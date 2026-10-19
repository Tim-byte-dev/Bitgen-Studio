// bitGen Studio — lib/modelFolders.js (2.538.0): WHERE A CIVITAI DOWNLOAD GOES, per model type.
// Tim (verbatim): "add download button to civitai models, create dialog to get folder location to save to, store the
// folder location for each type of model and lora. if folder location is set for a model type don't show the dialog,
// just download it to it's folder. shift+click the download button will open the dialog to change the folder. use the
// folder select dialog to select the folder. save the folder in model_folders.json file. model types will be, sd1, sdxl,
// pony,illustrious, flux2klein,flux3klein, flux, flux2, z-image etc. image, image-edit, video and music models will be
// the main categories."
//
//   THE KEY     <main>/<type>/<kind>   main  image | image-edit | video | music
//                                      type  sd1 sdxl pony illustrious noobai flux flux2 flux2klein flux3klein krea qwen
//                                            z-image chroma hidream sd3 anima other | wan ltx h3 hunyuan | music
//                                      kind  model (checkpoints / diffusion_models) | lora | vae | text_encoders |
//                                            embeddings | controlnet | upscale_models | ultralytics
//               e.g. "image/sdxl/lora", "image-edit/qwen/model", "video/wan/lora"
//   THE FILE    <app>/model_folders.json  {v: 1, folders: {key: "D:\\ComfyUI\\models\\loras\\SDXL"}}  (one for every project)
//   SUGGESTED   ComfyUI's folder for that kind (the first that exists) + the type's name: loras/SDXL, checkpoints/Pony
//   OUTSIDE     a folder that is not inside ComfyUI's folders for that kind still works for the download, but ComfyUI
//               will not list it until it is added to extra_model_paths.yaml - resolve() says so (outside: true)
// Pure (scripts/test-modelfolders538.js): typeOf, mainOf, kindOf, keyOf, labelOf, parseKey, inside, normalize.
"use strict";
const fs = require("fs");
const path = require("path");

const MAINS = ["image", "image-edit", "video", "music"];
const TYPES = {
  sd1: "SD 1.5", sdxl: "SDXL", pony: "Pony", illustrious: "Illustrious", noobai: "NoobAI", flux: "Flux.1", flux2: "Flux.2",
  flux2klein: "Flux.2 Klein", flux3klein: "Flux 3 Klein", krea: "Krea", qwen: "Qwen", "z-image": "Z-Image", chroma: "Chroma",
  hidream: "HiDream", sd3: "SD 3", anima: "Anima", wan: "Wan", ltx: "LTX", h3: "MiniMax H3", hunyuan: "Hunyuan Video",
  music: "Music", other: "Other",
};
const KINDS = { model: "models", lora: "LoRAs", vae: "VAEs", text_encoders: "text encoders", embeddings: "embeddings",
  controlnet: "ControlNets", upscale_models: "upscalers", ultralytics: "detectors" };
const MAIN_LABEL = { image: "Image", "image-edit": "Image edit", video: "Video", music: "Music" };

/** a family (lib/modelCards FAMILIES) + the name / base model -> the folder type */
function typeOf(family, hints) {
  const f = String(family || "").toLowerCase();
  const s = (String((hints && hints.name) || "") + " " + String((hints && hints.base_model) || "")).toLowerCase();
  if (f === "sd15") return "sd1";
  if (f === "flux3") return "flux3klein";
  if (f === "flux2") return /klein/.test(s) ? "flux2klein" : "flux2";
  return TYPES[f] ? f : "other";
}
/** lib/modelCards category ("image" | "image edit" | "video" | "music") -> the main category */
function mainOf(category) {
  const c = String(category || "").toLowerCase().replace(/[\s_]+/g, "-");
  return MAINS.includes(c) ? c : "image";
}
/** a ComfyUI category -> the kind (checkpoints / diffusion_models / unet are all "model") */
function kindOf(cat) {
  const c = String(cat || "").toLowerCase();
  if (/^(checkpoints|diffusion_models|unet|unet_gguf)$/.test(c)) return "model";
  if (/^(loras?|lycoris)$/.test(c)) return "lora";
  return KINDS[c] ? c : "model";
}
function keyOf(main, type, kind) { return `${mainOf(main)}/${TYPES[type] ? type : "other"}/${KINDS[kind] ? kind : "model"}`; }
function parseKey(key) {
  const m = /^([a-z-]+)\/([a-z0-9-]+)\/([a-z_]+)$/.exec(String(key || ""));
  if (!m || !MAINS.includes(m[1]) || !TYPES[m[2]] || !KINDS[m[3]]) return null;
  return { main: m[1], type: m[2], kind: m[3] };
}
function labelOf(key) {
  const k = parseKey(key); if (!k) return String(key || "");
  return `${MAIN_LABEL[k.main]} · ${TYPES[k.type]} ${KINDS[k.kind]}`;
}
/** is dir inside (or equal to) one of roots - case-insensitive on Windows-looking paths */
function inside(dir, roots) {
  const norm = (p) => { let s = String(p || "").replace(/\\/g, "/").replace(/\/+$/, ""); if (/^[a-z]:/i.test(s)) s = s.toLowerCase(); return s; };
  const d = norm(dir);
  return (roots || []).some((r) => { const x = norm(r); return x && (d === x || d.startsWith(x + "/")); });
}
/** the file's content -> {v: 1, folders: {validKey: absDir}} (unknown keys / non-absolute dirs dropped) */
function normalize(o) {
  const out = { v: 1, folders: {} };
  const f = (o && o.folders) || {};
  for (const k of Object.keys(f)) {
    const d = String(f[k] || "").trim();
    if (parseKey(k) && d && (path.isAbsolute(d) || /^[a-z]:[\\/]/i.test(d)) && d.length < 1000) out.folders[k] = d;
  }
  return out;
}

