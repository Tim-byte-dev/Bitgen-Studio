// bitGen Studio — lib/h3SheetAddon.js (2.870.0): Settings ▸ Add-ons ▸ H3 Character Sheet Designer.
//
// What the Character creator's 🪪 Character sheet tab needs (lib/charSheetH3.js): the H3 Character Sheet Designer node
// pack (ukr8b3g-cmyk, MIT code - cloned into ComfyUI's custom_nodes by lib/setupPacks.js, lib/nodePacks.json id "h3sheet")
// and MiniMax H3 Image's files from Comfy-Org/MiniMax-H3-Image (lib/modelCatalog.json group "h3img") - the transformer and
// its VAE; the text encoder is the MiniMax H3 one the video already uses (downloaded only when it is missing). ComfyUI
// 0.45 or newer has the MiniMax H3 Image Conditioning node; ComfyUI is restarted once to load a new pack.
//   ITEMS                        [{id, label, for, files: [catalog ids] | pack: true, need}]
//   status(place?)               {installed, pack, note, items: [{id, label, for, size, present, need}]}
//   install(log, picks, deps)    -> {ok, error}   (deps: place / packInstall / download / comfy - the tests pass fakes)
//   remove(log, place?)          -> {ok, error}   (the image model + VAE; the text encoder and the pack stay)
//   comfySupport(o)              -> {online, designer, cond}
"use strict";
const fs = require("fs");
const path = require("path");
const S = require("./charSheetH3");

const ITEMS = [
  { id: "pack", label: "H3 Character Sheet Designer (ComfyUI node pack)", for: "lays out the views and writes the sheet's prompt", pack: true, need: true },
  { id: "dit", label: "MiniMax H3 Image transformer (int8)", for: "draws the sheet", files: ["h3img_dit"], need: true },
  { id: "vae", label: "MiniMax H3 Image VAE (fp16)", for: "draws the sheet", files: ["h3img_vae"], need: true },
  { id: "te", label: "MiniMax H3 text encoder (nvfp4)", for: "the video's own text encoder - skipped when you have it", files: ["h3_te"], need: true },
];

const Models = () => require("./setupModels");
const Packs = () => require("./setupPacks");
const entry = (id) => Models().byId(id);
const place = () => require("./aiFillAddon").place();
const fmt = (b) => require("./aiFillAddon").fmt(b);
const paths = (pl) => ({ comfyModels: pl.models, app: require("./core").BASE });
const sizeOf = (it) => (it.files || []).reduce((s, id) => s + ((entry(id) || {}).size || 0), 0);
const packRow = (pl) => (pl.customNodes ? Packs().status(pl.customNodes).find((x) => x.id === S.PACK.id) : null);

function status(pl0) {
  const p = pl0 || place();
  const pack = packRow(p);
  const packOk = !!(pack && pack.present);
  const items = ITEMS.map((it) => ({ id: it.id, label: it.label, for: it.for, need: true, dflt: true,
    size: it.pack ? "under 1 MB" : fmt(sizeOf(it)),
    present: it.pack ? packOk : (!!p.models && it.files.every((id) => { const m = entry(id); return !!m && Models().present(m, paths(p)); })) }));
  const ready = items.every((i) => i.present);
  return { installed: ready, pack: packOk, items,
    note: !p.ok ? `ComfyUI not found (${p.error}) - set its folder in Settings ▸ ComfyUI first`
      : ready ? "ready - the Character creator's 🪪 Character sheet (ComfyUI 0.45+ with the pack loaded)"
      : items.some((i) => i.present) ? "partly installed - Install again for the rest" : "not installed" };
}

/** does the running ComfyUI have the designer + MiniMax H3 Image nodes? */
async function comfySupport(o) {
  const opt = o || {};
  let url = opt.url != null ? String(opt.url) : "";
  if (opt.url == null) { try { url = require("./comfy").comfyCfg().url; } catch (e) { url = ""; } }
  const f = opt.fetch || (typeof fetch === "function" ? fetch : null);
  if (!url || !f) return { online: false, designer: false, cond: false };
  const one = async (cls) => {
    const r = await f(`${url}/object_info/${cls}`, { signal: AbortSignal.timeout(opt.timeout || 4000) });
    if (!r.ok) return false;
    const j = await r.json().catch(() => null);
    return !!(j && j[cls]);
  };
  try {
    const designer = await one(S.NODE), cond = await one(S.COND);
    return { online: true, designer, cond };
  } catch (e) { return { online: false, designer: false, cond: false }; }
}

