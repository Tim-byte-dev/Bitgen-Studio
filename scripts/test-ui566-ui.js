#!/usr/bin/env node
/* bitGen Studio — 2.566.0 in a REAL browser: Settings ▸ Add-ons ▸ MOSS-Image - its files to tick with their sizes (the SFT
 * model, the text encoder and the VAE ticked; the text encoder and the VAE needed - always), ⤓ Download ticked posts the
 * picks; the MOSS-Image styles are in the image style list (lib/mossAddon.js, static/addons.js, lib/styles.js).
 * Tim: "can you add this model type to bitgen please...https://huggingface.co/Comfy-Org/MOSS-Image, add an option in
 * add-ons to download and install it". Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.566.0 browser test did not run"); process.exit(0); }
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
    const names = (sty.styles || []).map((s) => s.name);
    const m = (sty.styles || []).find((s) => s.name === "MOSS-Image") || {};
    check("the image styles MOSS-Image and MOSS-Image Base are there (arch moss, ComfyUI)", names.includes("MOSS-Image") && names.includes("MOSS-Image Base") && m.arch === "moss" && m.engine === "comfy", names.filter((n) => /moss/i.test(n)));
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Addons, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    let posted = null;
    await p.route("**/api/addons/moss/install", async (r) => { posted = r.request().postDataJSON(); r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, job: { id: "moss", action: "install", state: "running" } }) }); });
    p.on("dialog", (d) => d.accept());
    await ev(() => window.H3Addons.open());
    await p.waitForSelector('#stab-addons [data-addon="moss"]', { timeout: 45000 });
    const card = await ev(() => { const c = document.querySelector('#stab-addons [data-addon="moss"]'); const boxes = [...c.querySelectorAll("[data-aoi]")];
      return { title: c.querySelector("h4").textContent, n: boxes.length, on: boxes.filter((x) => x.checked).map((x) => x.value), locked: boxes.filter((x) => x.disabled).map((x) => x.value),
               text: c.textContent, btn: [...c.querySelectorAll("button")].map((x) => x.textContent), visible: !!c.offsetParent }; });
    check("Settings ▸ Add-ons shows \"MOSS-Image\" with its seven files to tick (SFT / Base int8 + bf16, two text encoders, the VAE), each with its size; SFT ticked; the text encoder and the VAE ticked and needed",
      /MOSS-Image/.test(card.title) && card.visible && card.n === 7 && card.on.join() === "sft,te,vae" && card.locked.join() === "te,vae" && /5\.4 GB/.test(card.text) && /\(needed\)/.test(card.text) && /16 Oct 2026/.test(card.text) && card.btn.some((t) => /Download ticked/.test(t)), card);
    await ev(() => { const c = document.querySelector('#stab-addons [data-addon="moss"]'); const by = (v) => c.querySelector(`[data-aoi][value="${v}"]`); by("base").checked = true; by("base").dispatchEvent(new Event("change")); });
    await p.click('#stab-addons [data-addon="moss"] [data-act="install"]');
    await p.waitForTimeout(600);
    check("⤓ Download ticked posts the picks (SFT + Base + the needed text encoder and VAE)", posted && JSON.stringify(posted.items) === '["sft","base","te","vae"]', posted);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
