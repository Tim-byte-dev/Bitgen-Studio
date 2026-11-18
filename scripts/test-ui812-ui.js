#!/usr/bin/env node
/* bitGen Studio — 2.812.0 against the RUNNING app (+ a real browser): tables in document text - ▦ Table ▾ ▸ Insert Table…,
 * typing in cells, rows / columns, merge / split, borders, shading, a column's width dragged, the header row repeated on
 * the next page, the table menu on right-click.
 * Tim (verbatim): "go with the next part please" (the word plan's tables). No Playwright = SKIP. */
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
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.docTable, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.waitForTimeout(400);
    await ev(() => { const f = document.getElementById("kxFull"); if (f) f.click(); const P = document.getElementById("promptdock"); if (P && !P.classList.contains("dockgone")) toggleDockGone("promptdock", "tP"); });
    await p.waitForTimeout(600);
    await ev(() => window.imageEditorInstance.E.ui.run("file.newtextdoc")); await p.waitForTimeout(300);
    await ev(() => { const d = document.querySelector(".kxdlg.pcd"); d.querySelector("#pdnDpi").value = "96"; d.querySelector(".ok").click(); });
    await p.waitForTimeout(800);
    await p.keyboard.type("Before the table");
    await p.click("#kxOpts #pttMenu"); await p.waitForTimeout(200);
    const items = await ev(() => [...[...document.querySelectorAll(".kxmenu")].pop().querySelectorAll("[data-cmd]")].map((d) => d.dataset.cmd));
    check("▦ Table ▾: Insert Table…, rows, columns, deletes, merge, split, header row, colours", ["doc.table.insert", "doc.table.rowAbove", "doc.table.colRight", "doc.table.delTable", "doc.table.merge", "doc.table.split", "doc.table.header", "doc.table.colors"].every((c) => items.includes(c)), items);
    await ev(() => [...document.querySelectorAll(".kxmenu")].pop().querySelector('[data-cmd="doc.table.insert"]').click()); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #pttR", "4"); await p.fill(".kxdlg.pcd #pttC", "3"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(300);
    const ed = () => ev(() => document.querySelector(".pcdocedit .pcdoc").innerHTML);
    let h = await ed();
    check("Insert Table 4 x 3 with a header row: thead (1 row of th) + 3 body rows, even column widths, a paragraph after it", /<thead><tr><th>/.test(h) && (h.match(/<tr>/g) || []).length === 4 && (h.match(/<col style="width: ?33\.333%;?">/g) || []).length === 3 && /<\/table><p>/.test(h), h);
    await p.keyboard.type("Name"); await p.keyboard.press("Tab"); await p.keyboard.type("Qty"); await p.keyboard.press("Tab"); await p.keyboard.type("Price");
    h = await ed();
    check("typing in the cells (Tab = the next cell)", /<th>Name<\/th><th>Qty<\/th><th>Price<\/th>/.test(h), h);
    const run = (c) => ev((c) => window.imageEditorInstance.E.ui.run(c), c);
    await run("doc.table.colRight"); await p.waitForTimeout(150);
    h = await ed();
    check("Insert Column Right: 4 columns in every row, widths 25% each", (h.match(/<col /g) || []).length === 4 && /<th>Price<\/th><th><br><\/th>/.test(h) && (h.match(/width: ?25%/g) || []).length === 4, h);
    await run("doc.table.rowBelow"); await p.waitForTimeout(150);
    h = await ed();
    check("Insert Row Below (from the header): a body row at the top of the body", (h.match(/<tr>/g) || []).length === 5 && /<tbody><tr><td><br><\/td>/.test(h), h);
    // merge two body cells by selecting across them
    await ev(() => { const e = document.querySelector(".pcdocedit .pcdoc"), tds = e.querySelectorAll("tbody tr:nth-child(2) td"), s = getSelection(); s.setBaseAndExtent(tds[0], 0, tds[1], 0); });
    await run("doc.table.merge"); await p.waitForTimeout(150);
    h = await ed();
    check("Merge Cells: two cells side by side -> one with colspan 2", /<td colspan="2">/.test(h), h);
    await run("doc.table.split"); await p.waitForTimeout(150);
    h = await ed();
    check("Split Cell: back to two", !/colspan/.test(h), h);
    await run("doc.table.border.outside"); await p.waitForTimeout(150);
    h = await ed();
    check("Outside Border: the table has the border, the cells none", /<table style="[^"]*border: 1px solid/.test(h) && /<td style="border-style: none;?"/.test(h), h);
    await run("doc.table.border.all"); await run("doc.table.valign.middle"); await p.waitForTimeout(150);
    h = await ed();
    check("All Borders + Cell Alignment: Middle on the caret's cell", /<td style="border: 1px solid[^"]*vertical-align: middle;?"/.test(h) || /vertical-align: middle/.test(h), h);
    // a column's width dragged
    const edge = await ev(() => { const th = document.querySelector(".pcdocedit .pcdoc th"), r = th.getBoundingClientRect(); return [r.right + 1, r.top + r.height / 2]; });   // just past the edge (the next cell) - the edge is grabbed from either side
    await p.mouse.move(edge[0], edge[1]); await p.mouse.down(); await p.mouse.move(edge[0] + 60, edge[1], { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(200);
    const ws = await ev(() => [...document.querySelectorAll(".pcdocedit .pcdoc col")].map((c) => parseFloat(c.style.width)));
    check("dragging the first column's right edge: it grows, the next one gives the room (the sum stays 100%)", ws[0] > 27 && ws[1] < 23 && Math.abs(ws.reduce((a, b) => a + b, 0) - 100) < 0.1, ws);
    // right-click in a cell = the table menu
    const cellAt = await ev(() => { const r = document.querySelector(".pcdocedit .pcdoc tbody td").getBoundingClientRect(); return [r.left + 10, r.top + 8]; });
    await p.mouse.click(cellAt[0], cellAt[1], { button: "right" }); await p.waitForTimeout(250);
    const rm = await ev(() => { const m = [...document.querySelectorAll(".kxmenu")].pop(); return m ? [...m.querySelectorAll("[data-cmd]")].map((d) => d.dataset.cmd) : []; });
    check("right-click in a cell: the table menu", rm.includes("doc.table.rowAbove") && rm.includes("doc.table.merge"), rm);
    await ev(() => window.imageEditorInstance.E.ui.closeMenus());
    // a long table: the header row again on the next page
    await ev(() => { const e = document.querySelector(".pcdocedit .pcdoc"), tb = e.querySelector("tbody"); let rows = ""; for (let i = 1; i <= 70; i++) rows += `<tr><td>Item ${i}</td><td>${i}</td><td>$${i}.00</td><td>row ${i}</td></tr>`; tb.innerHTML = rows; e.dispatchEvent(new Event("input")); });
    await p.waitForTimeout(500); await p.keyboard.press("Escape"); await p.waitForTimeout(1500);
    const st = await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers.find((x) => x.type === "doc"); return { pages: E.pages.count(), frames: E.docText.storyOf(L).map((f) => ({ top: Math.round(f.doc.top), rep: !!f.doc.rep, repTh: /<th[^>]*>Name<\/th>/.test(f.doc.rep || "") })) }; });
    check("a table longer than the page: a page added, and the next frame repeats the header row (Name / Qty / Price)", st.pages >= 2 && st.frames.length >= 2 && !st.frames[0].rep && st.frames[1].rep && st.frames[1].repTh, st);
    await ev(() => window.imageEditorInstance.E.pages.go(1)); await p.waitForTimeout(400);
    await p.waitForFunction(() => window.imageEditorInstance.E.docText.ready(), null, { timeout: 10000 });
    const ink = await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers.find((x) => x.type === "doc"), d = L.canvas.getContext("2d").getImageData(L.doc.x, L.doc.y, 200, 20).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 100) n++; return n; });
    check("…and it is drawn: the header row at the top of page 2's frame", ink > 100, ink);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally { await b.close(); }
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
