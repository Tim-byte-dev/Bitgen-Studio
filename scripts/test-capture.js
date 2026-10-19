#!/usr/bin/env node
// Behavioral tests for the timeline CAPTURE RESOLVER (captureAt) in
// static/index.html — 2.117.0, Tim: "allow first and last and ref image to be
// selected from the selected video or picture layer in timeline, i think that
// it is not looking past the first video layer or it is not reading to the
// last frame of all the layers".
//
// The functions are EXTRACTED FROM THE SHIPPED SOURCE and executed in a vm —
// not reimplemented here — so these tests fail if the UI's real logic
// regresses, not a copy of it. Run: node scripts/test-capture.js
const fs = require("fs");
const path = require("path");
const PAGE = require("../lib/extensions").pageHtml(require("path").join(__dirname, ".."));

const vm = require("vm");

const HTML = PAGE;

let pass = 0, fail = 0;
const check = (n, cond, got) => cond
  ? (pass++, console.log("PASS: " + n))
  : (fail++, console.log("FAIL: " + n + (got !== undefined ? "\n      got " + JSON.stringify(got) : "")));

// ---- pull named function/const definitions out of the inline script -------
function slice(name) {
  let i = HTML.indexOf("function " + name + "(");
  if (i >= 0) {
    const open = HTML.indexOf("{", i);
    let d = 0, j = open;
    for (; j < HTML.length; j++) {
      if (HTML[j] === "{") d++;
      else if (HTML[j] === "}" && --d === 0) break;
    }
    return HTML.slice(i, j + 1);
  }
  i = HTML.indexOf("const " + name + " =");
  if (i >= 0) {
    // arrow consts here are one-liners — take the line
    return HTML.slice(i, HTML.indexOf("\n", i));
  }
  throw new Error("cannot find " + name + " in the assembled page");
}

const NAMES = ["lkKind", "lkLayer", "lkClips", "lkExists", "clipsOf",
               "allClips", "v1", "effDur", "imgLen", "captureAt"];
const SRC = "const TLFPS = 24;\n"
  + "const CAP_EPS = 0.5 / TLFPS + 1e-6;\n"
  + "const LDEF = { opacity: 1, live: true };\n"
  + NAMES.map(slice).join("\n") + "\n";

function world(tlPatch) {
  const ctx = { tl: Object.assign({
    video: [], v1: { name: "V1", opacity: 1, live: true }, vlayers: [],
    audio: [], images: [], selLayer: null,
  }, tlPatch) };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return ctx;
}
const cap = (ctx, t) => vm.runInContext(`captureAt(${t})`, ctx);

const vclip = (name, start, dur, src, inn) =>
  ({ name, start, in: inn || 0, out: (inn || 0) + dur, dur: (inn || 0) + dur, opacity: 1, src: src || "output" });
const layer = (name, clips) => ({ name, clips, opacity: 1, live: true });
const iclip = (name, start, len) => ({ name, start, len, opacity: 1 });

// ---------------------------------------------------------------- the bug
{
  // V1: a.webm 0→5 · V2 overlay: b.webm 5→9 — the playhead past V1's end
  // MUST find the overlay clip (the "not looking past the first video layer")
  const ctx = world({ video: [vclip("a.webm", 0, 5)],
                      vlayers: [layer("V2", [vclip("b.webm", 5, 4)])] });
  const r = cap(ctx, 6.5);
  check("past V1's end: the overlay layer's clip is found",
    r && r.kind === "video" && r.clip === "b.webm" && Math.abs(r.off - 1.5) < 1e-6, r);
}
{
  // playhead parked at the very end of everything: the LAST frame of the
  // last clip, not "not over a clip" (the "not reading to the last frame")
  const ctx = world({ video: [vclip("a.webm", 0, 5)],
                      vlayers: [layer("V2", [vclip("b.webm", 5, 4)])] });
  const r = cap(ctx, 9);
  check("exact composition end: the last clip's FINAL frame is captured",
    r && r.clip === "b.webm" && Math.abs(r.off - (4 - 1 / 24)) < 1e-6, r);
  const r2 = cap(ctx, 9.015);   // half-a-frame slack past the end still lands
  check("half a frame past the end still resolves (pixel-rounded playhead drags)",
    r2 && r2.clip === "b.webm", r2);
  check("well past the end is still refused", cap(ctx, 9.4) === null, cap(ctx, 9.4));
}
{
  // seam between adjacent clips on V1: the exact-hit pass wins for the NEXT
  // clip's first frame; the end-inclusive pass never shadows a real hit
  const ctx = world({ video: [vclip("a.webm", 0, 5), vclip("c.webm", 5, 3)] });
  const r = cap(ctx, 5);
  check("clip seam: the following clip's first frame wins the exact pass",
    r && r.clip === "c.webm" && Math.abs(r.off - 0) < 1e-6, r);
}

