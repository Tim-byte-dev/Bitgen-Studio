#!/usr/bin/env node
/* bitGen Studio — 2.729.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311): NITROFUSION2.
 * Tim (verbatim): "can u add this please https://chendaryen.github.io/NitroFusion2.github.io/"
 *   - Settings ▸ Add-ons shows the NitroFusion2 card: what it is for, its six files as tick boxes (bf16 + the de-distillation
 *     LoRA + the shared encoder / VAE ticked, the encoder + VAE fixed, the GGUFs not), Install;
 *   - the three styles are there for the Image docker (GET /api/styles): NitroFusion2, NitroFusion2 2-step, NitroFusion2 GGUF.
 * No server / no Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.729.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.729.0 browser test did not run"); process.exit(0); }
  const b = await chromium.launch();
  try {
    const p = await (await b.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => document.getElementById("settings") && document.getElementById("stab-addons"), null, { timeout: 30000 });
    await ev(() => { const d = document.getElementById("settings"); if (!d.open) { if (typeof openSettings === "function") openSettings(); else d.showModal(); } });
    await p.waitForTimeout(400);
    await ev(() => document.querySelector('#settings [data-stab="addons"]').click());
    await p.waitForFunction(() => document.querySelector('#aoList [data-aoi="nf2"]'), null, { timeout: 15000 }).catch(() => {});
    const c = await ev(() => {
      const boxes = [...document.querySelectorAll('#aoList [data-aoi="nf2"]')];
      const card = boxes.length ? boxes[0].closest(".ao") : null;
      return { n: boxes.length, ids: boxes.map((x) => x.value), on: boxes.filter((x) => x.checked).map((x) => x.value), fixed: boxes.filter((x) => x.disabled).map((x) => x.value),
        text: card ? card.textContent : "", install: !!(card && card.querySelector('[data-ao="nf2"][data-act="install"]')), shown: !!(card && card.offsetParent) };
    });
    check("Settings ▸ Add-ons: the NitroFusion2 card - what it is for, six files as tick boxes, Install", c.shown && c.n === 6 && c.ids.join() === "bf16,dedistill,q4,q8,te,vae"
      && /NitroFusion2 \(image model, 1-2 steps\)/.test(c.text) && /Z-Image-Turbo distilled to 1-2 steps/.test(c.text) && c.install, c);
    check("…bf16 + the de-distillation LoRA + the encoder + VAE ticked (encoder + VAE fixed), the GGUFs not", c.on.join() === "bf16,dedistill,te,vae" && c.fixed.join() === "te,vae", c);
    const st = await fetch(URL0 + "api/styles?kind=image").then((r) => r.json()).catch(() => ({}));
    const names = (st.styles || st || []).map ? (st.styles || st).map((s) => s.name) : [];
    check("the Image docker's styles: NitroFusion2, NitroFusion2 2-step, NitroFusion2 GGUF", ["NitroFusion2", "NitroFusion2 2-step", "NitroFusion2 GGUF"].every((n) => names.includes(n)), names.filter((n) => /Nitro|MOSS/.test(n)));
    check("no page errors", errs.length === 0, errs);
  } finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
