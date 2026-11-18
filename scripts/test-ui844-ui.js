#!/usr/bin/env node
/* bitGen Studio — 2.844.0 in a REAL browser: the image editor's four views on its top strip, clicked like a person would.
 *   🖼 Image View (tools, no palette / dockers / ribbon) · ✒ Vector View (palette, dockers, rulers) · 📝 WP View (pages one
 *   below another, the writing ribbon: Bold / Heading 1 into a WP layer; no tool column) · 🌐 Web View (New Website = a
 *   1440 x 900 page called Home, ＋ Web Page, ⚡ Quick Preview -> the site inside the editor at 📱 phone width).
 * Tim: "when in image-editor add views to the top toolstrip - … just call them WP View, Vector View and Image View, add web
 * view". Against the running app (H3_URL). No Playwright = SKIP. */
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
  const shown = (sel) => ev((s) => { const e = document.querySelector(s); return !!(e && e.offsetParent !== null && getComputedStyle(e).display !== "none"); }, sel);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: true } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.views && window.imageEditorInstance.E.pages, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { if (d.style.display !== "none") d.style.display = "none"; }); const d = document.getElementById("imageeditdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    await p.waitForTimeout(300);
    const strip = await ev(() => { const s = document.getElementById("pcViews"); return s ? { labels: [...s.querySelectorAll("[data-view]")].map((b) => b.textContent.trim()), inBar: !!s.closest(".pcmenu .mr"), first: s.parentNode.firstElementChild === s } : null; });
    check("the top strip: 📝 WP View · ✒ Vector View · 🖼 Image View · 🌐 Web View, at the start of its right part", strip && strip.labels.join("|") === "📝WP View|✒Vector View|🖼Image View|🌐Web View" && strip.inBar && strip.first, strip);

    await p.click('#pcViews [data-view="image"]'); await p.waitForTimeout(300);
    const im = { tools: await shown("#kxTools"), pal: await ev(() => document.querySelector(".kx").classList.contains("pal-off")), dock: await ev(() => document.querySelector('#pcPanels .pcgrp[data-g="dock"]').classList.contains("off")), rib: await shown("#pcViewRibbon"), on: await ev(() => document.querySelector('#pcViews [data-view="image"]').classList.contains("on")), color: await shown("#pcColor") };
    check("🖼 Image View: the tool column, Color in front, no palette, no dockers, no ribbon; its button lit", im.tools && im.pal && im.dock && !im.rib && im.on && im.color, im);

    await p.click('#pcViews [data-view="vector"]'); await p.waitForTimeout(300);
    const ve = await ev(() => { const kx = document.querySelector(".kx"), d = document.querySelector('#pcPanels .pcgrp[data-g="dock"]'); return { pal: !kx.classList.contains("pal-off"), palShown: !!document.querySelector(".pcpal") && getComputedStyle(document.querySelector(".pcpal")).display !== "none", dock: !d.classList.contains("off"), xf: document.getElementById("dkXf").classList.contains("on"), rulers: kx.classList.contains("rulers"), tool: window.imageEditorInstance.E.S.tool }; });
    check("✒ Vector View: the colour palette, the dockers (Transform in front), rulers", ve.pal && ve.palShown && ve.dock && ve.xf && ve.rulers, ve);

    // a 3-page A4 document with a WP layer on page 1
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S; E.pages.newDocument({ preset: "A4", orient: "portrait", dpi: 72 }, 3, "Letter");
      const W = E.docText.addFrame(40, 40, S.w - 80, S.h - 80, {}, false); E.docText.end(); W.doc.html = E.docText.sanitize("<p>Dear Tim, the cakes are ready.</p>"); E.docText.reflow(W.doc.flow.id); E.refresh(); });
    await p.waitForTimeout(400);
    await p.click('#pcViews [data-view="wp"]'); await p.waitForTimeout(800);
    const w = await ev(() => { const E = window.imageEditorInstance.E, r = document.getElementById("pcViewRibbon"); return { tabs: r ? [...r.querySelectorAll(".cbtab")].map((t) => t.textContent) : [], ribShown: !!r && r.style.display !== "none", tools: document.getElementById("kxTools").offsetParent !== null, mode: E.pageView.mode(), tool: E.S.tool, para: document.getElementById("pcPara").classList.contains("on"), pages: document.querySelectorAll(".pcpv [data-pv]").length }; });
    check("📝 WP View: the writing ribbon (HOME INSERT LAYOUT MAILINGS REVIEW EXPORT), no tool column, the pages one below another, Paragraph in front, the WP tool",
      w.ribShown && w.tabs.join() === "HOME,INSERT,LAYOUT,MAILINGS,REVIEW,EXPORT" && !w.tools && w.mode === "column" && w.tool === "doctext" && w.para, w);
    await p.waitForTimeout(1200);
    const pv = await ev(() => { const E = window.imageEditorInstance.E, els = [...document.querySelectorAll(".pcpv [data-pv]")].map((e) => e.getBoundingClientRect()); return { n: els.length, sameX: els.every((r) => Math.abs(r.left - els[0].left) < 2), down: els.length > 1 && els[1].top > els[0].top, lay: E.pageView.layout().map((q) => q.x) }; });
    check("the other two pages are drawn below the first (one column)", pv.n === 2 && pv.sameX && pv.down && pv.lay.every((x) => x === pv.lay[0]), pv);
    // type in the WP layer, select the words, ribbon Bold, then Heading 1
    await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers.find((x) => x.type === "doc"); E.setActive(E.S.layers.indexOf(L)); E.docText.wpMode(L); });
    await p.waitForTimeout(400);
    await ev(() => { const ed = window.imageEditorInstance.E.docText.ed(), r = document.createRange(), t = ed.querySelector("p").firstChild; r.setStart(t, 0); r.setEnd(t, 4); const s = getSelection(); s.removeAllRanges(); s.addRange(r); window.imageEditorInstance.E.docText.keepSel(); });
    await p.click('#pcViewRibbon .cbtab[data-tab="home"]'); await p.waitForTimeout(150);
    await p.click('#pcViewRibbon .cbb[data-id="v_fx_bold"]'); await p.waitForTimeout(300);
    await p.click('#pcViewRibbon .cbb[data-id="v_fx_style_h1"]'); await p.waitForTimeout(400);
    const h = await ev(() => window.imageEditorInstance.E.docText.ed().innerHTML);
    check("ribbon HOME: 𝐁 Bold on the selected words, then H1 makes the paragraph a heading (the caret kept in the WP layer)", /<h1[^>]*>[\s\S]*(font-weight:\s*(bold|700)|<b>)[\s\S]*Dear/.test(h), h);
    await ev(() => window.imageEditorInstance.E.docText.end());
    await p.click('#pcViewRibbon .cbtab[data-tab="layout"]'); await p.waitForTimeout(200);
    const lay = await ev(() => [...document.querySelectorAll("#pcViewRibbon .cbb .lb")].map((x) => x.textContent));
    check("ribbon LAYOUT: Margins, Page Properties, the figure places, One Below Another", ["Margins", "Page Properties", "Figure Left", "One Below Another"].every((n) => lay.includes(n)), lay);
    await p.click('#pcViewRibbon .cbb[data-id="v_cmd_view_pages_two"]'); await p.waitForTimeout(500);
    check("ribbon LAYOUT ▢▢ Two Pages switches the page view", await ev(() => window.imageEditorInstance.E.pageView.mode()) === "two");

    // 🌐 Web View
    await p.click('#pcViews [data-view="web"]'); await p.waitForTimeout(700);
    const we = await ev(() => { const E = window.imageEditorInstance.E, r = document.getElementById("pcViewRibbon"); return { tabs: [...r.querySelectorAll(".cbtab")].map((t) => t.textContent), tools: document.getElementById("kxTools").offsetParent !== null, pages: E.pages.shown(), mode: E.pageView.mode(), align: document.getElementById("dkAlign").classList.contains("on"), tool: E.S.tool }; });
    check("🌐 Web View: the WEB ribbon, the tools back, the Pages panel, one page at a time, Align in front, the Move tool", we.tabs.join() === "WEB" && we.tools && we.pages && we.mode === "one" && we.align && we.tool === "move", we);
    await p.click('#pcViewRibbon .cbb[data-id="v_act_newsite"]'); await p.waitForTimeout(300);
    await p.fill(".kxdlg #wvName", "T844 Cafe"); await p.click(".kxdlg .ok"); await p.waitForTimeout(600);
    const site = await ev(() => { const E = window.imageEditorInstance.E; return { w: E.S.w, h: E.S.h, n: E.pages.count(), name: E.pages.list()[0].name }; });
    check("🌐 New Website: a 1440 × 900 px page called Home", site.w === 1440 && site.h === 900 && site.n === 1 && site.name === "Home", site);
    await p.click('#pcViewRibbon .cbb[data-id="v_act_newpage"]'); await p.waitForTimeout(300);
    await p.fill(".kxdlg #wvPage", "Menu"); await p.click(".kxdlg .ok"); await p.waitForTimeout(600);
    const pg = await ev(() => window.imageEditorInstance.E.pages.list().map((x) => x.name));
    check("＋ Web Page asks its name - the page after Home is Menu", pg.join() === "Home,Menu", pg);
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S; E.pages.go(0); const T = E.makeLayer("Title", S.w, S.h, "text"); T.text = { str: "Tiger Cafe", x: 60, y: 60, size: 64, color: "#222222", font: "Arial", weight: 700, align: "left" }; E.D.rasterize(T); S.layers.push(T); E.refresh(); });
    await p.click('#pcViewRibbon .cbb[data-id="v_act_quick"]');
    await p.waitForFunction(() => { const f = document.querySelector("#pcWebPreview iframe"); try { return f && /Tiger Cafe/.test(f.contentDocument.body.textContent); } catch (e) { return false; } }, null, { timeout: 30000 });
    await p.click('#pcWebPreview [data-dev="phone"]'); await p.waitForTimeout(500);
    const ph = await ev(() => { const b = document.querySelector("#pcWebPreview .wpdev"), f = b.querySelector("iframe"); return { w: b.style.width, nav: /Menu/.test(f.contentDocument.body.textContent), lit: document.querySelector('#pcWebPreview [data-dev="phone"]').classList.contains("on"), size: document.querySelector("#pcWebPreview .wpsize").textContent, sandbox: f.getAttribute("sandbox"), over: (() => { const a = document.getElementById("pcWebPreview").getBoundingClientRect(), s = document.getElementById("ieStage").getBoundingClientRect(); return a.left >= s.left - 1 && a.right <= s.right + 1; })() }; });
    check("⚡ Quick Preview builds the site (no AI) and shows it over the canvas; 📱 Phone = 390 px wide; the menu holds Menu; no scripts run in it",
      ph.w === "390px" && ph.nav && ph.lit && /Phone · 390 × 844/.test(ph.size) && ph.sandbox === "allow-same-origin" && ph.over, ph);
    await p.click('#pcWebPreview [data-a="close"]'); await p.waitForTimeout(200);
    check("✕ closes the preview", !(await shown("#pcWebPreview")));
    const menu = await ev(() => { const W = window.imageEditorInstance.E.ui.MENUS.find(([n]) => n === "Window"); const s = W[1].find((x) => x && x.label === "Workspace") || {}; const at = W[1].indexOf(s); return { label: s.label, items: s.items, after: W[1][at - 1] && W[1][at - 1].label, kept: window.imageEditorInstance.E.store.get("ws.view", null) }; });
    check("Window ▸ Workspace (after Arrange) lists the four views; the view picked is kept", menu.label === "Workspace" && menu.items.join() === "ws.wp,ws.vector,ws.image,ws.web" && menu.after === "Arrange" && menu.kept === "web", menu);
    // back to Image View: the ribbon goes, the preview stays shut, the tool kept
    await p.click('#pcViews [data-view="image"]'); await p.waitForTimeout(300);
    check("back to 🖼 Image View: no ribbon, the palette and dockers away", !(await shown("#pcViewRibbon")) && await ev(() => document.querySelector(".kx").classList.contains("pal-off")));
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
