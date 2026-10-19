#!/usr/bin/env node
/* bitGen Studio — 2.529.0 units: HOUSE BUILDER EXTRAS - ⌂ roofs (flat / gable / hip over the top floor), 🪄 furnish a
 * room (the LLM's pick cleaned to the library, else the rules by the kind of room; placed against the walls, clear of
 * doors, inside the room, never on top of other pieces), ⤓ .glb (binary glTF read back), 🖼 the plan picture to trace,
 * the routes. From the recommendations Tim asked to be worked through ("House builder extras"). */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const G = require("../static/housegeo.js"), F = require("../lib/houseFurnish.js"), GL = require("../lib/houseGltf.js");

/* ---- roofs */
const ex = G.example();
const top = (kind) => { const m = JSON.parse(JSON.stringify(ex)); m.roof = { kind, pitch: 30, overhang: 0.4 }; const b = G.build(G.normalize(m), {}); return { b, r: b.meshes.filter((g) => g.mat === "roof_tiles") }; };
check("no roof by default (nothing changes for the houses already drawn)", G.normalize(ex).roof.kind === "none" && !G.build(G.normalize(ex), {}).meshes.some((g) => /^roof_/.test(g.mat)));
const ga = top("gable"), hi = top("hip"), fl = top("flat");
const xs = []; ex.walls.forEach((w) => xs.push(w.a[1], w.b[1])); const ex2 = []; ex.walls.forEach((w) => ex2.push(w.a[0], w.b[0]));
const short = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ex2) - Math.min(...ex2)) + 0.8;
check("gable: the ridge at the ceiling + half the short side × tan(pitch), the overhang round it", ga.r.length === 1 && Math.abs(ga.b.bounds[4] - (2.7 + short / 2 * Math.tan(Math.PI / 6))) < 1e-6 && ga.b.bounds[0] < Math.min(...ex2) - 0.39, [ga.b.bounds[4], 2.7 + short / 2 * Math.tan(Math.PI / 6)]);
check("…its two gable ends are in the walls' material", ga.b.meshes.some((g) => g.mat === "plaster" && g.pos.some((v, i) => i % 3 === 1 && v > 3)));
check("hip: four slopes (no gable ends), the same height", hi.r[0].idx.length === 4 * 6 && Math.abs(hi.b.bounds[4] - ga.b.bounds[4]) < 1e-6);
check("flat: a slab + a parapet, low", fl.r.length === 1 && fl.b.bounds[4] < 3.3);
check("build {roof: false} leaves it off (the orbit view's choice)", (() => { const m = JSON.parse(JSON.stringify(ex)); m.roof = { kind: "gable" }; return !G.build(G.normalize(m), { roof: false }).meshes.some((g) => g.mat === "roof_tiles"); })());
check("…over the TOP floor only (two floors: on the second)", (() => { const m = G.normalize({ name: "2", floors: [{}, {}] }); G.addRoom(m, 0, [[0, 0], [5, 0], [5, 4], [0, 4]], "A"); G.addRoom(m, 1, [[0, 0], [5, 0], [5, 4], [0, 4]], "B"); m.roof = G.normalize({ roof: { kind: "flat" } }).roof; const b = G.build(m, {}), r = b.meshes.find((g) => g.mat === "roof_tiles"); const ys = r.pos.filter((v, i) => i % 3 === 1); return Math.min(...ys) > 5.5 && !G.build(m, { upTo: 0 }).meshes.some((g) => g.mat === "roof_tiles"); })());
check("normalize: pitch 5 - 60°, overhang 0 - 1.5 m, a roof material only", (() => { const r = G.normalize({ roof: { kind: "hip", pitch: 99, overhang: -1, mat: "oak" } }).roof; return r.pitch === 60 && r.overhang === 0 && r.mat === "roof_tiles"; })());

