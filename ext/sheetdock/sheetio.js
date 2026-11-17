/* ext/sheetdock/sheetio.js — ▦ .XLSX / .CSV IN AND OUT (2.824.0): window.H3SheetIO (+ SheetCSV pure, Node-tested).
 *
 * Tim: "... and continue next" (the agreed step: .xlsx + .csv). ⤒ Import: an .xlsx goes to the server (lib/sheetXlsx.js)
 * and comes back as a workbook - values, formulas, number formats, looks, merges, widths, frozen panes; a .csv / .tsv /
 * .txt is read here (the separator found by itself). ⤓ Export ▾: Excel workbook (.xlsx - downloaded and kept in the
 * project's sheets folder; formulas go with their results) or CSV of this sheet (the values as numbers / text).
 *   SheetCSV.parse(text) -> rows [[text]]      SheetCSV.write(rows) -> text (quotes where needed, CRLF)
 */
(function (root) {
  "use strict";
  function parse(text) {
    let s = String(text || "").replace(/^﻿/, "");
    const first = s.split(/\r?\n/, 1)[0] || "";
    const sep = ["\t", ";", ","].map((c) => [c, first.split(c).length]).sort((a, b) => b[1] - a[1])[0];
    const SEP = sep[1] > 1 ? sep[0] : ",";
    const rows = []; let row = [], cur = "", q = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) { if (ch === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; continue; }
      if (ch === '"' && cur === "") { q = true; continue; }
      if (ch === SEP) { row.push(cur); cur = ""; continue; }
      if (ch === "\n" || ch === "\r") { if (ch === "\r" && s[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; if (rows.length >= 200000) break; continue; }
      cur += ch;
    }
    if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }
  function write(rows) { return rows.map((r) => r.map((v) => { const t = v == null ? "" : String(v); return /[",\r\n]|^\s|\s$/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }).join(",")).join("\r\n") + "\r\n"; }
  const SheetCSV = { parse, write };
  root.SheetCSV = SheetCSV;
  if (typeof module !== "undefined" && module.exports) { module.exports = SheetCSV; return; }

  const doc = root.document; if (!doc) return;
  const H = () => root.H3Sheet, X = () => root.H3Sheet._;
  const C = () => root.SheetCalc;
  const base = (n) => String(n || "Workbook").replace(/\.(xlsx|xlsm|csv|tsv|txt)$/i, "").slice(0, 80);
  function download(blob, name) { const a = doc.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; doc.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
  async function importFile(file) {
    const Hs = H(), I = X();
    if (/\.(csv|tsv|txt)$/i.test(file.name)) {
      const rows = parse(await file.text()), cells = {};
      rows.forEach((r, ri) => r.forEach((v, ci) => { if (v !== "" && ci < 16384) cells[C().addr(ci, ri)] = { v }; }));
      const S = { name: base(file.name).replace(/[\[\]*?:\\/]/g, "").slice(0, 31) || "Sheet1", cells, cols: {}, rows: {}, merges: [], freeze: { r: 0, c: 0 } };
      // typed entries get their format as if typed ($1,200 -> currency, 17/11/2026 -> a date …)
      for (const cl of Object.values(cells)) { const p = C().parseInput(cl.v); if (p.fmt && p.fmt !== "text") cl.f = p.fmt; }
      Hs.load({ sheets: [S], active: 0 }, base(file.name));
      I.msg(`⤒ ${file.name}: ${rows.length} rows`);
      return;
    }
    const r = await fetch("/api/sheets/import?name=" + encodeURIComponent(file.name), { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: file });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "HTTP " + r.status);
    Hs.load(j.doc, base(file.name));
    I.msg(`⤒ ${file.name}: ${j.doc.sheets.length} sheet${j.doc.sheets.length === 1 ? "" : "s"}` + (j.notes && j.notes.length ? " - " + j.notes.join("; ") : ""));
  }
  function pick() {
    // in the page (hidden) - some browsers open no picker for an input that is not
    const inp = doc.createElement("input"); inp.type = "file"; inp.accept = ".xlsx,.xlsm,.csv,.tsv,.txt"; inp.hidden = true; doc.body.appendChild(inp);
    inp.addEventListener("change", async () => { const f = inp.files[0]; inp.remove(); if (!f) return; try { await importFile(f); } catch (e) { X().msg("✗ " + (e.message || e), true); } });
    inp.click();
  }
  async function exportXlsx() {
    const Hs = H(), I = X(), W = Hs.W, B = Hs.book();
    const results = W.sheets.map((S, si) => { const o = {}; for (const [k, cl] of Object.entries(S.cells)) if (cl.v && cl.v[0] === "=") { const p = C().parseAddr(k), v = B.get(si, p.c, p.r); if (v != null && typeof v !== "object") o[k] = v; } return o; });
    const name = (doc.getElementById("shFile").value || W.name || "Workbook").trim();
    const r = await fetch("/api/sheets/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, doc: { sheets: W.sheets, active: W.active }, results }) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || "HTTP " + r.status); }
    const fname = decodeURIComponent(r.headers.get("X-File-Name") || name + ".xlsx");
    download(await r.blob(), fname);
    const charts = W.sheets.reduce((n, S) => n + ((S.charts || []).length), 0);
    I.msg(`⤓ ${fname} - downloaded and kept in the project's sheets folder` + (charts ? ` (charts stay in bitGen's own .bgs - an .xlsx gets their data)` : ""));
  }
  function exportCsv() {
    const Hs = H(), I = X(), S = Hs.W.sheets[Hs.W.active], B = Hs.book();
    let r2 = -1, c2 = -1; for (const k of Object.keys(S.cells)) { const p = C().parseAddr(k); if (S.cells[k].v != null && S.cells[k].v !== "") { r2 = Math.max(r2, p.r); c2 = Math.max(c2, p.c); } }
    const rows = [];
    for (let r = 0; r <= r2; r++) { const row = []; for (let c = 0; c <= c2; c++) { const v = B.get(Hs.W.active, c, r); row.push(v == null ? "" : typeof v === "object" ? v.err : typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : typeof v === "number" ? String(+v.toPrecision(15)) : v); } rows.push(row); }
    const name = base(doc.getElementById("shFile").value) + (Hs.W.sheets.length > 1 ? " - " + S.name : "") + ".csv";
    download(new Blob(["﻿" + write(rows)], { type: "text/csv" }), name);
    I.msg(`⤓ ${name}: ${rows.length} rows`);
  }
  function exportMenu(btn) {
    const r = btn.getBoundingClientRect(), m = X().menu(r.left, r.bottom + 2, `<div data-x="xlsx">📗 Excel workbook (.xlsx)</div><div data-x="csv">📄 CSV - this sheet (.csv)</div>`);
    m.addEventListener("click", async (e) => { const a = (e.target.closest("[data-x]") || {}).dataset; if (!a || !a.x) return; m.remove(); try { if (a.x === "xlsx") await exportXlsx(); else exportCsv(); } catch (er) { X().msg("✗ " + (er.message || er), true); } });
  }
  root.H3SheetIO = { importFile, pick, exportXlsx, exportCsv, exportMenu };
})(typeof window !== "undefined" ? window : globalThis);
