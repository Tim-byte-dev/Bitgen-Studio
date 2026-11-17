#!/usr/bin/env node
/* bitGen Studio — 2.824.0 against the RUNNING app (+ a real browser): ▦ .xlsx in / out, charts, ✨ Dashboard by the LLM.
 * Tim: "can we use the llm to look through an excel file and format it like a dashboard in our spreadsheet. and continue
 * next". An .xlsx made here with exceljs (styles, a merged title, dates, a SUMPRODUCT the engine does not have) is
 * imported; ✨ Dashboard asks a stand-in OpenAI-style LLM (set as Settings ▸ LLM's endpoint for the run, put back
 * after) - it is shown the columns, not the rows; one of its breakdowns names a column that is not there and is left
 * out; the dashboard is checked on screen (numbers, charts), one undo takes it away; LLM off = from the data's shape;
 * 📊 a chart dragged / sized / deleted; ⤓ .xlsx read back with exceljs, ⤓ CSV; 💾 + 📂 keep the charts.
 * H3_SHOTS=<dir> saves pictures. No Playwright = SKIP. */
"use strict";
const path = require("path"), fs = require("fs"), http = require("http");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const ExcelJS = require(path.join(__dirname, "..", "node_modules", "exceljs"));
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/", SHOTS = process.env.H3_SHOTS || "";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (method, u, body) => { const r = await fetch(new URL(u, URL_), { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined }); return r.json(); };
const asked = [];
const PLAN = { title: "Fruit sales 2026", subtitle: "Revenue, units and orders", sheet: "Orders",
  kpis: [{ label: "Revenue", func: "SUM", column: "Revenue", format: "currency" }, { label: "Units sold", func: "SUM", column: "Units", format: "integer" }, { label: "Orders", func: "COUNT", column: "Order", format: "integer" }, { label: "Best order", func: "MAX", column: "Revenue", format: "currency" }],
  breakdowns: [{ title: "Revenue by region", by: "Region", value: "Revenue", func: "SUM", top: 8, chart: "bar" }, { title: "Not there", by: "Colour", value: "Revenue", func: "SUM", chart: "pie" }, { title: "Units by product", by: "Product", value: "Units", func: "SUM", chart: "doughnut" }],
  trend: { title: "Revenue by month", date: "Date", value: "Revenue", func: "SUM", period: "month", chart: "line" }, formats: { Revenue: "currency", Date: "date" }, theme: "teal" };
