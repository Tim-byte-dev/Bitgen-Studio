#!/usr/bin/env node
/* bitGen Studio — 3.12.0: 🧩 MING LAYERED DESIGN in ComfyUI - Comfy-Org/Ming-Image's files (lib/modelCatalog.json group
 * "mingimage"), lib/mingAddon.js (the add-on "mingimage": status / install / remove / jobParams), routes/ming.js, the dialog
 * (ext/imageeditdock/pcming.js) and the wiring; 3.9.0's word legs (lib/mingLayers.js) kept. The worker + its graphs:
 * scripts/test-ming-31200.py; the dialog in a real browser: scripts/test-ui3900-ui.js.
 * Tim: "replace our ming image with this one, https://huggingface.co/Comfy-Org/Ming-Image" */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const ML = require(path.join(ROOT, "lib/mingLayers.js"));
const PM = require(path.join(ROOT, "ext/imageeditdock/pcming.js"));

(async () => {
  /* ---------------- the words both models read */
  const rows = [{ name: "Title", desc: 'The words "SUMMER SALE" in bold #FFFFFF letters', where: "top" }, { name: "Shoe", desc: "A red running shoe, three-quarter view, #D62828", where: "centre" },
    { name: "", desc: "" }, { name: "Background", desc: "Sunny beach gradient", where: "nowhere" }];
  const C = ML.clean(rows);
  check("clean: empty rows dropped, an unknown place = the whole canvas, front first kept", C.length === 3 && C[0].name === "Title" && C[2].where === "all" && C[1].where === "centre", C);
  check("clean: a name or a description alone is enough (the other filled from it); 12 at most", ML.clean([{ desc: "only words" }])[0].name === "Layer 1" && ML.clean([{ name: "Logo" }])[0].desc === "Logo" && ML.clean(Array.from({ length: 20 }, (_, i) => ({ name: "L" + i }))).length === 12);
  const J = JSON.parse(ML.t2iPrompt(rows, { w: 1536, h: 1024, style: "flat poster", lighting: "" }));
  check("0.2-Design's prompt: exactly canvas_settings + layers (its schema)", JSON.stringify(Object.keys(J)) === '["canvas_settings","layers"]' && JSON.stringify(Object.keys(J.canvas_settings)) === '["aspect_ratio","ambient_lighting","image_style"]', Object.keys(J));
  check("…its layers from the BACKGROUND up (the list is front first)", J.layers.length === 3 && /^Background:/.test(J.layers[0].description) && /^Title:/.test(J.layers[2].description), J.layers.map((l) => l.description));
  check("…each with the four fields, coordinates as Ming's string", J.layers.every((l) => JSON.stringify(Object.keys(l)) === '["description","coordinates","hierarchy_and_relation","color_specs"]') && J.layers[2].coordinates === "cx: 0.500, cy: 0.200, w: 1.000, h: 0.400" && J.layers[0].coordinates === "cx: 0.500, cy: 0.500, w: 1.000, h: 1.000", J.layers.map((l) => l.coordinates));
  check("…the order said in words; the colours written as #hex picked up", /background/i.test(J.layers[0].hierarchy_and_relation) && /front-most/.test(J.layers[2].hierarchy_and_relation) && JSON.stringify(J.layers[2].color_specs) === '["#FFFFFF"]' && JSON.stringify(J.layers[1].color_specs) === '["#D62828"]', J.layers.map((l) => [l.hierarchy_and_relation, l.color_specs]));
  check("…the quoted words kept verbatim, the canvas 3:2 1536 × 1024, your style; a lighting line when none is given", J.layers[2].description.includes('"SUMMER SALE"') && J.canvas_settings.aspect_ratio === "3:2, 1536 × 1024 px" && J.canvas_settings.image_style === "flat poster" && J.canvas_settings.ambient_lighting.length > 10, J.canvas_settings);
  const P = ML.layerPlan(rows);
  check("0.1-Design-Layer's plan: the count line both ways + Layer 1 the front, the last the background (its own format)", /^Decompose this image into 3 layers with the following specifications:/.test(P) && /\nNumber of layers: 3\n/.test(P) && /\nLayer 1: Title - The words "SUMMER SALE"/.test(P) && /\nLayer 3: Background - Sunny beach gradient \(the background\)$/.test(P), P);
  const s1 = ML.sizeFor(1920, 1080, 1024), s2 = ML.sizeFor(1000, 1000, 2048), s3 = ML.sizeFor(5000, 100, 1024);
  check("sizeFor: the canvas's shape at ~1 MP / ~4 MP, 16-px steps, held to 1:4 .. 4:1", s1.w % 16 === 0 && s1.h % 16 === 0 && Math.abs(s1.w / s1.h - 16 / 9) < 0.02 && Math.abs(s1.w * s1.h / 1048576 - 1) < 0.03 && s2.w === 2048 && s2.h === 2048 && s3.w / s3.h === 4, [s1, s2, s3]);
  check("stem: a safe file name", ML.stem("Summer sale / 2026!") === "Summer_sale_2026" && ML.stem("") === "design");

  /* ---------------- Comfy-Org's files in the model list */
  const SM = require(path.join(ROOT, "lib/setupModels.js")), CAT = JSON.parse(read("lib/modelCatalog.json"));
  const mi = CAT.models.filter((m) => m.group === "mingimage");
  check("the catalog: 9 Comfy-Org/Ming-Image files (3.13.2: + 0.2 Design, waiting for its encoder) into ComfyUI's diffusion_models / text_encoders / vae, a group for them",
    mi.length === 9 && mi.every((m) => m.repo === "Comfy-Org/Ming-Image" && m.as === m.file.split("/").pop() && m.dest === "comfy/" + m.file.split("/")[0] && m.size > 0) && CAT.groups.some((g) => g.id === "mingimage"), mi.map((m) => m.file));
  check("…3.13.2: the files that ARE in Comfy-Org's repo - 0.1 Design + its own text encoder (no 0.2 encoder there), the VAE, the Design-Layer ones; never the missing 0.2 encoder",
    !mi.some((m) => /0\.2_ling/.test(m.file)) && ["diffusion_models/ming_image_0.1_design_int8_convrot.safetensors", "text_encoders/ming_image_0.1_ling_mini_2.0_int8_convrot.safetensors", "vae/ming_image_vae_bf16.safetensors",
      "diffusion_models/ming_image_0.1_design_layer_int8_convrot.safetensors", "text_encoders/ming_image_0.1_ling_mini_2.0_layer_int8_convrot.safetensors"].every((f) => mi.some((m) => m.file === f)));

  /* ---------------- the add-on */
  const A = require(path.join(ROOT, "lib/mingAddon.js"));
  const comfy = fs.mkdtempSync(path.join(os.tmpdir(), "mingc-")), models = path.join(comfy, "models");
  const pl = { ok: true, models, customNodes: path.join(comfy, "custom_nodes") };
  const put = (id) => { const m = SM.byId(id), f = SM.destPath(m, { comfyModels: models, app: comfy }); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, "x"); return f; };
  check("the Download box ticks: design + layer (int8) ticked, the bf16 sets not; sizes shown", JSON.stringify(A.status(pl).items.map((i) => [i.id, i.dflt, i.present])) === '[["design",true,false],["layer",true,false],["design_bf16",false,false],["layer_bf16",false,false]]'
    && A.status(pl).items.every((i) => /GB/.test(i.size)), A.status(pl).items);
  check("nothing downloaded: not installed, both missing; ComfyUI's folder unknown here = nothing to say missing (the worker asks ComfyUI)",
    !A.status(pl).installed && A.missing(pl).length === 2 && /not installed/.test(A.status(pl).note) && A.missing({ ok: false, models: "" }).length === 0 && /ComfyUI not found/.test(A.status({ ok: false, error: "nope", models: "" }).note));
  const got = [];
  const r = await A.install(() => {}, ["layer"], { place: pl, download: async (m) => { got.push(m.id); put(m.id); return { ok: true }; }, comfy: async () => ({ online: true, nodes: true }) });
  check("install: only the ticked set (Design-Layer int8 + its text encoder + the VAE)", r.ok && got.join() === "mingimage_layer_int8,mingimage_layer_te_int8,mingimage_vae", { r, got });
  check("…ready: splits pictures; the note says to tick the other", A.ready(pl) && A.haveWeights(pl).layer && !A.haveWeights(pl).gen && /splits pictures into layers/.test(A.status(pl).note) && /Tick the other/.test(A.status(pl).note), A.status(pl).note);
  const logs = [];
  await A.install((l) => logs.push(l), ["design", "design_bf16"], { place: pl, download: async (m) => { put(m.id); return { ok: true, skipped: m.id === "mingimage_vae" }; }, comfy: async () => ({ online: true, nodes: false }) });
  check("…a shared file is fetched once; a ComfyUI without the Ming nodes -> how to update", logs.filter((l) => /ming_image_vae_bf16/.test(l) && /^\[ok\]/.test(l)).length === 1 && logs.some((l) => /no Ming-Image nodes yet/.test(l) && /0\.46\.0/.test(l)), logs);
  check("install refuses without ComfyUI's folder, and with nothing ticked that exists", /ComfyUI not found/.test((await A.install(() => {}, [], { place: { ok: false, error: "x" } })).error) && /tick/.test((await A.install(() => {}, ["nope"], { place: pl })).error));
  check("comfySupport: asks ComfyUI for TextEncodeMingImageEdit", (await A.comfySupport({ url: "http://x", fetch: async (u) => ({ ok: true, json: async () => (/TextEncodeMingImageEdit$/.test(u) ? { TextEncodeMingImageEdit: {} } : {}) }) })).nodes === true
    && (await A.comfySupport({ url: "http://x", fetch: async () => ({ ok: true, json: async () => ({}) }) })).nodes === false && (await A.comfySupport({ url: "", fetch: null })).online === false);

  /* ---------------- the job */
  const jrows = [{ name: "Title", desc: 'The words "SUMMER SALE"', where: "top" }, { name: "Shoe", desc: "A red running shoe", where: "centre" }, { name: "Background", desc: "Sunny beach", where: "all" }];
  const j1 = A.jobParams({ rows: jrows, engine: "comfy", w: 1920, h: 1080, place: pl });
  check("a design + layers in ComfyUI: bf16 for the design (its bf16 set is there), int8 for the layers; no venv / python in the params", j1.params && j1.params.engine === "comfy" && j1.params.generate && j1.params.split
    && JSON.stringify(j1.params.precision) === '{"design":"bf16","layer":"int8"}' && !j1.params.ming && !/python|venv/.test(JSON.stringify(j1.params)), j1);
  check("3.9.0's engine \"local\" is ComfyUI now", A.jobParams({ rows: jrows, engine: "local", place: pl }).params.engine === "comfy");
  const empty = { ok: true, models: fs.mkdtempSync(path.join(os.tmpdir(), "mingc2-")) };
  const j4 = A.jobParams({ rows: jrows, engine: "comfy", place: empty });
  check("its files not downloaded -> 409 with what is missing (the Download box) and OpenRouter named", j4.status === 409 && j4.missing.map((m) => m.id).join() === "design,layer" && /OpenRouter/.test(j4.error), j4);
  check("a ComfyUI elsewhere (its folder not known here): the job goes - the worker asks ComfyUI what it lists", !!A.jobParams({ rows: jrows, engine: "comfy", place: { ok: false, models: "" } }).params);
  const pic = path.join(comfy, "in.png"); fs.writeFileSync(pic, "png");
  const sp = A.jobParams({ rows: jrows, engine: "comfy", input: pic, w: 800, h: 600, layer_res: 512, place: pl });
  check("splitting the open picture: no design step, the plan, 512, the picture's shape for the split", sp.params && !sp.params.generate && sp.params.split && sp.params.input === pic && sp.params.t2i_prompt === null
    && /Number of layers: 3/.test(sp.params.layer_plan) && sp.params.layer_res === 512 && sp.params.input_w === 800 && sp.params.input_h === 600, sp);
  check("no rows / one layer to split -> refused in words", /add at least one layer/.test(A.jobParams({ rows: [], place: pl }).error) && /at least two layers/.test(A.jobParams({ rows: [jrows[0]], input: pic, place: pl }).error));
  check("☁ OpenRouter: unchanged - your key needed, the key NOT in the params", /API key/.test(A.jobParams({ rows: jrows, engine: "openrouter" }).error)
    && (() => { const o = A.jobParams({ rows: jrows, engine: "openrouter", orKey: "sk-or-x" }); return o.params.engine === "openrouter" && o.params.ming.layer === "inclusionai/ming-image-0.1-design-layer" && !JSON.stringify(o.params).includes("sk-or-x") && !o.params.precision; })());

  /* ---------------- remove: the files and 3.9.0's folder */
  const app = fs.mkdtempSync(path.join(os.tmpdir(), "minga-")); process.env.BITGEN_ADDON_BASE = app;
  fs.mkdirSync(path.join(app, "ming_image", ".venv"), { recursive: true }); fs.writeFileSync(path.join(app, "ming_image", "x.ok"), "1");
  check("3.9.0's install is named as not used any more", /not used any more - Remove deletes it/.test(A.status(pl).note), A.status(pl).note);
  const rl = []; const rr = await A.remove((l) => rl.push(l), pl);
  check("remove: every Ming-Image file and 3.9.0's ming_image folder gone", rr.ok && !fs.existsSync(path.join(app, "ming_image")) && !A.ready(pl) && rl.some((l) => /file\(s\) removed/.test(l)), rl);
  delete process.env.BITGEN_ADDON_BASE;
  /* ---------------- the dialog's pure parts */
  check("pcming check: a list, 12 at most, splitting needs a picture and two layers", PM.check({ rows: [] }) !== "" && PM.check({ rows: PM.DEFAULT_ROWS, mode: "make" }) === "" && /two layers/.test(PM.check({ rows: [{ name: "a" }], mode: "split", hasPicture: true })) && /open a picture/.test(PM.check({ rows: PM.DEFAULT_ROWS, mode: "split", hasPicture: false })));
  const so = PM.sortOutputs(["Title_ming.png", "Title_ming_L03_Background.png", "Title_ming_L01_Title.png", "Title_ming_L02_Shoe.png"]);
  check("pcming sortOutputs: the design + the layers front first", so.flat === "Title_ming.png" && so.layers.join() === "Title_ming_L01_Title.png,Title_ming_L02_Shoe.png,Title_ming_L03_Background.png", so);

  /* ---------------- the wiring */
  const core = read("lib/core.js"), idx = read("routes/index.js"), rt = read("routes/ming.js"), wk = read("misc/ming_worker.py"), ui = read("ext/imageeditdock/pcming.js");
  const EJ = JSON.parse(read("ext/imageeditdock/ext.json")).scripts;
  check("mode ming -> misc/ming_worker.py; the route mounted from routes/index.js (server.js untouched)", /ming: "ming_worker\.py"/.test(core) && /require\("\.\/ming"\)\.mount\(app\)/.test(idx) && !/ming/i.test(read("misc/server.js")));
  const L = require(path.join(ROOT, "lib/addons.js")).LIST;
  check("Settings ▸ Add-ons: 🧩 Ming layered design is \"mingimage\" (ticks passed to its install); \"ming\" is Ming-3.0 TTS's again (one entry each)",
    (() => { const a = L.find((x) => x.id === "mingimage"), t = L.filter((x) => x.id === "ming"); return !!a && /picks/.test(a.install.toString()) && a.links().length === 2 && t.length === 1 && /TTS/.test(t[0].label) && /GB/.test(a.size); })());
  check("add-on ids are unique", new Set(L.map((x) => x.id)).size === L.length, L.map((x) => x.id).filter((id, i, a) => a.indexOf(id) !== i));
  check("the route: 409 needs mingimage; GET says comfy (+ local for an old page); no card-spread option", /needs: jp\.status === 409 \? A\.ID/.test(rt) && /comfy: here, local: here/.test(rt) && !/gpus/.test(rt.split("function mount")[1]));
  check("the worker: ComfyUI's own nodes (scripts/ming_graph.py), no infer.py / venv any more; OpenRouter by /images", /ming_graph as mg/.test(wk) && /cp\.run\(cc, base, graph, say, tag\)/.test(wk) && !/infer\.py|--device-map|HF_HUB_OFFLINE/.test(wk.replace(/^"""[\s\S]*?"""/, "")) && /base \+ "\/images"/.test(wk));
  check("the editor: Layer ▸ 🧩 Ming Layered Design…, ＋ Add layer rows, ComfyUI or ☁ OpenRouter, the 409 opens \"mingimage\"'s Download box", /"layer\.ming", "🧩 Ming Layered Design…"/.test(ui) && /＋ Add layer/.test(ui) && /value="comfy"/.test(ui) && /value="openrouter"/.test(ui) && /A\.act\(ADDON, "install"\)/.test(ui) && PM.ADDON === "mingimage" && !/pmGpus/.test(ui));
  check("pcming.js loads before the editor installs it", EJ.includes("pcming.js") && EJ.indexOf("pcming.js") < EJ.indexOf("imageedit.js") && /win\.PCMing\.install\(E\)/.test(read("ext/imageeditdock/imageedit.js")));
  console.log("\n" + pass + " passed, " + fail + " failed");
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: threw " + (e && e.stack || e)); console.log("RESULT: 1 failed"); process.exit(1); });
