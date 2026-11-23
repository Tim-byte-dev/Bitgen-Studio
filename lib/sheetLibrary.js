// bitGen Studio — lib/sheetLibrary.js (2.874.0): YOUR OWN MANNEQUINS AND CHARACTER SHEET TEMPLATES for the 🪪 Character sheet.
//
// Tim (verbatim): "let the user use own mannequin images for the character sheet profile, user can upload character sheet and
// follow that template to create the character sheet". Kept for every project in <install>/charsheet_library/:
//   mannequins/<id>.<ext>   a picture of your own mannequin - the sheet tab's 🧍 Mannequin… lists it beside bitGen's two
//   templates/<id>.<ext>    a finished character sheet whose LAYOUT the new sheet follows (routes/charSheetH3.js puts it in the
//                           designer's layout-guide slot - its people / clothes are placeholders, the character comes from the picture)
//   index.json              {mannequins: [{id, name, file, w, h, added}], templates: [...]}
//   KINDS / list() / add(kind, {name, buffer | path, original}) -> item / remove(kind, id) / file(kind, id) -> path | ""
//   dims(buffer) -> {w, h, type} | null   (PNG / JPEG / WebP / BMP headers - no library)
//   reference(ref) -> {kind, path, w, h, name} | null   (2.934.0) what the sheet follows: "<template id>" (your sheet),
//                     "mannequin:male" / "mannequin:female" (bitGen's mannequin reference sheet - its poses and camera
//                     angles) or "mannequin:own:<id>" (your own mannequin picture)
"use strict";
const fs = require("fs");
const path = require("path");

const KINDS = ["mannequins", "templates"];
const EXT = { png: ".png", jpeg: ".jpg", webp: ".webp", bmp: ".bmp" };
const MAX_BYTES = 40 * 1024 * 1024;
let ROOT = null;
const root = () => ROOT || path.join(require("./core").BASE, "charsheet_library");
function setRoot(dir) { ROOT = dir || null; }            // tests
const idxPath = () => path.join(root(), "index.json");

function dims(b) {
  if (!b || b.length < 30) return null;
  if (b.readUInt32BE(0) === 0x89504e47) return { type: "png", w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] === 0x42 && b[1] === 0x4d) return { type: "bmp", w: Math.abs(b.readInt32LE(18)), h: Math.abs(b.readInt32LE(22)) };
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const k = b.toString("ascii", 12, 16);
    if (k === "VP8X") return { type: "webp", w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
    if (k === "VP8 ") return { type: "webp", w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (k === "VP8L") { const v = b.readUInt32LE(21); return { type: "webp", w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 }; }
    return null;
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1], L = b.readUInt16BE(i + 2);
      if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf))
        return { type: "jpeg", h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      i += 2 + L;
    }
  }
  return null;
}

function read() {
  let o = null;
  try { o = JSON.parse(fs.readFileSync(idxPath(), "utf8")); } catch (e) { o = null; }
  const out = {};
  KINDS.forEach((k) => { out[k] = (o && Array.isArray(o[k]) ? o[k] : []).filter((x) => x && x.id && x.file && fs.existsSync(path.join(root(), k, x.file))); });
  return out;
}
function write(o) {
  fs.mkdirSync(root(), { recursive: true });
  const tmp = idxPath() + ".part";
  fs.writeFileSync(tmp, JSON.stringify(o, null, 1));
  fs.renameSync(tmp, idxPath());
}
const view = (kind, x) => ({ id: x.id, name: x.name, w: x.w, h: x.h, added: x.added, url: `/api/charsheet/library/${kind}/${encodeURIComponent(x.id)}/file` });
function list() { const o = read(); const out = {}; KINDS.forEach((k) => { out[k] = o[k].map((x) => view(k, x)); }); return out; }

function cleanName(s, dflt) { return String(s || "").replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 80) || dflt; }
function add(kind, o) {
  if (!KINDS.includes(kind)) throw new Error("no such library: " + kind);
  const buf = o.buffer || (o.path ? fs.readFileSync(o.path) : null);
  if (!buf || !buf.length) throw new Error("the picture is empty");
  if (buf.length > MAX_BYTES) throw new Error("the picture is over 40 MB");
  const d = dims(buf);
  if (!d || !EXT[d.type]) throw new Error("that is not a PNG, JPEG, WebP or BMP picture");
  if (d.w < 64 || d.h < 64) throw new Error("the picture is too small (at least 64 x 64)");
  const all = read();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const file = id + EXT[d.type];
  fs.mkdirSync(path.join(root(), kind), { recursive: true });
  fs.writeFileSync(path.join(root(), kind, file), buf);
  const item = { id, name: cleanName(o.name || o.original, kind === "templates" ? "My sheet" : "My mannequin"), file, w: d.w, h: d.h, added: new Date().toISOString() };
  all[kind].push(item);
  write(all);
  return view(kind, item);
}
function remove(kind, id) {
  if (!KINDS.includes(kind)) throw new Error("no such library: " + kind);
  const all = read(), x = all[kind].find((y) => y.id === String(id));
  if (!x) return false;
  try { fs.unlinkSync(path.join(root(), kind, x.file)); } catch (e) { /* gone already */ }
  all[kind] = all[kind].filter((y) => y !== x);
  write(all);
  return true;
}
function item(kind, id) { return KINDS.includes(kind) ? read()[kind].find((y) => y.id === String(id)) || null : null; }
function file(kind, id) { const x = item(kind, id); return x ? path.join(root(), kind, x.file) : ""; }

/* 2.934.0 (Tim: "in character sheet editor the mannequin sheet is the reference sheet of poses and camera angles and another
   image must be loaded or generated to create the character sheet"): the 🧍 mannequin is no longer the start picture - its
   sheet rides where a template does, and the character comes from the picture you load or generate */
const MANNEQUIN_LABEL = { male: "Male display mannequin", female: "Female display mannequin" };
let STATIC = null;
function setStatic(dir) { STATIC = dir || null; }       // tests
const staticDir = () => STATIC || path.join(require("./core").BASE, "static", "mannequins");
function mannequinSheet(sex) {
  if (!MANNEQUIN_LABEL[sex]) return null;
  const p = path.join(staticDir(), sex + "_sheet.png");
  let d = null;
  try { const fd = fs.openSync(p, "r"), b = Buffer.alloc(64); fs.readSync(fd, b, 0, 64, 0); fs.closeSync(fd); d = dims(b); } catch (e) { d = null; }
  return d ? { kind: "mannequin", path: p, w: d.w, h: d.h, name: MANNEQUIN_LABEL[sex], sex } : null;
}
function reference(ref) {
  const r = String(ref || "");
  if (!r) return null;
  const m = /^mannequin:(.+)$/.exec(r);
  if (!m) { const x = item("templates", r); return x ? { kind: "template", path: file("templates", x.id), w: x.w, h: x.h, name: x.name } : null; }
  if (m[1].startsWith("own:")) {
    const x = item("mannequins", m[1].slice(4));
    return x ? { kind: "mannequin", path: file("mannequins", x.id), w: x.w, h: x.h, name: x.name, own: true } : null;
  }
  return mannequinSheet(m[1]);
}

module.exports = { KINDS, MAX_BYTES, MANNEQUIN_LABEL, setRoot, setStatic, root, dims, list, add, remove, item, file, mannequinSheet, reference };
