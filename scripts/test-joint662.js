#!/usr/bin/env node
/* bitGen Studio — 2.662.0: THE SKETCHER'S WALLS END SQUARE (ext/pushpulldock/pparch.js wallQuads / joints / jointAt /
 * mitreQuads, ppplan.js, pparchtools.js branch drag). The clicks: scripts/test-ui662-ui.js.
 * Tim (verbatim): "end walls in a square not a triangle when drawing a room , add a segment to the end of each wall so user
 * can drag another wall from any side of the end of walls" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);
const PC = globalThis.polygonClipping = require(path.join(ROOT, "static/vendor/polygon-clipping.umd.min.js"));
const P = require(path.join(ROOT, "ext/pushpulldock/pparch.js"));
const PL = require(path.join(ROOT, "ext/pushpulldock/ppplan.js"));
const ring = (q) => q.map((p) => [p[0], p[1]]).concat([[q[0][0], q[0][1]]]);
const areaOf = (U) => U.reduce((s, poly) => s + poly.reduce((t, rg, k) => t + (k ? -1 : 1) * Math.abs(P.area2(rg.slice(0, -1))) / 2, 0), 0);
const unionOf = (polys) => PC.union.apply(null, polys.map((q) => [ring(q)]));

let A = P.empty(); const R = P.addRoom(A, P.rectPts([0, 0], [4, 3]), true);
const Q = P.wallQuads(R), J = P.joints(R);
check("each wall a rectangle from its corner to its corner (square ends)", Q.length === 4 && JSON.stringify(Q[0].quad) === JSON.stringify([[0, 0.075], [4, 0.075], [4, -0.075], [0, -0.075]]));
check("4 corners, each a joint of its two walls", J.length === 4 && J.every((j) => j.kind === "corner" && j.walls.length === 2) && JSON.stringify(J[1].walls) === "[0,1]");
const sq = J[1].poly, bx = [Math.min(...sq.map((p) => p[0])), Math.min(...sq.map((p) => p[1])), Math.max(...sq.map((p) => p[0])), Math.max(...sq.map((p) => p[1]))];
check("…a square corner's joint reaches the outside corner (4.075, -0.075)", near(bx[2], 4.075) && near(bx[1], -0.075) && sq.some((p) => near(p[0], 4.075) && near(p[1], -0.075)), sq);
const same = (Rm) => { const a = areaOf(unionOf(P.wallQuads(Rm).map((q) => q.quad).concat(P.joints(Rm).map((j) => j.poly)))), b = areaOf(unionOf(P.mitreQuads(Rm).map((q) => q.quad))); return near(a, b, 1e-6) ? true : [a, b]; };
check("the walls + joints = the same shape as the mitred walls (a rectangle room)", same(R) === true, same(R));
const hex = P.addRoom(A, [[10, 0], [12, 0], [13, 1.7], [12, 3.4], [10, 3.4], [9, 1.7]], true);
check("…an angled room (120° corners) too - no point sticking out", same(hex) === true, same(hex));
const tri = P.addRoom(A, [[20, 0], [24, 0], [20, 1]], true);
check("…a sharp corner: no long point - the joint stays near its corner (within 6 half-walls), filling at least the mitred shape", (() => { const a = areaOf(unionOf(P.wallQuads(tri).map((q) => q.quad).concat(P.joints(tri).map((j) => j.poly)))), b = areaOf(unionOf(P.mitreQuads(tri).map((q) => q.quad))); return a >= b - 1e-6 && P.joints(tri).every((j) => j.poly.every((p) => Math.hypot(p[0] - j.v[0], p[1] - j.v[1]) <= 6 * 0.075 + 1e-6)); })());
const W = P.addRoom(A, [[0, 10], [3, 10], [3, 12]], { closed: false });
const JW = P.joints(W);
check("a free wall: a cap past each end (facing on), the corner between its two runs", JW.length === 3 && JW.filter((j) => j.kind === "end").length === 2 && JW[0].out[0] === -1 && JW[2].out[1] === 1 && JW[1].kind === "corner");
check("…the cap: half a wall past the end, as wide as the wall", JSON.stringify(JW[0].poly.map((p) => p.map((v) => +v.toFixed(4)))) === JSON.stringify([[0, 10.075], [0, 9.925], [-0.075, 9.925], [-0.075, 10.075]]), JW[0].poly);
check("a hidden / taken-out wall: the walls beside it get end caps", (() => { const j = P.joints(R, (i) => i === 1); return j.filter((x) => x.kind === "end").length === 2 && j.length === 4; })());
check("jointAt: the outside corner region = that joint only; the corner inside a wall's rectangle = not only", (() => { const a = P.jointAt(A, [4.04, -0.04], 1), b = P.jointAt(A, [3.98, -0.01], 1); return a && a.only && a.k === 1 && b && !b.only; })());
check("wallOwner: a point in a corner = one of its walls", (() => { const w = P.wallOwner(A, [4.05, -0.02], 1); return w && w.R === R && (w.i === 0 || w.i === 1); })());
const B = P.build(Object.assign(P.empty(), { rooms: [JSON.parse(JSON.stringify(R))] }));
const sides = B.polys.filter((p) => p.tag.ak === "wall" && Math.abs(p.n[2]) < 0.1);
check("build: one outside face a wall + one inside (the straight runs' points merged - 8 faces)", sides.length === 8, sides.length);
check("…corner lines only at the real corners (8 verticals)", B.lines.filter((l) => near(l[0][0], l[1][0]) && near(l[0][1], l[1][1]) && Math.abs(l[0][2] - l[1][2]) > 1).length >= 8);
const sym = PL.symbols(Object.assign(P.empty(), { rooms: [JSON.parse(JSON.stringify(R))] }), 0, {});
check("the floorplan: the walls one shape with their corners (the area of the mitred walls)", near(sym.fills.filter((f) => f.k === "wall").reduce((s, f) => s + areaOf([f.rings]), 0), areaOf(unionOf(P.mitreQuads(R).map((q) => q.quad))), 1e-4));
check("…a click on the corner picks a wall of it", (() => { const t = PL.pickAt(Object.assign(P.empty(), { rooms: [JSON.parse(JSON.stringify(R))] }), [4.05, -0.05], 0); return t && t.ak === "wall"; })());
const AT = fs.readFileSync(path.join(ROOT, "ext/pushpulldock/pparchtools.js"), "utf8");
check("the wiring: Select - a press on a corner / an end piece (only) drags a new wall out of that side (its top: any way), the room's height / thickness / wall type, lit up under the pointer",
  /function branchAt\(h\)/.test(AT) && /mode: "branch"/.test(AT) && /function finishBranch\(D\)/.test(AT) && /closed: false, z: R0\.z, h: R0\.h, t: (R0\.t|O\.wall\.t)/.test(AT) && /PPWallType\.assign\(A, \[\{ R, i: 0 \}\]/.test(AT) && /drag a new wall out of this side/.test(AT));
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
