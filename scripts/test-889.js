#!/usr/bin/env node
/* bitGen Studio — 2.889.0 units: 💵 pay the ATO and pay super in 📒 Accounts (lib/accountingSettle.js). The BAS lodged as one entry
 * (1A / 1B exact cents on the BAS's basis, W2, 5A into 1350, whole-dollar rounding into 6270, label 9 into 2330 ATO Integrated Client
 * Account), paid now / later / in part, a refund, never twice; the next BAS not counting it as a GST adjustment; super owed from the
 * pay runs, paid at most what is owed; the bank tab sees the payments; the routes + the docker's buttons.
 * Tim (2026-11-19, the parked next steps): "keep your next step suggestions saved, we will do them after this" - 1. 💵 Pay the ATO /
 * pay super. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message) && e.status === 400; } };
const A = require("../lib/accounting"), TX = require("../lib/accountingTax"), ST = require("../lib/accountingSettle"), BR = require("../lib/bankRec");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "acc889-")); A.setRoot(tmp);
const lines = (j) => j.lines.map((l) => `${l.account}:${l.dr}:${l.cr}`).join();

check("the chart gains 1350 PAYG Instalments Paid, 2330 ATO Integrated Client Account, 6270 BAS Rounding (old books get them on load)", ["1350", "2330", "6270"].every((c) => A.blank().accounts.some((a) => a.code === c)));
A.saveSettings("t", { basis: "cash" });
TX.saveTax("t", { withholding: true, instalments: "amount", instalmentAmount: "500" });
const inv = A.saveDoc("t", { kind: "invoice", party: "C", date: "2026-07-10", lines: [{ account: "4200", amount: 1100 }] });
A.savePayment("t", { doc: inv.id, date: "2026-08-05", amount: 1100, account: "1100" });
A.saveDoc("t", { kind: "invoice", party: "D", date: "2026-09-20", lines: [{ account: "4200", amount: 550 }] });   // not paid - cash basis leaves it
A.saveDoc("t", { kind: "receipt", party: "Office", date: "2026-08-12", lines: [{ account: "6160", amount: "330.55" }] });
TX.payRun("t", { employee: "Sam", date: "2026-09-05", gross: 2000, tax: 300 });
let B = A.load("t");
const plan = ST.atoPlan(B, "2026-07-01", "2026-09-30", "cash");
check("the plan (cash): Dr 2200 100.00 (1A), Cr 2210 30.05 (1B), Dr 2300 300 (W2), Dr 1350 500 (5A), Dr 6270 0.05 rounding, Cr 2330 870 (label 9 = 100 - 30 + 300 + 500)",
  lines({ lines: plan.lines }) === "2200:10000:0,2210:0:3005,2300:30000:0,1350:50000:0,6270:5:0,2330:0:87000" && plan.owed === 87000 && plan.exact === 86995 && plan.rounding === 5 && /\$870 payable/.test(plan.label), plan);
const r = ST.lodge("t", { from: "2026-07-01", to: "2026-09-30", basis: "cash", date: "2026-10-20", pay: { amount: "870", account: "1100", date: "2026-10-21" } });
B = A.load("t");
check("lodged + paid: two General Journal entries (settle bas / ato), the payment Dr 2330 Cr the bank", r.lodged.settle.kind === "bas" && r.lodged.settle.owed === 87000 && lines(r.paid) === "2330:87000:0,1100:0:87000" && r.paid.settle.kind === "ato" && B.journals.filter((j) => j.settle).length === 2);
check("after: 2330 owes nothing, 2210 / 2300 cleared, the unpaid September invoice's GST (50) still in 2200, 500 in 1350", ST.balance(B, "2330") === 0 && ST.balance(B, "2210") === 0 && ST.balance(B, "2300") === 0 && ST.balance(B, "2200") === 5000 && ST.balance(B, "1350") === 50000,
  ["2330", "2210", "2300", "2200", "1350"].map((c) => ST.balance(B, c)));
const q2 = A.bas(B, "2026-10-01", "2026-12-31", "accrual");
check("the next quarter's BAS does not count the lodging (dated in it) as a GST adjustment", q2.adjustments["1A"] === 0 && q2.adjustments["1B"] === 0 && q2["1A"] === 0, q2);
check("never twice; refused: a lodging date inside the period, a payment over what the BAS owes", throws(() => ST.lodge("t", { from: "2026-07-01", to: "2026-09-30" }), /already in the books/)
  && throws(() => ST.lodge("t", { from: "2026-10-01", to: "2026-12-31", date: "2026-11-01" }), /after its period ends|nothing to lodge/));
check("the bank tab sees the ATO payment (a book item of 870 on the 21st)", BR.bookItems(B, "1100").some((i) => i.date === "2026-10-21" && Math.abs(i.amount) === 87000), BR.bookItems(B, "1100").slice(-3));
// a later BAS paid in part, then the rest
A.saveDoc("t", { kind: "invoice", party: "E", date: "2026-10-05", lines: [{ account: "4200", amount: 2200 }] });
B = A.load("t");
const p2 = ST.atoPlan(B, "2026-10-01", "2026-12-31", "accrual");
check("accrual Q2: 1A 200 + 5A 500 (no pay runs) - the September invoice's 50 is not this quarter's", p2.owed === 70000 && p2.lines.some((l) => l.account === "2200" && l.dr === 20000), p2.lines);
check("refused: paying more than this BAS owes", throws(() => ST.lodge("t", { from: "2026-10-01", to: "2026-12-31", basis: "accrual", date: "2027-01-10", pay: { amount: 800, date: "2027-01-10" } }), /more than this BAS owes/));
ST.lodge("t", { from: "2026-10-01", to: "2026-12-31", basis: "accrual", date: "2027-01-10" });
const part = ST.atoPay("t", { date: "2027-01-28", amount: "300" });
B = A.load("t");
check("lodged now, paid later in part: 400 still owed to the ATO; more than that refused", ST.balance(B, "2330") === 40000 && part.settle.refund === false && throws(() => ST.atoPay("t", { date: "2027-02-01", amount: 500 }), /more than is owed to the ATO/));
ST.atoPay("t", { date: "2027-02-20", amount: 400 });
// a refund period: only purchases
A.saveDoc("t", { kind: "receipt", party: "Tools", date: "2027-02-10", lines: [{ account: "6250", amount: 2200 }] });
TX.saveTax("t", { instalments: "none" });
B = A.load("t");
const p3 = ST.atoPlan(B, "2027-01-01", "2027-03-31", "accrual");
const r3 = ST.lodge("t", { from: "2027-01-01", to: "2027-03-31", basis: "accrual", date: "2027-04-20", pay: { amount: 200, date: "2027-04-28" } });
check("a refund BAS: 2330 debited (the ATO owes you), the refund received = Dr the bank, Cr 2330; 2330 back to nothing", p3.owed === -20000 && p3.lines.some((l) => l.account === "2330" && l.dr === 20000) && r3.paid.settle.refund === true && lines(r3.paid) === "1100:20000:0,2330:0:20000" && ST.balance(A.load("t"), "2330") === 0, { p3, paid: r3.paid });
// super
TX.payRun("t", { employee: "Jo", date: "2027-04-02", gross: 1000, tax: 100 });
const sp = ST.superPlan(A.load("t"), "2027-04-28");
check("super owed: Sam's 240 + Jo's 120 from the pay runs, by person", sp.owed === 36000 && sp.people.map((x) => x.name + ":" + x.amount).join() === "Sam:24000,Jo:12000" && sp.since === "", sp);
check("refused: more than the super owed, no amount, no date", throws(() => ST.superPay("t", { date: "2027-04-28", amount: 400 }), /more than the super owed/) && throws(() => ST.superPay("t", { date: "2027-04-28" }), /amount/) && throws(() => ST.superPay("t", { amount: 1 }), /date/));
const sj = ST.superPay("t", { date: "2027-04-28", amount: 360, fund: "SuperClear", account: "1100" });
const sp2 = ST.superPlan(A.load("t"), "2027-04-30");
check("💵 super paid: Dr 2310 Cr the bank, the fund named; then nothing owed, paid last on the 28th, no pay runs since", lines(sj) === "2310:36000:0,1100:0:36000" && sj.settle.fund === "SuperClear" && /Super paid - SuperClear/.test(sj.memo) && sp2.owed === 0 && sp2.since === "2027-04-28" && sp2.people.length === 0, sp2);
// an edited entry keeps what it is
const ed = A.saveJournal("t", Object.assign({}, sj, { memo: "Super paid - SuperClear (Q4)", lines: sj.lines.map((l) => ({ account: l.account, dr: l.dr / 100, cr: l.cr / 100, memo: l.memo })) }));
check("an edited settle / pay run entry keeps its tag", ed.settle && ed.settle.kind === "super" && /Q4/.test(ed.memo));
// wiring
check("wiring: routes (plan / lodge / atopay / super), the docker's 💵 Pay the ATO… / 💵 Pay super… + 💵 Lodge + pay this BAS on the BAS tab, acctsettle.js loaded",
  /\/api\/accounts\/settle\/ato"/.test(src("routes/accounting.js")) && /\/api\/accounts\/settle\/atopay"/.test(src("routes/accounting.js")) && /\/api\/accounts\/settle\/super"/.test(src("routes/accounting.js"))
  && /id="acPayAto"/.test(src("ext/acctdock/dock.html")) && /id="acPaySuper"/.test(src("ext/acctdock/dock.html")) && /data-settlebas/.test(src("ext/acctdock/acctdock.js")) && /"acctsettle\.js"/.test(src("ext/acctdock/ext.json"))
  && /!j\.settle\) for \(const l of j\.lines\)/.test(src("lib/accounting.js")));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
