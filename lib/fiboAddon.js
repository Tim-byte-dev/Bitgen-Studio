// bitGen Studio — lib/fiboAddon.js (2.582.0): Settings ▸ Add-ons ▸ Fibo 2.0 - its model files (+ ComfyUI-GGUF for a GGUF).
//
// Tim: "please add fibo to the model edit tools https://huggingface.co/realrebelai/Fibo-2.0_GGUFs/tree/main. this model
// should work with very low vram".
// Fibo 2.0 (Bria AI, 8B; CC BY-NC 4.0 - non-commercial use only) runs in ComfyUI's own nodes (21 Oct 2026 or later:
// CLIPLoader type fibo2 + TextEncodeFibo2). Edit Turbo edits a picture from an instruction in 4 steps; Dev makes and
// edits pictures (30 steps, cfg 5). The low-VRAM files come from realrebelai/Fibo-2.0_GGUFs (w4a8 ConvRot 6.6 GB - the
// styles' default, ComfyUI's own loader; GGUF Q4_0 / Q5_0 / Q8_0 - the ComfyUI-GGUF pack, installed when one is ticked),
// the text encoder (Qwen3-VL 4B int8) and the FLUX.2 VAE from Comfy-Org/Fibo-2.0 (lib/modelCatalog.json group "fibo").
//   ITEMS                        [{id, label, for, files: [catalog ids], dflt, need, gguf}]
//   status(place?)               {installed, note, items: [{id, label, for, size, present, dflt, need}]}
//   install(log, picks, deps)    -> {ok, error}  (deps: place / download / packInstall / comfy / styles)
//   remove(log, place?)          -> {ok, error}  (the downloaded files; the styles and the node pack stay)
//   comfySupport(o)              -> {online, fibo2}  (CLIPLoader's type list has fibo2)
"use strict";
const fs = require("fs");
const path = require("path");

const ITEMS = [
  { id: "edit", label: "Edit Turbo (w4a8 ConvRot, 6.6 GB)", for: "the Fibo 2.0 Edit Turbo style - edits a picture from an instruction in 4 steps; the lowest VRAM (about 8 GB cards), ComfyUI's own loader", files: ["fibo_edit_w4a8"], dflt: true },
  { id: "edit_q4", label: "Edit Turbo GGUF Q4_0 (6.6 GB)", for: "optional - GGUF instead (installs ComfyUI-GGUF); pick it as the style's Model", files: ["fibo_edit_q4"], dflt: false, gguf: true },
  { id: "edit_q5", label: "Edit Turbo GGUF Q5_0 (7.5 GB)", for: "optional - GGUF, a little better than Q4_0", files: ["fibo_edit_q5"], dflt: false, gguf: true },
  { id: "edit_q8", label: "Edit Turbo GGUF Q8_0 (10 GB)", for: "optional - GGUF, near full quality, more VRAM", files: ["fibo_edit_q8"], dflt: false, gguf: true },
  { id: "edit_int8", label: "Edit Turbo int8 ConvRot (Comfy-Org, 8.4 GB)", for: "optional - Comfy-Org's official file, more VRAM than w4a8", files: ["fibo_edit_int8"], dflt: false },
  { id: "dev", label: "Dev (w4a8 ConvRot, 6.6 GB)", for: "the Fibo 2.0 Dev style - makes pictures from text and edits them (30 steps)", files: ["fibo_dev_w4a8"], dflt: false },
  { id: "dev_q4", label: "Dev GGUF Q4_0 (6.6 GB)", for: "optional - Dev as GGUF (installs ComfyUI-GGUF)", files: ["fibo_dev_q4"], dflt: false, gguf: true },
  { id: "te", label: "Text encoder - Qwen3-VL 4B (int8)", for: "needed by every Fibo 2.0 style", files: ["fibo_te"], dflt: true, need: true },
  { id: "vae", label: "VAE - FLUX.2 VAE", for: "needed by every Fibo 2.0 style", files: ["fibo_vae"], dflt: true, need: true },
];
const DEFAULTS = ITEMS.filter((i) => i.dflt).map((i) => i.id);
const STYLES = ["Fibo 2.0 Edit Turbo", "Fibo 2.0 Dev"];
const MODEL_IDS = ["edit", "edit_q4", "edit_q5", "edit_q8", "edit_int8", "dev", "dev_q4"];

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
  const model = MODEL_IDS.some(has);
  const ready = model && has("te") && has("vae");
  return { installed: ready, items,
    note: !p.ok ? `ComfyUI not found (${p.error}) - set its folder in Settings ▸ ComfyUI first`
      : ready ? "ready: " + items.filter((i) => i.present).map((i) => i.label.replace(/ \(.*\)$/, "")).join(", ") + " - the Fibo 2.0 styles (the image editor's ✨ AI ▸ Edit, Settings ▸ Image; ComfyUI from 21 Oct 2026)"
      : items.some((i) => i.present) ? "partly downloaded - Install again for the rest" : "not installed" };
}

