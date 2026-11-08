// bitGen Studio — lib/modelsFound.js (2.719.0): ARE THE RENDER'S MODELS IN A MODEL PATH? - checked before it starts.
//
// Tim (verbatim): "check if models are in a model path before render - create a list of found models so it can be a quick
// check save the list as /misc/models_found.json. if models are not found bring up a msgbox to download/cancel model names
// not found"
//
//   THE LIST    misc/models_found.json {v, made, comfy_dir, yaml, roots, count, models: [{name, cat, root, size}]} - every
//               model file in ComfyUI's model paths (models/<folder> + extra_model_paths.yaml, lib/comfyModels.scan: the
//               folders, so it answers before ComfyUI is started). Made when there is none, when the ComfyUI folder changed,
//               on 🧩 ⟳, and again whenever a check misses a name (the file may have been added since) - one rescan, then
//               the verdict. A name found is also stat-ed: a file deleted since the list was made is not "found".
//   WHAT A RENDER NEEDS   needs(graph, style, kind) - the model files of the workflow's ComfyUI loaders (CORE loaders only:
//               a custom node's own names - a repo id, a file it downloads itself - are its business), with the style's
//               overrides in place of what they replace, exactly as the workers do:
//                 image / music (scripts/comfy_image.py)  model -> every model loader, vae -> every vae_name, te[i] ->
//                                                         the i-th text-encoder input (by node id, then key); the workflow's
//                                                         own LoRA nodes are filled / bypassed - only the style's LoRAs
//                 video (misc/worker.py apply_video_style)  a phase's model -> the model loaders, te[0] -> clip_name /
//                                                         clip_name1, vae -> every vae_name; the workflow's LoRA nodes are
//                                                         bypassed - only the style's (+ Basic Settings') LoRAs
//                 Wan / LTX 2.3 (the worker picks its files by family)  only the style's own names
//   MATCHING    a name is found when the list has it by its name (any separator / case) or by its file name in any
//               folder - "is the file in a model path", not "is it in the right folder" (the existing preflight and
//               ComfyUI's own check say that, with their advice)
//   DOWNLOAD    sourceOf(name): the 📦 model catalogue's entry with that file name (lib/modelCatalog.json) - the dialog's
//               ⬇ Download runs it through Settings ▸ Models' downloader (POST /api/setup/download)
//   NOT CHECKED (ok, with why) no ComfyUI folder here, a ComfyUI on another computer (Remote GPU), an sd-cli style
// Pure: needs, loaderFiles, match, sourceOf (scripts/test-modelsfound719.js). routes/modelsFound.js serves it.
"use strict";
const fs = require("fs");
const path = require("path");

const V = 1;
// ComfyUI's core loaders (+ ComfyUI-GGUF's and KJNodes' model loader) -> {input key: models folder}
const TE = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [n === 1 ? "clip_name" : "clip_name" + (i + 1), "text_encoders"]));
const LOADERS = {
  CheckpointLoaderSimple: { ckpt_name: "checkpoints" }, CheckpointLoader: { ckpt_name: "checkpoints" },
  ImageOnlyCheckpointLoader: { ckpt_name: "checkpoints" }, unCLIPCheckpointLoader: { ckpt_name: "checkpoints" },
  UNETLoader: { unet_name: "diffusion_models" }, UnetLoaderGGUF: { unet_name: "diffusion_models" },
  UnetLoaderGGUFAdvanced: { unet_name: "diffusion_models" }, DiffusionModelLoaderKJ: { model_name: "diffusion_models" },
  VAELoader: { vae_name: "vae" },
  CLIPLoader: TE(1), DualCLIPLoader: TE(2), TripleCLIPLoader: TE(3), QuadrupleCLIPLoader: TE(4),
  CLIPLoaderGGUF: TE(1), DualCLIPLoaderGGUF: TE(2), TripleCLIPLoaderGGUF: TE(3), QuadrupleCLIPLoaderGGUF: TE(4),
  LoraLoader: { lora_name: "loras" }, LoraLoaderModelOnly: { lora_name: "loras" },
  CLIPVisionLoader: { clip_name: "clip_vision" },
  ControlNetLoader: { control_net_name: "controlnet" }, DiffControlNetLoader: { control_net_name: "controlnet" },
  UpscaleModelLoader: { model_name: "upscale_models" }, StyleModelLoader: { style_model_name: "style_models" },
};
const ROLE = { checkpoints: "model", diffusion_models: "model", vae: "vae", text_encoders: "te", loras: "lora" };
const EXT = /\.(safetensors|gguf|ckpt|pt|pt2|pth|bin|sft|pkl|onnx)$/i;
const FOLDER_LABEL = { checkpoints: "models/checkpoints", diffusion_models: "models/diffusion_models", vae: "models/vae",
  text_encoders: "models/text_encoders", loras: "models/loras", clip_vision: "models/clip_vision", controlnet: "models/controlnet",
  upscale_models: "models/upscale_models", style_models: "models/style_models" };

