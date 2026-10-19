"use strict";
/**
 * bitGen Studio — the NATIVE ENGINE behind Viggle (native) (2.352.0).
 *
 * Tim: "can we build our own wan2gp engine?" -> Viggle (native) (2.351.0). Tim then kept ComfyUI as THE
 * engine ("keep comfy and the engine as it is ... users without 32gb vram can still use it through comfy")
 * and reported "the viggle doesn't render at all now, 200sec elapsed and no steps started": 2.351 loaded
 * the 66 GB transformer in bf16 AND pinned a second copy for streaming - more than 128 GB of RAM.
 *
 * Now Viggle (native) runs on a resident server (scripts/native/server.py in venvs/native) that keeps the
 * model int8 in RAM (~half), streams it block by block to the GPU (scripts/native/wstream.py - Wan2GP's
 * technique, written from scratch) and keeps it loaded between segments. Weights: Tim's ComfyUI Viggle
 * files when the engine can read them (a header-only check: scripts/native/check.py), else the official
 * download.
 *
 * This module: the components Viggle needs, finding ComfyUI candidates, the chosen source per component
 * (saved in config.native.sources for the worker), readiness. Pure except the fs reads.
 */
const fs = require("fs");
const path = require("path");

const FPS = 24;
// ---- the components (mirrors scripts/native/fetch.py)
const COMPONENTS = [
  { id: "base", label: "configs, tokenizer, schedulers", gb: 0.03, official: "MiniMax-H3/modular_model_index.json", comfy: null, need: ["viggle"] },
  { id: "vae", label: "video VAE", gb: 10.4, official: "MiniMax-H3/vae", comfy: { folders: ["vae"], re: /minimax[_-]?h3.*video[_-]?vae|h3[_-]video[_-]vae/i }, need: ["viggle"] },
  { id: "audio_vae", label: "audio VAE", gb: 0.6, official: "MiniMax-H3/audio_vae", comfy: { folders: ["vae", "audio_encoders"], re: /minimax[_-]?h3.*audio[_-]?vae/i }, need: ["viggle"] },
  { id: "viggle", label: "Viggle-Animate transformer", gb: 66, official: "Viggle-Animate/transformer", comfy: { folders: ["diffusion_models", "unet"], re: /viggle/i }, need: ["viggle"] },
  { id: "viggle_lora", label: "Viggle DMD LoRA", gb: 2.5, official: "Viggle-Animate/lora/pytorch_lora_weights.safetensors", comfy: { folders: ["loras"], re: /viggle.*dmd|dmd.*viggle/i }, need: ["viggle"] },
  { id: "viggle_assets", label: "Viggle prompt embedding", gb: 0.01, official: "Viggle-Animate/assets/fixed_embed_fwd_anyframe.pt", comfy: null, need: ["viggle"] },
];
const BYID = Object.fromEntries(COMPONENTS.map((c) => [c.id, c]));
// what each download id fetches (fetch.py): the official side of a component
// (2.353.0: the DMD LoRA is its own download - a missing LoRA no longer pulls the 66 GB transformer)
const FETCH_ID = { base: "base", vae: "vae", audio_vae: "audio_vae", viggle: "viggle", viggle_lora: "viggle_lora", viggle_assets: "viggle_assets" };
// a ComfyUI file the engine cannot read, by its name (the header check says it precisely; this just skips the obvious)
const UNREADABLE = /nvfp4|w6a8|w4a[0-9]|awq|gguf|mxfp|svdq/i;
const DIFFUSERS_COMMIT = "d6726f3";
const PREFER = ["both", "official", "comfy"];

function defaults() {
  return { venv: "", dir: "", port: 8199, prefer: "both", pack: "int8", pin: true, ram_budget_gb: 0,
           idle_unload_min: 20, idle_exit_min: 120, free_comfy: true, device: "auto",
           picks: {}, checks: {}, sources: {}, base: "", lora_dirs: [], python: "" };
}
function cfgOf(config) { return { ...defaults(), ...((config || {}).native || {}) }; }

/** venv + weights folder (2.351's venvs/viggle + models/viggle_native are used when they are what exists). */
function paths(n, base, modelsDir, resolve) {
  const r = resolve || ((p) => path.resolve(base || ".", p));
  const win = process.platform === "win32";
  let venv = String(n.venv || "").trim() ? r(n.venv) : r(path.join("venvs", "native"));
  const legacyV = r(path.join("venvs", "viggle"));
  if (!String(n.venv || "").trim() && !fs.existsSync(venv) && fs.existsSync(legacyV)) venv = legacyV;
  let root = String(n.dir || "").trim() ? r(n.dir) : path.join(modelsDir || r("models"), "native");
  const legacyR = path.join(modelsDir || r("models"), "viggle_native");
  if (!String(n.dir || "").trim() && !fs.existsSync(root) && fs.existsSync(legacyR)) root = legacyR;
  return { venv, python: path.join(venv, win ? "Scripts" : "bin", win ? "python.exe" : "python"), root,
           base: path.join(root, "MiniMax-H3"), viggle: path.join(root, "Viggle-Animate") };
}