/* ---------------- live */
function file() { return path.join(require("./core").BASE, "model_folders.json"); }
function read() { try { return normalize(JSON.parse(fs.readFileSync(file(), "utf8"))); } catch { return normalize({}); } }
function write(o) {
  const n = normalize(o), f = file(), tmp = f + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(n, null, 2));
  fs.renameSync(tmp, f);
  return n;
}
function get(key) { return read().folders[key] || ""; }
/** set (dir) or forget (dir "") one type's folder */
function set(key, dir) {
  if (!parseKey(key)) return { error: "unknown model type: " + key };
  const d = String(dir || "").trim();
  if (d && !(path.isAbsolute(d) || /^[a-z]:[\\/]/i.test(d))) return { error: "pick a full folder path" };
  const cur = read();
  if (d) cur.folders[key] = d; else delete cur.folders[key];
  const n = write(cur);
  try { require("./testPlan").event("model_folder", { what: key }); } catch { /* the 🧪 checklist */ }
  return { ok: true, key, dir: n.folders[key] || "", label: labelOf(key) };
}
function list() {
  const cur = read();
  return { file: file(), folders: Object.keys(cur.folders).sort().map((k) => ({ key: k, label: labelOf(k), dir: cur.folders[k] })),
    mains: MAINS, types: TYPES, kinds: KINDS };
}
/** ComfyUI's roots for a category (lib/modelCards' scan) */
function rootsOf(cat) {
  try { const sc = require("./modelCards").comfyScan(); return ((((sc.categories || {})[cat] || {}).roots) || []).map((r) => r.dir).filter(Boolean); } catch { return []; }
}
/** where a file of this model would go: {key, label, dir (set) | "", suggest, outside} */
function resolve(info) {
  const o = info || {}, cards = require("./modelCards");
  const fam = (o.family && cards.FAMILIES[o.family]) ? o.family : (cards.baseFamily(o.base_model) || cards.nameFamily(o.name) || "other");
  const category = o.category || cards.categoryOf(fam, { name: o.name, base_model: o.base_model });
  const cat = String(o.cat || (/lora|locon|dora|lycoris/i.test(String(o.type || "")) ? "loras" : "checkpoints"));
  const key = keyOf(mainOf(category), typeOf(fam, o), kindOf(cat));
  const dir = get(key);
  const roots = kindOf(cat) === "model" ? rootsOf("checkpoints").concat(rootsOf("diffusion_models")) : rootsOf(cat);
  let suggest = "";
  try { const t = require("./modelInstall").pickTarget(require("./civitai").scanRoots(cat)); if (t) suggest = path.join(t.dir, TYPES[parseKey(key).type].replace(/[^A-Za-z0-9. -]/g, "")); } catch { suggest = ""; }
  return { key, label: labelOf(key), dir, suggest, cat, outside: !!dir && roots.length > 0 && !inside(dir, roots) };
}

module.exports = { MAINS, TYPES, KINDS, typeOf, mainOf, kindOf, keyOf, parseKey, labelOf, inside, normalize, file, read, get, set, list, resolve, rootsOf };
