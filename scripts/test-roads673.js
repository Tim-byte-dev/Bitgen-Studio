#!/usr/bin/env node
/* bitGen Studio — 2.673.0: ROADS IN THE SKETCHER (ext/pushpulldock/pproads.js) - types, the profile on the ground or graded,
 * cut + fill / tunnel + bridge past steep ground, junctions with traffic lights / stop / give-way, the geometry.
 * The clicks: scripts/test-ui673-ui.js.
 * Tim (verbatim): "in sketcher add a road tool like Sim City's road tool, to draw roads on the map, roads will follow the
 * contour of the ground unless too steep, then offer a tunnel or cut the terrain to pass. offer several types of roads just
 * like sim city, autoplace traffic lights  and signs etc" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
globalThis.polygonClipping = require(path.join(ROOT, "static/vendor/polygon-clipping.umd.min.js"));
const PT = require(path.join(ROOT, "ext/pushpulldock/ppterrain.js"));
const R = require(path.join(ROOT, "ext/pushpulldock/pproads.js"));
const P = require(path.join(ROOT, "ext/pushpulldock/pparch.js"));
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);
const parts = (out) => { const c = {}; out.polys.forEach((p) => { c[p.tag.part] = (c[p.tag.part] || 0) + 1; }); return c; };
const build = (A) => { const out = { polys: [], lines: [] }; R.build(A, out, null); return out; };

// the types
check("six types like SimCity: Dirt road, Street, Road, One-way road, Avenue, Highway", R.KEYS.join() === "dirt,street,road,oneway,avenue,highway" && R.KEYS.every((k) => R.TYPES[k].label && R.TYPES[k].max > 0 && R.TYPES[k].speed > 0));
const S = (k) => R.section(k);
check("their cross-sections: a street 6 m + 1.8 m footpaths, an avenue 4 lanes with a 3 m median, a highway 6 lanes + barrier (no footpaths)", near(S("street").c, 3) && near(S("street").H, 4.8) && near(S("avenue").m, 1.5) && S("avenue").per === 2 && S("highway").per === 3 && S("highway").t.walk === 0 && S("highway").t.barrier);
check("…steeper for small roads: dirt 20 %, street 15 %, road 12 %, avenue 8 %, highway 6 %", R.KEYS.map((k) => R.TYPES[k].max).join() === "0.2,0.15,0.12,0.12,0.08,0.06");
check("a picture of each type for the picker", R.KEYS.every((k) => /^<svg[^>]+><rect/.test(R.icon(k))));

// a hill: 40 m high, rising 1 : 2.5 (40 %) over 100 m - a road over it
const T = PT.clean({ x0: -100, y0: -60, cell: 2, nx: 150, ny: 60, z0: 0 });
for (let j = 0; j <= T.ny; j++) for (let i = 0; i <= T.nx; i++) { const x = T.x0 + i * T.cell; T.h[j * (T.nx + 1) + i] = Math.max(0, 40 - Math.abs(x) * 0.4); }
const mk = (type, mode) => { const A = { n: 1, roads: [], terrain: JSON.parse(JSON.stringify(T)), roadSet: { side: "left", auto: true } }; const r = R.make(A, [[-90, 0], [0, 0], [90, 0]], { type }); if (mode) R.setMode(A, r, mode); return { A, r }; };
let { A, r } = mk("avenue");
let pr = R.profile(A, r);
check("on the ground (follow): the road follows the hill's contour", r.mode === "follow" && near(pr.z[pr.z.length >> 1], 40, 2.5) && pr.z.every((z, i) => Math.abs(z - pr.g[i]) < 2.5), { mid: pr.z[pr.z.length >> 1] });
check("…40 % is too steep for an avenue (8 %): flagged steep - the panel offers ⛏ cut / 🚇 tunnel", pr.steep && pr.steepest > 0.3, { steepest: pr.steepest });
check("…a dirt road over a gentle 6 % rise is fine (not steep)", (() => { const B = { n: 1, roads: [], terrain: PT.clean({ x0: -60, y0: -20, cell: 2, nx: 60, ny: 20 }) }; B.terrain.h = B.terrain.h.map((_, k) => (k % 61) * 2 * 0.06); const d = R.make(B, [[-50, 0], [50, 0]], { type: "dirt" }); return !R.profile(B, d).steep; })());
({ A, r } = mk("avenue", "cut"));
pr = R.profile(A, r);
check("⛏ cut: an even grade no steeper than 8 % - the road cut deep into the hill", pr.grade <= 0.082 && pr.z[pr.z.length >> 1] < 15 && r.cut > 1000 && r.mode === "cut", { grade: pr.grade, cut: r.cut, fill: r.fill });
check("…the ground under it cut down to the road (level across it), batters out (1 : 2) - the ground follows the road", near(PT.at(A.terrain, 0, 0), pr.z[pr.z.length >> 1] - 0.03, 0.5) && PT.at(A.terrain, 0, 12) > PT.at(A.terrain, 0, 0) && PT.at(A.terrain, 0, 12) < 40, [PT.at(A.terrain, 0, 0), PT.at(A.terrain, 0, 12)]);
check("…its profile kept (graded once): built again it stays where it was cut", r.prof && r.prof.sig === pr.sig && near(R.profile(A, r).z[10], pr.z[10]));
({ A, r } = mk("highway", "tunnel"));
pr = R.profile(A, r);
const tun = pr.kind.filter((k) => k === "tunnel").length * R.STEP;
check("🚇 tunnel: a highway (6 %) through the hill in a tunnel (the high ground left alone above it)", tun > 40 && pr.grade <= 0.062 && near(PT.at(A.terrain, 0, 0), 40, 0.6), { tun, top: PT.at(A.terrain, 0, 0) });
const ot = parts(build(A));
check("…drawn: tunnel lining + two portals (each with its dark mouth), the approaches cut", ot.tunnel > 20 && ot.portal === 16, ot);   // 2 portals x (2 piers + lintel + the mouth) x 2 triangles
// a valley: a bridge
const V = PT.clean({ x0: -100, y0: -40, cell: 2, nx: 100, ny: 40 }); for (let j = 0; j <= V.ny; j++) for (let i = 0; i <= V.nx; i++) { const x = V.x0 + i * V.cell; V.h[j * (V.nx + 1) + i] = Math.min(0, -25 + Math.abs(x) * 0.6); }
const Av = { n: 1, roads: [], terrain: V }, rv = R.make(Av, [[-90, 0], [90, 0]], { type: "road" }); R.setMode(Av, rv, "tunnel");
const pv = R.profile(Av, rv), ov = parts(build(Av));
check("…over a deep valley: a bridge (deck, parapets, piers down to the ground)", pv.kind.includes("bridge") && ov.bridge > 20 && ov.pier > 0, { kinds: [...new Set(pv.kind)], ov });

// junctions + who gives way
const J0 = { n: 1, roads: [], roadSet: { side: "left", auto: true } };
R.make(J0, [[0, 0], [200, 0]], { type: "avenue", curved: false }); R.make(J0, [[100, -80], [100, 80]], { type: "road", curved: false });
R.make(J0, [[30, 0], [30, 60]], { type: "street", curved: false });       // a street ending on the avenue (a T)
R.make(J0, [[150, -60], [150, 60]], { type: "street", curved: false });   // a street crossing the avenue
const J = R.junctions(J0);
const at = (x) => J.find((j) => near(j.p[0], x, 1) && near(j.p[1], 0, 1));
check("an avenue crossing a road: traffic lights on all four approaches", at(100) && at(100).kind === "signal" && at(100).arms.length === 4 && at(100).arms.every((m) => m.ctl === "signal"), at(100));
check("a street ending on the avenue (a T): a stop sign on the street, the avenue not stopped", at(30) && at(30).kind === "stop" && at(30).arms.length === 3 && at(30).arms.filter((m) => m.ctl === "stop").length === 1 && at(30).arms.find((m) => m.ctl === "stop").type === "street", at(30));
check("a street crossing the avenue: stop signs on both street approaches", at(150) && at(150).arms.filter((m) => m.ctl === "stop").length === 2);
const J1 = { n: 1, roads: [] }; R.make(J1, [[0, 0], [100, 0]], { type: "street", curved: false }); R.make(J1, [[50, -50], [50, 50]], { type: "street", curved: false }); R.make(J1, [[0, 30], [100, 30]], { type: "street", curved: false }); R.make(J1, [[20, 30], [20, 80]], { type: "street", curved: false });
const K = R.junctions(J1), x4 = K.find((j) => near(j.p[0], 50, 1) && near(j.p[1], 0, 1)), t3 = K.find((j) => near(j.p[0], 20, 1) && near(j.p[1], 30, 1));
check("two streets crossing: an all-way stop; a street ending on a street: give way on the one that ends", x4 && x4.kind === "allstop" && x4.arms.every((m) => m.ctl === "stop") && t3 && t3.kind === "give" && t3.arms.filter((m) => m.ctl === "give").length === 1, [x4 && x4.kind, t3 && t3.kind]);
const J2 = { n: 1, roads: [] }; R.make(J2, [[0, 0], [100, 0]], { type: "oneway", curved: false }); R.make(J2, [[50, -50], [50, 50]], { type: "avenue", curved: false });
const ow = R.junctions(J2)[0];
check("a one-way road: no signal for the arm traffic only leaves by (3 signalled approaches of 4)", ow.kind === "signal" && ow.arms.filter((m) => m.ctl).length === 3 && ow.arms.find((m) => m.oneway && m.flowOut).ctl === null, ow.arms.map((m) => [m.type, m.flowOut, m.ctl]));
const o0 = build(J0), c0 = parts(o0);
check("built: carriageways, medians, kerbs + footpaths, markings, junction patches, crossings at the lights, signs", ["carriageway", "median", "kerb", "footpath", "marking", "junction", "crossing", "sign"].every((k) => c0[k] > 0), c0);
check("…every point a number, normals unit length", o0.polys.every((p) => p.rings.every((g) => g.every((q) => q.every(Number.isFinite))) && near(Math.hypot(...p.n), 1, 1e-6)));
check("…signs off (Traffic lights + signs unticked): no signs, no crossings", (() => { const B = JSON.parse(JSON.stringify(J0)); B.roadSet = { auto: false }; const c = parts(build(B)); return !c.sign && !c.crossing && c.junction > 0; })());
const lt = J0.roadSet.side, cy = (side) => { const B = JSON.parse(JSON.stringify(J0)); B.roadSet = { side, auto: true }; return build(B).polys.filter((p) => p.tag.part === "marking" && p.col === R.COL.yellow).length; };
check("drive on the left (Australia): white centre lines; on the right (US): yellow", lt === "left" && cy("left") === 0 && cy("right") > 0);

// the model: clean, saved in pparch, found / removed / built
const cl = R.cleanRoad({ id: 3, type: "bogus", mode: "x", nodes: [{ p: [0, 0] }, { p: [5, 5] }], prof: { sig: "a", z: [1, "2"] } });
check("clean: an unknown type = Road, mode = on the ground, its profile kept", cl.type === "road" && cl.mode === "follow" && cl.prof.z.join() === "1,2" && R.cleanRoad({ nodes: [{ p: [0, 0] }] }) === null);
globalThis.PPRoads = R;
const M = P.clean({ rooms: [], roads: [{ id: 7, type: "street", nodes: [{ p: [0, 0] }, { p: [40, 0] }] }], roadSet: { side: "right" } });
check("pparch keeps them: A.roads + A.roadSet; find / remove; built with the model", M.roads.length === 1 && M.roadSet.side === "right" && P.find(M, "road", 7) && P.build(M).polys.some((p) => p.tag && p.tag.ak === "road") && P.remove(M, "road", 7) && !M.roads.length);
check("snap: near a road's end -> its end; onto its middle -> the centre line (a T)", (() => { const B = { roads: [R.make(null, [[0, 0], [50, 0]], { type: "road", curved: false })] }; const e = R.snap(B, [49, 1.5], 2), m = R.snap(B, [20, 2.2], 2); return e.end && e.p[0] === 50 && !m.end && m.p[1] === 0 && near(m.p[0], 20, 0.01); })());
const TT = read("ext/pushpulldock/ppterraintools.js"), PL = read("ext/pushpulldock/ppplan.js"), AT = read("ext/pushpulldock/pparchtools.js"), EX = read("ext/pushpulldock/ext.json");
check("wired: the 🛤 Road tool (ppterraintools -> pproadtools.js), its panel when picked, the floorplan, ext.json", /\["road", "🛤", "Road"/.test(TT) && /PPRoadTools/.test(TT) && /asel\.ak === "road" && root\.PPRoads/.test(AT) && /PPRoads\.outline/.test(PL) && EX.indexOf('"pproads.js"') > 0 && EX.indexOf('"pproadtools.js"') > EX.indexOf('"pproads.js"'));
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
