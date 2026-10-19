// bitGen Studio — lib/segment.js (2.390.0): SEGMENT ANYTHING for the image editor.
//
// Tim (verbatim): "yes, please do these steps and maybe add sam to segment the image on the layer and add an option to
// put segments on different layers" (the steps: layers as references, "mask the persons head" from a prompt, PSD files,
// Generate with the editor's layers).
//
// Meta's Segment Anything (SAM, Apache-2.0) + CLIPSeg (words -> where) run LOCALLY in their own venv (venvs/segment:
// torch, segment-anything, transformers), driven as ONE long-lived server (scripts/segment.py --serve) so the models stay
// loaded and a picture clicked again reuses its embedding. Nothing leaves the machine after ⬇ Install (the downloads run
// once; the server then runs with HF_HUB_OFFLINE=1).
//   status()                 {ready, venv, python, model, checkpoint, models: {vit_b|vit_l|vit_h: {file, size, found}},
//                             installing, server}
//   settings(patch)          {model: vit_b|vit_l|vit_h, checkpoint: a .pth path ("" = found by name)}
//   install(o)               builds the venv (torch CUDA when there is an NVIDIA card), fetches the checkpoint + CLIPSeg
//   run(o)                   {op: points|text|auto, image: Buffer, points, box, prompt, threshold, refine, instances, max,
//                             min_area, points_per_side, fake} -> {masks: [{name, url, label, bbox, area, score}], w, h, note}
//   maskPath(name)           a mask PNG under the project's temp/segment
//   stop()                   ends the server (tests; it also ends itself after 10 idle minutes)
"use strict";
const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const core = require("./core");

const ROOT = path.join(__dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "segment.py");
const IS_WIN = process.platform === "win32";
const MODELS = {
  vit_b: { file: "sam_vit_b_01ec64.pth", size: "375 MB", label: "SAM ViT-B (fast)" },
  vit_l: { file: "sam_vit_l_0b3195.pth", size: "1.25 GB", label: "SAM ViT-L" },
  vit_h: { file: "sam_vit_h_4b8939.pth", size: "2.56 GB", label: "SAM ViT-H (best edges)" },
};
const URL_BASE = "https://dl.fbaipublicfiles.com/segment_anything/";
const OPS = ["points", "text", "auto"];
const IDLE_MS = 10 * 60 * 1000;
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }

const cfgOf = () => ((core.getConfig() || {}).segment || {});
function venvDir() { const v = String(cfgOf().venv || "").trim(); return core.resolvePath(v || path.join("venvs", "segment")); }
function venvPython(dir) { return path.join(dir, IS_WIN ? "Scripts" : "bin", IS_WIN ? "python.exe" : "python"); }
const samDir = () => core.resolvePath(path.join("models", "sam"));
const hfDir = () => core.resolvePath(path.join("models", "hf"));
const READY = (dir) => path.join(dir, ".bitgen_segment_ready");
const modelKind = () => (MODELS[cfgOf().model] ? cfgOf().model : "vit_b");

/** ComfyUI's models/sams (the Impact Pack keeps SAM there) - a checkpoint already on the machine is used as it is */
function comfySams() {
  try {
    const c = (core.getConfig().engine || {}).comfy || {};
    return c.dir ? path.join(core.resolvePath(c.dir), "models", "sams") : "";
  } catch { return ""; }
}
/** the .pth for a kind: the one set in settings, else models/sam/<file>, else ComfyUI's models/sams/<file> */
function checkpointFor(kind) {
  const set = String(cfgOf().checkpoint || "").trim();
  if (set && kind === modelKind()) return core.resolvePath(set);
  const f = MODELS[kind].file;
  for (const d of [samDir(), comfySams()].filter(Boolean)) { const p = path.join(d, f); if (fs.existsSync(p)) return p; }
  return path.join(samDir(), f);
}

let installing = null;
let srv = null;                 // {proc, fake, pending: Map, buf, log, idle, device}
let seq = 0;

function status() {
  const dir = venvDir(), py = venvPython(dir);
  const kind = modelKind(), ck = checkpointFor(kind);
  const venvOk = fs.existsSync(py) && fs.existsSync(READY(dir));
  return {
    ready: venvOk && fs.existsSync(ck), venv: dir, python: py, venv_ready: venvOk, model: kind, checkpoint: ck,
    checkpoint_found: fs.existsSync(ck),
    models: Object.fromEntries(Object.entries(MODELS).map(([k, m]) => [k, { ...m, found: fs.existsSync(checkpointFor(k)) }])),
    fake_available: process.env.H3_E2E === "1",
    installing: installing ? { state: installing.state, error: installing.error || null, log: installing.log.slice(-14) } : null,
    server: srv ? { running: true, fake: srv.fake, device: srv.device || null } : { running: false },
  };
}

