#!/usr/bin/env node
/* bitGen Studio — 2.763.0 browser test: "NO POD RENDERS THIS STYLE YET" (static/stylepodask.js, lib/stylePods.js,
 * routes/stylePods.js) on a running studio (H3_URL, default :8311) started with H3_RUNPOD_REST_API=http://127.0.0.1:8399/v2 and
 * H3_RUNPOD_PROXY=http://127.0.0.1:8399/proxy/{id}-{port} (this test's stand-in RunPod on 8399).
 * Tim (verbatim): "if we are in pod mode and a style is selected, check if that style has a pod assigned to it and create the
 * pod with the comfy cuda 13 template" (agreed: ask first - the GPU, its $/h, the disk; Create or Use my running pod)
 *   - Basic Settings ▸ GPU on RunPod ▸ Pods (Remote); an image render of a style with no pod waits, the box opens by itself:
 *     the CUDA 13 template, the GPUs with ⭐ bitGen's pick and $/h, the disk, your pods; Esc does not close it
 *   - Create pod: POST /v2/pods with the CUDA 13 template, the GPU picked, gpu.minCudaVersion 13.0; the style linked to it
 *   - another style: Use this pod (a stopped one) -> linked; Cancel on a third -> the job goes on without a pod
 * Put back afterwards. No server / no Playwright / 8399 busy = SKIP. */
