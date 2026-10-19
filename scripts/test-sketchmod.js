// scripts/test-sketchmod.js — 2.463.0: the sketch's MODIFY tools + more shapes, the pure part (ext/imageeditdock/pcsketch.js):
// crossings, trim (a line's middle / end, a circle -> an arc, nothing crossing = gone), extend, fillet (a tangent arc +
// its radius, fully constrained stays so), chamfer, offset (a closed chain stays joined, circles concentric), mirror
// (symmetric copies that follow), rectangular / circular patterns, polygon, slot, 2- / 3-point circles, splines.
"use strict";
const fs = require("fs"), path = require("path");
const K = require("../ext/imageeditdock/pcsketch.js");
let fail = 0;
const check = (name, ok, extra) => { console.log((ok ? "ok   " : "FAIL ") + name + (ok || extra === undefined ? "" : " " + JSON.stringify(extra))); if (!ok) fail++; };
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-4);
const P = (s, id) => K.pt(s, id);
const lines = (s) => s.ents.filter((e) => e.t === "line" && !e.axis && !e.cons);

/* crossings */
const X = K.crossings({ k: "seg", a: [0, 0], b: [10, 10] }, { k: "seg", a: [0, 10], b: [10, 0] });
const Y = K.crossings({ k: "seg", a: [-10, 0], b: [10, 0] }, { k: "circ", c: [0, 0], r: 5, a0: null, a1: null });
const Z = K.crossings({ k: "circ", c: [0, 0], r: 5, a0: null, a1: null }, { k: "circ", c: [8, 0], r: 5, a0: null, a1: null });
check("crossings: two segments (at 5,5), a line through a circle (2), two circles (2)", X.length === 1 && near(X[0].p[0], 5) && near(X[0].ta, 0.5) && Y.length === 2 && Z.length === 2 && near(Z[0].p[0], 4));

/* trim */
let s = K.create(0, 0);
const h = K.line(s, [0, 100], [300, 100]); K.tryAdd(s, { t: "horizontal", a: h }, "con"); K.line(s, [100, 0], [100, 200]); const v2 = K.line(s, [200, 0], [200, 200]);
check("cutsOf: a line crossed by two others is cut at 1/3 and 2/3", JSON.stringify(K.cutsOf(s, K.ent(s, h)).map((c) => Math.round(c.t * 1000) / 1000)) === "[0.333,0.667]");
let r = K.trim(s, h, 150, 100);
const hs = lines(s).filter((e) => near(P(s, e.p1).y, 100) && near(P(s, e.p2).y, 100)).map((e) => [P(s, e.p1).x, P(s, e.p2).x].sort((a, b) => a - b)).sort((a, b) => a[0] - b[0]);
check("Trim the middle piece: two lines 0-100 and 200-300 remain, both still horizontal, their new ends kept on the crossing lines", r.ok && JSON.stringify(hs) === "[[0,100],[200,300]]" && s.cons.filter((k) => k.t === "horizontal").length === 2 && s.cons.filter((k) => k.t === "onLine").length === 2 && K.solve(s).ok, { hs, cons: s.cons.map((k) => k.t) });
r = K.trim(s, v2, 200, 20);
check("Trim an end piece: that line now starts where it was crossed (y 100)", r.ok && near(Math.min(P(s, K.ent(s, v2).p1).y, P(s, K.ent(s, v2).p2).y), 100));
const lone = K.line(s, [400, 400], [500, 400]); r = K.trim(s, lone, 450, 400);
check("Trim a line nothing crosses: it goes", r.ok && r.removed && !K.ent(s, lone));
s = K.create(0, 0);
const c = K.circle(s, [100, 100], 50); K.line(s, [0, 100], [200, 100]);
const dc = K.tryAdd(s, K.dimFrom(s, "diameter", [c]), "dim");
r = K.trim(s, c, 100, 50);
const arc = s.ents.find((e) => e.t === "arc"), A = arc && K.arcAngles(s, arc);
check("Trim a circle cut by a line: the clicked half goes - an arc (the lower half) on the same centre, its diameter dimension moved to it", r.ok && arc && near(A.a1 - A.a0, Math.PI) && A.cy === 100 && near(Math.sin((A.a0 + A.a1) / 2), 1) && s.dims[0].refs[0] === arc.id && dc.ok, { A, dims: s.dims });

