#!/usr/bin/env node
/* bitGen Studio — 2.586.0 in a REAL browser: Settings ▸ Add-ons ▸ LLM - a dropdown of the chat / writing LLMs. The card
 * "LLM": the dropdown (★ Qwen3.8 27B first and picked), what the picked one is for + its size, ⤓ Download posts
 * {items: [the pick]}; a file already in the LLM folder shows ✓ and 🗑 Delete it removes just that one (a real job).
 * Tim: "what would be the best llm base to build our checkpoint, add it as a download in addons in a dropdown called llm".
 * Against the running app (H3_URL) - the LLM folder is Settings ▸ LLM's (a test file is made there and deleted).
 * No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.586.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const APP = process.env.H3_APP_DIR || path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const cfg = await (await fetch(URL_ + "api/config")).json();
  const dir0 = (cfg.llm || {}).dir || "llm-models";
  const dir = path.isAbsolute(dir0) ? dir0 : path.join(APP, dir0);
  const TEST = path.join(dir, "gemma-4-12B-it-qat-UD-Q4_K_XL.gguf");
  const made = !fs.existsSync(TEST);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Addons, null, { timeout: 60000 });
    await p.waitForTimeout(600);
    let posted = null;
    await p.route("**/api/addons/llm/install", async (r) => { posted = r.request().postDataJSON(); r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, job: { id: "llm", action: "install", state: "running" } }) }); });
    p.on("dialog", (d) => d.accept());
    await ev(() => window.H3Addons.open());
    await p.waitForSelector('#stab-addons [data-addon="llm"] select[data-aosel="llm"]', { timeout: 45000 });
    const card = await ev(() => { const c = document.querySelector('#stab-addons [data-addon="llm"]'); const s = c.querySelector("select");
      return { title: c.querySelector("h4").textContent, n: s.options.length, val: s.value, first: s.options[0].textContent, text: c.textContent, boxes: c.querySelectorAll("[data-aoi]").length }; });
    check("Settings ▸ Add-ons ▸ \"LLM\": a dropdown (no tick boxes) of 9 LLMs, ★ Qwen3.8 27B first and picked, what it is for + its size shown",
      /^LLM/.test(card.title) && card.n === 9 && card.val === "qwen38_q4xl" && /^★ Qwen3\.8 27B/.test(card.first) && card.boxes === 0 && /base for our checkpoint|the base we recommend|newest dense 27B/.test(card.text) && /17\.6 GB/.test(card.text), card);
    await p.selectOption('#stab-addons select[data-aosel="llm"]', "gemma4_31b");
    await p.waitForFunction(() => /Google's largest Gemma 4/.test(document.querySelector('#stab-addons [data-addon="llm"]').textContent), null, { timeout: 5000 });
    check("picking another shows what it is for", true);
    await p.click('#stab-addons [data-addon="llm"] [data-act="install"]');
    await p.waitForTimeout(500);
    check("⤓ Download posts the one picked ({items: [\"gemma4_31b\"]})", posted && JSON.stringify(posted.items) === '["gemma4_31b"]', posted);
    await p.unroute("**/api/addons/llm/install");
    await ev(() => { const s = window.H3Addons.state; s.job = null; });

    // a file already in the LLM folder: ✓ + 🗑 Delete it (a real remove job)
    fs.mkdirSync(dir, { recursive: true }); if (made) fs.writeFileSync(TEST, "GGUF test file");
    await ev(() => window.H3Addons.refresh());
    await p.selectOption('#stab-addons select[data-aosel="llm"]', "gemma4_12b");
    await p.waitForFunction(() => /✓ in the LLM folder/.test(document.querySelector('#stab-addons [data-addon="llm"]').textContent), null, { timeout: 8000 });
    const st = await ev(() => { const c = document.querySelector('#stab-addons [data-addon="llm"]'); return { opt: [...c.querySelectorAll("option")].find((o) => o.value === "gemma4_12b").textContent, badge: c.querySelector(".st").textContent, del: !!c.querySelector('[data-act="remove"]'), dl: (c.querySelector('[data-act="install"]') || {}).textContent }; });
    check("a file in the LLM folder: ✓ in the dropdown, the card installed, ⟳ Download again + 🗑 Delete it", /✓$/.test(st.opt) && /installed/.test(st.badge) && st.del && /Download again/.test(st.dl), st);
    if (made) {
      await p.click('#stab-addons [data-addon="llm"] [data-act="remove"]');
      for (let i = 0; i < 30 && fs.existsSync(TEST); i++) await sleep(300);
      check("🗑 Delete it removes that file only", !fs.existsSync(TEST));
    }
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    await b.close();
    try { if (made && fs.existsSync(TEST)) fs.unlinkSync(TEST); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
