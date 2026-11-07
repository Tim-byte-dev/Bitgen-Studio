// bitGen Studio — lib/vram16.js (2.708.0): 16 GB MODE for MiniMax H3 renders - its settings, files and node packs.
//
// Tim: "this workflow is meant to work with 16gb vram - minimax" (DENO's MiniMax H3 R2V Turbo 8+2 export) - his pick:
// "16 GB mode for my H3 renders" (use its tricks automatically when the card has 16 GB). The graph side is
// scripts/h3_16gb.py (applied by misc/worker.py); this is the app side:
//   cfg(c?)                       engine.comfy.vram16 normalized: {mode: "auto" | "on" | "off", scale: 1.0-2.0, turbo}
//   ITEMS                         the model files (catalog ids) - 2 LoRAs per pass + the H3 latent upscaler
//   PACKS                         the node packs ({key: VACCEL repo key in lib/comfy.js}) - DENO (text encoder unload)
//                                 and the H3 latent upscaler nodes; KJNodes (VRAM_Debug) is optional
//   status(o?)                    {mode, scale, turbo, items: [{id, label, size, present}], packs: [...], ready, note}
//   install(log, deps?)           the add-on's install: downloads the missing files (Settings ▸ Add-ons)
//   remove(log, deps?)            deletes the four files (the shared H3 files are never touched)
// Settings ▸ ComfyUI ▸ 16 GB mode holds the switch, the upscale and the pass-1 LoRA (static/vram16.js).
"use strict";
const fs = require("fs");
const path = require("path");

const ITEMS = [
  { id: "acc", file: "h3_acc8", label: "Ref2VA Acc 8-step LoRA", pass: 1 },
  { id: "dmd", file: "h3_dmd_ref", label: "DMD Ref2VA 8-step LoRA", pass: 2 },
  { id: "refiner", file: "h3_refiner2k", label: "Open-H3 2K refiner LoRA", pass: 2 },
  { id: "upscaler", file: "h3_latent_up", label: "H3 latent upscaler (3D)", pass: 2 },
];
const PACKS = [
  { key: "deno", label: "DENO custom nodes", node: "DenoTextEncoderUnload", for: "the text encoder leaves VRAM before sampling", need: true },
  { key: "h3latentup", label: "H3 latent upscaler nodes", node: "MinimaxH3LatentUpscaler3D", for: "the latent upscale pass", need: true },
  { key: "kjnodes", label: "KJNodes", node: "VRAM_Debug", for: "models unloaded before the big decode (optional)", need: false },
];
const MODES = ["auto", "on", "off"];
const DEFAULT = { mode: "auto", scale: 1.5, turbo: true };

const Models = () => require("./setupModels");
const fmt = (b) => require("./aiFillAddon").fmt(b);
const place = () => require("./aiFillAddon").place();
const paths = (pl) => ({ comfyModels: pl.models, app: require("./core").BASE });

/** engine.comfy.vram16 -> {mode, scale, turbo} (the worker reads the same - misc/worker.py _vram16_cfg) */
function cfg(c) {
  let v = c;
  if (v === undefined) { try { v = ((require("./core").getConfig().engine || {}).comfy || {}).vram16; } catch (e) { v = null; } }
  v = v && typeof v === "object" ? v : {};
  const mode = MODES.includes(String(v.mode || "").toLowerCase()) ? String(v.mode).toLowerCase() : DEFAULT.mode;
  let scale = parseFloat(v.scale); scale = Number.isFinite(scale) ? Math.round(Math.min(2, Math.max(1, scale)) * 100) / 100 : DEFAULT.scale;
  return { mode, scale, turbo: v.turbo !== false };
}

