#!/usr/bin/env node
/* bitGen Studio — 2.624.0 (pure + wiring): THE 📏 PUSHPULL DOCKER - THEME COLOURS, WALLS ON A FLOOR'S EDGE, CUT + SLOPED
 * WALL TOPS, CEILINGS / ROOFS THAT FOLLOW THEM, DOUBLE-CLICK EMPTY = ORBIT, ⛶ / ⇲ DOCK + ✕ IN ITS TITLE BAR.
 * Tim: "in push/pull docker make it the same theme colors as bitgen. when user creates walls add offset input to offset wall
 * from edge of floor, allow user to drag walls but show snap regions on floor and allow user to snap wall to floor edge, when
 * user double clicks the the top of a wall cut the face allow the use to drag that edge up and down and delete the edge when
 * the del button is pressed and edge is selected. allow user to select edges on the wall to change slope of the wall. in
 * ceiling options add flat ceiling, follow slope of walls, with roof follow slope of walls add eaves width input. when user
 * double clicks empty space deselect everything ang go into orbit mode"
 * + "add a maximize and close button to the puss pull dockers titlebar change maximize button to dock button when maximized"
 *   ext/pushpulldock/pparch.js  wall tops (R.tops), R.ceil flat | follow, the "follow" roof (eaves), floors' edges */
"use strict";
const fs = require("fs");
const path = require("path");
const R0 = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (p) => fs.readFileSync(path.join(R0, p), "utf8");
globalThis.polygonClipping = require(path.join(R0, "static", "vendor", "polygon-clipping.umd.min.js"));
const P = require(path.join(R0, "ext", "pushpulldock", "pparch.js"));
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);
const nearP = (p, q, e) => near(p[0], q[0], e) && near(p[1], q[1], e);
const zs = (polys) => polys.flatMap((pl) => pl.rings[0].map((q) => q[2]));
const floorA = () => { const A = P.clean({ slabs: [{ pts: [[0, 0], [6, 0], [6, 5], [0, 5]], z: 0, th: 0.2 }] }); return A; };

/* walls drawn on a floor's edge: the offset */
let A = floorA();
let o = P.offsetOnFloor(A, [[0, 0], [4, 0], [4, 3], [0, 3]], true, 0.15, 0.1);
check("a room drawn along a floor's edges: those walls move in - their outside face 10 cm (the offset) in from the edge; the others stay",
  o.moved === 2 && nearP(o.pts[0], [0.175, 0.175]) && nearP(o.pts[1], [4, 0.175]) && nearP(o.pts[2], [4, 3]) && nearP(o.pts[3], [0.175, 3]), o);
o = P.offsetOnFloor(A, [[0, 0], [4, 0], [4, 3], [0, 3]], true, 0.15, 0);
check("…offset 0: the outside face ON the floor's edge (the centre line half a wall in)", nearP(o.pts[0], [0.075, 0.075]), o.pts);
o = P.offsetOnFloor(A, [[1, 1], [3, 1], [3, 2]], false, 0.15, 0.1);
check("…a wall not on an edge is left where it was drawn", o.moved === 0 && nearP(o.pts[0], [1, 1]));

/* a room dragged near a floor's edge: it snaps (the outside face onto the edge, the offset in) */
let r = P.addRoom(A, [[0.2, 0.6], [4, 0.6], [4, 3], [0.2, 3]]);
let s = P.snapToFloor(A, [r.id], [0, 0], 0.3, 0);
check("a room dragged near a floor's edge snaps: its left wall's outside face onto the edge (x 0.2 − 0.075 → 0)", s.hit && s.hit.slab === A.slabs[0].id && near(s.d[0], -0.125) && near(s.d[1], 0), s);
s = P.snapToFloor(A, [r.id], [0, 0], 0.3, 0.1);
check("…with the offset 10 cm: 10 cm in from the edge", s.hit && near(s.d[0], -0.025), s.d);
s = P.snapToFloor(A, [r.id], [1, 0], 0.3, 0);
check("…too far from any floor edge: no snap", !s.hit && nearP(s.d, [1, 0]), s);