const norm = (s) => String(s || "").trim().replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
const base = (s) => norm(s).split("/").pop();
const isLink = (v) => Array.isArray(v) && v.length === 2 && Number.isInteger(Number(v[1]));
const idNum = (id) => (/^\d+$/.test(String(id)) ? parseInt(id, 10) : 1 << 30);

/** the model files a workflow's loaders name: [{node, cls, key, name, cat, role}] (API prompt or UI export; a UI export's
 *  bypassed / muted nodes are left out - they never load) */
function loaderFiles(g) {
  const out = [];
  if (!g || typeof g !== "object") return out;
  if (Array.isArray(g.nodes)) {
    for (const n of g.nodes) {
      const keys = n && LOADERS[String(n.type || "")];
      if (!keys || n.mode === 2 || n.mode === 4) continue;
      const cats = Object.values(keys), names = Object.keys(keys);
      const vals = (Array.isArray(n.widgets_values) ? n.widgets_values : []).filter((x) => typeof x === "string" && EXT.test(x));
      vals.slice(0, names.length).forEach((v, i) => out.push({ node: String(n.id), cls: String(n.type), key: names[i], name: v, cat: cats[i], role: ROLE[cats[i]] || "other" }));
    }
  } else {
    for (const [id, n] of Object.entries(g)) {
      const keys = n && LOADERS[String(n.class_type || "")];
      if (!keys) continue;
      const ins = n.inputs || {};
      for (const [k, cat] of Object.entries(keys)) {
        const v = ins[k];
        if (typeof v !== "string" || isLink(v) || !EXT.test(v)) continue;
        out.push({ node: String(id), cls: String(n.class_type), key: k, name: v, cat, role: ROLE[cat] || "other" });
      }
    }
  }
  return out.sort((a, b) => idNum(a.node) - idNum(b.node) || (a.node < b.node ? -1 : a.node > b.node ? 1 : 0) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** What a render needs: [{name, cat, from}] - from "workflow" / "style" / "basic" (unique by name).
 *  kind image | music | video; o = {auto: the worker picks the files itself (Wan, LTX 2.3), model: Basic Settings' model} */
function needs(graph, style, kind, o) {
  const opt = o || {};
  const st = style || {};
  const s = (v) => String(v == null ? "" : v).trim();
  const out = [];
  const add = (name, cat, from) => { if (s(name) && EXT.test(s(name))) out.push({ name: s(name), cat, from }); };
  const wf = opt.auto ? [] : loaderFiles(graph);
  const te = Array.isArray(st.te) ? st.te.map(s) : [];
  const basic = new Set([opt.model].concat((Array.isArray(opt.extra_loras) ? opt.extra_loras : []).map((l) => (l || {}).path)).filter(Boolean).map(norm));
  const from = (n) => (basic.has(norm(n)) ? "basic" : "style");
  const modelCat = (wf.find((f) => f.role === "model") || {}).cat;
  if (kind === "video") {
    const phases = (Array.isArray(st.phases) ? st.phases : []).map((p) => s((p || {}).model));
    const anyModel = phases.some(Boolean);
    for (const f of wf) {
      if (f.role === "lora") continue;                                      // bypassed unless the 4-step LoRA is on
      if (f.role === "model" && anyModel) continue;                         // the phases' models replace them
      if (f.role === "vae" && s(st.vae)) continue;
      if (f.role === "te" && te[0] && (f.key === "clip_name" || f.key === "clip_name1")) continue;
      add(f.name, f.cat, "workflow");
    }
    phases.forEach((m) => add(m, modelCat || "diffusion_models", from(m)));
  } else {
    const model = s(opt.model) || s(st.model);
    const teSlots = wf.filter((f) => f.role === "te");
    for (const f of wf) {
      if (f.role === "lora") continue;                                      // filled from the style / bypassed
      if (f.role === "model" && model) continue;
      if (f.role === "vae" && s(st.vae)) continue;
      if (f.role === "te" && te[teSlots.indexOf(f)]) continue;
      add(f.name, f.cat, "workflow");
    }
    add(model, modelCat || "checkpoints", from(model));
  }
  add(st.vae, "vae", "style");
  (kind === "video" ? te.slice(0, 1) : te).forEach((t) => add(t, "text_encoders", "style"));
  for (const l of (Array.isArray(st.loras) ? st.loras : []).concat(Array.isArray(opt.extra_loras) ? opt.extra_loras : [])) add((l || {}).path, "loras", from((l || {}).path));
  const seen = new Set();
  return out.filter((x) => { const k = norm(x.name); if (seen.has(k)) return false; seen.add(k); return true; });
}

/** index of a found list: {names: Map(norm name -> entry), bases: Map(file name -> [entries])} */
function index(list) {
  const names = new Map(), bases = new Map();
  for (const m of ((list && list.models) || [])) {
    names.set(norm(m.name), m);
    const b = base(m.name);
    if (!bases.has(b)) bases.set(b, []);
    bases.get(b).push(m);
  }
  return { names, bases };
}
/** the found entry for a name, or null (pure - no disk) */
function match(name, idx) {
  const i = idx && idx.names ? idx : index(idx);
  return i.names.get(norm(name)) || ((i.bases.get(base(name)) || [])[0]) || null;
}

/** the 📦 catalogue entry that downloads this file: {id, label, size, repo, dest} or null */
// 2.724.1 (Tim's box: "yue2_convrot_int8.safetensors ... Not in bitGen's download list"): an entry saved under another name
// ("as" - lib/setupModels.js writes m.as || basename(m.file)) is found by THAT name - the one the workflows load (YuE2's
// checkpoint, the H3 latent upscaler, the xinsir SDXL ControlNets, the FLUX inpaint ControlNet, the Klein outpaint LoRA)
const savedAs = (m) => base(m.as || m.file);
function sourceOf(name, catalog) {
  const b = base(name);
  if (!b) return null;
  const m = ((catalog && catalog.models) || []).find((x) => x && x.file && savedAs(x) === b && x.dest !== "hf-cache");
  return m ? { id: m.id, label: m.label || m.id, size: m.size || 0, repo: m.repo, dest: m.dest || "" } : null;
}

/* ---------------- the list on disk */
function core() { return require("./core"); }
function file() { return process.env.BITGEN_MODELS_FOUND || path.join(core().BASE, "misc", "models_found.json"); }   // the env: tests

/** where the model paths are: {dir, extraPaths, remote, why} */
function target() {
  const cfg = core().getConfig() || {};
  const c = (cfg.engine || {}).comfy || {};
  let url = String(c.url || "http://127.0.0.1:8188");
  let host = "";
  try { host = new URL(url).hostname; } catch { host = ""; }
  const remote = !!host && !/^(127\.\d+\.\d+\.\d+|localhost|0\.0\.0\.0|::1|\[::1\])$/i.test(host);
  let t = { dirAbs: "", extraPaths: "" };
  try { t = require("./comfyDetect").scanTarget(c); } catch { /* none */ }
  let exists = false;
  try { exists = !!t.dirAbs && fs.statSync(t.dirAbs).isDirectory(); } catch { exists = false; }
  const why = remote ? `ComfyUI runs on another computer (${host}) - its model paths are not on this one`
    : !t.dirAbs ? "no ComfyUI folder is set (Settings ▸ ComfyUI ▸ Folder)"
    : !exists ? `the ComfyUI folder does not exist: ${t.dirAbs}` : "";
  return { dir: t.dirAbs || "", extraPaths: t.extraPaths || "", remote, why };
}

/** scan the model paths and save the list -> the list */
function build(tgt) {
  const t = tgt || module.exports.target();
  const list = { v: V, made: new Date().toISOString(), comfy_dir: t.dir, yaml: null, roots: {}, count: 0, models: [], warnings: [] };
  if (t.why) { list.warnings.push(t.why); return save(list); }
  const sc = require("./comfyModels").scan(t.dir, { extraPaths: t.extraPaths });
  list.yaml = sc.yaml || null;
  list.warnings = (sc.warnings || []).slice(0, 20);
  for (const [cat, c] of Object.entries(sc.categories || {})) {
    list.roots[cat] = (c.roots || []).filter((r) => r.exists).map((r) => r.dir);
    for (const f of c.files || []) if (!f.dir) list.models.push({ name: f.name, cat, root: f.root, size: f.size || 0 });
  }
  list.count = list.models.length;
  return save(list);
}
function save(list) {
  try {
    const f = file();
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f + ".part", JSON.stringify(list, null, 1));
    fs.renameSync(f + ".part", f);
  } catch (e) { list.warnings = (list.warnings || []).concat(["could not save misc/models_found.json: " + (e.message || e)]); }
  return list;
}
/** the saved list (made when there is none or the ComfyUI folder changed) */
function read() {
  let list = null;
  try { list = JSON.parse(fs.readFileSync(file(), "utf8")); } catch { list = null; }
  const t = module.exports.target();
  if (!list || list.v !== V || !Array.isArray(list.models) || String(list.comfy_dir || "") !== t.dir) return module.exports.build();
  return list;
}
/** is the found entry still on disk? */
function onDisk(m) {
  if (!m || !m.root) return true;                                    // nothing to stat (a test list)
  try { return fs.statSync(path.join(m.root, m.name)).isFile(); } catch { return false; }
}

/** THE CHECK: needed [{name, cat, from}] -> {checked, why, missing: [{name, cat, folder, from, source}], found, list_made, rescanned} */
function check(needed, opts) {
  const o = opts || {};
  const t = o.target || module.exports.target();
  const want = (needed || []).filter((x) => x && x.name);
  if (t.why) return { checked: false, why: t.why, missing: [], found: 0, needed: want.length };
  const miss = (list) => { const idx = index(list); return want.filter((x) => { const m = match(x.name, idx); return !m || !onDisk(m); }); };
  let list = o.list || module.exports.read(), rescanned = false;
  let missing = miss(list);
  if (missing.length && !o.list) { list = module.exports.build(); rescanned = true; missing = miss(list); }
  const catalog = o.catalog || require("./setupModels").CATALOG;
  return { checked: true, why: "", needed: want.length, found: want.length - missing.length, list_made: list.made, rescanned,
    missing: missing.map((x) => ({ name: x.name, cat: x.cat, folder: FOLDER_LABEL[x.cat] || "models/" + x.cat, from: x.from, source: sourceOf(x.name, catalog) })) };
}

/* ---------------- 2.720.0: AFTER A FAILED RENDER
 * Tim: "if worker exits with code 1 , check for models if models are not found ask if user wants to dl models".
 * A render the check before it could not see through (a custom node's loader, a render the app started itself - a scene,
 * Swap, LTX, Wan's own picks) fails in ComfyUI. When its worker exits with an error, lib/core.js calls afterFail(job):
 *   the names ComfyUI refused (its "Value not in list [lora_name] = x" / "lora_name: 'x' not in (list of length n)" lines)
 *   + what the job's own style + workflow load (needs()), checked against the list (one rescan) -> job.models_missing
 *   {missing, at} (jobDict serves it) and a [models] line in the job's log. The app (static/modelsfound.js watchJobs)
 *   asks: ⬇ Download / Cancel. A name ComfyUI refused that IS on disk is not "missing" - ComfyUI has not re-read its
 *   folders (the worker's own advice says so). */
const KEY_CAT = { unet_name: "diffusion_models", ckpt_name: "checkpoints", vae_name: "vae", lora_name: "loras", t5_name: "text_encoders",
  control_net_name: "controlnet", style_model_name: "style_models" };
const catOfKey = (k) => KEY_CAT[k] || (/^clip_name\d?$/.test(k) ? "text_encoders" : /^model_name$/.test(k) ? "diffusion_models" : "other");
/** the model files ComfyUI refused, from a job's log lines -> [{name, cat, from: "comfyui"}] (pure) */
function namesFromLog(lines) {
  const out = [], seen = new Set();
  const add = (k, v) => {
    const n = String(v || "").trim().replace(/^['"]|['"]$/g, "");
    if (!n || !EXT.test(n) || seen.has(norm(n))) return;
    seen.add(norm(n)); out.push({ name: n, cat: catOfKey(k), from: "comfyui" });
  };
  for (const raw of (Array.isArray(lines) ? lines : String(lines || "").split("\n"))) {
    for (const line of String(raw).split("\n")) {
      let m = /Value not in list\s*\[(\w+)\]\s*=\s*(.+?)\s*$/.exec(line);
      if (m) { add(m[1], m[2]); continue; }
      m = /\b(\w+_name\d?):\s*'([^']+)'\s+not in\s+[(\[]/.exec(line);
      if (m) add(m[1], m[2]);
    }
  }
  return out;
}
/** what a job loads: the names ComfyUI refused + its style's / workflow's files -> rows for check() */
function jobNeeds(job) {
  const p = (job && job.params) || {};
  const rows = namesFromLog(job && job.log);
  const read = (rel) => {
    const r = String(rel || "").trim();
    if (!r) return null;
    try { return JSON.parse(fs.readFileSync(path.isAbsolute(r) ? r : path.join(core().BASE, r), "utf8")); } catch { return null; }
  };
  try {
    if (p.style && typeof p.style === "object") {
      const st = p.style;
      rows.push(...needs(read(p.workflow || st.workflow), st, st.kind === "music" || p.mode === "music" ? "music" : "image", {}));
    } else if (p.video_style && typeof p.video_style === "object") {
      const st = p.video_style;
      const auto = /^wan/i.test(String(st.arch || "")) || st.arch === "ltx-2.3";
      let g = null;
      if (!auto) { const w = require("./styleModels").workflowFor(st, p.mode || "ref2va", core().BASE, core().getConfig()); g = w ? read(w.abs) : null; }
      rows.push(...needs(g, st, "video", { auto, extra_loras: p.extra_loras }));
    }
  } catch { /* the log's names still count */ }
  const seen = new Set();
  return rows.filter((x) => { const k = norm(x.name); if (seen.has(k)) return false; seen.add(k); return true; });
}
/** a job's worker exited with an error: are its model files missing? -> job.models_missing (or nothing); never throws */
function afterFail(job, say) {
  try {
    if (!job || job.status !== "failed") return null;
    if (job.remote || job.farm) return null;                 // rendered on another member's PC - its folders, not ours
    const rows = jobNeeds(job);
    if (!rows.length) return null;
    const r = module.exports.check(rows);
    if (!r.checked || !r.missing.length) return null;
    job.models_missing = { at: Date.now() / 1000, missing: r.missing };
    if (say) say(`[models] ${r.missing.length} model file(s) it needs are not in ComfyUI's model paths: ${r.missing.map((m) => m.name).join(", ")}`
      + (r.missing.some((m) => m.source) ? " - the app offers to download them (⬇ Download)" : "") );
    return job.models_missing;
  } catch (e) { return null; }
}

module.exports = { namesFromLog, jobNeeds, afterFail, V, LOADERS, FOLDER_LABEL, loaderFiles, needs, index, match, sourceOf, file, target, build, read, check, norm };
