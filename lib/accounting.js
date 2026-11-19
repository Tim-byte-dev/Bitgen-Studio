// bitGen Studio — lib/accounting.js (2.877.0): 📒 THE BOOKS behind the Accounts docker - double entry, Australian GST and BAS.
//
// Tim (verbatim): "I think one more docker for Accounting - allow user to upload receipts, invoices to pay, invoices paid to us,
// invoice due to be paid, invoices due to be paid to us, get the total due , the company jobs etc and total due, gst etc.(use au
// tax system, we will add a dialog for the users taxes and costs later. give the layout the old accounting style aesthetic, with
// journals, ledger, balance sheet, bas statement, write invoice, quotes etc."
//
// One set of books per business (the business details of 2.875.0 - lib/businessProfiles.js - or "main"), a JSON file for now
// (MariaDB later, like the business details): <install>/accounting/<biz>/books.json + files/<doc id>.<ext> (the receipts / bills
// as uploaded). Money is whole CENTS everywhere in here; the page shows dollars.
//
//   DOCUMENTS (the source of most entries)
//     receipt   a purchase already paid (the shoebox receipt)      Purchases -> Cash Payments journal   Dr expense + GST paid, Cr bank
//     bill      a supplier's invoice to pay (payable)                Purchases journal                    Dr expense + GST paid, Cr Accounts Payable
//     invoice   an invoice we sent (receivable)                      Sales journal                        Dr Accounts Receivable, Cr income + GST collected
//     payments  money paid on a bill (Cash Payments: Dr AP, Cr bank) / received on an invoice (Cash Receipts: Dr bank, Cr AR)
//     A line's amount INCLUDES GST; its tax code: GST (10 % in it), FRE (GST-free), CAP (a capital purchase with GST), NT (not
//     reportable - wages, drawings, loans).
//   GENERAL JOURNAL  any balanced entry typed in (Dr = Cr).
//   REPORTS  journals, ledger (running balance), trial balance, profit and loss, balance sheet, the BAS worksheet (G1, G2/G3,
//            G10, G11, 1A, 1B; cash or accrual), aged receivables / payables, jobs, the summary (owed to us, we owe, overdue, GST).
//   The Australian financial year: 1 July - 30 June; BAS quarters Jul-Sep, Oct-Dec, Jan-Mar, Apr-Jun.
//   PAYG withholding / instalments, wages and the user's own tax settings come with the taxes dialog (later).
"use strict";
const fs = require("fs");
const path = require("path");

/* ============================== the chart of accounts (Australian small business) ============================== */
// [code, name, type, default tax code, flags]   types: asset liability equity income cos (cost of sales) expense
const CHART = [
  ["1100", "Business Bank Account", "asset", "NT", "bank"], ["1110", "Cash on Hand", "asset", "NT", "bank"],
  ["1120", "Savings Account", "asset", "NT", "bank"], ["1200", "Accounts Receivable", "asset", "NT", "system"],
  ["1300", "Prepayments", "asset", "NT"], ["1400", "Stock on Hand", "asset", "NT"],
  ["1500", "Plant and Equipment", "asset", "CAP"], ["1510", "Less Accumulated Depreciation", "asset", "NT"],
  ["1600", "Motor Vehicles", "asset", "CAP"], ["1700", "Computer Equipment", "asset", "CAP"],
  ["2100", "Accounts Payable", "liability", "NT", "system"], ["2200", "GST Collected", "liability", "NT", "system"],
  ["2210", "GST Paid", "liability", "NT", "system"], ["2300", "PAYG Withholding Payable", "liability", "NT"],
  ["2310", "Superannuation Payable", "liability", "NT"], ["2400", "Business Credit Card", "liability", "NT", "bank"],
  ["2500", "Loans", "liability", "NT"],
  ["3100", "Owner's Capital", "equity", "NT"], ["3200", "Owner's Drawings", "equity", "NT"], ["3300", "Retained Earnings", "equity", "NT"],
  ["4100", "Sales", "income", "GST"], ["4200", "Services Income", "income", "GST"], ["4300", "Other Income", "income", "GST"],
  ["4400", "Interest Income", "income", "FRE"],
  ["5100", "Purchases and Materials", "cos", "GST"], ["5200", "Subcontractors", "cos", "GST"], ["5300", "Freight In", "cos", "GST"],
  ["6100", "Advertising and Marketing", "expense", "GST"], ["6110", "Bank Fees", "expense", "FRE"],
  ["6120", "Computer and Software", "expense", "GST"], ["6130", "Electricity and Gas", "expense", "GST"],
  ["6140", "Insurance", "expense", "GST"], ["6150", "Motor Vehicle Expenses", "expense", "GST"],
  ["6160", "Office Supplies and Postage", "expense", "GST"], ["6170", "Rent", "expense", "GST"],
  ["6180", "Repairs and Maintenance", "expense", "GST"], ["6190", "Telephone and Internet", "expense", "GST"],
  ["6200", "Travel", "expense", "GST"], ["6210", "Wages and Salaries", "expense", "NT"], ["6220", "Superannuation", "expense", "NT"],
  ["6230", "Accounting and Legal", "expense", "GST"], ["6240", "Subscriptions", "expense", "GST"],
  ["6250", "Tools and Small Equipment", "expense", "GST"], ["6260", "Depreciation", "expense", "NT"],
  ["6900", "General Expenses", "expense", "GST"]];
const SYS = { bank: "1100", ar: "1200", ap: "2100", gstOut: "2200", gstIn: "2210", retained: "3300" };
const TYPES = ["asset", "liability", "equity", "income", "cos", "expense"];
const TAX = { GST: "GST 10 %", FRE: "GST-free", CAP: "Capital purchase (GST)", NT: "Not reportable" };
const KINDS = { receipt: "Receipt (paid)", bill: "Bill to pay", invoice: "Invoice we sent", quote: "Quote", credit: "Credit note" };
// 2.881.0: a credit note (an adjustment note when GST registered) takes back all or part of a sale: Dr income + GST Collected, Cr
// Accounts Receivable; for an invoice = applied to it (its balance falls), on its own = a credit the customer has (💵 refund it)
// 2.878.0: a quote is written like an invoice but posts NOTHING (no journal, no GST, no BAS) until it is made an invoice
const QUOTE_STATES = ["draft", "sent", "accepted", "declined", "invoiced"];
const JOURNALS = { SJ: "Sales Journal", PJ: "Purchases Journal", CR: "Cash Receipts Journal", CP: "Cash Payments Journal", GJ: "General Journal" };
const CREDIT_SIDE = new Set(["liability", "equity", "income"]);    // their balance shows credit-positive

