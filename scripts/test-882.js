#!/usr/bin/env node
/* bitGen Studio — 2.882.0 units: 🏦 bank statements in 📒 Accounts - lib/bankStatement.js reads CSV (with and without a header
 * row, debit / credit columns, day-first dates), OFX / QFX and QIF; lib/bankRec.js adds them to the books (a statement read twice
 * not doubled), matches them (exact + only = by itself), suggests, ✚ makes a payment / spend / sale / transfer from a line, and
 * reconciles against the statement's closing balance. The routes and the docker's Bank tab.
 * Tim (verbatim): "yes, please add the next steps" (... bank statement import + reconcile ...) */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message) && e.status === 400; } };
const A = require("../lib/accounting"), S = require("../lib/bankStatement"), R = require("../lib/bankRec");

// ---------- reading statements ----------
check("dates: day first (AU), ISO, OFX, words, 2-digit years, QIF quotes; nonsense = ''", S.date("05/07/2026") === "2026-07-05" && S.date("2026-07-05") === "2026-07-05" && S.date("20260705120000[+10:AEST]") === "2026-07-05"
  && S.date("5 Jul 2026") === "2026-07-05" && S.date("05-Jul-26") === "2026-07-05" && S.date("5/7/26") === "2026-07-05" && S.date("7/ 5'26", false) === "2026-07-05" && S.date("31/02/2026") === "" && S.date("hello") === "");
