#!/usr/bin/env node
/* bitGen Studio — 2.766.1 browser test: Model manager ▸ Civitai's filters (static/modelmgr.js) on a running studio (H3_URL,
 * default :8311). Civitai itself is answered in the page (route) - nothing leaves the computer.
 * Tim (verbatim): "add civitai filters to model manager, checkpoint, lora,all, model family - krea2,flux etc. sort by"
 * No server / no Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.766.1 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.766.1 browser test did not run"); process.exit(0); }
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1400, height: 950 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const asked = [];
    await p.route("**/api/civitai/enums", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ base_models: ["Krea 2", "Flux.1 Krea", "Flux.1 D", "Qwen"], families: [{ name: "Krea", base_models: ["Krea 2", "Flux.1 Krea"] }, { name: "Flux", base_models: ["Flux.1 D"] }, { name: "Qwen", base_models: ["Qwen"] }], types: [], sorts: [], periods: [] }) }));
    await p.route("**/api/civitai/search?**", (r) => { asked.push(r.request().url()); r.fulfill({ contentType: "application/json", body: JSON.stringify({ items: [{ model_id: 1, title: "A Krea LoRA", type: "LORA", versions: [], thumb: "" }], next: "" }) }); });
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3ModelMgr && window.SecFloat, null, { timeout: 30000 });
    await p.evaluate(() => { try { localStorage.removeItem("h3mm.sel.v1"); } catch (e) { /* fine */ } H3ModelMgr.show(true); });
    await sleep(800);
    await p.click('[data-mmtab="civitai"]'); await sleep(800);
    const f1 = await p.evaluate(() => ({ chips: [...document.querySelectorAll(".mmgr [data-cvgrp]")].map((b) => b.textContent + (b.classList.contains("on") ? "*" : "")), fam: [...document.querySelectorAll("#mmCvFam optgroup")].map((g) => g.label + ":" + g.children.length),
      sortLabel: (document.querySelector('.mmgr label[for="mmCvSort"]') || {}).textContent || "", period: [...document.querySelectorAll("#mmCvPeriod option")].map((o) => o.value) }));
    check("Civitai tab: All / Checkpoints / LoRAs (All on), the model family grouped (Krea: All Krea + Krea 2 + Flux.1 Krea), Sort by, the period", f1.chips.join() === "All*,Checkpoints,LoRAs" && f1.fam.join() === "Krea:3,Flux:1,Qwen:1" && f1.sortLabel === "Sort by" && f1.period.join() === "AllTime,Year,Month,Week,Day", f1);
    await p.click('.mmgr [data-cvgrp="LoRA"]'); await sleep(600);
    check("LoRAs: it searches at once with group=LoRA, the chip on", /group=LoRA/.test(asked[asked.length - 1] || "") && await p.evaluate(() => document.querySelector('.mmgr [data-cvgrp="LoRA"]').classList.contains("on")), asked);
    await p.selectOption("#mmCvFam", "fam:Krea"); await sleep(500);
    await p.selectOption("#mmCvSort", "Newest"); await sleep(500);
    await p.selectOption("#mmCvPeriod", "Month"); await sleep(600);
    const last = new URL(asked[asked.length - 1]);
    check("the family (all Krea), sort by Newest, this month - each change searches again", last.searchParams.get("family") === "Krea" && last.searchParams.get("sort") === "Newest" && last.searchParams.get("period") === "Month" && last.searchParams.get("group") === "LoRA", last.search);
    await p.selectOption("#mmCvFam", "bm:Flux.1 D"); await sleep(600);
    check("…one base model", new URL(asked[asked.length - 1]).searchParams.get("baseModels") === "Flux.1 D");
    await p.selectOption("#mmCvType", "VAE"); await sleep(600);
    check("other types: VAE (no chip on)", /group=VAE/.test(asked[asked.length - 1]) && await p.evaluate(() => !document.querySelector(".mmgr [data-cvgrp].on")));
    check("the cards show", await p.evaluate(() => /A Krea LoRA/.test(document.getElementById("mmGrid").textContent)));
    await p.reload(); await p.waitForFunction(() => window.H3ModelMgr, null, { timeout: 30000 }); await p.evaluate(() => H3ModelMgr.show(true)); await sleep(800);
    await p.click('[data-mmtab="civitai"]'); await sleep(800);
    const kept = await p.evaluate(() => ({ fam: document.getElementById("mmCvFam").value, sort: document.getElementById("mmCvSort").value, period: document.getElementById("mmCvPeriod").value, type: document.getElementById("mmCvType").value }));
    check("kept after a reload", kept.fam === "bm:Flux.1 D" && kept.sort === "Newest" && kept.period === "Month" && kept.type === "VAE", kept);
    if (process.env.H3_SHOT) await p.screenshot({ path: process.env.H3_SHOT + "-cv.png" });
    await p.evaluate(() => { try { localStorage.removeItem("h3mm.sel.v1"); } catch (e) { /* fine */ } });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e)); }
  finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
