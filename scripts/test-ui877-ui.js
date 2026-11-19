#!/usr/bin/env node
/* bitGen Studio — 2.877.0 in a REAL browser: 📒 the Accounts docker on the top bar's app strip; a receipt (with its picture), a
 * bill to pay and an invoice we sent typed in its dialog (GST worked out as typed); 💵 money received on the invoice; a general
 * journal entry; the documents' filters; the Summary (owed to us / we owe, overdue); the journals, the ledger's running balance,
 * the trial balance + balance sheet in balance, the BAS worksheet (accrual + cash); a job's totals; the green columnar pad.
 * Tim (verbatim): "I think one more docker for Accounting - allow user to upload receipts, invoices to pay, invoices paid to us,
 * invoice due to be paid, invoices due to be paid to us, get the total due , the company jobs etc and total due, gst etc.(use au
 * tax system ... give the layout the old accounting style aesthetic, with journals, ledger, balance sheet, bas statement ..." */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os");
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
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII=", "base64");
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ui877-")); fs.writeFileSync(path.join(tmp, "receipt.png"), PNG);
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const BIZ = "ui877" + Date.now().toString(36);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Accounts && document.getElementById("acctdock"), null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    const strip = await ev(() => { const b = document.getElementById("tX_acctdock"); return { btn: !!b, inStrip: !!(b && b.closest("#appGrp1")), icon: b && b.textContent }; });
    check("📒 Accounts on the top bar's app strip (icon only)", strip.btn && strip.inStrip && strip.icon === "📒", strip);
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); });
    await p.click("#tX_acctdock"); await p.waitForTimeout(500);
    await ev((biz) => { const d = document.getElementById("acctdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1700px;height:1000px;z-index:9999"; H3Accounts.state().biz = biz; H3Accounts.state().per = "all"; document.getElementById("acPer").value = "all"; return H3Accounts.refresh(); }, BIZ);
    await p.waitForTimeout(600);
    const look = await ev(() => { const P = document.getElementById("acPaper"), cs = getComputedStyle(P); return { bg: cs.backgroundColor, img: cs.backgroundImage.includes("repeating-linear-gradient"), tabs: [...document.querySelectorAll("#acTabs button")].map((b) => b.textContent) }; });
    check("the old ledger look: a pale green columnar pad with ruled lines; index-card tabs Summary … Accounts",
      look.img && /rgb\(238, 244, 228\)/.test(look.bg) && look.tabs.join("|") === "Summary|Documents|Journals|Ledger|Trial Balance|Profit & Loss|Balance Sheet|BAS|Jobs|Accounts", look);
    // a job first
    await ev(() => H3Accounts.show("jobs")); await p.waitForSelector("#acJobCode");
    await p.fill("#acJobCode", "smith-01"); await p.fill("#acJobName", "Smith kitchen"); await p.fill("#acJobClient", "J Smith"); await p.click("#acJobAdd");
    await p.waitForFunction(() => document.querySelector("#acPaper").textContent.includes("SMITH-01"), null, { timeout: 5000 });
    // ＋ Invoice we sent
    await p.click("#acNewInvoice"); await p.waitForSelector("#acfParty");
    await p.fill("#acfParty", "J Smith"); await p.fill("#acfDate", "2026-10-05"); await p.fill("#acfDue", "2026-10-19"); await p.selectOption("#acfJob", "SMITH-01");
    await p.fill('#acfLines [data-k="desc"]', "Kitchen fit-out"); await p.fill('#acfLines [data-k="unit"]', "11000");   // 2.878.0: an invoice line = qty x unit price
    const tot1 = await ev(() => ({ t: document.getElementById("acfTot").textContent, gst: document.querySelector("#acfLines [data-gst]").textContent, tax: document.querySelector('#acfLines [data-k="tax"]').value, acc: document.querySelector('#acfLines [data-k="account"]').value, x: !!document.querySelector("#acDlg > .h3dlgx, #acDlg .h3dlgx") }));
    check("＋ Invoice we sent: the dialog works out GST as you type (11,000.00 incl. = 1,000.00 GST, Services Income, GST 10 %), a ✕ top right",
      /Total \$11,000\.00 · GST \$1,000\.00 · without GST \$10,000\.00/.test(tot1.t) && tot1.gst === "1,000.00" && tot1.tax === "GST" && tot1.acc === "4200" && tot1.x, tot1);
    await p.click("#acDlgOk"); await p.waitForFunction(() => !document.getElementById("acDlg").open, null, { timeout: 5000 });
    // ＋ Bill to pay
    await p.click("#acNewBill"); await p.waitForSelector("#acfParty");
    await p.fill("#acfParty", "Timber Co"); await p.fill("#acfNo", "T-55"); await p.fill("#acfDate", "2026-10-06"); await p.fill("#acfDue", "2026-11-05"); await p.selectOption("#acfJob", "SMITH-01");
    await p.selectOption('#acfLines [data-k="account"]', "5100"); await p.fill('#acfLines [data-k="desc"]', "Timber"); await p.fill('#acfLines [data-k="amount"]', "2200");
    await p.click("#acDlgOk"); await p.waitForFunction(() => !document.getElementById("acDlg").open, null, { timeout: 5000 });
    // ＋ Receipt with its picture and two lines (a capital purchase + GST-free bank fees)
    await p.click("#acNewReceipt"); await p.waitForSelector("#acfParty");
    await p.fill("#acfParty", "Officeworks"); await p.fill("#acfDate", "2026-10-07");
    await p.selectOption('#acfLines [data-k="account"]', "1700"); await p.fill('#acfLines [data-k="desc"]', "Laptop"); await p.fill('#acfLines [data-k="amount"]', "1650");
    await p.click("#acfAdd"); const last = "#acfLines tr:last-child ";
    await p.selectOption(last + '[data-k="account"]', "6110"); await p.fill(last + '[data-k="desc"]', "Card fee"); await p.fill(last + '[data-k="amount"]', "5");
    const tot2 = await ev(() => ({ t: document.getElementById("acfTot").textContent, taxes: [...document.querySelectorAll('#acfLines [data-k="tax"]')].map((s) => s.value) }));
    check("＋ 🧾 Receipt: two lines - Computer Equipment takes Capital purchase (GST), Bank Fees GST-free; 1,655.00 with 150.00 GST",
      tot2.taxes.join() === "CAP,FRE" && /Total \$1,655\.00 · GST \$150\.00/.test(tot2.t), tot2);
    await p.setInputFiles("#acfFile", path.join(tmp, "receipt.png")); await p.waitForFunction(() => /receipt\.png/.test(document.getElementById("acfFileName").textContent));
    await p.click("#acDlgOk"); await p.waitForFunction(() => !document.getElementById("acDlg").open, null, { timeout: 5000 });
    // a general journal entry: the owner puts money in
    await p.click("#acNewJournal"); await p.waitForSelector("#acjDate");
    await p.fill("#acjDate", "2026-10-01"); await p.fill("#acjMemo", "capital introduced");
    await p.selectOption('#acjLines tr:nth-child(2) [data-k="account"]', "1100"); await p.fill('#acjLines tr:nth-child(2) [data-k="dr"]', "10000");
    await p.selectOption('#acjLines tr:nth-child(3) [data-k="account"]', "3100"); await p.fill('#acjLines tr:nth-child(3) [data-k="cr"]', "9000");
    await p.click("#acDlgOk"); await p.waitForTimeout(400);
    const unb = await ev(() => ({ open: document.getElementById("acDlg").open, e: document.getElementById("acDlgE").textContent }));
    check("a journal entry that does not balance is refused with why (the dialog stays)", unb.open && /must be equal/.test(unb.e), unb);
    await p.fill('#acjLines tr:nth-child(3) [data-k="cr"]', "10000"); await p.click("#acDlgOk"); await p.waitForFunction(() => !document.getElementById("acDlg").open, null, { timeout: 5000 });
    // documents
    await ev(() => H3Accounts.refresh().then(() => H3Accounts.show("docs"))); await p.waitForSelector("[data-filter]");
    const docs = await ev(() => [...document.querySelectorAll("#acPaper tr[data-doc]")].map((tr) => tr.textContent));
    check("Documents: the invoice numbered INV-0001, the bill, the receipt (📎, paid)", docs.length === 3 && docs.some((t) => /INV-0001/.test(t) && /J Smith/.test(t)) && docs.some((t) => /Officeworks/.test(t) && /paid/.test(t)), docs);
    // 💵 money received on the invoice: half
    await ev(() => { const tr = [...document.querySelectorAll("#acPaper tr[data-doc]")].find((t) => /INV-0001/.test(t.textContent)); tr.querySelector("[data-pay]").click(); });
    await p.waitForSelector("#acpAmt"); const owing = await ev(() => document.getElementById("acpAmt").value);
    await p.fill("#acpDate", "2026-10-20"); await p.fill("#acpAmt", "5500"); await p.click("#acDlgOk"); await p.waitForFunction(() => !document.getElementById("acDlg").open, null, { timeout: 5000 });
    await ev(() => H3Accounts.show("docs")); await p.waitForTimeout(300);
    await p.click('[data-filter="owedToUs"]'); await p.waitForTimeout(300);
    const owed = await ev(() => [...document.querySelectorAll("#acPaper tr[data-doc]")].map((tr) => tr.textContent));
    check("💵 Money received (offered the 11,000.00 owing): 5,500 in - Due to be paid to us shows the invoice with 5,500.00 left, overdue", owing === "11000.00" && owed.length === 1 && /5,500\.00/.test(owed[0]) && /overdue/.test(owed[0]), { owing, owed });
    const file = await ev(async () => { const d = H3Accounts.state().books.docs.find((x) => x.kind === "receipt"); const r = await fetch("/api/accounts/file/" + d.file + "?biz=" + H3Accounts.state().biz); return { name: d.file, ok: r.ok, type: r.headers.get("content-type") }; });
    check("📎 the receipt's picture is kept beside the books and opens", file.ok && /\.png$/.test(file.name) && /image\/png/.test(file.type), file);
    // summary
    await ev(() => H3Accounts.show("summary")); await p.waitForSelector(".accard");
    const sum = await ev(() => [...document.querySelectorAll(".accard")].map((c) => c.textContent));
    check("Summary: the bank 13,845.00 (10,000 in − 1,655 receipt + 5,500 received), owed to us 5,500.00 overdue, we owe 2,200.00",
      sum.some((t) => /Business Bank Account/.test(t) && /13,845\.00/.test(t)) && sum.some((t) => /Owed to us/.test(t) && /5,500\.00/.test(t) && /overdue/.test(t)) && sum.some((t) => /We owe/.test(t) && /2,200\.00/.test(t)), sum);
    if (SHOTS) await p.locator("#acctdock").screenshot({ path: path.join(SHOTS, "accounts-summary.png") });
    // journals
    await ev(() => H3Accounts.show("journals")); await p.waitForSelector("#acJnl");
    const sj = await ev(() => document.getElementById("acPaper").innerText);
    check("Sales Journal: Accounts Receivable Dr 11,000 to Services Income 10,000 + GST Collected 1,000, 'To' indented, (being …)", /Accounts Receivable/.test(sj) && /To Services Income/.test(sj) && /To GST Collected/.test(sj) && /\(being/.test(sj), sj.slice(0, 500));
    if (SHOTS) await p.locator("#acctdock").screenshot({ path: path.join(SHOTS, "accounts-journal.png") });
    // ledger
    await ev(() => { H3Accounts.state().account = "1100"; return H3Accounts.show("ledger"); }); await p.waitForSelector("#acAcc");
    const led = await ev(() => [...document.querySelectorAll("#acPaper tr")].map((tr) => tr.innerText.replace(/\s+/g, " ")));
    check("Ledger 1100: Balance b/d, running balance 10,000 → 8,345 → 13,845… Balance c/d 13,845.00", /Balance b\/d/.test(led[1]) && /8,345\.00$/.test(led[3]) && /Balance c\/d/.test(led[led.length - 1]) && /13,845\.00/.test(led[led.length - 1]), led);
    // TB + BS
    await ev(() => H3Accounts.show("tb")); await p.waitForTimeout(300);
    const tb = await ev(() => document.getElementById("acPaper").innerText);
    await ev(() => H3Accounts.show("bs")); await p.waitForTimeout(300);
    const bs = await ev(() => document.getElementById("acPaper").innerText);
    check("Trial Balance in balance; Balance Sheet balances (net assets = equity incl. current year earnings)", /in balance/i.test(tb) && !/out of balance/i.test(tb) && /balances/i.test(bs) && !/does not/i.test(bs) && /Current Year Earnings/.test(bs), { tb: tb.slice(-200), bs: bs.slice(-300) });
    if (SHOTS) await p.locator("#acctdock").screenshot({ path: path.join(SHOTS, "accounts-balance-sheet.png") });
    // BAS
    await ev(() => { H3Accounts.state().per = "custom"; document.getElementById("acFrom").value = "2026-10-01"; document.getElementById("acTo").value = "2026-12-31"; H3Accounts.state().basis = "accrual"; return H3Accounts.show("bas"); });
    await p.waitForSelector(".acbas");
    const fig = () => ev(() => Object.fromEntries([...document.querySelectorAll(".acbas .box")].filter((b) => b.querySelector(".cd")).map((b) => [b.querySelector(".cd").textContent, b.querySelector(".fig").textContent])));
    const acc = await fig(), accV = await ev(() => document.querySelector(".acbas").innerText);
    check("BAS accrual: G1 $11,000, G10 $1,650, G11 $2,205, 1A $1,000, 1B $350 -> $650 payable",
      acc.G1 === "$11,000" && acc.G10 === "$1,650" && acc.G11 === "$2,205" && acc["1A"] === "$1,000" && acc["1B"] === "$350" && /\$650 payable to the ATO/.test(accV), { acc, accV });
    if (SHOTS) await p.locator("#acctdock").screenshot({ path: path.join(SHOTS, "accounts-bas.png") });
    await p.selectOption("#acBasis", "cash"); await p.waitForTimeout(400);
    const cash = await fig();
    check("BAS cash basis: only what was paid - G1 $5,500, 1A $500; the bill unpaid is out (G11 $5, 1B $150 from the receipt)", cash.G1 === "$5,500" && cash["1A"] === "$500" && cash.G11 === "$5" && cash["1B"] === "$150", cash);
    // jobs
    await ev(() => { H3Accounts.state().per = "all"; return H3Accounts.show("jobs"); }); await p.waitForTimeout(300);
    const job = await ev(() => [...document.querySelectorAll("#acPaper tr")].map((tr) => tr.innerText.replace(/\s+/g, " ")).find((t) => /SMITH-01/.test(t)));
    check("Jobs: SMITH-01 income 10,000.00, costs 2,000.00, profit 8,000.00, owed to us 5,500.00, we owe 2,200.00", /10,000\.00/.test(job) && /2,000\.00/.test(job) && /8,000\.00/.test(job) && /5,500\.00/.test(job) && /2,200\.00/.test(job), job);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran: " + e.message, false); }
  finally {
    try { fs.rmSync(path.join(process.env.H3_ROOT || "/tmp/t819", "accounting", BIZ), { recursive: true, force: true }); } catch { /* left */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
