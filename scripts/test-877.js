#!/usr/bin/env node
/* bitGen Studio — 2.877.0 units: 📒 the books (lib/accounting.js) - money in cents, GST inside an amount (1/11), the Australian
 * financial year + BAS quarters, documents (receipt / bill / invoice) checked, the double entry they post (every entry balances),
 * payments, the general journal, ledger running balances, the trial balance, profit and loss, the balance sheet (A = L + E with
 * this year's and earlier years' earnings), the BAS worksheet on accrual and cash bases (part payments pro rata, capital purchases
 * in G10, GST-free in G3 / G11, not reportable left out, journal GST adjustments, whole dollars), aged lists, jobs, the summary,
 * storage (files kept, ids checked); routes/accounting.js mounted before the 100 KB json parser (and businessProfiles with it);
 * the docker's pure parts (ext/acctdock/acctdock.js).
 * Tim (verbatim): "I think one more docker for Accounting - allow user to upload receipts, invoices to pay, invoices paid to us,
 * invoice due to be paid, invoices due to be paid to us, get the total due , the company jobs etc and total due, gst etc.(use au
 * tax system ... with journals, ledger, balance sheet, bas statement, write invoice, quotes etc." */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message) && e.status === 400; } };
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII=";
const A = require("../lib/accounting");

/* ---- 1 money, GST, dates */
check("cents: numbers, '1,234.50', '$12', nonsense -> NaN; money() back", A.cents(12.345) === 1235 && A.cents("1,234.50") === 123450 && A.cents("$12") === 1200 && Number.isNaN(A.cents("12a")) && Number.isNaN(A.cents("")) && A.money(123450) === "1,234.50" && A.money(-5) === "-0.05");
check("GST inside an amount: 1/11 of $110 = $10; capital purchases too; GST-free / not reportable none", A.gstIn(11000, "GST") === 1000 && A.gstIn(11000, "CAP") === 1000 && A.gstIn(11000, "FRE") === 0 && A.gstIn(11000, "NT") === 0 && A.gstIn(1, "GST") === 0);
const fy = A.finYear("2026-11-19"), fy2 = A.finYear("2027-03-01"), q2 = A.quarter("2026-11-19"), q3 = A.quarter("2027-02-14");
check("the Australian financial year (1 July - 30 June) and BAS quarters", fy.from === "2026-07-01" && fy.to === "2027-06-30" && fy.label === "FY 2026-27" && fy2.from === "2026-07-01"
  && q2.from === "2026-10-01" && q2.to === "2026-12-31" && /^Q2 FY 2026-27/.test(q2.label) && q3.from === "2027-01-01" && q3.to === "2027-03-31" && /^Q3/.test(q3.label), { fy, q2, q3 });
const lq = A.period("lastquarter", "2026-11-19"), lfy = A.period("lastfy", "2026-11-19"), mo = A.period("month", "2027-02-10");
check("periods: last quarter, last financial year, a month (February's end), custom", lq.from === "2026-07-01" && lq.to === "2026-09-30" && lfy.from === "2025-07-01" && mo.to === "2027-02-28" && A.period("custom", "", "2026-01-01", "2026-01-31").to === "2026-01-31");
check("the chart: Australian small-business accounts, the system ones (AR 1200, AP 2100, GST Collected 2200, GST Paid 2210), banks",
  A.CHART.length >= 45 && A.blank().accounts.filter((a) => a.system).map((a) => a.code).join() === "1200,2100,2200,2210" && A.blank().accounts.filter((a) => a.bank).length === 4 && A.blank().settings.gstRate === 0.1);

