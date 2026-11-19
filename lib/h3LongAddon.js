// bitGen Studio — lib/h3LongAddon.js (2.872.0): Settings ▸ Add-ons ▸ H3 Long Video.
//
// What H3 Long Video (lib/h3LongVideo.js) needs: the H3-LongVideos node pack (cloned from its own page - never shipped),
// PlagueKind's nodes (H3 SLA attention), Comfy-Org's NVIDIA VFX nodes (the 2K pass), ComfyUI-Easy-Use (the GPU clean-ups
// between loaders), MATLOWAI's fused turbo MiniMax H3 file, and MiniMax H3's text encoder + video / audio VAEs (skipped
// when they are there already - every H3 video uses them). ComfyUI is restarted once to load new packs.
//   ITEMS                        [{id, label, for, pack | files, need}]
//   status(place?)               {installed, note, items: [{id, label, for, size, present, need}]}
//   install(log, picks, deps)    -> {ok, error}   (deps: place / packInstall / download / comfy - the tests pass fakes)
//   remove(log, place?)          -> {ok, error}   (the fused model only; the shared H3 files and the packs stay)
//   comfySupport(o)              -> {online, node, sla, rtx}
"use strict";
const fs = require("fs");
const path = require("path");
const L = require("./h3LongVideo");

const ITEMS = [
  { id: "pack", label: "H3-LongVideos (ComfyUI node pack)", for: "chains the shots - anchor + one paragraph per shot", pack: L.PACKS.long.id, need: true },
  { id: "sla", label: "PlagueKind nodes (H3 SLA attention)", for: "sparse attention - faster, less VRAM", pack: L.PACKS.sla.id, need: false },
  { id: "rtx", label: "NVIDIA VFX nodes (RTX Video Super Resolution)", for: "the 2K pass (an RTX card)", pack: L.PACKS.rtx.id, need: false },
  { id: "easy", label: "ComfyUI-Easy-Use", for: "frees the GPU between the model loads", pack: "easyuse", need: false },
  { id: "dit", label: "MiniMax H3 fused turbo (int8 ConvRot)", for: "draws the shots (8 steps)", files: ["h3long_dit"], need: true },
  { id: "h3", label: "MiniMax H3 text encoder + video / audio VAEs", for: "every H3 video's own files - skipped when you have them", files: ["h3_te", "h3_vvae", "h3_avae"], need: true },
];

const Models = () => require("./setupModels");
const Packs = () => require("./setupPacks");
const entry = (id) => Models().byId(id);
const place = () => require("./aiFillAddon").place();
const fmt = (b) => require("./aiFillAddon").fmt(b);
const paths = (pl) => ({ comfyModels: pl.models, app: require("./core").BASE });
const sizeOf = (it) => (it.files || []).reduce((s, id) => s + ((entry(id) || {}).size || 0), 0);
const packRow = (pl, id) => (pl.customNodes ? Packs().status(pl.customNodes).find((x) => x.id === id) : null);

function present(it, p) {
  if (it.pack) { const r = packRow(p, it.pack); return !!(r && r.present); }
  return !!p.models && it.files.every((id) => { const m = entry(id); return !!m && Models().present(m, paths(p)); });
}
function status(pl0) {
  const p = pl0 || place();
  const items = ITEMS.map((it) => ({ id: it.id, label: it.label, for: it.for, need: it.need, dflt: true,
    size: it.pack ? "under 50 MB" : fmt(sizeOf(it)), present: present(it, p) }));
  const ready = items.filter((i) => i.need).every((i) => i.present);
  return { installed: ready, items,
    note: !p.ok ? `ComfyUI not found (${p.error}) - set its folder in Settings ▸ ComfyUI first`
      : ready ? "ready - the H3 Long Video style and the StoryBoard's long scenes (restart ComfyUI after a new pack)"
      : items.some((i) => i.present) ? "partly installed - Install again for the rest" : "not installed" };
}