// ------------------------------------------------------- selected layer
{
  // V1 and V2 overlap; the SELECTED layer's clip wins
  const ctx = world({ video: [vclip("a.webm", 0, 8)],
                      vlayers: [layer("V2", [vclip("b.webm", 2, 4, "video")])],
                      selLayer: "vl:0" });
  const r = cap(ctx, 3);
  check("selected overlay layer beats V1 on overlap, and src rides along",
    r && r.clip === "b.webm" && r.src === "video" && Math.abs(r.off - 1) < 1e-6, r);
  vm.runInContext('tl.selLayer = "v1"', ctx);
  const r2 = cap(ctx, 3);
  check("selecting V1 flips the same moment back to V1's clip",
    r2 && r2.clip === "a.webm", r2);
}
{
  // a selected PICTURE layer hands over the image itself (off 0, kind image)
  const ctx = world({ video: [vclip("a.webm", 0, 8)],
                      images: [layer("I1", [iclip("still.png", 2, 3)])],
                      selLayer: "i:0" });
  const r = cap(ctx, 3);
  check("selected picture layer: the image itself is the capture",
    r && r.kind === "image" && r.clip === "still.png" && r.off === 0, r);
  // outside the image clip the selection falls through to V1
  const r2 = cap(ctx, 6);
  check("outside the selected image clip: falls through to the video layers",
    r2 && r2.kind === "video" && r2.clip === "a.webm", r2);
}
{
  // no selection: images are still found AFTER the video layers
  const ctx = world({ video: [], images: [layer("I1", [iclip("still.png", 0, 3)])] });
  const r = cap(ctx, 1);
  check("no selection: an image-only timeline still captures the picture",
    r && r.kind === "image" && r.clip === "still.png", r);
}
{
  // an AUDIO layer selection is not a capture source — falls through
  const ctx = world({ video: [vclip("a.webm", 0, 5)],
                      audio: [layer("A1", [{ name: "s.wav", start: 0, in: 0, out: 5 }])],
                      selLayer: "a:0" });
  const r = cap(ctx, 1);
  check("a selected audio layer falls through to the video layers",
    r && r.kind === "video" && r.clip === "a.webm", r);
}
{
  // src passthrough on V1 (project-asset clips were 404ing from /outputs/)
  const ctx = world({ video: [vclip("cam.mp4", 0, 5, "video")] });
  const r = cap(ctx, 2);
  check("V1 project-asset clip: src \"video\" is returned for the passets URL",
    r && r.src === "video", r);
}
{
  const ctx = world({});
  check("an empty timeline resolves to null", cap(ctx, 1) === null, cap(ctx, 1));
}

// ------------------------------------------- the UI wiring, source-level
check("setMarker uses captureAt (not the V1-only clipAt)",
  /const at = captureAt\(playhead\)/.test(HTML), null);
check("markers persist src and kind for restore-on-load",
  HTML.includes("M.refs.push({ id, clip: at.clip, off: at.off, t, src: at.src, kind: at.kind")
  && HTML.includes("M[kind] = { id, clip: at.clip, off: at.off, t, src: at.src, kind: at.kind"), null);
check("restore-on-load fetches image markers and passes src for video markers",
  HTML.includes('if (m.kind === "image")') && HTML.includes("grabFrame(m.clip, m.off, m.src)"), null);
check("the prompt dock title bar has the Clear button, wired",
  HTML.includes('id="promptClear"') && HTML.includes('$("promptClear") && ($("promptClear").onclick'), null);

console.log("=======================");
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