/** does the running ComfyUI know the fibo2 text encoder? -> {online, fibo2} */
async function comfySupport(o) {
  const opt = o || {};
  let url = opt.url != null ? String(opt.url) : "";
  if (opt.url == null) { try { url = require("./comfy").comfyCfg().url; } catch (e) { url = ""; } }
  const f = opt.fetch || (typeof fetch === "function" ? fetch : null);
  if (!url || !f) return { online: false, fibo2: false };
  try {
    const r = await f(`${url}/object_info/CLIPLoader`, { signal: AbortSignal.timeout(opt.timeout || 4000) });
    if (!r.ok) return { online: false, fibo2: false };
    const j = await r.json(), n = j && j.CLIPLoader;
    const spec = n && n.input && ((n.input.required || {}).type || (n.input.optional || {}).type);
    const list = Array.isArray(spec) ? (Array.isArray(spec[0]) ? spec[0] : ((spec[1] || {}).options || [])) : [];
    return { online: !!n, fibo2: list.includes("fibo2") };
  } catch (e) { return { online: false, fibo2: false }; }
}

async function install(log, picks, deps) {
  const d = deps || {};
  const pl = d.place || place();
  if (!pl.ok) return { ok: false, error: `ComfyUI not found (${pl.error}) - set its folder in Settings ▸ ComfyUI, then install again` };
  const want = wanted(picks);
  if (!want.some((id) => MODEL_IDS.includes(id))) return { ok: false, error: "tick at least one Fibo 2.0 model (Edit Turbo or Dev)" };
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
    } else if (pk) log(`[ok] ${pk.folder} is in ComfyUI already (update it if a Fibo .gguf will not load - its Fibo 2.0 support is recent)`, false);
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
      if (!r || !r.ok) return { ok: false, error: `${m.as || path.basename(m.file)}: ${(r && r.error) || "the download failed"}${/401|403|gated/i.test(String((r && r.error) || "")) ? " - accept Bria's terms on the model's Hugging Face page and set your token in Settings ▸ Hugging Face" : ""}` };
      log(`[ok] ${m.as || path.basename(m.file)}${r.skipped ? " (already there)" : ""}`, false);
    }
  }
  try {
    const made = d.styles ? d.styles(STYLES) : require("./styles").restoreStarters(core.STYLES_DIR, STYLES, "image");
    if (made && made.length) log(`[ok] image styles back: ${made.join(", ")}`, false);
  } catch (e) { log(`[warn] the Fibo 2.0 styles: ${e.message}`, true); }
  if (needsGguf(want)) log("[ok] GGUF: pick fibo2_*-Q4_0.gguf (or Q5_0 / Q8_0) as the style's Model in Settings ▸ Image - the styles load the w4a8 file", false);
  const cs = await (d.comfy || comfySupport)();
  if (cs.online && !cs.fibo2) log("[warn] this ComfyUI does not know Fibo 2.0 yet - update ComfyUI (21 Oct 2026 or later: the portable build's update\\update_comfyui.bat, a git install: git pull, or ComfyUI-Manager ▸ Update ComfyUI), then restart it", true);
  else if (newPack) log("[ok] restart ComfyUI once so it loads ComfyUI-GGUF (the Model manager's 📁 Model paths ▸ ⟳ Restart ComfyUI)", false);
  else if (cs.online) log("[ok] ComfyUI knows Fibo 2.0 - the image editor's ✨ AI ▸ Edit with the Fibo 2.0 Edit Turbo style", false);
  else log("[ok] files in place - Fibo 2.0 needs ComfyUI from 21 Oct 2026 or later", false);
  log("[ok] Fibo 2.0's weights are CC BY-NC 4.0: non-commercial use only (commercial use needs Bria AI's licence)", false);
  return { ok: true };
}

async function remove(log, pl0) {
  const pl = pl0 || place();
  if (!pl.models) return { ok: false, error: "ComfyUI's models folder is not known" };
  let n = 0;
  for (const it of ITEMS) for (const fid of it.files) {
    if (fid === "fibo_vae" || fid === "fibo_te") continue;   // the FLUX.2 VAE + Qwen3-VL 4B int8 are FLUX 3 Klein's too
    const m = entry(fid); if (!m) continue;
    const p = Models().destPath(m, paths(pl));
    try { if (p && fs.existsSync(p)) { fs.unlinkSync(p); n++; log(`[ok] deleted ${p}`, false); } }
    catch (e) { log(`[warn] could not delete ${p}: ${e.message}`, true); }
  }
  log(`[ok] ${n} Fibo 2.0 file(s) removed - the styles, the text encoder + FLUX.2 VAE (FLUX 3 Klein uses them too) and ComfyUI-GGUF stay`, false);
  return { ok: true };
}

module.exports = { ITEMS, DEFAULTS, STYLES, wanted, needsGguf, status, comfySupport, install, remove };
