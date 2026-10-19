// bitGen Studio — lib/patternStore.js (2.437.0): the image editor's PATTERN LIBRARY - patterns/<name>.png in the
// install folder (shared by every project, like themes/). Edit ▸ Define Pattern… adds one, Edit ▸ Pattern Library…
// lists / imports / deletes them; Pattern fill layers, Edit ▸ Fill ▸ Pattern and the Pattern Overlay style use them
// (ext/imageeditdock/pcpattern.js). Copy .png files into the folder to share them.
//   dir()               <install>/patterns (made on first use)
//   safeName(n)         a pattern name that is a safe file name
//   pngSize(buf)        {w, h} of a PNG (null when it is not one)
//   list()              [{name, w, h, size, mtime}] by name
//   file(name)          the path, or throws 404
//   save(name, buf)     -> {name, w, h, size} (a PNG up to 4096 x 4096 / 16 MB; the same name = replaced)
//   remove(name)        -> {removed}
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");

const MAX = 16 * 1024 * 1024, MAX_SIDE = 4096;
let BASE_DIR = null;                                 // tests point it elsewhere (setBase)
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
function setBase(d) { BASE_DIR = d; }
function dir() { const d = path.join(BASE_DIR || core.BASE, "patterns"); fs.mkdirSync(d, { recursive: true }); return d; }
function safeName(n) { return String(n == null ? "" : n).replace(/\.png$/i, "").replace(/[^A-Za-z0-9 ._()&+-]+/g, "_").replace(/^[.\s_]+/, "").replace(/\s+/g, " ").trim().slice(0, 60); }
function pngSize(b) {
  if (!Buffer.isBuffer(b) || b.length < 24 || b.toString("latin1", 1, 4) !== "PNG" || b.toString("latin1", 12, 16) !== "IHDR") return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
function list() {
  return fs.readdirSync(dir()).filter((f) => /\.png$/i.test(f)).map((f) => {
    const p = path.join(dir(), f), st = fs.statSync(p);
    let sz = null; try { const fd = fs.openSync(p, "r"), b = Buffer.alloc(24); fs.readSync(fd, b, 0, 24, 0); fs.closeSync(fd); sz = pngSize(b); } catch { sz = null; }
    return sz ? { name: f.slice(0, -4), w: sz.w, h: sz.h, size: st.size, mtime: Math.round(st.mtimeMs) } : null;
  }).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
}
function file(name) {
  const n = safeName(name); if (!n) throw bad("no pattern name", 404);
  const p = path.join(dir(), n + ".png");
  if (!fs.existsSync(p)) throw bad(`no pattern "${n}"`, 404);
  return p;
}
function save(name, buf) {
  const n = safeName(name); if (!n) throw bad("give the pattern a name");
  if (!Buffer.isBuffer(buf) || !buf.length) throw bad("the pattern is empty");
  if (buf.length > MAX) throw bad("the pattern is over 16 MB");
  const sz = pngSize(buf); if (!sz) throw bad("a pattern is a PNG picture");
  if (!sz.w || !sz.h || sz.w > MAX_SIDE || sz.h > MAX_SIDE) throw bad(`a pattern is at most ${MAX_SIDE} x ${MAX_SIDE} pixels`);
  const p = path.join(dir(), n + ".png");
  fs.writeFileSync(p + ".part", buf); fs.renameSync(p + ".part", p);
  return { name: n, w: sz.w, h: sz.h, size: buf.length };
}
function remove(name) {
  const n = safeName(name), p = path.join(dir(), n + ".png");
  if (!n || !fs.existsSync(p)) return { removed: false };
  fs.unlinkSync(p); return { removed: true, name: n };
}

module.exports = { dir, setBase, safeName, pngSize, list, file, save, remove, MAX, MAX_SIDE };
