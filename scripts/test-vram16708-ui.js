#!/usr/bin/env node
/* bitGen Studio — 2.708.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311): Settings ▸
 * ComfyUI ▸ 16 GB mode - Auto by default, the upscale and the 8-step pass 1, its status (card, files, node packs), the
 * latent upscaler nodes' install button, ⤓ to Settings ▸ Add-ons ▸ 16 GB mode; Save keeps engine.comfy.vram16 and a
 * reopened Settings shows it. No server / no Playwright = SKIP.  Tim (verbatim): "this workflow is meant to work with
 * 16gb vram - minimax" */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.708.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.708.0 browser test did not run"); process.exit(0); }
  const cfg0 = await (await fetch(URL0 + "api/config")).json().catch(() => null);
  const b = await chromium.launch();
  try {
    const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(URL0); await p.waitForFunction(() => window.H3Vram16 && document.getElementById("openSettings"), null, { timeout: 30000 });
    await p.evaluate(() => document.getElementById("openSettings").click()); await p.waitForTimeout(600);
    await p.evaluate(() => document.querySelector('[data-stab="comfy"]').click());
    await p.waitForFunction(() => /Files:/.test(document.getElementById("s_c16status").textContent), null, { timeout: 15000 });
    const a = await p.evaluate(() => ({ mode: document.getElementById("s_c16mode").value, opts: [...document.getElementById("s_c16mode").options].map((o) => o.value),
      scale: document.getElementById("s_c16scale").value, turbo: document.getElementById("s_c16turbo").checked, st: document.getElementById("s_c16status").textContent,
      btn: !!document.getElementById("s_vapack_h3latentup"), vis: !!document.getElementById("s_c16mode").getClientRects().length }));
    const was = ((cfg0 && cfg0.engine && cfg0.engine.comfy) || {}).vram16;
    check("Settings ▸ ComfyUI shows 16 GB mode: Auto / On / Off (Auto unless saved otherwise), upscale ×1.5, pass 1 in 8 steps",
      a.vis && a.opts.join() === "auto,on,off" && (was ? a.mode === was.mode : a.mode === "auto") && (was ? true : a.scale === "1.5" && a.turbo), { a, was });
    check("…its status: the card (when ComfyUI answers), the four files and the node packs (DENO, the latent upscaler nodes, KJNodes optional) + the install button",
      (!/Card:/.test(a.st) || /Card: .*GB/.test(a.st)) && /Ref2VA Acc 8-step LoRA/.test(a.st) && /DMD Ref2VA/.test(a.st) && /2K refiner/.test(a.st) && /H3 latent upscaler \(3D\)/.test(a.st)
      && /DENO custom nodes/.test(a.st) && /H3 latent upscaler nodes/.test(a.st) && /KJNodes \(optional\)/.test(a.st) && a.btn, a.st);
    const off = await p.evaluate(async () => { const m = document.getElementById("s_c16mode"); m.value = "off"; m.dispatchEvent(new Event("change")); await new Promise((r) => setTimeout(r, 50));
      const o = { scale: document.getElementById("s_c16scale").disabled, turbo: document.getElementById("s_c16turbo").disabled };
      m.value = "on"; m.dispatchEvent(new Event("change")); return o; });
    check("Off greys out the upscale and the 8-step pass", off.scale && off.turbo, off);
    // save: on, x1.8, pass 1 off -> the config holds it, a reopened Settings shows it
    await p.evaluate(() => { document.getElementById("s_c16scale").value = "1.8"; document.getElementById("s_c16turbo").checked = false; });
    await p.evaluate(() => { document.getElementById("s_save").click(); });
    await p.waitForTimeout(1200);
    const cfg1 = await (await fetch(URL0 + "api/config")).json();
    check("Save keeps engine.comfy.vram16 {mode on, scale 1.8, turbo false}", JSON.stringify(((cfg1.engine || {}).comfy || {}).vram16) === '{"mode":"on","scale":1.8,"turbo":false}', ((cfg1.engine || {}).comfy || {}).vram16);
    await p.reload(); await p.waitForFunction(() => window.H3Vram16 && document.getElementById("openSettings"));
    await p.evaluate(() => document.getElementById("openSettings").click()); await p.waitForTimeout(800);
    const back = await p.evaluate(() => ({ mode: document.getElementById("s_c16mode").value, scale: document.getElementById("s_c16scale").value, turbo: document.getElementById("s_c16turbo").checked }));
    check("…a reopened Settings shows what was saved", back.mode === "on" && back.scale === "1.8" && back.turbo === false, back);
    await p.evaluate(() => document.querySelector('[data-stab="comfy"]').click()); await p.waitForTimeout(300);
    await p.evaluate(() => document.getElementById("s_c16files").click());
    await p.waitForFunction(() => document.querySelector('[data-addon="vram16"]'), null, { timeout: 15000 }).catch(() => {});
    const ad = await p.evaluate(() => { const r = document.querySelector('[data-addon="vram16"]'); return r ? { text: r.textContent.slice(0, 300), vis: !!r.getClientRects().length } : null; });
    check("⤓ The 16 GB mode files… opens Settings ▸ Add-ons at 16 GB mode (its files, what it needs)", !!ad && ad.vis && /16 GB mode/.test(ad.text), ad);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  // put the setting back as it was
  try { const c = await (await fetch(URL0 + "api/config")).json(); if (c && c.engine && c.engine.comfy) { const was = ((cfg0 && cfg0.engine && cfg0.engine.comfy) || {}).vram16; if (was) c.engine.comfy.vram16 = was; else delete c.engine.comfy.vram16;
    await fetch(URL0 + "api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) }); } } catch (e) { /* best effort */ }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