/* one wall dragged: the room stretches, the wall snaps onto a floor's edge */
A = floorA(); r = P.addRoom(A, [[0, 0], [4, 0], [4, 3], [0, 3]]);
P.moveEdge(A, r.id, 1, 0.5);
check("one wall of a room dragged out 50 cm: the room stretches (x 4 → 4.5), the other walls stay", near(r.pts[1][0], 4.5) && near(r.pts[2][0], 4.5) && near(r.pts[0][0], 0) && near(r.pts[1][1], 0), r.pts);
s = P.snapEdge(A, r.id, 1, 1.3, 0.3, 0);
check("…dragged near the floor's edge: it snaps - its outside face on the edge (x 6)", s.hit && s.hit.kind === "floor" && near(4.5 + s.dist + 0.075, 6), s);
s = P.snapEdge(A, r.id, 1, 1.3, 0.3, 0.1);
check("…with the offset: 10 cm in", s.hit && near(4.5 + s.dist + 0.075, 5.9), s.dist);
const r2 = P.addRoom(A, [[5, 0], [8, 0], [8, 3], [5, 3]]);
s = P.snapEdge(A, r.id, 1, 0.45, 0.2, 0);
check("…or onto another room's wall (one shared wall)", s.hit && s.hit.kind === "wall" && s.hit.room === r2.id && near(s.dist, 0.5), s);

/* the wall tops: a cut, dragged up, deleted */
A = P.empty(); r = P.addRoom(A, [[0, 0], [4, 0], [4, 3], [0, 3]]);
check("a new room: flat tops, a flat ceiling", P.flatTop(r, 0) && r.ceil === "flat" && P.topAt(r, 0, 0.3) === 2.7);
let k = P.cutTop(A, r.id, 0, 0.5);
check("double-click a wall's top = a cut there (a point on its top line, nothing moved yet)", k === 1 && r.tops[0].length === 3 && near(r.tops[0][1][0], 0.5) && near(P.topAt(r, 0, 0.5), 2.7), r.tops);
P.moveTopPoint(A, r.id, 0, k, 4);
check("…the cut dragged up to 4 m: the wall's top slopes to it from both corners (a gable end)", near(P.topAt(r, 0, 0.5), 4) && near(P.topAt(r, 0, 0.25), 3.35) && near(P.topAt(r, 0, 0), 2.7) && near(P.minTop(r, 0), 2.7), r.tops[0]);
let B = P.build(A);
const top = B.polys.filter((pl) => pl.tag.ak === "wall" && pl.tag.part === "top" && pl.tag.edge === 0);
check("…the wall is built up to it (its piece above 2.7 m, tagged the wall's top)", top.length >= 3 && near(Math.max(...zs(top)), 4) && near(Math.min(...zs(top)), 2.7), top.length);
check("…a cut is found under the pointer (topHit: the cut, its wall, its height)", (() => { const h = P.topHit(A, [2, 0], 4, 0.1); return h && h.k === 1 && h.edge === 0 && near(h.h, 4); })() && P.topHit(A, [2, 0], 1, 0.1) === null);
const h2 = P.topHit(A, [1, 0], 3.35, 0.1);
check("…between the cuts: the top edge (a segment) - no point", h2 && h2.k === -1 && h2.seg === 0, h2);
P.removeTopPoint(A, r.id, 0, 1);
check("Delete on the cut: it goes, the wall is flat again", !r.tops[0] && near(P.topAt(r, 0, 0.5), 2.7), r.tops);

/* an edge selected: the slope */
P.moveTopPoint(A, r.id, 0, 1, 3.5);
check("a corner of a wall's top dragged up: the slope - the wall beside it goes up at that corner too (no gap)", near(P.topAt(r, 0, 1), 3.5) && near(P.topAt(r, 1, 0), 3.5) && near(P.topAt(r, 0, 0), 2.7), r.tops);
const base = P.profile(r, 2).map((p) => p.slice());
P.moveTopSeg(A, r.id, 2, 0, 0.5, base);
check("a top EDGE dragged: both its ends go up (a shed wall), the walls beside follow", near(P.topAt(r, 2, 0), 3.2) && near(P.topAt(r, 2, 1), 3.2) && near(P.topAt(r, 1, 1), 3.2) && near(P.topAt(r, 3, 0), 3.2), r.tops);
k = P.cutTop(A, r.id, 3, 0.5); P.moveTopPoint(A, r.id, 3, k, 4.2);
P.removeTopSeg(A, r.id, 3, 0);
check("Delete on a top edge with a cut: the cut goes (one straight top again)", P.profile(r, 3).length === 2, P.profile(r, 3));
P.removeTopSeg(A, r.id, 2, 0);
check("Delete on a top edge from corner to corner: flat at the room's height", near(P.topAt(r, 2, 0), 2.7) && near(P.topAt(r, 2, 1), 2.7));
const back = P.clean(JSON.parse(JSON.stringify(A))).rooms[0];
check("the tops and the ceiling are kept with the model (clean keeps them, drops nonsense)", JSON.stringify(back.tops) === JSON.stringify(r.tops) && back.ceil === "flat"
  && P.clean({ rooms: [{ pts: [[0, 0], [2, 0], [2, 2]], tops: { 0: "x", 7: [[0, 3], [1, 3]], 1: [[0.5, 3]] }, ceil: "weird" }] }).rooms[0].ceil === "flat");

