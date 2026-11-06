#!/usr/bin/env node
/* bitGen Studio — 2.703.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311): the 📖 Help window
 * and Ctrl+K in Simplified Chinese / Japanese (the language picker, kept), a section newer in English / not translated says so
 * (English a click away), the ❔ help pages in the language with their own picker. No server / no Playwright = SKIP.
 * Tim (verbatim): "is it possible to translate help and the user guide into chinese and japanese as additional help files?" */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.703.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const HAN = /[一-鿿]/, KANA = /[぀-ヿ]/;
(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.703.0 browser test did not run"); process.exit(0); }
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, locale: "en-AU" });
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(URL0); await p.waitForFunction(() => window.H3HelpLang && window.H3Palette && window.H3Help && window.SecFloat && SecFloat.started, null, { timeout: 30000 });
    const api = await p.evaluate(async () => { const z = await (await fetch("/api/help?lang=zh-CN")).json(), j = await (await fetch("/api/help?lang=ja")).json(), pg = await (await fetch("/api/help/page?topic=timeline&lang=ja")).json();
      return { zl: z.lang, zt: z.sections.slice(0, 3).map((s) => s.title), zn: z.sections.filter((s) => s.lang === "zh-CN").length, jt: j.sections[1].title, jk: j.shortcuts.groups[0].rows[0][1], pg: pg.lang, ph: pg.html.slice(0, 400), n: z.sections.length }; });
    check("/api/help?lang=zh-CN: the guide in Simplified Chinese (every section), ja in Japanese with the shortcuts; /api/help/page the ❔ page", api.zl === "zh-CN" && api.zn === api.n && api.zt.every((t) => HAN.test(t)) && KANA.test(api.jt + api.jk) && api.pg === "ja" && KANA.test(api.ph), api);
    check("the default follows the system language (en-AU -> English)", await p.evaluate(() => H3HelpLang.get()) === "en");
    // 📖 Help in Chinese
    await p.evaluate(() => { H3HelpLang.set("zh-CN"); return H3Palette.showHelp(""); });
    await p.waitForFunction(() => { const c = document.querySelector("#hlpBody .hlpc"); return c && /[一-鿿]/.test(c.textContent); }, null, { timeout: 15000 });
    const h1 = await p.evaluate(() => ({ title: document.querySelector("#hlpBody .hlpc h3").textContent, pick: document.querySelector("#hlpBody select.hlplang").value, opts: [...document.querySelector("#hlpBody select.hlplang").options].map((o) => o.textContent), secs: document.querySelector("#hlpBody select:not(.hlplang)").options.length, kept: localStorage.getItem("bg.helpLang") }));
    check("📖 Help in 简体中文: the section in Chinese, the language picker (English / 简体中文 / 日本語) beside the section list, kept", HAN.test(h1.title) && h1.pick === "zh-CN" && h1.opts.join() === "English,简体中文,日本語" && h1.secs > 150 && h1.kept === "zh-CN", h1);
    // switch to Japanese from the picker
    await p.selectOption("#hlpBody select.hlplang", "ja");
    await p.waitForFunction(() => /[぀-ヿ]/.test(document.querySelector("#hlpBody .hlpc").textContent), null, { timeout: 15000 });
    check("…the picker switches it to 日本語 (the same section, the section list in Japanese)", await p.evaluate(() => /[぀-ヿ]/.test(document.querySelector("#hlpBody select:not(.hlplang)").textContent)));
    // Ctrl+K finds the guide in Japanese words, and by the English name too
    const pal = await p.evaluate(() => { H3Palette.open(""); const a = H3Palette.search("タイムライン").filter((e) => e.group === "Help").length, b = H3Palette.search("Sketcher").filter((e) => e.group === "Help").length; H3Palette.close(); return [a, b]; });
    check("Ctrl+K searches the Japanese guide (タイムライン) and still finds it by an English name (Sketcher)", pal[0] > 0 && pal[1] > 0, pal);
    // a stale and a missing section (the server's answer changed by the test)
    await p.route("**/api/help?lang=zh-CN", async (route) => { const r = await route.fetch(); const j = await r.json(); j.sections[0].stale = true; const en = await (await route.fetch({ url: route.request().url().replace(/\?lang=.*/, "") })).json(); j.sections[1] = Object.assign({}, en.sections[1], { lang: "en", stale: false }); route.fulfill({ json: j }); });
    await p.evaluate(() => H3HelpLang.set("zh-CN"));
    await p.waitForFunction(() => /[一-鿿]/.test(document.querySelector("#hlpBody .hlpc").textContent) && !/[぀-ヿ]/.test(document.querySelector("#hlpBody .hlpc h3").textContent), null, { timeout: 15000 });
    const id0 = await p.evaluate(() => H3Palette.state().help.sections[0].id), id1 = await p.evaluate(() => H3Palette.state().help.sections[1].id);
    await p.evaluate((id) => H3Palette.showHelp(id), id0);
    const st = await p.evaluate(() => { const n = document.querySelector("#hlpBody [data-hlpnote]"); return n ? { kind: n.getAttribute("data-hlpnote"), text: n.textContent } : null; });
    await p.click("#hlpBody [data-hlpen]");
    await p.waitForFunction(() => !/[\u4e00-\u9fff]/.test(document.querySelector("#hlpBody .hlpc h3").textContent), null, { timeout: 15000 }).catch(() => {});
    const en0 = await p.evaluate(() => document.querySelector("#hlpBody .hlpc h3").textContent);
    await p.evaluate((id) => H3Palette.showHelp(id), id1);
    const ms = await p.evaluate(() => { const n = document.querySelector("#hlpBody [data-hlpnote]"); return n ? n.getAttribute("data-hlpnote") : null; });
    check("a section newer in English says so in Chinese, 查看英文版 shows the English one; a section not translated says so", st && st.kind === "stale" && /英文/.test(st.text) && !/[一-鿿]/.test(en0) && ms === "missing", { st, en0, ms });
    await p.unroute("**/api/help?lang=zh-CN");
    // ❔ help pages
    await p.evaluate(() => { H3HelpLang.set("ja"); H3Help.open("timeline"); });
    await p.waitForFunction(() => /[぀-ヿ]/.test(document.getElementById("hpBody").textContent), null, { timeout: 15000 });
    const hp = await p.evaluate(() => ({ title: document.getElementById("hpTitle").textContent, pick: document.querySelector("#hpDlg select.hplang").value }));
    check("❔ help (the timeline's) in 日本語 - its title too - with a language picker in its title bar", KANA.test(hp.title) && hp.pick === "ja", hp);
    await p.selectOption("#hpDlg select.hplang", "en");
    await p.waitForFunction(() => !/[぀-ヿ一-鿿]/.test(document.getElementById("hpBody").textContent.slice(0, 400)), null, { timeout: 15000 });
    check("…switched to English there, the 📖 Help window follows (one setting)", await p.evaluate(() => H3HelpLang.get() === "en" && document.querySelector("#hlpBody select.hlplang").value === "en"));
    await p.route(/\/api\/help\/page\?/, (route) => route.fulfill({ json: { html: "<h2>旧</h2><p>旧的页面</p>", lang: "zh-CN", stale: true } }));
    await p.evaluate(() => H3HelpLang.set("zh-CN"));
    await p.waitForSelector("#hpBody [data-hpnote=stale]", { timeout: 15000 });
    await p.click("#hpBody [data-hpnote=stale] button");
    await p.waitForFunction(() => !document.querySelector("#hpBody [data-hpnote]") && /timeline|Timeline|clip/i.test(document.getElementById("hpBody").textContent), null, { timeout: 15000 });
    check("a ❔ page newer in English says so, its button shows the English page", true);
    await p.unroute(/\/api\/help\/page\?/);
    await p.evaluate(() => { document.getElementById("hpDlg").close(); H3HelpLang.set("en"); localStorage.removeItem("bg.helpLang"); });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
