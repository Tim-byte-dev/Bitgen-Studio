#!/usr/bin/env node
/* bitGen Studio — 2.761.0 in a REAL browser against a running studio (H3_URL / H3_PORT - default 8311) started with
 * H3_RUNPOD_REST_API=http://127.0.0.1:8399/v2 and H3_RUNPOD_PROXY=http://127.0.0.1:8399/proxy/{id}-{port} (this test's
 * stand-in RunPod + pod on 8399).
 * Tim (verbatim): "make each pod name in my pods a accordian menuitem, add folder, checkpoint and add lora to each pod in my
 * pod ... add checkboxes under the pod name to tell if it is a video,llm,vllm,image,image-edit style. add a save button to the
 * menu item that is disabled until changes are made and disabled again after save unless new changes are made. this will
 * save the style P_ when pods are selected in basic settings only show pod styles, add the cost in basics settings refresh
 * after every minute to show total cost"
 *   - My pods: each pod a closed item (its name a button); opened: the five ticks, 📁 / ➕ Checkpoint / ➕ LoRA, 💾 Save off
 *   - a tick turns Save on; Save makes the P_ style (the pod's SDXL checkpoint) and turns it off; LLM shows the port / model
 *   - Basic Settings ▸ GPU: 💲 the pods' cost (running now, today, this month) from the stand-in's bill
 * Put back afterwards. No server / no Playwright / 8399 busy = SKIP. */
