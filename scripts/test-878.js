#!/usr/bin/env node
/* bitGen Studio — 2.878.0 units: ✍ invoices + quotes in the Accounts docker - the ABN checked the ATO's way (business details +
 * the customer's), quotes (Q-0001, valid until, posting nothing, no BAS, draft / sent / accepted / declined, expired, made an
 * invoice once, linked both ways), lines as quantity x unit price, the invoice settings (terms, quote days, how to pay, prefixes,
 * the business heading the page), what a tax invoice still lacks (invoiceIssues), the printed page (lib/accountingPrint.js:
 * "Tax Invoice" / "Invoice" / "Quote", seller + ABN, GST per line, GST-free named, "Total price includes GST", the buyer, paid
 * stamp, how to pay), the routes and the docker.
 * Tim (verbatim): "... with journals, ledger, balance sheet, bas statement, write invoice, quotes etc." + "next please" */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message) && e.status === 400; } };
const P = require("../lib/businessProfiles"), A = require("../lib/accounting"), PR = require("../lib/accountingPrint");

/* ---- 1 the ABN */
check("an ABN checked the ATO's way: 51 824 753 556 (the ATO's own example) good, spaced; a wrong check digit / 10 digits refused; none = none",
  P.abn("51824753556") === "51 824 753 556" && P.abn("51 824 753 556") === "51 824 753 556" && P.abn("") === "" && throws(() => P.abn("51824753557"), /not a valid ABN/) && throws(() => P.abn("5182475355"), /11 digits/));
const tmpB = fs.mkdtempSync(path.join(os.tmpdir(), "biz878-")); P.setRoot(tmpB);
const prof = P.save({ company: "Tiger Art", address: "1 Art St\nBrisbane QLD", phone: "0400 000 000", email: "hi@tiger.example", abn: "51824753556" });
check("the business details keep the ABN (and refuse a wrong one)", prof.abn === "51 824 753 556" && P.FIELDS.some((f) => f[0] === "abn") && throws(() => P.save({ company: "X", abn: "12345678901" }), /not a valid ABN/));
const Z = require("../ext/imageeditdock/pcbizinfo.js");
check("the Business details dialog has the ABN field (pcbzAbn) and sends it", Z.fromForm({ company: "X", abn: " 51 824 753 556 " }).abn === "51 824 753 556" && /pcbzAbn", "ABN \(for tax invoices\)"/.test(src("ext/imageeditdock/pcbizinfo.js")));

/* ---- 2 quotes + invoices */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "acc878-")); A.setRoot(tmp);
const q = A.saveDoc("t", { kind: "quote", party: "Acme Pty Ltd", partyAddress: "9 Rd\r\nCairns", partyAbn: "51 824 753 556", date: "2026-11-01",
  lines: [{ desc: "Design hours", account: "4200", qty: 12, unit: "110" }, { desc: "Fresh fruit", account: "4100", qty: 2, unit: 25, tax: "FRE" }] });
check("a quote: Q-0001, valid 30 days, quantity x unit price (12 x $110 = $1,320 + 2 x $25 GST-free), GST $120, the customer kept", q.number === "Q-0001" && q.due === "2026-12-01"
  && q.lines[0].amount === 132000 && q.lines[0].qty === 12 && q.lines[0].unit === 11000 && q.lines[1].gst === 0 && q.total === 137000 && q.gst === 12000 && q.partyAddress === "9 Rd\nCairns" && q.partyAbn === "51 824 753 556" && q.qstatus === "draft", q);
