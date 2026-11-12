#!/usr/bin/env node
/* bitGen Studio — 2.754.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311) started with
 * H3_RUNPOD_REST_API=http://127.0.0.1:8399/v2 (2.755.0: REST v2 - a stand-in RunPod REST API this test serves on 8399).
 * Tim (verbatim): "can you make a remote generation floating docker, add the toggle for it under the basic settings gpu menu
 * item not in the statusbar. add a checkbox in the settings- remote geneation tab, to use remote generation, if checked show
 * the gpu menu item in basic settings if unchecked hide the gpu menu item ... no point confusing people . i would like to add
 * public pods to my account is it possible to have a shortcut to them?"
 *   - off (a new install): Basic Settings ▸ GPU hidden; Settings ▸ Remote generation shows only "Use remote generation";
 *   - ticked: GPU back, the tab's parts back; GPU has "☁ Remote generation docker" (not in the status bar); it opens the
 *     floating docker: where the work runs, 🖥 PODS docker (2.758.0: My pods and the pod shortcuts moved there);
 *   - unticked: GPU + docker hidden, everything back on this computer.
 * Put back afterwards. No server / no Playwright / 8399 busy = SKIP. */
"use strict";
const path = require("path"), http = require("http");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.754.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b) => fetch(URL0 + p.replace(/^\//, ""), b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined).then((r) => r.json());

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.754.0 browser test did not run"); process.exit(0); }
  const seen = []; let state = "EXITED";
  const rp = http.createServer((q, s) => {
    seen.push(q.method + " " + q.url + " " + (q.headers.authorization || ""));
    // 2.755.0: the pod's ComfyUI through "RunPod's proxy" (H3_RUNPOD_PROXY=http://127.0.0.1:8399/proxy/{id}-{port})
    if (q.url === "/proxy/pod754-8188/system_stats") { if (state !== "RUNNING") { s.writeHead(502); return s.end("{}"); } s.writeHead(200, { "Content-Type": "application/json" }); return s.end(JSON.stringify({ system: { comfyui_version: "0.3.60" }, devices: [{ name: "cuda:0 RTX 4090", vram_total: 25769803776, type: "cuda" }] })); }
    if (q.headers.authorization !== "Bearer rpa_UI754") { s.writeHead(401); return s.end("{}"); }
    s.writeHead(200, { "Content-Type": "application/json" });
    // 2.755.0: RunPod's REST API v2 - {pods, pagination}; POST /pods/{id}/action {action}; GET /pods/{id} with runtime
    const pod = () => ({ id: "pod754", name: "H3 pod", status: state, gpu: { id: "NVIDIA GeForce RTX 4090", count: 1 }, cost: 0.69, ports: ["8188/http"], startedAt: state === "RUNNING" ? new Date().toISOString() : null, runtime: state === "RUNNING" ? { uptime: 42 } : null });
    if (q.method === "GET" && q.url === "/v2/pods?limit=1000") return s.end(JSON.stringify({ pods: [pod()], pagination: { nextCursor: null, hasNextPage: false } }));
    if (q.method === "GET" && q.url === "/v2/pods/pod754") return s.end(JSON.stringify(pod()));
    if (q.method === "POST" && q.url === "/v2/pods/pod754/action") { let b = ""; q.on("data", (d) => { b += d; }); return q.on("end", () => { const a = (JSON.parse(b || "{}")).action; seen.push("ACTION " + a); state = a === "start" ? "RUNNING" : a === "stop" ? "EXITED" : state; s.end(JSON.stringify(pod())); }); }
    s.end("{}");
  });
  try { await new Promise((ok, bad) => { rp.once("error", bad); rp.listen(8399, "127.0.0.1", ok); }); } catch { console.log("SKIP: port 8399 is busy - the 2.754.0 browser test did not run"); process.exit(0); }
  const v0 = await api("/api/remotegpu"), g0 = await api("/api/gpusplit");
  await api("/api/remotegpu/use", { mode: "local" });
  await api("/api/remotegpu/save", { runpod: { key: "rpa_UI754" } });
  await api("/api/gpusplit", { where: "local" });
  await api("/api/remotegen/enabled", { on: false });
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 } });
    await ctx.route(/runpod\.io/, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>RunPod</title>" }));
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3RemoteDock && H3RemoteDock.state().on !== null && document.getElementById("gpuDock") && document.getElementById("rgEnabled") && window.SecFloat && SecFloat.windows.rgen, null, { timeout: 30000 });
    await sleep(800);
    const vis = (sel) => ev((s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== "none"; }, sel);
    const gpuShown = async () => (await vis('h2.sec.drop[data-sec="gpu"]')) && (await vis("#sec-gpu"));
    check("off: Basic Settings ▸ GPU is hidden", !(await vis('h2.sec.drop[data-sec="gpu"]')) && !(await vis("#sec-gpu")));
    await ev(() => { document.getElementById("openSettings").onclick(); document.querySelector('#settings .stabs [data-stab="rgpu"]').click(); });
    await sleep(500);
    const t0 = await ev(() => ({ first: document.getElementById("stab-rgpu").firstElementChild.className, cb: document.getElementById("rgEnabled").checked,
      label: document.querySelector(".rgEnRow label").textContent.trim(), others: [...document.getElementById("stab-rgpu").children].filter((c) => !c.classList.contains("rgEnRow")).every((c) => getComputedStyle(c).display === "none") }));
    check("…Settings ▸ Remote generation: \"Use remote generation\" first, unticked, and nothing else of the tab shows", t0.first === "rgEnRow" && !t0.cb && t0.label === "Use remote generation" && t0.others, t0);
    await p.check("#rgEnabled"); await sleep(700);
    const t1 = await ev(() => ({ mode: getComputedStyle(document.getElementById("rgMode")).display, llm: getComputedStyle(document.getElementById("rgVllm")).display }));
    check("ticked: the tab's parts show again; the server says on", t1.mode !== "none" && t1.llm !== "none" && (await api("/api/remotegen")).enabled === true, t1);
    await ev(() => document.getElementById("settings").close());
    await ev(() => { if (window.SecFloat && SecFloat.windows.basic) SecFloat.show("basic", true); toggleSec("gpu", false); }); await sleep(400);   // Basic Settings is a floating docker of its own
    await ev(() => H3GpuSplit.choose("remote")); await sleep(900);   // 2.764.1: on Local the remote details are hidden - Remote shows them
    check("…Basic Settings ▸ GPU shows, with \"☁ Remote generation docker\" in it - and no status-bar button for the docker", (await gpuShown()) && (await ev(() => !!document.querySelector("#sec-gpu #gpuDock")))
      && !(await ev(() => /Remote generation/.test(document.getElementById("statusbar").textContent))));
    await p.click("#gpuDock"); await sleep(1500);
    const d0 = await ev(() => ({ shown: SecFloat.state("rgen").shown, body: !!document.getElementById("rgdBody") && document.getElementById("rgdBody").offsetWidth > 0, pressed: document.getElementById("gpuDock").getAttribute("aria-pressed"),
      now: document.getElementById("rgdNow").textContent, title: (document.getElementById("rgdBody").closest(".df-panel, .df-float, [data-dfid]") || {}).textContent || "" }));
    check("the button opens the floating docker (pressed): where the work runs (Local), no remote GPU, the LLM here", d0.shown && d0.body && d0.pressed === "true" && /Where the work runs: Local/.test(d0.now) && /Remote GPU: none set up/.test(d0.now) && /LLM: this computer/.test(d0.now), d0);
    // 2.758.0 (Tim: "can you remove this My pods ... Pod shortcuts ... from remote generation docker and add to pod's card in pods
    // docker"): the pods + shortcuts moved to the PODS docker (test-ui756-ui.js, test-ui758-ui.js); here a button opens it
    const d1 = await ev(() => ({ pods: !!document.getElementById("rgdPodList"), cuts: !!document.getElementById("rgdCuts"), text: document.getElementById("rgdBody").textContent }));
    check("2.758.0: no My pods / Pod shortcuts in this docker any more - 🖥 PODS docker opens the PODS docker (your pods, the templates, ★ shortcuts)",
      !d1.pods && !d1.cuts && !/My pods|Pod shortcuts/.test(d1.text) && /🖥 PODS docker/.test(d1.text), d1);
    await p.click("#rgdPodsDock"); await sleep(800);
    check("…it opens", await ev(() => !!(SecFloat.state("pods") || {}).shown));
    await ev(() => SecFloat.show("pods", false));
    // off again
    await ev(() => { document.getElementById("openSettings").onclick(); document.querySelector('#settings .stabs [data-stab="rgpu"]').click(); });
    await sleep(400); await p.uncheck("#rgEnabled"); await sleep(1200);
    await ev(() => document.getElementById("settings").close());
    const off = await api("/api/gpusplit"), rg2 = await api("/api/remotegpu");
    check("unticked: GPU and the docker hidden; everything back on this computer (Local, ComfyUI here)", !(await gpuShown()) && !(await ev(() => SecFloat.state("rgen").shown)) && off.enabled === false && off.where === "local" && rg2.mode === "local", { where: off.where, mode: rg2.mode });
    const refused = await api("/api/gpusplit", { where: "both" });
    check("…and Both is refused while it is off, saying where to turn it on", /tick Use remote generation first/.test(refused.error || ""), refused);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close(); rp.close();
    await api("/api/remotegpu/use", { mode: "local" }).catch(() => {});
    await api("/api/remotegpu/save", { runpod: Object.assign({ key: "", pod_id: "", pod_name: "", cost_hr: 0, port: 8188 }, v0.runpod || {}) }).catch(() => {});
    for (const c of ((await api("/api/remotegen").catch(() => ({}))).shortcuts || [])) await api("/api/remotegen/shortcuts", { remove: c.id }).catch(() => {});
    await api("/api/remotegen/enabled", { on: null }).catch(() => {});
    await api("/api/gpusplit", { where: "local", llm: !!g0.llm, vlm: !!g0.vlm, image: !!g0.image, video: !!g0.video }).catch(() => {});
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
