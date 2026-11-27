// bitGen Studio — lib/pih3Addon.js (3.5.0): Settings ▸ Add-ons ▸ π pi-H3 - MiniMax H3 in 2 or 4 steps.
//
// Tim (verbatim): "can u add https://hanshengchen.com/blog/pi-h3/ , when asking the user to download, let user choose which
// model to dl".
// pi-H3 (Hansheng Chen et al., Stanford / Luma AI) distils MiniMax H3's FL2VA model into 2- or 4-step adapters; the DWD
// ones predict the frames at the last step, so the video skips the VAE decoder. It runs in ComfyUI with Lakonik's
// ComfyUI-piFlow nodes (Apache-2.0, ComfyUI 0.45+). The adapters are under the MiniMax H3 Community License (like H3).
// You pick what is downloaded (here, and in the box a pi-H3 style shows when its adapter is missing - static/pih3gen.js +
// static/needinstall.js "choose"):
//   nodes      github.com/Lakonik/ComfyUI-piFlow -> custom_nodes/ComfyUI-piFlow (git pull when it is there) - always
//   dwd2/dwd4  the 2-step / 4-step DWD adapter (int8, 2.2 GB each) -> models/loras - the "pi-H3 (2 / 4 steps)" styles
//   *_bf16     the same at full precision (3.8 GB each) - used when the int8 one is not there (scripts/pih3.py)
//   kjsol      Kijai's ComfyUI-SolAttn_triton (+ Triton) - a better sparse attention than ComfyUI's built-in INT8 one
//   base/te/vae  MiniMax H3's FL2VA int8 model, text encoder and VAEs - shared with MiniMax H3, skipped when you have them
// Spark-Attn (the pack's first choice) comes as a per-GPU archive from github.com/zechengtang/Spark-H3/releases - put it in
// custom_nodes yourself; scripts/pih3.py uses it when ComfyUI has it.
//   ITEMS   status(place?) -> {installed, have: {dwd2, dwd4}, note, items}   install(log, picks, deps)   remove(log, place?)
"use strict";
const fs = require("fs");
const path = require("path");

const REPO = "https://github.com/Lakonik/ComfyUI-piFlow";
const FOLDER = "ComfyUI-piFlow";
const KJ_REPO = "https://github.com/kijai/ComfyUI-SolAttn_triton";
const KJ_FOLDER = "ComfyUI-SolAttn_triton";
const ITEMS = [
  { id: "nodes", label: "pi-H3 nodes (ComfyUI-piFlow)", for: "Load LakonLab Adapter, pi-Flow Scheduler, DWD Decode - every pi-H3 style needs them", pack: true, dflt: true, need: true },
  { id: "dwd2", label: "2-step adapter (int8)", for: "the pi-H3 (2 steps) style - the fastest", files: ["pih3_dwd2"], dflt: true, steps: 2 },
  { id: "dwd4", label: "4-step adapter (int8)", for: "the pi-H3 (4 steps) style - a little slower, more detail", files: ["pih3_dwd4"], dflt: false, steps: 4 },
  { id: "dwd2_bf16", label: "2-step adapter (bf16, full precision)", for: "optional - used in place of the int8 one when that is not there", files: ["pih3_dwd2_bf16"], dflt: false, steps: 2 },
  { id: "dwd4_bf16", label: "4-step adapter (bf16, full precision)", for: "optional - used in place of the int8 one when that is not there", files: ["pih3_dwd4_bf16"], dflt: false, steps: 4 },
  { id: "kjsol", label: "Kijai's Sol-Attn (Triton)", for: "optional - sharper than ComfyUI's built-in INT8 sparse attention; the first video compiles its kernels", kj: true, dflt: false },
  { id: "base", label: "MiniMax H3 FL2VA model (int8)", for: "the model the adapters sit on - shared with MiniMax H3, skipped when you have it", files: ["h3_fl2va"], dflt: true, need: true },
  { id: "te", label: "Text encoder - H3's Qwen3-VL 32B (nvfp4)", for: "shared with MiniMax H3 - skipped when you have it", files: ["h3_te"], dflt: true, need: true },
  { id: "vae", label: "VAEs - H3 video + audio", for: "shared with MiniMax H3 - the video one only encodes a first / last frame", files: ["h3_vvae", "h3_avae"], dflt: true, need: true },
];
const ADAPTERS = ["dwd2", "dwd4", "dwd2_bf16", "dwd4_bf16"];
const DEFAULTS = ITEMS.filter((i) => i.dflt).map((i) => i.id);
const STYLES = ["pi-H3 (2 steps)", "pi-H3 (4 steps)"];
const MIN_COMFY = "0.45.0";
const LICENCE = "the adapters are under the MiniMax H3 Community License, like MiniMax H3 itself (not for the EU, the UK, South Korea or the USA without MiniMax's own licence; show \"MiniMax H3\" in a commercial product)";

