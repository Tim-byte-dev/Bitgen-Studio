#!/usr/bin/env node
/* bitGen Studio — 2.763.4 browser test: THE PODS DOCKER'S FIGURES, THE SUMMARY BEFORE CREATE POD, THE PROMPT DOCKER'S STYLE,
 * A GONE POD THAT ASKS (static/podsdock.js, lib/podStats.js, lib/stylePods.js) on a running studio (H3_URL, default :8311)
 * started with H3_RUNPOD_REST_API=http://127.0.0.1:8399/v2 and H3_RUNPOD_PROXY=http://127.0.0.1:8399/proxy/{id}-{port}.
 * Tim (verbatim): "the pods docker still didn't show, the pod was created automatically, i didn't get to choose the gpu pod, show
 * all the details before i create the pod. in the pods docker show utilization, memory and disk visualizations and usage. put
 * the style in the dropdown as the selected style in the prompt docker"
 * Put back afterwards. No server / no Playwright / 8399 busy = SKIP. */
"use strict";
const path = require("path"), http = require("http");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.763.2 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b, m) => fetch(URL0 + p.replace(/^\//, ""), b || m ? { method: m || "POST", headers: { "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined } : undefined).then((r) => r.json());

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.763.4 browser test did not run"); process.exit(0); }
  const PODS = [{ id: "pod7634r", name: "Busy pod", desiredStatus: "RUNNING", status: "RUNNING", costPerHr: 0.44, gpu: { id: "NVIDIA A40", count: 1 }, ports: ["8188/http"] }];
  const created = [];
  const rp = http.createServer((q, s) => {
    let b = ""; q.on("data", (d) => { b += d; }); q.on("end", () => {
      const send = (c, j) => { s.writeHead(c, { "Content-Type": "application/json" }); s.end(JSON.stringify(j)); };
      if (q.url === "/proxy/pod7634r-8188/system_stats") return send(200, { system: { ram_total: 2e11, ram_free: 1.5e11, argv: ["/workspace/ComfyUI/main.py"] }, devices: [{ name: "cuda:0 NVIDIA A40 : cudaMallocAsync", type: "cuda", vram_total: 4.8e10, vram_free: 3e10 }] });
      if (/^\/proxy\//.test(q.url)) return send(502, {});
      if (q.headers.authorization !== "Bearer rpa_UI7634") return send(401, {});
      if (q.method === "GET" && q.url === "/v2/pods?limit=1000") return send(200, { pods: PODS });
      const one = /^\/v2\/pods\/(\w+)$/.exec(q.url); if (one && q.method === "GET") { const p = PODS.find((x) => x.id === one[1]); return p ? send(200, p) : send(404, {}); }
      if (q.method === "POST" && q.url === "/v2/pods") { const body = JSON.parse(b); created.push(body); return send(201, { id: "pod7634n", name: body.name, desiredStatus: "RUNNING", status: "RUNNING", gpu: { id: body.gpu.id, count: body.gpu.count } }); }   // made - and then gone from the list
      if (/^\/v2\/catalog\/templates/.test(q.url)) return send(200, { templates: q.url.includes("official") ? [{ id: "tplCu13u", name: "ComfyUI CUDA 13", image: "runpod/comfyui:cuda13", ports: ["8188/http", "8888/http"] }] : [], pagination: { hasNextPage: false } });
      if (/^\/v2\/catalog\/gpus/.test(q.url)) return send(200, { gpus: [{ id: "NVIDIA RTX A5000", name: "RTX A5000", memory: 24, price: { secure: 0.27, community: 0.16 }, availability: "HIGH", secure: true, community: true },
        { id: "NVIDIA A40", name: "A40", memory: 48, price: { secure: 0.44, community: 0.35 }, availability: "HIGH", secure: true, community: true }] });
      if (/^\/v2\/billing\/pods/.test(q.url)) return send(200, { records: [], metadata: {} });
      send(404, {});
    });
  });
  try { await new Promise((ok, bad) => { rp.once("error", bad); rp.listen(8399, "127.0.0.1", ok); }); } catch { console.log("SKIP: port 8399 is busy - the 2.763.4 browser test did not run"); process.exit(0); }
  const g0 = await api("/api/gpusplit"), links0 = (await api("/api/stylepods")).links || {};
  await api("/api/remotegpu/use", { mode: "local" });
  await api("/api/remotegpu/save", { runpod: { key: "rpa_UI7634", pod_id: "", port: 8188 }, serverless: { endpoint: "" } });
  await api("/api/remotegen/enabled", { on: true });
  await api("/api/gpusplit", { where: "remote", engine: { provider: "runpod", runpod: "pods" } });
  const sts = ((await api("/api/styles?kind=image")).styles || []).filter((x) => x.engine === "comfy" && (!x.runs_on || x.runs_on === "local") && !x.chain);
  const st = sts[1] || sts[0];
  const jobs = [];
  // 2.764.0: a pod made for a style is kept as a preset (runpod/pods/presets) - the ones this test makes go afterwards
  const PDIR = require("path").join(__dirname, "..", "runpod", "pods", "presets"), pre0 = (() => { try { return require("fs").readdirSync(PDIR); } catch { return []; } })();
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    // 2.764.0: Generate with a style that has no pod opens the box of your pods + presets (static/podpick.js, tested in
    // test-ui764-ui.js) - here its Create pod… is pressed, as a person would, so the PODS docker's form opens as before
    await p.addInitScript(() => { setInterval(() => { const b = document.querySelector("#ppkDlg[open] [data-ppkcreate]"); if (b && !b.disabled) b.click(); }, 300); });
    await p.addInitScript(() => { window.H3_POD_STATS_POLL = 1000; });
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3Pods && window.SecFloat && SecFloat.windows.pods && document.getElementById("styleSel"), null, { timeout: 30000 });
    // the prompt docker: 🖼 Image + a style
    await p.waitForFunction((sid) => [...document.getElementById("styleSel").options].some((o) => o.value === sid), st.id, { timeout: 20000 }).catch(() => {});
    await ev((sid) => { const g = document.getElementById("genModeSel"); g.value = "image"; if (typeof g.onchange === "function") g.onchange(); g.dispatchEvent(new Event("change", { bubbles: true }));
      const s = document.getElementById("styleSel"); s.value = sid; s.dispatchEvent(new Event("change", { bubbles: true })); }, st.id);
    await sleep(500);
    check("(the prompt docker has the style picked)", (await ev(() => document.getElementById("styleSel").value)) === st.id);
    await ev(() => H3Pods.show(true)); await sleep(800);
    await p.click('[data-pdsrc="mine"]');
    await p.waitForFunction(() => { const h = document.querySelector('[data-pdstath="pod7634r"] .pdBar'); return h && /VRAM/.test(h.textContent); }, null, { timeout: 20000 }).catch(() => {});
    const head = await ev(() => [...document.querySelectorAll('[data-pdstath="pod7634r"] .pdBar')].map((x) => x.textContent + " " + x.querySelector("i").style.width));
    check("My pods: a running pod shows its GPU memory as a bar beside its name (18.0 of 48.0 GB = 38%)", head.some((t) => /^VRAM 18\.0\/48\.0 GB 38%$/.test(t)), head);
    await p.click('#pdPods .pdRow[data-pod="pod7634r"] .pdHead'); await sleep(1500);
    const full = await ev(() => [...document.querySelectorAll('[data-pdstats="pod7634r"] .pdBar')].map((x) => x.textContent));
    check("…opened: its figures as bars - VRAM and RAM (50.0 of 200.0 GB) - updated every few seconds", full.some((t) => /^VRAM 18\.0\/48\.0 GB$/.test(t)) && full.some((t) => /^RAM 50\.0\/200\.0 GB$/.test(t)), full);
    // the prompt docker's style in the docker's dropdowns + the summary
    await p.click('[data-pdsrc="all"]');
    await p.waitForFunction(() => document.querySelector('#pdTpl .pdCard[data-tpl="tplCu13u"] [data-pdcreate]'), null, { timeout: 15000 }).catch(() => {});
    const forV = await ev(() => document.getElementById("pdFor").value);
    check("the docker's For dropdown starts on the style picked in the prompt docker", forV === st.id, { forV, want: st.id });
    await ev(() => document.querySelector('#pdTpl .pdCard[data-tpl="tplCu13u"] [data-pdcreate]').click());
    await p.waitForFunction(() => { const s = document.getElementById("pdSum"); return s && /GPU/.test(s.textContent) && /A5000|A40/.test(s.textContent); }, null, { timeout: 15000 }).catch(() => {});
    const sum = await ev(() => ({ style: (document.getElementById("pdStyle") || {}).value, rows: [...document.querySelectorAll("#pdSum .k")].map((k) => k.textContent + ": " + k.nextElementSibling.textContent) }));
    check("Create pod… : the form's Style is the prompt docker's; everything the pod will be is listed before Create pod (template + image, GPU, price, cloud, both disks, a CUDA 13 host, ports + Jupyter, the style, the custom nodes)",
      sum.style === st.id && ["Template", "GPU", "Price", "Cloud", "Container disk", "/workspace", "Host", "Ports", "Style", "Then"].every((k) => sum.rows.some((r) => r.indexOf(k + ":") === 0))
      && sum.rows.some((r) => /^Template: ComfyUI CUDA 13 \(runpod\/comfyui:cuda13\)$/.test(r)) && sum.rows.some((r) => /^Host: CUDA 13 or newer only$/.test(r)) && sum.rows.some((r) => r.indexOf("Style: " + st.name) === 0) && sum.rows.some((r) => /^Then: this computer's custom nodes/.test(r)), sum);
    await ev(() => { const g = document.getElementById("pdGpu"); g.value = "NVIDIA A40"; g.dispatchEvent(new Event("change")); const c = document.getElementById("pdCount"); c.value = "2"; c.dispatchEvent(new Event("change")); });
    await sleep(200);
    const sum2 = await ev(() => [...document.querySelectorAll("#pdSum .k")].map((k) => k.textContent + ": " + k.nextElementSibling.textContent));
    check("…the summary follows the form: 2 × A40 = 96 GB in all, twice the price", sum2.some((r) => /^GPU: 2 × A40 · 48 GB each \(96 GB in all\)$/.test(r)) && sum2.some((r) => /^Price: \$0\.88\/h/.test(r)), sum2);
    await ev(() => document.getElementById("pdGo").click());
    for (let i = 0; i < 30 && !created.length; i++) await sleep(300);
    check("Create pod: made as shown (A40 × 2, the CUDA 13 template); the style linked to it", created[0] && created[0].gpu.id === "NVIDIA A40" && created[0].gpu.count === 2 && created[0].templateId === "tplCu13u" && (await api("/api/stylepods")).links[st.id] === "pod7634n", created[0]);
    // the pod is gone (it never shows in the list) -> a render of the style asks, filled in the same way - nothing made by itself
    const n0 = created.length;
    await ev(() => { const c = document.getElementById("pdClose"); if (c) c.click(); });
    const j = await api("/api/genimage", { prompt: "a house", style_id: st.id }); jobs.push(j.id || j.job_id);
    await p.waitForFunction(() => { const a = document.getElementById("pdAsk"); return a && !a.hidden && /is gone on RunPod/.test(a.textContent) && document.getElementById("pdGpu") && document.getElementById("pdGpu").value; }, null, { timeout: 40000 }).catch(() => {});
    const gone = await ev(() => ({ ask: (document.getElementById("pdAsk") || {}).textContent || "", gpu: (document.getElementById("pdGpu") || {}).value, count: (document.getElementById("pdCount") || {}).value, sum: (document.getElementById("pdSum") || {}).textContent || "" }));
    check("its pod gone on RunPod: NOT made again by itself - the PODS docker opens, says so, and the new pod is filled in the same way (A40 × 2) for you to check and create",
      created.length === n0 && /The pod .* is gone on RunPod/.test(gone.ask) && gone.gpu === "NVIDIA A40" && gone.count === "2" && /2 × A40/.test(gone.sum), { gone, made: created.length - n0 });
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close();
    try { for (const f of require("fs").readdirSync(PDIR)) if (!pre0.includes(f)) require("fs").unlinkSync(require("path").join(PDIR, f)); } catch { /* none made */ }
    for (const j of jobs) if (j) await api("/api/jobs/" + j + "/cancel", {}).catch(() => {});
    rp.close();
    try { const now = (await api("/api/stylepods")).links || {}; for (const s of Object.keys(now)) if (!(s in links0)) await api("/api/stylepods/link", { style_id: s, pod_id: "" }); } catch { /* fine */ }
    await api("/api/pods/pod7634n/setup", { kinds: [], styles: [], pod_name: "x", port: 8188 }).catch(() => {});
    await api("/api/gpusplit", { where: "local", engine: { provider: (g0.engine || {}).provider || "runpod", runpod: (g0.engine || {}).runpod || "serverless" }, llm: !!g0.llm, vlm: !!g0.vlm, image: !!g0.image, video: !!g0.video }).catch(() => {});
    await api("/api/remotegpu/use", { mode: "local" }).catch(() => {});
    await api("/api/remotegpu/save", { runpod: { key: "", pod_id: "", port: 8188 } }).catch(() => {});
    await api("/api/remotegen/enabled", { on: null }).catch(() => {});
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
