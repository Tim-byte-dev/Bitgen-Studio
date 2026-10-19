// bitGen Studio — lib/subjectMatte.js (2.488.0): Select Subject with the AI matte - one still in, its subject's mask out.
// The model is the path layers' AI matte (lib/matte.js: rembg + BiRefNet in venvs/matte, models in models/rembg), run on
// one picture by scripts/subject_matte.py. Used by routes/subject.js (the image editor's Select ▸ Subject).
//   status()             {ai, installing, models}
//   install(o)           lib/matte.js's install (in the background)
//   run(png, o)          Promise<Buffer>: the mask as a grey PNG (white = subject); o = {model, fake}
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const { spawn } = require("child_process");
const matte = require("./matte");

const SCRIPT = path.join(__dirname, "..", "scripts", "subject_matte.py");
const MAX = 64 * 1024 * 1024;
const IS_WIN = process.platform === "win32";
const bad = (msg, status) => Object.assign(new Error(msg), { status: status || 400 });
const isPng = (b) => Buffer.isBuffer(b) && b.length > 8 && b.readUInt32BE(0) === 0x89504e47;

function status() { const s = matte.status(); return { ai: !!s.ai, installing: s.installing, models: matte.MODELS }; }
function install(o) { return matte.install(o || {}); }

function run(png, o) {
  const opt = o || {};
  if (!isPng(png)) return Promise.reject(bad("send the picture as a PNG"));
  if (png.length > MAX) return Promise.reject(bad("the picture is too big", 413));
  const st = matte.status();
  if (!opt.fake && !st.ai) return Promise.reject(bad("the AI matte is not installed - Select ▸ Subject Settings… ⬇ Install, or use Built in", 409));
  const model = matte.MODELS.includes(opt.model) ? opt.model : matte.MODELS[0];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bg-subj-")), inp = path.join(dir, "in.png"), out = path.join(dir, "mask.png"), job = path.join(dir, "job.json");
  fs.writeFileSync(inp, png);
  fs.writeFileSync(job, JSON.stringify({ input: inp, output: out, model, fake: !!opt.fake }));
  const pyBin = opt.fake ? (IS_WIN ? "python" : "python3") : st.python;
  return new Promise((ok, no) => {
    const env = { ...process.env, PYTHONUNBUFFERED: "1" };
    if (matte.modelsDir) env.U2NET_HOME = matte.modelsDir();
    const p = spawn(pyBin, [SCRIPT, job], { env, windowsHide: true });
    let err = "";
    const timer = setTimeout(() => { try { p.kill(); } catch (_) { /* gone */ } }, 300000);
    p.stderr.on("data", (d) => { err = (err + d).slice(-4000); });
    p.on("error", (e) => { clearTimeout(timer); no(e); });
    p.on("close", (code) => {
      clearTimeout(timer);
      try {
        if (code !== 0 || !fs.existsSync(out)) return no(new Error("the AI matte failed: " + (err.trim().split("\n").pop() || "exit " + code)));
        ok(fs.readFileSync(out));
      } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* fine */ } }
    });
  });
}
module.exports = { status, install, run, isPng, MAX };
