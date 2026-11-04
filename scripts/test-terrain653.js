#!/usr/bin/env node
/* bitGen Studio — 2.653.0: THE SKETCHER'S ⛰ TERRAIN - the ground's height field (ext/pushpulldock/ppterrain.js): kept and
 * cleaned with the model (pparch.js), made round the building, the brush, the ground shaped to contour lines, levelled
 * under the rooms, a heightmap, resized, its contour lines (marching squares), its mesh, a ray onto it, the floorplan's
 * contours (ppplan.js) and the wiring. The real clicks: scripts/test-ui653-ui.js.
 * Tim (verbatim): "... and terrain elevation tools like contour lines and shape the ground to match the contours." */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);

globalThis.polygonClipping = require(path.join(ROOT, "static/vendor/polygon-clipping.umd.min.js"));
const T = require(path.join(ROOT, "ext/pushpulldock/ppterrain.js"));
const P = require(path.join(ROOT, "ext/pushpulldock/pparch.js"));
const PL = require(path.join(ROOT, "ext/pushpulldock/ppplan.js"));

// ---- clean: sizes clamped, heights checked, contours kept with ids
const c0 = T.clean({ x0: 0, y0: 0, cell: 1, nx: 4, ny: 2, h: [0, 1, 2, 3, 4, 0, 1, "x", 3, 4, 0, 1, 2, 3, 99999], col: "mat:grass", step: 0, major: 99,
  contours: [{ pts: [[0, 0], [1, 1]], z: 2 }, { id: 7, pts: [[0, 0]] }, { id: 7, pts: [[0, 0], [2, 0], [2, 2]], z: 1, closed: true }, null] });
check("clean: a (nx+1)(ny+1) height list kept (a bad one = the base, a wild one clamped), the interval / every-n clamped, colour kept",
  c0.h.length === 15 && c0.h[7] === 0 && c0.h[14] === 5000 && c0.step === 0.05 && c0.major === 20 && c0.col === "mat:grass", c0);
check("…contours: one point dropped, ids unique past the counter, closed only with 3+ points", c0.contours.length === 2 && c0.contours[0].id !== c0.contours[1].id && c0.contours[1].closed && !c0.contours[0].closed && c0.cn > Math.max(c0.contours[0].id, c0.contours[1].id), c0.contours);
check("clean: a height list of the wrong length = flat at z0; nothing = no ground; a bad colour = grass", T.clean({ nx: 2, ny: 2, h: [1, 2], z0: 3 }).h.every((v) => v === 3) && T.clean(null) === null && T.clean({ col: "javascript:x" }).col === "mat:grass");
check("clean: never more than 200 cells a side", T.clean({ nx: 5000, ny: 1 }).nx === 200);

// ---- the model keeps it
const A = P.empty(); P.addRoom(A, [[0, 0], [6, 0], [6, 4], [0, 4]], { z: 1 });
check("an empty model has no ground; has() is false for only nothing", P.empty().terrain === null && !P.has(P.empty()));
const t = T.make(A);
check("make: round the building (≥ 40 m, 0.5 m cells, the building in its middle), just under the lowest floor",
  t.nx * t.cell >= 40 && t.cell === 0.5 && near(t.x0 + t.nx * t.cell / 2, 3) && near(t.y0 + t.ny * t.cell / 2, 2) && t.h.every((v) => near(v, 0.97)), { x0: t.x0, y0: t.y0, nx: t.nx, h0: t.h[0] });
check("make: a big site gets bigger cells (≤ 200 a side)", T.make(null, { w: 400, l: 100 }).nx === 200 && T.make(null, { w: 400, l: 100 }).cell === 2);
A.terrain = t;
const A2 = P.clean(JSON.parse(JSON.stringify(A)));
check("the model keeps the ground (saved / undone with it); has() is true with only ground", A2.terrain && A2.terrain.h.length === t.h.length && P.has(Object.assign(P.empty(), { terrain: t })));
const bb = P.bbox(A2);
check("bbox takes the ground in (zoom extents)", near(bb.min[0], t.x0) && near(bb.max[1], t.y0 + t.ny * t.cell), bb);

