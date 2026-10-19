#!/usr/bin/env node
/* bitGen Studio — 2.429.0 units: CORELDRAW'S DOCKERS (pcdockers.js) + the wiring
 *   1. anchors and matrices (translate, rotate, scale, skew, about a point), the Transform docker's settings -> a matrix
 *   2. Align (to the active / first object, the selection, the page edge / centre) and Distribute (edges, centres,
 *      spacing; over the selection / the page)
 *   3. Shaping plans (weld, trim, intersect, simplify, front / back minus, boundary; what is kept)
 *   4. pcbezier's gradient fill (linear / radial) and its SVG; the wiring (ext.json, the dock group, the commands, the
 *      showTab / layers hooks)
 * Tim: "i would like all the drawing tools from coreldraw and the tool dockers" (the agreed order). */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const K = require(path.join(ROOT, "ext", "imageeditdock", "pcdockers.js"));
const B = require(path.join(ROOT, "ext", "imageeditdock", "pcbezier.js"));
const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1e-6 : e);
const nearP = (p, q, e) => near(p[0], q[0], e) && near(p[1], q[1], e);
const box = { x: 10, y: 20, w: 100, h: 50 };

/* ---- 1 */
check("anchorPt: the 9 points of a box", K.ANCHORS.length === 9 && nearP(K.anchorPt(box, "tl"), [10, 20]) && nearP(K.anchorPt(box, "c"), [60, 45]) && nearP(K.anchorPt(box, "br"), [110, 70]) && nearP(K.anchorPt(box, "l"), [10, 45]) && nearP(K.anchorPt(box, "t"), [60, 20]) && nearP(K.anchorPt(box, "r"), [110, 45]));
const m = K.about(K.mRotate(90), 60, 45);
check("about + mRotate: 90° about the centre keeps the centre, turns the corner", nearP(K.apply(m, 60, 45), [60, 45]) && nearP(K.apply(m, 110, 45), [60, 95]));
check("mMul: q after p", nearP(K.apply(K.mMul(K.mTranslate(5, 0), K.mScale(2, 2)), 1, 1), [7, 2]) && K.isRigidScale(K.mScale(2, 3)) && !K.isRigidScale(K.mRotate(10)));
const pos = K.transformFor({ tab: "position", rel: false, x: 0, y: 0, anchor: "tl" }, box), posR = K.transformFor({ tab: "position", rel: true, x: 5, y: -5 }, box);
check("transformFor position: absolute puts the anchor there; relative moves by x / y", nearP(K.apply(pos, 10, 20), [0, 0]) && nearP(K.apply(posR, 10, 20), [15, 15]));
const rot = K.transformFor({ tab: "rotate", angle: 90, anchor: "c" }, box);
check("...rotate: + = counter-clockwise (CorelDRAW), about the anchor", nearP(K.apply(rot, 110, 45), [60, -5], 1e-9), K.apply(rot, 110, 45));
const sc = K.transformFor({ tab: "scale", sx: 50, sy: 200, anchor: "tl" }, box), mir = K.transformFor({ tab: "scale", sx: 100, sy: 100, mirrorH: true, anchor: "c" }, box);
check("...scale % about the anchor; mirror flips", nearP(K.apply(sc, 110, 70), [60, 120]) && nearP(K.apply(mir, 10, 20), [110, 20]));
const sz = K.transformFor({ tab: "size", w: 200, h: 25, anchor: "tl" }, box), sk = K.transformFor({ tab: "skew", x: 45, y: 0, anchor: "tl" }, box);
check("...size w / h; skew x°", nearP(K.apply(sz, 110, 70), [210, 45]) && nearP(K.apply(sk, 10, 70), [60, 70], 1e-9), [K.apply(sz, 110, 70), K.apply(sk, 10, 70)]);
check("boxThrough / union", JSON.stringify(K.boxThrough(K.mScale(2, 2), { x: 0, y: 0, w: 1, h: 1 })) === '{"x":0,"y":0,"w":2,"h":2}' && JSON.stringify(K.union([{ x: 0, y: 0, w: 1, h: 1 }, { x: 5, y: -2, w: 1, h: 1 }])) === '{"x":0,"y":-2,"w":6,"h":3}');

/* ---- 2 */
const it = [{ id: 1, box: { x: 0, y: 10, w: 20, h: 20 } }, { id: 2, box: { x: 50, y: 30, w: 40, h: 10 } }, { id: 3, box: { x: 200, y: 0, w: 10, h: 40 } }];
const moves = (ms) => ms.map((x) => [x.dx, x.dy]);
check("alignMoves left to the active object (id 2) / top to the selection / right to the page edge / centres to the page centre",
  JSON.stringify(moves(K.alignMoves(it, "left", "active", { w: 300, h: 100 }, 2))) === "[[50,0],[0,0],[-150,0]]" && JSON.stringify(moves(K.alignMoves(it, "top", "selection", {}, 2))) === "[[0,-10],[0,-30],[0,0]]"
  && JSON.stringify(moves(K.alignMoves(it, "right", "page-edge", { w: 300, h: 100 }))) === "[[280,0],[210,0],[90,0]]" && JSON.stringify(moves(K.alignMoves(it, "hcenter", "page-center", { w: 300, h: 100 }))) === "[[140,0],[80,0],[-55,0]]",
  [moves(K.alignMoves(it, "right", "page-edge", { w: 300, h: 100 }))]);
