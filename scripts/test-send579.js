#!/usr/bin/env node
/* bitGen Studio — 2.579.0 units: 🗑 a model deleted from the disk (lib/modelDelete.js), Settings ▸ Dockers ↺ Reset
 * (static/dockreset.js, GET /api/docker-status/defaults), the 📐 SolidCraft docker's sends - 🟠 Blender
 * (lib/blenderSend.js + scripts/blend_open_model.py), 🎮 Unreal (lib/ueImport.js + the plugin's import_mesh 1.4.0),
 * 🏠 House builder (static/housegeo.js 3D model items) - and the docker shown only with SolidCraft installed.
 * Tim: "add send to blender,send to unreal, send to homebuilder and send to image-editor buttons in soldicraft docker.
 * only show the docker is solidcraft is installed. only show the blender and unreal buttons if they are installed too.
 * allow user to delete models in model manager, in settings dialog add dockers tab, add all the dockers to that tab
 * including custom/new dockers with a reset button. reset that docker's position and size to default if reset is
 * clicked" + "when user deletes model in model manager, delete it from the disk too". Run: node scripts/test-send579.js */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);

(async () => {
  /* 1 🗑 delete a model from the disk */
  const MD = require(path.join(ROOT, "lib", "modelDelete.js"));
  check("sidecarsOf: the files beside it with its stem (previews, info, its config) - never another model file or another model's files",
    JSON.stringify(MD.sidecarsOf("juggernaut.safetensors", ["juggernaut.safetensors", "juggernaut.preview.png", "juggernaut.civitai.info", "juggernaut.bitgen.json", "juggernaut.yaml", "juggernaut.ckpt", "juggernaut_v2.png", "other.png", "Juggernaut.PNG"]))
      === JSON.stringify(["juggernaut.preview.png", "juggernaut.civitai.info", "juggernaut.bitgen.json", "juggernaut.yaml", "Juggernaut.PNG"]));
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg579-"));
  try {
    const dir = path.join(T, "models", "checkpoints"), info = path.join(T, "model_info", "models", "jug");
    fs.mkdirSync(dir, { recursive: true }); fs.mkdirSync(path.join(info, "user"), { recursive: true });
    fs.writeFileSync(path.join(dir, "jug.safetensors"), Buffer.alloc(4096));
    fs.writeFileSync(path.join(dir, "jug.preview.png"), "p"); fs.writeFileSync(path.join(dir, "jug.bitgen.json"), "{}"); fs.writeFileSync(path.join(dir, "jug.ckpt"), "other model");
    fs.writeFileSync(path.join(info, "info.json"), "{}");
    let invalidated = 0;
    const card = { key: "checkpoints|jug.safetensors", name: "jug.safetensors", kind: "model", size: 4096 };
    MD.setCards({ find: (k) => (k === card.key && fs.existsSync(path.join(dir, "jug.safetensors")) ? { card, abs: path.join(dir, "jug.safetensors") } : null), invalidate: () => { invalidated++; } });
    MD.setInfoDir(() => info);
    const c = MD.check(card.key);
    check("check(): what a delete removes - the file, its size, the files beside it, its model_info page", c.name === "jug.safetensors" && c.size === 4096 && JSON.stringify(c.sidecars.sort()) === '["jug.bitgen.json","jug.preview.png"]' && c.info === true && Array.isArray(c.styles), c);
    const r = MD.remove(card.key);
    check("remove(): the model file, its sidecars and its model_info page GONE FROM THE DISK; another model with the same stem stays; the cards rescan",
      r.ok && r.freed >= 4096 && !fs.existsSync(path.join(dir, "jug.safetensors")) && !fs.existsSync(path.join(dir, "jug.preview.png")) && !fs.existsSync(path.join(dir, "jug.bitgen.json"))
      && !fs.existsSync(info) && fs.existsSync(path.join(dir, "jug.ckpt")) && invalidated === 1, r);
    check("an unknown key (or one deleted already): no such model", /no such model/.test(MD.remove(card.key).error || "") && /no such model/.test(MD.remove("checkpoints|../../etc.safetensors").error || ""));
  } finally { MD.setCards(null); MD.setInfoDir(null); fs.rmSync(T, { recursive: true, force: true }); }
  const RM = rd("routes", "modelMgr.js"), MM = rd("static", "modelmgr.js");
  check("routes: GET /api/modelmgr/delete?key= (what goes), POST /api/modelmgr/delete {key} (lib/modelDelete)", /app\.get\("\/api\/modelmgr\/delete"/.test(RM) && /app\.post\("\/api\/modelmgr\/delete"/.test(RM) && /require\("\.\.\/lib\/modelDelete"\)\.remove/.test(RM));
  check("the model manager: 🗑 on every card and 🗑 Delete on its ⓘ page - a confirmation that lists what goes (and the styles that use it), then the card is gone",
    /data-mmdel/.test(MM) && /id="mmIDel"/.test(MM) && /function delModel\(key\)/.test(MM) && /appConfirm\(lines\.join/.test(MM) && /jpost\("\/api\/modelmgr\/delete"/.test(MM) && /load\(true\)/.test(MM));

  /* 2 Settings ▸ Dockers */
  const DR = require(path.join(ROOT, "static", "dockreset.js")), DS = require(path.join(ROOT, "lib", "dockerStatus.js"));
  check("nameOf: a docker header's words without ▾ / ⛶ / 📌", DR.nameOf("▾ 📐 SolidCraft⛶") === "📐 SolidCraft" && DR.nameOf("▸  Prompt chat 📌") === "Prompt chat");
  check("the built-in list = docker_status.json's dockers (main + side) - nothing left out", JSON.stringify(DR.MAIN.map((m) => m[0]).concat(DR.SIDE.map((s) => s[0]))) === JSON.stringify(DS.DOCKS));
  const D = DS.defaults();
  check("defaults(): the shipped height / width per docker (what ↺ Reset puts back)", D.docks.timelinedock.height === 150 && D.docks.rdock.width === 300 && D.docks.chatdock.state === "closed");
  const RD = rd("routes", "dockerStatus.js"), DJ = rd("static", "dockreset.js"), IX = rd("static", "index.html");
  check("GET /api/docker-status/defaults; the Dockers tab script loaded", /app\.get\("\/api\/docker-status\/defaults"/.test(RD) && /<script src="\/static\/dockreset\.js">/.test(IX));
  check("the tab: every .bdock on the page (extensions = custom / new ones), the side dockers, SecFloat windows; ↺ Reset: home (H3Panels / PFloat), not maximized, shown + open, the default height / width, no pin; ↺ Reset all",
    /querySelectorAll\("\.bdock\[id\]"\)/.test(DJ) && /SecFloat\.windows/.test(DJ) && /H3Panels\.home\(pid\)/.test(DJ) && /toggleMax\(d\.id, false\)/.test(DJ) && /max_height: 0, maximized: false, hidden: false, state: "open"/.test(DJ)
    && /x: -1, y: -1, w: 0, h: 0, mode: "float"/.test(DJ) && /function resetAll/.test(DJ) && /dataset\.stab = "dockers"/.test(DJ));

  /* 3 🟠 Blender */
  const BS = require(path.join(ROOT, "lib", "blenderSend.js"));
  const spawned = [];
  const bs = BS.send("sc_part.obj", { modelPath: (n) => (n === "sc_part.obj" ? "/p/models3d/sc_part.obj" : null), find: () => "/opt/blender/blender", spawn: (exe, args, o) => { spawned.push({ exe, args, o }); return { on() {}, unref() {} }; } });
  check("send: Blender's own window (no -b) with scripts/blend_open_model.py -- <obj> <projects/<p>/blender/solidcraft/<stem>.blend>, detached",
    bs.ok && spawned.length === 1 && spawned[0].exe === "/opt/blender/blender" && spawned[0].args[0] === "--python" && /blend_open_model\.py$/.test(spawned[0].args[1]) && spawned[0].args[2] === "--" && spawned[0].args[3] === "/p/models3d/sc_part.obj"
    && /blender[\\/]solidcraft[\\/]sc_part\.blend$/.test(spawned[0].args[4]) && spawned[0].o.detached && spawned[0].args.indexOf("-b") < 0, { bs, spawned });
  check("...no Blender found / no such model / not an .obj -> what to do", /Settings ▸ 3D/.test(BS.send("sc_part.obj", { modelPath: () => "/x.obj", find: () => null }).error) && /no model/.test(BS.send("nope.obj", { modelPath: () => null }).error) && /\.obj/.test(BS.send("a.glb", { modelPath: () => "/a.glb", find: () => "/b" }).error));
  const PY = rd("scripts", "blend_open_model.py");
  check("the script: the start scene emptied, OBJ in metres with Z up (wm.obj_import forward Y up Z scale 0.001; the old importer scaled after), saved as the .blend, framed in the window",
    /bpy\.ops\.wm\.obj_import\(filepath=path, forward_axis="Y", up_axis="Z", global_scale=0\.001\)/.test(PY) && /save_as_mainfile/.test(PY) && /view_selected/.test(PY) && /_empty_scene\(\)/.test(PY));
  check("routes: POST /api/blender/send {model}", /app\.post\("\/api\/blender\/send"/.test(rd("routes", "blender.js")));

  /* 4 🎮 Unreal */
  const UI = require(path.join(ROOT, "lib", "ueImport.js"));
  const y = UI.zUpMmToYupCm("# SolidCraft OBJ export (mm)\no Body1\nv 10 20 30\nvn 0 1 0\nvn 0 0 1\nf 1//1 2//2 3//1");
  check("zUpMmToYupCm: Z up mm -> Y up cm, (x, y, z) -> (x, z, -y) / 10 (a turn - faces keep their winding); normals turned, not scaled; the rest untouched",
    y === "# SolidCraft OBJ export (mm)\no Body1\nv 1 3 -2\nvn 0 0 -1\nvn 0 1 0\nf 1//1 2//2 3//1", y);
  const U = fs.mkdtempSync(path.join(os.tmpdir(), "bg579u-"));
  try {
    const src = path.join(U, "sc_part.obj"); fs.writeFileSync(src, "v 0 0 0\nv 100 0 0\nv 0 100 50\nf 1 2 3\n");
    let asked = null;
    const r = await UI.send("sc_part.obj", { modelPath: () => src, dir: path.join(U, "imp"), call: async (cmd, a, ms) => { asked = { cmd, a, ms }; return { ok: true, assets: ["/Game/bitGen/SolidCraft/sc_part.sc_part"], actor: "sc_part" }; } });
    check("send: the Y-up cm copy in projects/<p>/unreal/import, then the bridge's import_mesh {file, name, folder SolidCraft, place}",
      r.ok && asked.cmd === "import_mesh" && asked.a.name === "sc_part" && asked.a.folder === "SolidCraft" && asked.a.place === true && /v 0 5 -10/.test(fs.readFileSync(asked.a.file, "utf8")) && r.actor === "sc_part", { r, asked });
  } finally { fs.rmSync(U, { recursive: true, force: true }); }
  const BP = rd("ue", "bitGenBridge", "Content", "Python", "bitgen_bridge.py"), UP = JSON.parse(rd("ue", "bitGenBridge", "bitGenBridge.uplugin"));
  check("the plugin 1.4.0+ (2.590.0: 1.5.0): import_mesh (AssetImportTask automated, /Game/bitGen/<folder>, replace + save; placed in the level, replaced where it stood, selected)",
    /VERSION = "1\.([4-9]|\d\d)\.\d+"/.test(BP) && /^1\.([4-9]|\d\d)\.\d+$/.test(UP.VersionName) && /"import_mesh": cmd_import_mesh/.test(BP) && /AssetImportTask\(\)/.test(BP) && /"automated", True/.test(BP) && /spawn_actor_from_object\(mesh, loc, rot\)/.test(BP) && /set_selected_level_actors/.test(BP));
  check("routes: POST /api/unreal/import {model}; the test stub knows import_mesh", /app\.post\("\/api\/unreal\/import"/.test(rd("routes", "unreal.js")) && /import_mesh: \(a\) =>/.test(rd("scripts", "ue-stub.js")));

  /* 5 🏠 House builder: 3D model items */
  const G = require(path.join(ROOT, "static", "housegeo.js"));
  const md = G.loadModel("sc_box.obj", "v 0 0 0\nv 400 0 0\nv 400 300 0\nv 0 300 0\nv 0 0 200\nv 400 0 200\nv 400 300 200\nv 0 300 200\nf 1 2 3 4\nf 5 6 7 8\nf 1 2 6 5");
  check("loadModel: an OBJ in mm, Z up -> metres, centred on x / y, standing on 0; quads split into triangles", near(md.size[0], 0.4) && near(md.size[1], 0.3) && near(md.size[2], 0.2) && md.pos.length === 6 * 3 * 3 && Math.min(...md.pos.filter((_, i) => i % 3 === 2)) === 0);
  const H = G.normalize({ items: [{ type: "model", model: "sc_box.obj", x: 2, y: 1, rot: 90, w: 0.8, d: 0.3, h: 0.2 }, { type: "model", model: "../evil.obj" }, { type: "model" }], walls: [], rooms: [] });
  check("normalize keeps a model item with a plain models3d .obj name (and only those)", H.items.length === 1 && H.items[0].model === "sc_box.obj" && H.items[0].type === "model");
  const b = G.build(H, {}), mesh = b.meshes[0];
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < mesh.pos.length; i += 3) for (let j = 0; j < 3; j++) { mn[j] = Math.min(mn[j], mesh.pos[i + j]); mx[j] = Math.max(mx[j], mesh.pos[i + j]); }
  check("build: its own mesh at the item's place, turned 90° and stretched to w 0.8 (plan x / y -> world x / z, height -> y)",
    b.meshes.length === 1 && mesh.idx.length === 18 && near(mx[1] - mn[1], 0.2) && near(mx[0] - mn[0], 0.3) && near(mx[2] - mn[2], 0.8) && near((mn[0] + mx[0]) / 2, 2) && near((mn[2] + mx[2]) / 2, 1), { mn, mx });
  delete G.MODELS["sc_box.obj"];
  check("...not loaded yet: a box of its size (so the plan, shots and exports never lose it)", G.build(H, {}).meshes.length === 1 && G.build(H, {}).meshes[0].idx.length === 36);
  const HB = rd("static", "housebuilder.js"), HF = rd("lib", "houseFurnish.js"), HL = rd("lib", "house.js");
  check("the House builder: addModel(name) (its own size, the rooms' middle; again = the same piece), models read from models3d before drawing; never in the furniture list or the ✨ furnisher; the .obj / .glb exports carry them",
    /function addModel\(name\)/.test(HB) && /function ensureModels\(\)/.test(HB) && /if \(cat\[k\]\.hidden\) return;/.test(HB) && /G\.CATALOGUE\[t\]\.hidden/.test(HF) && /!G\.CATALOGUE\[k\]\.hidden/.test(HF) && /loadModels\(get\(name\)\)/.test(HL));

  /* 6 the SolidCraft docker */
  const DH = rd("ext", "solidcraftdock", "dock.html"), SJ = rd("ext", "solidcraftdock", "scdock.js"), AO = rd("static", "addons.js"), AD = require(path.join(ROOT, "lib", "addons.js"));
  check("the bar: Send to Image editor / Timeline / House builder / Blender / Unreal - Blender + Unreal hidden until found",
    /🖼 Send to Image editor/.test(DH) && /🎞 Send to Timeline/.test(DH) && /id="scToHouse"/.test(DH) && /id="scToBlender" type="button" hidden/.test(DH) && /id="scToUnreal" type="button" hidden/.test(DH)
    && /\$\("scToBlender"\)\.hidden = !\(j && j\.found\)/.test(SJ) && /\$\("scToUnreal"\)\.hidden = !\(j && \(j\.current \|\| j\.editor/.test(SJ));
  check("no SolidCraft = no docker and no status-bar button (sc-absent); Settings ▸ Add-ons' install / zip tells it (h3:addons-changed)",
    /#solidcraftdock\.sc-absent, #tX_solidcraftdock\.sc-absent \{ display: none !important; \}/.test(DH) && /classList\.toggle\("sc-absent", off\)/.test(SJ) && /addEventListener\("h3:addons-changed"/.test(SJ) && /dispatchEvent\(new CustomEvent\("h3:addons-changed"/.test(AO));
  const sc = AD.list().find((a) => a.id === "solidcraft");
  check("Settings ▸ Add-ons ▸ SolidCraft: ⤓ Install + 📦 Install from a zip… (the offline way, now that the docker hides)", sc && sc.zip && sc.zip.url === "/api/solidcraft/install-zip" && /data-aozip/.test(AO));

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