/* ============================== money, dates ============================== */
/** dollars (number or "1,234.50" / "$12") -> whole cents; nonsense -> NaN */
function cents(v) {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 100) : NaN;
  const s = String(v == null ? "" : v).replace(/[$,\s]/g, "");
  if (!/^-?\d*\.?\d*$/.test(s) || !/\d/.test(s)) return NaN;
  return Math.round(parseFloat(s) * 100);
}
/** cents -> "1,234.50" (negative "-1,234.50") */
function money(c) {
  const n = Math.round(Number(c) || 0), neg = n < 0, a = Math.abs(n);
  return (neg ? "-" : "") + String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + String(a % 100).padStart(2, "0");
}
/** the GST inside an amount that includes it (10 % -> 1/11), whole cents; FRE / NT none */
function gstIn(amountC, tax, rate) {
  if (tax !== "GST" && tax !== "CAP") return 0;
  const r = rate == null ? 0.1 : rate;
  return Math.round(amountC * r / (1 + r));
}
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || "")) && !isNaN(Date.parse(d + "T00:00:00Z"));
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
/** the Australian financial year a date is in: {from: "YYYY-07-01", to: "YYYY+1-06-30", label: "FY 2026-27"} */
function finYear(d) {
  const t = isDate(d) ? d : today(), y = +t.slice(0, 4), start = +t.slice(5, 7) >= 7 ? y : y - 1;
  return { from: `${start}-07-01`, to: `${start + 1}-06-30`, label: `FY ${start}-${String(start + 1).slice(2)}` };
}
/** the BAS quarter a date is in: {from, to, label: "Q2 FY 2026-27 (Oct-Dec 2026)"} */
function quarter(d) {
  const t = isDate(d) ? d : today(), y = +t.slice(0, 4), m = +t.slice(5, 7), q0 = Math.floor((m - 1) / 3) * 3 + 1;
  const end = new Date(Date.UTC(y, q0 + 2, 0)).toISOString().slice(0, 10), fy = finYear(t);
  const qn = { 7: 1, 10: 2, 1: 3, 4: 4 }[q0], MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return { from: `${y}-${String(q0).padStart(2, "0")}-01`, to: end, label: `Q${qn} ${fy.label} (${MON[q0 - 1]}-${MON[q0 + 1]} ${y})` };
}
/** a named period -> {from, to, label}: quarter, lastquarter, fy, lastfy, month, all; or {from, to} as given */
function period(name, at, from, to) {
  const t = isDate(at) ? at : today();
  if (name === "custom" && isDate(from) && isDate(to)) return { from, to, label: `${from} - ${to}` };
  if (name === "lastquarter") return quarter(addDays(quarter(t).from, -1));
  if (name === "fy") return finYear(t);
  if (name === "lastfy") return finYear(addDays(finYear(t).from, -1));
  if (name === "month") { const f = t.slice(0, 8) + "01", e = new Date(Date.UTC(+t.slice(0, 4), +t.slice(5, 7), 0)).toISOString().slice(0, 10); return { from: f, to: e, label: f.slice(0, 7) }; }
  if (name === "all") return { from: "1900-01-01", to: t, label: "All dates to " + t };
  return quarter(t);
}

/* ============================== the books ============================== */
const clip = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b-\u001f]/g, "").trim().slice(0, n);
const newId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
/** an empty set of books with the chart */
function blank() {
  return { version: 1, settings: { basis: "cash", gstRegistered: true, gstRate: 0.1, currency: "AUD", invoicePrefix: "INV-", quotePrefix: "Q-", creditPrefix: "CN-", terms: 14, quoteDays: 30, payTo: "" },
    accounts: CHART.map(([code, name, type, tax, flag]) => ({ code, name, type, tax, bank: flag === "bank", system: flag === "system" })),
    docs: [], payments: [], journals: [], jobs: [], counters: { invoice: 0, quote: 0, credit: 0 } };
}
const accountOf = (B, code) => B.accounts.find((a) => a.code === String(code));
function bad(msg) { return Object.assign(new Error(msg), { status: 400 }); }

