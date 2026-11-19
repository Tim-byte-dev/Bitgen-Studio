#!/usr/bin/env node
/* bitGen Studio — 2.883.0 units: 🧾 the tax settings (lib/accountingTax.js) and 👷 pay runs in 📒 Accounts - a pay run's journal
 * (gross, PAYG withheld, net from the bank, super), W1 / W2 / 4 and the PAYG instalment (T1 × T2 = T11, or T7) with 5A, 8A, 8B, 9 on
 * the BAS report, the CSV and the printed worksheet; the routes and the docker's buttons.
 * Tim (verbatim, 2.877.0): "use au tax system, we will add a dialog for the users taxes and costs later" + "yes, please add the next steps" */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message) && e.status === 400; } };
const A = require("../lib/accounting"), TX = require("../lib/accountingTax"), C = require("../lib/accountingCsv");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "acc883-")); A.setRoot(tmp);

check("defaults: sole trader, quarterly, no withholding, wages 6210, super 12 %, no instalments", JSON.stringify(TX.settings(A.load("t"))) === JSON.stringify({ structure: "sole", cycle: "quarterly", withholding: false, wages: ["6210"], superRate: 12, instalments: "none", instalmentAmount: 0, instalmentRate: 0 }));
let t = TX.saveTax("t", { structure: "company", withholding: true, instalments: "rate", instalmentRate: "4.5" });
check("saved: company, withholding, T2 4.5 %; kept in the books' settings", t.structure === "company" && t.withholding && t.instalments === "rate" && t.instalmentRate === 4.5 && A.load("t").settings.tax.instalmentRate === 4.5, t);
check("refused: a wages account that is not an expense, a super rate over 30, instalments by amount without one, by rate without one",
  throws(() => TX.saveTax("t", { wages: ["1100"] }), /not an expense/) && throws(() => TX.saveTax("t", { superRate: 40 }), /0 to 30/)
  && throws(() => TX.saveTax("t", { instalments: "amount", instalmentAmount: "" }), /T7/) && throws(() => TX.saveTax("t", { instalments: "rate", instalmentRate: 0 }), /T2/));
t = TX.saveTax("t", { instalments: "amount", instalmentAmount: "1,250.00" });
check("the T7 amount given in dollars, kept in cents; saving again without it keeps it", t.instalmentAmount === 125000 && TX.saveTax("t", { cycle: "monthly" }).instalmentAmount === 125000);
// a pay run
const j = TX.payRun("t", { employee: "Sam", date: "2026-10-09", gross: "1500", tax: "220", period: "week ending 9/10" });
check("👷 pay run: Dr Wages 1,500, Cr bank 1,280 net, Cr PAYG Withholding 220, Dr Super 180 (12 %), Cr Super Payable 180", j.lines.map((l) => `${l.account}:${l.dr}:${l.cr}`).join() === "6210:150000:0,1100:0:128000,2300:0:22000,6220:18000:0,2310:0:18000"
  && j.payrun.net === 128000 && j.payrun.super === 18000 && /Pay run - Sam \(week ending 9\/10\)/.test(j.memo), j);
check("super typed by hand kept; refused: no name, no gross, tax over gross, a non-bank 'from'", TX.payRun("t", { employee: "Jo", date: "2026-10-16", gross: 800, tax: 0, super: "50" }).payrun.super === 5000
  && throws(() => TX.payRun("t", { date: "2026-10-16", gross: 1 }), /who is paid/) && throws(() => TX.payRun("t", { employee: "x", date: "2026-10-16" }), /gross/)
  && throws(() => TX.payRun("t", { employee: "x", date: "2026-10-16", gross: 10, tax: 11 }), /more than the gross/) && throws(() => TX.payRun("t", { employee: "x", date: "2026-10-16", gross: 10, account: "6110" }), /bank account/));
