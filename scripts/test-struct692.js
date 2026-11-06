#!/usr/bin/env node
/* bitGen Studio — 2.692.0: THE SKETCHER'S STRUCTURE - ext/pushpulldock/ppstruct.js (floor systems: slab on ground, waffle pod,
 * stiffened raft, suspended slab on piers, raised timber floor on piers / bearers / joists; lintels; the beam check) + its wiring
 * in pparch.js (clean, build) and pparchtools.js (the room / door / window panels). The browser: scripts/test-ui692-ui.js.
 * Tim (verbatim): "is it possible to add framing, wood/steel to australian standards? and flooring solutions like slab, pier, raised
 * etc" + "just use the standards don't import anything - don't do anything to jepordize the free license" */
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
const room = (z, fs0) => { const A = P.empty(), R = P.addRoom(A, P.rectPts([0, 0], [6, 4]), true); R.z = z; R.fs = S.clean(fs0); return { A, R }; };

const c = S.clean({ type: "raised", joist: { D: 9999, at: 0.01, grade: "nope" }, pier: { kind: "steel" } });
check("clean(): 6 floor systems, a raised floor's members held to sense (a bad grade = MGP10), the pier kind's width", S.FLOORS.length === 6 && c.joist.D === 600 && c.joist.at === 0.3 && c.joist.grade === "MGP10" && c.pier.w === S.PIERS.steel.w && S.clean({}).type === "none");
const m = (D, B, n) => ({ D, B, n: n || 1, grade: "MGP10" });
const k1 = S.check(m(140, 45), 2, 0.2, 0.7), k2 = S.check(m(190, 45), 2, 0.2, 0.7);
check("check(): a deeper section = a lower use of its limit, a longer span a higher one", k2.util < k1.util && S.check(m(140, 45), 3, 0.2, 0.7).util > k1.util);
const sb = S.check(m(140, 45), 2, 0, 1, {});
const Z = 45 * 140 * 140 / 6, M2 = (1.2 * (500 * 0.045 * 0.14 * 9.81 / 1000) + 1.5) * 4 / 8;
check("check(): the strength sum - M* = (1.2G + 1.5Q) L²/8 against φ k1 f'b Z (0.85 × 0.8 × 17 MPa)", Math.abs(sb.strength - Math.max(M2 / (0.85 * 0.8 * 17 * Z / 1e6), 1.35 * (500 * 0.045 * 0.14 * 9.81 / 1000) * 0.5 / (0.85 * 0.57 * 17 * Z / 1e6))) < 1e-9, sb);
const J = (D, B, L) => S.check(m(D, B), L, 0.4 * 0.45, 1.5 * 0.45, S.JOIST);
check("a floor joist (450 centres) is held by the 1.8 kN point load + the bounce (1 kN <= 2 mm): 90 × 35 fails at 1.8 m, 140 × 45 passes", !J(90, 35, 1.8).ok && J(140, 45, 1.8).ok && J(140, 45, 1.8).bounce > 0);
const best = S.choose(1.8, 0.4 * 0.45, 1.5 * 0.45, "MGP10", { n: 1 }, S.JOIST);
check("choose(): the smallest stock section that passes (and the one below it does not)", best && J(best.D, best.B, 1.8).ok && S.SIZES.filter(([D, B]) => D * B < best.D * best.B).every(([D, B]) => !J(D, B, 1.8).ok), best);
check("a stronger grade (MGP15) uses less of its limit where MGP10 does not", !S.check(m(120, 45), 2.4, 0.18, 0.675, S.JOIST).ok && S.check({ D: 120, B: 45, n: 1, grade: "MGP15" }, 2.4, 0.18, 0.675, S.JOIST).util < S.check(m(120, 45), 2.4, 0.18, 0.675, S.JOIST).util);
// a raised floor
const { A, R } = room(0.7, { type: "raised" }), pl = S.plan(A, R, H), parts = (k) => pl.parts.filter((p) => p.part === k);
const X = P.exterior(R), fsR = S.clean(R.fs);
check("raised: the flooring under the whole outline, bearers along the long side no further apart than set, piers along them, joists across",
  parts("flooring").length === 1 && parts("bearer").length === 4 && parts("joist").length >= Math.ceil(6.15 / 0.45) && parts("pier").length === 20, pl.members);
const bear = parts("bearer")[0], joist = parts("joist")[0], pier = parts("pier")[0];
check("raised: heights - the flooring's top at the room's floor, the joists under it, the bearers under them, the piers from the ground up to the bearers",
  Math.abs(joist.z1 - (0.7 - fsR.sheet)) < 1e-9 && Math.abs(bear.z1 - joist.z0) < 1e-9 && Math.abs(pier.z1 - bear.z0) < 1e-9 && pier.z0 === 0 && Math.abs(joist.z1 - joist.z0 - 0.14) < 1e-9);
