#!/usr/bin/env node
/* bitGen Studio — 2.375.1: Basic Settings' Steps survives a page load and reaches Generate, in a REAL browser.
 * Tim: "i set it to 15 steps but it is still rendering 20 steps" - the job log said "steps=20 (auto: template base
 * arm, LoRA off)": the page had sent 0. Every config load put Steps back to the default (0 = auto), racing the
 * project's restore at boot - and New / Open reload the page since 2.371.
 * Run against the running app (H3_URL, default the e2e server on :8311). No Playwright here = SKIP (exit 0).
 *   1. Steps 15 -> reload -> still 15 (and its label);
 *   2. Generate posts steps=15 and the console says what Basic Settings sent;
 *   3. a config load (Settings' reset path) leaves it at 15.
 *   node scripts/test-basicsteps-ui.js */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the Basic Settings steps browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 400))); }
};
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  try {
    const settle = async () => {
      await p.waitForFunction(() => typeof window.submitJob === "function" && document.getElementById("steps"), null, { timeout: 20000 });
      await p.waitForTimeout(2500);                       // the config + the project's restore both land
    };
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await settle();
    await p.evaluate(() => { const s = document.getElementById("steps"); s.value = "15"; s.dispatchEvent(new Event("input", { bubbles: true })); });
    // THE BUG: a config answer that lands AFTER the project's restore put Steps back to the default - a slow
    // /api/config reproduces it every time (2.375.0 came back with the default, not 15)
    await p.route("**/api/config", async (r) => { await new Promise((ok) => setTimeout(ok, 1500)); r.continue(); });
    const early = await Promise.all([
      p.waitForResponse((r) => /\/api\/config$/.test(r.url()), { timeout: 60000 }),
      p.reload({ waitUntil: "domcontentloaded" }).then(() =>
        p.waitForFunction(() => document.getElementById("steps"), null, { timeout: 20000 })
          .then(() => p.evaluate(() => document.getElementById("steps").value))),
    ]).then((x) => x[1]);
    check("...before the config answers it already shows the remembered 15 (not the slider's midpoint 25)", early === "15", early);
    await settle();
    await p.waitForTimeout(1000);
    await p.unroute("**/api/config");
    const after = await p.evaluate(() => [document.getElementById("steps").value, (document.getElementById("stepsv") || {}).textContent]);
    check("Steps 15 survives a page reload even when the config answers last (it used to reset to the default)", after[0] === "15" && after[1] === "15", after);

    let posted = null;
    await p.route("**/api/comfy/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ backend: "sdcli" }) }));
    await p.route("**/api/generate", (r) => { posted = r.request().postData() || ""; r.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "intercepted by the test" }) }); });
    await p.evaluate(() => { window.alert = () => {}; return window.submitJob("a test prompt"); });
    await p.waitForTimeout(500);
    check("Generate posts steps=15", !!posted && /name="steps"\r\n\r\n15\r\n/.test(posted), posted && posted.slice(0, 300));
    const said = await p.evaluate(() => (document.getElementById("log") || {}).textContent || "");
    check("...and the console says what Basic Settings sent", /\[generate\] Basic Settings: steps 15, cfg/.test(said), said.slice(-300));

    await p.evaluate(() => window.loadConfig && window.loadConfig());
    await p.waitForTimeout(800);
    check("a later config load leaves Steps at 15", await p.evaluate(() => document.getElementById("steps").value) === "15");
    await p.evaluate(() => { const s = document.getElementById("steps"); s.value = "0"; s.dispatchEvent(new Event("input", { bubbles: true })); });
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.message || e));
  } finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
