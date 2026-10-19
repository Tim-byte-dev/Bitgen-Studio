// scripts/test-sketch.js — 2.462.0: SKETCH LAYERS, the pure part (ext/imageeditdock/pcsketch.js: the model, the
// constraint solver, degrees of freedom, profiles; pcsketchtools.js conFor / dimFor / snapFor) + the wiring.
"use strict";
const fs = require("fs"), path = require("path");
const K = require("../ext/imageeditdock/pcsketch.js");
global.PCSketch = K;
const T = require("../ext/imageeditdock/pcsketchtools.js");
let fail = 0;
const check = (name, ok, extra) => { console.log((ok ? "ok   " : "FAIL ") + name + (ok || extra === undefined ? "" : " " + JSON.stringify(extra))); if (!ok) fail++; };
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-4);
const P = (s, id) => K.pt(s, id);
const lenOf = (s, id) => { const e = K.ent(s, id); return Math.hypot(P(s, e.p2).x - P(s, e.p1).x, P(s, e.p2).y - P(s, e.p1).y); };

/* 1 the origin */
let s = K.create(500, 300);
check("a new sketch: a fixed origin point + two construction axes, nothing free (0 degrees of freedom)", s.pts.length === 5 && s.ents.length === 2 && s.ents.every((e) => e.cons && e.axis) && K.dof(s).dof === 0 && P(s, s.origin.pt).x === 500);

/* 2 a line: 4 free -> horizontal -> on the origin -> a length = fully constrained */
const l = K.line(s, [520, 320], [640, 330]);
check("a free line: 4 degrees of freedom", K.dof(s).dof === 4);
let r = K.tryAdd(s, { t: "horizontal", a: l }, "con");
check("Horizontal: 3 left, the line level", r.ok && K.dof(s).dof === 3 && near(P(s, K.ent(s, l).p1).y, P(s, K.ent(s, l).p2).y), r);
r = K.tryAdd(s, { t: "coincident", a: K.ent(s, l).p1, b: s.origin.pt }, "con");
check("Coincident with the origin: 1 left, its start on the origin", r.ok && K.dof(s).dof === 1 && near(P(s, K.ent(s, l).p1).x, 500) && near(P(s, K.ent(s, l).p1).y, 300));
r = K.tryAdd(s, K.dimFrom(s, "len", [l]), "dim");
const df = K.dof(s);
check("a length dimension (its value now): fully constrained - the line drawn black (fully)", r.ok && df.dof === 0 && df.fully(K.ent(s, l)) && near(s.dims[0].v, lenOf(s, l), 1e-3));
r = K.setDim(s, s.dims[0].id, 250);
check("the dimension set to 250: the line is 250 long, still on the origin, still level", r.ok && near(lenOf(s, l), 250) && near(P(s, K.ent(s, l).p1).x, 500) && near(P(s, K.ent(s, l).p2).y, 300), r);
r = K.tryAdd(s, { t: "vertical", a: l }, "con");
check("Vertical on that level line: refused - it would over-constrain (the sketch as it was)", !r.ok && r.why === "over" && near(lenOf(s, l), 250) && s.cons.filter((k) => k.t === "vertical").length === 0, r);
r = K.tryAdd(s, { t: "horizontal", a: l }, "con");
check("Horizontal again: refused - redundant", !r.ok && r.why === "redundant");
r = K.tryAdd(s, K.dimFrom(s, "dist", [K.ent(s, l).p1, K.ent(s, l).p2]), "dim");
check("a second dimension of the same length: a DRIVEN one (shown in brackets, it sets nothing)", r.driven && s.dims[1].driven && near(s.dims[1].v, 250) && /^\(250\)$/.test(K.dimGeom(s, s.dims[1]).text), s.dims[1]);
r = K.drag(s, [K.ent(s, l).p2], 40, 40);
check("dragging the fully constrained end: it stays", near(P(s, K.ent(s, l).p2).x, 750) && near(P(s, K.ent(s, l).p2).y, 300));

