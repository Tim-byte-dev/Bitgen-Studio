#!/usr/bin/env node
/* bitGen Studio — 2.756.0 in a REAL browser against a running studio (H3_URL / H3_PORT - default 8311) started with
 * H3_RUNPOD_REST_API=http://127.0.0.1:8399/v2 and H3_RUNPOD_PROXY=http://127.0.0.1:8399/proxy/{id}-{port} (this test's
 * stand-in RunPod on 8399).
 * Tim (verbatim): "if user selects has remote checked and remote selected in basic settings show the remote servers, runpod
 * and openrouter, if user selects runpod show serverless or pods radio group" + "can we get the list of public pods from
 * runpod in a docker called PODS(like model manager), button and docker only visible when runpod pods are selected as the
 * generation engine? the user can choose/create a pod"
 *   - Basic Settings ▸ GPU: Remote servers RunPod / OpenRouter, RunPod: Serverless / Pods (Pods unlocks Remote);
 *   - the 🖥 PODS button only with RunPod ▸ Pods; the docker: Official / Verified / Community templates, ComfyUI only, search;
 *   - 2.756.1 (Tim: "list all them templates filter them by search, have a card for each of them like comfyui does. now it
 *     says 0 of 100 templates"): every template at once (All + a count per source), a card each, search word by word,
 *     the kind filter, ComfyUI only off by default; Create pod… opens the form above the cards;
 *   - Create pod…: GPUs with live prices (none free = disabled), the hourly estimate, POST /pods (template, GPU, cloud, disk,
 *     /workspace); the new pod 🅱 in My pods, loading pod… -> pod loaded; ⏹ Stop; Terminate asks first, then deletes it;
 *   - RunPod ▸ Serverless: the button and the docker go.
 * Put back afterwards. No server / no Playwright / 8399 busy = SKIP. */
