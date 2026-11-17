#!/usr/bin/env node
/* bitGen Studio — 2.822.0 against the RUNNING app (+ a real browser): ▦ the spreadsheet docker - typing, formulas, the
 * ƒx bar, the fill handle, copy / paste, formats, sort, filter, freeze, merge, rows inserted (references follow), sheets
 * as tabs + a reference to another sheet, undo, save / open in the project. Tim: "continue with the spreadsheet please".
 * No Playwright = SKIP. */
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
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1900, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, x) => p.evaluate(f, x);
  const S = (a) => ev((a) => { const H = window.H3Sheet, q = window.SheetCalc.parseAddr(a); return H.shown(q.c, q.r); }, a);
  const raw = (a) => ev((a) => { const c = window.H3Sheet.W.sheets[window.H3Sheet.W.active].cells[a]; return c ? c.v : undefined; }, a);
  const go = (a) => ev((a) => { const q = window.SheetCalc.parseAddr(a); window.H3Sheet.go(q.c, q.r); document.getElementById("shGrid").focus(); }, a);
  const type = async (t) => { for (const ch of t) { if (ch === "\t") await p.keyboard.press("Tab"); else if (ch === "\n") await p.keyboard.press("Enter"); else await p.keyboard.type(ch); } };
  const gone = [];
  try {
    await p.addInitScript(() => { try { localStorage.removeItem("h3.g.sheetdock"); localStorage.removeItem("h3.sheet.draft"); } catch (e) { /* fine */ } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && document.getElementById("tX_sheetdock") && window.H3Sheet, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    const st = await ev(() => ({ grp: [...document.getElementById("appGrp1").children].map((c) => c.id), gone: document.getElementById("sheetdock").classList.contains("dockgone") }));
    check("▦ on the top bar's app strip after ✉; the docker starts hidden", st.grp.join() === "tIE,tX_maildock,tX_sheetdock" && st.gone, st);
    await p.$eval("#tX_sheetdock", (e) => e.click()); await p.waitForTimeout(500);
    await ev(() => document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { if (d.style.display !== "none") { d.dataset.t822 = d.style.display; d.style.display = "none"; } }));
    await ev(() => { const d = document.getElementById("sheetdock"); d.style.minHeight = "600px"; });
    await p.waitForTimeout(300);
    await go("A1");
    await type("Item\tQty\tPrice\tTotal\n"); await go("A2"); await type("Pears\t5\t2\n"); await go("A3"); await type("Apples\t3\t$1.50\n"); await go("A4"); await type("Plums\t12\t25%\n");
    check("typing: words, numbers (P, S, L and digits go into the cells, not the app's keys)", (await S("A2")) === "Pears" && (await S("B4")) === "12" && (await raw("A3")) === "Apples", [await S("A2"), await S("B4")]);
    check("$1.50 = 1.5 shown as currency, 25% = 0.25 shown as a percent", (await S("C3")) === "$1.50" && (await S("C4")) === "25.00%", [await S("C3"), await S("C4")]);
    await go("A1"); await p.keyboard.press("Control+ArrowDown"); const j1 = await ev(() => ({ ...window.H3Sheet.St.act }));
    await p.keyboard.press("Control+ArrowRight"); const j2 = await ev(() => ({ ...window.H3Sheet.St.act }));
    await p.keyboard.press("Control+Shift+ArrowUp"); const j3 = await ev(() => ({ ...window.H3Sheet.St.sel }));
    check("Ctrl+↓ / Ctrl+→ jump to the end of the data (A4, then C4); Ctrl+Shift+↑ picks up to the top (C1:C4)", j1.r === 3 && j1.c === 0 && j2.r === 3 && j2.c === 2 && Math.min(j3.r1, j3.r2) === 0 && Math.max(j3.r1, j3.r2) === 3 && j3.c1 === 2 && j3.c2 === 2, [j1, j2, j3]);
    await go("D2"); await type("=B2*C2\n");
    check("a formula: =B2*C2 = 10", (await S("D2")) === "10", await S("D2"));
    // the fill handle (a real drag of the corner) copies the formula down, its references moved
    await go("D2");
    await p.waitForTimeout(200);
    const fh = await p.$("#shFillH"), fb = await fh.boundingBox(), r4 = await (await p.$('#shPane .h[data-row="3"]')).boundingBox();
    await p.mouse.move(fb.x + 3, fb.y + 3); await p.mouse.down(); await p.mouse.move(fb.x + 3, r4.y + 2, { steps: 4 }); await p.mouse.move(fb.x + 3, r4.y + r4.height / 2, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(300);
    check("the fill handle dragged down 2 rows: =B3*C3, =B4*C4 (4.5, 3) and no further", (await raw("D3")) === "=B3*C3" && (await raw("D4")) === "=B4*C4" && (await raw("D5")) === undefined && (await S("D3")) === "4.5" && (await S("D4")) === "3", [await raw("D3"), await raw("D4"), await S("D3"), await S("D4")]);
    // the ƒx bar
    await go("D5"); await p.click("#shFormula"); await p.keyboard.press("Control+a"); await p.keyboard.type("=SUM(D2:D4)"); await p.keyboard.press("Enter");
    check("the ƒx bar: =SUM(D2:D4) = 17.5", (await S("D5")) === "17.5", [await S("D5"), await raw("D5"), await raw("D4"), await ev(() => window.H3Sheet.St.sel)]);
    // a click on a cell while typing a formula puts its address in
    await go("E2"); await type("=");
    const cb = await ev(() => { const pane = document.getElementById("shPane"), cells = [...pane.querySelectorAll(".c")]; const t = cells.find((x) => x.textContent === "5"); const r = t.getBoundingClientRect(); return [r.x + 10, r.y + 8]; });
    await p.mouse.click(cb[0], cb[1]); await p.keyboard.type("*2"); await p.keyboard.press("Enter");
    check("typing =, then a click on B2: its address goes in (=B2*2 = 10)", (await raw("E2")) === "=B2*2" && (await S("E2")) === "10", [await raw("E2"), await S("E2")]);
    // copy / paste inside: the formula moves
    await go("E2"); await ev(() => window.H3Sheet.copy(false)); await go("E4"); await ev(() => window.H3Sheet.paste(window.H3Sheet.St.clip.text));
    check("copy E2, paste at E4: =B4*2 (24)", (await raw("E4")) === "=B4*2" && (await S("E4")) === "24", [await raw("E4"), await S("E4")]);
    // tab-separated from another program
    await go("A8"); await ev(() => window.H3Sheet.paste("x\t1\ny\t2"));
    check("pasted text from another program (tabs + lines) fills the cells", (await S("A8")) === "x" && (await S("B9")) === "2");
    // formats
    await go("D2"); await ev(() => { const s = document.getElementById("shFmt"); s.value = "currency"; s.dispatchEvent(new Event("change")); });
    check("Format ▸ Currency: D2 shows $10.00", (await S("D2")) === "$10.00", await S("D2"));
    await p.$eval("#shB", (e) => e.click());
    check("B = bold (one undo step)", await ev(() => !!window.H3Sheet.W.sheets[0].cells.D2.s.b));
    // sort by Item A->Z (the header row stays)
    await go("A3"); await p.$eval("#shSortA", (e) => e.click());
    check("A→Z on the Item column: Apples, Pears, Plums - the header stays, each row's cells go with it, x / y below a gap stay put", (await S("A1")) === "Item" && (await S("A2")) === "Apples" && (await S("A3")) === "Pears" && (await S("B4")) === "12" && (await S("A8")) === "x", [await S("A2"), await S("A3"), await S("A4"), await S("B4"), await S("A8")]);
    check("…a row's formula goes with it (=B2*C2 on Apples' row, Pears' currency format with it to D3, the SUM row stays at the bottom)", (await raw("D2")) === "=B2*C2" && (await S("D2")) === "4.5" && (await S("D3")) === "$10.00" && (await raw("D5")) === "=SUM(D2:D4)" && (await S("D5")) === "17.5", [await raw("D2"), await S("D2"), await raw("D5")]);
    // filter
    await go("B3"); await p.$eval("#shFilter", (e) => e.click());
    const ft = await ev(() => document.querySelectorAll("#shPane .ft").length);
    check("⏷ Filter (one cell picked = the whole table round it, A1:E5): a ▾ on each heading", ft === 5 && (await ev(() => JSON.stringify(window.H3Sheet.W.sheets[0].filter))) === '{"r":0,"r2":4,"c1":0,"c2":4,"cols":{}}', [ft, await ev(() => window.H3Sheet.W.sheets[0].filter)]);
    await p.click('#shPane .ft[data-ft="0"]'); await p.waitForSelector('.shmenu [data-v="Pears"]');
    await p.click('.shmenu [data-v="Pears"]'); await p.click(".shmenu [data-ok]"); await p.waitForTimeout(200);
    const vis = await ev(() => [...document.querySelectorAll("#shPane [data-row]")].map((x) => +x.dataset.row).filter((r) => r < 5));
    check("…▾ on Item, Pears unticked, OK: only the rows with the picked values show (Pears hidden, the SUM row's blank kept)", vis.join() === "0,1,3,4", [vis, await ev(() => [window.H3Sheet.shown(0, 4), JSON.stringify(window.H3Sheet.W.sheets[0].filter), document.querySelectorAll("#shPane [data-row]").length])]);
    await ev(() => { delete window.H3Sheet.W.sheets[0].filter; window.H3Sheet.paint(); });
    // insert a row above row 3: the formulas follow
    await go("A3"); await ev(() => window.H3Sheet.shiftCells("r", 2, 1));
    check("a row inserted above row 3: SUM(D2:D4) became SUM(D2:D5), still 17.5", (await raw("D6")) === "=SUM(D2:D5)" && (await S("D6")) === "17.5", [await raw("D6"), await S("D6")]);
    // merge, freeze
    await ev(() => { window.H3Sheet.St.sel = { r1: 9, c1: 0, r2: 9, c2: 2 }; window.H3Sheet.St.act = { r: 9, c: 0 }; }); await p.$eval("#shMerge", (e) => e.click());
    check("⊞ Merge A10:C10", await ev(() => window.H3Sheet.W.sheets[0].merges.includes("A10:C10")));
    await go("B2"); await p.$eval("#shFreeze", (e) => e.click());
    check("❄ Freeze at B2: 1 row, 1 column (the lines drawn)", await ev(() => { const f = window.H3Sheet.W.sheets[0].freeze; return f.r === 1 && f.c === 1 && document.querySelectorAll("#shPane .frz").length === 2; }));
    // a second sheet with a reference back
    await p.$eval("#shAddSheet", (e) => e.click()); await p.waitForTimeout(200);
    await go("A1"); await type("=Sheet1!D6*2\n");
    check("＋ a sheet (tab Sheet2); =Sheet1!D6*2 = 35", (await ev(() => [...document.querySelectorAll("#shTabs .tab")].map((t) => t.textContent).join())) === "Sheet1,Sheet2" && (await S("A1")) === "35", await S("A1"));
    // undo
    await go("A1"); await p.keyboard.press("Control+z");
    check("Ctrl+Z takes the last change back", (await raw("A1")) === undefined);
    await p.keyboard.press("Control+y");
    check("Ctrl+Y puts it back", (await raw("A1")) === "=Sheet1!D6*2");
    // save + open
    await ev(() => { document.getElementById("shFile").value = "ui822 test"; }); await p.$eval("#shSave", (e) => e.click()); await p.waitForTimeout(600);
    gone.push("ui822 test.bgs");
    const L = await (await fetch(new URL("api/sheets", URL_))).json();
    check("💾 Save: ui822 test.bgs in the project's sheets folder", (L.files || []).some((f) => f.name === "ui822 test.bgs"), L);
    await ev(() => window.H3Sheet.load({ sheets: [{ name: "Sheet1", cells: {} }], active: 0 }, "Workbook"));
    await p.$eval("#shOpen", (e) => e.click()); await p.waitForSelector('.shmenu [data-f="ui822 test.bgs"]');
    await ev(() => document.querySelector('.shmenu [data-f="ui822 test.bgs"]').click()); await p.waitForTimeout(600);
    const op = await ev(() => { const H = window.H3Sheet, B = H.book(); return [H.W.sheets.length, B.value("Sheet1", "D6"), B.value("Sheet2", "A1"), document.getElementById("shFile").value, [...document.querySelectorAll("#shTabs .tab.on")].map((t) => t.textContent).join()]; });
    check("📂 Open brings it back: both sheets, the formulas worked out again, on the tab it was saved on", op[0] === 2 && op[1] === 17.5 && op[2] === 35 && op[3] === "ui822 test" && op[4] === "Sheet2", op);
    const ni = await ev(() => ({ pane: document.getElementById("shPane").hasAttribute("data-noi18n"), tab: !!document.querySelector("#shTabs .tab [data-noi18n]") }));
    check("cell contents and sheet names are never run through the UI translation (data-noi18n)", ni.pane && ni.tab, ni);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally {
    for (const n of gone) { try { await fetch(new URL("api/sheets/file?name=" + encodeURIComponent(n), URL_), { method: "DELETE" }); } catch (e) { /* fine */ } }
    try { await ev(() => { document.querySelectorAll("[data-t822]").forEach((d) => { d.style.display = d.dataset.t822; delete d.dataset.t822; }); localStorage.removeItem("h3.sheet.draft"); if (!document.getElementById("sheetdock").classList.contains("dockgone")) toggleDockGone("sheetdock", "tX_sheetdock"); }); } catch (e) { /* fine */ }
    await b.close();
    console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
