// bitGen Studio — lib/sceneTools.js (2.515.0): the timeline's SCENE TOOLS - step 8 of the After Effects gap list.
// Tim (verbatim): "do number 8 of the after effects list" - AFTER-EFFECTS-GAP.md: "AI cut-out through a shot (a subject
// matte that follows) + refine edge", "3D camera tracker (solve the camera, place layers in the scene)", "Content-aware
// fill for video (remove an object across a shot)".
//
// Each runs as a background job (a Python script, JSON lines of progress on its stdout):
//   cutout(o)    scripts/roto.py     the subject cut out through the range -> video/cut_<clip>_<hash>.webm (VP9 with
//                                    its alpha, the clip's own size; frame 0 = the range's start)
//   camtrack(o)  scripts/camtrack.py the camera solved (+ the scene's points) -> workspace/camtrack/cam_<clip>_<hash>.json
//                                    (camSolve(name) reads it back; the page keys the 3D camera from it - tlcamtrack.js)
//   fill(o)      scripts/vfill.py    the clip again with the hole filled -> <clip>_fill<hash>.mp4 beside the clip
//                                    (the same length and times; its sound copied) - the clip is pointed at it
//   job(id)      {state: working | done | failed | cancelled, p 0..1, stage, error, result}
//   cancel(id)
//   status()     {cutout: {methods, sam2, ai}, cv2, python}
//   installSam2() Segment Anything 2 into the AI matte's venv (venvs/matte - lib/matte.js): torch + sam2 + the
//                checkpoint models/sam2/sam2.1_hiera_small.pt - in the background
// Served by routes/scene.js (never server.js).
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), crypto = require("crypto");
const { spawn, spawnSync } = require("child_process");
const core = require("./core");

