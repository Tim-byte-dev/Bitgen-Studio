// bitGen Studio — lib/ph3Addon.js (2.678.0): Settings ▸ Add-ons ▸ P-H3 Image - download its model files.
//
// Tim (verbatim): "please add this image edit model, https://huggingface.co/PrunaAI/P-H3-Image-Comfy"
// P-H3 Image (PrunaAI, built on MiniMax H3 - the MiniMax H3 Community License: "Powered by MiniMax H3"; it excludes the EU,
// UK, Republic of Korea and the US without a separate licence) makes and EDITS pictures (up to 8 inputs) in ComfyUI's
// own nodes - PH3ImageConditioning, MiniMaxH3SigmaShift, TextGenerateV2 - on ComfyUI's master branch / the nightly until
// the next release (0.44). bitGen Studio follows Comfy-Org's templates: the MiniMax H3 FL2VA transformer bitGen Studio's
// video already uses + the 2 GB P-H3 LoRA (no second 20 GB model), P-H3's int8 text encoder + VAE and its w4a8 prompt
// upsampler. Files from PrunaAI/P-H3-Image-Comfy (lib/modelCatalog.json group "ph3") into ComfyUI's models/loras,
// text_encoders, vae; the MiniMax H3 FL2VA transformer (group "video") only if it is missing. The two image styles
// ("P-H3 Image" text to image, "P-H3 Image Edit" - comfy_workflows/img_ph3_*.json) are put back if they are missing.
//   ITEMS                        [{id, label, for, files: [catalog ids], dflt, need}] - need = always downloaded
//   status(place?)               {installed, note, items: [{id, label, for, size, present, dflt, need}]}
//   install(log, picks, deps)    -> {ok, error}  (deps: place / download / comfy (async -> {online, ph3}) / styles)
//   remove(log, place?)          -> {ok, error}  (P-H3's own files; the MiniMax H3 transformer stays - the video needs it)
//   comfySupport(o)              -> {online, ph3}  (the running ComfyUI has the PH3ImageConditioning node)
//   missingMessage(cs)           the words when ComfyUI is running without the P-H3 nodes (null = fine / not known)
"use strict";
const fs = require("fs");
const path = require("path");

const ITEMS = [
  { id: "lora", label: "P-H3 Image LoRA (bf16)", for: "the P-H3 model itself, on the MiniMax H3 transformer", files: ["ph3_lora"], dflt: true, need: true },
  { id: "te", label: "P-H3 text encoder (int8)", for: "needed by every P-H3 Image style", files: ["ph3_te"], dflt: true, need: true },
  { id: "vae", label: "P-H3 VAE (int8)", for: "needed by every P-H3 Image style", files: ["ph3_vae"], dflt: true, need: true },
  { id: "up", label: "P-H3 prompt upsampler (w4a8)", for: "needed - a short request becomes the full prompt the model wants", files: ["ph3_up"], dflt: true, need: true },
  { id: "h3", label: "MiniMax H3 FL2VA transformer (int8)", for: "needed - the video's own model (skipped when you have it)", files: ["h3_fl2va"], dflt: true, need: true },
];
const DEFAULTS = ITEMS.filter((i) => i.dflt).map((i) => i.id);
const STYLES = ["P-H3 Image", "P-H3 Image Edit"];
const NODE = "PH3ImageConditioning";

const Models = () => require("./setupModels");
const entry = (id) => Models().byId(id);
const place = () => require("./aiFillAddon").place();             // ComfyUI's folders (the same lookup)
const paths = (pl) => ({ comfyModels: pl.models, app: require("./core").BASE });
const sizeOf = (it) => it.files.reduce((s, id) => s + ((entry(id) || {}).size || 0), 0);
const fmt = (b) => require("./aiFillAddon").fmt(b);
/** the picks + what every style needs, known ids only, in the list's order */
function wanted(picks) {
  const p = Array.isArray(picks) && picks.length ? picks : DEFAULTS;
  return ITEMS.filter((i) => i.need || p.includes(i.id)).map((i) => i.id);
}

function status(pl0) {
  const p = pl0 || place();
  const items = ITEMS.map((it) => ({ id: it.id, label: it.label, for: it.for, dflt: it.dflt, need: !!it.need, size: fmt(sizeOf(it)),
    present: !!p.models && it.files.every((id) => { const m = entry(id); return !!m && Models().present(m, paths(p)); }) }));
  const ready = items.every((i) => !i.need || i.present);
  return { installed: ready, items,
    note: !p.ok ? `ComfyUI not found (${p.error}) - set its folder in Settings ▸ ComfyUI first`
      : ready ? "ready - the P-H3 Image / P-H3 Image Edit styles in Settings ▸ Image (ComfyUI with the P-H3 nodes: master / nightly, 0.44)"
      : items.some((i) => i.present) ? "partly downloaded - Install again for the rest" : "not installed" };
}

