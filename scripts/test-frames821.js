#!/usr/bin/env node
/* bitGen Studio — 2.821.0 units: the image editor - Insert Into Frame (the arrow, a click), the order items on the right-click
 * menu (a frame's layers stay in it), the Gradient tool on shapes / text (pcdoc.gradStyle), a real cut / join (bakeShape). */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const D = require(path.join(ROOT, "ext", "imageeditdock", "pcdoc.js"));

// a frame (id 3) holding 1 and 2, a picture 4 above it
const lay = () => [{ id: 0, name: "bg", type: "pixel" }, { id: 1, name: "a", type: "pixel", parent: 3 }, { id: 2, name: "b", type: "pixel", parent: 3 }, { id: 3, name: "F", type: "shape", shape: {}, frame: { lock: true } }, { id: 4, name: "top", type: "pixel" }];
const names = (L) => L.map((x) => x.name + (x.parent != null ? "<" + x.parent : "")).join(",");
let L = D.move(lay(), 2, 1);
check("Bring Forward at the top of a frame: it stays in the frame (unchanged)", names(L) === names(lay()), names(L));
L = D.move(lay(), 1, -1);
check("Send Backward at the bottom of a frame: it stays in the frame", names(L) === names(lay()), names(L));
L = D.move(lay(), 1, 1);
check("…inside the frame it moves among the frame's layers", names(L) === "bg,b<3,a<3,F,top", names(L));
L = D.moveEnd(lay(), 1, 1);
check("Bring to Front inside a frame = the frame's top layer", names(L) === "bg,b<3,a<3,F,top", names(L));
const grp = [{ id: 0, name: "bg", type: "pixel" }, { id: 1, name: "a", type: "pixel", parent: 3 }, { id: 3, name: "G", type: "group" }];
check("a plain group still lets a layer out at its edge (as before)", D.move(grp, 1, 1).find((x) => x.id === 1).parent == null);

// gradStyle with a stand-in canvas context
const calls = [];
const g = { createLinearGradient: (...a) => { calls.push(["lin", a]); return { addColorStop: (t, c) => calls.push(["stop", t, c]) }; }, createRadialGradient: (...a) => { calls.push(["rad", a]); return { addColorStop: (t, c) => calls.push(["stop", t, c]) }; } };
D.gradStyle(g, { fill: "#f00", fillGrad: { type: "linear", x0: 10, y0: 20, x1: 110, y1: 20, css: [[0, "rgba(0,0,0,1)"], [1, "rgba(255,255,255,1)"]] } }, { x: 0, y: 0, w: 200, h: 100 });
check("gradStyle: the drag's ends are the gradient's (picture px), its colour stops", JSON.stringify(calls[0]) === JSON.stringify(["lin", [10, 20, 110, 20]]) && calls.filter((c) => c[0] === "stop").length === 2, calls);
calls.length = 0; D.gradStyle(g, { fillGrad: { type: "radial", x0: 50, y0: 50, x1: 50, y1: 80, stops: [{ t: 0, c: "#ff0000", a: 1 }, { t: 1, c: "#0000ff", a: 0.5 }] } }, null);
check("…radial: round the start, the drag's length; {t, c, a} stops", JSON.stringify(calls[0]) === JSON.stringify(["rad", [50, 50, 0, 50, 50, 30]]) && calls[2][2] === "rgba(0,0,255,0.5)", calls);
check("…no gradient = the plain fill", D.gradStyle(g, { fill: "#123456" }, null) === "#123456");

const FR = read("ext", "imageeditdock", "pcframes.js"), TL = read("ext", "imageeditdock", "pctools.js"), DK = read("ext", "imageeditdock", "pcdockers.js");
const PN = read("ext", "imageeditdock", "pcpen.js"), PB = read("ext", "imageeditdock", "pcpropbar.js"), PP = read("ext", "imageeditdock", "pcpath.js"), BZ = read("ext", "imageeditdock", "pcbezier.js"), DC = read("ext", "imageeditdock", "pcdoc.js");
check("Insert Into Frame: the command, a thick black arrow cursor, a click = place(...) where they are, Esc = no", /C\("frame\.insert", "Insert Into Frame", "", startInsert/.test(FR) && /const ARROW = "url\(/.test(FR) && /E\.stage\.style\.cursor = ARROW/.test(FR) && /place\(ids\.map\(byId\)\.filter\(Boolean\), F, false\)/.test(FR) && /ins && e\.key === "Escape"/.test(FR));
check("…in the canvas menu, the Layers menu and Layer ▸ Frame", /items\.push\("frame\.insert", "frame\.place"\)/.test(FR) && /concat\(\["frame\.insert", "frame\.place"/.test(FR) && /items: \["frame\.insert", "frame\.place"/.test(FR));
check("the right-click menu: Bring to Front / Forward, Send Backward / to Back on the object clicked", /items\.push\(sep, "layer\.front", "layer\.forward", "layer\.backward", "layer\.back"\)/.test(FR));
check("the Gradient tool on a shape / a text = vecGradient (shape.fillGrad / Gradient Overlay), else pixels as before", /grad = \{ x0: fx, y0: fy, x1: fx, y1: fy, vec: L \}/.test(TL) && /if \(gd\.vec\) return vecGradient\(gd\.vec, gd\);/.test(TL) && /X\.shape\.fillGrad = \{ type: S\.gradType/.test(TL) && /X\.styles\.gradientOverlay = /.test(TL));
check("…shapes, paths and vector lines all draw shape.fillGrad (pcdoc.gradStyle)", /s\.fillGrad \? gradStyle\(g, s,/.test(DC) && /root\.PCDoc\.gradStyle\(g, s, bbox\(p\)\)/.test(PP) && /return root\.PCDoc\.gradStyle\(g, s, Q\.bbox\(area\)\)/.test(BZ));
check("a real cut / join: bakeShape after the Shape tool's and the property bar's modes", /function bakeShape\(L\)/.test(DK) && /if \(E\.bakeShape\) E\.bakeShape\(into\);/.test(PN) && /if \(E\.bakeShape\) E\.bakeShape\(T\);/.test(PB));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
