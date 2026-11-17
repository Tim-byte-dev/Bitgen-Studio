// bitGen Studio — lib/sheetFiles.js (2.822.0): ▦ SPREADSHEET - the workbooks, kept in the project.
//
// Tim: "continue with the spreadsheet please" (the agreed plan: an Excel-like docker of our own - ext/sheetdock; the
// formula engine is ext/sheetdock/sheetcalc.js). A workbook is a .bgs JSON file in projects/<project>/sheets/:
//   {v: 1, app: "bitGen Studio", sheets: [{name, cells: {"A1": {v: "raw text or =formula", f?: format, s?: style}},
//    cols: {"0": width}, rows: {"0": height}, merges: ["A1:B2"], freeze: {r, c}}], active}
//   dir()  list()  read(name)  write(name, doc)  remove(name)  - names are cleaned to <name>.bgs inside that folder
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");

const MAX = 40 * 1024 * 1024;
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
function dir() { const d = core.pDir("sheets"); fs.mkdirSync(d, { recursive: true }); return d; }
/** a name that stays in the folder and ends in .bgs */
function safeName(n) {
  let b = path.basename(String(n || "")).replace(/\.bgs$/i, "").replace(/[^A-Za-z0-9 ._()&-]+/g, "_").replace(/^[.\s]+/, "").trim().slice(0, 100);
  if (!b) b = "Workbook";
  return b + ".bgs";
}
/** a posted workbook -> the kept shape (unknown keys dropped, sizes checked) */
// a filter: its block (rows r..r2, columns c1..c2) + the values picked per column - nothing else is kept
function cleanFilter(f) {
  if (!f || typeof f !== "object") return undefined;
  const int = (v, max) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= 0 && n <= max ? n : 0; };
  const cols = {};
  if (f.cols && typeof f.cols === "object") for (const [c, v] of Object.entries(f.cols)) if (/^\d{1,5}$/.test(c) && Array.isArray(v)) cols[c] = v.slice(0, 5000).map((x) => String(x).slice(0, 500));
  const out = { r: int(f.r, 9999999), c1: int(f.c1, 18277), c2: int(f.c2, 18277), cols };
  if (f.r2 != null) out.r2 = int(f.r2, 9999999);
  return out;
}

function clean(doc) {
  const d = doc && typeof doc === "object" ? doc : null;
  if (!d || !Array.isArray(d.sheets) || !d.sheets.length) throw bad("a workbook has at least one sheet");
  if (d.sheets.length > 200) throw bad("at most 200 sheets");
  const names = new Set();
  const sheets = d.sheets.map((s, i) => {
    let name = String((s && s.name) || "Sheet" + (i + 1)).replace(/[\u0000-\u001f\[\]*?:\\\/]/g, "").trim().slice(0, 60) || "Sheet" + (i + 1);
    while (names.has(name.toLowerCase())) name += " (2)";
    names.add(name.toLowerCase());
    const cells = {};
    for (const [k, c] of Object.entries((s && s.cells) || {})) {
      if (!/^[A-Z]{1,3}[1-9][0-9]{0,6}$/.test(k) || !c || typeof c !== "object") continue;
      const o = {};
      if (c.v != null && c.v !== "") o.v = String(c.v).slice(0, 32000);
      if (c.f && typeof c.f === "string") o.f = c.f.slice(0, 40);
      if (c.s && typeof c.s === "object") o.s = c.s;
      if (Object.keys(o).length) cells[k] = o;
    }
    const num = (m) => { const o = {}; for (const [k, v] of Object.entries(m || {})) if (/^\d+$/.test(k) && +v > 0) o[k] = Math.min(2000, Math.round(+v)); return o; };
    return { name, cells, cols: num(s.cols), rows: num(s.rows), merges: (Array.isArray(s.merges) ? s.merges : []).filter((m) => /^[A-Z]{1,3}\d+:[A-Z]{1,3}\d+$/.test(m)).slice(0, 5000),
      freeze: s.freeze && typeof s.freeze === "object" ? { r: Math.max(0, Math.min(100, +s.freeze.r || 0)), c: Math.max(0, Math.min(50, +s.freeze.c || 0)) } : { r: 0, c: 0 },
      filter: cleanFilter(s.filter) };
  });
  return { v: 1, app: "bitGen Studio", sheets, active: Math.max(0, Math.min(sheets.length - 1, +d.active || 0)) };
}
function list() {
  try {
    return fs.readdirSync(dir()).filter((f) => /\.bgs$/i.test(f)).map((f) => {
      const st = fs.statSync(path.join(dir(), f));
      return { name: f, size: st.size, mtime: Math.round(st.mtimeMs) };
    }).sort((a, b) => b.mtime - a.mtime || (a.name < b.name ? -1 : 1));
  } catch { return []; }
}
function file(name) {
  const n = safeName(name), p = path.join(dir(), n);
  if (!fs.existsSync(p)) throw bad(`${n} is not in this project's sheets folder`, 404);
  return p;
}
function read(name) { return Object.assign({ name: path.basename(file(name)) }, JSON.parse(fs.readFileSync(file(name), "utf8"))); }
function write(name, doc) {
  const n = safeName(name), body = JSON.stringify(clean(doc));
  if (body.length > MAX) throw bad("the workbook is over 40 MB");
  const p = path.join(dir(), n);
  fs.writeFileSync(p + ".part", body); fs.renameSync(p + ".part", p);
  return { name: n, size: body.length };
}
function remove(name) { fs.rmSync(file(name), { force: true }); return { ok: true }; }

module.exports = { dir, safeName, clean, list, read, write, remove };