// ---- at / brush
const g = T.clean({ x0: 0, y0: 0, cell: 1, nx: 20, ny: 20, z0: 0 });
g.h[T.clean ? 10 * 21 + 10 : 0] = 2;
check("at: a grid point's height there, between points blended, past the edge = the edge's", near(T.at(g, 10, 10), 2) && near(T.at(g, 10.5, 10), 1) && near(T.at(g, -5, -5), 0));
g.h[10 * 21 + 10] = 0;
T.brush(g, "raise", 10, 10, 4, 1);
check("brush raise: s metres in the middle, less out to the edge, nothing past it", near(T.at(g, 10, 10), 1) && T.at(g, 12, 10) > 0.3 && T.at(g, 12, 10) < 1 && T.at(g, 15, 10) === 0, [T.at(g, 10, 10), T.at(g, 12, 10)]);
T.brush(g, "lower", 10, 10, 4, 1);
check("brush lower: back down", g.h.every((v) => near(v, 0, 1e-3)));
g.h[10 * 21 + 10] = 4; const before = g.h[10 * 21 + 10];
T.brush(g, "smooth", 10, 10, 3, 1);
check("brush smooth: a spike eased toward its neighbours", g.h[10 * 21 + 10] < before && g.h[10 * 21 + 10] >= 0, g.h[10 * 21 + 10]);
T.brush(g, "flatten", 10, 10, 5, 1, 0.5);
check("brush flatten: toward the target height", Math.abs(T.at(g, 10, 10) - 0.5) < 0.1, T.at(g, 10, 10));
check("brush: an unknown mode / no radius does nothing", T.brush(g, "explode", 10, 10, 3, 1) === 0 && T.brush(g, "raise", 10, 10, 0, 1) === 0);

// ---- the ground shaped to the contour lines (rings at 0 / 2 / 4 m round one middle: a hill)
const H = T.clean({ x0: -20, y0: -20, cell: 0.5, nx: 80, ny: 80 });
const circ = (r, z) => { const p = []; for (let k = 0; k < 36; k++) { const a = k / 36 * 2 * Math.PI; p.push([r * Math.cos(a), r * Math.sin(a)]); } T.addContour(H, p, z, true); };
check("fit with no contour line changes nothing", T.fit(H).held === 0 && H.h.every((v) => v === 0));
circ(15, 0); circ(10, 2); circ(5, 4);
const f = T.fit(H);
const ln = (r1, r2, z1, z2, r) => z1 + (z2 - z1) * Math.log(r / r1) / Math.log(r2 / r1);
check("fit: every line's points held at its height, inside the top ring flat at 4 m",
  f.held > 200 && near(T.at(H, 10, 0), 2, 0.05) && near(T.at(H, 0, 5), 4, 0.05) && near(T.at(H, 0, 0), 4, 0.02) && near(T.at(H, -15, 0), 0, 0.05), { f, top: T.at(H, 0, 0) });
check("fit: between two rings the smooth (harmonic) slope - within 6 cm of the exact one", near(T.at(H, 7.5, 0), ln(10, 5, 2, 4, 7.5), 0.06) && near(T.at(H, 0, -12.5), ln(15, 10, 0, 2, 12.5), 0.06), [T.at(H, 7.5, 0), ln(10, 5, 2, 4, 7.5)]);
check("fit: outside the last ring the ground keeps its height (the edges free)", near(T.at(H, 19, 19), 0, 0.05), T.at(H, 19, 19));
const ca = T.contourAt(H, [10.1, 0], 0.3);
check("contourAt: the line nearest a point (within tol)", ca && ca.C.z === 2 && !T.contourAt(H, [12.5, 0], 0.3), ca && ca.C.z);