/** a document as kept: checked + totals worked out (throws a 400 with a plain reason) */
function cleanDoc(B, d0) {
  const d = d0 || {};
  const kind = KINDS[d.kind] ? d.kind : null;
  if (!kind) throw bad("pick what it is: a receipt, a bill to pay, an invoice we sent or a quote");
  if (!isDate(d.date)) throw bad("give the date (YYYY-MM-DD)");
  const sale = kind === "invoice" || kind === "quote" || kind === "credit";
  const due = kind === "receipt" || kind === "credit" ? d.date : isDate(d.due) ? d.due : addDays(d.date, kind === "quote" ? +B.settings.quoteDays || 30 : +B.settings.terms || 14);
  if (due < d.date) throw bad("the due date is before the document's date");
  const rate = B.settings.gstRegistered ? B.settings.gstRate : 0;
  const lines = (Array.isArray(d.lines) ? d.lines : []).map((l) => {
    // 2.878.0: an invoice / quote line can be quantity x unit price (both GST inclusive) - the amount is worked out from them
    const qty = l.qty === "" || l.qty == null ? null : Number(l.qty), unit = l.unit === "" || l.unit == null ? null : cents(l.unit);
    if (qty != null && (!Number.isFinite(qty) || qty <= 0)) throw bad("a quantity is a number over 0");
    if (unit != null && !Number.isFinite(unit)) throw bad("a unit price is an amount");
    const amount = qty != null && unit != null ? Math.round(qty * unit) : cents(l.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw bad("each line needs an amount over $0.00");
    const acc = accountOf(B, l.account); if (!acc) throw bad(`no account ${l.account}`);
    const ok = sale ? acc.type === "income" : ["expense", "cos", "asset"].includes(acc.type) && !acc.system && !acc.bank;
    if (!ok) throw bad(`${acc.code} ${acc.name} is not ${sale ? "an income account" : "an expense, cost or asset account"}`);
    const tax = TAX[l.tax] ? l.tax : acc.tax || "GST";
    if (tax === "CAP" && sale) throw bad("capital purchase is for purchases");
    const gst = gstIn(amount, tax, rate);
    return Object.assign({ desc: clip(l.desc, 200), account: acc.code, amount, tax, gst }, qty != null && unit != null ? { qty, unit } : {});
  });
  if (!lines.length) throw bad("add at least one line");
  const total = lines.reduce((s, l) => s + l.amount, 0), gst = lines.reduce((s, l) => s + l.gst, 0);
  const paidFrom = kind === "receipt" ? (accountOf(B, d.paidFrom) && accountOf(B, d.paidFrom).bank ? String(d.paidFrom) : SYS.bank) : "";
  const job = clip(d.job, 30);
  if (job && !B.jobs.some((j) => j.code === job)) throw bad(`no job ${job} - add it under Jobs first`);
  const out = { id: d.id || newId("d"), kind, number: clip(d.number, 40), party: clip(d.party, 120), date: d.date, due, ref: clip(d.ref, 80),
    notes: clip(d.notes, 1000), job, lines, total, gst, net: total - gst, paidFrom, file: d.file || "" };
  if (sale) {   // 2.878.0: who it is to (a tax invoice of $1,000 or more must show the buyer's identity or ABN)
    let pAbn = ""; try { pAbn = require("./businessProfiles").abn(d.partyAbn); } catch (e) { throw bad("the customer's " + e.message.replace(/^an /, "")); }
    Object.assign(out, { partyAddress: clip(String(d.partyAddress || "").replace(/\r/g, ""), 300).replace(/[ \t]+\n/g, "\n"), partyEmail: clip(d.partyEmail, 160), partyAbn: pAbn });
  }
  if (kind === "quote") Object.assign(out, { qstatus: QUOTE_STATES.includes(d.qstatus) && d.qstatus !== "invoiced" ? d.qstatus : "draft", invoice: "" });
  if (kind === "invoice" && d.fromQuote) out.fromQuote = clip(d.fromQuote, 40);
  if (kind === "credit" && d.forInvoice) {
    const inv = B.docs.find((x) => x.id === d.forInvoice && x.kind === "invoice");
    if (!inv) throw bad("the invoice it credits is gone");
    if (d.date < inv.date) throw bad("a credit note is dated on or after its invoice");
    out.forInvoice = inv.id; if (!out.ref) out.ref = inv.number;
    const left = docState(Object.assign({}, B, { docs: B.docs.filter((x) => x.id !== out.id) }), inv, "2999-12-31").balance;
    if (total > left) throw bad(`that is more than invoice ${inv.number} still has owing ($${money(left)}) - make the rest a credit on its own`);
  }
  return out;
}
/** what is paid on a document (receipts: all of it) and its state today */
function docState(B, d, at) {
  const t = isDate(at) ? at : today();
  if (d.kind === "credit") {   // 2.881.0
    if (d.forInvoice) return { paid: d.total, balance: 0, late: 0, status: "applied" };
    const out = B.payments.filter((p) => p.doc === d.id && p.date <= t).reduce((s, p) => s + p.amount, 0), left = d.total - out;
    return { paid: out, balance: left, late: 0, status: left <= 0 ? "refunded" : "open" };
  }
  if (d.kind === "quote") return { paid: 0, balance: 0, late: 0, status: (d.qstatus === "draft" || d.qstatus === "sent") && d.due < t ? "expired" : d.qstatus || "draft" };
  const credited = d.kind === "invoice" ? B.docs.filter((c) => c.kind === "credit" && c.forInvoice === d.id && c.date <= t).reduce((s, c) => s + c.total, 0) : 0;
  const paid = d.kind === "receipt" ? d.total : B.payments.filter((p) => p.doc === d.id && p.date <= t).reduce((s, p) => s + p.amount, 0) + credited;
  const balance = d.total - paid, late = balance > 0 && d.due < t ? daysBetween(d.due, t) : 0;
  const status = balance <= 0 ? (credited >= d.total ? "credited" : "paid") : late ? "overdue" : paid > 0 ? "part paid" : "due";
  return { paid, balance, status, late, credited };
}
function cleanPayment(B, p0) {
  const p = p0 || {}, d = B.docs.find((x) => x.id === p.doc);
  if (!d || d.kind === "receipt" || d.kind === "quote") throw bad("pay or receive against a bill or an invoice");
  if (d.kind === "credit" && d.forInvoice) throw bad("this credit note is applied to its invoice - nothing to refund");
  if (!isDate(p.date)) throw bad("give the date it was paid");
  if (p.date < d.date) throw bad("the payment is before the document's date");
  const amount = cents(p.amount); if (!Number.isFinite(amount) || amount <= 0) throw bad("give the amount paid");
  const left = docState(Object.assign({}, B, { payments: B.payments.filter((x) => x.id !== p.id) }), d, "2999-12-31").balance;
  if (amount > left) throw bad(`that is more than is owed ($${money(left)})`);
  const acc = accountOf(B, p.account || SYS.bank); if (!acc || !acc.bank) throw bad("pick the bank, cash or card account it went through");
  return { id: p.id || newId("p"), doc: d.id, date: p.date, amount, account: acc.code, ref: clip(p.ref, 80) };
}
function cleanJournal(B, j0) {
  const j = j0 || {};
  if (!isDate(j.date)) throw bad("give the journal entry's date");
  const lines = (Array.isArray(j.lines) ? j.lines : []).map((l) => {
    const dr = l.dr === "" || l.dr == null ? 0 : cents(l.dr), cr = l.cr === "" || l.cr == null ? 0 : cents(l.cr);
    if (!Number.isFinite(dr) || !Number.isFinite(cr) || dr < 0 || cr < 0) throw bad("debits and credits are amounts of $0.00 or more");
    if (!accountOf(B, l.account)) throw bad(`no account ${l.account}`);
    return { account: String(l.account), dr, cr, job: clip(l.job, 30), memo: clip(l.memo, 120) };
  }).filter((l) => l.dr || l.cr);
  if (lines.length < 2) throw bad("a journal entry has at least two lines");
  const dr = lines.reduce((s, l) => s + l.dr, 0), cr = lines.reduce((s, l) => s + l.cr, 0);
  if (dr !== cr) throw bad(`debits ($${money(dr)}) and credits ($${money(cr)}) must be equal`);
  return { id: j.id || newId("j"), date: j.date, memo: clip(j.memo, 200), ref: clip(j.ref, 40), lines };
}
function cleanJob(j0) {
  const j = j0 || {}, code = clip(j.code, 30).toUpperCase().replace(/\s+/g, "-");
  if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(code)) throw bad("a job code: letters, numbers, - _ . (e.g. JOB-001)");
  return { code, name: clip(j.name, 120) || code, client: clip(j.client, 120), status: j.status === "closed" ? "closed" : "open", notes: clip(j.notes, 500) };
}
function cleanAccount(B, a0) {
  const a = a0 || {}, code = clip(a.code, 8);
  if (!/^\d{3,6}$/.test(code)) throw bad("an account code is 3 - 6 digits");
  if (!TYPES.includes(a.type)) throw bad("pick the account's type");
  const old = accountOf(B, code);
  if (old && old.system && a.type !== old.type) throw bad("a system account keeps its type");
  return { code, name: clip(a.name, 80) || code, type: a.type, tax: TAX[a.tax] ? a.tax : "NT", bank: !!a.bank && (a.type === "asset" || a.type === "liability"), system: !!(old && old.system) };
}

