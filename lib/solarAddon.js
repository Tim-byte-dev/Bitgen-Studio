// bitGen Studio — lib/solarAddon.js (2.588.0): Settings ▸ Add-ons ▸ SolarRenderer.
//
// Tim: "add https://enderfga.cn/SolarRenderer/".
// SolarRenderer (Enderfga - "Few-Step Generative Reference Rendering", arXiv 2610.28630) renders a STRUCTURE video -
// grey boxes, a semantic map, skeletons, depth, normals, a body mesh, a sketch, a three.js page - plus an optional first
// frame and a six-part prompt into the finished clip, in 4 steps. It is a control LoRA + a four-step LoRA on frozen
// MiniMax H3 (ref2va); a causal LoRA pair renders long clips block by block.
// The add-on:
//   - the NODE PACK: github.com/Enderfga/SolarRenderer cloned into ComfyUI's custom_nodes/SolarRenderer (its README:
//     "cd ComfyUI/custom_nodes && git clone https://github.com/Enderfga/SolarRenderer"). The ComfyUI nodes came in the
//     repo's pull request #3 - a clone without comfyui/nodes.py fetches that branch (pull/3/head). Only comfyui/'s own
//     requirements are installed (the repo's root package wants flash-attn - the ComfyUI nodes do not need it)
//   - the LoRAs you tick, from Enderfga/SolarRenderer into ComfyUI's models/loras (file names from the README's table)
//   - MiniMax H3's ref2va model, text encoder and VAE are the H3 files bitGen already uses (Settings ▸ Setup) - the
//     pack's workflows name the bf16 / int8 encoder; ⤒ Import & check says which file is missing and the graph can be
//     pointed at the one you have
//   - its WORKFLOWS (workflows/solarrenderer_full.json, _low_memory.json, _long.json in the pack) are imported through
//     Settings ▸ ComfyUI ▸ Graphs ▸ ☀ SolarRenderer (routes/solar.js -> ⤒ Import & check: the inputs counted, a test
//     run, saved as a workflow when it works)
// What was NOT verified here (the GitHub / Hugging Face pages could not be opened from the build machine): the nodes'
// input names (so bitGen builds no SolarRenderer graph of its own - it imports the pack's), the LoRA sizes (read live on
// download) and whether pull request #3 is merged (both cases are handled).
// The weights carry the MiniMax H3 Community License (with its territorial restrictions - the EU, the UK, South Korea
// and the US are excluded) and its Acceptable Use Policy; the code is Apache-2.0 (NOTICE.md).
//   status(place?)               {installed, pack, note, items, workflows}
//   install(log, picks, deps)    -> {ok, error}     remove(log, place?) -> {ok, error} (the LoRAs + the pack folder)
//   workflows(place?)            -> [{file, name, size}]   the pack's .json workflows
"use strict";
const fs = require("fs");
const path = require("path");

const REPO = "https://github.com/Enderfga/SolarRenderer";
const FOLDER = "SolarRenderer";
const PR_REF = "pull/3/head";
const ITEMS = [
  { id: "lora", label: "Control + four-step LoRAs", for: "the full-quality and low-memory workflows - needed", files: ["solar_control", "solar_4step"], dflt: true, need: true },
  { id: "causal", label: "Causal LoRA pair (long clips)", for: "optional - the long-clip workflow (block-causal streaming)", files: ["solar_causal_control", "solar_causal_4step"], dflt: false },
  { id: "tae", label: "TAEH3 preview decoder", for: "optional - live previews while it renders (shared with H3)", files: ["taeh3"], dflt: false },
];
const DEFAULTS = ITEMS.filter((i) => i.dflt).map((i) => i.id);
const Models = () => require("./setupModels");
const entry = (id) => Models().byId(id);
const place = () => require("./aiFillAddon").place();
const paths = (pl) => ({ comfyModels: pl.models, app: require("./core").BASE });
const fmt = (b) => require("./aiFillAddon").fmt(b);
function wanted(picks) {
  const p = Array.isArray(picks) && picks.length ? picks : DEFAULTS;
  return ITEMS.filter((i) => i.need || p.includes(i.id)).map((i) => i.id);
}
const packDir = (pl) => (pl && pl.customNodes ? path.join(pl.customNodes, FOLDER) : "");
/** does the pack folder hold the ComfyUI nodes? */
function packState(dir) {
  if (!dir || !fs.existsSync(dir)) return { present: false, nodes: false, root_init: false };
  const nodes = fs.existsSync(path.join(dir, "comfyui", "nodes.py")) || fs.existsSync(path.join(dir, "nodes.py"));
  return { present: true, nodes, root_init: fs.existsSync(path.join(dir, "__init__.py")) };
}
/** the pack's workflow files (workflows/*.json, comfyui/workflows/*.json) */
function workflows(pl0) {
  const dir = packDir(pl0 || place());
  const out = [];
  for (const sub of ["workflows", path.join("comfyui", "workflows"), path.join("comfyui", "example_workflows"), "example_workflows"]) {
    let fl = [];
    try { fl = fs.readdirSync(path.join(dir, sub)).filter((f) => /\.json$/i.test(f)).sort(); } catch { fl = []; }
    for (const f of fl) { const p = path.join(dir, sub, f); let size = 0; try { size = fs.statSync(p).size; } catch { size = 0; } out.push({ file: path.join(sub, f).replace(/\\/g, "/"), name: f.replace(/\.json$/i, ""), size }); }
  }
  return out;
}
function readWorkflow(file, pl0) {
  const dir = packDir(pl0 || place());
  const list = workflows(pl0);
  const hit = list.find((w) => w.file === String(file || "").replace(/\\/g, "/"));
  if (!hit) { const e = new Error("no such SolarRenderer workflow - install the add-on (Settings ▸ Add-ons ▸ SolarRenderer)"); e.status = 404; throw e; }
  return { name: hit.name, text: fs.readFileSync(path.join(dir, hit.file), "utf8") };
}

