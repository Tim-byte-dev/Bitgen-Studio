// lib/accountingPaySummary.js — 2.893.0: 👷 a year's payment summary per person in 📒 Accounts - from the pay runs (lib/accountingTax.js
// payRunEntry keeps {employee, gross, tax, super, net, period} on each pay run's journal entry). For the Australian financial year
// (1 July - 30 June): each person's gross payments, tax withheld, super and net pay, how many pays, the first and last pay date and
// every pay; the totals; the years that have pay runs. A page per person to print / save as PDF (🖨) and a CSV.
//   Since Single Touch Payroll the ATO gives employees their income statement in myGov from what the employer reports - this is
//   a record from the books (for the employer, the employee and the tax agent), not a lodgement. No tax file numbers are kept.
// Tim (verbatim): "continue next" (parked: "👷 A year's payment summary per person (gross, tax withheld, super) from the pay runs")
"use strict";
const A = () => require("./accounting");

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const au = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d || "")) ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : esc(d));
const d2 = (c) => (Math.round(Number(c) || 0) / 100).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const keyOf = (name) => String(name || "").trim().toLowerCase().replace(/\s+/g, " ");

/** "2027" (the year it ends) | "2026-27" | "FY 2026-27" | a date | "" (today's year) -> {from, to, label, end} */
function yearOf(fy) {
  const L = A(), s = String(fy == null ? "" : fy).trim();
  let at = "";
  if (L.isDate(s)) at = s;
  else { const m = s.match(/(\d{4})(?:\s*[-/]\s*(\d{2,4}))?/); if (m) at = m[2] ? `${+m[1] + 1}-06-30` : `${m[1]}-06-30`; }
  const y = L.finYear(at || undefined);
  return Object.assign(y, { end: +y.to.slice(0, 4) });
}
/** the pay runs of a year by person: {from, to, label, end, people [{name, runs, gross, tax, super, net, first, last, pays}], totals, years} */
function summary(B, fy) {
  const y = yearOf(fy), by = new Map(), years = new Set();
  const runs = (B.journals || []).filter((j) => j.payrun && j.date);
  for (const j of runs) years.add(A().finYear(j.date).to.slice(0, 4));
  for (const j of runs.filter((x) => x.date >= y.from && x.date <= y.to).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))) {
    const p = j.payrun, k = keyOf(p.employee);
    let o = by.get(k);
    if (!o) { o = { name: String(p.employee || "").trim(), runs: 0, gross: 0, tax: 0, super: 0, net: 0, first: j.date, last: j.date, pays: [] }; by.set(k, o); }
    o.runs++; o.gross += p.gross || 0; o.tax += p.tax || 0; o.super += p.super || 0; o.net += p.net != null ? p.net : (p.gross || 0) - (p.tax || 0); o.last = j.date;
    o.pays.push({ id: j.id, date: j.date, period: p.period || "", gross: p.gross || 0, tax: p.tax || 0, super: p.super || 0, net: p.net != null ? p.net : (p.gross || 0) - (p.tax || 0) });
  }
  const people = [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
  const tot = (k) => people.reduce((s, p) => s + p[k], 0);
  years.add(String(y.end));
  return Object.assign({}, y, { people, totals: { people: people.length, runs: tot("runs"), gross: tot("gross"), tax: tot("tax"), super: tot("super"), net: tot("net") },
    years: [...years].map(Number).sort((a, b) => b - a).map((e) => ({ end: e, label: `FY ${e - 1}-${String(e).slice(2)}` })) });
}
/** one person (by name, any case) or null */
const personOf = (S, name) => S.people.find((p) => keyOf(p.name) === keyOf(name)) || null;
/** the CSV rows: a line per person + the total (dollars with cents) */
function rows(S) {
  const r = [["Financial year", "Name", "Pays", "First pay", "Last pay", "Gross payments", "Tax withheld", "Super", "Net paid"]];
  for (const p of S.people) r.push([S.label, p.name, p.runs, p.first, p.last, (p.gross / 100).toFixed(2), (p.tax / 100).toFixed(2), (p.super / 100).toFixed(2), (p.net / 100).toFixed(2)]);
  r.push([S.label, "Total", S.totals.runs, "", "", (S.totals.gross / 100).toFixed(2), (S.totals.tax / 100).toFixed(2), (S.totals.super / 100).toFixed(2), (S.totals.net / 100).toFixed(2)]);
  return r;
}
/** the page to print: one sheet per person (or the one asked for), the year's totals first when there are several */
function html(S, business, only) {
  const biz = business || {}, people = only ? S.people.filter((p) => keyOf(p.name) === keyOf(only)) : S.people;
  const head = `<div class="who"><b>${esc(biz.company || biz.name || "")}</b>${biz.abn ? ` · <span class="abn">ABN ${esc(biz.abn)}</span>` : ""}${biz.address ? `<br>${esc(String(biz.address).replace(/\n/g, ", "))}` : ""}</div>`;
  const yr = `${esc(S.label)} · ${au(S.from)} - ${au(S.to)}`;
  const fig = (label, v, strong) => `<tr${strong ? ' class="sum"' : ""}><td class="lb">${esc(label)}</td><td class="fg">$${d2(v)}</td></tr>`;
  const sheet = (p) => `<div class="sheet"><h1>Payment summary</h1>${head}<div>${yr}</div><hr>
<h2>Paid to</h2><div class="payee">${esc(p.name)}</div><div class="dim">${p.runs} pay${p.runs === 1 ? "" : "s"} · first ${au(p.first)} · last ${au(p.last)}</div>
<h2>The year's figures</h2><table>${fig("Gross payments (salary, wages and other payments)", p.gross)}${fig("Tax withheld (PAYG withholding)", p.tax)}${fig("Net paid", p.net, true)}${fig("Super (super guarantee) for the year", p.super)}</table>
<h2>The pays</h2><table class="pays"><tr><th>Date</th><th>For</th><th class="n">Gross</th><th class="n">Tax withheld</th><th class="n">Net</th><th class="n">Super</th></tr>
${p.pays.map((x) => `<tr><td>${au(x.date)}</td><td>${esc(x.period)}</td><td class="n">${d2(x.gross)}</td><td class="n">${d2(x.tax)}</td><td class="n">${d2(x.net)}</td><td class="n">${d2(x.super)}</td></tr>`).join("")}
<tr class="tot"><td>Total</td><td></td><td class="n">${d2(p.gross)}</td><td class="n">${d2(p.tax)}</td><td class="n">${d2(p.net)}</td><td class="n">${d2(p.super)}</td></tr></table>
<div class="note">From the pay runs in the books, made by bitGen Studio on ${au(new Date().toISOString().slice(0, 10))}. A record for the employer, the employee and the tax agent - not a lodgement: since Single Touch Payroll the employee's income statement comes from what the employer reports to the ATO (the employee sees it in myGov). No tax file number is kept.</div></div>`;
  const all = !only && people.length > 1 ? `<div class="sheet"><h1>Payment summaries - the year</h1>${head}<div>${yr}</div><hr>
<table class="pays"><tr><th>Name</th><th class="n">Pays</th><th class="n">Gross</th><th class="n">Tax withheld</th><th class="n">Net</th><th class="n">Super</th></tr>
${people.map((p) => `<tr><td>${esc(p.name)}</td><td class="n">${p.runs}</td><td class="n">${d2(p.gross)}</td><td class="n">${d2(p.tax)}</td><td class="n">${d2(p.net)}</td><td class="n">${d2(p.super)}</td></tr>`).join("")}
<tr class="tot"><td>Total</td><td class="n">${S.totals.runs}</td><td class="n">${d2(S.totals.gross)}</td><td class="n">${d2(S.totals.tax)}</td><td class="n">${d2(S.totals.net)}</td><td class="n">${d2(S.totals.super)}</td></tr></table>
<div class="note">A page for each person follows.</div></div>` : "";
  return `<!DOCTYPE html><html lang="en-AU"><head><meta charset="utf-8"><title>Payment summary ${esc(S.label)}${only && people[0] ? " - " + esc(people[0].name) : ""}</title><style>
@page { size: A4; margin: 16mm; } body { margin: 0; background: #e9e4d3; font: 13px/1.45 Georgia, serif; color: #1f2a1b; }
.sheet { width: 210mm; min-height: 297mm; margin: 12px auto; padding: 16mm; box-sizing: border-box; background: #fbf8ee; box-shadow: 0 2px 10px rgba(0,0,0,.25); page-break-after: always; }
.sheet:last-child { page-break-after: auto; }
h1 { font: 700 22px Georgia, serif; font-variant: small-caps; letter-spacing: .06em; margin: 0; color: #2f4a26; }
.who { margin: 6px 0 2px; } .abn { font: 700 12px "Courier New", monospace; } .payee { font: 700 18px Georgia, serif; } .dim { color: #4c5d43; font-size: 12px; }
hr { border: 0; border-top: 3px double #2f4a26; margin: 10px 0; }
h2 { font: 700 13px Georgia, serif; font-variant: small-caps; border-bottom: 1px solid #2f4a26; margin: 16px 0 6px; }
table { border-collapse: collapse; width: 100%; } td, th { padding: 4px 6px; } .lb { width: 65%; }
.fg { font: 700 15px "Courier New", monospace; text-align: right; border: 1px solid #2f4a26; background: #fff; }
.sum td { font-weight: 700; } .pays th { text-align: left; border-bottom: 1px solid #2f4a26; font-variant: small-caps; } .n { text-align: right; font-family: "Courier New", monospace; }
.pays tr.tot td { border-top: 3px double #2f4a26; font-weight: 700; } .note { font-size: 11px; font-style: italic; color: #4c5d43; margin-top: 18px; }
.bar { position: sticky; top: 0; background: #2f4a26; color: #fbf8ee; padding: 6px 12px; font: 13px system-ui, sans-serif; z-index: 2; }
.bar button { font: 13px system-ui, sans-serif; padding: 3px 12px; }
@media print { body { background: none; } .sheet { margin: 0; box-shadow: none; width: auto; min-height: 0; padding: 0; background: none; } .bar { display: none; } .fg { background: none; } }
</style></head><body><div class="bar"><button type="button" onclick="window.print()">🖨 Print / Save as PDF</button> Payment summary ${esc(S.label)} - a record from your books</div>
${people.length ? all + people.map(sheet).join("\n") : `<div class="sheet"><h1>Payment summary</h1>${head}<div>${yr}</div><hr><p>No pay runs in this year${only ? " for " + esc(only) : ""}.</p></div>`}
</body></html>`;
}
module.exports = {
  yearOf, summary, personOf, rows, html,
  summaryOf: (biz, fy) => summary(A().load(biz), fy),
};
