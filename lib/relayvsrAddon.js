// bitGen Studio — lib/relayvsrAddon.js (2.728.0): Settings ▸ Add-ons ▸ RelayVSR - download its model files.
//
// Tim (verbatim): "yes please add a 1920x1080 automatic preset and add https://github.com/kopperx/RelayVSR"
// RelayVSR (kopperx/RelayVSR, Apache-2.0) runs in ComfyUI's OWN nodes since PR #17511 (2026-11-05: RelayVSRConditioning +
// VSRDecode, master after commit 2f89433 - newer than the v0.44.0 release; comfy-kitchen 0.2.41 from ComfyUI's
// requirements.txt) - no node pack, no venv, nothing imported. The add-on downloads Comfy-Org/RelayVSR's repacks (Apache-
// 2.0; lib/modelCatalog.json group "upscale") into ComfyUI's models/diffusion_models + models/vae - the pairs you tick:
//   x2  relayvsr_x2_lightx2v_int8_convrot + relayvsr_flash_vae_x2_fp32  (LightX2V's, trained on MiniMax H3 clips - the
//       one for a 960x544 render -> 1920x1080; ticked by default)
//   x4  relayvsr_x4_int8_convrot + relayvsr_flash_vae_x4_fp32            (the original - 4K from a small clip)
// and asks the running ComfyUI whether it has the nodes (older = update ComfyUI on the "latest" channel).
//   ITEMS                        [{id, label, for, files: [catalog ids], dflt}]
//   status(place?)               {installed, note, items: [{id, label, for, size, present, dflt}]}
//   install(log, picks, deps)    -> {ok, error}  (deps: place / download / comfy (async -> {online, nodes}))
//   remove(log, place?)          -> {ok, error}  (the downloaded files)
"use strict";
const fs = require("fs");
const path = require("path");

const ITEMS = [
  { id: "x2", label: "RelayVSR x2 (LightX2V, trained on H3 clips)", for: "the x2 pair - an H3 / LTX render to 1080p or 1920 x 1080", files: ["relayvsr_x2", "relayvsr_vae_x2"], dflt: true },
  { id: "x4", label: "RelayVSR x4 (the original)", for: "the x4 pair - 4K (2160p) from a small clip", files: ["relayvsr_x4", "relayvsr_vae_x4"], dflt: false },
];
const DEFAULTS = ITEMS.filter((i) => i.dflt).map((i) => i.id);
const UPDATE = "update ComfyUI to the newest (Settings ▸ ComfyUI ▸ ⤓ Update ComfyUI on the \"latest\" channel, the portable build's "
  + "update\\update_comfyui.bat, or git pull + pip install -r requirements.txt), then restart it - RelayVSR is in ComfyUI's core since "
  + "5 Nov 2026, newer than the v0.44.0 release";

const Models = () => require("./setupModels");
const entry = (id) => Models().byId(id);
const place = () => require("./aiFillAddon").place();
const paths = (pl) => ({ comfyModels: pl.models, app: require("./core").BASE });
const sizeOf = (it) => it.files.reduce((s, id) => s + ((entry(id) || {}).size || 0), 0);
const fmt = (b) => require("./aiFillAddon").fmt(b);
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
        + " - the preview's 🔁 RelayVSR, or the video docker's ⚙ Upscaler \"RelayVSR\" (ComfyUI newer than v0.44.0)"
      : "not installed" };
}

/** does the running ComfyUI have the RelayVSR nodes? -> {online, nodes} */
const comfySupport = (o) => require("./relayvsr").comfySupport(o);

async function install(log, picks, deps) {
  const d = deps || {};
  const pl = d.place || place();
  if (!pl.ok) return { ok: false, error: `ComfyUI not found (${pl.error}) - set its folder in Settings ▸ ComfyUI, then install again` };
  const want = wanted(picks);
  if (!want.length) return { ok: false, error: "tick x2, x4 or both" };
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
  const cs = await (d.comfy || comfySupport)();
  if (cs.online && !cs.nodes) log("[warn] this ComfyUI has no RelayVSR nodes yet - " + UPDATE, true);
  else if (cs.online) log("[ok] ComfyUI has the RelayVSR nodes - 🔁 RelayVSR in the preview bar (restart ComfyUI if it does not list the new files)", false);
  else log("[ok] files in place - RelayVSR needs ComfyUI newer than the v0.44.0 release (its own RelayVSR nodes)", false);
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
  log(`[ok] ${n} RelayVSR file(s) removed`, false);
  return { ok: true };
}

module.exports = { ITEMS, DEFAULTS, UPDATE, wanted, status, install, remove, comfySupport };
