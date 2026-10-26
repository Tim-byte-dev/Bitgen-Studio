#!/usr/bin/env node
/* bitGen Studio — 2.595.0 in a REAL browser, against the running app (H3_URL): Settings ▸ Add-ons ▸ WeVisOne-VL.
 *   The card is a dropdown (★ 4B Q4_K_M picked first, five in all), its buttons and size line speak of "the vision
 *   folder", its ⤓ links list the project page and both GGUF repos with the vision folder; Download asks first and
 *   starts the add-on job with the picked one (the job call stood in for - nothing downloads).
 * Tim: "can we add https://tencent.github.io/WeVisOne-VL/, add it to addons to dl, dl it to the llm vision folder set by
 * the user". No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.595.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const started = [];
  await p.route(/\/api\/addons\/wevisone\/install$/, async (r) => { started.push(JSON.parse(r.request().postData() || "{}")); await r.fulfill({ json: { ok: true, job: { id: "wevisone", action: "install", state: "running", lines: [] } } }); });
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Addons, null, { timeout: 60000 });
    await ev(() => { if (typeof openSettings === "function") openSettings(); else document.getElementById("settings").showModal(); });
    await ev(() => document.querySelector('#settings .stabs [data-stab="addons"]').click());
    await ev(() => window.H3Addons.refresh());
    const card = await ev(() => { const c = document.querySelector('#aoList .ao[data-addon="wevisone"]'); if (!c) return null;
      const s = c.querySelector("select[data-aosel]");
      return { opts: s ? [...s.options].map((o) => o.value) : [], val: s && s.value, text: c.textContent,
        titles: [...c.querySelectorAll("button[data-act]")].map((x) => x.title), links: [...c.querySelectorAll(".lnk a")].map((a) => a.href), to: [...c.querySelectorAll(".lnk .to")].map((x) => x.textContent) }; });
    check("the WeVisOne-VL card: a dropdown of five, ★ 4B Q4_K_M first, the vision folder named", card && card.opts.length === 5 && card.val === "wv4_q4km" && /vision models folder/.test(card.text) && /the vision folder: /.test(card.text), card);
    check("its button says the vision folder (not the LLM folder)", card && card.titles.some((t) => /into the vision folder/.test(t)) && !card.titles.some((t) => /LLM folder/.test(t)), card && card.titles);
    check("its ⤓ links: the project page + both GGUF repos -> <vision folder>/WeVisOne-VL-4B / -2B", card && card.links.includes("https://tencent.github.io/WeVisOne-VL/") && card.links.includes("https://huggingface.co/mradermacher/WeVisOne-VL-2B-GGUF")
      && card.to.some((t) => /WeVisOne-VL-4B/.test(t)), card);
    await ev(() => { const s = document.querySelector('#aoList .ao[data-addon="wevisone"] select[data-aosel]'); s.value = "wv2_q8"; s.dispatchEvent(new Event("change", { bubbles: true })); });
    p.once("dialog", (d) => d.accept());
    await ev(() => document.querySelector('#aoList .ao[data-addon="wevisone"] button[data-act="install"]').click());
    await p.waitForTimeout(1200);
    check("⤓ Download (confirmed) starts the add-on job with the picked one (2B Q8_0)", started.length === 1 && JSON.stringify(started[0].items) === '["wv2_q8"]', started);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { try { await b.close(); } catch { /* fine */ } }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
