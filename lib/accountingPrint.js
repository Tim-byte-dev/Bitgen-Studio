// bitGen Studio — lib/accountingPrint.js (2.878.0): ✍ a written invoice or quote as a page to print (or Save as PDF) - the
// Accounts docker's 🖨 (routes/accounting.js GET /api/accounts/print/:id). Pure: printHtml(doc, books, business, {auto}).
//
// The ATO's tax invoice (GST registered): the words "Tax Invoice", the seller's name + ABN, the date, what was sold (quantity and
// price), the GST - each line's, GST-free lines named so - or "Total price includes GST" when every line is taxable; at $1,000 or
// more the buyer's identity or ABN. Not GST registered: "Invoice", no GST. A quote: "Quote", Valid until, nothing posted.
// What a tax invoice still lacks (lib/accounting.js invoiceIssues) shows above the page on screen, never on paper.
"use strict";
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const br = (s) => esc(s).replace(/\n/g, "<br>");
const $ = (c) => { const n = Math.round(Number(c) || 0), a = Math.abs(n); return (n < 0 ? "-" : "") + "$" + String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + String(a % 100).padStart(2, "0"); };
const ausDate = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d || "")) ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : esc(d));
/** the title on the page */
function titleOf(doc, books) { return doc.kind === "quote" ? "Quote" : books.settings.gstRegistered ? "Tax Invoice" : "Invoice"; }
/** the page */
function printHtml(doc, books, business, opt) {
  const o = opt || {}, B = books, biz = business || {}, gstOn = !!B.settings.gstRegistered, title = titleOf(doc, B), q = doc.kind === "quote";
  const issues = o.issues || [];
  const allTaxable = doc.lines.every((l) => l.tax === "GST");
  const paid = q ? 0 : doc.paid || 0, balance = q ? 0 : doc.balance != null ? doc.balance : doc.total - paid;
  const lines = doc.lines.map((l) => `<tr><td>${esc(l.desc || "")}</td><td class="n">${l.qty != null ? esc(+l.qty.toFixed(3)) : "1"}</td><td class="n">${l.unit != null ? $(l.unit) : $(l.amount)}</td>`
    + (gstOn ? `<td class="n">${l.tax === "GST" ? $(l.gst) : l.tax === "FRE" ? "GST-free" : "–"}</td>` : "") + `<td class="n">${$(l.amount)}</td></tr>`).join("");
  const from = [biz.address, [biz.phone, biz.email].filter(Boolean).join("  ·  "), biz.website].filter(Boolean).map(br).join("<br>");
  const to = [doc.partyAddress, doc.partyEmail].filter(Boolean).map(br).join("<br>");
  return `<!DOCTYPE html><html lang="en-AU"><head><meta charset="utf-8"><title>${esc(title)} ${esc(doc.number)}${doc.party ? " - " + esc(doc.party) : ""}</title><style>
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; }
body { margin: 0; background: #e9e4d3; font: 13px/1.45 Georgia, "Times New Roman", serif; color: #1f2a1b; }
.sheet { width: 210mm; min-height: 297mm; margin: 12px auto; padding: 16mm 15mm; background: #fbf8ee; box-shadow: 0 2px 10px rgba(0,0,0,.25); position: relative; }
.sheet::before { content: ""; position: absolute; top: 0; bottom: 0; left: 9mm; width: 3px; border-left: 1px solid #c9655a; border-right: 1px solid #c9655a; opacity: .7; }
.top { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; }
.seller img { max-height: 70px; max-width: 220px; display: block; margin-bottom: 6px; }
.seller .co { font: 700 20px Georgia, serif; letter-spacing: .02em; }
.seller .abn { font: 700 12px "Courier New", monospace; margin-top: 3px; }
.ttl { text-align: right; }
.ttl h1 { font: 700 28px Georgia, serif; font-variant: small-caps; letter-spacing: .08em; margin: 0; color: #2f4a26; }
.meta { margin-top: 6px; border-collapse: collapse; margin-left: auto; }
.meta td { padding: 1px 0 1px 12px; font-size: 12px; } .meta td:first-child { color: #4c5d43; font-variant: small-caps; }
.meta td:last-child { font-family: "Courier New", monospace; font-weight: 700; text-align: right; }
.rule { border: 0; border-top: 3px double #2f4a26; margin: 12px 0; }
.to h3, .pay h3 { font: 700 12px Georgia, serif; font-variant: small-caps; letter-spacing: .06em; color: #2f4a26; margin: 0 0 2px; }
.to .nm { font-weight: 700; }
table.lines { width: 100%; border-collapse: collapse; margin-top: 14px; }
table.lines th { font: 700 11px Georgia, serif; font-variant: small-caps; letter-spacing: .05em; text-align: left; border-bottom: 2px solid #2f4a26; padding: 3px 6px; color: #2f4a26; }
table.lines td { padding: 4px 6px; border-bottom: 1px solid #c9dcbc; vertical-align: top; }
.n { text-align: right; font-family: "Courier New", monospace; white-space: nowrap; }
table.lines th.n { text-align: right; }
table.tot { margin: 10px 0 0 auto; border-collapse: collapse; min-width: 260px; }
table.tot td { padding: 2px 6px; } table.tot td:first-child { font-variant: small-caps; }
table.tot tr.big td { border-top: 1px solid #1f2a1b; border-bottom: 3px double #1f2a1b; font-weight: 700; font-size: 15px; }
.incl { text-align: right; font-style: italic; font-size: 12px; margin-top: 4px; }
.pay { margin-top: 18px; display: flex; gap: 30px; } .pay > div { flex: 1; }
.notes { margin-top: 14px; font-size: 12px; white-space: pre-wrap; }
.stamp { position: absolute; top: 46mm; right: 24mm; font: 700 26px "Courier New", monospace; color: #b1302a; border: 4px solid #b1302a; padding: 2px 12px; transform: rotate(-12deg); opacity: .8; letter-spacing: .1em; }
.bar { position: sticky; top: 0; background: #2f4a26; color: #f8fbf3; padding: 6px 12px; display: flex; gap: 10px; align-items: center; font: 13px system-ui, sans-serif; z-index: 2; }
.bar button { font: 13px system-ui, sans-serif; padding: 3px 12px; cursor: pointer; }
.warn { background: #fff3cd; color: #6b4e00; padding: 6px 12px; font: 12px system-ui, sans-serif; border-bottom: 1px solid #e0c36a; }
@media print { body { background: none; } .sheet { margin: 0; box-shadow: none; width: auto; min-height: 0; padding: 0 0 0 4mm; background: none; } .sheet::before, .bar, .warn { display: none; } }
</style></head><body>
<div class="bar"><button type="button" onclick="window.print()">🖨 Print / Save as PDF</button><span>${esc(title)} ${esc(doc.number)} - in the print box pick "Save as PDF" for a PDF</span></div>
${issues.length ? `<div class="warn">⚠ ${issues.map(esc).join("<br>⚠ ")}</div>` : ""}
<div class="sheet">
${!q && balance <= 0 && doc.total > 0 ? `<div class="stamp">PAID</div>` : ""}
<div class="top"><div class="seller">${biz.logo_url ? `<img src="${esc(biz.logo_url)}" alt="">` : ""}<div class="co">${esc(biz.company || biz.name || "")}</div>${from ? `<div>${from}</div>` : ""}${biz.abn ? `<div class="abn">ABN ${esc(biz.abn)}</div>` : ""}</div>
<div class="ttl"><h1>${esc(title)}</h1><table class="meta"><tr><td>${q ? "Quote" : "Invoice"} no.</td><td>${esc(doc.number)}</td></tr><tr><td>Date</td><td>${ausDate(doc.date)}</td></tr>
<tr><td>${q ? "Valid until" : "Due date"}</td><td>${ausDate(doc.due)}</td></tr>${doc.ref ? `<tr><td>${q ? "Ref" : "Quote"}</td><td>${esc(doc.ref)}</td></tr>` : ""}${doc.job ? `<tr><td>Job</td><td>${esc(doc.job)}</td></tr>` : ""}</table></div></div>
<hr class="rule">
<div class="to"><h3>${q ? "Quote for" : "Bill to"}</h3><div class="nm">${esc(doc.party || "")}</div>${to ? `<div>${to}</div>` : ""}${doc.partyAbn ? `<div>ABN ${esc(doc.partyAbn)}</div>` : ""}</div>
<table class="lines"><tr><th>Description</th><th class="n">Qty</th><th class="n">Unit price${gstOn ? " incl. GST" : ""}</th>${gstOn ? '<th class="n">GST</th>' : ""}<th class="n">Amount${gstOn ? " incl. GST" : ""}</th></tr>${lines}</table>
<table class="tot">${gstOn ? `<tr><td>Subtotal excl. GST</td><td class="n">${$(doc.total - doc.gst)}</td></tr><tr><td>GST</td><td class="n">${$(doc.gst)}</td></tr>` : ""}
<tr class="big"><td>Total${gstOn ? " incl. GST" : ""}</td><td class="n">${$(doc.total)}</td></tr>${!q && paid ? `<tr><td>Paid</td><td class="n">${$(paid)}</td></tr><tr class="big"><td>Balance due</td><td class="n">${$(balance)}</td></tr>` : ""}</table>
${gstOn && allTaxable ? `<div class="incl">Total price includes GST</div>` : ""}
<div class="pay">${B.settings.payTo && !q ? `<div><h3>How to pay</h3><div>${br(B.settings.payTo)}</div>${doc.number ? `<div>Please use <b>${esc(doc.number)}</b> as the reference.</div>` : ""}</div>` : ""}
<div><h3>${q ? "This quote" : "Terms"}</h3><div>${q ? `Valid until ${ausDate(doc.due)}. Prices include GST where shown.` : balance > 0 ? `Please pay by ${ausDate(doc.due)}.` : "Thank you - paid in full."}</div></div></div>
${doc.notes ? `<div class="notes">${esc(doc.notes)}</div>` : ""}
</div>${o.auto ? "<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300))</script>" : ""}</body></html>`;
}
module.exports = { printHtml, titleOf };
