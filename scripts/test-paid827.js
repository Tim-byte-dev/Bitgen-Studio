#!/usr/bin/env node
/* bitGen Studio — 2.827.0 units: ▦ 📌 PAID TO. Tim: "can we have it say rent paid to this date, rent days is calculated by
 * weekly/7". sheetcalc.js dayRate / paidTo / PAIDTO(); sheetconst.js paidStatus (ahead / behind + owing, the part toward the
 * next day), constOfRow (Category, else the Ref), plan() leaves "you enter it" constants alone; sheetFiles keeps `manual`. */
"use strict";
const path = require("path");
const ROOT = path.join(__dirname, "..");
const C = require(path.join(ROOT, "ext/sheetdock/sheetcalc.js")), K = require(path.join(ROOT, "ext/sheetdock/sheetconst.js")), SF = require(path.join(ROOT, "lib/sheetFiles.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const S = K.serial, iso = K.isoOf;
const rent = { name: "Rent", kind: "expense", rates: [{ amount: 540, every: "week", start: "2026-01-13" }, { amount: 580, every: "week", start: "2027-01-12" }] };

check("a day of rent = weekly / 7 ($77.14); fortnightly / 14, monthly x 12 / 365, yearly / 365", Math.abs(C.dayRate(rent, S("2026-02-01")) - 540 / 7) < 1e-9 && Math.abs(C.dayRate({ rates: [{ amount: 700, every: "fortnight", start: "2026-01-01" }] }, S("2026-02-01")) - 50) < 1e-9 && Math.abs(C.dayRate({ rates: [{ amount: 365, every: "month", start: "2026-01-01" }] }, S("2026-02-01")) - 12) < 1e-9 && Math.abs(C.dayRate({ rates: [{ amount: 3650, every: "year", start: "2026-01-01" }] }, S("2026-02-01")) - 10) < 1e-9);
check("…none before it starts, none after it ends; the new weekly rate from its start ($580 / 7)", C.dayRate(rent, S("2026-01-12")) === 0 && Math.abs(C.dayRate(rent, S("2027-01-12")) - 580 / 7) < 1e-9 && C.dayRate({ end: "2026-02-01", rates: [{ amount: 7, every: "week", start: "2026-01-01" }] }, S("2026-02-02")) === 0);
const p0 = C.paidTo(rent, 0), p1 = C.paidTo(rent, 540), p2 = C.paidTo(rent, 1000), p3 = C.paidTo(rent, 540 * 52 + 580);
check("paid to: nothing = the day before the start; $540 = one week (13/01 -> 19/01); $1,000 = 12 days (24/01) + $74.29 toward the next", iso(p0.to) === "2026-01-12" && iso(p1.to) === "2026-01-19" && p1.credit === 0 && iso(p2.to) === "2026-01-24" && p2.days === 12 && p2.credit === 74.29, [iso(p0.to), iso(p1.to), iso(p2.to), p2]);
check("…across a rate change: a year at 540 + one week at 580 = paid to 18/01/2027", iso(p3.to) === "2027-01-18", iso(p3.to));
check("…a constant that ends: paid to stops at its end however much was paid", iso(C.paidTo({ end: "2026-01-20", rates: [{ amount: 70, every: "week", start: "2026-01-01" }] }, 100000).to) === "2026-01-20");
const B = new C.Book([{ name: "S", cells: { Z1: { v: '=TEXT(PAIDTO("Rent",1000),"d/mm/yyyy")' }, Z2: { v: '=PAIDTO("Nope",1)' }, Z3: { v: '=PAIDTO("rent",540)' } } }]);
B.consts = [rent];
check("PAIDTO(\"Rent\", 1000) = 24/01/2026 in a formula (a date); an unknown name = #N/A", B.value(0, "Z1") === "24/01/2026" && B.value(0, "Z2").err === "#N/A" && iso(B.value(0, "Z3")) === "2026-01-19", [B.value(0, "Z1"), B.value(0, "Z2"), B.value(0, "Z3")]);
check("ƒ▾ lists PAIDTO", C.FUNCS.includes("PAIDTO"));

const st1 = K.paidStatus(rent, 1000, S("2026-01-27")), st2 = K.paidStatus(rent, 1080, S("2026-01-20")), st3 = K.paidStatus(rent, 0, S("2026-01-15")), st4 = K.paidStatus(rent, 540, S("2026-01-19"));
check("status: $1,000 on 27/01 = paid to 24/01, 3 days behind, $157.14 owing (3 days less the $74.29 already paid toward them)", st1.iso === "2026-01-24" && st1.behind === 3 && st1.owing === 157.14 && st1.credit === 74.29, st1);
check("…$1,080 on 20/01 = 6 days ahead; nothing paid on 15/01 = 3 days ($231.43) owing; paid to the day = 0 days ahead", st2.ahead === 6 && st3.behind === 3 && st3.owing === 231.43 && st4.ahead === 0 && st4.behind === undefined, [st2, st3, st4]);
check("constOfRow: the Category when it names a constant (any case), else the Ref's name, else none", K.constOfRow([rent], "RENT", "").name === "Rent" && K.constOfRow([rent], "Food", "📌 Rent · 2026-01-13").name === "Rent" && K.constOfRow([rent], "Food", "") === null);

const tenant = { name: "Tenant", kind: "income", manual: true, rates: [{ amount: 400, every: "week", start: "2026-02-02" }] };
const P = K.plan([rent, tenant], [{ r: 5, ref: "📌 Tenant · 2026-02-02", amount: 400 }], S("2026-02-20"));
check("plan: a \"you enter it\" constant (manual) gets no entries and its Refs are never stale; the others as before", P.add.every((a) => a.k.name === "Rent") && P.add.length === 6 && P.stale.length === 0, P);
const up = K.upsert([], { name: "Tenant", amount: 400, every: "week", start: "2026-02-02", kind: "income", manual: true });
check("upsert keeps manual; sheetFiles.clean keeps it", up.k.manual === true && SF.clean({ sheets: [{ name: "A", cells: {} }], constants: [tenant, Object.assign({}, rent, { manual: "yes" })] }).constants.map((k) => !!k.manual).join() === "true,false");
check("findLedger knows a Paid to heading", K.findLedger([{ name: "L", cells: { A1: { v: "Date" }, B1: { v: "Income" }, C1: { v: "Expense" }, D1: { v: "Paid to" } } }], (si, c, r) => new C.Book([{ name: "L", cells: { A1: { v: "Date" }, B1: { v: "Income" }, C1: { v: "Expense" }, D1: { v: "Paid to" } } }]).get(si, c, r)).cols.paidto === 3);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
