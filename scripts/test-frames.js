#!/usr/bin/env node
/* bitGen Studio — 2.442.0 units: FRAMES (CorelDRAW's PowerClip - ext/imageeditdock/pcframes.js): what can be a frame,
 * the frame's nodes, the affine map its contents follow, the tree (layers inside a closed shape), extract; the wiring. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const ED = path.join(ROOT, "ext", "imageeditdock");
const F = require(path.join(ED, "pcframes.js"));
const D = require(path.join(ED, "pcdoc.js"));
const Q = require(path.join(ED, "pcpath.js"));

const A = (x, y) => ({ x, y, ix: x, iy: y, ox: x, oy: y });
const rect = { type: "shape", shape: Object.assign({}, D.SHAPE_DEFAULT, { kind: "rect", x: 10, y: 20, w: 100, h: 50 }) };
const closedPath = { type: "shape", shape: { kind: "path", path: { subs: [{ closed: true, pts: [A(0, 0), A(10, 0), A(5, 9)] }] } } };
const openPath = { type: "shape", shape: { kind: "path", path: { subs: [{ closed: false, pts: [A(0, 0), A(10, 0), A(5, 9)] }] } } };
check("isClosedShape: a rectangle, an ellipse, a closed path - not a line, an open path, a dimension, a pixel layer",
  F.isClosedShape(rect) && F.isClosedShape({ type: "shape", shape: { kind: "ellipse", x: 0, y: 0, w: 5, h: 5 } }) && F.isClosedShape(closedPath)
  && !F.isClosedShape({ type: "shape", shape: { kind: "line", x: 0, y: 0, w: 5, h: 5 } }) && !F.isClosedShape(openPath)
  && !F.isClosedShape({ type: "shape", shape: Object.assign({}, closedPath.shape, { line: { labels: [{}] } }) }) && !F.isClosedShape({ type: "pixel" }));
check("geoOf: a rectangle's nodes are the ones it gets as a path (PCPath.fromShape)", JSON.stringify(F.geoOf(rect.shape, Q)) === "[[10,20],[110,20],[110,70],[10,70]]", F.geoOf(rect.shape, Q));

const pts = [[0, 0], [100, 0], [100, 50], [0, 50], [30, 20]];
const rot = (a, k, tx, ty) => { const c = Math.cos(a) * k, s = Math.sin(a) * k; return [c, s, -s, c, tx, ty]; };
const m1 = rot(Math.PI / 6, 1.5, 40, -12), B1 = pts.map(([x, y]) => F.applyM(m1, x, y));
const f1 = F.fitAffine(pts, B1);
check("fitAffine: a turn of 30° + 1.5× + a move, found from the nodes (within 1e-6)", f1 && f1.every((v, i) => Math.abs(v - m1[i]) < 1e-6), { f1, m1 });
const skew = [1, 0.2, 0.4, 0.8, 5, 6], f2 = F.fitAffine(pts, pts.map(([x, y]) => F.applyM(skew, x, y)));
check("...a skew too (any affine map)", f2 && f2.every((v, i) => Math.abs(v - skew[i]) < 1e-6), f2);
const bent = pts.map(([x, y], i) => (i === 2 ? [x + 9, y] : [x + 3, y]));
check("...not an affine change (one node moved alone) = null; a different node count / all on one line = null",
  F.fitAffine(pts, bent) === null && F.fitAffine(pts, pts.slice(1)) === null && F.fitAffine([[0, 0], [1, 1], [2, 2]], [[0, 0], [1, 1], [2, 2]]) === null);
check("isIdent / invM / mulM", F.isIdent(F.fitAffine(pts, pts)) && F.isIdent(F.mulM(m1, F.invM(m1))) && !F.isIdent(m1));
// the Transform docker turns a rectangle into a path (PCPath.toPathShape) - its nodes still match
const ps = Q.toPathShape(rect.shape); ps.path = Q.transform(ps.path, m1);
const f3 = F.fitAffine(F.geoOf(rect.shape, Q), F.geoOf(ps, Q));
check("a rectangle frame turned by the Transform docker (made a path): the same map comes back from its nodes", f3 && f3.every((v, i) => Math.abs(v - m1[i]) < 1e-6), f3);

const mk = (id, extra) => Object.assign({ id, name: "L" + id, type: "pixel", parent: null, visible: true }, extra || {});
const fr = mk(4, { type: "shape", shape: rect.shape, frame: { geo: [], lock: true } });
let layers = [mk(1), mk(2), mk(3, { type: "group" }), mk(5, { parent: 3 }), fr];
layers = D.normalize(layers);
const L2 = F.moveInto(D, layers, [2, 3], 4);
check("moveInto: the picked layers (a group with what is in it) go into the frame as its children, right below it - the tree keeps them",
  L2.map((x) => x.id).join() === "1,2,5,3,4" && L2.find((x) => x.id === 2).parent === 4 && L2.find((x) => x.id === 3).parent === 4 && L2.find((x) => x.id === 5).parent === 3
  && D.depth(L2, L2.find((x) => x.id === 5)) === 2 && D.descendants(L2, 4).length === 3, L2.map((x) => [x.id, x.parent]));
let threw = false; try { F.moveInto(D, L2, [4], 3); } catch (e) { threw = /inside it/.test(e.message); }
check("...a frame cannot go into a layer inside it", threw);
check("frameOf / underFrame: the nearest frame up the tree; whether a frame sits between a layer and a moved group",
  F.frameOf(L2, L2.find((x) => x.id === 5)) === 4 && F.frameOf(L2, L2.find((x) => x.id === 1)) === null
  && F.underFrame(L2, L2.find((x) => x.id === 5), 3) === false && F.underFrame(L2, L2.find((x) => x.id === 2), null) === true);
const ins = D.insert(L2.slice(), mk(9), 4, true);
check("pcdoc: a layer inserted INTO a frame is its top child; a frame in the undo snapshot (DEEP)",
  ins.find((x) => x.id === 9).parent === 4 && ins.indexOf(ins.find((x) => x.id === 9)) === ins.indexOf(ins.find((x) => x.id === 4)) - 1
  && JSON.stringify(D.snapLayer(fr).frame) === JSON.stringify(fr.frame) && D.snapLayer(fr).frame !== fr.frame);
const L3 = F.extractPlan(D, L2.map((x) => Object.assign({}, x)), 4);
check("extractPlan: the contents out, right above the frame, where they were in the tree; the frame plain",
  L3.map((x) => x.id).join() === "1,4,2,5,3" && L3.find((x) => x.id === 2).parent === null && L3.find((x) => x.id === 4).frame === null && L3.find((x) => x.id === 5).parent === 3, L3.map((x) => [x.id, x.parent]));
const plain = Object.assign({}, fr, { frame: null });
check("a closed shape without L.frame does not hold layers (they land at the top level)", D.toTree([mk(7, { parent: 4 }), plain]).length === 2);

const IE = read("ext", "imageeditdock", "imageedit.js"), DK = read("ext", "imageeditdock", "pcdockers.js"), GF = read("ext", "imageeditdock", "pcgenfill.js");
const UI = read("ext", "imageeditdock", "pcui.js"), PSD = read("ext", "imageeditdock", "pcpsd.js"), DOC = read("ext", "imageeditdock", "pcdoc.js");
const ext = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts;
check("the wiring: pcdoc draws a frame through PCFrames.content; the canvas pick asks E.hitLayer; ✨ Generate asks E.beforeGenerate; the screen render is marked (the faint contents while editing); installed after pcdims",
  /PCFrames\.holds\(node\)\) return root\.PCFrames\.content/.test(DOC) && /E\.hitLayer\(L, x, y\)/.test(IE) && /if \(E\.beforeGenerate\) E\.beforeGenerate\(mode\)/.test(IE)
  && /docEnv\(\{ into: cv, screen: true \}\)/.test(IE) && IE.indexOf("PCFrames.install(E)") > IE.indexOf("PCDims.install(E)") && ext.indexOf("pcframes.js") > ext.indexOf("pcdims.js") && ext.indexOf("pcframes.js") < ext.indexOf("imageedit.js"));
check("...a group moved / transformed leaves what is in a frame to its frame (no double move); the result into a frame (pcgenfill); a drop onto a closed shape's row; a frame in a PSD = a group with its contents clipped",
  /underFrame\(S\.layers, x, G\.id\)/.test(IE) && /underFrame\(S\.layers, x, L\.id\)/.test(DK) && /how === "frame" && E\.frames\) return E\.frames\.placeResult/.test(GF)
  && /E\.frames\.isClosedShape\(Ly\)/.test(UI) && /if \(L\.frame && n\.kids\.length\)/.test(PSD) && /clipping: true/.test(PSD));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
