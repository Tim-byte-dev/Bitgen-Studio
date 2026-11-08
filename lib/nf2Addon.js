// bitGen Studio — lib/nf2Addon.js (2.729.0): Settings ▸ Add-ons ▸ NitroFusion2 - download its model files.
//
// Tim (verbatim): "can u add this please https://chendaryen.github.io/NitroFusion2.github.io/"
// NitroFusion2 (Dar-Yen Chen, Yi-Zhe Song; github.com/ChenDarYen/NitroFusion2, Apache-2.0) is Z-Image-Turbo distilled to 1-2
// steps with an adversarial loss on the MMDiT's text stream. It runs in ComfyUI's OWN nodes (the authors' workflows need no
// node pack; the GGUF style uses ComfyUI-GGUF, installed here when a GGUF file is ticked). The files you tick from
// ChenDY/NitroFusion2 + what every style needs (lib/modelCatalog.json group "nf2"): Z-Image-Turbo's Qwen3 4B text encoder
// (Comfy-Org/z_image_turbo) and the FLUX.1 VAE (ae.safetensors - already there when FLUX.1 Kontext / Fill is). The three
// styles ("NitroFusion2" 1 step, "NitroFusion2 2-step", "NitroFusion2 GGUF" - comfy_workflows/img_nf2_*.json) are put back
// when they are missing.
//   ITEMS                        [{id, label, for, files: [catalog ids], dflt, need, gguf}]
//   status(place?)               {installed, note, items: [{id, label, for, size, present, dflt, need}]}
//   install(log, picks, deps)    -> {ok, error}  (deps: place / download / packStatus / packInstall / styles)
//   remove(log, place?)          -> {ok, error}  (NitroFusion2's own files; the text encoder + VAE stay)
"use strict";
const fs = require("fs");
const path = require("path");

const ITEMS = [
  { id: "bf16", label: "NitroFusion2 (bf16, 12.3 GB)", for: "the NitroFusion2 (1 step) and NitroFusion2 2-step styles - the full model", files: ["nf2_bf16"], dflt: true },
  { id: "dedistill", label: "De-distillation LoRA (382 MB)", for: "the NitroFusion2 2-step style's first step - fewer artifacts at 2 steps", files: ["nf2_dedistill"], dflt: true },
  { id: "q4", label: "GGUF Q4_K_M (5.1 GB)", for: "optional - the NitroFusion2 GGUF style for smaller cards (installs ComfyUI-GGUF)", files: ["nf2_q4"], dflt: false, gguf: true },
  { id: "q8", label: "GGUF Q8_0 (7.2 GB)", for: "optional - GGUF near full quality; pick it as the GGUF style's Model", files: ["nf2_q8"], dflt: false, gguf: true },
  { id: "te", label: "Text encoder - Qwen3 4B (Z-Image)", for: "needed by every NitroFusion2 style", files: ["nf2_te"], dflt: true, need: true },
  { id: "vae", label: "VAE - FLUX.1 ae", for: "needed by every NitroFusion2 style", files: ["flux_ae"], dflt: true, need: true },
];
const DEFAULTS = ITEMS.filter((i) => i.dflt).map((i) => i.id);
const STYLES = ["NitroFusion2", "NitroFusion2 2-step", "NitroFusion2 GGUF"];
const MODEL_IDS = ["bf16", "q4", "q8"];

const Models = () => require("./setupModels");
const Packs = () => require("./setupPacks");
const entry = (id) => Models().byId(id);
const place = () => require("./aiFillAddon").place();
const paths = (pl) => ({ comfyModels: pl.models, app: require("./core").BASE });
const sizeOf = (it) => it.files.reduce((s, id) => s + ((entry(id) || {}).size || 0), 0);
const fmt = (b) => require("./aiFillAddon").fmt(b);
/** the picks + what every style needs, known ids only, in the list's order (pure) */
function wanted(picks) {
  const p = Array.isArray(picks) && picks.length ? picks : DEFAULTS;
  return ITEMS.filter((i) => i.need || p.includes(i.id)).map((i) => i.id);
}
/** ComfyUI-GGUF is needed when a GGUF file is picked (pure) */
const needsGguf = (want) => want.some((id) => (ITEMS.find((i) => i.id === id) || {}).gguf);