async function comfySupport(o) {
  const opt = o || {};
  let url = opt.url != null ? String(opt.url) : "";
  if (opt.url == null) { try { url = require("./comfy").comfyCfg().url; } catch (e) { url = ""; } }
  const f = opt.fetch || (typeof fetch === "function" ? fetch : null);
  const none = { online: false, node: false, sla: false, rtx: false };
  if (!url || !f) return none;
  const one = async (cls) => {
    const r = await f(`${url}/object_info/${encodeURIComponent(cls)}`, { signal: AbortSignal.timeout(opt.timeout || 4000) });
    if (!r.ok) return false;
    const j = await r.json().catch(() => null);
    return !!(j && j[cls]);
  };
  try { return { online: true, node: await one(L.NODE), sla: await one(L.SLA), rtx: await one(L.RTX) }; }
  catch (e) { return none; }
}

async function install(log, picks, deps) {
  const d = deps || {};
  const pl = d.place || place();
  if (!pl.ok) return { ok: false, error: `ComfyUI not found (${pl.error}) - set its folder in Settings ▸ ComfyUI, then install again` };
  const core = require("./core");
  const X = require("./setupExec");
  const env = Object.assign({}, process.env, { PYTHONUTF8: "1", PIP_DISABLE_PIP_VERSION_CHECK: "1" });
  const want = Array.isArray(picks) && picks.length ? ITEMS.filter((it) => it.need || picks.includes(it.id)) : ITEMS;
  log(`[ok] H3-LongVideos comes from its own page (${L.PACKS.long.url}) under ${L.PACKS.long.licence}; PlagueKind's nodes are MIT, Comfy-Org's NVIDIA VFX nodes Apache-2.0; the models keep their own licences`, false);
  let newPack = false;
  for (const it of want.filter((x) => x.pack)) {
    const pack = packRow(pl, it.pack);
    if (!pack) { log(`[warn] ${it.label} is not in the node pack list`, true); if (it.need) return { ok: false, error: `${it.label} is not in the node pack list` }; continue; }
    if (pack.present) { log(`[ok] ${pack.folder} is in ComfyUI already`, false); continue; }
    log(`[..] node pack ${pack.folder} (${pack.url})`, false);
    const packInstall = d.packInstall || ((pk) => Packs().install(pk, pl.customNodes, { git: X.which("git", require("./setupRun").runtimeDirs()), python: pl.python, log, env }));
    const r = await packInstall(pack);
    if (!r || !r.ok) {
      const why = `${pack.folder} did not install: ${(r && r.error) || "see the log"}`;
      if (it.need) return { ok: false, error: why + ` - or put its files in ComfyUI/custom_nodes/${pack.folder} by hand (${pack.url})` };
      log(`[warn] ${why} - it runs without it`, true); continue;
    }
    newPack = true;
  }
  const token = ((core.getConfig() || {}).hf || {}).token || "";
  const dl = d.download || ((m) => { let last = -1; return Models().download(m, { token, paths: paths(pl), python: require("./setupRun").appPython(), log, env, engine: "auto",
    onProgress: (p) => { const pc = p && p.total ? Math.floor((p.got / p.total) * 10) * 10 : -1; if (pc > last) { last = pc; log(`… ${m.as || path.basename(m.file)} ${pc} %`, false); } } }); });
  for (const it of want.filter((x) => x.files)) {
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
  if (newPack || (cs.online && !cs.node)) log("[ok] restart ComfyUI once (the ComfyUI docker's ⟳ Restart, or close and start the app) so it loads the new node packs", false);
  log("[ok] H3 Long Video is ready: pick the \"H3 Long Video (40 s)\" video style, or tick the StoryBoard's ⚙ Long video", false);
  return { ok: true };
}

async function remove(log, pl0) {
  const pl = pl0 || place();
  if (!pl.models) return { ok: false, error: "ComfyUI's models folder is not known" };
  let n = 0;
  for (const fid of ["h3long_dit"]) {
    const m = entry(fid); if (!m) continue;
    const p = Models().destPath(m, paths(pl));
    try { if (p && fs.existsSync(p)) { fs.unlinkSync(p); n++; log(`[ok] deleted ${p}`, false); } }
    catch (e) { log(`[warn] could not delete ${p}: ${e.message}`, true); }
  }
  log(`[ok] ${n} file(s) removed - the MiniMax H3 text encoder and VAEs stay (every H3 video needs them), the node packs stay in ComfyUI's custom_nodes`, false);
  return { ok: true };
}

module.exports = { ITEMS, status, install, remove, comfySupport };
