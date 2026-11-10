#!/usr/bin/env node
/* bitGen Studio — 2.754.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311) started with
 * H3_RUNPOD_REST_API=http://127.0.0.1:8399/v2 (2.755.0: REST v2 - a stand-in RunPod REST API this test serves on 8399).
 * Tim (verbatim): "can you make a remote generation floating docker, add the toggle for it under the basic settings gpu menu
 * item not in the statusbar. add a checkbox in the settings- remote geneation tab, to use remote generation, if checked show
 * the gpu menu item in basic settings if unchecked hide the gpu menu item ... no point confusing people . i would like to add
 * public pods to my account is it possible to have a shortcut to them?"
 *   - off (a new install): Basic Settings ▸ GPU hidden; Settings ▸ Remote generation shows only "Use remote generation";
 *   - ticked: GPU back, the tab's parts back; GPU has "☁ Remote generation docker" (not in the status bar); it opens the
 *     floating docker: where the work runs, 🔄 My pods (start / stop / Use it), pod shortcuts (Deploy ↗ = RunPod's deploy
 *     page with the template + bitGen's referral code; a bad link refused; ✕ removes), Explore ↗;
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
    check("…Basic Settings ▸ GPU shows, with \"☁ Remote generation docker\" in it - and no status-bar button for the docker", (await gpuShown()) && (await ev(() => !!document.querySelector("#sec-gpu #gpuDock")))
      && !(await ev(() => /Remote generation/.test(document.getElementById("statusbar").textContent))));
    await p.click("#gpuDock"); await sleep(1500);
    const d0 = await ev(() => ({ shown: SecFloat.state("rgen").shown, body: !!document.getElementById("rgdBody") && document.getElementById("rgdBody").offsetWidth > 0, pressed: document.getElementById("gpuDock").getAttribute("aria-pressed"),
      now: document.getElementById("rgdNow").textContent, title: (document.getElementById("rgdBody").closest(".df-panel, .df-float, [data-dfid]") || {}).textContent || "" }));
    check("the button opens the floating docker (pressed): where the work runs (Local), no remote GPU, the LLM here", d0.shown && d0.body && d0.pressed === "true" && /Where the work runs: Local/.test(d0.now) && /Remote GPU: none set up/.test(d0.now) && /LLM: this computer/.test(d0.now), d0);
    await p.waitForFunction(() => document.querySelector("#rgdPodList [data-rgdpod]"), null, { timeout: 8000 }).catch(() => {});
    const pods = await ev(() => [...document.querySelectorAll("#rgdPodList .rgdRow")].map((r) => r.textContent));
    check("My pods: listed as the docker opens (your key) - name, GPU, $/h, state, ▶ Start, Use it", pods.length === 1 && /H3 pod · RTX 4090 · \$0\.69\/h · stopped▶ StartUse it/.test(pods[0]) && seen.some((x) => x === "GET /v2/pods?limit=1000 Bearer rpa_UI754"), pods);
    await ev(() => { window.H3_POD_POLL = 400; });
    await p.click('#rgdPodList [data-act="start"]');
    const loading = await ev(() => document.querySelector("#rgdPodList .rgdSt").textContent);
    await p.waitForFunction(() => /pod loaded/.test((document.querySelector("#rgdPodList .rgdSt") || {}).textContent || ""), null, { timeout: 10000 }).catch(() => {});
    const pods2 = await ev(() => [...document.querySelectorAll("#rgdPodList .rgdRow")].map((r) => r.textContent));
    check("…▶ Start (RunPod REST v2: POST /pods/{id}/action start): \"loading pod…\" at once, then \"pod loaded\" when its ComfyUI answers - with its time running and about what it cost so far; ⏹ Stop",
      seen.includes("ACTION start") && seen.includes("POST /v2/pods/pod754/action Bearer rpa_UI754") && /loading pod/.test(loading) && /pod loaded · running 1 min · ≈ \$0\.01⏹ Stop/.test(pods2[0] || "") && /pod loaded/.test(await ev(() => document.getElementById("rgdMsg").textContent)), { loading, pods2 });
    await p.click("#rgdPodList [data-rgduse]"); await sleep(1500);
    const rg = await api("/api/remotegpu");
    await p.click('#rgdPodList [data-act="stop"]');
    const stopping = await ev(() => document.querySelector("#rgdPodList .rgdSt").textContent);
    await p.waitForFunction(() => /^stopped$/.test((document.querySelector("#rgdPodList .rgdSt") || {}).textContent || ""), null, { timeout: 10000 }).catch(() => {});
    const stopped = await ev(() => ({ st: document.querySelector("#rgdPodList .rgdSt").textContent, btn: document.querySelector("#rgdPodList [data-rgdpod]").dataset.act, msg: document.getElementById("rgdMsg").textContent }));
    check("…⏹ Stop: \"stopping pod…\", then \"stopped\" (▶ Start again), saying storage is still billed", seen.includes("ACTION stop") && /stopping pod/.test(stopping) && stopped.st === "stopped" && stopped.btn === "start" && /storage is still billed/.test(stopped.msg), { stopping, stopped });
    check("…Use it: the studio renders on that pod (RunPod pod pod754, its ComfyUI through RunPod's proxy)", rg.mode === "runpod" && rg.runpod.pod_id === "pod754" && /pod754-8188\.proxy\.runpod\.net/.test(rg.comfy_url || ""), { mode: rg.mode, pod: rg.runpod && rg.runpod.pod_id, url: rg.comfy_url });
    // shortcuts
    await p.fill("#rgdCutName", "Bad"); await p.fill("#rgdCutLink", "https://example.com/nothing"); await p.click("#rgdCutAdd"); await sleep(600);
    check("pod shortcuts: a link that is not a RunPod template is refused, saying where to copy it", /not a RunPod template link/.test(await ev(() => document.getElementById("rgdMsg").textContent)));
    await p.fill("#rgdCutName", "MiniMax H3 ComfyUI"); await p.fill("#rgdCutLink", "https://www.runpod.io/console/explore/57we0zdwtt"); await p.press("#rgdCutLink", "Enter"); await sleep(800);
    const c1 = await ev(() => [...document.querySelectorAll("#rgdCuts .rgdRow")].map((r) => { const a = r.querySelector(".rgdDeploy"), n = r.querySelector(".nm a"); return { name: n.textContent, page: n.href, deploy: a.href, t: a.target, rel: a.rel }; }));
    check("…a template's page link added: its name links to the page, Deploy ↗ = RunPod's deploy page with it + bitGen's referral code, in the browser",
      c1.length === 1 && c1[0].name === "MiniMax H3 ComfyUI" && c1[0].page === "https://www.runpod.io/console/explore/57we0zdwtt" && c1[0].deploy === "https://runpod.io/console/deploy?template=57we0zdwtt&ref=gbj9zxqh" && c1[0].t === "_blank" && /noopener/.test(c1[0].rel), c1);
    const [pop] = await Promise.all([ctx.waitForEvent("page", { timeout: 8000 }), p.click("#rgdCuts .rgdDeploy")]);
    check("…Deploy ↗ opens a new window (the app hands it to the browser), the studio stays", /template=57we0zdwtt&ref=gbj9zxqh/.test(pop.url()) && /127\.0\.0\.1/.test(p.url()), pop.url());
    await pop.close();
    check("…kept (the server's list) and Explore RunPod templates ↗ is there", (await api("/api/remotegen")).shortcuts.length === 1 && (await ev(() => { const a = document.getElementById("rgdExplore"); return a.href === "https://www.runpod.io/console/explore" && a.target === "_blank"; })));
    await p.click("#rgdCuts [data-rgdcut]"); await sleep(600);
    check("…✕ removes it", (await api("/api/remotegen")).shortcuts.length === 0 && /No shortcuts yet/.test(await ev(() => document.getElementById("rgdCuts").textContent)));
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
