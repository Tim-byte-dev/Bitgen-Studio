#!/usr/bin/env node
/* bitGen Studio — 2.758.0 in a REAL browser against a running studio (H3_URL / H3_PORT - default 8311) started with
 * H3_RUNPOD_REST_API=http://127.0.0.1:8399/v2 and H3_RUNPOD_PROXY=http://127.0.0.1:8399/proxy/{id}-{port} (this test's
 * stand-in RunPod + pod on 8399).
 * Tim (verbatim): "can you show progess of pod loading?" + "when pods are chosen only show pod styles, I am trying with this
 * pod ComfyUI - Qwen Image - ZiT - Boogu - Krea , how can i choose the model?" + "use overide settings when pods load but
 * disable checkpoints and lora loader, overide settings will be for step, seed and cfg and the size and aspect ratio"
 *   - ▶ Start a pod: the bar walks waiting for a GPU machine -> starting the container -> ComfyUI starting -> pod loaded
 *     (the time it took kept); the next start of it shows "of about …"
 *   - 🎨 Styles: the pod's models (the bitGen style each fits; Boogu: none) + its saved workflows -> Make P_ styles
 *   - RunPod ▸ Pods: only P_ styles in the prompt docker's list; Override style ticked; with a P_ style picked the
 *     checkpoint box and the LoRA rows are off
 * Put back afterwards (the P_ styles removed). No server / no Playwright / 8399 busy = SKIP. */
