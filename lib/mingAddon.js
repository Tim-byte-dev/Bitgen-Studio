// bitGen Studio — lib/mingAddon.js (3.9.0; 3.12.0 runs it in ComfyUI): Settings ▸ Add-ons ▸ 🧩 Ming layered design -
// Ming-Image-0.2-Design makes a design from your layer list, Ming-Image-0.1-Design-Layer splits it into those layers
// (transparent PNGs). Both inclusionAI, MIT.
// Tim (3.9.0): "can u add this to image editor please. https://huggingface.co/inclusionAI/Ming-Image-0.2-Design ... it is
// supposed to be able to generate separate layers. please check it" (what was checked: lib/mingLayers.js).
// Tim (3.12.0): "replace our ming image with this one, https://huggingface.co/Comfy-Org/Ming-Image"
//
// 3.12.0: no venv, no inclusionAI code, no Hugging Face cache any more. ComfyUI runs both models in its OWN nodes since the
// v0.46.0 release (comfy/model_base.MingImage, comfy_extras/nodes_ming.py) and Comfy-Org repacked them (int8 ConvRot + bf16).
// The add-on downloads Comfy-Org/Ming-Image's files (lib/modelCatalog.json group "mingimage") into ComfyUI's models folders -
// the sets you tick:
//   design       0.2-Design int8 (≈6.5 GB) + its Ling-mini-2.0 int8 text encoder (≈17 GB) + the VAE      (ticked)
//   layer        0.1-Design-Layer int8 (≈6.5 GB) + its own int8 text encoder (≈17 GB) + the VAE          (ticked)
//   design_bf16  0.2-Design bf16 (≈12 GB) + the same 0.2 text encoder (0.2's comes as int8 only) + the VAE
//   layer_bf16   0.1-Design-Layer bf16 (≈12 GB) + its bf16 text encoder (≈33 GB) + the VAE
// ComfyUI keeps one model on the card at a time and moves the text encoder off after it has read the prompt, so the int8 sets
// should run on a 24 - 32 GB card (inclusionAI's own code wanted one 80 GB card - not measured here yet). When a bf16 set is
// there the job uses it for that model.
// The add-on's id is "mingimage" - 3.9.0 called it "ming", the id Ming-3.0 TTS already had (Settings ▸ Audio's Install Ming-3.0
// TTS opened this one). The 3.9.0 install (<app>/ming_image: its venv + code) is not used any more - Remove deletes it too.
// ITEMS / status / missing / ready / haveWeights / install / remove / jobParams / comfySupport (pure: scripts/test-31200.js)
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");
const ML = require("./mingLayers");

const ID = "mingimage";
const REPO = "Comfy-Org/Ming-Image";
const OR = { gen: ["inclusionai/ming-image-0.2-design", "inclusionai/ming-image-0.1-design"], layer: "inclusionai/ming-image-0.1-design-layer" };
const ITEMS = [
  { id: "design", label: "Ming-Image 0.2 Design int8 (+ its text encoder + VAE)", for: "makes the design from your layer list - the int8 files (smaller; for a 24 - 32 GB card)", files: ["mingimage_design_int8", "mingimage_design_te", "mingimage_vae"], dflt: true, kind: "gen", precision: "int8" },
  { id: "layer", label: "Ming-Image 0.1 Design-Layer int8 (+ its text encoder + VAE)", for: "splits the design (or the picture already open) into your layers, transparent", files: ["mingimage_layer_int8", "mingimage_layer_te_int8", "mingimage_vae"], dflt: true, kind: "layer", precision: "int8" },
  { id: "design_bf16", label: "Ming-Image 0.2 Design bf16 (+ text encoder + VAE)", for: "full precision for the design - used instead of int8 when it is there", files: ["mingimage_design_bf16", "mingimage_design_te", "mingimage_vae"], dflt: false, kind: "gen", precision: "bf16" },
  { id: "layer_bf16", label: "Ming-Image 0.1 Design-Layer bf16 (+ its bf16 text encoder + VAE)", for: "full precision for the layers (its text encoder alone is ≈33 GB) - used instead of int8 when it is there", files: ["mingimage_layer_bf16", "mingimage_layer_te_bf16", "mingimage_vae"], dflt: false, kind: "layer", precision: "bf16" },
];
const DEFAULTS = ITEMS.filter((i) => i.dflt).map((i) => i.id);
const FILES = [...new Set(ITEMS.flatMap((i) => i.files))];
const NOTICE = "Ming-Image (inclusionAI, MIT) in ComfyUI's own nodes (0.46.0 or newer) with Comfy-Org's repacked files: 0.2-Design makes "
  + "the design from your layer list, 0.1-Design-Layer splits it into those layers. Or ☁ OpenRouter in the dialog.";
