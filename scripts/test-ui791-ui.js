#!/usr/bin/env node
/* bitGen Studio — 2.791.0 browser test: LOCAL MULTI-GPU - ☁ Runs on ▸ "Local - <card>", the card's own ComfyUI started for a render
 * and the render sent there (lib/gpuCards.js, lib/remoteHosts.js, lib/gpuSplit.js, lib/core.js) on a running studio (H3_URL) started
 * with two stand-in cards and a stand-in ComfyUI per card:
 *   H3_E2E=1 H3_TEST_GPUS='[{"name":"RTX 5090","mem_total":32607},{"name":"RTX 3090","mem_total":24576}]'
 *   H3_GPU_CARD_CMD='["python3","<app>/scripts/stub-comfy.py","{port}","/tmp/stub-card-out"]'
 * Tim (the agreed design's D): "Local - <card> per type. ComfyUI runs on ONE card per process -> one ComfyUI per picked card
 * (--cuda-device N, its own port 8188, 8189 ...; jobs routed by type in gpuSplit.forJob like a remote target)"
 * No server / no Playwright / fewer than two cards on the server = SKIP. Put back afterwards (Image = Local, the card's ComfyUI stopped). */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.791.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b) => fetch(URL0 + p.replace(/^\//, ""), b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined).then((r) => r.json());

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.791.0 browser test did not run"); process.exit(0); }
  const gc = await api("/api/gpucards");
  if (!gc.cards || gc.cards.length < 2) { console.log("SKIP: the studio sees fewer than two graphics cards (start it with H3_TEST_GPUS - see the top of this file)"); process.exit(0); }
  const before = await api("/api/remotehosts");
  const b = await chromium.launch();
  const jobs = [];
  try {
    const opts = (before.kinds.find((k) => k.k === "image") || {}).options || [];
    check("Runs on ▸ Image lists Local - <card> for each card, after Local (2.794.0: speech rows too)", opts.map((o) => o.id).slice(0, 3).join() === "local,local:0,local:1" && /Local - RTX 3090 \(GPU 1, 24 GB\)/.test(opts[2].label)
      && ((before.kinds.find((k) => k.k === "tts") || {}).options || []).some((o) => /^local:/.test(o.id)), opts.slice(0, 3));
    const v1 = await api("/api/remotehosts", { kind: "image", host: "local:1" });
    const g1 = await api("/api/gpucards");
    check("picked Local - RTX 3090: Image = local:1, kept (rgpu.local_cards), nothing remote", (v1.hosts || {}).image === "local:1" && g1.picks.image === 1 && v1.where === "local", { hosts: v1.hosts, where: v1.where, picks: g1.picks });

    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3RemoteHosts || document.querySelector("[data-rhk]") || true, null, { timeout: 30000 });
    await sleep(2500);
    const sel = await p.evaluate(() => { const s = document.querySelector('select[data-rhkind="image"]'); return s ? { v: s.value, t: s.options[s.selectedIndex] && s.options[s.selectedIndex].textContent, n: s.options.length } : null; });
    check("the docker's Image dropdown shows the card picked", sel.v === "local:1" && /RTX 3090/.test(sel.t), sel);

    // a picture: the card's ComfyUI started (stand-in), the render sent there
    const sts = ((await api("/api/styles?kind=image")).styles || []).filter((x) => x.engine === "comfy" && !x.chain && (!x.runs_on || x.runs_on === "local"));
    const j = await api("/api/genimage", { prompt: "a red fox", style_id: sts[0].id });
    jobs.push(j.id);
    let jj = null;
    for (let i = 0; i < 80 && j.id; i++) { jj = await api("/api/jobs/" + j.id); if (jj && (jj.params || {}).gpu_card) break; if (jj && /^(failed|done)$/.test(jj.status) && !(jj.params || {}).gpu_card) break; await sleep(500); }
    const log = ((jj && jj.log) || []).join("\n");
    check("the render waits for GPU 1's own ComfyUI (port 8190), then goes to it", /\[gpu\] (looking for|starting) ComfyUI (on|for) GPU 1/.test(log) && ((jj || {}).params || {}).gpu_card && jj.params.gpu_card.url === "http://127.0.0.1:8190" && jj.params.gpu_card.card === 1, { log: log.slice(-800), gpu_card: ((jj || {}).params || {}).gpu_card, status: jj && jj.status });
    const g2 = await api("/api/gpucards");
    check("GPU 1's ComfyUI is up on 8190 (kept running for the next render)", g2.procs["1"] && g2.procs["1"].phase === "up" && g2.procs["1"].port === 8190, g2.procs);
    const up = await fetch("http://127.0.0.1:8190/system_stats").then((r) => r.ok).catch(() => false);
    check("…it answers", up);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("the test crashed: " + e.message, false); }
  finally {
    for (const j of jobs) if (j) await api("/api/jobs/" + j + "/cancel", {}).catch(() => {});
    await api("/api/remotehosts", { kind: "image", host: "local" }).catch(() => {});
    await api("/api/gpucards/stop", {}).catch(() => {});
    await b.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
