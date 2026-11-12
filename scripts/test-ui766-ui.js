#!/usr/bin/env node
/* bitGen Studio — 2.766.0 browser test: REMOTE MODELS, THE TICKED PODS, A BAR FOR EACH TRANSFER (static/remotemodels.js,
 * static/podxfer.js, static/podsdock.js, static/modelmgr.js, lib/remoteModels.js) on a running studio (H3_URL, default :8311) started with H3_RUNPOD_REST_API=http://127.0.0.1:8399/v2.
 * Tim (verbatim): "add a remote_models.json in our pods folder ... these will be the models listed in remote mode in model
 * manager and the overide settings dropdowns instead of the local models ... add a checkbox to the left of the pod name to
 * select the pod(mulitple pods can be selected)" + "go with your suggestions and add a progress bar for each transfer to the pod"
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.766.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
const ROOT = path.join(__dirname, "..");
const RMF = path.join(ROOT, "runpod", "pods", "remote_models.json");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b, m) => fetch(URL0 + p.replace(/^\//, ""), b || m ? { method: m || "POST", headers: { "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined } : undefined).then((r) => r.json());

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.766.0 browser test did not run"); process.exit(0); }
  const PODS = [{ id: "pod766a", name: "Busy pod", desiredStatus: "RUNNING", status: "RUNNING", costPerHr: 0.44, gpu: { id: "NVIDIA A40", count: 1 }, ports: ["8188/http"], templateId: "tplCu13u", startedAt: new Date(Date.now() - 90 * 60000).toISOString() },
    { id: "pod766b", name: "Spare pod", desiredStatus: "EXITED", status: "EXITED", costPerHr: 0.69, gpu: { id: "NVIDIA GeForce RTX 4090", count: 1 }, ports: ["8188/http"], templateId: "tplCu13u", containerDiskInGb: 40, volumeInGb: 80 }];
  const acts = [];
  const rp = http.createServer((q, s) => {
    let b = ""; q.on("data", (d) => { b += d; }); q.on("end", () => {
      const send = (c, j) => { s.writeHead(c, { "Content-Type": "application/json" }); s.end(JSON.stringify(j)); };
      if (/^\/proxy\//.test(q.url)) return send(502, {});
      if (q.headers.authorization !== "Bearer rpa_UI766") return send(401, {});
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
  try { await new Promise((ok, bad) => { rp.once("error", bad); rp.listen(8399, "127.0.0.1", ok); }); } catch { console.log("SKIP: port 8399 is busy - the 2.766.0 browser test did not run"); process.exit(0); }
  const g0 = await api("/api/gpusplit"), links0 = (await api("/api/stylepods")).links || {};
  await api("/api/remotegpu/save", { runpod: { key: "rpa_UI766", pod_id: "", port: 8188 }, serverless: { endpoint: "" } });
  await api("/api/remotegen/enabled", { on: true });
  await api("/api/gpusplit", { where: "remote", engine: { provider: "runpod", runpod: "pods" } });
  await api("/api/pods/costs?refresh=1").catch(() => {});
  const had = fs.existsSync(RMF) ? fs.readFileSync(RMF) : null, sel0 = (await api("/api/pods/selected")).selected || [];
  fs.mkdirSync(path.dirname(RMF), { recursive: true });
  fs.writeFileSync(RMF, JSON.stringify({ v: 1, models: [
    { id: "ui766a", label: "Krea raw UI766", group: "Krea", folder: "diffusion_models", name: "krea2_raw_ui766.safetensors", url: "https://huggingface.co/Comfy-Org/Krea-2/resolve/main/x.safetensors", source: "huggingface", size: 12e9, styles: [], pods: { pod766a: "done" } },
    { id: "ui766b", label: "My LoRA UI766", group: "Krea LoRAs", folder: "loras", name: "my_lora_ui766.safetensors", url: "https://civitai.red/api/download/models/766", source: "civitai", size: 2e8, styles: [], pods: {} }] }));
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3Pods && window.H3PodXfer && window.H3RemoteModels && window.H3ModelMgr && window.SecFloat && SecFloat.windows.pods, null, { timeout: 30000 });
    await ev(() => { H3Pods.show(true); SecFloat.windows.pods.panel.float(120, 40, 900, 900); });
    await sleep(600);
    await p.click('[data-pdsrc="mine"]');
    await p.waitForFunction(() => document.querySelector('.pdRow[data-pod="pod766a"] [data-pdsel]'), null, { timeout: 20000 });
    const c1 = await ev(() => { const r = document.querySelector('.pdRow[data-pod="pod766a"]'), cb = r.querySelector("[data-pdsel]"), nm = r.querySelector(".pdHead .nm b"), a = cb.getBoundingClientRect(), n = nm.getBoundingClientRect();
      return { left: a.right <= n.left, same: Math.abs((a.top + a.bottom) / 2 - (n.top + n.bottom) / 2) < 14, first: cb.parentElement.firstElementChild === cb, label: cb.getAttribute("aria-label"), n: document.querySelectorAll(".pdRow [data-pdsel]").length }; });
    check("PODS ▸ My pods: a checkbox LEFT of each pod's name, on its line, named for screen readers", c1.left && c1.same && c1.first && c1.label === "Select Busy pod" && c1.n === 2, c1);
    await p.check('.pdRow[data-pod="pod766a"] [data-pdsel]'); await sleep(400);
    await p.check('.pdRow[data-pod="pod766b"] [data-pdsel]'); await sleep(800);
    const s1 = (await api("/api/pods/selected")).selected.map((x) => x.id).sort().join();
    check("…several pods ticked - kept by the server (Model manager's ⇪ sends to them)", s1 === "pod766a,pod766b", s1);
    await p.click('.pdRow[data-pod="pod766a"] .pdHead'); await sleep(300);   // a click on the name still opens / closes it
    check("…the name still opens the pod; the tick stays", await ev(() => document.querySelector('.pdRow[data-pod="pod766a"]').classList.contains("open") && document.querySelector('.pdRow[data-pod="pod766a"] [data-pdsel]').checked));
    // Model manager in remote mode
    await ev(() => H3ModelMgr.show(true)); await sleep(500);
    await ev(() => H3ModelMgr.load());
    await p.waitForFunction(() => document.querySelector('.mmcard[data-key="rm:ui766a"]'), null, { timeout: 20000 });
    const m1 = await ev(() => ({ remote: !document.getElementById("mmRemote").hidden && document.getElementById("mmRemote").style.display !== "none", txt: document.getElementById("mmRemote").textContent,
      to: (document.querySelector("#mmRemote [data-rmto]") || {}).textContent || "", fetchHidden: document.getElementById("mmFetch").style.display === "none", send: !!document.querySelector('.mmcard[data-key="rm:ui766a"] [data-rmsend]'),
      pods: (document.querySelector('.mmcard[data-key="rm:ui766a"] .nfo') || {}).textContent || "", cards: [...document.querySelectorAll(".mmcard")].map((c) => c.dataset.key) }));
    check("Model manager (remote mode): the cards are remote_models.json's - no local ones; the remote bar says so", m1.remote && /Remote mode/.test(m1.txt) && m1.cards.every((k) => /^rm:/.test(k)) && m1.cards.includes("rm:ui766a"), m1);
    check("…Send to: the ticked pods; ⇪ on each card; the pods that have it (✓ 1); Civitai info / Sync hidden", /Send to: Busy pod, Spare pod|Send to: Spare pod, Busy pod/.test(m1.to) && m1.send && /✓ 1/.test(m1.pods) && m1.fetchHidden, m1);
    await p.click('[data-mmtab="loras"]'); await sleep(400);
    check("…LoRAs tab: the remote LoRAs", await ev(() => !!document.querySelector('.mmcard[data-key="rm:ui766b"]')));
    // ⇪: each ticked pod downloads it - a bar each (the stand-in pods have no ComfyUI: the bars fail, saying why)
    await p.click('.mmcard[data-key="rm:ui766b"] [data-rmsend]');
    await p.waitForFunction(() => document.querySelectorAll("#pdXfer .pxRow").length >= 2, null, { timeout: 20000 }).catch(() => {});
    const x1 = await ev(() => [...document.querySelectorAll("#pdXfer .pxRow")].map((r) => ({ nm: r.querySelector(".pxNm").textContent, bar: !!r.querySelector('.pxBar[role="progressbar"]'), sub: r.querySelector(".pxSub").textContent, bad: r.classList.contains("bad") })));
    check("⇪ Send: a progress bar for EACH ticked pod in the PODS docker (my_lora → Busy pod / Spare pod, from Civitai)", x1.length >= 2 && x1.some((x) => /my_lora_ui766\.safetensors → Busy pod \(from Civitai\)/.test(x.nm)) && x1.some((x) => /→ Spare pod/.test(x.nm)) && x1.every((x) => x.bar), x1);
    // 2.766.1: a stopped pod fails at once (▶ Start it); a running pod that does not answer is waited for (3 min) - its bar says so
    await p.waitForFunction(() => [...document.querySelectorAll("#pdXfer .pxRow")].some((r) => r.classList.contains("bad")) && [...document.querySelectorAll("#pdXfer .pxRow .pxSub")].some((x) => /waiting for the pod to answer/.test(x.textContent)), null, { timeout: 40000 }).catch(() => {});
    const x2 = await ev(() => [...document.querySelectorAll("#pdXfer .pxRow")].map((r) => ({ nm: r.querySelector(".pxNm").textContent, sub: r.querySelector(".pxSub").textContent, bad: r.classList.contains("bad") })));
    check("…the stopped pod: its bar red at once (▶ Start it); the running pod that does not answer: waiting for it, said under its bar", x2.some((x) => /Spare pod/.test(x.nm) && x.bad && /stopped on RunPod - ▶ Start it/.test(x.sub)) && x2.some((x) => /Busy pod/.test(x.nm) && !x.bad && /waiting for the pod to answer/.test(x.sub)), x2);
    if (process.env.H3_SHOT) { await p.screenshot({ path: process.env.H3_SHOT + "-a.png" }); }
    check("…the same bars in Model manager's remote bar", await ev(() => document.querySelectorAll("#mmRemote [data-rmxfer] .pxRow").length >= 2));
    // Basic Settings' Override combos read the remote list
    const cm = await ev(() => loadComfyModels(true).then((d) => ({ remote: !!d.remote, ck: ((d.categories.diffusion_models || {}).files || []).map((f) => f.name), lo: ((d.categories.loras || {}).files || []).map((f) => f.name) })));
    check("Override / LoRA dropdowns (the page's model lists): the remote models in remote mode", cm.remote && cm.ck.includes("krea2_raw_ui766.safetensors") && cm.lo.includes("my_lora_ui766.safetensors"), cm);
    // ＋ From this computer: this computer's models to search
    await p.click('[data-mmtab="models"]'); await sleep(300);
    await p.click("#mmRemote [data-rmlocal]"); await sleep(1500);
    check("＋ From this computer…: a search over this computer's models + LoRAs", await ev(() => !!document.querySelector("#mmRemote [data-rmq]")));
    await p.click("#mmRemote [data-rmlink]"); await sleep(300);
    await p.fill("#rmLUrl", "https://huggingface.co/x/y/resolve/main/ui766_link.safetensors"); await p.selectOption("#rmLFolder", "loras"); await p.fill("#rmLLabel", "Linked UI766");
    await p.click('#mmRemote [data-rmlf] button[type="submit"]'); await sleep(1500);
    check("＋ Link…: in remote_models.json (the list repainted)", JSON.parse(fs.readFileSync(RMF, "utf8")).models.some((m) => m.name === "ui766_link.safetensors" && m.label === "Linked UI766"));
    // local mode: this computer's models again
    await api("/api/gpusplit", { where: "local" }); await api("/api/remotegen/enabled", { on: false });
    const lm = await ev(() => loadComfyModels(true).then((d) => !d.remote));
    check("local mode: this computer's models in the lists again", lm);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close();
    rp.close();
    if (had) fs.writeFileSync(RMF, had); else { fs.rmSync(RMF, { force: true }); try { if (!fs.readdirSync(path.dirname(RMF)).length) fs.rmSync(path.join(ROOT, "runpod"), { recursive: true, force: true }); } catch { /* fine */ } }
    await api("/api/pods/selected", { pods: sel0 }).catch(() => {});
    await api("/api/pods/transfers/clear", {}).catch(() => {});
    await api("/api/gpusplit", { where: "local", engine: { provider: (g0.engine || {}).provider || "runpod", runpod: (g0.engine || {}).runpod || "serverless" }, llm: !!g0.llm, vlm: !!g0.vlm, image: !!g0.image, video: !!g0.video }).catch(() => {});
    await api("/api/remotegpu/save", { runpod: { key: "", pod_id: "", port: 8188 } }).catch(() => {});
    await api("/api/remotegen/enabled", { on: null }).catch(() => {});
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
