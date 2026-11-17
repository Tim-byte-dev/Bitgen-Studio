#!/usr/bin/env node
/* bitGen Studio — 2.819.0 units: the image editor's Ctrl+Shift+A (every selection cleared), the selection's line while
 * drawing, one shape mode for every tool, double-click = the Move tool's handles (no box), a click again = rotate
 * (ext/imageeditdock/pcpickmodes.js + pchandles.js). */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const M = require(path.join(ROOT, "ext", "imageeditdock", "pcpickmodes.js"));
const H = require(path.join(ROOT, "ext", "imageeditdock", "pchandles.js"));

check("MODES: new, add, subtract, intersect, exclude - each with its sign", M.MODES.join() === "new,add,subtract,intersect,exclude" && M.MODES.every((m) => M.GLYPH[m] && M.NAMES[m]));
check("syncedOps: one mode for the Shape tool, the curve tools and the Pen", JSON.stringify(M.syncedOps("subtract")) === JSON.stringify({ shapeOp: "subtract", drawOp: "subtract", penOp: "subtract" }));
check("…Replace is the Shape tool's own (the others draw new)", JSON.stringify(M.syncedOps("replace")) === JSON.stringify({ shapeOp: "replace", drawOp: "new", penOp: "new" }) && M.syncedOps("bogus").shapeOp === "new");
const S = { shapeOp: "add", drawOp: "intersect", penOp: "exclude", penMode: "shape" };
check("opFor: the mode the tool in hand draws in", M.opFor("shape", S) === "add" && M.opFor("crect", S) === "intersect" && M.opFor("pen", S) === "exclude" && M.opFor("lasso", S) === "new");
check("…the Pen drawing a PATH: no shape mode", M.opFor("pen", Object.assign({}, S, { penMode: "path" })) === "new");
check("CLOSED_TOOLS: the tools a mode button can bring back draw closed shapes (no open line tools)", M.CLOSED_TOOLS.includes("shape") && M.CLOSED_TOOLS.includes("crect") && !M.CLOSED_TOOLS.includes("bezier") && !M.CLOSED_TOOLS.includes("freehand") && M.CLOSED_TOOLS.every((t) => M.DRAW_TOOLS.includes(t)));
check("rubberOf: Polygonal Lasso - the last point on to the pointer", JSON.stringify(M.rubberOf("poly", [[0, 0], [10, 0]], [10, 20], false)) === "[10,0,10,20]" && M.rubberOf("poly", [[0, 0]], null, false) === null);
check("rubberOf: Lasso while dragging - its end back to its start; not before 3 points, not after letting go", JSON.stringify(M.rubberOf("lasso", [[0, 0], [5, 5], [9, 1]], null, true)) === "[9,1,0,0]" && M.rubberOf("lasso", [[0, 0], [5, 5]], null, true) === null && M.rubberOf("lasso", [[0, 0], [5, 5], [9, 1]], null, false) === null);
check("rubberOf: nothing for other tools / no points", M.rubberOf("rect", [[0, 0], [1, 1], [2, 2]], [3, 3], true) === null && M.rubberOf("poly", [], [1, 1], false) === null);
check("handles nextMode: a click on the picked object switches scale <-> rotate, elsewhere = scale", H.nextMode("scale", true) === "rotate" && H.nextMode("rotate", true) === "scale" && H.nextMode("rotate", false) === "scale" && H.nextMode("scale", false) === "scale");

const PM = read("ext", "imageeditdock", "pcpickmodes.js"), HD = read("ext", "imageeditdock", "pchandles.js"), TL = read("ext", "imageeditdock", "pctools.js"), IE = read("ext", "imageeditdock", "imageedit.js");
const UI = read("ext", "imageeditdock", "pcui.js"), DK = read("ext", "imageeditdock", "pcdockers.js"), VL = read("ext", "imageeditdock", "pcvline.js"), PN = read("ext", "imageeditdock", "pcpen.js");
const EXT = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts;
check("Select ▸ Clear All Selections = Shift+Ctrl+A (after Deselect); Align and Distribute has no key now; the hidden Krita deselect gone",
  /E\.ui\.addCmd\("sel\.clearall", "Clear All Selections", "Shift\+Ctrl\+A", clearAll, \{ enabled: \(\) => !!S\.w \}, \["Select", "sel\.none"\]\)/.test(PM) && /C\("dk\.align", "Dockers: Align and Distribute", "",/.test(DK) && !/sel\.none2/.test(UI));
check("…it clears the area, the picked objects, the picks in Layers and the pen / curve tools' picked nodes (their hooks)",
  /E\.deselect\(\)/.test(PM) && /E\.multi\.clear\(\)/.test(PM) && /E\.selHl\.deselect\(\)/.test(PM) && /S\.picks = \[\]/.test(PM) && /E\.clearSelHooks/.test(PM)
  && /\(E\.clearSelHooks = E\.clearSelHooks \|\| \[\]\)\.push\(\(\) => \{ asel\.clear\(\); csel\.clear\(\); \}\)/.test(PN) && /\(E\.clearSelHooks = E\.clearSelHooks \|\| \[\]\)\.push\(\(\) => nsel\.clear\(\)\)/.test(VL));
check("the lasso's line: black under the white dashes (imageedit drawOverlay)", /g\.strokeStyle = "#000"; g\.lineWidth = 1\.5 \* px; g\.setLineDash\(\[\]\); g\.stroke\(\);\n\s+g\.strokeStyle = "#fff"; g\.lineWidth = px; g\.setLineDash\(\[3 \* px, 3 \* px\]\); g\.stroke\(\);/.test(IE));
check("the Bézier tool's next segment follows the pointer too (not only the Pen's)", /if \(bz\.hover && !bz\.drag\) \{/.test(VL) && !/bz\.tool === "cpen" && bz\.hover/.test(VL));
check("the modes: the tools' own buttons sync the others; the property bar's ◻ ⊕ ⊖ ⊗ ⊘ go into the mode (the shape tool on)",
  /closest\("\[data-pnshop\],\[data-dop\],\[data-pnop\],\[data-pmmode\]"\)/.test(PM) && /E\.propbar\.extras\.push/.test(PM) && /E\.setTool\(CLOSED_TOOLS\.includes\(lastDraw\)/.test(PM));
check("no box round the picked layer: pchandles draws no strokeRect, pctools' Move-tool box is gone", !/g\.strokeRect\(b\.x, b\.y, b\.w, b\.h\)/.test(HD) && !/the bounding box of a text \/ shape layer while the move tool is on it/.test(TL));
check("handles: a click on the picked object switches them, a double-click = scale; double-click on a row in Layers / with no tool = transform",
  /setMode\(nextMode\(st\.mode, st\.click\.same\)\)/.test(HD) && /stage\.addEventListener\("dblclick", \(\) => \{\n\s+if \(S\.tool !== "move" \|\| !shown\(\)\) return;\n\s+setMode\("scale"\);/.test(HD)
  && /row\.addEventListener\("dblclick"/.test(PM) && /const DBL_TOOLS = \["none", "objsel"\]/.test(PM));
check("ext.json: pcpickmodes.js right after pcshapeops.js; installed after PCShapeOps (and the property bar)", EXT.indexOf("pcpickmodes.js") === EXT.indexOf("pcshapeops.js") + 1
  && IE.indexOf("PCPickModes.install(E)") > IE.indexOf("PCShapeOps.install(E)") && IE.indexOf("PCPickModes.install(E)") > IE.indexOf("PCPropBar.install(E)"));
check("server.js untouched", !/pcpickmodes|clearall/i.test(read("misc", "server.js")));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
