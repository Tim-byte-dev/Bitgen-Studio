// bitGen Studio — lib/aiFillAddon.js (2.557.0): Settings ▸ Add-ons ▸ AI fill models - the Krita AI plugin's fill helpers.
//
// Tim: "add download ai fill models to addons tab in settings dialog".
// What the image editor's selection fill uses per model family (lib/kritaInpaint.js) - the node pack + the model files of
// lib/modelCatalog.json group "inpaint" - installed from the Add-ons tab: tick what you need, ⤓ Install downloads it.
//   the node pack   comfyui-inpaint-nodes (Acly) into ComfyUI's custom_nodes (lib/setupPacks.js - git or the GitHub zip,
//                   its requirements into ComfyUI's Python); comfyui_controlnet_aux too when an inpainting ControlNet is
//                   picked (its InpaintPreprocessor)
//   the files       Hugging Face downloads (lib/setupModels.js - resumable, the hf CLI when it is installed, the token
//                   from Settings) into ComfyUI's models/inpaint, models/controlnet, models/loras
//   remove          deletes the downloaded model files (the node pack stays - other things may use it)
// After an install ComfyUI must be restarted once to load a new node pack; the editor then picks the helpers up by itself.
//   ITEMS                       [{id, label, for, files: [catalog ids], cn?, dflt}]
//   place()                     {ok, customNodes, models, python, error}
//   status(place?)              {installed, note, pack, items: [{id, label, for, size, present, dflt}]}
//   install(log, picks, deps)   -> {ok, error}  (deps: run / download / packInstall - the tests pass fakes)
//   remove(log, place?)         -> {ok, error}
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");

const ITEMS = [
  { id: "fooocus", label: "Fooocus inpaint (SDXL / Pony)", for: "SDXL and Pony styles fill with their own model", files: ["fooocus_head", "fooocus_patch"], dflt: true },
  { id: "mat", label: "MAT (Remove)", for: "Remove in a selection takes the object out first (any style)", files: ["mat_places"], dflt: true },
  { id: "noobai", label: "NoobAI inpainting ControlNet (Illustrious / NoobAI)", for: "Illustrious / NoobAI styles fill with their own model", files: ["cn_noobai_inpaint"], cn: true, dflt: true },
  { id: "flux", label: "FLUX.1 inpainting ControlNet (Alimama)", for: "FLUX.1 styles fill with their own model", files: ["cn_flux_inpaint"], cn: true, dflt: false },
  { id: "sd15", label: "SD 1.5 inpaint ControlNet", for: "SD 1.5 styles fill with their own model", files: ["cn_sd15_inpaint"], cn: true, dflt: false },
  { id: "klein4b", label: "FLUX.2 Klein 4B outpaint LoRA", for: "optional - Klein 4B fills (the edit-model fill)", files: ["klein4b_outpaint"], dflt: false },
];
const DEFAULTS = ITEMS.filter((i) => i.dflt).map((i) => i.id);

const Models = () => require("./setupModels");
const Packs = () => require("./setupPacks");
const entry = (id) => Models().byId(id);

/** where ComfyUI is (its custom_nodes, models, Python) - the configured one, else <app>/comfy */
function place() {
  const cfg = core.getConfig() || {};
  const dir = String(((cfg.engine || {}).comfy || {}).dir || "").trim();
  const abs = dir ? (path.isAbsolute(dir) ? dir : path.join(core.BASE, dir)) : path.join(core.BASE, "comfy");
  try {
    const r = require("./setupComfy").inspectDir(abs);
    if (r.ok) return { ok: true, customNodes: r.customNodes, models: r.models, python: r.python };
    return { ok: false, error: r.error || "ComfyUI not found", customNodes: "", models: path.join(core.BASE, "comfy", "ComfyUI", "models"), python: "" };
  } catch (e) { return { ok: false, error: e.message, customNodes: "", models: "", python: "" }; }
}
const paths = (pl) => ({ comfyModels: pl.models, app: core.BASE });
const sizeOf = (it) => it.files.reduce((s, id) => s + ((entry(id) || {}).size || 0), 0);
const fmt = (b) => (b >= 1e9 ? (b / 1e9).toFixed(1) + " GB" : b >= 1e6 ? Math.round(b / 1e6) + " MB" : Math.max(1, Math.round(b / 1e3)) + " KB");

