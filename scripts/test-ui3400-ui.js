#!/usr/bin/env node
/* bitGen Studio — 3.4.0 in a REAL browser: Basic Settings ▸ Text encoder (PlatoKeys). Against the running app (H3_URL).
 * Tim: "add a text encoder dropdown in basic settings to overide the models own ... top option will be styles own" */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TE = "qwen3.5_2b_bf16.safetensors";
(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0); process.exit(0); }
  const real = await (await fetch(URL0 + "api/platokeys")).json();
  check("GET /api/platokeys answers (no ComfyUI here: an empty list + a note)", Array.isArray(real.encoders) && typeof real.note === "string", real);
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    const heads = [];
    await p.route("**/api/platokeys*", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ encoders: [{ file: TE, families: ["h3", "moss"], labels: ["MiniMax H3", "MOSS-Image"] }], online: true, nodes: true, note: "" }) }));
    await p.route(/\/api\/(genimage|generate)$/, (r) => { heads.push(r.request().url().replace(/^.*\/api\//, "") + "|" + (r.request().headers()["x-bitgen-sampler"] || "")); return r.fulfill({ status: 400, contentType: "application/json", body: '{"error":"test stop"}' }); });
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3Samplers && document.getElementById("imgTextEnc") && document.getElementById("vidTextEnc") && document.getElementById("imgTextEnc").options.length === 2 && window.H3BasicCfg && window.H3BasicCfg.state().started && window.H3StyleBasic && window.H3StyleBasic.ready(), null, { timeout: 90000 });
    await sleep(800);
    await ev(() => { ["imgSampler", "imgScheduler", "imgTextEnc", "vidTextEnc"].forEach((i) => { const s = document.getElementById(i); s.value = ""; s.dispatchEvent(new Event("change", { bubbles: true })); }); });
    const a = await ev(() => ({ img: [...document.getElementById("imgTextEnc").options].map((o) => o.value + "=" + o.textContent), vid: document.getElementById("vidTextEnc").options.length,
      row: document.getElementById("imgTextEnc").closest(".samplerRow") === document.getElementById("imgSampler").closest(".samplerRow"),
      label: document.getElementById("imgTextEnc").closest("label").firstChild.textContent.trim(), title: document.getElementById("imgTextEnc").title }));
    check("pictures and video: Text encoder under Sampler / Scheduler - Style's own first, then the encoder with the styles it maps onto",
      a.row && a.label === "Text encoder" && a.vid === 2 && a.img.join("|") === "=— Style's own —|" + TE + "=" + TE + "  →  MiniMax H3, MOSS-Image" && /PlatoKeys/.test(a.title), a);
    const send = (u) => ev((x) => fetch(x, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then(() => 0), u);
    await ev(() => { const o = document.getElementById("ovrStyle"); if (o.checked) { o.checked = false; o.dispatchEvent(new Event("change", { bubbles: true })); } });
    await send("/api/genimage");
    await ev((t) => { const s = document.getElementById("imgTextEnc"); s.value = t; s.dispatchEvent(new Event("change", { bubbles: true })); }, TE);
    await send("/api/genimage"); await send("/api/generate");
    await ev(() => { const s = document.getElementById("imgSampler"); s.value = "euler"; s.dispatchEvent(new Event("change")); const o = document.getElementById("ovrStyle"); o.checked = true; o.dispatchEvent(new Event("change", { bubbles: true })); });
    await send("/api/genimage");
    await sleep(6500);                                           // basic.cfg (600 ms) and the style's own copy (a look every 5 s - static/stylebasic.js) keep it
    check("Style's own sends nothing; a picked encoder goes with a picture render even with Override style off; not with video (its own list); with Override on, beside the sampler",
      heads[0] === "genimage|" && heads[1] === "genimage|" + JSON.stringify({ sampler: "", scheduler: "", text_encoder: TE }) && heads[2] === "generate|"
      && heads[3] === "genimage|" + JSON.stringify({ sampler: "euler", scheduler: "", text_encoder: TE }), heads);
    await p.reload();
    await p.waitForFunction(() => window.H3Samplers && document.getElementById("imgTextEnc") && document.getElementById("imgTextEnc").options.length === 2 && window.H3BasicCfg && window.H3BasicCfg.state().started && window.H3StyleBasic && window.H3StyleBasic.ready(), null, { timeout: 90000 }); await sleep(1500);
    const k = await ev(() => [document.getElementById("imgTextEnc").value, document.getElementById("vidTextEnc").value]);
    check("kept after a reload (video still Style's own)", k[0] === TE && k[1] === "", k);
    await ev(() => { ["imgTextEnc", "imgSampler"].forEach((i) => { const s = document.getElementById(i); s.value = ""; s.dispatchEvent(new Event("change", { bubbles: true })); }); const o = document.getElementById("ovrStyle"); o.checked = false; o.dispatchEvent(new Event("change", { bubbles: true })); });
    await sleep(6500);                                           // the next test starts from Style's own
    check("no page errors", errs.length === 0, errs);
  } finally { await b.close(); }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
