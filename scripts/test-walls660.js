#!/usr/bin/env node
/* bitGen Studio — 2.660.0: THE SKETCHER'S WALLS - ONE TAKEN OUT OF A ROOM, INTERIOR / EXTERIOR (ext/pushpulldock/pparch.js,
 * pparchtools.js, pparchview.js, ppoutline.js, ppplan.js). The clicks: scripts/test-ui660-ui.js.
 * Tim (verbatim): "allow me to remove just 1 wall from a room, allow me to toggle walls to interior/exterior" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);
globalThis.polygonClipping = require(path.join(ROOT, "static/vendor/polygon-clipping.umd.min.js"));
const P = require(path.join(ROOT, "ext/pushpulldock/pparch.js"));
const PL = require(path.join(ROOT, "ext/pushpulldock/ppplan.js"));
const fresh = () => { const A = P.empty(); P.addRoom(A, P.rectPts([0, 0], [4, 3]), true); P.addRoom(A, P.rectPts([4, 0], [8, 3]), true); return P.clean(JSON.parse(JSON.stringify(A))); };

let A = fresh(); const R1 = A.rooms[0], R2 = A.rooms[1];
check("a new room: no walls taken out, no kinds set (gone [], wkind {})", JSON.stringify(R1.gone) === "[]" && JSON.stringify(R1.wkind) === "{}");
check("wallKind auto: the shared wall interior (a room past its outside face), the others exterior",
  JSON.stringify(P.edgesOf(R1).map((e) => P.wallKind(A, R1, e.i))) === '["ext","int","ext","ext"]' && JSON.stringify(P.edgesOf(R2).map((e) => P.wallKind(A, R2, e.i))) === '["ext","ext","ext","int"]');
check("twinWalls: the room beside's wall on the same line (Room 2's wall 4), none for an outside wall",
  JSON.stringify(P.twinWalls(A, R1, 1).map((w) => [w.R.id, w.i])) === JSON.stringify([[R2.id, 3]]) && P.twinWalls(A, R1, 0).length === 0);
P.addOp(A, "door", { room: R1.id, edge: 1, at: 1.5 }); P.addOp(A, "window", { room: R1.id, edge: 0, at: 2 });
const L = P.removeWall(A, R1.id, 1, true);
check("removeWall (with its twin): Room 1's wall 2 + Room 2's wall 4 out, the door in it gone, the window in another wall kept",
  L && L.length === 2 && JSON.stringify(R1.gone) === "[1]" && JSON.stringify(R2.gone) === "[3]" && A.ops.length === 1 && A.ops[0].kind === "window", { L: L && L.length, ops: A.ops });
check("…again on the same wall: nothing (null)", P.removeWall(A, R1.id, 1, true) === null);
A = P.clean(JSON.parse(JSON.stringify(A))); const r1 = A.rooms[0], r2 = A.rooms[1];
check("clean keeps them (sorted, each once, in range; a bad list -> [])", JSON.stringify(r1.gone) === "[1]" && JSON.stringify(P.cleanGone([3, 1, 1, 9, -1, "x"], 4)) === "[1,3]" && JSON.stringify(P.cleanGone("no", 4)) === "[]");
check("wallQuads: 3 walls left (the gone one none)", P.wallQuads(r1).length === 3 && !P.wallQuads(r1).some((q) => q.i === 1));
const q0 = P.wallQuads(r1).find((q) => q.i === 0), q2 = P.wallQuads(r1).find((q) => q.i === 2);
check("…the walls beside it end square at the open side (not mitred past it)", near(Math.max(...q0.quad.map((p) => p[0])), 4) && near(Math.max(...q2.quad.map((p) => p[0])), 4), { q0: q0.quad, q2: q2.quad });
const inn = P.interior(r1);
check("interior: the floor / ceiling reach the open side's line (x = 4), the other sides half a wall in", near(Math.max(...inn.map((p) => p[0])), 4) && near(Math.min(...inn.map((p) => p[0])), r1.t / 2), inn);
check("the two rooms' floors meet (no gap where the walls were)", near(Math.min(...P.interior(r2).map((p) => p[0])), 4));
const b2 = P.build(A);
check("build: no wall standing between the two rooms (no face at 3.9 < x < 4.1 across the middle)",
  b2.polys.some((p) => p.tag.ak === "wall") && !b2.polys.some((p) => p.tag.ak === "wall" && Math.abs(p.n[0]) > 0.9 && p.rings[0].every((v) => v[0] > 3.85 && v[0] < 4.15) && p.rings[0].some((v) => v[1] > 0.5 && v[1] < 2.5)));
r1.skirtOn = true; r1.corniceOn = true; const T = { polys: [], lines: [] }; P.trims(A, r1, T, () => false);
check("skirting / cornice: none along the open side (only the runs' square ends there)", T.polys.length > 0 && !T.polys.some((p) => p.rings[0].every((v) => v[0] > 3.9) && Math.max(...p.rings[0].map((v) => v[1])) - Math.min(...p.rings[0].map((v) => v[1])) > 0.5), T.polys.length);
check("nearestWall: a door can't go in a wall that is gone (the click at x = 4 finds nothing of Room 1)", (() => { const w = P.nearestWall(A, [4, 1.5], 0.3, 0.5); return !w || w.room !== r1.id; })());
check("clean drops an opening on a gone wall (an old file)", P.clean(Object.assign(JSON.parse(JSON.stringify(A)), { ops: [{ id: 50, kind: "door", room: r1.id, edge: 1, at: 1 }] })).ops.length === 0);
check("restoreWalls: back (how many)", P.restoreWalls(A, r1.id) === 1 && r1.gone.length === 0 && P.restoreWalls(A, r1.id) === 0);
// interior / exterior
A = fresh(); const s1 = A.rooms[0];
check("setWallKind: an outside wall set interior, kept by clean; auto again with null / 'auto'; a bad value dropped",
  P.setWallKind(A, s1.id, 0, "int") && P.wallKind(A, s1, 0) === "int" && P.clean(JSON.parse(JSON.stringify(A))).rooms[0].wkind[0] === "int" &&
  P.setWallKind(A, s1.id, 0, "auto") && P.wallKind(A, s1, 0) === "ext" && JSON.stringify(P.cleanKind({ 0: "int", 1: "x", 7: "ext" }, 4)) === '{"0":"int"}');
s1.wall = "#123456"; P.setWallKind(A, s1.id, 3, "int");
const fx = P.build(A).polys.filter((p) => p.tag.ak === "wall" && p.n[0] < -0.9 && p.rings[0].every((v) => v[0] < -0.05));
check("an interior wall's OUTSIDE face takes its inside colour (an exterior one the building's outside)", fx.length && fx.every((p) => p.col === "#123456"), fx.map((p) => p.col));
s1.wext = { 3: "#abcdef" };
check("…its own Outside colour still wins", P.build(A).polys.filter((p) => p.tag.ak === "wall" && p.n[0] < -0.9 && p.rings[0].every((v) => v[0] < -0.05)).every((p) => p.col === "#abcdef"));
const sym = PL.symbols(A, 0, {});
const wf = sym.fills.filter((f) => f.k === "wall");
check("the floorplan: the exterior walls dark, the interior ones a lighter fill on top (wallIn)", wf.some((f) => !f.int) && wf.some((f) => f.int && f.col === "#7d7f86"), wf.map((f) => [f.col, !!f.int]));
// the wiring
const AT = fs.readFileSync(path.join(ROOT, "ext/pushpulldock/pparchtools.js"), "utf8"), AV = fs.readFileSync(path.join(ROOT, "ext/pushpulldock/pparchview.js"), "utf8"), OL = fs.readFileSync(path.join(ROOT, "ext/pushpulldock/ppoutline.js"), "utf8");
check("the wiring: Delete / Eraser on a wall takes just it out (Shift+Eraser the room), its panel: Interior / exterior + 🗑 Take this wall out, the room's ↺ Put back; a pick / the outline skip a gone wall",
  /function takeOut\(id, i\)/.test(AT) && /!ev\.shiftKey\) \{ takeOut\(t\.id, t\.edge\)/.test(AT) && /"Interior \/ exterior"/.test(AT) && /🗑 Take this wall out/.test(AT) && /↺ Put back/.test(AT) && /P\(\)\.isGone\(R, e\.i\)/.test(AV) && /isGone/.test(OL));
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
