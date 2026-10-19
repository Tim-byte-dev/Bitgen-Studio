"use strict";
/**
 * sfx.js — THE SFX DOCK'S LIBRARY (2.360.0).
 *
 * Tim: "can you add a sfx docker, let user add video files, including .mov or audio files, extract audio from
 * video files allow user to select section from the waveform and trim - give option to keep selected or delete
 * selected".
 *
 * projects/<p>/sfx/ holds the project's sound effects, every one a 48 kHz stereo 16-bit WAV, so a cut is
 * sample-exact and a re-cut never loses quality:
 *   add(tmp, original)   an audio file is converted, a VIDEO (.mov .mp4 .mkv .webm .avi ...) has its first
 *                        audio track extracted; a video with no audio track is refused in words
 *   trim(name, a, b, mode, asNew)
 *                        "keep"   - only [a, b] is left
 *                        "delete" - [a, b] is cut out and the two sides are joined
 *                        each cut edge gets a 5 ms fade (no click at the join). In place, the previous version
 *                        kept in sfx/.undo/ for ↶ Undo; asNew writes <name>_keep / <name>_cut beside it instead
 *   undo(name)           the version before the last in-place cut
 *   toSound(name)        a copy into the project's Sound assets (timeline, references, the other docks)
 *   toGallery(name)      2.361.0 (Tim: "add saved file to the sound tab in gallery docker"): every cut's result
 *                        is copied into projects/<p>/output as sfx_<name> - the gallery's Audio tab lists it;
 *                        a later cut / undo of the same sound refreshes that copy (it is the sound's, never
 *                        another file's)
 *   remove(name)         the file and its undo copy
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const core = require("./core");

const AUDIO_EXT = [".wav", ".mp3", ".flac", ".ogg", ".oga", ".m4a", ".aac", ".opus", ".wma", ".aif", ".aiff"];
const VIDEO_EXT = [".mov", ".mp4", ".m4v", ".mkv", ".webm", ".avi", ".wmv", ".flv", ".mpg", ".mpeg", ".3gp",
                   ".mts", ".m2ts", ".ts", ".mxf"];
const FADE = 0.005;
const MIN = 0.01;

function dir(project) {
  const d = path.join(core.projDir(project || core.getProject()), "sfx");
  fs.mkdirSync(d, { recursive: true });
  return d;
}
const undoDir = (project) => path.join(dir(project), ".undo");

/** A name that stays inside the folder: its base name, reserved characters replaced. */
function safeName(n) {
  const b = path.basename(String(n || "").replace(/\\/g, "/")).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim();
  return b && b !== "." && b !== ".." && !b.startsWith(".") ? b : "";
}

/** The file of a library entry (abs) or null. */
function fileOf(name, project) {
  const n = safeName(name);
  if (!n) return null;
  const p = path.join(dir(project), n);
  try { return fs.statSync(p).isFile() ? p : null; } catch { return null; }
}

function freeName(d, name) {
  const ext = path.extname(name), stem = name.slice(0, name.length - ext.length);
  let n = name, k = 2;
  while (fs.existsSync(path.join(d, n))) n = `${stem} (${k++})${ext}`;
  return n;
}

function seconds(p) {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p],
                      { encoding: "utf8", timeout: 30000 });
  const d = r.status === 0 ? parseFloat(r.stdout) : NaN;
  return Number.isFinite(d) ? d : null;
}

function hasAudio(p) {
  const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index",
                                  "-of", "csv=p=0", p], { encoding: "utf8", timeout: 30000 });
  if (r.status !== 0) return null;
  return String(r.stdout || "").trim().length > 0;
}

function ffmpeg(args) {
  const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args],
                      { encoding: "utf8", timeout: 600000, maxBuffer: 16 * 1024 * 1024 });
  return { ok: r.status === 0, err: String(r.stderr || (r.error && r.error.message) || "").trim().split("\n").slice(-3).join(" ") };
}

const WAV = ["-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le"];

/** Every sound effect: [{name, size, mtime, undo}] newest first. */
function list(project) {
  const d = dir(project), u = undoDir(project);
  let names = [];
  try { names = fs.readdirSync(d).filter((n) => !n.startsWith(".") && /\.wav$/i.test(n)); } catch { names = []; }
  return names.map((n) => {
    const st = fs.statSync(path.join(d, n));
    return { name: n, size: st.size, mtime: st.mtimeMs / 1000, undo: fs.existsSync(path.join(u, n)) };
  }).sort((a, b) => b.mtime - a.mtime);
}

