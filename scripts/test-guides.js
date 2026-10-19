#!/usr/bin/env node
/* bitGen Studio — 2.440.0 units: RULERS IN UNITS, GUIDELINES AND SNAPPING (ext/imageeditdock/pcguides.js). */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const G = require(path.join(ROOT, "ext", "imageeditdock", "pcguides.js"));
const K = require(path.join(ROOT, "ext", "imageeditdock", "pcdocs.js"));

check("units: px, mm, cm, in, pt at a dpi (96 px = 1 in = 25.4 mm = 72 pt)", G.toUnit(96, "in", 96) === 1 && Math.abs(G.toUnit(96, "mm", 96) - 25.4) < 1e-9 && Math.abs(G.toUnit(96, "pt", 96) - 72) < 1e-9 && G.fromUnit(2.54, "cm", 300) === 300 && G.toUnit(5, "px", 72) === 5);
check("gridStep: a set spacing, else the one drawn at the zoom", G.gridStep(25, 1) === 25 && G.gridStep(0, 1) === 32 && G.gridStep(0, 4) === 8);
const T = G.targetsOf({ on: { guides: 1, page: 1, objects: 1, nodes: 1, midpoints: 1, intersections: 1 }, guides: [{ o: "v", p: 100 }, { o: "h", p: 50 }], w: 400, h: 300,
  boxes: [{ x: 10, y: 10, w: 20, h: 20 }], paths: [{ subs: [{ closed: true, pts: [{ x: 200, y: 200 }, { x: 220, y: 200 }, { x: 220, y: 240 }] }] }] });
check("targetsOf: guidelines, the page's edges + centre, the boxes' edges + centres, nodes, midpoints (a closed shape: its closing side too), guideline × guideline / page intersections",
  T.xs.length === 7 && T.ys.length === 7 && T.pts.filter((p) => p.k === "node").length === 3 && T.pts.filter((p) => p.k === "midpoint").length === 3 && T.pts.filter((p) => p.k === "intersection").length === 9 && T.pts.some((p) => p.k === "page centre"), { xs: T.xs.length, ys: T.ys.length, pts: T.pts.map((p) => p.k) });
const off = G.targetsOf({ on: {}, guides: [{ o: "v", p: 100 }], w: 400, h: 300, boxes: [{ x: 1, y: 1, w: 2, h: 2 }], paths: [] });
check("...nothing switched on = nothing to snap to", off.xs.length + off.ys.length + off.pts.length === 0);
check("snapPoint: a point target within reach first (the guideline crossing)", JSON.stringify(G.snapPoint(103, 49, T, 5, 0)) === '{"x":100,"y":50,"hit":{"k":"intersection","x":100,"y":50}}');
check("...a node / a midpoint", G.snapPoint(219, 239, T, 5, 0).hit.k === "node" && G.snapPoint(211, 199, T, 5, 0).hit.k === "midpoint");
check("...else each axis to its nearest line (a vertical guideline: x only)", JSON.stringify(G.snapPoint(97, 170, T, 5, 0)) === '{"x":100,"y":170,"hit":{"k":"guideline","x":100,"y":null}}');
check("...out of reach: as it is; the grid (12) takes an axis nothing else did", JSON.stringify(G.snapPoint(300, 170, T, 2, 0)) === '{"x":300,"y":170,"hit":null}' && JSON.stringify(G.snapPoint(301, 167, T, 2, 12)) === '{"x":300,"y":168,"hit":{"k":"grid","x":300,"y":168}}');
const sb = G.snapBox({ x: 0, y: 120, w: 10, h: 10 }, 88, 0, T, 4, 0);
check("snapBox: a moved box's right edge onto a guideline (the shift corrected: 90)", sb.dx === 90 && sb.dy === 0 && sb.hit.k === "guideline" && sb.hit.x === 100, sb);
check("...its centre onto the page centre (y 150)", G.snapBox({ x: 300, y: 100, w: 20, h: 20 }, 0, 38, T, 4, 0).dy === 40);
check("SNAP_TOOLS: the drawing / selection / path tools + Move; not the brushes", ["move", "rect", "pen", "crect", "cdimpar", "shape", "directsel"].every((t) => G.SNAP_TOOLS.has(t)) && !["paint", "erase", "clone", "lasso", "freehand"].some((t) => G.SNAP_TOOLS.has(t)));
check("a document keeps its guidelines (DOC_KEYS guides) - and its .bgi", K.DOC_KEYS.includes("guides") && /guides: clone\(S\.guides \|\| \[\]\)/.test(read("ext", "imageeditdock", "pcbgi.js")) && /S\.guides = Array\.isArray\(m\.guides\)/.test(read("ext", "imageeditdock", "pcbgi.js")));
const IE = read("ext", "imageeditdock", "imageedit.js");
check("the editor's pointer: E.snapPos in pointerdown / move / up; pcguides installed after pcpropbar; the grid at a set spacing", (IE.match(/E\.snapPos \? E\.snapPos\(e, pos\(e\)\) : pos\(e\)/g) || []).length === 3
  && IE.indexOf("PCGuides.install(E)") > IE.indexOf("PCPropBar.install(E)") && /S\.gridFixed > 0 \? S\.gridFixed/.test(read("ext", "imageeditdock", "pcui.js")));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