check("a customer's wrong ABN refused; a quantity of 0 refused", throws(() => A.saveDoc("t", { kind: "quote", date: "2026-11-01", partyAbn: "1", lines: [{ account: "4200", amount: 5 }] }), /customer's ABN is 11 digits/)
  && throws(() => A.saveDoc("t", { kind: "invoice", date: "2026-11-01", lines: [{ account: "4200", qty: 0, unit: 5 }] }), /quantity/));
let B = A.load("t");
check("a quote posts nothing - no journal, no ledger, not in the BAS, not owed to us; no payment against it", A.postings(B).length === 0 && A.bas(B, "2026-10-01", "2026-12-31", "accrual").G1 === 0
  && A.aged(B, "invoice", "2026-12-31").rows.length === 0 && throws(() => A.savePayment("t", { doc: q.id, date: "2026-11-02", amount: 1 }), /bill or an invoice/));
check("a quote's state: draft -> sent; expired after its date while draft / sent; a wrong state refused", A.quoteState("t", q.id, "sent").status === "sent" && A.docState(A.load("t"), A.load("t").docs[0], "2026-12-05").status === "expired" && throws(() => A.quoteState("t", q.id, "paid"), /draft, sent/));
const edited = A.saveDoc("t", Object.assign({}, A.load("t").docs[0], { notes: "Thanks", lines: q.lines.map((l) => Object.assign({}, l, { amount: l.amount / 100, unit: l.unit / 100 })) }));
check("changing a quote keeps its state and number", edited.qstatus === "sent" && edited.number === "Q-0001" && edited.notes === "Thanks", edited);
A.saveSettings("t", { terms: 7, payTo: "BSB 062-000  Acc 1234 5678", quotePrefix: "QT-", profile: prof.id });
const inv = A.quoteToInvoice("t", q.id, "2026-11-10");
B = A.load("t"); const q2 = B.docs.find((d) => d.id === q.id);
check("➜ a quote made an invoice: INV-0001 dated today, due after the terms (7 days), same customer + lines + total, ref = the quote, linked both ways", inv.number === "INV-0001" && inv.date === "2026-11-10" && inv.due === "2026-11-17"
  && inv.total === 137000 && inv.gst === 12000 && inv.lines[0].qty === 12 && inv.party === "Acme Pty Ltd" && inv.partyAbn === "51 824 753 556" && inv.ref === "Q-0001" && inv.fromQuote === q.id && q2.qstatus === "invoiced" && q2.invoice === inv.id, { inv, q2 });
check("...once only; an invoiced quote cannot be changed; the invoice posts (Sales Journal) and is in the BAS", throws(() => A.quoteToInvoice("t", q.id), /already invoice INV-0001/) && throws(() => A.saveDoc("t", Object.assign({}, q2, { lines: [{ account: "4200", amount: 1 }] })), /already an invoice/)
  && A.journal(B, "SJ", "2026-11-01", "2026-11-30").rows.length === 1 && A.bas(B, "2026-10-01", "2026-12-31", "accrual").G1 === 1370 && A.bas(B, "2026-10-01", "2026-12-31", "accrual").G3 === 50);
check("deleting the invoice puts the quote back to accepted", A.removeDoc("t", inv.id) && A.load("t").docs.find((d) => d.id === q.id).qstatus === "accepted");
const inv2 = A.quoteToInvoice("t", q.id, "2026-11-11");
check("the next quote / invoice numbers follow the prefixes set (QT-0002, INV-0002)", inv2.number === "INV-0002" && A.saveDoc("t", { kind: "quote", date: "2026-11-12", lines: [{ account: "4200", amount: 5 }] }).number === "QT-0002");
B = A.load("t");
check("the invoice settings kept: terms, quote days, how to pay, the business heading the page", B.settings.terms === 7 && B.settings.quoteDays === 30 && /BSB 062-000/.test(B.settings.payTo) && B.settings.profile === prof.id);

/* ---- 3 what a tax invoice still lacks */
const bigNoBuyer = Object.assign({}, inv2, { party: "", partyAbn: "" });
check("invoiceIssues: none for a complete one; your ABN / name missing; $1,000+ without the buyer's name or ABN; not GST registered = no tax invoice rules",
  A.invoiceIssues(B, inv2, prof).length === 0 && A.invoiceIssues(B, inv2, { company: "X" }).some((m) => /your ABN/.test(m)) && A.invoiceIssues(B, inv2, null).length === 2
  && A.invoiceIssues(B, bigNoBuyer, prof).some((m) => /\$1,000 or more must show the buyer/.test(m)) && A.invoiceIssues(B, Object.assign({}, bigNoBuyer, { total: 99999 }), prof).length === 0
  && A.invoiceIssues(Object.assign({}, B, { settings: Object.assign({}, B.settings, { gstRegistered: false }) }), bigNoBuyer, null).length === 0);

/* ---- 4 the printed page */
const V = A.view(B, "2026-11-20"), dInv = V.docs.find((d) => d.id === inv2.id);
const h = PR.printHtml(dInv, B, prof, { issues: [] });
check("the page: 'Tax Invoice', the seller's name, address, ABN 51 824 753 556, the number + Australian dates (dd/mm/yyyy), the buyer + their ABN",
  /<h1>Tax Invoice<\/h1>/.test(h) && /Tiger Art/.test(h) && /1 Art St<br>Brisbane QLD/.test(h) && /ABN 51 824 753 556/.test(h) && /INV-0002/.test(h) && /11\/11\/2026/.test(h) && /18\/11\/2026/.test(h) && /Acme Pty Ltd/.test(h) && /9 Rd<br>Cairns/.test(h));
check("...each line: quantity, unit price, its GST ($120.00) or GST-free, the amount; subtotal excl. GST $1,250.00, GST $120.00, total $1,370.00",
  /<td class="n">12<\/td><td class="n">\$110\.00<\/td><td class="n">\$120\.00<\/td><td class="n">\$1,320\.00<\/td>/.test(h) && />GST-free</.test(h) && /Subtotal excl\. GST<\/td><td class="n">\$1,250\.00/.test(h) && /Total incl\. GST<\/td><td class="n">\$1,370\.00/.test(h));
check("...a mixed invoice does not say 'Total price includes GST' (only when every line is taxable); how to pay with the invoice number as the reference; Please pay by",
  !/Total price includes GST/.test(h) && /BSB 062-000/.test(h) && /use <b>INV-0002<\/b> as the reference/.test(h) && /Please pay by 18\/11\/2026/.test(h));
const allTax = PR.printHtml(Object.assign({}, dInv, { lines: [dInv.lines[0]] }), B, prof, {});
check("...every line taxable: 'Total price includes GST'", /Total price includes GST/.test(allTax));
const paidH = PR.printHtml(Object.assign({}, dInv, { paid: dInv.total, balance: 0 }), B, prof, {});
check("...paid in full: a PAID stamp, Balance due $0.00, 'Thank you - paid in full'", /class="stamp">PAID/.test(paidH) && /Balance due<\/td><td class="n">\$0\.00/.test(paidH) && /paid in full/.test(paidH));
const qH = PR.printHtml(V.docs.find((d) => d.kind === "quote" && d.number === "QT-0002"), B, prof, {});
check("a quote prints as 'Quote' with Valid until, no how-to-pay", /<h1>Quote<\/h1>/.test(qH) && /Valid until/.test(qH) && !/How to pay/.test(qH));
const nr = PR.printHtml(dInv, Object.assign({}, B, { settings: Object.assign({}, B.settings, { gstRegistered: false }) }), prof, {});
check("not GST registered: 'Invoice' with no GST column", /<h1>Invoice<\/h1>/.test(nr) && !/<th class="n">GST<\/th>/.test(nr));
const warnH = PR.printHtml(dInv, B, null, { issues: ["your ABN is not in the business details - a tax invoice must show it"], auto: true });
check("what is missing shows above the page on screen only (hidden in print); ?auto=1 prints at once; 🖨 Print / Save as PDF", /class="warn">⚠ your ABN/.test(warnH) && /\.bar, \.warn \{ display: none; \}/.test(warnH) && /window\.print\(\),300\)/.test(warnH) && /Save as PDF/.test(warnH));
check("escaped: a customer called <b> stays text", /&lt;b&gt;/.test(PR.printHtml(Object.assign({}, dInv, { party: "<b>" }), B, prof, {})));