/* ============================== postings (the double entry) ============================== */
/** every posting the books make: [{date, journal, src: {type, id}, ref, party, memo, account, dr, cr, job}] (oldest first) */
function postings(B) {
  const out = [], P = (o) => out.push(Object.assign({ dr: 0, cr: 0, job: "", memo: "", party: "", ref: "" }, o));
  for (const d of B.docs) {
    if (d.kind === "quote") continue;   // a quote posts nothing
    const src = { type: "doc", id: d.id }, base = { date: d.date, src, ref: d.number, party: d.party, job: d.job };
    if (d.kind === "credit") {   // 2.881.0: the sale taken back (Sales Journal, the other way round)
      for (const l of d.lines) P(Object.assign({}, base, { journal: "SJ", account: l.account, dr: l.amount - l.gst, memo: "Credit - " + (l.desc || "") }));
      if (d.gst) P(Object.assign({}, base, { journal: "SJ", account: SYS.gstOut, dr: d.gst, memo: "GST on the credit note" }));
      P(Object.assign({}, base, { journal: "SJ", account: SYS.ar, cr: d.total, memo: "Credit note " + (d.number || "") + (d.ref ? " for " + d.ref : "") }));
      continue;
    }
    if (d.kind === "invoice") {
      P(Object.assign({}, base, { journal: "SJ", account: SYS.ar, dr: d.total, memo: "Invoice " + (d.number || "") }));
      for (const l of d.lines) P(Object.assign({}, base, { journal: "SJ", account: l.account, cr: l.amount - l.gst, memo: l.desc }));
      if (d.gst) P(Object.assign({}, base, { journal: "SJ", account: SYS.gstOut, cr: d.gst, memo: "GST collected" }));
    } else {
      const j = d.kind === "receipt" ? "CP" : "PJ";
      for (const l of d.lines) P(Object.assign({}, base, { journal: j, account: l.account, dr: l.amount - l.gst, memo: l.desc }));
      if (d.gst) P(Object.assign({}, base, { journal: j, account: SYS.gstIn, dr: d.gst, memo: "GST paid" }));
      P(Object.assign({}, base, { journal: j, account: d.kind === "receipt" ? d.paidFrom || SYS.bank : SYS.ap, cr: d.total, memo: d.kind === "receipt" ? "Paid - receipt " + (d.number || "") : "Bill " + (d.number || "") }));
    }
  }
  for (const p of B.payments) {
    const d = B.docs.find((x) => x.id === p.doc); if (!d) continue;
    const base = { date: p.date, src: { type: "payment", id: p.id }, ref: p.ref || d.number, party: d.party, job: d.job };
    if (d.kind === "credit") { P(Object.assign({}, base, { journal: "CP", account: SYS.ar, dr: p.amount, memo: "Refund - credit note " + (d.number || "") })); P(Object.assign({}, base, { journal: "CP", account: p.account, cr: p.amount, memo: "Refund - credit note " + (d.number || "") })); continue; }
    if (d.kind === "invoice") { P(Object.assign({}, base, { journal: "CR", account: p.account, dr: p.amount, memo: "Received - invoice " + (d.number || "") })); P(Object.assign({}, base, { journal: "CR", account: SYS.ar, cr: p.amount, memo: "Received - invoice " + (d.number || "") })); }
    else { P(Object.assign({}, base, { journal: "CP", account: SYS.ap, dr: p.amount, memo: "Paid - bill " + (d.number || "") })); P(Object.assign({}, base, { journal: "CP", account: p.account, cr: p.amount, memo: "Paid - bill " + (d.number || "") })); }
  }
  for (const j of B.journals) for (const l of j.lines) P({ date: j.date, journal: "GJ", src: { type: "journal", id: j.id }, ref: j.ref, memo: l.memo || j.memo, account: l.account, dr: l.dr, cr: l.cr, job: l.job });
  return out.map((p, i) => Object.assign(p, { n: i })).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.n - b.n));
}
/** an account's balance on its natural side (assets / expenses debit-positive, the rest credit-positive) */
const natural = (acc, dr, cr) => (CREDIT_SIDE.has(acc.type) ? cr - dr : dr - cr);

