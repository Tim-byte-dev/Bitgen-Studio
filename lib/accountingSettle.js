// lib/accountingSettle.js — 2.889.0: 💵 PAY THE ATO AND PAY SUPER in 📒 Accounts (the first of the parked next steps, 2026-11-19).
//
// THE BAS LODGED: one General Journal entry for a BAS period moves what the period owes into 2330 ATO Integrated Client Account -
//   Dr 2200 GST Collected (1A, exact cents)   Cr 2210 GST Paid (1B)   Dr 2300 PAYG Withholding Payable (W2)
//   Dr 1350 PAYG Instalments Paid (5A - income tax paid ahead, set against the year's tax)
//   Dr / Cr 6270 BAS Rounding (the ATO takes whole dollars: label 9 less the exact cents)
//   Cr 2330 ATO Integrated Client Account = label 9 (a refund: Dr - the ATO owes you)
// PAID TO THE ATO (or a refund received): Dr 2330, Cr the bank (Dr the bank, Cr 2330) - whole or part, now or later.
// SUPER PAID: Dr 2310 Superannuation Payable, Cr the bank (the fund or the clearing house) - at most what is owed.
// Each entry carries `settle` {kind: bas | ato | super, ...} so the BAS worksheet never counts the lodging as a GST adjustment, a
// period is not lodged twice, and the 🏦 Bank tab matches the payment to the statement like any other entry (it has a bank line).
// GST basis: the BAS's own (cash or accrual) - what the worksheet shows is what is cleared; GST on invoices not yet paid (cash)
// stays in 2200 / 2210 for the period it is paid in.
"use strict";
const A = () => require("./accounting");
const TX = () => require("./accountingTax");

const ATO = "2330", INSTAL = "1350", ROUND = "6270";
const bad = (msg) => Object.assign(new Error(msg), { status: 400 });
const sum = (L) => L.reduce((s, x) => s + x, 0);

/** an account's balance on its natural side as at a date (liability: credit-positive) */
function balance(B, code, at) {
  const L = A(), acc = B.accounts.find((a) => a.code === code); if (!acc) return 0;
  const P = L.postings(B).filter((p) => p.account === code && (!at || p.date <= at));
  const dr = sum(P.map((p) => p.dr)), cr = sum(P.map((p) => p.cr));
  return ["liability", "equity", "income"].includes(acc.type) ? cr - dr : dr - cr;
}
const settleOf = (B, kind) => B.journals.filter((j) => j.settle && j.settle.kind === kind);
const nameOf = (B, code) => { const a = B.accounts.find((x) => x.code === code); return a ? a.name : code; };

/** what lodging the BAS for [from, to] will post (nothing is written): {lines, owed (label 9, cents), exact, rounding, already, ...} */
function atoPlan(B, from, to, basis) {
  const L = A(), T = TX();
  if (!L.isDate(from) || !L.isDate(to) || from > to) throw bad("give the BAS period (from - to)");
  const g = L.bas(B, from, to, basis), x = T.extras(B, from, to, g), t = T.settings(B);
  const A1 = g.cents["1A"], B1 = g.cents["1B"];
  const W2 = sum(L.postings(B).filter((p) => p.account === T.PAYGW && p.date >= from && p.date <= to).map((p) => p.cr));
  const inst = (x["5A"] || 0) * 100;
  const owed = (x["9"] || 0) * 100, exact = A1 - B1 + W2 + inst, rounding = owed - exact;
  const lines = [], add = (account, dr, cr, why) => { if (dr || cr) lines.push({ account, name: nameOf(B, account), dr, cr, why }); };
  add(L.SYS.gstOut, A1 > 0 ? A1 : 0, A1 < 0 ? -A1 : 0, "1A - GST on sales");
  add(L.SYS.gstIn, B1 < 0 ? -B1 : 0, B1 > 0 ? B1 : 0, "1B - GST on purchases");
  add(T.PAYGW, W2, 0, "W2 / 4 - PAYG withheld");
  add(INSTAL, inst, 0, "5A - PAYG income tax instalment");
  add(ROUND, rounding > 0 ? rounding : 0, rounding < 0 ? -rounding : 0, "whole dollars, as the ATO takes them");
  add(ATO, owed < 0 ? -owed : 0, owed > 0 ? owed : 0, owed >= 0 ? "label 9 - owed to the ATO" : "label 9 - the ATO owes you");
  const already = settleOf(B, "bas").filter((j) => j.settle.from === from && j.settle.to === to).map((j) => ({ id: j.id, date: j.date }));
  return { from, to, basis: g.basis, label: x.verdictAll, owed, exact, rounding, lines, already, gst: { "1A": g["1A"], "1B": g["1B"] }, payg: { W2: x.W2, "5A": x["5A"] },
    instalments: t.instalments, atoBalance: balance(B, ATO) };
}
function journalOf(B, j0, settle) { const j = A().cleanJournal(B, j0); j.settle = settle; return j; }
function bankOk(B, code) { const a = B.accounts.find((x) => x.code === String(code || "1100")); if (!a || !a.bank) throw bad("pick the bank account"); return a.code; }
const D = (c) => c / 100;

