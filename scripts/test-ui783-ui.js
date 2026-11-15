#!/usr/bin/env node
/* bitGen Studio — 2.783.0 browser test: the left docker is System; Basic Settings ▸ GPU is gone; Remote + Pods on the status
 * bar; All local / All remote / Both at the top of the ☁ Remote generation docker; pod + local stats side by side.
 * Needs a running studio (H3_URL, default :8311 - H3_E2E=1) with H3_RUNPOD_REST_API pointing at 127.0.0.1:8399 (a stand-in
 * RunPod answers there). The pod's stats are stood in for by the page's route (GET /api/pods/remote-stats).
 */
"use strict";
const http = require("http");
let chromium; try { ({ chromium } = require("playwright")); } catch { chromium = null; }
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.783.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b) => fetch(URL0 + p.replace(/^\//, ""), b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined).then((r) => r.json());

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.783.0 browser test did not run"); process.exit(0); }
  const rp = http.createServer((q, s) => { s.writeHead(200, { "Content-Type": "application/json" }); s.end(q.url.indexOf("/v2/pods") === 0 ? JSON.stringify({ pods: [], pagination: { hasNextPage: false } }) : "{}"); });
  try { await new Promise((ok, bad) => { rp.once("error", bad); rp.listen(8399, "127.0.0.1", ok); }); } catch { console.log("SKIP: port 8399 is busy - the 2.783.0 browser test did not run"); process.exit(0); }
  const g0 = await api("/api/gpusplit"), e0 = await api("/api/remotegen");
  await api("/api/remotegpu/save", { runpod: { key: "rpa_UI783" } });
  await api("/api/remotegen/enabled", { on: true });
  await api("/api/gpusplit", { where: "local", engine: { provider: "runpod", runpod: "pods" } });
  let stats = null;   // what the stand-in "pod" says (null = this computer only)
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 } });
    await ctx.addInitScript(() => { window.H3_REMOTE_STATS_POLL = 300; window.H3_RBTN_POLL = 1000; });
    await ctx.route(/\/api\/pods\/remote-stats/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(stats || { remote: null }) }));
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3RemoteBtns && document.getElementById("tRgen") && window.H3RemoteDock && H3RemoteDock.state().on !== null && window.SecFloat && SecFloat.windows.rgen && document.getElementById("gpuWhere"), null, { timeout: 30000 });
    await sleep(1500);
    const vis = (sel) => ev((s) => { const e = document.querySelector(s); return !!e && e.offsetParent !== null && getComputedStyle(e).display !== "none"; }, sel);

    check("the left docker is called System", await ev(() => document.querySelector("#ldock .dockhead h1").textContent.trim() === "System"));
    check("Basic Settings has no GPU item (none on screen)", !(await ev(() => !!document.querySelector('h2.sec.drop[data-sec="gpu"]'))) && !(await vis("#sec-gpu")));
    check("the status bar has Remote (remote generation on); Pods is hidden while everything is local",
      (await vis("#tRgen")) && !(await vis("#tPods")) && (await ev(() => document.getElementById("tRgen").previousElementSibling.id === "tQ")));

    await p.click("#tRgen"); await sleep(1200);
    const top = await ev(() => { const d = document.getElementById("rgdBody"); const w = document.getElementById("rgdWhere");
      return { shown: SecFloat.state("rgen").shown, first: d.firstElementChild && d.firstElementChild.id, inW: !!w.querySelector("#gpuWhere"),
        labels: [...w.querySelectorAll('input[name="gpuWhere"]')].map((i) => i.parentNode.textContent.trim()), lit: document.getElementById("tRgen").classList.contains("on") }; });
    check("Remote opens the ☁ Remote generation docker; its first section is the radio group: All local / All remote / Both; the button lit",
      top.shown && top.first === "rgdWhere" && top.inW && top.labels.join("|") === "All local|All remote|Both" && top.lit, top);

    await ev(() => { const i = document.querySelector('input[name="gpuWhere"][value="remote"]'); i.checked = true; i.dispatchEvent(new Event("change")); }); await sleep(2000);
    let g = await api("/api/gpusplit");
    check("All remote = every type Remote (image, video, music, speech, transcripts, song separation)", g.where === "remote" && ["image", "video", "music", "tts", "stt", "stems"].every((k) => g.types[k] === "remote"), { where: g.where, types: g.types });
    await p.waitForFunction(() => { const e = document.getElementById("tPods"); return e && e.style.display !== "none"; }, null, { timeout: 8000 }).catch(() => {});
    check("…something runs remotely: Pods shows on the status bar, after Remote", (await vis("#tPods")) && (await ev(() => document.getElementById("tPods").previousElementSibling.id === "tRgen")));
    await p.click("#tPods"); await sleep(1000);
    check("Pods opens the PODS docker (lit)", await ev(() => SecFloat.state("pods").shown && document.getElementById("tPods").classList.contains("on")));

    await ev(() => { const i = document.querySelector('input[name="rt_music"][value="local"]'); i.checked = true; i.dispatchEvent(new Event("change")); }); await sleep(2000);
    g = await api("/api/gpusplit");
    check("Music put back to Local while All remote = Both (the radio group follows)", g.where === "both" && g.types.music === "local" && g.types.image === "remote"
      && (await ev(() => document.querySelector('input[name="gpuWhere"]:checked').value === "both")), { where: g.where, types: g.types });

    // pod + local: this computer's charts stay, the pod's frame comes under them
    stats = { remote: { pod_id: "pod783", name: "Test pod", mixed: true }, stats: { cpu: 41, ram_used: 8192, ram_total: 65536, gpus: [{ name: "NVIDIA A40", util: 77, temp: 58, mem_used: 10240, mem_total: 46068 }], disks: [{ path: "/workspace", used: 2e10, total: 1e11 }] } };
    await p.waitForFunction(() => !!document.getElementById("statsPod"), null, { timeout: 10000 }).catch(() => {});
    const mx = await ev(() => { const f = document.getElementById("statsPod"); return f && { title: f.querySelector(".gtitle span").textContent, rows: [...f.querySelectorAll(".stat .row span")].map((x) => x.textContent), cpu: f.querySelector(".stat .row b").textContent,
      head: document.getElementById("stats").previousElementSibling.textContent, local: !!document.querySelector("#stats > .stat") }; });
    check("pod + local: the System heading, this computer's charts, then ☁ Test pod's frame (CPU, RAM, GPU, VRAM, disk)", !!mx && mx.title === "☁ Test pod" && mx.head === "System" && mx.local
      && mx.rows.join("|") === "CPU|RAM|GPU0 · A40|GPU0 VRAM|Disk /workspace" && mx.cpu === "41%", mx);
    stats = { remote: { pod_id: "pod783", name: "Test pod" }, stats: stats.stats };
    await p.waitForFunction(() => !document.getElementById("statsPod") && /☁ Test pod/.test(document.getElementById("stats").previousElementSibling.textContent), null, { timeout: 10000 }).catch(() => {});
    check("the pod alone: its figures in the charts (System · ☁ Test pod), no separate frame", await ev(() => !document.getElementById("statsPod") && /System · ☁ Test pod/.test(document.getElementById("stats").previousElementSibling.textContent)));
    stats = null;

    await ev(() => { const i = document.querySelector('input[name="gpuWhere"][value="local"]'); i.checked = true; i.dispatchEvent(new Event("change")); }); await sleep(2500);
    g = await api("/api/gpusplit");
    check("All local: everything here, Pods hidden and its docker closed - the Remote generation docker stays open",
      g.where === "local" && !(await vis("#tPods")) && (await ev(() => !SecFloat.state("pods").shown && SecFloat.state("rgen").shown)), { where: g.where });
    await api("/api/remotegen/enabled", { on: false }); await ev(() => document.dispatchEvent(new Event("h3:rgpu"))); await sleep(1500);
    check("Use remote generation off: the Remote button hides", !(await vis("#tRgen")) && !(await vis("#tPods")));
    check("no page errors", errs.length === 0, errs);
  } finally {
    await b.close();
    await api("/api/remotegen/enabled", { on: true }).catch(() => {});
    await api("/api/gpusplit", { where: g0.where || "local", per: false, engine: g0.engine || undefined }).catch(() => {});
    await api("/api/remotegen/enabled", { on: !!e0.enabled }).catch(() => {});
    rp.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
