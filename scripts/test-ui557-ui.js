#!/usr/bin/env node
/* bitGen Studio — 2.557.0 in a REAL browser: Settings ▸ Add-ons ▸ AI fill models - the card with its models to tick (sizes,
 * the useful ones ticked), ⤓ Download ticked sends the ticked ones (static/addons.js -> routes/addons.js).
 * Tim: "add download ai fill models to addons tab in settings dialog". Against the running app (H3_URL). */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.557.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });   // 2.556.0: results straight in, as when this test was written (no ⏳ Pending)
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Addons, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    let posted = null;
    await p.route("**/api/addons/aifill/install", async (r) => { posted = r.request().postDataJSON(); r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, job: { id: "aifill", action: "install", state: "running" } }) }); });
    p.on("dialog", (d) => d.accept());
    await ev(() => window.H3Addons.open());
    await p.waitForSelector('#stab-addons [data-addon="aifill"]', { timeout: 45000 });   // the first /api/addons after a start looks at every add-on (slow once)
    const card = await ev(() => { const c = document.querySelector('#stab-addons [data-addon="aifill"]'); const boxes = [...c.querySelectorAll("[data-aoi]")];
      return { title: c.querySelector("h4").textContent, n: boxes.length, on: boxes.filter((b) => b.checked).map((b) => b.value), sizes: [...c.querySelectorAll(".its .sz")].map((x) => x.textContent),
               btn: [...c.querySelectorAll("button")].map((b) => b.textContent), visible: !!c.offsetParent }; });
    check("Settings ▸ Add-ons shows \"AI fill models (the Krita AI way)\" with its six models to tick, each with its size; Fooocus, MAT and NoobAI ticked; ⤓ Download ticked",
      /AI fill models/.test(card.title) && card.visible && card.n === 6 && card.on.join() === "fooocus,mat,noobai" && card.sizes.every((x) => /B$/.test(x)) && card.btn.some((t) => /Download ticked/.test(t)), card);
    await ev(() => { const c = document.querySelector('#stab-addons [data-addon="aifill"]'); const by = (v) => c.querySelector(`[data-aoi][value="${v}"]`);
      by("noobai").checked = false; by("noobai").dispatchEvent(new Event("change")); by("flux").checked = true; by("flux").dispatchEvent(new Event("change")); });
    await p.click('#stab-addons [data-addon="aifill"] [data-act="install"]');
    await p.waitForTimeout(600);
    check("⤓ Download ticked posts the ticked models (NoobAI unticked, FLUX ticked)", posted && JSON.stringify(posted.items) === '["fooocus","mat","flux"]', posted);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