// ---- contour lines (marching squares)
const L = T.lines(H, 1);
check("lines: one level a metre on the hill (1..4 - the flat 0 m floor itself crosses nothing), each a ring of segments; every 5th = major", L.map((x) => x.z).join() === "1,2,3,4" && L.every((x) => x.segs.length > 10) && !L[0].major && T.lines(H, 0.5).find((x) => x.z === 2.5).major, L.map((x) => [x.z, x.segs.length, x.major]));
const r2 = L[1].segs.map((s) => Math.hypot(s[0], s[1]));
check("…the 2 m line lies on the 2 m contour drawn (r ≈ 10 m)", r2.every((r) => Math.abs(r - 10) < 0.45), [Math.min(...r2), Math.max(...r2)]);
check("lines: a flat ground has none at all, or one level flat on it (no crash)", T.lines(T.clean({ nx: 4, ny: 4 }), 0.5).length <= 1);
check("lines: never more than 300 levels (the interval doubled)", T.lines(Object.assign(T.clean({ nx: 2, ny: 2 }), { h: [0, 0, 0, 0, 1000, 0, 0, 0, 0] }), 0.05).length <= 301);

// ---- level under the rooms
const Lv = T.clean({ x0: -10, y0: -10, cell: 0.5, nx: 60, ny: 60, z0: 2 });
const n = T.level(Lv, A, 2);
check("level: under the room just below its floor (1 m - 3 cm), blended out over the margin, untouched far off",
  n > 50 && near(T.at(Lv, 3, 2), 0.97, 1e-3) && near(T.at(Lv, 0, 0), 0.97, 1e-3) && T.at(Lv, -1.2, 2) > 0.97 && T.at(Lv, -1.2, 2) < 2 && near(T.at(Lv, -8, 2), 2), [T.at(Lv, -1.2, 2), T.at(Lv, -8, 2)]);
check("level: no rooms = nothing", T.level(Lv, P.empty(), 2) === 0);

// ---- a heightmap
const hm = T.clean({ x0: 0, y0: 0, cell: 1, nx: 10, ny: 10 });
const grey = new Float32Array(3 * 2); grey.set([0, 0.5, 1, 1, 1, 1]);        // top row: black .. white; bottom row: white
T.fromImage(hm, grey, 3, 2, 10, 20);
check("fromImage: the picture's top = the north edge; black = lowest, white = highest, grey between", near(T.at(hm, 0, 10), 10) && near(T.at(hm, 10, 10), 20) && near(T.at(hm, 5, 10), 15) && near(T.at(hm, 0, 0), 20), [T.at(hm, 0, 10), T.at(hm, 5, 10), T.at(hm, 10, 10), T.at(hm, 0, 0)]);

// ---- resample
const rs = T.resample(H, { cell: 1 });
check("resample: a coarser grid keeps the shape (the hill top, a ring's height)", rs.nx === 40 && rs.cell === 1 && near(T.at(rs, 0, 0), 4, 0.05) && near(T.at(rs, 10, 0), 2, 0.1) && rs.contours.length === 3, { nx: rs.nx, top: T.at(rs, 0, 0) });
const mv = T.resample(H, { cx: 100, cy: 0 });
check("resample: moved - its corner moves, off the old ground = the old edge's height", near(mv.x0, 80) && near(T.at(mv, 100, 0), T.at(H, 20, 0)));

// ---- the mesh + a ray
const m = T.mesh(T.clean({ x0: 0, y0: 0, cell: 1, nx: 3, ny: 2, sides: false }));
check("mesh: (nx+1)(ny+1) points, 2 triangles a cell, normals up on flat ground, uv in metres", m.pos.length === 36 && m.idx.length === 3 * 2 * 6 && m.nrm[2] === 1 && m.uv[2] === 1, { p: m.pos.length, i: m.idx.length });
const ms = T.mesh(T.clean({ x0: 0, y0: 0, cell: 1, nx: 3, ny: 2 }));
check("mesh with earth sides: + the four edges down a metre under the lowest + the bottom", ms.idx.length === m.idx.length + 3 * 2 * (3 + 2 + 3 + 2) + 6 && Math.min(...ms.pos.filter((_, i) => i % 3 === 2)) === -1, ms.idx.length);
const hh = T.hit(H, [0, 0, 100], [0, 0, -1]), hs = T.hit(H, [-30, 0, 10], [Math.cos(0.3), 0, -Math.sin(0.3)]);
check("hit: straight down onto the hill top; a slanting ray meets the slope (its point on the ground)", hh && near(hh[2], 4, 1e-3) && hs && near(hs[2], T.at(H, hs[0], hs[1]), 1e-6) && near(hs[2], 10 - Math.tan(0.3) * (hs[0] + 30), 0.01), { hh, hs });
check("hit: a ray past the ground / up into the sky = none", T.hit(H, [100, 100, 10], [0, 0, -1]) === null && T.hit(H, [0, 0, 10], [0, 0, 1]) === null);

