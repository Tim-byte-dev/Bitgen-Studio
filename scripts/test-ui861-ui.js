#!/usr/bin/env node
/* bitGen Studio — 2.861.0 in a REAL browser: the Web editor's 🧩 Skills lists the three new skills in their groups (📰 Content; 📅 📍
 * Customers, "needs PHP"); ＋ Blog and news puts its list on the page and 👁 Preview shows the CRM's 📰 Posts as cards, newest first, one
 * post opened from its card; ＋ Contact and map puts the OpenStreetMap map and the form on the open page. Against the running app (H3_URL). */
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
  // 2.926.0 (TM-002): the 👁 Preview is its own origin now - its page is read through Playwright's frame, not contentDocument
  const pf = async () => { const h = await p.$("#wbPrev"); return h && h.contentFrame(); };
  const pev = async (fn) => (await pf()).evaluate(fn);
  const pwait = async (fn, ms) => { const t0 = Date.now(); for (;;) { try { const f = await pf(); if (f && await f.evaluate(fn)) return true; } catch { /* loading */ } if (Date.now() - t0 > (ms || 10000)) return false; await new Promise((r) => setTimeout(r, 200)); } };
  const api = (u, body) => fetch(new URL(u, URL_), body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}).then((r) => r.json());
  try {
    await api("/api/web/create", {});
    await api("/api/web/records", { kind: "posts", record: { title: "We are open", date: "2026-11-01", body: "Come in.\n\nFresh bread daily.", published: true } });
    await api("/api/web/records", { kind: "posts", record: { title: "Older news", date: "2026-10-01", body: "x", published: true } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Web, null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await ev(() => document.getElementById("tX_webdock").click());
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("webdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    await p.waitForFunction(() => /index\.html/.test(document.getElementById("wbFileName").textContent), null, { timeout: 15000 });
    await p.click("#wbSk"); await p.waitForSelector('#wbSkList [data-skadd="booking"]');
    const cards = await ev(() => ["booking", "blog", "contact-map"].map((id) => { const b = document.querySelector(`#wbSkList [data-skadd="${id}"]`), c = b && b.closest(".sk"); return c ? c.textContent : ""; }));
    check("🧩 the three new skills are listed: 📅 Booking widget + 📍 Contact and map say they need PHP, 📰 Blog and news does not", /Booking widget/.test(cards[0]) && /PHP/.test(cards[0]) && /Blog and news/.test(cards[1]) && !/PHP/.test(cards[1]) && /Contact and map/.test(cards[2]) && /PHP/.test(cards[2]), cards);
    await p.click('#wbSkList [data-skadd="blog"]');
    await p.waitForFunction(() => /Blog and news/.test(document.getElementById("wbSkOut").textContent), null, { timeout: 10000 });
    await p.click("#wbSave"); await p.waitForTimeout(500);
    await p.click('#webdock .wbtab[data-tab="prev"]');
    await pwait(() => { const d = document; return d && d.querySelectorAll(".bg-blog-card").length === 2; }, 10000);
    const t = await pev(() => [...document.querySelectorAll(".bg-blog-card h3")].map((h) => h.textContent));
    check("＋ Blog and news on index.html, 👁 Preview: the CRM's posts as cards, newest first", t[0] === "We are open" && t[1] === "Older news", t);
    await p.frameLocator("#wbPrev").locator(".bg-blog-card").first().click();
    await pwait(() => { const d = document; return d && d.querySelector(".bg-blog-post"); }, 10000);
    const post = await pev(() => document.querySelector(".bg-blog-post").textContent);
    check("...a card opens the post (its two paragraphs)", /We are open/.test(post) && /Fresh bread daily/.test(post), post);
    await p.click("#wbSk"); await p.waitForTimeout(200); if (!(await ev(() => document.getElementById("wbSkForm").classList.contains("on")))) await p.click("#wbSk");
    await p.click('#wbSkList [data-skadd="contact-map"]');
    await p.waitForFunction(() => /Contact and map/.test(document.getElementById("wbSkOut").textContent), null, { timeout: 10000 });
    await p.click("#wbSave"); await p.waitForTimeout(400);
    // the starter site already has its own contact.html (kept - yours): the map + form go on the open page
    await p.click('#webdock .wbtab[data-tab="prev"]');
    await pwait(() => { const d = document; return d && d.querySelector(".bg-map iframe"); }, 10000);
    const m = await pev(() => { const d = document; return { src: d.querySelector(".bg-map iframe").getAttribute("src"), credit: d.querySelector(".bg-map-foot").textContent, form: !!d.querySelector("form[data-bg-contact] [name=message]") }; });
    check("＋ Contact and map on the open page (the starter's own contact.html kept); 👁 Preview shows the OpenStreetMap map (credited) and the form", /^https:\/\/www\.openstreetmap\.org\/export\/embed\.html/.test(m.src) && /OpenStreetMap contributors/.test(m.credit) && m.form, m);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