A.saveDoc("t", { kind: "invoice", party: "C", date: "2026-10-01", lines: [{ account: "4200", amount: 11000 }] });
let B = A.load("t"), R = A.report(B, { kind: "bas", period: "custom", from: "2026-10-01", to: "2026-12-31", basis: "accrual" });
check("BAS report: W1 2,300, W2 220 -> 4; T7 1,250 -> 5A; 8A = 1A 1,000 + 220 + 1,250 = 2,470; 8B 0; 9 payable", R.payg.W1 === 2300 && R.payg.W2 === 220 && R.payg["4"] === 220 && R.payg.T7 === 1250 && R.payg["5A"] === 1250
  && R["1A"] === 1000 && R.payg["8A"] === 2470 && R.payg["8B"] === 0 && R.payg["9"] === 2470 && /\$2,470 payable/.test(R.payg.verdictAll) && R.payg.pays.length === 2, R.payg);
TX.saveTax("t", { instalments: "rate", instalmentRate: 4.5 });
R = A.report(A.load("t"), { kind: "bas", period: "custom", from: "2026-10-01", to: "2026-12-31", basis: "accrual" });
check("by rate: T1 = income without GST 10,000, T2 4.5 % -> T11 450 = 5A", R.payg.T1 === 10000 && R.payg.T11 === 450 && R.payg["5A"] === 450 && R.payg.T7 === 0, R.payg);
const rows = C.rowsFor("bas", R, A.load("t")).map((r) => r.join("|")).join("\n");
check("⤓ CSV has W1, W2, T1, T2, T11, 4, 5A, 8A, 8B, 9", ["|W1|2300", "|W2|220", "|T1|10000", "|T2|4.5", "|T11|450", "|4|220", "|5A|450", "|8A|1670", "|8B|0", "|9|1670"].every((s) => rows.includes(s)), rows);
const html = C.basHtml(R, A.load("t"), { company: "Acme", abn: "51 824 753 556" });
check("🖨 the worksheet: PAYG tax withheld + instalment sections, 8A / 8B / 9", /PAYG tax withheld/.test(html) && /PAYG income tax instalment/.test(html) && />8A</.test(html) && /\$1,670 payable to the ATO/.test(html));
TX.saveTax("t", { withholding: false, instalments: "none" });
const B2 = A.load("t"); B2.journals = []; A.save("t", B2);
R = A.report(A.load("t"), { kind: "bas", period: "custom", from: "2026-10-01", to: "2026-12-31" });
check("nothing set and no wages: the PAYG part stays out of the worksheet (paygShown false); a quarter's T7 counts once a quarter", R.payg.paygShown === false && !/PAYG tax withheld/.test(C.basHtml(R, A.load("t"), {}))
  && TX.extras(Object.assign(A.load("t"), { settings: Object.assign(A.load("t").settings, { tax: Object.assign(TX.settings(A.load("t")), { instalments: "amount", instalmentAmount: 100000 }) }) }), "2026-07-01", "2027-06-30").T7 === 4000);
check("the books balance after pay runs", (() => { TX.payRun("t", { employee: "Sam", date: "2026-11-06", gross: 1000, tax: 100 }); return A.trialBalance(A.load("t"), "2026-12-31").balanced; })());
const rt = src("routes/accounting.js");
check("routes: GET / POST /api/accounts/tax, POST /api/accounts/payrun", rt.includes('app.get("/api/accounts/tax"') && rt.includes('app.post("/api/accounts/tax"') && rt.includes('app.post("/api/accounts/payrun"'));
const ui = src("ext/acctdock/accttax.js"), dock = src("ext/acctdock/acctdock.js"), html2 = src("ext/acctdock/dock.html");
check("the docker: 🧾 Taxes… + ＋ 👷 Pay run buttons, accttax.js (H3AcctTax open / payRun), the BAS tab shows PAYG, no tax file number asked", /id="acTaxes"/.test(html2) && /id="acPayRun"/.test(html2)
  && /H3AcctTax = \{ open, payRun \}/.test(ui) && /b\.payg && b\.payg\.paygShown/.test(dock) && !/tax file number"|id="[^"]*tfn/i.test(ui) && /"accttax\.js"/.test(src("ext/acctdock/ext.json")));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
