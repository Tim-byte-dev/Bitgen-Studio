#!/usr/bin/env node
/* bitGen Studio — scripts/test-selhl605.js (2.605.0): HOVER = THE MOVE TOOL'S THIN FRAME, a CLICK with a drawing tool picks
 * + the Move tool - the pure part + the wiring (ext/imageeditdock/pcselhl.js, ext/timelinedock/tlselhl.js), and the
 * shape Ops defaults that were inside a comment (pcpen.js - a second shape drawn while one was picked was lost).
 * Tim: "when user hovers over text don't show the thick bounding box,do this with all drawing objects show the same one
 * as the move tool, if user clicks on the element select it and automatically go to the move tool." */
"use strict";
const fs = require("fs");
const path = require("path");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
try {
  const H = require("../ext/imageeditdock/pcselhl.js");
  check("HOVER_TOOLS: the Move tool, no tool, every drawing tool and the Type tools", ["move", "none", "shape", "crect", "line2", "type", "vtype"].every((t) => H.HOVER_TOOLS.includes(t)) && !H.HOVER_TOOLS.includes("paint") && !H.HOVER_TOOLS.includes("rect"), H.HOVER_TOOLS);
  check("TYPE_TOOLS: type + vtype (they show the frame on texts only)", JSON.stringify(H.TYPE_TOOLS) === '["type","vtype"]');
  const SL = rd("ext", "imageeditdock", "pcselhl.js"), PP = rd("ext", "imageeditdock", "pcpen.js"), TS = rd("ext", "timelinedock", "tlselhl.js"), CV = rd("ext", "timelinedock", "canvas.js"), PT = rd("ext", "imageeditdock", "pctools.js");
  const W = {
    "image editor: the frame = the handles' (#2680eb, 1 px, 4 / 3 dashes) for hover and a picked object with no tool; the thick outline gone": /g\.strokeStyle = "#2680eb"; g\.lineWidth = 1 \* px; g\.setLineDash\(\[4 \* px, 3 \* px\]\)/.test(SL) && !/function outline\(/.test(SL) && /if \(hover && hover !== sel && S\.layers\.includes\(hover\)\) frame\(g, hover, px\)/.test(SL),
    "image editor: a click (no drag) with a drawing tool on an object picks it + the Move tool": /if \(click && d\.obj && S\.layers\.includes\(d\.obj\) && S\.tool === d\.tool\)/.test(SL) && /E\.setTool\("move"\); S\.objSel = true; lastActive = S\.active; hover = null/.test(SL),
    "image editor: a text is hit anywhere in its box": /a TEXT is hit anywhere in its box/.test(SL),
    "image editor: the Move tool's box not left behind after a click on empty canvas": /S\.tool !== "move" \|\| S\.objSel === false \|\|/.test(PT),
    "pcpen: S.cshape / S.shapeOp set (they were inside a comment) + no Ops = a new layer": /^    S\.cshape = store\.get\("pen\.cshape", "heart"\); S\.shapeOp = store\.get\("pen\.shapeop", "new"\);$/m.test(PP) && /const op = S\.shapeOp && Q\.OP_NAMES && Q\.OP_NAMES\[S\.shapeOp\] \? S\.shapeOp : "new";/.test(PP),
    "timeline: hover with the Move / Text / Shape / Freehand tools = the picked frame (1 px dashed); the press on an object held back (click = pick + Move, drag = the tool draws)": /var HOVER_TOOLS = \["move", "text", "shape", "freehand"\]/.test(TS) && /ctx\.setLineDash\(\[4, 3\]\)/.test(TS) && /d\.started = true;/.test(TS) && /extTool: function \(id\)/.test(CV),
  };
  const miss = Object.keys(W).filter((k) => !W[k]);
  check("wired: " + Object.keys(W).join(" · "), miss.length === 0, miss);
} catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
