// bitGen Studio — lib/cadStore.js (2.464.0): the image editor's CAD files (sketch layers as DXF / SVG), kept in the project.
//
// Tim: "continue with the photoshop gap closure. add cad tools, create sketch layers for cad in image editor". A sketch
// layer exports as a .dxf (for CAD / laser / CNC) or an .svg and a .dxf comes back in as a sketch; the files are written /
// read in the page (ext/imageeditdock/pcsketchcad.js) and kept here in projects/<project>/cad/ (File ▸ Import DXF from
// Project, the next session).
//   dir()            projects/<p>/cad (made on first use)
//   safeName(n, ext) a file name that stays in that folder and ends in .dxf / .svg
//   save(name, text) -> {name, size}   (the same name = replaced)
//   list(ext)        [{name, size, mtime}] newest first (ext "dxf" / "svg" / all)
//   file(name)       the path, or throws 404
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");

const MAX = 64 * 1024 * 1024;
const EXTS = ["dxf", "svg"];
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
function dir() { const d = core.pDir("cad"); fs.mkdirSync(d, { recursive: true }); return d; }
function extOf(n) { const m = /\.([a-z0-9]+)$/i.exec(String(n || "")); return m ? m[1].toLowerCase() : ""; }
function safeName(n, ext) {
  const e = EXTS.includes(String(ext || "").toLowerCase()) ? String(ext).toLowerCase() : EXTS.includes(extOf(n)) ? extOf(n) : "";
  if (!e) throw bad("a CAD file is a .dxf or an .svg");
  let b = path.basename(String(n || "")).replace(/\.(dxf|svg|png|jpe?g|webp|bgi)$/i, "").replace(/[^A-Za-z0-9 ._()-]+/g, "_").replace(/^[.\s]+/, "").trim().slice(0, 80);
  if (!b) b = "sketch";
  return b + "." + e;
}
/** what the text has to look like: a DXF has group-code pairs with SECTION / EOF, an SVG an <svg> element */
function looksRight(ext, text) {
  if (ext === "dxf") return /(^|\n)\s*0\s*\r?\n\s*SECTION\b/.test(text) && /(^|\n)\s*0\s*\r?\n\s*EOF\b/.test(text);
  if (ext === "svg") return /<svg[\s>]/i.test(text) && !/<script[\s>]/i.test(text);
  return false;
}
function save(name, text) {
  const t = Buffer.isBuffer(text) ? text.toString("utf8") : String(text == null ? "" : text);
  if (!t.length) throw bad("the file is empty");
  if (Buffer.byteLength(t) > MAX) throw bad("the file is over 64 MB");
  const n = safeName(name), e = extOf(n);
  if (!looksRight(e, t)) throw bad(e === "dxf" ? "that is not a DXF (no SECTION / EOF)" : "that is not an SVG (or it has a script in it)");
  const p = path.join(dir(), n);
  fs.writeFileSync(p + ".part", t);
  fs.renameSync(p + ".part", p);
  return { name: n, size: Buffer.byteLength(t) };
}
function list(ext) {
  const want = EXTS.includes(String(ext || "").toLowerCase()) ? [String(ext).toLowerCase()] : EXTS;
  try {
    return fs.readdirSync(dir()).filter((f) => want.includes(extOf(f))).map((f) => {
      const st = fs.statSync(path.join(dir(), f));
      return { name: f, size: st.size, mtime: Math.round(st.mtimeMs) };
    }).sort((a, b) => b.mtime - a.mtime);
  } catch { return []; }
}
function file(name) {
  const n = path.basename(String(name || ""));
  if (!EXTS.includes(extOf(n))) throw bad("not a CAD file name", 404);
  const p = path.join(dir(), n);
  if (!fs.existsSync(p)) throw bad(`${n} is not in this project's cad folder`, 404);
  return p;
}

module.exports = { dir, safeName, looksRight, save, list, file, extOf, MAX, EXTS };