function llmServer() {
  return http.createServer((req, res) => {
    let body = ""; req.on("data", (c) => { body += c; });
    req.on("end", () => {
      let j = {}; try { j = JSON.parse(body); } catch (e) { /* empty */ }
      const all = (j.messages || []).map((m) => m.content).join("\n"); asked.push(all);
      const text = /You design dashboards/.test(all) ? "Here is the plan:\n```json\n" + JSON.stringify(PLAN, null, 1) + "\n```" : "?";
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: text } }] }));
    });
  }).listen(0, "127.0.0.1");
}
async function makeXlsx() {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet("Orders");
  ws.columns = [{ width: 12 }, { width: 13 }, { width: 11 }, { width: 11 }, { width: 8 }, { width: 12 }];
  ws.mergeCells("A1:F1"); ws.getCell("A1").value = "Orders 2026"; ws.getCell("A1").font = { bold: true, size: 16 };
  ws.addRow([]);
  ws.getRow(2).values = ["Order", "Date", "Region", "Product", "Units", "Revenue"];
  ws.getRow(2).font = { bold: true, color: { argb: "FFFFFFFF" } }; ws.getRow(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF203864" } };
  const regions = ["North", "South", "East", "West"], prods = ["Apples", "Pears", "Plums"];
  let rev = 0, units = 0;
  for (let i = 0; i < 48; i++) {
    const u = (i % 5) + 1, price = [2.5, 3, 4][i % 3], v = u * price; rev += v; units += u;
    const row = ws.addRow([`Order-${String(i + 1).padStart(4, "0")}`, new Date(Date.UTC(2026, Math.floor(i / 8), 1 + (i % 8) * 3)), regions[i % 4], prods[i % 3], u, v]);
    row.getCell(6).numFmt = '"$"#,##0.00';
  }
  ws.getCell("H2").value = "Check"; ws.getCell("H3").value = { formula: "SUMPRODUCT(E3:E50,F3:F50)", result: 4242 };
  ws.views = [{ state: "frozen", ySplit: 2 }];
  const ws2 = wb.addWorksheet("Notes"); ws2.getCell("A1").value = "Made for the test";
  return { buf: Buffer.from(await wb.xlsx.writeBuffer()), rev, units };
}
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const llm = llmServer(); await new Promise((r) => llm.on("listening", r));
  const cfg0 = await api("GET", "api/config"), llm0 = { external_url: (cfg0.llm || {}).external_url || "", external_model: (cfg0.llm || {}).external_model || "local" };
  await api("POST", "api/config", { llm: { external_url: `http://127.0.0.1:${llm.address().port}/v1/chat/completions`, external_model: "stand-in" } });
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, x) => p.evaluate(f, x);
  const S = (a) => ev((a) => { const q = window.SheetCalc.parseAddr(a); return window.H3Sheet.shown(q.c, q.r); }, a);
  const shot = async (n) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, n + ".png") }); } };
  const gone = [];
  try {
    const X = await makeXlsx();
    await p.addInitScript(() => { try { localStorage.removeItem("h3.g.sheetdock"); localStorage.removeItem("h3.sheet.draft"); } catch (e) { /* fine */ } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Sheet && window.H3SheetIO && window.H3SheetDash && window.SheetChart, null, { timeout: 60000 });
    await p.$eval("#tX_sheetdock", (e) => e.click()); await p.waitForTimeout(400);
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { if (d.style.display !== "none") { d.dataset.t824 = d.style.display; d.style.display = "none"; } }); const d = document.getElementById("sheetdock"); d.dataset.t824css = d.style.cssText; d.style.cssText = "position:fixed;left:0;top:40px;width:1360px;height:860px;z-index:60;background:var(--panel)"; });
    // ⤒ Import (the real file picker)
    // ⤒ Import opens the file picker (bitGen's own file dialog on this computer); the test hands the file straight in
    await ev(() => { const fd = window.FileDialog, o = fd && fd.pickInto; window.__t824 = []; if (o) fd.pickInto = function (inp) { window.__t824.push(inp.accept); }; const oc = HTMLInputElement.prototype.click; HTMLInputElement.prototype.click = function () { if (this.type === "file") { window.__t824.push(this.accept); return; } return oc.apply(this, arguments); }; });
    await p.click("#shImport");
    check("⤒ Import opens the file picker for .xlsx / .csv", (await ev(() => window.__t824.some((a) => /\.xlsx/.test(a) && /\.csv/.test(a)))), await ev(() => window.__t824));
    await ev((b64) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return window.H3SheetIO.importFile(new File([u], "orders 2026.xlsx")); }, X.buf.toString("base64"));
    await p.waitForFunction(() => window.H3Sheet.W.sheets.length === 2 && window.H3Sheet.W.sheets[0].name === "Orders", null, { timeout: 15000 });
    const imp = await ev(() => { const S0 = window.H3Sheet.W.sheets[0]; return { file: document.getElementById("shFile").value, merges: S0.merges, freeze: S0.freeze, head: S0.cells.A2.s, f6: S0.cells.F3.f, date: S0.cells.B3.f, cols: S0.cols[1] }; });
    check("⤒ Import an .xlsx: both sheets, the merged title, frozen rows, the header's fill + white bold, number formats, dates, widths", imp.file === "orders 2026" && imp.merges.includes("A1:F1") && imp.freeze.r === 2 && imp.head.b && imp.head.bg === "#203864" && imp.head.color === "#ffffff" && imp.f6 === '"$"#,##0.00' && imp.date === "d/mm/yyyy" && imp.cols > 80, imp);
    check("…values as the file shows them: $2.50, a date, and SUMPRODUCT (not in our engine) = the file's own result 4242", (await S("F3")) === "$2.50" && (await S("B3")) === "1/01/2026" && (await S("H3")) === "4242", [await S("F3"), await S("B3"), await S("H3")]);
    await shot("1-imported");
    // ✨ Dashboard by the LLM
    await p.$eval("#shDash", (e) => e.click()); await p.waitForSelector("#shDashDlg[open]");
    await p.fill("#shdAsk", "revenue by region and month");
    await p.click("#shdGo");
    await p.waitForFunction(() => window.H3Sheet.W.sheets[0].name === "Dashboard", null, { timeout: 30000 });
    await p.waitForTimeout(300);
    const q = asked.join("\n");
    check("the LLM was shown the columns (names, kinds, totals) and the ask - not the rows", /"Revenue": money, total/.test(q) && /"Region": text, 4 different/.test(q) && /"Date": dates from/.test(q) && /revenue by region and month/.test(q) && !/Order-0042/.test(q), q.slice(0, 600));
    const dash = await ev(() => { const H = window.H3Sheet, D = H.W.sheets[0]; return { tabs: [...document.querySelectorAll("#shTabs .tab")].map((t) => t.textContent.trim()), active: H.W.active, charts: D.charts.map((c) => c.type + " " + c.title), msg: document.getElementById("shMsg").textContent, title: D.cells.A1.v }; });
    check("✨ Dashboard: a new first sheet built from the LLM's plan - its title, KPI tiles, the breakdowns + trend with charts", dash.tabs[0] === "Dashboard" && dash.active === 0 && dash.title === "Fruit sales 2026" && dash.charts.join("|") === "bar Revenue by region|doughnut Units by product|line Revenue by month" && /the LLM's plan/.test(dash.msg), dash);
    check("…the breakdown that named a column the data does not have (Colour) was left out", !dash.charts.some((c) => /Not there/.test(c)));
    check("…the KPI tiles are live formulas: revenue, units, orders, the best order", (await S("A5")) === "$" + X.rev.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",") && (await S("C5")) === String(X.units) && (await S("E5")) === "48" && (await S("G5")) === "$20.00", [await S("A5"), await S("C5"), await S("E5"), await S("G5")]);
    const svgs = await ev(() => [...document.querySelectorAll("#shPane .ch")].map((c) => ({ rects: c.querySelectorAll("rect").length, paths: c.querySelectorAll("path").length, lines: c.querySelectorAll("polyline").length, text: c.textContent.slice(0, 120) })));
    check("…the charts are drawn on the sheet (bars, doughnut slices, the month line)", svgs.length >= 2 && svgs[0].rects >= 4 && /North|South|East|West/.test(svgs[0].text) && (svgs[1] ? svgs[1].paths >= 3 : true), svgs);
    const data = await ev(() => { const S1 = window.H3Sheet.W.sheets.find((s) => s.name === "Orders"); return { filter: S1.filter, band: (S1.cells.A4.s || {}).bg, head: S1.cells.A2.s.bg }; });
    check("…and the data sheet formatted as a table: the header in the theme, banded rows, a filter on the headings", data.filter && data.filter.r === 1 && data.filter.r2 === 49 && data.band === "#132326" && data.head === "#17707a", data);
    await shot("2-dashboard");
    await ev(() => { document.getElementById("shGrid").scrollTop = 420; }); await p.waitForTimeout(200); await shot("3-dashboard-lower"); await ev(() => { document.getElementById("shGrid").scrollTop = 0; });
    await ev(() => document.getElementById("shGrid").focus()); await p.keyboard.press("Control+z"); await p.waitForTimeout(200);
    check("one Ctrl+Z takes the whole dashboard away (the data's looks too)", (await ev(() => window.H3Sheet.W.sheets.map((s) => s.name).join()))  === "Orders,Notes" && !(await ev(() => window.H3Sheet.W.sheets[0].filter)));
    // LLM off
    await p.$eval("#shDash", (e) => e.click()); await p.waitForSelector("#shDashDlg[open]"); await p.click("#shdLlm"); await p.click("#shdGo");
    await p.waitForFunction(() => window.H3Sheet.W.sheets[0].name === "Dashboard", null, { timeout: 20000 });
    const fb = await ev(() => ({ msg: document.getElementById("shMsg").textContent, charts: window.H3Sheet.W.sheets[0].charts.length }));
    check("LLM off: a dashboard from the data's own shape (KPIs, region / product breakdowns, the month trend)", /the data's own shape/.test(fb.msg) && fb.charts === 3, fb);
    await ev(() => window.H3Sheet.undo(false));
    // 📊 a chart by hand
    await ev(() => { const H = window.H3Sheet; H.W.active = 0; H.St.book = null; H.paint(); H.St.sel = { r1: 1, c1: 2, r2: 9, c2: 2 }; H.St.act = { r: 1, c: 2 }; H.paint(); });
    await ev(() => { const H = window.H3Sheet; H.St.sel = { r1: 1, c1: 4, r2: 9, c2: 5 }; H.St.act = { r: 1, c: 4 }; H.paint(); });
    await p.$eval("#shChart", (e) => e.click()); await p.waitForSelector('.shmenu [data-t="column"]'); await ev(() => document.querySelector('.shmenu [data-t="column"]').click());
    const c0 = await ev(() => { const c = window.H3Sheet.W.sheets[0].charts[0]; return { ...c }; });
    check("📊 Chart ▾ ▸ Column: a chart of E2:F10 beside the cells, picked", c0.range === "E2:F10" && c0.type === "column" && (await ev(() => !!document.querySelector("#shPane .ch.on"))), c0);
    const cb = await (await p.$("#shPane .ch")).boundingBox();
    await p.mouse.move(cb.x + 60, cb.y + 60); await p.mouse.down(); await p.mouse.move(cb.x + 160, cb.y + 110, { steps: 5 }); await p.mouse.up();
    await p.mouse.move(cb.x + 100 + cb.width - 4, cb.y + 50 + cb.height - 4); await p.mouse.down(); await p.mouse.move(cb.x + 100 + cb.width + 76, cb.y + 50 + cb.height + 36, { steps: 5 }); await p.mouse.up();
    const c1 = await ev(() => ({ ...window.H3Sheet.W.sheets[0].charts[0] }));
    check("…dragged (moved 100, 50) and sized by its corner (+80, +40)", c1.x === c0.x + 100 && c1.y === c0.y + 50 && c1.w === c0.w + 80 && c1.h === c0.h + 40, [c0, c1]);
    await ev(() => window.H3Sheet.shiftCells("r", 0, 1));
    check("…a row inserted above: its range follows (E3:F11)", (await ev(() => window.H3Sheet.W.sheets[0].charts[0].range)) === "E3:F11");
    await ev(() => window.H3Sheet.undo(false));
    // ⤓ Export .xlsx (read back) + CSV
    await p.$eval("#shExport", (e) => e.click()); await p.waitForSelector('.shmenu [data-x="xlsx"]');
    const dl = p.waitForEvent("download"); await ev(() => document.querySelector('.shmenu [data-x="xlsx"]').click()); const d1 = await dl;
    const tmp = path.join(require("os").tmpdir(), "ui824.xlsx"); await d1.saveAs(tmp); gone.push("orders 2026.xlsx");
    const back = new ExcelJS.Workbook(); await back.xlsx.readFile(tmp); const o = back.getWorksheet("Orders");
    check("⤓ Export ▸ .xlsx: downloaded - the same sheets, values, number formats, the header fill, merges, frozen rows, the formula + its result", d1.suggestedFilename() === "orders 2026.xlsx" && back.worksheets.length === 2 && o.getCell("F3").value === 2.5 && o.getCell("F3").numFmt === '"$"#,##0.00' && o.getCell("A2").fill.fgColor.argb === "FF203864" && o.model.merges.includes("A1:F1") && o.views[0].ySplit === 2 && o.getCell("H3").value.formula === "SUMPRODUCT(E3:E50,F3:F50)", [d1.suggestedFilename(), o.getCell("F3").value, o.getCell("H3").value]);
    await p.$eval("#shExport", (e) => e.click()); await p.waitForSelector('.shmenu [data-x="csv"]');
    const dl2 = p.waitForEvent("download"); await ev(() => document.querySelector('.shmenu [data-x="csv"]').click()); const d2 = await dl2;
    const csv = fs.readFileSync(await d2.path(), "utf8").replace(/^﻿/, "").split("\r\n");
    check("⤓ Export ▸ CSV: this sheet's values (numbers plain, dates as day numbers)", csv[1].startsWith("Order,Date,Region,Product,Units,Revenue") && csv[2].startsWith("Order-0001,46023,North,Apples,1,2.5"), csv.slice(0, 3));
    // 💾 + 📂 keep the chart
    await ev(() => { document.getElementById("shFile").value = "ui824 test"; }); await p.$eval("#shSave", (e) => e.click()); await p.waitForTimeout(500); gone.push("ui824 test.bgs");
    const kept = await api("GET", "api/sheets/file?name=" + encodeURIComponent("ui824 test.bgs"));
    check("💾 the workbook keeps its chart (type, range, place, size)", kept.sheets[0].charts && kept.sheets[0].charts[0].range === "E2:F10" && kept.sheets[0].charts[0].w === c1.w);
    await ev(() => { window.H3Sheet.St.chart = window.H3Sheet.W.sheets[0].charts[0].id; window.H3Sheet.paint(); document.getElementById("shGrid").focus(); }); await p.keyboard.press("Delete");
    check("a picked chart + Delete = gone", !(await ev(() => (window.H3Sheet.W.sheets[0].charts || []).length)));
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally {
    try { await api("POST", "api/config", { llm: llm0 }); } catch (e) { /* fine */ }
    for (const n of gone) { try { await fetch(new URL("api/sheets/file?name=" + encodeURIComponent(n), URL_), { method: "DELETE" }); } catch (e) { /* fine */ } }
    try { await ev(() => { const d = document.getElementById("sheetdock"); d.style.cssText = d.dataset.t824css || ""; document.querySelectorAll("[data-t824]").forEach((x) => { x.style.display = x.dataset.t824; delete x.dataset.t824; }); localStorage.removeItem("h3.sheet.draft"); if (!d.classList.contains("dockgone")) toggleDockGone("sheetdock", "tX_sheetdock"); }); } catch (e) { /* fine */ }
    await b.close(); llm.close();
    console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
