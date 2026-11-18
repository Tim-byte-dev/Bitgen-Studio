#!/usr/bin/env node
/* bitGen Studio — 2.848.0 in a REAL browser:
 *   🌐 Build Website has the 🔐 Admin area tick; ticked + PHP = the build's .zip has admin/index.php, admin/admin.css,
 *     inc/admin.php, inc/admin_pages.php, inc/admindb.php, admin-schema.sql and the setup key in README + config.php;
 *     the status line says the setup key; the tick is remembered;
 *   📅 Calendar Settings ▸ Database: the 🔐 Admin database field (myadmin) and Replace the hours edited on the website.
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.site && window.imageEditorInstance.E.calendar, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("imageeditdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    await ev(() => { const E = window.imageEditorInstance.E; E.views.apply("web"); E.pages.newDocument({ preset: "Custom", wmm: 508, hmm: 317.5, orient: "landscape", dpi: 72 }, 1, "T848 Shop"); E.fitView(); });
    await p.waitForTimeout(400);
    /* ---- 🌐 Build Website ▸ 🔐 */
    await ev(() => window.imageEditorInstance.E.site.dialog()); await p.waitForTimeout(400);
    const tick = await ev(() => { const t = document.getElementById("siteAdmin"); return t ? { checked: t.checked, label: t.closest("label").textContent } : null; });
    await p.fill("#siteName", "T848 Shop"); await p.fill("#siteTitle", "T848 Shop"); await p.selectOption("#siteStack", "php"); await p.uncheck("#siteAi"); await p.check("#siteAdmin");
    await ev(() => { window.open = () => null; });
    await p.click(".kxdlg.pcd .ok");
    // the status line (wherever the editor writes it) says the admin area + its setup key
    await p.waitForFunction(() => /setup key [A-Za-z0-9]{20}/.test(document.body.innerText), null, { timeout: 60000 });
    const says = [await ev(() => (/[^\n]*setup key [A-Za-z0-9]{20}[^\n]*/.exec(document.body.innerText) || [""])[0])];
    const z = await fetch(new URL("/api/sites/zip?name=T848%20Shop", URL_)), zb = Buffer.from(await z.arrayBuffer());
    const JSZip = require(path.join(__dirname, "..", "node_modules", "jszip")), zz = await JSZip.loadAsync(zb);
    const files = ["admin/index.php", "admin/admin.css", "inc/admin.php", "inc/admin_pages.php", "inc/admindb.php", "admin-schema.sql", "inc/config.php", "README.txt"];
    const key = (/setup key ([A-Za-z0-9]{20})/.exec(says.join("\n")) || [])[1];
    const readme = zz.file("README.txt") ? await zz.file("README.txt").async("string") : "", cfg = zz.file("inc/config.php") ? await zz.file("inc/config.php").async("string") : "";
    check("🌐 Build Website: the 🔐 Admin area tick; ticked + PHP = /admin/, its PHP, admin-schema.sql in the .zip; the status line says the setup key (also in README + config.php)",
      tick && /Admin area/.test(tick.label) && files.every((f) => !!zz.file(f)) && !!key && readme.includes(key) && cfg.includes(key) && /ADMIN_DB_NAME/.test(cfg), { tick, key, missing: files.filter((f) => !zz.file(f)), says: says.slice(-3) });
    const last = await ev(() => JSON.parse(window.imageEditorInstance.E.store.get("site.last", "{}")));
    check("the tick is remembered (site.last)", last.admin === true, last);
    /* ---- 📅 Calendar Settings ▸ Database */
    const L = await ev(async () => { const E = window.imageEditorInstance.E; const L = await E.calendar.create(600, 400, { mode: "booking" }); return !!L; });
    await p.waitForTimeout(800);
    await ev(() => { document.querySelectorAll(".kxdlg.pcd .cn").forEach((c) => c.click()); });   // a Download box when this server has no MariaDB
    await ev(() => { const E = window.imageEditorInstance.E; E.calendar.settings(E.S.layers.filter((l) => l.cal).pop()); }); await p.waitForTimeout(400);
    await p.click('.kxdlg.pcd [data-ctab="db"]');
    const db = await ev(() => ({ admin: (document.getElementById("pccAdminDb") || {}).value, force: !!document.getElementById("pccForce"), sql: (document.getElementById("pccSql") || {}).value || "" }));
    await p.click(".kxdlg.pcd .cn");
    check("📅 Calendar Settings ▸ Database: 🔐 Admin database = myadmin, Replace the hours + services edited on the website's admin; the SQL keeps the admin's changes", L && db.admin === "myadmin" && db.force && /admin_edited = 0/.test(db.sql) && /source = 'studio'/.test(db.sql), db);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
