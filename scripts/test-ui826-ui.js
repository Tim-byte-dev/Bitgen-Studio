#!/usr/bin/env node
/* bitGen Studio — 2.826.0 against the RUNNING app (+ a real browser): ▦ 📌 Constants. Tim: "add a button for constants in
 * spreadsheet, this will show a dialog - type - price - duration, start date eg rent - 540 - week 13/01/2026 - show a list of
 * the constants and use the newest date, so if rent was 540/wk for 1 year then changed to 580/wk it will remember all the
 * transactions for the year and enter the new amount from the next start date etc."
 *   📌 Constants ▸ Rent 540 / week from 13/01/2026 ▸ ⟳ Bring up to date (to 30/06/2026): a Ledger sheet made, 25 entries shown
 *   first, ✔ Apply = Date / Description / Category / Expense / a running Balance / Ref; one undo
 *   580 from 14/04/2026 (back in time): the 12 entries from then listed and corrected; the list shows both amounts
 *   Wages (income, fortnightly) go in date order among the rent rows and a hand-typed one; the balance runs right
 *   an end date: the wages after it are listed and removed only when ticked
 *   =Rent / CONST() in a cell; 💾 Save + 📂 Open keep the constants. H3_SHOTS=<dir> saves pictures. No Playwright = SKIP. */
