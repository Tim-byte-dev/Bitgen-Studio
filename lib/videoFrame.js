// bitGen Studio — lib/videoFrame.js (2.903.0): A VIDEO IN THE PREVIEW, ONE FRAME AT A TIME + 📷 CAPTURE THE FRAME.
//
// Tim (verbatim): "when viewing a video add a button to advance 1 frame and go back 1 frame. and a button to capture the frame"
//
// The page (static/lbframe.js) steps the <video> by one frame; it needs the video's real frame rate and frame count (a
// browser does not tell them), and the captured frame is cut by ffmpeg from the FILE - the exact frame at the video's own
// size, not the browser's scaled, colour-converted picture - and saved like the image editor's 💾 Save to Images
// (lib/imageSave.js: the project's images folder = Assets, and the Gallery).
//   fileOf(url)          the preview's address (/outputs/<name>, /passets/video|images|sound/<name>) -> the file | null
//   rate(text)           "30000/1001" -> 29.97 (pure)
//   frameAt(t, fps, n)   the frame shown at t seconds (0 .. n-1) (pure)
//   nameFor(file, n)     <video>_frame<n>.png (pure)
//   info(url)            -> {fps, frames, dur, w, h, name}
//   capture(url, o)      o = {t | frame} -> {ok, name, gallery, frame, t, w, h} (the PNG saved)
"use strict";
const fs = require("fs"), path = require("path"), { spawnSync } = require("child_process");
const FFMPEG = process.env.BITGEN_FFMPEG || "ffmpeg", FFPROBE = process.env.BITGEN_FFPROBE || "ffprobe";
let core = null;
const C = () => core || (core = require("./core"));
function setCore(c) { core = c; }

function err(msg, status) { return Object.assign(new Error(msg), { status: status || 400 }); }

function fileOf(url) {
  let u = String(url || "");
  try { u = new URL(u, "http://x").pathname; } catch (e) { /* a plain path */ }
  try { u = decodeURIComponent(u); } catch (e) { /* as it is */ }
  let m = /^\/outputs\/([^/]+)$/.exec(u);
  if (m) return require("./frames").resolveMedia(m[1], "output");
  m = /^\/passets\/(images|video|sound)\/([^/]+)$/.exec(u);
  if (m) { const p = path.join(C().pDir(m[1]), path.basename(m[2])); return fs.existsSync(p) ? p : null; }
  return null;
}

function rate(t) {
  const s = String(t || "").trim(), m = /^(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?$/.exec(s);
  if (!m) return 0;
  const v = m[2] ? +m[1] / +m[2] : +m[1];
  return isFinite(v) && v > 0 && v < 1000 ? Math.round(v * 1000) / 1000 : 0;
}
function frameAt(t, fps, n) {
  const f = Math.floor(Math.max(0, +t || 0) * fps + 1e-6);
  return n > 0 ? Math.min(n - 1, f) : f;
}
function nameFor(file, n) {
  const stem = path.basename(String(file || "video"), path.extname(String(file || ""))).replace(/[^\w.-]+/g, "_").replace(/_{2,}/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "video";
  return `${stem}_frame${n}.png`;
}

function probe(file) {
  const r = spawnSync(FFPROBE, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate,avg_frame_rate,nb_frames,duration:format=duration",
    "-of", "json", file], { encoding: "utf8", timeout: 30000 });
  if (r.error) throw err("ffprobe is not on this computer (" + r.error.code + ")", 500);
  let j = {}; try { j = JSON.parse(r.stdout || "{}"); } catch (e) { j = {}; }
  const s = (j.streams || [])[0];
  if (!s) throw err("no video in that file", 400);
  const fps = rate(s.avg_frame_rate) || rate(s.r_frame_rate) || 24;
  const dur = +s.duration || +((j.format || {}).duration) || 0;
  const frames = +s.nb_frames > 0 ? +s.nb_frames : Math.max(1, Math.round(dur * fps));
  return { fps, frames, dur, w: +s.width || 0, h: +s.height || 0 };
}

function info(url) {
  const file = fileOf(url);
  if (!file) throw err("that video is not in this project's folders", 404);
  return Object.assign(probe(file), { name: path.basename(file) });
}

function capture(url, o) {
  const file = fileOf(url);
  if (!file) throw err("that video is not in this project's folders", 404);
  const p = probe(file), x = o || {};
  const n = x.frame !== undefined && x.frame !== null && x.frame !== "" ? Math.max(0, Math.min(p.frames - 1, Math.floor(+x.frame) || 0)) : frameAt(x.t, p.fps, p.frames);
  // ffmpeg's -ss gives the first frame that STARTS at or after the time: half a frame before frame n is frame n (its own start
  // can round a hair past n / fps in a millisecond time base - webm - and give frame n + 1)
  const at = n === 0 ? 0 : Math.max(0, (n - 0.5) / p.fps);
  const r = spawnSync(FFMPEG, ["-v", "error", "-ss", at.toFixed(6), "-i", file, "-frames:v", "1", "-an", "-f", "image2pipe", "-vcodec", "png", "pipe:1"],
    { maxBuffer: 512 * 1024 * 1024, timeout: 120000 });
  if (r.error) throw err("ffmpeg is not on this computer (" + r.error.code + ")", 500);
  const buf = r.stdout;
  if (!buf || buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) throw err("ffmpeg could not read that frame: " + String(r.stderr || "").trim().split("\n").slice(-1)[0], 500);
  const saved = require("./imageSave").finish(buf, { name: nameFor(file, n), ext: "png" });
  return Object.assign(saved, { frame: n, t: at, w: p.w, h: p.h, fps: p.fps });
}

module.exports = { fileOf, rate, frameAt, nameFor, info, capture, setCore };
