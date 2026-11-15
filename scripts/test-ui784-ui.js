#!/usr/bin/env node
/* bitGen Studio — 2.784.0 browser test: PODS ▸ Create pod's Sort GPUs (Fastest / Cheapest) above the GPU list.
 * Needs a running studio (H3_URL, default :8311 - H3_E2E=1) with H3_RUNPOD_REST_API=http://127.0.0.1:8399/v2 (a stand-in
 * RunPod catalogue answers there).
 */
"use strict";
const http = require("http");
let chromium; try { ({ chromium } = require("playwright")); } catch { chromium = null; }
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.784.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b) => fetch(URL0 + p.replace(/^\//, ""), b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined).then((r) => r.json());
const G = (id, name, mem, price, av) => ({ id, name, memory: mem, secure: true, community: true, price: { secure: price, community: price / 2 }, availability: av || "HIGH", maxCount: { secure: 8, community: 4 } });
const GPUS = [G("NVIDIA RTX A6000", "RTX A6000", 48, 0.49), G("NVIDIA GeForce RTX 5090", "RTX 5090", 32, 0.89), G("NVIDIA RTX A4000", "RTX A4000", 16, 0.17),
  G("NVIDIA L40S", "L40S", 48, 0.86), G("NVIDIA H100 80GB HBM3", "H100 80GB", 80, 2.99, "NONE")];

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.784.0 browser test did not run"); process.exit(0); }
  const rp = http.createServer((q, s) => {
    const send = (j) => { s.writeHead(200, { "Content-Type": "application/json" }); s.end(JSON.stringify(j)); };
    if (/^\/v2\/catalog\/gpus\?/.test(q.url)) return send({ gpus: GPUS });
    if (/^\/v2\/catalog\/templates/.test(q.url)) return send({ templates: [], pagination: { hasNextPage: false } });
    if (/^\/v2\/pods/.test(q.url)) return send({ pods: [], pagination: { hasNextPage: false } });
    send({});
  });
  try { await new Promise((ok, bad) => { rp.once("error", bad); rp.listen(8399, "127.0.0.1", ok); }); } catch { console.log("SKIP: port 8399 is busy - the 2.784.0 browser test did not run"); process.exit(0); }
  await api("/api/remotegpu/save", { runpod: { key: "rpa_UI784" } });
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 } });
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3Pods && window.H3GpuSpeed && window.SecFloat && SecFloat.windows.pods, null, { timeout: 30000 });
    await ev(() => { try { localStorage.removeItem("h3.pod.gpuSort"); } catch (e) { /* fine */ } H3Pods.show(true); H3Pods.go("create"); });
    await p.waitForFunction(() => { const s = document.getElementById("pdGpu"); return s && s.options.length > 3; }, null, { timeout: 20000 });
    const read = () => ev(() => ({ order: [...document.getElementById("pdGpu").options].map((o) => o.value.replace(/^NVIDIA (GeForce )?/, "")), picked: document.getElementById("pdGpu").value.replace(/^NVIDIA (GeForce )?/, ""),
      text: document.getElementById("pdGpu").selectedOptions[0].textContent, sort: (document.querySelector('input[name="pdGpuSort"]:checked') || {}).value,
      above: !!(document.getElementById("pdGpuSort").compareDocumentPosition(document.getElementById("pdGpu")) & Node.DOCUMENT_POSITION_FOLLOWING) }));
    let r = await read();
    check("Sort GPUs sits above the GPU list, Cheapest by default (as the list was)", r.above && r.sort === "cheap", r);
    check("…Cheapest: cheapest first, the one none is free last; the cheapest free with 20 GB+ picked", r.order.join() === "RTX A4000,RTX A6000,L40S,RTX 5090,H100 80GB HBM3" && r.picked === "RTX A6000", r);
    check("…each card says its rough speed (an RTX 5090 = 1×)", /~0\.45× RTX 5090/.test(r.text), r.text);
    await p.check('input[name="pdGpuSort"][value="fast"]'); await sleep(400);
    r = await read();
    check("Fastest: the fastest free first (H100 none free stays last); the fastest picked", r.order.join() === "RTX 5090,L40S,RTX A6000,RTX A4000,H100 80GB HBM3" && r.picked === "RTX 5090" && /~1× RTX 5090/.test(r.text), r);
    await p.selectOption("#pdGpu", "NVIDIA L40S"); await p.check('input[name="pdCloud"][value="COMMUNITY"]'); await sleep(800);
    r = await read();
    check("…another cloud keeps the order and the card picked", r.order[0] === "RTX 5090" && r.picked === "L40S", r);
    await p.reload();
    await p.waitForFunction(() => window.H3Pods && window.SecFloat && SecFloat.windows.pods, null, { timeout: 30000 });
    await ev(() => { H3Pods.show(true); H3Pods.go("create"); });
    await p.waitForFunction(() => { const s = document.getElementById("pdGpu"); return s && s.options.length > 3; }, null, { timeout: 20000 });
    r = await read();
    check("the order is remembered (Fastest after a reload)", r.sort === "fast" && r.order[0] === "RTX 5090", r);
    check("no page errors", errs.length === 0, errs);
  } finally {
    await b.close(); rp.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
