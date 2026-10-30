// bitGen Studio — lib/fontFiles.js (2.435.0): the computer's FONT FILES by family / bold / italic - for the image
// editor's PDF save to embed the fonts its text uses (ext/imageeditdock/pcpdf.js + static/vendor/fontkit).
//
// Tim (verbatim): "Give user option to embed fonts into pdf in the save dialog".
//   DIRS        the system's font folders (Windows %WINDIR%\Fonts + the user's, macOS /Library/Fonts ..., Linux
//               /usr/share/fonts ...) + <install>/fonts (drop a .ttf / .otf there to make it known)
//   readNames(buf)   pure: an sfnt (TrueType / OpenType) file's family, subfamily, typographic family / subfamily,
//                    full name, PostScript name, OS/2 weight + bold / italic bits
//   index()          [{file, family, sub, bold, italic, weight}] - every .ttf / .otf found (cached, rescanned after 60 s)
//   find(family, bold, italic)   the best file: the family (or its typographic family) exactly, the closest style -
//                    null when the family is not on this computer
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const core = require("./core");

function dirs() {
  const d = [];
  const win = process.env.WINDIR || process.env.SystemRoot;
  if (win) d.push(path.join(win, "Fonts"));
  if (process.env.LOCALAPPDATA) d.push(path.join(process.env.LOCALAPPDATA, "Microsoft", "Windows", "Fonts"));
  const home = os.homedir();
  d.push("/Library/Fonts", "/System/Library/Fonts", "/System/Library/Fonts/Supplemental", path.join(home, "Library", "Fonts"));
  d.push("/usr/share/fonts", "/usr/local/share/fonts", path.join(home, ".fonts"), path.join(home, ".local", "share", "fonts"));
  d.push(path.join(core.BASE, "fonts"));
  return d;
}
/* ---------------- pure: the name table ---------------- */
function readNames(buf) {
  if (!buf || buf.length < 12) return null;
  const ver = buf.readUInt32BE(0);
  if (ver !== 0x00010000 && ver !== 0x4f54544f && ver !== 0x74727565) return null;      // TrueType / OTTO / 'true'
  const n = buf.readUInt16BE(4), tables = {};
  for (let i = 0; i < n; i++) {
    const o = 12 + i * 16; if (o + 16 > buf.length) break;
    tables[buf.toString("latin1", o, o + 4)] = { off: buf.readUInt32BE(o + 8), len: buf.readUInt32BE(o + 12) };
  }
  const nt = tables.name; if (!nt || nt.off + 6 > buf.length) return null;
  const count = buf.readUInt16BE(nt.off + 2), so = nt.off + buf.readUInt16BE(nt.off + 4);
  const got = {};
  for (let i = 0; i < count; i++) {
    const r = nt.off + 6 + i * 12; if (r + 12 > buf.length) break;
    const plat = buf.readUInt16BE(r), enc = buf.readUInt16BE(r + 2), lang = buf.readUInt16BE(r + 4), id = buf.readUInt16BE(r + 6), len = buf.readUInt16BE(r + 8), off = buf.readUInt16BE(r + 10);
    if (![1, 2, 4, 6, 16, 17].includes(id)) continue;
    const s0 = so + off; if (s0 + len > buf.length) continue;
    let s = "";
    if (plat === 3 || plat === 0) { for (let k = 0; k + 1 < len; k += 2) s += String.fromCharCode(buf.readUInt16BE(s0 + k)); }
    else if (plat === 1 && enc === 0) s = buf.toString("latin1", s0, s0 + len);
    else continue;
    const rank = plat === 3 && lang === 0x409 ? 3 : plat === 3 ? 2 : 1;
    if (!got[id] || got[id].rank < rank) got[id] = { s: s.replace(/\0/g, "").trim(), rank };
  }
  const v = (id) => (got[id] ? got[id].s : "");
  let weight = 400, fsSel = 0;
  const o2 = tables["OS/2"];
  if (o2 && o2.off + 64 <= buf.length) { weight = buf.readUInt16BE(o2.off + 4); fsSel = buf.readUInt16BE(o2.off + 62); }
  const sub = v(17) || v(2);
  return { family: v(1), sub: v(2), tfamily: v(16), tsub: v(17), full: v(4), ps: v(6), weight,
    bold: !!(fsSel & 0x20) || weight >= 600 || /bold|black|heavy/i.test(sub), italic: !!(fsSel & 0x01) || /italic|oblique/i.test(sub) };
}
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
/** the best of the candidates for (family, bold, italic) - pure */
function pick(list, family, bold, italic) {
  const f = norm(String(family || "").replace(/^[A-Z]{6}\+/, ""));
  if (!f) return null;
  const same = list.filter((x) => norm(x.family) === f || norm(x.tfamily) === f);
  if (!same.length) return null;
  const score = (x) => (x.bold === !!bold ? 2 : 0) + (x.italic === !!italic ? 1 : 0) - Math.abs((x.weight || 400) - (bold ? 700 : 400)) / 1000;
  return same.slice().sort((a, b) => score(b) - score(a))[0];
}
/* ---------------- the index ---------------- */
let cache = null, cacheT = 0;
function headOf(file) {
  // the table directory + the name / OS/2 tables are near the start of the file; read enough of it
  let fd = null;
  try {
    fd = fs.openSync(file, "r");
    const st = fs.fstatSync(fd), n = Math.min(st.size, 2 * 1024 * 1024), b = Buffer.alloc(n);
    fs.readSync(fd, b, 0, n, 0);
    return b;
  } catch { return null; } finally { if (fd != null) try { fs.closeSync(fd); } catch { /* fine */ } }
}
function walk(d, out, depth) {
  let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (depth < 5) walk(p, out, depth + 1); }
    else if (/\.(ttf|otf)$/i.test(e.name)) out.push(p);
  }
}
function index(force) {
  if (cache && !force && Date.now() - cacheT < 60000) return cache;
  const files = []; for (const d of dirs()) walk(d, files, 0);
  const out = [];
  for (const f of files.slice(0, 6000)) { const b = headOf(f); const nm = b ? readNames(b) : null; if (nm && (nm.family || nm.tfamily)) out.push(Object.assign({ file: f }, nm)); }
  cache = out; cacheT = Date.now();
  return out;
}
/** 2.466.0: a GENERIC family (what a CSS stack ends in) -> the usual fonts for it, first one on this computer wins -
 *  the image editor's OpenType text / Convert to Shape need SOME font file for "sans-serif" */
