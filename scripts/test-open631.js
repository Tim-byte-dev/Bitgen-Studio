#!/usr/bin/env node
/* bitGen Studio — 2.631.0 (pure + wiring): DOORS / WINDOWS OPEN (%, WHICH WAY), THE AUTO ROOF + AUTO FLOOR; THE VIEW ▾ CAMERAS.
 * Tim: "add door open and window open properties to door and window, create inputs for percentage open and a checkbox for
 * direction. add an auto roof and auto floor option" */
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
// a room 4 x 3 (front wall along +x at y = 0, the inside = +y), a door in it
const mk = (o) => { const A = P.empty(), R = P.addRoom(A, [[0, 0], [4, 0], [4, 3], [0, 3]]); const op = P.addOp(A, o.kind || "door", o.w || 0.9, Object.assign({ room: R.id, edge: 0, at: 2 }, o)); return { A, R, op }; };
const reach = (A, id) => { let lo = 0, hi = 0; P.build(A).polys.filter((p) => p.tag.ak === "op" && p.tag.id === id).forEach((p) => p.rings[0].forEach((q) => { lo = Math.min(lo, q[1]); hi = Math.max(hi, q[1]); })); return { lo, hi }; };
let t = mk({});
check("kept with the building: open (0-100 %) and which way", P.clean({ rooms: t.A.rooms, ops: [Object.assign({}, t.op, { open: 250, dir: 1 })] }).ops[0].open === 100 && P.clean({ rooms: t.A.rooms, ops: [Object.assign({}, t.op, { open: 40 })] }).ops[0].dir === false);
const shut = reach(t.A, t.op.id);
t.op.open = 100; const inw = reach(t.A, t.op.id);
t.op.dir = true; const outw = reach(t.A, t.op.id);
check("a door 100 % open: its leaf swings 90° into the room (about its width); 'Opens outward' = out of it", shut.hi < 0.15 && inw.hi > 0.75 && outw.lo < -0.75 && outw.hi < 0.15, { shut, inw, outw });
t.op.dir = false; t.op.open = 50; const half = reach(t.A, t.op.id);
check("…50 %: 45° (about 0.6 m in)", half.hi > 0.55 && half.hi < 0.75, half);
t = mk({ kind: "window", w: 1.2 }); const w0 = reach(t.A, t.op.id); t.op.open = 100; const w1 = reach(t.A, t.op.id); t.op.dir = true; const w2 = reach(t.A, t.op.id);
check("a window open: its sashes swing out (outside = -y); 'Opens inward' = into the room", w1.lo < w0.lo - 0.3 && w2.hi > w0.hi + 0.3, { w0, w1, w2 });
t = mk({ kind: "window", w: 1.2, style: "slider" });
const xs = (A, id) => P.build(A).polys.filter((p) => p.tag.ak === "op" && p.tag.id === id && p.alpha < 1).map((p) => Math.min(...p.rings[0].map((q) => q[0])));
const s0 = xs(t.A, t.op.id); t.op.open = 100; const s1 = xs(t.A, t.op.id);
check("a sliding window open: a pane slides along (its glass moved)", s0.length > 0 && JSON.stringify(s0) !== JSON.stringify(s1), { s0, s1 });
// the auto floor + roof
t = mk({}); t.R.slab = true;
const sl = P.build(t.A).polys.filter((p) => p.tag.ak === "room" && p.tag.part === "slab");
const X = P.exterior(t.R);
check("auto floor: a 20 cm slab under the room's outside walls (it follows the room)", sl.length >= 6 && X && near(Math.min(...X.map((q) => q[0])), -0.075) && sl.some((p) => p.n[2] === -1 && p.rings[0].every((q) => near(q[2], -0.2))));
check("…kept (room.slab)", P.clean(JSON.parse(JSON.stringify(t.A))).rooms[0].slab === true && P.clean({ rooms: [{ pts: [[0, 0], [1, 0], [1, 1]] }] }).rooms[0].slab === false);
const TL = read("ext/pushpulldock/pparchtools.js");
check("the panel: a door / window's Open (%) + Opens outward / Opens inward / The other pane slides; the Room tool's Auto roof + Auto floor; a room's Floor slab + Roof",
  /numIn\("Open", op\.open/.test(TL) && /"Opens outward"/.test(TL) && /"Opens inward"/.test(TL) && /"The other pane slides"/.test(TL) && /Auto roof \(the Roof tool's type\)/.test(TL) && /Auto floor \(a slab under the walls\)/.test(TL)
  && /if \(O\.room\.autoRoof\) P\(\)\.addRoof/.test(TL) && /slab: !!O\.room\.autoFloor/.test(TL) && /"Floor slab under the walls"/.test(TL) && /chkIn\("Roof", !!own/.test(TL));
check("server.js untouched by this release", !/autoRoof|exterior/.test(read("misc/server.js")));
console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