"use strict";
const path = require("path"), http = require("http");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.756.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b) => fetch(URL0 + p.replace(/^\//, ""), b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined).then((r) => r.json());

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.756.0 browser test did not run"); process.exit(0); }
  const seen = []; const PODS = {}; let polls = 0;
  const TPL = { official: [{ id: "cmfy756a", name: "ComfyUI - CUDA 12.8", image: "runpod/comfyui:latest", disk: 40, ports: ["8188/http", "22/tcp"], category: "NVIDIA", public: true },
    { id: "ptch756a", name: "PyTorch 2.8", image: "runpod/pytorch:2.8", disk: 50, ports: ["8888/http"], category: "NVIDIA", public: true },
    { id: "srvl756a", name: "Serverless worker", image: "x/y", serverless: true, ports: [] }],
    verified: [{ id: "rocm756a", name: "ROCm PyTorch", image: "rocm/pytorch:6.4", disk: 30, ports: ["8888/http"], category: "AMD", public: true },
      { id: "cmfy756a", name: "ComfyUI - CUDA 12.8 (again)", image: "runpod/comfyui:latest", disk: 40, ports: ["8188/http"], category: "NVIDIA" }],
    community: [{ id: "h3com756", name: "MiniMax H3 (community)", image: "someone/h3-comfy:1", disk: 80, ports: ["3000/http"], mounts: { persistent: { size: 120, path: "/workspace" } }, category: "NVIDIA" }] };
  const GPUS = [{ id: "NVIDIA GeForce RTX 4090", name: "RTX 4090", memory: 24, secure: true, community: true, price: { secure: 0.69, community: 0.34 }, availability: "HIGH", maxCount: { secure: 8, community: 4 } },
    { id: "NVIDIA RTX A4000", name: "RTX A4000", memory: 16, secure: true, community: true, price: { secure: 0.25, community: 0.17 }, availability: "MEDIUM", maxCount: { secure: 4, community: 4 } },
    { id: "NVIDIA H100 80GB HBM3", name: "H100 80GB", memory: 80, secure: true, community: false, price: { secure: 2.99, community: null }, availability: "NONE", maxCount: { secure: 8, community: 0 } }];
  const view = (p) => ({ id: p.id, name: p.name, status: p.status, gpu: { id: p.gpu.id, count: p.gpu.count }, cost: p.cost, ports: p.ports, runtime: p.status === "RUNNING" ? { uptime: 30 } : null });
  const rp = http.createServer((q, s) => {
    let b = ""; q.on("data", (d) => { b += d; }); q.on("end", () => {
      const send = (code, j) => { s.writeHead(code, { "Content-Type": "application/json" }); s.end(j == null ? "" : JSON.stringify(j)); };
      const m = /^\/proxy\/(\w+)-(\d+)\/system_stats$/.exec(q.url);
      if (m) return PODS[m[1]] && PODS[m[1]].status === "RUNNING" && m[2] === "3000" ? send(200, { system: { comfyui_version: "0.3.60" }, devices: [] }) : send(502, {});
      seen.push(q.method + " " + q.url + (b ? " " + b : ""));
      if (q.headers.authorization !== "Bearer rpa_UI756") return send(401, {});
      let t = /^\/v2\/catalog\/templates\?source=(\w+)$/.exec(q.url);
      if (t) return send(200, { templates: TPL[t[1]] || [], pagination: { nextCursor: null, hasNextPage: false } });
      if (/^\/v2\/catalog\/gpus\?include=AVAILABILITY&product=POD&cloud=(SECURE|COMMUNITY)$/.test(q.url)) return send(200, { gpus: GPUS });
      if (q.method === "POST" && q.url === "/v2/pods") { const j = JSON.parse(b); const id = "new756"; PODS[id] = { id, name: j.name, status: "PROVISIONING", gpu: j.gpu, cost: 0.69 * j.gpu.count, ports: ["3000/http"], body: j }; return send(201, view(PODS[id])); }
      if (q.method === "GET" && q.url === "/v2/pods?limit=1000") return send(200, { pods: Object.values(PODS).map(view), pagination: { hasNextPage: false } });
      const g = /^\/v2\/pods\/(\w+)$/.exec(q.url);
      if (g && PODS[g[1]]) { const p = PODS[g[1]]; if (p.status === "PROVISIONING" && ++polls > 1) p.status = "RUNNING"; return send(200, view(p)); }
      const a = /^\/v2\/pods\/(\w+)\/action$/.exec(q.url);
      if (a && PODS[a[1]]) { const act = JSON.parse(b).action, p = PODS[a[1]];
        if (act === "terminate") { delete PODS[a[1]]; return send(204, null); }
        p.status = act === "stop" ? "EXITED" : act === "start" ? "RUNNING" : p.status; return send(200, view(p)); }
      send(404, {});
    });
  });
  try { await new Promise((ok, bad) => { rp.once("error", bad); rp.listen(8399, "127.0.0.1", ok); }); } catch { console.log("SKIP: port 8399 is busy - the 2.756.0 browser test did not run"); process.exit(0); }
  const v0 = await api("/api/remotegpu"), g0 = await api("/api/gpusplit");
  await api("/api/remotegpu/use", { mode: "local" });
  await api("/api/remotegpu/save", { runpod: { key: "rpa_UI756" }, serverless: { endpoint: "" } });
  await api("/api/remotegen/enabled", { on: true });
  await api("/api/gpusplit", { where: "local", engine: { provider: "runpod", runpod: "serverless" } });
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 } });
    await ctx.route(/runpod\.io/, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>RunPod</title>" }));
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3Pods && H3Pods.state().g && document.getElementById("gpuPods") && document.getElementById("gpuEngine") && window.SecFloat && SecFloat.windows.pods, null, { timeout: 30000 });
    await ev(() => { window.H3_POD_POLL = 400; if (SecFloat.windows.basic) SecFloat.show("basic", true); toggleSec("gpu", false); }); await sleep(500);
    const vis = (sel) => ev((s) => { const e = document.querySelector(s); return !!e && e.offsetWidth > 0 && getComputedStyle(e).display !== "none"; }, sel);
    // 2.764.1: on Local the remote options are hidden - picking Remote (nothing set up yet) shows them and waits
    const hid0 = !(await vis("#gpuEngine"));
    await p.check('input[name="gpuWhere"][value="remote"]'); await sleep(600);
    const e0 = await ev(() => ({ prov: [...document.querySelectorAll('input[name="gpuProv"]')].map((i) => i.value + (i.checked ? "*" : "")), rp: [...document.querySelectorAll('input[name="gpuRunpod"]')].map((i) => i.value + (i.checked ? "*" : "")),
      remote: H3GpuSplit.state().pick === "remote" }));
    check("Basic Settings ▸ GPU (nothing remote set up yet): Local hides the remote options; Remote picked = it waits and shows Remote servers RunPod (picked) / OpenRouter, RunPod: Serverless (picked) / Pods; no 🖥 PODS button",
      hid0 && (await vis("#gpuEngine")) && e0.prov.join() === "runpod*,openrouter" && e0.rp.join() === "serverless*,pods" && e0.remote && (await api("/api/gpusplit")).where === "local" && !(await vis("#gpuPods")), e0);
    await p.check('input[name="gpuProv"][value="openrouter"]'); await sleep(700);
    check("…OpenRouter: the RunPod row hides (the LLM goes there)", !(await vis("#gpuRunpod")) && (await api("/api/gpusplit")).engine.provider === "openrouter");
    await p.check('input[name="gpuProv"][value="runpod"]'); await sleep(600);
    await p.check('input[name="gpuRunpod"][value="pods"]'); await sleep(900);
    check("RunPod ▸ Pods: the 🖥 PODS button shows and Remote unlocks (a pod comes from the PODS docker)", (await vis("#gpuPods")) && !(await ev(() => document.querySelector('input[name="gpuWhere"][value="remote"]').disabled)) && (await api("/api/gpusplit")).engine.pods === true);
    await p.check('input[name="gpuWhere"][value="remote"]'); await sleep(700);
    check("…Remote picked with no pod yet: allowed (renders stay here until a pod is used)", (await api("/api/gpusplit")).where === "remote");
    await p.click("#gpuPods"); await sleep(600);
    await p.click("#pdRefresh");   // the server keeps RunPod's templates 10 minutes - this test's stand-in, not an earlier one's
    await p.waitForFunction(() => document.querySelectorAll("#pdTpl .pdCard").length > 0 && /^\d+ of \d+ templates/.test(document.getElementById("pdMsg").textContent), null, { timeout: 10000 }).catch(() => {});
    const tpl = () => ev(() => [...document.querySelectorAll("#pdTpl .pdCard")].map((r) => r.querySelector(".pdName").textContent));
    const msg = () => ev(() => document.getElementById("pdMsg").textContent);
    const tabs = () => ev(() => [...document.querySelectorAll("[data-pdsrc]")].map((b) => b.dataset.pdsrc + (b.classList.contains("on") ? "*" : "") + "=" + b.querySelector(".n").textContent).join(" "));
    const t1 = await tpl();
    check("2.756.1: the PODS docker opens on ALL the templates (Official + Verified + Community, each once, never a serverless one), ComfyUI ones first; a count per source; ComfyUI only OFF",
      (await ev(() => SecFloat.state("pods").shown)) && t1.join() === "ComfyUI - CUDA 12.8,MiniMax H3 (community),PyTorch 2.8,ROCm PyTorch" && /^4 of 4 templates$/.test(await msg())
      && /^all\*=4 official=2 verified=1 community=1 star=\d+ mine=\d+( presets=\d+)?$/.test(await tabs()) && !(await ev(() => document.getElementById("pdComfy").checked)) && seen.filter((x) => /catalog\/templates/.test(x)).length >= 3, { t1, m: await msg(), tabs: await tabs() });
    const c0 = await ev(() => { const c = document.querySelector('#pdTpl .pdCard[data-tpl="h3com756"]'); return { glyph: c.querySelector(".pdGlyph").textContent, cat: c.querySelector(".pdCat").textContent, cfy: !!c.querySelector(".pdCfy"),
      img: c.querySelector(".pdImg").textContent, chips: [...c.querySelectorAll(".pdChips span")].map((x) => x.textContent), href: c.querySelector("a.pdLink").href, h: c.querySelector(".pdArt").style.getPropertyValue("--h"),
      w: c.getBoundingClientRect().width, cols: getComputedStyle(document.getElementById("pdTpl")).gridTemplateColumns.split(" ").length }; });
    check("…a card each, like ComfyUI's: a coloured tile with its initials, NVIDIA, the ComfyUI badge; name, image, Community, 80 GB disk, 120 GB /workspace, 3000/http; Create pod… + ↗ its page; several cards a row",
      c0.glyph === "MH" && c0.cat === "NVIDIA" && c0.cfy && c0.img === "someone/h3-comfy:1" && c0.chips.join("|") === "Community|80 GB disk|120 GB /workspace|3000/http"
      && c0.href === "https://www.runpod.io/console/explore/h3com756" && c0.h !== "" && c0.cols >= 2 && c0.w > 150, c0);
    await p.fill("#pdQ", "pytorch"); await sleep(400);
    check("…search as you type: PyTorch and ROCm PyTorch; the counts follow", (await tpl()).join() === "PyTorch 2.8,ROCm PyTorch" && (await tabs()).startsWith("all*=2 official=1 verified=1 community=0 ") && /^2 of 4 templates$/.test(await msg()), { t: await tpl(), tabs: await tabs() });
    await p.fill("#pdQ", "pytorch rocm"); await sleep(400);
    check("…every word must match (pytorch rocm -> ROCm PyTorch)", (await tpl()).join() === "ROCm PyTorch", await tpl());
    await p.fill("#pdQ", "3000"); await sleep(400);
    check("…a port finds it too (3000 -> the MiniMax H3 one)", (await tpl()).join() === "MiniMax H3 (community)", await tpl());
    await p.fill("#pdQ", "nothing-like-this"); await sleep(400);
    check("…nothing matches: says what to try", (await tpl()).length === 0 && /No template matches/.test(await ev(() => document.getElementById("pdTpl").textContent)));
    await p.fill("#pdQ", ""); await p.selectOption("#pdKind", "AMD"); await sleep(300);
    check("…the kind filter: AMD -> ROCm PyTorch", (await tpl()).join() === "ROCm PyTorch", await tpl());
    await p.selectOption("#pdKind", ""); await p.check("#pdComfy"); await sleep(300);
    check("…ComfyUI only: the two ComfyUI ones", (await tpl()).join() === "ComfyUI - CUDA 12.8,MiniMax H3 (community)", await tpl());
    await p.click('[data-pdsrc="community"]'); await sleep(300);
    check("…Community: the MiniMax H3 template (ComfyUI on port 3000)", (await tpl()).join() === "MiniMax H3 (community)" && (await tabs()).startsWith("all=2 official=1 verified=0 community*=1"), { t: await tpl(), tabs: await tabs() });
    await p.click('[data-pdcreate="h3com756"]');
    await p.waitForFunction(() => document.querySelectorAll("#pdGpu option").length > 2, null, { timeout: 8000 }).catch(() => {});
    // 2.760.0 (Tim: "when creating a pod hide all the templates"): the form alone - the cards and their filters hidden
    check("…Create pod… opens the form ALONE (2.760.0: the template cards, the search and the filters hidden; the tabs stay)", await ev(() => { const c = document.getElementById("pdCreate"), f = document.getElementById("pdForm"), seen = (id) => { const e = document.getElementById(id); return !!e && e.offsetParent !== null; };
      return !!f && c.contains(f) && seen("pdForm") && /Create a pod from MiniMax H3 \(community\)/.test(c.textContent) && document.querySelector('.pdCard[data-tpl="h3com756"]').classList.contains("sel")
        && !seen("pdTpl") && !seen("pdQ") && !seen("pdKind") && !seen("pdFor") && !!document.querySelector('[data-pdsrc="mine"]').offsetParent; }));
    check("…the form stays open while the templates are refreshed", await ev(() => { H3Pods.load(); return true; }) && await sleep(600).then(() => ev(() => !!document.getElementById("pdForm") && document.querySelectorAll("#pdGpu option").length > 2)));
    const f = await ev(() => ({ opts: [...document.querySelectorAll("#pdGpu option")].map((o) => o.textContent + (o.disabled ? " [x]" : "")), sel: document.getElementById("pdGpu").value, disk: document.getElementById("pdDisk").value, price: document.getElementById("pdPrice").textContent, name: document.getElementById("pdName").value }));
    check("Create pod…: the GPUs, offered ones first, cheapest first, with memory, $/h (Secure) and availability; none free = disabled; picks a 20 GB+ card; the template's disk; the hourly estimate",
      f.opts[0] === "RTX A4000 · 16 GB · $0.25/h · medium" && f.opts[1] === "RTX 4090 · 24 GB · $0.69/h · high" && /^H100 80GB · 80 GB · \$2\.99\/h · none free \[x\]$/.test(f.opts[2]) && f.sel === "NVIDIA GeForce RTX 4090"
      && f.disk === "80" && /About \$0\.69 an hour while it runs/.test(f.price) && f.name === "MiniMax H3 (community)", f);
    await p.check('input[name="pdCloud"][value="COMMUNITY"]'); await sleep(900);
    check("…Community cloud: its prices", /RTX 4090 · 24 GB · \$0\.34\/h/.test((await ev(() => [...document.querySelectorAll("#pdGpu option")].map((o) => o.textContent).join("|")))));
    await p.check('input[name="pdCloud"][value="SECURE"]'); await sleep(700);
    await p.selectOption("#pdGpu", "NVIDIA GeForce RTX 4090"); await p.fill("#pdName", "My H3 pod"); await p.fill("#pdVol", "60");
    await p.click("#pdGo");
    await p.waitForFunction(() => document.querySelector('#pdPods [data-pod="new756"]'), null, { timeout: 8000 }).catch(() => {});
    const row0 = await ev(() => (document.querySelector('#pdPods [data-pod="new756"]') || {}).textContent || "");   // before it loads
    check("2.760.0 (Tim: \"after the pod is created only show my pods\"): 🖥 My pods lit, the pods alone - no templates, no form", await ev(() => {
      const seen = (e) => !!e && e.offsetParent !== null;
      return document.querySelector('[data-pdsrc="mine"]').classList.contains("on") && seen(document.getElementById("pdPods")) && !seen(document.getElementById("pdTpl")) && !document.getElementById("pdForm") && !seen(document.getElementById("pdQ"))
        && /pod created/.test(document.getElementById("pdMsg").textContent); }));
    const created = seen.find((x) => /^POST \/v2\/pods /.test(x)) || "";
    let body = {}; try { body = JSON.parse(created.slice("POST /v2/pods ".length)); } catch { body = {}; }
    check("Create pod: POST /pods - the name, the template, the GPU (1), Secure, the container disk, /workspace 60 GB",
      body.name === "My H3 pod" && body.templateId === "h3com756" && body.gpu && body.gpu.id === "NVIDIA GeForce RTX 4090" && body.gpu.count === 1 && body.cloud === "SECURE" && body.disk === 80
      && body.mounts && body.mounts.persistent && body.mounts.persistent.size === 60 && body.mounts.persistent.path === "/workspace", body);
    await p.waitForFunction(() => /pod loaded/.test((document.querySelector('#pdPods [data-pod="new756"] .pdSt') || {}).textContent || ""), null, { timeout: 12000 }).catch(() => {});
    const row1 = await ev(() => document.querySelector('#pdPods [data-pod="new756"]').textContent);
    const bg = (await api("/api/gpusplit")) && (await api("/api/pods/mine")).pods.find((x) => x.id === "new756");
    check("…the new pod in My pods, 🅱 (bitGen made it), loading pod… then pod loaded (its ComfyUI on the template's port 3000)", /My H3 pod 🅱/.test(row0) && /loading pod/.test(row0) && /pod loaded/.test(row1) && bg && bg.bitgen === true, { row0, row1 });
    await p.click('#pdPods [data-pod="new756"] [data-pduse]'); await sleep(1500);
    const rg = await api("/api/remotegpu");
    check("…Use it: renders on it, through its ComfyUI port (3000)", rg.mode === "runpod" && rg.runpod.pod_id === "new756" && +rg.runpod.port === 3000, { mode: rg.mode, port: rg.runpod && rg.runpod.port });
    await p.click('#pdPods [data-pod="new756"] [data-pdact="stop"]');
    await p.waitForFunction(() => /^stopped$/.test((document.querySelector('#pdPods [data-pod="new756"] .pdSt') || {}).textContent || ""), null, { timeout: 10000 }).catch(() => {});
    check("⏹ Stop: stopping pod… then stopped", /^stopped$/.test(await ev(() => document.querySelector('#pdPods [data-pod="new756"] .pdSt').textContent)) && seen.some((x) => /action \{"action":"stop"\}/.test(x)));
    await p.click('#pdPods [data-pod="new756"] [data-pdkill]'); await sleep(300);
    const ask = await ev(() => (document.querySelector('#pdPods [data-pod="new756"] .pdKill') || {}).textContent || "");
    check("Terminate asks first, saying the pod and its files are deleted (nothing sent yet)", /Terminate My H3 pod\? The pod and every file on it \(models, outputs\) are deleted/.test(ask) && !seen.some((x) => /"terminate"/.test(x)), ask);
    await p.click("#pdPods [data-pdkillyes]"); await sleep(1500);
    check("…Terminate: RunPod deletes it; gone from My pods and from the pods bitGen started", seen.some((x) => /action \{"action":"terminate"\}/.test(x)) && !(await ev(() => !!document.querySelector('#pdPods [data-pod="new756"]')))
      && /terminated - no more charges/.test(await ev(() => document.getElementById("pdMsg").textContent)), seen.filter((x) => /action/.test(x)));
    await ev(() => document.querySelector('input[name="gpuRunpod"][value="serverless"]').click()); await sleep(1200);   // the floating docker may cover it
    check("RunPod ▸ Serverless: the 🖥 PODS button and the docker go", !(await vis("#gpuPods")) && !(await ev(() => SecFloat.state("pods").shown)));
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close(); rp.close();
    // the engine first, while remote generation is still on (afterwards the studio refuses the change and Pods stayed
    // picked - the next tests then found Remote unlocked)
    await api("/api/gpusplit", { where: "local", engine: { provider: (g0.engine || {}).provider || "runpod", runpod: (g0.engine || {}).runpod || "serverless" }, llm: !!g0.llm, vlm: !!g0.vlm, image: !!g0.image, video: !!g0.video }).catch(() => {});
    await api("/api/remotegpu/use", { mode: "local" }).catch(() => {});
    await api("/api/remotegpu/save", { runpod: Object.assign({ key: "", pod_id: "", pod_name: "", cost_hr: 0, port: 8188 }, v0.runpod || {}), serverless: Object.assign({ endpoint: "" }, v0.serverless || {}) }).catch(() => {});
    await api("/api/remotegen/enabled", { on: null }).catch(() => {});
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
