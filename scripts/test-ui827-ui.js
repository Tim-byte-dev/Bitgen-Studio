#!/usr/bin/env node
/* bitGen Studio — 2.827.0 against the RUNNING app (+ a real browser): ▦ 📌 PAID TO. Tim: "can we have it say rent paid to this
 * date, rent days is calculated by weekly/7".
 *   Rent 540 / week from 13/01/2026, ⟳ to 2/03/2026: the Ledger's Paid to column = 19/01/2026 after the first week …
 *   2/03/2026 after the seventh (live PAIDTO formulas); the list says paid to 2/03/2026 and how far behind today
 *   Tenant 400 / week (income, "⟳ enters it" off = you enter the payments): two payments typed (1,000 + 400) -> ⟳ only
 *   fills Paid to on those rows: 18/02/2026 (1000 / (400/7) = 17.5 days) then 25/02/2026; the list shows ✍ + paid to 25/02
 *   your own words in a Paid to cell stay; a ledger of yours without the column gets one when ticked
 * H3_SHOTS=<dir> saves pictures. No Playwright = SKIP. */
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
  const raw = (name, a) => ev(([n, a]) => { const s = window.H3Sheet.W.sheets.find((s) => s.name === n), c = s && s.cells[a]; return c ? c.v : ""; }, [name, a]);
  const shown = (name, a) => ev(([n, a]) => { const H = window.H3Sheet, si = H.W.sheets.findIndex((s) => s.name === n), act = H.W.active; H.W.active = si; const q = window.SheetCalc.parseAddr(a), t = H.shown(q.c, q.r); H.W.active = act; return t; }, [name, a]);
  const form = async (o) => {
    await p.fill("#sckName", o.name); await p.fill("#sckAmt", String(o.amount)); await p.selectOption("#sckEvery", o.every); await p.fill("#sckStart", o.start);
    if (o.desc != null) await p.fill("#sckDesc", o.desc);
    if (o.kind) await p.check(`[name="sckKind"][value="${o.kind}"]`);
    if (o.auto === false) await p.uncheck("#sckAuto"); else await p.check("#sckAuto");
    await p.click("#sckAdd");
  };
  const planText = () => ev(() => document.getElementById("sckPlan").textContent.replace(/\s+/g, " "));
  const listText = () => ev(() => document.getElementById("sckList").textContent.replace(/\s+/g, " "));
  try {
    await p.addInitScript(() => { try { localStorage.removeItem("h3.g.sheetdock"); localStorage.removeItem("h3.sheet.draft"); } catch (e) { /* fine */ } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Sheet && window.H3SheetConst, null, { timeout: 60000 });
    await p.$eval("#tX_sheetdock", (e) => e.click()); await p.waitForTimeout(400);
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { if (d.style.display !== "none") { d.dataset.t827 = d.style.display; d.style.display = "none"; } }); const d = document.getElementById("sheetdock"); d.dataset.t827css = d.getAttribute("style") || ""; d.style.cssText += ";position:fixed;left:10px;top:60px;width:1380px;height:820px;z-index:9999"; });
    await ev(() => window.H3Sheet.load({ sheets: [{ name: "Sheet1", cells: {} }], active: 0 }, "t827 paid to"));

    await p.click("#shConst"); await p.waitForSelector("#shConstDlg[open]");
    check("the dialog has Paid to column (ticked) beside the ledger and ⟳ enters it (ticked) in the form", await ev(() => document.getElementById("sckPaid").checked && document.getElementById("sckAuto").checked));
    await form({ name: "Rent", amount: 540, every: "week", start: "2026-01-13", desc: "Rent payment", kind: "expense" });
    await p.fill("#sckTo", "2026-03-02"); await p.click("#sckSync"); await p.click("#sckApply");
    check("⟳ Apply: Paid to after the first week = 19/01/2026, after the seventh = 2/03/2026 (540 a week = 77.14 a day)", (await raw("Ledger", "G1")) === "Paid to" && (await shown("Ledger", "G2")) === "19/01/2026" && (await shown("Ledger", "G8")) === "2/03/2026" && (await raw("Ledger", "A9")) === "", [await shown("Ledger", "G2"), await shown("Ledger", "G8")]);
    check("…a live formula: =PAIDTO(\"Rent\",ABS(SUMIF(C$2:C2,\"Rent\",E$2:E2)))", (await raw("Ledger", "G2")) === '=PAIDTO("Rent",ABS(SUMIF(C$2:C2,"Rent",E$2:E2)))', await raw("Ledger", "G2"));
    const want = await ev(() => { const K = window.H3SheetConst, st = K.paidStatus(K.list()[0], 540 * 7); return st; });
    const l1 = await listText();
    check(`the list: Rent · Paid to 2/03/2026 · ${want.behind} days behind (today) · the owing amount`, l1.includes(`Paid to 2/03/2026 · ${want.behind} days behind · $${want.owing.toLocaleString("en-AU", { minimumFractionDigits: want.owing % 1 ? 2 : 0, maximumFractionDigits: 2 })} owing`), [l1, want]);
    await ev(() => window.H3Sheet._.step());
    await ev(() => { const H = window.H3Sheet, si = H.W.sheets.findIndex((s) => s.name === "Ledger"), S = H.W.sheets[si]; S.cells.E5.v = "1000"; H.St.book = null; H._.changed(); });
    check("…live: a week's entry changed to 1,000 moves the dates after it (row 5, 3/02: 2,620 paid = 33 days → paid to 14/02/2026)", (await shown("Ledger", "G5")) === "14/02/2026", await shown("Ledger", "G5"));
    await ev(() => window.H3Sheet.undo());

    // a tenant you enter yourself
    await form({ name: "Tenant", amount: 400, every: "week", start: "2026-02-02", desc: "Rent from the tenant", kind: "income", auto: false });
    check("Tenant (income, ⟳ enters it off) is marked ✍ in the list; nothing paid yet = owing", /Tenant\s*Income \(received\)\s*✍/.test(await listText()) && /Nothing paid yet · \$[\d,.]+ owing/.test(await listText()), await listText());
    await ev(() => { const H = window.H3Sheet, si = H.W.sheets.findIndex((s) => s.name === "Ledger"); H.W.active = si; H._.step(); [["2026-02-03", "Rent from the tenant", "Tenant", "1000"], ["2026-02-20", "Rent from the tenant", "Tenant", "400"]].forEach((row, i) => { H.setRaw(0, 8 + i, row[0]); H.setRaw(1, 8 + i, row[1]); H.setRaw(2, 8 + i, row[2]); H.setRaw(3, 8 + i, row[3]); }); H.setRaw(0, 10, "2026-02-25"); H.setRaw(1, 10, "Tenant's bond"); H.setRaw(2, 10, "Tenant"); H.setRaw(3, 10, "100"); H.setRaw(6, 10, "bond - not rent"); H.St.book = null; H._.changed(); });
    await p.click("#sckSync");
    const t2 = await planText();
    check("⟳: no Tenant entries made (you enter it); Paid to filled in on the 2 typed rows that have none", /No new entries/.test(t2) && /Paid to filled in on 2 rows/.test(t2) && !/Tenant ×/.test(t2), t2);
    await p.click("#sckApply");
    const ten = await ev(() => { const H = window.H3Sheet, si = H.W.sheets.findIndex((s) => s.name === "Ledger"), b = H.book(), o = []; for (let r = 1; r < 20; r++) if (b.get(si, 2, r) === "Tenant") { const act = H.W.active; H.W.active = si; o.push([b.get(si, 3, r), H.shown(6, r), H.W.sheets[si].cells[window.SheetCalc.addr(6, r)].v]); H.W.active = act; } return o; });
    check("…the typed tenant rows (in date order now): 1,000 → paid to 18/02/2026 (17.5 days at 57.14), + 400 → 25/02/2026", ten.length === 3 && ten[0][0] === 1000 && ten[0][1] === "18/02/2026" && ten[1][1] === "25/02/2026", ten);
    check("…your own words in a Paid to cell (the bond row) stay", ten[2][2] === "bond - not rent", ten[2]);
    check("the list: Tenant · Paid to 27/02/2026 counting the 100 too (1,500 = 26.25 days) + the part toward the next day", /Tenant.*Paid to 27\/02\/2026 · \d+ days behind/.test(await listText()) && /\+ \$14\.29 toward the next day/.test(await listText()), await listText());
    await shot("1-paidto");

    // a ledger of yours without the column
    await ev(() => { const H = window.H3Sheet; H._.step(); H.W.sheets.push({ name: "Money", cells: { A1: { v: "Date" }, B1: { v: "Details" }, C1: { v: "Money in" }, D1: { v: "Money out" }, A2: { v: "2026-01-13" }, B2: { v: "Rent" }, D2: { v: "540" } }, cols: {}, rows: {}, merges: [], freeze: { r: 0, c: 0 }, charts: [] }); H.W.ledger = { sheet: "Money" }; H.St.book = null; H._.tabs(); H._.changed(); });
    await p.click('#shConstDlg [data-x]'); await p.click("#shConst"); await p.waitForSelector("#shConstDlg[open]");
    await p.fill("#sckTo", "2026-01-20"); await p.click("#sckSync");
    check("your ledger (Money) with no Paid to: ⟳ says ＋ a Paid to column", /＋ a Paid to column in the ledger/.test(await planText()), await planText());
    await p.click("#sckApply");
    check("…✔ Apply: Paid to + Ref columns added; the rent entries get their dates", (await raw("Money", "F1")) === "Paid to" && (await raw("Money", "E1")) === "Ref" && /^=PAIDTO\("Rent"/.test(await raw("Money", "F3")) && (await shown("Money", "F4")) === "26/01/2026", [await raw("Money", "E1"), await raw("Money", "F1"), await raw("Money", "F3"), await shown("Money", "F4")]);
    check("ƒ▾ lists PAIDTO", await ev(() => window.SheetCalc.FUNCS.includes("PAIDTO")));
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally {
    try { await ev(() => { const d = document.getElementById("sheetdock"); d.style.cssText = d.dataset.t827css || ""; document.querySelectorAll("[data-t827]").forEach((x) => { x.style.display = x.dataset.t827; delete x.dataset.t827; }); localStorage.removeItem("h3.sheet.draft"); if (!d.classList.contains("dockgone")) toggleDockGone("sheetdock", "tX_sheetdock"); }); } catch (e) { /* fine */ }
    await b.close();
    console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
