#!/usr/bin/env node
/* bitGen Studio — 2.705.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311): the language
 * dropdown left of ⊞ changes the app's own words at once (and the guide's - one setting), new words the app writes are
 * translated as they appear, the editors stay English (this release), back to English puts every word back. No server / no
 * Playwright = SKIP.  Tim (verbatim): "is it possible to add a language dropdown to the left of docker layout and change the
 * language of the ui on change?" */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.705.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const CJK = /[぀-ヿ一-鿿]/;
(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.705.0 browser test did not run"); process.exit(0); }
  const b = await chromium.launch();
  try {
    const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 }, locale: "en-US" })).newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(URL0); await p.waitForFunction(() => window.H3UiLang && document.getElementById("uiLangSel") && document.getElementById("dockCfgBtn"), null, { timeout: 30000 });
    const pos = await p.evaluate(() => { const s = document.getElementById("uiLangSel"), btn = document.getElementById("dockCfgBtn"), a = s.getBoundingClientRect(), c = btn.getBoundingClientRect();
      return { left: a.right <= c.left + 1, same: Math.abs((a.top + a.bottom) / 2 - (c.top + c.bottom) / 2) < 12, opts: [...s.options].map((o) => o.textContent), val: s.value, lang: document.documentElement.getAttribute("data-uilang") }; });
    check("the language dropdown sits just left of ⊞ (docker layout) on the menu bar: English / 简体中文 / 繁體中文 / 日本語; English to start", pos.left && pos.same && pos.opts.join() === "English,简体中文,繁體中文,日本語" && pos.val === "en", pos);
    const before = await p.evaluate(() => ({ gen: document.querySelector('[data-stab="general"]').textContent, set: document.getElementById("openSettings").title, ie: (document.querySelector("#imageeditdock .bhead") || {}).textContent || "" }));
    for (const [lang, test] of [["zh-CN", /[一-鿿]/], ["ja", /[぀-ヿ一-鿿]/], ["zh-TW", /[一-鿿]/]]) {
      await p.selectOption("#uiLangSel", lang);
      await p.waitForFunction((l) => document.documentElement.getAttribute("data-uilang") === l && window.H3UiLang.state().dict, lang, { timeout: 15000 });
      const r = await p.evaluate((enSet) => {
        const D = H3UiLang.state().dict, gen = document.querySelector('[data-stab="general"]').textContent, set = document.getElementById("openSettings").title;
        // how much of the main window's visible words are translated now
        let en = 0, tr = 0; const w = document.createTreeWalker(document.getElementById("menubar").parentElement || document.body, 4, null); let n;
        while ((n = w.nextNode())) { const e = n.parentElement; if (!e || e.closest(H3UiLang.SKIP) || !e.getClientRects().length) continue; const v = n.nodeValue.trim(); if (!/[A-Za-z]{3}/.test(v) && !/[぀-ヿ一-鿿]/.test(v)) continue; if (/[぀-ヿ一-鿿]/.test(v)) tr++; else en++; }
        return { gen, set, want: D.General, wantSet: H3UiLang.tr(enSet, D), tr, en, ie: (document.querySelector("#imageeditdock .bhead") || {}).textContent || "" };
      }, before.set);
      check(`${lang}: the app's words change at once - Settings' tabs, the ⚙ tooltip, most of what is on screen, the image editor's title too (2.707.0)`,
        r.gen === r.want && test.test(r.gen) && r.set === r.wantSet && r.tr > r.en && test.test(r.ie), r);
    }
    // the app writes new words while it runs - translated as they appear (before they are painted)
    const dyn = await p.evaluate(async () => { const D = H3UiLang.state().dict, k = Object.keys(D).find((x) => /^[A-Z][a-z]+$/.test(x)); const b = document.createElement("button"); b.textContent = "⚙ " + k; b.title = k; document.getElementById("menubar").appendChild(b);
      await new Promise((r) => setTimeout(r, 50)); const out = { k, t: b.textContent, tt: b.title, want: "⚙ " + D[k] }; b.textContent = "⚙ " + k; await new Promise((r) => setTimeout(r, 50)); out.again = b.textContent; b.remove(); return out; });
    check("words the app writes later (a new button, its tooltip, the same words written again) are translated as they appear", dyn.t === dyn.want && dyn.tt === dyn.want.slice(2) && dyn.again === dyn.want, dyn);
    // the guide follows (one setting)
    await p.evaluate(() => H3Palette.showHelp(""));
    await p.waitForFunction(() => /[一-鿿]/.test(document.querySelector("#hlpBody .hlpc").textContent), null, { timeout: 15000 });
    check("…and the 📖 Help guide is in the same language (one setting)", await p.evaluate(() => document.querySelector("#hlpBody select.hlplang").value === "zh-TW"));
    // back to English: every word back
    await p.selectOption("#uiLangSel", "en");
    await p.waitForFunction(() => document.documentElement.getAttribute("data-uilang") === "en", null, { timeout: 15000 });
    const back = await p.evaluate(() => ({ gen: document.querySelector('[data-stab="general"]').textContent, set: document.getElementById("openSettings").title, cjk: (() => { let c = 0; const w = document.createTreeWalker(document.getElementById("menubar"), 4, null); let n; while ((n = w.nextNode())) if (/[぀-ヿ一-鿿]/.test(n.nodeValue) && !n.parentElement.closest("#uiLangSel, .hlplang, .hplang")) c++; return c; })() }));
    check("back to English: every word back as it was (nothing reloaded)", back.gen === before.gen && back.set === before.set && back.cjk === 0, { back, before });
    check("ComfyUI's status keeps its state for the start-on-click (not its words)", await p.evaluate(() => { const s = document.getElementById("sbcomfy"); return !s || !s.textContent || !!s.dataset.state; }));
    check("no page errors", errs.length === 0, errs);
    await p.evaluate(() => { try { localStorage.removeItem("bg.helpLang"); } catch (e) {} });
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
