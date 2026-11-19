// bitGen Studio — lib/accountingCsv.js (2.880.0): ⤓ CSV of the 📒 Accounts docker's lists and reports (opens in any spreadsheet,
// ▦ the Spreadsheet docker included) + 🖨 the BAS worksheet as a page to print. Pure: csv(rows), rowsFor(kind, report, books),
// basHtml(bas, books, business).
"use strict";
const A = require("./accounting");
const d2 = (c) => (c == null || c === "" ? "" : (Math.round(Number(c) || 0) / 100).toFixed(2));
/** rows (arrays) -> CSV text (quoted when needed, CRLF, a BOM so Excel reads the $ and accents) */
function csv(rows) {
  const q = (v) => { const s = v == null ? "" : String(v); return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return "﻿" + rows.map((r) => r.map(q).join(",")).join("\r\n") + "\r\n";
}
/** a report (lib/accounting.js report()) -> rows with a header */
function rowsFor(kind, R, B) {
  const acc = (c) => (B.accounts.find((a) => a.code === c) || { name: "" }).name;
  switch (kind) {
    case "docs": return [["Kind", "Number", "Date", "Due", "Party", "Job", "Total", "GST", "Paid", "Balance", "Status", "Description", "Account", "Line amount", "Tax"]]
      .concat(...R.docs.map((d) => d.lines.map((l, i) => [i ? "" : A.KINDS[d.kind], i ? "" : d.number, i ? "" : d.date, i ? "" : d.kind === "receipt" ? "" : d.due, i ? "" : d.party, i ? "" : d.job,
        i ? "" : d2(d.total), i ? "" : d2(d.gst), i ? "" : d2(d.paid), i ? "" : d2(d.balance), i ? "" : d.status, l.desc, l.account + " " + acc(l.account), d2(l.amount), l.tax])));
    case "journal": return [["Date", "Ref", "Party", "Account", "Account name", "Debit", "Credit", "Job", "Memo"]]
      .concat(...R.rows.map((r) => r.lines.map((l) => [r.date, r.ref, r.party, l.account, l.name, d2(l.dr || ""), d2(l.cr || ""), l.job, l.memo || r.memo])));
    case "ledger": return [["Date", "Journal", "Ref", "Party", "Memo", "Debit", "Credit", "Balance", "Job"], [R.period.from, "", "", "", "Balance b/d", "", "", d2(R.opening), ""]]
      .concat(R.rows.map((r) => [r.date, r.journal, r.ref, r.party, r.memo, d2(r.dr || ""), d2(r.cr || ""), d2(r.balance), r.job]), [[R.period.to, "", "", "", "Balance c/d", "", "", d2(R.closing), ""]]);
    case "tb": return [["Code", "Account", "Debit", "Credit"]].concat(R.rows.map((r) => [r.code, r.name, d2(r.dr || ""), d2(r.cr || "")]), [["", "Totals", d2(R.dr), d2(R.cr)]]);
    case "pl": return [["Section", "Code", "Account", "Amount"]].concat(R.income.map((r) => ["Income", r.code, r.name, d2(r.amount)]), [["Total Income", "", "", d2(R.totalIncome)]],
      R.cos.map((r) => ["Cost of Sales", r.code, r.name, d2(r.amount)]), [["Gross Profit", "", "", d2(R.gross)]], R.expenses.map((r) => ["Expenses", r.code, r.name, d2(r.amount)]),
      [["Total Expenses", "", "", d2(R.totalExpenses)], [R.net < 0 ? "Net Loss" : "Net Profit", "", "", d2(R.net)]]);
    case "bs": return [["Section", "Code", "Account", "Amount"]].concat(R.assets.map((r) => ["Assets", r.code, r.name, d2(r.amount)]), [["Total Assets", "", "", d2(R.totalAssets)]],
      R.liabilities.map((r) => ["Liabilities", r.code, r.name, d2(r.amount)]), [["Total Liabilities", "", "", d2(R.totalLiabilities)], ["Net Assets", "", "", d2(R.netAssets)]],
      R.equity.map((r) => ["Equity", r.code, r.name, d2(r.amount)]), [["Total Equity", "", "", d2(R.totalEquity)]]);
    case "bas": return [["Label", "Box", "Amount ($, whole dollars)"], ["Total sales (including any GST)", "G1", R.G1], ["Export sales", "G2", R.G2], ["Other GST-free sales", "G3", R.G3],
      ["Capital purchases (including any GST)", "G10", R.G10], ["Non-capital purchases (including any GST)", "G11", R.G11], ["GST on sales", "1A", R["1A"]], ["GST on purchases", "1B", R["1B"]],
      ["Net GST (1A - 1B)", "", R.net]].concat(R.payg && R.payg.paygShown ? [["Total salary, wages and other payments", "W1", R.payg.W1], ["Amounts withheld", "W2", R.payg.W2],
      ["PAYG instalment income", "T1", R.payg.T1], ["Instalment rate (%)", "T2", R.payg.T2], ["Instalment (rate)", "T11", R.payg.T11], ["Instalment (amount)", "T7", R.payg.T7],
      ["PAYG tax withheld", "4", R.payg["4"]], ["PAYG income tax instalment", "5A", R.payg["5A"]], ["Total owed to the ATO", "8A", R.payg["8A"]], ["Total the ATO owes", "8B", R.payg["8B"]], ["Payable (refundable if negative)", "9", R.payg["9"]]] : [],
      [["Period", R.from, R.to], ["Basis", R.basis, ""]]);
    case "jobs": return [["Code", "Job", "Client", "Status", "Income", "Costs", "Profit", "Owed to us", "We owe"]].concat(R.jobs.map((j) => [j.code, j.name, j.client, j.status, d2(j.income), d2(j.costs), d2(j.profit), d2(j.owed), d2(j.toPay)]));
    default: throw Object.assign(new Error("which list?"), { status: 400 });
  }
}
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const au = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d || "")) ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : esc(d));
/** 🖨 the BAS worksheet as a page (A4, the GST section's boxes like the ATO's form) */
function basHtml(R, B, business) {
  const biz = business || {}, n = (v) => "$" + Number(v || 0).toLocaleString("en-AU");
  const box = (code, label, v) => `<tr><td class="lb">${esc(label)}</td><td class="cd">${code}</td><td class="fg">${n(v)}</td></tr>`;
  return `<!DOCTYPE html><html lang="en-AU"><head><meta charset="utf-8"><title>BAS worksheet ${au(R.from)} - ${au(R.to)}</title><style>
@page { size: A4; margin: 16mm; } body { margin: 0; background: #e9e4d3; font: 13px/1.45 Georgia, serif; color: #1f2a1b; }
.sheet { width: 210mm; min-height: 297mm; margin: 12px auto; padding: 16mm; background: #fbf8ee; box-shadow: 0 2px 10px rgba(0,0,0,.25); }
h1 { font: 700 22px Georgia, serif; font-variant: small-caps; letter-spacing: .06em; margin: 0; color: #2f4a26; }
.who { margin: 6px 0 2px; } .abn { font: 700 12px "Courier New", monospace; }
hr { border: 0; border-top: 3px double #2f4a26; margin: 10px 0; }
h2 { font: 700 13px Georgia, serif; font-variant: small-caps; border-bottom: 1px solid #2f4a26; margin: 16px 0 6px; }
table { border-collapse: collapse; width: 100%; } td { padding: 4px 6px; } .lb { width: 60%; }
.cd { font: 700 12px "Courier New", monospace; background: #2f4a26; color: #fbf8ee; text-align: center; width: 44px; }
.fg { font: 700 15px "Courier New", monospace; text-align: right; border: 1px solid #2f4a26; background: #fff; width: 150px; }
.sum td { font-weight: 700; font-size: 15px; } .note { font-size: 11px; font-style: italic; color: #4c5d43; margin-top: 18px; }
.bar { position: sticky; top: 0; background: #2f4a26; color: #fbf8ee; padding: 6px 12px; font: 13px system-ui, sans-serif; }
.bar button { font: 13px system-ui, sans-serif; padding: 3px 12px; }
@media print { body { background: none; } .sheet { margin: 0; box-shadow: none; width: auto; min-height: 0; padding: 0; background: none; } .bar { display: none; } .fg { background: none; } }
</style></head><body><div class="bar"><button type="button" onclick="window.print()">🖨 Print / Save as PDF</button> BAS worksheet - a copy for your records and your tax agent</div>
<div class="sheet"><h1>Business Activity Statement - GST worksheet</h1>
<div class="who"><b>${esc(biz.company || biz.name || "")}</b>${biz.abn ? ` · <span class="abn">ABN ${esc(biz.abn)}</span>` : ""}</div>
<div>Period ${au(R.from)} - ${au(R.to)} · ${R.basis === "cash" ? "cash basis (when paid)" : "accrual basis (when invoiced)"} · ${R.docs} document(s)</div><hr>
<h2>GST amounts you owe the ATO from sales</h2><table>${box("G1", "Total sales (including any GST)", R.G1)}${box("G2", "Export sales", R.G2)}${box("G3", "Other GST-free sales", R.G3)}${box("1A", "GST on sales", R["1A"])}</table>
<h2>GST amounts the ATO owes you from purchases</h2><table>${box("G10", "Capital purchases (including any GST)", R.G10)}${box("G11", "Non-capital purchases (including any GST)", R.G11)}${box("1B", "GST on purchases", R["1B"])}</table>
${R.payg && R.payg.paygShown ? `<h2>PAYG tax withheld</h2><table>${box("W1", "Total salary, wages and other payments", R.payg.W1)}${box("W2", "Amounts withheld from them", R.payg.W2)}${box("4", "PAYG tax withheld", R.payg["4"])}</table>
<h2>PAYG income tax instalment</h2><table>${R.payg.instalments === "rate" ? box("T1", "PAYG instalment income", R.payg.T1) + `<tr><td class="lb">Instalment rate</td><td class="cd">T2</td><td class="fg">${esc(String(R.payg.T2))} %</td></tr>` + box("T11", "T1 × T2", R.payg.T11) : R.payg.instalments === "amount" ? box("T7", "Instalment amount (from the ATO)", R.payg.T7) : ""}${box("5A", "PAYG income tax instalment", R.payg["5A"])}</table>
<h2>Summary</h2><table>${box("8A", "Owed to the ATO (1A + 4 + 5A)", R.payg["8A"])}${box("8B", "Owed by the ATO (1B)", R.payg["8B"])}<tr class="sum"><td class="lb">9: ${esc(R.payg.verdictAll)}</td><td class="cd">9</td><td class="fg">${n(Math.abs(R.payg["9"]))}</td></tr></table>`
  : `<h2>Summary</h2><table><tr class="sum"><td class="lb">1A − 1B: ${esc(R.verdict)}</td><td></td><td class="fg">${n(Math.abs(R.net))}</td></tr></table>`}
${R.adjustments && (R.adjustments["1A"] || R.adjustments["1B"]) ? `<div class="note">Includes GST adjustments from the General Journal: 1A $${d2(R.adjustments["1A"])}, 1B $${d2(R.adjustments["1B"])}.</div>` : ""}
<div class="note">Whole dollars, cents left off. Made by bitGen Studio from your books on ${au(new Date().toISOString().slice(0, 10))} - a worksheet, not the lodged statement: lodge through the ATO (Online services for business) or your tax agent and check the figures with them.${R.payg && R.payg.paygShown ? " The PAYG figures come from your pay runs and the tax settings (🧾 Taxes)." : " PAYG withholding and instalments: set them in 🧾 Taxes."}</div>
</div></body></html>`;
}
module.exports = { csv, rowsFor, basHtml };