/* ============================== reports ============================== */
/** a journal's entries in [from, to], grouped by their source: [{date, ref, party, memo, lines: [{account, name, dr, cr}]}] */
function journal(B, code, from, to) {
  const P = postings(B).filter((p) => p.journal === code && p.date >= from && p.date <= to), groups = new Map();
  for (const p of P) {
    const k = p.src.type + ":" + p.src.id;
    if (!groups.has(k)) groups.set(k, { date: p.date, ref: p.ref, party: p.party, memo: p.memo, src: p.src, lines: [] });
    const a = accountOf(B, p.account);
    groups.get(k).lines.push({ account: p.account, name: a ? a.name : "?", dr: p.dr, cr: p.cr, job: p.job, memo: p.memo });
  }
  const rows = [...groups.values()];
  return { code, name: JOURNALS[code], rows, dr: P.reduce((s, p) => s + p.dr, 0), cr: P.reduce((s, p) => s + p.cr, 0) };
}
/** one account's ledger: the opening balance before `from`, each posting with the running balance, the closing balance */
function ledger(B, code, from, to) {
  const acc = accountOf(B, code); if (!acc) throw bad(`no account ${code}`);
  const P = postings(B).filter((p) => p.account === acc.code);
  let bal = 0;
  for (const p of P) if (p.date < from) bal += natural(acc, p.dr, p.cr);
  const opening = bal, rows = [];
  for (const p of P) if (p.date >= from && p.date <= to) { bal += natural(acc, p.dr, p.cr); rows.push({ date: p.date, journal: p.journal, ref: p.ref, party: p.party, memo: p.memo, dr: p.dr, cr: p.cr, balance: bal, job: p.job }); }
  return { account: acc, opening, rows, closing: bal };
}
/** the trial balance as at `to`: each account with a balance in the Dr or Cr column; the columns agree */
function trialBalance(B, to) {
  const sums = new Map();
  for (const p of postings(B)) if (p.date <= to) { const s = sums.get(p.account) || { dr: 0, cr: 0 }; s.dr += p.dr; s.cr += p.cr; sums.set(p.account, s); }
  const rows = B.accounts.filter((a) => sums.has(a.code)).map((a) => { const s = sums.get(a.code), net = s.dr - s.cr; return { code: a.code, name: a.name, type: a.type, dr: net > 0 ? net : 0, cr: net < 0 ? -net : 0 }; }).filter((r) => r.dr || r.cr);
  const dr = rows.reduce((s, r) => s + r.dr, 0), cr = rows.reduce((s, r) => s + r.cr, 0);
  return { to, rows, dr, cr, balanced: dr === cr };
}
/** sums by account of the postings in [from, to] on the natural side */
function sumsBetween(B, from, to) {
  const m = new Map();
  for (const p of postings(B)) if (p.date >= from && p.date <= to) m.set(p.account, (m.get(p.account) || 0) + p.dr - p.cr);
  return m;
}
/** profit and loss for [from, to] (amounts without GST) */
function profitLoss(B, from, to) {
  const m = sumsBetween(B, from, to), sec = (type) => B.accounts.filter((a) => a.type === type && m.get(a.code)).map((a) => ({ code: a.code, name: a.name, amount: natural(a, Math.max(0, m.get(a.code)), Math.max(0, -m.get(a.code))) }));
  const income = sec("income"), cos = sec("cos"), expenses = sec("expense"), tot = (r) => r.reduce((s, x) => s + x.amount, 0);
  const ti = tot(income), tc = tot(cos), te = tot(expenses);
  return { from, to, income, totalIncome: ti, cos, totalCos: tc, gross: ti - tc, expenses, totalExpenses: te, net: ti - tc - te };
}
/** the balance sheet as at `to`: assets = liabilities + equity (this year's profit + earlier years' as earnings) */
function balanceSheet(B, to) {
  const m = sumsBetween(B, "1900-01-01", to), fy = finYear(to);
  const sec = (type) => B.accounts.filter((a) => a.type === type && m.get(a.code)).map((a) => ({ code: a.code, name: a.name, amount: natural(a, Math.max(0, m.get(a.code)), Math.max(0, -m.get(a.code))) }));
  const assets = sec("asset"), liabilities = sec("liability"), equity = sec("equity"), tot = (r) => r.reduce((s, x) => s + x.amount, 0);
  const current = profitLoss(B, fy.from, to).net, earlier = profitLoss(B, "1900-01-01", addDays(fy.from, -1)).net;
  if (earlier) equity.push({ code: "", name: "Retained Earnings (earlier years)", amount: earlier });
  equity.push({ code: "", name: `Current Year Earnings (${fy.label})`, amount: current });
  const ta = tot(assets), tl = tot(liabilities), te = tot(equity);
  return { to, assets, totalAssets: ta, liabilities, totalLiabilities: tl, netAssets: ta - tl, equity, totalEquity: te, balanced: ta === tl + te };
}
/** the BAS worksheet for [from, to]: GST figures in whole dollars (cents dropped, as the ATO asks) */
function bas(B, from, to, basis0) {
  const basis = basis0 === "accrual" ? "accrual" : basis0 === "cash" ? "cash" : B.settings.basis;
  const f = { G1: 0, G2: 0, G3: 0, G10: 0, G11: 0, A1: 0, B1: 0 }, inP = (d) => d >= from && d <= to, used = [];
  const add = (d, k) => {
    for (const l of d.lines) {
      const a = Math.round(l.amount * k), g = Math.round(l.gst * k);
      if (d.kind === "invoice" || d.kind === "credit") { f.G1 += a; if (l.tax === "FRE") f.G3 += a; f.A1 += g; }
      else if (l.tax === "CAP") { f.G10 += a; f.B1 += g; }
      else if (l.tax !== "NT") { f.G11 += a; f.B1 += g; }
    }
  };
  for (const d of B.docs) {
    if (d.kind === "quote") continue;
    // 2.881.0: a credit note = a decreasing adjustment - accrual: in the period of its date; cash: an unlinked one when it is refunded,
    // one for an invoice through that invoice's payments (each payment reports the invoice less its credits)
    if (d.kind === "credit") {
      if (basis === "accrual") { if (inP(d.date)) { add(d, -1); used.push(d.id); } continue; }
      if (!d.forInvoice) { const back = B.payments.filter((p) => p.doc === d.id && inP(p.date)).reduce((s, p) => s + p.amount, 0); if (back && d.total) { add(d, -back / d.total); used.push(d.id); } }
      continue;
    }
    if (basis === "accrual" || d.kind === "receipt") { if (inP(d.date)) { add(d, 1); used.push(d.id); } continue; }
    const paid = B.payments.filter((p) => p.doc === d.id && inP(p.date)).reduce((s, p) => s + p.amount, 0);
    const credits = d.kind === "invoice" ? B.docs.filter((c) => c.kind === "credit" && c.forInvoice === d.id) : [], net = d.total - credits.reduce((s, c) => s + c.total, 0);
    if (paid && net > 0) { const k = Math.min(1, paid / net); add(d, k); for (const c of credits) add(c, -k); used.push(d.id); }
  }
  // GST adjustments typed in the general journal straight to the GST accounts
  let adjA = 0, adjB = 0;
  for (const j of B.journals) if (inP(j.date)) for (const l of j.lines) { if (l.account === SYS.gstOut) adjA += l.cr - l.dr; if (l.account === SYS.gstIn) adjB += l.dr - l.cr; }
  f.A1 += adjA; f.B1 += adjB;
  const D = (c) => Math.trunc(c / 100);   // whole dollars, cents dropped
  const out = { from, to, basis, G1: D(f.G1), G2: D(f.G2), G3: D(f.G3), G10: D(f.G10), G11: D(f.G11), "1A": D(f.A1), "1B": D(f.B1), adjustments: { "1A": adjA, "1B": adjB }, docs: used.length };
  out.net = out["1A"] - out["1B"];
  out.verdict = out.net > 0 ? `$${out.net.toLocaleString("en-AU")} payable to the ATO` : out.net < 0 ? `$${(-out.net).toLocaleString("en-AU")} refund from the ATO` : "nothing to pay";
  return out;
}
/** unpaid invoices (receivables) or bills (payables) as at `to`, in age buckets past their due date */
function aged(B, kind, to) {
  const t = isDate(to) ? to : today(), B5 = ["current", "1-30", "31-60", "61-90", "90+"], tot = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0, all: 0 };
  const rows = B.docs.filter((d) => d.kind === kind && d.date <= t).map((d) => Object.assign({ id: d.id, number: d.number, party: d.party, date: d.date, due: d.due, total: d.total, job: d.job }, docState(B, d, t)))
    .filter((r) => r.balance > 0).map((r) => { const b = r.late <= 0 ? "current" : r.late <= 30 ? "1-30" : r.late <= 60 ? "31-60" : r.late <= 90 ? "61-90" : "90+"; tot[b] += r.balance; tot.all += r.balance; return Object.assign(r, { bucket: b }); });
  return { kind, to: t, buckets: B5, rows: rows.sort((a, b) => (a.due < b.due ? -1 : 1)), totals: tot };
}
/** each job: income + costs (without GST) in [from, to], its profit, what its customers still owe */
function jobs(B, from, to) {
  const P = postings(B).filter((p) => p.job && p.date >= from && p.date <= to);
  return B.jobs.map((j) => {
    let income = 0, costs = 0;
    for (const p of P) if (p.job === j.code) { const a = accountOf(B, p.account); if (!a) continue; if (a.type === "income") income += p.cr - p.dr; if (a.type === "expense" || a.type === "cos") costs += p.dr - p.cr; }
    const owed = B.docs.filter((d) => d.job === j.code && d.kind === "invoice").reduce((s, d) => s + docState(B, d, to).balance, 0);
    const toPay = B.docs.filter((d) => d.job === j.code && d.kind === "bill").reduce((s, d) => s + docState(B, d, to).balance, 0);
    return Object.assign({}, j, { income, costs, profit: income - costs, owed, toPay });
  });
}
/** the front page: banks, owed to us / by us (+ overdue), this quarter's GST, this year's profit, what falls due in 7 days */
function summary(B, at) {
  const t = isDate(at) ? at : today(), q = quarter(t), fy = finYear(t), tb = sumsBetween(B, "1900-01-01", t);
  const banks = B.accounts.filter((a) => a.bank).map((a) => ({ code: a.code, name: a.name, balance: natural(a, Math.max(0, tb.get(a.code) || 0), Math.max(0, -(tb.get(a.code) || 0))) }));
  const ar = aged(B, "invoice", t), ap = aged(B, "bill", t), gst = bas(B, q.from, t), pl = profitLoss(B, fy.from, t);
  const soon = [...ar.rows, ...ap.rows].filter((r) => r.due >= t && r.due <= addDays(t, 7)).map((r) => Object.assign({ kind: ar.rows.includes(r) ? "invoice" : "bill" }, r));
  return { at: t, quarter: q, fy, banks, owedToUs: ar.totals.all, overdueToUs: ar.totals.all - ar.totals.current, owedByUs: ap.totals.all, overdueByUs: ap.totals.all - ap.totals.current,
    unpaidInvoices: ar.rows.length, unpaidBills: ap.rows.length, gst, profit: pl.net, income: pl.totalIncome, soon, overdue: [...ar.rows, ...ap.rows].filter((r) => r.status === "overdue").length };
}
/** the books for the page: documents with their state, everything else as kept */
function view(B, at) {
  return Object.assign({}, B, { docs: B.docs.map((d) => Object.assign({}, d, docState(B, d, at))).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)) });
}

