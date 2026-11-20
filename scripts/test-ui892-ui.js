#!/usr/bin/env node
/* bitGen Studio — 2.892.0 in a REAL browser: 📒 Accounts ▸ 🏦 Bank extras - ✚ Make… ▸ Split over several accounts (the parts, "left
 * to split", + a part, the receipt made with a line each), ↔ the transfer suggested from the other account's statement and made once
 * (matched on both, ↔ shown), ⚙ Rules… (listed, ✎ the words cut so another store is caught, 🗑 deleted).
 * Tim (verbatim): "continue next" (parked: "🏦 Bank extras ...") */
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
  const BIZ = "ui892" + Date.now().toString(36);
  const closed = () => p.waitForFunction(() => !document.getElementById("acDlg").open, null, { timeout: 6000 });
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
      const imp = (account, text, name) => fetch("/api/accounts/bank/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ biz, account, text, name }) });
      await imp("1100", '05/08/2026,"-110.00","OFFICEWORKS 0123 SYDNEY",""\n06/08/2026,"-500.00","TRANSFER TO SAVINGS",""\n07/08/2026,"-220.00","OFFICEWORKS 0456 PARRAMATTA",""\n', "main.csv");
      await imp("1120", '07/08/2026,"+500.00","TRANSFER FROM BUSINESS",""\n', "sav.csv");
      H3Accounts.state().bankAcc = "1100";
      await H3Accounts.refresh(); await H3Accounts.show("bank");
    }, BIZ);
    await p.waitForSelector("#acBankRules");
    // ↔ the transfer
    const x = await ev(() => [...document.querySelectorAll("[data-bxfer]")].map((b) => b.textContent));
    check("the $500 out has '↔ Transfer to 1120 Savings Account (2026-08-07)' - the line on the savings statement", x.length === 1 && /↔ Transfer to 1120 Savings Account \(2026-08-07\)/.test(x[0]), x);
    await p.click("[data-bxfer]");
    await p.waitForFunction(() => /matched on both statements \(1120 2026-08-07\)/.test(document.getElementById("acMsg").textContent), null, { timeout: 8000 });
    await p.click('[data-bfilter="matched"]'); await p.waitForSelector(".bank-twin");
    const tw = await ev(() => document.querySelector(".bank-twin").textContent);
    await p.selectOption("#acBankAcc", "1120"); await p.waitForFunction(() => document.getElementById("acBankAcc").value === "1120" && document.querySelector(".bank-twin"), null, { timeout: 6000 });
    const tw2 = await ev(() => ({ twin: document.querySelector(".bank-twin").textContent, st: document.querySelector(".bank-tab .acstamp").textContent }));
    check("↔ shown both sides: '↔ 1120 2026-08-07' on the business account, '↔ 1100 2026-08-06' + matched by bitGen on the savings", /↔ 1120 2026-08-07/.test(tw) && /↔ 1100 2026-08-06/.test(tw2.twin) && /matched by bitGen/.test(tw2.st), { tw, tw2 });
    await p.selectOption("#acBankAcc", "1100"); await p.waitForFunction(() => document.getElementById("acBankAcc").value === "1100", null, { timeout: 6000 });
    await p.click('[data-bfilter="open"]'); await p.waitForSelector(".bank-tab tr[data-bline]");
    // ✚ Split
    await p.click('.bank-tab tr[data-bline]:has-text("0123") [data-bmake]:not(.bank-sug)'); await p.waitForSelector("#acbAs");
    await p.selectOption("#acbAs", "split");
    const f0 = await ev(() => ({ parts: document.querySelectorAll("#acbParts tr.acb-part").length, left: document.getElementById("acbLeft").textContent, vis: getComputedStyle(document.getElementById("acbParts").closest("[data-for]")).display !== "none", acc: getComputedStyle(document.getElementById("acbAcc")).display }));
    check("✚ Make… ▸ Split: 2 parts (the first with the whole $110.00), '✔ adds up'", f0.parts === 2 && f0.vis && f0.left === "✔ adds up", f0);
    const fill = async (i, acc, amt) => { const row = p.locator("#acbParts tr.acb-part").nth(i); await row.locator('[data-k="account"]').selectOption(acc); await row.locator('[data-k="amount"]').fill(amt); };
    await fill(0, "6160", "66");
    const left1 = await ev(() => document.getElementById("acbLeft").textContent);
    await fill(1, "6120", "33");
    await p.click("[data-partadd]"); await fill(2, "6110", "11");
    const f1 = await ev(() => ({ left: document.getElementById("acbLeft").textContent, tax: [...document.querySelectorAll('#acbParts [data-k="tax"]')].map((s) => s.value).join() }));
    check("the parts: 'left to split $44.00' after the first, + a part, '✔ adds up'; each part's tax from its account (GST, GST, GST-free)", /left to split \$44\.00/.test(left1) && f1.left === "✔ adds up" && f1.tax === "GST,GST,FRE", { left1, f1 });
    await p.fill("#acbParty", "Officeworks");
    await p.click("#acDlgOk"); await closed();
    const rc = await ev(() => { const r = H3Accounts.state().books.docs.find((d) => d.kind === "receipt" && d.party === "Officeworks"); return r && [r.lines.length, r.total, r.gst, r.paidFrom].join(); });
    check("...saved: one paid receipt, 3 lines, $110.00 with $9.00 GST, from 1100", rc === "3,11000,900,1100", rc);
    // ⚙ Rules
    await p.click("#acBankRules"); await p.waitForSelector(".bank-rules");
    const r0 = await ev(() => ({ t: document.getElementById("acDlgT").textContent, rows: [...document.querySelectorAll(".bank-rules tr")].slice(1).map((r) => r.textContent) }));
    check("⚙ Rules…: 'officeworks sydney' (split 60 % / 30 % / 10 %) and 'transfer to savings' (→ 1120) listed", r0.t === "⚙ Bank rules" && r0.rows.length === 2 && r0.rows.some((r) => /officeworks sydney.*Split.*60 % 6160 \+ 30 % 6120 \+ 10 % 6110/.test(r)) && r0.rows.some((r) => /transfer to savings.*1120/.test(r)), r0);
    const i = await ev(() => [...document.querySelectorAll(".bank-rules tr")].slice(1).findIndex((r) => /officeworks/.test(r.textContent)));
    await p.click(`[data-redit="${i}"]`); await p.waitForSelector("#acbRKey");
    const ed = await ev(() => ({ as: document.getElementById("acbRAs").value, pct: [...document.querySelectorAll('#acbRParts [data-k="pct"]')].map((x) => x.value).join(), left: document.getElementById("acbRLeft").textContent }));
    check("✎ opens the split rule: Makes 'a split', 60 / 30 / 10, '✔ 100 %'", ed.as === "split" && ed.pct === "60,30,10" && ed.left === "✔ 100 %", ed);
    await p.fill("#acbRKey", "officeworks"); await p.click("#acbRSave");
    await p.waitForFunction(() => !document.getElementById("acbRKey") && [...document.querySelectorAll(".bank-rules tr")].some((r) => /^officeworksmoney out/.test(r.textContent)), null, { timeout: 6000 });
    const waiting = await ev(() => [...document.querySelectorAll(".bank-rules tr")].find((r) => /^officeworks/.test(r.textContent)).querySelector("td.n").textContent);
    check("💾 the words cut to 'officeworks': saved, and the Parramatta line now waits for it (1)", waiting === "1", waiting);
    const j = await ev(() => [...document.querySelectorAll(".bank-rules tr")].slice(1).findIndex((r) => /transfer to savings/.test(r.textContent)));
    await p.click(`[data-rdel="${j}"]`);
    const sure = await ev((k) => document.querySelector(`[data-rdel="${k}"]`).textContent, j);
    await p.click(`[data-rdel="${j}"]`);
    await p.waitForFunction(() => document.querySelectorAll(".bank-rules tr").length === 2, null, { timeout: 6000 });
    check("🗑 asks 'Delete?' then deletes the transfer rule", sure === "Delete?", sure);
    await p.click("#acDlgOk"); await closed();
    await p.waitForSelector(".bank-tab [data-bmake].bank-sug");
    const sg = await ev(() => [...document.querySelectorAll(".bank-tab [data-bmake].bank-sug")].map((x) => x.textContent));
    check("the $220 Parramatta line: '✚ Split over 3 accounts (as before)'", sg.length === 1 && /Split over 3 accounts \(as before\)/.test(sg[0]), sg);
    await p.click(".bank-tab [data-bmake].bank-sug"); await p.waitForSelector("#acbParts");
    const pre = await ev(() => ({ as: document.getElementById("acbAs").value, amts: [...document.querySelectorAll('#acbParts [data-k="amount"]')].map((x) => x.value).join(), left: document.getElementById("acbLeft").textContent }));
    check("...it opens as a split with $132.00 / $66.00 / $22.00, '✔ adds up'", pre.as === "split" && pre.amts === "132.00,66.00,22.00" && pre.left === "✔ adds up", pre);
    await p.click("#acDlgOk"); await closed();
    await p.waitForFunction(() => /Nothing here/.test(document.getElementById("acPaper").textContent), null, { timeout: 6000 });
    check("everything on the statement is in the books now (To match: nothing)", true);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran: " + e.message, false); }
  finally {
    try { fs.rmSync(path.join(process.env.H3_ROOT || "/tmp/t819", "accounting", BIZ), { recursive: true, force: true }); } catch { /* left */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
