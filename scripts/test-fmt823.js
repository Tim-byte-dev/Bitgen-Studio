#!/usr/bin/env node
/* bitGen Studio — 2.823.0 units: ▦ the spreadsheet's NUMBER FORMAT CODES (ext/sheetdock/sheetfmt.js - our own), typed
 * entries -> codes, Text cells, TEXT(), the saved looks cleaned (lib/sheetFiles.js cleanStyle) and the Format Cells
 * wiring. Tim: "continue , add format cells button, format the cells like excel". */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const F = require(path.join(ROOT, "ext", "sheetdock", "sheetfmt.js"));
const C = require(path.join(ROOT, "ext", "sheetdock", "sheetcalc.js"));
const t = (v, c) => F.render(v, c).text, col = (v, c) => F.render(v, c).color || null;

check("General: integers as they are, 0.333333333 (11 characters), big / tiny numbers in E notation", t(1500, "General") === "1500" && t(1 / 3, "General") === "0.333333333" && t(123456789012, "General") === "1.23457E+11" && t(0.1 + 0.2, "") === "0.3", [t(1 / 3, "General"), t(123456789012, "General")]);
check("digits: 0 pads, # only when there, ? = a space; thousands; decimals rounded", t(1234.567, "#,##0.00") === "1,234.57" && t(0, "#,##0") === "0" && t(0, "#,###") === "" && t(7, "000") === "007" && t(1.5, "0.0#") === "1.5" && t(1.5, "0.0?") === "1.5 " && t(12.5, ".00") === "12.50");
check("commas after the digits divide by 1000 each; % multiplies by 100", t(1234567, "#,##0,") === "1,235" && t(1234567, '0.0,,"M"') === "1.2M" && t(0.1234, "0.00%") === "12.34%" && t(0.5, "0%") === "50%");
check("sections: positive;negative;zero;text - the second gets the number without its minus, [Red] its colour", t(-1234.1, "#,##0.00_);[Red](#,##0.00)") === "(1,234.10)" && col(-1234.1, "#,##0.00_);[Red](#,##0.00)") === "#ff0000" && t(1234.1, "#,##0.00_);[Red](#,##0.00)") === "1,234.10 " && t(-3, "$#,##0.00") === "-$3.00" && t(0, '0;-0;"zero"') === "zero" && t("abc", '0;-0;0;"<"@">"') === "<abc>");
check("conditions: [>=1000] / [<0] pick the section (with its colour); [<=9999999] phone numbers", col(2000, "[Blue][>=1000]#,##0;[Red][<0]-#,##0;0") === "#0000ff" && t(-5, "[Blue][>=1000]#,##0;[Red][<0]-#,##0;0") === "-5" && t(5551234, "[<=9999999]###-####;(###) ###-####") === "555-1234" && t(2125551234, "[<=9999999]###-####;(###) ###-####") === "(212) 555-1234");
check("scientific: 0.00E+00, E-, engineering ##0.0E+0", t(123456, "0.00E+00") === "1.23E+05" && t(0.000123, "0.00E+00") === "1.23E-04" && t(12345, "##0.0E+0") === "12.3E+3" && t(0, "0.00E+00") === "0.00E+00");
check("fractions: # ?/? (best), # ??/16 (fixed), a whole number leaves the fraction blank", t(1.75, "# ?/?") === "1 3/4" && t(5.125, "# ??/16") === "5  2/16" && t(0.3333, "?/?") === "1/3" && t(2, "# ?/?") === "2    ", [t(1.75, "# ?/?"), t(5.125, "# ??/16")]);
check("dates: d/mm/yyyy, dddd, d mmmm yyyy, mmm-yy, mmmmm (the first letter)", t(46343, "d/mm/yyyy") === "17/11/2026" && t(46343, "dddd, d mmmm yyyy") === "Tuesday, 17 November 2026" && t(46343, "mmm-yy") === "Nov-26" && t(46343, "mmmmm") === "N" && t(46343, "yyyy-mm-dd") === "2026-11-17");
check("times: m after h = minutes, AM/PM, [h] elapsed, fractions of a second", t(46343.5, "h:mm AM/PM") === "12:00 PM" && t(0.8958333, "h:mm AM/PM") === "9:30 PM" && t(1.5, "[h]:mm:ss") === "36:00:00" && t(0.0105, "mm:ss.0") === "15:07.2" && t(0.75, "hh:mm") === "18:00");
check("Accounting: the sign at the left edge (a fill between), a dash for zero, text indented", JSON.stringify(F.render(1234.5, F.build("Accounting", { dp: 2, sym: "$" })).fill) === JSON.stringify({ left: " $", ch: " ", right: "1,234.50 " }) && F.render(0, F.build("Accounting", { dp: 2, sym: "$" })).fill.right === "-   " && t("abc", F.build("Accounting", { dp: 2, sym: "$" })) === " abc ");
check("literals: \"text\", \\x, a quoted currency word, @ = the text; Special keeps leading zeros", t(1500, '"A$"#,##0.00') === "A$1,500.00" && t(5, '0" kg"') === "5 kg" && t(5, "0\\%") === "5%" && t("abc", '"Total: "@') === "Total: abc" && t(802, "0000") === "0802" && t(12345678901, "00 000 000 000") === "12 345 678 901");
check("-0.00 is 0.00; a negative date shows ####; booleans / errors as they are", t(-0.001, "0.00") === "0.00" && /^#+$/.test(t(-1, "d/mm/yyyy")) && t(true, "0.00") === "TRUE" && t({ err: "#DIV/0!" }, "0.00") === "#DIV/0!");
check("build + detect go both ways (Number / Currency with each negative look, Accounting, Date, Custom)", F.detect(F.build("Currency", { dp: 2, sym: "$", neg: "redparen" })).cat === "Currency" && F.detect("$#,##0.00_);[Red]($#,##0.00)").opt.neg === "redparen" && F.detect("0.00%").cat === "Percentage" && F.detect("d/mm/yyyy").cat === "Date" && F.detect("0.0#").cat === "Custom" && F.detect("General").cat === "General" && F.detect(F.build("Number", { dp: 3, sep: true, neg: "red" })).opt.dp === 3);
check("decimals(): .00→ / .0← in every section, General from what it shows", F.decimals("#,##0.00", 1) === "#,##0.000" && F.decimals("#,##0.00", -1) === "#,##0.0" && F.decimals("0.0", -1) === "0" && F.decimals("0", 1) === "0.0" && F.decimals("$#,##0.00_);[Red]($#,##0.00)", 1) === "$#,##0.000_);[Red]($#,##0.000)" && F.decimals("0%", 1) === "0.0%" && F.decimals("General", 1, 1) === "0.00", [F.decimals("General", 1, 1)]);
check("2.822.0's names upgraded: number / currency / percent (with s.dp) / date / text", F.upgrade("number", 1) === "#,##0.0" && F.upgrade("currency") === "$#,##0.00" && F.upgrade("percent", 0) === "0%" && F.upgrade("date") === "yyyy-mm-dd" && F.upgrade("text") === "@" && F.upgrade("0.00") === "0.00");
check("the dialog's lists: 12 categories, 17 currency symbols (A$, ฿ …), dates, times, fractions, special numbers", F.CATS.length === 12 && F.CATS[3] === "Accounting" && F.SYMBOLS.some((s) => s.id === "A$") && F.SYMBOLS.some((s) => s.id === "฿") && F.DATES.includes("d/mm/yyyy") && F.TIMES.includes("[h]:mm:ss") && F.SPECIAL.some(([c]) => c === "00 000 000 000"));

// typed entries + the engine
const pi = (x) => C.parseInput(x);
check("typed: 9:30 / 9:30 pm / 21:15:00 / 25:30 = times with their format; 1 1/2 = 1.5 as a fraction; 1/2 alone stays text", pi("9:30").fmt === "h:mm" && Math.abs(pi("9:30 pm").value - 0.8958333) < 1e-6 && pi("9:30 pm").fmt === "h:mm AM/PM" && pi("21:15:00").fmt === "h:mm:ss" && pi("25:30").fmt === "[h]:mm" && pi("1 1/2").value === 1.5 && pi("1/2").value === "1/2");
const B = new C.Book([{ name: "S", cells: { A1: { v: "0012", f: "@" }, A2: { v: "=A1+1" }, A3: { v: "=1+1", f: "@" }, A4: { v: '=TEXT(46343,"dddd d mmm")' }, A5: { v: '=TEXT(0.25,"0.0%")' }, A6: { v: '=TEXT(-1234.5,"#,##0.00;(#,##0.00)")' } } }]);
check("a Text (@) cell keeps what was typed - 0012 and =1+1 stay text; TEXT() uses the same codes", B.value("S", "A1") === "0012" && B.value("S", "A2") === 13 && B.value("S", "A3") === "=1+1" && B.value("S", "A4") === "Tuesday 17 Nov" && B.value("S", "A5") === "25.0%" && B.value("S", "A6") === "(1,234.50)", [B.value("S", "A4"), B.value("S", "A6")]);
check("SheetCalc.format reads codes and 2.822.0's names", C.format(1234.5, "currency") === "$1,234.50" && C.format(1234.5, "$#,##0.0") === "$1,234.5" && C.format(46343, "d mmm yyyy") === "17 Nov 2026");

// the saved looks
const SF = require(path.join(ROOT, "lib", "sheetFiles.js"));
const st = SF.cleanStyle({ b: true, i: "yes", color: "red;background:url(x)", bg: "#fff", font: 'Arial";onclick=x', bd: { t: { s: "thick", c: "#f00" }, b: 1, l: { s: "bogus" }, d1: { s: "dashed", c: "url(x)" } }, pat: { t: "gray50", c: "javascript:" }, grad: { c1: "#fff", c2: "#000", d: "zz" }, align: "centerSel", valign: "middle", rot: 45, size: 11.3, indent: 3, onclick: "x", u: "dacc" });
check("cleanStyle: known keys only, colours #hex only, fonts letters / spaces, border / pattern / gradient enums", JSON.stringify(st) === JSON.stringify({ b: true, u: "dacc", align: "centerSel", bg: "#fff", indent: 3, rot: 45, size: 11.5, font: "Arialonclickx", bd: { t: { s: "thick", c: "#f00" }, b: 1, d1: { s: "dashed" } }, pat: { t: "gray50" }, grad: { c1: "#fff", c2: "#000", d: "c" } }), st);
const cl = SF.clean({ sheets: [{ name: "S", protect: true, cells: { A1: { v: "1", f: '#,##0.00_);[Red](#,##0.00)' + "x".repeat(300), s: { unlock: true, hide: true } } } }] }).sheets[0];
check("clean: a sheet's protect, a cell's unlock / hide, format codes up to 255 characters", cl.protect === true && cl.cells.A1.s.unlock === true && cl.cells.A1.s.hide === true && cl.cells.A1.f.length === 255);

// the wiring
const EXT = JSON.parse(read("ext", "sheetdock", "ext.json")), DOCK = read("ext", "sheetdock", "sheetdock.js"), DLG = read("ext", "sheetdock", "sheetfmtdlg.js"), HTML = read("ext", "sheetdock", "dock.html");
check("ext.json: the format codes first, the Format Cells dialog last", /^sheetfmt\.js,sheetcalc\.js,(sheetchart\.js,)?sheetdock\.js,sheetfmtdlg\.js(,|$)/.test(EXT.scripts.join()));  /* 2.824.0: + sheetchart before the docker, sheetio / sheetdash after the dialog */
check("▤ Format… on the toolbar, Ctrl+1 and the cells' right-click menu open the dialog; the Number Format dropdown has the categories", /id="shFmtCells"/.test(HTML) && /k === "1"\) \{ e\.preventDefault\(\); openFormat\(\)/.test(DOCK) && /data-a="format">▤ Format Cells…/.test(DOCK) && /<option value="Accounting">Accounting<\/option>/.test(HTML) && /value="__more">More number formats…/.test(HTML));
check("the dialog: Number / Alignment / Font / Border / Fill / Protection; only what changed is applied, one undo step", /\["number", "Number"\], \["align", "Alignment"\], \["font", "Font"\], \["border", "Border"\], \["fill", "Fill"\], \["prot", "Protection"\]/.test(DLG) && /if \(!T\.size\) \{ dlg\.close\(\); return; \}\s*I\.step\(\);/.test(DLG));
check("protection: locked cells of a protected sheet refuse edits, formats and structure changes; the tab menu protects / unprotects", /function guard\(range\)/.test(DOCK) && /if \(guard\(\{ r1: St\.act\.r/.test(DOCK) && /function shiftCells\(axis, at, n\) \{\s*if \(guardSheet\(\)\) return;/.test(DOCK) && /🔒 Protect sheet/.test(DOCK));
check("CSS safety: colours / fonts checked again where they become CSS; the pattern picture's address in single quotes", /const okColor = \(x\) => \(typeof x === "string" && \/\^#\[0-9a-f\]\{3,8\}\$\/i/.test(DOCK) && /return "url\('data:image\/svg\+xml,"/.test(DOCK));
check("server.js untouched", !/sheetfmt|cleanStyle/.test(read("misc", "server.js")));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