check("raised: the members listed (joists, bearers, piers) and how much clearance there is", pl.members.length === 3 && /140 × 45 MGP10 @ 450/.test(pl.members[0].size) && pl.members[2].count === 20 && Math.abs(pl.clear - (0.7 - 0.019 - 0.14 - 0.19)) < 1e-6 && !pl.notes.length);
check("raised too low: a note to raise the floor", S.plan(room(0.4, { type: "raised" }).A, room(0.4, { type: "raised" }).R, H).notes.some((t) => /raise the room's Floor level/.test(t)));
check("floorChecks(): the joists and bearers checked + the smallest that passes", S.floorChecks(R.fs).joist.ok && S.floorChecks(R.fs).bearer.best && S.floorChecks({ type: "slab" }) === null);
// slabs
const types = {}; ["slab", "waffle", "raft", "suspended"].forEach((t) => { const q = room(t === "suspended" ? 1 : 0, { type: t }); types[t] = S.plan(q.A, q.R, H); });
check("slab on ground: the slab (top at the floor) + an edge beam along every side", types.slab.parts.filter((p) => p.part === "slab" && p.z1 === 0).length === 1 && types.slab.parts.filter((p) => p.part === "edge beam").length === 4);
check("waffle pod: ribs both ways under the topping; stiffened raft: internal beams; suspended (floor 1 m up): piers from the ground to the slab", types.waffle.parts.some((p) => p.part === "rib") && types.raft.parts.some((p) => p.part === "beam") && types.suspended.parts.some((p) => p.part === "pier") && types.slab.notes.some((t) => /Site class M/.test(t)));
// lintels
const L0 = P.empty(), R1 = P.addRoom(L0, P.rectPts([0, 0], [6, 4]), true), R2 = P.addRoom(L0, P.rectPts([6, 0], [10, 4]), true);
const w = P.addOp(L0, "window", { room: R1.id, edge: 0, at: 3 }, { w: 1.8 }), dIn = P.addOp(L0, "door", { room: R1.id, edge: 1, at: 2 });
const lw = S.lintel(L0, w, H);
check("a window in an outside wall: a lintel - the smallest 2 × 45 that passes over its width + 100 mm; a door in the shared (inside) wall: none",
  lw && Math.abs(lw.span - 1.9) < 1e-9 && lw.m.n === 2 && lw.m.B === 45 && lw.check.ok && S.lintel(L0, dIn, H) === null && Math.abs(lw.rlw - (4 / 2 + 0.45)) < 1e-9, lw && lw.size);
L0.struct.roof = "tile"; const lt = S.lintel(L0, w, H);
check("tiles (heavier) need at least as big a lintel", lt.m.D * lt.m.B * lt.m.n >= lw.m.D * lw.m.B * lw.m.n && lt.g > lw.g);
w.lint = { D: 90, B: 35, n: 1, grade: "MGP10" }; const lo = S.lintel(L0, w, H);
check("a lintel picked by hand is used and checked (90 × 35 over 1.9 m fails)", !lo.auto && lo.size === "90 × 35 MGP10" && !lo.check.ok);
// the model
const C = P.clean(JSON.parse(JSON.stringify(A))); C.struct.show = true; C.ops = []; const o2 = P.build(C), st = o2.polys.filter((p) => p.tag && p.tag.part === "struct");
check("pparch clean keeps the floor system / a lintel / A.struct; build draws the structure (tag part struct); 🪵 show = the walls see-through",
  C.rooms[0].fs.type === "raised" && st.length > 100 && o2.polys.some((p) => p.tag && p.tag.ak === "wall" && p.alpha === 0.3) && P.clean(JSON.parse(JSON.stringify(L0))).ops.find((o) => o.id === w.id).lint.D === 90);
const L1 = P.clean(JSON.parse(JSON.stringify(L0))); L1.struct.show = true; L1.ops.find((o) => o.id === w.id).lint = null;
check("…with 🪵 show on, each outside door / window's lintel is drawn over it", P.build(L1).polys.some((p) => p.tag && p.tag.part === "lintel"));
check("schedule(): every member of the model in rows (room, kind, size, count)", S.schedule(L1, H).some((r) => /Lintel/.test(r.kind)));
const T = fs.readFileSync(path.join(ROOT, "ext", "pushpulldock", "pparchtools.js"), "utf8"), EJ = JSON.parse(fs.readFileSync(path.join(ROOT, "ext", "pushpulldock", "ext.json"), "utf8")), SRC = fs.readFileSync(path.join(ROOT, "ext", "pushpulldock", "ppstruct.js"), "utf8");
check("wired: ppstruct.js before pparch.js; the room panel's 🏗 Floor system (✔ Size them) + the door / window panel's 🪵 Lintel; the guide's words",
  EJ.scripts.indexOf("ppstruct.js") >= 0 && EJ.scripts.indexOf("ppstruct.js") < EJ.scripts.indexOf("pparch.js") && /structRoom\(R\);/.test(T) && /structOp\(op\);/.test(T) && /✔ Size them/.test(T) && /A guide check, not a certificate/.test(T));
check("no supplier's span tables in it (Tim: \"don't import anything\") - stock sizes and grade properties only", !/hySPAN|Carter Holt|CHH|designIT/i.test(SRC) && !/LVL/.test(SRC));
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