function status(pl0) {
  const p = pl0 || place();
  const ps = packState(packDir(p));
  const items = ITEMS.map((it) => ({ id: it.id, label: it.label, for: it.for, dflt: it.dflt, need: !!it.need,
    size: it.files.every((id) => (entry(id) || {}).size) ? fmt(it.files.reduce((s, id) => s + ((entry(id) || {}).size || 0), 0)) : "size read on download",
    present: !!p.models && it.files.every((id) => { const m = entry(id); return !!m && Models().present(m, paths(p)); }) }));
  const loras = (items.find((x) => x.id === "lora") || {}).present;
  const ready = ps.nodes && loras;
  const wf = ps.present ? workflows(p) : [];
  return { installed: ready, pack: ps.nodes, items, workflows: wf.map((w) => w.name),
    note: !p.ok ? `ComfyUI not found (${p.error}) - set its folder in Settings ▸ ComfyUI first`
      : ready ? `ready: the node pack + ${items.filter((i) => i.present).map((i) => i.label).join(", ")}${wf.length ? ` - Settings ▸ ComfyUI ▸ Graphs ▸ ☀ SolarRenderer imports its ${wf.length} workflow(s)` : ""} (restart ComfyUI after installing)`
      : ps.present && !ps.nodes ? "the pack folder is there but has no ComfyUI nodes (comfyui/nodes.py) - Install again"
      : loras ? "the LoRAs are there - the node pack is missing (Install again)" : "not installed" };
}

