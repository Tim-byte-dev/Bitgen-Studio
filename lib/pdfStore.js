// bitGen Studio — lib/pdfStore.js (2.424.0): the image editor's PDF files, kept in the project.
//
// Tim (verbatim): "add a pdf import/edit/save feature". The editor reads a PDF in the page (static/vendor/pdf.min.js -
// pdf.js, Apache-2.0) and writes one there too (static/vendor/pdf-lib.min.js - MIT; ext/imageeditdock/pcpdf.js); this
// keeps them in projects/<project>/pdf/ so File ▸ Open PDF from Project finds them again.
//   dir()            projects/<p>/pdf (made on first use)
//   safeName(n)      a file name that stays in that folder and ends in .pdf
//   save(name, buf)  -> {name, size}   (the same name = replaced: "save into the original")
//   list()           [{name, size, mtime}] newest first
//   file(name)       the path, or throws 404
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");

const MAX = 512 * 1024 * 1024;
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
function dir() { const d = core.pDir("pdf"); fs.mkdirSync(d, { recursive: true }); return d; }
function safeName(n) {
  let b = path.basename(String(n || "")).replace(/\.pdf$/i, "").replace(/[^A-Za-z0-9 ._()-]+/g, "_").replace(/^[.\s]+/, "").trim().slice(0, 80);
  if (!b) b = "document";
  return b + ".pdf";
}
/** a PDF starts with "%PDF-" (within the first 1 KB - some writers put junk first) */
function looksPdf(buf) { return !!buf && buf.length > 8 && buf.toString("latin1", 0, Math.min(1024, buf.length)).includes("%PDF-"); }
function save(name, buf) {
  if (!Buffer.isBuffer(buf) || !buf.length) throw bad("the PDF is empty");
  if (buf.length > MAX) throw bad("the PDF is over 512 MB");
  if (!looksPdf(buf)) throw bad("that is not a PDF file (no %PDF- header)");
  const n = safeName(name), p = path.join(dir(), n);
  fs.writeFileSync(p + ".part", buf);
  fs.renameSync(p + ".part", p);
  return { name: n, size: buf.length };
}
function list() {
  try {
    return fs.readdirSync(dir()).filter((f) => /\.pdf$/i.test(f)).map((f) => {
      const st = fs.statSync(path.join(dir(), f));
      return { name: f, size: st.size, mtime: Math.round(st.mtimeMs) };
    }).sort((a, b) => b.mtime - a.mtime);
  } catch { return []; }
}
function file(name) {
  const n = path.basename(String(name || ""));
  if (!/\.pdf$/i.test(n)) throw bad("not a PDF name", 404);
  const p = path.join(dir(), n);
  if (!fs.existsSync(p)) throw bad(`${n} is not in this project's pdf folder`, 404);
  return p;
}

module.exports = { dir, safeName, looksPdf, save, list, file, MAX };
