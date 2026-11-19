#!/usr/bin/env node
/* bitGen Studio — 2.880.0 in a REAL browser: 📒 Accounts ▸ ＋ ✨ Read a receipt… with a PDF bill (made here) - its first page drawn
 * to a PNG and sent to /api/accounts/read (answered by this test with what the vision model would say, checked by
 * lib/receiptRead.js toDraft), the bill dialog filled (supplier, number, dates, the line, account, GST, the file kept) to check +
 * Save; ✨ Read it inside the receipt dialog; ⤓ CSV of the documents (a .csv download); 🖨 the BAS worksheet page.
 * Tim (verbatim): "next" (2.880.0: read a receipt with the vision LLM + BAS print + CSV) */
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
const R = require("../lib/receiptRead");
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ui880-"));
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1800, height: 1100 }, acceptDownloads: true }), p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const BIZ = "ui880" + Date.now().toString(36);
  try {
    // a PDF bill, made by the browser
    const mk = await ctx.newPage(); await mk.setContent("<h1>Timber Co</h1><p>Tax invoice T-901 · 01/11/2026 · due 30/11/2026</p><p>Pine framing $2,200.00 incl. GST $200.00</p>");
    fs.writeFileSync(path.join(tmp, "bill.pdf"), await mk.pdf({ format: "A4" })); await mk.close();
    const seen = [];
    await p.route("**/api/accounts/read", async (route) => {
      const body = JSON.parse(route.request().postData() || "{}"); seen.push({ head: String(body.file || "").slice(0, 22), len: String(body.file || "").length, name: body.name });
      const answer = seen.length === 1 ? { kind: "bill", supplier: "Timber Co", number: "T-901", date: "01/11/2026", due: "30/11/2026", total: "2,200.00", gst: 200, lines: [{ description: "Pine framing", amount: 2200 }], category: "timber" }
        : { kind: "receipt", supplier: "Ampol Highfields", date: "03/11/2026", total: 66, gst: 6, category: "fuel" };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(Object.assign(R.toDraft(answer), { raw: JSON.stringify(answer) })) });
    });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Accounts && window.H3Layouts && document.getElementById("acctdock"), null, { timeout: 60000 });
    await p.waitForTimeout(3400);
    await ev(() => { if (H3Layouts.isOff({ kind: "dock", id: "acctdock" })) H3Layouts.set({ kind: "dock", id: "acctdock" }, false); });
    await p.waitForTimeout(300);
    await ev((biz) => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("acctdock"); if (d.classList.contains("dockgone")) document.getElementById("tX_acctdock").click(); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1700px;height:1000px;z-index:9999"; const S = H3Accounts.state(); S.biz = biz; S.per = "all"; document.getElementById("acPer").value = "all"; return H3Accounts.refresh(); }, BIZ);
    await p.waitForTimeout(400);
    // ＋ ✨ Read a receipt… with the PDF
    await p.setInputFiles("#acReadFile", path.join(tmp, "bill.pdf"));
    await p.waitForSelector("#acfParty", { timeout: 20000 }); await p.waitForTimeout(300);
    const f1 = await ev(() => ({ t: document.getElementById("acDlgT").textContent, party: document.getElementById("acfParty").value, no: document.getElementById("acfNo").value, date: document.getElementById("acfDate").value, due: document.getElementById("acfDue").value,
      acc: document.querySelector('#acfLines [data-k="account"]').value, amt: document.querySelector('#acfLines [data-k="amount"]').value, tax: document.querySelector('#acfLines [data-k="tax"]').value, tot: document.getElementById("acfTot").textContent,
      file: document.getElementById("acfFileName").textContent, note: [...document.querySelectorAll("#acDlg .acnote")].map((x) => x.textContent).join("|") }));
    check("the PDF's first page drawn to a PNG and sent to be read (a picture, not the PDF)", seen[0] && seen[0].head.startsWith("data:image/png;base64") && seen[0].len > 2000 && seen[0].name === "bill.pdf", seen);
    check("the bill dialog filled: Timber Co, T-901, 01/11/2026 due 30/11/2026, Purchases and Materials, $2,200.00 incl. $200.00 GST, the PDF kept, 'check it before you save'",
      f1.t === "New bill to pay" && f1.party === "Timber Co" && f1.no === "T-901" && f1.date === "2026-11-01" && f1.due === "2026-11-30" && f1.acc === "5100" && f1.amt === "2200.00" && f1.tax === "GST"
      && /Total \$2,200\.00 · GST \$200\.00/.test(f1.tot) && /bill\.pdf/.test(f1.file) && /check it before you save/.test(f1.note), f1);
    await p.click("#acDlgOk"); await p.waitForFunction(() => !document.getElementById("acDlg").open, null, { timeout: 5000 });
    const kept = await ev(() => H3Accounts.refresh().then(() => { const d = H3Accounts.state().books.docs.find((x) => x.party === "Timber Co"); return d && { kind: d.kind, total: d.total, file: d.file }; }));
    check("Save: the bill in the books with the PDF attached", kept && kept.kind === "bill" && kept.total === 220000 && /\.pdf$/.test(kept.file), kept);
    // ✨ Read it inside the receipt dialog
    await p.click("#acNewReceipt"); await p.waitForSelector("#acfRead");
    const dis = await ev(() => document.getElementById("acfRead").disabled);
    fs.writeFileSync(path.join(tmp, "fuel.png"), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII=", "base64"));
    await p.setInputFiles("#acfFile", path.join(tmp, "fuel.png")); await p.waitForFunction(() => !document.getElementById("acfRead").disabled);
    await p.click("#acfRead"); await p.waitForFunction(() => document.getElementById("acfParty").value === "Ampol Highfields", null, { timeout: 10000 });
    const f2 = await ev(() => ({ acc: document.querySelector('#acfLines [data-k="account"]').value, amt: document.querySelector('#acfLines [data-k="amount"]').value, file: document.getElementById("acfFileName").textContent }));
    check("✨ Read it (off until a file is attached) fills the receipt: Ampol Highfields, Motor Vehicle Expenses, $66.00, the picture kept", dis === true && f2.acc === "6150" && f2.amt === "66.00" && /fuel\.png/.test(f2.file) && seen.length === 2, f2);
    await p.click("#acDlgCancel");
    // ⤓ CSV + 🖨 BAS
    await ev(() => H3Accounts.show("docs")); await p.waitForSelector("[data-csv]");
    const [dl] = await Promise.all([p.waitForEvent("download"), ev(() => { const a = document.querySelector("[data-csv]"); window.__open = window.open; window.open = (u) => { const l = document.createElement("a"); l.href = u; l.download = ""; document.body.appendChild(l); l.click(); l.remove(); return null; }; a.click(); })]);
    const csvText = fs.readFileSync(await dl.path(), "utf8");
    check("⤓ CSV: the documents as a .csv download (the bill's row)", /\.csv$/.test(dl.suggestedFilename()) && /^﻿?Kind,Number,Date/.test(csvText) && /Timber Co/.test(csvText) && /2200\.00/.test(csvText), { name: dl.suggestedFilename(), csv: csvText.slice(0, 300) });
    await ev(() => { window.open = window.__open; H3Accounts.state().basis = "accrual"; return H3Accounts.show("bas"); }); await p.waitForSelector("[data-basprint]");
    const [pop] = await Promise.all([ctx.waitForEvent("page"), ev(() => document.querySelector("[data-basprint]").click())]);
    await pop.waitForLoadState("load");
    const bas = await pop.evaluate(() => document.querySelector(".sheet").innerText);
    check("🖨 the BAS worksheet page: G11 $2,200 + 1B $200 from the bill, a refund of $200, 'not the lodged statement'", /G11\s*\$2,200/.test(bas) && /1B\s*\$200/.test(bas) && /\$200 refund from the ATO/.test(bas) && /not the lodged statement/.test(bas), bas.slice(0, 600));
    await pop.close();
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran: " + e.message, false); }
  finally {
    try { fs.rmSync(path.join(process.env.H3_ROOT || "/tmp/t819", "accounting", BIZ), { recursive: true, force: true }); } catch { /* left */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
