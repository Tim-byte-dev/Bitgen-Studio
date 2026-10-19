// bitGen Studio — lib/bgFiles.js (2.436.0): bitGen's own document files, kept in the project.
//
// Tim (verbatim): "save image edit project as .bgi, save video project as .bgv, save the overall project as .bgp in xml
// format". The image editor's .bgi (a zip: doc.xml + the layers' PNGs - written in the page, ext/imageeditdock/pcbgi.js)
// and the timeline's .bgv (XML - lib/bgVideo.js) are kept in projects/<p>/bgi/ and projects/<p>/bgv/ (File ▸ Open …
// from Project lists them). The whole project's .bgp is lib/bgProject.js.
//   KINDS                    {bgi, bgv}: folder, extension, the largest file, what a real one starts with
//   dir(kind)                projects/<p>/<kind> (made on first use)
//   safeName(kind, n)        a file name that stays in that folder and ends in .<kind>
//   save(kind, name, buf)    -> {name, size}   (the same name = replaced: the document saved again)
//   list(kind)               [{name, size, mtime}] newest first
//   file(kind, name)         the path, or throws 404
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");

const KINDS = {
  bgi: { dir: "bgi", ext: ".bgi", max: 2 * 1024 * 1024 * 1024, what: "an image editor project (.bgi)",
    looks: (b) => b.length > 30 && b.readUInt32LE(0) === 0x04034b50 },                                          // a zip
  bgv: { dir: "bgv", ext: ".bgv", max: 256 * 1024 * 1024, what: "a video project (.bgv)",
    looks: (b) => /<bitgen-video[\s>]/.test(b.toString("utf8", 0, Math.min(b.length, 4096))) },
};
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
function kindOf(kind) { const k = KINDS[String(kind || "").toLowerCase()]; if (!k) throw bad("no such file kind: " + kind, 404); return k; }
function dir(kind) { const d = core.pDir(kindOf(kind).dir); fs.mkdirSync(d, { recursive: true }); return d; }
function safeName(kind, n) {
  const K = kindOf(kind);
  let b = path.basename(String(n || "")).replace(/\.(bgi|bgv|bgp|png|jpe?g|webp|psd|json|xml)$/i, "").replace(/[^A-Za-z0-9 ._()-]+/g, "_").replace(/^[.\s]+/, "").trim().slice(0, 80);
  if (!b) b = kind === "bgv" ? "timeline" : "picture";
  return b + K.ext;
}
function save(kind, name, buf) {
  const K = kindOf(kind);
  if (!Buffer.isBuffer(buf) || !buf.length) throw bad("the file is empty");
  if (buf.length > K.max) throw bad(`the file is over ${Math.round(K.max / 1048576)} MB`);
  if (!K.looks(buf)) throw bad(`that is not ${K.what}`);
  const n = safeName(kind, name), p = path.join(dir(kind), n);
  fs.writeFileSync(p + ".part", buf);
  fs.renameSync(p + ".part", p);
  return { name: n, size: buf.length };
}
function list(kind) {
  const K = kindOf(kind);
  try {
    return fs.readdirSync(dir(kind)).filter((f) => f.toLowerCase().endsWith(K.ext)).map((f) => {
      const st = fs.statSync(path.join(dir(kind), f));
      return { name: f, size: st.size, mtime: Math.round(st.mtimeMs) };
    }).sort((a, b) => b.mtime - a.mtime);
  } catch { return []; }
}
function file(kind, name) {
  const K = kindOf(kind), n = path.basename(String(name || ""));
  if (!n.toLowerCase().endsWith(K.ext)) throw bad(`not a ${K.ext} name`, 404);
  const p = path.join(dir(kind), n);
  if (!fs.existsSync(p)) throw bad(`${n} is not in this project's ${K.dir} folder`, 404);
  return p;
}

module.exports = { KINDS, dir, safeName, save, list, file };