/** does the running ComfyUI have the P-H3 nodes? -> {online, ph3} */
async function comfySupport(o) {
  const opt = o || {};
  let url = opt.url != null ? String(opt.url) : "";
  if (opt.url == null) { try { url = require("./comfy").comfyCfg().url; } catch (e) { url = ""; } }
  const f = opt.fetch || (typeof fetch === "function" ? fetch : null);
  if (!url || !f) return { online: false, ph3: false };
  try {
    const r = await f(`${url}/object_info/${NODE}`, { signal: AbortSignal.timeout(opt.timeout || 4000) });
    if (!r.ok) {   // an old ComfyUI answers an unknown node with {} or a 404 - is it there at all?
      const s = await f(`${url}/system_stats`, { signal: AbortSignal.timeout(opt.timeout || 4000) }).catch(() => null);
      return { online: !!(s && s.ok), ph3: false };
    }
    const j = await r.json();
    return { online: true, ph3: !!(j && j[NODE]) };
  } catch (e) { return { online: false, ph3: false }; }
}
function missingMessage(cs) {
  if (!cs || !cs.online || cs.ph3) return null;
  return "This ComfyUI cannot run P-H3 Image yet: it has no PH3ImageConditioning node. P-H3 is on ComfyUI's master branch (the next release, 0.44) - " +
    "update ComfyUI to the latest nightly (Settings ▸ ComfyUI ▸ ⤓ Update ComfyUI, a git install: git pull + pip install -r requirements.txt), then restart it.";
}

async function install(log, picks, deps) {
  const d = deps || {};
  const pl = d.place || place();
  if (!pl.ok) return { ok: false, error: `ComfyUI not found (${pl.error}) - set its folder in Settings ▸ ComfyUI, then install again` };
  const want = wanted(picks);
  const core = require("./core");
  const token = ((core.getConfig() || {}).hf || {}).token || "";
  const env = Object.assign({}, process.env, { PYTHONUTF8: "1" });
  const dl = d.download || ((m) => { let last = -1; return Models().download(m, { token, paths: paths(pl), python: require("./setupRun").appPython(), log, env, engine: "auto",
    onProgress: (p) => { const pc = p && p.total ? Math.floor((p.got / p.total) * 10) * 10 : -1; if (pc > last) { last = pc; log(`… ${m.as || path.basename(m.file)} ${pc} %`, false); } } }); });
  log("[ok] P-H3 Image is under the MiniMax H3 Community License (read it: huggingface.co/PrunaAI/P-H3-Image-Comfy) - it excludes the EU, UK, Republic of Korea and the US without a licence from MiniMax; show \"Powered by MiniMax H3\" with what you make", false);
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
  } catch (e) { log(`[warn] the P-H3 Image styles: ${e.message}`, true); }
  const cs = await (d.comfy || comfySupport)();
  const miss = missingMessage(cs);
  if (miss) log("[warn] " + miss, true);
  else if (cs.online) log("[ok] ComfyUI has the P-H3 nodes - pick the P-H3 Image (or P-H3 Image Edit) style and Generate (restart ComfyUI if it does not list the new files)", false);
  else log("[ok] files in place - P-H3 Image needs ComfyUI with its nodes (master / nightly, 0.44); pick the P-H3 Image style and Generate", false);
  return { ok: true };
}

async function remove(log, pl0) {
  const pl = pl0 || place();
  if (!pl.models) return { ok: false, error: "ComfyUI's models folder is not known" };
  let n = 0;
  for (const it of ITEMS) {
    if (it.id === "h3") continue;                                   // the video's own model stays
    for (const fid of it.files) {
      const m = entry(fid); if (!m) continue;
      const p = Models().destPath(m, paths(pl));
      try { if (p && fs.existsSync(p)) { fs.unlinkSync(p); n++; log(`[ok] deleted ${p}`, false); } }
      catch (e) { log(`[warn] could not delete ${p}: ${e.message}`, true); }
    }
  }
  log(`[ok] ${n} P-H3 Image file(s) removed - the MiniMax H3 transformer stays (the video needs it), the styles stay (Settings ▸ Image)`, false);
  return { ok: true };
}

module.exports = { ITEMS, DEFAULTS, STYLES, NODE, wanted, status, install, remove, comfySupport, missingMessage };