const LINKS = [
  { label: "Comfy-Org/Ming-Image (Hugging Face, MIT - the ComfyUI files)", url: "https://huggingface.co/" + REPO, kind: "model", dest: "ComfyUI's models folders" },
  { label: "Ming-Image (inclusionAI, GitHub, MIT)", url: "https://github.com/inclusionAI/Ming-Image", kind: "pack", dest: "nothing - the original code and model cards, to read" },
];

const Models = () => require("./setupModels");
const entry = (id) => Models().byId(id);
const place = () => require("./aiFillAddon").place();
const paths = (pl) => ({ comfyModels: pl.models, app: core.BASE });
const fmt = (b) => require("./aiFillAddon").fmt(b);
const sizeOf = (it) => it.files.reduce((s, id) => s + ((entry(id) || {}).size || 0), 0);
const oldDir = (base) => path.join(base || process.env.BITGEN_ADDON_BASE || core.BASE, "ming_image");
function wanted(picks) {
  const p = Array.isArray(picks) && picks.length ? picks : DEFAULTS;
  return ITEMS.filter((i) => p.includes(i.id)).map((i) => i.id);
}
function present(it, pl) { return !!pl.models && it.files.every((id) => { const m = entry(id); return !!m && Models().present(m, paths(pl)); }); }

/** {gen, layer, gen16, layer16} - which sets are in ComfyUI's models folders */
function haveWeights(pl0) {
  const pl = pl0 || place(), has = (id) => present(ITEMS.find((i) => i.id === id), pl);
  const d8 = has("design"), d16 = has("design_bf16"), l8 = has("layer"), l16 = has("layer_bf16");
  return { gen: d8 || d16, layer: l8 || l16, gen16: d16, layer16: l16 };
}
/** what is not there for o.need = ["gen"] / ["layer"] / both - [] when ComfyUI's folder is not known here (a ComfyUI elsewhere:
 *  the worker asks it what it lists) */
function missing(pl0, o) {
  const pl = pl0 || place(), need = (o && o.need) || ["gen", "layer"];
  if (!pl.ok || !pl.models) return [];
  const w = haveWeights(pl), out = [];
  if (need.includes("gen") && !w.gen) out.push({ id: "design", what: "Ming-Image 0.2 Design (makes the design)", how: "Install (tick it)" });
  if (need.includes("layer") && !w.layer) out.push({ id: "layer", what: "Ming-Image 0.1 Design-Layer (splits it into layers)", how: "Install (tick it)" });
  return out;
}
function ready(pl0) { const w = haveWeights(pl0); return w.gen || w.layer; }

function status(pl0) {
  const p = pl0 || place();
  const items = ITEMS.map((it) => ({ id: it.id, label: it.label, for: it.for, dflt: it.dflt, size: fmt(sizeOf(it)), present: present(it, p) }));
  const w = haveWeights(p), old = fs.existsSync(oldDir());
  const leftover = old ? ` The 3.9.0 install in ${oldDir()} is not used any more - Remove deletes it.` : "";
  if (!p.ok) return { installed: false, items, note: `ComfyUI not found (${p.error}) - set its folder in Settings ▸ ComfyUI first. ` + NOTICE + leftover };
  if (w.gen || w.layer) {
    const can = [w.gen ? "makes designs" + (w.gen16 ? " (bf16)" : "") : "", w.layer ? "splits pictures into layers" + (w.layer16 ? " (bf16)" : "") : ""].filter(Boolean).join(" and ");
    return { installed: true, items, note: `ready - ${can} (Image editor ▸ Layer ▸ 🧩 Ming Layered Design…; ComfyUI 0.46.0 or newer).`
      + (!w.gen || !w.layer ? " Tick the other model and Install to have both." : "") + leftover };
  }
  return { installed: false, items, note: "not installed. " + NOTICE + leftover };
}

