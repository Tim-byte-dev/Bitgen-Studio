// lib/accountingTax.js — 2.883.0: 🧾 the business's tax settings + pay runs for 📒 Accounts, and the PAYG parts of the BAS.
//   settings(B) / cleanTax(t)  B.settings.tax: {structure sole | partnership | company | trust, cycle quarterly | monthly | annual,
//     withholding (registered for PAYG withholding), wages [accounts], superRate (the super guarantee - 12 % from 1 July 2025,
//     editable), instalments none | amount | rate, instalmentAmount (cents a quarter, the ATO's T7), instalmentRate (%, T2)}
//   payRun(B, p)  one pay for one person: the gross, the tax withheld (typed - from the ATO's tax tables or calculator, bitGen does
//     not ship them), super -> a General Journal entry (Dr wages, Cr PAYG Withholding Payable, Cr the bank net; Dr super expense,
//     Cr Superannuation Payable) with the pay run kept on it
//   extras(B, from, to)  W1 (gross wages: debits to the wages accounts), W2 (credits to PAYG Withholding Payable), T1 instalment
//     income (income without GST from the profit and loss), T2 / T11 or T7, and the statement's summary 4, 5A, 8A, 8B, 9
//   No tax file numbers are asked or kept. Whole dollars, cents dropped, like the GST boxes.
"use strict";
const A = () => require("./accounting");

const STRUCT = { sole: "Sole trader", partnership: "Partnership", company: "Company", trust: "Trust" };
const CYCLE = { quarterly: "Quarterly", monthly: "Monthly", annual: "Annually" };
const INSTAL = { none: "No PAYG instalments", amount: "The amount the ATO worked out (T7)", rate: "Instalment income × the ATO's rate (T1 × T2)" };
const DEFAULTS = { structure: "sole", cycle: "quarterly", withholding: false, wages: ["6210"], superRate: 12, instalments: "none", instalmentAmount: 0, instalmentRate: 0 };
const PAYGW = "2300", SUPER_PAY = "2310", SUPER_EXP = "6220";
function bad(msg) { return Object.assign(new Error(msg), { status: 400 }); }