check("amounts: $1,234.50, -12.5, (40.00), 12.00 DR, +3, nonsense NaN", S.amount("$1,234.50") === 123450 && S.amount("-12.5") === -1250 && S.amount("(40.00)") === -4000 && S.amount("12.00 DR") === -1200 && S.amount("+3") === 300 && Number.isNaN(S.amount("abc")));
const cba = '05/07/2026,"-45.10","EFTPOS OFFICEWORKS 0123 SYDNEY AU","+1,954.90"\n06/07/2026,"+1100.00","TRANSFER FROM SMITH PTY LTD INV-0001","+3,054.90"\n07/07/2026,"-2.50","MONTHLY ACCOUNT FEE","+3,052.40"\n';
let r = S.parse(cba, { name: "CSVData.csv" });
check("CSV with no header (CommBank / ANZ): date, amount, description, balance found; closing balance = the last line's", r.format === "csv" && r.lines.length === 3 && r.lines[0].amount === -4510 && /OFFICEWORKS/.test(r.lines[0].desc) && r.closing && r.closing.balance === 305240 && r.closing.date === "2026-07-07", r);
const wbc = 'Bank Account,Date,Narrative,Debit Amount,Credit Amount,Balance,Categories,Serial\n032000123456,07/07/2026,"MONTHLY FEE",2.50,,3052.40,FEES,\n032000123456,06/07/2026,"DEPOSIT SMITH",,1100.00,3054.90,DEP,\n';
r = S.parse(wbc);
check("CSV with a header + Debit / Credit columns (Westpac), newest first turned round", r.header && r.lines.length === 2 && r.lines[0].date === "2026-07-06" && r.lines[0].amount === 110000 && r.lines[1].amount === -250 && r.closing.balance === 305240, r);
const nab = "Date,Amount,Account Number,,Transaction Type,Transaction Details,Balance,Category,Merchant Name\n05 Jul 26,-45.10,123,,EFTPOS,OFFICEWORKS SYDNEY,1954.90,Shopping,Officeworks\n";
r = S.parse(nab);
check("CSV with NAB's header (Transaction Details, 05 Jul 26)", r.lines.length === 1 && r.lines[0].date === "2026-07-05" && /OFFICEWORKS/.test(r.lines[0].desc), r);
check("CSV: the columns can be picked when they are not found", S.parse("a,b,c\n2026-07-05,x,-3\n", { map: { date: 0, amount: 2, desc: 1 } }).lines[0].amount === -300 && /pick them/.test(S.parse("a,b,c\nx,y,z\n").warnings[0]));
const ofx = `OFXHEADER:100\nDATA:OFXSGML\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><ACCTID>123456</BANKACCTFROM><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260705<TRNAMT>-45.10<FITID>A1<NAME>OFFICEWORKS<MEMO>EFTPOS
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260706120000[+10:AEST]<TRNAMT>1100.00<FITID>A2<NAME>SMITH PTY LTD
</BANKTRANLIST><LEDGERBAL><BALAMT>3052.40<DTASOF>20260707</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
r = S.parse(ofx, { name: "x.qfx" });
check("OFX (SGML, no closing tags): FITIDs, names + memos, the ledger balance", r.format === "ofx" && r.lines.length === 2 && r.lines[0].fitid === "A1" && r.lines[0].desc === "OFFICEWORKS · EFTPOS" && r.lines[1].amount === 110000 && r.closing.balance === 305240 && r.account === "123456", r);
r = S.parse("!Type:Bank\nD05/07/2026\nT-45.10\nPOFFICEWORKS\n^\nD06/07/2026\nT1,100.00\nPSMITH PTY LTD\nN12\n^\n");
check("QIF: D T P N ^", r.format === "qif" && r.lines.length === 2 && r.lines[1].amount === 110000 && r.lines[1].ref === "12", r);

// ---------- the books ----------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "acc882-")); A.setRoot(tmp);
const inv = A.saveDoc("t", { kind: "invoice", party: "Smith Pty Ltd", date: "2026-07-01", lines: [{ desc: "Work", account: "4200", amount: 1100 }] });
const bill = A.saveDoc("t", { kind: "bill", party: "Landlord", date: "2026-07-01", lines: [{ desc: "Rent", account: "6170", amount: 880 }] });
const rc = A.saveDoc("t", { kind: "receipt", party: "Officeworks", date: "2026-07-04", lines: [{ desc: "Paper", account: "6160", amount: 45.10 }] });
let res = R.importText("t", "1100", cba, { name: "CSVData.csv" });
check("import: 3 lines added; the $45.10 Officeworks receipt in the books (4 Jul) matched by itself", res.added === 3 && res.dupes === 0 && res.auto === 1 && res.closing.balance === 305240, res);
res = R.importText("t", "1100", cba, { name: "again.csv" });
check("...the same statement again: nothing added (3 already there)", res.added === 0 && res.dupes === 3, res);
check("...an overlapping statement adds only the new line; a real second line of the same kind on the same day is kept",
  R.importText("t", "1100", cba + '07/07/2026,"-2.50","MONTHLY ACCOUNT FEE","+3,049.90"\n', {}).added === 1);
let V = R.viewOf("t", "1100");
const pay = V.lines.find((l) => l.amount === 110000), fee = V.lines.filter((l) => l.amount === -250);
check("view: 4 lines, 1 matched, 3 unmatched; banks listed", V.lines.length === 4 && V.counts.matched === 1 && V.counts.unmatched === 3 && V.banks.some((b) => b.code === "2400"), V.counts);
check("the $1,100 in: invoice INV-0001 owing exactly that is suggested (Smith named)", pay.suggest[0] && pay.suggest[0].how === "payment" && pay.suggest[0].doc === inv.id, pay.suggest);
let l = R.createFor("t", pay.id, { as: "payment", doc: inv.id });
check("✚ payment: received on the invoice through the bank, matched; the invoice paid", l.match.startsWith("payment:") && A.view(A.load("t")).docs.find((d) => d.id === inv.id).status === "paid");
check("money in cannot pay a bill; a spend cannot be money in", throws(() => R.createFor("t", fee[0].id, { as: "payment", doc: inv.id }), /bill or refunds/) && throws(() => R.createFor("t", pay.id, { as: "spend", account: "6110" }), /already matched/));
l = R.createFor("t", fee[0].id, { as: "spend", account: "6110", tax: "FRE", party: "Bank" });
const B1 = A.load("t"), d1 = B1.docs.find((d) => "doc:" + d.id === l.match);
check("✚ spend: a paid receipt from the bank account (GST-free bank fee), matched", d1 && d1.kind === "receipt" && d1.paidFrom === "1100" && d1.total === 250 && d1.gst === 0 && d1.lines[0].account === "6110", d1);
V = R.viewOf("t", "1100");
const fee2 = V.lines.find((l) => l.state === "unmatched");
check("the second fee: the account used for the same words before is suggested", fee2 && fee2.suggest.some((s) => s.how === "spend" && s.account === "6110" && s.tax === "FRE"), fee2 && fee2.suggest);
check("match: amounts must agree, an entry matched once only, unmatch / ignore", throws(() => R.matchLine("t", fee2.id, "payment:" + A.load("t").payments[0].id), /amounts differ/)
  && throws(() => R.matchLine("t", fee2.id, l.match), /already matched/) && R.ignoreLine("t", fee2.id, true).ignore === true && R.ignoreLine("t", fee2.id, false).ignore === false);
let C = R.checkRec("t", "1100", "2026-07-07", "3049.90");
check("check before all is in the books: the unmatched fee is listed, not reconciled", C.unrecorded.length === 1 && !C.ok && throws(() => R.doReconcile("t", "1100", "2026-07-07", 3049.90), /not in the books yet/), C);
R.createFor("t", fee2.id, { as: "spend", account: "6110", tax: "FRE" });
// the opening balance: the statement started at $2,000.00 - in the books by a journal from Owner's Capital before the statement
A.saveJournal("t", { date: "2026-06-30", memo: "Opening balance", lines: [{ account: "1100", dr: 2000 }, { account: "3100", cr: 2000 }] });
// a cheque written in the books not yet on the statement
const chq = A.savePayment("t", { doc: bill.id, date: "2026-07-06", amount: 880, account: "1100", ref: "CHQ 12" });
C = R.checkRec("t", "1100", "2026-07-07", "3049.90");
check("check: books $2,169.90 less the unpresented cheque (-$880) = the statement's $3,049.90 - out by nothing", C.books === 216990 && C.unpresented.length === 1 && C.unpresented[0].key === "payment:" + chq.id && C.adjusted === 304990 && C.difference === 0 && C.ok, C);
check("a wrong closing balance says how much it is out", throws(() => R.doReconcile("t", "1100", "2026-07-07", "3050.00"), /out by \$0\.10/));
const rec = R.doReconcile("t", "1100", "2026-07-07", "3049.90");
V = R.viewOf("t", "1100");
check("reconciled: 4 lines locked, the reconciliation kept; a reconciled line cannot be unmatched; ↶ undo frees them", rec.rec.lines === 4 && V.counts.reconciled === 4 && V.last.date === "2026-07-07"
  && throws(() => R.unmatchLine("t", V.lines[0].id), /reconciled/) && R.undoReconcile("t", "1100").date === "2026-07-07" && R.viewOf("t", "1100").counts.reconciled === 0);
// a sale and a transfer
R.importText("t", "1100", "08/07/2026,330.00,CASH SALE MARKET\n09/07/2026,-500.00,TRANSFER TO SAVINGS\n", {});
V = R.viewOf("t", "1100");
const sale = V.lines.find((l) => l.amount === 33000), tr = V.lines.find((l) => l.amount === -50000);
const ls = R.createFor("t", sale.id, { as: "sale", account: "4100", tax: "GST", party: "Market" });
const B2 = A.load("t"), sp = B2.payments.find((p) => "payment:" + p.id === ls.match), sd = B2.docs.find((d) => d.id === sp.doc);
check("✚ sale: an invoice (numbered, GST $30) paid the same day through the bank - on the BAS", sd.kind === "invoice" && /^INV-0002$/.test(sd.number) && sd.gst === 3000 && A.bas(B2, "2026-07-01", "2026-09-30", "cash")["1A"] === 130, { sd, bas: A.bas(B2, "2026-07-01", "2026-09-30", "cash") });
const lt = R.createFor("t", tr.id, { as: "journal", account: "1120" });
check("✚ transfer: a journal Dr Savings Cr the bank, no GST; the bank account itself refused", lt.match.startsWith("journal:") && throws(() => R.createFor("t", R.viewOf("t", "1100").lines[0].id, { as: "journal", account: "1100" }), /already matched|another account/));
check("the books still balance", A.trialBalance(A.load("t"), "2026-12-31").balanced);
const victim = R.viewOf("t", "1100").lines.find((l) => l.amount === 33000);
A.removeDoc("t", A.load("t").payments.find((p) => "payment:" + p.id === victim.match).doc);
check("an entry deleted from the books leaves its line unmatched again", R.viewOf("t", "1100").lines.find((l) => l.id === victim.id).state === "unmatched");
check("delete a statement line; a card account (liability) works too", R.deleteLine("t", victim.id) === true && R.importText("t", "2400", "08/07/2026,-55.00,FUEL\n", {}).added === 1 && R.checkRec("t", "2400", "2026-07-08", "55.00").difference === 0);
check("bad account / no transactions refused", throws(() => R.importText("t", "6110", cba, {}), /pick the bank/) && throws(() => R.importText("t", "1100", "nothing here", {}), /no date and amount|no transactions/));
check("descKey drops card words + numbers", R.descKey("EFTPOS OFFICEWORKS 0123 SYDNEY AU") === "officeworks sydney" && R.descKey("MONTHLY ACCOUNT FEE") === "monthly account fee");

// ---------- the routes + the docker ----------
const rt = src("routes/accounting.js");
check("routes: /api/accounts/bank (+ import, line match / unmatch / ignore / create / delete, check, reconcile, unreconcile)", ["\"/api/accounts/bank\"", "/api/accounts/bank/import", "/bank/line/:id/match", "/bank/line/:id/unmatch", "/bank/line/:id/ignore", "/bank/line/:id/create", "app.delete(\"/api/accounts/bank/line/:id\"", "/api/accounts/bank/check", "/api/accounts/bank/reconcile", "/api/accounts/bank/unreconcile"].every((s) => rt.includes(s)) && /bank\/import", big/.test(rt));
const ui = src("ext/acctdock/acctdock.js") + src("ext/acctdock/acctbank.js"), html = src("ext/acctdock/dock.html");
check("the docker: a 🏦 Bank tab (view bank), import (file / paste), ✓ match, ✚ make, ⊘ ignore, ↶ unmatch, the reconcile box", /\["bank",\s*"🏦 Bank"\]/.test(ui) && ["data-bmatch", "data-bmake", "data-bign", "data-bun", "acBankFile", "acBankRec", "/api/accounts/bank/reconcile"].every((s) => ui.includes(s)) && /\.bank-/.test(html) && /"acctbank\.js"/.test(src("ext/acctdock/ext.json")));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
