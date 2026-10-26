// bitGen Studio — lib/comfyFolders.js (2.598.0): WHERE THE RUNNING COMFYUI KEEPS ITS MODELS, asked of ComfyUI itself.
//
// Tim: "the model manager can't find the list of models or loras, comfui is running, models show in the dropdown".
// The dropdowns ask the running ComfyUI (/object_info - lib/comfyModels.list); the 🧩 Model manager only scanned the
// folders it could work out from Settings ▸ ComfyUI ▸ Folder + extra_model_paths.yaml - so a ComfyUI whose models live
// somewhere else (the Desktop app's own models folder, --base-directory, a yaml passed with --extra-model-paths-config,
// a folder not set in Settings) showed models in the dropdowns and none in the manager. Now:
//   liveRoots(url)   GET <url>/internal/folder_paths - every category's folders as ComfyUI resolved them -> [{dir,
//                    category, source: "comfyui"}] for comfyModels.scan's extraRoots (the manager scans those too)
//   liveNames(url)   the dropdowns' own lists (comfyModels.liveLists) - the manager shows a card for every model / LoRA
//                    ComfyUI offers, even one whose file it cannot open (ComfyUI on another computer)
//   refresh(url, {force}) both, kept 60 s (3 s timeout - a ComfyUI that is not running = none, never a wait)
//   cached()         {roots, names, url, at} - the last answer (lib/modelCards.list reads it, it is synchronous)
//   rootsFrom(body)  pure: /internal/folder_paths' answer -> roots (aliases folded: unet -> diffusion_models, clip ->
//                    text_encoders)
"use strict";
const ALIAS = { checkpoints: "checkpoints", diffusion_models: "diffusion_models", unet: "diffusion_models", loras: "loras",
                vae: "vae", text_encoders: "text_encoders", clip: "text_encoders", clip_vision: "clip_vision", controlnet: "controlnet",
                upscale_models: "upscale_models", embeddings: "embeddings", diffusers: "diffusers", style_models: "style_models" };
let C = { roots: [], names: {}, url: "", at: 0 };

function rootsFrom(body) {
  const out = [], seen = new Set();
  if (!body || typeof body !== "object") return out;
  for (const [k, v] of Object.entries(body)) {
    const cat = ALIAS[k]; if (!cat) continue;
    const dirs = Array.isArray(v) ? (Array.isArray(v[0]) ? v[0] : v) : [];
    for (const d of dirs) {
      if (typeof d !== "string" || !d.trim()) continue;
      const key = cat + "\u0000" + d.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key); out.push({ dir: d, category: cat, source: "comfyui" });
    }
  }
  return out;
}
async function liveRoots(url, opts) {
  const o = opts || {};
  const f = o.fetch || (typeof fetch === "function" ? fetch : null);
  if (!url || !f) return [];
  try {
    const r = await f(String(url).replace(/\/$/, "") + "/internal/folder_paths", { signal: AbortSignal.timeout(o.timeout || 3000) });
    if (!r.ok) return [];
    return rootsFrom(await r.json());
  } catch { return []; }
}
async function liveNames(url, opts) {
  try { return (await require("./comfyModels").liveLists(url, Object.assign({ timeout: 3000 }, opts || {}))).categories || {}; }
  catch { return {}; }
}
async function refresh(url, opts) {
  const o = opts || {};
  if (!o.force && C.url === url && Date.now() - C.at < 60000) return C;
  const [roots, names] = await Promise.all([liveRoots(url, o), liveNames(url, o)]);
  C = { roots, names, url, at: Date.now() };
  return C;
}
function cached() { return C; }
module.exports = { rootsFrom, liveRoots, liveNames, refresh, cached, _set: (c) => { C = Object.assign({ roots: [], names: {}, url: "", at: Date.now() }, c || {}); } };