/* the ceiling: flat or following the walls' slope; the roof that follows them, its eaves */
A = P.empty(); r = P.addRoom(A, [[0, 0], [4, 0], [4, 3], [0, 3]]);
[0, 2].forEach((i) => { const q = P.cutTop(A, r.id, i, 0.5); P.moveTopPoint(A, r.id, i, q, 4); });
B = P.build(A);
let ceil = B.polys.filter((pl) => pl.tag.part === "ceil");
check("Ceiling: Flat - level at the walls' lowest top (2.7 m) under the gable", ceil.length && zs(ceil).every((z) => near(z, 2.7, 0.01)), [...new Set(zs(ceil))]);
r.ceil = "follow"; B = P.build(A); ceil = B.polys.filter((pl) => pl.tag.part === "ceil");
check("Ceiling: Follows the walls' slope - up to the ridge (about 4 m) and down to 2.7 m, facing down", ceil.length >= 4 && Math.max(...zs(ceil)) > 3.8 && near(Math.min(...zs(ceil)), 2.7, 0.01) && ceil.every((pl) => pl.n[2] < 0), { n: ceil.length, max: Math.max(...zs(ceil)) });
const rf = P.addRoof(A, [r.id], { type: "follow", over: 0.5 });
const roofBox = (A) => { const pl = P.build(A).polys.filter((x) => x.tag.ak === "roof"); const xs = pl.flatMap((x) => x.rings[0].map((q) => q[0])), ys = pl.flatMap((x) => x.rings[0].map((q) => q[1])); return { n: pl.length, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), z1: Math.max(...zs(pl)) }; };
let rb = roofBox(A);
check("Roof: Follows the walls' slope - on the walls' tops (its ridge over the gables)", P.ROOFS.includes("follow") && rb.n > 4 && rb.z1 > 4, rb);
check("…the eaves width (50 cm) past the walls' outside faces all round", near(rb.x0, -0.575, 1e-3) && near(rb.x1, 4.575, 1e-3) && near(rb.y0, -0.575, 0.05), rb);
rf.over = 1; rb = roofBox(A);
check("…eaves width 1 m: further out", near(rb.x0, -1.075, 1e-3), rb);
check("…a room that is not a rectangle: no follow ceiling / roof surface (nothing wrong drawn)", P.followGrid(P.addRoom(P.empty(), [[0, 0], [4, 0], [5, 2], [2, 4], [0, 3]]), true, 0.4) === null);

/* the wiring */
const TL = read("ext/pushpulldock/pparchtools.js"), PT = read("ext/pushpulldock/pptools.js"), VW = read("ext/pushpulldock/ppview.js"), AV = read("ext/pushpulldock/pparchview.js"), DH = read("ext/pushpulldock/dock.html"), FR = read("ext/pushpulldock/ppframe.js"), DK = read("ext/pushpulldock/ppdock.js");
check("the Room / Wall tools: Offset from floor edge; dragged walls show the floor's snap regions", /Offset from floor edge/.test(TL) && /offsetOnFloor/.test(TL) && /function regions\(/.test(TL) && /snapToFloor/.test(TL) && /On Floor Edge/.test(TL));
check("the room's Ceiling: None / Flat / Follows the walls' slope; a follow roof's Eaves width", /Follows the walls' slope/.test(TL) && /Eaves width/.test(TL));
check("double-click a wall's top = a cut (selectDbl), Delete takes a cut / an edge, a selected edge is dragged up / down", /function selectDbl/.test(TL) && /removeTopPoint/.test(TL) && /removeTopSeg/.test(TL) && /moveTopSeg/.test(TL));
check("double-click empty space: everything deselected, the Orbit tool", /use\("orbit"\)/.test(PT) && /selectDbl/.test(PT));
check("bitGen's theme colours: the view's background / grid / selection from the CSS variables, repainted on a theme change", /--ink/.test(VW) && /--tiger|--accent/.test(VW) && /h3theme/.test(VW) && /V\.theme/.test(AV) && /var\(--ink, /.test(DH));
check("the title bar: ⛶ maximize (\"⇲ Dock\" while maximized) and ✕ close", /id="ppMaxBtn"/.test(DH) && /id="ppCloseBtn"/.test(DH) && /⇲ Dock/.test(FR) && /function close\(\)/.test(FR));
check("Space / the canvas' focus never scroll the page under the docker", /Space never scrolls/.test(DK) && !/canvas\.focus\(\)/.test(DK));
check("server.js untouched by this release", !/pparch|pushpulldock/.test(read("misc/server.js")));
console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
