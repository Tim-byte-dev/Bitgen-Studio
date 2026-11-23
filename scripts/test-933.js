#!/usr/bin/env node
/* bitGen Studio — 2.933.0 units: 🧍 the garment drape (lib/garmentDrape.js, scripts/garment_drape.py, the A-pose bodies).
 * No Blender here - it is stood in for (the real cloth run: scripts/test-933-live.js). The job: start -> sewing -> rendering ->
 * done, the files beside the garment, models3d/garment-<slug>.glb, Images garment-<slug>-<view>.png, meta.drape with urls;
 * the quality words; refusals (no Blender 409, one at a time 409, no such garment 404, a Blender error said). */
"use strict";
const fs = require("fs");
const path = require("path");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const ROOT = path.join(__dirname, "..");
const D = require(path.join(ROOT, "lib", "garmentDrape.js"));
const G = require(path.join(ROOT, "lib", "garment.js"));
const core = require(path.join(ROOT, "lib", "core.js"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  /* ---- pure */
  check("quality(): closed seams, nothing inside, not slid = good", D.quality({ seam_gap_max_cm: 0.9, drop_cm: 2, inside_pct: 0 }).ok === true && /seams closed/.test(D.quality({}).words));
  const q = D.quality({ seam_gap_max_cm: 14.2, drop_cm: 35, inside_pct: 4.5 });
  check("…an open seam, a slide and pieces inside the body are each said (not good)", !q.ok && /14 cm open/.test(q.words) && /slid down 35 cm/.test(q.words) && /4\.5 % of it is inside/.test(q.words), q);
  check("cleanColor(): #rrggbb -> 0..1, a list clamped, junk -> the default red", JSON.stringify(D.cleanColor("#ff8000")) === "[1,0.502,0]" && JSON.stringify(D.cleanColor([2, -1, 0.5])) === "[1,0,0.5]" && D.cleanColor("blue").length === 3);

  /* ---- the A-pose bodies */
  const span = (f) => { let mx = 0, top = 0; for (const l of fs.readFileSync(f, "utf8").split("\n")) if (l.startsWith("v ")) { const p = l.split(" "); mx = Math.max(mx, Math.abs(+p[1])); top = Math.max(top, +p[2]); } return { mx, top }; };
  for (const s of ["female", "male"]) {
    const a = span(path.join(ROOT, "static", "mannequins", "mesh", s + ".obj")), b = span(path.join(ROOT, "static", "mannequins", "mesh", s + "_drape.obj"));
    check(`${s}_drape.obj: the same mannequin (height) with the arms raised (wider reach) - GarmentCode's A-pose`, Math.abs(a.top - b.top) < 0.002 && b.mx > a.mx + 0.15, { a, b });
  }
  const py = fs.readFileSync(path.join(ROOT, "scripts", "garment_drape.py"), "utf8");
  check("garment_drape.py: Blender's cloth with sewing springs, the mannequin a collider, Rz Ry Rx placement, GarmentCode's simulator NOT used",
    /use_sewing_springs = True/.test(py) && /"COLLISION"/.test(py) && /Matrix\.Rotation\(rz, 3, "Z"\) @ Matrix\.Rotation\(ry, 3, "Y"\) @ Matrix\.Rotation\(rx, 3, "X"\)/.test(py) && /NOT GarmentCode's simulator/.test(py)
    && /delaunay_2d_cdt/.test(py) && /lift/.test(py) && /drop_cm/.test(py));
  const mk = fs.readFileSync(path.join(ROOT, "scripts", "make_mannequin_mesh.py"), "utf8");
  check("make_mannequin_mesh.py --drape: arms at 90 - arm_pose_angle (the measure file), only the OBJ", /--drape/.test(mk) && /90\.0 - float\(m\["body"\]\["arm_pose_angle"\]\)/.test(mk) && /_drape\.obj/.test(mk));

  /* ---- a garment to drape (the pattern script stood in for, as in test-932) */
  const outline = { name: "fx", panels: [{ name: "left_ftorso", outline: [[0, 0], [20, 0], [20, 40], [0, 40]], rotation: [0, 0, 0], translation: [0, 90, 20],
    edges: [{ at: [0, 1] }, { at: [1, 2] }, { at: [2, 3] }, { at: [3, 4] }] }], stitches: [] };
  const pdeps = { runtime: { python: process.execPath, src: "/gc", script: "/x.py" }, run: async (cmd, args, o) => {
    const req = JSON.parse(fs.readFileSync(args[1], "utf8"));
    fs.writeFileSync(path.join(req.out, "outline.json"), JSON.stringify(outline));
    fs.writeFileSync(path.join(req.out, "pattern.svg"), "<svg xmlns='http://www.w3.org/2000/svg'/>");
    o.log('GARMENT {"ok": true, "panels": 1, "stitches": 0, "size_cm": [20, 40], "files": {"svg": "pattern.svg", "outline": "outline.json"}}');
    return 0;
  } };
  const g = await G.make({ name: "T933 drape fixture", values: { "meta.upper": "Shirt" }, body: { sex: "male", height: 175 } }, pdeps);
  const seen = [];
  const PNG = Buffer.from("89504e470d0a1a0a", "hex");
  const fakeBlender = (opts) => async (cmd, args, o) => {
    const req = JSON.parse(fs.readFileSync(args[args.indexOf("--") + 1], "utf8")); seen.push({ cmd, args, req });
    if (opts && opts.fail) { o.log("Traceback: boom"); o.log('DRAPE {"ok": false, "error": "cloth exploded"}'); return 1; }
    fs.mkdirSync(req.out, { recursive: true });
    for (const f of ["garment.obj", "garment.mtl", "dressed.glb", "drape.json"]) fs.writeFileSync(path.join(req.out, f), f);
    for (const v of ["front", "side", "back"]) fs.writeFileSync(path.join(req.out, v + ".png"), PNG);
    for (let f = 5; f <= req.frames; f += 5) { o.log(`DRAPE_STEP ${f}/${req.frames}`); await sleep(5); }
    for (const v of ["front", "side", "back"]) o.log("DRAPE_RENDER " + v);
    o.log('DRAPE ' + JSON.stringify({ ok: true, files: { obj: "garment.obj", mtl: "garment.mtl", glb: "dressed.glb", front: "front.png", side: "side.png", back: "back.png" },
      seam_gap_cm: 0.1, seam_gap_max_cm: 0.8, inside_pct: 0, drop_cm: (opts && opts.drop) || 1.5, lift_cm: 4.5, seconds: 12.3 }));
    return 0;
  };
  let e1 = null; try { D.start(g.slug, {}, { blender: null }); } catch (e) { e1 = e; }
  check("no Blender -> 409 saying so (Settings ▸ Blender)", e1 && e1.status === 409 && /Blender is not installed/.test(e1.message));
  let e2 = null; try { D.start("no-such-garment-933", {}, { blender: "/b" }); } catch (e) { e2 = e; }
  check("no such garment -> 404", e2 && e2.status === 404);
  const { id } = D.start(g.slug, { fabric: "denim", color: "#204080", frames: 40, size: [320, 480], samples: 4 }, { blender: "/opt/blender", run: fakeBlender() });
  let e3 = null; try { D.start(g.slug, {}, { blender: "/opt/blender", run: fakeBlender() }); } catch (e) { e3 = e; }
  check("…one at a time (a second start -> 409)", e3 && e3.status === 409 && /running/.test(e3.message));
  let j = D.get(id), states = new Set([j.state]);
  for (let i = 0; i < 200 && j.state !== "done" && j.state !== "error"; i++) { await sleep(10); j = D.get(id); states.add(j.state); }
  const r = seen[0];
  check("Blender run headless with the drape script and a request: the outline, the MALE A-pose body (the garment's sex), denim, the colour, 40 frames",
    r.cmd === "/opt/blender" && r.args.slice(0, 4).join() === "-b,--factory-startup,--python," + path.join(ROOT, "scripts", "garment_drape.py") && /outline\.json$/.test(r.req.outline)
    && /male_drape\.obj$/.test(r.req.body) && r.req.fabric === "denim" && JSON.stringify(r.req.color) === "[0.125,0.251,0.502]" && r.req.frames === 40 && r.req.samples === 4, r && r.req);
  check("the job: sewing -> rendering -> done 100 %, the quality in its note", j.state === "done" && j.pct === 100 && states.has("sewing") && /✓ draped - seams closed \(12\.3 s\)/.test(j.note), [j, [...states]]);
  const m = G.get(g.slug);
  check("meta.drape: files + urls (drape-<file>), the model, the views, the quality kept",
    m.drape && m.drape.urls.front === `/api/garment/file/${g.slug}/drape-front.png` && m.drape.urls.glb === `/api/garment/file/${g.slug}/drape-dressed.glb` && m.drape.model === `garment-${g.slug}.glb`
    && m.drape.images.side === `garment-${g.slug}-side.png` && m.drape.good === true && m.drape.sex === "male" && m.drape.fabric === "denim", m.drape);
  check("…dressed.glb copied to models3d/ (the image editor's 3D layer), the views to Images (References / Dress it)",
    fs.existsSync(path.join(core.pDir("models3d"), `garment-${g.slug}.glb`)) && ["front", "side", "back"].every((v) => fs.existsSync(path.join(core.pDir("images"), `garment-${g.slug}-${v}.png`))));
  check("fileOf: drape-<file> served from drape/, anything else refused", fs.existsSync(G.fileOf(g.slug, "drape-garment.obj")) && (() => { try { G.fileOf(g.slug, "drape-../meta.json"); return false; } catch (e) { return e.status === 404; } })());
  // a rough one, then a failing one
  const r2 = D.start(g.slug, { frames: 20 }, { blender: "/b", run: fakeBlender({ drop: 40 }) });
  for (let i = 0; i < 200 && !["done", "error"].includes(D.get(r2.id).state); i++) await sleep(10);
  check("a garment that slid off: done, but '⚠ draped roughly - … slid down 40 cm', meta.drape.good false", /⚠ draped roughly/.test(D.get(r2.id).note) && /slid down 40 cm/.test(D.get(r2.id).note) && G.get(g.slug).drape.good === false, D.get(r2.id).note);
  const r3 = D.start(g.slug, {}, { blender: "/b", run: fakeBlender({ fail: true }) });
  for (let i = 0; i < 200 && !["done", "error"].includes(D.get(r3.id).state); i++) await sleep(10);
  check("Blender's own error said (the job's error), the next drape may start", D.get(r3.id).state === "error" && /cloth exploded/.test(D.get(r3.id).error) && (() => { try { D.get("nope"); return false; } catch (e) { return e.status === 404; } })());
  // clean up
  G.remove(g.slug);
  try { fs.rmSync(path.join(core.pDir("models3d"), `garment-${g.slug}.glb`)); } catch { /* gone */ }
  for (const v of ["front", "side", "back"]) try { fs.rmSync(path.join(core.pDir("images"), `garment-${g.slug}-${v}.png`)); } catch { /* gone */ }
  const ui = fs.readFileSync(path.join(ROOT, "static", "garment.js"), "utf8");
  check("the dialog: 🧍 Drape on the mannequin, fabric + colour, the views, → References, 🧊 3D layer, ⤓ OBJ",
    /id="gmDrape"/.test(ui) && /id="gmFabric"/.test(ui) && /id="gmColor"/.test(ui) && /id="gmToRefs"/.test(ui) && /id="gmTo3d"/.test(ui) && /id="gmObj"/.test(ui) && /H3To3D\.deliver\(d\.model, "editor"\)/.test(ui));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e && e.stack || e)); process.exit(1); });