async function install(log, picks, deps) {
  const d = deps || {};
  const pl = d.place || place();
  if (!pl.ok) return { ok: false, error: `ComfyUI not found (${pl.error}) - set its folder in Settings ▸ ComfyUI, then install again` };
  const X = d.exec || require("./setupExec");
  const env = Object.assign({}, process.env, { PYTHONUTF8: "1", GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" });
  // 1. the node pack
  const dir = packDir(pl);
  let ps = packState(dir);
  if (!ps.present) {
    log(`[..] the node pack: ${REPO} -> ${dir}`, false);
    const git = d.git !== undefined ? d.git : X.which("git", require("./setupRun").runtimeDirs());
    const r = await (d.fetchRepo || require("./setupPacks").fetchRepo)(REPO, dir, { git, log, env });
    if (!r || !r.ok) return { ok: false, error: "could not fetch the SolarRenderer node pack: " + ((r && r.error) || "git / the zip failed") };
    ps = packState(dir);
  } else log(`[ok] ${FOLDER} already in custom_nodes`, false);
  if (!ps.nodes) {
    // the ComfyUI nodes came in pull request #3 - not merged yet = fetch that branch
    const git = d.git !== undefined ? d.git : X.which("git", require("./setupRun").runtimeDirs());
    if (git && fs.existsSync(path.join(dir, ".git"))) {
      log(`[..] the ComfyUI nodes are not on the main branch here - fetching ${PR_REF} (pull request #3)`, false);
      const c1 = await X.run(git, ["-C", dir, "fetch", "--depth", "1", "origin", `${PR_REF}:comfyui-nodes`], { log, env, timeout: 10 * 60000 });
      const c2 = c1 === 0 ? await X.run(git, ["-C", dir, "checkout", "comfyui-nodes"], { log, env, timeout: 120000 }) : 1;
      if (c2 !== 0) log("[warn] could not check out pull request #3 - see the log", true);
      ps = packState(dir);
    }
    if (!ps.nodes) return { ok: false, error: `the SolarRenderer repo has no ComfyUI nodes (comfyui/nodes.py) here${git ? "" : " - git is needed to fetch pull request #3 (Settings ▸ General ▸ Setup installs it)"}` };
  }
  log("[ok] SolarRenderer's ComfyUI nodes are there" + (ps.root_init ? "" : " - but the repo has no __init__.py at its top: ComfyUI may not load it; see the pack's README"), !ps.root_init);
  // only comfyui/'s own requirements (the root package wants flash-attn - the nodes do not)
  const req = path.join(dir, "comfyui", "requirements.txt");
  if (pl.python && fs.existsSync(req)) {
    log("[..] pip install -r comfyui/requirements.txt (ComfyUI's Python)", false);
    const code = await X.run(pl.python, ["-m", "pip", "install", "-r", req, "--progress-bar", "off"], { log, env, cwd: dir, timeout: 30 * 60000 });
    if (code !== 0) log("[warn] its requirements did not all install - see the log; the nodes may still load", true);
  }
  // 2. the LoRAs
  const core = require("./core");
  const token = ((core.getConfig() || {}).hf || {}).token || "";
  const dl = d.download || ((m) => { let last = -1; return Models().download(m, { token, paths: paths(pl), python: require("./setupRun").appPython(), log, env, engine: "auto",
    onProgress: (p) => { const pc = p && p.total ? Math.floor((p.got / p.total) * 10) * 10 : -1; if (pc > last) { last = pc; log(`… ${path.basename(m.file)} ${pc} %`, false); } } }); });
  for (const id of wanted(picks)) {
    const it = ITEMS.find((i) => i.id === id);
    for (const fid of it.files) {
      const m = entry(fid);
      if (!m) { log(`[warn] ${fid} is not in the model list`, true); continue; }
      if (!d.download && !require("./reinstallForce").on() && Models().present(m, paths(pl))) { log(`[ok] ${path.basename(m.file)} (already there)`, false); continue; }
      log(`[..] ${it.label}: ${m.repo}/${m.file}`, false);
      const r = await dl(m);
      if (!r || !r.ok) return { ok: false, error: `${path.basename(m.file)}: ${(r && r.error) || "the download failed"}` };
      log(`[ok] ${path.basename(m.file)}`, false);
    }
  }
  const wf = workflows(pl);
  log(`[ok] SolarRenderer installed - restart ComfyUI, then Settings ▸ ComfyUI ▸ Graphs ▸ ☀ SolarRenderer imports ${wf.length ? "its workflows (" + wf.map((w) => w.name).join(", ") + ")" : "its workflows"} through ⤒ Import & check. It renders on MiniMax H3's ref2va model, text encoder and VAE (the H3 files from Settings ▸ Setup).`, false);
  log("[ok] the weights carry the MiniMax H3 Community License (the EU, the UK, South Korea and the US are excluded territories) - see NOTICE.md", false);
  return { ok: true };
}

async function remove(log, pl0) {
  const pl = pl0 || place();
  let n = 0;
  for (const it of ITEMS) {
    if (it.id === "tae") continue;                                 // shared with H3's previews
    for (const fid of it.files) {
      const m = entry(fid); if (!m || !pl.models) continue;
      const p = Models().destPath(m, paths(pl));
      try { if (p && fs.existsSync(p)) { fs.unlinkSync(p); n++; log(`[ok] deleted ${p}`, false); } } catch (e) { log(`[warn] could not delete ${p}: ${e.message}`, true); }
    }
  }
  const dir = packDir(pl);
  if (dir && fs.existsSync(dir)) {
    const ok = require("./setupPacks").safeRm(dir, log);
    log(ok ? `[ok] removed ${dir}` : `[warn] could not remove ${dir} - delete it by hand`, !ok);
  }
  log(`[ok] SolarRenderer removed (${n} LoRA file(s)) - restart ComfyUI. The workflows you saved stay in comfy_workflows/`, false);
  return { ok: true };
}

module.exports = { REPO, FOLDER, PR_REF, ITEMS, DEFAULTS, wanted, packDir, packState, workflows, readWorkflow, status, install, remove };