const IS_WIN = process.platform === "win32";
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });
const num = (v, d, lo, hi) => { const x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
const u01 = (v) => num(v, 0.5, 0, 1);
const SAM2_CKPT = "sam2.1_hiera_small.pt";
const SAM2_CFG = "configs/sam2.1/sam2.1_hiera_s.yaml";
const SAM2_URLS = ["https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_small.pt",
  "https://huggingface.co/facebook/sam2.1-hiera-small/resolve/main/sam2.1_hiera_small.pt"];
const METHODS = ["auto", "sam2", "ai", "flow"];

function matte() { return require("./matte"); }
function sysPython() { return ((core.getConfig().paths || {}).python) || (IS_WIN ? "python" : "python3"); }
function scripts(n) { return path.join(core.resolvePath("scripts"), n); }
const pyOk = new Map();
/** does this python have the modules (asked once a minute) */
function has(py, mods) {
  const k = py + "|" + mods; const hit = pyOk.get(k);
  if (hit && Date.now() - hit.at < 60000) return hit.ok;
  let ok = false;
  try { ok = fs.existsSync(py) || !/[\\/]/.test(py) ? spawnSync(py, ["-c", "import " + mods], { timeout: 30000, windowsHide: true }).status === 0 : false; } catch { ok = false; }
  pyOk.set(k, { ok, at: Date.now() });
  return ok;
}
function mattePy() { try { const s = matte().status(); return fs.existsSync(s.python) ? s.python : null; } catch { return null; } }
/** the python for the cut-out: the AI matte's venv (rembg, OpenCV, maybe SAM 2) when it is there, else the app's */
function rotoPy() { const m = mattePy(); return m && has(m, "cv2, numpy") ? m : sysPython(); }
/** the python with OpenCV for the camera tracker and the fill */
function cvPy() { const s = sysPython(); if (has(s, "cv2, numpy")) return s; const m = mattePy(); return m && has(m, "cv2, numpy") ? m : s; }

function sam2Dir() { return core.resolvePath(path.join("models", "sam2")); }
function sam2Ckpt() { return path.join(sam2Dir(), SAM2_CKPT); }
let sam2Inst = null;
function sam2Status() {
  const py = mattePy();
  const ready = !!(py && fs.existsSync(sam2Ckpt()) && has(py, "torch, sam2"));
  return { ready, ckpt: sam2Ckpt(), installing: sam2Inst ? { state: sam2Inst.state, error: sam2Inst.error || null, log: sam2Inst.log.slice(-12) } : null };
}
function status() {
  const st = sam2Status(), m = mattePy(), py = rotoPy();
  const methods = [];
  if (st.ready) methods.push("sam2");
  if (m && has(m, "rembg, cv2")) methods.push("ai");
  if (has(py, "cv2, numpy")) methods.push("flow");
  return { cutout: { methods, sam2: st, ai: methods.includes("ai") }, cv2: has(cvPy(), "cv2, numpy"), python: { roto: py, cv: cvPy() } };
}
function runLog(cmd, args, env, log) {
  return new Promise((ok, no) => {
    const p = spawn(cmd, args, { env, windowsHide: true });
    const take = (d) => String(d).split(/\r?\n/).filter(Boolean).forEach((l) => { log.push(l.slice(0, 300)); if (log.length > 400) log.shift(); });
    p.stdout.on("data", take); p.stderr.on("data", take);
    p.on("error", no); p.on("close", (c) => (c === 0 ? ok() : no(new Error(path.basename(cmd) + " exited with " + c))));
  });
}
function installSam2() {
  if (sam2Inst && sam2Inst.state === "running") return sam2Status();
  const py = mattePy();
  if (!py) throw bad("install the AI matte first (it is the venv SAM 2 goes into) - Select ▸ Subject Settings… ⬇ Install, or the cut-out's ⬇ AI matte", 409);
  const log = []; sam2Inst = { state: "running", log, error: null };
  const env = { ...process.env, PYTHONUNBUFFERED: "1", PIP_NO_INPUT: "1" };
  let gpu = false; try { gpu = spawnSync("nvidia-smi", ["-L"], { timeout: 8000 }).status === 0; } catch { gpu = false; }
  (async () => {
    try {
      fs.mkdirSync(sam2Dir(), { recursive: true });
      log.push("[sam2] step 1/3: torch" + (gpu ? " (CUDA)" : " (CPU)"));
      await runLog(py, ["-m", "pip", "install", "torch", "torchvision", "--progress-bar", "off"].concat(gpu ? ["--index-url", "https://download.pytorch.org/whl/cu124"] : []), env, log);
      log.push("[sam2] step 2/3: sam2");
      try { await runLog(py, ["-m", "pip", "install", "sam2", "--progress-bar", "off"], env, log); }
      catch (e) { log.push("[sam2] from PyPI failed - from GitHub"); await runLog(py, ["-m", "pip", "install", "git+https://github.com/facebookresearch/sam2.git", "--progress-bar", "off"], env, log); }
      log.push("[sam2] step 3/3: the checkpoint -> " + sam2Ckpt());
      const tmp = sam2Ckpt() + ".part";
      let got = false;
      for (const u of SAM2_URLS) {
        try { await runLog(py, ["-c", `import urllib.request,sys; urllib.request.urlretrieve(${JSON.stringify(u)}, ${JSON.stringify(tmp)}); print("ok")`], env, log); got = true; break; }
        catch (e) { log.push("[sam2] " + u + " failed"); }
      }
      if (!got || !fs.existsSync(tmp) || fs.statSync(tmp).size < 1e7) throw new Error("the checkpoint could not be fetched");
      fs.renameSync(tmp, sam2Ckpt());
      pyOk.clear();
      sam2Inst.state = "done"; log.push("[sam2] ready");
    } catch (e) { sam2Inst.state = "error"; sam2Inst.error = String(e.message || e); log.push("[sam2] failed: " + sam2Inst.error); }
  })();
  return sam2Status();
}

/* ---- files */
function clipFile(name, src) {
  const n = path.basename(String(name || ""));
  if (!n) throw bad("which clip? (name)");
  const dirs = { video: core.pDir("video"), final: path.join(core.projDir(core.getProject()), "final"), output: core.pDir("output") };
  const d = dirs[src] || dirs.output;
  const p = path.join(d, n);
  if (fs.existsSync(p)) return p;
  const f = require("./asr").findAsset(n);
  if (!f) throw bad("not in this project: " + n, 404);
  return f;
}
const stem = (f) => path.basename(f).replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_").slice(0, 40);
function hashOf(file, o) {
  const st = fs.statSync(file);
  return crypto.createHash("sha1").update(JSON.stringify([path.basename(file), st.size, Math.round(st.mtimeMs), o])).digest("hex").slice(0, 10);
}
const CUT = /^cut_[\w.-]{1,60}\.webm$/;
/** a cut-out file of ours (video/cut_*.webm) -> its path, or null */
function cutFile(name) {
  const n = path.basename(String(name || ""));
  if (!CUT.test(n)) return null;
  const p = path.join(core.pDir("video"), n);
  return fs.existsSync(p) ? p : null;
}

/* ---- jobs */
const JOBS = new Map();
let seq = 0;
function start(kind, py, script, jobObj, onDone) {
  for (const [k, j] of JOBS) if (j.state !== "working" && Date.now() - j.at > 3600000) JOBS.delete(k);
  const id = kind + "_" + Date.now().toString(36) + "_" + (++seq);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bg-scene-")), jf = path.join(dir, "job.json");
  fs.writeFileSync(jf, JSON.stringify(jobObj));
  const J = { id, kind, state: "working", p: 0, stage: "starting", error: "", result: null, at: Date.now() };
  JOBS.set(id, J);
  let buf = "", err = "";
  const p = spawn(py, [script, jf], { windowsHide: true, env: { ...process.env, PYTHONUNBUFFERED: "1", U2NET_HOME: core.resolvePath(path.join("models", "rembg")) } });
  J.proc = p;
  p.stdout.on("data", (d) => {
    buf += d; let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("{")) continue;
      try { const m = JSON.parse(line); if (m.ok) J.result = m; else { if (m.p != null) J.p = +m.p; if (m.stage) J.stage = String(m.stage); } } catch { /* a stray line */ }
    }
  });
  p.stderr.on("data", (d) => { err += d; if (err.length > 20000) err = err.slice(-20000); });
  p.on("error", (e) => { J.state = "failed"; J.error = "could not start Python: " + e.message; });
  p.on("close", (code) => {
    delete J.proc;
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* fine */ }
    if (J.state === "cancelled") return;
    if (code === 0 && J.result) {
      try { if (onDone) J.result = onDone(J.result) || J.result; J.state = "done"; J.p = 1; } catch (e) { J.state = "failed"; J.error = String(e.message || e); }
    } else { J.state = "failed"; J.error = (err.trim().split("\n").filter(Boolean).pop() || "the job stopped (" + code + ")").slice(0, 400); }
  });
  return { id, state: J.state };
}
function job(id) {
  const J = JOBS.get(String(id || ""));
  if (!J) throw bad("no such job", 404);
  return { id: J.id, kind: J.kind, state: J.state, p: J.p, stage: J.stage, error: J.error, result: J.result };
}
function cancel(id) {
  const J = JOBS.get(String(id || "")); if (!J) throw bad("no such job", 404);
  if (J.state === "working") { J.state = "cancelled"; try { J.proc && J.proc.kill(); } catch { /* gone */ } }
  return { id: J.id, state: J.state };
}

