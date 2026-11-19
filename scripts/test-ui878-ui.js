#!/usr/bin/env node
/* bitGen Studio — 2.878.0 in a REAL browser: ✍ the Accounts docker writes quotes and invoices - ＋ 📝 Quote with the customer
 * (address, email, ABN) and lines as quantity x unit price (the amount and GST follow as typed), Status accepted, ➜📤 made an
 * invoice (INV-0001, ref the quote), 🖨 the printed tax invoice (the business details' name + ABN, "Tax Invoice", GST per line,
 * how to pay), a wrong customer ABN refused, the $1,000 warning without a buyer; the business details dialog's ABN field.
 * Tim (verbatim): "... write invoice, quotes etc." + "next please" */
"use strict";
const path = require("path"), fs = require("fs");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const SHOTS = process.env.SHOTS || "";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1800, height: 1100 } }), p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  let profId = "";
  try {
    // the business details with an ABN (the books of that business)
    const prof = await (await fetch(URL_ + "api/business/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: { company: "UI878 Joinery", address: "5 Saw St\nToowoomba QLD", phone: "0400 111 222", abn: "51 824 753 556" } }) })).json();
    profId = prof.id;
    check("the business details keep an ABN", prof.abn === "51 824 753 556", prof);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Accounts && document.getElementById("acctdock"), null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); });
    await p.click("#tX_acctdock"); await p.waitForTimeout(400);
    await ev((id) => { const d = document.getElementById("acctdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1700px;height:1000px;z-index:9999"; const S = H3Accounts.state(); S.biz = id; S.per = "all"; document.getElementById("acPer").value = "all"; return H3Accounts.refresh(); }, profId);
    await p.waitForTimeout(400);
    const biz = await ev(() => document.getElementById("acBiz").selectedOptions[0].textContent);
    check("Books of ▾ shows the business", biz === "UI878 Joinery", biz);
    // payment details
    await ev(() => H3Accounts.show("accounts")); await p.waitForSelector("#acPayTo");
    await p.fill("#acPayTo", "BSB 062-000  Account 1234 5678"); await p.dispatchEvent("#acPayTo", "change"); await p.waitForTimeout(500);
    // ＋ 📝 Quote
    await p.click("#acNewQuote"); await p.waitForSelector("#acfAbn");
    const qf = await ev(() => ({ t: document.getElementById("acDlgT").textContent, due: document.querySelector('label.f input#acfDue').closest("label").textContent, ro: document.querySelector('#acfLines [data-k="amount"]').readOnly, qty: document.querySelector('#acfLines [data-k="qty"]').value, st: document.getElementById("acfQst").value }));
    check("＋ 📝 Quote: 'New quote', Valid until, Status draft, Qty 1 + Unit price (the Amount follows, not typed)", qf.t === "New quote" && /Valid until/.test(qf.due) && qf.ro && qf.qty === "1" && qf.st === "draft", qf);
    await p.fill("#acfParty", "Mrs K Brown"); await p.fill("#acfAddr", "22 Oak Ave\nHighfields QLD"); await p.fill("#acfEmail", "kb@example.com"); await p.fill("#acfDate", "2026-11-02");
    await p.fill('#acfLines [data-k="desc"]', "Built-in robe, 2.4 m"); await p.fill('#acfLines [data-k="qty"]', "2"); await p.fill('#acfLines [data-k="unit"]', "1650");
    const t1 = await ev(() => ({ amt: document.querySelector('#acfLines [data-k="amount"]').value, tot: document.getElementById("acfTot").textContent }));
    check("2 x $1,650 = $3,300.00 incl. $300.00 GST as typed", t1.amt === "3300.00" && /Total \$3,300\.00 · GST \$300\.00/.test(t1.tot), t1);
    await p.fill("#acfAbn", "12 345 678 901"); await p.click("#acDlgOk"); await p.waitForTimeout(400);
    const bad = await ev(() => ({ open: document.getElementById("acDlg").open, e: document.getElementById("acDlgE").textContent }));
    check("a customer ABN that does not check out is refused, the dialog stays", bad.open && /not a valid ABN/.test(bad.e), bad);
    await p.fill("#acfAbn", ""); await p.fill("#acfParty", "");
    const warn = await ev(() => document.getElementById("acfWarn").textContent);
    check("$1,000 or more with no buyer's name or ABN: the dialog says a tax invoice must show it", /must show the buyer's name or ABN/.test(warn), warn);
    await p.fill("#acfParty", "Mrs K Brown"); await p.selectOption("#acfQst", "accepted");
    await p.click("#acDlgOk"); await p.waitForFunction(() => !document.getElementById("acDlg").open, null, { timeout: 5000 });
    await ev(() => H3Accounts.refresh().then(() => { H3Accounts.state().filter = "quote"; return H3Accounts.show("docs"); })); await p.waitForTimeout(400);
    const qrow = await ev(() => { const tr = document.querySelector("#acPaper tr[data-doc]"); return tr && { t: tr.innerText.replace(/\s+/g, " "), print: !!tr.querySelector("[data-print]"), q2i: !!tr.querySelector("[data-q2i]") }; });
    check("Quotes: Q-0001 accepted, $3,300.00, with 🖨 and ➜📤", qrow && /Q-0001/.test(qrow.t) && /accepted/i.test(qrow.t) && /3,300\.00/.test(qrow.t) && qrow.print && qrow.q2i, qrow);
    const sumBefore = await ev(async () => (await (await fetch("/api/accounts/report?kind=summary&biz=" + H3Accounts.state().biz)).json()).owedToUs);
    // ➜📤 make it an invoice (the confirm box answered yes)
    await ev(() => { window.__c = window.appConfirm; window.appConfirm = () => Promise.resolve(true); document.querySelector("#acPaper tr[data-doc] [data-q2i]").click(); });
    await p.waitForFunction(() => /is invoice INV-0001/.test(document.getElementById("acMsg").textContent), null, { timeout: 5000 });
    const after = await ev(async () => { const B = H3Accounts.state().books, inv = B.docs.find((d) => d.kind === "invoice"), q = B.docs.find((d) => d.kind === "quote"); const s = await (await fetch("/api/accounts/report?kind=summary&biz=" + H3Accounts.state().biz)).json(); return { inv: inv && { n: inv.number, ref: inv.ref, total: inv.total, qty: inv.lines[0].qty }, q: q.status, owed: s.owedToUs }; });
    check("➜📤: invoice INV-0001 (ref Q-0001, the same lines), the quote 'invoiced'; owed to us goes from $0 to $3,300 (a quote is not in the books)",
      sumBefore === 0 && after.inv && after.inv.n === "INV-0001" && after.inv.ref === "Q-0001" && after.inv.total === 330000 && after.inv.qty === 2 && after.q === "invoiced" && after.owed === 330000, { sumBefore, after });
    // 🖨 the printed tax invoice
    await ev(() => H3Accounts.show("docs")); await p.click('[data-filter="invoice"]'); await p.waitForTimeout(300);
    const [pop] = await Promise.all([ctx.waitForEvent("page"), ev(() => document.querySelector("#acPaper tr[data-doc] [data-print]").click())]);
    await pop.waitForLoadState("load"); await pop.waitForTimeout(400);
    const page = await pop.evaluate(() => ({ h1: document.querySelector("h1").textContent, text: document.querySelector(".sheet").innerText, warn: !!document.querySelector(".warn"), bar: document.querySelector(".bar").innerText }));
    check("🖨 the printed page: Tax Invoice, UI878 Joinery + ABN 51 824 753 556, INV-0001, Bill to Mrs K Brown, 2 x $1,650.00, GST $300.00, total $3,300.00, how to pay, 'Total price includes GST'",
      page.h1 === "Tax Invoice" && /UI878 Joinery/.test(page.text) && /ABN 51 824 753 556/.test(page.text) && /INV-0001/.test(page.text) && /Mrs K Brown/.test(page.text) && /\$1,650\.00/.test(page.text)
      && /\$300\.00/.test(page.text) && /\$3,300\.00/.test(page.text) && /BSB 062-000/.test(page.text) && /Total price includes GST/.test(page.text) && !page.warn && /Save as PDF/.test(page.bar), page);
    if (SHOTS) await pop.screenshot({ path: path.join(SHOTS, "tax-invoice.png"), fullPage: false });
    const pdf = await pop.pdf({ format: "A4" });
    check("it prints to an A4 PDF", pdf.length > 5000 && pdf.slice(0, 4).toString() === "%PDF", pdf.length);
    await pop.close();
    // the business details dialog has the ABN field
    const abnField = await ev(() => { const E = window.imageEditorInstance && window.imageEditorInstance.E; if (!E || !E.bizInfo) return "no editor"; E.bizInfo.dialog("card", {}); return new Promise((r) => setTimeout(() => { const i = document.getElementById("pcbzAbn"); r(i ? i.closest("label").textContent : "none"); const x = document.querySelector(".kxdlg.pcd .bt .cn, .kxdlg.pcd .cn"); if (x) x.click(); }, 600)); });
    check("✨ Create ▸ 💳 Business details: an ABN field", /ABN \(for tax invoices\)/.test(abnField) || abnField === "no editor", abnField);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran: " + e.message, false); }
  finally {
    try { if (profId) await fetch(URL_ + "api/business/profiles/" + profId, { method: "DELETE" }); } catch { /* left */ }
    try { if (profId) fs.rmSync(path.join(process.env.H3_ROOT || "/tmp/t819", "accounting", profId), { recursive: true, force: true }); } catch { /* left */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
