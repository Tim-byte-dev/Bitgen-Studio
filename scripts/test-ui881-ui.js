#!/usr/bin/env node
/* bitGen Studio — 2.881.0 in a REAL browser: 📒 Accounts - ⤺ a credit note from an invoice's row (the lines copied, saved as
 * CN-0001 for it, the invoice's balance down), ⤓ the PDF (a real application/pdf), ✉ email it: ✉ Mail's composer opens with the
 * customer's address, the subject, the words and the PDF attached; ➤ Send (the mail server answered by this test) marks it ✉✓.
 * Tim (verbatim): "yes, please add the next steps" */
"use strict";
const path = require("path"), fs = require("fs");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1800, height: 1100 } }), p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const BIZ = "ui881" + Date.now().toString(36);
  let mailed = null;
  try {
    await p.route("**/api/mail/*/send", async (route) => { mailed = JSON.parse(route.request().postData() || "{}"); await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, accepted: [(mailed.to || "x")], rejected: [], sent: { ok: true } }) }); });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Accounts && window.H3Layouts && window.H3MailCompose && window.H3Mail, null, { timeout: 60000 });
    await p.waitForTimeout(3400);
    await ev(() => { if (H3Layouts.isOff({ kind: "dock", id: "acctdock" })) H3Layouts.set({ kind: "dock", id: "acctdock" }, false); });
    await p.waitForTimeout(300);
    const inv = await ev(async (biz) => {
      document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; });
      const d = document.getElementById("acctdock"); if (d.classList.contains("dockgone")) document.getElementById("tX_acctdock").click();
      d.style.cssText += ";position:fixed;left:10px;top:40px;width:1700px;height:1000px;z-index:9999";
      const S = H3Accounts.state(); S.biz = biz; S.per = "all"; document.getElementById("acPer").value = "all";
      const r = await fetch("/api/accounts/doc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ biz, doc: { kind: "invoice", party: "Ms K Brown", partyEmail: "kb@example.com", date: "2026-11-19", lines: [{ desc: "Robe", account: "4200", qty: 2, unit: 1650 }] } }) });
      await H3Accounts.refresh(); S.filter = "all"; await H3Accounts.show("docs"); return r.json();
    }, BIZ);
    await p.waitForSelector(`[data-credit="${inv.id}"]`);
    // ⤺ a credit note from the invoice
    await p.click(`[data-credit="${inv.id}"]`); await p.waitForSelector("#acfParty");
    const f = await ev(() => ({ t: document.getElementById("acDlgT").textContent, party: document.getElementById("acfParty").value, note: [...document.querySelectorAll("#acDlg .acnote")].map((x) => x.textContent).join("|"), lines: document.querySelectorAll('#acfLines [data-k="qty"]').length, due: !!document.getElementById("acfDue") }));
    check("⤺ on the invoice's row: 'New credit note' for Ms K Brown, 'For invoice INV-0001', its lines copied, no due date", f.t === "New credit note" && f.party === "Ms K Brown" && /For invoice INV-0001/.test(f.note) && /still owing \$3,300\.00/.test(f.note) && f.lines === 1 && !f.due, f);
    await p.fill('#acfLines [data-k="desc"]', "Discount - one door scratched"); await p.fill('#acfLines [data-k="qty"]', "1"); await p.fill('#acfLines [data-k="unit"]', "330");
    await p.click("#acDlgOk"); await p.waitForFunction(() => !document.getElementById("acDlg").open, null, { timeout: 5000 });
    const after = await ev(() => H3Accounts.refresh().then(() => { const B = H3Accounts.state().books, i = B.docs.find((d) => d.kind === "invoice"), c = B.docs.find((d) => d.kind === "credit"); return { cn: c && [c.number, c.ref, c.status, c.total], inv: [i.balance, i.credited] }; }));
    check("saved: CN-0001 for INV-0001, applied ($330); the invoice owes $2,970", after.cn && after.cn.join() === "CN-0001,INV-0001,applied,33000" && after.inv.join() === "297000,33000", after);
    // ⤓ the PDF
    const pdf = await ev(async (id) => { const r = await fetch("/api/accounts/pdf/" + id + "?biz=" + H3Accounts.state().biz); const buf = new Uint8Array(await r.arrayBuffer()); return { type: r.headers.get("content-type"), head: String.fromCharCode(...buf.slice(0, 5)), n: buf.length, cd: r.headers.get("content-disposition") }; }, inv.id);
    check("⤓ a real PDF file: application/pdf, %PDF-, named 'Tax Invoice INV-0001 - Ms K Brown.pdf'", /application\/pdf/.test(pdf.type) && pdf.head === "%PDF-" && pdf.n > 2000 && /Tax Invoice INV-0001 - Ms K Brown\.pdf/.test(pdf.cd), pdf);
    // ✉ email it (a mailbox stood in)
    await ev(() => { H3Mail.S.accounts = [{ id: "acc1", name: "Tim", email: "tim@example.com" }]; H3Mail.loadAccounts = async () => H3Mail.S.accounts; });
    await ev(() => H3Accounts.show("docs")); await p.waitForSelector(`[data-email="${inv.id}"]`);
    await p.click(`[data-email="${inv.id}"]`);
    await p.waitForFunction(() => { const d = document.getElementById("mlCompose"); return d && d.open && H3MailCompose.S.atts.length; }, null, { timeout: 10000 });
    const comp = await ev(() => ({ to: document.getElementById("mlCTo").value, subj: document.getElementById("mlCSubj").value, text: document.getElementById("mlEdit").innerText, atts: H3MailCompose.S.atts.map((a) => [a.name, a.type, a.data.length > 1000]) }));
    check("✉: ✉ Mail's composer opens - To kb@example.com, 'Tax Invoice INV-0001', the words (the balance due $2,970.00, due date), the PDF attached",
      comp.to === "kb@example.com" && /^Tax Invoice INV-0001/.test(comp.subj) && /^Hi Ms Brown,/.test(comp.text) && /\$2,970\.00 \(balance due\)/.test(comp.text) && /due \d\d\/\d\d\/2026/.test(comp.text) && comp.atts.length === 1 && comp.atts[0][0] === "Tax Invoice INV-0001 - Ms K Brown.pdf" && comp.atts[0][1] === "application/pdf" && comp.atts[0][2], comp);
    await ev(() => H3MailCompose.send());
    await p.waitForFunction(() => /emailed to kb@example\.com/.test(document.getElementById("acMsg").textContent), null, { timeout: 8000 });
    const marked = await ev(() => { const d = H3Accounts.state().books.docs.find((x) => x.kind === "invoice"); return { sent: d.sent, btn: document.querySelector(`[data-email="${d.id}"]`).textContent }; });
    check("➤ Send: the email goes with the PDF; the invoice is marked emailed (✉✓)", mailed && mailed.to === "kb@example.com" && (mailed.attachments || []).length === 1 && /^[A-Za-z0-9+/]/.test(mailed.attachments[0].data) && marked.sent && marked.btn === "✉✓", { mailed: mailed && { to: mailed.to, n: (mailed.attachments || []).length }, marked });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran: " + e.message, false); }
  finally {
    try { fs.rmSync(path.join(process.env.H3_ROOT || "/tmp/t819", "accounting", BIZ), { recursive: true, force: true }); } catch { /* left */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
