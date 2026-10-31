#!/usr/bin/env node
/* bitGen Studio — 2.524.0: 🏠 THE HOUSE BUILDER (static/housegeo.js, static/housebuilder.js's pure helpers, lib/house.js,
 * routes/house.js). Geometry: the example, rooms sharing a wall, openings cut out of walls, a floor with a stair hole,
 * the sun's path (southern hemisphere), the room description for ✨ Make it real, the .obj. Then the routes against a
 * stand-in core (a temp project): save / list / get / render (+ the Images assets) / obj / delete (?assets=1).
 * Tim (verbatim): "i would like a floorplan/housebuilder floating docker that i can use as a location as well" */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);
const G = require("../static/housegeo.js");
const HB = null;

/* ---- geometry */
const ex = G.example(), bx = G.build(ex, { ceilings: true });
check("the example: 12 walls, 8 openings, 4 rooms, furniture, a camera", ex.walls.length === 12 && ex.openings.length === 8 && ex.rooms.length === 4 && ex.items.length > 15 && ex.cameras.length === 1, [ex.walls.length, ex.openings.length, ex.rooms.length, ex.items.length]);
check("…builds meshes (grouped by material + colour) and lamp lights", bx.meshes.length > 10 && bx.lights.length >= 3 && bx.meshes.every((g) => g.pos.length % 3 === 0 && g.idx.every((i) => i < g.pos.length / 3)), bx.meshes.length);
check("…every mesh has a normal and a uv per vertex", bx.meshes.every((g) => g.nrm.length === g.pos.length && g.uv.length / 2 === g.pos.length / 3));
const m = G.normalize({ name: "T" });
const r1 = G.addRoom(m, 0, [[0, 0], [4, 0], [4, 3], [0, 3]], "Lounge");
check("a room brings its 4 walls", m.rooms.length === 1 && m.walls.length === 4);
G.addRoom(m, 0, [[4, 0], [7, 0], [7, 3], [4, 3]], "Study");
check("a room next to it SHARES the wall between them (3 new walls, not 4)", m.walls.length === 7, m.walls.length);
G.addRoom(m, 0, [[0, 3], [7, 3], [7, 6], [0, 6]], "Hall");
check("…and a long room under both: only the uncovered edges become walls", m.walls.length === 10, m.walls.length);
check("area / centroid / inside", near(G.area(r1.poly), 12) || near(G.area(r1.poly), -12) ? near(G.centroid(r1.poly)[0], 2) && G.inside([1, 1], r1.poly) && !G.inside([5, 1], r1.poly) : false);
const tri = G.triangulate([[0, 0], [5, 0], [5, 4], [0, 4]], [[[1, 1], [2, 1], [2, 2], [1, 2]].reverse()]);
let ta = 0; for (const t of tri.tris) { const a = tri.points[t[0]], b = tri.points[t[1]], c = tri.points[t[2]]; ta += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2; }
check("triangulate: a 5 × 4 floor with a 1 × 1 hole = 19 m² of triangles", near(ta, 19, 1e-6), ta);
const wp = G.wallPieces(5, 2.7, [{ t: 1, w: 0.9, h: 2.1, sill: 0 }, { t: 3.5, w: 1.2, h: 1.2, sill: 0.9 }]);
const wa = wp.reduce((a, p) => a + (p.s1 - p.s0) * (p.z1 - p.z0), 0);
check("wall pieces: a door + a window cut out (5 × 2.7 − 0.9 × 2.1 − 1.2 × 1.2)", near(wa, 5 * 2.7 - 0.9 * 2.1 - 1.2 * 1.2, 1e-6) && wp.length === 6, { wa, wp });
const nw = G.nearestWall(m, 0, [2, 0.1], 0.5);
check("nearestWall: the wall under the click, how far along", nw && near(nw.t, 2, 1e-6) && near(nw.d, 0.1, 1e-6), nw);
check("uncovered: a wall along an existing one adds only the new part", JSON.stringify(G.uncovered(m, 0, [0, 0], [9, 0])) === JSON.stringify([[[7, 0], [9, 0]]]), G.uncovered(m, 0, [0, 0], [9, 0]));
const s6 = G.sun({ hour: 6.5, north: 0 }), s12 = G.sun({ hour: 12, north: 0 }), s17 = G.sun({ hour: 17.5, north: 0 }), s22 = G.sun({ hour: 22 });
check("the sun (southern hemisphere): morning in the east (+x), noon in the NORTH (up the plan, 270°), evening in the west", Math.min(s6.az, 360 - s6.az) < 20 && near(s12.az, 270) && s17.az > 170 && s17.az < 190 && s12.el > s6.el, [s6.az, s12.az, s17.az]);
check("…at night there is no sun", s22.night && s22.intensity === 0);
check("…the north arrow turns it", near(G.sun({ hour: 12, north: 30 }).az, 300));
const two = G.normalize({ name: "Two", floors: [{ name: "Ground", height: 2.7 }, { name: "Upstairs", height: 2.5 }] });
G.addRoom(two, 0, [[0, 0], [5, 0], [5, 5], [0, 5]], "Down"); G.addRoom(two, 1, [[0, 0], [5, 0], [5, 5], [0, 5]], "Up");
two.stairs.push({ id: "s1", floor: 0, x: 2, y: 2.5, rot: 90, w: 1, len: 3.6 });
const b2 = G.build(two, {});
check("two floors: the upper floor stands on the lower (elevations 0, 2.7 + slab)", near(b2.elevations[0], 0) && near(b2.elevations[1], 2.7 + G.SLAB, 1e-6), b2.elevations);
const up = b2.meshes.reduce((a, g) => a.concat(g.pos.filter((_, i) => i % 3 === 1)), []);
check("…the stairs reach the floor above", up.some((y) => y > 2.5));
const n0 = G.build(G.normalize({ name: "x", floors: [{}, {}], rooms: two.rooms, walls: two.walls }), {}).meshes.reduce((a, g) => a + g.idx.length, 0), n1 = b2.meshes.reduce((a, g) => a + g.idx.length, 0);
check("…and cut a hole in the floor above (more triangles than the plain floor)", n1 > n0, [n0, n1]);
check("build upTo: only the floors up to it", G.build(two, { upTo: 0 }).bounds[4] < 3.2);
const desc = G.describe(ex, ex.rooms[0].id);
check("describe: a room for the prompt (name, m², size, ceiling, floor, walls, its furniture, its doors / windows)", /^living room \(\d+ m², [\d.]+ × [\d.]+ m, 2\.7 m ceiling\), .* floor, .* walls, with .*sofa/.test(desc) && /window/.test(desc), desc);
check("…a generic 'Room 3' reads as 'room'", /^room \(/.test(G.describe(m, G.addRoom(m, 0, [[10, 10], [12, 10], [12, 12], [10, 12]], "Room 3").id)));
check("…the whole house", /^Example house: 1 floor, 4 rooms \(/.test(G.describe(ex)), G.describe(ex));
const o = G.toObj(bx.meshes, "Example");
const vn = (o.obj.match(/^v /gm) || []).length, fl = o.obj.match(/^f .*/gm) || [];
const maxIdx = Math.max(...fl.map((f) => Math.max(...f.slice(2).split(" ").map((t) => +t.split("/")[0]))));
check(".obj: vertices, faces that point at them, materials in the .mtl", vn > 100 && fl.length > 100 && maxIdx === vn && /mtllib house.mtl/.test(o.obj) && /^newmtl /m.test(o.mtl) && /^Kd /m.test(o.mtl), { vn, maxIdx });
check("normalize keeps bad input sane (no NaN, a floor, the light)", (() => { const z = G.normalize({ walls: [{ a: ["x", 1], b: [2, 2] }], items: [{ type: "nope" }] }); return z.floors.length === 1 && z.light && !JSON.stringify(z).includes("NaN") && !z.items.length; })());
check("the library: ~38 pieces, each with its size + parts", Object.keys(G.CATALOGUE).length >= 35 && Object.values(G.CATALOGUE).every((c) => c.w > 0 && c.d > 0 && c.h > 0 && typeof c.parts === "function" && c.parts(c.w, c.d, c.h).length));
/* ---- the docker's pure helpers */
/* 2.630.0: the House builder is gone - this check went with it */
/* 2.630.0: the House builder is gone - this check went with it */
/* 2.630.0: the House builder is gone - this check went with it */
/* 2.630.0: the House builder is gone - this check went with it */

/* ---- lib/house.js + routes/house.js against a stand-in core */
const T = fs.mkdtempSync(path.join(os.tmpdir(), "h524-")), PROJ = path.join(T, "projects", "p1");
fs.mkdirSync(PROJ, { recursive: true });
const stub = (rel, exp) => { const p = require.resolve(rel); require.cache[p] = { id: p, filename: p, loaded: true, exports: exp }; };
stub("../lib/core.js", { BASE: T, STYLES_DIR: path.join(T, "styles"), getProject: () => "p1", projDir: () => PROJ, pDir: (k) => path.join(PROJ, k) });
stub("../lib/styles.js", { read: () => [{ id: "a", name: "Qwen Image Edit" }, { id: "b", name: "SDXL" }, { id: "c", name: "FLUX Fill inpaint" }, { id: "d", name: "FLUX.2 Klein" }], imageSlots: (s) => (s.id === "a" || s.id === "c" ? 1 : 0) });
stub("../lib/imageRefs.js", { resolve: (s) => ({ swapped: s.id === "d" }) });
const H = require("../lib/house.js");
check("renderName: house-<slug>-<camera>-<kind>.png", H.renderName("My House!", "Living room", "depth") === "house-my-house-living-room-depth.png");
const express = require("express");
const app = express(); require("../routes/house.js").mount(app);
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const srv = app.listen(0, "127.0.0.1", async () => {
  const U = "http://127.0.0.1:" + srv.address().port;
  const j = async (u, o) => { const r = await fetch(U + u, o); return { s: r.status, b: await r.json().catch(() => null) }; };
  try {
    const big = G.example(); big.name = "Beach House"; for (let i = 0; i < 3000; i++) big.items.push({ id: "x" + i, floor: 0, type: "plant", x: i % 20, y: Math.floor(i / 20), rot: 0 });
    const sv = await j("/api/house", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(big) });
    check("POST /api/house: a big house (over the 100 kb JSON limit) saves - as text", sv.s === 200 && sv.b.slug === "beach-house" && JSON.stringify(big).length > 100000 && fs.existsSync(path.join(PROJ, "houses", "beach-house", "house.json")), sv);
    const bad = await j("/api/house", { method: "POST", body: "nope" });
    check("…not JSON = 400", bad.s === 400);
    const ls = await j("/api/house");
    check("GET /api/house: the list (rooms, floors, area)", ls.b.length === 1 && ls.b[0].rooms === 4 && ls.b[0].area > 50, ls.b);
    const g = await j("/api/house/beach-house");
    check("GET /api/house/:name: the model, normalised (furniture capped at 3000 pieces)", g.b.name === "Beach House" && g.b.items.length === 3000 && big.items.length > 3000, g.b.items && g.b.items.length);
    check("…an unknown house = 404", (await j("/api/house/nope")).s === 404);
    const rs = await j("/api/house/beach-house/render?kind=depth&cam=Living room", { method: "POST", headers: { "Content-Type": "image/png" }, body: PNG });
    check("POST render (depth): kept with the house AND in the Images assets", rs.b.file === "house-beach-house-living-room-depth.png" && rs.b.asset === rs.b.file && fs.existsSync(path.join(PROJ, "images", rs.b.file)) && fs.existsSync(path.join(PROJ, "houses", "beach-house", "renders", rs.b.file)), rs);
    const rp = await j("/api/house/beach-house/render?kind=pano&cam=Living room", { method: "POST", body: PNG });
    check("…a pano stays with the house (the Location gets its own copy)", rp.b.file && !rp.b.asset && !fs.existsSync(path.join(PROJ, "images", rp.b.file)), rp);
    check("…not a PNG / a bad kind = 400", (await j("/api/house/beach-house/render?kind=shot", { method: "POST", body: "GIF89a" })).s === 400 && (await j("/api/house/beach-house/render?kind=evil", { method: "POST", body: PNG })).s === 400);
    await j("/api/house/beach-house/render?kind=plan", { method: "POST", body: PNG });
    const pl = await fetch(U + "/api/house/beach-house/plan.png");
    check("the plan picture", pl.ok && Buffer.from(await pl.arrayBuffer()).equals(PNG));
    const rf = await fetch(U + "/api/house/beach-house/render/" + encodeURIComponent("../house.json"));
    check("a render's path cannot climb out of renders/", rf.status === 404);
    const z = Buffer.from(await (await fetch(U + "/api/house/beach-house/obj")).arrayBuffer());
    check("GET obj: a zip of house.obj + house.mtl + README", z.slice(0, 2).toString() === "PK" && z.includes("house.obj") && z.includes("house.mtl") && z.includes("README.txt"));
    const st = await j("/api/house/styles");
    check("styles: the ones that take a picture (an edit style; Klein via its edit sibling) - not inpaint, not text-only", JSON.stringify(st.b.map((s) => s.id)) === JSON.stringify(["a", "d"]), st.b);
    const d0 = await j("/api/house/beach-house", { method: "DELETE" });
    check("DELETE: the house goes; its Images assets stay by default", d0.b.ok && !fs.existsSync(path.join(PROJ, "houses", "beach-house")) && fs.existsSync(path.join(PROJ, "images", "house-beach-house-living-room-depth.png")));
    await j("/api/house", { method: "POST", body: JSON.stringify(big) });
    await j("/api/house/beach-house/render?kind=shot&cam=Living room", { method: "POST", body: PNG });
    fs.writeFileSync(path.join(PROJ, "images", "mine.png"), PNG);
    await j("/api/house/beach-house?assets=1", { method: "DELETE" });
    check("DELETE ?assets=1: its shots leave the Images assets too (only its own)", !fs.existsSync(path.join(PROJ, "images", "house-beach-house-living-room-shot.png")) && fs.existsSync(path.join(PROJ, "images", "mine.png")));
    check("a house needs a name", (await j("/api/house", { method: "POST", body: JSON.stringify({ name: "!!!" }) })).s === 400);
  } catch (e) { check("the routes ran", false, String(e && e.stack || e)); }
  srv.close(); fs.rmSync(T, { recursive: true, force: true });
  /* pins */
  const idx = fs.readFileSync(path.join(__dirname, "..", "routes", "index.js"), "utf8"), html = fs.readFileSync(path.join(__dirname, "..", "static", "index.html"), "utf8");
  check("pins: routes/house.js mounted from routes/index.js (not server.js)", /require\("\.\/house"\)\.mount\(app\)/.test(idx) && !/house/.test(fs.readFileSync(path.join(__dirname, "..", "misc", "server.js"), "utf8")));
  /* 2.630.0: the House builder is gone - this check went with it */
  const tp = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "lib", "testPlan.json"), "utf8"));
  /* 2.630.0: the House builder is gone - this check went with it */
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
});