const GENERIC = {
  "sans-serif": ["Arial", "Helvetica", "Segoe UI", "Liberation Sans", "DejaVu Sans", "Noto Sans", "FreeSans", "Carlito"],
  serif: ["Times New Roman", "Times", "Georgia", "Liberation Serif", "DejaVu Serif", "Noto Serif", "FreeSerif", "Caladea"],
  monospace: ["Courier New", "Consolas", "Menlo", "Liberation Mono", "DejaVu Sans Mono", "Noto Sans Mono", "FreeMono"],
  "system-ui": ["Segoe UI", "SF Pro Text", "Helvetica Neue", "Ubuntu", "Cantarell", "DejaVu Sans"],
  cursive: ["Comic Sans MS", "Comic Neue", "URW Chancery L"],
};
function find(family, bold, italic) {
  const ix = index(), f = pick(ix, family, bold, italic); if (f) return f;
  const g = GENERIC[String(family || "").trim().toLowerCase()];
  if (g) for (const name of g) { const h = pick(ix, name, bold, italic); if (h) return h; }
  return null;
}
/** the families on this computer (for a list) */
function families() { const s = new Set(); for (const x of index()) s.add(x.tfamily || x.family); return [...s].sort((a, b) => a.localeCompare(b)); }
/** 2.617.0: a font was added to <install>/fonts (lib/fontInstall.js) - the next look rescans */
function reset() { cache = null; cacheT = 0; }
module.exports = { dirs, readNames, pick, index, find, families, GENERIC, reset };
