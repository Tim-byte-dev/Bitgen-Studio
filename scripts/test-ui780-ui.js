#!/usr/bin/env node
/* bitGen Studio — 2.780.0 browser test: THE PODS DOCKER WITHOUT A TEMPLATE BROWSER (static/podsdock.js) on a running studio
 * (H3_URL, default :8311). The server's answers are stood in (page routes): two bitGen pods and two others on the account.
 *   tabs 🖥 My pods / 📦 Presets / ＋ Create pod - no template cards, search, kind, ComfyUI only, For style, ★ Shortcuts
 *   My pods = bitGen's pods; the others in one line (how many, $/h running) that opens to their state + ⏹ Stop
 *   ＋ Create pod = the bitGen pod form: what it is made from in one line; Create pod sends the bitGen pod's template
 * Tim (verbatim): "i think with using our clean pod template and uploading others we don't need to show any other pods except for
 * our pods what do u think?" … "i think we drop the template browser completely. it will make it less complicated"
 * No server / no Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.780.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pod = (id, name, bitgen, status, hr) => ({ id, name, bitgen, made_by_bitgen: bitgen, status, cost_hr: hr, gpu: "RTX 4090", gpus: 1, setup: null });

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.780.0 browser test did not run"); process.exit(0); }
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1400, height: 950 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    const json = (r, j, st) => r.fulfill({ status: st || 200, contentType: "application/json", body: JSON.stringify(j) });
    const created = [], acted = [];
    await p.route("**/api/pods/mine", (r) => json(r, { pods: [pod("bg1", "bitGen Krea", true, "RUNNING", 0.69), pod("bg2", "bitGen Wan", true, "EXITED", 0.44), pod("ot1", "my old ollama", false, "RUNNING", 0.44), pod("ot2", "test box", false, "EXITED", 0.2)] }));
    await p.route("**/api/pods/bitgen-template*", (r) => json(r, { id: "runpod-torch-v280", name: "Runpod Pytorch 2.8.0", image: "runpod/pytorch:2.8.0-py3.11-cuda12.8.1", ports: ["8888/http", "22/tcp"], disk: 50, comfy: false, install: true, cuda: "12.8" }));
    await p.route("**/api/pods/gpus*", (r) => json(r, { cloud: "SECURE", gpus: [{ id: "NVIDIA GeForce RTX 4090", name: "RTX 4090", memory: 24, price: 0.69, availability: "High", offered: true, max: 8 }] }));
    await p.route("**/api/pods/create", (r) => { created.push(JSON.parse(r.request().postData() || "{}")); return json(r, { pod: { id: "bg3", name: "bitGen pod" }, port: 8188 }); });
    await p.route(/\/api\/pods\/ot1\/stop$/, (r) => { acted.push("ot1 stop"); return json(r, { ok: true }); });
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3Pods && window.SecFloat && SecFloat.windows.pods, null, { timeout: 30000 });
    await ev(() => H3Pods.show(true));
    await p.waitForFunction(() => document.querySelector('#pdPods .pdRow[data-pod="bg1"]'), null, { timeout: 10000 });
    const a = await ev(() => ({ tabs: [...document.querySelectorAll("#pdBody [data-pdsrc]")].map((x) => x.dataset.pdsrc + (x.classList.contains("on") ? "*" : "") + (x.querySelector(".n").textContent ? "=" + x.querySelector(".n").textContent : "")).join(),
      old: ["pdQ", "pdKind", "pdComfy", "pdFor", "pdTpl", "pdStarAdd"].filter((i) => document.getElementById(i)), cards: document.querySelectorAll(".pdCard").length,
      rows: [...document.querySelectorAll("#pdPods .pdRow[data-pod]")].map((r) => r.dataset.pod), others: (document.querySelector("#pdOthers summary") || {}).textContent || "", msg: document.getElementById("pdMsg").textContent }));
    check("tabs: 🖥 My pods (on, 2) / 📦 Presets / ＋ Create pod - no template cards, search, kind, ComfyUI only, For style or ★ Shortcuts", /^mine\*=2,presets(=\d+)?,create$/.test(a.tabs) && !a.old.length && !a.cards, a);
    check("My pods: bitGen's two pods only", a.rows.join() === "bg1,bg2" && a.msg === "2 bitGen pods", a);
    check("…the account's other pods in one line: 2 other pods (not bitGen's) · $0.44/h running", /^2 other pods on your RunPod account \(not bitGen's\) · \$0\.44\/h running$/.test(a.others), a.others);
    await p.click("#pdOthers summary"); await sleep(200);
    const o = await ev(() => [...document.querySelectorAll("#pdOthers [data-pdother]")].map((r) => r.dataset.pdother + ":" + r.querySelector(".sub").textContent + ":" + !!r.querySelector("[data-pdostop]")));
    check("…opened: each with its state; ⏹ Stop on the running one", o.length === 2 && /^ot1:.*running:true$/.test(o[0]) && /^ot2:.*exited:false$/.test(o[1]), o);
    await p.click('#pdOthers [data-pdother="ot1"] [data-pdostop]'); await sleep(500);
    check("…⏹ Stop stops it on RunPod", acted.join() === "ot1 stop", acted);
    await p.click('[data-pdsrc="create"]');
    await p.waitForFunction(() => /Made from RunPod's Runpod Pytorch 2\.8\.0/.test((document.getElementById("pdTplLine") || {}).textContent || "") && document.getElementById("pdGpu") && document.getElementById("pdGpu").value, null, { timeout: 10000 });
    const f = await ev(() => ({ line: document.getElementById("pdTplLine").textContent, name: document.getElementById("pdName").value, mineShown: getComputedStyle(document.getElementById("pdMineBox")).display, sum: [...document.querySelectorAll("#pdSum .k")].map((k) => k.textContent + "=" + k.nextElementSibling.textContent) }));
    check("＋ Create pod: the bitGen pod form alone - made from RunPod's PyTorch template, bitGen installs ComfyUI on it; named 'bitGen pod'",
      /bitGen installs ComfyUI, the custom nodes your styles use and their files on it/.test(f.line) && f.name === "bitGen pod" && f.mineShown === "none" && f.sum.some((x) => /^ComfyUI=bitGen installs it on the pod/.test(x)) && f.sum.some((x) => /^Host=CUDA 12\.8 or newer$/.test(x)), f);
    await p.click("#pdGo"); await sleep(800);
    const after = await ev(() => document.querySelector("#pdBody [data-pdsrc].on").dataset.pdsrc);
    check("Create pod sends the bitGen pod's template, then 🖥 My pods", created[0] && created[0].templateId === "runpod-torch-v280" && created[0].gpu === "NVIDIA GeForce RTX 4090" && after === "mine", { c: created[0], after });
    check("no page errors", errs.length === 0, errs);
  } finally { await b.close(); }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
