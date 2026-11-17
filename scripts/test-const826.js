#!/usr/bin/env node
/* bitGen Studio — 2.826.0 units: ▦ 📌 Constants. Tim: "add a button for constants in spreadsheet … rent - 540 - week 13/01/2026 -
 * show a list of the constants and use the newest date, so if rent was 540/wk for 1 year then changed to 580/wk it will
 * remember all the transactions for the year and enter the new amount from the next start date" + "if we say received it's
 * income if we say paid or payment it is an expense".
 *   ext/sheetdock/sheetconst.js: nth / occurrences (rates in turn, month ends, quarters, years, an end date, up to a day),
 *   rateNow, plan (add / change / stale), findLedger (Income + Expense, or Amount + Type; any sheet; the preferred one first),
 *   kindOfWords, upsert; sheetcalc.js =Rent / CONST(); lib/sheetFiles.js cleanConstants + the ledger kept; the wiring */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const K = require(path.join(ROOT, "ext/sheetdock/sheetconst.js")), C = require(path.join(ROOT, "ext/sheetdock/sheetcalc.js")), SF = require(path.join(ROOT, "lib/sheetFiles.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const S = K.serial;

const rent = { id: "k1", name: "Rent", kind: "expense", desc: "Rent payment", rates: [{ amount: 540, every: "week", start: "2026-01-13" }, { amount: 580, every: "week", start: "2027-01-12" }] };
const o = K.occurrences(rent, S("2027-02-01"));
check("Rent 540 / week from 13/01/2026, 580 from 12/01/2027: 52 weeks at 540, then 580 from the new start date", o.length === 55 && o[0].iso === "2026-01-13" && o[51].iso === "2027-01-05" && o[51].amount === 540 && o[52].iso === "2027-01-12" && o[52].amount === 580 && o.filter((x) => x.amount === 540).length === 52, [o.length, o[51], o[52]]);
check("…up to a day: nothing after it", K.occurrences(rent, S("2026-01-26")).map((x) => x.iso).join() === "2026-01-13,2026-01-20");
check("a monthly amount on the 31st: the month's last day when it is shorter (Feb 28, Apr 30)", K.occurrences({ rates: [{ amount: 300, every: "month", start: "2026-01-31" }] }, S("2026-05-31")).map((x) => x.iso).join() === "2026-01-31,2026-02-28,2026-03-31,2026-04-30,2026-05-31");
check("fortnight / quarter / year / day", K.occurrences({ rates: [{ amount: 1, every: "fortnight", start: "2026-01-02" }] }, S("2026-02-01")).length === 3 && K.occurrences({ rates: [{ amount: 1, every: "quarter", start: "2026-02-15" }] }, S("2027-01-01")).map((x) => x.iso).join() === "2026-02-15,2026-05-15,2026-08-15,2026-11-15" && K.occurrences({ rates: [{ amount: 1, every: "year", start: "2024-02-29" }] }, S("2026-12-31")).map((x) => x.iso).join() === "2024-02-29,2025-02-28,2026-02-28" && K.occurrences({ rates: [{ amount: 1, every: "day", start: "2026-01-30" }] }, S("2026-02-02")).length === 4);
check("an end date stops it", K.occurrences({ end: "2026-03-31", rates: [{ amount: 1, every: "month", start: "2026-01-01" }] }, S("2026-12-31")).length === 3);
check("a rate change of period too (weekly, then monthly)", K.occurrences({ rates: [{ amount: 100, every: "week", start: "2026-01-01" }, { amount: 450, every: "month", start: "2026-02-01" }] }, S("2026-03-15")).map((x) => x.iso + "=" + x.amount).join() === "2026-01-01=100,2026-01-08=100,2026-01-15=100,2026-01-22=100,2026-01-29=100,2026-02-01=450,2026-03-01=450");
check("rateNow: the newest rate started by the day", K.rateNow(rent, S("2026-12-31")).amount === 540 && K.rateNow(rent, S("2027-01-12")).amount === 580 && K.rateNow(rent, S("2025-01-01")) === null);

// the plan
const rows = [{ r: 1, ref: "📌 Rent · 2026-01-13", amount: 540 }, { r: 2, ref: "", amount: 120 }, { r: 3, ref: "📌 Rent · 2026-01-20", amount: 500 }, { r: 4, ref: "📌 Gym · 2026-01-01", amount: 20 }];
const P = K.plan([rent], rows, S("2026-02-03"));
check("plan: the dates not in the ledger are added (in date order), an entry with another amount is a change, one no constant makes is stale; hand-typed rows left alone", P.add.map((a) => a.o.iso).join() === "2026-01-27,2026-02-03" && P.add[0].ref === "📌 Rent · 2026-01-27" && P.change.length === 1 && P.change[0].r === 3 && P.change[0].from === 500 && P.change[0].to === 540 && P.stale.length === 1 && P.stale[0].ref === "📌 Gym · 2026-01-01", P);
check("refOf / parseRef", K.refOf("Car loan", "2026-02-01") === "📌 Car loan · 2026-02-01" && K.parseRef("📌 Car loan · 2026-02-01").name === "Car loan" && K.parseRef("Rent") === null);

// the ledger, found by its headings
const book = (sheets) => { const b = new C.Book(sheets); return (si, c, r) => b.get(si, c, r); };
const sh1 = { name: "Notes", cells: { A1: { v: "hello" } } };
const sh2 = { name: "Money", cells: { A2: { v: "Date" }, B2: { v: "Details" }, C2: { v: "Money in" }, D2: { v: "Money out" }, E2: { v: "Balance" }, A3: { v: "2026-01-01" }, D3: { v: "50" }, A5: { v: "2026-01-09" }, C5: { v: "70" } } };
const L = K.findLedger([sh1, sh2], book([sh1, sh2]));
check("findLedger: headings in any row of any sheet (Date, Details, Money in / out, Balance); the rows down to the last one with something", L && L.si === 1 && L.head === 1 && L.cols.date === 0 && L.cols.desc === 1 && L.cols.income === 2 && L.cols.expense === 3 && L.cols.balance === 4 && L.cols.ref == null && L.r0 === 2 && L.r1 === 4, L);
const sh3 = { name: "Book", cells: { A1: { v: "Date" }, B1: { v: "Description" }, C1: { v: "Type" }, D1: { v: "Amount" }, E1: { v: "Ref" } } };
const L3 = K.findLedger([sh2, sh3], book([sh2, sh3]), "Book");
check("findLedger: Amount + Type works too; the workbook's ledger sheet is looked at first", L3 && L3.si === 1 && L3.cols.amount === 3 && L3.cols.type === 2 && L3.cols.ref === 4 && L3.r1 === 0, L3);
check("findLedger: no Date + money headings = none", K.findLedger([sh1], book([sh1])) === null);

// words + the form
check("kindOfWords: received = income, paid / payment = expense (received wins: \"received a payment\")", K.kindOfWords("received a payment of 540") === "income" && K.kindOfWords("Paid 80 for power") === "expense" && K.kindOfWords("payment to the plumber") === "expense" && K.kindOfWords("hello") === null);
const list = [];
const a = K.upsert(list, { name: "Rent", amount: "540", every: "week", start: "2026-01-13", kind: "expense", desc: "Rent payment" });
const b = K.upsert(list, { name: "rent", amount: "580", every: "week", start: "2027-01-12" });
const c = K.upsert(list, { name: "Rent", amount: "585", every: "week", start: "2027-01-12" });
check("upsert: a new name = a new constant; the same name (any case) = a new amount from its date; the same date = that amount replaced", a.made && !b.made && !b.replaced && c.replaced && list.length === 1 && list[0].rates.map((r) => r.amount + "@" + r.start).join() === "540@2026-01-13,585@2027-01-12" && list[0].desc === "Rent payment", list);
const errs = [{ name: "", amount: 1, every: "week", start: "2026-01-01" }, { name: "x", amount: "abc", every: "week", start: "2026-01-01" }, { name: "x", amount: 1, every: "sometimes", start: "2026-01-01" }, { name: "x", amount: 1, every: "week", start: "" }].map((f) => { try { K.upsert([], f); return "ok"; } catch (e) { return e.message; } });
check("upsert: a name, a number, how often and a start date are needed (said)", errs.every((e) => e !== "ok"), errs);

// formulas read them
const B = new C.Book([{ name: "S", cells: { A1: { v: "2026-06-01" }, Z1: { v: "=Rent*52" }, Z2: { v: '=CONST("Rent",A1)' }, Z3: { v: '=CONST("rent",DATE(2027,2,1))' }, Z4: { v: "=Car_loan" }, Z5: { v: "=Nope" }, Z6: { v: '=CONST("Nope")' } } }]);
B.consts = [rent, { name: "Car loan", rates: [{ amount: 300, every: "month", start: "2026-02-01" }], end: "2026-10-01" }];
const val = (a) => { const v = B.value(0, a); return v && v.err ? v.err : v; };
const now = K.rateNow(rent).amount;
check("=Rent = today's amount; CONST(\"Rent\", a date) = the amount then; Car_loan = \"Car loan\" (0 after it ends); an unknown name = #NAME? / #N/A", val("Z1") === now * 52 && val("Z2") === 540 && val("Z3") === 580 && val("Z4") === 0 && val("Z5") === "#NAME?" && val("Z6") === "#N/A", ["Z1", "Z2", "Z3", "Z4", "Z5", "Z6"].map(val));
check("ƒ▾ lists CONST", C.FUNCS.includes("CONST"));

// kept in the .bgs
const d = SF.clean({ sheets: [{ name: "Ledger", cells: {} }], ledger: { sheet: "Ledger" }, constants: [{ name: "Rent", kind: "expense", desc: "Rent payment", rates: [{ amount: "580", every: "week", start: "2027-01-12" }, { amount: 540, every: "week", start: "2026-01-13" }, { amount: 1, start: "13/01/2026" }] }, { name: "RENT", rates: [{ amount: 1, every: "week", start: "2026-01-01" }] }, { name: "No rates" }, { name: "Wages", kind: "income", end: "nope", rates: [{ amount: 1000, every: "fortnight", start: "2026-01-02" }] }] });
check("sheetFiles.clean keeps the constants (rates sorted, a bad date / a second Rent / no rates dropped, kind, end checked) and the ledger sheet", d.ledger.sheet === "Ledger" && d.constants.length === 2 && d.constants[0].rates.map((r) => r.amount).join() === "540,580" && d.constants[0].desc === "Rent payment" && d.constants[1].kind === "income" && d.constants[1].end === undefined, d.constants);
check("…a workbook with none has no constants key", SF.clean({ sheets: [{ name: "A", cells: {} }] }).constants === undefined);

// the wiring
const ext = JSON.parse(read("ext/sheetdock/ext.json")), dock = read("ext/sheetdock/sheetdock.js"), html = read("ext/sheetdock/dock.html");
check("ext.json: sheetconst.js after sheetai.js", ext.scripts.indexOf("sheetconst.js") === ext.scripts.indexOf("sheetai.js") + 1, ext.scripts);
check("📌 Constants on the toolbar; Save / load / the draft carry W.constants + W.ledger; the book reads them; a renamed ledger sheet followed", /id="shConst"[^>]*>📌 Constants/.test(html) && /constants: W\.constants, ledger: W\.ledger/.test(dock) && /W\.constants = Array\.isArray\(d\.constants\)/.test(dock) && /W\.constants = Array\.isArray\(dr\.constants\)/.test(dock) && /St\.book\.consts = W\.constants/.test(dock) && /W\.ledger\.sheet === W\.sheets\[i\]\.name\) W\.ledger\.sheet = name/.test(dock));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