const Models = () => require("./setupModels");
const entry = (id) => Models().byId(id);
const place = () => require("./aiFillAddon").place();
const paths = (pl) => ({ comfyModels: pl.models, app: require("./core").BASE });
const fmt = (b) => require("./aiFillAddon").fmt(b);
const sizeOf = (it) => (it.files || []).reduce((s, id) => s + ((entry(id) || {}).size || 0), 0);
const packDir = (pl, f) => (pl && pl.customNodes ? path.join(pl.customNodes, f || FOLDER) : "");

/** the picks (+ what is always needed), known ids only, in the list's order (pure) */
function wanted(picks) {
  const p = Array.isArray(picks) && picks.length ? picks : DEFAULTS;
  return ITEMS.filter((i) => i.need || p.includes(i.id)).map((i) => i.id);
}
/** which step counts have an adapter, int8 or bf16 (pure: present = {id: bool}) */
function haveOf(present) {
  const p = present || {};
  return { dwd2: !!(p.dwd2 || p.dwd2_bf16), dwd4: !!(p.dwd4 || p.dwd4_bf16) };
}

function status(pl0) {
  const pl = pl0 || place();
  const nodes = !!(packDir(pl) && fs.existsSync(path.join(packDir(pl), "lakonlab_loaders.py")));
  const kj = !!(packDir(pl, KJ_FOLDER) && fs.existsSync(packDir(pl, KJ_FOLDER)));
  const present = {};
  const items = ITEMS.map((it) => {
    const p = it.pack ? nodes : it.kj ? kj : !!pl.models && it.files.every((id) => { const m = entry(id); return !!m && Models().present(m, paths(pl)); });
    present[it.id] = p;
    return { id: it.id, label: it.label, for: it.for, dflt: !!it.dflt, need: !!it.need, present: p,
      size: it.pack ? "small" : it.kj ? "small (+ Triton)" : fmt(sizeOf(it)) };
  });
  const have = haveOf(present);
  const ready = nodes && present.base && present.te && present.vae && (have.dwd2 || have.dwd4);
  return { installed: ready, have, nodes, kjsol: kj, items,
    note: !pl.ok ? `ComfyUI not found (${pl.error}) - set its folder in Settings ▸ ComfyUI first`
      : ready ? `ready: ${[have.dwd2 && "2 steps", have.dwd4 && "4 steps"].filter(Boolean).join(" + ")}${kj ? " · Kijai's Sol-Attn" : ""} - pick a pi-H3 video style (restart ComfyUI after installing; ComfyUI ${MIN_COMFY} or later)`
      : items.some((i) => i.present && !i.need) ? "partly installed - Install again with what is missing ticked" : "not installed" };
}

