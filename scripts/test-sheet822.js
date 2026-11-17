#!/usr/bin/env node
/* bitGen Studio — 2.822.0 units: ▦ the spreadsheet's formula engine (ext/sheetdock/sheetcalc.js - our own, no library),
 * the workbook files (lib/sheetFiles.js) and the wiring. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const C = require(path.join(ROOT, "ext", "sheetdock", "sheetcalc.js"));

check("addresses: A..Z, AA, the 16384th column XFD; parseAddr with $", C.colName(0) === "A" && C.colName(25) === "Z" && C.colName(26) === "AA" && C.colName(16383) === "XFD" && C.colIndex("XFD") === 16383 && JSON.stringify(C.parseAddr("$B$3")) === JSON.stringify({ c: 1, r: 2, ac: true, ar: true }));
const cells = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { v: String(v) }]));
const B = new C.Book([
  { name: "Sheet1", cells: cells({ A1: "Item", B1: "Qty", C1: "Price", A2: "Apples", B2: 3, C2: 1.5, A3: "Pears", B3: 5, C3: 2, A4: "Plums", B4: 2, C4: 4,
    D2: "=B2*C2", D3: "=B3*C3", D4: "=B4*C4", D5: "=SUM(D2:D4)", E1: "=-2^2", E2: "=2^3^2", E3: "=1+2*3-4/2", E4: "=(1+2)*3", E5: "=10%", E6: "=\"a\"&\"b\"&1", E7: "=1<2", E8: "=\"abc\"=\"ABC\"",
    F1: "=A9/0", F2: "=G1", G1: "=F2", F3: "=NOPE(1)", F4: "=\"x\"+1", F5: "=Data!A1*2", F6: "='My data'!B2", F7: "=Sheet9!A1", F8: "=VLOOKUP(\"zz\",A2:C4,2,FALSE)",
    H1: "=IF(B2>2,\"many\",\"few\")", H2: "=IFS(B3<3,\"a\",B3<6,\"b\")", H3: "=AND(B2>1,B3>1)", H4: "=OR(FALSE,B4>5)", H5: "=NOT(TRUE)", H6: "=IFERROR(1/0,\"none\")",
    I1: "=AVERAGE(B2:B4)", I2: "=MIN(B2:B4)", I3: "=MAX(C2:C4)", I4: "=COUNT(A1:C4)", I5: "=COUNTA(A1:C4)", I6: "=ROUND(2.456,2)", I7: "=ABS(-3)",
    J1: "=VLOOKUP(\"Pears\",A2:C4,3,FALSE)", J2: "=XLOOKUP(\"Plums\",A2:A4,B2:B4)", J3: "=INDEX(A2:C4,2,3)", J4: "=MATCH(\"Plums\",A2:A4,0)",
    J5: "=SUMIF(B2:B4,\">2\",C2:C4)", J6: "=SUMIFS(C2:C4,B2:B4,\">2\",A2:A4,\"P*\")", J7: "=COUNTIF(A2:A4,\"P*\")", J8: "=COUNTIFS(B2:B4,\">=2\",C2:C4,\"<4\")",
    K1: "=TEXT(1234.5,\"#,##0.00\")", K2: "=CONCAT(A2,\" x\",B2)", K3: "=LEFT(A2,3)&RIGHT(A3,2)&MID(A4,2,2)", K4: "=LEN(TRIM(\"  a  b \"))", K5: "=UPPER(A2)&LOWER(\"X\")",
    K6: "=YEAR(DATE(2026,11,17))*10000+MONTH(DATE(2026,11,17))*100+DAY(DATE(2026,11,17))", K7: "=TEXT(DATE(2026,11,17),\"dd/mm/yyyy\")", K8: "=SUM(B:B)" }) },
  { name: "Data", cells: cells({ A1: 21 }) }, { name: "My data", cells: cells({ B2: "hi" }) }]);
const v = (a) => B.value("Sheet1", a), err = (a) => (C.isErr(v(a)) ? v(a).err : null);
check("arithmetic + precedence: -2^2 = 4, 2^3^2 = 64, 1+2*3-4/2 = 5, (1+2)*3 = 9, 10% = 0.1", v("E1") === 4 && v("E2") === 64 && v("E3") === 5 && v("E4") === 9 && v("E5") === 0.1, [v("E1"), v("E2"), v("E3"), v("E4"), v("E5")]);
check("& joins, comparisons (text compares without case)", v("E6") === "ab1" && v("E7") === true && v("E8") === true);
check("a range: SUM(D2:D4) of formulas = 4.5 + 10 + 8", v("D5") === 22.5, v("D5"));
check("errors: #DIV/0!, #CYCLE! (a formula that needs itself), #NAME?, #VALUE!, #REF! (no such sheet), #N/A", err("F1") === "#DIV/0!" && err("F2") === "#CYCLE!" && err("F3") === "#NAME?" && err("F4") === "#VALUE!" && err("F7") === "#REF!" && err("F8") === "#N/A", ["F1", "F2", "F3", "F4", "F7", "F8"].map(err));
check("other sheets: Data!A1, 'My data'!B2", v("F5") === 42 && v("F6") === "hi");
check("IF / IFS / AND / OR / NOT / IFERROR", v("H1") === "many" && v("H2") === "b" && v("H3") === true && v("H4") === false && v("H5") === false && v("H6") === "none");
check("AVERAGE / MIN / MAX / COUNT / COUNTA / ROUND / ABS", Math.abs(v("I1") - 10 / 3) < 1e-12 && v("I2") === 2 && v("I3") === 4 && v("I4") === 6 && v("I5") === 12 && v("I6") === 2.46 && v("I7") === 3, ["I1", "I2", "I3", "I4", "I5", "I6"].map(v));
check("VLOOKUP / XLOOKUP / INDEX / MATCH", v("J1") === 2 && v("J2") === 2 && v("J3") === 2 && v("J4") === 3, ["J1", "J2", "J3", "J4"].map(v));
check("SUMIF / SUMIFS (wildcards) / COUNTIF / COUNTIFS", v("J5") === 3.5 && v("J6") === 2 && v("J7") === 2 && v("J8") === 2, ["J5", "J6", "J7", "J8"].map(v));
check("TEXT / CONCAT / LEFT RIGHT MID / LEN TRIM / UPPER LOWER", v("K1") === "1,234.50" && v("K2") === "Apples x3" && v("K3") === "Apprslu" && v("K4") === 3 && v("K5") === "APPLESx", ["K1", "K2", "K3", "K4", "K5"].map(v));
check("dates: DATE / YEAR / MONTH / DAY, TEXT(date, \"dd/mm/yyyy\"); whole columns (B:B)", v("K6") === 20261117 && v("K7") === "17/11/2026" && v("K8") === 10, [v("K6"), v("K7"), v("K8")]);
check("shiftFormula: relative references move, $ ones stay, off the sheet = #REF!", C.shiftFormula("=A1+$B$2+B$3+Data!C3*SUM(A1:B2)", 2, 1) === "=B3+$B$2+C$3+Data!D5*SUM(B3:C4)" && C.shiftFormula("=A1", -1, 0) === "=#REF!");
check("adjustRefs: rows inserted / deleted - references follow, ranges stretch / shrink, into the deleted = #REF!", C.adjustRefs("=A1+A5+SUM(A2:A9)+Data!A5", "Sheet1", "Sheet1", "r", 2, 1) === "=A1+A6+SUM(A2:A10)+Data!A5" && C.adjustRefs("=A3+SUM(A1:A9)", "Sheet1", "Sheet1", "r", 2, -1) === "=#REF!+SUM(A1:A8)" && C.adjustRefs("=C1", "Sheet1", "Sheet1", "c", 1, 1) === "=D1");
const pi = (t) => JSON.stringify(C.parseInput(t));
check("typed entries: 12% / $1,200.50 / 2026-11-17 / 17/11/2026 (day first) / 1,234 / text - since 2.823.0 the format suggested is a format code", pi("12%") === '{"value":0.12,"fmt":"0%"}' && pi("$1,200.50") === '{"value":1200.5,"fmt":"$#,##0.00"}' && pi("2026-11-17") === '{"value":46343,"fmt":"yyyy-mm-dd"}' && pi("17/11/2026") === '{"value":46343,"fmt":"d/mm/yyyy"}' && pi("1,234") === '{"value":1234,"fmt":"#,##0"}' && pi("hello") === '{"value":"hello"}', [pi("12%"), pi("$1,200.50"), pi("1,234")]);
check("formats: currency, percent, date, number with decimals", C.format(1234.5, "currency") === "$1,234.50" && C.format(0.125, "percent") === "12.50%" && C.format(46343, "date") === "2026-11-17" && C.format(1234.567, "number", 1) === "1,234.6" && C.format(-5, "currency", 0) === "-$5");

const SF = require(path.join(ROOT, "lib", "sheetFiles.js"));
const cl = SF.clean({ sheets: [{ name: "A/B*", cells: { A1: { v: 5 }, zz: { v: 1 }, B2: { v: "", s: { b: true } } }, freeze: { r: 1 } }, { name: "a/b*" }], active: 9 });
check("sheetFiles.clean: sheet names cleaned + made unique, bad addresses dropped, values as text, active kept in range", cl.sheets[0].name === "AB" && cl.sheets[1].name === "ab (2)" && cl.sheets[0].cells.A1.v === "5" && !cl.sheets[0].cells.zz && cl.sheets[0].cells.B2.s.b && cl.active === 1 && cl.sheets[0].freeze.r === 1, cl);
check("safeName: <name>.bgs in the folder", SF.safeName("../x/My book") === "My book.bgs" && SF.safeName("") === "Workbook.bgs");
const IX = read("routes", "index.js"), EXT = JSON.parse(read("ext", "sheetdock", "ext.json"));
check("routes/sheets.js mounted from routes/index.js (server.js untouched); the docker's scripts: the engine first", /require\("\.\/sheets"\)\.mount\(app\)/.test(IX) && !/sheets/.test(read("misc", "server.js")) && /^sheetfmt\.js,sheetcalc\.js,(sheetchart\.js,)?sheetdock\.js,sheetfmtdlg\.js(,|$)/.test(EXT.scripts.join()))  /* 2.823.0: + the format codes first, the Format Cells dialog last */;
check("the app's own keys stay out of the cells (P, S, L, digits)", /#sheetdock/.test(read("ext", "promptdock", "pfloat.js")) && /a\.closest\("#sheetdock[^"]*"\)/.test(read("static", "secfloat.js"))   /* 2.831.0: + #slidesdock, #slShow */);

const fl = SF.clean({ sheets: [{ name: "S", cells: {}, filter: { r: "2", r2: 9, c1: 0, c2: 3, cols: { 1: ["a", 5], x: ["no"], 2: "no" }, evil: "<script>" } }] }).sheets[0].filter;
check("sheetFiles.clean: a filter keeps only its block + the picked values per column (as text)", JSON.stringify(fl) === '{"r":2,"c1":0,"c2":3,"cols":{"1":["a","5"]},"r2":9}', fl);
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
