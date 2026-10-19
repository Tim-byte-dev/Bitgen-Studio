#!/usr/bin/env node
/* bitGen Studio — 2.504.0 in a REAL browser: the preview's ⚡ DLSS 5 (static/dlss5panel.js) and the ⚙ Upscaler's DLSS 5.
 * Tim linked https://github.com/RH-RunningHub/ComfyUI-RH-DLSS5 with his "secret sauce" H3 workflow.
 *   1. ⚡ DLSS 5 in the preview bar opens its panel for the video playing: 1280x720 at 2K -> about 2560x1440 (x2)
 *   2. 4K -> 3840x2160 (x3); frame generation 2x is said; ⚡ Enhance sends the name + the choices, closes, follows the job
 *   3. a size DLSS cannot reach is said in words and Enhance stays off; a live preview cannot be sent
 *   4. the ⚙ Upscaler offers DLSS 5; opening DLSS 5 closes the SeedVR2 panel
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the DLSS 5 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  let clip = "", before = null;
  try {
    before = (await (await fetch(URL_ + "api/dlss5/settings")).json()).settings;
    const sent = [];
    await p.route("**/api/dlss5", (r) => { if (r.request().method() !== "POST") return r.continue(); sent.push(JSON.parse(r.request().postData() || "{}")); r.fulfill({ json: { id: "dl1", note: "x", target: { width: 3840, height: 2160, factor: 3 } } }); });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3_PROJECT_READY && window.PvDlss5 && window.Dlss5Panel && window.SeedVR2Panel, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    const where = await (await fetch(URL_ + "api/outputs/where")).json();
    const proj = (where.dirs || where).find((x) => x.where === "project");
    clip = path.join(proj.dir, "output", `dlui_${process.pid}.mp4`);
    fs.mkdirSync(path.dirname(clip), { recursive: true });
    execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=24", "-t", "1", "-pix_fmt", "yuv420p", "-c:v", "libx264", clip]);
    const name = path.basename(clip);
    await fetch(URL_ + "api/dlss5/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "2K", fps: "off", style: "default" }) });
    await ev((n) => { curVideo = null; playVideo(n); }, name);
    await p.waitForTimeout(600);
    await ev(() => { document.getElementById("pvSeedvr2").click(); });
    await p.waitForTimeout(300);
    await ev(() => document.getElementById("pvDlss5").click());
    await p.waitForFunction(() => document.getElementById("dlPlan") && /→/.test(document.getElementById("dlPlan").textContent), null, { timeout: 15000 }).catch(() => {});
    const u1 = await ev(() => ({ shown: !document.getElementById("dlPanel").classList.contains("hidden"), src: document.getElementById("dlSrc").textContent,
      plan: document.getElementById("dlPlan").textContent, mode: document.getElementById("dlMode").value, go: document.getElementById("dlGo").disabled,
      btn: document.getElementById("pvDlss5").textContent, sv: window.SeedVR2Panel.shown(), modes: [...document.getElementById("dlMode").options].map((o) => o.value) }));
    check("⚡ DLSS 5 in the preview bar opens its panel for the video playing: 1280×720 at 2K → about 2560×1440 (×2); the SeedVR2 panel closes",
      u1.btn === "⚡ DLSS 5" && u1.shown && u1.src === name + " · preview" && u1.mode === "2K" && /1280×720 → about 2560×1440 \(×2\)/.test(u1.plan) && !u1.go && !u1.sv
      && u1.modes.includes("1x (DLAA / native)") && u1.modes.includes("4K"), u1);
    await ev(() => { const s = document.getElementById("dlMode"); s.value = "4K"; s.dispatchEvent(new Event("change")); const f = document.getElementById("dlFps"); f.value = "2x"; f.dispatchEvent(new Event("change")); document.getElementById("dlStyle").value = "cinematic"; });
    await p.waitForFunction(() => /3840×2160/.test(document.getElementById("dlPlan").textContent), null, { timeout: 10000 }).catch(() => {});
    const u2 = await ev(() => document.getElementById("dlPlan").textContent);
    await ev(() => document.getElementById("dlGo").click());
    await p.waitForTimeout(600);
    const u3 = await ev(() => ({ shown: !document.getElementById("dlPanel").classList.contains("hidden"), title: document.getElementById("vtitle").textContent, sel: selJob }));
    check("4K says 3840×2160 (×3) + frame generation 2x; ⚡ Enhance sends the name + the choices, says it was queued, closes, follows the job",
      /→ about 3840×2160 \(×3\) · frame generation 2x/.test(u2) && sent.length === 1 && sent[0].name === name && sent[0].from === "preview" && sent[0].mode === "4K"
      && sent[0].fps === "2x" && sent[0].style === "cinematic" && sent[0].detail === 1 && !u3.shown && /⚡ DLSS 5 queued: .* → about 3840×2160/.test(u3.title) && u3.sel === "dl1", { u2, sent, u3 });
    await ev(() => document.getElementById("pvDlss5").click());
    await p.waitForTimeout(800);
    await ev(() => { const s = document.getElementById("dlMode"); s.value = "8K"; s.dispatchEvent(new Event("change")); });
    await p.waitForFunction(() => /cannot reach/.test(document.getElementById("dlPlan").textContent), null, { timeout: 10000 }).catch(() => {});
    const u4 = await ev(() => ({ go: document.getElementById("dlGo").disabled, plan: document.getElementById("dlPlan").textContent }));
    check("8K from 720p (beyond 3x) is said in words and Enhance stays off", u4.go && /cannot reach 8K/.test(u4.plan), u4);
    await ev(() => { PvDlss5.close(); curVideo = "__preview__abc"; document.getElementById("pvDlss5").click(); });
    await p.waitForTimeout(600);
    const u5 = await ev(() => ({ go: document.getElementById("dlGo").disabled, plan: document.getElementById("dlPlan").textContent }));
    await ev(() => PvDlss5.close());
    check("a live preview (not a file) cannot be sent: Enhance off, says to select a video", u5.go && /select a video first/.test(u5.plan), u5);
    const g = await ev(() => [...document.getElementById("vdSetUpscaler").options].map((o) => o.value + "|" + o.textContent));
    check("the video docker ⚙ Upscaler offers 'DLSS 5 (NVIDIA RTX)'", g.some((x) => /^dlss5\|DLSS 5 \(NVIDIA RTX\)/.test(x)), g);
    check("no page errors", !errs.length, errs);
  } catch (e) {
    check("ran without throwing", false, String(e && e.stack || e));
  } finally {
    if (clip) try { fs.rmSync(clip, { force: true }); } catch { /* fine */ }
    if (before) try { await fetch(URL_ + "api/dlss5/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(before) }); } catch { /* fine */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