"use strict";
const path = require("path"), http = require("http");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.763.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b, m) => fetch(URL0 + p.replace(/^\//, ""), b || m ? { method: m || "POST", headers: { "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined } : undefined).then((r) => r.json());

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.763.0 browser test did not run"); process.exit(0); }
  const PODS = [{ id: "pod763u", name: "Stopped pod", desiredStatus: "EXITED", status: "EXITED", costPerHr: 0.44, gpu: { id: "NVIDIA GeForce RTX 4090", count: 1 }, ports: ["8188/http"] }];
  const created = [];
  const rp = http.createServer((q, s) => {
    let b = ""; q.on("data", (d) => { b += d; }); q.on("end", () => {
      const send = (c, j) => { s.writeHead(c, { "Content-Type": "application/json" }); s.end(JSON.stringify(j)); };
      if (/^\/proxy\//.test(q.url)) return send(502, {});   // the pods never load here - the jobs wait (cancelled at the end)
      if (q.headers.authorization !== "Bearer rpa_UI763") return send(401, {});
      if (q.method === "GET" && q.url === "/v2/pods?limit=1000") return send(200, { pods: PODS });
      const one = /^\/v2\/pods\/(\w+)$/.exec(q.url); if (one && q.method === "GET") { const p = PODS.find((x) => x.id === one[1]); return p ? send(200, p) : send(404, {}); }
      if (q.method === "POST" && q.url === "/v2/pods") { const body = JSON.parse(b); created.push(body); const p = { id: "pod763new", name: body.name, desiredStatus: "RUNNING", status: "RUNNING", costPerHr: 0.33, gpu: { id: body.gpu.id, count: 1 } }; PODS.push(p); return send(201, p); }
      const act = /^\/v2\/pods\/(\w+)\/action$/.exec(q.url); if (act && q.method === "POST") { const p = PODS.find((x) => x.id === act[1]); if (p) p.desiredStatus = p.status = "RUNNING"; return send(200, p || {}); }
      if (/^\/v2\/catalog\/templates/.test(q.url)) return send(200, { templates: q.url.includes("official") ? [{ id: "tplComfyU", name: "ComfyUI", ports: ["8188/http"] }, { id: "tplCu13u", name: "ComfyUI CUDA 13", ports: ["8188/http", "8888/http"] }] : [], pagination: { hasNextPage: false } });
      if (/^\/v2\/catalog\/gpus/.test(q.url)) return send(200, { gpus: [{ id: "NVIDIA RTX A4000", name: "RTX A4000", memory: 16, price: { secure: 0.25, community: 0.17 }, availability: "HIGH", secure: true, community: true },
        { id: "NVIDIA GeForce RTX 4090", name: "RTX 4090", memory: 24, price: { secure: 0.69, community: 0.34 }, availability: "HIGH", secure: true, community: true },
        { id: "NVIDIA RTX A6000", name: "RTX A6000", memory: 48, price: { secure: 0.49, community: 0.33 }, availability: "MEDIUM", secure: true, community: true },
        { id: "NVIDIA H100", name: "H100", memory: 80, price: { secure: 2.99, community: 1.99 }, availability: "NONE", secure: true, community: true }] });
      if (/^\/v2\/billing\/pods/.test(q.url)) return send(200, { records: [], metadata: {} });
      send(404, {});
    });
  });
  try { await new Promise((ok, bad) => { rp.once("error", bad); rp.listen(8399, "127.0.0.1", ok); }); } catch { console.log("SKIP: port 8399 is busy - the 2.763.0 browser test did not run"); process.exit(0); }
  const g0 = await api("/api/gpusplit"), c0 = await api("/api/currency").catch(() => ({})), links0 = (await api("/api/stylepods")).links || {};
  await api("/api/currency", { code: "USD" }).catch(() => {});
  await api("/api/remotegpu/use", { mode: "local" });
  await api("/api/remotegpu/save", { runpod: { key: "rpa_UI763", pod_id: "", port: 8188 }, serverless: { endpoint: "" } });
  await api("/api/remotegen/enabled", { on: true });
  await api("/api/gpusplit", { where: "remote", engine: { provider: "runpod", runpod: "pods" } });
  const imgs = ((await api("/api/styles?kind=image")).styles || []).filter((x) => x.engine === "comfy" && x.runs_on !== "remote" && x.runs_on !== "api" && x.runs_on !== "pod" && !x.chain);
  const jobs = [];
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3StylePodAsk && typeof refreshJobs === "function", null, { timeout: 30000 });
    check("the page has the question box's code (H3StylePodAsk) and at least three image styles to try", imgs.length >= 3, imgs.length);
    // 1. a style with no pod -> asked
    const j1 = await api("/api/genimage", { prompt: "a red fox", style_id: imgs[0].id }); jobs.push(j1.id || j1.job_id);
    await p.waitForFunction(() => { const d = document.getElementById("spaDlg"); return d && d.open && d.querySelector("#spaGpu"); }, null, { timeout: 30000 }).catch(() => {});
    const box = await ev(() => { const d = document.getElementById("spaDlg"); if (!d) return null;
      return { open: d.open, title: d.querySelector("#spaTitle").textContent, tpl: (d.querySelector("fieldset .hint") || {}).textContent || "", gpus: [...d.querySelectorAll("#spaGpu option")].map((o) => o.textContent + (o.disabled ? " [off]" : "") + (o.selected ? " [x]" : "")),
        vol: (d.querySelector("#spaVol") || {}).value, pods: [...d.querySelectorAll("#spaPod option")].map((o) => o.textContent), cost: (d.querySelector("#spaCost") || {}).textContent || "", create: !(d.querySelector("#spaCreate") || {}).disabled }; });
    check("a render in pod mode whose style has no pod: the box opens by itself - 'A pod for <style>', RunPod's ComfyUI CUDA 13 template, the disk (50 GB at least)",
      box && box.open && box.title === "A pod for " + imgs[0].name && /ComfyUI CUDA 13/.test(box.tpl) && +box.vol >= 50 && box.create, box);
    check("…the GPUs with memory and $/h - ⭐ bitGen's pick (the cheapest with enough memory) picked, one with none free greyed; your stopped pod offered; the cost line",
      box && box.gpus.some((g) => /^⭐ .* · \d+ GB · \$\d\.\d\d\/h \[x\]$/.test(g)) && box.gpus.some((g) => /H100.*\(none free now\) \[off\]/.test(g)) && box.pods.some((t) => /Stopped pod/.test(t) && /exited/.test(t)) && /About \$\d\.\d\d\/h while it runs/.test(box.cost), box);
    await p.keyboard.press("Escape"); await sleep(300);
    check("…Esc does not close it (Cancel says what happens to the render)", await ev(() => document.getElementById("spaDlg").open));
    const q1 = await api("/api/jobs");
    check("…the job waits in the queue with the question (job.pod_ask) and a [pod] line", (() => { const j = q1.find((x) => x.id === jobs[0]); return j && j.status === "queued" && /^pa\d+$/.test(j.pod_ask || ""); })(), q1.map((x) => [x.id, x.status, x.pod_ask]));
    await ev(() => { const s = document.getElementById("spaGpu"); s.value = "NVIDIA RTX A6000"; s.dispatchEvent(new Event("change")); });
    await p.click("#spaCreate");
    await p.waitForFunction(() => !document.getElementById("spaDlg").open, null, { timeout: 15000 }).catch(() => {});
    const c = created[0] || {};
    check("Create pod: RunPod is asked for a pod from the CUDA 13 template on the GPU picked, on a CUDA 13 host, with the disk; the box closes",
      c.templateId === "tplCu13u" && c.gpu && c.gpu.id === "NVIDIA RTX A6000" && c.gpu.minCudaVersion === "13.0" && c.mounts && c.mounts.persistent.size >= 50 && !(await ev(() => document.getElementById("spaDlg").open)), c);
    const l1 = (await api("/api/stylepods")).links;
    check("…the style is linked to the new pod (next time it goes there by itself)", l1[imgs[0].id] === "pod763new", l1);
    // 2. another style -> Use my stopped pod
    const j2 = await api("/api/genimage", { prompt: "a blue fox", style_id: imgs[1].id }); jobs.push(j2.id || j2.job_id);
    await api("/api/jobs/" + jobs[0] + "/cancel", {}).catch(() => {});
    await p.waitForFunction((n) => { const d = document.getElementById("spaDlg"); return d && d.open && d.querySelector("#spaTitle").textContent === "A pod for " + n && d.querySelector("#spaUse"); }, imgs[1].name, { timeout: 30000 }).catch(() => {});
    await p.click("#spaUse").catch(() => {});
    await p.waitForFunction(() => !document.getElementById("spaDlg").open, null, { timeout: 15000 }).catch(() => {});
    const l2 = (await api("/api/stylepods")).links;
    check("another style: Use this pod (your stopped one) - linked to it", l2[imgs[1].id] === "pod763u", l2);
    // 3. a third -> Cancel
    await api("/api/jobs/" + jobs[1] + "/cancel", {}).catch(() => {});
    const j3 = await api("/api/genimage", { prompt: "a green fox", style_id: imgs[2].id }); jobs.push(j3.id || j3.job_id);
    await p.waitForFunction((n) => { const d = document.getElementById("spaDlg"); return d && d.open && d.querySelector("#spaTitle").textContent === "A pod for " + n && d.querySelector("#spaCancel"); }, imgs[2].name, { timeout: 30000 }).catch(() => {});
    await p.click("#spaCancel").catch(() => {});
    let j3s = null;
    for (let i = 0; i < 40; i++) { await sleep(500); const all = await api("/api/jobs"); j3s = all.find((x) => x.id === jobs[2]); if (!j3s || j3s.status !== "queued") break; }
    const lg = await api("/api/jobs/" + jobs[2] + "?log_from=0").catch(() => ({}));
    check("a third style: Cancel - the render stops waiting (said in its log), no link made", (!j3s || j3s.status !== "queued") && !(await api("/api/stylepods")).links[imgs[2].id]
      && (lg.log || []).some((l) => /you cancelled/.test(l)), { j3s: j3s && j3s.status, log: (lg.log || []).filter((l) => /\[pod\]|\[gpu\]/.test(l)) });
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close();
    for (const j of jobs) if (j) await api("/api/jobs/" + j + "/cancel", {}).catch(() => {});
    rp.close();
    try { const now = (await api("/api/stylepods")).links || {}; for (const s of Object.keys(now)) if (!(s in links0)) await api("/api/stylepods/link", { style_id: s, pod_id: "" }); } catch { /* fine */ }
    await api("/api/currency", { code: (c0 && c0.code) || "USD" }).catch(() => {});
    await api("/api/gpusplit", { where: "local", engine: { provider: (g0.engine || {}).provider || "runpod", runpod: (g0.engine || {}).runpod || "serverless" }, llm: !!g0.llm, vlm: !!g0.vlm, image: !!g0.image, video: !!g0.video }).catch(() => {});
    await api("/api/remotegpu/use", { mode: "local" }).catch(() => {});
    await api("/api/remotegpu/save", { runpod: { key: "", pod_id: "", port: 8188 } }).catch(() => {});
    await api("/api/remotegen/enabled", { on: null }).catch(() => {});
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
