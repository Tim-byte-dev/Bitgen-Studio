#!/usr/bin/env node
/* bitGen Studio — 2.823.0 against the RUNNING app (+ a real browser): ▦ the spreadsheet's ▤ FORMAT CELLS dialog - opened
 * from the toolbar, Ctrl+1 and the right-click menu; each tab used by clicking it as a person would, then the cells
 * checked on screen; Cancel changes nothing, one undo takes a whole OK back; the Number Format dropdown and the decimal
 * buttons; protection; save + open keeps the looks. Tim: "continue , add format cells button, format the cells like
 * excel". No Playwright = SKIP. */
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
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, x) => p.evaluate(f, x);
  const S = (a) => ev((a) => { const q = window.SheetCalc.parseAddr(a); return window.H3Sheet.shown(q.c, q.r); }, a);
  const cellOf = (a) => ev((a) => { const c = window.H3Sheet.W.sheets[window.H3Sheet.W.active].cells[a]; return c ? JSON.parse(JSON.stringify(c)) : null; }, a);
  const dom = (a) => ev((a) => { const H = window.H3Sheet, q = window.SheetCalc.parseAddr(a), G = H.St.geo, g = document.getElementById("shGrid"), pane = document.getElementById("shPane").getBoundingClientRect();
    const x = pane.left + 44 + G.colX[q.c] - g.scrollLeft + 3, y = pane.top + 22 + G.rowY[q.r] - g.scrollTop + 3;
    const el = document.elementsFromPoint(x, y).find((e) => e.classList && e.classList.contains("c")); if (!el) return null;
    const t = el.querySelector(".t"), cs = getComputedStyle(el), ts = t ? getComputedStyle(t) : {};
    return { text: el.textContent, style: el.getAttribute("style"), color: cs.color, bg: cs.backgroundColor, bgImg: cs.backgroundImage, weight: cs.fontWeight, size: cs.fontSize, fill: !!el.querySelector(".fl"), transform: ts.transform, deco: ts.textDecorationLine, decoStyle: ts.textDecorationStyle, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height, bTop: cs.borderTopWidth + " " + cs.borderTopStyle, bBot: cs.borderBottomWidth + " " + cs.borderBottomStyle };
  }, a);
  const sel = (a) => ev((a) => { const [x, y] = a.split(":"), P = window.SheetCalc.parseAddr(x), Q = window.SheetCalc.parseAddr(y || x); window.H3Sheet.St.sel = { r1: P.r, c1: P.c, r2: Q.r, c2: Q.c }; window.H3Sheet.St.act = { r: P.r, c: P.c }; window.H3Sheet.paint(); document.getElementById("shGrid").focus(); }, a);
  const open = async (tab) => { await p.keyboard.press("Control+1"); await p.waitForSelector("#shFmtDlg[open]"); if (tab) await p.click(`#shFmtDlg [data-tab="${tab}"]`); };
  const ok = async () => { await p.click("#fdOk"); await p.waitForTimeout(150); };
  const gone = [];
  try {
    await p.addInitScript(() => { try { localStorage.removeItem("h3.g.sheetdock"); localStorage.removeItem("h3.sheet.draft"); localStorage.removeItem("h3.sheet.fmttab"); } catch (e) { /* fine */ } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Sheet && window.H3SheetFormat && window.SheetFmt, null, { timeout: 60000 });
    await p.$eval("#tX_sheetdock", (e) => e.click()); await p.waitForTimeout(400);
    await ev(() => {
      document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { if (d.style.display !== "none") { d.dataset.t823 = d.style.display; d.style.display = "none"; } });
      const d = document.getElementById("sheetdock"); d.dataset.t823css = d.style.cssText; d.style.cssText = "position:fixed;left:0;top:40px;width:1300px;height:820px;z-index:60;background:var(--panel)";
    });
    await p.waitForTimeout(300);
    await ev(() => { const H = window.H3Sheet, put = (a, v) => { const q = window.SheetCalc.parseAddr(a); H.setRaw(q.c, q.r, v); };
      [["A1", "Budget 2026"], ["A2", "Item"], ["B2", "Amount"], ["C2", "Date"], ["D2", "Share"], ["E2", "Note"], ["A3", "Rent"], ["B3", "1500"], ["C3", "17/11/2026"], ["D3", "0.4"], ["E3", "paid on the first of each month"],
        ["A4", "Food"], ["B4", "-320.5"], ["C4", "2026-12-01"], ["D4", "0.125"], ["A5", "Zero"], ["B5", "0"], ["A6", "Total"], ["B6", "=SUM(B3:B5)"], ["B8", "123456789.123"]].forEach(([a, v]) => put(a, v));
      H.book().recalc(); H.paint(); });
    // three ways in
    await sel("B3:B6"); await p.$eval("#shFmtCells", (e) => e.click()); await p.waitForSelector("#shFmtDlg[open]");
    check("▤ Format… on the toolbar opens Format Cells on the Number tab, with the cells it changes", await ev(() => document.querySelector("#shFmtDlg [data-tab='number']").classList.contains("on") && document.getElementById("fdNote").textContent === "B3:B6"));
    await p.click("#fdCancel"); await p.waitForTimeout(100);
    await sel("B3:B6"); await open();
    check("Ctrl+1 opens it too", await ev(() => document.getElementById("shFmtDlg").open)); await p.keyboard.press("Escape"); await p.waitForTimeout(100);
    const b3 = await ev(() => { const H = window.H3Sheet, G = H.St.geo, pane = document.getElementById("shPane").getBoundingClientRect(); return [pane.left + 44 + G.colX[1] + 20, pane.top + 22 + G.rowY[2] + 8]; });
    await p.mouse.click(b3[0], b3[1], { button: "right" }); await p.waitForSelector('.shmenu [data-a="format"]');
    check("…and the cells' right-click menu: ▤ Format Cells… (Ctrl+1)", (await ev(() => document.querySelector('.shmenu [data-a="format"]').textContent)) === "▤ Format Cells… (Ctrl+1)");
    await ev(() => document.querySelector('.shmenu [data-a="format"]').click()); await p.waitForSelector("#shFmtDlg[open]"); await p.click("#fdCancel");
    // Number ▸ Currency, red brackets
    await sel("B3:B6"); await open("number"); await p.click('#shFmtDlg [data-cat="Currency"]');
    const negs = await ev(() => [...document.querySelectorAll("#fdOpts [data-neg]")].map((d) => d.textContent));
    check("Currency shows the four looks of -1234.10 to pick from", negs.join("|") === "-$1,234.10|$1,234.10|($1,234.10)|($1,234.10)", negs);
    await p.click('#shFmtDlg [data-neg="redparen"]');
    check("…the sample is the active cell's own value", (await ev(() => document.getElementById("fdSample").textContent)) === "$1,500.00 ");
    await ok();
    const b4 = await dom("B4");
    check("OK: B3:B6 currency - B4 shows ($320.50) in red, B6 = $1,179.50", (await S("B3")) === "$1,500.00 " && b4.text === "($320.50)" && b4.color === "rgb(255, 0, 0)" && (await S("B6")) === "$1,179.50 ", [await S("B3"), b4]);
    await ev(() => window.H3Sheet.undo(false));
    check("one Ctrl+Z takes the whole OK back", (await cellOf("B4")).f === undefined && (await S("B4")) === "-320.5", await cellOf("B4"));
    await ev(() => window.H3Sheet.undo(true));
    // Cancel changes nothing
    await sel("B3"); await open("font"); await p.selectOption("#fdFs", "b"); await p.click("#fdCancel");
    check("Cancel changes nothing", !((await cellOf("B3")).s || {}).b);
    // Accounting
    await sel("B5"); await open("number"); await p.click('#shFmtDlg [data-cat="Accounting"]'); await ok();
    const b5 = await dom("B5");
    check("Accounting: the $ at the cell's left edge and the number at the right (a fill between); zero is a dash", b5.fill && /\$/.test(b5.text) && /-/.test(b5.text), b5);
    // Date + percentage via the dialog's lists / decimals
    await sel("C3:C4"); await open("number"); await p.click('#shFmtDlg [data-cat="Date"]'); await p.click('#shFmtDlg [data-type="d mmm yyyy"]'); await ok();
    check("Date ▸ d mmm yyyy: 17 Nov 2026, 1 Dec 2026", (await S("C3")) === "17 Nov 2026" && (await S("C4")) === "1 Dec 2026", [await S("C3"), await S("C4")]);
    await sel("D3:D4"); await open("number"); await p.click('#shFmtDlg [data-cat="Percentage"]'); await p.fill("#fdDp", "1"); await p.dispatchEvent("#fdDp", "input"); await ok();
    check("Percentage, 1 decimal: 40.0%, 12.5%", (await S("D3")) === "40.0%" && (await S("D4")) === "12.5%");
    // Custom code typed
    await sel("D3"); await open("number"); await p.click('#shFmtDlg [data-cat="Custom"]'); await p.fill("#fdCode", '[Blue]0.0%" share"'); await p.dispatchEvent("#fdCode", "input");
    check("Custom: a code typed shows in the sample as you type", (await ev(() => document.getElementById("fdSample").textContent)) === "40.0% share");
    await ok();
    check("…OK: D3 = 40.0% share, in blue", (await S("D3")) === "40.0% share" && (await dom("D3")).color === "rgb(0, 0, 255)");
    // Alignment: centre across selection, wrap (the row grows), turned text
    await sel("A1:E1"); await open("align"); await p.selectOption("#fdHa", "centerSel"); await p.click('#shFmtDlg [data-tab="font"]'); await p.selectOption("#fdFs", "b"); await p.fill("#fdSize", "16"); await p.dispatchEvent("#fdSize", "input"); await ok();
    const a1 = await dom("A1");
    check("Centre across selection: the title spans A1:E1, bold 16 pt; the row grew for it", a1.width > 400 && a1.weight === "700" && a1.size === "21.3px" && a1.height >= 26, a1);
    await sel("E3"); await open("align"); await p.click("#fdWrap"); await p.selectOption("#fdVa", "top"); await ok();
    check("Wrap text: the row grows to show every line", (await dom("E3")).height > 40, await dom("E3"));
    await sel("E4"); await ev(() => { const q = window.SheetCalc.parseAddr("E4"); window.H3Sheet.setRaw(q.c, q.r, "Turned"); window.H3Sheet.book().recalc(); window.H3Sheet.paint(); });
    await open("align"); await p.fill("#fdRot", "45"); await p.dispatchEvent("#fdRot", "input"); await ok();
    check("Orientation 45°: the text is turned (and its row made taller)", /matrix/.test((await dom("E4")).transform) && (await dom("E4")).height > 30, await dom("E4"));
    // Font: double underline + red
    await sel("A6"); await open("font"); await p.selectOption("#fdU", "double"); await p.click("#fdColAuto"); await p.fill("#fdCol", "#ff8800"); await p.dispatchEvent("#fdCol", "input"); await ok();
    const a6 = await dom("A6");
    check("Font: double underline, an own colour", a6.deco === "underline" && a6.decoStyle === "double" && a6.color === "rgb(255, 136, 0)", a6);
    // Border: outline + inside, the double bottom under the header
    await sel("A3:E6"); await open("border"); await p.click('#shFmtDlg [data-ls="thin"]'); await p.click('#shFmtDlg [data-pre="outline"]'); await p.click('#shFmtDlg [data-pre="inside"]');
    check("Border: the preview draws what the presets set (4 sides + 2 inside lines lit)", (await ev(() => document.querySelectorAll(".fdEdge.on").length)) === 6);
    await ok();
    const bd = await ev(() => { const c = window.H3Sheet.W.sheets[0].cells; return [c.A3.s.bd, c.C4.s.bd, c.E6.s.bd]; });
    check("…OK: outside edges + every inside line, thin", JSON.stringify(bd[0]) === '{"t":{"s":"thin"},"l":{"s":"thin"},"b":{"s":"thin"},"r":{"s":"thin"}}' && JSON.stringify(bd[1]) === '{"b":{"s":"thin"},"r":{"s":"thin"}}' && JSON.stringify(bd[2]) === '{"b":{"s":"thin"},"r":{"s":"thin"}}', bd);
    await sel("A2:E2"); await open("border"); await p.click('#shFmtDlg [data-ls="double"]'); await p.fill("#fdLc", "#ff0000"); await p.dispatchEvent("#fdLc", "input"); await p.click('.fdEdge[data-edge="bottom"]'); await ok();
    check("…a red double line under the header (clicked on its edge button)", (await dom("B2")).bBot === "3px double", await dom("B2"));
    await sel("D5"); await open("border"); await p.click('#shFmtDlg [data-ls="medium"]');
    const prev = await ev(() => { const l = document.querySelector('#fdBdPrev [data-edge="d2"]'), r = l.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await p.mouse.click(prev[0], prev[1]); await ok();
    check("…a diagonal clicked on the preview itself", JSON.stringify((await cellOf("D5")).s.bd.d2) === '{"s":"medium"}' && (await ev(() => !!document.querySelector("#shPane .dg line"))));
    // Fill: palette, pattern, gradient
    await sel("A1"); await open("fill"); await p.click('#shFmtDlg [data-bg="#4472c4"]'); await ok();
    check("Fill: a palette colour", (await dom("A1")).bg === "rgb(68, 114, 196)");
    await sel("A2:E2"); await open("fill"); await p.click('#shFmtDlg [data-pat="lightUp"]'); await ok();
    check("…a pattern (drawn in the theme's ink when its colour is Automatic)", /data:image\/svg\+xml/.test((await dom("C2")).bgImg));
    await sel("A6:E6"); await open("fill"); await p.selectOption("#fdGd", "v"); await ok();
    check("…two-colour shading", /linear-gradient/.test((await dom("C6")).bgImg));
    // the Number Format dropdown + decimals
    await sel("B8"); await ev(() => { const s = document.getElementById("shFmt"); s.value = "Currency"; s.dispatchEvent(new Event("change")); });
    check("Number Format ▸ Currency: $123,456,789.12 is too wide for the column = ##########, as spreadsheet programs show it", (await cellOf("B8")).f === "$#,##0.00" && /^#+$/.test((await dom("B8")).text), [await cellOf("B8"), (await dom("B8")).text]);
    await ev(() => { window.H3Sheet.W.sheets[0].cols[1] = 160; window.H3Sheet.paint(); });
    await p.$eval("#shDecLess", (e) => e.click());
    check("…a wider column, then .0← one decimal fewer: $123,456,789.1", (await cellOf("B8")).f === "$#,##0.0" && (await dom("B8")).text === "$123,456,789.1", [await cellOf("B8"), (await dom("B8")).text]);
    check("…the dropdown shows the active cell's category", (await ev(() => document.getElementById("shFmt").value)) === "Currency");
    // protection
    await sel("B3"); await open("prot"); await p.click("#fdLock"); await p.click("#fdProtect"); await ok();
    check("Protection: B3 unlocked + the sheet protected (🔒 on its tab)", (await cellOf("B3")).s.unlock === true && (await ev(() => window.H3Sheet.W.sheets[0].protect)) === true && /🔒/.test(await ev(() => document.querySelector("#shTabs .tab.on").textContent)));
    await sel("A3"); await p.keyboard.type("x");
    check("…a locked cell refuses typing (the status line says why)", (await cellOf("A3")).v === "Rent" && /protected/.test(await ev(() => document.getElementById("shMsg").textContent)));
    await sel("B3"); await p.keyboard.type("2000"); await p.keyboard.press("Enter");
    check("…an unlocked one can be typed in", (await cellOf("B3")).v === "2000");
    await sel("B3"); await p.$eval("#shFmtCells", (e) => e.click()); await p.waitForTimeout(150);
    check("…formats refused while protected (Format Cells does not open)", !(await ev(() => document.getElementById("shFmtDlg").open)));
    // unprotect from the tab menu
    await ev(() => { const t = document.querySelector("#shTabs .tab.on"), r = t.getBoundingClientRect(); t.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: r.left + 5, clientY: r.top + 5 })); });
    await p.waitForSelector('.shmenu [data-a="protect"]');
    check("the tab's menu says 🔓 Unprotect sheet", /Unprotect sheet/.test(await ev(() => document.querySelector('.shmenu [data-a="protect"]').textContent)));
    await ev(() => document.querySelector('.shmenu [data-a="protect"]').click());
    check("…pressed: the sheet is open again", !(await ev(() => window.H3Sheet.W.sheets[0].protect)));
    // save + open
    await ev(() => { document.getElementById("shFile").value = "ui823 test"; }); await p.$eval("#shSave", (e) => e.click()); await p.waitForTimeout(600);
    gone.push("ui823 test.bgs");
    const back = await (await fetch(new URL("api/sheets/file?name=" + encodeURIComponent("ui823 test.bgs"), URL_))).json();
    const k = back.sheets[0].cells;
    check("💾 Save keeps every look (format code, alignment, font, borders, fill, protection flags)", k.B4.f === "$#,##0.00_);[Red]($#,##0.00)" && k.A1.s.align === "centerSel" && k.A1.s.size === 16 && k.A2.s.bd.b.s === "double" && k.A2.s.bd.b.c === "#ff0000" && k.C2.s.pat.t === "lightUp" && k.A6.s.u === "double" && k.B3.s.unlock === true && k.D5.s.bd.d2.s === "medium", [k.B4, k.A1, k.A2]);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally {
    for (const n of gone) { try { await fetch(new URL("api/sheets/file?name=" + encodeURIComponent(n), URL_), { method: "DELETE" }); } catch (e) { /* fine */ } }
    try { await ev(() => { const d = document.getElementById("sheetdock"); d.style.cssText = d.dataset.t823css || ""; document.querySelectorAll("[data-t823]").forEach((x) => { x.style.display = x.dataset.t823; delete x.dataset.t823; }); localStorage.removeItem("h3.sheet.draft"); if (!d.classList.contains("dockgone")) toggleDockGone("sheetdock", "tX_sheetdock"); }); } catch (e) { /* fine */ }
    await b.close();
    console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
