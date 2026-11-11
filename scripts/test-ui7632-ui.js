#!/usr/bin/env node
/* bitGen Studio — 2.763.2 browser test: GENERATE IN POD MODE NEVER STARTS THIS COMPUTER'S COMFYUI (static/podroute.js,
 * lib/stylePods.js willUsePod, routes/stylePods.js /route, routes/modelsFound.js) on a running studio (H3_URL, default :8311)
 * WITHOUT a ComfyUI of its own, started with H3_RUNPOD_REST_API=http://127.0.0.1:8399/v2 and
 * H3_RUNPOD_PROXY=http://127.0.0.1:8399/proxy/{id}-{port} (this test's stand-in RunPod on 8399).
 * Tim (his log): "[comfy] launching via run.bat … [generate] Image · house — that one failed." + "i did not get any popups, it
 * says starting in queue but i don't know what it;s doing"
 *   - RunPod ▸ Pods (Remote): /api/stylepods/route says pod; the models check skips the style
 *   - 🖼 Image + Generate: POST /api/genimage is sent, the pod question opens, /api/comfy/ensure is never called
 *   - Cancel = cancelled; H3PodRoute.why gives the job's [pod] lines
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
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.763.2 browser test did not run"); process.exit(0); }
  const PODS = [{ id: "pod7632u", name: "My pod", desiredStatus: "EXITED", status: "EXITED", costPerHr: 0.44, gpu: { id: "NVIDIA GeForce RTX 4090", count: 1 }, ports: ["8188/http"] }];
  const rp = http.createServer((q, s) => {
    let b = ""; q.on("data", (d) => { b += d; }); q.on("end", () => {
      const send = (c, j) => { s.writeHead(c, { "Content-Type": "application/json" }); s.end(JSON.stringify(j)); };
      if (/^\/proxy\//.test(q.url)) return send(502, {});
      if (q.headers.authorization !== "Bearer rpa_UI7632") return send(401, {});
      if (q.method === "GET" && q.url === "/v2/pods?limit=1000") return send(200, { pods: PODS });
      if (/^\/v2\/catalog\/templates/.test(q.url)) return send(200, { templates: q.url.includes("official") ? [{ id: "tplCu13u", name: "ComfyUI CUDA 13", ports: ["8188/http", "8888/http"] }] : [], pagination: { hasNextPage: false } });
      if (/^\/v2\/catalog\/gpus/.test(q.url)) return send(200, { gpus: [{ id: "NVIDIA GeForce RTX 4090", name: "RTX 4090", memory: 24, price: { secure: 0.69, community: 0.34 }, availability: "HIGH", secure: true, community: true }] });
      if (/^\/v2\/billing\/pods/.test(q.url)) return send(200, { records: [], metadata: {} });
      send(404, {});
    });
  });
  try { await new Promise((ok, bad) => { rp.once("error", bad); rp.listen(8399, "127.0.0.1", ok); }); } catch { console.log("SKIP: port 8399 is busy - the 2.763.2 browser test did not run"); process.exit(0); }
  const g0 = await api("/api/gpusplit");
  await api("/api/remotegpu/use", { mode: "local" });
  await api("/api/remotegpu/save", { runpod: { key: "rpa_UI7632", pod_id: "", port: 8188 }, serverless: { endpoint: "" } });
  await api("/api/remotegen/enabled", { on: true });
  await api("/api/gpusplit", { where: "remote", engine: { provider: "runpod", runpod: "pods" } });
  const st = ((await api("/api/styles?kind=image")).styles || []).find((x) => x.engine === "comfy" && (!x.runs_on || x.runs_on === "local") && !x.chain && !/edit/i.test(x.name));
  const jobs = [];
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const reqs = []; p.on("request", (r) => { if (/\/api\/(comfy\/ensure|genimage|stylepods\/route|models\/check)/.test(r.url())) reqs.push(r.method() + " " + r.url().replace(/^https?:\/\/[^/]+/, "")); });
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3PodRoute && window.H3StylePodAsk && document.getElementById("genModeSel") && document.getElementById("go"), null, { timeout: 30000 });
    const route = await api("/api/stylepods/route?mode=image&style_id=" + encodeURIComponent(st.id));
    check("GET /api/stylepods/route: an image style on RunPod Pods (Remote) goes to a pod", route.pod === true, route);
    const mc = await api("/api/models/check", { kind: "image", style_id: st.id });
    check("…the 'models not found' check skips it (its files are put on the pod)", /renders on a RunPod pod/.test(JSON.stringify(mc)), mc);
    await ev((sid) => { const g = document.getElementById("genModeSel"); g.value = "image"; if (typeof g.onchange === "function") g.onchange(); g.dispatchEvent(new Event("change", { bubbles: true }));
      const s = document.getElementById("styleSel"); s.value = sid; s.dispatchEvent(new Event("change", { bubbles: true }));
      const t = document.getElementById("prompt"); t.value = "a house by a lake"; t.dispatchEvent(new Event("input", { bubbles: true })); }, st.id);
    await sleep(400);
    await ev(() => document.getElementById("go").click());   // the button the prompt docker shows (the docker may be folded here)
    await p.waitForFunction(() => { const d = document.getElementById("spaDlg"); return d && d.open && d.querySelector("#spaCancel"); }, null, { timeout: 30000 }).catch(() => {});
    const open = await ev(() => { const d = document.getElementById("spaDlg"); return d ? { open: d.open, title: (d.querySelector("#spaTitle") || {}).textContent || "" } : null; });
    check("Generate (🖼 Image, a style with no pod): the render is SENT (POST /api/genimage) and the pod question opens - this computer's ComfyUI is never started (no /api/comfy/ensure)",
      open && open.open && open.title === "A pod for " + st.name && reqs.some((x) => /^POST \/api\/genimage/.test(x)) && !reqs.some((x) => /comfy\/ensure/.test(x)), { open, reqs });
    const jl = await api("/api/jobs"); const j = jl.find((x) => x.pod_ask); if (j) jobs.push(j.id);
    await p.click("#spaCancel").catch(() => {});
    let js = null; for (let i = 0; i < 30; i++) { await sleep(500); js = (await api("/api/jobs")).find((x) => j && x.id === j.id); if (!js || js.status !== "queued") break; }
    check("Cancel: the render is cancelled - not failed, and not rendered on this computer", js && js.status === "cancelled", js && { status: js.status });
    // a failed render's reason is printed after "that one failed" (podroute.why)
    const lines = await ev((id) => H3PodRoute.why(id), j && j.id);
    check("H3PodRoute.why: the job's [pod] lines - the reason - for the log", lines.some((l) => /^\[pod\] /.test(l)), lines);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close();
    for (const j of jobs) await api("/api/jobs/" + j + "/cancel", {}).catch(() => {});
    rp.close();
    await api("/api/gpusplit", { where: "local", engine: { provider: (g0.engine || {}).provider || "runpod", runpod: (g0.engine || {}).runpod || "serverless" }, llm: !!g0.llm, vlm: !!g0.vlm, image: !!g0.image, video: !!g0.video }).catch(() => {});
    await api("/api/remotegpu/use", { mode: "local" }).catch(() => {});
    await api("/api/remotegpu/save", { runpod: { key: "", pod_id: "", port: 8188 } }).catch(() => {});
    await api("/api/remotegen/enabled", { on: null }).catch(() => {});
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