"use strict";
const path = require("path"), http = require("http");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.761.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b, m) => fetch(URL0 + p.replace(/^\//, ""), b || m ? { method: m || "POST", headers: { "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined } : undefined).then((r) => r.json());

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.761.0 browser test did not run"); process.exit(0); }
  const POD = { id: "pod761u", name: "Item pod", desiredStatus: "RUNNING", status: "RUNNING", costPerHr: 0.69, gpu: { id: "NVIDIA GeForce RTX 4090", count: 1 }, ports: ["3000/http"], runtime: { uptime: 30 } };
  const rp = http.createServer((q, s) => {
    let b = ""; q.on("data", (d) => { b += d; }); q.on("end", () => {
      const send = (c, j) => { s.writeHead(c, { "Content-Type": "application/json" }); s.end(JSON.stringify(j)); };
      const px = /^\/proxy\/pod761u-3000(\/.*)$/.exec(q.url);
      if (px) { const p = px[1];
        if (p === "/system_stats") return send(200, { system: { argv: ["/workspace/ComfyUI/main.py"] } });
        if (p === "/object_info/CheckpointLoaderSimple") return send(200, { CheckpointLoaderSimple: { input: { required: { ckpt_name: [["sdxl_ui761.safetensors"]] } } } });
        if (/^\/object_info\//.test(p)) return send(404, {});
        if (p.startsWith("/api/userdata")) return send(200, []);
        return send(404, {}); }
      if (/^\/proxy\//.test(q.url)) return send(502, {});
      if (q.headers.authorization !== "Bearer rpa_UI761") return send(401, {});
      if (q.method === "GET" && q.url === "/v2/pods?limit=1000") return send(200, { pods: [POD] });
      if (q.method === "GET" && q.url === "/v2/pods/" + POD.id) return send(200, POD);
      if (/^\/v2\/billing\/pods/.test(q.url)) {   // 2.761.1: RunPod wants startTime AND endTime
        const u = new URL(q.url, "http://x"); if (!u.searchParams.get("startTime") || !u.searchParams.get("endTime")) return send(400, { detail: "startTime and endTime must be provided together" });
        return send(200, { records: [{ startTime: new Date().toISOString(), podId: POD.id, totalAmount: 1.25 }], metadata: {} }); }
      if (/^\/v2\/catalog\/templates/.test(q.url)) return send(200, { templates: [], pagination: { hasNextPage: false } });
      send(404, {});
    });
  });
  try { await new Promise((ok, bad) => { rp.once("error", bad); rp.listen(8399, "127.0.0.1", ok); }); } catch { console.log("SKIP: port 8399 is busy - the 2.761.0 browser test did not run"); process.exit(0); }
  const v0 = await api("/api/remotegpu"), g0 = await api("/api/gpusplit"), c0 = await api("/api/currency").catch(() => ({}));
  await api("/api/currency", { code: "USD" }).catch(() => {});
  await api("/api/remotegpu/use", { mode: "local" });
  await api("/api/remotegpu/save", { runpod: { key: "rpa_UI761", pod_id: "", port: 3000 }, serverless: { endpoint: "" } });
  await api("/api/remotegen/enabled", { on: true });
  await api("/api/gpusplit", { where: "remote", engine: { provider: "runpod", runpod: "pods" } });
  await api("/api/pods/costs?refresh=1").catch(() => {});   // the costs are kept 50 s - an earlier test's stand-in is not this one
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.addInitScript(() => { window.H3_POD_COST_POLL = 2000; });
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3Pods && window.H3PodSetup && window.SecFloat && SecFloat.windows.pods && document.getElementById("gpuPodCost"), null, { timeout: 30000 });
    await ev(() => { if (SecFloat.windows.basic) SecFloat.show("basic", true); toggleSec("gpu", false); }); await sleep(500);
    await p.waitForFunction(() => /RunPod pods/.test((document.getElementById("gpuPodCost") || {}).textContent || ""), null, { timeout: 15000 }).catch(() => {});
    const cost = await ev(() => { const e = document.getElementById("gpuPodCost"); return { t: e.textContent, shown: e.offsetParent !== null }; });
    check("Basic Settings ▸ GPU (RunPod ▸ Pods): 💲 the pods' cost - 1 running at $0.69/h now, RunPod's bill today and this month", cost.shown && /💲 RunPod pods: 1 running · \$0\.69\/h now · \$1\.25 today · \$1\.25 this month/.test(cost.t), cost);
    await ev(() => H3Pods.show(true)); await sleep(500);
    await p.click('[data-pdsrc="mine"]');
    await p.waitForFunction(() => document.querySelector('#pdPods .pdRow[data-pod="pod761u"] .pdHead'), null, { timeout: 10000 });
    const closed = await ev(() => { const r = document.querySelector('#pdPods .pdRow[data-pod="pod761u"]'); return { open: r.classList.contains("open"), body: r.querySelector(".pdBodyIn").hidden, head: r.querySelector(".pdHead").textContent, exp: r.querySelector(".pdHead").getAttribute("aria-expanded") }; });
    check("My pods: the pod is a closed item - its name a button (▸, the GPU, $/h, its cost this month), the body hidden", !closed.open && closed.body && /^▸Item pod/.test(closed.head) && /\$1\.25 today, \$1\.25 this month/.test(closed.head) && closed.exp === "false", closed);
    await p.click('#pdPods .pdRow[data-pod="pod761u"] .pdHead'); await sleep(600);
    const row = () => ev(() => { const r = document.querySelector('#pdPods .pdRow[data-pod="pod761u"]'); return { open: r.classList.contains("open"),
      kinds: [...r.querySelectorAll("[data-pskind]")].map((c) => c.closest("label").textContent.trim() + (c.checked ? "*" : "")), save: !!(r.querySelector("[data-pssave]") || {}).disabled,
      tools: [...r.querySelectorAll(".psTools button")].map((x) => x.textContent), llm: !!r.querySelector("[data-psport]"), acts: [...r.querySelectorAll(".pdActs button")].map((x) => x.textContent), msg: (r.querySelector(".psMsg") || {}).textContent || "" }; });
    let r = await row();
    check("opened: the ticks under its name (Video, LLM, vLLM, Image, Image edit), ⬆ My custom nodes (2.763.1) + 💾 Save OFF; its own buttons below",
      r.open && r.kinds.join() === "Video,LLM,vLLM,Image,Image edit" && r.tools.join("|") === "⬆ My custom nodes|💾 Save" && r.save === true && r.acts.includes("Use it") && r.acts.includes("Terminate"), r);
    // 2.763.0 (Tim: "can we use a dropdown of our styles for the mode selected ... add an all button so that it shows all styles")
    await ev(() => { const g = document.getElementById("genModeSel"); g.value = "image"; if (typeof g.onchange === "function") g.onchange(); g.dispatchEvent(new Event("change", { bubbles: true })); });
    await sleep(500);   // the open item lists the 🖼 Image styles now (podsetup.js follows #genModeSel)
    const sty = () => ev(() => { const r = document.querySelector('#pdPods .pdRow[data-pod="pod761u"]'), sel = r.querySelector("[data-psstyle]");
      return { sel: !!sel, n: sel ? sel.options.length - 1 : 0, first: sel && sel.options[1] ? sel.options[1].textContent : "", all: (r.querySelector("[data-psall]") || {}).textContent || "", hint: (r.querySelector(".psStyles .hint") || {}).textContent || "",
        chips: [...r.querySelectorAll("[data-pschip]")].map((c) => c.dataset.pschip), ck: !!r.querySelector("[data-psck]"), lora: !!r.querySelector("[data-psloraadd]") }; });
    await p.waitForFunction(() => { const s = document.querySelector('#pdPods .pdRow[data-pod="pod761u"] [data-psstyle]'); return s && s.options.length > 1; }, null, { timeout: 10000 }).catch(() => {});
    const s1 = await sty();
    const imgN = ((await api("/api/styles?kind=image")).styles || []).filter((x) => x.runs_on !== "remote" && x.runs_on !== "api").length;
    check("2.763.0: the pod's Styles - a dropdown of your image styles (the Generate mode is 🖼 Image) + All; no checkpoint / LoRA dropdowns any more", s1.sel && s1.n === imgN && /image styles/.test(s1.hint) && s1.all === "All" && !s1.ck && !s1.lora, { s1, imgN });
    await p.click('#pdPods .pdRow[data-pod="pod761u"] [data-psall]'); await sleep(400);
    const s2 = await sty();
    check("…All lists every kind (more than the image ones)", s2.n > s1.n && /all styles/.test(s2.hint), s2);
    await p.click('#pdPods .pdRow[data-pod="pod761u"] [data-psall]'); await sleep(400);
    const pick = await ev(() => { const s = document.querySelector('#pdPods .pdRow[data-pod="pod761u"] [data-psstyle]'); s.value = s.options[1].value; s.dispatchEvent(new Event("change")); return s.value; });
    await p.click('#pdPods .pdRow[data-pod="pod761u"] [data-psadd]'); await sleep(400);
    const s3 = await sty();
    check("…＋ links the picked style (a chip), it leaves the dropdown; 💾 Save on", s3.chips.join() === pick && s3.n === s1.n - 1 && (await row()).save === false, s3);
    await p.click('#pdPods .pdRow[data-pod="pod761u"] [data-psdel]'); await sleep(400);
    check("…✕ takes it off again - nothing changed, Save off", (await sty()).chips.length === 0 && (await row()).save === true);
    await p.check('#pdPods .pdRow[data-pod="pod761u"] [data-pskind="image"]'); await sleep(200);
    check("a tick turns 💾 Save on", (await row()).save === false);
    await p.uncheck('#pdPods .pdRow[data-pod="pod761u"] [data-pskind="image"]'); await sleep(200);
    check("…untick it again (nothing changed): off again", (await row()).save === true);
    await p.check('#pdPods .pdRow[data-pod="pod761u"] [data-pskind="image"]');
    await p.check('#pdPods .pdRow[data-pod="pod761u"] [data-pskind="llm"]'); await sleep(400);
    r = await row();
    check("LLM ticked: the pod's LLM server - its port (8000) and model", r.llm && (await ev(() => document.querySelector('#pdPods [data-psport]').value)) === "8000" && r.save === false, r);
    await sleep(600);   // the LLM tick's repaint
    await p.selectOption('#pdPods .pdRow[data-pod="pod761u"] [data-psstyle]', pick);
    await p.click('#pdPods .pdRow[data-pod="pod761u"] [data-psadd]'); await sleep(300);
    await p.click('#pdPods .pdRow[data-pod="pod761u"] [data-pssave]');
    await p.waitForFunction(() => /✓ saved/.test((document.querySelector('#pdPods .pdRow[data-pod="pod761u"] .psMsg') || {}).textContent || ""), null, { timeout: 20000 }).catch(() => {});
    r = await row();
    check("💾 Save: the style linked to this pod, Image + the LLM on this pod; no P_ style made; Save OFF again",
      /1 style on this pod/.test(r.msg) && /the LLM runs on this pod/.test(r.msg) && r.save === true && r.kinds.join() === "Video,LLM*,vLLM,Image*,Image edit"
      && !((await api("/api/styles?kind=image")).styles || []).some((x) => /^P_/.test(x.name)), r);
    const set = await api("/api/pods/pod761u/setup");
    check("…kept: the ticks, the LLM's port and the style (GET /api/pods/:id/setup)", set.kinds.join() === "llm,image" && set.llm_here && set.llm.port === 8000 && set.styles.join() === pick, set);
    // Basic Settings on Pods: your own styles (each renders on its pod)
    const shown = await ev(() => fetch("/api/remotegpu/serverless/styles").then((r) => r.json()).then((j) => Object.values(j.styles).filter((s) => s.kind === "image" && !s.hide).length));
    check("2.763.0: with Pods picked in Basic Settings your own image styles are offered (not only P_)", shown >= imgN, { shown, imgN });
    await p.click('#pdPods .pdRow[data-pod="pod761u"] .pdHead'); await sleep(300);
    check("the name again closes the item", !(await row()).open);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close(); rp.close();
    try { const all = await api("/api/styles?kind=image"); for (const s of (all.styles || []).filter((x) => x.runs_on === "pod" && /^P_/.test(x.name))) await api("/api/styles/" + s.id, null, "DELETE"); } catch { /* fine */ }
    await api("/api/pods/pod761u/setup", { kinds: [], styles: [], pod_name: "Item pod", port: 3000 }).catch(() => {});
    await api("/api/currency", { code: (c0 && c0.code) || "USD" }).catch(() => {});
    await api("/api/gpusplit", { where: "local", engine: { provider: (g0.engine || {}).provider || "runpod", runpod: (g0.engine || {}).runpod || "serverless" }, llm: !!g0.llm, vlm: !!g0.vlm, image: !!g0.image, video: !!g0.video }).catch(() => {});
    await api("/api/remotegpu/use", { mode: "local" }).catch(() => {});
    await api("/api/remotegpu/save", { runpod: Object.assign({ key: "", pod_id: "", pod_name: "", cost_hr: 0, port: 8188 }, v0.runpod || {}), serverless: Object.assign({ endpoint: "" }, v0.serverless || {}) }).catch(() => {});
    await api("/api/remotegen/enabled", { on: null }).catch(() => {});
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