/* ---- the three tools: the requests made safe, the jobs started */
function range(o) {
  const from = num(o.from, 0, 0, 86400), to = num(o.to, from + 5, 0, 86400);
  if (!(to > from + 0.02)) throw bad("the range is empty");
  return { from, to };
}
function cleanPrompts(ps) {
  const out = [];
  for (const p of (Array.isArray(ps) ? ps : []).slice(0, 40)) {
    if (!p || typeof p !== "object") continue;
    const pts = (Array.isArray(p.pts) ? p.pts : []).slice(0, 40).filter((q) => Array.isArray(q) && q.length >= 2).map((q) => [u01(q[0]), u01(q[1]), q[2] === 0 || q[2] === false ? 0 : 1]);
    const box = Array.isArray(p.box) && p.box.length === 4 ? p.box.map(u01) : null;
    if (!pts.length && !box) continue;
    out.push({ t: num(p.t, 0, 0, 86400), pts, box });
  }
  return out;
}
function cutout(o) {
  o = o || {};
  const src = clipFile(o.name, o.src), r = range(o);
  if (r.to - r.from > 120) throw bad("cut out at most 2 minutes at a time");
  const prompts = cleanPrompts(o.prompts);
  if (!prompts.length) throw bad("click the subject first (✚) - or drag a box round it");
  const method = METHODS.includes(o.method) ? o.method : "auto";
  const ref = o.refine || {};
  const refine = { feather: num(ref.feather, 1, 0, 100), choke: Math.round(num(ref.choke, 0, -50, 50)), smooth: num(ref.smooth, 30, 0, 100), edge: ref.edge !== false };
  const work = Math.round(num(o.work, 768, 256, 2048));
  const model = matte().MODELS.includes(o.model) ? o.model : matte().MODELS[0];
  const key = hashOf(src, [r, prompts, method, refine, work, model]);
  const outName = "cut_" + stem(src) + "_" + key + ".webm", out = path.join(core.pDir("video"), outName);
  fs.mkdirSync(core.pDir("video"), { recursive: true });
  const meta = { file: outName, from: r.from, to: r.to };
  if (fs.existsSync(out) && fs.statSync(out).size > 0) {             // made before with the same everything
    const id = "cutout_" + Date.now().toString(36) + "_" + (++seq);
    JOBS.set(id, { id, kind: "cutout", state: "done", p: 1, stage: "made before", error: "", result: { ok: true, ...meta, cached: true }, at: Date.now() });
    return { id, state: "done" };
  }
  return start("cutout", rotoPy(), scripts("roto.py"), { input: src, output: out, ...r, prompts, method, model, work, refine,
    sam2: { ckpt: sam2Ckpt(), cfg: SAM2_CFG } }, (res) => ({ ...res, ...meta, to: res.to != null ? res.to : r.to }));
}
function camtrack(o) {
  o = o || {};
  const src = clipFile(o.name, o.src), r = range(o);
  if (r.to - r.from > 120) throw bad("solve at most 2 minutes at a time");
  const ig = o.ignore && cutFile(o.ignore.name) ? { file: cutFile(o.ignore.name), t0: num(o.ignore.t0, 0, 0, 86400) } : null;
  const job = { input: src, ...r, fov: num(o.fov, 0, 0, 170), mode: ["auto", "free", "tripod"].includes(o.mode) ? o.mode : "auto",
    width: Math.round(num(o.width, 960, 320, 1920)), features: Math.round(num(o.features, 1200, 200, 4000)), ignore: ig };
  const name = "cam_" + stem(src) + "_" + hashOf(src, [job.from, job.to, job.fov, job.mode, job.width, job.features, ig && path.basename(ig.file), ig && ig.t0]) + ".json";
  // the solve is kept in the project (workspace/camtrack/<name>) - the page fetches it (GET /api/scene/cam/<name>)
  return start("camtrack", cvPy(), scripts("camtrack.py"), job, (res) => {
    fs.mkdirSync(camDir(), { recursive: true });
    fs.writeFileSync(path.join(camDir(), name), JSON.stringify(res));
    return { ok: true, file: name, mode: res.mode, fov: res.fov, err: res.err, solved: res.solved, lost: res.lost, frames: (res.frames || []).length, points: (res.points || []).length, from: res.from, fps: res.fps };
  });
}
function camDir() { return path.join(core.projDir(core.getProject()), "workspace", "camtrack"); }
const CAMF = /^cam_[\w.-]{1,70}\.json$/;
/** a kept camera solve (JSON) */
function camSolve(name) {
  const n = path.basename(String(name || ""));
  if (!CAMF.test(n)) throw bad("not a camera solve: " + n);
  const p = path.join(camDir(), n);
  if (!fs.existsSync(p)) throw bad("the camera solve is gone - 📷 ▶ Solve again", 404);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function fill(o) {
  o = o || {};
  const src = clipFile(o.name, o.src), r = range(o);
  if (r.to - r.from > 120) throw bad("fill at most 2 minutes at a time");
  const h = o.hole || {};
  let hole = null;
  if (h.kind === "grey") { const f = require("./layerBake").fileOf(h.name); if (f) hole = { file: f, kind: "grey", t0: num(h.t0, 0, 0, 86400), invert: !!h.invert }; }
  else { const f = cutFile(h.name); if (f) hole = { file: f, kind: "alpha", t0: num(h.t0, 0, 0, 86400), invert: !!h.invert }; }
  if (!hole) throw bad("what to take out? - 🧍 cut it out first (or give the layer ✒ masks)");
  let ref = null;
  if (o.ref && o.ref.name) {
    const n = path.basename(String(o.ref.name));
    const p = [core.pDir("images"), core.pDir("output")].map((d) => path.join(d, n)).find((x) => fs.existsSync(x));
    if (p) ref = { file: p, t: num(o.ref.t, r.from, 0, 86400) };
  }
  const job = { input: src, ...r, hole, grow: num(o.grow, 4, 0, 200), feather: num(o.feather, 3, 0, 100), reach: num(o.reach, 2, 0.2, 10),
    method: o.method === "spatial" ? "spatial" : "auto", ref, work: Math.round(num(o.work, 1280, 320, 3840)) };
  const key = hashOf(src, [job.from, job.to, path.basename(hole.file), fs.statSync(hole.file).size, hole.t0, hole.invert, job.grow, job.feather, job.reach, job.method, ref && path.basename(ref.file), job.work]);
  const outName = stem(src).replace(/_fill[0-9a-f]{10}$/, "") + "_fill" + key + (/\.webm$/i.test(src) ? ".webm" : ".mp4"), out = path.join(path.dirname(src), outName);
  const meta = { file: outName, of: path.basename(src), from: r.from, to: r.to };
  if (fs.existsSync(out) && fs.statSync(out).size > 0) {
    const id = "fill_" + Date.now().toString(36) + "_" + (++seq);
    JOBS.set(id, { id, kind: "fill", state: "done", p: 1, stage: "made before", error: "", result: { ok: true, ...meta, cached: true }, at: Date.now() });
    return { id, state: "done" };
  }
  return start("fill", cvPy(), scripts("vfill.py"), { ...job, output: out }, (res) => ({ ...res, ...meta }));
}

module.exports = { status, installSam2, cutout, camtrack, camSolve, fill, job, cancel, cutFile, clipFile, cleanPrompts, METHODS, SAM2_CKPT, SAM2_CFG };