/* ============================== storage ============================== */
let ROOT = null;
const root = () => ROOT || path.join(require("./core").BASE, "accounting");
function setRoot(d) { ROOT = d || null; }
const bizDir = (biz) => { const b = String(biz || "main"); if (!/^[a-z0-9_-]{1,40}$/i.test(b)) throw bad("which business?"); return path.join(root(), b); };
const file = (biz) => path.join(bizDir(biz), "books.json");
function load(biz) {
  const f = file(biz);   // a bad business id is refused, not read as empty books
  try { const o = JSON.parse(fs.readFileSync(f, "utf8")); if (o && o.version === 1 && Array.isArray(o.docs)) { const b = blank(); for (const a of b.accounts) if (!o.accounts.some((x) => x.code === a.code)) o.accounts.push(a); return Object.assign(b, o, { settings: Object.assign(b.settings, o.settings) }); } } catch (e) { /* none yet */ }
  return blank();
}
function save(biz, B) {
  fs.mkdirSync(bizDir(biz), { recursive: true });
  B.accounts.sort((a, b) => (a.code < b.code ? -1 : 1));
  fs.writeFileSync(file(biz) + ".part", JSON.stringify(B, null, 1));
  fs.renameSync(file(biz) + ".part", file(biz));
  return B;
}
const FILE_TYPES = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif", "application/pdf": ".pdf" };
/** a receipt / bill as a data: URL -> kept beside the books; its file name */
function keepFile(biz, id, dataUrl) {
  const m = /^data:([a-z/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl || ""));
  if (!m || !FILE_TYPES[m[1]]) throw bad("attach a picture (PNG, JPEG, WebP, GIF) or a PDF");
  const buf = Buffer.from(m[2].replace(/\s+/g, ""), "base64");
  if (!buf.length || buf.length > 25 * 1024 * 1024) throw bad("the file is empty or over 25 MB");
  const dir = path.join(bizDir(biz), "files"); fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) if (f.startsWith(id + ".")) { try { fs.unlinkSync(path.join(dir, f)); } catch (e) { /* gone */ } }
  const name = id + FILE_TYPES[m[1]]; fs.writeFileSync(path.join(dir, name), buf);
  return name;
}
const filePath = (biz, name) => (/^[a-z0-9]+\.(png|jpg|webp|gif|pdf)$/i.test(String(name || "")) ? path.join(bizDir(biz), "files", name) : "");

