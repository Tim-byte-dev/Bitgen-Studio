#!/usr/bin/env node
/* bitGen Studio — 2.743.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311): Settings ▸
 * Remote GPU ▸ RUNPOD SERVERLESS. Tim (verbatim): "can we try using a runpod serverless gpu?"
 *   - the RunPod Serverless choice shows its own part (key, endpoint ID, $/hour, what the endpoint needs) and hides the rest;
 *   - typed in, it is saved (one RunPod key for pods and serverless);
 *   - ✓ Test asks RunPod's /health and says the workers / jobs in one line - against a stand-in RunPod on 8399 (the studio
 *     started with H3_RUNPOD_SLS_API=http://127.0.0.1:8399/v2, as scripts/e2e-stub-test.sh starts it; otherwise that leg
 *     is skipped);
 *   - Use it: ComfyUI's URL becomes the studio's own /rpsl, which answers like a ComfyUI; This computer puts it back.
 * The studio's Remote GPU settings are put back afterwards. No server / no Playwright = SKIP. */
"use strict";
const path = require("path"), http = require("http");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.743.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b) => fetch(URL0 + p.replace(/^\//, ""), b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined).then((r) => r.json());

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.743.0 browser test did not run"); process.exit(0); }
  // a stand-in RunPod on 8399 (only /health is asked here)
  const seen = [];
  const rp = http.createServer((req, res) => {
    seen.push(req.method + " " + req.url + " " + (req.headers.authorization || ""));
    res.writeHead(req.headers.authorization === "Bearer rpa_UI743" ? 200 : 401, { "Content-Type": "application/json" });
    res.end(JSON.stringify(/\/v2\/epui743\/health$/.test(req.url) ? { jobs: { completed: 7, failed: 1, inProgress: 0, inQueue: 2, retried: 0 }, workers: { idle: 2, running: 1 } } : { error: "?" }));
  });
  const rpUp = await new Promise((r) => { rp.once("error", () => r(false)); rp.listen(8399, "127.0.0.1", () => r(true)); });
  const v0 = await api("/api/remotegpu");
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3RemoteGpu && document.getElementById("rgMode"), null, { timeout: 30000 });
    await sleep(800);
    await ev(() => { document.getElementById("openSettings").onclick(); document.querySelector('#settings .stabs [data-stab="rgpu"]').click(); });
    await sleep(600);
    const modes = await ev(() => [...document.querySelectorAll('#stab-rgpu input[name="rgmode"]')].map((r) => r.value + ":" + r.parentElement.textContent.trim()));
    check("Remote GPU: This computer / Remote URL / RunPod pod / RunPod Serverless / SSH tunnel", modes.join("|") === "local:This computer|url:Remote URL|runpod:RunPod pod|serverless:RunPod Serverless|ssh:SSH tunnel", modes);
    await p.check('#stab-rgpu input[name="rgmode"][value="serverless"]');
    await sleep(300);
    const shown = await ev(() => [...document.querySelectorAll("#stab-rgpu .rgsec")].filter((s) => s.style.display !== "none").map((s) => s.dataset.rg));
    const help = await ev(() => document.getElementById("rgSlsHelp").textContent);
    check("…RunPod Serverless shows only its own part, saying what the endpoint needs (worker-comfyui, the models on a network volume, the nodes, 10 MB)", shown.join() === "serverless"
      && /worker-comfyui/.test(help) && /network volume/.test(help) && /custom nodes/.test(help) && /10 MB/.test(help), { shown, help });
    await p.fill("#rgSlsKey", "rpa_UI743"); await p.fill("#rgEndpoint", "epui743"); await p.fill("#rgSlsCost", "1.44");
    await p.locator("#rgSlsCost").blur(); await sleep(500);
    const v1 = await api("/api/remotegpu");
    check("…typed in = saved: the key (the same one pods use), the endpoint, $/hour", v1.runpod.key === "rpa_UI743" && v1.serverless.endpoint === "epui743" && v1.serverless.cost_hr === 1.44, { runpod: v1.runpod, serverless: v1.serverless });
    const probe = await api("/api/remotegpu/serverless/test", {});
    if (rpUp && probe.ok) {
      await p.click("#rgTest");
      await p.waitForFunction(() => /workers/.test(document.getElementById("rgMsg").textContent), null, { timeout: 8000 }).catch(() => {});
      const tm = await ev(() => document.getElementById("rgMsg").textContent);
      check("…✓ Test: RunPod's /health in one line (2 ready, 1 running, 2 waiting)", /^✓ workers: 2 ready, 1 running/.test(tm) && /2 waiting/.test(tm) && seen.some((s) => /GET \/v2\/epui743\/health Bearer rpa_UI743/.test(s)), { tm, seen });
    } else console.log("SKIP: ✓ Test leg - the studio was not started with H3_RUNPOD_SLS_API=http://127.0.0.1:8399/v2 (" + (probe.error || "8399 busy") + ")");
    await p.click("#rgUse"); await sleep(1000);
    const c1 = await api("/api/config");
    const st = await fetch(c1.engine.comfy.url + "/system_stats").then((r) => r.json()).catch(() => ({}));
    check("…Use it: ComfyUI's URL is the studio's own /rpsl (not started here), and it answers like a ComfyUI", /\/rpsl$/.test(c1.engine.comfy.url) && c1.engine.comfy.autostart === false
      && /RunPod Serverless \(endpoint epui743\)/.test(((st || {}).system || {}).comfyui_version || ""), { url: c1.engine.comfy.url, st });
    const now = await ev(() => document.getElementById("rgNow").textContent);
    check("…the tab says what renders now", /RunPod Serverless epui743/.test(now), now);
    await p.check('#stab-rgpu input[name="rgmode"][value="local"]'); await sleep(200);
    await p.click("#rgUse"); await sleep(1000);
    const c2 = await api("/api/config");
    check("This computer: back to its own ComfyUI", !/\/rpsl$/.test(c2.engine.comfy.url) && (c2.rgpu || {}).mode === "local", c2.engine.comfy);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close();
    await api("/api/remotegpu/save", { runpod: { key: (v0.runpod || {}).key || "" }, serverless: { endpoint: (v0.serverless || {}).endpoint || "", cost_hr: (v0.serverless || {}).cost_hr || 0 } }).catch(() => {});
    if (v0.mode && v0.mode !== "local") await api("/api/remotegpu/use", { mode: v0.mode }).catch(() => {});
    rp.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