function settings(patch) {
  const p = patch || {};
  const cfg = core.getConfig() || {};
  const cur = Object.assign({}, cfg.segment || {});
  if (p.model !== undefined) { if (!MODELS[p.model]) throw bad(`model must be one of ${Object.keys(MODELS).join(", ")}`); cur.model = p.model; }
  if (p.checkpoint !== undefined) {
    const c = String(p.checkpoint || "").trim();
    if (c && !/\.(pth|pt)$/i.test(c)) throw bad("the checkpoint is a SAM .pth file");
    cur.checkpoint = c;
  }
  cfg.segment = cur;
  core.setConfig(cfg);
  stop();                                    // the next request loads what was chosen
  return status();
}

function runLogged(cmd, args, opts, log) {
  return new Promise((ok, no) => {
    const p = spawn(cmd, args, { ...(opts || {}), windowsHide: true });
    const take = (d) => String(d).split(/\r?\n/).filter(Boolean).forEach((l) => { log.push(l.slice(0, 300)); if (log.length > 400) log.shift(); });
    p.stdout.on("data", take); p.stderr.on("data", take);
    p.on("error", no);
    p.on("close", (code) => (code === 0 ? ok() : no(new Error(`${path.basename(cmd)} exited with ${code}`))));
  });
}
function hasNvidia() { try { return spawnSync("nvidia-smi", ["-L"], { encoding: "utf8", timeout: 8000 }).status === 0; } catch { return false; } }

/** the pip commands for the venv (pure - tested): torch first (CUDA wheels from PyTorch's index on an NVIDIA machine) */
function pipPlan(gpu) {
  return [
    ["-m", "pip", "install", "--upgrade", "pip", "wheel", "--progress-bar", "off"],
    gpu ? ["-m", "pip", "install", "torch", "torchvision", "--index-url", "https://download.pytorch.org/whl/cu124", "--progress-bar", "off"]
        : ["-m", "pip", "install", "torch", "torchvision", "--progress-bar", "off"],
    ["-m", "pip", "install", "segment-anything", "transformers", "opencv-python-headless", "pillow", "numpy", "--progress-bar", "off"],
  ];
}
/** python that downloads a checkpoint with progress lines (pure - tested) */
function fetchScript(url, dest) {
  return "import sys, urllib.request\n"
    + `u, d = ${JSON.stringify(url)}, ${JSON.stringify(dest)}\n`
    + "def hook(n, bs, total):\n"
    + "    if total > 0 and n % 400 == 0: print('download %d%%' % min(100, n * bs * 100 // total), flush=True)\n"
    + "urllib.request.urlretrieve(u, d + '.part', hook)\n"
    + "import os; os.replace(d + '.part', d); print('saved', d, flush=True)\n";
}

