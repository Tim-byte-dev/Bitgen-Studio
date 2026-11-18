#!/usr/bin/env node
/* bitGen Studio — 2.850.0 in a REAL browser:
 *   🌐 Build Website has the 🛒 Shop tick; ticking it picks PHP + MySQL and the 🔐 Admin area; the build's .zip has
 *     shop.php, product.php, cart.php, checkout.php, order.php, inc/shop.php, the admin area, the header's Shop + Cart, the
 *     shop's CSS and README part; the status line says the shop; the tick is remembered.
 * Against the running app (H3_URL). No Playwright = SKIP. */
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.site, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("imageeditdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    await ev(() => { const E = window.imageEditorInstance.E; E.views.apply("web"); E.pages.newDocument({ preset: "Custom", wmm: 508, hmm: 317.5, orient: "landscape", dpi: 72 }, 1, "T850 Bakery"); E.fitView(); });
    await p.waitForTimeout(400);
    await ev(() => window.imageEditorInstance.E.site.dialog()); await p.waitForTimeout(400);
    const tick = await ev(() => { const t = document.getElementById("siteShop"); return t ? { checked: t.checked, label: t.closest("label").textContent } : null; });
    await p.fill("#siteName", "T850 Bakery"); await p.fill("#siteTitle", "T850 Bakery"); await p.selectOption("#siteStack", "static"); await p.uncheck("#siteAi"); await p.uncheck("#siteAdmin");
    await p.check("#siteShop");
    const after = await ev(() => ({ stack: document.getElementById("siteStack").value, admin: document.getElementById("siteAdmin").checked }));
    check("🌐 Build Website: the 🛒 Shop tick; ticking it picks PHP + MySQL and the 🔐 Admin area", tick && /Shop/.test(tick.label) && after.stack === "php" && after.admin === true, { tick, after });
    await ev(() => { window.open = () => null; });
    await p.click(".kxdlg.pcd .ok");
    await p.waitForFunction(() => /🛒 the shop: shop\.php/.test(document.body.innerText), null, { timeout: 60000 });
    const z = await fetch(new URL("/api/sites/zip?name=T850%20Bakery", URL_)), zb = Buffer.from(await z.arrayBuffer());
    const JSZip = require(path.join(__dirname, "..", "node_modules", "jszip")), zz = await JSZip.loadAsync(zb);
    const files = ["shop.php", "product.php", "cart.php", "checkout.php", "order.php", "inc/shop.php", "admin/index.php", "inc/admindb.php", "admin-schema.sql", "css/site.css", "inc/header.php", "README.txt"];
    const rd = async (f) => (zz.file(f) ? zz.file(f).async("string") : "");
    const hdr = await rd("inc/header.php"), css = await rd("css/site.css"), readme = await rd("README.txt"), schema = await rd("admin-schema.sql");
    check("the .zip: the shop's pages + inc/shop.php, the admin area (orders with their payment method + key), the header's Shop + Cart, the shop's CSS, the README's 🛒 part",
      files.every((f) => !!zz.file(f)) && /href="shop\.php"/.test(hdr) && /href="cart\.php"/.test(hdr) && /\.shop-grid\{/.test(css) && /🛒 THE SHOP/.test(readme) && /view_token CHAR\(32\)/.test(schema), { missing: files.filter((f) => !zz.file(f)) });
    const last = await ev(() => JSON.parse(window.imageEditorInstance.E.store.get("site.last", "{}")));
    check("the tick is remembered (site.last)", last.shop === true && last.stack === "php", last);
    await ev(() => window.imageEditorInstance.E.site.dialog()); await p.waitForTimeout(300);
    const again = await ev(() => document.getElementById("siteShop").checked);
    await p.click(".kxdlg.pcd .cn");
    check("the dialog opens with 🛒 ticked next time", again === true);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
