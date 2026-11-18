#!/usr/bin/env node
/* bitGen Studio — 2.858.0 in a REAL browser: the Web editor's ⤴ Publish panel (GET real, the POST stood in) sends the token +
 * owner / repository / branch / private / FTP / message and shows the link; 🌐 Build Website has ☑ Into this project's www
 * folder and sends toWww. Against the running app (H3_URL). No Playwright = SKIP. */
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
  let sent = null, built = null;
  await p.route(/\/api\/web\/publish$/, async (r) => { if (r.request().method() !== "POST") return r.continue(); sent = JSON.parse(r.request().postData()); await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: "https://github.com/timpaul/default", owner: "timpaul", repo: sent.repo, branch: sent.branch, sent: 14, kept: 0, removed: 0, created: true, nothing: false, commit: "abc" }) }); });
  await p.route(/\/api\/sites\/build$/, async (r) => { built = JSON.parse(r.request().postData()); await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ name: built.name, stack: "static", pages: [{ title: "Home", by: "bitgen" }], www: { copied: 7, configMerged: null }, preview: "/sites-preview/x/index.html" }) }); });
  await p.route(/\/api\/sites\/save$/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  try {
    await fetch(new URL("/api/web/create", URL_), { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Web && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.site, null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await ev(() => document.getElementById("tX_webdock").click());
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("webdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    await p.waitForSelector('#wbTree .it[data-p="index.html"]', { timeout: 15000 });
    await p.click("#wbPub"); await p.waitForSelector("#wbPubForm.on");
    const f = await ev(() => ({ repo: document.getElementById("wbPubRepo").value, br: document.getElementById("wbPubBranch").value, priv: document.getElementById("wbPubPriv").checked, ph: document.getElementById("wbPubTok").placeholder }));
    await p.fill("#wbPubTok", "ghp_uitesttoken1234567890abcd"); await p.check("#wbPubFtp"); await p.fill("#wbPubMsg", "first");
    await p.click("#wbPubGo");
    await p.waitForFunction(() => /✓|✗/.test(document.getElementById("wbPubOut").textContent), null, { timeout: 10000 });
    const out = await ev(() => ({ t: document.getElementById("wbPubOut").textContent, href: (document.querySelector("#wbPubOut a") || {}).href }));
    check("⤴ Publish: the panel with the project's repository (main, private), sends the token, FTP and message, the link back", f.repo === "default" && f.br === "main" && f.priv && /repo scope/.test(f.ph) && sent && sent.token === "ghp_uitesttoken1234567890abcd" && sent.ftp === true && sent.message === "first" && sent.repo === "default" && /14 file\(s\) sent/.test(out.t) && out.href === "https://github.com/timpaul/default", { f, sent, out });
    // Build Website's tick
    await ev(() => { const E = window.imageEditorInstance.E; if (!E.S.w) E.openDoc(800, 600, "pub", (g) => { g.fillStyle = "#fff"; g.fillRect(0, 0, 800, 600); }); });
    await p.waitForTimeout(400);
    await ev(() => window.imageEditorInstance.E.site.dialog());
    await p.waitForSelector(".kxdlg.pcd #siteWww", { timeout: 10000 });
    const tick = await ev(() => document.getElementById("siteWww").checked);
    await ev(() => { const d = [...document.querySelectorAll(".kxdlg.pcd")].pop(); d.querySelector("#siteAi").checked = false; d.querySelector(".ok").click(); });
    await p.waitForFunction(() => /put into this project's www folder/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
    check("🌐 Build Website: ☑ Into this project's www folder (on by default) sends toWww; the result says how many files went in", tick && built && built.toWww === true && await ev(() => /7 file\(s\) put into this project's www folder/.test(document.body.innerText)), built);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
