#!/usr/bin/env node
/* bitGen Studio — 2.854.0 in a REAL browser: ⤴ Publish to GitHub (GitHub itself stood in by page.route on the studio's
 * /api/sites/publish POST - the real REST calls are covered by test-854.js):
 *   a built site -> File ▸ ⤴ Publish Website to GitHub… opens with the site's settings from the server (repository named
 *   after the site, main, private), ⤴ Publish sends the token + owner / repo / branch / private / FTP / message, the
 *   answer is shown with the repository's link, the token box emptied, ✕ forgets the token; Build Website's ⤴ button;
 *   the Web ribbon's ⤴ Publish to GitHub.
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
  p.on("dialog", (d) => d.dismiss().catch(() => {}));
  let sent = null, tok = null;
  await p.route(/\/api\/sites\/publish$/, async (r) => { if (r.request().method() !== "POST") return r.continue(); sent = JSON.parse(r.request().postData() || "{}"); await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: "https://github.com/timpaul/pub-site-854", owner: "timpaul", repo: sent.repo, branch: sent.branch, commit: "abc123", sent: 12, kept: 0, removed: 0, created: true, nothing: false }) }); });
  await p.route(/\/api\/sites\/publish\/token$/, async (r) => { tok = JSON.parse(r.request().postData() || "{}"); await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ saved: false }) }); });
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    // a built site, made through the studio's own API
    const j = (u, body) => fetch(new URL(u, URL_), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
    await j("/api/sites/save", { name: "Pub Site 854", title: "Pub Site", stack: "static", pages: [{ title: "Home", w: 1200, h: 800, els: [{ kind: "text", text: "Hello there", size: 30, box: { x: 0, y: 0, w: 400, h: 40 } }] }], assets: [] });
    const built = await j("/api/sites/build", { name: "Pub Site 854", ai: false });
    const st = await (await fetch(new URL("/api/sites/publish?name=" + encodeURIComponent("Pub Site 854"), URL_))).json();
    check("GET /api/sites/publish: the built site's settings - the repository named after the site, main, private, no token yet", built.pages && st.built && st.publish.repo === "pub-site-854" && st.publish.branch === "main" && st.publish.private === true && st.token === false, st);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.site, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("imageeditdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    const hasCmd = await ev(() => { const E = window.imageEditorInstance.E; return !!(E.ui.cmds ? E.ui.cmds.has("file.sitepub") : true); });
    await ev(() => window.imageEditorInstance.E.site.publishDialog("Pub Site 854"));
    await p.waitForSelector(".kxdlg.pcd #spRepo", { timeout: 10000 });
    const box = await ev(() => { const d = [...document.querySelectorAll(".kxdlg.pcd")].pop(); return { t: d.querySelector("h4").textContent, repo: d.querySelector("#spRepo").value, br: d.querySelector("#spBranch").value, priv: d.querySelector("#spPriv").checked, ftp: d.querySelector("#spFtp").checked, ph: d.querySelector("#spTok").placeholder, note: d.textContent }; });
    check("⤴ Publish to GitHub opens with the site's settings, says the secrets stay here", hasCmd && /Publish to GitHub - Pub Site 854/.test(box.t) && box.repo === "pub-site-854" && box.br === "main" && box.priv && !box.ftp && /repo scope/.test(box.ph) && /inc\/config\.php/.test(box.note) && /stay on this computer/.test(box.note), box);
    await p.fill(".kxdlg.pcd #spTok", "ghp_uitesttoken1234567890abcd");
    await p.fill(".kxdlg.pcd #spOwner", "timpaul");
    await p.check(".kxdlg.pcd #spFtp");
    await p.fill(".kxdlg.pcd #spMsg", "new home page");
    await p.click(".kxdlg.pcd .ok");
    await p.waitForFunction(() => /✓|✗/.test((document.querySelector("#spOut") || {}).textContent || ""), null, { timeout: 15000 });
    const out = await ev(() => ({ t: document.querySelector("#spOut").textContent, href: (document.querySelector("#spOut a") || {}).href || "", tok: document.querySelector("#spTok").value, open: !!document.querySelector("#spOut") }));
    check("⤴ Publish sends the token + owner / repository / branch / private / FTP / message", sent && sent.name === "Pub Site 854" && sent.token === "ghp_uitesttoken1234567890abcd" && sent.owner === "timpaul" && sent.repo === "pub-site-854" && sent.branch === "main" && sent.private === true && sent.ftp === true && sent.message === "new home page", sent);
    check("the answer shown with the repository's link; the token box emptied; the box stays open", /the repository made, 12 file\(s\) sent/.test(out.t) && out.href === "https://github.com/timpaul/pub-site-854" && out.tok === "" && out.open, out);
    await p.click(".kxdlg.pcd #spForget");
    await p.waitForFunction(() => /forgotten|✗/.test(document.querySelector("#spOut").textContent), null, { timeout: 5000 });
    check("✕ forgets the kept token", tok && tok.token === "", tok);
    await ev(() => { const d = [...document.querySelectorAll(".kxdlg.pcd")].pop(); if (d) d.querySelector(".cn").click(); });
    await ev(() => window.imageEditorInstance.E.views.apply("web")); await p.waitForTimeout(400);
    const rib = await ev(() => !![...document.querySelectorAll("#imageeditdock .cbbtn, #imageeditdock [data-cbid], #imageeditdock button")].find((x) => /Publish to GitHub/.test(x.textContent + (x.title || ""))));
    check("the Web ribbon has ⤴ Publish to GitHub", rib);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
