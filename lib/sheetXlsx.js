// lib/sheetXlsx.js — ▦ SPREADSHEET .XLSX IN + OUT (2.824.0), with exceljs (MIT).
//
// Tim: "can we use the llm to look through an excel file and format it like a dashboard in our spreadsheet. and continue
// next" (next = the agreed .xlsx / .csv step). Our workbook model (lib/sheetFiles.js) <-> an .xlsx:
//   values (numbers, text, booleans, dates -> day serials), formulas (+ the file's own last result kept as cell.c, so a
//   function our engine does not know still shows the right value), number format codes (the same codes - sheetfmt.js),
//   fonts, fills (solid / the 17 patterns / two-colour gradients), borders (13 styles + diagonals), alignment (incl.
//   centre across selection, indent, rotation, vertical text, wrap, shrink), protection (locked / hidden + the sheet's),
//   merges, column widths, row heights, frozen panes, sheet names, the active sheet.
//   fromXlsx(buffer) -> {sheets, active, notes}      toXlsx(doc, results) -> Buffer (results: [{A1: value}] per sheet)
// Theme colours are turned into plain colours (Office's default theme + tint). Charts in an .xlsx are not read and ours
// are not written (exceljs has no charts) - said in notes.
"use strict";

const EPOCH = Date.UTC(1899, 11, 30);
const THEME = ["FFFFFF", "000000", "E7E6E6", "44546A", "4472C4", "ED7D31", "A5A5A5", "FFC000", "5B9BD5", "70AD47", "0563C1", "954F72"];
const PAT_IN = { darkGray: "gray75", mediumGray: "gray50", lightGray: "gray25", gray125: "gray125", gray0625: "gray0625" };
const PAT_OUT = { gray75: "darkGray", gray50: "mediumGray", gray25: "lightGray" };
const PATS = new Set(["darkHorizontal", "darkVertical", "darkDown", "darkUp", "darkGrid", "darkTrellis", "lightHorizontal", "lightVertical", "lightDown", "lightUp", "lightGrid", "lightTrellis", "gray125", "gray0625"]);
const LINES = new Set(["hair", "dotted", "dashDotDot", "dashDot", "dashed", "thin", "mediumDashDotDot", "slantDashDot", "mediumDashDot", "mediumDashed", "medium", "thick", "double"]);

