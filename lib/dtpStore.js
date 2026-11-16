// bitGen Studio — lib/dtpStore.js (2.799.0): the image editor's desktop-publishing exports, kept in the project.
//
// Tim (verbatim): "i want to give the editor full desktop publishing ability like coreldraw, user can add multiple pages
// each page will have it's own layers. export to cdr, ai,pdf". The page writes the files (ext/imageeditdock/pcdtpout.js:
// a PDF, a PDF-compatible .ai, a .zip of SVG pages or the CorelDRAW pack = PDF + SVG pages); this keeps them in
// projects/<project>/dtp/.
//   dir()            projects/<p>/dtp (made on first use)
//   safeName(n)      a file name that stays in that folder and ends in .pdf / .ai / .svg / .zip
//   save(name, buf)  -> {name, size}   (checked: a .pdf / .ai is a PDF, a .zip a zip, an .svg an SVG)
//   list()           [{name, size, mtime}] newest first
//   file(name)       the path, or throws 404
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");
const pdfStore = require("./pdfStore");

const MAX = 1024 * 1024 * 1024;
const EXT = /\.(pdf|ai|svg|zip)$/i;
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
function dir() { const d = core.pDir("dtp"); fs.mkdirSync(d, { recursive: true }); return d; }
function safeName(n) {
  const base = path.basename(String(n || ""));
  const m = EXT.exec(base), ext = m ? m[0].toLowerCase() : ".pdf";
  let b = base.replace(EXT, "").replace(/[^A-Za-z0-9 ._()-]+/g, "_").replace(/^[.\s]+/, "").trim().slice(0, 100);
  if (!b) b = "document";
  return b + ext;
}
function kindOk(ext, buf) {
  if (ext === ".pdf" || ext === ".ai") return pdfStore.looksPdf(buf);
  if (ext === ".zip") return buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b;
  if (ext === ".svg") return /<svg[\s>]/i.test(buf.toString("utf8", 0, Math.min(4096, buf.length)));
  return false;
}
function save(name, buf) {
  if (!Buffer.isBuffer(buf) || !buf.length) throw bad("the file is empty");
  if (buf.length > MAX) throw bad("the file is over 1 GB");
  if (!EXT.test(path.basename(String(name || "")))) throw bad("only .pdf, .ai, .svg or .zip");
  const n = safeName(name), ext = path.extname(n).toLowerCase();
  if (!kindOk(ext, buf)) throw bad(`that is not a ${ext === ".ai" ? "PDF-compatible .ai" : ext.slice(1).toUpperCase()} file`);
  const p = path.join(dir(), n);
  fs.writeFileSync(p + ".part", buf);
  fs.renameSync(p + ".part", p);
  return { name: n, size: buf.length };
}
function list() {
  try {
    return fs.readdirSync(dir()).filter((f) => EXT.test(f)).map((f) => {
      const st = fs.statSync(path.join(dir(), f));
      return { name: f, size: st.size, mtime: Math.round(st.mtimeMs) };
    }).sort((a, b) => b.mtime - a.mtime || (a.name < b.name ? -1 : 1));
  } catch { return []; }
}
function file(name) {
  const n = path.basename(String(name || ""));
  if (!EXT.test(n)) throw bad("not an export name", 404);
  const p = path.join(dir(), n);
  if (!fs.existsSync(p)) throw bad(`${n} is not in this project's dtp folder`, 404);
  return p;
}

module.exports = { dir, safeName, save, list, file, MAX };
