#!/usr/bin/env node
/* bitGen Studio — 2.845.0 in a REAL browser: ⟷ Page Width - the Zoom tool's settings button, the top strip's ⟷, View ▸ Page
 * Width and Shift+Ctrl+0 make the page's width fill the canvas room; the line at the top kept when zoomed in.
 * Tim: "in zoom settings, add zoom to page width". Against the running app (H3_URL). No Playwright = SKIP. */
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
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.fitWidth, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock, #pcPagesPanel").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("imageeditdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    await ev(() => { const E = window.imageEditorInstance.E; E.openDoc(595, 842, "pw845.png", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, 595, 842); }); E.fitView(); });
    await p.waitForTimeout(500);
    const geo = () => ev(() => { const E = window.imageEditorInstance.E, S = E.S, st = E.stage.getBoundingClientRect(), pp = document.getElementById("kxPaper").getBoundingClientRect(), ruled = document.querySelector(".kx").classList.contains("rulers"), L = ruled ? 30 : 16;
      return { zoom: S.zoom, room: st.width - L - 16, w: pp.width, left: pp.left - st.left, L, top: (L - S.panY) / S.zoom }; });
    const g0 = await geo();
    // the Zoom tool's settings
    await ev(() => window.imageEditorInstance.E.setTool("zoom")); await p.waitForTimeout(200);
    const has = await ev(() => { const b = document.getElementById("ptZPW"); return b ? b.textContent : null; });
    await p.click("#ptZPW"); await p.waitForTimeout(300);
    const g1 = await geo();
    check("the Zoom tool's settings have ⟷ Page Width; clicked, the page is as wide as the canvas room (rulers / edges left free)",
      has === "⟷ Page Width" && Math.abs(g1.w - g1.room) <= 2 && Math.abs(g1.left - g1.L) <= 2 && g1.zoom > g0.zoom, { has, g0, g1 });
    // scroll down a bit, zoom out, Page Width again: the line at the top stays
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S; S.panY = S.panY - 300 * S.zoom; E.applyView(); });
    const before = await geo();
    await ev(() => window.imageEditorInstance.E.zoomAt(0.5, 0, 16)); await p.waitForTimeout(100);
    await p.click("#kxPageW"); await p.waitForTimeout(300);
    const g2 = await geo();
    check("the top strip's ⟷ does it too, and the page line at the top of the view stays at the top", Math.abs(g2.w - g2.room) <= 2 && Math.abs(g2.top - before.top) < 2, { before, g2 });
    await ev(() => { const E = window.imageEditorInstance.E; E.fitView(); });
    await ev(() => window.imageEditorInstance.E.ui.run("view.pagewidth")); await p.waitForTimeout(200);
    const g3 = await geo();
    await ev(() => window.imageEditorInstance.E.fitView());
    await p.click("#ieStage", { position: { x: 400, y: 400 } }).catch(() => {});
    await ev(() => window.imageEditorInstance.E.setTool("move"));
    await p.focus("#ieStage"); await p.keyboard.press("Control+Shift+Digit0"); await p.waitForTimeout(300);
    const g4 = await geo();
    const menu = await ev(() => { const V = window.imageEditorInstance.E.ui.MENUS.find(([n]) => n === "View")[1]; return V.slice(V.indexOf("view.fit"), V.indexOf("view.fit") + 2); });
    check("View ▸ Page Width (after Fit on Screen) and Shift+Ctrl+0 do it", menu.join() === "view.fit,view.pagewidth" && Math.abs(g3.w - g3.room) <= 2 && Math.abs(g4.w - g4.room) <= 2, { menu, g3, g4 });
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