/** does the running ComfyUI have its Ming-Image nodes? -> {online, nodes} */
async function comfySupport(o) {
  const opt = o || {};
  let url = opt.url != null ? String(opt.url) : "";
  if (opt.url == null) { try { url = require("./comfy").comfyCfg().url; } catch { url = ""; } }
  const f = opt.fetch || (typeof fetch === "function" ? fetch : null);
  if (!url || !f) return { online: false, nodes: false };
  try {
    const r = await f(`${String(url).replace(/\/$/, "")}/object_info/TextEncodeMingImageEdit`, { signal: AbortSignal.timeout(opt.timeout || 4000) });
    if (!r.ok) return { online: true, nodes: false };
    const j = await r.json();
    return { online: true, nodes: !!(j && j.TextEncodeMingImageEdit) };
  } catch { return { online: false, nodes: false }; }
}
const UPDATE = "Ming-Image runs in ComfyUI's own nodes since the v0.46.0 release - update ComfyUI (Settings ▸ ComfyUI ▸ ⤓ Update ComfyUI, "
  + "or the portable build's update\\update_comfyui.bat), then restart it";

/** log, picks (item ids), deps {place, download, comfy} -> {ok, error} */
async function install(log, picks, deps) {
  const d = deps || {};
  const pl = d.place || place();
  if (!pl.ok) return { ok: false, error: `ComfyUI not found (${pl.error}) - set its folder in Settings ▸ ComfyUI, then install again` };
  const want = wanted(picks);
  if (!want.length) return { ok: false, error: "tick the design model, the layer model or both" };
  const token = ((core.getConfig() || {}).hf || {}).token || "";
  const env = Object.assign({}, process.env, { PYTHONUTF8: "1" });
  const dl = d.download || ((m) => { let last = -1; return Models().download(m, { token, paths: paths(pl), python: require("./setupRun").appPython(), log, env, engine: "auto",
    onProgress: (p) => { const pc = p && p.total ? Math.floor((p.got / p.total) * 10) * 10 : -1; if (pc > last) { last = pc; log(`… ${m.as || path.basename(m.file)} ${pc} %`, false); } } }); });
  log("[!!] " + NOTICE, false);
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
  if (cs.online && !cs.nodes) log("[warn] this ComfyUI has no Ming-Image nodes yet - " + UPDATE, true);
  else if (cs.online) log("[ok] ComfyUI knows Ming-Image - Image editor ▸ Layer ▸ 🧩 Ming Layered Design… (restart ComfyUI if it does not list the new files)", false);
  else log("[ok] files in place - Ming-Image needs ComfyUI 0.46.0 or newer (its own Ming-Image nodes)", false);
  if (fs.existsSync(oldDir())) log(`[!!] the 3.9.0 install in ${oldDir()} is not used any more (its venv, code and the Hugging Face cache copies) - Remove deletes the folder`, false);
  return { ok: true };
}

/** the Ming-Image files (the VAE too - nothing else uses it) and the 3.9.0 folder */
async function remove(log, pl0) {
  const pl = pl0 || place();
  let n = 0;
  if (pl.models) {
    for (const fid of FILES) {
      const m = entry(fid); if (!m) continue;
      const p = Models().destPath(m, paths(pl));
      try { if (p && fs.existsSync(p)) { fs.unlinkSync(p); n++; log(`[ok] deleted ${p}`, false); } }
      catch (e) { log(`[warn] could not delete ${p}: ${e.message}`, true); }
    }
  } else log("[warn] ComfyUI's models folder is not known - its Ming-Image files stay", true);
  const od = oldDir();
  if (fs.existsSync(od)) {
    log(`[..] removing the 3.9.0 install ${od} (its weights in the Hugging Face cache stay - delete inclusionAI--Ming-Image-* there by hand if you want the space)`, false);
    if (!require("./setupPacks").safeRm(od, log)) return { ok: false, error: `could not remove ${od} - close anything using it and try again` };
  }
  log(`[ok] ${n} Ming-Image file(s) removed`, false);
  return { ok: true };
}

