// bitGen Studio — lib/pan2Addon.js (2.890.0): Settings ▸ Add-ons ▸ PAN 2 - download its model files.
//
// Tim (verbatim): "can you add this to our video models https://huggingface.co/Comfy-Org/PAN2"
// PAN 2 (IFM at MBZUAI, Apache-2.0) runs in ComfyUI's OWN nodes since PR #17755 (15 Nov 2026, the v0.46.0 release) - no
// node pack. The add-on downloads Comfy-Org/PAN2's repacks (lib/modelCatalog.json group "pan2") into ComfyUI's models
// folders - the sets you tick:
//   int8  pan2_int8_convrot (26.7 GB) + the Qwen3.5 9B int8 text encoder + the Wan 2.2 VAE   (ticked - a 32 GB card)
//   bf16  pan2_bf16 (67.4 GB) + the same text encoder + VAE                                    (80-96 GB cards)
// and asks the running ComfyUI whether it knows CLIPLoader type "pan2" (older = update ComfyUI).
//   ITEMS                        [{id, label, for, files: [catalog ids], dflt}]
//   status(place?)               {installed, note, items: [{id, label, for, size, present, dflt}]}
//   install(log, picks, deps)    -> {ok, error}  (deps: place / download / comfy (async -> {online, nodes}))
//   remove(log, place?)          -> {ok, error}  (the PAN 2 models; the text encoder + VAE stay - other styles use them)
"use strict";
const fs = require("fs");
const path = require("path");

const ITEMS = [
  { id: "int8", label: "PAN 2 int8 (26.7 GB + text encoder + VAE)", for: "the model for a 32 GB card (RTX 5090) - what the PAN 2 style uses", files: ["pan2_int8", "pan2_te", "pan2_vae"], dflt: true },
  { id: "bf16", label: "PAN 2 bf16 (67.4 GB + text encoder + VAE)", for: "full precision for 80-96 GB cards - set it as the style's model", files: ["pan2_bf16", "pan2_te", "pan2_vae"], dflt: false },
];
const DEFAULTS = ITEMS.filter((i) => i.dflt).map((i) => i.id);
const MODELS = ["pan2_int8", "pan2_bf16"];

const Models = () => require("./setupModels");
const entry = (id) => Models().byId(id);
const place = () => require("./aiFillAddon").place();
const paths = (pl) => ({ comfyModels: pl.models, app: require("./core").BASE });
const fmt = (b) => require("./aiFillAddon").fmt(b);
const sizeOf = (it) => it.files.reduce((s, id) => s + ((entry(id) || {}).size || 0), 0);
function wanted(picks) {
  const p = Array.isArray(picks) && picks.length ? picks : DEFAULTS;
  return ITEMS.filter((i) => p.includes(i.id)).map((i) => i.id);
}

function status(pl0) {
  const p = pl0 || place();
  const items = ITEMS.map((it) => ({ id: it.id, label: it.label, for: it.for, dflt: it.dflt, size: fmt(sizeOf(it)),
    present: !!p.models && it.files.every((id) => { const m = entry(id); return !!m && Models().present(m, paths(p)); }) }));
  const ready = items.some((i) => i.present);
  return { installed: ready, items,
    note: !p.ok ? `ComfyUI not found (${p.error}) - set its folder in Settings ▸ ComfyUI first`
      : ready ? "ready: " + items.filter((i) => i.present).map((i) => i.label.replace(/ \(.*\)$/, "")).join(", ")
        + " - pick the PAN 2 video style in the prompt docker (ComfyUI 0.46.0 or newer)"
      : "not installed" };
}

const comfySupport = (o) => require("./pan2").comfySupport(o);

async function install(log, picks, deps) {
  const d = deps || {};
  const pl = d.place || place();
  if (!pl.ok) return { ok: false, error: `ComfyUI not found (${pl.error}) - set its folder in Settings ▸ ComfyUI, then install again` };
  const want = wanted(picks);
  if (!want.length) return { ok: false, error: "tick int8, bf16 or both" };
  const core = require("./core");
  const token = ((core.getConfig() || {}).hf || {}).token || "";
  const env = Object.assign({}, process.env, { PYTHONUTF8: "1" });
  const dl = d.download || ((m) => { let last = -1; return Models().download(m, { token, paths: paths(pl), python: require("./setupRun").appPython(), log, env, engine: "auto",
    onProgress: (p) => { const pc = p && p.total ? Math.floor((p.got / p.total) * 10) * 10 : -1; if (pc > last) { last = pc; log(`… ${m.as || path.basename(m.file)} ${pc} %`, false); } } }); });
  const done = new Set();
  for (const id of want) {
    const it = ITEMS.find((i) => i.id === id);
    for (const fid of it.files) {
      if (done.has(fid)) continue;
      done.add(fid);
      const m = entry(fid);
      if (!m) { log(`[warn] ${fid} is not in the model list`, true); continue; }
      log(`[..] ${it.label.replace(/ \(.*\)$/, "")}: ${m.repo}/${m.file} (${fmt(m.size || 0)})`, false);
      const r = await dl(m);
      if (!r || !r.ok) return { ok: false, error: `${m.as || path.basename(m.file)}: ${(r && r.error) || "the download failed"}` };
      log(`[ok] ${m.as || path.basename(m.file)}${r.skipped ? " (already there)" : ""}`, false);
    }
  }
  const cs = await (d.comfy || comfySupport)();
  if (cs.online && !cs.nodes) log("[warn] this ComfyUI does not know PAN 2 yet - " + require("./pan2").UPDATE, true);
  else if (cs.online) log("[ok] ComfyUI knows PAN 2 - pick the PAN 2 video style (restart ComfyUI if it does not list the new files)", false);
  else log("[ok] files in place - PAN 2 needs ComfyUI 0.46.0 or newer (its own PAN 2 support)", false);
  return { ok: true };
}

async function remove(log, pl0) {
  const pl = pl0 || place();
  if (!pl.models) return { ok: false, error: "ComfyUI's models folder is not known" };
  let n = 0;
  for (const fid of MODELS) {
    const m = entry(fid); if (!m) continue;
    const p = Models().destPath(m, paths(pl));
    try { if (p && fs.existsSync(p)) { fs.unlinkSync(p); n++; log(`[ok] deleted ${p}`, false); } }
    catch (e) { log(`[warn] could not delete ${p}: ${e.message}`, true); }
  }
  log(`[ok] ${n} PAN 2 model file(s) removed - the Qwen3.5 9B text encoder and the Wan 2.2 VAE stay (other styles can use them)`, false);
  return { ok: true };
}

module.exports = { ITEMS, DEFAULTS, MODELS, wanted, status, install, remove, comfySupport };
