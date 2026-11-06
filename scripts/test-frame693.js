#!/usr/bin/env node
/* bitGen Studio — 2.693.0: THE SKETCHER'S WALL FRAMING - ext/pushpulldock/ppstruct.js wallFrames / frameTotals / the schedule's
 * rows / build (🪵 Show framing), A.struct's frame settings, the room panel's 🪵 Wall framing. The browser: test-ui693-ui.js.
 * Tim (verbatim): "you choose, we will go one at a time" (after 2.692.0 offered wall framing, roof framing, the Plans schedule) */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
globalThis.polygonClipping = require(path.join(ROOT, "static", "vendor", "polygon-clipping.umd.min.js"));
const S = require(path.join(ROOT, "ext", "pushpulldock", "ppstruct.js"));
const P = require(path.join(ROOT, "ext", "pushpulldock", "pparch.js"));
const H = P.structH;
const model = () => { const A = P.empty(), R = P.addRoom(A, P.rectPts([0, 0], [6, 4]), true), R2 = P.addRoom(A, P.rectPts([6, 0], [10, 4]), true);
  const w = P.addOp(A, "window", { room: R.id, edge: 0, at: 3 }, { w: 1.8 }), d = P.addOp(A, "door", { room: R.id, edge: 1, at: 2 }); return { A, R, R2, w, d }; };
const c = S.cleanStruct({ frame: "bogus", stud: { D: 9999, at: 0.01 }, steel: "x", plates: 7 });
check("cleanStruct: timber by default, a 90 × 35 MGP10 stud @ 450 held to sense, steel c89, 2 top plates, noggings 1.2 m, braces on",
  c.frame === "timber" && c.stud.D === 300 && c.stud.at === 0.3 && c.steel === "c89" && c.plates === 2 && c.nog === 1.2 && c.brace && S.cleanStruct({}).stud.D === 90);
const { A, R, R2 } = model(), W = S.wallFrames(A, R, H), W2 = S.wallFrames(A, R2, H);
check("every wall framed once - the wall two rooms share by the first room only (Room 1: 4 walls, Room 2: 3)", W.length === 4 && W2.length === 3);
const w0 = W.find((x) => x.i === 0), parts = (w, k) => w.parts.filter((p) => p.part === k);
check("the window's wall: bottom plate (one piece), 2 top plates, a jamb stud each side, jack studs over the head and under the sill, a sill trimmer, no head (its lintel is the head)",
  parts(w0, "bottom plate").length === 1 && parts(w0, "top plate").length === 2 && parts(w0, "jamb stud").length === 2 && parts(w0, "jack stud").length >= 6 && parts(w0, "sill trimmer").length === 1 && !parts(w0, "head").length, w0.n);
const st = parts(w0, "stud").concat(parts(w0, "jamb stud")).map((p) => (p.x0 + p.x1) / 2).sort((a, b) => a - b);
check("studs (common + jamb) no further apart than the spacing (450), none inside the window, none on top of another", st.every((x, k) => !k || x - st[k - 1] <= 0.45 + 1e-9 || (st[k - 1] < 2.1 && x > 3.9)) && st.every((x, k) => !k || x - st[k - 1] >= 0.035 - 1e-6) && st.every((x) => x < 2.1 || x > 3.9));
const w1 = W.find((x) => x.i === 1);
check("the door's wall: the bottom plate cut at the door (2 pieces), noggings broken at it (a row over its head runs through), jack studs over it only", parts(w1, "bottom plate").length === 2 && parts(w1, "nogging").filter((p) => p.z1 < 2.1).every((p) => p.x1 <= 1.55 + 1e-6 || p.x0 >= 2.45 - 1e-6) && parts(w1, "nogging").some((p) => p.z0 > 2.2 && p.x0 < 1 && p.x1 > 3) && parts(w1, "jack stud").every((p) => p.z0 > 2));
check("the frame inside the wall's own length: ends half a stud short of each corner (the corner post fills it), on the floor, under the wall's top",
  W.every((w) => w.parts.every((p) => p.strap || p.part === "corner post" || (p.x0 >= w.s0 - 1e-9 && p.x1 <= w.s1 + 1e-9 && p.z0 >= R.z - 1e-9 && p.z1 <= R.z + R.h + 1e-9))) && W.reduce((n, w) => n + parts(w, "corner post").length, 0) === 4);
check("strap braces only in clear panels 1.8 m or longer (the window wall has two, beside the window)", parts(w0, "strap brace").length === 2 && W.find((x) => x.i === 3).parts.filter((p) => p.strap).length === 1);
const inside = S.wallFrames((() => { const m = model(); P.addOp(m.A, "door", { room: m.R2.id, edge: 3, at: 2 }); return m.A; })(), model().R, H);
const shared = (() => { const m = model(), dd = P.addOp(m.A, "door", { room: m.R.id, edge: 1, at: 2 }); void dd; return S.wallFrames(m.A, m.R, H).find((x) => x.i === 1); })();
check("a door in the shared (inside) wall gets a head instead of a lintel", parts(shared, "head").length >= 1 && inside.length === 4);
const t = S.frameTotals(A, R, H);
check("frameTotals: studs / jambs / jacks, metres of studs / plates / noggings, braces", t.walls === 4 && t.jambs === 4 && t.studs > 30 && t.plate > 50 && t.nog > 30 && t.braces === 4, t);
const B = S.cleanStruct(Object.assign({}, A.struct, { frame: "steel" })), A2 = Object.assign({}, A, { struct: B }), ws = S.wallFrames(A2, A2.rooms[0], H);
check("light-gauge steel: one top track, the C-section's flange as the stud width", parts(ws.find((x) => x.i === 0), "top plate").length === 1 && Math.abs(parts(ws[0], "stud")[0].x1 - parts(ws[0], "stud")[0].x0 - 0.041) < 1e-9);
check("frame None / a room set not to be framed = nothing", !S.wallFrames(Object.assign({}, A, { struct: S.cleanStruct({ frame: "none" }) }), R, H).length && !S.wallFrames(A, Object.assign({}, R, { noFrame: true }), H).length);
const C = P.clean(JSON.parse(JSON.stringify(A))); const off = P.build(C).polys.filter((p) => p.tag && p.tag.part === "frame").length; C.struct.show = true;
const on = P.build(C).polys.filter((p) => p.tag && p.tag.part === "frame").length;
check("drawn only with 🪵 Show framing (tag part frame, its wall's edge)", off === 0 && on > 500 && P.build(C).polys.some((p) => p.tag && p.tag.part === "frame" && p.tag.edge === 0));
check("the schedule: studs, plates, noggings and braces per room", S.schedule(A, H).filter((r) => /Studs|Plates|Noggings|Strap braces/.test(r.kind)).length === 8);
const nf = JSON.parse(JSON.stringify(Object.assign({}, A, { struct: S.cleanStruct({ frame: "steel", steel: "c150" }) }))); nf.rooms[1].noFrame = true; const nc = P.clean(nf);
check("clean keeps the frame settings + a room's noFrame", nc.struct.steel === "c150" && nc.rooms[1].noFrame === true && nc.rooms[0].noFrame === false);
const T = fs.readFileSync(path.join(ROOT, "ext", "pushpulldock", "pparchtools.js"), "utf8");
check("wired: the room panel's 🪵 Wall framing (frame, studs / steel, spacing, noggings, braces, this room) - stud sizes said to be unchecked",
  /function structWalls\(R\)/.test(T) && /structWalls\(R\);/.test(T) && /Frame this room's walls/.test(T) && /Stud sizes are NOT checked/.test(T));
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