function status(pl) {
  const p = pl || place();
  const pack = p.customNodes ? Packs().status(p.customNodes).find((x) => x.id === "inpaint") : null;
  const items = ITEMS.map((it) => ({ id: it.id, label: it.label, for: it.for, dflt: it.dflt, size: fmt(sizeOf(it)),
    present: !!p.models && it.files.every((id) => { const m = entry(id); return !!m && Models().present(m, paths(p)); }) }));
  const have = items.filter((i) => i.present);
  const packOk = !!(pack && pack.present);
  return { installed: packOk && have.length > 0, pack: packOk, items,
           note: !p.ok ? `ComfyUI not found (${p.error}) - set its folder in Settings ▸ ComfyUI first`
             : `${packOk ? "comfyui-inpaint-nodes ✓" : "comfyui-inpaint-nodes not installed"} · ${have.length ? have.map((i) => i.label.replace(/ \(.*\)$/, "")).join(", ") : "no models yet"}` };
}

async function install(log, picks, deps) {
  const d = deps || {};
  const pl = d.place || place();
  if (!pl.ok) return { ok: false, error: `ComfyUI not found (${pl.error}) - set its folder in Settings ▸ ComfyUI, then install again` };
  const want = (Array.isArray(picks) && picks.length ? picks : DEFAULTS).filter((id) => ITEMS.some((i) => i.id === id));
  if (!want.length) return { ok: false, error: "tick at least one model" };
  const X = require("./setupExec");
  const env = Object.assign({}, process.env, { PYTHONUTF8: "1", PIP_DISABLE_PIP_VERSION_CHECK: "1" });
  // 1 the node packs (comfyui-inpaint-nodes; the ControlNet preprocessor pack when a ControlNet is picked)
  const packs = ["inpaint"].concat(want.some((id) => (ITEMS.find((i) => i.id === id) || {}).cn) ? ["cnaux"] : []);
  const st = Packs().status(pl.customNodes);
  const packInstall = d.packInstall || ((pack) => Packs().install(pack, pl.customNodes, { git: X.which("git", require("./setupRun").runtimeDirs()), python: pl.python, log, env }));
  let newPack = false;
  for (const id of packs) {
    const p = st.find((x) => x.id === id);
    if (!p) continue;
    if (p.present) { log(`[ok] ${p.folder} is in ComfyUI already`, false); continue; }
    log(`[..] node pack ${p.folder} (${p.url})`, false);
    const r = await packInstall(p);
    if (!r || !r.ok) return { ok: false, error: `${p.folder} did not install: ${(r && r.error) || "see the log"}` };
    newPack = true;
  }
  // 2 the model files
  const token = ((core.getConfig() || {}).hf || {}).token || "";
  const dl = d.download || ((m) => { let last = -1; return Models().download(m, { token, paths: paths(pl), python: require("./setupRun").appPython(), log, env, engine: "auto",
    onProgress: (p) => { const pc = p && p.total ? Math.floor((p.got / p.total) * 10) * 10 : -1; if (pc > last) { last = pc; log(`… ${m.as || path.basename(m.file)} ${pc} %`, false); } } }); });
  for (const id of want) {
    const it = ITEMS.find((i) => i.id === id);
    for (const fid of it.files) {
      const m = entry(fid);
      if (!m) { log(`[warn] ${fid} is not in the model list`, true); continue; }
      log(`[..] ${it.label}: ${m.repo}/${m.file} (${fmt(m.size || 0)})`, false);
      const r = await dl(m);
      if (!r || !r.ok) return { ok: false, error: `${m.as || path.basename(m.file)}: ${(r && r.error) || "the download failed"}` };
      log(`[ok] ${m.as || path.basename(m.file)}${r.skipped ? " (already there)" : ""}`, false);
    }
  }
  try { require("./kritaInpaint").reset(); } catch (e) { /* the next look asks ComfyUI again anyway */ }
  log(newPack ? "[ok] restart ComfyUI once (the ComfyUI docker's ⟳ Restart, or close and start the app) so it loads the new node pack - the image editor then fills the Krita AI way"
              : "[ok] the image editor uses them from the next fill (ComfyUI lists new model files by itself)", false);
  return { ok: true };
}

async function remove(log, pl0) {
  const pl = pl0 || place();
  if (!pl.models) return { ok: false, error: "ComfyUI's models folder is not known" };
  let n = 0;
  for (const it of ITEMS) for (const fid of it.files) {
    const m = entry(fid); if (!m) continue;
    const p = Models().destPath(m, paths(pl));
    try { if (p && fs.existsSync(p)) { fs.unlinkSync(p); n++; log(`[ok] deleted ${p}`, false); } }
    catch (e) { log(`[warn] could not delete ${p}: ${e.message}`, true); }
  }
  try { require("./kritaInpaint").reset(); } catch (e) { /* fine */ }
  log(`[ok] ${n} model file(s) removed - the node pack comfyui-inpaint-nodes stays in ComfyUI`, false);
  return { ok: true };
}

module.exports = { ITEMS, DEFAULTS, place, status, install, remove, fmt };
