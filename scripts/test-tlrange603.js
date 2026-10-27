#!/usr/bin/env node
/* bitGen Studio — scripts/test-tlrange603.js (2.603.0): the timeline's LAYER RANGE (the marker, then Shift+click) and
 * its UNDO - the pure part + the wiring (ext/timelinedock/tlrange.js).
 * Tim: "lets drag the timeline marker to the start of the range then shift+click on a different part of the layer and
 * that will be our range in that layer - cut will remove the range in the selected layer only completely(must be able
 * to undo)". */
"use strict";
const fs = require("fs");
const path = require("path");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
try {
  const R = require("../ext/timelinedock/tlrange.js");
  check("rangeOf: the marker to the click, either way round, on frames", JSON.stringify(R.rangeOf(2, 6.01, 24)) === JSON.stringify({ a: 2, b: 6 }) && JSON.stringify(R.rangeOf(6, 2, 24)) === JSON.stringify({ a: 2, b: 6 }));
  check("…shorter than a frame = no range; never below 0", R.rangeOf(3, 3.01, 24) === null && R.rangeOf(-1, 1, 24).a === 0);
  const H = R.Hist(3);
  H.push("A"); H.push("B");
  const u1 = H.undo("C"), u2 = H.undo("B"), u3 = H.undo("A");
  const r1 = H.redo("A"), r2 = H.redo("B");
  check("Hist: undo walks back (C -> B -> A), redo forward again, nothing left = null", u1 === "B" && u2 === "A" && u3 === null && r1 === "B" && r2 === "C");
  H.clear(); H.push("1"); H.push("2"); H.push("3"); H.push("4");
  check("…keeps the last N; a new edit drops the redo steps", JSON.stringify(H.sizes()) === "[3,0]" && (H.undo("5"), H.push("x"), H.sizes()[1] === 0));
  const T = rd("ext", "timelinedock", "tlrange.js"), IH = rd("static", "index.html"), EXT = JSON.parse(rd("ext", "timelinedock", "ext.json")).scripts;
  const W = {
    "ext.json loads tlrange.js (after timelinedock.js)": EXT.indexOf("tlrange.js") > EXT.indexOf("timelinedock.js"),
    "Shift+press on a track: the range from the position marker, the layer picked, marked a layer range": /var t0 = tAt\(e\), anchor = ph\(\)/.test(T) && /T\.sel\.layer = true; T\.selLayer = d\.lk/.test(T) && /pickLayer\(lk\)/.test(T),
    "applySel: a layer range = scope layer (the whole range on that layer), whatever the scope box says": /const scope = tl\.sel\.layer \? "layer" :/.test(IH),
    "undo: tlSave is watched (a 400 ms burst = one step), ↶ / ↷ buttons, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y over the layers": /wrap\("tlSave", track\)/.test(T) && /Date\.now\(\) - lastAt > 400/.test(T) && /mk\("tlUndo", "↶"\)/.test(T) && /k === "y" \|\| e\.shiftKey\) redo\(\); else undo\(\)/.test(T),
    "the selection is not an edit (undo keeps it out)": /T\.sel = undefined; T\.selLayer = undefined/.test(T),
    "a ruler drag is a plain selection again": /root\.dragSelect = w2/.test(T),
  };
  const miss = Object.keys(W).filter((k) => !W[k]);
  check("wired: " + Object.keys(W).join(" · "), miss.length === 0, miss);
} catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
