#!/usr/bin/env node
/* bitGen Studio — 2.883.0 in a REAL browser: 📒 Accounts - 🧾 Taxes… (instalments by the ATO's rate, withholding on), ＋ 👷 Pay run
 * (super worked out at 12 %, the net shown, the journal made), then the BAS tab shows W1 / W2 / 4, T1 / T2 / T11 / 5A and 8A / 8B / 9.
 * Tim (verbatim): "use au tax system, we will add a dialog for the users taxes and costs later" + "yes, please add the next steps" */
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
  const BIZ = "ui883" + Date.now().toString(36);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Accounts && window.H3AcctTax && window.H3Layouts, null, { timeout: 60000 });
    await p.waitForTimeout(3400);
    await ev(() => { if (H3Layouts.isOff({ kind: "dock", id: "acctdock" })) H3Layouts.set({ kind: "dock", id: "acctdock" }, false); });
    await p.waitForTimeout(300);
    await ev(async (biz) => {
      document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; });
      const d = document.getElementById("acctdock"); if (d.classList.contains("dockgone")) document.getElementById("tX_acctdock").click();
      d.style.cssText += ";position:fixed;left:10px;top:40px;width:1700px;height:1000px;z-index:9999";
      const S = H3Accounts.state(); S.biz = biz; S.per = "custom"; document.getElementById("acPer").value = "custom";
      document.getElementById("acFrom").value = "2026-10-01"; document.getElementById("acTo").value = "2026-12-31";
      await fetch("/api/accounts/doc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ biz, doc: { kind: "invoice", party: "C", date: "2026-10-01", lines: [{ account: "4200", amount: 11000 }] } }) });
      await H3Accounts.refresh();
    }, BIZ);
    // 🧾 Taxes…
    await p.click("#acTaxes"); await p.waitForSelector("#actxInst");
    const t0 = await ev(() => ({ t: document.getElementById("acDlgT").textContent, wh: document.getElementById("actxWh").checked, sup: document.getElementById("actxSuper").value, amtShown: document.querySelector('[data-inst="amount"]').style.display }));
    check("🧾 Taxes…: the dialog with withholding off, super 12 %, the instalment rows hidden until picked", t0.t === "🧾 Taxes" && !t0.wh && t0.sup === "12" && t0.amtShown === "none", t0);
    await p.selectOption("#actxStruct", "company"); await p.check("#actxWh"); await p.selectOption("#actxInst", "rate"); await p.selectOption("#actxBasis", "accrual");
    const rateShown = await ev(() => document.querySelector('[data-inst="rate"]').style.display);
    await p.fill("#actxRate", "4.5");
    await p.click("#acDlgOk"); await p.waitForFunction(() => !document.getElementById("acDlg").open, null, { timeout: 5000 });
    const kept = await ev(async (biz) => (await (await fetch("/api/accounts/tax?biz=" + biz)).json()).tax, BIZ);
    check("...by rate shows T2; saved: company, withholding, rate 4.5 %", rateShown === "" && kept.structure === "company" && kept.withholding && kept.instalments === "rate" && kept.instalmentRate === 4.5, kept);
    // ＋ 👷 Pay run
    await p.click("#acPayRun"); await p.waitForSelector("#acprGross");
    await p.fill("#acprName", "Sam"); await p.fill("#acprDate", "2026-10-09"); await p.fill("#acprGross", "1500"); await p.fill("#acprTax", "220");
    const pr = await ev(() => ({ sup: document.getElementById("acprSuper").value, sum: document.getElementById("acprSum").textContent }));
    check("👷 Pay run: super worked out at 12 % ($180.00); 'Net pay $1,280.00 · $220.00 to the ATO · $180.00 super'", pr.sup === "180.00" && /Net pay \$1,280\.00 from the bank · \$220\.00 to the ATO \(PAYG withheld\) · \$180\.00 super/.test(pr.sum), pr);
    await p.click("#acDlgOk"); await p.waitForFunction(() => !document.getElementById("acDlg").open, null, { timeout: 5000 });
    await p.waitForFunction(() => /pay run for Sam: gross \$1,500\.00, tax \$220\.00, net \$1,280\.00, super \$180\.00/.test(document.getElementById("acMsg").textContent), null, { timeout: 5000 });
    check("...saved: the message says gross / tax / net / super - in the General Journal", true);
    // the BAS tab
    await p.waitForTimeout(900);   // the dialog's own refresh() finishes first (it would paint over the tab)
    await ev(() => H3Accounts.show("bas")); await p.waitForSelector(".acbas");
    const bas = await ev(() => { const o = {}; document.querySelectorAll(".acbas .box").forEach((b) => { const cd = b.querySelector(".cd"); if (cd) o[cd.textContent] = b.querySelector(".fig").textContent; }); return { o, heads: [...document.querySelectorAll(".acbas h4")].map((h) => h.textContent), last: (document.querySelector(".acbas") || { lastElementChild: null }).lastElementChild ? document.querySelector(".acbas").lastElementChild.textContent : document.getElementById("acPaper").textContent.slice(0, 300) }; });
    check("BAS tab: W1 $1,500, W2 $220, 4 $220; T1 $10,000, T2 4.5 %, T11 $450, 5A $450; 8A $1,670 (1A 1,000 + 220 + 450), 8B $0, 9 payable",
      bas.o.W1 === "$1,500" && bas.o.W2 === "$220" && bas.o["4"] === "$220" && bas.o.T1 === "$10,000" && bas.o.T2 === "4.5 %" && bas.o.T11 === "$450" && bas.o["5A"] === "$450" && bas.o["8A"] === "$1,670" && bas.o["8B"] === "$0" && bas.o["9"] === "$1,670"
      && bas.heads.join("|") === "GST amounts you owe the ATO from sales|GST amounts the ATO owes you from purchases|PAYG tax withheld|PAYG income tax instalment|Summary" && /\$1,670 payable to the ATO/.test(bas.last), bas);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran: " + e.message, false); }
  finally {
    try { fs.rmSync(path.join(process.env.H3_ROOT || "/tmp/t819", "accounting", BIZ), { recursive: true, force: true }); } catch { /* left */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
