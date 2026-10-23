// bitGen Studio — lib/solidcraftFiles.js (2.578.0): the 📐 SolidCraft docker's files IN THE PROJECT -
// projects/<p>/solidcraft/: designs (.solidcraft), exported parts (STEP / IGES / STL / OBJ / 3MF / glTF) and renders (PNG).
// The docker copies a design between here and SolidCraft's private file storage in the page (routes/solidcraft.js).
//   dir()               projects/<p>/solidcraft (made on first use)
//   safeName(n)         a name that stays in the folder with an allowed extension, or "" (refused)
//   list()              [{name, kind: design | part | picture, size, mtime}] newest first
//   file(name)          the path, or throws 404
//   save(name, buf)     -> {name, size, mtime} (the same name = replaced)
//   remove(name)        -> {removed}
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");

const MAX = 512 * 1024 * 1024;
const KINDS = { solidcraft: "design", step: "part", stp: "part", igs: "part", iges: "part", stl: "part", obj: "part", "3mf": "part", glb: "part", gltf: "part", png: "picture", dxf: "drawing", svg: "drawing" };
let DIR = null;                                   // tests point it elsewhere
function setDir(d) { DIR = d; }
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
function dir() { const d = DIR || core.pDir("solidcraft"); fs.mkdirSync(d, { recursive: true }); return d; }
function extOf(n) { const m = /\.([a-z0-9]+)$/i.exec(String(n || "")); return m ? m[1].toLowerCase() : ""; }
function safeName(n) {
  const base = String(n == null ? "" : n).split(/[\\/]/).pop().replace(/[^A-Za-z0-9 ._()&+,'-]+/g, "_").replace(/^[.\s_]+/, "").replace(/\s+/g, " ").trim().slice(0, 120);
  return base && KINDS[extOf(base)] ? base : "";
}
function list() {
  let names = [];
  try { names = fs.readdirSync(dir()); } catch { names = []; }
  return names.filter((f) => KINDS[extOf(f)] && !f.startsWith(".")).map((f) => {
    let st = null; try { st = fs.statSync(path.join(dir(), f)); } catch { return null; }
    return st.isFile() ? { name: f, kind: KINDS[extOf(f)], size: st.size, mtime: Math.round(st.mtimeMs) } : null;
  }).filter(Boolean).sort((a, b) => b.mtime - a.mtime);
}
function file(name) {
  const n = safeName(name);
  if (!n || n !== String(name)) throw bad("no such file", 404);
  const p = path.join(dir(), n);
  if (!fs.existsSync(p)) throw bad(`no file "${n}" in the project's solidcraft folder`, 404);
  return p;
}
function save(name, buf) {
  const n = safeName(name);
  if (!n) throw bad("a file name ending in .solidcraft, .step, .stl, .obj, .3mf, .png … is needed");
  if (!Buffer.isBuffer(buf) || !buf.length) throw bad("the file is empty");
  if (buf.length > MAX) throw bad("the file is too large", 413);
  const p = path.join(dir(), n);
  fs.writeFileSync(p + ".tmp", buf); fs.renameSync(p + ".tmp", p);
  const st = fs.statSync(p);
  return { name: n, kind: KINDS[extOf(n)], size: st.size, mtime: Math.round(st.mtimeMs) };
}
function remove(name) {
  const p = file(name);
  // the recycle bin (🗑 restorable) when the project has one, else gone
  try { if (DIR) throw new Error("tests"); require("./recycleBin").recycle(p, core.getProject()); } catch { fs.rmSync(p, { force: true }); }
  return { removed: path.basename(p) };
}

module.exports = { MAX, KINDS, setDir, dir, safeName, list, file, save, remove };
