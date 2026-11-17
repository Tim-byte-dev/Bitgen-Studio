#!/usr/bin/env node
/* bitGen Studio — 2.829.0 units. Tim: "do the image-editor additions and add the constants sheet to excel export".
 *   ext/imageeditdock/pcshadowtool.js geom / offset (a drag -> the Drop Shadow style's distance + angle, and back as pcdoc draws it);
 *   lib/sheetXlsx.js: the 📌 Constants sheet written in an .xlsx (a row per amount, From / To, Ledger) and read back into the
 *   Constants on import (a sheet of yours called Constants is kept as a sheet); the wiring (the tool in the Gradient group, its
 *   install, the WP layer's name / menu / Layers badge / thumbnail double-click, sheetio sends the constants). */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const T = require(path.join(ROOT, "ext/imageeditdock/pcshadowtool.js")), X = require(path.join(ROOT, "lib/sheetXlsx.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

(async () => {
  const g1 = T.geom(100, 100, 112, 109), o1 = T.offset(g1);
  check("a drag 12 right / 9 down = 15 px at 143° (Photoshop-style angle); offset() gives the drag back as pcdoc draws it", g1.distance === 15 && g1.angle === 143 && Math.abs(o1.dx - 12) < 0.3 && Math.abs(o1.dy - 9) < 0.3, [g1, o1]);
  const cases = [[10, 0], [0, 10], [-10, 0], [0, -10], [-7, -7]].map(([dx, dy]) => { const g = T.geom(0, 0, dx, dy), o = T.offset(g); return [dx, dy, g.angle, Math.round(o.dx), Math.round(o.dy)]; });
  check("every way round: right = 180°, down = 90°, left = 0°, up = 270°; offset() back to the drag", cases.every(([dx, dy, , ox, oy]) => ox === dx && oy === dy) && cases[0][2] === 180 && cases[1][2] === 90 && cases[2][2] === 0 && cases[3][2] === 270, cases);

  const doc = { sheets: [{ name: "Ledger", cells: { A1: { v: "Date" } } }, { name: "Constants", cells: { A1: { v: "my own notes" } } }], active: 0, ledger: { sheet: "Ledger" },
    constants: [{ name: "Rent", kind: "expense", desc: "Rent payment", rates: [{ amount: 540, every: "week", start: "2026-01-13" }, { amount: 580, every: "week", start: "2027-01-12" }] }, { name: "Tenant", kind: "income", manual: true, end: "2027-06-30", rates: [{ amount: 400, every: "week", start: "2026-02-02" }] }] };
  const buf = await X.toXlsx(doc, []);
  const ExcelJS = require(path.join(ROOT, "node_modules", "exceljs")), wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
  const ws = wb.getWorksheet("Constants (2)"), rows = []; ws.eachRow((r) => rows.push(r.values.slice(1).map((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v))));
  check("the .xlsx gets a Constants sheet (\"Constants (2)\" - yours keeps its name): a row per amount with From / To, income / expense, how often, entered by ⟳, the Ledger", rows[0].slice(0, 8).join("|") === X.CONST_HEAD.join("|") && JSON.stringify(rows[1].slice(0, 8)) === JSON.stringify(["Rent", "Expense", 540, "week", "2026-01-13", "2027-01-11", "Rent payment", "yes"]) && rows[2][2] === 580 && rows[2][5] == null && JSON.stringify(rows[3].slice(0, 8)) === JSON.stringify(["Tenant", "Income", 400, "week", "2026-02-02", "2027-06-30", "", "no"]) && rows[0][9] === "Ledger" && rows[0][10] === "Ledger", rows);
  check("…money and dates formatted ($, d/mm/yyyy), the heading row kept on screen", ws.getCell("C2").numFmt === '"$"#,##0.00' && ws.getCell("E2").numFmt === "d/mm/yyyy" && ws.views[0].state === "frozen");
  const back = await X.fromXlsx(buf);
  check("opened in bitGen again: the Constants come back (both rent amounts, the tenant's end + entered-by-you), the ledger; your own Constants sheet stays a sheet", back.sheets.map((s) => s.name).join() === "Ledger,Constants" && back.constants.length === 2 && back.constants[0].rates.map((r) => r.amount + "@" + r.start).join() === "540@2026-01-13,580@2027-01-12" && back.constants[0].desc === "Rent payment" && back.constants[1].manual === true && back.constants[1].end === "2027-06-30" && back.ledger.sheet === "Ledger", back);
  const plain = await X.toXlsx({ sheets: [{ name: "A", cells: {} }], active: 0 }, []), wb2 = new ExcelJS.Workbook(); await wb2.xlsx.load(plain);
  check("a workbook with no constants gets no Constants sheet", wb2.worksheets.length === 1);
  const SF = require(path.join(ROOT, "lib/sheetFiles.js"));
  check("the import route keeps them (sheetFiles.clean keeps constants + ledger)", SF.clean(back).constants.length === 2 && SF.clean(back).ledger.sheet === "Ledger");

  const ui = read("ext/imageeditdock/pcui.js"), ie = read("ext/imageeditdock/imageedit.js"), dt = read("ext/imageeditdock/pcdoctext.js"), ext = JSON.parse(read("ext/imageeditdock/ext.json")), io = read("ext/sheetdock/sheetio.js");
  check("the Drop Shadow tool: in the Gradient group (G) with an icon, installed after mail merge, in ext.json", /\["gradient", "Gradient Tool"\], \["dropshadow", "Drop Shadow Tool/.test(ui) && /dropshadow: '<rect/.test(ui) && /PCShadowTool\.install\(E\)/.test(ie) && ext.scripts.indexOf("pcshadowtool.js") === ext.scripts.indexOf("pcdocmerge.js") + 1);
  check("the WP layer: named \"WP layer\", Layer ▸ New ▸ 📄 WP Layer, ✎ Type in This WP Layer on the right-click menu, WP on its Layers row, its thumbnail double-clicked types in it", /makeLayer\("WP layer"/.test(dt) && /📄 WP Layer \(word processor\)/.test(dt) && /nw\.items\.splice\(nw\.items\.indexOf\("layer\.newgroup"\) \+ 1, 0, "layer\.newdocframe"\)/.test(dt) && /layerCtxItems \|\| \[\]\)\.concat\(\["layer\.docedit"\]\)/.test(dt) && /wp\.textContent = "WP"/.test(ui) && /Ly\.type === "doc" && E\.docText\) return E\.docText\.begin\(Ly\)/.test(ui));
  check("⤓ Export ▸ .xlsx sends the constants + the ledger", /constants: W\.constants, ledger: W\.ledger \}, results/.test(io));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: " + (e.stack || e)); console.log(`\nRESULT: ${pass} passed, ${fail + 1} failed`); process.exit(1); });
