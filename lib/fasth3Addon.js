// bitGen Studio — lib/fasth3Addon.js (2.573.0): Settings ▸ Add-ons ▸ FastH3 Omni - download its model files.
//
// Tim: "please add this workflow https://www.fasth3-omni.com/en, fasth3 omni".
// FastH3 Omni (FastVideo / Hao AI Lab) is MiniMax H3's reference-to-video model distilled to 8 steps: up to 9 pictures,
// 3 videos and 3 sounds in, synced video + audio out. It runs in ComfyUI's own nodes (0.43 or later: the VSA method of
// BlockSparseAttention) - no node pack. The add-on downloads the model you tick from FastVideo/FastH3-Omni-Comfy into
// ComfyUI's models/diffusion_models, plus H3's own text encoder and VAEs when they are missing (they are shared with
// MiniMax H3), puts the "FastH3 Omni" video style back if it was deleted (comfy_workflows/fasth3_omni_r2v.json) and asks
// the running ComfyUI whether it has VSA sparse attention (older = update ComfyUI - Settings ▸ ComfyUI ▸ ⤓ Update).
//   ITEMS                        [{id, label, for, files: [catalog ids], dflt, need}] - need = always downloaded
//   status(place?)               {installed, note, items: [{id, label, for, size, present, dflt, need}]}
//   install(log, picks, deps)    -> {ok, error}  (deps: place / download / comfy (async -> {online, vsa, kitchen}) / styles)
//   remove(log, place?)          -> {ok, error}  (only the FastH3 files - H3's shared encoder / VAEs stay)
//   comfySupport(o)              -> {online, vsa, kitchen}  (o = {url, fetch, timeout})
"use strict";
const fs = require("fs");
const path = require("path");

const ITEMS = [
  { id: "int8", label: "FastH3 Omni 8-step (int8)", for: "the FastH3 Omni style - the one to use (~22 GB, like H3's own int8 model)", files: ["fasth3_omni_int8"], dflt: true },
  { id: "bf16", label: "FastH3 Omni 8-step (bf16)", for: "optional - full precision, needs a 48 GB+ card (pick it as the style's Model)", files: ["fasth3_omni_bf16"], dflt: false },
  { id: "te", label: "Text encoder - H3's Qwen3-VL 32B (nvfp4)", for: "shared with MiniMax H3 - skipped when you have it", files: ["h3_te"], dflt: true, need: true },
  { id: "vae", label: "VAEs - H3 video + audio", for: "shared with MiniMax H3 - skipped when you have them", files: ["h3_vvae", "h3_avae"], dflt: true, need: true },
];
const DEFAULTS = ITEMS.filter((i) => i.dflt).map((i) => i.id);
const STYLES = ["FastH3 Omni"];
const MIN_COMFY = "0.43.0";

const Models = () => require("./setupModels");
const entry = (id) => Models().byId(id);
const place = () => require("./aiFillAddon").place();             // ComfyUI's folders (the same lookup)
const paths = (pl) => ({ comfyModels: pl.models, app: require("./core").BASE });
const sizeOf = (it) => it.files.reduce((s, id) => s + ((entry(id) || {}).size || 0), 0);
const fmt = (b) => require("./aiFillAddon").fmt(b);
/** the picks + what the style needs, known ids only, in the list's order */
function wanted(picks) {
  const p = Array.isArray(picks) && picks.length ? picks : DEFAULTS;
  return ITEMS.filter((i) => i.need || p.includes(i.id)).map((i) => i.id);
}

function status(pl0) {
  const p = pl0 || place();
  const items = ITEMS.map((it) => ({ id: it.id, label: it.label, for: it.for, dflt: it.dflt, need: !!it.need, size: fmt(sizeOf(it)),
    present: !!p.models && it.files.every((id) => { const m = entry(id); return !!m && Models().present(m, paths(p)); }) }));
  const has = (id) => (items.find((x) => x.id === id) || {}).present;
  const ready = (has("int8") || has("bf16")) && has("te") && has("vae");
  return { installed: ready, items,
    note: !p.ok ? `ComfyUI not found (${p.error}) - set its folder in Settings ▸ ComfyUI first`
      : ready ? "ready: " + items.filter((i) => i.present).map((i) => i.label.replace(/ \(.*\)$/, "")).join(", ")
        + ` - pick the FastH3 Omni style, or the StoryBoard's Workflow ▸ FastH3 Omni (ComfyUI ${MIN_COMFY} or later)`
      : items.some((i) => i.present && !i.need) ? "partly downloaded - Install again for the rest" : "not installed" };
}

