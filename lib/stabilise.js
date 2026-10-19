// bitGen Studio — lib/stabilise.js (2.413.0): the canvas's STEADY PREVIEW of a ✨ stabilised clip. The compile has
// stabilised since 2.409.0 (scripts/vfx_filters.py; vidstab with a smoothing % since 2.413.0) but the canvas showed the
// shot as it was. Here the whole source file is stabilised once per (file, smoothing, lock) - 640 wide, VP9 + its sound,
// in <project>/cache/stab - and the canvas reads that file instead (same times: only the file changes).
// Tim: "do the smaller jobs and complete the 10 partly done jobs" (Stabilise: "the canvas shows the shot as it is").
//
//   want({name, smooth, lock}) -> {state: "ready" | "working" | "failed", file, url, error}   (starts the work once)
//   fileFor(file) -> the cached file's path (the route serves it), or null
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

function core() { return require("./core"); }
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
const jobs = new Map();                      // key -> {state, error}

function dir() {
  const c = core();
  const d = path.join(c.projDir(c.getProject()), "cache", "stab");
  fs.mkdirSync(d, { recursive: true });
  return d;
}
function norm(o) {
  const sm = Math.max(0, Math.min(100, Math.round(Number(o && o.smooth != null ? o.smooth : 50)) || 0));
  return { smooth: Number.isFinite(sm) ? sm : 50, lock: !!(o && o.lock) };
}
/** the cache file's name: the source (name + size + mtime) and the settings */
function keyOf(src, o) {
  const st = fs.statSync(src);
  const h = crypto.createHash("sha1").update([path.basename(src), st.size, st.mtimeMs, o.smooth, o.lock ? 1 : 0].join("|")).digest("hex").slice(0, 16);
  return path.basename(src).replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_").slice(0, 40) + "_" + h + ".webm";
}

function want(o) {
  const name = path.basename(String((o && o.name) || ""));
  if (!name) throw bad("which clip? (name)");
  const src = require("./asr").findAsset(name);
  if (!src) throw bad("not in this project: " + name, 404);
  const n = norm(o), file = keyOf(src, n), out = path.join(dir(), file), url = "/api/clipfx/stabilised/" + encodeURIComponent(file);
  if (fs.existsSync(out) && fs.statSync(out).size > 0) return { state: "ready", file, url };
  const j = jobs.get(file);
  if (j) return { state: j.state, file, url, error: j.error || "" };
  const c = core();
  const py = ((c.getConfig().paths || {}).python) || (process.platform === "win32" ? "python" : "python3");
  const tmp = out.replace(/\.webm$/, ".part.webm");
  const job = { state: "working", error: "" };
  jobs.set(file, job);
  let err = "";
  const p = spawn(py, [path.join(c.resolvePath("scripts"), "clipfx_render.py"), "stabprev", src, tmp, String(n.smooth), n.lock ? "1" : "0"],
    { stdio: ["ignore", "ignore", "pipe"] });
  p.stderr.on("data", (d) => { err += String(d); });
  p.on("error", (e) => { job.state = "failed"; job.error = e.message; });
  p.on("close", (code) => {
    if (code === 0 && fs.existsSync(tmp)) {
      try { fs.renameSync(tmp, out); jobs.delete(file); return; } catch (e) { err = e.message; }
    }
    job.state = "failed"; job.error = (err.trim().split("\n").pop() || "the steady preview failed").slice(0, 300);
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

module.exports = { want, fileFor, keyOf, norm };
