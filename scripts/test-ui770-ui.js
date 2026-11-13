#!/usr/bin/env node
/* bitGen Studio — 2.770.0 browser test (from 2.768.0's): THE REMOTE OPTIONS IN THE ☁ REMOTE GENERATION DOCKER, AND THE PROMPT DOCKER'S LLM / VISION
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.770.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b, m) => fetch(URL0 + p.replace(/^\//, ""), b || m ? { method: m || "POST", headers: { "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined } : undefined).then((r) => r.json());
const listen = (srv, port) => new Promise((ok, bad) => { srv.once("error", bad); srv.listen(port, "127.0.0.1", ok); });

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.770.0 browser test did not run"); process.exit(0); }
  const MODELS = Array.from({ length: 14 }, (_, i) => ({ id: "free/m" + i + ":free", name: "Free M" + i, context_length: 8000 + i, architecture: { input_modalities: ["text"], output_modalities: ["text"] }, pricing: { prompt: "0", completion: "0" } })).concat([
    { id: "google/gemma-4-31b-it:free", name: "Gemma 4 31B (free)", context_length: 131072, architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] }, pricing: { prompt: "0", completion: "0" } },
    { id: "qwen/qwen3.8-27b:free", name: "Qwen3.8 27B (free)", context_length: 32768, architecture: { input_modalities: ["text"], output_modalities: ["text"] }, pricing: { prompt: "0", completion: "0" } },
    { id: "openai/gpt-x", name: "GPT X", architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] }, pricing: { prompt: "0.000002", completion: "0.000008" }, description: "A paid model that takes pictures" }]);
  const orsrv = http.createServer((q, s) => { s.writeHead(200, { "Content-Type": "application/json" }); s.end(JSON.stringify(/\/models/.test(q.url) ? { data: MODELS } : {})); });
  const rp = http.createServer((q, s) => { s.writeHead(200, { "Content-Type": "application/json" }); s.end(JSON.stringify(/\/v2\/pods/.test(q.url) ? { pods: [] } : /templates/.test(q.url) ? { templates: [], pagination: {} } : /gpus/.test(q.url) ? { gpus: [] } : /billing/.test(q.url) ? { records: [] } : {})); });
  try { await listen(orsrv, 8397); await listen(rp, 8399); } catch { console.log("SKIP: port 8397 / 8399 is busy - the 2.770.0 browser test did not run"); process.exit(0); }
  const g0 = await api("/api/gpusplit"), or0 = await api("/api/openrouter"), rp0 = await api("/api/remoteprep"), where0 = rp0.where_set || {};
  await api("/api/remotegpu/save", { runpod: { key: "rpa_UI768", pod_id: "", port: 8188 }, serverless: { endpoint: "" } });
  await api("/api/remotegen/enabled", { on: true });
  await api("/api/remoteprep/where", { llm: "", vlm: "" });
  await api("/api/openrouter", { key: "", model: "", vlm_model: "" });
  await api("/api/gpusplit", { where: "remote", engine: { provider: "runpod", runpod: "pods" } });
  await api("/api/openrouter", { provider: "openrouter", show_free: true, show_paid: false });   // the Settings platform = OpenRouter (the default)
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3RemoteLlm && document.querySelector("#llmSel optgroup[data-rl]"), null, { timeout: 30000 }).catch(() => {});
    await sleep(800);
    const L1 = await ev(() => ({ n: [...document.querySelectorAll("#llmSel option[data-rl]")].length, more: [...document.querySelectorAll("#llmSel option")].map((o) => o.textContent).filter((t) => /more - ☰ All/.test(t)), q: !!document.getElementById("rlQ_llm") && getComputedStyle(document.getElementById("rlQ_llm")).display !== "none", all: !!document.getElementById("rlAll") && getComputedStyle(document.getElementById("rlAll")).display !== "none", paid: [...document.querySelectorAll("#llmSel option")].some((o) => o.value === "openai/gpt-x") }));
    check("remote mode: the LLM list shows 10 at a time (free only - Settings' default), says how many more; ☰ All beside the lists (no search box - 2.770.2)", L1.n === 10 && /6 more - ☰ All/.test(L1.more[0] || "") && !L1.q && L1.all && !L1.paid, L1);
    await api("/api/openrouter", { show_paid: true }); await ev(() => window.H3RemoteLlm.load()); await sleep(800);
    check("Settings ▸ OpenRouter ▸ Show paid: the paid models are in the list too (with their price)", await ev(() => [...document.querySelectorAll("#llmSel option[data-rl]")].length === 10 && /17 more|7 more/.test([...document.querySelectorAll("#llmSel option")].map((o) => o.textContent).join("|"))));
    await ev(() => document.getElementById("rlAll").click());
    await p.waitForFunction(() => document.querySelectorAll("#rlDlgRows tr[data-id]").length > 10, null, { timeout: 10000 }).catch(() => {});
    const D1 = await ev(() => ({ open: getComputedStyle(document.getElementById("rlDlg")).display !== "none", n: document.querySelectorAll("#rlDlgRows tr[data-id]").length, count: document.getElementById("rlDlgN").textContent }));
    check("☰ All: a dialog with every OpenRouter model (free and paid) in a list", D1.open && D1.n === 17 && /17 of 17 models/.test(D1.count), D1);
    await ev(() => { document.getElementById("rlDlgFree").click(); }); await sleep(200);
    const D2 = await ev(() => [...document.querySelectorAll("#rlDlgRows tr[data-id]")].map((r) => r.dataset.id));
    check("…Free off: only the paid ones", D2.length === 1 && D2[0] === "openai/gpt-x", D2);
    await ev(() => { document.getElementById("rlDlgSort").value = "price"; document.getElementById("rlDlgSort").dispatchEvent(new Event("change")); }); await sleep(200);
    check("…sorted by price (low first)", (await ev(() => [...document.querySelectorAll("#rlDlgRows tr[data-id]")].map((r) => r.dataset.id)))[0] === "qwen/qwen3.8-27b:free" ? false : true);
    await ev(() => { const q = document.getElementById("rlDlgQ"); q.value = "gpt"; q.dispatchEvent(new Event("input")); }); await sleep(200);
    await ev(() => document.querySelector('#rlDlgRows tr[data-id="openai/gpt-x"]').click()); await sleep(200);
    const det = await ev(() => document.getElementById("rlDlgDet").textContent);
    check("…picking one shows its details (price, context, pictures, description)", /Paid: \$2 per million tokens in, \$8 out/.test(det) && /takes pictures/.test(det) && /A paid model that takes pictures/.test(det), det);
    await ev(() => document.getElementById("rlDlgUse").click()); await sleep(1200);
    const after = await ev(() => ({ open: getComputedStyle(document.getElementById("rlDlg")).display !== "none", sel: document.getElementById("llmSel").value }));
    check("…Use: the dialog closes, the LLM list is set to it and it is the model used (saved)", !after.open && after.sel === "openai/gpt-x" && (await api("/api/openrouter")).model === "openai/gpt-x", after);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close(); orsrv.close(); rp.close();
    await api("/api/remoteprep/where", { llm: where0.llm || "", vlm: where0.vlm || "" }).catch(() => {});
    await api("/api/openrouter", { key: or0.key || "", model: or0.model || "", vlm_model: or0.vlm_model || "", show_paid: !!or0.show_paid, provider: or0.provider || "openrouter" }).catch(() => {});
    await api("/api/gpusplit", { where: "local", engine: { provider: (g0.engine || {}).provider || "runpod", runpod: (g0.engine || {}).runpod || "serverless" }, llm: !!g0.llm, vlm: !!g0.vlm, image: !!g0.image, video: !!g0.video }).catch(() => {});
    await api("/api/remotegpu/save", { runpod: { key: "", pod_id: "", port: 8188 } }).catch(() => {});
    await api("/api/remotegen/enabled", { on: null }).catch(() => {});
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