/* 3 a rectangle */
s = K.create(0, 0);
const R = K.rect2(s, [100, 100], [300, 200]);
check("a 2-point rectangle: 4 lines on 4 shared points, 2 horizontal + 2 vertical = 4 degrees of freedom", R.lines.length === 4 && s.cons.filter((k) => k.t === "horizontal").length === 2 && s.cons.filter((k) => k.t === "vertical").length === 2 && K.dof(s).dof === 4);
K.tryAdd(s, K.dimFrom(s, "len", [R.lines[0]]), "dim"); K.tryAdd(s, K.dimFrom(s, "len", [R.lines[1]]), "dim");
check("...its width + height dimensioned: 2 left (its place)", K.dof(s).dof === 2);
K.tryAdd(s, { t: "fix", a: R.pts[0] }, "con");
check("...a corner fixed: fully constrained", K.dof(s).dof === 0);
K.drag(s, [R.pts[2]], 30, 30);
check("...dragging the opposite corner: nothing moves", near(P(s, R.pts[2]).x, 300) && near(P(s, R.pts[2]).y, 200));
let pr = K.profiles(s);
check("profiles: one closed region 200 x 100, its path a closed sub of 4 points", pr.length === 1 && near(pr[0].area, 20000, 1e-3) && pr[0].path.subs.length === 1 && pr[0].path.subs[0].closed && pr[0].path.subs[0].pts.length === 4, pr.map((p) => p.area));
const c = K.circle(s, [200, 150], 30);
pr = K.profiles(s);
const rp = pr.find((p) => !p.circle);
check("a circle inside: 2 profiles, the rectangle's has the circle as a hole (2 subs, the second subtracted)", pr.length === 2 && rp.holes.length === 1 && rp.path.subs.length === 2 && rp.path.subs[1].op === "subtract", pr.map((p) => [p.area, p.holes.length]));
const R2 = K.rect2(s, [300, 100], [400, 200]);
K.tryAdd(s, { t: "coincident", a: R2.pts[0], b: R.pts[1] }, "con"); K.tryAdd(s, { t: "coincident", a: R2.pts[3], b: R.pts[2] }, "con");
pr = K.profiles(s);
check("a second rectangle sharing an edge (coincident corners): 3 profiles (two regions + the circle)", pr.length === 3, pr.map((p) => Math.round(p.area)));

s = K.create(0, 0);
const R4 = K.rect2(s, [0, 0], [200, 100]), split = K.line(s, [80, 0], [80, 100]);
K.tryAdd(s, { t: "onLine", a: K.ent(s, split).p1, b: R4.lines[0] }, "con"); K.tryAdd(s, { t: "onLine", a: K.ent(s, split).p2, b: R4.lines[2] }, "con");
pr = K.profiles(s);
check("a line across a rectangle, its ends kept ON the rectangle's sides: two profiles (80 x 100 + 120 x 100)", pr.length === 2 && JSON.stringify(pr.map((p) => Math.round(p.area)).sort((a, b) => a - b)) === "[8000,12000]" && pr.every((p) => p.path.subs[0].pts.length === 4), pr.map((p) => Math.round(p.area)));

/* 4 circles, arcs, tangency */
s = K.create(0, 0);
const ln = K.line(s, [0, 200], [400, 200]); K.tryAdd(s, { t: "horizontal", a: ln }, "con");
const ci = K.circle(s, [200, 150], 30);
r = K.tryAdd(s, { t: "tangent", a: ln, b: ci }, "con");
const cc = P(s, K.ent(s, ci).c);
check("Tangent line - circle: the circle touches the line (centre 1 radius away, the side it was on)", r.ok && near(Math.abs(cc.y - P(s, K.ent(s, ln).p1).y), K.ent(s, ci).r, 1e-3) && cc.y < P(s, K.ent(s, ln).p1).y, { cc, r: K.ent(s, ci).r });
const ci2 = K.circle(s, [300, 120], 20);
r = K.tryAdd(s, { t: "tangent", a: ci, b: ci2 }, "con");
const c1 = P(s, K.ent(s, ci).c), c2 = P(s, K.ent(s, ci2).c);
check("Tangent circle - circle (outside): centres r1 + r2 apart", r.ok && near(Math.hypot(c2.x - c1.x, c2.y - c1.y), K.ent(s, ci).r + K.ent(s, ci2).r, 1e-3));
r = K.tryAdd(s, { t: "equal", a: ci, b: ci2 }, "con");
check("Equal circles: the same radius (still tangent)", r.ok && near(K.ent(s, ci).r, K.ent(s, ci2).r, 1e-3));
const ar = K.arc3(s, [100, 300], [150, 260], [200, 300]);
const A = K.arcAngles(s, K.ent(s, ar));
check("a 3-point arc: the circle through the three points, from the start round through the middle point", near(A.cx, 150) && near(Math.hypot(100 - A.cx, 300 - A.cy), A.r) && near(Math.hypot(150 - A.cx, 260 - A.cy), A.r) && A.a1 > A.a0, A);
r = K.tryAdd(s, K.dimFrom(s, "radius", [ar]), "dim");
K.setDim(s, s.dims[s.dims.length - 1].id, 80);
const A2 = K.arcAngles(s, K.ent(s, ar));
check("a radius dimension on the arc: 80 (both ends stay on it)", r.ok && near(A2.r, 80, 1e-3) && near(Math.hypot(P(s, K.ent(s, ar).p2).x - A2.cx, P(s, K.ent(s, ar).p2).y - A2.cy), 80, 1e-3), A2);

