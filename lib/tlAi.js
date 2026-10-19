// bitGen Studio — lib/tlAi.js (2.420.0): the server half of 🤖 AI INSIDE THE TIMELINE (ext/timelinedock/tlai.js).
// Tim: "yes, please add your 2 suggestions" (regenerate a shot in place, extend it, AI B-roll for a gap, AI-aware cuts).
//
//   frame({name, t})        -> {file, url}   a clip's picture at source second t as a PNG (<project>/temp/tlai) - the
//                              first frame of a new take / the last frame an extension or a B-roll continues from
//   fileFor(file)           -> its path (the route serves it) or null
//   probe({name})           -> {name, src, dur, w, h}   a finished job's file, ready to be a clip
//   beats({name, start, dur}) -> {tempo, beats, dur, cached}   scripts/beats.py, cached in <project>/cache/beats
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn, spawnSync } = require("child_process");

function core() { return require("./core"); }
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
function find(name) {
  const f = require("./asr").findAsset(path.basename(String(name || "")));
  if (!f) throw bad("not in this project: " + name, 404);
  return f;
}
function pdir() { const c = core(); return c.projDir(c.getProject()); }
function srcOf(f) {
  const d = path.basename(path.dirname(f));
  return d === "video" ? "video" : d === "final" ? "final" : d === "sound" ? "sound" : "output";
}

function frame(o) {
  const f = find(o && o.name);
  const t = Math.max(0, Number(o && o.t) || 0);
  const st = fs.statSync(f);
  const key = crypto.createHash("sha1").update([path.basename(f), st.size, st.mtimeMs, t.toFixed(3)].join("|")).digest("hex").slice(0, 16);
  const dir = path.join(pdir(), "temp", "tlai");
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, "frame_" + key + ".png");
  if (!fs.existsSync(out)) {
    // -ss before -i is fast but lands on a keyframe on some files: decode up to the moment instead (accurate)
    let r = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", f, "-ss", t.toFixed(3), "-frames:v", "1", out], { encoding: "utf8" });
    if ((r.status !== 0 || !fs.existsSync(out)) && t > 0.05)    // past the end: the last frame
      r = spawnSync("ffmpeg", ["-v", "error", "-y", "-sseof", "-0.1", "-i", f, "-frames:v", "1", "-update", "1", out], { encoding: "utf8" });
    if (!fs.existsSync(out)) throw bad("no picture at " + t.toFixed(2) + " s in " + path.basename(f) + ": " + String(r.stderr || "").trim().split("\n").pop(), 422);
  }
  return { file: path.basename(out), url: "/api/tlai/frame/" + path.basename(out) };
}
function fileFor(file) {
  const f = path.basename(String(file || ""));
  if (!/^frame_[0-9a-f]{16}\.png$/.test(f)) return null;
  const p = path.join(pdir(), "temp", "tlai", f);
  return fs.existsSync(p) ? p : null;
}
function probe(o) {
  const f = find(o && o.name);
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration", "-of", "json", f], { encoding: "utf8" });
  let j = {};
  try { j = JSON.parse(r.stdout || "{}"); } catch { j = {}; }
  const v = (j.streams || []).find((s) => s.codec_type === "video") || {};
  const dur = Number((j.format || {}).duration);
  if (!Number.isFinite(dur) || dur <= 0) throw bad("not a finished video: " + path.basename(f), 422);
  return { name: path.basename(f), src: srcOf(f), dur: Math.round(dur * 1000) / 1000, w: v.width || 0, h: v.height || 0 };
}
function beats(o) {
  const f = find(o && o.name);
  const start = Math.max(0, Number(o && o.start) || 0), dur = Math.max(0, Number(o && o.dur) || 0);
  const st = fs.statSync(f);
  const key = crypto.createHash("sha1").update([path.basename(f), st.size, st.mtimeMs, start.toFixed(3), dur.toFixed(3)].join("|")).digest("hex").slice(0, 16);
  const dir = path.join(pdir(), "cache", "beats");
  const cf = path.join(dir, key + ".json");
  try { return Object.assign(JSON.parse(fs.readFileSync(cf, "utf8")), { cached: true }); } catch { /* not yet */ }
  const c = core();
  const py = ((c.getConfig().paths || {}).python) || (process.platform === "win32" ? "python" : "python3");
  return new Promise((resolve, reject) => {
    let so = "", se = "";
    const p = spawn(py, [path.join(c.resolvePath("scripts"), "beats.py"), f, String(start), String(dur)], { stdio: ["ignore", "pipe", "pipe"] });
    const to = setTimeout(() => { try { p.kill(); } catch { /* gone */ } }, 180000);
    p.stdout.on("data", (d) => { so += d; });
    p.stderr.on("data", (d) => { se += d; });
    p.on("error", (e) => { clearTimeout(to); reject(e); });
    p.on("close", (code) => {
      clearTimeout(to);
      if (code !== 0) return reject(bad(/No module named 'numpy'/.test(se) ? "numpy is not installed (pip install numpy)" : (se.trim().split("\n").pop() || "the beat finder failed"), 500));
      try {
        const r = JSON.parse(so);
        fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(cf, JSON.stringify(r));
        resolve(Object.assign(r, { cached: false }));
      } catch (e) { reject(e); }
    });
  });
}

module.exports = { frame, fileFor, probe, beats };
