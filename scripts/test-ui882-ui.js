#!/usr/bin/env node
/* bitGen Studio — 2.882.0 in a REAL browser: 📒 Accounts ▸ 🏦 Bank - a CSV statement imported through the file box (the paper
 * receipt already in the books matched by itself), the open invoice suggested and ✚ paid from its line, ✚ Make… a bank fee as a
 * GST-free spend, the second fee suggested "as before", ⚖ Check the closing balance and ✔ Reconcile, ↶ undo.
 * Tim (verbatim): "yes, please add the next steps" */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os");
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
  const BIZ = "ui882" + Date.now().toString(36);
  const csv = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ui882-")), "CSVData.csv");
  fs.writeFileSync(csv, '05/07/2026,"-45.10","EFTPOS OFFICEWORKS 0123 SYDNEY AU","+1,954.90"\n06/07/2026,"+1100.00","TRANSFER FROM SMITH PTY LTD","+3,054.90"\n07/07/2026,"-2.50","MONTHLY ACCOUNT FEE","+3,052.40"\n08/07/2026,"-2.50","MONTHLY ACCOUNT FEE","+3,049.90"\n');
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Accounts && window.H3AcctBank && window.H3Layouts, null, { timeout: 60000 });
    await p.waitForTimeout(3400);
    await ev(() => { if (H3Layouts.isOff({ kind: "dock", id: "acctdock" })) H3Layouts.set({ kind: "dock", id: "acctdock" }, false); });
    await p.waitForTimeout(300);
    await ev(async (biz) => {
      document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; });
      const d = document.getElementById("acctdock"); if (d.classList.contains("dockgone")) document.getElementById("tX_acctdock").click();
      d.style.cssText += ";position:fixed;left:10px;top:40px;width:1700px;height:1000px;z-index:9999";
      const S = H3Accounts.state(); S.biz = biz; S.per = "all"; document.getElementById("acPer").value = "all";
      const post = (doc) => fetch("/api/accounts/doc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ biz, doc }) });
      await post({ kind: "invoice", party: "Smith Pty Ltd", date: "2026-07-01", lines: [{ desc: "Work", account: "4200", amount: 1100 }] });
      await post({ kind: "receipt", party: "Officeworks", date: "2026-07-04", lines: [{ desc: "Paper", account: "6160", amount: 45.10 }] });
      await fetch("/api/accounts/journal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ biz, entry: { date: "2026-06-30", memo: "Opening", lines: [{ account: "1100", dr: 2000 }, { account: "3100", cr: 2000 }] } }) });
      await H3Accounts.refresh(); await H3Accounts.show("bank");
    }, BIZ);
    await p.waitForSelector("#acBankImp");
    const tabs = await ev(() => [...document.querySelectorAll("#acTabs button")].map((x) => x.textContent));
    check("🏦 Bank is a tab of 📒 Accounts (after BAS); empty it says to import a statement", tabs.includes("🏦 Bank") && tabs.indexOf("🏦 Bank") === tabs.indexOf("BAS") + 1 && /import one from your internet banking/.test(await p.textContent("#acPaper")), tabs);
    // ⤒ the statement through the file box
    await p.setInputFiles("#acBankFile", csv);
    await p.waitForFunction(() => /4 line\(s\) read · 4 added · 1 matched by themselves/.test(document.getElementById("acMsg").textContent), null, { timeout: 10000 });
    const v1 = await ev(() => ({ rows: document.querySelectorAll(".bank-tab tr[data-bline]").length, filt: document.querySelector("[data-bfilter].on").textContent, sug: [...document.querySelectorAll("[data-bpay]")].map((x) => x.textContent) }));
    check("⤒ CSV read: 4 lines, the Officeworks receipt matched by itself - 'To match (3)' shown; the $1,100 line suggests '✚ Invoice INV-0001 · Smith Pty Ltd'", v1.rows === 3 && v1.filt === "To match (3)" && v1.sug.length === 1 && /Invoice INV-0001 · Smith Pty Ltd/.test(v1.sug[0]), v1);
    await p.click("[data-bpay]");
    await p.waitForFunction(() => /payment recorded and matched/.test(document.getElementById("acMsg").textContent), null, { timeout: 8000 });
    const paid = await ev(() => H3Accounts.state().books.docs.find((d) => d.kind === "invoice").status);
    check("✚ the suggestion: the payment received on INV-0001 through the bank - the invoice paid", paid === "paid", paid);
    // ✚ Make… a fee
    await p.click(".bank-tab tr[data-bline] [data-bmake]:not(.bank-sug)");
    await p.waitForSelector("#acbAs");
    const f = await ev(() => ({ t: document.getElementById("acDlgT").textContent, as: document.getElementById("acbAs").value, opts: [...document.querySelectorAll("#acbAs option")].map((o) => o.value).join(), note: document.querySelector("#acDlgB .acnote").textContent }));
    check("✚ Make…: money out $2.50 - payment / spend / split / transfer / other; a spend first (no open bills)", f.t === "✚ Make it in the books" && f.as === "spend" && f.opts === "payment,spend,split,transfer,journal" && /money out \$2\.50/.test(f.note), f);
    await p.selectOption("#acbAcc", "6110"); await p.fill("#acbParty", "The bank");
    const tax = await ev(() => document.getElementById("acbTax").value);
    await p.click("#acDlgOk"); await p.waitForFunction(() => !document.getElementById("acDlg").open, null, { timeout: 5000 });
    await p.waitForFunction(() => document.querySelectorAll(".bank-tab tr[data-bline]").length === 1, null, { timeout: 5000 });
    const sp = await ev(() => { const r = H3Accounts.state().books.docs.find((d) => d.kind === "receipt" && d.party === "The bank"); return r && [r.total, r.gst, r.paidFrom, r.lines[0].account]; });
    check("...Bank Fees picks GST-free; saved as a paid receipt from the bank account ($2.50, no GST)", tax === "FRE" && sp && sp.join() === "250,0,1100,6110", { tax, sp });
    const asBefore = await ev(() => [...document.querySelectorAll(".bank-tab [data-bmake].bank-sug")].map((x) => x.textContent));
    check("the second fee: '✚ Spend → 6110 (as before)'", asBefore.length === 1 && /Spend → 6110 \(as before\)/.test(asBefore[0]), asBefore);
    await p.click(".bank-tab [data-bmake].bank-sug"); await p.waitForSelector("#acbAs");
    const pre = await ev(() => [document.getElementById("acbAs").value, document.getElementById("acbAcc").value, document.getElementById("acbTax").value]);
    await p.click("#acDlgOk"); await p.waitForFunction(() => !document.getElementById("acDlg").open, null, { timeout: 5000 });
    check("...it opens filled in the same way (spend, 6110, GST-free)", pre.join() === "spend,6110,FRE", pre);
    // ⚖ check + ✔ reconcile
    await p.waitForSelector("#acBankRecBal");
    const rec0 = await ev(() => [document.getElementById("acBankRecDate").value, document.getElementById("acBankRecBal").value]);
    check("the reconcile box is filled from the statement: 2026-07-08, $3,049.90", rec0.join() === "2026-07-08,3049.90", rec0);
    await p.fill("#acBankRecBal", "3050.00"); await p.click("#acBankChk"); await p.waitForSelector(".bank-rec");
    const off = await ev(() => ({ t: document.getElementById("acBankRecOut").textContent, dis: document.getElementById("acBankRec").disabled }));
    check("⚖ a wrong balance: out by $0.10, ✔ Reconcile stays off", /Out by\s*0\.10/.test(off.t) && off.dis, off);
    await p.fill("#acBankRecBal", "3049.90"); await p.click("#acBankChk");
    await p.waitForFunction(() => !document.getElementById("acBankRec").disabled, null, { timeout: 5000 });
    await p.click("#acBankRec");
    await p.waitForFunction(() => /reconciled to 2026-07-08 - 4 line/.test(document.getElementById("acMsg").textContent), null, { timeout: 8000 });
    await p.click('[data-bfilter="matched"]'); await p.waitForSelector(".bank-tab");
    const done = await ev(() => ({ n: [...document.querySelectorAll(".bank-tab .acstamp")].filter((x) => /reconciled/i.test(x.textContent)).length, sub: document.querySelector("#acPaper .acsub").textContent, undo: !!document.getElementById("acBankUnrec") }));
    check("✔ reconciled: 4 lines stamped, 'last reconciled 2026-07-08 at $3,049.90', ↶ Undo last there", done.n === 4 && /last reconciled 2026-07-08 at \$3,049\.90/.test(done.sub) && done.undo, done);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran: " + e.message, false); }
  finally {
    try { fs.rmSync(path.join(process.env.H3_ROOT || "/tmp/t819", "accounting", BIZ), { recursive: true, force: true }); } catch { /* left */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
