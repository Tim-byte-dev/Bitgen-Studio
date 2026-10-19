// bitGen Studio — lib/matte.js (2.387.0): a path layer's subject, CUT OUT of its green screen.
//
// Tim: "can we add a paths layer, then generate parts of the scene on each path layer so animals, cars, people can be
// rendered separately have transparent backgrounds and compose the scene" - asked how: "Green screen + AI matte".
//
// The subject is generated on a plain green background (ext/timelinedock/paths.js); this takes the green away:
//   AI matte    rembg + BiRefNet in its own venv (venvs/matte, the model in models/rembg), frame by frame through
//               scripts/matte.py - hair, fur, glass and motion blur keep their soft edges
//   chroma key  ffmpeg chromakey + despill - nothing to install (the fallback when the venv is not there)
// Out: video/pathv_<id>.webm (VP9 yuva420p, alpha_mode=1 - see-through on the canvas and in the compile) and its
// mirror pathv_<id>_l.webm (the subject facing the other way, for a path that turns back), the subject's box and
// heights (so the page can stand it on the path at the size asked for).
//   status()               {ai, venv, python, models, installing, log}
//   install()              builds venvs/matte (rembg[gpu|cpu]) and fetches the model, in the background
//   start(o)               {id, output, method: auto | ai | key, model} -> {id, state}
//   job(id)                {state, done, of, method, error, result: {name, left, w, h, dur, fps, bbox, height, key}}
//   keyColour(file)        the green screen's colour (the frame's border, averaged)
"use strict";
const fs = require("fs");
const path = require("path");
const { spawn, execFile, spawnSync } = require("child_process");
const core = require("./core");

const ROOT = path.join(__dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "matte.py");
const MODELS = ["birefnet-general", "birefnet-general-lite", "isnet-general-use", "u2net", "u2netp"];   // best .. fastest
const IS_WIN = process.platform === "win32";
const ID = (v) => String(v || "").replace(/[^A-Za-z0-9_-]+/g, "").slice(0, 40);
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }

function venvDir() {
  const c = ((core.getConfig() || {}).matte || {}).venv;
  return core.resolvePath(c && String(c).trim() ? String(c).trim() : path.join("venvs", "matte"));
}
function venvPython(dir) { return path.join(dir, IS_WIN ? "Scripts" : "bin", IS_WIN ? "python.exe" : "python"); }
function modelsDir() { return core.resolvePath(path.join("models", "rembg")); }
const READY = (dir) => path.join(dir, ".bitgen_matte_ready");
let installing = null;          // {log: [], state, error}

function status() {
  const dir = venvDir(), py = venvPython(dir);
  const ai = fs.existsSync(py) && fs.existsSync(READY(dir));
  return { ai, venv: dir, python: py, models: MODELS, model_dir: modelsDir(),
           installing: installing ? { state: installing.state, error: installing.error || null, log: installing.log.slice(-12) } : null };
}

function run(cmd, args, opts, log) {
  return new Promise((ok, no) => {
    const p = spawn(cmd, args, { ...(opts || {}), windowsHide: true });
    const take = (d) => String(d).split(/\r?\n/).filter(Boolean).forEach((l) => { log.push(l.slice(0, 300)); if (log.length > 400) log.shift(); });
    p.stdout.on("data", take); p.stderr.on("data", take);
    p.on("error", (e) => no(e));
    p.on("close", (code) => (code === 0 ? ok() : no(new Error(`${path.basename(cmd)} exited with ${code}`))));
  });
}
function hasNvidia() {
  try { return spawnSync("nvidia-smi", ["-L"], { encoding: "utf8", timeout: 8000 }).status === 0; } catch { return false; }
}
/* venvs/matte: rembg with the GPU onnxruntime when there is an NVIDIA card, then the model fetched once */
function install(o) {
  if (installing && installing.state === "running") return status();
  const dir = venvDir(), log = [];
  installing = { state: "running", log, error: null };
  const sys = (o && o.python) || ((core.getConfig().paths || {}).python) || (IS_WIN ? "python" : "python3");
  const extra = (o && o.device === "cpu") || !hasNvidia() ? "cpu" : "gpu";
  const env = { ...process.env, PYTHONUNBUFFERED: "1", PIP_NO_INPUT: "1", U2NET_HOME: modelsDir() };
  (async () => {
    try {
      fs.mkdirSync(path.dirname(dir), { recursive: true });
      fs.mkdirSync(modelsDir(), { recursive: true });
      log.push(`[matte] step 1/4: the venv at ${dir}`);
      if (!fs.existsSync(venvPython(dir))) await run(sys, ["-m", "venv", dir], { env }, log);
      const py = venvPython(dir);
      log.push("[matte] step 2/4: pip");
      await run(py, ["-m", "pip", "install", "--upgrade", "pip", "wheel", "--progress-bar", "off"], { env }, log);
      log.push(`[matte] step 3/4: rembg[${extra}] (+ onnxruntime${extra === "gpu" ? "-gpu" : ""}, numpy, pillow)`);
      await run(py, ["-m", "pip", "install", `rembg[${extra}]`, "numpy", "pillow", "--progress-bar", "off"], { env }, log);
      const model = (o && MODELS.includes(o.model)) ? o.model : MODELS[0];
      log.push(`[matte] step 4/4: the ${model} model -> ${modelsDir()}`);
      await run(py, ["-c", `from rembg import new_session; new_session(${JSON.stringify(model)}); print("model ready")`], { env }, log);
      fs.writeFileSync(READY(dir), new Date().toISOString());
      installing.state = "done";
      log.push("[matte] AI matte ready");
    } catch (e) {
      installing.state = "error";
      installing.error = String(e.message || e);
      log.push("[matte] failed: " + installing.error);
    }
  })();
  return status();
}

