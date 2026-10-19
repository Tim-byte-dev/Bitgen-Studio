// scripts/test-dimgroup.js — the pure part of the dimension groups (2.457.0, ext/imageeditdock/pcdimgroup.js).
"use strict";
const P = require("../ext/imageeditdock/pcdimgroup.js");
let fail = 0;
const check = (name, ok, extra) => { console.log((ok ? "ok   " : "FAIL ") + name + (ok || extra === undefined ? "" : " " + JSON.stringify(extra))); if (!ok) fail++; };
const r = (p) => p.map((v) => Math.round(v * 100) / 100);
const same = (p, q) => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6;

// a parallel dimension of a level edge, its line 30 px above
const d = P.makeDef("parallel", [100, 100], [300, 100], [200, 70]);
const g = P.geom(d);
check("geom: the dimension line runs 30 px above the measured points, 200 px long", same(g.d0, [100, 70]) && same(g.d1, [300, 70]) && Math.abs(g.len - 200) < 1e-9, { d0: g.d0, d1: g.d1, len: g.len });
check("...each extension line starts a gap (4) off its point and runs 6 past the dimension line", same(g.ext[0].s, [100, 96]) && same(g.ext[0].e, [100, 64]) && same(g.ext[1].s, [300, 96]) && same(g.ext[1].e, [300, 64]), g.ext.map((x) => [x.s, x.e]));
check("...the number sits above the middle of the line, upright", Math.abs(g.label.x - 200) < 1e-6 && g.label.y < 70 && Math.abs(g.label.angle) < 1e-9, g.label);
// slanted
const s = P.geom(P.makeDef("parallel", [0, 0], [30, 40], [-40, 30]));
check("geom parallel slanted: 3-4-5 = 50 long", Math.abs(s.len - 50) < 1e-9, s.len);
// horizontal / vertical
const h = P.geom(P.makeDef("horizontal", [0, 0], [30, 40], [10, -20]));
check("horizontal: measures across only (30), the line level at y -20", Math.abs(h.len - 30) < 1e-9 && Math.abs(h.d0[1] + 20) < 1e-9 && Math.abs(h.d1[1] + 20) < 1e-9, h);
const v = P.geom(P.makeDef("vertical", [0, 0], [30, 40], [60, 10]));
check("vertical: measures up / down only (40), the line upright at x 60", Math.abs(v.len - 40) < 1e-9 && Math.abs(v.d0[0] - 60) < 1e-9 && Math.abs(v.d1[0] - 60) < 1e-9, v);
check("autoKind: placed above = horizontal, beside = vertical", P.autoKind([0, 0], [100, 0], [50, -40]) === "horizontal" && P.autoKind([0, 0], [0, 100], [60, 50]) === "vertical");
check("constrain: Shift = horizontal, Ctrl = vertical, else as it was", P.constrain("parallel", true, false) === "horizontal" && P.constrain("parallel", false, true) === "vertical" && P.constrain("parallel", false, false) === "parallel");

// edits
const ml = P.moveLine(d, [150, 40], false, false);
check("moveLine: the line goes to the pointer (40), the points stay", same(P.geom(ml).d0, [100, 40]) && same(ml.a, d.a) && same(ml.b, d.b));
const sl = P.geom(P.makeDef("parallel", [0, 0], [30, 40], [-40, 30]));
const slH = P.moveLine(P.makeDef("parallel", [0, 0], [30, 40], [-40, 30]), [10, -30], true, false);
check("moveLine + Shift on a slanted dimension: horizontal (measures 30)", slH.kind === "horizontal" && Math.abs(P.geom(slH).len - 30) < 1e-9 && sl.len === 50, slH.kind);
const me = P.moveExt(d, 1, [300, 80], [350, 85], false, false);
check("moveExt: dragging extension line 2 50 px along = 250 long (its point slides along the dimension)", Math.abs(P.geom(me).len - 250) < 1e-9 && same(me.b, [350, 100]) && same(me.a, d.a), me.b);
const me0 = P.moveExt(d, 0, [100, 80], [60, 80], false, false);
check("...extension line 1 the other way: 240 long", Math.abs(P.geom(me0).len - 240) < 1e-9 && same(me0.a, [60, 100]));
const en = P.extNode(d, 0, "s", [100, 90]);
check("extNode s: the start of extension line 1 at 90 = a gap of 10 (only that line)", en.ext[0].gap === 10 && en.ext[1].gap === 4 && same(P.geom(en).ext[0].s, [100, 90]));
const ee = P.extNode(d, 1, "e", [300, 50]);
check("extNode e: the end of extension line 2 at 50 = 20 past the dimension line (only that line)", ee.ext[1].over === 20 && ee.ext[0].over === 6 && same(P.geom(ee).ext[1].e, [300, 50]));
check("...the length stays", Math.abs(P.geom(ee).len - 200) < 1e-9);