/* 5 every other constraint is met */
s = K.create(0, 0);
const a1 = K.line(s, [0, 0], [100, 10]), b1 = K.line(s, [0, 50], [80, 90]), m1 = K.line(s, [200, 0], [260, 70]), q = K.point(s, [10, 120]);
const cA = K.circle(s, [400, 100], 30), cB = K.circle(s, [420, 110], 10);
const ok = (t, item) => { const x = K.tryAdd(s, item, "con"); check(t, x.ok, x); };
ok("Parallel", { t: "parallel", a: a1, b: b1 });
const ua = [P(s, K.ent(s, a1).p2).x - P(s, K.ent(s, a1).p1).x, P(s, K.ent(s, a1).p2).y - P(s, K.ent(s, a1).p1).y], ub = [P(s, K.ent(s, b1).p2).x - P(s, K.ent(s, b1).p1).x, P(s, K.ent(s, b1).p2).y - P(s, K.ent(s, b1).p1).y];
check("...the two lines run the same way", near(ua[0] * ub[1] - ua[1] * ub[0], 0, 1e-3));
ok("Perpendicular", { t: "perpendicular", a: a1, b: m1 });
const um = [P(s, K.ent(s, m1).p2).x - P(s, K.ent(s, m1).p1).x, P(s, K.ent(s, m1).p2).y - P(s, K.ent(s, m1).p1).y];
check("...at 90°", near(ua[0] * um[0] + ua[1] * um[1], 0, 1e-2) || near((P(s, K.ent(s, a1).p2).x - P(s, K.ent(s, a1).p1).x) * um[0] + (P(s, K.ent(s, a1).p2).y - P(s, K.ent(s, a1).p1).y) * um[1], 0, 1e-2));
ok("Equal lines", { t: "equal", a: a1, b: m1 });
check("...the same length", near(lenOf(s, a1), lenOf(s, m1), 1e-3));
ok("Midpoint", { t: "midpoint", a: K.ent(s, q).p1, b: b1 });
const mb = K.ent(s, b1);
check("...the point at the line's middle", near(P(s, K.ent(s, q).p1).x, (P(s, mb.p1).x + P(s, mb.p2).x) / 2) && near(P(s, K.ent(s, q).p1).y, (P(s, mb.p1).y + P(s, mb.p2).y) / 2));
ok("Concentric", { t: "concentric", a: cA, b: cB });
check("...the same centre", near(P(s, K.ent(s, cA).c).x, P(s, K.ent(s, cB).c).x) && near(P(s, K.ent(s, cA).c).y, P(s, K.ent(s, cB).c).y));
const sy = K.line(s, [600, 0], [600, 200]), pA = K.addPoint(s, 560, 50), pB = K.addPoint(s, 650, 80); K.point(s, pA); K.point(s, pB);
ok("Symmetric (two points about a line)", { t: "symmetric", a: pA, b: pB, c: sy });
const L0 = K.ent(s, sy), u0 = [P(s, L0.p2).x - P(s, L0.p1).x, P(s, L0.p2).y - P(s, L0.p1).y], mid = [(P(s, pA).x + P(s, pB).x) / 2 - P(s, L0.p1).x, (P(s, pA).y + P(s, pB).y) / 2 - P(s, L0.p1).y], ab = [P(s, pB).x - P(s, pA).x, P(s, pB).y - P(s, pA).y];
check("...their middle on the line, the line square to them", near(u0[0] * mid[1] - u0[1] * mid[0], 0, 1e-2) && near(u0[0] * ab[0] + u0[1] * ab[1], 0, 1e-2));
const co = K.line(s, [0, 300], [100, 310]), co2 = K.line(s, [150, 330], [250, 300]);
ok("Collinear", { t: "collinear", a: co, b: co2 });
const e1 = K.ent(s, co), e2 = K.ent(s, co2), du = [P(s, e1.p2).x - P(s, e1.p1).x, P(s, e1.p2).y - P(s, e1.p1).y], dw = [P(s, e2.p1).x - P(s, e1.p1).x, P(s, e2.p1).y - P(s, e1.p1).y];
check("...the second on the first's line", near(du[0] * dw[1] - du[1] * dw[0], 0, 1e-2));
s = K.create(0, 0);
const g1 = K.line(s, [0, 0], [100, 0]), g2 = K.line(s, [0, 0], [100, 40]);
K.tryAdd(s, { t: "coincident", a: K.ent(s, g1).p1, b: K.ent(s, g2).p1 }, "con");
r = K.tryAdd(s, K.dimFrom(s, "angle", [g1, g2]), "dim");
K.setDim(s, s.dims[0].id, 30);
const v1 = [P(s, K.ent(s, g1).p2).x - P(s, K.ent(s, g1).p1).x, P(s, K.ent(s, g1).p2).y - P(s, K.ent(s, g1).p1).y], v2 = [P(s, K.ent(s, g2).p2).x - P(s, K.ent(s, g2).p1).x, P(s, K.ent(s, g2).p2).y - P(s, K.ent(s, g2).p1).y];
check("an angle dimension set to 30°: the lines are 30° apart (the text says 30°)", r.ok && near(Math.abs(Math.atan2(v1[0] * v2[1] - v1[1] * v2[0], v1[0] * v2[0] + v1[1] * v2[1])) * 180 / Math.PI, 30, 1e-3) && K.dimGeom(s, s.dims[0]).text === "30°");

