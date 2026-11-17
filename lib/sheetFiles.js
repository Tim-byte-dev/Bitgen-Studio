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
// 2.823.0: a cell's looks - only known keys with safe values (they become CSS in the page)
const COLOR = /^#[0-9a-fA-F]{3,8}$/;
const LINE = new Set(["hair", "dotted", "dashDotDot", "dashDot", "dashed", "thin", "mediumDashDotDot", "slantDashDot", "mediumDashDot", "mediumDashed", "medium", "thick", "double"]);
const PATS = new Set(["gray75", "gray50", "gray25", "gray125", "gray0625", "darkHorizontal", "darkVertical", "darkDown", "darkUp", "darkGrid", "darkTrellis", "lightHorizontal", "lightVertical", "lightDown", "lightUp", "lightGrid", "lightTrellis"]);
const ENUM = { align: ["left", "center", "right", "fill", "justify", "centerSel", "distributed"], valign: ["top", "center", "justify", "distributed", "bottom"], dir: ["ltr", "rtl"], u: ["double", "acc", "dacc"] };
function cleanStyle(st) {
  if (!st || typeof st !== "object") return undefined;
  const o = {};
  for (const k of ["b", "i", "wrap", "shrink", "stack", "strike", "sup", "sub", "unlock", "hide"]) if (st[k] === true) o[k] = true;
  if (st.u === true) o.u = true; else if (ENUM.u.includes(st.u)) o.u = st.u;
  for (const k of ["align", "valign", "dir"]) if (ENUM[k].includes(st[k])) o[k] = st[k];
  for (const k of ["color", "bg"]) if (typeof st[k] === "string" && COLOR.test(st[k])) o[k] = st[k];
  const int = (v, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };
  if (int(st.indent, 1, 15) != null) o.indent = int(st.indent, 1, 15);
  if (int(st.rot, -90, 90)) o.rot = int(st.rot, -90, 90);
  if (int(st.dp, 0, 30) != null) o.dp = int(st.dp, 0, 30);
  { const n = Number(st.size); if (Number.isFinite(n) && n >= 1 && n <= 409) o.size = Math.round(n * 2) / 2; }
  if (typeof st.font === "string") { const f = st.font.replace(/[^\w \-.]/g, "").trim().slice(0, 64); if (f) o.font = f; }
  if (st.bd && typeof st.bd === "object") {
    const bd = {};
    for (const k of ["t", "r", "b", "l", "d1", "d2"]) { const v = st.bd[k]; if (v === 1 || v === true) bd[k] = 1; else if (v && typeof v === "object" && LINE.has(v.s)) bd[k] = Object.assign({ s: v.s }, typeof v.c === "string" && COLOR.test(v.c) ? { c: v.c } : {}); }
    if (Object.keys(bd).length) o.bd = bd;
  }
  if (st.pat && typeof st.pat === "object" && PATS.has(st.pat.t)) o.pat = Object.assign({ t: st.pat.t }, typeof st.pat.c === "string" && COLOR.test(st.pat.c) ? { c: st.pat.c } : {});
  if (st.grad && typeof st.grad === "object" && COLOR.test(String(st.grad.c1)) && COLOR.test(String(st.grad.c2))) o.grad = { c1: st.grad.c1, c2: st.grad.c2, d: ["h", "v", "du", "dd", "c"].includes(st.grad.d) ? st.grad.d : "c" };
  return Object.keys(o).length ? o : undefined;
}

// 2.824.0: charts on a sheet (ext/sheetdock/sheetchart.js)
const CHART_TYPES = new Set(["column", "bar", "line", "area", "pie", "doughnut", "scatter"]);
function cleanCharts(list) {
  if (!Array.isArray(list)) return undefined;
  const int = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  const out = list.slice(0, 50).filter((c) => c && typeof c === "object" && /^(?:[A-Z]{1,3}\d{1,7})(?::[A-Z]{1,3}\d{1,7})?$/.test(String(c.range || "").toUpperCase())).map((c, i) => ({
    id: String(c.id || "c" + (i + 1)).replace(/[^\w-]/g, "").slice(0, 20) || "c" + (i + 1), type: CHART_TYPES.has(c.type) ? c.type : "column", title: String(c.title || "").replace(/[\u0000-\u001f]/g, " ").slice(0, 120),
    range: String(c.range).toUpperCase(), x: int(c.x, 0, 1e6, 0), y: int(c.y, 0, 1e7, 0), w: int(c.w, 80, 4000, 420), h: int(c.h, 60, 3000, 260), legend: c.legend !== false,
    colors: Array.isArray(c.colors) ? c.colors.filter((x) => typeof x === "string" && COLOR.test(x)).slice(0, 12) : [] }));
  return out.length ? out : undefined;
}

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
      if (c.f && typeof c.f === "string") o.f = c.f.slice(0, 255);
      if (c.c != null && c.c !== "" && typeof c.v === "string" && c.v[0] === "=") o.c = String(c.c).slice(0, 32000);   // 2.824.0: the .xlsx's own last result of a formula          // a number format code (2.823.0) - text, shown as text
      { const st = cleanStyle(c.s); if (st) o.s = st; }
      if (Object.keys(o).length) cells[k] = o;
    }
    const num = (m) => { const o = {}; for (const [k, v] of Object.entries(m || {})) if (/^\d+$/.test(k) && +v > 0) o[k] = Math.min(2000, Math.round(+v)); return o; };
    return { name, cells, cols: num(s.cols), rows: num(s.rows), merges: (Array.isArray(s.merges) ? s.merges : []).filter((m) => /^[A-Z]{1,3}\d+:[A-Z]{1,3}\d+$/.test(m)).slice(0, 5000),
      freeze: s.freeze && typeof s.freeze === "object" ? { r: Math.max(0, Math.min(100, +s.freeze.r || 0)), c: Math.max(0, Math.min(50, +s.freeze.c || 0)) } : { r: 0, c: 0 },
      filter: cleanFilter(s.filter), protect: s.protect === true ? true : undefined, charts: cleanCharts(s.charts), dash: s.dash === true ? true : undefined };
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

module.exports = { dir, safeName, clean, cleanStyle, cleanCharts, list, read, write, remove };
