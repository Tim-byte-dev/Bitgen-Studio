// bitGen Studio — lib/laserStore.js (2.803.0): the image editor's laser toolpaths (G-code), kept in the project.
//
// Tim (verbatim): "can we add a lightburn feature to image editor, it can do a linedrawing using controlnet or import a
// vector or create a vector and generate a toolpath?". The page writes the G-code (ext/imageeditdock/pclaser.js); this
// keeps it in projects/<project>/laser/.
//   dir()            projects/<p>/laser (made on first use)
//   safeName(n)      a file name that stays in that folder and ends in .gcode / .nc
//   save(name, txt)  -> {name, size}   (checked: G-code text - lines of G / M / ; / S / F words)
//   list()           [{name, size, mtime}] newest first
//   file(name)       the path, or throws 404
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");

const MAX = 256 * 1024 * 1024;
const EXT = /\.(gcode|nc)$/i;
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
function dir() { const d = core.pDir("laser"); fs.mkdirSync(d, { recursive: true }); return d; }
function safeName(n) {
  const base = path.basename(String(n || "")), m = EXT.exec(base), ext = m ? m[0].toLowerCase() : ".gcode";
  let b = base.replace(EXT, "").replace(/[^A-Za-z0-9 ._()-]+/g, "_").replace(/^[.\s]+/, "").trim().slice(0, 100);
  if (!b) b = "laser";
  return b + ext;
}
/** G-code: every non-empty line a comment or G / M / S / F / X / Y / T words */
function looksGcode(txt) {
  const lines = String(txt).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.length > 0 && lines.some((l) => /^G\d/i.test(l)) && lines.every((l) => /^(;|\(|[GMSFXYZT]-?\d)/i.test(l));
}
function save(name, buf) {
  const txt = Buffer.isBuffer(buf) ? buf.toString("utf8") : String(buf || "");
  if (!txt.trim()) throw bad("the G-code is empty");
  if (Buffer.byteLength(txt) > MAX) throw bad("the G-code is over 256 MB");
  if (!looksGcode(txt)) throw bad("that is not G-code");
  const n = safeName(name), p = path.join(dir(), n);
  fs.writeFileSync(p + ".part", txt);
  fs.renameSync(p + ".part", p);
  return { name: n, size: Buffer.byteLength(txt) };
}
function list() {
  try {
    return fs.readdirSync(dir()).filter((f) => EXT.test(f)).map((f) => { const st = fs.statSync(path.join(dir(), f)); return { name: f, size: st.size, mtime: Math.round(st.mtimeMs) }; })
      .sort((a, b) => b.mtime - a.mtime || (a.name < b.name ? -1 : 1));
  } catch { return []; }
}
function file(name) {
  const n = path.basename(String(name || ""));
  if (!EXT.test(n)) throw bad("not a G-code name", 404);
  const p = path.join(dir(), n);
  if (!fs.existsSync(p)) throw bad(`${n} is not in this project's laser folder`, 404);
  return p;
}

module.exports = { dir, safeName, looksGcode, save, list, file, MAX };