async function install(log, picks, deps) {
  const d = deps || {};
  const pl = d.place || place();
  if (!pl.ok) return { ok: false, error: `ComfyUI not found (${pl.error}) - set its folder in Settings ▸ ComfyUI, then install again` };
  const core = require("./core");
  const X = require("./setupExec");
  const env = Object.assign({}, process.env, { PYTHONUTF8: "1", PIP_DISABLE_PIP_VERSION_CHECK: "1" });
  log(`[ok] H3 Character Sheet Designer ${S.PACK.version} by ukr8b3g-cmyk (${S.PACK.url}) - its code is MIT; MiniMax H3 Image is under the MiniMax H3 licence (huggingface.co/Comfy-Org/MiniMax-H3-Image)`, false);
  // 1 the node pack
  let newPack = false;
  const pack = packRow(pl);
  if (!pack) return { ok: false, error: "the H3 Character Sheet Designer pack is not in the node pack list" };
  if (pack.present) log(`[ok] ${pack.folder} is in ComfyUI already`, false);
  else {
    log(`[..] node pack ${pack.folder} (${pack.url})`, false);
    const packInstall = d.packInstall || ((pk) => Packs().install(pk, pl.customNodes, { git: X.which("git", require("./setupRun").runtimeDirs()), python: pl.python, log, env }));
    const r = await packInstall(pack);
    if (!r || !r.ok) return { ok: false, error: `${pack.folder} did not install: ${(r && r.error) || "see the log"}` };
    newPack = true;
  }
  // 2 the model files
  const token = ((core.getConfig() || {}).hf || {}).token || "";
  const dl = d.download || ((m) => { let last = -1; return Models().download(m, { token, paths: paths(pl), python: require("./setupRun").appPython(), log, env, engine: "auto",
    onProgress: (p) => { const pc = p && p.total ? Math.floor((p.got / p.total) * 10) * 10 : -1; if (pc > last) { last = pc; log(`… ${m.as || path.basename(m.file)} ${pc} %`, false); } } }); });
  for (const it of ITEMS) {
    if (it.pack) continue;
    for (const fid of it.files) {
      const m = entry(fid);
      if (!m) { log(`[warn] ${fid} is not in the model list`, true); continue; }
      if (Models().present(m, paths(pl))) { log(`[ok] ${m.as || path.basename(m.file)} (already there)`, false); continue; }
      log(`[..] ${it.label}: ${m.repo}/${m.file} (about ${fmt(m.size || 0)})`, false);
      const r = await dl(m);
      if (!r || !r.ok) return { ok: false, error: `${m.as || path.basename(m.file)}: ${(r && r.error) || "the download failed"}` };
      log(`[ok] ${m.as || path.basename(m.file)}${r.skipped ? " (already there)" : ""}`, false);
    }
  }
  const cs = await (d.comfy || comfySupport)();
  if (newPack || (cs.online && !cs.designer)) log("[ok] restart ComfyUI once (the ComfyUI docker's ⟳ Restart, or close and start the app) so it loads the H3 Character Sheet Designer pack", false);
  if (cs.online && !cs.cond) log("[warn] this ComfyUI has no MiniMax H3 Image Conditioning node - update ComfyUI to 0.45 or newer (Settings ▸ ComfyUI ▸ ⤓ Update ComfyUI), then restart it", true);
  log("[ok] the Character creator's 🪪 Character sheet makes the sheets now", false);
  return { ok: true };
}

async function remove(log, pl0) {
  const pl = pl0 || place();
  if (!pl.models) return { ok: false, error: "ComfyUI's models folder is not known" };
  let n = 0;
  for (const it of ITEMS) {
    if (it.pack || it.id === "te") continue;                 // the text encoder is the video's own
    for (const fid of it.files) {
      const m = entry(fid); if (!m) continue;
      const p = Models().destPath(m, paths(pl));
      try { if (p && fs.existsSync(p)) { fs.unlinkSync(p); n++; log(`[ok] deleted ${p}`, false); } }
      catch (e) { log(`[warn] could not delete ${p}: ${e.message}`, true); }
    }
  }
  log(`[ok] ${n} MiniMax H3 Image file(s) removed - the text encoder stays (the video needs it), the node pack stays in ComfyUI's custom_nodes`, false);
  return { ok: true };
}

module.exports = { ITEMS, status, install, remove, comfySupport };
