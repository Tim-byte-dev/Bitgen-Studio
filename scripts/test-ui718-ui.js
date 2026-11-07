#!/usr/bin/env node
/* bitGen Studio — 2.718.0 in a REAL browser (H3_URL): 🧩 Models ▸ ⟳ also refreshes the app's own model lists. A model
 * copied into ComfyUI's folder showed "— not found" in the style made from it (Settings ▸ Image ▸ Model) until the app
 * was reloaded - found while making the website's tutorial pictures (Tim: "can we add a Tutorials to the website - show
 * how to add a new model to bitgen and a new workflow, use images and a video"). No Playwright / studio = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.718.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
(async () => {
  try { const r = await fetch(URL_); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL_ + " - the 2.718.0 browser test did not run"); process.exit(0); }
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 950 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3ModelMgr && window.SecFloat && SecFloat.started && document.getElementById("mmBtn") && typeof window.loadComfyModels === "function", null, { timeout: 60000 });
    await p.click("#mmBtn");
    await p.waitForSelector("#mmRescan", { timeout: 15000 });
    const before = await p.evaluate(() => { window.__lcm = []; const f = window.loadComfyModels; window.loadComfyModels = function (force) { window.__lcm.push(force); return f.apply(this, arguments); }; return window.__lcm.length; });
    let modelsCalls = 0; p.on("request", (r) => { if (/\/api\/comfymodels\?refresh=1/.test(r.url())) modelsCalls++; });
    await p.click("#mmRescan");
    await p.waitForTimeout(1500);
    const got = await p.evaluate(() => window.__lcm);
    check("⟳ in the Model manager also reloads the app's model lists (loadComfyModels(true) -> /api/comfymodels?refresh=1)", before === 0 && got.length === 1 && got[0] === true && modelsCalls >= 1, { got, modelsCalls });
    check("no page errors", errs.length === 0, errs);
  } finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: " + (e && e.stack || e)); process.exit(1); });
