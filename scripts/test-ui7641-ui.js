#!/usr/bin/env node
/* bitGen Studio — 2.764.1 browser test: Basic Settings ▸ GPU on Local hides every remote detail (static/gpusplit.js) - on a
 * running studio (H3_URL, default :8311). Tim (verbatim): "if local is selected in basic settings, hide all the remote gpu
 * details and options. the remote gpu radio group ☁ Remote generation docker🖥 PODS 💲 RunPod pods: none running · $0.00
 * today · $1.31 this month." Put back afterwards. No server / no Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.764.1 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b) => fetch(URL0 + p.replace(/^\//, ""), b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined).then((r) => r.json());

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.764.1 browser test did not run"); process.exit(0); }
  const g0 = await api("/api/gpusplit");
  await api("/api/remotegpu/save", { runpod: { key: "rpa_UI7641", pod_id: "", port: 8188 }, serverless: { endpoint: "" } });
  await api("/api/remotegen/enabled", { on: true });
  await api("/api/gpusplit", { where: "local", engine: { provider: "runpod", runpod: "pods" } });
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3GpuSplit && H3GpuSplit.state().v && document.getElementById("gpuDock") && document.getElementById("gpuPods") && document.getElementById("gpuRpDock") && window.SecFloat && SecFloat.windows.pods, null, { timeout: 30000 });
    await ev(() => { if (SecFloat.windows.basic) SecFloat.show("basic", true); toggleSec("gpu", false); }); await sleep(600);
    const look = () => ev(() => { const v = (id) => { const e = document.getElementById(id); return !!e && e.offsetWidth > 0 && getComputedStyle(e).display !== "none"; };
      return { where: [...document.querySelectorAll('input[name="gpuWhere"]')].filter((i) => i.checked).map((i) => i.value).join(), radios: v("gpuWhere"), engine: v("gpuEngine"), dock: v("gpuDock"), pods: v("gpuPods"), rp: v("gpuRpDock"), setup: v("gpuSetup"), boxes: v("gpuBoxes"), line: document.getElementById("gpuLine").textContent,
        dockSetup: v("rgdSettings"), dockPods: v("rgdPodsDock") }; });   // 2.768.0: the remote options are in the ☁ Remote generation docker (⚙ / 🖥 PODS its own buttons)
    const l1 = await look();
    check("Local: only Local / Remote / Both and one line - no Remote servers / RunPod radio groups, ☁ Remote generation docker, 🖥 PODS, 💲 RunPod, ⚙ Settings ▸ Remote generation",
      l1.where === "local" && l1.radios && !l1.engine && !l1.dock && !l1.pods && !l1.rp && !l1.setup && !l1.boxes && l1.line === "Every job runs on this computer.", l1);
    await p.check('input[name="gpuWhere"][value="remote"]'); await sleep(1000);
    await ev(() => SecFloat.show("rgen", true)); await sleep(400);   // 2.768.0 (Tim: "move all the remote gpu options to the remote gpu docker")
    const l2 = await look();
    check("Remote: ☁ Remote generation docker shows again; in it the radio groups, 🖥 PODS and 💲 RunPod", (await api("/api/gpusplit")).where === "remote" && l2.engine && l2.dock && l2.dockPods && l2.rp, l2);
    await ev(() => { SecFloat.show("pods", true); SecFloat.show("rgen", true); SecFloat.show("runpod", true); }); await sleep(400);
    await ev(() => { const i = document.querySelector('input[name="gpuWhere"][value="local"]'); i.checked = true; i.dispatchEvent(new Event("change")); }); await sleep(1000);   // (the dockers just opened float over Basic Settings)
    const l3 = await look(), open = await ev(() => ["pods", "rgen"].filter((id) => (SecFloat.state(id) || {}).shown)), costs = await ev(() => !!(SecFloat.state("runpod") || {}).shown);
    check("Local again: hidden again, and the PODS / Remote generation dockers close - 💲 Costs stays (2.771.0: this computer's costs are in it)", (await api("/api/gpusplit")).where === "local" && !l3.engine && !l3.dock && !l3.pods && !l3.rp && open.length === 0 && costs, { l3, open, costs });
    await ev(() => SecFloat.show("runpod", false));
    // nothing remote set up: Remote waits, shows the choices, RunPod ▸ Pods saves it
    await api("/api/gpusplit", { where: "local", engine: { provider: "runpod", runpod: "serverless" } }); await ev(() => H3GpuSplit.load()); await sleep(600);
    await p.check('input[name="gpuWhere"][value="remote"]'); await sleep(800);
    const l4 = await look();
    check("nothing set up yet: Remote picked = it waits (not saved), the ☁ Remote generation docker opens with the Remote servers / RunPod choices (+ ⚙ Settings) and the line says what to do", (await api("/api/gpusplit")).where === "local" && l4.where === "remote" && l4.engine && l4.dockSetup && /needs somewhere to render first: pick RunPod ▸ Pods in the ☁ Remote generation docker/.test(l4.line), l4);
    await p.check('input[name="gpuRunpod"][value="pods"]'); await sleep(1500);
    check("…RunPod ▸ Pods picked: Remote is saved", (await api("/api/gpusplit")).where === "remote" && (await api("/api/gpusplit")).engine.pods === true);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e)); }
  finally {
    await b.close();
    await api("/api/gpusplit", { where: "local", engine: { provider: (g0.engine || {}).provider || "runpod", runpod: (g0.engine || {}).runpod || "serverless" }, llm: !!g0.llm, vlm: !!g0.vlm, image: !!g0.image, video: !!g0.video }).catch(() => {});
    await api("/api/remotegpu/save", { runpod: { key: "", pod_id: "", port: 8188 } }).catch(() => {});
    await api("/api/remotegen/enabled", { on: null }).catch(() => {});
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