function install(o) {
  if (installing && installing.state === "running") return status();
  const dir = venvDir(), log = [];
  installing = { state: "running", log, error: null };
  const sys = (o && o.python) || ((core.getConfig().paths || {}).python) || (IS_WIN ? "python" : "python3");
  const gpu = !(o && o.device === "cpu") && hasNvidia();
  const kind = (o && MODELS[o.model]) ? o.model : modelKind();
  const env = { ...process.env, PYTHONUNBUFFERED: "1", PIP_NO_INPUT: "1", HF_HOME: hfDir() };
  (async () => {
    try {
      fs.mkdirSync(path.dirname(dir), { recursive: true });
      fs.mkdirSync(samDir(), { recursive: true });
      fs.mkdirSync(hfDir(), { recursive: true });
      log.push(`[segment] step 1/5: the venv at ${dir}`);
      if (!fs.existsSync(venvPython(dir))) await runLogged(sys, ["-m", "venv", dir], { env }, log);
      const py = venvPython(dir);
      const plan = pipPlan(gpu);
      log.push(`[segment] step 2/5: pip`); await runLogged(py, plan[0], { env }, log);
      log.push(`[segment] step 3/5: torch (${gpu ? "CUDA - NVIDIA card found" : "CPU"})`); await runLogged(py, plan[1], { env }, log);
      log.push("[segment] step 4/5: segment-anything, transformers (CLIPSeg), opencv"); await runLogged(py, plan[2], { env }, log);
      const ck = checkpointFor(kind);
      if (!fs.existsSync(ck)) {
        log.push(`[segment] step 5/5: ${MODELS[kind].label} (${MODELS[kind].size}) -> ${ck}`);
        await runLogged(py, ["-c", fetchScript(URL_BASE + MODELS[kind].file, ck)], { env }, log);
      } else log.push(`[segment] step 5/5: ${MODELS[kind].label} already here: ${ck}`);
      log.push("[segment] CLIPSeg (CIDAS/clipseg-rd64-refined) -> models/hf");
      await runLogged(py, ["-c", "from transformers import CLIPSegProcessor, CLIPSegForImageSegmentation as M\n"
        + "CLIPSegProcessor.from_pretrained('CIDAS/clipseg-rd64-refined'); M.from_pretrained('CIDAS/clipseg-rd64-refined'); print('CLIPSeg ready')"], { env }, log);
      fs.writeFileSync(READY(dir), new Date().toISOString());
      const cfg = core.getConfig() || {};
      cfg.segment = Object.assign({}, cfg.segment || {}, { model: kind });
      core.setConfig(cfg);
      installing.state = "done";
      log.push("[segment] Segment Anything ready");
      stop();
    } catch (e) {
      installing.state = "error";
      installing.error = String(e.message || e);
      log.push("[segment] failed: " + installing.error);
    }
  })();
  return status();
}

/* ---------------- the server ---------------- */
function stop() {
  if (!srv) return;
  try { srv.proc.stdin.end(); srv.proc.kill(); } catch { /* gone */ }
  for (const p of srv.pending.values()) { clearTimeout(p.timer); p.no(new Error("the segment server stopped")); }
  clearTimeout(srv.idle);
  srv = null;
}
function server(fake) {
  if (srv && srv.fake === !!fake && srv.proc.exitCode == null) return srv;
  stop();
  const st = status();
  const py = fake ? (IS_WIN ? "python" : "python3") : st.python;
  const env = { ...process.env, PYTHONUNBUFFERED: "1", HF_HOME: hfDir(), HF_HUB_OFFLINE: "1", TRANSFORMERS_OFFLINE: "1" };
  const proc = spawn(py, [SCRIPT, "--serve"].concat(fake ? ["--fake"] : []), { env, windowsHide: true });
  const S = { proc, fake: !!fake, pending: new Map(), buf: "", log: [], idle: null, device: fake ? "fake" : null };
  const read = (d) => {
    const lines = (S.buf + String(d)).split(/\r?\n/); S.buf = lines.pop();
    for (const l of lines) {
      if (l.startsWith("H3SEG ")) {
        let a = null; try { a = JSON.parse(l.slice(6)); } catch { a = null; }
        const p = a && S.pending.get(a.id);
        if (p) { S.pending.delete(a.id); clearTimeout(p.timer); a.ok ? p.ok(a) : p.no(bad(a.error || "the segment failed", 422)); }
      } else { S.log.push(l.replace(/^H3SEG-LOG /, "")); if (S.log.length > 80) S.log.shift(); const m = /on (cuda|cpu)\b/.exec(l); if (m) S.device = m[1]; }
    }
  };
  proc.stdout.on("data", read); proc.stderr.on("data", (d) => { S.log.push(String(d).trim().slice(0, 300)); if (S.log.length > 80) S.log.shift(); });
  proc.on("error", (e) => { for (const p of S.pending.values()) p.no(e); S.pending.clear(); if (srv === S) srv = null; });
  proc.on("close", (code) => {
    const why = S.log.slice(-4).join(" ").slice(0, 400);
    for (const p of S.pending.values()) { clearTimeout(p.timer); p.no(new Error(`the segment server stopped (exit ${code})${why ? ": " + why : ""}`)); }
    S.pending.clear();
    if (srv === S) srv = null;
  });
  srv = S;
  return S;
}
function ask(S, req, ms) {
  return new Promise((ok, no) => {
    const id = ++seq;
    const timer = setTimeout(() => { S.pending.delete(id); no(new Error("the segment server took too long (" + Math.round(ms / 1000) + " s)")); }, ms);
    S.pending.set(id, { ok, no, timer });
    clearTimeout(S.idle);
    S.idle = setTimeout(() => { if (srv === S && !S.pending.size) stop(); }, IDLE_MS);
    S.proc.stdin.write(JSON.stringify(Object.assign({}, req, { id })) + "\n");
  });
}

