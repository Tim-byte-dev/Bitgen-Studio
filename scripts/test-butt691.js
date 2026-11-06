#!/usr/bin/env node
/* bitGen Studio — 2.691.0: A NEW WALL BUTTS UP TO THE OLD ONE - ext/pushpulldock/pparch.js butts(A) (read by wallQuads / joints;
 * walls() and the plan / sheets work it out first) and the last-set wall thickness in pparchtools.js. The browser:
 * scripts/test-ui691-ui.js.
 * Tim (verbatim): "the ends of the walls are not mitered or shaped, the new wall will butt up to the existing walls, even in rooms,
 * use last set wall thickness for the wall thickness right now u have it set at 2m" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const pc = globalThis.polygonClipping = require(path.join(ROOT, "static", "vendor", "polygon-clipping.umd.min.js"));
const P = require(path.join(ROOT, "ext", "pushpulldock", "pparch.js"));
const r3 = (v) => Math.round(v * 1000) / 1000;
const ring = (q) => { const r = q.map((p) => [p[0], p[1]]); return P.area2 && P.area2(r) < 0 ? r.reverse() : r; };
/** the walls' outline at the floor (all the pieces as one shape) -> its rings' corner count + area */
const outline = (A) => { P.butts(A); const parts = []; A.rooms.forEach((R) => { P.wallQuads(R).forEach((q) => parts.push([q.quad.concat([q.quad[0]])])); P.joints(R).forEach((j) => parts.push([j.poly.concat([j.poly[0]])])); });
  const U = pc.union.apply(null, parts); return U; };
const area = (U) => U.reduce((s, poly) => s + poly.reduce((t, rg, i) => { let a = 0; for (let k = 0; k + 1 < rg.length; k++) a += rg[k][0] * rg[k + 1][1] - rg[k + 1][0] * rg[k][1]; return t + (i ? -Math.abs(a / 2) : Math.abs(a / 2)); }, 0), 0);
const corners = (rg) => { const r = rg.slice(0, -1); return r.filter((b, i) => { const a = r[(i - 1 + r.length) % r.length], c = r[(i + 1) % r.length]; return Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) > 1e-9; }).length; };

