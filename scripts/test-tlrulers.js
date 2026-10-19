#!/usr/bin/env node
/* bitGen Studio — 2.446.0 units: RULERS, GUIDELINES AND SNAPPING on the timeline's preview canvas (tlgrid.js): the
 * ruler's numbered steps, snapping a moved box to targets, the guideline under the pointer; the wiring. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const T = require(path.join(ROOT, "ext", "timelinedock", "tlgrid.js"));
check("rulerStep: 1-2-5 numbered steps at least 60 screen px apart", T.rulerStep(1) === 100 && T.rulerStep(0.25) === 500 && T.rulerStep(4) === 20 && T.rulerStep(0.6) === 100 && T.rulerStep(12) === 5);
check("snapAxis: the nearest target within reach of any candidate; none = null", JSON.stringify(T.snapAxis([10, 50], [53, 200], 5)) === '{"d":3,"v":53}' && T.snapAxis([10], [30], 5) === null);
const r = T.snapBox({ cx: 100, cy: 50, w: 40, h: 20 }, [0, 118, 200], [0, 58], 5);
check("snapBox: the moved box's left / centre / right onto a vertical target, top / centre / bottom onto a horizontal one (the shift + where)", r.dx === -2 && r.dy === -2 && r.x === 118 && r.y === 58, r);
check("...out of reach: no shift", JSON.stringify(T.snapBox({ cx: 100, cy: 50, w: 40, h: 20 }, [300], [300], 5)) === '{"dx":0,"dy":0,"x":null,"y":null}');
check("guideAt: the guideline under a point (the nearest within reach), else -1", T.guideAt([{ o: "h", p: 30 }, { o: "v", p: 60 }], 61, 0, 3) === 1 && T.guideAt([{ o: "h", p: 30 }], 0, 33, 3) === 0 && T.guideAt([{ o: "h", p: 30 }], 0, 40, 3) === -1);
const TG = read("ext", "timelinedock", "tlgrid.js"), CV = read("ext", "timelinedock", "canvas.js");
check("the wiring: 📏 #tlRulerBtn after ⊞, the rulers #tlRulerTop / #tlRulerLeft in the canvas box, tl.guides saved with the timeline (tlSave), the Move tool's drag asks TlGrid.snapMove (Alt = free), ui.tl_rulers",
  /rbtn\.id = "tlRulerBtn"/.test(TG) && /rt\.id = "tlRulerTop"/.test(TG) && /rl\.id = "tlRulerLeft"/.test(TG) && /tl\.guides/.test(TG) && /tlSave\(\)/.test(TG) && /ev\.altKey\) return null/.test(TG)
  && /TlGrid\.snapMove\(\{ cx: S\.W \/ 2 \+ nx/.test(CV) && /ly: h\.Ly\.kind/.test(CV) && /tl_rulers/.test(TG));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