/* ============================== changes (each loads, checks, saves) ============================== */
function saveDoc(biz, d0, dataUrl) {
  const B = load(biz), old = d0 && d0.id ? B.docs.find((d) => d.id === d0.id) : null;
  if (d0 && d0.id && !old) throw bad("that document is gone");
  const d = cleanDoc(B, Object.assign({}, d0, { file: old ? old.file : "" }));
  if ((d.kind === "invoice" || d.kind === "quote" || d.kind === "credit") && !d.number) { const k = d.kind; B.counters[k] = (B.counters[k] || 0) + 1; d.number = (k === "quote" ? B.settings.quotePrefix || "Q-" : k === "credit" ? B.settings.creditPrefix || "CN-" : B.settings.invoicePrefix || "INV-") + String(B.counters[k]).padStart(4, "0"); }
  if (old && old.kind === "invoice" && d.kind !== "invoice" && B.docs.some((c) => c.kind === "credit" && c.forInvoice === old.id)) throw bad("it has credit notes - delete them first");
  if (old && old.kind === "quote" && old.qstatus === "invoiced") throw bad("the quote is already an invoice - change the invoice");
  if (old && old.kind === "quote" && d.kind === "quote" && !d0.qstatus) d.qstatus = old.qstatus;
  if (old && old.fromQuote && d.kind === "invoice") d.fromQuote = old.fromQuote;
  if (old && old.kind !== d.kind && B.payments.some((p) => p.doc === d.id)) throw bad("it has payments - delete them before changing what it is");
  if (old && B.payments.filter((p) => p.doc === d.id).reduce((s, p) => s + p.amount, 0) > d.total) throw bad("more has been paid on it than the new total");
  if (dataUrl) d.file = keepFile(biz, d.id, dataUrl);
  d.created = old ? old.created : new Date().toISOString(); d.updated = new Date().toISOString();
  if (old) B.docs[B.docs.indexOf(old)] = d; else B.docs.push(d);
  save(biz, B); return Object.assign({}, d, docState(B, d));
}
/** 2.881.0: ✉ emailed - the date kept on the document; a draft quote becomes sent */
function markSent(biz, id, date) {
  const B = load(biz), d = B.docs.find((x) => x.id === id); if (!d) throw bad("that document is gone");
  d.sent = isDate(date) ? date : today(); if (d.kind === "quote" && d.qstatus === "draft") d.qstatus = "sent";
  save(biz, B); return Object.assign({}, d, docState(B, d));
}
/** 2.878.0: a quote's state set by hand (draft / sent / accepted / declined) */
function quoteState(biz, id, st) {
  const B = load(biz), q = B.docs.find((x) => x.id === id);
  if (!q || q.kind !== "quote") throw bad("that is not a quote");
  if (q.qstatus === "invoiced") throw bad("the quote is already an invoice");
  if (!QUOTE_STATES.includes(st) || st === "invoiced") throw bad("draft, sent, accepted or declined");
  q.qstatus = st; q.updated = new Date().toISOString(); save(biz, B); return Object.assign({}, q, docState(B, q));
}
function removeDoc(biz, id) {
  const B = load(biz), d = B.docs.find((x) => x.id === id); if (!d) return false;
  if (d.kind === "invoice" && B.docs.some((c) => c.kind === "credit" && c.forInvoice === d.id)) throw bad("the invoice has credit notes - delete them first");
  if (d.kind === "invoice" && d.fromQuote) { const q = B.docs.find((x) => x.id === d.fromQuote); if (q) { q.qstatus = "accepted"; q.invoice = ""; } }
  B.docs = B.docs.filter((x) => x !== d); B.payments = B.payments.filter((p) => p.doc !== id);
  if (d.file) { try { fs.unlinkSync(filePath(biz, d.file)); } catch (e) { /* gone */ } }
  save(biz, B); return true;
}
/** 2.878.0: a quote made an invoice - its customer, lines and job copied, dated `date` (today), due after the books' terms; the
 *  quote marked invoiced and linked both ways. Returns the invoice. */