/* ---- furnish */
check("the kind of room: from its name, else your words", F.kindOf("Master Bedroom") === "bedroom" && F.kindOf("Room 3", "a home office with a desk") === "office" && F.kindOf("Ensuite") === "bathroom" && F.kindOf("Room 9", "") === "other");
const room = (name, w, d) => ({ name, floor: 0, poly: [[0, 0], [w, 0], [w, d], [0, d]] });
check("rules: a small bedroom gets a single bed, a big one a king", F.rules(room("Bedroom", 3, 2.8)).items.some((x) => x.type === "bed_single") && F.rules(room("Bedroom", 5, 4)).items.some((x) => x.type === "bed_king"));
check("…your words add library pieces (a piano, plants), a 'king bed' replaces the bed", (() => { const r = F.rules(room("Living", 6, 5), "a reading nook with a piano"); const b = F.rules(room("Bedroom", 4, 4), "a king bed"); return r.items.some((x) => x.type === "piano") && b.items.filter((x) => /^bed_/.test(x.type)).length === 1 && b.items.some((x) => x.type === "bed_king"); })());
check("wishList: the LLM's JSON, library types only, counts 1 - 8, at most 24 pieces", JSON.stringify(F.wishList('Sure! {"items":[{"type":"Sofa","count":1},{"type":"spaceship"},{"type":"chair","count":30},{"type":"coffee table"}]}')) === JSON.stringify([{ type: "sofa", count: 1 }, { type: "chair", count: 8 }, { type: "coffee_table", count: 1 }]) && F.wishList("no json here") === null);
// a real room with a door: everything inside, nothing overlapping, the door clear
const m = G.normalize({ name: "F" });
const bed = G.addRoom(m, 0, [[0, 0], [4.5, 0], [4.5, 4], [0, 4]], "Bedroom");
const wall = m.walls.find((w) => w.a[1] === 4 && w.b[1] === 4);
m.openings.push({ id: "d1", wall: wall.id, kind: "door", t: Math.abs(1 - wall.a[0]), w: 0.9, h: 2.1, sill: 0 });
const out = F.place(m, bed, F.rules(bed).items);
const corners = (it) => { const a = it.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [it.x + u * it.w / 2 * c - v * it.d / 2 * s, it.y + u * it.w / 2 * s + v * it.d / 2 * c]); };
check("place: the bedroom's set (bed, 2 bedsides, wardrobe, plant, light) all placed", out.skipped.length === 0 && out.placed.filter((i) => i.type === "bedside").length === 2 && out.placed.some((i) => /^bed_/.test(i.type)) && out.placed.some((i) => i.type === "wardrobe"), out);
check("…every piece inside the room", out.placed.every((it) => corners(it).every((p) => p[0] >= -0.001 && p[0] <= 4.501 && p[1] >= -0.001 && p[1] <= 4.001)), out.placed.map((i) => [i.type, corners(i)]));
const doorC = [1, 4];
check("…the door kept clear (1 m)", out.placed.filter((i) => !/ceiling_light|pendant|rug/.test(i.type)).every((it) => corners(it).concat([[it.x, it.y]]).every((p) => Math.hypot(p[0] - doorC[0], p[1] - doorC[1]) >= 0.99)), out.placed.map((i) => [i.type, i.x, i.y]));
const bedIt = out.placed.find((i) => /^bed_/.test(i.type)), f = [-Math.sin(bedIt.rot * Math.PI / 180), Math.cos(bedIt.rot * Math.PI / 180)];
check("…the bed's head against a wall, its foot into the room", corners(bedIt).some((p) => p[0] < 0.2 || p[0] > 4.3 || p[1] < 0.2 || p[1] > 3.8) && G.inside([bedIt.x + f[0] * 1.5, bedIt.y + f[1] * 1.5], bed.poly), bedIt);
const bs = out.placed.filter((i) => i.type === "bedside");
check("…the bedsides on either side of the bed", bs.length === 2 && Math.sign((bs[0].x - bedIt.x) * Math.cos(bedIt.rot * Math.PI / 180) + (bs[0].y - bedIt.y) * Math.sin(bedIt.rot * Math.PI / 180)) !== Math.sign((bs[1].x - bedIt.x) * Math.cos(bedIt.rot * Math.PI / 180) + (bs[1].y - bedIt.y) * Math.sin(bedIt.rot * Math.PI / 180)), bs);
m.items.push(...out.placed);
const again = F.place(m, bed, [{ type: "wardrobe", count: 1 }, { type: "piano", count: 1 }]);
check("…a second go never lands on what is there (or reports it)", again.placed.every((it) => !out.placed.some((o) => !/ceiling_light|pendant|rug/.test(o.type) && corners(it).some((p) => { const a = -o.rot * Math.PI / 180, dx = p[0] - o.x, dy = p[1] - o.y; return Math.abs(dx * Math.cos(a) - dy * Math.sin(a)) < o.w / 2 - 0.02 && Math.abs(dx * Math.sin(a) + dy * Math.cos(a)) < o.d / 2 - 0.02; }))) && again.placed.length + again.skipped.length === 2, again);
const din = G.normalize({ name: "D" }); const dr = G.addRoom(din, 0, [[0, 0], [5, 0], [5, 4], [0, 4]], "Dining");
const dp = F.place(din, dr, F.rules(dr).items), tb = dp.placed.find((i) => i.type === "dining_table");
check("dining: the table in the middle, six chairs round it, facing it", tb && dp.placed.filter((i) => i.type === "chair").length === 6 && dp.placed.filter((i) => i.type === "chair").every((c) => Math.hypot(c.x - tb.x, c.y - tb.y) < 1.6), dp);
(async () => {
  const fake = async () => ({ ok: true, text: '{"items":[{"type":"desk","count":1},{"type":"office_chair"},{"type":"bookshelf","count":2}]}' });
  const r1 = await F.furnish({ model: m, room: bed.id, prompt: "make it a study" }, fake);
  check("furnish: the LLM's pick, placed (by: llm)", r1.by === "llm" && r1.items.some((i) => i.type === "desk") && r1.wanted.length === 3, r1);
  const r2 = await F.furnish({ model: din, room: dr.id, prompt: "" }, async () => ({ ok: false, error: "no llm" }));
  check("…no LLM: the rules (by: rules)", r2.by === "rules" && r2.items.length > 4);
  const r3 = await F.furnish({ model: din, room: "nope" }, fake).catch((e) => e);
  check("…an unknown room = 400", r3 && r3.status === 400);

  /* ---- .glb */
  const b = G.build(G.normalize(ex), { ceilings: true }), glb = GL.toGlb(b.meshes, "Example", G.MATERIALS), back = GL.readGlb(glb);
  check(".glb: the header (glTF 2), the length, a JSON + a BIN chunk", glb.readUInt32LE(0) === 0x46546c67 && glb.readUInt32LE(4) === 2 && back.length === glb.length && back.json.asset.version === "2.0" && back.bin.length === back.json.buffers[0].byteLength);
  check("…one primitive + one PBR material per mesh group; glass is see-through (BLEND)", back.json.meshes[0].primitives.length === b.meshes.length && back.json.materials.length === b.meshes.length && back.json.materials.some((x) => x.alphaMode === "BLEND"));
  const acc = back.json.accessors[0], view = back.json.bufferViews[acc.bufferView];
  const firstX = back.bin.readFloatLE(view.byteOffset);
  check("…the vertex data is the build's (the first x) and the bounds are set", Math.abs(firstX - b.meshes[0].pos[0]) < 1e-5 && acc.min && acc.max && acc.count === b.meshes[0].pos.length / 3);
  check("…every buffer view 4-byte aligned", back.json.bufferViews.every((v) => v.byteOffset % 4 === 0));

  /* ---- the routes: glb, trace, furnish (stand-in core) */
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "hx529-")), PROJ = path.join(T, "projects", "p1");
  fs.mkdirSync(path.join(PROJ, "images"), { recursive: true });
  const stub = (rel, exp) => { const p = require.resolve(rel); require.cache[p] = { id: p, filename: p, loaded: true, exports: exp }; };
  stub("../lib/core.js", { BASE: T, getProject: () => "p1", projDir: () => PROJ, pDir: (k) => path.join(PROJ, k) });
  const H = require("../lib/house.js");
  H.save(Object.assign(G.example(), { name: "Glb House" }));
  const express = require("express");
  const app = express(); require("../routes/house.js").mount(app);
  const srv = app.listen(0, "127.0.0.1", async () => {
    const U = "http://127.0.0.1:" + srv.address().port;
    try {
      const g1 = await fetch(U + "/api/house/glb-house/glb");
      const gb = Buffer.from(await g1.arrayBuffer());
      check("GET /api/house/:name/glb: a .glb download", g1.ok && /gltf-binary/.test(g1.headers.get("content-type")) && /glb-house\.glb/.test(g1.headers.get("content-disposition")) && GL.readGlb(gb).json.asset.version === "2.0");
      const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
      const t1 = await (await fetch(U + "/api/house/glb-house/trace", { method: "POST", body: png })).json();
      const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
      const t2 = await (await fetch(U + "/api/house/glb-house/trace", { method: "POST", body: jpg })).json();
      const t3 = await fetch(U + "/api/house/glb-house/trace", { method: "POST", body: Buffer.from("GIF89a....") });
      const dir = path.join(PROJ, "houses", "glb-house");
      check("POST trace: a PNG / JPEG kept as trace.<ext> (a new one replaces the old), anything else 400", t1.file === "trace.png" && t2.file === "trace.jpg" && !fs.existsSync(path.join(dir, "trace.png")) && fs.existsSync(path.join(dir, "trace.jpg")) && t3.status === 400, [t1, t2, t3.status]);
      const t4 = await fetch(U + "/api/house/glb-house/trace");
      check("GET trace: the picture", t4.ok && Buffer.from(await t4.arrayBuffer()).equals(jpg));
      check("…a house not saved = 404", (await fetch(U + "/api/house/nope/trace", { method: "POST", body: png })).status === 404);
      const fm = G.example(); const lr = fm.rooms.find((r) => /Bed/.test(r.name));
      fm.items = fm.items.filter((i) => !G.inside([i.x, i.y], lr.poly));
      const fr = await (await fetch(U + "/api/house/furnish", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ model: fm, room: lr.id, prompt: "", llm: false }) })).json();
      check("POST /api/house/furnish (as text - a big house is more than 100 kb): the pieces", fr.by === "rules" && fr.kind === "bedroom" && fr.items.length >= 4, fr);
      check("normalize keeps the trace (its file name only trace.<ext>)", G.normalize({ trace: { file: "trace.png", x: 1, y: 2, mpp: 0.03, opacity: 0.4 } }).trace.mpp === 0.03 && G.normalize({ trace: { file: "../../x.png" } }).trace === null);
    } catch (e) { check("the routes ran", false, String(e && e.stack || e)); }
    srv.close(); fs.rmSync(T, { recursive: true, force: true });
    check("pins: the 🧪 checklist has the 2.529 group", JSON.parse(fs.readFileSync(path.join(__dirname, "..", "lib", "testPlan.json"), "utf8")).groups.some((g) => g.id === "g529"));
    console.log(`\n${pass} passed, ${fail} failed`);
    console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
    process.exit(fail ? 1 : 0);
  });
})();