function status(pl0) {
  const p = pl0 || place();
  const items = ITEMS.map((it) => ({ id: it.id, label: it.label, for: it.for, dflt: it.dflt, need: !!it.need, size: fmt(sizeOf(it)),
    present: !!p.models && it.files.every((id) => { const m = entry(id); return !!m && Models().present(m, paths(p)); }) }));
  const has = (id) => (items.find((x) => x.id === id) || {}).present;
  const ready = MODEL_IDS.some(has) && has("te") && has("vae");
  return { installed: ready, items,
    note: !p.ok ? `ComfyUI not found (${p.error}) - set its folder in Settings ▸ ComfyUI first`
      : ready ? "ready: " + items.filter((i) => i.present).map((i) => i.label.replace(/ \(.*\)$/, "")).join(", ") + " - the NitroFusion2 styles (the Image docker, Settings ▸ Image)"
      : items.some((i) => i.present) ? "partly downloaded - Install again for the rest" : "not installed" };
}

async function install(log, picks, deps) {
  const d = deps || {};
  const pl = d.place || place();
  if (!pl.ok) return { ok: false, error: `ComfyUI not found (${pl.error}) - set its folder in Settings ▸ ComfyUI, then install again` };
  const want = wanted(picks);
  if (!want.some((id) => MODEL_IDS.includes(id))) return { ok: false, error: "tick at least one NitroFusion2 model (bf16 or a GGUF)" };
  const core = require("./core");
  const X = require("./setupExec");
  const env = Object.assign({}, process.env, { PYTHONUTF8: "1", PIP_DISABLE_PIP_VERSION_CHECK: "1" });
  // 1 ComfyUI-GGUF, only for a GGUF file
  let newPack = false;
  if (needsGguf(want)) {
    const st = d.packStatus ? d.packStatus() : Packs().status(pl.customNodes);
    const pk = st.find((x) => x.id === "gguf");
    if (pk && !pk.present) {
      log(`[..] node pack ${pk.folder} (${pk.url}) - it loads the .gguf files`, false);
      const packInstall = d.packInstall || ((pack) => Packs().install(pack, pl.customNodes, { git: X.which("git", require("./setupRun").runtimeDirs()), python: pl.python, log, env }));
      const r = await packInstall(pk);
      if (!r || !r.ok) return { ok: false, error: `${pk.folder} did not install: ${(r && r.error) || "see the log"}` };
      newPack = true;
    } else if (pk) log(`[ok] ${pk.folder} is in ComfyUI already`, false);
  }
  // 2 the files
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
  try {
    const made = d.styles ? d.styles(STYLES) : require("./styles").restoreStarters(core.STYLES_DIR, STYLES, "image");
    if (made && made.length) log(`[ok] image styles back: ${made.join(", ")}`, false);
  } catch (e) { log(`[warn] the NitroFusion2 styles: ${e.message}`, true); }
  if (want.includes("q8")) log("[ok] GGUF Q8_0: pick nf2-Q8_0.gguf as the NitroFusion2 GGUF style's Model in Settings ▸ Image (the style loads Q4_K_M)", false);
  if (want.includes("bf16") && !want.includes("dedistill")) log("[ok] no de-distillation LoRA: the NitroFusion2 2-step style needs it - use the 1-step style, or tick it and Install again", false);
  if (newPack) log("[ok] restart ComfyUI once so it loads ComfyUI-GGUF (the Model manager's 📁 Model paths ▸ ⟳ Restart ComfyUI)", false);
  log("[ok] NitroFusion2 is ready - pick the NitroFusion2 style in the Image docker (1 step, cfg 1, about 1 MP)", false);
  return { ok: true };
}

async function remove(log, pl0) {
  const pl = pl0 || place();
  if (!pl.models) return { ok: false, error: "ComfyUI's models folder is not known" };
  let n = 0;
  for (const it of ITEMS) for (const fid of it.files) {
    if (it.need) continue;                                  // the Qwen3 4B encoder + FLUX.1 VAE: other styles use them too
    const m = entry(fid); if (!m) continue;
    const p = Models().destPath(m, paths(pl));
    try { if (p && fs.existsSync(p)) { fs.unlinkSync(p); n++; log(`[ok] deleted ${p}`, false); } }
    catch (e) { log(`[warn] could not delete ${p}: ${e.message}`, true); }
  }
  log(`[ok] ${n} NitroFusion2 file(s) removed - the styles, the text encoder, the VAE and ComfyUI-GGUF stay`, false);
  return { ok: true };
}

module.exports = { ITEMS, DEFAULTS, STYLES, MODEL_IDS, wanted, needsGguf, status, install, remove };