/* 6 drag keeps the constraints */
s = K.create(0, 0);
const h = K.line(s, [100, 100], [200, 100]); K.tryAdd(s, { t: "horizontal", a: h }, "con");
K.drag(s, [K.ent(s, h).p2], 30, 50);
check("dragging the end of a horizontal line: it goes where the pointer is, the other end follows down (still level)", near(P(s, K.ent(s, h).p2).x, 230, 1e-2) && near(P(s, K.ent(s, h).p1).y, P(s, K.ent(s, h).p2).y) && P(s, K.ent(s, h).p2).y > 120, [P(s, K.ent(s, h).p1), P(s, K.ent(s, h).p2)]);
const cr = K.circle(s, [400, 400], 20); K.dragRadius(s, cr, 55);
check("dragging a circle's edge: its radius", near(K.ent(s, cr).r, 55, 1e-3));

/* 7 remove / translate / transform */
s = K.create(0, 0);
const R3 = K.rect2(s, [0, 0], [100, 50]); K.tryAdd(s, K.dimFrom(s, "len", [R3.lines[0]]), "dim");
K.remove(s, [R3.lines[0]]);
check("deleting a line: its constraints + dimensions go; the points the other lines use stay", !s.ents.some((e) => e.id === R3.lines[0]) && s.dims.length === 0 && s.cons.filter((k) => k.t === "horizontal").length === 1 && s.pts.length === 5 + 4);
K.remove(s, [s.origin.h, s.origin.pt]);
check("...the origin and its axes cannot be deleted", K.ent(s, s.origin.h) && P(s, s.origin.pt));
K.translate(s, 10, 20);
check("translate: every point + the fixed places move (still solved)", near(P(s, s.origin.pt).x, 10) && K.solve(s).ok);
K.transform(s, [2, 0, 0, 2, 0, 0]);
check("transform (x2): points double, still solved", near(P(s, s.origin.pt).x, 20) && near(P(s, s.origin.pt).y, 40) && K.solve(s).ok);

/* 8 a D-shaped profile (a line + an arc): the path has Béziers */
s = K.create(0, 0);
const dA = K.arc3(s, [100, 100], [150, 50], [200, 100]); const ae = K.ent(s, dA); K.line(s, ae.p2, ae.p1);
pr = K.profiles(s);
const sub = pr.length ? pr[0].path.subs[0] : null;
check("a D shape (an arc + its chord): one profile, the arc as Bézier handles in its path", pr.length === 1 && sub && sub.pts.some((p) => Math.hypot(p.ox - p.x, p.oy - p.y) > 1), pr.length);

