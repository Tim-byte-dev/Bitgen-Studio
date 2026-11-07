#!/usr/bin/env node
/* bitGen Studio — 2.719.0: ARE THE RENDER'S MODELS IN A MODEL PATH? (lib/modelsFound.js, routes/modelsFound.js)
 * Tim: "check if models are in a model path before render - create a list of found models so it can be a quick check save
 * the list as /misc/models_found.json. if models are not found bring up a msgbox to download/cancel model names not found"
 *   the loaders read (API + UI export, core loaders only, bypassed nodes out), what an image / video / Wan render needs
 *   with the style's overrides, the matching, the catalogue's download, the list made from real folders + saved, the
 *   rescan when a name misses, a file deleted since, the "not checked" reasons, the route's plan for a real starter style,
 *   and the wiring (Generate image / video / music, 🧩 ⟳, the ignore lists). The message box: scripts/test-ui719-ui.js. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mf719-"));
process.env.BITGEN_MODELS_FOUND = path.join(tmp, "misc", "models_found.json");
const MF = require("../lib/modelsFound");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const rd = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const names = (rows) => rows.map((r) => r.name);

// ---- the loaders
const api = {
  "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "sdxl/juggernaut.safetensors" } },
  "10": { class_type: "UNETLoader", inputs: { unet_name: "flux\\klein.safetensors", weight_dtype: "default" } },
  "11": { class_type: "DualCLIPLoader", inputs: { clip_name1: "t5xxl.safetensors", clip_name2: "clip_l.safetensors", type: "flux" } },
  "12": { class_type: "VAELoader", inputs: { vae_name: "ae.safetensors" } },
  "13": { class_type: "VAELoader", inputs: { vae_name: "pixel_space" } },
  "14": { class_type: "LoraLoader", inputs: { lora_name: "detail.safetensors", model: ["10", 0], clip: ["11", 0] } },
  "15": { class_type: "Florence2ModelLoader", inputs: { model: "microsoft/Florence-2-large", model_name: "x.safetensors" } },
  "16": { class_type: "UpscaleModelLoader", inputs: { model_name: "4x_foolhardy.pth" } },
  "17": { class_type: "CLIPLoader", inputs: { clip_name: ["99", 0] } },
  "9": { class_type: "KSampler", inputs: { seed: 1 } },
};
const lf = MF.loaderFiles(api);
check("loaderFiles (API): core loaders' files in node order - checkpoint, unet, 2 text encoders, vae, lora, upscaler", JSON.stringify(names(lf)) === JSON.stringify(["sdxl/juggernaut.safetensors", "flux\\klein.safetensors", "t5xxl.safetensors", "clip_l.safetensors", "ae.safetensors", "detail.safetensors", "4x_foolhardy.pth"]), names(lf));
check("…each with its folder and role (te = clip_name1/2 of DualCLIPLoader)", lf[1].cat === "diffusion_models" && lf[1].role === "model" && lf[2].cat === "text_encoders" && lf[2].role === "te" && lf[2].key === "clip_name1" && lf[6].cat === "upscale_models", lf);
check("…a custom node's names (Florence2ModelLoader), a link, a non-file value (pixel_space) are not checked", !names(lf).includes("x.safetensors") && !names(lf).includes("pixel_space") && lf.length === 7);
const ui = { nodes: [
  { id: 3, type: "UNETLoader", mode: 0, widgets_values: ["wan2.2_high.safetensors", "fp8_e4m3fn"] },
  { id: 5, type: "LoraLoaderModelOnly", mode: 4, widgets_values: ["bypassed.safetensors", 1] },
  { id: 6, type: "CLIPLoader", mode: 0, widgets_values: ["umt5.safetensors", "wan", "default"] },
  { id: 7, type: "VAELoader", mode: 2, widgets_values: ["muted_vae.safetensors"] },
] };
check("loaderFiles (UI export): the widgets' file names; a bypassed (mode 4) and a muted (mode 2) node are left out", JSON.stringify(names(MF.loaderFiles(ui))) === JSON.stringify(["wan2.2_high.safetensors", "umt5.safetensors"]), MF.loaderFiles(ui));

// ---- what a render needs
let n = MF.needs(api, { model: "", vae: "", te: [], loras: [] }, "image");
check("image, no overrides: the workflow's files; its own LoRA node is not (the patcher fills / bypasses it)", names(n).length === 6 && !names(n).includes("detail.safetensors") && n.every((x) => x.from === "workflow"), n);
n = MF.needs(api, { model: "mine.safetensors", vae: "myvae.safetensors", te: ["", "my_clip_l.safetensors"], loras: [{ path: "style_lora.safetensors" }] }, "image", { extra_loras: [{ path: "temp.safetensors" }] });
check("image + the style's model / vae / te slot 2 / LoRAs + Basic Settings' LoRA: they replace what they replace (te slot 1 stays the workflow's)",
  JSON.stringify(names(n).sort()) === JSON.stringify(["4x_foolhardy.pth", "mine.safetensors", "my_clip_l.safetensors", "myvae.safetensors", "style_lora.safetensors", "t5xxl.safetensors", "temp.safetensors"].sort())
  && n.find((x) => x.name === "temp.safetensors").from === "basic" && n.find((x) => x.name === "mine.safetensors").cat === "checkpoints", n);
n = MF.needs(api, { model: "" }, "image", { model: "basic_ckpt.safetensors" });
check("image + Basic Settings' model: replaces the workflow's model loaders, marked basic", names(n).includes("basic_ckpt.safetensors") && !names(n).includes("sdxl/juggernaut.safetensors") && n.find((x) => x.name === "basic_ckpt.safetensors").from === "basic", n);
const vapi = { "1": { class_type: "UNETLoader", inputs: { unet_name: "minimax_h3.safetensors" } },
  "2": { class_type: "DualCLIPLoader", inputs: { clip_name1: "te1.safetensors", clip_name2: "te2.safetensors" } },
  "3": { class_type: "VAELoader", inputs: { vae_name: "h3_vae.safetensors" } },
  "4": { class_type: "LoraLoaderModelOnly", inputs: { lora_name: "turbo4.safetensors", model: ["1", 0] } } };
n = MF.needs(vapi, { phases: [{ model: "" }], te: [""], vae: "", loras: [] }, "video");
check("video, no overrides: model + both text encoders + vae; the workflow's LoRA (bypassed unless the 4-step LoRA is on) is not", JSON.stringify(names(n)) === JSON.stringify(["minimax_h3.safetensors", "te1.safetensors", "te2.safetensors", "h3_vae.safetensors"]), n);
n = MF.needs(vapi, { phases: [{ model: "h3_int8.safetensors" }], te: ["mine_te.safetensors"], vae: "", loras: [{ path: "look.safetensors" }] }, "video", { model: "h3_int8.safetensors" });
check("video + phase 1 model (Basic Settings), te[0] (replaces clip_name1 only - as worker.py), a LoRA",
  JSON.stringify(names(n).sort()) === JSON.stringify(["h3_int8.safetensors", "h3_vae.safetensors", "look.safetensors", "mine_te.safetensors", "te2.safetensors"].sort()) && n.find((x) => x.name === "h3_int8.safetensors").from === "basic", n);
n = MF.needs(vapi, { arch: "wan22", phases: [{ model: "wan_hi.safetensors" }, { model: "" }], te: [""], loras: [] }, "video", { auto: true });
check("Wan / LTX 2.3 (the worker picks the files): only the style's own names", JSON.stringify(names(n)) === JSON.stringify(["wan_hi.safetensors"]), n);
check("…a name given twice is checked once", MF.needs(null, { model: "a.safetensors", loras: [{ path: "A.safetensors" }] }, "image").length === 1);

// ---- matching + the catalogue
const list = { models: [{ name: "flux/klein.safetensors", cat: "diffusion_models" }, { name: "Loras/Detail.SAFETENSORS", cat: "loras" }] };
const ix = MF.index(list);
check("match: another separator / case is the same file", !!MF.match("flux\\Klein.safetensors", ix));
check("…the same file name in another subfolder counts as found (it is in a model path)", !!MF.match("other/detail.safetensors", ix) && !MF.match("nope.safetensors", ix));
const cat = JSON.parse(rd("lib/modelCatalog.json"));
const src = MF.sourceOf("subdir/turbo8_lora_step2500.safetensors", cat);
check("sourceOf: the 📦 catalogue entry with that file name (Turbo8 LoRA -> qwen21_turbo8)", src && src.id === "qwen21_turbo8" && src.repo && src.size > 0, src);
check("…none for a file it does not have", MF.sourceOf("my_own_lora.safetensors", cat) === null);

// ---- the list from real folders
const comfy = path.join(tmp, "ComfyUI");
const put = (rel, bytes) => { const f = path.join(comfy, "models", rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, Buffer.alloc(bytes || 16)); return f; };
put("checkpoints/sdxl/juggernaut.safetensors", 64); put("diffusion_models/flux/klein.safetensors"); put("vae/ae.safetensors");
put("text_encoders/t5xxl.safetensors"); put("text_encoders/clip_l.safetensors"); put("upscale_models/4x_foolhardy.pth");
fs.writeFileSync(path.join(comfy, "models", "checkpoints", "notes.txt"), "not a model");
const extra = path.join(tmp, "shared");
fs.mkdirSync(path.join(extra, "loras"), { recursive: true }); fs.writeFileSync(path.join(extra, "loras", "shared_lora.safetensors"), "x");
fs.writeFileSync(path.join(comfy, "extra_model_paths.yaml"), `shared:\n  base_path: ${extra}\n  loras: loras\n`);
const T = { dir: comfy, extraPaths: "", remote: false, why: "" };
const realTarget = MF.target;
MF.target = () => T;
const L = MF.build();
check("build: every model file of models/<folder> + extra_model_paths.yaml (not notes.txt), saved as the list file",
  L.count === 7 && L.models.some((m) => m.name === "shared_lora.safetensors" && m.cat === "loras") && !L.models.some((m) => /notes/.test(m.name)) && fs.existsSync(process.env.BITGEN_MODELS_FOUND), L);
const saved = JSON.parse(fs.readFileSync(process.env.BITGEN_MODELS_FOUND, "utf8"));
check("…the file: {v, made, comfy_dir, yaml, roots, count, models [{name, cat, root, size}]}", saved.v === 1 && saved.comfy_dir === comfy && /extra_model_paths/.test(saved.yaml) && saved.count === 7 && saved.models[0].root && "size" in saved.models[0] && Array.isArray(saved.roots.loras), saved);
let r = MF.check(MF.needs(api, {}, "image"), { catalog: cat });
check("check: the workflow's six files are all found (quick - no rescan)", r.checked && r.needed === 6 && r.missing.length === 0 && !r.rescanned, r);
let builds = 0; const realBuild = MF.build; MF.build = (t) => { builds++; return realBuild(t); };
put("loras/added_later.safetensors");
r = MF.check([{ name: "added_later.safetensors", cat: "loras", from: "style" }], { catalog: cat });
check("a file added after the list was made: the miss rescans once and it is found (the list is updated)", r.missing.length === 0 && r.rescanned && builds === 1 && JSON.parse(fs.readFileSync(process.env.BITGEN_MODELS_FOUND, "utf8")).count === 8, r);
fs.unlinkSync(path.join(comfy, "models", "vae", "ae.safetensors"));
r = MF.check([{ name: "ae.safetensors", cat: "vae", from: "workflow" }, { name: "turbo8_lora_step2500.safetensors", cat: "loras", from: "style" }], { catalog: cat });
check("a file deleted since + one never there: both missing, each with its folder and its catalogue download (FLUX ae, Turbo8)",
  r.missing.length === 2 && r.missing[0].folder === "models/vae" && r.missing[0].source && r.missing[0].source.id === "flux_ae" && r.missing[1].source && r.missing[1].source.id === "qwen21_turbo8", r);
MF.build = realBuild;
T.why = "no ComfyUI folder is set (Settings ▸ ComfyUI ▸ Folder)";
r = MF.check([{ name: "x.safetensors", cat: "loras" }]);
check("no model paths here (no folder / a ComfyUI on another computer): not checked, with why - the render is not stopped", r.checked === false && /ComfyUI/.test(r.why) && r.missing.length === 0, r);
T.why = "";
MF.target = realTarget;

// ---- the route's plan for a real starter style
const R = require("../routes/modelsFound");
const C = require("../lib/core"), styles = require("../lib/styles");
const t8 = styles.read(C.STYLES_DIR, "image").find((s) => s.name === "Qwen Image 2.1 edit Turbo8");
if (t8) {
  const p = R.plan({ kind: "image", style_id: t8.id });
  const wfNames = names(MF.loaderFiles(JSON.parse(rd(t8.workflow)))).filter((x) => !/lora/i.test(x));
  check("the route's plan (Qwen Image 2.1 edit Turbo8): its workflow's model files + its Turbo8 LoRA", p.rows && wfNames.every((w) => names(p.rows).includes(w)) && names(p.rows).includes("turbo8_lora_step2500.safetensors"), p);
} else check("a starter style to plan (Qwen Image 2.1 edit Turbo8)", false, styles.read(C.STYLES_DIR, "image").map((s) => s.name));
check("…a style that is not there: not checked (the render says why)", R.plan({ kind: "image", style_id: "nope" }).skip === "no style picked");
const ltx = styles.read(C.STYLES_DIR, "video").find((s) => require("../lib/ltx").isLtxStyle(s));
if (ltx) check("…an LTX style: not checked (it picks its files itself)", /LTX/.test(R.plan({ kind: "video", video_style_id: ltx.id }).skip || ""));
const h3 = styles.read(C.STYLES_DIR, "video").find((s) => s.arch === "minimax-h3");
if (h3) {
  const p = R.plan({ kind: "video", video_style_id: h3.id, mode: "ref2va", basic: JSON.stringify({ override: true, model: "my_h3.safetensors" }), extra_loras: [{ path: "tmp_lora.safetensors", weight: 1 }] });
  check("…a MiniMax H3 style + Basic Settings' Override model + a temporary LoRA: both in the plan, marked basic", p.rows && p.rows.some((x) => x.name === "my_h3.safetensors" && x.from === "basic") && p.rows.some((x) => x.name === "tmp_lora.safetensors" && x.from === "basic"), p);
}

// ---- the wiring
const idx = rd("static/index.html");
check("index.html loads static/modelsfound.js", /<script src="\/static\/modelsfound\.js"><\/script>/.test(idx));
const sec = (fn) => { const i = idx.indexOf(fn); return idx.slice(i, i + 2200); };
check("Generate image: the check runs before ComfyUI is started (kind image, the style, Basic Settings' model / LoRAs)", /H3ModelsFound\.ensure\(\{ kind: "image", style_id: id, model: ib\.model, extra_loras: ib\.extra_loras \}\)/.test(sec("async function startImageJob")) && sec("async function startImageJob").indexOf("H3ModelsFound.ensure") < sec("async function startImageJob").indexOf("ensureComfyReady"));
check("Generate video: the check runs first (kind video, the style, the mode, Basic Settings)", /kind: "video"/.test(sec("async function submitJob")) && sec("async function submitJob").indexOf("H3ModelsFound.ensure") < sec("async function submitJob").indexOf("ensureComfyReady"));
check("Generate music: the check runs first", /H3ModelsFound\.ensure\(\{ kind: "music", style_id: id \}\)/.test(sec("async function startMusicJob")));
check("🧩 ⟳ makes the list again", /H3ModelsFound\.refresh\(\)/.test(rd("static/modelmgr.js")));
check("routes/index.js mounts routes/modelsFound.js (server.js untouched)", /require\("\.\/modelsFound"\)\.mount\(app\)/.test(rd("routes/index.js")) && !/modelsFound/.test(rd("misc/server.js")));
check("the list is this machine's: .gitignore + make_zips.sh leave misc/models_found.json out", /^models_found\.json$/m.test(rd(".gitignore")) && /! -name "models_found\.json"/.test(rd("scripts/make_zips.sh")));
check("⬇ Download with no token sent uses the saved Hugging Face token (routes/setup.js)", /b\.token \|\| \(\(\(\(require\("\.\.\/lib\/core"\)\.getConfig\(\) \|\| \{\}\)\.hf\) \|\| \{\}\)\.token\)/.test(rd("routes/setup.js")));

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
