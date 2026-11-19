#!/usr/bin/env node
/* bitGen Studio — 2.866.0 in a REAL browser: the WYSIWYG's ◧ block toolbar (icons only; 🖼 ▸ picture / video / audio / 3D, 📅, 📋, 🛍, 🗂 ▸ the
 * CRM's categories, 🦸, ⎺ at the top, ⎽ at the end - their files into www, the style sheet + script once, dashed boxes for what the site
 * fills), 📱 Phone + tablet (viewport + bg-responsive, once), the ▭ / 📱 widths, ⇡ auto-hide. Against the running app (H3_URL). */
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
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  const api = (u, body) => fetch(new URL(u, URL_), body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}).then((r) => r.json());
  try {
    await api("/api/web/create", {});
    await api("/api/web/records", { kind: "products", record: { name: "Rye", price: 7, category: "Bread", image: "images/sample-1.svg" } });
    await api("/api/web/records", { kind: "products", record: { name: "Tart", price: 9, category: "Cakes" } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Web && window.WbWys, null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await ev(() => document.getElementById("tX_webdock").click());
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("webdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    await p.waitForFunction(() => /index\.html/.test(document.getElementById("wbFileName").textContent), null, { timeout: 15000 });
    await p.click('#webdock .wbtab[data-tab="wys"]'); await p.waitForTimeout(600);
    const bar = await ev(() => { const b = document.getElementById("wbBlocks"), f = document.getElementById("wbWys"); return { icons: [...b.querySelectorAll("button")].map((x) => x.textContent), left: b.getBoundingClientRect().right <= f.getBoundingClientRect().left + 1, titles: [...b.querySelectorAll("button")].map((x) => x.title).join("|") }; });
    check("◧ the WYSIWYG's block toolbar, icons only, left of the page: gallery, calendar, booking sheet, product pictures, category, hero, header, footer", bar.icons.join("") === "🖼📅📋🛍🗂🦸⎺⎽" && bar.left && /Gallery ▸/.test(bar.titles) && /Booking sheet/.test(bar.titles), bar);
    // header at the top
    await p.click('#wbBlocks [data-blk="header"]'); await p.waitForTimeout(500);
    let code = await ev(() => window.H3Web.currentText());
    check("⎺ header: right after <body> (wherever the cursor is), the layout's style sheet + script once, the page marked changed", /<body[^>]*>\n<header class="bg-header">/.test(code) && (code.match(/bg-layout\.css/g) || []).length === 1 && (code.match(/bg-layout\.js/g) || []).length === 1 && await ev(() => document.getElementById("wbFileName").classList.contains("dirty")), code.slice(0, 700));
    await p.click('#wbBlocks [data-blk="footer"]'); await p.waitForTimeout(500);
    code = await ev(() => window.H3Web.currentText());
    const fi = code.indexOf('<footer class="bg-footer">'), si = code.lastIndexOf("<script"), bi = code.search(/<\/body>/i);
    check("⎽ footer: at the end, before the page's scripts; the layout files not added twice", fi > 0 && fi < si && si < bi && (code.match(/bg-layout\.css/g) || []).length === 1, code.slice(-500));
    // gallery ▸ picture, at the cursor in the page
    await ev(() => { const d = document.getElementById("wbWys").contentDocument, h = d.querySelector("h1") || d.body.firstElementChild; const r = d.createRange(); r.selectNodeContents(h); r.collapse(false); const s = d.getSelection(); s.removeAllRanges(); s.addRange(r); });
    await p.click('#wbBlocks [data-blk="gallery"]'); await p.waitForSelector("#wbBlkFly");
    const fly = await ev(() => [...document.querySelectorAll("#wbBlkFly button")].map((b) => b.textContent.trim()));
    await p.click('#wbBlkFly [data-i="0"]'); await p.waitForTimeout(700);
    code = await ev(() => window.H3Web.currentText());
    check("🖼 ▸ the gallery kinds (pictures, video, audio, 3D); Picture gallery put in at the cursor with its css + js; the sample pictures in www", fly.join("|") === "🖼 Picture gallery|🎬 Video gallery|🎵 Audio playlist|🧊 3D model gallery" && /class="bg-gallery"/.test(code) && /bg-gallery\.css/.test(code) && /bg-gallery\.js/.test(code) && await ev(() => fetch("/web-preview/images/sample-1.svg").then((r) => r.ok)), { fly });
    // category ▸ from the CRM
    await p.click('#wbBlocks [data-blk="category"]'); await p.waitForSelector("#wbBlkFly");
    const cats = await ev(() => [...document.querySelectorAll("#wbBlkFly button")].map((b) => b.textContent.trim()));
    await p.click('#wbBlkFly [data-i="0"]'); await p.waitForTimeout(600);
    code = await ev(() => window.H3Web.currentText());
    check("🗂 ▸ the CRM's categories (Bread, Cakes); one picked = that category of the shop", cats.join("|") === "🗂 Bread|🗂 Cakes" && /<div data-bg-catalog="" data-category="Bread"><\/div>|<div data-bg-catalog data-category="Bread"><\/div>/.test(code), cats);
    const ph = await ev(() => { const d = document.getElementById("wbWys").contentDocument, e = d.querySelector("[data-bg-catalog]"); return e ? getComputedStyle(e, "::before").content : ""; });
    check("...in the editor it shows as a dashed box with its name (scripts are off here)", /a category of the shop/.test(ph), ph);
    await p.click('#wbBlocks [data-blk="sheet"]'); await p.waitForTimeout(600);
    code = await ev(() => window.H3Web.currentText());
    check("📋 booking sheet: the request form (day, time, people) with the contact form's files", /bg-booking-sheet/.test(code) && /name="people"/.test(code) && /bg-contact\.js/.test(code), "");
    // 📱
    await p.click("#wbResp"); await p.waitForTimeout(500);
    await p.click("#wbResp"); await p.waitForTimeout(300);
    code = await ev(() => window.H3Web.currentText());
    check("📱 Phone + tablet: the viewport line and <style id=\"bg-responsive\"> - pressed again it stays one", (code.match(/id="bg-responsive"/g) || []).length === 1 && /name="viewport"/.test(code) && /max-width: 640px/.test(code), code.slice(0, 400));
    await p.click('#wbWysBar [data-wysw="390px"]'); await p.waitForTimeout(450);   // the width eases in
    const w = await ev(() => document.getElementById("wbWys").getBoundingClientRect().width);
    check("📱 on the WYSIWYG bar: the page at phone width", Math.abs(w - 390) < 3, w);
    await p.click('#wbWysBar [data-wysw="100%"]');
    // auto-hide
    await p.check("#wbAutoHide"); await p.mouse.move(800, 700); await p.waitForTimeout(400);
    const h1 = await ev(() => document.getElementById("wbTopBar").getBoundingClientRect().height);
    const r = await ev(() => document.getElementById("wbTopBar").getBoundingClientRect());
    await p.mouse.move(r.left + 50, r.top + 3); await p.waitForTimeout(400);
    const h2 = await ev(() => document.getElementById("wbTopBar").getBoundingClientRect().height);
    check("⇡ Auto-hide: the top bar folds to a thin strip, opens again under the pointer; kept", h1 <= 8 && h2 > 20 && await ev(() => localStorage.getItem("wb.autohide") === "1"), { h1, h2 });
    await p.uncheck("#wbAutoHide");
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
