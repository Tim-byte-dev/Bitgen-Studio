// scripts/test-dimauto.js — auto / floorplan / chain dimensions, the pure part (2.458.0, ext/imageeditdock/pcdimauto.js).
"use strict";
const fs = require("fs"), path = require("path");
global.PCDimGroup = require("../ext/imageeditdock/pcdimgroup.js");
const A = require("../ext/imageeditdock/pcdimauto.js"), G = global.PCDimGroup;
let fail = 0;
const check = (name, ok, extra) => { console.log((ok ? "ok   " : "FAIL ") + name + (ok || extra === undefined ? "" : " " + JSON.stringify(extra))); if (!ok) fail++; };
const len = (d) => Math.round(G.geom(d).len * 10) / 10;
const anc = (x, y) => ({ x, y, ix: x, iy: y, ox: x, oy: y });

// an L-shaped room (6 walls), drawn clockwise on screen
const Lroom = { subs: [{ closed: true, pts: [[0, 0], [200, 0], [200, 100], [100, 100], [100, 160], [0, 160]].map(([x, y]) => anc(x, y)) }] };
const ps = A.polysOf(Lroom);
check("polysOf: one closed outline of 6 points", ps.length === 1 && ps[0].length === 6, ps);
check("polysOf: open paths and a repeated closing node are left out", A.polysOf({ subs: [{ closed: false, pts: [anc(0, 0), anc(9, 9), anc(5, 0)] }, { closed: true, pts: [anc(0, 0), anc(10, 0), anc(10, 10), anc(0, 0)] }] }).map((p) => p.length).join() === "3");
const out0 = A.outward(ps[0], 0), out1 = A.outward(ps[0], 1);
check("outward: the top wall faces up, the right wall faces right", out0[0] === 0 && out0[1] === -1 && out1[0] === 1 && Math.abs(out1[1]) < 1e-12, [out0, out1]);
const rev = ps[0].slice().reverse(), r0 = A.outward(rev, 0);   // drawn the other way round: its first wall = the bottom one (0,160 -> 100,160)
check("...the same drawn the other way round (the bottom wall faces down)", Math.abs(r0[0]) < 1e-12 && r0[1] === 1, r0);
const walls = A.wallDefs(ps[0], 30);
check("wallDefs: one dimension per wall (6) with their lengths 200 100 100 60 100 160", walls.length === 6 && walls.map(len).join() === "200,100,100,60,100,160", walls.map(len));
check("...each on the OUTSIDE: the top one 30 above, the inner corner's one (100,100 -> 100,160) to the right of it", G.geom(walls[0]).d0[1] === -30 && G.geom(walls[3]).d0[0] === 130, [G.geom(walls[0]).d0, G.geom(walls[3]).d0]);
const ov = A.overallDefs(ps[0], 60);
check("overallDefs: the overall width (horizontal, 200, 60 above) and height (vertical, 160, 60 right of 200)", ov.length === 2 && ov[0].kind === "horizontal" && len(ov[0]) === 200 && G.geom(ov[0]).d0[1] === -60 && ov[1].kind === "vertical" && len(ov[1]) === 160 && G.geom(ov[1]).d0[0] === 260, ov.map((d) => [d.kind, len(d)]));
const fp = A.floorplanDefs(ps, 30, 70);
check("floorplanDefs: every wall + the overall size = 8", fp.length === 8);
check("...walls only / overall only", A.floorplanDefs(ps, 30, 70, { overall: false }).length === 6 && A.floorplanDefs(ps, 30, 70, { walls: false }).length === 2);
check("boxPoly: a box's 4 corners", JSON.stringify(A.boxPoly({ x: 1, y: 2, w: 10, h: 5 })) === "[[1,2],[11,2],[11,7],[1,7]]");

// chains
const pts = [[0, 100], [120, 103], [50, 98], [300, 100]];
check("chainKind: running across = horizontal; up / down = vertical", A.chainKind(pts) === "horizontal" && A.chainKind([[0, 0], [5, 90]]) === "vertical");
const c = A.chainDefs(pts, "horizontal", [0, 60], 30);
check("chainDefs: the points in order along the line (0, 50, 120, 300): 3 dimensions 50 70 180 + the total 300", c.length === 4 && c.map(len).join() === "50,70,180,300" && c.every((d) => d.kind === "horizontal"), c.map(len));
check("...all on the line through the pointer (y 60), the total further out (y 30)", c.slice(0, 3).every((d) => G.geom(d).d0[1] === 60) && G.geom(c[3]).d0[1] === 30, c.map((d) => G.geom(d).d0[1]));
const cb = A.chainDefs(pts, "horizontal", [0, 140], 30);
check("...below the points: the total further down (y 170)", G.geom(cb[3]).d0[1] === 170);
const cv = A.chainDefs([[10, 0], [12, 80], [9, 200]], "vertical", [60, 0], 25);
check("a vertical chain: 80 120 + the total 200, the total right of it (x 85)", cv.map(len).join() === "80,120,200" && G.geom(cv[2]).d0[0] === 85, cv.map(len));
check("two points: one dimension, no total", A.chainDefs([[0, 0], [40, 0]], "horizontal", [0, -20], 30).length === 1);

// wiring
const rd = (...f) => fs.readFileSync(path.join(__dirname, "..", ...f), "utf8");
const ext = JSON.parse(rd("ext", "imageeditdock", "ext.json")).scripts, IE = rd("ext", "imageeditdock", "imageedit.js"), UI = rd("ext", "imageeditdock", "pcui.js"), DIMS = rd("ext", "imageeditdock", "pcdims.js"), GU = rd("ext", "imageeditdock", "pcguides.js"), DG = rd("ext", "imageeditdock", "pcdimgroup.js");
check("wiring: pcdimauto.js right after pcdimgroup.js, installed after PCDimGroup and before PCHandles", ext.indexOf("pcdimauto.js") === ext.indexOf("pcdimgroup.js") + 1 && IE.indexOf("PCDimAuto.install(E)") > IE.indexOf("PCDimGroup.install(E)") && IE.indexOf("PCDimAuto.install(E)") < IE.indexOf("PCHandles.install(E)"));
check("...the Chain Dimension tool in the F8 group (with its icon), snapping (pcdims DIM_TOOLS, pcguides), E.dims.snap, createMany", /\["cdimchain", "Chain Dimension Tool"\]/.test(UI) && /cdimchain: '</.test(UI) && /"cdimchain"\]\);/.test(DIMS) && /"cdimchain"/.test(GU) && /snap: \(x, y, e\)/.test(DIMS) && /function createMany/.test(DG));

console.log(fail ? `\n${fail} FAILED` : "\nall auto / floorplan / chain dimension checks passed");
process.exit(fail ? 1 : 0);