// ---- the floorplan's contours
const B = P.empty(); B.terrain = T.clean(JSON.parse(JSON.stringify(H)));
const S = PL.symbols(B, 0, {});
const cl = S.lines.filter((l) => l.k === "contour");
check("the floorplan: the ground's contour lines (k contour, under the floors) + the drawn ones + the majors' heights",
  cl.length > 100 && S.texts.some((x) => x.t === "2.5 m") && cl.filter((l) => l.col === "#2f7fc4").length === 3, { n: cl.length, texts: S.texts.map((x) => x.t) });
const pl = T.planLines(B.terrain, { minor: "#111111", major: "#222222", drawn: "#333333" });
check("planLines: the theme's colours - minor / major / the drawn lines", pl.lines.some((l) => l.col === "#111111") && pl.lines.some((l) => l.col === "#222222") && pl.lines.filter((l) => l.col === "#333333").length === 3 && pl.texts.length >= 1);
P.addRoom(B, [[0, 0], [4, 0], [4, 4], [0, 4]], { z: 0 }); P.addRoom(B, [[0, 0], [4, 0], [4, 4], [0, 4]], { z: 3 });
check("…drawn on the lowest storey only", PL.symbols(B, 0, {}).lines.some((l) => l.k === "contour") && !PL.symbols(B, 3, {}).lines.some((l) => l.k === "contour"));

// ---- the wiring
const ext = JSON.parse(read("ext/pushpulldock/ext.json")).scripts;
check("ext.json: ppterrain.js before pparch.js (its clean keeps the ground), ppterraintools.js before pptools.js",
  ext.indexOf("ppterrain.js") >= 0 && ext.indexOf("ppterrain.js") < ext.indexOf("pparch.js") && ext.indexOf("ppterraintools.js") > ext.indexOf("pparchtools.js") && ext.indexOf("ppterraintools.js") < ext.indexOf("pptools.js"), ext);
const tt = read("ext/pushpulldock/pptools.js"), dk = read("ext/pushpulldock/ppdock.js"), pa = read("ext/pushpulldock/pparchtools.js"), pp = read("ext/pushpulldock/ppplan.js");
check("pptools: the ⛰ tool's down / move / up / dbl / vcb / key / Esc go to it; its own panel", /TT && TT\.owns\(tool\)\) \{ TT\.down/.test(tt) && /TT\.move\(ev\)/.test(tt) && /TT\.up\(ev\)/.test(tt) && /TT\.dbl\(ev\)/.test(tt) && /TT\.vcb\(text\)/.test(tt) && /TT\.key\(e\)/.test(tt) && /TT\.escape\(\)/.test(tt) && /ctx\.otherPanel/.test(tt) && /ctx\.otherPanel && ctx\.otherPanel\(\)/.test(pa));
check("ppdock: the ground in the view (after the plan), Alt+G = Terrain, the Ground buttons", /PPTerrain\.attach\(S\.V, S\.A\)/.test(dk) && /e\.altKey && e\.code === "KeyG"/.test(dk) && /textContent = "Ground"/.test(dk) && /terrainView: S\.TV/.test(dk));
check("ppplan: the 3D ground hidden on the floorplan (its contours drawn)", /"pp-terrain"\]/.test(pp) && /contour: 2/.test(pp));
const tl = fs.readFileSync(path.join(ROOT, "ext/pushpulldock/ppterraintools.js"), "utf8");
check("the tool: five modes, Alt+G, its panel's buttons (shape, heightmap, level, size, remove)", ["raise", "lower", "smooth", "flatten", "contour"].every((m) => tl.includes('["' + m + '"')) && /"Alt\+G"/.test(tl) && ["ppTerFit", "ppTerHm", "ppTerLevel", "ppTerW", "ppTerRemove", "ppTerCentre"].every((id) => tl.includes(id)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
