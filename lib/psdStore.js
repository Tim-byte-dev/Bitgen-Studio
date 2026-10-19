// bitGen Studio — lib/psdStore.js (2.390.0): the image editor's PSD files, kept in the project.
//
// Tim: "can we open psd files?" -> yes. The editor reads and writes .psd in the page (static/vendor/ag-psd.js, MIT,
// ext/imageeditdock/pcpsd.js); this keeps a saved one in projects/<project>/psd/ so it is there next time (File ▸ Open
// PSD from Project) - the Images assets only take flat pictures.
//   dir()            projects/<p>/psd (made on first use)
//   safeName(n)      a file name that stays in that folder and ends in .psd
//   save(name, buf)  -> {name, size}   (the same name = the file is replaced: it is the document saved again)
//   list()           [{name, size, mtime}] newest first
//   file(name)       the path, or throws 404
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");

const MAX = 1024 * 1024 * 1024;
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
function dir() { const d = core.pDir("psd"); fs.mkdirSync(d, { recursive: true }); return d; }
function safeName(n) {
  let b = path.basename(String(n || "")).replace(/\.(psd|psb|png|jpe?g|webp|bmp)$/i, "").replace(/[^A-Za-z0-9 ._()-]+/g, "_").replace(/^[.\s]+/, "").trim().slice(0, 80);
  if (!b) b = "picture";
  return b + ".psd";
}
/** a real PSD starts with "8BPS" and version 1 (PSB = 2 is not written by the editor) */
function looksPsd(buf) { return !!buf && buf.length > 26 && buf.toString("latin1", 0, 4) === "8BPS" && (buf.readUInt16BE(4) === 1 || buf.readUInt16BE(4) === 2); }
function save(name, buf) {
  if (!Buffer.isBuffer(buf) || !buf.length) throw bad("the PSD is empty");
  if (buf.length > MAX) throw bad("the PSD is over 1 GB");
  if (!looksPsd(buf)) throw bad("that is not a PSD file (no 8BPS header)");
  const n = safeName(name), p = path.join(dir(), n);
  fs.writeFileSync(p + ".part", buf);
  fs.renameSync(p + ".part", p);
  return { name: n, size: buf.length };
}
function list() {
  try {
    return fs.readdirSync(dir()).filter((f) => /\.ps[db]$/i.test(f)).map((f) => {
      const st = fs.statSync(path.join(dir(), f));
      return { name: f, size: st.size, mtime: Math.round(st.mtimeMs) };
    }).sort((a, b) => b.mtime - a.mtime);
  } catch { return []; }
}
function file(name) {
  const n = path.basename(String(name || ""));
  if (!/\.ps[db]$/i.test(n)) throw bad("not a PSD name", 404);
  const p = path.join(dir(), n);
  if (!fs.existsSync(p)) throw bad(`${n} is not in this project's psd folder`, 404);
  return p;
}

module.exports = { dir, safeName, looksPsd, save, list, file, MAX };
