#!/usr/bin/env node
/* bitGen Studio — 2.707.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311): the dockers in
 * 简体中文 / 日本語 / 繁體中文 - the image editor (its tools, tool options, menus), the timeline, the Sketcher, the StoryBoard -
 * translated at once and as they are rebuilt; the editors still work (a tool picked, its options shown in the language);
 * a flood of updates stays fast; back to English restores. No server / no Playwright = SKIP.
 * Tim (verbatim): "ok, i guess we can do the dockers next" */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.707.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const CJK = /[぀-ヿ一-鿿]/;
// how much of a docker's words are in the language: text pieces with CJK vs English sentences left (names / paths are fine)
const COUNT = (id) => {
  const d = document.getElementById(id); if (!d) return null;
  const out = { cjk: 0, en: 0, ens: [] }; const w = document.createTreeWalker(d, 4, null); let n;
  while ((n = w.nextNode())) { const e = n.parentElement; if (!e || e.closest(H3UiLang.SKIP)) continue; const v = n.nodeValue.trim(); if (!v) continue;
    if (/[぀-ヿ一-鿿]/.test(v)) out.cjk++;
    else if ((v.match(/\b[a-z]{3,}\b/g) || []).length >= 3 && !/[\\/]|\.(js|json|png|bgi|psd)\b|https?:/.test(v)) { out.en++; if (out.ens.length < 6) out.ens.push(v.slice(0, 70)); } }
  for (const e of d.querySelectorAll("[title]")) { if (e.closest(H3UiLang.SKIP_ATTR)) continue; const v = e.getAttribute("title"); if (/[぀-ヿ一-鿿]/.test(v)) out.cjk++; else if ((v.match(/\b[a-z]{3,}\b/g) || []).length >= 3) { out.en++; if (out.ens.length < 6) out.ens.push("title: " + v.slice(0, 60)); } }
  return out;
};
(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.707.0 browser test did not run"); process.exit(0); }
  const b = await chromium.launch();
  try {
    const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 }, locale: "en-US" })).newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(URL0); await p.waitForFunction(() => window.H3UiLang && document.getElementById("uiLangSel") && document.querySelector("#imageeditdock .ietool"), null, { timeout: 30000 });
    await p.evaluate(() => { const t = document.getElementById("tX_pushpulldock"); if (t) t.click(); }); await p.waitForTimeout(1500);
    const en = await p.evaluate(() => ({ head: document.querySelector("#imageeditdock > .bhead").firstChild.nodeValue, tool: (document.querySelector("#imageeditdock .ietool[title]") || {}).title || "" }));
    for (const lang of ["zh-CN", "ja", "zh-TW"]) {
      const t0 = Date.now();
      await p.selectOption("#uiLangSel", lang);
      await p.waitForFunction((l) => document.documentElement.getAttribute("data-uilang") === l && H3UiLang.state().dict && H3UiLang.state().pats, lang, { timeout: 20000 });
      const ms = Date.now() - t0;
      const r = await p.evaluate((src) => { const f = new Function("id", "return (" + src + ")(id)"); return Object.fromEntries(["imageeditdock", "timelinedock", "pushpulldock", "videodock"].map((id) => [id, f(id)])); }, COUNT.toString());
      const ok = (x, min) => x && x.cjk >= min && x.en <= Math.max(3, x.cjk * 0.03);
      check(`${lang}: the dockers' words change at once (${ms} ms) - image editor ${r.imageeditdock.cjk} pieces, timeline ${r.timelinedock.cjk}, Sketcher ${r.pushpulldock.cjk}, StoryBoard ${r.videodock.cjk}; English sentences left ${["imageeditdock", "timelinedock", "pushpulldock", "videodock"].map((k) => r[k].en).join(" / ")}`,
        ok(r.imageeditdock, 300) && ok(r.timelinedock, 100) && ok(r.pushpulldock, 30) && ok(r.videodock, 100) && ms < 8000, Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.ens])));
      // the editors still work in the language: a tool picked -> its options panel (rebuilt by the code in English) shown translated
      const tool = await p.evaluate(async () => {
        const btns = [...document.querySelectorAll("#imageeditdock .ietool[data-tool]")]; const bt = btns[Math.min(3, btns.length - 1)]; bt.click();
        await new Promise((r) => setTimeout(r, 400));
        const name = (document.getElementById("pcToolName") || {}).textContent || "", opts = document.getElementById("kxOpts");
        return { tool: bt.dataset.tool, active: bt.classList.contains("on") || bt.classList.contains("active") || bt.getAttribute("aria-pressed") === "true", name, title: bt.title, opts: opts ? opts.textContent.trim().slice(0, 120) : "" };
      });
      check(`${lang}: the image editor still works - a tool picked (${tool.tool}), its tooltip and options in the language`, CJK.test(tool.title) && (!tool.opts || CJK.test(tool.opts)), tool);
      check(`${lang}: the docker title "Image editor" and the Sketcher's tools in the language`, await p.evaluate(() => /[぀-ヿ一-鿿]/.test(document.querySelector("#imageeditdock > .bhead").textContent) && [...document.querySelectorAll("#pushpulldock button[title]")].filter((b) => /[぀-ヿ一-鿿]/.test(b.title)).length >= 10));
    }
    // a flood of updates (a playing timeline's readouts, a status written 2,000 times) stays fast
    const flood = await p.evaluate(async () => { const s = document.createElement("span"); document.getElementById("timelinedock").appendChild(s); const t0 = performance.now();
      for (let i = 0; i < 2000; i++) { s.textContent = (i % 2 ? "Selection ends after this frame " : "00:00:" + (i % 60) + ".12 · frame ") + i; await null; }
      await new Promise((r) => setTimeout(r, 50)); const dt = performance.now() - t0; const last = s.textContent; s.remove(); return { dt, last }; });
    check(`a flood of 2,000 updates written into a docker stays fast (${Math.round(flood.dt)} ms - under 3 s)`, flood.dt < 3000, flood);
    await p.selectOption("#uiLangSel", "en");
    await p.waitForFunction(() => document.documentElement.getAttribute("data-uilang") === "en");
    const back = await p.evaluate(() => ({ head: document.querySelector("#imageeditdock > .bhead").firstChild.nodeValue, tool: (document.querySelector("#imageeditdock .ietool[title]") || {}).title || "",
      cjk: (() => { let c = 0; for (const id of ["imageeditdock", "timelinedock", "pushpulldock"]) { const w = document.createTreeWalker(document.getElementById(id), 4, null); let n; while ((n = w.nextNode())) if (/[぀-ヿ一-鿿]/.test(n.nodeValue)) c++; } return c; })() }));
    check("back to English: the dockers' words as the app wrote them", back.head === en.head && back.tool === en.tool && back.cjk === 0, { back, en });
    check("no page errors", errs.length === 0, errs);
    await p.evaluate(() => { try { localStorage.removeItem("bg.helpLang"); } catch (e) {} });
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
