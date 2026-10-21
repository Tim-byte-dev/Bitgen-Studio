// bitGen Studio — lib/mossAddon.js (2.566.0): Settings ▸ Add-ons ▸ MOSS-Image - download its model files.
//
// Tim: "can you add this model type to bitgen please...https://huggingface.co/Comfy-Org/MOSS-Image, add an option in
// add-ons to download and install it".
// MOSS-Image (OpenMOSS, an open 5B image model, Apache-2.0) runs in ComfyUI's own nodes (16 Oct 2026 or later: the
// moss_image text encoder type) - no node pack. The add-on downloads the files you tick from Comfy-Org/MOSS-Image
// (lib/modelCatalog.json group "moss") into ComfyUI's models/diffusion_models, models/text_encoders, models/vae, puts
// the two image styles back if they are missing ("MOSS-Image" = SFT, "MOSS-Image Base" - comfy_workflows/img_moss_*.json)
// and asks the running ComfyUI whether it knows the moss_image text encoder (older = update ComfyUI).
//   ITEMS                        [{id, label, for, files: [catalog ids], dflt, need}] - need = always downloaded
//   status(place?)               {installed, note, items: [{id, label, for, size, present, dflt, need}]}
//   install(log, picks, deps)    -> {ok, error}  (deps: place / download / comfy (async -> {online, moss}) / styles)
//   remove(log, place?)          -> {ok, error}  (the downloaded files; the styles stay)
//   comfySupport(o)              -> {online, moss}  (CLIPLoader's type list has moss_image; o = {url, fetch, timeout})
"use strict";
const fs = require("fs");
const path = require("path");

const ITEMS = [
  { id: "sft", label: "MOSS-Image SFT (int8)", for: "the MOSS-Image style - instruction-tuned, the one to use", files: ["moss_sft_int8"], dflt: true },
  { id: "base", label: "MOSS-Image Base (int8)", for: "the MOSS-Image Base style - no post-training, for LoRAs / fine-tuning", files: ["moss_base_int8"], dflt: false },
  { id: "sft_bf16", label: "MOSS-Image SFT (bf16)", for: "optional - full precision, more VRAM (pick it as the style's Model)", files: ["moss_sft_bf16"], dflt: false },
  { id: "base_bf16", label: "MOSS-Image Base (bf16)", for: "optional - full precision Base", files: ["moss_base_bf16"], dflt: false },
  { id: "te", label: "Text encoder - Qwen3.5 9B (w4a8)", for: "needed by every MOSS-Image style", files: ["moss_te"], dflt: true, need: true },
  { id: "te_int8", label: "Text encoder - Qwen3.5 9B (int8)", for: "optional - a higher-precision text encoder", files: ["moss_te_int8"], dflt: false },
  { id: "vae", label: "VAE - FLUX.2 VAE small", for: "needed by every MOSS-Image style", files: ["moss_vae"], dflt: true, need: true },
];
const DEFAULTS = ITEMS.filter((i) => i.dflt).map((i) => i.id);
const STYLES = ["MOSS-Image", "MOSS-Image Base"];

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
  const has = (id) => (items.find((x) => x.id === id) || {}).present;
  const model = has("sft") || has("base") || has("sft_bf16") || has("base_bf16");
  const ready = model && has("te") && has("vae");
  return { installed: ready, items,
    note: !p.ok ? `ComfyUI not found (${p.error}) - set its folder in Settings ▸ ComfyUI first`
      : ready ? "ready: " + items.filter((i) => i.present).map((i) => i.label.replace(/ \(.*\)$/, "")).join(", ") + " - the MOSS-Image styles in Settings ▸ Image (ComfyUI from 16 Oct 2026)"
      : items.some((i) => i.present) ? "partly downloaded - Install again for the rest" : "not installed" };
}

/** does the running ComfyUI know the moss_image text encoder? -> {online, moss} */
async function comfySupport(o) {
  const opt = o || {};
  let url = opt.url != null ? String(opt.url) : "";
  if (opt.url == null) { try { url = require("./comfy").comfyCfg().url; } catch (e) { url = ""; } }
  const f = opt.fetch || (typeof fetch === "function" ? fetch : null);
  if (!url || !f) return { online: false, moss: false };
  try {
    const r = await f(`${url}/object_info/CLIPLoader`, { signal: AbortSignal.timeout(opt.timeout || 4000) });
    if (!r.ok) return { online: false, moss: false };
    const j = await r.json(), n = j && j.CLIPLoader;
    const spec = n && n.input && ((n.input.required || {}).type || (n.input.optional || {}).type);
    const list = Array.isArray(spec) ? (Array.isArray(spec[0]) ? spec[0] : ((spec[1] || {}).options || [])) : [];
    return { online: !!n, moss: list.includes("moss_image") };
  } catch (e) { return { online: false, moss: false }; }
}

async function install(log, picks, deps) {
  const d = deps || {};
  const pl = d.place || place();
  if (!pl.ok) return { ok: false, error: `ComfyUI not found (${pl.error}) - set its folder in Settings ▸ ComfyUI, then install again` };
  const want = wanted(picks);
  if (!want.some((id) => /^(sft|base)/.test(id))) return { ok: false, error: "tick at least one MOSS-Image model (SFT or Base)" };
  const core = require("./core");
  const token = ((core.getConfig() || {}).hf || {}).token || "";
  const env = Object.assign({}, process.env, { PYTHONUTF8: "1" });
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
  // the image styles (a deleted starter comes back for this - the files are here now)
  try {
    const made = d.styles ? d.styles(STYLES) : require("./styles").restoreStarters(core.STYLES_DIR, STYLES, "image");
    if (made && made.length) log(`[ok] image styles back: ${made.join(", ")}`, false);
  } catch (e) { log(`[warn] the MOSS-Image styles: ${e.message}`, true); }
  if (want.includes("sft_bf16") || want.includes("base_bf16")) log("[ok] bf16: pick moss_image_*_bf16.safetensors as the style's Model in Settings ▸ Image (the styles load the int8 files)", false);
  const cs = await (d.comfy || comfySupport)();
  if (cs.online && !cs.moss) log("[warn] this ComfyUI does not know the moss_image text encoder yet - update ComfyUI (16 Oct 2026 or later: the portable build's update\\update_comfyui.bat, a git install: git pull, or ComfyUI-Manager ▸ Update ComfyUI), then restart it", true);
  else if (cs.online) log("[ok] ComfyUI knows MOSS-Image - pick the MOSS-Image style and Generate (restart ComfyUI if it does not list the new files)", false);
  else log("[ok] files in place - MOSS-Image needs ComfyUI from 16 Oct 2026 or later; pick the MOSS-Image style and Generate", false);
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
  log(`[ok] ${n} MOSS-Image file(s) removed - the styles stay (Settings ▸ Image)`, false);
  return { ok: true };
}

module.exports = { ITEMS, DEFAULTS, STYLES, wanted, status, install, remove, comfySupport };