/* ---- 2 documents checked */
const B = A.blank(); B.jobs.push({ code: "JOB-1", name: "Smith kitchen", status: "open" });
check("a document needs a kind, a date, lines with amounts on the right kind of account, a known job", throws(() => A.cleanDoc(B, { kind: "x" }), /receipt, a bill/) && throws(() => A.cleanDoc(B, { kind: "bill", date: "26/10/2026" }), /date/)
  && throws(() => A.cleanDoc(B, { kind: "bill", date: "2026-10-01", lines: [] }), /at least one line/) && throws(() => A.cleanDoc(B, { kind: "invoice", date: "2026-10-01", lines: [{ account: "6170", amount: 5 }] }), /income account/)
  && throws(() => A.cleanDoc(B, { kind: "bill", date: "2026-10-01", lines: [{ account: "1100", amount: 5 }] }), /expense, cost or asset/) && throws(() => A.cleanDoc(B, { kind: "bill", date: "2026-10-01", lines: [{ account: "6170", amount: 0 }] }), /over \$0\.00/)
  && throws(() => A.cleanDoc(B, { kind: "bill", date: "2026-10-01", job: "NOPE", lines: [{ account: "6170", amount: 5 }] }), /no job NOPE/) && throws(() => A.cleanDoc(B, { kind: "bill", date: "2026-10-05", due: "2026-10-01", lines: [{ account: "6170", amount: 5 }] }), /before/));
const d1 = A.cleanDoc(B, { kind: "bill", date: "2026-10-01", lines: [{ account: "6170", amount: "1,100" }, { account: "6110", amount: 10 }] });
check("a bill: 14 days to pay unless given; each line's tax from its account (Rent GST, Bank Fees GST-free); totals in cents", d1.due === "2026-10-15" && d1.lines[0].tax === "GST" && d1.lines[1].tax === "FRE" && d1.total === 111000 && d1.gst === 10000 && d1.net === 101000, d1);
const nr = Object.assign(A.blank(), { settings: Object.assign(A.blank().settings, { gstRegistered: false }) });
check("not GST registered: no GST in anything", A.cleanDoc(nr, { kind: "invoice", date: "2026-10-01", lines: [{ account: "4100", amount: 110 }] }).gst === 0);

/* ---- 3 a quarter's books */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "acc877-")); A.setRoot(tmp);
A.saveJob("t", { code: "job 1", name: "Smith kitchen", client: "J Smith" });
check("jobs: a code made upper case with dashes", A.load("t").jobs[0].code === "JOB-1");
const inv = A.saveDoc("t", { kind: "invoice", party: "J Smith", date: "2026-10-05", due: "2026-10-19", job: "JOB-1", lines: [{ desc: "Kitchen", account: "4200", amount: "11,000" }, { desc: "Fresh food hamper", account: "4100", amount: 100, tax: "FRE" }] });
const bill = A.saveDoc("t", { kind: "bill", party: "Timber Co", number: "T55", date: "2026-10-06", due: "2026-11-05", job: "JOB-1", lines: [{ desc: "Timber", account: "5100", amount: 2200 }] });
const rc = A.saveDoc("t", { kind: "receipt", party: "Officeworks", date: "2026-10-07", lines: [{ desc: "Laptop", account: "1700", amount: 1650 }, { desc: "Paper", account: "6160", amount: 55 }] }, PNG);
A.saveJournal("t", { date: "2026-10-01", memo: "Capital", lines: [{ account: "1100", dr: 10000 }, { account: "3100", cr: 10000 }] });
check("an invoice numbered INV-0001 by itself; a receipt kept with its picture (files/<id>.png) and paid at once", inv.number === "INV-0001" && rc.file === rc.id + ".png" && fs.existsSync(path.join(tmp, "t", "files", rc.file)) && rc.status === "paid" && rc.balance === 0 && inv.status === "due" || inv.status === "overdue");
check("a receipt's line on Computer Equipment takes Capital purchase (GST) by itself", rc.lines[0].tax === "CAP" && rc.lines[0].gst === 15000 && rc.gst === 15500);
check("a payment: more than is owed refused, before the document refused, through a bank account only", throws(() => A.savePayment("t", { doc: inv.id, date: "2026-10-20", amount: 20000 }), /more than is owed/)
  && throws(() => A.savePayment("t", { doc: inv.id, date: "2026-10-01", amount: 1 }), /before/) && throws(() => A.savePayment("t", { doc: inv.id, date: "2026-10-20", amount: 1, account: "4100" }), /bank, cash or card/)
  && throws(() => A.savePayment("t", { doc: rc.id, date: "2026-10-20", amount: 1 }), /bill or an invoice/));
