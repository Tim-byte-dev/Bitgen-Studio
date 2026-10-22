// bitGen Studio — lib/poseSheets.js: the character sheet's POSE SHEETS.
//
// 2.207.0 shipped six generated line-drawing templates in static/pose-sheets/. 2.577.0 (Tim: "delete the pose
// sheets, they are crap. can we add a folder to the app for pose_sheets. i will save pose sheets to that folder. in
// the character editor/creator remove the pose dropdown and add a dialog with thumbnails of the pose sheets in the
// folder and use the selected one for the poses"): the built-in ones are gone; the pose sheets are the user's OWN
// pictures in <install>/pose_sheets/ (made on first use; sub-folders are fine, they show as "folder/name").
// The StoryBoard's Character creator picks one in its 🧍 Pose sheet dialog (ext/videodock/posepick.js) and sends its
// id (the path inside the folder, "/"-separated) as `pose`; routes/characters.js sheetgen calls pick().
//
// WHY A POSE SHEET RIDES SLOT 1: the Klein edit treats its FIRST image slot as "the image being edited", so the pose
// sheet goes there (its panels + poses are what gets redrawn) and the uploaded photo rides slot 2, identity only.
//
//   dir()           <install>/pose_sheets (made on first use; setBase for tests)
//   list()          [{id, name, folder, size, mtime}] - every picture (png / jpg / jpeg / webp), by folder then name
//   file(id)        the absolute path, or null (unknown, outside the folder, not a picture, missing)
//   pick(id)        "" / "none" / unknown -> null; else {id, name, file}
//   openDir()       shows the folder in the computer's file manager -> {dir}
"use strict";
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const core = require("./core");

const EXT = /\.(png|jpe?g|webp)$/i;
const MAX_DEPTH = 3, MAX_FILES = 2000;
let BASE_DIR = null;
function setBase(d) { BASE_DIR = d; }
function dir() { const d = path.join(BASE_DIR || core.BASE, "pose_sheets"); fs.mkdirSync(d, { recursive: true }); return d; }

function list() {
  const root = dir(), out = [];
  (function walk(d, rel, depth) {
    let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (out.length >= MAX_FILES || e.name.startsWith(".")) continue;
      const r = rel ? rel + "/" + e.name : e.name;
      if (e.isDirectory()) { if (depth < MAX_DEPTH) walk(path.join(d, e.name), r, depth + 1); continue; }
      if (!e.isFile() || !EXT.test(e.name)) continue;
      let st = null; try { st = fs.statSync(path.join(d, e.name)); } catch { continue; }
      out.push({ id: r, name: e.name.replace(EXT, ""), folder: rel, size: st.size, mtime: Math.round(st.mtimeMs) });
    }
  })(root, "", 0);
  return out.sort((a, b) => a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}

/** the picture's path - only a picture INSIDE the folder (no "..", no absolute paths) */
function file(id) {
  const s = String(id == null ? "" : id).replace(/\\/g, "/").trim();
  if (!s || s === "none" || s.startsWith("/") || /^[a-z]:/i.test(s) || s.split("/").some((p) => p === ".." || p === "") || !EXT.test(s)) return null;
  const root = dir(), p = path.resolve(root, ...s.split("/"));
  if (p !== root && !p.startsWith(root + path.sep)) return null;
  try { return fs.statSync(p).isFile() ? p : null; } catch { return null; }
}

/** the pose sheet ONE character sheet render uses (null = none) */
function pick(id) {
  const f = file(id); if (!f) return null;
  const s = String(id).replace(/\\/g, "/").trim();
  return { id: s, name: path.basename(s).replace(EXT, ""), file: f };
}

function openDir() {
  const d = dir();
  const [cmd, args] = process.platform === "win32" ? ["explorer", [d]] : process.platform === "darwin" ? ["open", [d]] : ["xdg-open", [d]];
  try { const c = spawn(cmd, args, { detached: true, stdio: "ignore", windowsHide: false }); c.on("error", () => {}); c.unref(); } catch { /* no file manager here */ }
  return { dir: d };
}

module.exports = { EXT, setBase, dir, list, file, pick, openDir };
