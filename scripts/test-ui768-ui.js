#!/usr/bin/env node
/* bitGen Studio — 2.768.0 browser test: THE REMOTE OPTIONS IN THE ☁ REMOTE GENERATION DOCKER, AND THE PROMPT DOCKER'S LLM / VISION
 * LISTS = THE REMOTE HOST'S MODELS IN REMOTE MODE (static/gpusplit.js #gpuRemoteOpts, static/remotedock.js adopt,
 * static/remotellm.js, routes/remoteLlm.js) on a running studio (H3_URL, default :8311) started with
 * H3_OPENROUTER_API=http://127.0.0.1:8397/v1 and H3_RUNPOD_REST_API=http://127.0.0.1:8399/v2.
 * Tim (verbatim): "move all the remote gpu options to the remote gpu docker, when in remote mode clear the llm and vllm dropdown
 * lists in prompt docker add the list of free llm and vl models from openrouter(default) or the selected host in our prompt llm
 * and vllm dropdowns."
 * Stand-in OpenRouter on 8397 and RunPod on 8399. Put back afterwards. No server / no Playwright / a port busy = SKIP. */
"use strict";
const path = require("path"), http = require("http");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.768.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b, m) => fetch(URL0 + p.replace(/^\//, ""), b || m ? { method: m || "POST", headers: { "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined } : undefined).then((r) => r.json());
const listen = (srv, port) => new Promise((ok, bad) => { srv.once("error", bad); srv.listen(port, "127.0.0.1", ok); });

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.768.0 browser test did not run"); process.exit(0); }
  const MODELS = [
    { id: "google/gemma-4-31b-it:free", name: "Gemma 4 31B (free)", context_length: 131072, architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] }, pricing: { prompt: "0", completion: "0" } },
    { id: "qwen/qwen3.8-27b:free", name: "Qwen3.8 27B (free)", context_length: 32768, architecture: { input_modalities: ["text"], output_modalities: ["text"] }, pricing: { prompt: "0", completion: "0" } },
    { id: "openai/gpt-x", name: "GPT X", architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] }, pricing: { prompt: "0.000002", completion: "0.000008" } }];
  const orsrv = http.createServer((q, s) => { s.writeHead(200, { "Content-Type": "application/json" }); s.end(JSON.stringify(/\/models/.test(q.url) ? { data: MODELS } : {})); });
  const rp = http.createServer((q, s) => { s.writeHead(200, { "Content-Type": "application/json" }); s.end(JSON.stringify(/\/v2\/pods/.test(q.url) ? { pods: [] } : /templates/.test(q.url) ? { templates: [], pagination: {} } : /gpus/.test(q.url) ? { gpus: [] } : /billing/.test(q.url) ? { records: [] } : {})); });
  try { await listen(orsrv, 8397); await listen(rp, 8399); } catch { console.log("SKIP: port 8397 / 8399 is busy - the 2.768.0 browser test did not run"); process.exit(0); }
  const g0 = await api("/api/gpusplit"), or0 = await api("/api/openrouter"), rp0 = await api("/api/remoteprep"), where0 = rp0.where_set || {};
  await api("/api/remotegpu/save", { runpod: { key: "rpa_UI768", pod_id: "", port: 8188 }, serverless: { endpoint: "" } });
  await api("/api/remotegen/enabled", { on: true });
  await api("/api/remoteprep/where", { llm: "", vlm: "" });
  await api("/api/openrouter", { key: "", model: "", vlm_model: "", provider: "openrouter", show_free: true, show_paid: false });   // 2.770.0: the Settings platform = OpenRouter
  await api("/api/gpusplit", { where: "remote", engine: { provider: "runpod", runpod: "pods" } });
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = [], starts = [];
    p.on("pageerror", (e) => errs.push(e.message));
    p.on("request", (r) => { if (/\/api\/llm\/start$/.test(r.url())) starts.push(r.postData()); });
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3RemoteLlm && document.getElementById("rgdOpts") && document.getElementById("gpuRemoteOpts"), null, { timeout: 30000 });
    await sleep(1500);
    const where = await ev(() => { const inSec = (id) => !!document.getElementById(id) && !!document.getElementById(id).closest("#sec-gpu"), inDock = (id) => !!document.getElementById(id) && !!document.getElementById(id).closest("#rgdOpts");
      return { secKeeps: ["gpuWhere", "gpuLine", "gpuDock"].map(inSec), dock: ["gpuEngine", "gpuBoxes", "gpuLlmWhere", "gpuRpDock", "gpuSetup"].map(inDock), secHas: ["gpuEngine", "gpuBoxes", "gpuLlmWhere", "gpuRpDock"].map(inSec) }; });
    check("Basic Settings ▸ GPU keeps Local / Remote / Both, its line and ☁ Remote generation docker; Remote servers / RunPod, the Both boxes, LLM / Vision LLM and 💲 RunPod are in the ☁ Remote generation docker",
      where.secKeeps.every(Boolean) && where.dock.every(Boolean) && !where.secHas.some(Boolean), where);
    await p.waitForFunction(() => document.querySelector("#llmSel optgroup[data-rl]") && document.querySelector("#visionSel optgroup[data-rl]"), null, { timeout: 15000 }).catch(() => {});
    const L1 = await ev(() => ({ g: (document.querySelector("#llmSel optgroup") || {}).label, llm: [...document.querySelectorAll("#llmSel option")].map((o) => o.value), vlm: [...document.querySelectorAll("#visionSel option")].map((o) => o.value), sb: document.getElementById("sbllm").textContent }));
    check("Remote + nothing picked: the prompt docker's LLM list = OpenRouter's FREE text models (this computer's GGUFs cleared); the first one picked + saved",
      L1.g === "☁ OpenRouter" && L1.llm.join() === "google/gemma-4-31b-it:free,qwen/qwen3.8-27b:free" && !L1.llm.some((v) => /\.gguf$/i.test(v)) && /LLM: ☁ /.test(L1.sb), L1);
    check("…the Vision list = the free models that take pictures", L1.vlm.join() === "google/gemma-4-31b-it:free", L1.vlm);
    await sleep(500);
    check("…the first ones saved as OpenRouter's models (a prompt works at once once a key is added)", (await api("/api/openrouter")).model === "google/gemma-4-31b-it:free" && (await api("/api/openrouter")).vlm_model === "google/gemma-4-31b-it:free");
    await ev(() => { const s = document.getElementById("llmSel"); s.value = "qwen/qwen3.8-27b:free"; s.dispatchEvent(new Event("change", { bubbles: true })); }); await sleep(800);
    check("picking one in the LLM list: OpenRouter's model saved, nothing started on this computer (no /api/llm/start)", (await api("/api/openrouter")).model === "qwen/qwen3.8-27b:free" && starts.length === 0, { starts });
    await ev(() => { const s = document.getElementById("visionSel"); s.dispatchEvent(new Event("focus")); s.focus(); }); await sleep(1500);
    check("…the Vision list stays the remote one when it is opened (the page's own loader kept out)", await ev(() => !!document.querySelector("#visionSel optgroup[data-rl]") && [...document.querySelectorAll("#visionSel option")].every((o) => !/\.gguf$/i.test(o.value))));
    // the docker's LLM row ▸ RunPod (Pods): the pod's GGUFs
    await api("/api/openrouter", { provider: "runpod" });   // 2.770.0: Remote = the platform Settings picks
    await ev(() => { const i = document.querySelector('input[name="rp_llm"][value="remote"]'); i.checked = true; i.dispatchEvent(new Event("change")); });
    await p.waitForFunction(() => /RunPod pod/.test((document.querySelector("#llmSel optgroup") || {}).label || ""), null, { timeout: 10000 }).catch(() => {});
    const L2 = await ev(() => ({ g: (document.querySelector("#llmSel optgroup") || {}).label, llm: [...document.querySelectorAll("#llmSel option")].map((o) => o.value) }));
    check("LLM ▸ Remote with RunPod picked in Settings: the LLM list = the GGUFs bitGen puts on the pod", L2.g === "☁ RunPod pod" && L2.llm.includes("Qwen3-8B-Q4_K_M.gguf") && !L2.llm.some((v) => /VL|mmproj/.test(v)), L2);
    await ev(() => { const s = document.getElementById("llmSel"); s.value = "Qwen3-8B-Q4_K_M.gguf"; s.dispatchEvent(new Event("change", { bubbles: true })); }); await sleep(800);
    check("…picking one: kept for the pod (set up with it at the next prompt), nothing started here", (await api("/api/remotellm")).llm.current === "Qwen3-8B-Q4_K_M.gguf" && starts.length === 0);
    // Local: this computer's lists back
    await ev(() => { const h = document.querySelector('h2.sec[data-sec="gpu"]'), bd = document.getElementById("sec-gpu"); if (h && bd && getComputedStyle(bd).display === "none") h.click(); document.querySelector('input[name="gpuWhere"][value="local"]').click(); });
    await p.waitForFunction(() => !document.querySelector("#llmSel [data-rl]") && !document.querySelector("#visionSel [data-rl]"), null, { timeout: 10000 }).catch(() => {});
    const L3 = await ev(() => ({ llm: !!document.querySelector("#llmSel [data-rl]"), vlm: !!document.querySelector("#visionSel [data-rl]"), n: document.getElementById("llmSel").options.length, local: document.getElementById("gpuRemoteOpts").classList.contains("gpuLocal") }));
    check("Local: the prompt docker's lists are this computer's again; the docker's remote options hidden", !L3.llm && !L3.vlm && L3.n >= 1 && L3.local, L3);
    if (process.env.H3_SHOT) {
      await ev(() => document.querySelector('input[name="gpuWhere"][value="remote"]').click()); await sleep(1500);
      await ev(() => window.H3RemoteDock && H3RemoteDock.show(true)); await sleep(800);
      await p.screenshot({ path: process.env.H3_SHOT + "-768.png" });
    }
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close(); orsrv.close(); rp.close();
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