A.savePayment("t", { doc: inv.id, date: "2026-10-20", amount: 5550 });
check("a journal entry must balance and have two lines", throws(() => A.saveJournal("t", { date: "2026-10-01", lines: [{ account: "1100", dr: 5 }, { account: "3100", cr: 4 }] }), /must be equal/) && throws(() => A.saveJournal("t", { date: "2026-10-01", lines: [{ account: "1100", dr: 5 }] }), /two lines/));
let Bk = A.load("t");
const P = A.postings(Bk), byJ = (j) => P.filter((p) => p.journal === j);
const bal = (rows) => rows.reduce((s, p) => s + p.dr - p.cr, 0);
check("the double entry: every journal balances (Dr = Cr) - Sales, Purchases, Cash Receipts, Cash Payments, General", ["SJ", "PJ", "CR", "CP", "GJ"].every((j) => byJ(j).length && bal(byJ(j)) === 0), ["SJ", "PJ", "CR", "CP", "GJ"].map((j) => [j, byJ(j).length, bal(byJ(j))]));
const sj = A.journal(Bk, "SJ", "2026-10-01", "2026-12-31");
check("the Sales Journal: Dr Accounts Receivable 11,100, Cr Services 10,000, Cr Sales 100 (GST-free), Cr GST Collected 1,000",
  sj.rows.length === 1 && sj.rows[0].lines.map((l) => `${l.account}:${l.dr}:${l.cr}`).join() === "1200:1110000:0,4200:0:1000000,4100:0:10000,2200:0:100000" && sj.dr === sj.cr, sj.rows[0].lines);
const L = A.ledger(Bk, "1100", "2026-10-02", "2026-12-31");
check("the bank's ledger: Balance b/d 10,000 (before the period), -1,705 receipt, +5,550 received = 13,845", L.opening === 1000000 && L.rows.map((r) => r.balance).join() === "829500,1384500" && L.closing === 1384500, L);
const tb = A.trialBalance(Bk, "2026-12-31");
check("the trial balance is in balance", tb.balanced && tb.dr === tb.cr && tb.rows.length >= 9, tb);
const pl = A.profitLoss(Bk, "2026-07-01", "2027-06-30");
check("profit and loss (without GST): income 10,100, cost of sales 2,000, gross 8,100, expenses 50, net 8,050", pl.totalIncome === 1010000 && pl.totalCos === 200000 && pl.gross === 810000 && pl.totalExpenses === 5000 && pl.net === 805000, pl);
const bs = A.balanceSheet(Bk, "2026-12-31");
check("the balance sheet balances: assets = liabilities + equity (capital + this year's earnings)", bs.balanced && bs.totalAssets === bs.totalLiabilities + bs.totalEquity && bs.equity.some((e) => /Current Year Earnings \(FY 2026-27\)/.test(e.name) && e.amount === 805000), bs);
const acc = A.bas(Bk, "2026-10-01", "2026-12-31", "accrual");
check("BAS accrual: G1 11,100 (incl. the GST-free 100 in G3), 1A 1,000, G10 1,650 (the laptop), G11 2,255, 1B 355 -> 645 payable",
  acc.G1 === 11100 && acc.G3 === 100 && acc["1A"] === 1000 && acc.G10 === 1650 && acc.G11 === 2255 && acc["1B"] === 355 && acc.net === 645 && /\$645 payable/.test(acc.verdict), acc);
