#!/usr/bin/env node
/* bitGen Studio — 2.766.2 browser test: BASIC SETTINGS LOCAL <-> REMOTE SWITCHES THE APP OVER (static/gpusplit.js,
 * lib/modeSwitch.js, static/index.html cmFolderKey, static/remotemodels.js recheck) on a running studio (H3_URL, default :8311) started with H3_RUNPOD_REST_API=http://127.0.0.1:8399/v2.
 * Tim (verbatim): "when local is selected in basic settings go to local mode . show all the local model folders in folder
 * filter, check if comfyui is running, start it if it is not running ... in remote mode stop comfyi if it is running, clear the
 * folders in folder filer in basic settings and show the model families instead, list the models in the remote models list,
 * filter by family"
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.766.2 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
const ROOT = path.join(__dirname, "..");
const RMF = path.join(ROOT, "runpod", "pods", "remote_models.json");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b, m) => fetch(URL0 + p.replace(/^\//, ""), b || m ? { method: m || "POST", headers: { "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined } : undefined).then((r) => r.json());

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.766.2 browser test did not run"); process.exit(0); }
  const PODS = [{ id: "pod766a", name: "Busy pod", desiredStatus: "RUNNING", status: "RUNNING", costPerHr: 0.44, gpu: { id: "NVIDIA A40", count: 1 }, ports: ["8188/http"], templateId: "tplCu13u", startedAt: new Date(Date.now() - 90 * 60000).toISOString() },
    { id: "pod766b", name: "Spare pod", desiredStatus: "EXITED", status: "EXITED", costPerHr: 0.69, gpu: { id: "NVIDIA GeForce RTX 4090", count: 1 }, ports: ["8188/http"], templateId: "tplCu13u", containerDiskInGb: 40, volumeInGb: 80 }];
  const acts = [];
  const rp = http.createServer((q, s) => {
    let b = ""; q.on("data", (d) => { b += d; }); q.on("end", () => {
      const send = (c, j) => { s.writeHead(c, { "Content-Type": "application/json" }); s.end(JSON.stringify(j)); };
      if (/^\/proxy\//.test(q.url)) return send(502, {});
      if (q.headers.authorization !== "Bearer rpa_UI7662") return send(401, {});
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
  try { await new Promise((ok, bad) => { rp.once("error", bad); rp.listen(8399, "127.0.0.1", ok); }); } catch { console.log("SKIP: port 8399 is busy - the 2.766.2 browser test did not run"); process.exit(0); }
  const g0 = await api("/api/gpusplit"), links0 = (await api("/api/stylepods")).links || {};
  await api("/api/remotegpu/save", { runpod: { key: "rpa_UI7662", pod_id: "", port: 8188 }, serverless: { endpoint: "" } });
  await api("/api/remotegen/enabled", { on: true });
  await api("/api/gpusplit", { where: "remote", engine: { provider: "runpod", runpod: "pods" } });
  await api("/api/pods/costs?refresh=1").catch(() => {});
  const had = fs.existsSync(RMF) ? fs.readFileSync(RMF) : null;
  fs.mkdirSync(path.dirname(RMF), { recursive: true });
  fs.writeFileSync(RMF, JSON.stringify({ v: 1, models: [
    { id: "f1", label: "Krea raw", group: "Krea", folder: "diffusion_models", name: "krea2_raw_ui7662.safetensors", url: "https://x.io/k", source: "link" },
    { id: "f2", label: "Merge", folder: "checkpoints", name: "flux_merge_ui7662.safetensors", url: "https://x.io/f", source: "civitai", base_model: "Flux.1 D" },
    { id: "f3", label: "Pony one", folder: "checkpoints/Pony", name: "pony_ui7662.safetensors", url: "https://x.io/p", source: "link" }] }));
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3RemoteModels && typeof loadComfyModels === "function" && document.querySelector("#imgCkptCombo .cmfolder"), null, { timeout: 30000 });
    await ev(() => loadComfyModels(true)); await sleep(800);
    const setF = (v) => ev((x) => { const s = document.querySelector("#imgCkptCombo .cmfolder"); s.value = x; s.dispatchEvent(new Event("change", { bubbles: true })); }, v);
    await setF("*all*"); await sleep(300);   // a family remembered from an earlier run
    // the files listed - not the value already picked (a combo keeps showing it whatever the filter)
    const fold = () => ev(() => { const s = document.querySelector("#imgCkptCombo .cmfolder"), f = document.querySelector("#imgCkptCombo .cmfile"), cur = (document.getElementById("imgCkpt") || {}).value || "";
      return { opts: [...s.options].map((o) => o.textContent), vals: [...s.options].map((o) => o.value), files: [...f.options].map((o) => o.value).filter((v) => v && v !== cur) }; });
    const r1 = await fold();
    check("remote mode: Basic Settings' folder filter = the model families (All model families, Flux, Krea, Pony) - no folders", r1.opts[0] === "All model families" && r1.vals.slice(1).every((v) => /^fam:/.test(v)) && ["Flux", "Krea", "Pony"].every((x) => r1.opts.some((o) => o.startsWith(x))) && r1.files.includes("Pony/pony_ui7662.safetensors"), r1);
    const kv = r1.vals.find((v, i) => /Krea/.test(r1.opts[i]));
    await ev((v) => { const s = document.querySelector("#imgCkptCombo .cmfolder"); s.value = v; s.dispatchEvent(new Event("change", { bubbles: true })); }, kv); await sleep(300);   // Basic Settings may be folded
    const r2 = await fold();
    check("…filter by family: only that family's models (across checkpoints / diffusion models)", r2.files.join() === "krea2_raw_ui7662.safetensors", r2.files);
    // Local in Basic Settings ▸ GPU
    await ev(() => { const i = document.querySelector('input[name="gpuWhere"][value="local"]'); i.click(); });
    await p.waitForFunction(() => /^Local mode/.test((document.getElementById("gpuMsg") || {}).textContent || ""), null, { timeout: 15000 }).catch(() => {});
    const note1 = await ev(() => document.getElementById("gpuMsg").textContent);
    check("Local picked: local mode, ComfyUI here checked / started - said under the choice", /^Local mode/.test(note1), note1);
    await p.waitForFunction(() => { const s = document.querySelector("#imgCkptCombo .cmfolder"); return s && s.options[0].textContent === "All folders"; }, null, { timeout: 15000 }).catch(() => {});
    const r3 = await fold();
    check("…the folder filter = this computer's folders again (All folders, category/folder); no remote models", r3.opts[0] === "All folders" && !r3.vals.some((v) => /^fam:/.test(v)) && !r3.files.some((f) => /ui7662/.test(f)), r3);
    check("…the server is in local mode", (await api("/api/remotemodels/mode")).pods_mode === false);
    await ev(() => { const i = document.querySelector('input[name="gpuWhere"][value="remote"]'); i.click(); });
    await p.waitForFunction(() => /^Remote mode/.test((document.getElementById("gpuMsg") || {}).textContent || ""), null, { timeout: 15000 }).catch(() => {});
    const note2 = await ev(() => document.getElementById("gpuMsg").textContent);
    await p.waitForFunction(() => { const s = document.querySelector("#imgCkptCombo .cmfolder"); return s && s.options[0].textContent === "All model families"; }, null, { timeout: 15000 }).catch(() => {});
    const r4 = await fold();
    check("Remote picked again: remote mode said (ComfyUI here stopped when bitGen started it); the families back", /^Remote mode/.test(note2) && r4.opts[0] === "All model families", { note2, r4 });
    await setF("*all*");
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close();
    rp.close();
    if (had) fs.writeFileSync(RMF, had); else { fs.rmSync(RMF, { force: true }); try { if (!fs.readdirSync(path.dirname(RMF)).length) fs.rmSync(path.join(ROOT, "runpod"), { recursive: true, force: true }); } catch { /* fine */ } }
    await api("/api/gpusplit", { where: "local", engine: { provider: (g0.engine || {}).provider || "runpod", runpod: (g0.engine || {}).runpod || "serverless" }, llm: !!g0.llm, vlm: !!g0.vlm, image: !!g0.image, video: !!g0.video }).catch(() => {});
    await api("/api/remotegpu/save", { runpod: { key: "", pod_id: "", port: 8188 } }).catch(() => {});
    await api("/api/remotegen/enabled", { on: null }).catch(() => {});
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
