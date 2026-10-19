// bitGen Studio — lib/retimeSound.js (2.417.0): the canvas's SOUND of a reversed / ramped clip. Browsers cannot play
// backwards and a ramp changes speed under the clip, so since 2.406.0 such a clip was "seen, not heard" in the preview.
// Here its sound is rendered once with the compile's own retime (scripts/clipfx_render.py soundprev: areverse + atempo
// per segment) into <project>/cache/retime as Opus/webm; time 0 of that file = the clip's start on the timeline.
// Tim: "continue with the next part please the gap is getting smaller - soon bitgen should be superior".
//
//   want({name, in, out, dur, fx}) -> {state: "ready" | "working" | "failed", file, url, error}   (starts the work once)
//   fileFor(file) -> the cached file's path (the route serves it), or null
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const clipFx = require("./clipFx");

function core() { return require("./core"); }
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
const jobs = new Map();                      // file -> {state, error}

function dir() {
  const c = core();
  const d = path.join(c.projDir(c.getProject()), "cache", "retime");
  fs.mkdirSync(d, { recursive: true });
  return d;
}
/** the retime the compile would use: {segments, reverse} - null when the clip plays straight */
function plan(o) {
  const fx = clipFx.forJob(o && o.fx, { in: Math.max(0, +o.in || 0), out: o.out != null ? +o.out : null, dur: o.dur != null ? +o.dur : null, name: o.name });
  if (!fx || !fx.segments) return null;
  return { segments: fx.segments, reverse: !!fx.reverse };
}
/** the cache file's name: the source (name + size + mtime), the stretch and the retime */
function keyOf(src, o, p) {
  const st = fs.statSync(src);
  const h = crypto.createHash("sha1").update([path.basename(src), st.size, st.mtimeMs, (+o.in || 0).toFixed(3),
    o.out != null ? (+o.out).toFixed(3) : "", JSON.stringify(p)].join("|")).digest("hex").slice(0, 16);
  return path.basename(src).replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_").slice(0, 40) + "_" + h + ".webm";
}

function want(o) {
  const name = path.basename(String((o && o.name) || ""));
  if (!name) throw bad("which clip? (name)");
  const src = require("./asr").findAsset(name);
  if (!src) throw bad("not in this project: " + name, 404);
  const p = plan(Object.assign({}, o, { name }));
  if (!p) throw bad(name + " is not retimed - it plays its own sound");
  const cout = o.out != null ? +o.out : (o.dur != null ? +o.dur : null);
  const file = keyOf(src, Object.assign({}, o, { out: cout }), p), out = path.join(dir(), file);
  const url = "/api/clipfx/retimed/" + encodeURIComponent(file);
  if (fs.existsSync(out) && fs.statSync(out).size > 0) return { state: "ready", file, url };
  const j = jobs.get(file);
  if (j) return { state: j.state, file, url, error: j.error || "" };
  const c = core();
  const py = ((c.getConfig().paths || {}).python) || (process.platform === "win32" ? "python" : "python3");
  const tmp = out.replace(/\.webm$/, ".part.webm");
  const job = { state: "working", error: "" };
  jobs.set(file, job);
  let err = "";
  const pr = spawn(py, [path.join(c.resolvePath("scripts"), "clipfx_render.py"), "soundprev", src, tmp, JSON.stringify(p),
    String(+o.in || 0), cout != null ? String(cout) : "0"], { stdio: ["ignore", "ignore", "pipe"] });
  pr.stderr.on("data", (d) => { err += String(d); });
  pr.on("error", (e) => { job.state = "failed"; job.error = e.message; });
  pr.on("close", (code) => {
    if (code === 0 && fs.existsSync(tmp)) {
      try { fs.renameSync(tmp, out); jobs.delete(file); return; } catch (e) { err = e.message; }
    }
    job.state = "failed"; job.error = (err.trim().split("\n").pop() || "the sound preview failed").slice(0, 300);
    try { fs.unlinkSync(tmp); } catch { /* none */ }
  });
  return { state: "working", file, url };
}

function fileFor(file) {
  const f = path.basename(String(file || ""));
  if (!/^[\w.-]+\.webm$/.test(f)) return null;
  const p = path.join(dir(), f);
  return fs.existsSync(p) ? p : null;
}

module.exports = { want, fileFor, plan, keyOf };
