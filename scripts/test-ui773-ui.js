#!/usr/bin/env node
/* bitGen Studio — 2.773.0 browser test: REMOTE MODE IN THE LEFT DOCKER'S SYSTEM STATS (static/remotestats.js + index.html
 * refreshStats) and the Generate mode told to the server (static/remoteprep.js) on a running studio (H3_URL, default :8311).
 * The pod's figures come from the page's own stand-in (page.route) - no RunPod is asked.
 * Tim (verbatim): "when in remote mode , show the remote gpus/ram/cpu/hdd stats in the left docker instead of the local stats"
 * + "if in any image mode then only upload or check image styles, if in video mode , then only upload/check the video styles"
 * No server / no Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.773.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const MB = 1048576, GB = 1e9;

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.773.0 browser test did not run"); process.exit(0); }
  const real = await fetch(URL0 + "api/pods/remote-stats").then((r) => r.json()).catch((e) => ({ err: String(e) }));
  check("GET /api/pods/remote-stats answers (this studio is not in remote mode: {remote: null})", real && Object.prototype.hasOwnProperty.call(real, "remote") && real.remote === null, real);
  let REM = { remote: { pod_id: "p773", name: "Krea pod" }, stats: { cpu: 38, cpu_temp: null, ram_used: 20480, ram_total: 65536,
    gpus: [{ index: 0, name: "NVIDIA RTX A6000", util: 87, temp: 71, mem_used: 30000, mem_total: 49140 }],
    disks: [{ path: "/", used: 12 * GB, total: 50 * GB }, { path: "/workspace", used: 80 * GB, total: 100 * GB }] } };
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    const json = (route, j) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(j) });
    await p.route("**/api/pods/remote-stats", (r) => json(r, REM));
    const starts = [];
    await p.route("**/api/remoteprep/start", (r) => { try { starts.push(JSON.parse(r.request().postData() || "{}")); } catch { starts.push({}); } return json(r, { pods_mode: false, where: {}, mode: null }); });
    await p.addInitScript(() => { window.H3_REMOTE_STATS_POLL = 300; });
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3RemoteStats && /☁ Krea pod/.test((document.getElementById("stats").previousElementSibling || {}).textContent || ""), null, { timeout: 30000 }).catch(() => {});
    await p.waitForFunction(() => /A6000/.test(document.getElementById("stats").textContent), null, { timeout: 10000 }).catch(() => {});
    const a1 = await ev(() => { const st = document.getElementById("stats"), h = st.previousElementSibling, f = st.querySelector(".gpuframe:not(#statsDisks)");
      const val = (lbl) => { const e = [...st.querySelectorAll(".stat")].find((x) => (x.querySelector(".row span") || {}).textContent === lbl); return e ? e.querySelector("b").textContent : null; };
      const disks = [...st.querySelectorAll("#statsDisks .stat")].map((x) => x.querySelector("span").textContent + "=" + x.querySelector("b").textContent);
      return { head: h.textContent, gpu: f ? f.querySelector(".gtitle span").textContent : "", gpuHead: f ? f.querySelector(".gtitle b").textContent : "", cpu: val("CPU load"), temp: val("CPU temp"), ram: val("RAM"), disks, frames: st.querySelectorAll(".gpuframe:not(#statsDisks)").length }; });
    check("remote mode: the left docker's System says ☁ Krea pod; the GPU is the pod's (RTX A6000 · 87% · 71°C · 29.3GB), CPU load 38%, RAM 20.0/64GB, CPU temp n/a",
      a1.head === "System · ☁ Krea pod" && a1.gpu === "GPU0 · RTX A6000" && a1.gpuHead === "87% · 71°C · 29.3GB" && a1.cpu === "38%" && a1.ram === "20.0/64GB" && a1.temp === "n/a" && a1.frames === 1, a1);
    if (process.env.UI773_SHOT) await p.locator("#stats").screenshot({ path: process.env.UI773_SHOT });   // a picture (by hand)
    check("…the pod's disks as bars (the container disk, /workspace)", a1.disks.join() === "Disk /=12.0/50.0GB,Disk /workspace=80.0/100.0GB", a1.disks);
    // back to Local: this computer's figures, the pod's frames gone
    REM = { remote: null };
    await p.waitForFunction(() => (document.getElementById("stats").previousElementSibling || {}).textContent === "System", null, { timeout: 10000 }).catch(() => {});
    await p.waitForTimeout(1500);
    const a2 = await ev(() => { const st = document.getElementById("stats"); return { head: st.previousElementSibling.textContent, disks: !!document.getElementById("statsDisks"), a6000: /A6000/.test(st.textContent) }; });
    check("Local again: System = this computer's figures; the pod's GPU and disks gone", a2.head === "System" && !a2.disks && !a2.a6000, a2);
    REM = { remote: { none: "no pod in use yet - PODS ▸ My pods ▸ Use it" } };
    await p.waitForFunction(() => /no pod in use/.test((document.getElementById("stats").previousElementSibling || {}).title || ""), null, { timeout: 10000 }).catch(() => {});
    const a3 = await ev(() => { const h = document.getElementById("stats").previousElementSibling; return { t: h.textContent, title: h.title, one: h.scrollHeight <= h.clientHeight + 2 && getComputedStyle(h).whiteSpace === "nowrap" }; });
    check("remote mode with no pod in use: this computer's figures - the heading short (one line), why in its tooltip",
      a3.t === "System · this computer" && a3.title === "Remote mode - no pod in use yet - PODS ▸ My pods ▸ Use it" && a3.one, a3);
    // the Generate mode goes to the server (it makes ready only that mode's styles)
    await p.waitForFunction(() => document.getElementById("genModeSel"), null, { timeout: 10000 });
    const n0 = starts.length;
    await ev(() => { const s = document.getElementById("genModeSel"); s.value = "image"; s.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(800);
    const last = starts[starts.length - 1] || {};
    check("the prompt docker's Generate mode (🖼 Image) and the Image style are told to the server on change (and at start)",
      starts.length > n0 && last.gen_mode === "image" && Object.prototype.hasOwnProperty.call(last, "image_style_id") && starts.some((x) => x.gen_mode !== undefined), { n0, starts });
    await ev(() => { const s = document.getElementById("genModeSel"); s.value = "video"; s.dispatchEvent(new Event("change")); });
    check("no script errors", errs.length === 0, errs);
  } finally { await b.close(); }
  console.log("\n" + pass + " passed, " + fail + " failed");
  console.log("RESULT: " + (fail ? "FAIL" : "PASS"));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: " + (e && e.stack || e)); console.log("RESULT: FAIL"); process.exit(1); });