/** Add one picked file (src = where the upload landed, original = its name). -> {name, from, seconds} | {error} */
function add(src, original, project) {
  const orig = safeName(original) || "sfx";
  const ext = path.extname(orig).toLowerCase();
  const isVideo = VIDEO_EXT.includes(ext), isAudio = AUDIO_EXT.includes(ext);
  if (!isVideo && !isAudio) return { error: `${orig}: not an audio or video file (${AUDIO_EXT.concat(VIDEO_EXT).join(" ")})` };
  const has = hasAudio(src);
  if (has === false) return { error: `${orig} has no audio track - nothing to extract` };
  const d = dir(project);
  const name = freeName(d, orig.slice(0, orig.length - ext.length) + ".wav");
  const out = path.join(d, name);
  const r = ffmpeg(["-i", src, "-vn", "-map", "0:a:0", ...WAV, out]);
  if (!r.ok || !fs.existsSync(out)) {
    try { fs.unlinkSync(out); } catch {}
    return { error: `${orig}: the audio could not be read${r.err ? " - " + r.err : ""}` };
  }
  return { name, from: isVideo ? "video" : "audio", seconds: seconds(out), original: orig };
}

/** The ffmpeg arguments for a cut of a `total`-second file (pure - tested). */
function trimArgs(src, out, a, b, mode, total) {
  const f = (x) => x.toFixed(6);
  if (mode === "keep") {
    const d = b - a;
    const fade = Math.min(FADE, d / 4);
    return ["-i", src, "-af", `atrim=start=${f(a)}:end=${f(b)},asetpts=PTS-STARTPTS,`
      + `afade=t=in:st=0:d=${f(fade)},afade=t=out:st=${f(Math.max(0, d - fade))}:d=${f(fade)}`, ...WAV, out];
  }
  const parts = [];
  if (a > MIN) parts.push({ s: 0, e: a, fadeOut: true });
  if (total - b > MIN) parts.push({ s: b, e: total, fadeIn: true });
  const chains = parts.map((p, i) => {
    const d = p.e - p.s, fade = Math.min(FADE, d / 4);
    return `[0:a]atrim=start=${f(p.s)}:end=${f(p.e)},asetpts=PTS-STARTPTS`
      + (p.fadeOut && parts.length > 1 ? `,afade=t=out:st=${f(Math.max(0, d - fade))}:d=${f(fade)}` : "")
      + (p.fadeIn && parts.length > 1 ? `,afade=t=in:st=0:d=${f(fade)}` : "") + `[p${i}]`;
  });
  const fc = chains.join(";") + (parts.length > 1 ? `;[p0][p1]concat=n=2:v=0:a=1[out]` : "");
  return ["-i", src, "-filter_complex", fc, "-map", parts.length > 1 ? "[out]" : "[p0]", ...WAV, out];
}