// picking
const pth = { subs: [{ closed: true, pts: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }] }] };
const segs = P.segmentsOf(pth);
check("segmentsOf: a closed 4-node path = 4 edges", segs.length === 4);
const ns = P.nearestSeg(segs, 103, 20, 6);
check("nearestSeg: 3 px right of the right edge picks it", ns && same(ns.a, [100, 0]) && same(ns.b, [100, 50]), ns);
check("...10 px away picks nothing", P.nearestSeg(segs, 112, 20, 6) === null);
check("foot: the point on a line square to another", same(P.foot([40, 30], [0, 0], [100, 0]), [40, 0]));

// the whole group moved / scaled / turned
const M = P.fit3([[0, 0], [1, 0], [0, 1]], [[10, 20], [12, 20], [10, 22]]);
check("fit3: a scale x2 + move", M && r(M).join() === "2,0,0,2,10,20", M);
check("fit3: points in a line = null", P.fit3([[0, 0], [1, 1], [2, 2]], [[0, 0], [1, 1], [2, 2]]) === null);
const md = P.mapDef(d, M);
check("mapDef: the points move, gaps / overruns scale with it (8 / 12), the kind stays", same(md.a, [210, 220]) && md.ext[0].gap === 8 && md.ext[1].over === 12 && md.kind === "parallel");
const hd = P.makeDef("horizontal", [0, 0], [100, 0], [50, -30]);
check("mapDef: a quarter turn makes a horizontal one vertical", P.mapDef(hd, [0, 1, -1, 0, 0, 0]).kind === "vertical");
check("...a 30° turn makes it parallel", P.mapDef(hd, [Math.cos(0.5236), Math.sin(0.5236), -Math.sin(0.5236), Math.cos(0.5236), 0, 0]).kind === "parallel");
check("...a move keeps it horizontal", P.mapDef(hd, [1, 0, 0, 1, 5, 5]).kind === "horizontal");

// wiring
const fs = require("fs"), path = require("path"), rd = (...f) => fs.readFileSync(path.join(__dirname, "..", ...f), "utf8");
const ext = JSON.parse(rd("ext", "imageeditdock", "ext.json")).scripts, IE = rd("ext", "imageeditdock", "imageedit.js"), DOC = rd("ext", "imageeditdock", "pcdoc.js"), DIMS = rd("ext", "imageeditdock", "pcdims.js"), PB = rd("ext", "imageeditdock", "pcpropbar.js");
check("wiring: pcdimgroup.js after pccafill.js and before pchandles.js; installed before PCHandles (its parts win over the handles)", ext.indexOf("pcdimgroup.js") === ext.indexOf("pccafill.js") + 1 && ext.indexOf("pchandles.js") === ext.indexOf("pcdimgroup.js") + 7 && IE.indexOf("PCDimGroup.install(E)") > IE.indexOf("PCCaFill.install(E)") && IE.indexOf("PCDimGroup.install(E)") < IE.indexOf("PCHandles.install(E)"));
check("...a part clicked on the canvas picks its group (layerAt takes a layer from E.hitLayer)", /typeof h === "object"\) \{ const j = S\.layers\.indexOf\(h\)/.test(IE));
check("...undo keeps a group's definition and its parts' roles (DEEP)", /"dimg", "dimPart"/.test(DOC));
check("...pcdims: the number's text shared, the scale + the property bar take groups, Shift = horizontal / Ctrl = vertical", /textFor, lengthOf/.test(DIMS) && /DG\(\)\.rebuild\(G\)/.test(DIMS) && /if \(shift\) return \[x, o\[1\]\]; if \(ctrl\) return \[o\[0\], y\]/.test(DIMS) && /L\.type === "group" && L\.dimg/.test(PB));
console.log(fail ? `\n${fail} FAILED` : "\nall dimension group checks passed");
process.exit(fail ? 1 : 0);
