#!/usr/bin/env node
/* bitGen Studio — 2.767.0 browser test: BASIC SETTINGS ▸ GPU - LLM / VISION LLM ON LOCAL, OPENROUTER OR RUNPOD (static/remoteprep.js,
 * static/openrouter.js picker, routes/remotePrep.js) on a running studio (H3_URL, default :8311) started with H3_RUNPOD_REST_API=http://127.0.0.1:8399/v2.
 * Tim (verbatim): "when in remote mode, prepare the llm and video models for remote use" + "give user option to use openrouter or
 * runpod for llm/vllm or local" + "when user presses enter button to send prompt to llm" + "the model should be able to be
 * changed. it would be good to list/search open routers models and choose one from the list"
 * A stand-in RunPod on 8399; the box's question is answered in the page (route). Put back afterwards. No server / no
 * Playwright / 8399 busy = SKIP. */
"use strict";
const fs = require("fs"), path = require("path"), http = require("http");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.767.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
const ROOT = path.join(__dirname, "..");
const RMF = path.join(ROOT, "runpod", "pods", "remote_models.json");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b, m) => fetch(URL0 + p.replace(/^\//, ""), b || m ? { method: m || "POST", headers: { "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined } : undefined).then((r) => r.json());

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.767.0 browser test did not run"); process.exit(0); }
  const PODS = [{ id: "pod766a", name: "Busy pod", desiredStatus: "RUNNING", status: "RUNNING", costPerHr: 0.44, gpu: { id: "NVIDIA A40", count: 1 }, ports: ["8188/http"], templateId: "tplCu13u", startedAt: new Date(Date.now() - 90 * 60000).toISOString() },
    { id: "pod766b", name: "Spare pod", desiredStatus: "EXITED", status: "EXITED", costPerHr: 0.69, gpu: { id: "NVIDIA GeForce RTX 4090", count: 1 }, ports: ["8188/http"], templateId: "tplCu13u", containerDiskInGb: 40, volumeInGb: 80 }];
  const acts = [];
  const rp = http.createServer((q, s) => {
    let b = ""; q.on("data", (d) => { b += d; }); q.on("end", () => {
      const send = (c, j) => { s.writeHead(c, { "Content-Type": "application/json" }); s.end(JSON.stringify(j)); };
      if (/^\/proxy\//.test(q.url)) return send(502, {});
      if (q.headers.authorization !== "Bearer rpa_UI767") return send(401, {});
      if (q.method === "GET" && /^\/v2\/pods(\?|$)/.test(q.url)) return send(200, { pods: PODS });
      const one = /^\/v2\/pods\/(\w+)$/.exec(q.url); if (one && q.method === "GET") { const p = PODS.find((x) => x.id === one[1]); return p ? send(200, p) : send(404, {}); }
      const ac = /^\/v2\/pods\/(\w+)\/action$/.exec(q.url);
      if (ac && q.method === "POST") { const a = JSON.parse(b || "{}").action; acts.push(ac[1] + ":" + a); const i = PODS.findIndex((x) => x.id === ac[1]); if (i < 0) return send(404, {}); if (a === "terminate") { PODS.splice(i, 1); s.writeHead(204); return s.end(); } PODS[i].status = PODS[i].desiredStatus = a === "stop" ? "EXITED" : "RUNNING"; return send(200, PODS[i]); }
      if (/^\/v2\/catalog\/templates/.test(q.url)) return send(200, { templates: q.url.includes("official") ? [{ id: "tplCu13u", name: "ComfyUI CUDA 13", image: "runpod/comfyui:cuda13", ports: ["8188/http", "8888/http"] }] : [], pagination: { hasNextPage: false } });
      if (/^\/v2\/catalog\/gpus/.test(q.url)) return send(200, { gpus: [{ id: "NVIDIA A40", name: "A40", memory: 48, price: { secure: 0.44, community: 0.35 }, availability: "NONE", secure: true, community: true },
        { id: "NVIDIA RTX A6000", name: "RTX A6000", memory: 48, price: { secure: 0.49, community: 0.33 }, availability: "HIGH", secure: true, community: true },
        { id: "NVIDIA GeForce RTX 4090", name: "RTX 4090", memory: 24, price: { secure: 0.69, community: 0.34 }, availability: "HIGH", secure: true, community: true }] });
      if (/^\/v2\/billing\/pods/.test(q.url)) return send(200, { records: [], metadata: {} });
      send(404, {});
    });
  });
  try { await new Promise((ok, bad) => { rp.once("error", bad); rp.listen(8399, "127.0.0.1", ok); }); } catch { console.log("SKIP: port 8399 is busy - the 2.767.0 browser test did not run"); process.exit(0); }
  const g0 = await api("/api/gpusplit"), links0 = (await api("/api/stylepods")).links || {};
  await api("/api/remotegpu/save", { runpod: { key: "rpa_UI767", pod_id: "", port: 8188 }, serverless: { endpoint: "" } });
  await api("/api/remotegen/enabled", { on: true });
  await api("/api/gpusplit", { where: "remote", engine: { provider: "runpod", runpod: "pods" } });
  await api("/api/pods/costs?refresh=1").catch(() => {});
  const b = await chromium.launch();
  const rp0 = await api("/api/remoteprep"), where0 = rp0.where_set || rp0.where || {}, or0 = await api("/api/openrouter");   // 2.768.0: where = the effective one, where_set = the choice
  await api("/api/openrouter", { key: "sk-or-ui767", model: "google/gemma-4-31b-it:free" });
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.route("**/api/openrouter/models**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ models: [{ id: "google/gemma-4-31b-it:free", name: "Gemma 4 31B", free: true }, { id: "qwen/qwen3-vl-8b:free", name: "Qwen3 VL 8B", free: true, vision: true }, { id: "openai/gpt-x", name: "GPT X", in: 1, out: 2 }] }) }));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3RemotePrep && document.getElementById("gpuLlmWhere"), null, { timeout: 30000 });
    // Basic Settings in view, its GPU section open
    await ev(() => { if (window.SecFloat && SecFloat.windows && SecFloat.windows.basic && SecFloat.windows.basic.panel) try { SecFloat.windows.basic.panel.float(40, 40, 520, 900); } catch (e) { /* fine */ }
      const h = document.querySelector('h2.sec[data-sec="gpu"]'), b = document.getElementById("sec-gpu"); if (h && b && getComputedStyle(b).display === "none") h.click(); });
    await sleep(500);
    const rows = await ev(() => ({ shown: getComputedStyle(document.getElementById("gpuLlmWhere")).display !== "none", llm: [...document.querySelectorAll('input[name="rp_llm"]')].map((i) => i.value), vlm: [...document.querySelectorAll('input[name="rp_vlm"]')].map((i) => i.value) }));
    // 2.770.0 (Tim: "remove the openrouter search, and runpod and openrouter dialog, instead just have local and remote radio
    // buttons for llm and vllm" - the platform is Settings' choice, OpenRouter by default)
    check("remote mode: the ☁ Remote generation docker shows LLM and Vision LLM - Local / Remote (2.770.0; no OpenRouter search there)", rows.shown && rows.llm.join() === "local,remote" && rows.vlm.join() === "local,remote" && !(await ev(() => !!document.getElementById("rpOr_llm"))), rows);
    await api("/api/openrouter", { provider: "runpod" });
    await ev(() => document.querySelector('input[name="rp_llm"][value="remote"]').click());
    await p.waitForFunction(() => /set up on your pod when you send a prompt|on the pod/.test(document.getElementById("rpSt_llm").textContent), null, { timeout: 10000 }).catch(() => {});
    const s1 = await ev(() => document.getElementById("rpSt_llm").textContent);
    check("LLM ▸ Remote with RunPod picked in Settings (Pods): kept, and it says the LLM is set up on the pod when a prompt is sent", (await api("/api/remoteprep")).where.llm === "runpod" && /set up on your pod when you send a prompt/.test(s1), s1);
    await api("/api/openrouter", { provider: "openrouter" });
    await ev(() => { const i = document.querySelector('input[name="rp_vlm"][value="remote"]'); i.checked = true; i.dispatchEvent(new Event("change")); }); await sleep(1200);
    check("Vision LLM ▸ Remote with OpenRouter (the default): OpenRouter, the model picked in the prompt docker's list", (await api("/api/remoteprep")).where.vlm === "openrouter" && /prompt docker/.test(await ev(() => document.getElementById("rpSt_vlm").textContent)));
    await ev(() => { document.querySelector('input[name="gpuWhere"][value="local"]').click(); }); await sleep(1500);
    check("Local: the LLM / Vision LLM choice is hidden (this computer)", await ev(() => getComputedStyle(document.getElementById("gpuLlmWhere")).display === "none"));
    if (process.env.H3_SHOT) { await ev(() => document.querySelector('input[name="gpuWhere"][value="remote"]').click()); await sleep(1500); await ev(() => { const g = document.getElementById("sec-gpu"); g.scrollIntoView(); }); await p.screenshot({ path: process.env.H3_SHOT + "-gpu.png" }); }
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close();
    rp.close();
    await api("/api/remoteprep/where", { llm: where0.llm || "", vlm: where0.vlm || "" }).catch(() => {});
    await api("/api/openrouter", { key: or0.key || "", model: or0.model || "", vlm_model: or0.vlm_model || "", provider: or0.provider || "openrouter" }).catch(() => {});
    await api("/api/gpusplit", { where: "local", engine: { provider: (g0.engine || {}).provider || "runpod", runpod: (g0.engine || {}).runpod || "serverless" }, llm: !!g0.llm, vlm: !!g0.vlm, image: !!g0.image, video: !!g0.video }).catch(() => {});
    await api("/api/remotegpu/save", { runpod: { key: "", pod_id: "", port: 8188 } }).catch(() => {});
    await api("/api/remotegen/enabled", { on: null }).catch(() => {});
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
