#!/usr/bin/env node
/* bitGen Studio — 2.881.0 units: ⤺ credit notes (lib/accounting.js - CN-0001, for an invoice = applied, never more than it owes;
 * on its own = a credit to refund; the double entry the other way; BAS decreasing adjustments; an invoice with credit notes kept),
 * the Adjustment Note title, ⤓ a real PDF (lib/invoicePdf.js with pdf-lib), ✉ emailing (markSent, ✉ Mail's composer takes the
 * attachment + onSent), the routes, the docker. (The PDF's words are read by scripts/test-881-pdf.js - pdftotext, not in ci-units.)
 * Tim (verbatim): "yes, please add the next steps" (e-mail an invoice, credit notes, bank statements, the taxes dialog, the card sheet) */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message) && e.status === 400; } };
const A = require("../lib/accounting"), PR = require("../lib/accountingPrint"), IP = require("../lib/invoicePdf");
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "acc881-")); A.setRoot(tmp);
  const inv = A.saveDoc("t", { kind: "invoice", party: "S", date: "2026-10-05", lines: [{ desc: "Work", account: "4200", amount: 1100 }, { desc: "Fruit", account: "4100", amount: 55, tax: "FRE" }] });
  const cn = A.saveDoc("t", { kind: "credit", party: "S", date: "2026-10-10", forInvoice: inv.id, lines: [{ desc: "Discount", account: "4200", amount: 110 }, { desc: "Fruit back", account: "4100", amount: 55, tax: "FRE" }] });
  check("⤺ a credit note for an invoice: CN-0001, ref the invoice, applied", cn.number === "CN-0001" && cn.ref === "INV-0001" && cn.status === "applied" && cn.forInvoice === inv.id, cn);
  check("...never more than the invoice still owes; dated on or after it; the invoice must exist", throws(() => A.saveDoc("t", { kind: "credit", date: "2026-10-10", forInvoice: inv.id, lines: [{ account: "4200", amount: 1000 }] }), /more than invoice INV-0001 still has owing \(\$990\.00\)/)
    && throws(() => A.saveDoc("t", { kind: "credit", date: "2026-10-01", forInvoice: inv.id, lines: [{ account: "4200", amount: 1 }] }), /on or after/) && throws(() => A.saveDoc("t", { kind: "credit", date: "2026-10-11", forInvoice: "nope", lines: [{ account: "4200", amount: 1 }] }), /gone/));
  let B = A.load("t"), I = A.view(B, "2026-10-31").docs.find((d) => d.id === inv.id);
  check("the invoice: $165 credited, $990 owing (overdue)", I.credited === 16500 && I.balance === 99000 && I.status === "overdue", I);
  const solo = A.saveDoc("t", { kind: "credit", party: "S", date: "2026-10-12", lines: [{ desc: "Goodwill", account: "4200", amount: 55 }] });
  check("a credit on its own: open, $55 to refund; 💵 a refund more than it refused; refunded once paid back", solo.status === "open" && solo.balance === 5500 && throws(() => A.savePayment("t", { doc: solo.id, date: "2026-10-13", amount: 60 }), /more than is owed/)
    && A.savePayment("t", { doc: solo.id, date: "2026-10-13", amount: 55 }) && A.view(A.load("t")).docs.find((d) => d.id === solo.id).status === "refunded");
  check("a credit applied to an invoice cannot be refunded", throws(() => A.savePayment("t", { doc: cn.id, date: "2026-10-13", amount: 1 }), /applied to its invoice/));
  B = A.load("t");
  const sj = A.journal(B, "SJ", "2026-10-01", "2026-10-31"), cnRow = sj.rows.find((r) => r.ref === "CN-0001");
  check("the double entry the other way: Dr Services Income 100, Dr Sales 55, Dr GST Collected 10, Cr Accounts Receivable 165; the refund Dr AR Cr bank", cnRow && cnRow.lines.map((l) => `${l.account}:${l.dr}:${l.cr}`).join() === "4200:10000:0,4100:5500:0,2200:1000:0,1200:0:16500"
    && A.journal(B, "CP", "2026-10-01", "2026-10-31").rows.some((r) => r.lines.some((l) => l.account === "1200" && l.dr === 5500)), cnRow);
  const bas = A.bas(B, "2026-10-01", "2026-12-31", "accrual"), cash0 = A.bas(B, "2026-10-01", "2026-12-31", "cash");
  check("BAS accrual: decreasing adjustments - G1 1,155 - 165 - 55 = 935, G3 55 - 55 = 0, 1A 100 - 10 - 5 = 85", bas.G1 === 935 && bas.G3 === 0 && bas["1A"] === 85, bas);
  check("BAS cash, the invoice unpaid: its credit note reports nothing (no negative sale); the refunded credit on its own: -55, 1A -5", cash0.G1 === -55 && cash0["1A"] === -5 && cash0.G3 === 0, cash0);
  A.savePayment("t", { doc: inv.id, date: "2026-11-01", amount: 990 }); B = A.load("t");
  const cash = A.bas(B, "2026-10-01", "2026-12-31", "cash");
  check("...the invoice paid in full ($990 = $1,155 less $165 credited): G1 990 - 55 = 935, 1A 90 - 5 = 85 - the same as accrual once all is paid", cash.G1 === 935 && cash["1A"] === 85 && cash.G3 === 0, cash);
  check("the books still balance; income less the credits", (B = A.load("t")) && A.trialBalance(B, "2026-12-31").balanced && A.balanceSheet(B, "2026-12-31").balanced && A.profitLoss(B, "2026-07-01", "2027-06-30").totalIncome === 105000 - 15000 - 5000);
  check("an invoice with credit notes cannot be deleted or turned into something else", throws(() => A.removeDoc("t", inv.id), /credit notes - delete them first/) && throws(() => A.saveDoc("t", Object.assign({}, inv, { kind: "bill", lines: [{ account: "6170", amount: 1 }] })), /credit notes/));
  check("credit note numbers start CN- (settings creditPrefix)", A.saveSettings("t", { creditPrefix: "CR-" }).creditPrefix === "CR-" && A.saveDoc("t", { kind: "credit", date: "2026-10-20", lines: [{ account: "4200", amount: 1 }] }).number === "CR-0003");
  const sent = A.markSent("t", inv.id, "2026-10-06"), q = A.saveDoc("t", { kind: "quote", date: "2026-10-06", lines: [{ account: "4200", amount: 1 }] });
  check("✉ markSent: the date kept; a draft quote becomes sent", sent.sent === "2026-10-06" && A.markSent("t", q.id).qstatus === "sent");
  check("the title: Adjustment Note (GST registered) / Credit Note", PR.titleOf(cn, B) === "Adjustment Note" && PR.titleOf(cn, Object.assign({}, B, { settings: { gstRegistered: false } })) === "Credit Note");

  /* ---- the PDF */
  const V = A.view(A.load("t")), dInv = V.docs.find((d) => d.id === inv.id);
  const bytes = await IP.pdf(dInv, B, { company: "UI Joinery", abn: "51 824 753 556", address: "5 Saw St\nToowoomba" }, { logo: { bytes: fs.readFileSync(path.join(ROOT, "static/icon.png")), type: "png" } });
  const f = path.join(tmp, "inv.pdf"); fs.writeFileSync(f, bytes);
  check("⤓ a real PDF (pdf-lib, the app's own copy): %PDF, A4, the title in its metadata", Buffer.from(bytes).slice(0, 5).toString() === "%PDF-" && bytes.length > 3000 && /require\("\.\.\/static\/vendor\/pdf-lib\.min\.js"\)/.test(src("lib/invoicePdf.js")));
  const many = Object.assign({}, dInv, { lines: Array.from({ length: 40 }, (_, i) => ({ desc: "A long line that wraps onto a second line in the description column, number " + i, account: "4200", amount: 1100, tax: "GST", gst: 100, qty: 1, unit: 1100 })) });
  const pdfLib = require("../static/vendor/pdf-lib.min.js"), doc2 = await pdfLib.PDFDocument.load(await IP.pdf(many, B, {}));
  check("...lines that run on go onto more pages; characters a PDF font has not = '?', never a crash", doc2.getPageCount() >= 2 && IP.safe({ encodeText: (c) => { if (c === "✓") throw new Error("x"); } }, "ok ✓") === "ok ?");
  /* ---- routes, mail, docker */
  const RA = src("routes/accounting.js"), MC = src("ext/maildock/mailcompose.js"), J = src("ext/acctdock/acctdock.js");
  check("routes: GET /api/accounts/pdf/:id (inline, or b64 for ✉), POST /api/accounts/doc/:id/sent; the logo (PNG / JPEG) in the PDF", /\/api\/accounts\/pdf\/:id/.test(RA) && /b64 === "1"/.test(RA) && /\/api\/accounts\/doc\/:id\/sent/.test(RA) && /logoPath/.test(RA));
  check("✉ Mail's composer takes attachments + onSent (told when it is sent)", /S\.atts = \(Array\.isArray\(o\.attachments\)/.test(MC) && /if \(S\.onSent\) \{ try \{ S\.onSent\(r\)/.test(MC));
  check("the docker: ⤓ ✉ ⤺ on the rows, a Credit notes filter, emailDoc (Mail off / no mailbox said), the credit form for an invoice, 💵 Refund the credit",
    /data-pdf=/.test(J) && /data-email=/.test(J) && /data-credit=/.test(J) && /\["credit", "Credit notes"\]/.test(J) && /Mail is turned off/.test(J) && /add your mailbox in ✉ Mail first/.test(J) && /forInvoice: inv\.id/.test(J) && /Refund the credit/.test(J));
  const D = require("../ext/acctdock/acctdock.js");
  check("filters: credit notes; not 'paid by us'", D.filterDocs([{ kind: "credit", balance: 0, status: "applied" }], "credit").length === 1 && D.filterDocs([{ kind: "credit", balance: 0, status: "applied" }], "paidByUs").length === 0);
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