const cash = A.bas(Bk, "2026-10-01", "2026-12-31", "cash");
check("BAS cash: half the invoice received = half its figures (G1 5,550, G3 50, 1A 500); the unpaid bill left out; the receipt in", cash.G1 === 5550 && cash.G3 === 50 && cash["1A"] === 500 && cash.G11 === 55 && cash.G10 === 1650 && cash["1B"] === 155 && cash.net === 345, cash);
check("BAS in whole dollars, cents dropped (an invoice of $100.99 -> G1 100)", A.bas(Object.assign(A.blank(), { docs: [A.cleanDoc(A.blank(), { kind: "invoice", date: "2026-10-02", lines: [{ account: "4100", amount: 100.99 }] })] }), "2026-10-01", "2026-12-31", "accrual").G1 === 100);
A.saveJournal("t", { date: "2026-11-01", memo: "GST adjustment", lines: [{ account: "2210", dr: 20 }, { account: "6900", cr: 20 }] });
Bk = A.load("t");
check("a GST adjustment in the general journal reaches 1B", A.bas(Bk, "2026-10-01", "2026-12-31", "accrual")["1B"] === 375 && A.bas(Bk, "2026-10-01", "2026-12-31", "accrual").adjustments["1B"] === 2000);
const ar = A.aged(Bk, "invoice", "2026-11-25"), ap = A.aged(Bk, "bill", "2026-11-25");
check("aged: the invoice 37 days overdue (31-60), 5,550 owed to us; the bill 20 days overdue (1-30), 2,200 we owe", ar.rows.length === 1 && ar.rows[0].bucket === "31-60" && ar.rows[0].late === 37 && ar.totals.all === 555000 && ap.rows[0].bucket === "1-30" && ap.totals.all === 220000, { ar, ap });
const jb = A.jobs(Bk, "2026-07-01", "2027-06-30")[0];
check("jobs: JOB-1 income 10,100, costs 2,000, profit 8,100, owed to us 5,550, we owe 2,200", jb.income === 1010000 && jb.costs === 200000 && jb.profit === 810000 && jb.owed === 555000 && jb.toPay === 220000, jb);
const sm = A.summary(Bk, "2026-11-25");
check("the summary: the bank 13,845, owed to us 5,550 (all overdue), we owe 2,200 (overdue), this quarter's GST on the books' basis (cash)", sm.banks[0].balance === 1384500 && sm.owedToUs === 555000 && sm.overdueToUs === 555000 && sm.owedByUs === 220000 && sm.gst.basis === "cash" && sm.overdue === 2, sm);
const v = A.view(Bk, "2026-11-25");
check("the page's view: each document with paid / balance / status, newest first", v.docs[0].date >= v.docs[v.docs.length - 1].date && v.docs.find((d) => d.id === inv.id).paid === 555000 && v.docs.find((d) => d.id === inv.id).status === "overdue");
check("report(): every report by name; an unknown one refused", ["summary", "journal", "ledger", "tb", "pl", "bs", "bas", "aged", "jobs"].every((k) => A.report(Bk, { kind: k, period: "all", at: "2026-12-31" })) && throws(() => A.report(Bk, { kind: "x" }), /which report/));

/* ---- 4 changes that would break the books are refused */
check("a job with entries cannot be deleted; a system account stays; an account with entries stays", throws(() => A.removeJob("t", "JOB-1"), /has entries/) && throws(() => A.removeAccount("t", "1200"), /system/) && throws(() => A.removeAccount("t", "6170"), /has entries/) || throws(() => A.removeAccount("t", "6160"), /has entries/));
check("an account added (code + type) and deleted when unused", A.saveAccount("t", { code: "6270", name: "Training", type: "expense", tax: "GST" }).code === "6270" && A.removeAccount("t", "6270") === true && throws(() => A.saveAccount("t", { code: "ab", type: "expense" }), /3 - 6 digits/));
check("a document's total under what was paid on it refused", throws(() => A.saveDoc("t", { id: inv.id, kind: "invoice", date: "2026-10-05", lines: [{ account: "4200", amount: 10 }] }), /more has been paid/));
check("deleting a document takes its payments and its file", A.removeDoc("t", rc.id) && !fs.existsSync(path.join(tmp, "t", "files", rc.file)) && A.removeDoc("t", inv.id) && A.load("t").payments.length === 0);
check("settings: cash / accrual, GST registered, the invoice prefix", A.saveSettings("t", { basis: "accrual", gstRegistered: false, invoicePrefix: "TA-" }).basis === "accrual" && A.load("t").settings.invoicePrefix === "TA-");
check("a business id with odd characters refused; a file name that is not ours never served", throws(() => A.load("../x"), /which business/) && A.filePath("t", "../books.json") === "" && throws(() => A.keepFile("t", "x", "data:text/html;base64,PGI+"), /picture/));