/** 💵 the BAS lodged (+ paid now when o.pay.amount): {lodged, paid} */
function lodge(biz, o) {
  const L = A(), B = L.load(biz), q = o || {};
  const per = q.from && q.to ? { from: q.from, to: q.to } : L.period(q.period || "lastquarter", q.at);
  const plan = atoPlan(B, per.from, per.to, q.basis);
  if (plan.already.length) throw bad(`the BAS for ${per.from} - ${per.to} is already in the books (entered ${plan.already[0].date}) - delete that journal entry first to lodge it again`);
  if (!plan.lines.length) throw bad("this period has nothing to lodge (no GST, no PAYG)");
  const date = L.isDate(q.date) ? q.date : per.to;
  if (date < per.to) throw bad("the BAS is lodged after its period ends");
  const lodged = journalOf(B, { date, ref: "BAS", memo: `BAS ${per.from} - ${per.to} lodged (${plan.basis}) - ${plan.label}`, lines: plan.lines.map((l) => ({ account: l.account, dr: D(l.dr), cr: D(l.cr), memo: l.why })) },
    { kind: "bas", from: per.from, to: per.to, basis: plan.basis, owed: plan.owed });
  B.journals.push(lodged);
  let paid = null;
  if (q.pay && (q.pay.amount !== "" && q.pay.amount != null && L.cents(q.pay.amount))) {
    paid = atoEntry(B, Object.assign({ date }, q.pay), plan.owed);
    const amt = L.cents(q.pay.amount), most = Math.abs(plan.owed);
    if (amt > most) throw bad(`that is more than this BAS ${plan.owed < 0 ? "refunds" : "owes"} ($${L.money(most)})`);
    if (paid.date < date) throw bad("it is paid on or after the day the BAS is lodged");
  }
  if (paid) B.journals.push(paid);
  L.save(biz, B);
  return { lodged, paid, plan };
}
/** a payment to the ATO (or a refund from it) against 2330 */
function atoEntry(B, p, owedNow) {
  const L = A(), amt = L.cents(p.amount), refund = p.refund === true || (p.refund == null && owedNow < 0);
  if (!Number.isFinite(amt) || amt <= 0) throw bad("give the amount paid");
  if (!L.isDate(p.date)) throw bad("give the date it was paid");
  const bank = bankOk(B, p.account);
  return journalOf(B, { date: p.date, ref: String(p.ref || "ATO").slice(0, 40), memo: refund ? "Refund from the ATO" : "Paid to the ATO",
    lines: refund ? [{ account: bank, dr: D(amt), memo: "Refund from the ATO" }, { account: ATO, cr: D(amt), memo: "ATO refund received" }]
      : [{ account: ATO, dr: D(amt), memo: "Paid to the ATO" }, { account: bank, cr: D(amt), memo: "Paid to the ATO" }] }, { kind: "ato", refund });
}
function atoPay(biz, p0) {
  const L = A(), B = L.load(biz), p = p0 || {};
  const bal = balance(B, ATO, p.date);
  const j = atoEntry(B, p, bal);
  const amt = L.cents(p.amount);
  if (!j.settle.refund && amt > bal) throw bad(`that is more than is owed to the ATO in the books ($${L.money(Math.max(0, bal))}) - lodge the BAS first (💵 Pay the ATO ▸ the period)`);
  if (j.settle.refund && amt > -bal) throw bad(`that is more than the ATO owes you in the books ($${L.money(Math.max(0, -bal))})`);
  B.journals.push(j); L.save(biz, B); return j;
}

/** super owed as at a date + the pay runs since the last super payment, by person */
function superPlan(B, at) {
  const L = A(), T = TX(), day = L.isDate(at) ? at : new Date().toISOString().slice(0, 10);
  const last = settleOf(B, "super").filter((j) => j.date <= day).map((j) => j.date).sort().pop() || "";
  const runs = B.journals.filter((j) => j.payrun && j.payrun.super && j.date <= day && (!last || j.date > last));
  const people = {}; for (const j of runs) people[j.payrun.employee] = (people[j.payrun.employee] || 0) + j.payrun.super;
  return { at: day, owed: balance(B, T.SUPER_PAY, day), since: last, people: Object.entries(people).map(([name, amount]) => ({ name, amount })), runs: runs.length };
}
function superPay(biz, p0) {
  const L = A(), T = TX(), B = L.load(biz), p = p0 || {};
  if (!L.isDate(p.date)) throw bad("give the date it was paid");
  const amt = L.cents(p.amount); if (!Number.isFinite(amt) || amt <= 0) throw bad("give the amount paid");
  const owed = balance(B, T.SUPER_PAY, p.date);
  if (amt > owed) throw bad(`that is more than the super owed in the books ($${L.money(Math.max(0, owed))}) - enter the pay runs (👷) first`);
  const fund = String(p.fund || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 80), bank = bankOk(B, p.account);
  const j = journalOf(B, { date: p.date, ref: String(p.ref || "SUPER").slice(0, 40), memo: "Super paid" + (fund ? " - " + fund : ""),
    lines: [{ account: T.SUPER_PAY, dr: D(amt), memo: "Super paid" + (fund ? " to " + fund : "") }, { account: bank, cr: D(amt), memo: "Super paid" + (fund ? " - " + fund : "") }] }, { kind: "super", fund });
  B.journals.push(j); L.save(biz, B); return j;
}

module.exports = { ATO, INSTAL, ROUND, balance, atoPlan, lodge, atoPay, superPlan, superPay };