function quoteToInvoice(biz, id, date) {
  const B = load(biz), q = B.docs.find((x) => x.id === id);
  if (!q || q.kind !== "quote") throw bad("that is not a quote");
  if (q.qstatus === "invoiced") throw bad("the quote is already invoice " + ((B.docs.find((x) => x.id === q.invoice) || {}).number || ""));
  const dt = isDate(date) ? date : today();
  const inv = saveDoc(biz, { kind: "invoice", party: q.party, partyAddress: q.partyAddress, partyEmail: q.partyEmail, partyAbn: q.partyAbn, date: dt,
    job: q.job, notes: q.notes, ref: q.number, fromQuote: q.id, lines: q.lines.map((l) => Object.assign({}, l, { amount: l.amount / 100, unit: l.unit == null ? undefined : l.unit / 100 })) });
  const B2 = load(biz), q2 = B2.docs.find((x) => x.id === id); q2.qstatus = "invoiced"; q2.invoice = inv.id; save(biz, B2);
  return inv;
}
/** 2.878.0: what a tax invoice still lacks under the ATO's rules: the seller's name + ABN, the buyer's identity or ABN at $1,000 or more */
function invoiceIssues(B, d, business) {
  const out = [];
  if ((d.kind !== "invoice" && d.kind !== "credit") || !B.settings.gstRegistered) return out;
  if (!business || !business.abn) out.push("your ABN is not in the business details - a tax invoice must show it");
  if (!business || !(business.company || business.name)) out.push("your business name is not in the business details");
  if (d.total >= 100000 && !d.party && !d.partyAbn) out.push("a tax invoice of $1,000 or more must show the buyer's name or ABN");
  return out;
}
function savePayment(biz, p0) { const B = load(biz), p = cleanPayment(B, p0), i = B.payments.findIndex((x) => x.id === p.id); if (i >= 0) B.payments[i] = p; else B.payments.push(p); save(biz, B); return p; }
function removePayment(biz, id) { const B = load(biz), n = B.payments.length; B.payments = B.payments.filter((p) => p.id !== id); save(biz, B); return B.payments.length < n; }
function saveJournal(biz, j0) { const B = load(biz), j = cleanJournal(B, j0), i = B.journals.findIndex((x) => x.id === j.id); if (i >= 0) B.journals[i] = j; else B.journals.push(j); save(biz, B); return j; }
function removeJournal(biz, id) { const B = load(biz), n = B.journals.length; B.journals = B.journals.filter((j) => j.id !== id); save(biz, B); return B.journals.length < n; }
function saveJob(biz, j0) { const B = load(biz), j = cleanJob(j0), i = B.jobs.findIndex((x) => x.code === j.code); if (i >= 0) B.jobs[i] = j; else B.jobs.push(j); save(biz, B); return j; }
function removeJob(biz, code) {
  const B = load(biz);
  if (B.docs.some((d) => d.job === code) || B.journals.some((j) => j.lines.some((l) => l.job === code))) throw bad("the job has entries - close it instead");
  const n = B.jobs.length; B.jobs = B.jobs.filter((j) => j.code !== code); save(biz, B); return B.jobs.length < n;
}
function saveAccount(biz, a0) { const B = load(biz), a = cleanAccount(B, a0), i = B.accounts.findIndex((x) => x.code === a.code); if (i >= 0) B.accounts[i] = a; else B.accounts.push(a); save(biz, B); return a; }
function removeAccount(biz, code) {
  const B = load(biz), a = accountOf(B, code); if (!a) return false;
  if (a.system) throw bad("a system account stays");
  if (postings(B).some((p) => p.account === a.code)) throw bad("the account has entries");
  B.accounts = B.accounts.filter((x) => x !== a); save(biz, B); return true;
}
function saveSettings(biz, s0) {
  const B = load(biz), s = s0 || {};
  if (s.basis) B.settings.basis = s.basis === "accrual" ? "accrual" : "cash";
  if (s.gstRegistered != null) B.settings.gstRegistered = !!s.gstRegistered;
  if (s.invoicePrefix != null) B.settings.invoicePrefix = clip(s.invoicePrefix, 12) || "INV-";
  if (s.creditPrefix != null) B.settings.creditPrefix = clip(s.creditPrefix, 12) || "CN-";
  if (s.quotePrefix != null) B.settings.quotePrefix = clip(s.quotePrefix, 12) || "Q-";
  if (s.terms != null) B.settings.terms = Math.max(0, Math.min(365, Math.round(+s.terms) || 0));
  if (s.quoteDays != null) B.settings.quoteDays = Math.max(1, Math.min(365, Math.round(+s.quoteDays) || 30));
  for (const k of ["invoiceLayout", "quoteLayout"]) if (s[k] != null) B.settings[k] = String(s[k]).slice(0, 80);   // 2.879.0: "" = the ledger page, else an image editor template's name
  if (s.profile != null) B.settings.profile = /^[a-z0-9]{0,40}$/i.test(String(s.profile)) ? String(s.profile) : "";
  if (s.payTo != null) B.settings.payTo = String(s.payTo).replace(/\r/g, "").slice(0, 400);
  save(biz, B); return B.settings;
}
/** every report the page asks for, by name */
function report(B, q) {
  const o = q || {}, p = period(o.period, o.at, o.from, o.to);
  switch (o.kind) {
    case "summary": return summary(B, o.at);
    case "journal": return Object.assign(journal(B, JOURNALS[o.journal] ? o.journal : "GJ", p.from, p.to), { period: p });
    case "ledger": return Object.assign(ledger(B, o.account || SYS.bank, p.from, p.to), { period: p });
    case "tb": return Object.assign(trialBalance(B, p.to), { period: p });
    case "pl": return Object.assign(profitLoss(B, p.from, p.to), { period: p });
    case "bs": return Object.assign(balanceSheet(B, p.to), { period: p });
    case "bas": { const g = bas(B, p.from, p.to, o.basis); return Object.assign(g, { payg: require("./accountingTax").extras(B, p.from, p.to, g) }, { period: p }); }   // 2.883.0: + PAYG W1 / W2, T1 / T7, 4, 5A, 8A, 8B, 9
    case "aged": return aged(B, o.which === "bill" ? "bill" : "invoice", p.to);
    case "jobs": return { period: p, jobs: jobs(B, p.from, p.to) };
    default: throw bad("which report?");
  }
}
module.exports = { CHART, SYS, TYPES, TAX, KINDS, QUOTE_STATES, quoteToInvoice, quoteState, markSent, invoiceIssues, JOURNALS, cents, money, gstIn, isDate, addDays, daysBetween, finYear, quarter, period, blank,
  cleanDoc, docState, cleanPayment, cleanJournal, cleanJob, cleanAccount, postings, journal, ledger, trialBalance, profitLoss, balanceSheet,
  bas, aged, jobs, summary, view, report, setRoot, root, load, save, keepFile, filePath, saveDoc, removeDoc, savePayment, removePayment,
  saveJournal, removeJournal, saveJob, removeJob, saveAccount, removeAccount, saveSettings };
