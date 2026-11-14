#!/usr/bin/env node
/* bitGen Studio — 2.781.0 browser test: BASIC SETTINGS ▸ SAMPLER / SCHEDULER (static/samplerset.js) on a running studio (H3_URL,
 * default :8311): the rows sit above the checkpoint (pictures) and the video model, "Style's own" first then ComfyUI's list (the
 * answer of GET /api/samplers, stood in), and a picture / video render carries the pick (X-Bitgen-Sampler) only while Override
 * style is on. Tim (verbatim): "please add a list of samplers to the basic settings docker above the checkpoint dropdowns."
 * No server / no Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.781.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.781.0 browser test did not run"); process.exit(0); }
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    const heads = [];
    await p.route("**/api/samplers*", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ samplers: ["euler", "dpmpp_2m", "my_pack_sampler"], schedulers: ["simple", "karras"], from: "comfyui" }) }));
    await p.route(/\/api\/genimage$/, (r) => { heads.push(r.request().headers()["x-bitgen-sampler"] || ""); return r.fulfill({ status: 400, contentType: "application/json", body: '{"error":"test stop"}' }); });
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3Samplers && document.getElementById("imgSampler") && document.getElementById("vidSampler") && document.getElementById("imgSampler").options.length === 4, null, { timeout: 60000 });
    const a = await ev(() => {
      const after = (id, target) => { const row = document.getElementById(id).closest(".samplerRow"); let n = row.nextElementSibling, i = 0; while (n && i < 4) { if (n.contains(document.getElementById(target)) || n.id === target || n.getAttribute("for") === target) return i; n = n.nextElementSibling; i++; } return -1; };
      return { img: [...document.getElementById("imgSampler").options].map((o) => o.value || o.textContent), sch: [...document.getElementById("imgScheduler").options].map((o) => o.value || o.textContent),
        labels: [...document.querySelectorAll(".samplerRow")].map((r) => r.dataset.kind + ":" + [...r.querySelectorAll("label")].map((l) => l.firstChild.textContent.trim()).join("/")),
        imgAbove: after("imgSampler", "useImgModel"), vidAbove: after("vidSampler", "useVidModel") };
    });
    check("two rows - pictures and video - each Sampler / Scheduler", a.labels.slice().sort().join() === "image:Sampler/Scheduler,video:Sampler/Scheduler", a.labels);
    check("…above the checkpoint and the video model (right above their Use model tick)", a.imgAbove === 0 && a.vidAbove === 0, a);
    check("…Style's own first, then ComfyUI's own list (a pack's sampler too)", a.img.join() === "— Style's own —,euler,dpmpp_2m,my_pack_sampler" && a.sch.join() === "— Style's own —,simple,karras", a);
    await ev(() => { const s = document.getElementById("imgSampler"); s.value = "dpmpp_2m"; s.dispatchEvent(new Event("change")); const c = document.getElementById("imgScheduler"); c.value = "karras"; c.dispatchEvent(new Event("change")); });
    const send = () => ev(() => fetch("/api/genimage", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then(() => 0));
    await ev(() => { const o = document.getElementById("ovrStyle"); if (o.checked) { o.checked = false; o.dispatchEvent(new Event("change", { bubbles: true })); } });
    await send();
    await ev(() => { const o = document.getElementById("ovrStyle"); o.checked = true; o.dispatchEvent(new Event("change", { bubbles: true })); });
    await send();
    check("a picture render: no pick while Override style is off; with it on, X-Bitgen-Sampler = dpmpp_2m / karras", heads[0] === "" && heads[1] === '{"sampler":"dpmpp_2m","scheduler":"karras"}', heads);
    await p.reload();
    await p.waitForFunction(() => window.H3Samplers && document.getElementById("imgSampler") && document.getElementById("imgSampler").options.length === 4, null, { timeout: 60000 }); await sleep(1500);
    const k = await ev(() => [document.getElementById("imgSampler").value, document.getElementById("imgScheduler").value, document.getElementById("vidSampler").value]);
    check("kept after a reload (the video one still the style's own)", k.join() === "dpmpp_2m,karras,", k);
    await ev(() => { ["imgSampler", "imgScheduler"].forEach((i) => { const s = document.getElementById(i); s.value = ""; s.dispatchEvent(new Event("change")); }); const o = document.getElementById("ovrStyle"); o.checked = false; o.dispatchEvent(new Event("change", { bubbles: true })); });
    check("no page errors", errs.length === 0, errs);
  } finally { await b.close(); }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