const dc = K.distributeMoves(it, "hcenter", "selection", {}), ds = K.distributeMoves(it, "hspace", "selection", {});
const cen = it.map((x, k) => x.box.x + x.box.w / 2 + dc[k].dx);
check("distributeMoves centres: even steps between the outer two; spacing: equal gaps", near(cen[1] - cen[0], cen[2] - cen[1]) && near(cen[0], 10) && near(cen[2], 205)
  && (() => { const bs = it.map((x, k) => ({ x: x.box.x + ds[k].dx, w: x.box.w })); return near(bs[1].x - (bs[0].x + bs[0].w), bs[2].x - (bs[1].x + bs[1].w)); })(), [cen, ds]);
check("...over the page; under 3 (selection) nothing moves", (() => { const dp = K.distributeMoves(it.slice(0, 2), "left", "page", { w: 300, h: 100 }); return dp[0].dx === 0 && near(it[1].box.x + dp[1].dx, 300 - 40); })() && K.distributeMoves(it.slice(0, 2), "left", "selection", {}).every((x) => !x.dx));

/* ---- 3 */
const P = (op, ls, lt) => K.shapingPlan(op, [1, 2, 3], 2, ls, lt);
check("shapingPlan: weld = all added, the target's look; trim = target minus the others; intersect = target ∩ others; originals kept as asked",
  JSON.stringify(P("weld").steps) === '[{"op":"add","ids":[1,2,3]}]' && P("weld").style === 2 && P("weld").keep.length === 0 && JSON.stringify(P("trim", true).steps) === '[{"op":"add","ids":[2]},{"op":"subtract","ids":[1,3]}]' && P("trim", true).keep.join() === "1,3"
  && P("intersect", false, true).steps[1].op === "intersect" && P("intersect", false, true).keep.join() === "2");
check("...front minus back = the top one minus the rest; back minus front = the bottom one minus the rest; boundary keeps all + an outline; simplify each by those above",
  JSON.stringify(P("frontminusback").steps) === '[{"op":"add","ids":[3]},{"op":"subtract","ids":[1,2]}]' && JSON.stringify(P("backminusfront").steps) === '[{"op":"add","ids":[1]},{"op":"subtract","ids":[2,3]}]'
  && P("boundary").outline && P("boundary").keep.length === 3 && P("simplify").simplify && P("nope") === null);

/* ---- 4 */
const shp = { kind: "path", path: { subs: [{ closed: true, op: "add", pts: [{ x: 0, y: 0, ix: 0, iy: 0, ox: 0, oy: 0 }, { x: 10, y: 0, ix: 10, iy: 0, ox: 10, oy: 0 }, { x: 10, y: 10, ix: 10, iy: 10, ox: 10, oy: 10 }] }] }, fill: "#ff0000", fillOn: true, strokeW: 0, strokeOn: false, fillGrad: { type: "radial", c1: "#ff0000", c2: "#0000ff" }, line: {} };
const svg = B.svgLine(shp);
check("pcbezier: a gradient fill goes into the SVG (radialGradient, its two stops) and the data keeps it", /<radialGradient id="bg/.test(svg) && /stop-color="#0000ff"/.test(svg) && /fill="url\(#bg/.test(svg) && B.fromSvg(`<svg>${svg}</svg>`)[0].fillGrad.type === "radial");
const BZ = read("ext", "imageeditdock", "pcbezier.js"), EXT = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts, IE = read("ext", "imageeditdock", "imageedit.js"), UI = read("ext", "imageeditdock", "pcui.js"), DK = read("ext", "imageeditdock", "pcdockers.js");
check("...drawn with a canvas gradient over the filled area (fillStyleOf)", /function fillStyleOf\(g, s, area\)/.test(BZ) && /const style = fillStyleOf\(g, s, P\.fill\);/.test(BZ));
check("ext.json: pcdockers right after pcdraw; installed after PCDraw", EXT.indexOf("pcdockers.js") === EXT.indexOf("pcdraw.js") + 1 && IE.indexOf("PCDraw.install(E)") < IE.indexOf("PCDockers.install(E)"));
check("imageedit: the dock group (Transform / Shaping / Align / Object), hidden until opened; pcui repaints it (showTab, layers)",
  /<div class="pcgrp off" data-g="dock">/.test(IE) && /\$\{tab\("dock", "dkXf", "Transform", true\)\}\$\{tab\("dock", "dkShape", "Shaping"\)\}\$\{tab\("dock", "dkAlign", "Align"\)\}\$\{tab\("dock", "dkProps", "Object"\)\}/.test(IE)
  && /if \(\/\^dk\/\.test\(id\) && E\.ui\.dockers\) E\.ui\.dockers\(\);/.test(UI) && /if \(E\.ui\.dockers\) E\.ui\.dockers\(\);/.test(UI));
check("the commands: Window ▸ Dockers: Transform (Alt+F7), Shaping, Align and Distribute (Shift+Ctrl+A), Object Properties (Alt+Enter)",
  /C\("dk\.transform", "Dockers: Transform", "Alt\+F7"/.test(DK) && /C\("dk\.shaping", "Dockers: Shaping"/.test(DK) && /C\("dk\.align", "Dockers: Align and Distribute", "Shift\+Ctrl\+A"/.test(DK) && /C\("dk\.props", "Dockers: Object Properties", "Alt\+Enter"/.test(DK));
check("server.js untouched", !/pcdockers|dkXf/.test(read("server.js")));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
