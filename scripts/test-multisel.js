#!/usr/bin/env node
/* bitGen Studio — 2.474.0 units: NO TOOL, THE SELECTION BOX, SEVERAL LAYERS PICKED (ext/imageeditdock/pcmultisel.js) -
 * the pure parts + the wiring (pcselhl.js, pcui.js's Layers panel, the core's Move tool).
 * Tim (verbatim): "esc deselects all tools. when no tool selected click and drag shows a dashed bounding box that selects
 * everything in the bounding box. shift + select layer in layer docker selects every layer between the 2 shift+click
 * layers, ctrl+click adds or removes layers from the selection. del deletes all selected layers." */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, ok, got) => { if (ok) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got))); } };
const M = require(path.join(ROOT, "ext", "imageeditdock", "pcmultisel.js"));
const boxes = [{ id: 1, b: { x: 50, y: 50, w: 100, h: 80 } }, { id: 2, b: { x: 200, y: 60, w: 100, h: 80 } }, { id: 3, b: { x: 400, y: 250, w: 120, h: 100 } }, { id: 4, b: { x: 0, y: 0, w: 0, h: 0 } }];
check("norm: any drag direction -> x, y, w, h", JSON.stringify(M.norm({ x0: 320, y0: 160, x1: 30, y1: 30 })) === JSON.stringify({ x: 30, y: 30, w: 290, h: 130 }));
check("boxPick window (left to right): only what is wholly inside", M.boxPick(boxes, { x0: 30, y0: 30, x1: 320, y1: 160 }, false).join() === "1,2" && M.boxPick(boxes, { x0: 30, y0: 30, x1: 250, y1: 160 }, false).join() === "1");
check("boxPick crossing (right to left): what it touches; an empty box is never picked", M.boxPick(boxes, { x0: 560, y0: 380, x1: 280, y1: 100 }, true).join() === "2,3" && !M.boxPick(boxes, { x0: 0, y0: 0, x1: 600, y1: 400 }, true).includes(4));
check("rangeIds: every id between the two (either order), one alone when the other is gone", M.rangeIds([9, 8, 7, 6, 5], 8, 6).join() === "8,7,6" && M.rangeIds([9, 8, 7, 6, 5], 5, 8).join() === "8,7,6,5" && M.rangeIds([9, 8], 1, 8).join() === "8");
const PM = read("ext", "imageeditdock", "pcmultisel.js"), SH = read("ext", "imageeditdock", "pcselhl.js"), UI = read("ext", "imageeditdock", "pcui.js"), IE = read("ext", "imageeditdock", "imageedit.js"), EXT = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts;
check("Esc = no tool after the tool's own Esc and the core's pending things (a polygon lasso, AI results, the mask view); Esc again = the old Esc; Del with several picked = all of them in one step",
  /k === "escape"/.test(PM) && /S\.pts && S\.pts\.length\) \|\| \(S\.results && S\.results\.length\) \|\| S\.viewMask \|\| S\.drag/.test(PM) && /E\.setTool\("none"\)/.test(PM) && /E\.structOp\("delete layers"/.test(PM) && /list\(\)\.length > 1\) \{ deleteAll\(\); return true; \}/.test(PM));
check("no tool = E.tools.none: a click picks (Shift / Ctrl adds), a drag = the dashed box (blue window, green crossing)", /E\.tools\.none = \{/.test(PM) && /setLineDash\(\[6 \* px, 4 \* px\]\)/.test(PM) && /crossing \? "#3fb950" : "#3aa0ff"/.test(PM));
check("pcselhl: hover / outlines with no tool too (2.605.0: HOVER_TOOLS - and the drawing tools); Shift / Ctrl-click toggles; a press on one of several picked moves them all; a click on nothing clears the picks",
  /const HOVER_TOOLS = \["move", "none"\]/.test(SH) && /M\.toggle\(L\)/.test(SH) && /M\.count\(\) > 1 && M\.hit\(x, y\)/.test(SH) && /if \(M && M\.count\(\)\) M\.clear\(\);/.test(SH));
check("the Layers panel: Ctrl-click toggles, Shift-click = the range from the last clicked, a plain click = one", /E\.multi\.toggle\(Ly\)/.test(UI) && /P\.rangeIds\(order, from, Ly\.id\)/.test(UI) && /S\.pickAnchor = Ly\.id; if \(S\.picks && S\.picks\.length\) S\.picks = \[\];/.test(UI));
check("the core's Move tool moves every picked layer (moveSet.multi, one undo step); pcmultisel after pcselhl in ext.json and installed after it",
  /E\.multiMove \? E\.multiMove\(fx, fy\)/.test(IE) && /all = d\.multi \? d\.multi :/.test(IE) && EXT.indexOf("pcmultisel.js") === EXT.indexOf("pcselhl.js") + 1 && IE.indexOf("PCMultiSel.install(E)") > IE.indexOf("PCSelHl.install(E)"));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