function colName(i) { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
const addr = (c, r) => colName(c) + (r + 1);
function tint(hex, t) {
  if (!t) return hex;
  const n = parseInt(hex, 16), ch = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(t < 0 ? v * (1 + t) : v + (255 - v) * t));
  return ch.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("").toUpperCase();
}
/** an exceljs colour -> "#rrggbb" (or null) */
function colorIn(c) {
  if (!c || typeof c !== "object") return null;
  if (typeof c.argb === "string" && /^[0-9a-f]{6,8}$/i.test(c.argb)) return "#" + c.argb.slice(-6).toLowerCase();
  if (Number.isInteger(c.theme) && THEME[c.theme]) return "#" + tint(THEME[c.theme], +c.tint || 0).toLowerCase();
  return null;
}
const colorOut = (h) => (typeof h === "string" && /^#[0-9a-f]{3,8}$/i.test(h) ? { argb: "FF" + (h.length === 4 ? h.slice(1).split("").map((x) => x + x).join("") : h.slice(1, 7)).toUpperCase() } : undefined);
const sideIn = (b) => (b && LINES.has(b.style) ? Object.assign({ s: b.style }, colorIn(b.color) ? { c: colorIn(b.color) } : {}) : null);
const sideOut = (b) => (!b ? undefined : b === 1 || b === true ? { style: "thin" } : LINES.has(b.s) ? Object.assign({ style: b.s }, b.c ? { color: colorOut(b.c) } : {}) : undefined);

/* ------------------------------------------------------------------ in */
function styleIn(cell) {
  const s = {}, f = cell.font || {}, a = cell.alignment || {}, fl = cell.fill, bd = cell.border || {}, pr = cell.protection;
  if (f.bold) s.b = true; if (f.italic) s.i = true; if (f.strike) s.strike = true;
  if (f.underline) s.u = f.underline === "double" ? "double" : f.underline === "singleAccounting" ? "acc" : f.underline === "doubleAccounting" ? "dacc" : true;
  if (f.vertAlign === "superscript") s.sup = true; else if (f.vertAlign === "subscript") s.sub = true;
  if (f.name && !/^(calibri|aptos( narrow)?)$/i.test(f.name)) s.font = String(f.name).replace(/[^\w \-.]/g, "").slice(0, 64);
  if (f.size && Math.abs(f.size - 11) > 0.01) s.size = Math.round(f.size * 2) / 2;
  const fc = colorIn(f.color);
  const H = { left: "left", center: "center", right: "right", fill: "fill", justify: "justify", centerContinuous: "centerSel", distributed: "distributed" };
  if (H[a.horizontal]) s.align = H[a.horizontal];
  const V = { top: "top", middle: "center", justify: "justify", distributed: "distributed" };
  if (V[a.vertical]) s.valign = V[a.vertical];
  if (a.wrapText) s.wrap = true; if (a.shrinkToFit) s.shrink = true;
  if (a.indent) s.indent = Math.min(15, a.indent);
  if (a.readingOrder === "rtl") s.dir = "rtl";
  if (a.textRotation === "vertical" || a.textRotation === 255) s.stack = true;
  else if (typeof a.textRotation === "number" && a.textRotation) s.rot = a.textRotation > 90 ? 90 - a.textRotation : a.textRotation;
  if (fl && fl.type === "pattern" && fl.pattern && fl.pattern !== "none") {
    if (fl.pattern === "solid") { const c = colorIn(fl.fgColor); if (c) s.bg = c; }
    else { const t = PAT_IN[fl.pattern] || (PATS.has(fl.pattern) ? fl.pattern : null); if (t) { const bgc = colorIn(fl.bgColor); if (bgc) s.bg = bgc; s.pat = Object.assign({ t }, colorIn(fl.fgColor) ? { c: colorIn(fl.fgColor) } : {}); } }
  } else if (fl && fl.type === "gradient" && Array.isArray(fl.stops) && fl.stops.length >= 2) {
    const c1 = colorIn(fl.stops[0].color), c2 = colorIn(fl.stops[fl.stops.length - 1].color);
    if (c1 && c2) { const deg = ((+fl.degree || 0) % 360 + 360) % 360; s.grad = { c1, c2, d: fl.gradient === "path" ? "c" : deg === 90 || deg === 270 ? "h" : deg === 45 || deg === 225 ? "dd" : deg === 135 || deg === 315 ? "du" : "v" }; }
  }
  // the text colour: black (or automatic) text on no fill = our theme's ink (the grid is dark); on a light fill it stays black
  const light = (h) => { if (!h) return false; const n = parseInt(h.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.55; };
  const under = s.grad ? s.grad.c1 : s.bg;
  if (fc && fc !== "#000000") s.color = fc; else if (under && light(under)) s.color = "#000000";
  const b = {};
  for (const [k, side] of [["t", "top"], ["r", "right"], ["b", "bottom"], ["l", "left"]]) { const o = sideIn(bd[side]); if (o) b[k] = o; }
  if (bd.diagonal) { const o = sideIn(bd.diagonal); if (o && bd.diagonal.up) b.d1 = o; if (o && bd.diagonal.down) b.d2 = o; }
  if (Object.keys(b).length) s.bd = b;
  if (pr && pr.locked === false) s.unlock = true; if (pr && pr.hidden) s.hide = true;
  return Object.keys(s).length ? s : null;
}
function valueIn(v) {
  if (v == null) return { raw: null };
  if (typeof v === "number") return { raw: String(v) };
  if (typeof v === "boolean") return { raw: v ? "TRUE" : "FALSE" };
  if (v instanceof Date) return { raw: String(+((v.getTime() - EPOCH) / 86400000).toFixed(10)), date: true };
  if (typeof v === "string") return { raw: /^[=+\-@]/.test(v) && v.length > 1 && v[0] === "=" ? "'" + v : v };
  if (typeof v === "object") {
    if (v.richText) return { raw: v.richText.map((r) => r.text).join("") };
    if (v.error) return { raw: v.error };
    if (v.text != null && v.hyperlink) return { raw: String(v.text) };
    if ("result" in v || v.formula || v.sharedFormula) return { result: v.result };
  }
  return { raw: String(v) };
}
async function fromXlsx(buf) {
  const ExcelJS = require("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const notes = [], sheets = [];
  let active = 0;
  let constants = null, ledger = null;
  wb.eachSheet((ws) => {
    if (sheets.length >= 200) return;
    { const k = constantsIn(ws); if (k) { constants = k.constants; ledger = k.ledger; return; } }   // 2.828+: bitGen's own Constants sheet -> 📌 Constants
    if (ws.state === "hidden" || ws.state === "veryHidden") notes.push(`"${ws.name}" was hidden in the file - shown here`);
    const S = { name: String(ws.name).replace(/[\[\]*?:\\/]/g, "").slice(0, 60) || "Sheet" + (sheets.length + 1), cells: {}, cols: {}, rows: {}, merges: [], freeze: { r: 0, c: 0 } };
    let n = 0;
    ws.eachRow({ includeEmpty: true }, (row, rn) => {
      if (row.height && row.customHeight !== false && Math.abs(row.height - 15) > 0.5) S.rows[rn - 1] = Math.min(2000, Math.round(row.height * 4 / 3));
      row.eachCell({ includeEmpty: true }, (cell, cn) => {
        if (n++ > 400000) return;
        const k = addr(cn - 1, rn - 1), o = {};
        if (cell.isMerged && cell.master && cell.master.address !== cell.address) { const st = styleIn(cell); if (st) S.cells[k] = { s: st }; return; }
        let formula = null; try { formula = cell.formula || (cell.value && cell.value.formula) || null; } catch (e) { formula = null; }
        if (formula) { o.v = "=" + String(formula).replace(/^=/, "").replace(/_xlfn\.|_xlws\./g, ""); const res = cell.value && typeof cell.value === "object" ? cell.value.result : undefined; if (res != null) { const r = valueIn(res); if (r.raw != null) o.c = r.raw; } }
        else { const r = valueIn(cell.value); if (r.raw != null && r.raw !== "") o.v = r.raw; }
        // built-in format 14 (the locale's short date) comes as "mm-dd-yy" - shown day first, as here
        if (cell.numFmt && !/^general$/i.test(cell.numFmt)) o.f = /^mm-dd-yy$/i.test(cell.numFmt) ? "d/mm/yyyy" : String(cell.numFmt).slice(0, 255);
        else if (o.v != null && cell.value instanceof Date) o.f = "d/mm/yyyy";
        const st = styleIn(cell); if (st) o.s = st;
        if (Object.keys(o).length) S.cells[k] = o;
      });
    });
    (ws.columns || []).forEach((col, i) => { if (col && col.width && Math.abs(col.width - 9.140625) > 0.2 && Math.abs(col.width - 8.43) > 0.2) S.cols[i] = Math.max(16, Math.min(2000, Math.round(col.width * 7 + 5))); });
    const merges = (ws.model && ws.model.merges) || [];
    S.merges = merges.filter((m) => /^[A-Z]{1,3}\d+:[A-Z]{1,3}\d+$/.test(m)).slice(0, 5000);
    const v = (ws.views || [])[0];
    if (v && v.state === "frozen") S.freeze = { r: Math.min(100, +v.ySplit || 0), c: Math.min(50, +v.xSplit || 0) };
    if (ws.sheetProtection && ws.sheetProtection.sheet) S.protect = true;
    if (v && v.tabSelected) active = sheets.length;
    if (n > 400000) notes.push(`"${S.name}": only the first 400,000 cells were read`);
    sheets.push(S);
  });
  if (!sheets.length) throw Object.assign(new Error("there are no sheets in that file"), { status: 400 });
  const out = { sheets, active, notes };
  if (constants && constants.length) { out.constants = constants; if (ledger) out.ledger = { sheet: ledger }; notes.push(`📌 ${constants.length} constant${constants.length === 1 ? "" : "s"} read from the "Constants" sheet`); }
  return out;
}

/* ------------------------------------------------------------------ out */
function styleOut(xc, s, f) {
  if (f && !/^general$/i.test(f)) xc.numFmt = f;
  if (!s) return;
  const font = {};
  if (s.b) font.bold = true; if (s.i) font.italic = true; if (s.strike) font.strike = true;
  if (s.u) font.underline = s.u === true ? true : s.u === "acc" ? "singleAccounting" : s.u === "dacc" ? "doubleAccounting" : "double";
  if (s.sup) font.vertAlign = "superscript"; else if (s.sub) font.vertAlign = "subscript";
  if (s.font) font.name = s.font; if (s.size) font.size = s.size;
  if (s.color) font.color = colorOut(s.color);
  if (Object.keys(font).length) xc.font = font;
  const al = {};
  const H = { left: "left", center: "center", right: "right", fill: "fill", justify: "justify", centerSel: "centerContinuous", distributed: "distributed" };
  if (H[s.align]) al.horizontal = H[s.align];
  const V = { top: "top", center: "middle", justify: "justify", distributed: "distributed" };
  if (V[s.valign]) al.vertical = V[s.valign];
  if (s.wrap) al.wrapText = true; if (s.shrink) al.shrinkToFit = true; if (s.indent) al.indent = s.indent;
  if (s.dir === "rtl") al.readingOrder = "rtl";
  if (s.stack) al.textRotation = "vertical"; else if (s.rot) al.textRotation = s.rot;
  if (Object.keys(al).length) xc.alignment = al;
  if (s.grad) { const d = s.grad.d; xc.fill = d === "c" ? { type: "gradient", gradient: "path", center: { left: 0.5, top: 0.5 }, stops: [{ position: 0, color: colorOut(s.grad.c2) }, { position: 1, color: colorOut(s.grad.c1) }] } : { type: "gradient", gradient: "angle", degree: d === "h" ? 90 : d === "dd" ? 45 : d === "du" ? 135 : 0, stops: [{ position: 0, color: colorOut(s.grad.c1) }, { position: 1, color: colorOut(s.grad.c2) }] }; }
  else if (s.pat && s.pat.t) xc.fill = { type: "pattern", pattern: PAT_OUT[s.pat.t] || s.pat.t, fgColor: colorOut(s.pat.c || "#000000"), bgColor: s.bg ? colorOut(s.bg) : undefined };
  else if (s.bg) xc.fill = { type: "pattern", pattern: "solid", fgColor: colorOut(s.bg) };
  if (s.bd) {
    const b = {};
    for (const [k, side] of [["t", "top"], ["r", "right"], ["b", "bottom"], ["l", "left"]]) { const o = sideOut(s.bd[k]); if (o) b[side] = o; }
    if (s.bd.d1 || s.bd.d2) b.diagonal = Object.assign(sideOut(s.bd.d1 || s.bd.d2) || { style: "thin" }, { up: !!s.bd.d1, down: !!s.bd.d2 });
    if (Object.keys(b).length) xc.border = b;
  }
  if (s.unlock || s.hide) xc.protection = { locked: !s.unlock, hidden: !!s.hide };
}
function plainValue(raw) {
  const t = String(raw).trim();
  if (/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return Number(t);
  if (/^(true|false)$/i.test(t)) return /^true$/i.test(t);
  return String(raw).replace(/^'/, "");
}
/* 2.829.0 (Tim: "add the constants sheet to excel export"): the 📌 Constants as a sheet of their own - one row per amount (its
   From / To dates), Ledger in J1:K1 - read back into the Constants when the .xlsx is opened in bitGen again (constantsIn). */
const CONST_HEAD = ["Type", "Income / Expense", "Amount", "Every", "From", "To", "Description", "Entered by ⟳"];
const isoDate = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; };
const dayBefore = (iso) => { const d = isoDate(iso); return d ? new Date(d.getTime() - 86400000) : null; };
function constantsOut(wb, d, names) {
  if (!Array.isArray(d.constants) || !d.constants.length) return;
  let name = "Constants", i = 2; while (names.has(name.toLowerCase())) name = `Constants (${i++})`;
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.addRow(CONST_HEAD);
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF203864" } }; });
  for (const k of d.constants) {
    const R = (k.rates || []).slice().sort((a, b) => (a.start < b.start ? -1 : 1));
    R.forEach((r, j) => {
      const to = j + 1 < R.length ? dayBefore(R[j + 1].start) : k.end ? isoDate(k.end) : null;
      const row = ws.addRow([k.name, k.kind === "income" ? "Income" : "Expense", +r.amount, r.every, isoDate(r.start), to, k.desc || "", k.manual ? "no" : "yes"]);
      row.getCell(3).numFmt = '"$"#,##0.00'; row.getCell(5).numFmt = "d/mm/yyyy"; row.getCell(6).numFmt = "d/mm/yyyy";
    });
  }
  if (d.ledger && d.ledger.sheet) { ws.getCell("J1").value = "Ledger"; ws.getCell("J1").font = { bold: true }; ws.getCell("K1").value = d.ledger.sheet; }
  [16, 16, 12, 11, 12, 12, 28, 13, 2, 9, 16].forEach((w, c) => { ws.getColumn(c + 1).width = w; });
}
/** a sheet that is bitGen's Constants sheet -> {constants, ledger} (null when it is not one) */
function constantsIn(ws) {
  if (!/^constants( \(\d+\))?$/i.test(String(ws.name || ""))) return null;
  const txt = (v) => (v == null ? "" : typeof v === "object" && v.richText ? v.richText.map((x) => x.text).join("") : typeof v === "object" && v.text ? v.text : String(v)).trim();
  const head = CONST_HEAD.map((h, c) => txt(ws.getCell(1, c + 1).value));
  if (head.slice(0, 5).join("|") !== CONST_HEAD.slice(0, 5).join("|")) return null;
  const iso = (v) => { if (v instanceof Date) return v.toISOString().slice(0, 10); const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(txt(v)); return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : /^\d{4}-\d{2}-\d{2}$/.test(txt(v)) ? txt(v) : null; };
  const by = new Map();
  ws.eachRow((row, rn) => {
    if (rn === 1) return;
    const name = txt(row.getCell(1).value); if (!name) return;
    const amount = +(typeof row.getCell(3).value === "object" && row.getCell(3).value && row.getCell(3).value.result != null ? row.getCell(3).value.result : row.getCell(3).value);
    const start = iso(row.getCell(5).value); if (!start || !isFinite(amount)) return;
    let k = by.get(name.toLowerCase());
    if (!k) { k = { id: "k" + (by.size + 1), name, kind: /^income$/i.test(txt(row.getCell(2).value)) ? "income" : "expense", rates: [] }; by.set(name.toLowerCase(), k); }
    k.rates.push({ amount, every: txt(row.getCell(4).value).toLowerCase() || "month", start });
    const desc = txt(row.getCell(7).value); if (desc) k.desc = desc;
    if (/^no$/i.test(txt(row.getCell(8).value))) k.manual = true;
    const to = iso(row.getCell(6).value); k._last = { start, to };
  });
  for (const k of by.values()) { k.rates.sort((a, b) => (a.start < b.start ? -1 : 1)); const last = k.rates[k.rates.length - 1]; if (k._last && k._last.start === last.start && k._last.to) k.end = k._last.to; delete k._last; }
  const lg = txt(ws.getCell("J1").value) === "Ledger" ? txt(ws.getCell("K1").value) : "";
  return { constants: [...by.values()], ledger: lg || null };
}
async function toXlsx(doc, results) {
  const ExcelJS = require("exceljs"), clean = require("./sheetFiles").clean;
  const d = clean(doc), wb = new ExcelJS.Workbook();
  wb.creator = "bitGen Studio"; wb.created = new Date();
  for (let si = 0; si < d.sheets.length; si++) {
    const S = d.sheets[si];
    const ws = wb.addWorksheet(S.name, { views: [Object.assign(S.freeze && (S.freeze.r || S.freeze.c) ? { state: "frozen", xSplit: S.freeze.c, ySplit: S.freeze.r } : {}, si === d.active ? { tabSelected: true } : {})] });
    const res = (results && results[si]) || {};
    for (const [k, cell] of Object.entries(S.cells)) {
      const xc = ws.getCell(k);
      if (cell.v != null) {
        if (cell.v[0] === "=") { const r = res[k]; xc.value = { formula: cell.v.slice(1), result: r && typeof r === "object" ? undefined : r }; }
        else if (cell.f === "@") xc.value = String(cell.v);
        else xc.value = plainValue(cell.v);
      }
      styleOut(xc, cell.s, cell.f);
    }
    for (const [c, w] of Object.entries(S.cols)) ws.getColumn(+c + 1).width = Math.max(1, (w - 5) / 7);
    for (const [r, h] of Object.entries(S.rows)) ws.getRow(+r + 1).height = h * 0.75;
    for (const m of S.merges) { try { ws.mergeCells(m); } catch (e) { /* overlapping - left out */ } }
    if (S.protect) await ws.protect("", { selectLockedCells: true, selectUnlockedCells: true });
  }
  constantsOut(wb, d, new Set(d.sheets.map((S) => S.name.toLowerCase())));   // 2.829.0
  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { constantsIn, constantsOut, CONST_HEAD, fromXlsx, toXlsx, colorIn, styleIn, styleOut, tint, THEME };