/** Keep or delete [a, b] of a sound effect. -> {name, seconds, was, undo, note} | {error, status} */
function trim(name, a, b, mode, asNew, project) {
  const src = fileOf(name, project);
  if (!src) return { status: 404, error: `no sound effect called ${name}` };
  if (!["keep", "delete"].includes(mode)) return { status: 400, error: "mode is keep or delete" };
  const total = seconds(src);
  if (!(total > 0)) return { status: 400, error: `${name} could not be measured` };
  let s = Math.max(0, Math.min(total, Number(a))), e = Math.max(0, Math.min(total, Number(b)));
  if (!Number.isFinite(s) || !Number.isFinite(e)) return { status: 400, error: "select a part of the waveform first" };
  if (e < s) [s, e] = [e, s];
  if (e - s < MIN) return { status: 400, error: "the selection is too short - drag across the waveform" };
  if (mode === "delete" && s <= MIN && total - e <= MIN)
    return { status: 400, error: "that deletes the whole sound - use 🗑 to remove the file" };
  if (mode === "keep" && s <= MIN && total - e <= MIN)
    return { status: 400, error: "the selection is the whole sound - nothing to trim" };
  const d = dir(project);
  const tmp = path.join(d, `.trim_${process.pid}_${Date.now()}.wav`);
  const r = ffmpeg(trimArgs(src, tmp, s, e, mode, total));
  if (!r.ok || !fs.existsSync(tmp)) {
    try { fs.unlinkSync(tmp); } catch {}
    return { status: 500, error: `the cut failed${r.err ? ": " + r.err : ""}` };
  }
  const ext = path.extname(src), stem = path.basename(src, ext);
  let outName = path.basename(src), undo = false;
  if (asNew) {
    outName = freeName(d, `${stem}_${mode === "keep" ? "keep" : "cut"}${ext}`);
    fs.renameSync(tmp, path.join(d, outName));
  } else {
    fs.mkdirSync(undoDir(project), { recursive: true });
    fs.copyFileSync(src, path.join(undoDir(project), outName));
    fs.renameSync(tmp, src);
    undo = true;
  }
  const secs = seconds(path.join(d, outName));
  const r2 = (x) => Math.round(x * 100) / 100;
  let gallery = "";
  try { gallery = toGallery(outName, project).gallery || ""; } catch { gallery = ""; }
  return { name: outName, seconds: secs, was: total, undo, gallery,
           note: (mode === "keep" ? `kept ${r2(s)}-${r2(e)} s` : `deleted ${r2(s)}-${r2(e)} s`)
             + ` of ${path.basename(src)} -> ${outName} (${r2(secs || 0)} s)` + (asNew ? " - a new file" : " - ↶ Undo brings it back")
             + (gallery ? ` - in the gallery's Audio tab as ${gallery}` : "") };
}

const GALLERY_PREFIX = "sfx_";
/** The gallery's copy name of a sound effect. */
function galleryName(name) { return GALLERY_PREFIX + path.basename(String(name || "")); }
function galleryFile(name, project) { return path.join(core.projDir(project || core.getProject()), "output", galleryName(name)); }

/** 2.361.0: copy a sound effect into the gallery (projects/<p>/output/sfx_<name>, the Audio tab). */
function toGallery(name, project) {
  const src = fileOf(name, project);
  if (!src) return { status: 404, error: `no sound effect called ${name}` };
  const dest = galleryFile(name, project);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return { gallery: path.basename(dest) };
}

/** The version before the last in-place cut. */
function undo(name, project) {
  const src = fileOf(name, project);
  const bak = src ? path.join(undoDir(project), path.basename(src)) : null;
  if (!src || !bak || !fs.existsSync(bak)) return { status: 404, error: `nothing to undo for ${name}` };
  fs.renameSync(bak, src);
  // the gallery's copy follows (only one that exists - an undo never adds a new gallery file)
  let gallery = "";
  if (fs.existsSync(galleryFile(path.basename(src), project))) {
    try { gallery = toGallery(path.basename(src), project).gallery || ""; } catch { gallery = ""; }
  }
  return { name: path.basename(src), seconds: seconds(src), gallery,
           note: `${path.basename(src)} is back as it was before the last cut` + (gallery ? ` (the gallery's ${gallery} too)` : "") };
}

/** A copy into the project's Sound assets. */
function toSound(name, project) {
  const src = fileOf(name, project);
  if (!src) return { status: 404, error: `no sound effect called ${name}` };
  const sd = core.pDir("sound");
  fs.mkdirSync(sd, { recursive: true });
  const n = freeName(sd, path.basename(src));
  fs.copyFileSync(src, path.join(sd, n));
  return { name: n, note: `${n} added to the Sound assets (timeline, references)` };
}

function remove(name, project) {
  const src = fileOf(name, project);
  if (!src) return { status: 404, error: `no sound effect called ${name}` };
  fs.unlinkSync(src);
  try { fs.unlinkSync(path.join(undoDir(project), path.basename(src))); } catch {}
  return { name: path.basename(src), note: `${path.basename(src)} deleted` };
}

module.exports = { AUDIO_EXT, VIDEO_EXT, FADE, MIN, dir, safeName, fileOf, freeName, seconds, hasAudio, list, add,
                   trimArgs, trim, undo, toSound, remove, GALLERY_PREFIX, galleryName, galleryFile, toGallery };
