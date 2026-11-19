#!/usr/bin/env node
/* bitGen Studio — 2.889.0 in a REAL browser: 💵 Pay the ATO… and 💵 Pay super… in 📒 Accounts. The BAS tab's 💵 Lodge + pay this BAS
 * opens the dialog on that period: what the lodging posts (1A / 1B / W2 / 5A, the rounding, label 9 into 2330), Paid now with the
 * amount filled in; saved = the BAS in the books + the payment; opened again = 'already in the books', a payment only. 💵 Pay super:
 * what is owed and the pay runs by person, the amount filled in, saved. The ledger / bank see the entries. */
"use strict";
const path = require("path");
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
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const BIZ = "ui889" + Date.now().toString(36);
  const post = (u, body) => ev(async ([u, body]) => { const r = await fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return r.json(); }, [u, body]);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Accounts && window.H3AcctSettle && window.H3Layouts, null, { timeout: 60000 });
    await p.waitForTimeout(3400);
    await ev(() => { if (H3Layouts.isOff({ kind: "dock", id: "acctdock" })) H3Layouts.set({ kind: "dock", id: "acctdock" }, false); });
    await p.waitForTimeout(300);
    await post("/api/accounts/settings", { biz: BIZ, settings: { basis: "accrual" } });
    await post("/api/accounts/tax", { biz: BIZ, tax: { withholding: true } });
    await post("/api/accounts/doc", { biz: BIZ, doc: { kind: "invoice", party: "C", date: "2026-10-01", lines: [{ account: "4200", amount: 11000 }] } });
    await post("/api/accounts/payrun", { biz: BIZ, pay: { employee: "Sam", date: "2026-10-09", gross: 1500, tax: 220 } });
    await ev(async (biz) => {
      document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; });
      const d = document.getElementById("acctdock"); if (d.classList.contains("dockgone")) document.getElementById("tX_acctdock").click();
      d.style.cssText += ";position:fixed;left:10px;top:40px;width:1700px;height:1000px;z-index:9999";
      const S = H3Accounts.state(); S.biz = biz; S.per = "custom"; document.getElementById("acPer").value = "custom";
      document.getElementById("acFrom").value = "2026-10-01"; document.getElementById("acTo").value = "2026-12-31";
      await H3Accounts.refresh();
    }, BIZ);
    await p.waitForTimeout(600);
    await ev(() => H3Accounts.show("bas")); await p.waitForSelector("[data-settlebas]");
    check("the BAS tab has 💵 Lodge + pay this BAS (its period and basis)", await ev(() => { const x = document.querySelector("[data-settlebas]"); return x.dataset.from === "2026-10-01" && x.dataset.to === "2026-12-31" && x.dataset.basis === "accrual"; }));
    await p.click("[data-settlebas]"); await p.waitForSelector("#acstPlan table");
    const d1 = await ev(() => ({ title: document.getElementById("acDlgT").textContent, rows: [...document.querySelectorAll("#acstPlan table tr")].slice(1).map((r) => [...r.children].map((c) => c.textContent.trim()).join("|")),
      sub: document.querySelector("#acstPlan .acsub").textContent, amt: document.getElementById("acstAmt").value, per: document.getElementById("acstPer").value, lodgeShown: document.getElementById("acstLodgeRow").style.display }));
    check("💵 Pay the ATO opens on that period: Dr 2200 1,000 (1A), Dr 2300 220 (W2), Cr 2330 1,220 (label 9); the amount filled in",
      d1.title === "💵 Pay the ATO" && d1.per === "custom" && d1.rows.some((r) => /^2200 GST Collected\|1A/.test(r) && /1,000\.00\|$/.test(r)) && d1.rows.some((r) => /^2300 /.test(r) && /220\.00\|$/.test(r)) && d1.rows.some((r) => /^2330 ATO Integrated Client Account/.test(r) && /\|1,220\.00$/.test(r))
      && /\$1,220 payable to the ATO/.test(d1.sub) && d1.amt === "1220.00" && d1.lodgeShown === "", d1);
    await p.fill("#acstDate", "2027-01-15"); await p.check("#acstPaid"); await p.fill("#acstAmt", "1000"); await p.fill("#acstPaidOn", "2027-01-20");
    await p.click("#acDlgOk"); await p.waitForFunction(() => !document.getElementById("acDlg").open, null, { timeout: 5000 });
    await p.waitForFunction(() => /BAS 2026-10-01 - 2026-12-31 in the books .* and paid: \$1,000\.00/.test(document.getElementById("acMsg").textContent), null, { timeout: 5000 }).catch(() => {});
    const m1 = await ev(() => document.getElementById("acMsg").textContent);
    const j1 = await ev(async (biz) => (await (await fetch("/api/accounts?biz=" + biz)).json()).journals.filter((j) => j.settle).map((j) => j.settle.kind + ":" + j.date), BIZ);
    check("saved: the BAS lodged on the 15th + $1,000 paid on the 20th (two entries); the message says so", /in the books/.test(m1) && /paid: \$1,000\.00/.test(m1) && j1.join() === "bas:2027-01-15,ato:2027-01-20", { m1, j1 });
    await p.waitForTimeout(800);
    await ev(() => H3Accounts.show("bas")); await p.waitForSelector("[data-settlebas]");
    await p.click("[data-settlebas]"); await p.waitForSelector("#acstPlan .acnote");
    const d2 = await ev(() => ({ note: document.querySelector("#acstPlan .acnote").textContent, amt: document.getElementById("acstAmt").value, paid: document.getElementById("acstPaid").checked, lodge: document.getElementById("acstLodgeRow").style.display }));
    check("opened again: 'already in the books', $220 still owed, a payment only (ticked, $220.00)", /already in the books/.test(d2.note) && /\$220\.00/.test(d2.note) && d2.amt === "220.00" && d2.paid && d2.lodge === "none", d2);
    await p.fill("#acstPaidOn", "2027-02-01"); await p.click("#acDlgOk"); await p.waitForFunction(() => !document.getElementById("acDlg").open, null, { timeout: 5000 });
    const owed = await ev(async (biz) => (await (await fetch("/api/accounts/settle/ato?biz=" + biz + "&from=2026-10-01&to=2026-12-31&basis=accrual")).json()).atoBalance, BIZ);
    check("...the rest paid: nothing owed to the ATO", owed === 0, owed);
    // 💵 Pay super
    await p.waitForTimeout(800);
    await p.click("#acPaySuper"); await p.waitForSelector("#acsuPlan .acsub");
    await p.fill("#acsuDate", "2027-01-25"); await p.dispatchEvent("#acsuDate", "change"); await p.waitForTimeout(600);
    const s1 = await ev(() => ({ sub: document.querySelector("#acsuPlan .acsub").textContent, rows: [...document.querySelectorAll("#acsuPlan table tr")].slice(1).map((r) => r.textContent.replace(/\s+/g, " ").trim()), amt: document.getElementById("acsuAmt").value }));
    check("💵 Pay super: $180.00 owed (12 % of Sam's 1,500), Sam's pay runs listed, the amount filled in", /Super owed on 2027-01-25: \$180\.00/.test(s1.sub) && s1.rows.some((r) => /^Sam ?180\.00$/.test(r)) && s1.amt === "180.00", s1);
    await p.fill("#acsuFund", "SuperClear"); await p.click("#acDlgOk"); await p.waitForFunction(() => !document.getElementById("acDlg").open, null, { timeout: 5000 });
    await p.waitForTimeout(400);
    const m2 = await ev(() => document.getElementById("acMsg").textContent);
    const left = await ev(async (biz) => (await (await fetch("/api/accounts/settle/super?biz=" + biz + "&at=2027-01-31")).json()), BIZ);
    check("...saved: 'super paid: $180.00 to SuperClear', nothing owed after, paid last on the 25th", /super paid: \$180\.00 to SuperClear/.test(m2) && left.owed === 0 && left.since === "2027-01-25", { m2, left });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran: " + e.message, false); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
