#!/usr/bin/env node
/* bitGen Studio — 2.824.0 units: ▦ .xlsx in / out (lib/sheetXlsx.js, exceljs MIT), CSV (sheetio.js SheetCSV), charts
 * (sheetchart.js), ✨ the dashboard (lib/sheetAi.js plan by the LLM - stood in here; sheetdash.js profile / validate /
 * fallback / build checked by working out the built formulas). Tim: "can we use the llm to look through an excel file
 * and format it like a dashboard in our spreadsheet. and continue next". */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const ExcelJS = require(path.join(ROOT, "node_modules", "exceljs"));
const X = require(path.join(ROOT, "lib", "sheetXlsx.js")), SF = require(path.join(ROOT, "lib", "sheetFiles.js")), AI = require(path.join(ROOT, "lib", "sheetAi.js"));
const C = require(path.join(ROOT, "ext", "sheetdock", "sheetcalc.js")), FMT = require(path.join(ROOT, "ext", "sheetdock", "sheetfmt.js"));
const CH = require(path.join(ROOT, "ext", "sheetdock", "sheetchart.js")), SD = require(path.join(ROOT, "ext", "sheetdock", "sheetdash.js")), CSV = require(path.join(ROOT, "ext", "sheetdock", "sheetio.js"));

(async () => {
  // ------------------------------------------------------------ .xlsx in
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet("Sales");
  ws.columns = [{ width: 14 }, { width: 12 }, { width: 16 }];
  ws.addRow(["Region", "Date", "Revenue"]);
  ws.getRow(1).font = { bold: true, color: { theme: 0 } }; ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { theme: 4, tint: -0.25 } };
  for (let i = 0; i < 5; i++) { const r = ws.addRow(["North", new Date(Date.UTC(2026, i, 15)), 1000 + i * 10]); r.getCell(3).numFmt = '"$"#,##0.00'; }
  ws.getCell("C7").value = { formula: "SUM(C2:C6)", result: 5100 }; ws.getCell("C8").value = { formula: "GCD(C2:C6)", result: 123 };
  ws.getCell("D2").value = { formula: "C2*2", result: 2000 }; ws.getCell("D3").value = { sharedFormula: "D2", result: 2020 };
  ws.mergeCells("A10:C10"); ws.getCell("A10").value = "Merged"; ws.getCell("A10").alignment = { horizontal: "centerContinuous", textRotation: 45 };
  ws.getCell("B12").border = { top: { style: "thick", color: { argb: "FFFF0000" } }, diagonal: { up: true, style: "dashed" } };
  ws.getCell("B13").fill = { type: "pattern", pattern: "darkGray", fgColor: { argb: "FF00FF00" } };
  ws.getCell("A14").value = "on yellow"; ws.getCell("A14").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  const d = await X.fromXlsx(Buffer.from(await wb.xlsx.writeBuffer())), S = d.sheets[0];
  check("fromXlsx: theme colours worked out (header fill = accent 1 darker 25%), bold white text", JSON.stringify(S.cells.A1.s) === JSON.stringify({ b: true, bg: "#335693", color: "#ffffff" }), S.cells.A1);
  check("…dates -> day serials shown day first, number formats kept, shared formulas translated, the file's results kept", S.cells.B2.v === "46037" && S.cells.B2.f === "d/mm/yyyy" && S.cells.C2.f === '"$"#,##0.00' && S.cells.D3.v === "=C3*2" && S.cells.C8.c === "123", [S.cells.B2, S.cells.D3, S.cells.C8]);
  check("…centre across selection + rotation, a thick red top + a diagonal, a 75% pattern, merges, widths, frozen rows", S.cells.A10.s.align === "centerSel" && S.cells.A10.s.rot === 45 && S.cells.B12.s.bd.t.s === "thick" && S.cells.B12.s.bd.t.c === "#ff0000" && S.cells.B12.s.bd.d1.s === "dashed" && S.cells.B13.s.pat.t === "gray75" && S.merges.includes("A10:C10") && S.cols[0] === 103 && S.freeze.r === 1, S.cells.B12);
  check("…black text on a light fill stays black (the grid is dark); on no fill it is the theme's ink", S.cells.A14.s.color === "#000000" && !(S.cells.A2.s && S.cells.A2.s.color));
  const B = new C.Book(d.sheets);
  check("Book: a formula our engine lacks (GCD - 2.825.0: SUMPRODUCT is ours now) shows the file's own result; SUM is worked out", B.value("Sales", "C8") === 123 && B.value("Sales", "C7") === 5100, [B.value("Sales", "C8"), B.value("Sales", "C7")]);
  // ------------------------------------------------------------ .xlsx out
  const out = await X.toXlsx(d, [{ C7: 5100 }]), wb2 = new ExcelJS.Workbook(); await wb2.xlsx.load(out); const o = wb2.getWorksheet("Sales");
  check("toXlsx: values, the formula + its result, number formats, fills, borders, merges, widths, frozen rows", o.getCell("C2").value === 1000 && o.getCell("C7").value.formula === "SUM(C2:C6)" && o.getCell("C7").value.result === 5100 && o.getCell("C2").numFmt === '"$"#,##0.00' && o.getCell("A1").fill.fgColor.argb === "FF335693" && o.getCell("B12").border.top.style === "thick" && o.model.merges.includes("A10:C10") && Math.round(o.getColumn(1).width) === 14 && o.views[0].ySplit === 1);
  const back = await X.fromXlsx(out);
  check("…and back in again: the same looks", JSON.stringify(back.sheets[0].cells.A10) === JSON.stringify(S.cells.A10) && JSON.stringify(back.sheets[0].cells.B13.s.pat) === JSON.stringify(S.cells.B13.s.pat));
  // ------------------------------------------------------------ CSV
  const rows = CSV.parse('a;b;c\n1;"x;y";"say ""hi"""\r\n2;;3\n');
  check("CSV: the separator found (;), quotes and doubled quotes, CRLF; written back with quotes where needed", JSON.stringify(rows) === JSON.stringify([["a", "b", "c"], ["1", "x;y", 'say "hi"'], ["2", "", "3"]]) && CSV.write([["a", "b,c", 'q"'], [1, null]]) === 'a,"b,c","q"""\r\n1,\r\n', rows);
  // ------------------------------------------------------------ charts
  const grid = { A1: "Region", B1: "Revenue", C1: "Cost", A2: "North", B2: 10, C2: 4, A3: "South", B3: 25, C3: 9 };
  const get = (c, r) => grid[C.addr(c, r)];
  const cd = CH.data(get, "A1:C3");
  check("chart data: headings = series names, the first column = categories", JSON.stringify(cd) === JSON.stringify({ cats: ["North", "South"], series: [{ name: "Revenue", values: [10, 25] }, { name: "Cost", values: [4, 9] }] }), cd);
  const ns = CH.niceScale(0, 87, 5);
  check("niceScale 0..87 -> 0..100 by 20; short(): 1.2K, 3.4M", ns.lo === 0 && ns.hi === 100 && ns.step === 20 && CH.short(1234) === "1234" && CH.short(12345) === "12.3K" && CH.short(3400000) === "3.4M", ns);
  const types = CH.TYPES.map((t) => CH.svg({ type: t, title: "T" }, cd, 400, 260));
  check("svg for column / bar / line / area / pie / doughnut / scatter (bars, lines, slices drawn; titles escaped)", types.every((x) => x.startsWith("<svg") && x.endsWith("</svg>")) && (types[0].match(/<rect /g) || []).length >= 4 && /<polyline/.test(types[2]) && (types[4].match(/<path /g) || []).length >= 2 && CH.svg({ type: "column", title: "<b>" }, cd, 300, 200).includes("&lt;b&gt;"));
  // ------------------------------------------------------------ the dashboard
  const regions = ["North", "South", "East", "West"], prods = ["Apples", "Pears", "Plums"], cells = { A1: { v: "Date" }, B1: { v: "Region" }, C1: { v: "Product" }, D1: { v: "Units" }, E1: { v: "Revenue" } };
  let tot = 0, west = 0;
  for (let i = 0; i < 60; i++) { const r = i + 2, dt = new Date(Date.UTC(2026, 0, 1 + i * 5)); cells["A" + r] = { v: `${dt.getUTCDate()}/${dt.getUTCMonth() + 1}/2026`, f: "d/mm/yyyy" }; cells["B" + r] = { v: regions[i % 4] }; cells["C" + r] = { v: prods[i % 3] }; cells["D" + r] = { v: String((i % 7) + 1) }; const rev = ((i % 7) + 1) * 12.5; cells["E" + r] = { v: String(rev), f: "$#,##0.00" }; tot += rev; if (i % 4 === 3) west += rev; }
  const sheets = [{ name: "Sales data", cells, cols: {}, rows: {}, merges: [], freeze: { r: 0, c: 0 } }];
  const Bk = () => new C.Book(sheets), gget = (si, c, r) => Bk().get(si, c, r), code = (si, c, r) => { const cl = sheets[si].cells[C.addr(c, r)]; return (cl && cl.f) || "General"; };
  const prof = SD.profile(sheets, gget, code);
  check("profile: the header row, 60 data rows, each column's kind (date, text with 4 / 3 values, whole numbers, money)", prof.sheets[0].rows === 60 && JSON.stringify(prof.sheets[0].cols.map((c) => c.type + (c.kind ? ":" + c.kind : c.distinct ? ":" + c.distinct : ""))) === JSON.stringify(["date", "text:4", "text:3", "number:integer", "number:money"]), prof.sheets[0].cols);
  const txt = AI.profileText(prof);
  check("the LLM is shown the shape (kinds, totals, common values) - not the rows", /"Revenue": money, total 2,925/.test(txt) && /"Region": text, 4 different values \(most common: North, South, East, West\)/.test(txt) && /dates from 1\/1\/2026 to 23\/10\/2026/.test(txt) && txt.split("\n").length === 6, txt);
  AI.setComplete(async (o) => ({ ok: true, text: "<think>hmm</think>Sure!\n```json\n" + JSON.stringify({ title: "Sales", sheet: "Sales data", kpis: [{ label: "Revenue", func: "SUM", column: "Revenue", format: "currency" }, { label: "Bad", func: "SUM", column: "Nope" }, { func: "SUM", column: "Region" }], breakdowns: [{ title: "By region", by: "Region", value: "Revenue", func: "SUM", chart: "bar" }, { by: "Units", value: "Revenue" }], trend: { date: "Date", value: "Revenue", func: "SUM", period: "month", chart: "area" }, formats: { Revenue: "currency", Nope: "date" }, theme: "green" }) + ",\n```" }));
  const got = await AI.dashboardPlan(prof, "revenue");
  const plan = SD.validate(got.plan, prof);
  check("dashboardPlan: the JSON found in a chatty answer; validate drops what is not there (a missing column, SUM of text, a number column as a breakdown)", plan.kpis.length === 1 && plan.kpis[0].column === "Revenue" && plan.breakdowns.length === 1 && plan.breakdowns[0].chart === "bar" && plan.trend.chart === "area" && JSON.stringify(plan.formats) === '{"Revenue":"currency"}' && plan.theme === "green", plan);
  AI.setComplete(async () => ({ ok: false, error: "no LLM running" }));
  let err = null; try { await AI.dashboardPlan(prof, ""); } catch (e) { err = e; }
  check("…the LLM not answering = an error with its reason (the page then builds from the data's shape)", err && err.status === 502 && /no LLM running/.test(err.message));
  const fb = SD.fallback(prof);
  check("fallback: rows + totals, money by region / product, a monthly trend", fb.kpis.map((k) => k.label).join() === "Rows,Total Units,Total Revenue" && fb.breakdowns.map((b) => b.by).join() === "Region,Product" && fb.trend.period === "month");
  const built = SD.build({ sheets, get: gget, uniqueName: (n) => n }, fb, prof), D = sheets[0], B2 = new C.Book(sheets);
  const val = (a) => { const p = C.parseAddr(a); return B2.get(0, p.c, p.r); }, show = (a) => FMT.render(val(a), (D.cells[a] || {}).f).text;
  check("build: a Dashboard sheet first; KPI tiles = live formulas (60 rows, $2,925.00)", built.index === 0 && D.name === "Dashboard" && D.cells.A5.v === "=COUNTA('Sales data'!$A$2:$A$61)" && val("A5") === 60 && show("E5") === "$2,925.00", [D.cells.A5, show("E5")]);
  const westRow = ["A9", "A10", "A11", "A12"].find((a) => val(a) === "West");
  check("…a breakdown table: SUMIFS per region (West correct), shares, a total = the whole", westRow && val("B" + westRow.slice(1)) === west && show("B13") === "$2,925.00" && Math.abs(val("C13") - 1) < 1e-9, [westRow, west]);
  const tr = D.charts[2], trd = CH.data((c, r) => B2.get(0, c, r), tr.range, (c, r) => show(C.addr(c, r)));
  check("…the trend: one row a month (Jan … Oct 2026) whose SUMIFS add up to the total; charts placed beside the tables", trd.cats.length === 10 && trd.cats[0] === "Jan 2026" && trd.series[0].values.reduce((a, b) => a + b, 0) === tot && D.charts.length === 3 && D.charts.every((c) => c.x > 300), trd.cats);
  const ds = sheets[1];
  check("…the data sheet as a table: header styled, a filter, frozen header, bands, widths; the build marks the sheet as a dashboard", ds.cells.A1.s.b && ds.filter.r === 0 && ds.filter.r2 === 60 && ds.freeze.r === 1 && ds.cells.A3.s.bg && ds.cols[1] >= 60 && D.dash === true);
  // ------------------------------------------------------------ files + wiring
  const kept = SF.clean({ sheets: [{ name: "D", dash: true, charts: [{ id: "c1", type: "pie", range: "a1:b5", x: 10, y: 20, w: 300, h: 200, colors: ["#fff", "red"] }, { range: "nope" }], cells: { A1: { v: "=SUMPRODUCT(A2:A3)", c: "42" }, A2: { v: "7", c: "x" } } }] }).sheets[0];
  check("sheetFiles.clean: charts kept (bad ones dropped, colours checked), a formula's cached result kept (only on formulas), the dashboard flag", kept.charts.length === 1 && kept.charts[0].range === "A1:B5" && JSON.stringify(kept.charts[0].colors) === '["#fff"]' && kept.cells.A1.c === "42" && !kept.cells.A2.c && kept.dash === true, kept);
  const EXT = JSON.parse(read("ext", "sheetdock", "ext.json")), RT = read("routes", "sheets.js"), PKG = JSON.parse(read("package.json"));
  check("ext.json: sheetfmt, sheetcalc, sheetchart, sheetdock, sheetfmtdlg, sheetio, sheetdash", /^sheetfmt\.js,sheetcalc\.js,sheetchart\.js,sheetdock\.js,sheetfmtdlg\.js,sheetio\.js,sheetdash\.js(,|$)/.test(EXT.scripts.join()))  /* 2.825.0: + sheetai after */;
  check("routes: /api/sheets/import, /export, /ai/dashboard; exceljs (MIT) a dependency; server.js untouched", /\/api\/sheets\/import/.test(RT) && /\/api\/sheets\/export/.test(RT) && /\/api\/sheets\/ai\/dashboard/.test(RT) && PKG.dependencies.exceljs && !/sheetXlsx|sheetAi/.test(read("misc", "server.js")));
  check("credits + NOTICE name exceljs", /exceljs/i.test(read("lib", "credits.json")) && /exceljs/i.test(read("misc", "NOTICE.md")));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: " + (e.stack || e)); console.log(`\nRESULT: ${pass} passed, ${fail + 1} failed`); process.exit(1); });
