// bitGen Studio — REFERENCE VIDEO SELECTION (2.325.0).
//
// Tim (verbatim): "when user clicks a video in the reference docker show a
// dialog, show filmstrip of the clicked reference video and preview. show a
// selection box, selection box overlay on the filmstrip will be the length
// of the duration input in the dialog, the box will select the start frame
// and end frame within the box, allow user to zoom in and out of filmstrip.
// the selected portion will be the reference video for generation, either
// to continue the video, change the character or general reference. show
// the selected region in the preview only, add an apply and cancel button
// to the dialog".
//
// The dialog is static/refselect.js. Apply CUTS the selected frames into a
// new Video asset beside the source - `<stem>_sel_f<first>-f<last>.mp4`,
// frame-exact (re-encoded from the start frame, the source's own fps, its
// audio kept) - and the reference dock's entry becomes that clip. Every
// consumer (Ref / F/L references, Swap mode, a chain's continuation) already
// takes a video by NAME, so nothing downstream needs to know about windows.
// The source is never touched. projects/<p>/refsel.json remembers which
// source + frames each cut came from, so clicking a cut reopens the SOURCE
// with the box where it was.
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const FILE = "refsel.json";
const VIDEO_EXT = [".mp4", ".webm", ".mov", ".mkv", ".avi", ".m4v", ".gif"];

function fpsOf(s) {
  const m = /^(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?$/.exec(String(s || "").trim());
  if (!m) return 0;
  const v = m[2] ? +m[1] / +m[2] : +m[1];
  return Number.isFinite(v) && v > 0 && v < 1000 ? v : 0;
}

/** {duration, fps, frames, width, height, audio} of a video file, or null. */
function probe(file) {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries",
    "stream=codec_type,r_frame_rate,avg_frame_rate,nb_frames,width,height:format=duration",
    "-of", "json", file], { encoding: "utf8" });
  if (r.error || r.status !== 0) return null;
  let d;
  try { d = JSON.parse(r.stdout || "{}"); } catch { return null; }
  const st = d.streams || [];
  const v = st.find((s) => s.codec_type === "video");
  if (!v) return null;
  const fps = fpsOf(v.avg_frame_rate) || fpsOf(v.r_frame_rate) || 24;
  const duration = +((d.format || {}).duration) || 0;
  const nb = parseInt(v.nb_frames, 10);
  const frames = Number.isFinite(nb) && nb > 0 ? nb : Math.max(1, Math.round(duration * fps));
  return { duration, fps: Math.round(fps * 1000) / 1000, frames,
           width: +v.width || 0, height: +v.height || 0,
           audio: st.some((s) => s.codec_type === "audio") };
}

/**
 * The selection in whole frames: start snapped to a frame, the duration
 * to a frame count (>= 1), the box kept inside the video (a box longer
 * than the video becomes the whole video).
 */
function plan(info, start, dur) {
  const fps = +(info && info.fps) || 24;
  const total = Math.max(1, parseInt(info && info.frames, 10) || 1);
  let n = Math.round((Number(dur) || 0) * fps);
  if (!(n >= 1)) n = total;
  n = Math.min(n, total);
  let s = Math.round((Number(start) || 0) * fps);
  if (!(s >= 0)) s = 0;
  s = Math.min(s, total - n);
  return { fps, startFrame: s, frames: n, endFrame: s + n - 1,
           start: Math.round((s / fps) * 1e6) / 1e6, dur: Math.round((n / fps) * 1e6) / 1e6,
           whole: s === 0 && n === total };
}

function cutName(source, p) {
  const stem = path.basename(String(source), path.extname(String(source)))
    .replace(/_sel_f\d+-f\d+$/, "");
  return `${stem}_sel_f${p.startFrame}-f${p.endFrame}.mp4`;
}

/** ffmpeg: frames [startFrame, endFrame] of src, the source's fps, audio kept. */
function cutArgs(src, dst, p) {
  return ["-hide_banner", "-loglevel", "error", "-y",
          "-ss", p.start.toFixed(6), "-i", src,
          "-frames:v", String(p.frames), "-t", p.dur.toFixed(6),
          "-c:v", "libx264", "-crf", "14", "-preset", "veryfast", "-pix_fmt", "yuv420p",
          "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", dst];
}

function read(projDir) {
  try { const j = JSON.parse(fs.readFileSync(path.join(projDir, FILE), "utf8"));
        return j && typeof j === "object" ? j : {}; } catch { return {}; }
}

function record(projDir, name, rec) {
  const all = read(projDir);
  all[name] = rec;
  fs.mkdirSync(projDir, { recursive: true });
  fs.writeFileSync(path.join(projDir, FILE), JSON.stringify(all, null, 2));
}

const isVideo = (n) => VIDEO_EXT.includes(path.extname(String(n || "")).toLowerCase());

/**
 * What the dialog opens on for a clicked name: the SOURCE (a cut resolves
 * to the file it was cut from, while that still exists) + its probe + the
 * remembered selection (null = none yet).
 */
function describe(projDir, videoDir, name) {
  const n = path.basename(String(name || ""));
  if (!n || !isVideo(n)) return { error: "not a video file" };
  if (!fs.existsSync(path.join(videoDir, n))) return { error: `no such video asset: ${n}` };
  const rec = read(projDir)[n];
  const src = rec && rec.source && fs.existsSync(path.join(videoDir, rec.source)) ? rec.source : n;
  const info = probe(path.join(videoDir, src));
  if (!info) return { error: `ffprobe could not read ${src} (is ffmpeg on PATH?)` };
  return { name: n, source: src, ...info,
           selection: src !== n ? { start: rec.start, dur: rec.dur, startFrame: rec.startFrame,
                                     endFrame: rec.endFrame } : null };
}

/**
 * Apply: cut [start, start+dur) of `source` into its _sel_ clip (reused
 * when that exact cut already exists). The whole video = no cut, the
 * source itself is the reference.
 */
function select(projDir, videoDir, source, start, dur) {
  const src = path.basename(String(source || ""));
  if (!src || !isVideo(src)) return { error: "not a video file" };
  const abs = path.join(videoDir, src);
  if (!fs.existsSync(abs)) return { error: `no such video asset: ${src}` };
  const info = probe(abs);
  if (!info) return { error: `ffprobe could not read ${src} (is ffmpeg on PATH?)` };
  const p = plan(info, start, dur);
  if (p.whole) return { ok: true, name: src, cut: false, ...p,
                        note: `the whole of ${src} is the reference (${p.frames} frames)` };
  const name = cutName(src, p);
  const dst = path.join(videoDir, name);
  if (!fs.existsSync(dst)) {
    const tmp = dst + ".part.mp4";
    const r = spawnSync("ffmpeg", cutArgs(abs, tmp, p), { encoding: "utf8" });
    if (r.error || r.status !== 0) {
      try { fs.unlinkSync(tmp); } catch {}
      return { error: "ffmpeg could not cut the selection: "
        + String((r.error && r.error.message) || r.stderr || "").trim().split("\n").pop() };
    }
    fs.renameSync(tmp, dst);
  }
  record(projDir, name, { source: src, start: p.start, dur: p.dur, fps: p.fps,
                          startFrame: p.startFrame, endFrame: p.endFrame });
  return { ok: true, name, cut: true, ...p,
           note: `frames ${p.startFrame}-${p.endFrame} of ${src} (${p.dur.toFixed(2)}s) -> ${name}` };
}

module.exports = { FILE, VIDEO_EXT, fpsOf, probe, plan, cutName, cutArgs, read, record,
                   describe, select, isVideo };