/** Is the official side of a component on disk? */
function officialPath(p, comp) { return path.join(p.root, BYID[comp].official); }
function hasOfficial(p, comp) {
  const f = officialPath(p, comp);
  try {
    const s = fs.statSync(f);
    if (s.isFile()) return s.size > 0;
    return fs.readdirSync(f).some((x) => x.endsWith(".safetensors"));
  } catch { return false; }
}

/** ComfyUI's model folders: <dir>/ComfyUI/models or <dir>/models, + bitGen's extra_model_paths entries. */
function comfyRoots(comfyDir, extra, resolve) {
  const out = new Map();                     // type -> [dirs]
  const add = (t, d) => { if (d && fs.existsSync(d)) { const l = out.get(t) || []; if (!l.includes(d)) l.push(d); out.set(t, l); } };
  const dir = String(comfyDir || "").trim();
  if (dir) {
    const abs = resolve ? resolve(dir) : path.resolve(dir);
    for (const m of [path.join(abs, "ComfyUI", "models"), path.join(abs, "models")])
      if (fs.existsSync(m)) for (const t of ["diffusion_models", "unet", "vae", "audio_encoders", "loras"]) add(t, path.join(m, t));
  }
  const e = extra || {};
  for (const [t, v] of Object.entries(e.entries || {})) {
    for (const one of String(v || "").split(/\r?\n|;/).map((x) => x.trim()).filter(Boolean)) {
      add(t, path.isAbsolute(one) ? one : path.join(e.base_path || "", one));
    }
  }
  return out;
}

function walk(dir, depth, acc) {
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const d of ents) {
    const p = path.join(dir, d.name);
    if (d.isDirectory() && depth > 0) walk(p, depth - 1, acc);
    else if (d.isFile() && /\.safetensors$/i.test(d.name)) acc.push(p);
  }
  return acc;
}

/* 2.353.0 (Tim: "check if comfy workflow for the component exists, if it exists use the models in the
   workflow so user doesn't have to dl new ones"): the model files Tim's ComfyUI workflows NAME. The Viggle
   workflows are read first (they name exactly the Viggle model, its DMD LoRA and the H3 VAE ComfyUI
   renders with), then every other workflow in comfy_workflows/ (an H3 scene graph names the audio VAE).
   A name is a path under the component's ComfyUI model folders (a subfolder, / or \ both work). */
const VIGGLE_WORKFLOWS = ["viggle_animate_h3_api.json", "H3_Viggle_ref2va.json", "H3_Viggle_fl2va.json"];

/** Every model-file name a workflow names (API: node inputs; UI export: widgets_values). */
function namesIn(graph) {
  const out = [];
  const add = (v) => { if (typeof v === "string" && /\.(safetensors|sft|pt|pth|ckpt|gguf)$/i.test(v.trim())) out.push(v.trim()); };
  const nodes = graph && Array.isArray(graph.nodes) ? graph.nodes : Object.values(graph || {});
  for (const nd of nodes) {
    if (!nd || typeof nd !== "object") continue;
    for (const v of Object.values(nd.inputs && !Array.isArray(nd.inputs) ? nd.inputs : {})) add(v);
    for (const v of Array.isArray(nd.widgets_values) ? nd.widgets_values : []) add(v);
  }
  return out;
}

/** {component: {name, workflow}} - the first workflow naming a file for each component (Viggle's first). */
function workflowModels(base) {
  const dir = path.join(base || ".", "comfy_workflows");
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => /\.json$/i.test(f) && !/^e2e_/.test(f)); } catch { return {}; }
  files.sort((a, b) => (VIGGLE_WORKFLOWS.includes(b) - VIGGLE_WORKFLOWS.includes(a))
    || (VIGGLE_WORKFLOWS.indexOf(a) - VIGGLE_WORKFLOWS.indexOf(b)) || a.localeCompare(b));
  const out = {};
  for (const f of files) {
    let g = null;
    try { g = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch { continue; }
    for (const name of namesIn(g)) {
      const b = name.replace(/\\/g, "/").split("/").pop();
      if (UNREADABLE.test(b)) continue;
      for (const c of COMPONENTS) {
        if (!c.comfy || out[c.id] || !c.comfy.re.test(b) || (c.comfy.not && c.comfy.not.test(b))) continue;
        out[c.id] = { name, workflow: f };
      }
    }
  }
  return out;
}

