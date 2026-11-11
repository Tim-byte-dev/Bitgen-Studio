#!/usr/bin/env node
/* bitGen Studio — 2.759.0 in a REAL browser against a running studio (H3_URL / H3_PORT - default 8311) started with
 * H3_RUNPOD_REST_API=http://127.0.0.1:8399/v2 and H3_RUNPOD_PROXY=http://127.0.0.1:8399/proxy/{id}-{port} (this test's
 * stand-in RunPod + pod on 8399).
 * Tim (verbatim): "if i select a pod, how do i choose what model comfyui template to use and to dl it?" (asked: "Both")
 *   - PODS ▸ For <style>: the templates that fit it first, ✓ fits on them
 *   - ⬇ Models on a running pod: how files reach it (ComfyUI-Manager here, no Jupyter yet -> the password box), a style ticks
 *     its files, the search, ⬇ Download ticked -> Manager's queue, a bar per file
 * Put back afterwards. No server / no Playwright / 8399 busy = SKIP. */
"use strict";
const path = require("path"), http = require("http");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.759.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b) => fetch(URL0 + p.replace(/^\//, ""), b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined).then((r) => r.json());
(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.759.0 browser test did not run"); process.exit(0); }
  const queued = []; let done = 0;
  const POD = { id: "pod759", name: "Qwen pod", desiredStatus: "RUNNING", status: "RUNNING", imageName: "ls250824/run-comfyui-image", gpu: { id: "NVIDIA RTX A5000", count: 1 }, costPerHr: 0.27, runtime: { uptime: 60 } };
  const TPL = [{ id: "pyt759aa", name: "PyTorch 2.8", image: "runpod/pytorch:2.8", ports: ["8888/http"], category: "NVIDIA" },
    { id: "krea759a", name: "ComfyUI Krea 2 ready", image: "someone/krea2-comfy", ports: ["8188/http"], category: "NVIDIA" }];
  let MVAE = "qwen_image_vae.safetensors";   // Manager's list: the style's VAE (set from the files the style ticks - its files follow bitGen's catalogue)
  const rp = http.createServer((q, s) => { let b = ""; q.on("data", (d) => { b += d; }); q.on("end", () => {
    const send = (c, j) => { s.writeHead(c, { "Content-Type": "application/json" }); s.end(JSON.stringify(j)); };
    const px = /^\/proxy\/pod759-3000(\/.*)$/.exec(q.url);
    if (px) { const p = px[1];
      if (p === "/system_stats") return send(200, { system: { argv: ["/workspace/ComfyUI/main.py"] } });
      if (p === "/manager/queue/status") return send(200, { total_count: queued.length, done_count: done, in_progress_count: 0, is_processing: done < queued.length });
      if (p.startsWith("/externalmodel/getlist")) return send(200, { models: [{ name: "Qwen VAE", filename: MVAE, save_path: "default", type: "vae", base: "Qwen-Image", url: "u" }] });
      if (p === "/manager/queue/install_model") { queued.push(JSON.parse(b)); return send(200, {}); }
      if (p === "/manager/queue/start") return send(200, {});
      return send(404, {}); }
    if (/^\/proxy\//.test(q.url)) return send(502, {});
    if (q.headers.authorization !== "Bearer rpa_UI759") return send(401, {});
    if (q.url === "/v2/pods?limit=1000") return send(200, { pods: [POD] });
    if (q.url === "/v2/pods/pod759") return send(200, POD);
    if (/^\/v2\/catalog\/templates\?source=official/.test(q.url)) return send(200, { templates: TPL, pagination: { hasNextPage: false } });
    if (/^\/v2\/catalog\/templates/.test(q.url)) return send(200, { templates: [], pagination: { hasNextPage: false } });
    send(404, {}); }); });
  try { await new Promise((ok, bad) => { rp.once("error", bad); rp.listen(8399, "127.0.0.1", ok); }); } catch { console.log("SKIP: port 8399 is busy - the 2.759.0 browser test did not run"); process.exit(0); }
  const v0 = await api("/api/remotegpu"), g0 = await api("/api/gpusplit");
  await api("/api/remotegpu/save", { runpod: { key: "rpa_UI759", port: 3000 } });
  await api("/api/remotegen/enabled", { on: true });
  await api("/api/gpusplit", { where: "local", engine: { provider: "runpod", runpod: "pods" } });
  const b = await chromium.launch();
  try {
    const p = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3Pods && window.H3PodLoad && window.SecFloat && SecFloat.windows.pods, null, { timeout: 30000 });
    await ev(() => { window.H3_POD_POLL = 300; H3Pods.show(true); }); await p.click("#pdRefresh");
    await p.waitForFunction(() => document.querySelectorAll("#pdTpl .pdCard").length === 2 && document.querySelectorAll("#pdFor option").length > 3, null, { timeout: 15000 });
    const order0 = await ev(() => [...document.querySelectorAll("#pdTpl .pdCard")].map((c) => c.dataset.tpl));
    await ev(() => { const s = document.getElementById("pdFor"), o = [...s.options].find((x) => x.textContent === "For Krea 2 Turbo"); s.value = o.value; s.dispatchEvent(new Event("change")); });
    await sleep(300);
    const order1 = await ev(() => [...document.querySelectorAll("#pdTpl .pdCard")].map((c) => c.dataset.tpl + (c.querySelector(".pdFits") ? " ✓" : "")));
    check("For Krea 2 Turbo: the template that has Krea first, marked ✓ fits; the other after it", order1.join() === "krea759a ✓,pyt759aa" && order0.join() !== order1.join(), { order0, order1 });
    await p.click('[data-pdsrc="mine"]'); await sleep(300);   // 2.760.0: the pods are under 🖥 My pods
    await p.waitForFunction(() => document.querySelector('#pdPods .pdRow[data-pod="pod759"] [data-pdmod]'), null, { timeout: 10000 });
    await p.click('#pdPods .pdRow[data-pod="pod759"] [data-pdmod]');
    await p.waitForFunction(() => document.querySelector("#pdStyPanel [data-pmgo]"), null, { timeout: 15000 });
    const pan = await ev(() => ({ how: document.querySelector("#pdStyPanel .hint").textContent, pw: !!document.querySelector("#pdStyPanel [data-pmpw]"), rows: document.querySelectorAll("#pdStyPanel [data-pmf]").length }));
    check("⬇ Models: says how files reach this pod (ComfyUI-Manager - its own list; the Jupyter password box), bitGen's download list to search",
      /ComfyUI-Manager - only the models in its own list/.test(pan.how) && pan.pw && pan.rows > 5, pan);
    await ev(() => { const s = document.querySelector("#pdStyPanel [data-pmstyle]"), o = [...s.options].find((x) => x.textContent === "qwen2_1"); s.value = o.value; s.dispatchEvent(new Event("change")); });
    await p.waitForFunction(() => /Ticked the style's \d+ file\(s\)/.test(document.querySelector("#pdStyPanel [data-pmmsg]").textContent), null, { timeout: 8000 }).catch(() => {});
    const tk = await ev(() => ({ msg: document.querySelector("#pdStyPanel [data-pmmsg]").textContent, on: [...document.querySelectorAll("#pdStyPanel [data-pmf]:checked")].map((i) => i.getAttribute("data-pmf")) }));
    MVAE = tk.on.find((n) => /vae/i.test(n)) || tk.on[0] || MVAE;
    check("…picking the style qwen2_1 ticks its files from bitGen's list (with their size)", /Ticked the style's \d+ file\(s\), [\d.]+ GB\./.test(tk.msg) && tk.on.length > 0, tk);
    await p.click("#pdStyPanel [data-pmgo]");
    await p.waitForFunction(() => /ComfyUI-Manager is downloading/.test(document.querySelector("#pdStyPanel [data-pmmsg]").textContent), null, { timeout: 10000 }).catch(() => {});
    const go = await ev(() => document.querySelector("#pdStyPanel [data-pmmsg]").textContent);
    check("…⬇ Download ticked: ComfyUI-Manager downloads the one in its list (the Qwen VAE); the rest named", /ComfyUI-Manager is downloading 1 file\(s\)\. Not in ComfyUI-Manager's list: /.test(go) && queued.length === 1 && queued[0].filename === MVAE, { go, queued, MVAE });
    done = 1;
    await p.waitForFunction(() => document.querySelector("#pdStyPanel [data-pmsty]"), null, { timeout: 8000 }).catch(() => {});
    const bars = await ev(() => [...document.querySelectorAll("#pdStyPanel [data-pmprog] .pdLoad")].map((x) => x.textContent));
    check("…a bar per file, then 🎨 Make P_ styles from the pod", bars.length === 1 && bars[0].startsWith(MVAE + " · done") && (await ev(() => !!document.querySelector("#pdStyPanel [data-pmsty]"))), bars);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e)); }
  finally {
    await b.close(); rp.close();
    await api("/api/gpusplit", { where: "local", engine: { provider: (g0.engine || {}).provider || "runpod", runpod: (g0.engine || {}).runpod || "serverless" } }).catch(() => {});
    await api("/api/remotegpu/save", { runpod: Object.assign({ key: "", pod_id: "", pod_name: "", cost_hr: 0, port: 8188 }, v0.runpod || {}) }).catch(() => {});
    await api("/api/remotegen/enabled", { on: null }).catch(() => {});
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
