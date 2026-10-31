#!/usr/bin/env node
/* bitGen Studio — 2.538.0 units: ⤓ CIVITAI INTO EACH TYPE'S FOLDER (lib/modelFolders.js, model_folders.json), 🔄 SYNC,
 * the house builder's ◯ LIGHTS (static/housegeo.js + housebuilder.js), ⛶ MAXIMIZE BETWEEN THE SIDE DOCKERS (secfloat).
 * Tim (verbatim): "add download button to civitai models, create dialog to get folder location to save to, store the
 * folder location for each type of model and lora. if folder location is set for a model type don't show the dialog,
 * just download it to it's folder. shift+click the download button will open the dialog to change the folder. use the
 * folder select dialog to select the folder. save the folder in model_folders.json file. model types will be, sd1, sdxl,
 * pony,illustrious, flux2klein,flux3klein, flux, flux2, z-image etc. image, image-edit, video and music models will be
 * the main categories. add a circle to the toolbar in home builder, this will show location for lights. when maximizing
 * a docker don't cover vertical dockers (gallery, queue,references,assets etc if they are open . add a sync button in
 * models docker to retrieve the data for all the civitai models already on the computer" */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const MF = require("../lib/modelFolders.js"), MC = require("../lib/modelCards.js");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  /* ---- the keys */
  check("typeOf: sd15 -> sd1; flux3 -> flux3klein; flux2 + 'klein' -> flux2klein, else flux2; z-image / pony / illustrious as they are",
    MF.typeOf("sd15") === "sd1" && MF.typeOf("flux3") === "flux3klein" && MF.typeOf("flux2", { name: "FLUX.2 Klein 9B" }) === "flux2klein" && MF.typeOf("flux2", { base_model: "Flux.2 D" }) === "flux2"
    && MF.typeOf("z-image") === "z-image" && MF.typeOf("pony") === "pony" && MF.typeOf("illustrious") === "illustrious" && MF.typeOf("nonsense") === "other");
  check("mainOf: image / image edit -> image-edit / video / music (anything else = image)", MF.mainOf("image edit") === "image-edit" && MF.mainOf("video") === "video" && MF.mainOf("music") === "music" && MF.mainOf("?") === "image");
  check("kindOf: checkpoints / diffusion_models / unet = model; loras = lora; vae / embeddings as they are", MF.kindOf("checkpoints") === "model" && MF.kindOf("diffusion_models") === "model" && MF.kindOf("unet") === "model" && MF.kindOf("loras") === "lora" && MF.kindOf("vae") === "vae" && MF.kindOf("embeddings") === "embeddings");
  check("keyOf / parseKey / labelOf: image/sdxl/lora <-> {main, type, kind}, 'Image · SDXL LoRAs'; a bad key = null",
    MF.keyOf("image", "sdxl", "lora") === "image/sdxl/lora" && JSON.stringify(MF.parseKey("video/wan/model")) === JSON.stringify({ main: "video", type: "wan", kind: "model" })
    && MF.labelOf("image/sdxl/lora") === "Image · SDXL LoRAs" && MF.labelOf("image-edit/qwen/model") === "Image edit · Qwen models" && MF.parseKey("image/../lora") === null && MF.parseKey("x/sdxl/lora") === null);
  check("every type Tim named is a type: sd1 sdxl pony illustrious flux2klein flux3klein flux flux2 z-image; the main categories image image-edit video music",
    ["sd1", "sdxl", "pony", "illustrious", "flux2klein", "flux3klein", "flux", "flux2", "z-image"].every((t) => MF.TYPES[t]) && JSON.stringify(MF.MAINS) === JSON.stringify(["image", "image-edit", "video", "music"]));
  check("inside: a folder in (or equal to) a root, any slash, Windows paths any case; a sibling with the same start is not",
    MF.inside("/c/models/loras/SDXL", ["/c/models/loras"]) && MF.inside("D:\\ComfyUI\\models\\LoRAs\\x", ["d:/comfyui/models/loras"]) && MF.inside("/c/m/loras", ["/c/m/loras/"]) && !MF.inside("/c/m/loras2/x", ["/c/m/loras"]) && !MF.inside("/x", []));
  const nz = MF.normalize({ folders: { "image/sdxl/lora": "/a/b", "nope/x/y": "/c", "image/pony/model": "relative/dir", "video/wan/lora": "E:\\Models\\Wan" } });
  check("normalize: only known keys with a full path (POSIX or a drive letter) are kept", JSON.stringify(nz) === JSON.stringify({ v: 1, folders: { "image/sdxl/lora": "/a/b", "video/wan/lora": "E:\\Models\\Wan" } }), nz);
  check("baseFamily: 'Flux.3 Klein' is Flux 3 now (it was read as Flux.2 for the word Klein); 'Flux.2 Klein 9B' stays Flux.2", MC.baseFamily("Flux.3 Klein") === "flux3" && MC.baseFamily("Flux.2 Klein 9B") === "flux2" && MC.baseFamily("Flux.1 D") === "flux");

  /* ---- model_folders.json */
  const FILE = MF.file(), had = fs.existsSync(FILE) ? fs.readFileSync(FILE, "utf8") : null;
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg538-"));
  try {
    try { fs.rmSync(FILE); } catch { /* none */ }
    check("model_folders.json is <app>/model_folders.json (one for every project)", FILE === path.join(ROOT, "model_folders.json"));
    check("…none yet: get = '', the list is empty", MF.get("image/sdxl/lora") === "" && MF.list().folders.length === 0);
    const s1 = MF.set("image/sdxl/lora", path.join(T, "SDXL loras"));
    check("set: a type's folder is kept in the file", s1.ok && JSON.parse(fs.readFileSync(FILE, "utf8")).folders["image/sdxl/lora"] === path.join(T, "SDXL loras") && MF.get("image/sdxl/lora") === path.join(T, "SDXL loras"), s1);
    check("…an unknown type / a relative folder is refused", !!MF.set("image/nope/lora", "/x").error && !!MF.set("image/sdxl/lora", "rel/x").error);
    MF.set("image/pony/model", path.join(T, "Pony"));
    const L = MF.list();
    check("list: every set type with its label, A-Z; the types / kinds / main categories for the 📁 form", L.folders.length === 2 && L.folders[0].key === "image/pony/model" && L.folders[0].label === "Image · Pony models" && L.types.flux3klein && L.kinds.lora && L.mains.length === 4, L.folders);
    MF.set("image/pony/model", "");
    check("set dir '' forgets it (the next ⤓ asks again)", MF.get("image/pony/model") === "" && MF.list().folders.length === 1);

    /* ---- resolve: which type a Civitai file is */
    const r1 = MF.resolve({ base_model: "Pony", name: "Some Pony LoRA x.safetensors", cat: "loras" });
    check("resolve: a Pony LoRA -> image/pony/lora (no folder yet)", r1.key === "image/pony/lora" && r1.dir === "" && r1.label === "Image · Pony LoRAs", r1);
    const r2 = MF.resolve({ base_model: "SDXL 1.0", name: "Detail XL", cat: "loras" });
    check("…an SDXL LoRA -> image/sdxl/lora WITH the folder set above", r2.key === "image/sdxl/lora" && r2.dir === path.join(T, "SDXL loras"), r2);
    const r3 = MF.resolve({ base_model: "Qwen", name: "Qwen Image Edit 2511 x.safetensors", cat: "diffusion_models" });
    const r4 = MF.resolve({ base_model: "Wan Video 2.2 T2V-A14B", name: "motion lora", cat: "loras" });
    const r5 = MF.resolve({ base_model: "Flux.2 Klein 9B", name: "klein checkpoint", cat: "checkpoints" });
    const r6 = MF.resolve({ base_model: "Flux.3 Klein", name: "x", cat: "checkpoints" });
    const r7 = MF.resolve({ base_model: "SD 1.5", name: "y", cat: "checkpoints" });
    check("…Qwen Image Edit -> image-edit/qwen/model; a Wan LoRA -> video/wan/lora; Flux.2 Klein -> flux2klein; Flux 3 Klein -> flux3klein; SD 1.5 -> sd1",
      r3.key === "image-edit/qwen/model" && r4.key === "video/wan/lora" && r5.key === "image/flux2klein/model" && r6.key === "image/flux3klein/model" && r7.key === "image/sd1/model", [r3.key, r4.key, r5.key, r6.key, r7.key]);

    /* ---- civitai.download {folder}: the folder is read from the file, never the request */
    const cv = require("../lib/civitai.js"), ex = require("../lib/setupExec.js");
    const real = { api: cv.api, cfg: cv.cfg, dl: ex.download, open: ex.open, gj: ex.getJson };
    const e1 = cv.download({ version_id: "1", folder: "image/pony/lora" });
    check("download {folder} with no folder set for that type -> an error that says so (need_folder) - nothing queued", !!e1.error && e1.need_folder === true && e1.key === "image/pony/lora", e1);
    check("…an unknown type -> refused", !!cv.download({ version_id: "1", folder: "image/zzz/lora" }).error && !!cv.download({ version_id: "1", folder: "../../etc" }).error);
    const got = [];
    cv.cfg = () => ({ token: "", site: "civitai.com", mature: false });
    const fakeApi = (p) => {
      if (p === "/model-versions/5381") return { id: 5381, modelId: 538, name: "v1", baseModel: "SDXL 1.0", model: { name: "E2E 538 LoRA", type: "LORA" }, images: [],
        files: [{ id: 9, name: "e2e538_lora.safetensors", sizeKB: 1, type: "Model", primary: true, downloadUrl: "https://civitai.com/api/download/models/5381", hashes: {} }] };
      if (p === "/models/538") return { id: 538, name: "E2E 538 LoRA", type: "LORA", description: "" };
      return null;
    };
    ex.getJson = async (u) => { const j = fakeApi(String(u).replace(/^https:\/\/[^/]+\/api\/v1/, "").replace(/\?.*$/, "")); return j ? { status: 200, json: j } : { status: 404, json: null }; };
    ex.download = async (url, dest) => { got.push([url, dest]); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, Buffer.alloc(1024)); return { ok: true, status: 200 }; };
    ex.open = async () => ({ status: 404, headers: {}, res: { resume() {} } });
    const q = cv.download({ version_id: "5381", folder: "image/sdxl/lora", title: "E2E 538 LoRA", dir: "/etc/evil" });
    let d = null;
    for (let i = 0; i < 50; i++) { d = cv.downloads().find((x) => x.id === q.download.id); if (d && (d.status === "done" || d.status === "failed")) break; await sleep(60); }
    const want = path.join(T, "SDXL loras", "e2e538_lora.safetensors");
    check("…set: it downloads INTO that type's folder (made if missing) - a 'dir' in the request is ignored", d && d.status === "done" && d.dest === want && fs.existsSync(want) && got.length === 1 && got[0][1] === want, d);
    check("…its card is written beside it (<stem>.bitgen.json)", fs.existsSync(path.join(T, "SDXL loras", "e2e538_lora.bitgen.json")));
    const q2 = cv.download({ version_id: "5381", folder: "image/sdxl/lora" });
    for (let i = 0; i < 50; i++) { d = cv.downloads().find((x) => x.id === q2.download.id); if (d && (d.status === "done" || d.status === "failed")) break; await sleep(60); }
    check("…the same file there already (same size) = not downloaded again", d && d.status === "done" && got.length === 1 && /already in SDXL loras/.test(d.note), d);
    Object.assign(cv, { api: real.api, cfg: real.cfg }); ex.download = real.dl; ex.open = real.open; ex.getJson = real.gj;

    /* ---- 🔄 Sync: modelInfo by the version id + fetch {all, sync} */
    const MI = require("../lib/modelInfo.js");
    const calls = [];
    cv.cfg = () => ({ token: "", site: "civitai.com", mature: false });
    cv.api = async (p) => {
      calls.push(p);
      if (p === "/model-versions/77001") return { id: 77001, modelId: 770, name: "v2", baseModel: "Pony", trainedWords: ["e2e538"], images: [], model: { name: "E2E Sync", type: "Checkpoint" } };
      if (p === "/models/770") return { id: 770, name: "E2E Sync", type: "Checkpoint", description: "synced" };
      const e = new Error("404"); e.status = 404; throw e;
    };
    const card = { key: "checkpoints|e2e538_sync.safetensors", kind: "model", cat: "checkpoints", name: "e2e538_sync.safetensors", file: "e2e538_sync.safetensors", size: 2048, civitai: { model_id: 770, version_id: 77001 } };
    const dir = MI.dirFor(card);
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      const r = await MI.fetchOne(card);
      const info = MI.infoFor(card);
      check("fetchOne: a model Civitai already named (its version id) is asked for EXACTLY (/model-versions/<id>, first) -> found, match 'id'", r === "found" && calls[0] === "/model-versions/77001" && info && info.match === "id" && info.civitai.baseModel === "Pony", [r, calls, info && info.match]);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    // the queue: a card with nothing, one up to date, one 'nomatch' with a Civitai version id
    const mk = (n, extra) => Object.assign({ key: "checkpoints|" + n, kind: "model", cat: "checkpoints", name: n, file: n, size: 4096 }, extra || {});
    const c1 = mk("e2e538_a.safetensors"), c2 = mk("e2e538_b.safetensors"), c3 = mk("e2e538_c.safetensors", { civitai: { model_id: 1, version_id: 2 } });
    const put = (c, status) => { const dd = MI.dirFor(c); fs.mkdirSync(dd, { recursive: true }); fs.writeFileSync(path.join(dd, "info.json"), JSON.stringify({ v: 1, file: c.file, size: c.size, cat: c.cat, status, fetched_at: Date.now() })); };
    put(c2, "found"); put(c3, "nomatch");
    const realList = MC.list;
    MC.list = () => ({ models: [c1, c2, c3], loras: [] });
    cv.api = async () => { const e = new Error("no key"); e.status = 401; throw e; };    // the queue stops at once
    const wait = async () => { for (let i = 0; i < 60 && MI.status().running; i++) await sleep(50); };
    try {
      const f1 = MI.fetch({ all: true }); await wait();
      const f2 = MI.fetch({ all: true, sync: true }); await wait();
      const f3 = MI.fetch({ all: true, sync: true, force: true }); await wait();
      check("fetch {all}: only the cards with no details (1 of 3)", f1.queued === 1 && f1.skipped === 2, f1);
      check("🔄 fetch {all, sync}: + the one Civitai named whose details are no match yet (2 of 3)", f2.queued === 2 && f2.skipped === 1, f2);
      check("…Shift (force): all of them again", f3.queued === 3, f3);
    } finally { MC.list = realList; [c1, c2, c3].forEach((c) => fs.rmSync(MI.dirFor(c), { recursive: true, force: true })); Object.assign(cv, { api: real.api, cfg: real.cfg }); }
  } finally {
    if (had == null) { try { fs.rmSync(FILE); } catch { /* fine */ } } else fs.writeFileSync(FILE, had);
    fs.rmSync(T, { recursive: true, force: true });
  }

  /* ---- the routes, the docker */
  const ri = read("routes", "index.js"), rf = read("routes", "modelFolders.js"), sv = read("misc/server.js");
  check("routes/modelFolders.js mounted from routes/index.js (never server.js): GET /api/modelfolders, POST /api/modelfolders, POST /api/modelfolders/resolve",
    /require\("\.\/modelFolders"\)\.mount\(app\)/.test(ri) && /app\.get\("\/api\/modelfolders"/.test(rf) && /app\.post\("\/api\/modelfolders"/.test(rf) && /\/api\/modelfolders\/resolve/.test(rf) && !/modelfolders|modelFolders/i.test(sv));
  const mm = read("static", "modelmgr.js");
  check("the docker: ⤓ on a Civitai card (data-cvget, Shift = change the folder), the Select Folder dialog (FileDialog mode dir), 📁 the folders, 🔄 Sync ({all, sync})",
    /data-cvget/.test(mm) && /cvQuick\(card\.dataset\.key, e\.shiftKey\)/.test(mm) && /FileDialog\.open\(\{ mode: "dir"/.test(mm) && /id="mmFoldBtn"/.test(mm) && /id="mmSync"/.test(mm) && /all: true, sync: true/.test(mm) && /if \(r\.dir && !shift\) return go\(\)/.test(mm));
  check("…the versions view's ⤓ goes the same way (cvGet with Shift)", /cvGet\(it, v, f, e\.shiftKey/.test(mm));
  check(".gitignore keeps model_folders.json out (it is yours)", /^model_folders\.json$/m.test(read(".gitignore")));

  /* ---- ◯ lights */
  const G = require("../static/housegeo.js");
  const m = G.normalize({ floors: [{ name: "Ground", height: 2.7 }, { name: "Up", height: 2.5 }], lights: [{ x: 1, y: 2, floor: 1, reach: 99, intensity: -3, color: "bad" }, { x: 0, y: 0 }] });
  check("normalize: lights [{id, floor, name, x, y, z, intensity, color, reach}] - reach 0.5-30, brightness 0.1-5, a bad colour = warm white, z defaults under the ceiling",
    m.lights.length === 2 && m.lights[0].floor === 1 && m.lights[0].reach === 30 && m.lights[0].intensity === 0.1 && m.lights[0].color === "#ffd9a0" && Math.abs(m.lights[0].z - 2.2) < 1e-6 && m.lights[1].z === 2.4 && m.lights[1].reach === 4 && /^l/.test(m.lights[0].id) && m.lights[1].name === "Light 2", m.lights);
  const b = G.build(m), E = G.elevations(m), pl = b.lights.filter((L) => L.placed);
  check("build: a placed light is in the scene's lights (placed, its colour + reach), at its floor's elevation + its height", pl.length === 2 && pl[0].x === 1 && pl[0].z === 2 && Math.abs(pl[0].y - (E[1] + 2.2)) < 1e-6 && pl[0].reach === 30 && pl[0].color === "#ffd9a0", pl);
  /* 2.630.0: the House builder is gone - its ◯ Light tool checks went with it (the lights in housegeo.js stay) */

  /* ---- ⛶ maximize between the side dockers */
  const SF = require("../static/secfloat.js");
  check("maxSpan: no side columns = the whole width", JSON.stringify(SF.maxSpan(1800, [])) === JSON.stringify({ x: 0, w: 1800 }));
  check("…the left docker (0-300) + the Gallery (1500-1800) open = 300..1500", JSON.stringify(SF.maxSpan(1800, [{ l: 0, r: 300 }, { l: 1500, r: 1800 }])) === JSON.stringify({ x: 300, w: 1200 }));
  check("…Gallery + Queue + References on the right: the left-most of them bounds it", JSON.stringify(SF.maxSpan(1800, [{ l: 1600, r: 1800 }, { l: 1400, r: 1600 }, { l: 1250, r: 1400 }])) === JSON.stringify({ x: 0, w: 1250 }));
  check("…so many columns that under 320 px is left = the whole width (never a sliver)", JSON.stringify(SF.maxSpan(900, [{ l: 0, r: 400 }, { l: 600, r: 900 }])) === JSON.stringify({ x: 0, w: 900 }));
  const sf = read("static", "secfloat.js");
  check("maximize uses the open columns (ldock, refsdock, assetsdock, qdock, rdock - not floated, not hidden, not its own)", /\["ldock", "refsdock", "assetsdock", "qdock", "rdock"\]/.test(sf) && /maxSpan\(window\.innerWidth, sideCols\(w\.el, H\)\)/.test(sf));

  /* ---- the checklist */
  const tp = JSON.parse(read("lib", "testPlan.json")), g = tp.groups.find((x) => x.id === "g538");
  check("lib/testPlan.json: 2.538.0, group g538 first (⤓ first / again / Shift, 📁, 🔄 Sync, ◯ light, ⛶ beside the side dockers)", /^2\.(5[3-9]\d|[6-9]\d\d)\.\d+$/.test(tp.version) && !!g && ["mf_first", "mf_again", "mf_shift", "mf_list", "mm_sync", "max_sides"].every((id) => g.items.some((i) => i.id === id)));
  /* 2.630.0: the House builder is gone - this check went with it */

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e.stack || e)); console.log("RESULT: FAIL"); process.exit(1); });
