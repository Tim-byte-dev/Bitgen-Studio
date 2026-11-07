#!/usr/bin/env node
/* bitGen Studio — 2.706.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311): Settings in
 * 简体中文 / 日本語 / 繁體中文 - every tab's words, and the status lines the app writes while it runs (a token check, a
 * multi-line package status, the dockers' sizes) translated as they appear. No server / no Playwright = SKIP.
 * Tim (verbatim): "do the settings dialog next, the other dockers can go into the next edit" */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.706.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const CJK = /[぀-ヿ一-鿿]/;
(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.706.0 browser test did not run"); process.exit(0); }
  const b = await chromium.launch();
  try {
    const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 }, locale: "en-US" })).newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(URL0); await p.waitForFunction(() => window.H3UiLang && document.getElementById("uiLangSel"), null, { timeout: 30000 });
    for (const lang of ["zh-CN", "ja", "zh-TW"]) {
      await p.selectOption("#uiLangSel", lang);
      await p.waitForFunction((l) => document.documentElement.getAttribute("data-uilang") === l && H3UiLang.state().dict && H3UiLang.state().pats, lang, { timeout: 15000 });
      await p.evaluate(() => { const d = document.getElementById("settings"); if (!d.open) document.getElementById("openSettings").click(); });
      await p.waitForTimeout(800);
      const tabs = await p.evaluate(() => [...document.querySelectorAll("[data-stab]")].map((t) => t.dataset.stab));
      let cjk = 0, sentences = [], tabWords = [];
      for (const t of tabs) {
        await p.evaluate((t) => document.querySelector(`[data-stab="${t}"]`).click(), t); await p.waitForTimeout(500);
        const r = await p.evaluate((t) => {
          const d = document.getElementById("settings"), out = { cjk: 0, en: [], tab: document.querySelector(`[data-stab="${t}"]`).textContent };
          const w = document.createTreeWalker(d, 4, null); let n;
          while ((n = w.nextNode())) { const e = n.parentElement; if (!e || !e.getClientRects().length || e.closest(H3UiLang.SKIP)) continue; const v = n.nodeValue.trim(); if (!v) continue;
            if (/[぀-ヿ一-鿿]/.test(v)) out.cjk++;
            else if ((v.match(/\b[a-z]{3,}\b/g) || []).length >= 4 && !/[\\/]|\.(js|json|safetensors|gguf)\b|https?:/.test(v)) out.en.push(v.slice(0, 80)); }   // an English SENTENCE (names / paths / files are fine)
          return out;
        }, t);
        cjk += r.cjk; sentences.push(...r.en.map((x) => t + ": " + x)); tabWords.push(r.tab);
      }
      check(`${lang}: Settings - all ${tabs.length} tabs' names translated (names - ComfyUI, LLM, ControlNet, 3D - stay), ${cjk} pieces of text in the language, English sentences left: ${sentences.length} (at most 3)`,
        tabWords.every((x) => CJK.test(x) || /^(ComfyUI|LLM|ControlNet|3D)$/.test(x.trim())) && cjk > 800 && sentences.length <= 3, { tabWords: tabWords.filter((x) => !CJK.test(x)), sentences: sentences.slice(0, 8) });
      // the app writes statuses while it runs - translated as they appear
      const live = await p.evaluate(async () => {
        const hf = document.getElementById("s_hfstatus"), k = document.getElementById("s_kstatus");
        hf.textContent = "valid — signed in as timpaul"; k.textContent = "· not installed in ComfyUI's python\npython: python3 (configured python) · torch NOT importable here";
        await new Promise((r) => setTimeout(r, 60));
        return { hf: hf.textContent, k: k.textContent };
      });
      check(`${lang}: statuses written later are translated as they appear (a token check with the user's name kept; a two-line package status, line by line)`,
        CJK.test(live.hf) && /timpaul/.test(live.hf) && live.k.split("\n").length === 2 && live.k.split("\n").every((l) => CJK.test(l)) && /python3/.test(live.k), live);
    }
    const dr = await p.evaluate(async () => { document.querySelector('[data-stab="dockers"]').click(); await new Promise((r) => setTimeout(r, 500));
      const td = [...document.querySelectorAll("#drList td")].map((x) => x.textContent).find((x) => /px/.test(x)); return td || ""; });
    check("the dockers tab's sizes (\"floating · 492 px high\" - built from pieces) in the language", CJK.test(dr) && /\d+/.test(dr), dr);
    await p.evaluate(() => { document.getElementById("settings").close(); });
    await p.selectOption("#uiLangSel", "en");
    await p.waitForFunction(() => document.documentElement.getAttribute("data-uilang") === "en");
    const back = await p.evaluate(() => ({ hf: document.getElementById("s_hfstatus").textContent, tab: document.querySelector('[data-stab="general"]').textContent }));
    check("back to English: the statuses and tabs as the app wrote them", back.hf === "valid — signed in as timpaul" && back.tab === "General", back);
    check("no page errors", errs.length === 0, errs);
    await p.evaluate(() => { try { localStorage.removeItem("bg.helpLang"); } catch (e) {} });
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