/* ---- 5 routes + docker */
const RA = src("routes/accounting.js");
check("routes: a quote's state, a quote made an invoice, the page (GET /api/accounts/print/:id) headed by the business details", /\/api\/accounts\/quote\/:id\/state/.test(RA) && /\/api\/accounts\/quote\/:id\/invoice/.test(RA) && /\/api\/accounts\/print\/:id/.test(RA) && /function printBusiness/.test(RA) && /invoiceIssues/.test(RA));
const D = require("../ext/acctdock/acctdock.js");
const docs = [{ kind: "quote", balance: 0, status: "draft" }, { kind: "receipt", balance: 0, status: "paid" }, { kind: "invoice", balance: 0, status: "paid" }];
check("docker: a Quotes filter; quotes are not 'paid by us'", D.filterDocs(docs, "quote").length === 1 && D.filterDocs(docs, "paidByUs").length === 1 && D.FILTERS.some((f) => f[0] === "quote"));
const J = src("ext/acctdock/acctdock.js"), H = src("ext/acctdock/dock.html");
check("docker: ＋ 📝 Quote, the customer's address / email / ABN, Qty + Unit price, 🖨 + ➜📤 on the rows, the $1,000 warning, the invoice settings",
  /id="acNewQuote"/.test(H) && /acfAbn/.test(J) && /data-k="qty"/.test(J) && /data-print=/.test(J) && /data-q2i=/.test(J) && /\$1,000 or more must show the buyer/.test(J) && /acPayTo/.test(J) && /acProfile/.test(J));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
