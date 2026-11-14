#!/usr/bin/env node
/* bitGen Studio — 2.775.0 browser test: AUDIO ON A POD in 🖥 PODS (static/podsdock.js create form + static/podaudio.js My pods)
 * on a running studio (H3_URL, default :8311). RunPod's lists and the pod come from the page's own stand-ins (page.route).
 * Tim (verbatim): "when we create the pod can we have a button for tts, stt and demacus(sheet music) and allow bitgen to clone
 * voices and store the voice locally until user selects that voice"
 * No server / no Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.775.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.775.0 browser test did not run"); process.exit(0); }
  const real = await fetch(URL0 + "api/pods/nopod775/audio").then((r) => r.json()).catch((e) => ({ err: String(e) }));
  check("GET /api/pods/:id/audio answers {kinds, install} (lib/podAudio.js status)", real && Array.isArray(real.kinds) && "install" in real, real);
  const json = (route, j) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(j) });
  const POD = { id: "pod775u", name: "Audio pod", status: "RUNNING", desiredStatus: "RUNNING", gpu: "RTX 4090", gpus: 1, cost_hr: 0.69, bitgen: true, made_by_bitgen: true };
  let AUD = { kinds: [], install: null };
  const posted = [], created = [];
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.route("**/api/pods/mine", (r) => json(r, { pods: [POD] }));
    await p.route("**/api/pods/activity", (r) => json(r, { pods: {} }));
    await p.route("**/api/pods/costs*", (r) => json(r, { pods: {} }));
    await p.route("**/api/pods/selected", (r) => json(r, { selected: [] }));
    await p.route("**/api/pods/pod775u/stats*", (r) => json(r, { gpus: [] }));
    await p.route("**/api/pods/pod775u/audio", (r) => {
      if (r.request().method() === "POST") { const k = JSON.parse(r.request().postData() || "{}").kinds || []; posted.push(k); AUD = { kinds: k, install: { running: true, state: "installing tts (omnivoice, soundfile)", done: [], failed: {} } }; }
      return json(r, AUD);
    });
    await p.route("**/api/pods/create", (r) => { created.push(JSON.parse(r.request().postData() || "{}")); return json(r, { pod: { id: "pod775u", name: "Audio pod" }, port: 8188 }); });
    await p.route("**/api/pods/bitgen-template*", (r) => json(r, { id: "pt28", name: "Runpod Pytorch 2.8.0", image: "runpod/pytorch:2.8.0-py3.11-cuda12.8.1-cudnn-devel-ubuntu22.04", ports: ["8888/http", "22/tcp"], disk: 50, comfy: false, install: true, cuda: "12.8" }));   // 2.780.0
    await p.route("**/api/pods/templates*", (r) => json(r, { source: "all", total: 1, counts: { official: 1 }, failed: [], templates: [
      { id: "pt28", name: "Runpod Pytorch 2.8.0", image: "runpod/pytorch:2.8.0-py3.11-cuda12.8.1-cudnn-devel-ubuntu22.04", ports: ["8888/http", "22/tcp"], comfy: false, port: 8888, category: "NVIDIA", source: "official" }] }));
    await p.route("**/api/pods/gpus*", (r) => json(r, { cloud: "SECURE", gpus: [{ id: "NVIDIA GeForce RTX 4090", name: "RTX 4090", memory: 24, price: 0.69, availability: "High", offered: true, max: 8 }] }));
    await p.addInitScript(() => { window.H3_POD_AUDIO_POLL = 300; });
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3Pods && window.H3PodAudio && window.SecFloat && SecFloat.windows.pods, null, { timeout: 30000 });
    await ev(() => H3Pods.show(true)); await sleep(600);
    // the create form
    await p.click('[data-pdsrc="create"]');   // 2.780.0: ＋ Create pod (no template cards)
    await p.waitForSelector("#pdForm [data-pdaudio]", { timeout: 10000 });
    const f0 = await ev(() => ({ ticks: [...document.querySelectorAll("#pdForm [data-pdaudio]")].map((c) => c.dataset.pdaudio + ":" + c.parentNode.textContent.trim() + ":" + c.checked),
      sum: [...document.querySelectorAll("#pdSum .k")].map((k) => k.textContent + "=" + (k.nextElementSibling || {}).textContent).find((x) => /^Audio=/.test(x)) }));
    check("the create form: Audio ☐ Text to speech ☐ Speech to text ☐ Song separation (none ticked); the summary says they stay on this computer",
      JSON.stringify(f0.ticks) === JSON.stringify(["tts:Text to speech:false", "stt:Speech to text:false", "stems:Song separation:false"]) && /stay on this computer/.test(f0.sum || ""), f0);
    await p.check('#pdForm [data-pdaudio="tts"]'); await p.check('#pdForm [data-pdaudio="stems"]'); await sleep(300);
    const sum1 = await ev(() => [...document.querySelectorAll("#pdSum .k")].map((k) => k.textContent + "=" + (k.nextElementSibling || {}).textContent).find((x) => /^Audio=/.test(x)));
    check("…ticked: the summary names them, installed on the pod", /Text to speech, Song separation installed on it/.test(sum1 || ""), sum1);
    await p.click("#pdGo"); await sleep(800);
    check("…Create pod sends audio: [tts, stems]", created[0] && JSON.stringify(created[0].audio) === '["tts","stems"]', created[0]);
    // My pods: the pod's 🔊 Audio row
    await p.click('[data-pdsrc="mine"]').catch(() => 0);
    await ev(() => { const h = document.querySelector('#pdPods .pdRow[data-pod="pod775u"] .pdHead'); const r = h && h.closest(".pdRow"); if (r && !r.classList.contains("open")) h.click(); });
    await p.waitForSelector('#pdPods .pdRow[data-pod="pod775u"] .paRow [data-paaud]', { timeout: 10000 });
    const r0 = await ev(() => { const r = document.querySelector('#pdPods .pdRow[data-pod="pod775u"] .paRow'); return { ticks: [...r.querySelectorAll("[data-paaud]")].map((c) => c.dataset.paaud + ":" + c.checked), line: r.querySelector(".paLine").textContent, after: r.previousElementSibling && r.previousElementSibling.className }; });
    check("My pods: under the pod's 'what it is for' ticks, 🔊 Audio with the three ticks and a line (none = on this computer)",
      JSON.stringify(r0.ticks) === '["tts:false","stt:false","stems:false"]' && /run on this computer/.test(r0.line) && /psKinds/.test(r0.after || ""), r0);
    await p.check('#pdPods .pdRow[data-pod="pod775u"] .paRow [data-paaud="stt"]'); await sleep(900);
    const r1 = await ev(() => { const r = document.querySelector('#pdPods .pdRow[data-pod="pod775u"] .paRow'); return { ticks: [...r.querySelectorAll("[data-paaud]")].map((c) => c.dataset.paaud + ":" + c.checked), line: r.querySelector(".paLine").textContent }; });
    check("…a tick is saved at once (POST kinds) and the line says the install is running", JSON.stringify(posted[0]) === '["stt"]' && /⏳ installing tts/.test(r1.line) && r1.ticks.includes("stt:true"), { posted, r1 });
    AUD = { kinds: ["stt"], install: { running: false, state: "done", done: ["stt"], failed: {} } }; await sleep(1200);
    const l2 = await ev(() => document.querySelector('#pdPods .pdRow[data-pod="pod775u"] .paRow .paLine').textContent);
    check("…when it is done: ✓ on the pod: stt", /✓ on the pod: stt/.test(l2), l2);
    check("no page errors", errs.length === 0, errs);
  } finally { await b.close(); }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
