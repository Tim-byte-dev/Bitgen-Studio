#!/usr/bin/env node
/* bitGen Studio — 2.611.0 (pure + wiring): ▯ FRAME - click a frame on a layer to select it, Del removes it.
 * Tim: "can we add a click frame to select frame and del button deletes it".
 *   ext/timelinedock/tlframe.js  frameAt, span, describe; the click / drag / Shift+click, Del / ⌫ / Esc / ← →
 *   edittools.js  the ▯ mode (its own pointer handling stays off)   tlkeys.js  F + Del in the list
 *   tlrange.js    Shift+click left to ▯ Frame while it is on; the row says which frame(s) */
"use strict";
const fs = require("fs");
const path = require("path");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const read = (p) => fs.readFileSync(path.join(R, p), "utf8");
const F = require(path.join(R, "ext", "timelinedock", "tlframe.js"));

check("frameAt: the frame a time is in - a time on a frame's edge is that frame (no float slip), never below 0",
  F.frameAt(1, 24) === 24 && F.frameAt(0.999, 24) === 23 && F.frameAt(25 / 24, 24) === 25 && F.frameAt(1.5, 30) === 45 && F.frameAt(-2, 24) === 0 && F.frameAt(0.1, 0) === 2);
check("span: frames f0..f1 in either order, both in - one frame is 1/fps long",
  JSON.stringify(F.span(5, 3, 24)) === JSON.stringify({ a: 3 / 24, b: 6 / 24, f0: 3, n: 3 }) && F.span(10, 10, 25).n === 1 && Math.abs(F.span(10, 10, 25).b - F.span(10, 10, 25).a - 0.04) < 1e-9);
check("describe: \"frame 12\" / \"frames 3–5 (3)\" for a frame selection, nothing for a ruler or layer range",
  F.describe({ frame: true, a: 0.5, b: 0.5 + 1 / 24 }, 24) === "frame 12" && F.describe({ frame: true, a: 3 / 24, b: 6 / 24 }, 24) === "frames 3–5 (3)" && F.describe({ a: 0, b: 1, layer: true }, 24) === "" && F.describe(null, 24) === "");

const S = read("ext/timelinedock/tlframe.js");
check("the page: a press on a layer's track in ▯ Frame selects frames (drag = several, Shift+click from the selected one), marker to it, the clip's own press and click kept off",
  /function onDown\(e\)/.test(S) && /e\.stopImmediatePropagation\(\);\s*swallow = true/.test(S) && /if \(e\.shiftKey && cur && cur\.frame && T\.selLayer === lk\)/.test(S) && /T\.sel = \{ a: s\.a, b: s\.b, layer: true, frame: true, f0: s\.f0 \}/.test(S) && /tlSeek\(s\.a\)/.test(S) && /document\.addEventListener\("click", onClick, true\)/.test(S));
check("Del / ⌫ over the layers: the timeline's own ✂ Cut of that layer range with ripple ON, the box put back as it was (one ↶); Esc drops it; ← / → move it a frame (Shift: its end)",
  /e\.key === "Delete" \|\| e\.key === "Backspace"/.test(S) && /rp\.checked = true;\s*try \{ await applySel\("cut"\); \} finally \{ if \(rp\) rp\.checked = was; \}/.test(S) && /e\.key === "Escape"/.test(S) && /e\.key === "ArrowLeft" \|\| e\.key === "ArrowRight"/.test(S) && /dialog\[open\]/.test(S) && /typing\(\)/.test(S));
const ED = read("ext/timelinedock/edittools.js"), K = read("ext/timelinedock/tlkeys.js"), RG = read("ext/timelinedock/tlrange.js");
check("edittools: ▯ is the sixth tool (its own drags stay off in it); tlkeys: F turns it on, F + Del in the shortcut list",
  /\["frame", "▯", "Frame \(F\)/.test(ED) && /mode === "select" \|\| mode === "frame"/.test(ED) && /f: "frame"/.test(K) && /\["F", "▯ Frame tool/.test(K) && /\["Del \/ ⌫"/.test(K));
check("tlrange: Shift+click is ▯ Frame's while it is on; the row's label names the frame(s)",
  /TlEdit\.mode\(\) === "frame"\) return;/.test(RG) && /TlFrame\.describe\(s, fps\(\)\)/.test(RG));
const ej = JSON.parse(read("ext/timelinedock/ext.json")).scripts;
check("tlframe.js loads (after edittools / tlkeys / tlrange)", ej.includes("tlframe.js") && ej.indexOf("tlframe.js") > ej.indexOf("edittools.js") && ej.indexOf("tlframe.js") > ej.indexOf("tlkeys.js"));
check("server.js untouched by this release", !/tlframe|TlFrame/.test(read("misc/server.js")));

console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