async function install(log, picks, deps) {
  const d = deps || {};
  const pl = d.place || place();
  if (!pl.ok) return { ok: false, error: `ComfyUI not found (${pl.error}) - set its folder in Settings ▸ ComfyUI, then install again` };
  const want = wanted(picks);
  const st0 = d.place ? null : status(pl);
  if (!want.some((id) => ADAPTERS.includes(id)) && !(st0 && (st0.have.dwd2 || st0.have.dwd4)))
    return { ok: false, error: "tick an adapter - 2 steps or 4 steps (int8 or bf16)" };
  const X = d.exec || require("./setupExec");
  const env = Object.assign({}, process.env, { PYTHONUTF8: "1", GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" });
  const git = d.git !== undefined ? d.git : X.which("git", require("./setupRun").runtimeDirs());
  const fetchRepo = d.fetchRepo || require("./setupPacks").fetchRepo;
  // 1 the node packs
  const packs = [[REPO, FOLDER, "lakonlab_loaders.py"]].concat(want.includes("kjsol") ? [[KJ_REPO, KJ_FOLDER, ""]] : []);
  for (const [url, folder, marker] of packs) {
    const dir = packDir(pl, folder);
    if (fs.existsSync(dir) && fs.existsSync(path.join(dir, ".git")) && git) {
      log(`[..] ${folder} is in custom_nodes - git pull (the newest)`, false);
      if (await X.run(git, ["-C", dir, "pull", "--ff-only"], { log, env, timeout: 10 * 60000 }) !== 0) log("[warn] git pull did not finish - the copy there is kept", true);
    } else if (!fs.existsSync(dir)) {
      log(`[..] ${url} -> ${dir}`, false);
      const r = await fetchRepo(url, dir, { git, log, env });
      if (!r || !r.ok) return { ok: false, error: `could not fetch ${folder}: ` + ((r && r.error) || "git / the zip failed") };
    } else log(`[ok] ${folder} already in custom_nodes`, false);
    if (marker && !fs.existsSync(path.join(dir, marker))) return { ok: false, error: `the ${folder} copy has no ${marker} (${dir}) - remove it and install again` };
    const req = path.join(dir, "requirements.txt");
    if (pl.python && fs.existsSync(req)) {
      log(`[..] pip install -r requirements.txt (${folder}, ComfyUI's Python)`, false);
      if (await X.run(pl.python, ["-m", "pip", "install", "-r", req, "--progress-bar", "off"], { log, env, cwd: dir, timeout: 30 * 60000 }) !== 0) log("[warn] its requirements did not all install - see the log", true);
    }
  }
  if (want.includes("kjsol") && pl.python) {          // Kijai's Sol-Attn runs on Triton (Windows: triton-windows)
    const tri = process.platform === "win32" ? "triton-windows" : "triton";
    log(`[..] ${tri} for Kijai's Sol-Attn (ComfyUI's Python)`, false);
    if (await X.run(pl.python, ["-m", "pip", "install", "--upgrade", tri, "--progress-bar", "off"], { log, env, timeout: 30 * 60000 }) !== 0)
      log(`[warn] ${tri} did not install - pi-H3 renders with ComfyUI's built-in sparse attention until it does`, true);
  }
  // 2 the files you ticked (+ H3's shared ones when they are missing)
  const core = require("./core");
  const token = ((core.getConfig() || {}).hf || {}).token || "";
  const dl = d.download || ((m) => { let last = -1; return Models().download(m, { token, paths: paths(pl), python: require("./setupRun").appPython(), log, env, engine: "auto",
    onProgress: (p) => { const pc = p && p.total ? Math.floor((p.got / p.total) * 10) * 10 : -1; if (pc > last) { last = pc; log(`… ${m.as || path.basename(m.file)} ${pc} %`, false); } } }); });
  for (const id of want) {
    const it = ITEMS.find((i) => i.id === id);
    for (const fid of it.files || []) {
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
    if (made && made.length) log(`[ok] video styles back: ${made.join(", ")}`, false);
  } catch (e) { log(`[warn] the pi-H3 styles: ${e.message}`, true); }
  log(`[ok] pi-H3 installed - restart ComfyUI (${MIN_COMFY} or later), then pick "pi-H3 (2 steps)" or "pi-H3 (4 steps)" as the video style. Note: ${LICENCE}`, false);
  return { ok: true };
}

async function remove(log, pl0) {
  const pl = pl0 || place();
  let n = 0;
  for (const f of [FOLDER, KJ_FOLDER]) {
    const dir = packDir(pl, f);
    if (dir && fs.existsSync(dir)) { if (require("./setupPacks").safeRm(dir, log)) { n++; log(`[ok] removed ${dir}`, false); } }
  }
  if (pl.models) for (const id of ADAPTERS) for (const fid of ITEMS.find((i) => i.id === id).files) {
    const m = entry(fid); if (!m) continue;
    const p = Models().destPath(m, paths(pl));
    try { if (p && fs.existsSync(p)) { fs.unlinkSync(p); n++; log(`[ok] deleted ${p}`, false); } }
    catch (e) { log(`[warn] could not delete ${p}: ${e.message}`, true); }
  }
  log(`[ok] ${n} pi-H3 item(s) removed - MiniMax H3's model, text encoder and VAEs stay (MiniMax H3 uses them), the styles stay`, false);
  return { ok: true };
}

module.exports = { REPO, FOLDER, KJ_REPO, ITEMS, ADAPTERS, DEFAULTS, STYLES, MIN_COMFY, LICENCE, wanted, haveOf, status, install, remove };
