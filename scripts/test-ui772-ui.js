#!/usr/bin/env node
/* bitGen Studio — 2.772.0 browser test: WHAT A POD IS DOING, ON THE POD (static/podsdock.js + GET /api/pods/activity) and the
 * create form for RunPod's PyTorch template (bitGen installs ComfyUI there) on a running studio (H3_URL, default :8311).
 * The pod, its activity and RunPod's lists come from the page's own stand-ins (page.route) - no RunPod is asked.
 * Tim (verbatim): "in the pod that is installing and being used show what is being done, then hide the completed tasks in a
 * dropdown so the pods details don't get too big. say what it is doing, downloading, loading, finding etc"
 * No server / no Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.772.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.772.0 browser test did not run"); process.exit(0); }
  const real = await fetch(URL0 + "api/pods/activity").then((r) => r.json()).catch((e) => ({ err: String(e) }));
  check("GET /api/pods/activity answers {pods: {…}} (lib/podActivity.js all)", real && real.pods && typeof real.pods === "object" && !Array.isArray(real.pods), real);
  const inst = await fetch(URL0 + "api/pods/nopod772/install").then((r) => r.json()).catch((e) => ({ err: String(e) }));
  check("GET /api/pods/:id/install answers (nothing installing on that pod: null)", inst && Object.prototype.hasOwnProperty.call(inst, "install") && inst.install === null, inst);

  const POD = { id: "pod772u", name: "Blank pod", status: "RUNNING", desiredStatus: "RUNNING", gpu: "RTX 4090", gpus: 1, cost_hr: 0.69, bitgen: true, made_by_bitgen: true,
    setup: { phase: "installing", note: "installing what ComfyUI needs" } };
  const T = (o) => Object.assign({ state: "done", result: false }, o);
  let ACT = { now: [T({ verb: "Installing", icon: "📦", text: "installing what ComfyUI needs - collecting av (3)", rest: "what ComfyUI needs - collecting av (3)", state: "running", secs: 75 })],
    done: [T({ verb: "Creating", icon: "✨", text: "making ComfyUI's Python environment - already there", rest: "making ComfyUI's Python environment - already there", state: "skipped", secs: 0 }),
      T({ verb: "Downloading", icon: "⬇", text: "downloaded ComfyUI - 0.42.0", rest: "ComfyUI - 0.42.0", secs: 12 }),
      T({ verb: "Finding", icon: "🔍", text: "found what the pod has - Python 3.11 · PyTorch 2.8.0 (CUDA 12.8)", rest: "found what the pod has - Python 3.11 · PyTorch 2.8.0 (CUDA 12.8)", secs: 4 })], last: null, at: 1 };
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    const json = (route, j) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(j) });
    await p.route("**/api/pods/mine", (r) => json(r, { pods: [POD] }));
    await p.route("**/api/pods/activity", (r) => json(r, { pods: { pod772u: ACT } }));
    await p.route("**/api/pods/costs*", (r) => json(r, { pods: {} }));
    await p.route("**/api/pods/selected", (r) => json(r, { selected: [] }));
    await p.route("**/api/pods/pod772u/stats*", (r) => json(r, { gpus: [] }));
    await p.route("**/api/pods/templates*", (r) => json(r, { source: "all", total: 2, counts: { official: 2 }, failed: [], templates: [
      { id: "pt28", name: "Runpod Pytorch 2.8.0", image: "runpod/pytorch:2.8.0-py3.11-cuda12.8.1-cudnn-devel-ubuntu22.04", ports: ["8888/http", "22/tcp"], comfy: false, port: 8888, category: "NVIDIA", source: "official" },
      { id: "cf13", name: "ComfyUI - CUDA 13.0", image: "runpod/comfyui:cuda13.0", ports: ["8188/http", "8888/http"], comfy: true, port: 8188, category: "NVIDIA", source: "official" }] }));
    await p.route("**/api/pods/gpus*", (r) => json(r, { cloud: "SECURE", gpus: [{ id: "NVIDIA GeForce RTX 4090", name: "RTX 4090", memory: 24, price: 0.69, availability: "High", offered: true, max: 8 }] }));
    await p.addInitScript(() => { window.H3_POD_ACT_POLL = 250; });
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3Pods && window.SecFloat && SecFloat.windows.pods, null, { timeout: 30000 });
    await ev(() => H3Pods.show(true)); await sleep(500);
    await p.click('[data-pdsrc="mine"]');
    await p.waitForFunction(() => document.querySelector('#pdPods .pdRow[data-pod="pod772u"] .pdNow'), null, { timeout: 10000 });
    const a1 = await ev(() => { const r = document.querySelector('#pdPods .pdRow[data-pod="pod772u"]'), n = r.querySelector(".pdDoing .pdNow"), d = r.querySelector(".pdDoing details.pdDone");
      return { open: r.classList.contains("open"), cls: n.className, ic: n.querySelector(".ic").textContent, vb: n.querySelector(".vb").textContent, tx: n.querySelector(".tx").textContent, tm: n.querySelector(".tm").textContent,
        sum: d && d.querySelector("summary").textContent, dOpen: d && d.open, made: !!r.querySelector(".pdMade"), vis: n.getBoundingClientRect().height > 0, body: r.querySelector(".pdBodyIn").getBoundingClientRect().height, li: d ? d.querySelectorAll("li").length : -1 }; });
    check("the pod (closed - its body really hidden now: 0 px) shows what it is doing NOW - 📦 Installing what ComfyUI needs - collecting av (3), 1 min 15 s so far; no 'made by bitGen' line beside it",
      !a1.open && a1.body === 0 && a1.vis && /run/.test(a1.cls) && a1.ic === "📦" && a1.vb === "Installing" && a1.tx === "what ComfyUI needs - collecting av (3)" && a1.tm === "1 min 15 s" && !a1.made, a1);
    check("…the finished tasks are in a CLOSED dropdown: ✓ 2 done · 1 already there", a1.sum === "✓ 2 done · 1 already there" && a1.dOpen === false && a1.li === 3, a1);
    await p.click('#pdPods .pdRow[data-pod="pod772u"] details.pdDone summary');
    const a2 = await ev(() => [...document.querySelectorAll('#pdPods .pdRow[data-pod="pod772u"] details.pdDone li')].map((l) => ({ cls: l.className, st: l.querySelector(".st").textContent, t: l.querySelector(".tx").textContent, tm: l.querySelector(".tm").textContent, h: l.getBoundingClientRect().height > 0 })));
    check("…opened: newest first - each with ✓ / – (already there), its verb and what, how long (Finding … 4 s)",
      a2.length === 3 && a2.every((x) => x.h) && a2[0].cls === "skipped" && a2[0].st === "–" && /^Creating making ComfyUI's Python environment - already there$/.test(a2[0].t) && a2[1].st === "✓" && a2[1].t === "Downloading ComfyUI - 0.42.0" && a2[1].tm === "12 s" && /^Finding found what the pod has - Python 3\.11/.test(a2[2].t) && a2[2].tm === "4 s", a2);
    // the activity moves on: the dropdown stays open, the line says the new thing
    ACT = { now: [T({ verb: "Loading", icon: "⏳", text: "loading ComfyUI - Import times for custom nodes:", rest: "ComfyUI - Import times for custom nodes:", state: "running", secs: 20 })],
      done: [T({ verb: "Installing", icon: "📦", text: "installed what ComfyUI needs - 41 packages added", rest: "what ComfyUI needs - 41 packages added", secs: 140 })].concat(ACT.done), last: null, at: 2 };
    await p.waitForFunction(() => /Loading/.test((document.querySelector('#pdPods .pdRow[data-pod="pod772u"] .pdNow .vb') || {}).textContent || ""), null, { timeout: 5000 }).catch(() => {});
    if (process.env.UI772_SHOT) await p.locator('#pdPods .pdRow[data-pod="pod772u"]').screenshot({ path: process.env.UI772_SHOT });   // a picture (by hand)
    const a3 = await ev(() => { const r = document.querySelector('#pdPods .pdRow[data-pod="pod772u"]'), d = r.querySelector("details.pdDone"); return { vb: r.querySelector(".pdNow .vb").textContent, tx: r.querySelector(".pdNow .tx").textContent, open: d.open, sum: d.querySelector("summary").textContent, first: d.querySelector("li .tx").textContent }; });
    check("the activity moves on (every 2.5 s): ⏳ Loading ComfyUI - … now; the dropdown stays OPEN as you left it, ✓ 3 done with Installing … 41 packages added on top",
      a3.vb === "Loading" && a3.tx === "ComfyUI - Import times for custom nodes:" && a3.open === true && a3.sum === "✓ 3 done · 1 already there" && a3.first === "Installing what ComfyUI needs - 41 packages added", a3);
    // done: nothing running - the result line
    ACT = { now: [], done: [T({ verb: "Working", icon: "⚙", text: "ComfyUI 0.42.0 installed and running (PyTorch 2.8.0)", rest: "ComfyUI 0.42.0 installed and running (PyTorch 2.8.0)", result: true, secs: 0 })].concat(ACT.done),
      last: { ok: true, text: "ComfyUI 0.42.0 installed and running (PyTorch 2.8.0)" }, at: 3 };
    await p.waitForFunction(() => document.querySelector('#pdPods .pdRow[data-pod="pod772u"] .pdNow.ok'), null, { timeout: 5000 }).catch(() => {});
    const a4 = await ev(() => { const r = document.querySelector('#pdPods .pdRow[data-pod="pod772u"]'), n = r.querySelector(".pdNow"); return { n: r.querySelectorAll(".pdNow").length, cls: n.className, txt: n.textContent, sum: r.querySelector("details.pdDone summary").textContent }; });
    check("…finished: one line ✓ Done ComfyUI 0.42.0 installed and running - the result is not repeated in the dropdown (still ✓ 3 done)", a4.n === 1 && /ok/.test(a4.cls) && a4.txt === "✓DoneComfyUI 0.42.0 installed and running (PyTorch 2.8.0)" && a4.sum === "✓ 3 done · 1 already there", a4);
    ACT = { now: [], done: [T({ verb: "Working", icon: "⚙", text: "ComfyUI was not installed: git clone did not work - fatal: unable to access", rest: "", state: "failed", result: true })].concat(ACT.done),
      last: { ok: false, text: "ComfyUI was not installed: git clone did not work - fatal: unable to access" }, at: 4 };
    await p.waitForFunction(() => document.querySelector('#pdPods .pdRow[data-pod="pod772u"] .pdNow.bad'), null, { timeout: 5000 }).catch(() => {});
    const a5 = await ev(() => { const n = document.querySelector('#pdPods .pdRow[data-pod="pod772u"] .pdNow'); return { cls: n.className, txt: n.textContent, col: getComputedStyle(n.querySelector(".vb")).color }; });
    check("…stopped: ✗ Stopped <the reason>, in red", /bad/.test(a5.cls) && a5.txt === "✗StoppedComfyUI was not installed: git clone did not work - fatal: unable to access" && a5.col === "rgb(238, 102, 102)", a5);
    // the create form on RunPod's PyTorch template says bitGen installs ComfyUI there
    await p.click('[data-pdsrc="all"]'); await p.waitForSelector('[data-pdcreate="pt28"]', { timeout: 8000 });
    await p.click('[data-pdcreate="pt28"]');
    await p.waitForFunction(() => /ComfyUI/.test((document.getElementById("pdSum") || {}).textContent || "") && /RTX 4090/.test((document.getElementById("pdSum") || {}).textContent || ""), null, { timeout: 8000 }).catch(() => {});
    const f1 = await ev(() => { const s = document.getElementById("pdSum"); const rows = {}; const k = s ? [...s.querySelectorAll(".k")] : []; k.forEach((x) => { rows[x.textContent] = x.nextElementSibling.textContent; }); return rows; });
    check("the create form on RunPod's PyTorch template: ComfyUI = bitGen installs it (newest, + ComfyUI-Manager, the template's PyTorch); port 8188 opened; a CUDA 12.8 host",
      /^bitGen installs it on the pod - the newest ComfyUI from GitHub \+ ComfyUI-Manager, reusing the template's PyTorch/.test(f1.ComfyUI || "") && /8888\/http, 22\/tcp \+ 8188 \(ComfyUI\) \+ Jupyter/.test(f1.Ports || "") && f1.Host === "CUDA 12.8 or newer", f1);
    await p.click("#pdClose").catch(() => {});
    await p.click('[data-pdcreate="cf13"]');
    await sleep(400);
    const f2 = await ev(() => { const s = document.getElementById("pdSum"); const rows = {}; [...s.querySelectorAll(".k")].forEach((x) => { rows[x.textContent] = x.nextElementSibling.textContent; }); return rows; });
    check("…on a ComfyUI template: the template's own ComfyUI, no extra port", f2.ComfyUI === "the template's own" && !/8188 \(ComfyUI\)/.test(f2.Ports || ""), f2);
    check("no script errors", errs.length === 0, errs);
  } finally { await b.close(); }
  console.log("\n" + pass + " passed, " + fail + " failed");
  console.log("RESULT: " + (fail ? "FAIL" : "PASS"));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: " + (e && e.stack || e)); console.log("RESULT: FAIL"); process.exit(1); });
