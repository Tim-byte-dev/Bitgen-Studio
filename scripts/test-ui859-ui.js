#!/usr/bin/env node
/* bitGen Studio — 2.859.0 in a REAL browser: 🧩 the Web editor's Skills against the real server - ＋ Picture gallery onto index.html
 * (the markup + its link + script in the page, its files in www), saved, 👁 Preview: a thumbnail click opens the viewer, → the next;
 * ＋ Catalogue: shop.html shows the CRM's products with category chips, a chip filters, ＋ Add to cart counts; ✨ (the LLM stood
 * in) puts a cleaned section on the page. Against the running app (H3_URL). No Playwright = SKIP. */
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
  await p.route(/\/api\/llm\/chat|\/api\/chat$/, (r) => r.continue());
  try {
    await api("/api/web/create", {});
    await api("/api/web/records", { kind: "products", record: { name: "Sourdough", price: 8.5, category: "Bread" } });
    await api("/api/web/records", { kind: "products", record: { name: "Choc Cake", price: 30, category: "Cakes" } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Web, null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await ev(() => document.getElementById("tX_webdock").click());
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("webdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    await p.waitForFunction(() => /index\.html/.test(document.getElementById("wbFileName").textContent), null, { timeout: 15000 });
    await p.click("#wbSk"); await p.waitForSelector('#wbSkList [data-skadd="gallery-pictures"]');
    const n = await ev(() => document.querySelectorAll("#wbSkList .sk").length);
    await p.click('#wbSkList [data-skadd="gallery-pictures"]');
    await p.waitForFunction(() => /Picture gallery/.test(document.getElementById("wbSkOut").textContent), null, { timeout: 10000 });
    await p.click('#webdock .wbtab[data-tab="code"]');
    const code = await ev(() => document.getElementById("wbCode").value);
    check("🧩 the skills listed (11 + 2.861.0's 3); ＋ Picture gallery puts its markup, <link> and <script> into index.html (not saved yet ●)", n >= 11 && /class="bg-gallery"/.test(code) && /href="css\/bg-gallery\.css"/.test(code) && /src="js\/bg-gallery\.js"/.test(code) && await ev(() => document.getElementById("wbFileName").classList.contains("dirty")), code.slice(-800));
    await p.focus("#wbCode"); await p.keyboard.press("Control+s"); await p.waitForTimeout(500);
    await p.click('#webdock .wbtab[data-tab="prev"]');
    const fr = p.frameLocator("#wbPrev");
    await fr.locator(".bg-gallery > a").first().click();
    await p.waitForTimeout(400);
    const lb = await ev(() => { const d = document.getElementById("wbPrev").contentDocument, l = d.querySelector(".bg-lb"); return l ? { on: l.classList.contains("on"), src: (l.querySelector("img") || {}).getAttribute && l.querySelector("img").getAttribute("src") } : null; });
    await fr.locator(".bg-lb-next").click();
    const lb2 = await ev(() => document.getElementById("wbPrev").contentDocument.querySelector(".bg-lb img").getAttribute("src"));
    check("👁 Preview: a thumbnail opens the viewer; › the next picture (the gallery's files are in www)", lb && lb.on && lb.src === "images/sample-1.svg" && lb2 === "images/sample-2.svg", { lb, lb2 });
    // catalogue
    await p.click("#wbSk"); await p.waitForTimeout(200); if (!(await ev(() => document.getElementById("wbSkForm").classList.contains("on")))) await p.click("#wbSk");
    await p.click('#wbSkList [data-skadd="categories"]');
    await p.waitForFunction(() => /Catalogue/.test(document.getElementById("wbSkOut").textContent), null, { timeout: 10000 });
    await p.click("#wbSave"); await p.waitForTimeout(400);
    await p.click('#wbTree .it[data-p="shop.html"]'); await p.waitForTimeout(400);
    await p.click('#webdock .wbtab[data-tab="prev"]');
    await p.waitForFunction(() => { const d = document.getElementById("wbPrev").contentDocument; return d && d.querySelectorAll(".bg-product-card").length === 2; }, null, { timeout: 10000 });
    await p.waitForFunction(() => { const d = document.getElementById("wbPrev").contentDocument; return d && d.querySelectorAll(".bg-chips button").length === 3; }, null, { timeout: 10000 });
    const chips = await ev(() => [...document.getElementById("wbPrev").contentDocument.querySelectorAll(".bg-chips button")].map((x) => x.textContent));
    await fr.locator('.bg-chips button[data-c="Cakes"]').click();
    const shown = await ev(() => [...document.getElementById("wbPrev").contentDocument.querySelectorAll(".bg-product-card a:not(.pic)")].map((x) => x.textContent));
    await fr.locator("[data-bg-add]").first().click();
    const count = await ev(() => document.getElementById("wbPrev").contentDocument.querySelector("[data-bg-cart-count]").textContent);
    check("🗂 Catalogue: shop.html shows the CRM's products, chips All / Bread / Cakes filter, ＋ Add to cart counts", chips.join() === "All,Bread,Cakes" && shown.join() === "Choc Cake" && count === "1", { chips, shown, count });
    // ✨ with the LLM stood in
    await p.route(/\/api\/web\/skills\/ai$/, async (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ html: '<section class="bg-section"><h2>Our cakes</h2></section>\n', skills: [{ skill: "theme", name: "Theme", head: ["css/bg-theme.css"], scripts: ["js/bg-theme.js"], copied: ["css/bg-theme.css"], kept: [] }] }) }));
    await p.click('#wbTree .it[data-p="index.html"]'); await p.waitForTimeout(400);
    await p.fill("#wbSkAsk", "a section about our cakes"); await p.click("#wbSkAi");
    await p.waitForFunction(() => /✨ with Theme/.test(document.getElementById("wbSkOut").textContent), null, { timeout: 10000 });
    await p.click('#webdock .wbtab[data-tab="code"]');
    const c2 = await ev(() => document.getElementById("wbCode").value);
    check("✨ the LLM's section put on the page with its skills' link + script", /<h2>Our cakes<\/h2>/.test(c2) && /css\/bg-theme\.css/.test(c2) && /js\/bg-theme\.js/.test(c2));
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