/** The workflow-named files that exist in ComfyUI's model folders: {component: {file, name, workflow}}. */
function workflowFiles(base, roots) {
  const out = {};
  for (const [id, w] of Object.entries(workflowModels(base))) {
    const rel = w.name.replace(/\\/g, "/").split("/").filter(Boolean);
    for (const t of BYID[id].comfy.folders) {
      const hit = (roots.get(t) || []).map((d) => path.join(d, ...rel)).find((f) => { try { return fs.statSync(f).isFile(); } catch { return false; } });
      if (hit) { out[id] = { file: hit, name: w.name, workflow: w.workflow }; break; }
    }
  }
  return out;
}

/** candidates() + the workflow-named files, those first. */
function withWorkflow(cands, wf) {
  const out = { ...cands };
  for (const [id, w] of Object.entries(wf || {})) out[id] = [w.file, ...(out[id] || []).filter((f) => f !== w.file)];
  return out;
}

/** Rank: full before pruned, bf16/fp16 before int8 before fp8. */
function rank(file) {
  const b = path.basename(file).toLowerCase();
  let r = 0;
  if (/pruned/.test(b)) r += 10;
  if (/bf16|fp16|fp32/.test(b)) r += 0; else if (/int8/.test(b)) r += 1; else if (/fp8/.test(b)) r += 2; else r += 1;
  return r;
}

/** {component: [files]} of ComfyUI files that look like each component. */
function candidates(roots) {
  const out = {};
  for (const c of COMPONENTS) {
    if (!c.comfy) continue;
    const files = [];
    for (const t of c.comfy.folders) for (const d of roots.get(t) || []) walk(d, 3, files);
    out[c.id] = [...new Set(files)].filter((f) => c.comfy.re.test(path.basename(f)) && !(c.comfy.not && c.comfy.not.test(path.basename(f)))
      && !UNREADABLE.test(path.basename(f))).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  }
  return out;
}

/** The check cache key of a file: path + size + mtime (a replaced file is checked again). */
function fileKey(f) {
  try { const s = fs.statSync(f); return `${f}|${s.size}|${Math.round(s.mtimeMs)}`; } catch { return ""; }
}

/**
 * The source each component uses. n = cfgOf(config); p = paths(); cands = candidates().
 * prefer: both (a checked-OK ComfyUI file, else the official download), official, comfy.
 * n.picks[comp] = a file the user chose (or "official"). -> {comp: {source, how, file?, why}}
 */
function resolve(n, p, cands, wf) {
  const out = {};
  const prefer = PREFER.includes(n.prefer) ? n.prefer : "both";
  for (const c of COMPONENTS) {
    const off = hasOfficial(p, c.id);
    const list = (cands[c.id] || []).map((f) => ({ file: f, check: (n.checks || {})[fileKey(f)] || null }));
    const pick = (n.picks || {})[c.id];
    const okComfy = list.find((x) => x.check && x.check.ok && (!pick || pick === x.file));
    const pendingComfy = list.find((x) => !x.check);
    let r;
    if (pick === "official" || prefer === "official" || !c.comfy) {
      r = off ? { source: { official: officialPath(p, c.id) }, how: "official" } : { source: null, how: "missing" };
    } else if (okComfy) {
      r = { source: { comfy: okComfy.file }, how: "comfy", file: okComfy.file, why: okComfy.check.why };
    } else if (prefer === "comfy" && !off) {
      r = { source: null, how: pendingComfy ? "unchecked" : "missing" };
    } else {
      r = off ? { source: { official: officialPath(p, c.id) }, how: "official" } : { source: null, how: pendingComfy ? "unchecked" : "missing" };
    }
    r.candidates = list.map((x) => ({ file: x.file, ok: x.check ? x.check.ok : null, why: x.check ? x.check.why : "not checked yet" }));
    r.official = off;
    // 2.353.0: the file Tim's ComfyUI workflow names for it (used first once checked)
    if (wf && wf[c.id]) r.workflow = { file: wf[c.id].file, name: wf[c.id].name, from: wf[c.id].workflow,
                                       check: (n.checks || {})[fileKey(wf[c.id].file)] || null };
    out[c.id] = r;
  }
  return out;
}

/** What config.native carries to the workers (sources by the names the engine uses). */
function forWorkers(res, p, loraDirs) {
  const s = {};
  for (const id of ["vae", "audio_vae", "viggle", "viggle_lora", "viggle_assets"])
    if (res[id] && res[id].source) s[id] = res[id].source;
  return { sources: s, base: p.base, python: p.python, lora_dirs: loraDirs || [] };
}

/** Ready for a use ("viggle")? -> {ready, missing: [labels], gb (to download)} */
function readiness(res, venvReady, use) {
  const need = COMPONENTS.filter((c) => c.need.includes(use));
  const miss = need.filter((c) => !(res[c.id] && res[c.id].source));
  return { ready: venvReady && !miss.length, venv: venvReady, missing: miss.map((c) => c.id),
           // 2.353.0: a part the ComfyUI workflow's file covers is not counted as a download
           labels: miss.map((c) => c.label), gb: Math.round(miss.filter((c) => !trusted(res[c.id])).reduce((a, c) => a + c.gb, 0) * 10) / 10 };
}

