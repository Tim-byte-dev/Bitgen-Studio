/* bitGen Studio — lib/synthSamples.js (2.953.0): 🎹 THE SYNTH STATION's SAMPLES LIBRARY (the Audio docker's Synth tab,
 * ext/synthdock; the routes: routes/synth.js).
 * <install>/synth_samples/ = your samples (this PC's own: .gitignore + scripts/make_zips.sh leave it out). A file the browser
 * plays as it is (.wav .mp3 .flac .ogg .m4a .aac .opus .webm) is kept as it is; anything else (.aif, .wma, a video's sound)
 * is made a 48 kHz WAV with ffmpeg.
 *   setDir(d) (tests), dir(), add(src, original) -> {name, made} | {error}, list() -> [{name, size, mtime}], fileOf(name),
 *   remove(name), exportName(asked, uploaded) (the project file's name)
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const sfx = require("./sfx");

const KEEP = [".wav", ".mp3", ".flac", ".ogg", ".oga", ".m4a", ".aac", ".opus", ".webm"];
const MAKE = [".wma", ".aif", ".aiff", ".mov", ".mp4", ".m4v", ".mkv", ".avi", ".wmv", ".flv", ".mpg", ".mpeg", ".3gp", ".mts", ".m2ts", ".ts", ".mxf"];
const MAX_MB = 200, MAX_SECONDS = 600;
let DIR = null;
function setDir(d) { DIR = d || null; }
function dir() {
  const d = DIR || path.join(require("./core").BASE, "synth_samples");
  fs.mkdirSync(d, { recursive: true });
  return d;
}
const safeName = sfx.safeName;
function freeName(d, name) { return sfx.freeName(d, name); }
function fileOf(name) {
  const n = safeName(name);
  if (!n || !KEEP.includes(path.extname(n).toLowerCase())) return null;
  const p = path.join(dir(), n);
  try { return fs.statSync(p).isFile() ? p : null; } catch { return null; }
}
function list() {
  let names = [];
  try { names = fs.readdirSync(dir()).filter((n) => !n.startsWith(".") && KEEP.includes(path.extname(n).toLowerCase())); } catch { names = []; }
  return names.map((n) => { const st = fs.statSync(path.join(dir(), n)); return { name: n, size: st.size, mtime: st.mtimeMs / 1000 }; })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }));
}
/** one picked file into the library (src = where the upload landed) -> {name, made} | {error} */
function add(src, original) {
  const orig = safeName(original) || "sample.wav";
  const ext = path.extname(orig).toLowerCase(), stem = orig.slice(0, orig.length - ext.length) || "sample";
  const d = dir();
  if (KEEP.includes(ext)) {
    const name = freeName(d, stem + ext);
    fs.copyFileSync(src, path.join(d, name));
    return { name, made: false };
  }
  if (!MAKE.includes(ext)) return { error: `${orig}: not a sound file (${KEEP.concat(MAKE).join(" ")})` };
  const name = freeName(d, stem + ".wav"), out = path.join(d, name);
  const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", src, "-vn", "-map", "0:a:0", "-t", String(MAX_SECONDS),
                                 "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", out], { encoding: "utf8", timeout: 300000 });
  if (r.status !== 0 || !fs.existsSync(out)) {
    try { fs.unlinkSync(out); } catch { /* none */ }
    return { error: `${orig}: its sound could not be read${r.error ? " - is ffmpeg installed?" : ""}` };
  }
  return { name, made: true };
}
function remove(name) {
  const p = fileOf(name);
  if (!p) return { status: 404, error: `no sample called ${name}` };
  fs.unlinkSync(p);
  return { name: path.basename(p), note: `${path.basename(p)} deleted` };
}
/** a name for the project's file: the one asked for (safe), the upload's own extension */
function exportName(asked, upName) {
  const ext = (path.extname(String(upName || "")).toLowerCase() || ".wav").replace(/[^.a-z0-9]/g, "");
  const stem = (safeName(String(asked || "")) || "synth").replace(/\.[a-z0-9]{2,5}$/i, "").slice(0, 80) || "synth";
  return stem + ([".wav", ".webm", ".ogg"].includes(ext) ? ext : ".wav");
}

module.exports = { MAX_MB, setDir, dir, add, list, fileOf, remove, exportName, KEEP, MAKE };
