// bitGen Studio — lib/batchStore.js (2.427.0): the image editor's BATCH results (File ▸ Automate ▸ Batch…), kept in the
// project.
//
// Tim: "continue with the photoshop gap closure" - the agreed order: 2.427.0 Actions + batch. The editor plays an action
// on every picked picture in the page (ext/imageeditdock/pcactions.js) and sends each result here:
//   projects/<project>/batch/<run>/<name>.png | .jpg
//   safeRun(r) / safeName(n)   names that stay in their folder
//   save(run, name, buf)       -> {run, name, size} (PNG or JPEG only - the bytes are checked)
//   runs()                     [{run, files, mtime}] newest first
//   list(run)                  [{name, size, mtime}]
//   file(run, name)            the path, or throws 404
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");

const MAX = 256 * 1024 * 1024;
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
function dir() { const d = core.pDir("batch"); fs.mkdirSync(d, { recursive: true }); return d; }
const clean = (s, n) => String(s || "").replace(/[^A-Za-z0-9 ._()-]+/g, "_").replace(/^[.\s]+/, "").trim().slice(0, n);
function safeRun(r) { return clean(path.basename(String(r || "")), 60) || "batch"; }
/** the picture's kind from its bytes: "png" | "jpg" | null */
function kindOf(buf) {
  if (!buf || buf.length < 8) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  return null;
}
function safeName(n, kind) {
  const b = clean(path.basename(String(n || "")).replace(/\.(png|jpe?g|webp|gif|bmp|tiff?)$/i, ""), 100) || "picture";
  return b + "." + (kind || "png");
}
function save(run, name, buf) {
  if (!Buffer.isBuffer(buf) || !buf.length) throw bad("the picture is empty");
  if (buf.length > MAX) throw bad("the picture is over 256 MB");
  const kind = kindOf(buf); if (!kind) throw bad("not a PNG or JPEG picture");
  const r = safeRun(run), d = path.join(dir(), r); fs.mkdirSync(d, { recursive: true });
  const n = safeName(name, kind), p = path.join(d, n);
  fs.writeFileSync(p + ".part", buf); fs.renameSync(p + ".part", p);
  return { run: r, name: n, size: buf.length };
}
function runs() {
  try {
    return fs.readdirSync(dir(), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => {
      const d = path.join(dir(), e.name), files = fs.readdirSync(d).filter((f) => /\.(png|jpg)$/i.test(f));
      return { run: e.name, files: files.length, mtime: Math.round(fs.statSync(d).mtimeMs) };
    }).sort((a, b) => b.mtime - a.mtime);
  } catch { return []; }
}
function list(run) {
  const d = path.join(dir(), safeRun(run));
  try { return fs.readdirSync(d).filter((f) => /\.(png|jpg)$/i.test(f)).map((f) => { const st = fs.statSync(path.join(d, f)); return { name: f, size: st.size, mtime: Math.round(st.mtimeMs) }; }).sort((a, b) => a.name.localeCompare(b.name)); } catch { return []; }
}
function file(run, name) {
  const n = path.basename(String(name || ""));
  if (!/\.(png|jpg)$/i.test(n)) throw bad("not a batch picture", 404);
  const p = path.join(dir(), safeRun(run), n);
  if (!fs.existsSync(p)) throw bad(`${n} is not in that batch`, 404);
  return p;
}

module.exports = { dir, safeRun, safeName, kindOf, save, runs, list, file, MAX };