// 1. end to end at an angle (joined): the new wall has no cap, the old one's end is shaped round the corner
const A = P.empty(), W1 = P.addRoom(A, [[0, 0], [3, 0]], { closed: false, t: 0.3 }), W2 = P.addRoom(A, [[3, 0], [4.5, 2.6]], { closed: false, t: 0.3 }); P.addJoins(A, W2);
const b = P.butts(A);
check("joined end to end: the NEW wall's end butts (no cap); the OLD wall's end is shaped (a hull)", b[W2.id] && b[W2.id][0].butt && b[W1.id] && b[W1.id][1].hull && b[W1.id][1].hull.length >= 4, b);
const j1 = P.joints(W1).filter((j) => j.k === 1), j2 = P.joints(W2).filter((j) => j.k === 0);
check("…joints: the old wall's end piece is the shaped one, the new wall has none there", j1.length === 1 && j1[0].shaped && j2.length === 0);
const U = outline(A);
check("…the two walls are ONE clean outline - no notch at the corner: 6 corners (an L), like one wall drawn round it", U.length === 1 && U[0].length === 1 && corners(U[0][0]) === 6, U[0] && U[0][0].map((p) => p.map(r3)));
const B1 = P.empty(); P.addRoom(B1, [[0, 0], [3, 0], [4.5, 2.6]], { closed: false, t: 0.3 });
check("…the same outline (area) as ONE wall drawn round that corner", Math.abs(area(U) - area(outline(B1))) < 1e-6, [area(U), area(outline(B1))]);
// 2. not joined: the later one butts
const C = P.empty(), C1 = P.addRoom(C, [[0, 0], [4, 0]], { closed: false }), C2 = P.addRoom(C, [[4, 3], [4, 0]], { closed: false }), bc = P.butts(C);
check("not joined (drawn there): the LATER wall butts, the earlier one gets the corner - either way round its points go", bc[C2.id] && bc[C2.id][1].butt && bc[C1.id][1].hull && !bc[C1.id][0]);
// 3. a partition in a room: its ends on the room's walls' lines are cut to the walls' INSIDE faces (no cap)
const D = P.empty(), R = P.addRoom(D, P.rectPts([0, 0], [5, 4]), true); R.t = 0.3;
const Pn = P.addRoom(D, [[2, 0], [2, 4]], { closed: false, t: 0.1 }), bd = P.butts(D), q = P.wallQuads(Pn)[0].quad.map((p) => p.map(r3));
check("a partition from wall to wall (centre line to centre line): both ends butt; cut to the inside faces (y 0.15 and 3.85)", bd[Pn.id][0].butt && bd[Pn.id][1].butt && q.every((p) => p[1] === 0.15 || p[1] === 3.85) && !P.joints(Pn).length, q);
check("…the room keeps its own corners (no change to it)", !bd[R.id] && P.joints(R).length === 4);
// 4. an angled wall into a room's wall - thick: both its corners on the face (no wedge, no cap through the room)
const E = P.empty(), R2 = P.addRoom(E, P.rectPts([0, 0], [5, 4]), true); R2.t = 0.2;
const Wd = P.addRoom(E, [[2.5, -3], [2.5 + 3 * Math.tan(Math.PI / 6), 0]], { closed: false, t: 0.6 }); P.butts(E);
const qd = P.wallQuads(Wd)[0].quad;
check("a thick wall at 30° into a room's wall from outside: its end corners both on the wall's OUTSIDE face (y -0.1)", Math.abs(qd[1][1] + 0.1) < 1e-9 && Math.abs(qd[2][1] + 0.1) < 1e-9 && !P.joints(Wd).some((j) => j.k === 1), qd.map((p) => p.map(r3)));
// 5. a wall from a room's corner: butts (the room keeps its corner)
const F = P.empty(), R3 = P.addRoom(F, P.rectPts([0, 0], [4, 3]), true), Wf = P.addRoom(F, [[4, 0], [7, -2]], { closed: false }), bf = P.butts(F);
check("a wall out of a room's corner: it butts - no cap of its own into the room", bf[Wf.id] && bf[Wf.id][0].butt && !P.joints(Wf).some((j) => j.k === 0) && P.joints(Wf).some((j) => j.k === 1));
// 6. a free end on nothing: as before (a square cap); an end given its own size (2.664.0) keeps it
const G = P.empty(), G1 = P.addRoom(G, [[0, 0], [4, 0]], { closed: false }), G2 = P.addRoom(G, [[4, 0], [4, 3]], { closed: false }); G2.jw = { 0: { w: 0.4 } }; P.addJoins(G, G2); const bg = P.butts(G);
check("a free end on nothing keeps its square cap; an end with its own width (✎ this end) keeps its piece", P.joints(G1).some((j) => j.k === 0 && j.kind === "end" && !j.shaped) && !(bg[G2.id] && bg[G2.id][0]) && P.joints(G2).some((j) => j.k === 0 && j.w === 0.4));
// 7. walls() works it out itself (a model straight from a save)
const H = JSON.parse(JSON.stringify(A)), Hc = P.clean(H), out = P.build(Hc);
check("build() / walls() works the butts out itself (a model as loaded) - the new wall has no cap there", !P.joints(Hc.rooms[1]).some((j) => j.k === 0) && out.polys.length > 0);
// 8. the plan + sheets ask for it first; the last-set thickness
const PL = fs.readFileSync(path.join(ROOT, "ext", "pushpulldock", "ppplan.js"), "utf8"), SH = fs.readFileSync(path.join(ROOT, "ext", "pushpulldock", "ppsheets.js"), "utf8"), T = fs.readFileSync(path.join(ROOT, "ext", "pushpulldock", "pparchtools.js"), "utf8");
check("the plan (draw + pick) and the sheets' outline work the butts out first", (PL.match(/if \(Q\.butts\) Q\.butts\(A\);/g) || []).length === 2 && /if \(Q\.butts\) Q\.butts\(A\);/.test(SH));
check("thickness: every Wall thickness box = the next walls' / rooms' (lastT); over 2 = mm; a stored 2 m back to 150 mm; a wall drawn out of an end uses it",
  (T.match(/tIn\("(Wall thickness|Thickness \(all)/g) || []).length === 3 && /const tOf = \(v\) => Math\.min\(2, Math\.max\(0\.02, v > 2 \? v \/ 1000 : v\)\)/.test(T) && /const lastT = \(v\) => \{ O\.wall\.t = v; O\.room\.t = v; keepOpt\(\); \}/.test(T)
  && /if \(!\(O\[k\]\.t >= 0\.02 && O\[k\]\.t < 2\)\) O\[k\]\.t = OPT0\[k\]\.t;/.test(T) && /t: O\.wall\.t, wall: R0\.wall \}\);\s+\/\/ 2\.691\.0/.test(T) && !/numIn\("Wall thickness"/.test(T));
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
