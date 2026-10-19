// bitGen Studio — lib/proxy.js (2.416.0): PROXIES for heavy footage - light copies the canvas plays while the compile
// keeps reading the originals (Premiere's proxy workflow).
// Tim: "continue with the next part please the gap is getting smaller - soon bitgen should be superior".
//
//   info(names) -> {name: {w, h, codec, fps, mbps, heavy, why, state}}   heavy = more than 1920 wide or tall, a codec a
//                  browser plays badly or not at all (HEVC, ProRes, DNxHD, ...), or over 40 Mbit/s
//   want(name)  -> {state: ready | working | failed, file, url, error}  starts the proxy once: 960 wide VP9 (a key frame
//                  every 12 frames - quick to scrub), the sound as Opus, the same times as the original
//   fileFor(file) -> the proxy's path (the route serves it)
// Cached in <project>/cache/proxy/<name>_<sha1 of size + mtime>.webm - a changed original makes a new one.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn, spawnSync } = require("child_process");

function core() { return require("./core"); }
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
const jobs = new Map();
const HARD = ["hevc", "h265", "prores", "dnxhd", "dnxhr", "cfhd", "mjpeg", "mpeg2video", "rawvideo", "ffv1", "jpeg2000", "qtrle", "png"];
const PW = 960;

function dir() {
  const c = core();
  const d = path.join(c.projDir(c.getProject()), "cache", "proxy");
  fs.mkdirSync(d, { recursive: true });
  return d;
}
function keyOf(src) {
  const st = fs.statSync(src);
  const h = crypto.createHash("sha1").update([path.basename(src), st.size, st.mtimeMs, PW].join("|")).digest("hex").slice(0, 12);
  return path.basename(src).replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_").slice(0, 40) + "_" + h + ".webm";
}
function probe(src) {
  const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height,r_frame_rate,bit_rate:format=bit_rate",
    "-of", "json", src], { encoding: "utf8" });
  try {
    const j = JSON.parse(r.stdout || "{}"), s = (j.streams || [])[0] || {};
    const fr = String(s.r_frame_rate || "0/1").split("/"), fps = +fr[1] ? +fr[0] / +fr[1] : 0;
    const br = +(s.bit_rate || (j.format || {}).bit_rate || 0);
    return { codec: s.codec_name || "", w: +s.width || 0, h: +s.height || 0, fps: Math.round(fps * 1000) / 1000, mbps: Math.round(br / 1e5) / 10 };
  } catch { return { codec: "", w: 0, h: 0, fps: 0, mbps: 0 }; }
}
function heavyOf(p) {
  const why = [];
  if (Math.max(p.w, p.h) > 1920) why.push(p.w + "×" + p.h);
  if (HARD.includes(String(p.codec).toLowerCase())) why.push(p.codec);
  if (p.mbps > 40) why.push(p.mbps + " Mbit/s");
  return why;
}
function stateOf(src) {
  const file = keyOf(src), out = path.join(dir(), file);
  if (fs.existsSync(out) && fs.statSync(out).size > 0) return { state: "ready", file, url: "/api/proxy/file/" + encodeURIComponent(file) };
  const j = jobs.get(file);
  return j ? { state: j.state, file, error: j.error || "" } : { state: "none", file };
}
function info(names) {
  const asr = require("./asr"), out = {};
  (Array.isArray(names) ? names : []).slice(0, 200).forEach((n0) => {
    const n = path.basename(String(n0 || "")); if (!n) return;
    const src = asr.findAsset(n);
    if (!src) { out[n] = { error: "not in this project" }; return; }
    const p = probe(src), why = heavyOf(p), st = stateOf(src);
    out[n] = Object.assign(p, { heavy: why.length > 0, why: why.join(", "), state: st.state, url: st.url, error: st.error });
  });
  return out;
}
function want(name0) {
  const name = path.basename(String(name0 || ""));
  if (!name) throw bad("which clip? (name)");
  const src = require("./asr").findAsset(name);
  if (!src) throw bad("not in this project: " + name, 404);
  const st = stateOf(src);
  if (st.state === "ready" || st.state === "working") return st;
  const file = st.file, out = path.join(dir(), file), tmp = out.replace(/\.webm$/, ".part.webm");
  const job = { state: "working", error: "" };
  jobs.set(file, job);
  let err = "";
  const p = spawn("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-map", "0:v:0", "-map", "0:a:0?", "-vf", `scale='min(${PW},iw)':-2,format=yuv420p`,
    "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36", "-deadline", "realtime", "-cpu-used", "8", "-row-mt", "1", "-g", "12",
    "-c:a", "libopus", "-b:a", "96k", tmp], { stdio: ["ignore", "ignore", "pipe"] });
  p.stderr.on("data", (d) => { err += String(d); });
  p.on("error", (e) => { job.state = "failed"; job.error = e.message; });
  p.on("close", (code) => {
    if (code === 0 && fs.existsSync(tmp)) { try { fs.renameSync(tmp, out); jobs.delete(file); return; } catch (e) { err = e.message; } }
    job.state = "failed"; job.error = (err.trim().split("\n").pop() || "the proxy failed").slice(0, 300);
    try { fs.unlinkSync(tmp); } catch { /* none */ }
  });
  return { state: "working", file };
}
function fileFor(file) {
  const f = path.basename(String(file || ""));
  if (!/^[\w.-]+\.webm$/.test(f)) return null;
  const p = path.join(dir(), f);
  return fs.existsSync(p) ? p : null;
}

module.exports = { info, want, fileFor, heavyOf, probe, keyOf, PW };