"use strict";
const path = require("path"), http = require("http");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.758.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b, m) => fetch(URL0 + p.replace(/^\//, ""), b || m ? { method: m || "POST", headers: { "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined } : undefined).then((r) => r.json());

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.758.0 browser test did not run"); process.exit(0); }
  // the stand-in: one pod that loads in steps (no machine -> container -> ComfyUI) as the test says
  const POD = { id: "pod758", name: "Qwen-ZiT-Boogu-Krea", status: "EXITED", stage: 0, imageName: "ls250824/run-comfyui-image:latest" };
  const view = () => ({ id: POD.id, name: POD.name, desiredStatus: POD.status, status: POD.status, imageName: POD.imageName, gpu: { id: "NVIDIA GeForce RTX 4090", count: 1 }, costPerHr: 0.69,
    ports: ["3000/http"], ...(POD.status === "RUNNING" && POD.stage >= 2 ? { runtime: { uptime: 30 } } : {}) });
  const UNET = ["qwen_image_2512_int8_convrot.safetensors", "z_image_turbo_bf16.safetensors", "boogu_v1.safetensors"];
  const WF = { "Boogu fast.json": { 1: { class_type: "UNETLoader", inputs: { unet_name: "boogu_v1.safetensors", weight_dtype: "default" } }, 9: { class_type: "SaveImage", inputs: { filename_prefix: "x" } } } };
  const rp = http.createServer((q, s) => {
    let b = ""; q.on("data", (d) => { b += d; }); q.on("end", () => {
      const send = (code, j) => { s.writeHead(code, { "Content-Type": "application/json" }); s.end(j == null ? "" : JSON.stringify(j)); };
      const px = /^\/proxy\/(\w+)-(\d+)(\/.*)$/.exec(q.url);
      if (px) {
        if (px[1] !== POD.id || px[2] !== "3000" || POD.stage < 3) return send(502, {});
        const p = decodeURIComponent(px[3]);
        if (p === "/system_stats") return send(200, { system: { comfyui_version: "0.3.70" } });
        const oi = /^\/object_info\/(\w+)$/.exec(p);
        if (oi) return oi[1] === "UNETLoader" ? send(200, { UNETLoader: { input: { required: { unet_name: [UNET] } } } })
          : oi[1] === "CLIPLoader" ? send(200, { CLIPLoader: { input: { required: { clip_name: [["qwen_3_4b.safetensors"]] } } } })
          : oi[1] === "VAELoader" ? send(200, { VAELoader: { input: { required: { vae_name: [["ae.safetensors"]] } } } }) : send(404, {});
        if (p === "/object_info") return send(200, {});
        if (p.startsWith("/api/userdata?dir=workflows")) return send(200, Object.keys(WF));
        const f = /^\/api\/userdata\/workflows\/(.+)$/.exec(p); if (f && WF[f[1]]) return send(200, WF[f[1]]);
        return send(404, {});
      }
      if (q.headers.authorization !== "Bearer rpa_UI758") return send(401, {});
      if (q.method === "GET" && q.url === "/v2/pods?limit=1000") return send(200, { pods: [view()] });
      if (q.method === "GET" && q.url === "/v2/pods/" + POD.id) return send(200, view());
      if (q.method === "POST" && q.url === "/v2/pods/" + POD.id + "/action") { const a = JSON.parse(b).action; if (a === "start") { POD.status = "PROVISIONING"; POD.stage = 0; } if (a === "stop") POD.status = "EXITED"; return send(200, view()); }
      if (/^\/v2\/catalog\/templates\?source=community/.test(q.url)) return send(200, { templates: [{ id: "qzbk758t", name: "ComfyUI - Qwen Image - ZiT - Boogu - Krea", image: "ls250824/run-comfyui-image:latest", disk: 60, ports: ["3000/http"], category: "NVIDIA" }], pagination: { hasNextPage: false } });
      if (/^\/v2\/catalog\/templates/.test(q.url)) return send(200, { templates: [], pagination: { hasNextPage: false } });
      send(404, {});
    });
  });
  try { await new Promise((ok, bad) => { rp.once("error", bad); rp.listen(8399, "127.0.0.1", ok); }); } catch { console.log("SKIP: port 8399 is busy - the 2.758.0 browser test did not run"); process.exit(0); }
  const v0 = await api("/api/remotegpu"), g0 = await api("/api/gpusplit");
  await api("/api/remotegpu/use", { mode: "local" });
  await api("/api/remotegpu/save", { runpod: { key: "rpa_UI758", pod_id: "", port: 3000 }, serverless: { endpoint: "" } });
  await api("/api/remotegen/enabled", { on: true });
  await api("/api/gpusplit", { where: "local", engine: { provider: "runpod", runpod: "serverless" } });
  const b = await chromium.launch();
  let made = [];
  try {
    const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 } });
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3Pods && window.H3PodLoad && document.getElementById("gpuEngine") && window.SecFloat && SecFloat.windows.pods, null, { timeout: 30000 });
    await ev(() => { window.H3_POD_POLL = 300; if (SecFloat.windows.basic) SecFloat.show("basic", true); toggleSec("gpu", false); }); await sleep(500);
    const ovr0 = await ev(() => { const o = document.getElementById("ovrStyle"); if (o && o.checked) { o.checked = false; o.dispatchEvent(new Event("change", { bubbles: true })); } return !!o; });
    await p.check('input[name="gpuRunpod"][value="pods"]'); await sleep(900);
    check("RunPod ▸ Pods ticks Override style (its steps / seed / CFG / size / aspect go with a pod render)", ovr0 && (await ev(() => document.getElementById("ovrStyle").checked)));
    await p.check('input[name="gpuWhere"][value="remote"]'); await sleep(700);
    await p.click("#gpuPods"); await sleep(600);
    await p.click('[data-pdsrc="mine"]'); await sleep(300);   // 2.760.0: the pods are under 🖥 My pods
    await p.waitForFunction(() => document.querySelector('#pdPods .pdRow[data-pod="pod758"] .pdHead'), null, { timeout: 10000 });
    await p.click('#pdPods .pdRow[data-pod="pod758"] .pdHead'); await sleep(300);   // 2.761.0: a pod is an item - open it
    await p.waitForFunction(() => document.querySelector('#pdPods .pdRow[data-pod="pod758"]'), null, { timeout: 10000 });
    // ▶ Start: the stages, as the stand-in moves through them
    await p.click('#pdPods .pdRow[data-pod="pod758"] [data-pdact="start"]');
    const bar = () => ev(() => { const r = document.querySelector('#pdPods .pdRow[data-pod="pod758"]'), t = r && r.querySelector(".pdLoadT"), i = r && r.querySelector(".pdLoad .bar i"); return t ? { t: t.textContent, w: parseFloat(i.style.width) } : null; });
    const waitBar = (re) => p.waitForFunction((src) => { const t = document.querySelector('#pdPods .pdRow[data-pod="pod758"] .pdLoadT'); return t && new RegExp(src).test(t.textContent); }, re.source, { timeout: 8000 }).then(() => bar()).catch(() => bar());
    const s0 = await waitBar(/1\/4 waiting for a GPU machine/);
    POD.status = "RUNNING"; POD.stage = 1;
    const s1 = await waitBar(/2\/4 starting the container/);
    POD.stage = 2;
    const s2 = await waitBar(/3\/4 ComfyUI starting/);
    check("▶ Start: the bar walks 1/4 waiting for a GPU machine -> 2/4 starting the container -> 3/4 ComfyUI starting (the template may be downloading its models), with the time so far, and grows",
      s0 && /so far/.test(s0.t) && s1 && /2\/4 starting the container/.test(s1.t) && s2 && /3\/4 ComfyUI starting \(the template may be downloading its models\)/.test(s2.t) && s2.w > s0.w, { s0, s1, s2 });
    await sleep(1200);
    POD.stage = 3;
    const s3 = await waitBar(/pod loaded in/);
    check("…ComfyUI answers: 'pod loaded in …', the bar full; the message line says so", s3 && /^pod loaded in \d+ s$/.test(s3.t) && s3.w === 100 && /pod loaded/.test(await ev(() => document.getElementById("pdMsg").textContent)), s3);
    const loads = (await api("/api/config")).rgpu;
    check("…how long it took is kept for the next time (by pod and by the template's image)", !!(loads && loads.pod_loads && loads.pod_loads["pod:pod758"] >= 1 && loads.pod_loads["img:ls250824/run-comfyui-image:latest"] >= 1), loads && loads.pod_loads);
    // 🎨 Styles
    await p.waitForFunction(() => document.querySelector('#pdPods .pdRow[data-pod="pod758"] [data-pdsty]'), null, { timeout: 5000 });
    await p.click('#pdPods .pdRow[data-pod="pod758"] [data-pdsty]');
    await p.waitForFunction(() => document.querySelector("#pdStyPanel [data-pmake]"), null, { timeout: 15000 });
    const pan = await ev(() => ({ rows: [...document.querySelectorAll("#pdStyPanel label")].map((l) => l.textContent.trim() + (l.querySelector("input").checked ? " [x]" : "") + (l.querySelector("input").disabled ? " [off]" : "")) }));
    check("🎨 Styles: the pod's models with the bitGen style each fits (ticked), Boogu with no bitGen workflow (off), and the pod's saved workflow (ticked)",
      pan.rows.join(" | ") === "qwen_image_2512_int8_convrot.safetensors → qwen2_1 [x] | z_image_turbo_bf16.safetensors → R_Z-Image Turbo [x] | boogu_v1.safetensors bitGen has no workflow for it - use a workflow below [off] | Boogu fast.json [x]", pan);
    await p.click("#pdStyPanel [data-pmake]");
    await p.waitForFunction(() => /^Made: /.test((document.querySelector("#pdStyPanel [data-pmsg]") || {}).textContent || ""), null, { timeout: 20000 }).catch(() => {});
    const mk = await ev(() => document.querySelector("#pdStyPanel [data-pmsg]").textContent);
    made = ((/^Made: (.*?)\./.exec(mk) || [])[1] || "").split(", ").filter(Boolean);
    check("…🎨 Make P_ styles: 'Made: P_qwen_image_2512_int8_convrot, P_z_image_turbo_bf16, P_Boogu fast.'", made.join() === "P_qwen_image_2512_int8_convrot,P_z_image_turbo_bf16,P_Boogu fast", mk);
    // only P_ styles
    await p.waitForFunction(() => [...document.querySelectorAll("#styleSel option")].some((o) => o.textContent === "P_Boogu fast"), null, { timeout: 15000 }).catch(() => {});
    const opts = await ev(() => fetch("/api/remotegpu/serverless/styles").then((r) => r.json()).then((j) => Object.values(j.styles).filter((s) => s.kind === "image" && !s.hide).map((s) => s.name).sort()));
    check("RunPod ▸ Pods (Remote): only the P_ styles are shown", opts.length === 3 && opts.every((n) => /^P_/.test(n)), opts);
    // the P_ style picked: checkpoint + LoRAs off
    await ev(() => { const s = document.getElementById("styleSel"), o = [...s.options].find((x) => x.textContent === "P_Boogu fast"); s.value = o.value; s.dispatchEvent(new Event("change", { bubbles: true })); });
    await sleep(500);
    const lk = await ev(() => ({ ck: [...document.querySelectorAll("#imgCkptCombo input, #imgCkptCombo select")].map((x) => x.disabled), note: !!document.getElementById("imgCkptComboPodNote"),
      add: [...document.querySelectorAll("#tliRows input, #tliRows button")].every((x) => x.disabled), steps: document.getElementById("imgSteps").disabled, res: document.getElementById("imgRes").disabled }));
    check("…a P_ style picked: Basic Settings' checkpoint box and temporary LoRA rows are off ('A P_ pod style: the pod's own model and LoRAs are used.'), steps and size stay on",
      lk.ck.length > 0 && lk.ck.every(Boolean) && lk.note && lk.add && !lk.steps && !lk.res, lk);
    // pod shortcuts on the cards (Tim: "add to pod's card in pods docker can bitgen fill in the template link automatically?")
    await p.click('[data-pdsrc="all"]');   // 2.760.0: back to the templates
    await p.click("#pdRefresh");
    await p.waitForFunction(() => document.querySelector('#pdTpl .pdCard[data-tpl="qzbk758t"] [data-pdstar]'), null, { timeout: 10000 }).catch(() => {});
    await p.click('#pdTpl .pdCard[data-tpl="qzbk758t"] [data-pdstar]');
    await p.waitForFunction(() => /★ kept/.test(document.getElementById("pdMsg").textContent), null, { timeout: 5000 }).catch(() => {});
    const sc = await api("/api/remotegen");
    check("☆ on a template's card keeps it as a shortcut - its link filled in by bitGen (its ID + name), the ☆ now ★, Deploy ↗ = RunPod's deploy page + bitGen's referral code",
      (sc.shortcuts || []).length === 1 && sc.shortcuts[0].id === "qzbk758t" && sc.shortcuts[0].name === "ComfyUI - Qwen Image - ZiT - Boogu - Krea"
      && (await ev(() => { const c = document.querySelector('#pdTpl .pdCard[data-tpl="qzbk758t"]'); return c.querySelector("[data-pdstar]").textContent === "★" && c.querySelector(".pdDeploy").href === "https://runpod.io/console/deploy?template=qzbk758t&ref=gbj9zxqh"; })), sc);
    await p.click('[data-pdsrc="star"]'); await sleep(300);
    await p.fill("#pdCutLink", "https://example.com/nothing"); await p.click("#pdCutAdd"); await sleep(500);
    const bad = await ev(() => document.getElementById("pdMsg").textContent);
    await p.fill("#pdCutLink", "https://www.runpod.io/console/explore/priv7581"); await p.press("#pdCutLink", "Enter"); await sleep(700);
    const st = await ev(() => ({ cards: [...document.querySelectorAll("#pdTpl .pdCard")].map((c) => c.dataset.tpl), n: document.querySelector('[data-pdsrc="star"] .n').textContent, add: document.getElementById("pdStarAdd").style.display }));
    check("★ Shortcuts: the kept template + a private one added by its link (a link that is not RunPod's refused); the count; the paste box only on this tab",
      /not a RunPod template link/.test(bad) && st.cards.join() === "qzbk758t,priv7581" && st.n === "2" && st.add === "", { bad, st });
    await p.click('#pdTpl .pdCard[data-tpl="qzbk758t"] [data-pdstar]'); await sleep(600);
    check("…★ again removes it", (await api("/api/remotegen")).shortcuts.map((c) => c.id).join() === "priv7581");
    await api("/api/remotegen/shortcuts", { remove: "priv7581" });
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close(); rp.close();
    try { for (const c of ((await api("/api/remotegen")).shortcuts || [])) await api("/api/remotegen/shortcuts", { remove: c.id }); } catch { /* fine */ }
    try { const all = await api("/api/styles?kind=image"); for (const s of (all.styles || []).filter((x) => x.runs_on === "pod" && /^P_/.test(x.name))) await api("/api/styles/" + s.id, null, "DELETE"); } catch { /* fine */ }
    await api("/api/gpusplit", { where: "local", engine: { provider: (g0.engine || {}).provider || "runpod", runpod: (g0.engine || {}).runpod || "serverless" }, llm: !!g0.llm, vlm: !!g0.vlm, image: !!g0.image, video: !!g0.video }).catch(() => {});
    await api("/api/remotegpu/use", { mode: "local" }).catch(() => {});
    await api("/api/remotegpu/save", { runpod: Object.assign({ key: "", pod_id: "", pod_name: "", cost_hr: 0, port: 8188 }, v0.runpod || {}), serverless: Object.assign({ endpoint: "" }, v0.serverless || {}) }).catch(() => {});
    await api("/api/remotegen/enabled", { on: null }).catch(() => {});
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
