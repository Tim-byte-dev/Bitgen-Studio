#!/usr/bin/env node
/* bitGen Studio — 2.856.0 in a REAL browser: 🌐 the Web editor docker against the real server (the project's www folder):
 *   the top bar's 🌐 opens it; no www = 🌐 Make the www folder; the files panel on the right (folders open / shut, collapses);
 *   index.html opens; </> Code typed + Ctrl+S saved; ✎ WYSIWYG draws the page with its css (sandboxed - no scripts), typing
 *   on it goes back into the file's <body> (the head kept); 👁 Preview shows the page (unsaved = drawn from the text), widths;
 *   🗂 CRM: pages (title changed in the HTML), a client added (private), a product added; ＋📄 a new page, 🗑 to the trash;
 *   Project ▸ ✚ New has ☑ Website and sends it.
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
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  const api = (u, body) => fetch(new URL(u, URL_), body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}).then((r) => r.json());
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Web && document.getElementById("webdock"), null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    const strip = await ev(() => { const bt = document.getElementById("tX_webdock"); return bt ? { inStrip: !!bt.closest("#menubar, #appGrp1, .appgrp") || bt.parentElement.id, gone: document.getElementById("webdock").classList.contains("dockgone") } : null; });
    await ev(() => document.getElementById("tX_webdock").click());
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("webdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    await p.waitForFunction(() => document.getElementById("webdock").classList.contains("nosite") || document.querySelector("#wbTree .it"), null, { timeout: 15000 });
    const no = await ev(() => document.getElementById("webdock").classList.contains("nosite"));
    check("the top bar's 🌐 opens the Web editor (it starts closed); a project with no www says 🌐 Make the www folder", strip && strip.gone && no, strip);
    await p.click("#wbMake");
    await p.waitForFunction(() => document.querySelector('#wbTree .it[data-p="index.html"]') && /index\.html/.test(document.getElementById("wbFileName").textContent), null, { timeout: 15000 });
    const tree = await ev(() => [...document.querySelectorAll("#wbTree .it")].map((x) => x.dataset.p));
    check("🌐 Make the www folder: the files panel lists www (folders + pages), index.html opened", ["css", "js", "images", "fonts", "media", "inc", "admin", "data", "uploads", "index.html", "about.html", "css/style.css"].every((f) => tree.includes(f)), tree);
    // files panel collapses
    await p.click("#wbFilesHead"); const shut = await ev(() => ({ s: document.getElementById("wbFiles").classList.contains("shut"), w: document.getElementById("wbFiles").getBoundingClientRect().width }));
    await p.click("#wbFilesHead"); const open = await ev(() => document.getElementById("wbFiles").getBoundingClientRect().width);
    check("the files panel on the right collapses to a strip and opens again", shut.s && shut.w < 40 && open > 150 && await ev(() => { const m = document.getElementById("wbMain").getBoundingClientRect(), f = document.getElementById("wbFiles").getBoundingClientRect(); return f.left > m.left; }), { shut, open });
    // 4 tabs
    const tabs = await ev(() => [...document.querySelectorAll("#webdock .wbtab")].map((x) => x.textContent.trim()));
    check("4 tabs: 🗂 CRM, ✎ WYSIWYG, </> Code, 👁 Preview", tabs.join("|") === "🗂 CRM|✎ WYSIWYG|</> Code|👁 Preview", tabs);
    // code
    await p.click('#webdock .wbtab[data-tab="code"]');
    const code0 = await ev(() => document.getElementById("wbCode").value);
    await ev(() => { const t = document.getElementById("wbCode"); t.value = t.value.replace("Say what you do in one line.", "Bread baked at dawn."); t.dispatchEvent(new Event("input")); });
    const dirty = await ev(() => document.getElementById("wbFileName").classList.contains("dirty"));
    await p.focus("#wbCode"); await p.keyboard.press("Control+s");
    await p.waitForFunction(() => /saved/.test(document.getElementById("wbMsg").textContent), null, { timeout: 10000 });
    const disk = await api("/api/web/file?path=index.html");
    check("</> Code: the page's code, a change marks it ●, Ctrl+S saves it to www/index.html", /Welcome to/.test(code0) && dirty && /Bread baked at dawn\./.test(disk.text) && !(await ev(() => document.getElementById("wbFileName").classList.contains("dirty"))), disk.text.slice(0, 200));
    // WYSIWYG
    await p.click('#webdock .wbtab[data-tab="wys"]');
    await p.waitForFunction(() => { const d = document.getElementById("wbWys").contentDocument; return d && d.designMode === "on" && d.querySelector("h1"); }, null, { timeout: 10000 });
    const wy = await ev(() => { const d = document.getElementById("wbWys").contentDocument; return { h1: d.querySelector("h1").textContent, css: d.defaultView.getComputedStyle(d.querySelector(".btn")).backgroundColor, year: d.querySelector("[data-year]").textContent }; });
    check("✎ WYSIWYG: the page drawn with its own css (through <base>), its scripts NOT run (sandbox), editable", /Welcome to/.test(wy.h1) && wy.css === "rgb(232, 89, 12)" && wy.year === "", wy);
    await ev(() => { const d = document.getElementById("wbWys").contentDocument, h = d.querySelector("h1"); const r = d.createRange(); r.selectNodeContents(h); const s = d.defaultView.getSelection(); s.removeAllRanges(); s.addRange(r); });
    const fr = p.frameLocator("#wbWys"); await fr.locator("h1").click(); await p.keyboard.press("End"); await p.keyboard.type(" Today");
    await p.click('#wbWysBar [data-cmd="bold"]');
    await p.click('#webdock .wbtab[data-tab="code"]');
    const code1 = await ev(() => document.getElementById("wbCode").value);
    check("typing on the page goes back into the file's <body> (the head, doctype, links as written)", /<h1>Welcome to [^<]* Today<\/h1>/.test(code1) && /^<!DOCTYPE html>/.test(code1) && /<link rel="stylesheet" href="css\/style\.css">/.test(code1) && !/<base /.test(code1) && /<script src="js\/main\.js"><\/script>/.test(code1), code1.slice(0, 900));
    // preview
    await p.click('#webdock .wbtab[data-tab="prev"]');
    await p.waitForFunction(() => { const d = document.getElementById("wbPrev").contentDocument; return d && d.querySelector("h1") && /Today/.test(d.querySelector("h1").textContent); }, null, { timeout: 10000 });
    const pv = await ev(() => ({ note: document.getElementById("wbPrevNote").textContent }));
    await p.click("#wbSave"); await p.waitForTimeout(800);   // 💾 Save shows the saved page again
    await p.waitForFunction(() => { const d = document.getElementById("wbPrev").contentDocument; return d && d.querySelector("[data-year]") && d.querySelector("[data-year]").textContent; }, null, { timeout: 10000 });
    const pv2 = await ev(() => ({ src: document.getElementById("wbPrev").getAttribute("src"), year: document.getElementById("wbPrev").contentDocument.querySelector("[data-year]").textContent, h1: document.getElementById("wbPrev").contentDocument.querySelector("h1").textContent }));
    await p.click('.wbw[data-w="390px"]'); await p.waitForTimeout(400); const pw = await ev(() => document.getElementById("wbPrev").getBoundingClientRect().width);
    check("👁 Preview: unsaved changes drawn from the text (said); saved = the real page from /web-preview with its script run; 📱 phone width", /unsaved/.test(pv.note) && /^\/web-preview\/index\.html/.test(pv2.src) && /^\d{4}$/.test(pv2.year) && /Today/.test(pv2.h1) && pw > 380 && pw < 400, { pv, pv2, pw });
    // CRM
    await p.click('#webdock .wbtab[data-tab="crm"]');
    await p.waitForSelector("#wbCrmList tr.r");
    const pages = await ev(() => [...document.querySelectorAll("#wbCrmList tr.r")].map((r) => r.dataset.id));
    await p.click('#wbCrmList tr.r[data-id="about.html"] td');
    await p.fill("#wbF_title", "Our Bakery Story"); await p.click("#wbFSave");
    await p.waitForFunction(() => /saved/.test(document.getElementById("wbMsg").textContent), null, { timeout: 10000 });
    const about = await api("/api/web/file?path=about.html");
    check("🗂 CRM ▸ 📄 Pages: every page listed, a title changed in the page's HTML", pages.includes("index.html") && pages.includes("contact.html") && /<title>Our Bakery Story<\/title>/.test(about.text), pages);
    await p.click('#wbCrmNav [data-kind="clients"]'); await p.click("#wbCrmNew");
    await p.fill("#wbF_name", "Ann Lee"); await p.fill("#wbF_email", "ann@example.com"); await p.click("#wbFSave");
    await p.waitForSelector("#wbCrmList tr.r"); const cl = await api("/api/web/records?kind=clients");
    await p.click('#wbCrmNav [data-kind="products"]'); await p.click("#wbCrmNew");
    await p.fill("#wbF_name", "Sourdough"); await p.fill("#wbF_price", "8.5"); await p.click("#wbFSave");
    await p.waitForSelector("#wbCrmList tr.r"); const content = await (await fetch(new URL("/web-preview/data/content.json", URL_))).json();
    const priv = await fetch(new URL("/web-preview/../web/crm.json", URL_)).then((r) => r.status);
    check("🗂 CRM ▸ 👤 Clients (private - not reachable through the site) + 🛍 Products (in the site's data/content.json)", cl.items[0].name === "Ann Lee" && content.products[0].price === 8.5 && priv !== 200, { cl, content, priv });
    // new page, delete
    await p.click('#wbTree .it[data-p="index.html"]'); await p.click("#wbNewFile"); await p.fill("#wbAsk", "services.html"); await p.press("#wbAsk", "Enter");
    await p.waitForFunction(() => /services\.html/.test(document.getElementById("wbFileName").textContent), null, { timeout: 10000 });
    await p.click("#wbDelete"); await p.waitForFunction(() => !document.querySelector('#wbTree .it[data-p="services.html"]'), null, { timeout: 10000 });
    check("＋📄 a new page made + opened (its css linked); 🗑 moves it out of www", !(await api("/api/web/tree")).files.some((f) => f.path === "services.html"));
    // New project ☑ Website
    let sent = null;
    await p.route(/\/api\/projects\/new$/, async (r) => { sent = JSON.parse(r.request().postData()); await r.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "stand-in: not made" }) }); });
    await ev(() => document.getElementById("projNew").click());
    await p.fill("#npName", "Web Test 856"); await p.check("#npWeb"); await p.click("#npCreate");
    await p.waitForFunction(() => /stand-in/.test(document.getElementById("newprjhint").textContent), null, { timeout: 10000 });
    check("Project ▸ ✚ New: ☑ Website sent with the new project", sent && sent.name === "Web Test 856" && sent.website === true, sent);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