function status(o) {
  const d = o || {};
  const pl = d.place || place();
  const c = cfg(d.cfg);
  const items = ITEMS.map((it) => { const m = Models().byId(it.file);
    return { id: it.id, label: it.label, pass: it.pass, size: fmt((m || {}).size || 0),
      present: !!(m && pl.ok && pl.models && Models().present(m, paths(pl))) }; });
  let packs;
  try { const comfy = d.comfy || require("./comfy");
    packs = PACKS.map((p) => Object.assign({}, p, { installed: !!comfy.packInstalled(p.key).installed })); }
  catch (e) { packs = PACKS.map((p) => Object.assign({}, p, { installed: false })); }
  const missing = items.filter((i) => !i.present), packsMissing = packs.filter((p) => p.need && !p.installed);
  const ready = !missing.length && !packsMissing.length;
  const note = !pl.ok ? `ComfyUI not found (${pl.error}) - set its folder in Settings ▸ ComfyUI first`
    : ready ? "ready - every part of 16 GB mode can run"
      : [missing.length ? "missing files: " + missing.map((i) => i.label).join(", ") + " (Settings ▸ Add-ons ▸ 16 GB mode ▸ Install)" : "",
        packsMissing.length ? "missing node packs: " + packsMissing.map((p) => p.label).join(", ") + " (the buttons below)" : ""]
        .filter(Boolean).join("; ") + " - a render leaves out only the parts it cannot run, and says so";
  return Object.assign(c, { items, packs, ready, installed: !missing.length, comfy: !!pl.ok, note });
}

async function install(log, deps) {
  const d = deps || {};
  const pl = d.place || place();
  if (!pl.ok) return { ok: false, error: `ComfyUI not found (${pl.error}) - set its folder in Settings ▸ ComfyUI, then install again` };
  const core = require("./core");
  const token = ((core.getConfig() || {}).hf || {}).token || "";
  const env = Object.assign({}, process.env, { PYTHONUTF8: "1" });
  const dl = d.download || ((m) => { let last = -1; return Models().download(m, { token, paths: paths(pl), python: require("./setupRun").appPython(), log, env, engine: "auto",
    onProgress: (p) => { const pc = p && p.total ? Math.floor((p.got / p.total) * 10) * 10 : -1; if (pc > last) { last = pc; log(`… ${m.as || path.basename(m.file)} ${pc} %`, false); } } }); });
  for (const it of ITEMS) {
    const m = Models().byId(it.file);
    if (!m) { log(`[warn] ${it.file} is not in the model list`, true); continue; }
    if (!d.download && !require("./reinstallForce").on() && Models().present(m, paths(pl))) { log(`[ok] ${m.as || path.basename(m.file)} (already there)`, false); continue; }
    log(`[..] ${it.label}: ${m.repo}/${m.file} (${fmt(m.size || 0)})`, false);
    const r = await dl(m);
    if (!r || !r.ok) return { ok: false, error: `${m.as || path.basename(m.file)}: ${(r && r.error) || "the download failed"}` };
    log(`[ok] ${m.as || path.basename(m.file)}${r.skipped ? " (already there)" : ""}`, false);
  }
  const st = status({ place: pl });
  const pk = st.packs.filter((p) => p.need && !p.installed);
  if (pk.length) log("[next] install the node packs: Settings ▸ ComfyUI ▸ 16 GB mode ▸ " + pk.map((p) => "⬇ " + p.label).join(", ") + ", then restart ComfyUI", false);
  log(`[ok] 16 GB mode is ${st.mode === "off" ? "OFF - turn it on in Settings ▸ ComfyUI ▸ 16 GB mode" : st.mode === "auto" ? "on automatically for a card with 16 GB or less" : "on"}`, false);
  return { ok: true };
}

async function remove(log, deps) {
  const d = deps || {};
  const pl = d.place || place();
  if (!pl.ok) return { ok: false, error: `ComfyUI not found (${pl.error})` };
  let n = 0;
  for (const it of ITEMS.filter((i) => i.id !== "upscaler")) {          // the latent upscaler is shared with the ⚙ upscaler
    const m = Models().byId(it.file); if (!m) continue;
    const p = Models().destPath(m, paths(pl));
    try { if (p && fs.existsSync(p)) { fs.unlinkSync(p); n++; log(`[ok] deleted ${p}`, false); } }
    catch (e) { log(`[warn] could not delete ${p}: ${e.message}`, true); }
  }
  log(`[ok] ${n} file(s) removed - the H3 latent upscaler stays (the ⚙ upscaler uses it); 16 GB mode leaves out what is missing`, false);
  return { ok: true };
}

module.exports = { ITEMS, PACKS, MODES, DEFAULT, cfg, status, install, remove };