/** does the running ComfyUI have VSA sparse attention (and comfy kitchen attention)? -> {online, vsa, kitchen} */
async function comfySupport(o) {
  const opt = o || {};
  let url = opt.url != null ? String(opt.url) : "";
  if (opt.url == null) { try { url = require("./comfy").comfyCfg().url; } catch (e) { url = ""; } }
  const f = opt.fetch || (typeof fetch === "function" ? fetch : null);
  if (!url || !f) return { online: false, vsa: false, kitchen: false };
  const get = async (cls) => {
    const r = await f(`${url}/object_info/${cls}`, { signal: AbortSignal.timeout(opt.timeout || 4000) });
    if (!r.ok) return null;
    const j = await r.json();
    return (j && j[cls]) || null;
  };
  try {
    const bs = await get("BlockSparseAttention");
    const be = await get("ModelAttentionBackend").catch(() => null);
    const txt = JSON.stringify((bs && bs.input) || {});
    const att = be && be.input && ((be.input.required || {}).attention);
    const list = Array.isArray(att) ? (Array.isArray(att[0]) ? att[0] : ((att[1] || {}).options || [])) : [];
    return { online: true, vsa: /"vsa"/.test(txt), kitchen: list.includes("comfy kitchen attention") };
  } catch (e) { return { online: false, vsa: false, kitchen: false }; }
}

async function install(log, picks, deps) {
  const d = deps || {};
  const pl = d.place || place();
  if (!pl.ok) return { ok: false, error: `ComfyUI not found (${pl.error}) - set its folder in Settings ▸ ComfyUI, then install again` };
  const want = wanted(picks);
  if (!want.some((id) => id === "int8" || id === "bf16")) return { ok: false, error: "tick a FastH3 Omni model (int8 or bf16)" };
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
      if (!d.download && !require("./reinstallForce").on() && Models().present(m, paths(pl))) { log(`[ok] ${m.as || path.basename(m.file)} (already there)`, false); continue; }
      log(`[..] ${it.label}: ${m.repo}/${m.file} (${fmt(m.size || 0)})`, false);
      const r = await dl(m);
      if (!r || !r.ok) return { ok: false, error: `${m.as || path.basename(m.file)}: ${(r && r.error) || "the download failed"}` };
      log(`[ok] ${m.as || path.basename(m.file)}${r.skipped ? " (already there)" : ""}`, false);
    }
  }
  try {
    const made = d.styles ? d.styles(STYLES) : require("./styles").restoreStarters(core.STYLES_DIR, STYLES, "video");
    if (made && made.length) log(`[ok] video style back: ${made.join(", ")}`, false);
  } catch (e) { log(`[warn] the FastH3 Omni style: ${e.message}`, true); }
  if (want.includes("bf16")) log("[ok] bf16: pick fasth3_omniref_8step_pruned_bf16.safetensors as the style's Model in Settings ▸ Video styles (the style loads the int8 file)", false);
  const cs = await (d.comfy || comfySupport)();
  if (cs.online && !cs.vsa) log(`[warn] this ComfyUI has no VSA sparse attention yet - FastH3 Omni needs ComfyUI ${MIN_COMFY} or later: Settings ▸ ComfyUI ▸ ⤓ Update ComfyUI, then restart it`, true);
  else if (cs.online) log("[ok] ComfyUI has VSA sparse attention" + (cs.kitchen ? "" : " (no comfy kitchen attention - the dense part runs on pytorch attention; Settings ▸ ComfyUI ▸ Comfy Kitchen adds it)")
    + " - pick the FastH3 Omni style (or the StoryBoard's Workflow ▸ FastH3 Omni) and Generate; restart ComfyUI if it does not list the new file", false);
  else log(`[ok] files in place - FastH3 Omni needs ComfyUI ${MIN_COMFY} or later; pick the FastH3 Omni style and Generate`, false);
  return { ok: true };
}

async function remove(log, pl0) {
  const pl = pl0 || place();
  if (!pl.models) return { ok: false, error: "ComfyUI's models folder is not known" };
  let n = 0;
  for (const it of ITEMS) {
    if (it.need) continue;                                        // H3's shared encoder + VAEs stay
    for (const fid of it.files) {
      const m = entry(fid); if (!m) continue;
      const p = Models().destPath(m, paths(pl));
      try { if (p && fs.existsSync(p)) { fs.unlinkSync(p); n++; log(`[ok] deleted ${p}`, false); } }
      catch (e) { log(`[warn] could not delete ${p}: ${e.message}`, true); }
    }
  }
  log(`[ok] ${n} FastH3 Omni file(s) removed - H3's text encoder and VAEs stay (MiniMax H3 uses them), the style stays`, false);
  return { ok: true };
}

module.exports = { ITEMS, DEFAULTS, STYLES, MIN_COMFY, wanted, status, install, remove, comfySupport };