function outDir() { const d = path.join(core.tempDir(), "segment"); fs.mkdirSync(d, { recursive: true }); return d; }
/** files older than a day go (the folder is a scratch space) */
function sweep(dir) {
  const old = Date.now() - 24 * 3600 * 1000;
  try { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); try { if (fs.statSync(p).mtimeMs < old) fs.unlinkSync(p); } catch { /* fine */ } } } catch { /* fine */ }
}
function maskPath(name) {
  const n = path.basename(String(name || ""));
  if (!/^seg[A-Za-z0-9_-]*\.png$/.test(n)) throw bad("not a mask name", 404);
  const p = path.join(outDir(), n);
  if (!fs.existsSync(p)) throw bad("that mask is gone (made more than a day ago?)", 404);
  return p;
}

/** a request's own fields, checked (pure - tested) */
function requestOf(o) {
  const x = o || {};
  const op = String(x.op || "");
  if (!OPS.includes(op)) throw bad(`op must be one of ${OPS.join(", ")}`);
  const num = (v, d, lo, hi) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  const r = { op };
  if (op === "points") {
    let pts = x.points; if (typeof pts === "string") { try { pts = JSON.parse(pts || "[]"); } catch { pts = []; } }
    let box = x.box; if (typeof box === "string") { try { box = JSON.parse(box || "null"); } catch { box = null; } }
    r.points = (Array.isArray(pts) ? pts : []).slice(0, 64).filter((p) => Array.isArray(p) && p.length >= 2 && p.every((v) => Number.isFinite(+v)))
      .map((p) => [Math.round(+p[0]), Math.round(+p[1]), p.length > 2 && +p[2] === 0 ? 0 : 1]);
    r.box = Array.isArray(box) && box.length === 4 && box.every((v) => Number.isFinite(+v)) ? box.map((v) => Math.round(+v)) : null;
    if (!r.points.length && !r.box) throw bad("click on the picture (or drag a box) first");
  } else if (op === "text") {
    r.prompt = String(x.prompt || "").trim().slice(0, 300);
    if (!r.prompt) throw bad("write what to select (\"the person's head\", \"dog, car\")");
    r.threshold = num(x.threshold, 0.35, 0.05, 0.95);
    r.refine = !(x.refine === false || x.refine === "false" || x.refine === "0");
    r.instances = x.instances === true || x.instances === "true" || x.instances === "1";
  } else {
    r.max = Math.round(num(x.max, 64, 1, 256));
    r.min_area = num(x.min_area, 0.2, 0, 50);
    r.points_per_side = Math.round(num(x.points_per_side, 32, 8, 64));
  }
  return r;
}

async function run(o) {
  const x = o || {};
  const req = requestOf(x);
  if (!x.image || !x.image.length) throw bad("the picture is missing");
  const st = status();
  const fake = !!x.fake || (!st.ready && st.fake_available);
  if (!fake && !st.ready)
    throw bad(st.venv_ready ? `the ${MODELS[st.model].label} checkpoint is missing (${st.checkpoint}) - ⬇ Install fetches it, or point Segment settings at your .pth`
                            : "Segment Anything is not installed - ⬇ Install it in the editor (Select ▸ Segment settings…)", 409);
  const dir = outDir();
  sweep(dir);
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const img = path.join(dir, `in_${stamp}.png`);
  fs.writeFileSync(img, x.image);
  const S = server(fake);
  const kind = MODELS[x.model] ? x.model : st.model;
  const a = await ask(S, Object.assign(req, { image: img, out_dir: dir, prefix: `seg_${stamp}`, model: kind, checkpoint: checkpointFor(kind) }),
    req.op === "auto" ? 15 * 60 * 1000 : 5 * 60 * 1000);
  try { fs.unlinkSync(img); } catch { /* fine */ }
  return {
    masks: (a.masks || []).map((m) => ({ name: m.file, url: `/api/segment/mask/${encodeURIComponent(m.file)}`, label: m.label, bbox: m.bbox, area: m.area, score: m.score })),
    w: a.w, h: a.h, took: a.took, note: a.note, fake,
  };
}

module.exports = { MODELS, OPS, URL_BASE, status, settings, install, run, stop, maskPath, requestOf, pipPlan, fetchScript, checkpointFor };
