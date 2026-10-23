#!/usr/bin/env node
/* bitGen Studio — 2.582.0 in a REAL browser: Fibo 2.0 in the edit tools. The two Fibo 2.0 image styles are there; the
 * image editor's ✨ AI Edit offers them (GET /api/aiedit/engines); Settings ▸ Add-ons ▸ Fibo 2.0 shows its nine files with
 * sizes (Edit Turbo w4a8, the encoder and the VAE ticked; the encoder and the VAE needed) and ⤓ Download ticked posts the
 * picks (a GGUF added). Tim: "please add fibo to the model edit tools https://huggingface.co/realrebelai/Fibo-2.0_GGUFs/tree/
 * main. this model should work with very low vram". Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.582.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    const sty = await (await fetch(URL_ + "api/styles")).json();
    const fs2 = (sty.styles || []).filter((s) => /^Fibo 2\.0/.test(s.name));
    check("the image styles Fibo 2.0 Edit Turbo + Fibo 2.0 Dev are there (arch fibo2, ComfyUI)", fs2.length === 2 && fs2.every((s) => s.arch === "fibo2" && s.engine === "comfy"), fs2.map((s) => s.name));
    const eng = await (await fetch(URL_ + "api/aiedit/engines")).json();
    const ed = (eng.edit || []).map((x) => x.name);
    check("the image editor's ✨ AI ▸ Edit offers both Fibo 2.0 styles (TextEncodeFibo2 is an edit graph); Qwen Image Edit stays the default",
      ed.includes("Fibo 2.0 Edit Turbo") && ed.includes("Fibo 2.0 Dev") && (eng.edit.find((x) => x.id === eng.defaults.edit) || {}).name !== "Fibo 2.0 Dev", ed);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Addons, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    let posted = null;
    await p.route("**/api/addons/fibo/install", async (r) => { posted = r.request().postDataJSON(); r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, job: { id: "fibo", action: "install", state: "running" } }) }); });
    p.on("dialog", (d) => d.accept());
    await ev(() => window.H3Addons.open());
    await p.waitForSelector('#stab-addons [data-addon="fibo"]', { timeout: 45000 });
    const card = await ev(() => { const c = document.querySelector('#stab-addons [data-addon="fibo"]'); const boxes = [...c.querySelectorAll("[data-aoi]")];
      return { title: c.querySelector("h4").textContent, n: boxes.length, on: boxes.filter((x) => x.checked).map((x) => x.value), locked: boxes.filter((x) => x.disabled).map((x) => x.value), text: c.textContent }; });
    check("Settings ▸ Add-ons ▸ \"Fibo 2.0 (image editing, low VRAM)\": nine files with sizes; Edit Turbo w4a8 + the encoder + the VAE ticked, the encoder + VAE needed; the licence and ComfyUI 21 Oct 2026 said",
      /Fibo 2\.0/.test(card.title) && /low VRAM/.test(card.title) && card.n === 9 && card.on.join() === "edit,te,vae" && card.locked.join() === "te,vae" && /6\.6 GB/.test(card.text) && /CC BY-NC 4\.0/.test(card.text) && /21 Oct 2026/.test(card.text), card);
    await ev(() => { const c = document.querySelector('#stab-addons [data-addon="fibo"]'); const x = c.querySelector('[data-aoi][value="edit_q4"]'); x.checked = true; x.dispatchEvent(new Event("change")); });
    await p.click('#stab-addons [data-addon="fibo"] [data-act="install"]');
    await p.waitForTimeout(600);
    check("⤓ Download ticked posts the picks (Edit Turbo + its GGUF Q4_0 + the needed encoder and VAE)", posted && JSON.stringify(posted.items) === '["edit","edit_q4","te","vae"]', posted);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