function notReady(r, use) {
  if (r.ready) return "";
  const what = "Viggle (native)";
  const parts = [];
  if (!r.venv) parts.push("its Python environment");
  if (r.labels.length) parts.push(`${r.labels.join(", ")} (~${r.gb} GB to download, or point it at your ComfyUI files)`);
  return `${what} is not installed yet - ${parts.join(" and ")}: the swap dialog's ⚙ -> Viggle native -> ⤓ Install`;
}

/** The download ids a use still needs (official side). 2.353.0: a component whose ComfyUI workflow names a
 *  file that exists and has not FAILED its check is not downloaded - the install checks it once the venv
 *  is there (routes/native.afterInstall) and fetches it only if the engine cannot read it. */
function fetchList(res, use) {
  const ids = new Set();
  for (const c of COMPONENTS) {
    if (!c.need.includes(use) || (res[c.id] && res[c.id].source)) continue;
    if (trusted(res[c.id])) continue;
    ids.add(FETCH_ID[c.id]);
  }
  if (ids.size && !(res.base && res.base.source)) ids.add("base");
  return ["base", "vae", "audio_vae", "viggle", "viggle_lora", "viggle_assets"].filter((x) => ids.has(x));
}
/** A workflow-named file waiting for its check (not failed). */
function trusted(r) { return !!(r && r.workflow && !(r.workflow.check && r.workflow.check.ok === false)); }

function settingsSafe(b) {
  const d = defaults(), x = b || {};
  const num = (v, def, lo, hi) => (Number.isFinite(+v) && v !== "" && v !== null ? Math.max(lo, Math.min(hi, +v)) : def);
  const out = {};
  if ("prefer" in x) out.prefer = PREFER.includes(x.prefer) ? x.prefer : d.prefer;
  if ("pack" in x) out.pack = x.pack === "bf16" ? "bf16" : "int8";
  if ("pin" in x) out.pin = x.pin !== false;
  if ("free_comfy" in x) out.free_comfy = x.free_comfy !== false;
  if ("port" in x) out.port = Math.round(num(x.port, d.port, 1024, 65535));
  if ("ram_budget_gb" in x) out.ram_budget_gb = num(x.ram_budget_gb, 0, 0, 4096);
  if ("idle_unload_min" in x) out.idle_unload_min = num(x.idle_unload_min, d.idle_unload_min, 0, 1440);
  if ("idle_exit_min" in x) out.idle_exit_min = num(x.idle_exit_min, d.idle_exit_min, 0, 10080);
  if ("device" in x) out.device = /^(auto|cpu|cuda(:\d+)?)$/.test(String(x.device)) ? String(x.device) : "auto";
  for (const k of ["dir", "venv"]) if (typeof x[k] === "string") out[k] = x[k].trim().slice(0, 500);
  if (x.picks && typeof x.picks === "object") {
    out.picks = {};
    for (const [k, v] of Object.entries(x.picks)) if (BYID[k] && typeof v === "string" && v) out.picks[k] = v.slice(0, 1000);
  }
  return out;
}

/** Recompute + store config.native.{sources, base, python, lora_dirs} (the part the workers read). */
function refreshConfig(config, env) {
  const n = cfgOf(config);
  const p = paths(n, env.BASE, env.MODELS_DIR, env.resolvePath);
  const roots = comfyRoots(((config.engine || {}).comfy || {}).dir, env.comfyExtra ? env.comfyExtra() : {}, env.resolvePath);
  const wf = workflowFiles(env.BASE, roots);
  const cands = withWorkflow(candidates(roots), wf);
  const res = resolve(n, p, cands, wf);
  const w = forWorkers(res, p, [...(roots.get("loras") || [])]);
  const cur = config.native || {};
  const changed = JSON.stringify([cur.sources, cur.base, cur.python, cur.lora_dirs]) !== JSON.stringify([w.sources, w.base, w.python, w.lora_dirs]);
  if (changed) {
    config.native = { ...defaults(), ...cur, ...w };
    if (env.save) env.save();
  }
  return { n: cfgOf(config), p, res, roots, changed, cands, wf };
}

module.exports = { refreshConfig, FPS, COMPONENTS, BYID, FETCH_ID, UNREADABLE, DIFFUSERS_COMMIT, PREFER, defaults, cfgOf, paths, officialPath,
                   hasOfficial, comfyRoots, candidates, fileKey, resolve, forWorkers, readiness, notReady, fetchList, settingsSafe, rank,
                   VIGGLE_WORKFLOWS, namesIn, workflowModels, workflowFiles, withWorkflow, trusted };
