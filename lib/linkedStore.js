// bitGen Studio — lib/linkedStore.js (2.469.0): LINKED SMART OBJECTS' files, kept in the project (projects/<p>/linked).
//
// Tim: "continue with the photoshop gap closure. add cad tools, create sketch layers for cad in image editor" - the gap
// row "linked smart objects (contents in a separate file)". A linked smart object's contents are a picture in this
// folder; edit it there (any program) and the image editor updates every layer that links to it.
//   dir()             projects/<p>/linked (made on first use)
//   safeName(n, k)    a name that stays in the folder, ending in .png / .jpg
//   save(name, buf)   PNG / JPEG bytes -> {name, size, mtime} (the same name = the file replaced)
//   list()            [{name, size, mtime}] newest first
//   stat(names)       {name: mtime | 0}
//   file(name)        the path, or throws 404
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");

const MAX = 256 * 1024 * 1024;
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
function dir() { const d = core.pDir("linked"); fs.mkdirSync(d, { recursive: true }); return d; }
function kindOf(buf) {
  if (!buf || buf.length < 8) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  return null;
}
function safeName(n, kind) {
  const b = String(path.basename(String(n || ""))).replace(/\.(png|jpe?g|webp|gif|bmp|psd)$/i, "").replace(/[^A-Za-z0-9 ._()-]+/g, "_").replace(/^[.\s]+/, "").trim().slice(0, 90) || "linked";
  return b + "." + (kind || "png");
}
function save(name, buf) {
  if (!Buffer.isBuffer(buf) || !buf.length) throw bad("the picture is empty");
  if (buf.length > MAX) throw bad("the picture is over 256 MB");
  const kind = kindOf(buf); if (!kind) throw bad("not a PNG or JPEG picture");
  const n = safeName(name, kind), p = path.join(dir(), n);
  fs.writeFileSync(p + ".part", buf); fs.renameSync(p + ".part", p);
  return { name: n, size: buf.length, mtime: Math.round(fs.statSync(p).mtimeMs) };
}
function list() {
  try {
    return fs.readdirSync(dir()).filter((f) => /\.(png|jpg)$/i.test(f)).map((f) => { const st = fs.statSync(path.join(dir(), f)); return { name: f, size: st.size, mtime: Math.round(st.mtimeMs) }; })
      .sort((a, b) => b.mtime - a.mtime);
  } catch { return []; }
}
function stat(names) {
  const out = {};
  for (const n0 of names || []) { const n = path.basename(String(n0 || "")); try { out[n] = /\.(png|jpg)$/i.test(n) ? Math.round(fs.statSync(path.join(dir(), n)).mtimeMs) : 0; } catch { out[n] = 0; } }
  return out;
}
function file(name) {
  const n = path.basename(String(name || ""));
  if (!/\.(png|jpg)$/i.test(n)) throw bad("not a linked picture's name", 404);
  const p = path.join(dir(), n);
  if (!fs.existsSync(p)) throw bad(`${n} is not in this project's linked folder`, 404);
  return p;
}
module.exports = { dir, kindOf, safeName, save, list, stat, file, MAX };