/* ---- the clip */
function srcOf(output) {
  const n = path.basename(String(output || ""));
  if (!n) throw bad("output is required");
  for (const k of ["output", "video"]) {
    const p = path.join(core.pDir(k), n);
    if (fs.existsSync(p)) return p;
  }
  throw bad(`${n} is not in this project`, 404);
}
function probe(file) {
  const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate,nb_frames",
    "-show_entries", "format=duration", "-of", "json", file], { encoding: "utf8" });
  const j = JSON.parse(r.stdout || "{}");
  const s = (j.streams || [])[0] || {};
  const [a, b] = String(s.r_frame_rate || "24/1").split("/").map(Number);
  const fps = b ? a / b : 24;
  const dur = parseFloat((j.format || {}).duration) || 0;
  return { w: s.width | 0, h: s.height | 0, fps: Math.round(fps * 1000) / 1000, dur, frames: parseInt(s.nb_frames, 10) || Math.round(dur * fps) };
}
function ff(args) {
  return new Promise((ok, no) => execFile("ffmpeg", ["-y", "-loglevel", "error"].concat(args), { maxBuffer: 256 * 1024 * 1024, encoding: "buffer" },
    (err, out, se) => (err ? no(new Error(String(se || err.message).trim().split("\n").slice(-2).join(" "))) : ok(out))));
}
/* the screen's colour: the first frame's border (a strip 3% wide all round), averaged */
async function keyColour(file, w, h) {
  const W = 64, H = Math.max(8, Math.round(64 * h / Math.max(1, w)));
  const raw = await ff(["-i", file, "-frames:v", "1", "-vf", `scale=${W}:${H}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
  let r = 0, g = 0, b = 0, n = 0;
  const m = Math.max(1, Math.round(W * 0.03));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x >= m && x < W - m && y >= m && y < H - m) continue;
    const i = (y * W + x) * 3;
    r += raw[i]; g += raw[i + 1]; b += raw[i + 2]; n++;
  }
  return n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : [0, 177, 64];
}
const hex = (c) => "0x" + c.map((v) => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, "0")).join("");
/* the subject's box over the clip (alpha > half), from every 4th frame, and its height frame by frame */
async function alphaBox(file, w, h) {
  const raw = await ff(["-c:v", "libvpx-vp9", "-i", file, "-vf", `select='not(mod(n\\,4))',alphaextract,scale=${w}:${h}`, "-vsync", "0",
    "-f", "rawvideo", "-pix_fmt", "gray", "-"]);
  const fsz = w * h, nf = Math.floor(raw.length / fsz);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  const heights = [];
  for (let f = 0; f < nf; f++) {
    let fy0 = h, fy1 = -1;
    for (let y = 0; y < h; y++) {
      const row = f * fsz + y * w;
      for (let x = 0; x < w; x++) {
        if (raw[row + x] > 128) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < fy0) fy0 = y; if (y > fy1) fy1 = y;
        }
      }
    }
    if (fy1 >= 0) { heights.push(fy1 - fy0 + 1); if (fy0 < y0) y0 = fy0; if (fy1 > y1) y1 = fy1; }
  }
  heights.sort((a, b) => a - b);
  return { bbox: x1 >= 0 ? { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } : { x: 0, y: 0, w, h },
           height: heights.length ? heights[Math.floor(heights.length / 2)] : h, sampled: nf };
}

const jobs = new Map();
function job(id) {
  const j = jobs.get(ID(id));
  if (!j) return { state: "none" };
  return { state: j.state, done: j.done, of: j.of, method: j.method, error: j.error || null, result: j.result || null };
}
function start(o) {
  o = o || {};
  const id = ID(o.id);
  if (!id) throw bad("an id is required");
  const src = srcOf(o.output);
  const want = ["ai", "key"].includes(o.method) ? o.method : "auto";
  const st = status();
  if (want === "ai" && !st.ai && !o.fake) throw bad("the AI matte is not installed - ⬇ Install it, or pick Chroma key", 409);
  const method = want === "auto" ? (st.ai || o.fake ? "ai" : "key") : want;
  const pr = probe(src);
  if (!(pr.w > 0 && pr.h > 0)) throw bad(`${path.basename(src)} has no picture`);
  const J = { state: "running", done: 0, of: pr.frames || 0, method, error: null, result: null };
  jobs.set(id, J);
  const vdir = core.pDir("video");
  fs.mkdirSync(vdir, { recursive: true });
  const name = `pathv_${id}.webm`, left = `pathv_${id}_l.webm`;
  const out = path.join(vdir, name), outL = path.join(vdir, left);
  (async () => {
    try {
      const key = Array.isArray(o.key) && o.key.length === 3 ? o.key.map(Number) : await keyColour(src, pr.w, pr.h);
      if (method === "key") {
        const sim = Math.max(0.02, Math.min(0.5, Number(o.similarity) || 0.14));
        await ff(["-i", src, "-an", "-vf", `chromakey=${hex(key)}:${sim}:0.06,format=rgba,despill=type=${key[2] > key[1] ? "blue" : "green"}:mix=0.6,format=yuva420p`,
          "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0", "-b:v", "0", "-crf", "24", "-deadline", "good", "-cpu-used", "4",
          "-metadata:s:v:0", "alpha_mode=1", out]);
        J.done = J.of;
      } else {
        const py = o.fake ? (o.python || (IS_WIN ? "python" : "python3")) : st.python;
        const tmp = path.join(require("os").tmpdir(), `h3_matte_${id}_${Date.now()}.json`);
        fs.writeFileSync(tmp, JSON.stringify({ input: src, output: out, w: pr.w, h: pr.h, fps: pr.fps, frames: pr.frames,
          model: MODELS.includes(o.model) ? o.model : MODELS[0], key, despill: o.despill !== false, fake: !!o.fake }));
        const log = [];
        await new Promise((ok, no) => {
          const p = spawn(py, [SCRIPT, tmp], { env: { ...process.env, U2NET_HOME: modelsDir(), PYTHONUNBUFFERED: "1" }, windowsHide: true });
          let part = "";
          const read = (d) => {
            const lines = (part + String(d)).split(/\r?\n/); part = lines.pop();
            for (const l of lines) {
              log.push(l); if (log.length > 60) log.shift();
              const m = /H3M frame (\d+)\/(\d+)/.exec(l);
              if (m) { J.done = +m[1]; J.of = Math.max(J.of, +m[2]); }
              const e = /H3M error: (.*)$/.exec(l);
              if (e) J.error = e[1];
            }
          };
          p.stdout.on("data", read); p.stderr.on("data", read);
          p.on("error", no);
          p.on("close", (code) => { try { fs.unlinkSync(tmp); } catch { /* fine */ }
            code === 0 ? ok() : no(new Error(J.error || `the matte stopped (exit ${code}): ` + log.slice(-3).join(" ").slice(0, 300))); });
        });
      }
      // the mirror: the same subject facing the other way (a path that turns back)
      await ff(["-c:v", "libvpx-vp9", "-i", out, "-an", "-vf", "hflip,format=yuva420p", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
        "-auto-alt-ref", "0", "-b:v", "0", "-crf", "24", "-deadline", "good", "-cpu-used", "4", "-metadata:s:v:0", "alpha_mode=1", outL]);
      const box = await alphaBox(out, pr.w, pr.h);
      J.result = { name, left, w: pr.w, h: pr.h, dur: core.probeDuration(out) || pr.dur, fps: pr.fps, bbox: box.bbox, height: box.height,
                   key: "#" + hex(key).slice(2), method };
      J.state = "done";
    } catch (e) {
      J.state = "error";
      J.error = String(e.message || e);
    }
  })();
  return { id, state: "running", method };
}

module.exports = { MODELS, status, install, start, job, keyColour, alphaBox, probe, venvDir, modelsDir };   // 2.488.0: + modelsDir (lib/subjectMatte.js)