const int = (x, lo, hi, d) => { const n = Math.round(+x); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
/** the job: o = {rows, engine "comfy" (3.9.0's "local" = the same) | "openrouter", split (layers wanted), input (a picture to split
 *  - no generation), w, h, level 1024 | 2048, layer_res 512 | 1024, style, lighting, steps, seed, name, orKey, place?,
 *  auto (3.13.0: a split with just the number of layers - the rows are only their names)}
 *  -> {params} | {error, missing, status} */
function jobParams(o) {
  const x = o || {}, rows = ML.clean(x.rows), engine = x.engine === "openrouter" ? "openrouter" : "comfy";
  const input = x.input && fs.existsSync(x.input) ? x.input : "";
  if (x.input && !input) return { error: "the picture to split is gone", status: 400 };
  if (!rows.length) return { error: "add at least one layer - its name and what goes in it", status: 400 };
  const split = !!input || (x.split !== false && rows.length > 1);
  if (input && rows.length < 2) return { error: "splitting a picture needs at least two layers (the front ones and the background)", status: 400 };
  const gen = !input, need = [gen ? "gen" : "", split ? "layer" : ""].filter(Boolean);
  const precision = { design: "int8", layer: "int8" };
  if (engine === "comfy") {
    const pl = x.place || place();
    const miss = missing(pl, { need });
    if (miss.length) return { error: "🧩 Ming-Image's ComfyUI files are not downloaded - Settings ▸ Add-ons ▸ 🧩 Ming layered design: " + miss.map((m) => m.what).join(", ") + " missing (or pick ☁ OpenRouter in the dialog)", missing: miss, status: 409 };
    if (pl.ok && pl.models) { const w = haveWeights(pl); if (w.gen16) precision.design = "bf16"; if (w.layer16) precision.layer = "bf16"; }
  } else if (!x.orKey) return { error: "☁ OpenRouter needs your API key - 🖥 GPU ▸ Remote generation ▸ OpenRouter (Ming 0.1 Design and Design-Layer are free there)", status: 400 };
  const sz = ML.sizeFor(x.w, x.h, x.level), name = ML.stem(x.name || rows[0].name || "design");
  const label = "🧩 Ming " + (gen ? "design" : "split") + (split ? " · " + rows.length + " layers" : "") + (engine === "openrouter" ? " (OpenRouter)" : "");
  const params = { mode: "ming", engine, name, rows, generate: gen, split, input: input || null,
    width: sz.w, height: sz.h, layer_res: +x.layer_res === 512 ? 512 : 1024,
    input_w: input && +x.w > 0 ? Math.round(+x.w) : 0, input_h: input && +x.h > 0 ? Math.round(+x.h) : 0,   // 3.12.0: the split's shape
    t2i_prompt: gen ? ML.t2iPrompt(rows, { w: sz.w, h: sz.h, style: x.style, lighting: x.lighting }) : null,
    layer_plan: split ? (input && +x.auto >= 2 ? ML.autoPlan(rows.length) : ML.layerPlan(rows)) : null,   // 3.13.0: auto = just N
    steps: x.steps ? int(x.steps, 4, 50, 12) : null, seed: Number.isFinite(+x.seed) && x.seed !== "" && x.seed != null ? Math.floor(Math.abs(+x.seed)) : 42,
    prompt: label, label, no_assets: true };
  if (engine === "comfy") params.precision = precision;
  else params.ming = { gen: OR.gen, layer: OR.layer };
  // the OpenRouter key rides the job the way OpenRouter pictures do (lib/orRender.js jobApis - never in the job's params)
  if (engine === "openrouter") params.style = { api_id: require("./orRender").API_ID, name: "Ming-Image on OpenRouter" };
  return { params };
}

module.exports = { ID, REPO, OR, ITEMS, DEFAULTS, FILES, NOTICE, LINKS, UPDATE, wanted, haveWeights, missing, ready, status, comfySupport, install, remove, jobParams, oldDir };