/* extend */
s = K.create(0, 0);
const a = K.line(s, [0, 0], [50, 50]), wall = K.line(s, [200, -100], [200, 300]);
r = K.extend(s, a, 48, 48);
check("Extend: the line's end runs on to the next line it meets (200, 200), kept on it", r.ok && r.to === wall && near(P(s, K.ent(s, a).p2).x, 200) && near(P(s, K.ent(s, a).p2).y, 200) && s.cons.some((k) => k.t === "onLine" && k.b === wall));
check("Extend: nothing that way -> refused", !K.extend(s, wall, 200, -100).ok);

/* fillet + chamfer */
s = K.create(0, 0);
const R = K.rect2(s, [0, 0], [200, 100]); K.tryAdd(s, { t: "fix", a: R.pts[0] }, "con"); K.tryAdd(s, K.dimFrom(s, "len", [R.lines[2]]), "dim"); K.tryAdd(s, K.dimFrom(s, "len", [R.lines[3]]), "dim");
check("(a fixed 200 x 100 rectangle: fully constrained)", K.dof(s).dof === 0);
const f = K.fillet(s, R.lines[0], R.lines[1], 20), FA = K.arcAngles(s, K.ent(s, f.arc));
check("Fillet the top-right corner r 20: an arc centred (180, 20), a quarter turn, tangent to both lines, its radius dimension; still fully constrained",
  f.ok && near(FA.cx, 180) && near(FA.cy, 20) && near(FA.r, 20) && near(FA.a1 - FA.a0, Math.PI / 2) && s.cons.filter((k) => k.t === "tangent").length === 2 && s.dims.some((m) => m.t === "radius" && m.v === 20) && K.dof(s).dof === 0, { f, FA, dof: K.dof(s).dof });
K.setDim(s, f.dim, 35);
const FB = K.arcAngles(s, K.ent(s, f.arc));
check("...its radius typed 35: the arc grows, still tangent (centre 165, 35)", near(FB.r, 35, 1e-3) && near(FB.cx, 165, 1e-3) && near(FB.cy, 35, 1e-3), FB);
check("Fillet too big for the lines -> refused", !K.fillet(s, R.lines[2], R.lines[3], 500).ok);
const ch = K.chamfer(s, R.lines[2], R.lines[3], 30);
const pr = K.profiles(s);
check("Chamfer the bottom-left corner by 30: a cutting line; one profile 20000 - fillet - 450", ch.ok && pr.length === 1 && near(pr[0].area, 20000 - (35 * 35 - Math.PI * 35 * 35 / 4) - 450, 30), pr.map((p) => Math.round(p.area)));

/* offset */
s = K.create(0, 0);
const Q = K.rect2(s, [0, 0], [200, 100]);
r = K.offset(s, Q.lines, 10);             // 2.494.0: + = out (away from what the chain encloses)
let areas = K.profiles(s).map((p) => Math.round(p.area)).sort((x, y) => x - y);
check("Offset a closed rectangle 10 out: 4 joined lines (one more profile 220 x 120), each parallel to its own", r.ok && r.ents.length === 4 && JSON.stringify(areas) === "[20000,26400]" && s.cons.filter((k) => k.t === "parallel").length === 4, areas);
K.drag(s, [Q.pts[2]], 30, 20);
const W = Math.abs(P(s, Q.pts[2]).x - P(s, Q.pts[0]).x), H = Math.abs(P(s, Q.pts[2]).y - P(s, Q.pts[0]).y);
areas = K.profiles(s).map((p) => p.area).sort((x, y) => x - y);
check("...the original dragged bigger: the offset follows, still 10 out all round ((w + 20) x (h + 20))", W > 205 && near(areas[0], W * H, 1e-2) && near(areas[1], (W + 20) * (H + 20), 1e-2), { W, H, areas });
const oc = K.circle(s, [500, 500], 40); r = K.offset(s, [oc], 15);
const occ = K.ent(s, r.ents[0]);
check("Offset a circle by 15: a concentric circle r 55 (kept 15 bigger)", r.ok && occ.t === "circle" && occ.c === K.ent(s, oc).c && near(occ.r, 55));

/* mirror */
s = K.create(0, 0);
const ax = K.line(s, [100, -50], [100, 250]); K.tryAdd(s, { t: "fix", a: K.ent(s, ax).p1 }, "con"); K.tryAdd(s, { t: "fix", a: K.ent(s, ax).p2 }, "con");
const m1 = K.line(s, [20, 0], [80, 40]), mc = K.circle(s, [60, 150], 20);
r = K.mirror(s, [m1, mc], ax);
const ml = K.ent(s, r.ents[0]), mcc = K.ent(s, r.ents[1]);
check("Mirror a line + a circle about x = 100: copies at x 180 / 120 and 140 (r 20), symmetric constraints", r.ok && near(P(s, ml.p1).x, 180) && near(P(s, ml.p2).x, 120) && near(P(s, mcc.c).x, 140) && near(mcc.r, 20) && s.cons.filter((k) => k.t === "symmetric").length === 3, r);
K.drag(s, [K.ent(s, m1).p1], -10, 0);
check("...the original dragged 10 left: its copy goes 10 right", near(P(s, ml.p1).x, 190, 1e-3));

