#!/usr/bin/env node
/* bitGen Studio — 2.657.0: THE SKETCHER'S 🏊 POOLS (ext/pushpulldock/ppsite.js): kept by pparch's clean, the shell / water /
 * edge tiles / decking built, the depth slope, the volume, the outline offset, the ground cut away under it (ppterrain mesh),
 * resized, on the floorplan, the wiring. The clicks: scripts/test-ui657-ui.js.
 * Tim (verbatim): "... and a swimming pool creator(with edge tiles or decking)" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);
globalThis.polygonClipping = require(path.join(ROOT, "static/vendor/polygon-clipping.umd.min.js"));
const S = require(path.join(ROOT, "ext/pushpulldock/ppsite.js"));
const T = require(path.join(ROOT, "ext/pushpulldock/ppterrain.js"));
const P = require(path.join(ROOT, "ext/pushpulldock/pparch.js"));
const PL = require(path.join(ROOT, "ext/pushpulldock/ppplan.js"));

check("offset: a square moved out by d (mitred corners)", JSON.stringify(S.offset([[0, 0], [4, 0], [4, 2], [0, 2]], 0.5)) === JSON.stringify([[-0.5, -0.5], [4.5, -0.5], [4.5, 2.5], [-0.5, 2.5]]));
const A = P.empty(), q = S.make(A, S.rect([0, 0], [8, 4]), { z: 0.2, shallow: 1, deep: 2 });
check("make: a rectangle pool, an id from the model's counter, named Pool 1", q && q.id > 0 && q.name === "Pool 1" && A.pools.length === 1 && q.pts.length === 4);
check("depthAt: shallow at one end of its length, deep at the other, a straight slope (⇄ swaps)", near(S.depthAt(q, [0, 2]), 1) && near(S.depthAt(q, [8, 2]), 2) && near(S.depthAt(q, [4, 1]), 1.5) && (q.deepAt = 0, near(S.depthAt(q, [0, 2]), 2)));
q.deepAt = 1;
check("volume: the area × the mean depth less the freeboard (12 cm)", near(S.volume(q), 32 * (1.5 - 0.12), 1e-3), S.volume(q));
check("size / resize: length along its long side, width across", JSON.stringify(S.size(q)) === '{"l":8,"w":4}' && S.resize(q, 10, 5) && JSON.stringify(S.size(q)) === '{"l":10,"w":5}' && JSON.stringify(q.pts[0]) === "[0,0]");
const out = { polys: [], lines: [] }; S.build(A, out, null);
const parts = out.polys.map((p) => p.tag.part);
check("build: 4 walls + the sloping floor + the water (see-through) + the edge tiles (top + 4 outer faces)", parts.filter((x) => x === "wall").length === 4 && parts.includes("floor") && out.polys.find((p) => p.tag.part === "water").alpha < 1 && parts.filter((x) => x === "coping").length === 5, parts);
const fl = out.polys.find((p) => p.tag.part === "floor");
check("…the floor at the depths (z - shallow .. z - deep), its normal up and tilted", near(Math.min(...fl.rings[0].map((p) => p[2])), 0.2 - 2) && near(Math.max(...fl.rings[0].map((p) => p[2])), 0.2 - 1) && fl.n[2] > 0.9 && fl.n[0] !== 0, fl);
check("…a wall faces into the pool", out.polys.filter((p) => p.tag.part === "wall").every((w) => { const c = w.rings[0].reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4], [0, 0]); return (5 - c[0]) * w.n[0] + (2.5 - c[1]) * w.n[1] > 0; }));
q.edge = "both"; const o2 = { polys: [], lines: [] }; S.build(A, o2, null);
check("edge tiles + decking: the tiles round the water, the decking round them (outside = edge + deck width)", o2.polys.some((p) => p.tag.part === "deck") && o2.polys.some((p) => p.tag.part === "coping") && near(S.outerW(q), 0.35 + 1.5) && near(S.outer(q)[0][0], -1.85));
q.edge = "none";
check("no edge: the outline is the pool's own", S.outerW(q) === 0 && JSON.stringify(S.outer(q)) === JSON.stringify(q.pts));
q.edge = "tiles";
const C = P.clean(JSON.parse(JSON.stringify(A)));
check("pparch clean keeps the pools (shape, depths, edge, materials), drops a bad one; has() / bbox / find / remove know them",
  C.pools.length === 1 && C.pools[0].deep === 2 && C.pools[0].edge === "tiles" && P.clean({ pools: [{ pts: [[0, 0], [1, 0]] }] }).pools.length === 0 && P.has(Object.assign(P.empty(), { pools: C.pools })) && P.bbox(C).min[2] < -1.7 && P.find(C, "pool", C.pools[0].id) && P.remove(C, "pool", C.pools[0].id) && C.pools.length === 0);
check("…pparch.build draws them (tag ak pool)", P.build(A).polys.some((p) => p.tag.ak === "pool" && p.tag.part === "water"));
const t = T.clean({ x0: -5, y0: -5, cell: 1, nx: 20, ny: 20, sides: false });
check("the ground cut away under it (its outside edge)", T.mesh(t, S.holes(A)).idx.length < T.mesh(t).idx.length && S.holes(A)[0].length === 4);
const sym = PL.symbols(A, 0, {});
check("the floorplan: its water, its edge, its name and size + depths; picked by a click", sym.fills.some((f) => f.tag && f.tag.ak === "pool") && sym.texts.some((x) => x.t === "Pool 1") && sym.texts.some((x) => /10 × 5 m · 1-2 m deep/.test(x.t)) && PL.pickAt(A, [5, 2.5], 0).ak === "pool");
const J = fs.readFileSync(path.join(ROOT, "ext/pushpulldock/ppterraintools.js"), "utf8"), AT = fs.readFileSync(path.join(ROOT, "ext/pushpulldock/pparchtools.js"), "utf8"), EJ = JSON.parse(fs.readFileSync(path.join(ROOT, "ext/pushpulldock/ext.json"), "utf8")).scripts;
check("the wiring: 🏊 Pool beside ⛰ Terrain (two corners / free shape, the ground levelled round it), its panel in Select, ppsite.js before pparch.js",
  /\["pool", "🏊", "Pool", ""\]/.test(J) && /function finishPool/.test(J) && /PT\(\)\.addPad\(t, root\.PPSite\.outer\(q\)/.test(J) && /asel\.ak === "pool" && root\.PPSite/.test(AT) && EJ.indexOf("ppsite.js") < EJ.indexOf("pparch.js"));
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
