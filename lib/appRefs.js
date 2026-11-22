// bitGen Studio — lib/appRefs.js (2.916.0): THE 📱 APP'S REFERENCES - PICTURES, VIDEOS AND SOUNDS FROM THE PHONE OR THIS PC.
//
// Tim: "in the android app add a button for reference images and video and audio, user can select from phone gallery, camera or
// the pc it is connected to using the host bitgen". The app's Create screen has ＋ Picture / ＋ Video / ＋ Audio; each comes from
// the camera (or the microphone), the phone's gallery / files, or 💻 this PC. From the phone a video or sound is sent to the
// project first (POST /api/remote/upload - its Video / Sound assets); from this PC it is picked from this list. A reference has to
// be in the project's Images / Video / Sound folder for a render (POST /api/generate reads ref_videos / ref_audios as names
// there), so one picked from the Gallery (the project's output folders) is copied in first.
//   list(kind)                 kind images | video | audio -> [{name, where: "assets" | "output", size, mtime}] newest first
//   resolve(items, kind)       [{name, where}] -> the names in the project's asset folder (copied from the Gallery when needed)
//   readPicture(name)          an Images asset -> {name, mime, buffer} (a render's picture references are files)
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");

const KDIR = { images: "images", video: "video", audio: "sound" };
const RX = { images: /\.(png|jpe?g|webp|bmp|gif|avif)$/i, video: /\.(mp4|webm|mov|mkv|avi)$/i, audio: /\.(mp3|wav|flac|ogg|opus|m4a|aac)$/i };
const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", bmp: "image/bmp", gif: "image/gif", avif: "image/avif" };
const kindOk = (k) => (KDIR[k] ? k : "images");
function outDirs() {
  const p = core.projDir(core.getProject());
  return [core.pDir("output"), path.join(p, "final"), p];
}
function list(kind0) {
  const kind = kindOk(kind0), rx = RX[kind], out = [], seen = new Set();
  const add = (dir, where) => {
    let names = []; try { names = fs.readdirSync(dir); } catch { return; }
    for (const n of names) {
      if (!rx.test(n) || seen.has(where + "/" + n)) continue;
      try { const st = fs.statSync(path.join(dir, n)); if (!st.isFile()) continue; seen.add(where + "/" + n); out.push({ name: n, where, size: st.size, mtime: Math.round(st.mtimeMs) }); } catch { /* gone */ }
    }
  };
  add(core.pDir(KDIR[kind]), "assets");
  for (const d of outDirs()) add(d, "output");
  return out.sort((a, b) => b.mtime - a.mtime).slice(0, 300);
}
/** a file the app named -> its path on this PC, or "" (only bare names, only these folders) */
function pathOf(item, kind) {
  const n = path.basename(String((item && item.name) || item || ""));
  if (!n || !RX[kind].test(n)) return "";
  const dirs = item && item.where === "output" ? outDirs() : [core.pDir(KDIR[kind])].concat(outDirs());
  for (const d of dirs) { const p = path.join(d, n); if (fs.existsSync(p)) return p; }
  return "";
}
function resolve(items, kind0) {
  const kind = kindOk(kind0), dest = core.pDir(KDIR[kind]), names = [];
  fs.mkdirSync(dest, { recursive: true });
  for (const it of (Array.isArray(items) ? items : []).slice(0, 9)) {
    const src = pathOf(it, kind);
    if (!src) continue;
    const n = path.basename(src), to = path.join(dest, n);
    if (path.resolve(src) !== path.resolve(to) && !fs.existsSync(to)) fs.copyFileSync(src, to);
    names.push(n);
  }
  return names;
}
function readPicture(name) {
  const p = pathOf({ name, where: "assets" }, "images");
  if (!p) return null;
  const ext = path.extname(p).slice(1).toLowerCase();
  return { name: path.basename(p), mime: MIME[ext] || "image/png", buffer: fs.readFileSync(p) };
}
module.exports = { KDIR, RX, list, resolve, readPicture };