/* patterns */
s = K.create(0, 0);
const pc = K.circle(s, [50, 50], 10);
r = K.patternRect(s, [pc], 3, 2, 40, 60);
check("Rectangular pattern 3 x 2: 5 copies 40 / 60 apart", r.ok && r.ents.length === 5 && r.ents.map((id) => [P(s, K.ent(s, id).c).x, P(s, K.ent(s, id).c).y].join()).sort().join("|") === ["130,50", "130,110", "50,110", "90,50", "90,110"].sort().join("|"));
const pl = K.line(s, [100, 0], [150, 0]); K.tryAdd(s, { t: "horizontal", a: pl }, "con");
r = K.patternCirc(s, [pl], s.origin.pt, 4, 360);
const quarter = K.ent(s, r.ents[0]);
check("Circular pattern 4 round the origin: 3 copies a quarter turn apart (the first at (0,100)-(0,150)); Horizontal not copied to the turned ones", r.ok && r.ents.length === 3 && near(P(s, quarter.p1).x, 0) && near(P(s, quarter.p1).y, 100) && s.cons.filter((k) => k.t === "horizontal").length === 1 + 1, { p: P(s, quarter.p1), h: s.cons.filter((k) => k.t === "horizontal").length });

/* shapes */
s = K.create(0, 0);
const pg = K.polygon(s, [100, 100], [150, 100], 6);
check("Polygon 6: a regular hexagon (area 3√3/2 r²) in a construction circle, 4 degrees of freedom (centre, size, turn)", pg.ok && near(K.profiles(s)[0].area, 1.5 * Math.sqrt(3) * 2500, 1) && K.dof(s).dof === 4 && K.ent(s, pg.circle).cons);
s = K.create(0, 0);
const sl = K.slot(s, [0, 0], [100, 0], 40);
check("Slot 100 long, 40 wide: two half circles + two lines, tangent, 5 degrees of freedom; area ~ 100 x 40 + π 20²", sl.ok && K.solve(s).ok && K.dof(s).dof === 5 && near(K.profiles(s)[0].area, 4000 + Math.PI * 400, 40), K.profiles(s).map((p) => p.area));
s = K.create(0, 0);
const c2 = K.circle2(s, [0, 0], [100, 0]), c3 = K.circle3p(s, [0, 0], [100, 0], [50, 50]);
check("2-point circle (a diameter) r 50 at (50, 0); 3-point circle through the three points", near(K.ent(s, c2).r, 50) && near(P(s, K.ent(s, c2).c).x, 50) && near(K.ent(s, c3).r, 50) && near(P(s, K.ent(s, c3).c).y, 0));
s = K.create(0, 0);
const sp = K.spline(s, [[0, 0], [50, 40], [100, 0]]); K.line(s, K.ent(s, sp).pts[2], K.ent(s, sp).pts[0]);
const sprof = K.profiles(s);
check("Spline through 3 points: passes them (distance 0 at the middle one), closes a profile with a line (Bézier path)", near(K.distTo(s, K.ent(s, sp), 50, 40), 0) && sprof.length === 1 && sprof[0].path.subs[0].pts.some((q) => Math.hypot(q.ox - q.x, q.oy - q.y) > 1));

/* wiring */
const rd = (...p) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");
const UI = rd("ext", "imageeditdock", "pcui.js"), ST = rd("ext", "imageeditdock", "pcsketchtools.js");
check("wiring: the 9 new tools in the N group with icons; T / E / F letters; Offset / Mirror / patterns in the 📐 Sketch tab",
  ["sk_trim", "sk_extend", "sk_fillet", "sk_chamfer", "sk_poly", "sk_slot", "sk_circle2", "sk_circle3", "sk_spline"].every((t) => UI.includes(`["${t}", `) && new RegExp("\\n    " + t + ": '").test(UI) && ST.includes(`E.tools.${t} = `))
  && /t: "sk_trim", e: "sk_extend", f: "sk_fillet"/.test(ST) && /id="skOffset"/.test(ST) && /id="skMirror"/.test(ST) && /id="skRectPat"/.test(ST) && /id="skCircPat"/.test(ST));

console.log(fail ? `\n${fail} FAILED` : "\nall sketch modify checks passed");
process.exit(fail ? 1 : 0);