function settings(B) { return Object.assign({}, DEFAULTS, (B.settings && B.settings.tax) || {}); }
function cleanTax(B, t0) {
  const t = Object.assign(settings(B), t0 || {}), L = A();
  const out = { structure: STRUCT[t.structure] ? t.structure : "sole", cycle: CYCLE[t.cycle] ? t.cycle : "quarterly", withholding: !!t.withholding,
    instalments: INSTAL[t.instalments] ? t.instalments : "none" };
  const wages = (Array.isArray(t.wages) ? t.wages : String(t.wages || "").split(/[\s,]+/)).map(String).filter(Boolean);
  for (const w of wages) { const a = B.accounts.find((x) => x.code === w); if (!a || a.type !== "expense") throw bad(`the wages account ${w} is not an expense account`); }
  out.wages = wages.length ? [...new Set(wages)] : ["6210"];
  const sr = Number(t.superRate); if (!Number.isFinite(sr) || sr < 0 || sr > 30) throw bad("the super rate is a percentage from 0 to 30");
  out.superRate = Math.round(sr * 100) / 100;
  // given in dollars (the dialog); kept in cents - when it is not given the kept one stays
  const amt = t0 && t0.instalmentAmount != null && t0.instalmentAmount !== "" ? L.cents(t0.instalmentAmount) : settings(B).instalmentAmount || 0;
  if (!Number.isFinite(amt) || amt < 0) throw bad("the instalment amount is $0.00 or more");
  const rate = Number(t.instalmentRate); if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw bad("the instalment rate is a percentage from 0 to 100");
  if (out.instalments === "amount" && !amt) throw bad("give the instalment amount from the ATO (T7)");
  if (out.instalments === "rate" && !rate) throw bad("give the instalment rate from the ATO (T2, a %)");
  out.instalmentAmount = amt; out.instalmentRate = Math.round(rate * 1000) / 1000;
  return out;
}
/** 👷 a pay run -> a General Journal entry (returned, already cleaned by lib/accounting.js) */
function payRunEntry(B, p0) {
  const L = A(), p = p0 || {}, t = settings(B);
  if (!L.isDate(p.date)) throw bad("give the pay date");
  const name = String(p.employee || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 80);
  if (!name) throw bad("who is paid? (a name - no tax file number is needed here)");
  const gross = L.cents(p.gross), tax = p.tax === "" || p.tax == null ? 0 : L.cents(p.tax);
  if (!Number.isFinite(gross) || gross <= 0) throw bad("give the gross pay (before tax)");
  if (!Number.isFinite(tax) || tax < 0) throw bad("the tax withheld is $0.00 or more");
  if (tax > gross) throw bad("the tax withheld is more than the gross pay");
  const sup = p.super === "" || p.super == null ? Math.round(gross * (t.superRate || 0) / 100) : L.cents(p.super);
  if (!Number.isFinite(sup) || sup < 0) throw bad("super is $0.00 or more");
  const bank = B.accounts.find((a) => a.code === String(p.account || "1100"));
  if (!bank || !bank.bank) throw bad("pick the bank account the pay came from");
  const wage = String(p.wages || t.wages[0] || "6210"), wa = B.accounts.find((a) => a.code === wage);
  if (!wa || wa.type !== "expense") throw bad(`the wages account ${wage} is not an expense account`);
  const d = (c) => c / 100, lines = [
    { account: wage, dr: d(gross), memo: `Gross pay - ${name}`, job: p.job || "" },
    { account: bank.code, cr: d(gross - tax), memo: `Net pay - ${name}` }];
  if (tax) lines.push({ account: PAYGW, cr: d(tax), memo: `PAYG withheld - ${name}` });
  if (sup) lines.push({ account: SUPER_EXP, dr: d(sup), memo: `Super - ${name}`, job: p.job || "" }, { account: SUPER_PAY, cr: d(sup), memo: `Super owed - ${name}` });
  const j = L.cleanJournal(B, { date: p.date, memo: `Pay run - ${name}${p.period ? " (" + String(p.period).slice(0, 40) + ")" : ""}`, ref: String(p.ref || "PAY").slice(0, 40), lines });
  j.payrun = { employee: name, gross, tax, super: sup, net: gross - tax, period: String(p.period || "").slice(0, 40) };
  return j;
}
const sum = (rows) => rows.reduce((s, x) => s + x, 0);
/** the PAYG parts of the BAS for [from, to] (whole dollars) + the statement's summary with the GST figures of `gst` */
function extras(B, from, to, gst) {
  const L = A(), t = settings(B), D = (c) => Math.trunc(c / 100);
  const P = L.postings(B).filter((p) => p.date >= from && p.date <= to);
  const W1c = sum(P.filter((p) => t.wages.includes(p.account)).map((p) => p.dr - p.cr)), W2c = sum(P.filter((p) => p.account === PAYGW).map((p) => p.cr));
  const pays = B.journals.filter((j) => j.payrun && j.date >= from && j.date <= to).map((j) => Object.assign({ id: j.id, date: j.date }, j.payrun));
  const T1c = L.profitLoss(B, from, to).totalIncome;
  const out = { tax: t, W1: D(Math.max(0, W1c)), W2: D(W2c), pays, T1: D(Math.max(0, T1c)), T2: t.instalmentRate, T11: 0, T7: 0, instalments: t.instalments };
  if (t.instalments === "rate") out.T11 = D(Math.max(0, T1c) * t.instalmentRate / 100);
  if (t.instalments === "amount") {
    // the ATO's T7 is a quarter's amount; a longer period counts each quarter in it once
    const q = Math.max(1, Math.round(L.daysBetween(from, to) / 91.3));
    out.T7 = D(t.instalmentAmount * q);
  }
  const g = gst || { "1A": 0, "1B": 0 };
  out["4"] = out.W2; out["5A"] = t.instalments === "rate" ? out.T11 : t.instalments === "amount" ? out.T7 : 0;
  out["8A"] = (g["1A"] > 0 ? g["1A"] : 0) + out["4"] + out["5A"];
  out["8B"] = (g["1A"] < 0 ? -g["1A"] : 0) + g["1B"];
  out["9"] = out["8A"] - out["8B"];
  out.verdictAll = out["9"] > 0 ? `$${out["9"].toLocaleString("en-AU")} payable to the ATO` : out["9"] < 0 ? `$${(-out["9"]).toLocaleString("en-AU")} refund from the ATO` : "nothing to pay";
  out.paygShown = t.withholding || !!W2c || !!W1c || t.instalments !== "none";
  return out;
}
module.exports = {
  STRUCT, CYCLE, INSTAL, DEFAULTS, PAYGW, SUPER_PAY, SUPER_EXP, settings, cleanTax, payRunEntry, extras,
  saveTax(biz, t0) { const L = A(), B = L.load(biz); B.settings.tax = cleanTax(B, t0); L.save(biz, B); return B.settings.tax; },
  payRun(biz, p) { const L = A(), B = L.load(biz), j = payRunEntry(B, p); B.journals.push(j); L.save(biz, B); return j; },
};
