// bitGen Studio — lib/fontInstall.js (2.617.0): a FONT FILE added to the studio's own font folder (<install>/fonts - every
// font list, the canvas and the PDF save read it: lib/fontFiles.js, static/fontlist.js). Nothing is installed in the system.
//
// Tim (verbatim): "can we install text preset effects from a zip, multiple effects can be in a single zip" - a text effect
// pack usually carries the font its PSDs use; the zip import (static/textfx.js importZip) adds it here.
//   safeName(name)       the file name kept (letters, digits, space . _ - ( ) +), .ttf / .otf only, else null
//   isFont(buf)          a TrueType / OpenType file (0x00010000, "true", "OTTO")
//   install(name, buf)   -> {file, name, family, existed} - an identical file already there is not written again; a
//                        different one with that name gets " (2)" ...
//   dir()                <install>/fonts
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");
const fontFiles = require("./fontFiles");

const MAX = 40 * 1024 * 1024;
let DIR = null;
function bad(m, s) { const e = new Error(m); e.status = s || 400; return e; }
function dir() { return DIR || path.join(core.BASE, "fonts"); }
function setDir(d) { DIR = d; }
function safeName(name) {
  const b = path.basename(String(name || "").replace(/\\/g, "/")).replace(/[^\w .()+-]+/g, "_").replace(/^\.+/, "").slice(0, 120);
  return /\.(ttf|otf)$/i.test(b) ? b : null;
}
function isFont(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return false;
  const t = buf.readUInt32BE(0);
  return t === 0x00010000 || t === 0x74727565 /* true */ || t === 0x4f54544f /* OTTO */;
}
function install(name, buf) {
  const n = safeName(name);
  if (!n) throw bad("only .ttf / .otf fonts");
  if (!isFont(buf)) throw bad(n + " is not a TrueType / OpenType font");
  if (buf.length > MAX) throw bad(n + " is over 40 MB", 413);
  const d = dir(); fs.mkdirSync(d, { recursive: true });
  let f = path.join(d, n), k = 1;
  while (fs.existsSync(f)) {
    try { if (fs.readFileSync(f).equals(buf)) return { file: f, name: path.basename(f), family: famOf(buf), existed: true }; } catch { /* look on */ }
    k++; f = path.join(d, n.replace(/(\.\w+)$/, " (" + k + ")$1"));
  }
  fs.writeFileSync(f, buf);
  fontFiles.reset();
  return { file: f, name: path.basename(f), family: famOf(buf), existed: false };
}
function famOf(buf) { try { const nm = fontFiles.readNames(buf); return nm ? (nm.tfamily || nm.family || "") : ""; } catch { return ""; } }
module.exports = { dir, setDir, safeName, isFont, install, MAX };