/* 9 the tools' picks */
s = K.create(0, 0);
const t1 = K.line(s, [0, 0], [100, 0]), t2 = K.line(s, [0, 50], [100, 60]), tc = K.circle(s, [200, 200], 20);
const pid = K.ent(s, t1).p1;
check("conFor: two lines -> parallel; a point + a line -> on line; a line + a circle -> tangent; nonsense -> a message",
  T.conFor("parallel", [{ k: "ent", id: t1 }, { k: "ent", id: t2 }], s).t === "parallel" && T.conFor("coincident", [{ k: "pt", id: pid }, { k: "ent", id: t2 }], s).t === "onLine"
  && T.conFor("tangent", [{ k: "ent", id: t1 }, { k: "ent", id: tc }], s).t === "tangent" && !!T.conFor("parallel", [{ k: "ent", id: tc }], s).err);
check("dimFor: a line -> its length; a circle -> diameter; two lines -> angle; two points placed above -> horizontal distance",
  T.dimFor([{ k: "ent", id: t1 }], s, 50, -20).t === "len" && T.dimFor([{ k: "ent", id: tc }], s, 0, 0).t === "diameter" && T.dimFor([{ k: "ent", id: t1 }, { k: "ent", id: t2 }], s, 0, 0).t === "angle"
  && T.dimFor([{ k: "pt", id: K.ent(s, t1).p1 }, { k: "pt", id: K.ent(s, t2).p2 }], s, 50, -40).t === "hdist");
const sn = T.snapFor(s, 101, 2, 6, null, []), sh = T.snapFor(s, 300, 302, 6, { x: 200, y: 300 }, []);
check("snapFor: near a point = that point; nearly level from the last point = horizontal", sn.pt === K.ent(s, t1).p2 && sh.hv === "horizontal" && sh.y === 300);

/* 10 wiring */
const rd = (...f) => fs.readFileSync(path.join(__dirname, "..", ...f), "utf8");
const ext = JSON.parse(rd("ext", "imageeditdock", "ext.json")).scripts, IE = rd("ext", "imageeditdock", "imageedit.js"), DOC = rd("ext", "imageeditdock", "pcdoc.js"), UI = rd("ext", "imageeditdock", "pcui.js"), DK = rd("ext", "imageeditdock", "pcdockers.js");
check("wiring: pcsketch.js + pcsketchtools.js after pc3d.js, before pchandles.js; installed before PCHandles", ext.indexOf("pcsketch.js") === ext.indexOf("pc3d.js") + 1 && ext.indexOf("pcsketchtools.js") === ext.indexOf("pcsketch.js") + 1 && ext.indexOf("pchandles.js") === ext.indexOf("pcsketchtools.js") + 3 && IE.indexOf("PCSketchTools.install(E)") < IE.indexOf("PCHandles.install(E)"));
check("...a sketch layer is live (pcdoc rasterize + DEEP), moves / transforms its points, rasterizes, duplicates; the N tool group with icons; 📐 in Layers",
  /L\.type === "sketch"\);/.test(DOC) && /root\.PCSketch\.draw\(g, L\.sketch\)/.test(DOC) && /"l3d", "sketch"\]/.test(DOC) && /win\.PCSketch\.translate\(L\.sketch, dx, dy\)/.test(IE) && /delete L\.sketch/.test(IE) && /"artboard", "sketch"\]\) d\[k\]/.test(IE)
  && /\{ k: "n", tools: \[\["sk_select"/.test(UI) && ["sk_select", "sk_line", "sk_rect", "sk_rectc", "sk_circle", "sk_arc", "sk_point", "sk_dim", "sk_trim", "sk_extend", "sk_fillet", "sk_chamfer", "sk_poly", "sk_slot", "sk_circle2", "sk_circle3", "sk_spline"].every((t) => new RegExp("\\n    " + t + ": '").test(UI)) && /sketch: "📐"/.test(UI) && /root\.PCSketch\.transform\(L\.sketch, m\)/.test(DK));

console.log(fail ? `\n${fail} FAILED` : "\nall sketch checks passed");
process.exit(fail ? 1 : 0);
