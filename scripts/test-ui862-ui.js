#!/usr/bin/env node
/* bitGen Studio — 2.862.0 in a REAL browser: the 🧩 web skill cards follow the language dropdown - 日本語 names, descriptions, groups
 * and the PHP note; back to English. Against the running app (H3_URL). No Playwright = SKIP. */
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
    await fetch(new URL("/api/web/create", URL_), { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Web && window.H3UiLang && document.getElementById("uiLangSel"), null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await ev(() => document.getElementById("tX_webdock").click());
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("webdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    await p.click("#wbSk"); await p.waitForSelector('#wbSkList [data-skadd="booking"]');
    const card = () => ev(() => { const c = document.querySelector('#wbSkList [data-skadd="booking"]').closest(".sk"); return { t: c.querySelector("b").textContent, p: c.querySelector("p").textContent, note: c.querySelectorAll("p")[1] && c.querySelectorAll("p")[1].textContent, groups: [...document.querySelectorAll("#wbSkList .grp")].map((g) => g.textContent) }; });
    const en = await card();
    await p.selectOption("#uiLangSel", "ja");
    await p.waitForFunction(() => document.documentElement.getAttribute("data-uilang") === "ja" && window.H3UiLang.state().dict, null, { timeout: 15000 });
    await p.waitForFunction(() => /予約/.test(document.querySelector('#wbSkList [data-skadd="booking"]').closest(".sk").querySelector("b").textContent), null, { timeout: 8000 }).catch(() => {});
    const ja = await card();
    check("日本語: the booking card's name, description, the PHP note and the groups in Japanese (the icon kept)", en.t === "📅 Booking widget" && ja.t === "📅 予約ウィジェット" && /訪問者/.test(ja.p) && /PHP/.test(ja.note) && /ホスト/.test(ja.note) && ja.groups.includes("ギャラリー") && ja.groups.includes("顧客"), { en, ja });
    await p.click("#wbSkNo"); await p.click("#wbSk"); await p.waitForSelector('#wbSkList [data-skadd="blog"]');
    await p.waitForTimeout(600);
    const again = await ev(() => document.querySelector('#wbSkList [data-skadd="blog"]').closest(".sk").querySelector("b").textContent);
    check("...the list drawn again (closed + opened) comes out in Japanese too", again === "📰 ブログとニュース", again);
    await p.selectOption("#uiLangSel", "en");
    await p.waitForFunction(() => document.documentElement.getAttribute("data-uilang") === "en", null, { timeout: 15000 });
    await p.waitForTimeout(500);
    check("...English again: the card back as it was", (await card()).t === "📅 Booking widget");
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