"use strict";
const path = require("path"), fs = require("fs");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/", SHOTS = process.env.H3_SHOTS || "";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, x) => p.evaluate(f, x);
  const shot = async (n) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, n + ".png") }); } };
  const sheetIs = (name) => ev((n) => window.H3Sheet.W.sheets.findIndex((s) => s.name === n), name);
  const S = (name, a) => ev(([n, a]) => { const H = window.H3Sheet, si = H.W.sheets.findIndex((s) => s.name === n), q = window.SheetCalc.parseAddr(a), v = H.book().get(si, q.c, q.r); return v && v.err ? v.err : v; }, [name, a]);
  const raw = (name, a) => ev(([n, a]) => { const s = window.H3Sheet.W.sheets.find((s) => s.name === n), c = s && s.cells[a]; return c ? c.v : ""; }, [name, a]);
  const shown = (name, a) => ev(([n, a]) => { const H = window.H3Sheet, si = H.W.sheets.findIndex((s) => s.name === n), act = H.W.active; H.W.active = si; const q = window.SheetCalc.parseAddr(a), t = H.shown(q.c, q.r); H.W.active = act; return t; }, [name, a]);
  const form = async (o) => {
    await p.fill("#sckName", o.name); await p.fill("#sckAmt", String(o.amount)); await p.selectOption("#sckEvery", o.every); await p.fill("#sckStart", o.start);
    if (o.desc != null) await p.fill("#sckDesc", o.desc);
    if (o.kind) await p.check(`[name="sckKind"][value="${o.kind}"]`);
    await p.fill("#sckEnd", o.end || "");
    await p.click("#sckAdd");
  };
  const planText = () => ev(() => document.getElementById("sckPlan").textContent.replace(/\s+/g, " "));
  const gone = [];
  try {
    await p.addInitScript(() => { try { localStorage.removeItem("h3.g.sheetdock"); localStorage.removeItem("h3.sheet.draft"); } catch (e) { /* fine */ } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Sheet && window.H3SheetConst, null, { timeout: 60000 });
    await p.$eval("#tX_sheetdock", (e) => e.click()); await p.waitForTimeout(400);
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { if (d.style.display !== "none") { d.dataset.t826 = d.style.display; d.style.display = "none"; } }); const d = document.getElementById("sheetdock"); d.dataset.t826css = d.getAttribute("style") || ""; d.style.cssText += ";position:fixed;left:10px;top:60px;width:1380px;height:820px;z-index:9999"; });
    await ev(() => window.H3Sheet.load({ sheets: [{ name: "Sheet1", cells: {} }], active: 0 }, "t826 constants"));

    // 📌 Constants: Rent 540 / week from 13/01/2026
    await p.click("#shConst"); await p.waitForSelector("#shConstDlg[open]");
    check("📌 Constants opens with no constants yet (the list says how to add one)", /No constants yet/.test(await ev(() => document.getElementById("sckList").textContent)));
    await form({ name: "Rent", amount: 540, every: "week", start: "2026-01-13", desc: "Rent payment", kind: "expense" });
    const l1 = await ev(() => document.getElementById("sckList").textContent.replace(/\s+/g, " "));
    check("＋ Add: Rent · Expense · $540 / week · 13/01/2026 in the list", /Rent/.test(l1) && /Expense \(paid\)/.test(l1) && /\$540 \/ week · 13\/01\/2026/.test(l1), l1);
    await p.fill("#sckTo", "2026-06-30"); await p.click("#sckSync");
    check("⟳ Bring up to date with no ledger: a Ledger sheet is made (Date, Description, Category, Income, Expense, Balance, Paid to - 2.827.0, Ref)", (await sheetIs("Ledger")) === 1 && (await raw("Ledger", "A1")) === "Date" && (await raw("Ledger", "G1")) === "Paid to" && (await raw("Ledger", "H1")) === "Ref");
    check("…and what it would do is shown first: 25 new entries up to 30/06/2026 (Rent × 25), nothing written yet", /25 new entries up to 30\/06\/2026: Rent × 25/.test(await planText()) && (await raw("Ledger", "A2")) === "" && (await ev(() => !document.getElementById("sckApply").hidden)), await planText());
    await p.click("#sckApply");
    check("✔ Apply: row 2 = 13/01/2026 · Rent payment · Rent · $540 expense · Balance -540 · 📌 Rent · 2026-01-13", (await shown("Ledger", "A2")) === "13/01/2026" && (await raw("Ledger", "B2")) === "Rent payment" && (await raw("Ledger", "C2")) === "Rent" && (await S("Ledger", "E2")) === 540 && (await S("Ledger", "F2")) === -540 && (await raw("Ledger", "H2")) === "📌 Rent · 2026-01-13" && (await raw("Ledger", "F2")) === "=SUM(D$2:D2)-SUM(E$2:E2)", [await shown("Ledger", "A2"), await raw("Ledger", "F2")]);
    check("…25 rows to 30/06/2026, the balance running to -13,500, the amounts shown as money", (await shown("Ledger", "A26")) === "30/06/2026" && (await raw("Ledger", "A27")) === "" && (await S("Ledger", "F26")) === -13500 && (await shown("Ledger", "E26")) === "$540.00", [await shown("Ledger", "A26"), await S("Ledger", "F26"), await shown("Ledger", "E26")]);
    await ev(() => window.H3Sheet.undo());
    check("…one Ctrl+Z takes the 25 entries out again", (await raw("Ledger", "A2")) === "" && (await raw("Ledger", "A26")) === "");
    await p.click("#sckSync"); await p.click("#sckApply");
    await shot("1-ledger");

    // the rent goes up - back in time
    await ev(() => document.querySelector('#sckList .k[data-k]').click());
    check("a click on Rent fills the form for a new amount (+ Add a new amount to Rent) and shows its amounts", (await ev(() => document.getElementById("sckAdd").textContent)) === "＋ Add a new amount to Rent" && (await ev(() => document.getElementById("sckName").value)) === "Rent");
    await form({ name: "Rent", amount: 580, every: "week", start: "2026-04-14" });
    const l2 = await ev(() => document.getElementById("sckList").textContent.replace(/\s+/g, " "));
    check("580 from 14/04/2026: the list shows $580 now, with 13/01/2026 - 13/04/2026 · $540 kept under it", /\$580 \/ week · 14\/04\/2026 \(2\)/.test(l2) && /13\/01\/2026 - 13\/04\/2026 · \$540 \/ week/.test(l2), l2);
    await p.click("#sckSync");
    const t2 = await planText();
    check("⟳: no new entries, the 12 from 14/04/2026 listed with their change ($540 → $580), Correct ticked", /No new entries/.test(t2) && /Correct 12 entries whose amount changed/.test(t2) && /Rent · 2026-04-14 · \$540 → \$580/.test(t2) && (await ev(() => document.getElementById("sckFix").checked)), t2);
    await p.click("#sckApply");
    check("…✔ Apply: 13 weeks stay 540, the 12 from 14/04 are 580; the balance follows (-14,700)", (await S("Ledger", "E14")) === 540 && (await S("Ledger", "E15")) === 580 && (await shown("Ledger", "A15")) === "14/04/2026" && (await S("Ledger", "F26")) === -(13 * 540 + 12 * 580), [await S("Ledger", "E14"), await S("Ledger", "E15"), await S("Ledger", "F26")]);

    // a hand-typed row + wages (income) in date order
    await ev(() => { const H = window.H3Sheet, si = H.W.sheets.findIndex((s) => s.name === "Ledger"); H.W.active = si; H._.step(); H.setRaw(0, 26, "2026-03-03"); H.setRaw(1, 26, "Plumber"); H.setRaw(4, 26, "120"); H.setRaw(5, 26, "=SUM(D$2:D27)-SUM(E$2:E27)"); H.St.book = null; H._.changed(); });
    await form({ name: "Wages", amount: 1000, every: "fortnight", start: "2026-01-02", desc: "Pay", kind: "income" });
    await p.click("#sckSync");
    check("Wages (income) 1000 / fortnight: 13 new entries", /13 new entries up to 30\/06\/2026: Wages × 13/.test(await planText()), await planText());
    await p.click("#sckApply");
    const order = await ev(() => { const H = window.H3Sheet, si = H.W.sheets.findIndex((s) => s.name === "Ledger"), b = H.book(), o = []; for (let r = 1; r < 60; r++) { const v = b.get(si, 1, r); if (v === "") break; o.push(v); } return o; });
    check("…everything in date order: Pay (2/01), Rent payment (13/01), Pay (16/01) … the Plumber (3/03) in its place", order[0] === "Pay" && order[1] === "Rent payment" && order[2] === "Pay" && order.length === 25 + 13 + 1 && order.includes("Plumber") && (await raw("Ledger", "D2")) === "1000", order.slice(0, 6));
    const tot = 13 * 1000 - 13 * 540 - 12 * 580 - 120;
    const fin = await ev(() => { const H = window.H3Sheet, si = H.W.sheets.findIndex((s) => s.name === "Ledger"), b = H.book(); let r = 1; while (b.get(si, 0, r + 1) !== "") r++; const rows = []; for (let y = 1; y <= r; y++) rows.push(b.get(si, 5, y)); return { last: b.get(si, 5, r), ok: rows.every((v) => typeof v === "number"), plumber: (() => { for (let y = 1; y <= r; y++) if (b.get(si, 1, y) === "Plumber") return H.W.sheets[si].cells[window.SheetCalc.addr(5, y)].v + " @" + (y + 1); })() }; });
    check("…the running balance is right to the last row (wages - rent - plumber), the plumber's own formula moved with its row", fin.last === tot && fin.ok && /^=SUM\(D\$2:D(\d+)\)-SUM\(E\$2:E\1\) @\1$/.test(fin.plumber), [fin, tot]);
    await shot("2-wages");

    // an end date: the wages after it no longer made
    await form({ name: "Wages", amount: 1000, every: "fortnight", start: "2026-01-02", end: "2026-03-31" });
    await p.click("#sckSync");
    const t3 = await planText();
    check("Wages end 31/03/2026: the 6 after it are listed as made by no constant, Remove NOT ticked", /Remove 6 entries no constant makes any more/.test(t3) && !(await ev(() => document.getElementById("sckStale").checked)), t3);
    await p.check("#sckStale"); await p.click("#sckApply");
    const pays = await ev(() => { const H = window.H3Sheet, si = H.W.sheets.findIndex((s) => s.name === "Ledger"), b = H.book(); let n = 0; for (let r = 1; r < 80; r++) if (b.get(si, 1, r) === "Pay") n++; return n; });
    check("…ticked + ✔ Apply: 7 pay entries left (to 27/03), the rest of the ledger closed up (33 rows)", pays === 7 && (await raw("Ledger", "A35")) === "" && (await raw("Ledger", "A34")) !== "", [pays, await raw("Ledger", "A34"), await raw("Ledger", "A35")]);

    // formulas, save + open
    await p.click('#shConstDlg [data-x]');
    await ev(() => { const H = window.H3Sheet; H.W.active = 0; H._.step(); H.setRaw(0, 0, "=Rent"); H.setRaw(0, 1, '=CONST("Rent",DATE(2026,2,1))'); H.setRaw(0, 2, "=Wages"); H.St.book = null; H._.changed(); });
    check("=Rent = 580 (today's amount), CONST(\"Rent\", 1/02/2026) = 540, =Wages = 0 (ended)", (await S("Sheet1", "A1")) === 580 && (await S("Sheet1", "A2")) === 540 && (await S("Sheet1", "A3")) === 0, [await S("Sheet1", "A1"), await S("Sheet1", "A2"), await S("Sheet1", "A3")]);
    await ev(() => { document.getElementById("shFile").value = "t826 constants"; }); await p.click("#shSave"); await p.waitForTimeout(600); gone.push("t826 constants.bgs");
    const f = await (await fetch(new URL("api/sheets/file?name=" + encodeURIComponent("t826 constants.bgs"), URL_))).json();
    check("💾 the workbook keeps the constants (both rent amounts, wages' end) and the ledger sheet", f.ledger && f.ledger.sheet === "Ledger" && f.constants.length === 2 && f.constants[0].rates.length === 2 && f.constants[1].end === "2026-03-31", { ledger: f.ledger, constants: f.constants });
    await ev(() => window.H3Sheet.load({ sheets: [{ name: "Sheet1", cells: {} }], active: 0 }, "Workbook"));
    check("a new workbook has none", (await ev(() => window.H3Sheet.W.constants.length)) === 0);
    await ev((d) => window.H3Sheet.load(d, "t826 constants"), f);
    check("📂 opened again: the constants back, =Rent works", (await ev(() => window.H3Sheet.W.constants.length)) === 2 && (await S("Sheet1", "A1")) === 580);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally {
    for (const n of gone) { try { await fetch(new URL("api/sheets/file?name=" + encodeURIComponent(n), URL_), { method: "DELETE" }); } catch (e) { /* fine */ } }
    try { await ev(() => { const d = document.getElementById("sheetdock"); d.style.cssText = d.dataset.t826css || ""; document.querySelectorAll("[data-t826]").forEach((x) => { x.style.display = x.dataset.t826; delete x.dataset.t826; }); localStorage.removeItem("h3.sheet.draft"); if (!d.classList.contains("dockgone")) toggleDockGone("sheetdock", "tX_sheetdock"); }); } catch (e) { /* fine */ }
    await b.close();
    console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
