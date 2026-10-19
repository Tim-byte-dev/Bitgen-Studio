#!/usr/bin/env node
// Unit tests for lib/camera.js — the camera preset vocabulary.
// Run: node scripts/test-camera.js
//
// What is being pinned here is not "does it join strings". It is the two rules
// that make the difference between a picker that improves a picture and one
// that quietly makes it worse: a FIXED output order (prompt order matters to
// every model in this app, and clicking lens-then-framing must not render
// differently from framing-then-lens), and ONE PICK PER GROUP (two framings is
// a contradiction a diffusion model averages, not a richer instruction).
const fs = require("fs");
const path = require("path");
const C = require(path.join(__dirname, "..", "lib", "camera"));

let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log("PASS: " + n); };
const bad = (n, got) => { fail++; console.log("FAIL: " + n + "\n      got " + JSON.stringify(got)); };
const check = (n, cond, got) => (cond ? ok(n) : bad(n, got));

// ------------------------------------------------------------------- the file
{
  const raw = JSON.parse(fs.readFileSync(C.FILE, "utf8"));
  check("the vocabulary is a FILE, so it can be edited without touching code",
    fs.existsSync(C.FILE), C.FILE);
  const all = C.all();
  for (const g of C.GROUPS) {
    check(`the ${g} group has entries`, all[g].length > 0, all[g].length);
    check(`...every ${g} entry has an id, a label and the words it contributes`,
      all[g].every((e) => e.id && e.label && e.text), all[g].find((e) => !e.text));
  }
  const ids = C.GROUPS.flatMap((g) => all[g].map((e) => e.id));
  check("IDS ARE UNIQUE ACROSS GROUPS — find() searches all of them, and a "
    + "duplicate would resolve to whichever group came first",
    new Set(ids).size === ids.length,
    ids.filter((x, i) => ids.indexOf(x) !== i));
  check("only movements are marked video-only — a lens is a lens either way",
    C.GROUPS.every((g) => g === "move" || all[g].every((e) => !e.video)), null);
  check("every movement IS marked video-only",
    all.move.every((e) => e.video === true), all.move.filter((e) => !e.video));
  void raw;
}

// ------------------------------------------------------------------- listing
{
  const v = C.list("video");
  const i = C.list("image");
  check("video offers movements", v.move.length > 0, v.move.length);
  check("A STILL IS OFFERED NO MOVEMENT — a control that does nothing teaches "
    + "people the picker is decorative", i.move.length === 0, i.move.length);
  check("...but keeps framing, angle and lens",
    i.shot.length === v.shot.length && i.angle.length === v.angle.length
    && i.lens.length === v.lens.length, null);
  check("an unknown mode is treated as a still, not as video",
    C.list("banana").move.length === 0, null);
  check("list() does not hand out the cache for callers to mutate",
    (() => { const a = C.list("video"); a.shot.length = 0;
             return C.list("video").shot.length > 0; })(), null);
}

// -------------------------------------------------------------------- phrase
{
  const p = C.phrase(["mcu", "low", "85", "push"]);
  check("a full selection reads like a shot list",
    /^medium close-up, low angle/.test(p) && /85mm/.test(p) && /dolly push in/.test(p), p);
  // THE ORDER IS FIXED, NOT THE CLICK ORDER.
  check("framing comes before angle before lens before movement, whatever "
    + "order they were picked in",
    C.phrase(["push", "85", "low", "mcu"]) === p, C.phrase(["push", "85", "low", "mcu"]));
  check("an object selection gives the same phrase as the id list",
    C.phrase({ shot: "mcu", angle: "low", lens: "85", move: "push" }) === p, null);
  check("a partial selection is fine — most prompts want a lens or an angle, "
    + "not all four", C.phrase(["85"]).length > 0 && !/angle/.test(C.phrase(["85"])),
    C.phrase(["85"]));
  check("nothing picked is an empty phrase, not a stray comma",
    C.phrase([]) === "" && C.phrase({}) === "", [C.phrase([]), C.phrase({})]);
  // ONE PER GROUP, enforced here too and not only by the radio-button UI.
  check("TWO FRAMINGS CANNOT BOTH GET THROUGH — a saved style or a hand-made "
    + "request must not smuggle a contradiction past the picker",
    (C.phrase(["cu", "ws"]).match(/shot/g) || []).length <= 1, C.phrase(["cu", "ws"]));
  check("...and the first one wins, predictably",
    C.phrase(["cu", "ws"]) === C.phrase(["cu"]), C.phrase(["cu", "ws"]));
  check("a movement is dropped for a still rather than rendered as motion blur",
    !/dolly/.test(C.phrase(["mcu", "push"], "image")), C.phrase(["mcu", "push"], "image"));
  check("...while the rest of that selection survives",
    C.phrase(["mcu", "push"], "image") === C.phrase(["mcu"], "image"), null);
  check("an unknown id is ignored, not printed",
    C.phrase(["mcu", "nope"]) === C.phrase(["mcu"]), C.phrase(["mcu", "nope"]));
  check("junk input does not throw on the way to a render",
    C.phrase(null) === "" && C.phrase(undefined) === ""
    && C.phrase([null, 7, {}]) === "", null);
}

// ---------------------------------------------------------------------- find
{
  check("find returns the entry and which group it came from",
    C.find("85").group === "lens" && /85mm/.test(C.find("85").text), C.find("85"));
  check("find is null for something that is not a preset",
    C.find("definitely-not-a-preset") === null, C.find("definitely-not-a-preset"));
}

// -------------------------------- every preset has a preview to draw with
{
  const html = fs.readFileSync(
    path.join(__dirname, "..", "static", "index.html"), "utf8");
  const block = html.slice(html.indexOf("const CAMSVG"), html.indexOf("function camSvg"));
  const all = C.all();
  const missing = [];
  for (const g of C.GROUPS) {
    for (const e of all[g]) {
      // ids are used as object keys; numeric ones are unquoted
      if (!new RegExp(`(^|[\\s{,])["']?${e.id}["']?\\s*:`, "m").test(block)) {
        missing.push(g + "/" + e.id);
      }
    }
  }
  check("EVERY preset has a preview diagram — a tile with an empty frame in a "
    + "grid of drawings reads as a broken one", missing.length === 0, missing);
}

console.log("=======================");
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