/* ---- 5 routes + the docker */
const RI = src("routes/index.js"), RA = src("routes/accounting.js");
const iJson = RI.indexOf("app.use(express.json());"), iAcc = RI.indexOf('require("./accounting").mount(app)'), iBiz = RI.indexOf('require("./businessProfiles").mount(app)');
check("routes: mounted from routes/index.js BEFORE the 100 KB json parser - the accounting and the business details (a logo over 100 KB was refused)", iAcc > 0 && iBiz > 0 && iAcc < iJson && iBiz < iJson && !/accounting/.test(src("misc/server.js")));
check("routes: the books, reports, documents (+ the file), payments, journal, jobs, accounts, settings", ["/api/accounts\"", "/api/accounts/report", "/api/accounts/doc", "/api/accounts/file/:name", "/api/accounts/payment", "/api/accounts/journal", "/api/accounts/job", "/api/accounts/account", "/api/accounts/settings"].every((u) => RA.includes(u)) && /limit: "40mb"/.test(RA));
check("the books are kept out of git (/accounting/)", /^\/accounting\/$/m.test(src(".gitignore")));
const D = require("../ext/acctdock/acctdock.js");
check("docker: dollars in the accountant's way - negatives in brackets, a dash for none", D.dollars(123450) === "1,234.50" && D.dollars(-500) === "(5.00)" && D.dollars(0, true) === "–" && D.dollars(0) === "0.00");
const docs = [{ kind: "invoice", balance: 5, status: "overdue" }, { kind: "invoice", balance: 0, status: "paid" }, { kind: "bill", balance: 3, status: "due" }, { kind: "receipt", balance: 0, status: "paid" }];
check("docker filters: due to be paid to us / by us, overdue, paid to us / by us, by kind", D.filterDocs(docs, "owedToUs").length === 1 && D.filterDocs(docs, "owedByUs").length === 1 && D.filterDocs(docs, "overdue").length === 1
  && D.filterDocs(docs, "paidToUs").length === 1 && D.filterDocs(docs, "paidByUs").length === 1 && D.filterDocs(docs, "receipt").length === 1 && D.filterDocs(docs, "all").length === 4);
check("docker: the tabs Summary … Accounts (2.882.0 + 🏦 Bank); on the app strip; its own extension", D.TABS.map((t) => t[1]).join("|") === "Summary|Documents|Journals|Ledger|Trial Balance|Profit & Loss|Balance Sheet|BAS|🏦 Bank|Jobs|Accounts"
  && /\["tX_acctdock", "📒", "Accounts"\]/.test(src("static/appstrip.js")) && JSON.parse(src("ext/acctdock/ext.json")).scripts.join() === "acctdock.js,acctbank.js,accttax.js,acctsettle.js");
const H = src("ext/acctdock/dock.html");
check("the old accounting look: a green columnar pad (ruled lines, red margin), index-card tabs, typewriter figures, double-ruled totals, rubber stamps",
  /repeating-linear-gradient/.test(H) && /#acPaper::before/.test(H) && /border-bottom: 3px double/.test(H) && /Courier/.test(H) && /\.acstamp/.test(H) && /font-variant: small-caps/.test(H));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
