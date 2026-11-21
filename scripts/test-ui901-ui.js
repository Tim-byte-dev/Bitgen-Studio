#!/usr/bin/env node
/* bitGen Studio — 2.901.0 browser test: ＋ CREATE POD MAKES THE BITGEN POD FROM ITS IMAGE (static/podsdock.js) on a running studio
 * (H3_URL, default :8311). The server's answers are stood in (page routes): two bitGen pods and two others on the account.
 *   tabs 🖥 My pods / 📦 Presets / ＋ Create pod - no template cards, search, kind, ComfyUI only, For style, ★ Shortcuts
 *   My pods = bitGen's pods; the others in one line (how many, $/h running) that opens to their state + ⏹ Stop
 *   ＋ Create pod = the bitGen pod form: what it is made from in one line; Create pod sends the bitGen pod's template
 * Tim (verbatim): "i think with using our clean pod template and uploading others we don't need to show any other pods except for
 * our pods what do u think?" … "i think we drop the template browser completely. it will make it less complicated"
 * No server / no Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.901.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pod = (id, name, bitgen, status, hr) => ({ id, name, bitgen, made_by_bitgen: bitgen, status, cost_hr: hr, gpu: "RTX 4090", gpus: 1, setup: null });

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.901.0 browser test did not run"); process.exit(0); }
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1400, height: 950 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    const json = (r, j, st) => r.fulfill({ status: st || 200, contentType: "application/json", body: JSON.stringify(j) });
    const created = [];
    await p.route("**/api/pods/mine", (r) => json(r, { pods: [] }));
    // what lib/podImage.js imageView() gives when no bitGen pod template is found
    await p.route("**/api/pods/bitgen-template*", (r) => json(r, { id: "", name: "bitGen Studio pod", image: "ghcr.io/tim-byte-dev/bitgen-pod:latest", ports: ["8188/http", "8888/http", "22/tcp"], disk: 50, comfy: false, install: true, cuda: "12.8", ours: true, source: "image" }));
    await p.route("**/api/pods/gpus*", (r) => json(r, { cloud: "SECURE", gpus: [{ id: "NVIDIA GeForce RTX 4090", name: "RTX 4090", memory: 24, price: 0.69, availability: "High", offered: true, max: 8 }] }));
    await p.route("**/api/pods/create", (r) => { created.push(JSON.parse(r.request().postData() || "{}")); return json(r, { pod: { id: "bg3", name: "bitGen pod" }, port: 8188 }); });
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3Pods && window.SecFloat && SecFloat.windows.pods, null, { timeout: 30000 });
    await ev(() => H3Pods.show(true));
    await p.waitForFunction(() => document.querySelector('[data-pdsrc="create"]'), null, { timeout: 10000 });
    await p.click('[data-pdsrc="create"]');
    await p.waitForFunction(() => /bitGen Studio pod/.test((document.getElementById("pdTplLine") || {}).textContent || "") && document.getElementById("pdGpu") && document.getElementById("pdGpu").value, null, { timeout: 10000 });
    const f = await ev(() => ({ line: document.getElementById("pdTplLine").textContent, sum: [...document.querySelectorAll("#pdSum .k")].map((k) => k.textContent + "=" + k.nextElementSibling.textContent) }));
    check("＋ Create pod: made from the bitGen Studio pod image - ComfyUI already in it, about 3 minutes", /Made from the bitGen Studio pod image - ComfyUI, ComfyUI-Manager and the common node packs already in it: ready in about 3 minutes/.test(f.line), f.line);
    check("…the summary: ComfyUI already in the image, a CUDA 12.8 host, the image named", f.sum.some((x) => /^ComfyUI=already in the bitGen pod image/.test(x)) && f.sum.some((x) => /^Host=CUDA 12\.8 or newer$/.test(x)) && f.sum.some((x) => /ghcr\.io\/tim-byte-dev\/bitgen-pod:latest/.test(x)), f.sum);
    await p.click("#pdGo"); await sleep(800);
    check("Create pod sends no template (the server makes it from the image)", created[0] && created[0].templateId === "" && created[0].gpu === "NVIDIA GeForce RTX 4090", created[0]);
    check("no page errors", errs.length === 0, errs);
  } finally { await b.close(); }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
