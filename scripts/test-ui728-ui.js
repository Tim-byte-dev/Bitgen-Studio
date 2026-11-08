#!/usr/bin/env node
/* bitGen Studio — 2.728.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311): RelayVSR + the
 * 1920 x 1080 frame. Tim (verbatim): "yes please add a 1920x1080 automatic preset and add https://github.com/kopperx/RelayVSR"
 *   - the preview bar has 🔁 RelayVSR; with nothing in the player it says to pick a video;
 *   - the panel for a 960x544 Video asset: Size starts at 1920 × 1080, Model auto -> "960×544 → 1920×1088 (RelayVSR x2)
 *     → 1920×1080 (edges trimmed)"; 2160p -> x4; x2 forced at 2160p -> refused in words, 🔁 Upscale off; 🔁 Upscale
 *     queues a relayvsr job (1920x1080, fit crop, the x2 pair) and remembers the choices;
 *   - one upscale panel at a time (⏫ SeedVR2 closes it, 🔁 closes SeedVR2's); SeedVR2's Size has 1920 × 1080 too;
 *   - the video docker's ⚙: Upscaler "RelayVSR", Upscale resolution "1920 × 1080";
 *   - Settings ▸ Add-ons lists RelayVSR with its x2 / x4 pairs.
 * No server / no Playwright = SKIP. */
"use strict";
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.728.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.728.0 browser test did not run"); process.exit(0); }
  // a 960x544 clip as a Video asset (the size of Tim's LTX render)
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "ui728-"));
  const name = "t728_brain_" + process.pid + ".mp4", clip = path.join(T, name);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=960x544:rate=24", "-t", "1", "-pix_fmt", "yuv420p", "-c:v", "libx264", clip]);
  const fd = new FormData(); fd.append("file", new Blob([fs.readFileSync(clip)], { type: "video/mp4" }), name);
  const up = await fetch(URL0 + "api/passets", { method: "POST", body: fd }).then((r) => r.json()).catch((e) => ({ error: String(e) }));
  check("a 960x544 clip is a Video asset of the project", !up.error, up);
  const b = await chromium.launch();
  try {
    const p = await (await b.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.RelayVsrPanel && document.getElementById("pvRelayvsr") && window.SeedVR2Panel, null, { timeout: 30000 });
    await p.waitForTimeout(500);
    const btn = await ev(() => { const x = document.getElementById("pvRelayvsr"); return { text: x.textContent.trim(), title: x.title, inBar: !!x.closest("#previewdock, .pvbar, [id^=pv]") || !!document.getElementById("pvRtxvfx") && x.parentElement === document.getElementById("pvRtxvfx").parentElement }; });
    check("the preview bar has 🔁 RelayVSR beside ✨ RTX VFX (its tooltip says ComfyUI core nodes, x2 / x4)", btn.text === "🔁 RelayVSR" && btn.inBar && /ComfyUI core nodes/.test(btn.title), btn);
    await ev(() => document.getElementById("pvRelayvsr").click());
    await p.waitForFunction(() => RelayVsrPanel.shown(), null, { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(300);
    const empty = await ev(() => ({ shown: RelayVsrPanel.shown(), plan: document.getElementById("rvPlan").textContent, go: document.getElementById("rvGo").disabled }));
    check("🔁 with nothing in the player: the panel opens and says to pick a video, 🔁 Upscale off", empty.shown && /select a video first/.test(empty.plan) && empty.go, empty);
    await ev(() => RelayVsrPanel.close());

    await ev((n) => RelayVsrPanel.open({ name: n, from: "asset", anchor: document.getElementById("pvRelayvsr") }), name);
    await p.waitForFunction(() => /→/.test(document.getElementById("rvPlan").textContent), null, { timeout: 15000 }).catch(() => {});
    const a = await ev(() => { const r = document.getElementById("rvPanel").getBoundingClientRect();
      return { size: document.getElementById("rvSize").value, model: document.getElementById("rvModel").value, plan: document.getElementById("rvPlan").textContent,
        go: document.getElementById("rvGo").disabled, opts: [...document.getElementById("rvSize").options].map((o) => o.value), src: document.getElementById("rvSrc").textContent,
        onScreen: r.width > 200 && r.top >= 0 && r.bottom <= innerHeight }; });
    check("the panel for the 960x544 asset: Size 1920 × 1080 first, Model auto, the plan '960×544 → 1920×1088 (RelayVSR x2) → 1920×1080 (edges trimmed)'",
      a.size === "1920x1080" && a.opts[0] === "1920x1080" && a.opts.includes("native") && a.opts.includes("2160") && a.model === "auto" && !a.go && a.onScreen
      && /960×544 → 1920×1088 \(RelayVSR x2\) → 1920×1080 \(edges trimmed\)/.test(a.plan) && /Video assets/.test(a.src), a);
    await p.selectOption("#rvSize", "2160"); await p.waitForTimeout(700);
    const k4 = await ev(() => document.getElementById("rvPlan").textContent);
    check("2160p: auto picks x4 (3840×2176, scaled to 2160)", /→ 3840×2176 \(RelayVSR x4\) → 3812×2160/.test(k4), k4);
    await p.selectOption("#rvModel", "x2"); await p.waitForTimeout(700);
    const bad = await ev(() => ({ plan: document.getElementById("rvPlan").textContent, go: document.getElementById("rvGo").disabled }));
    check("x2 forced at 2160p: refused in words, 🔁 Upscale off", /more than RelayVSR x2/.test(bad.plan) && /pick x4/.test(bad.plan) && bad.go, bad);
    await p.selectOption("#rvModel", "auto"); await p.selectOption("#rvSize", "1920x1080"); await p.fill("#rvDetail", "0.85");
    await ev(() => document.getElementById("rvDetail").dispatchEvent(new Event("change"))); await p.waitForTimeout(700);
    const before = await fetch(URL0 + "api/jobs").then((r) => r.json()).catch(() => []);
    const ids0 = new Set((Array.isArray(before) ? before : before.jobs || []).map((j) => j.id));
    await ev(() => document.getElementById("rvGo").click()); await p.waitForTimeout(1200);
    const after = await fetch(URL0 + "api/jobs").then((r) => r.json()).catch(() => []);
    const job = (Array.isArray(after) ? after : after.jobs || []).find((j) => !ids0.has(j.id) && j.params && j.params.mode === "relayvsr");
    const st = await fetch(URL0 + "api/relayvsr/settings").then((r) => r.json());
    check("🔁 Upscale queues a relayvsr job: 1920x1080, fit crop, x2 pair, detail 0.85 - the panel closes, the choices remembered",
      job && job.params.width === 1920 && job.params.height === 1080 && job.params.fit === "crop" && job.params.factor === 2
      && job.params.unet === "relayvsr_x2_lightx2v_int8_convrot.safetensors" && job.params.detail === 0.85
      && !(await ev(() => RelayVsrPanel.shown())) && st.settings.size === "1920x1080" && st.settings.detail === 0.85, { job: job && job.params, st: st.settings });
    if (job) { try { await fetch(URL0 + "api/jobs/" + job.id + "/cancel", { method: "POST" }); } catch { /* it fails on its own without ComfyUI */ } }

    // one upscale panel at a time
    await ev(() => document.getElementById("pvRelayvsr").click());
    await p.waitForFunction(() => RelayVsrPanel.shown(), null, { timeout: 15000 }).catch(() => {});
    await ev(() => document.getElementById("pvSeedvr2").click());
    await p.waitForFunction(() => SeedVR2Panel.shown(), null, { timeout: 15000 }).catch(() => {});
    const one = await ev(() => ({ rv: RelayVsrPanel.shown(), sv: SeedVR2Panel.shown(), opt: !!document.querySelector('#svSize option[value="1920x1080"]') }));
    await ev(() => document.getElementById("pvRelayvsr").click());
    await p.waitForFunction(() => RelayVsrPanel.shown(), null, { timeout: 15000 }).catch(() => {});
    const two = await ev(() => ({ rv: RelayVsrPanel.shown(), sv: SeedVR2Panel.shown() }));
    check("one upscale panel at a time: ⏫ SeedVR2 closes 🔁's, 🔁 closes SeedVR2's; SeedVR2's Size offers 1920 × 1080", !one.rv && one.sv && one.opt && two.rv && !two.sv, { one, two });
    await ev(() => RelayVsrPanel.close());

    // the video docker's ⚙
    const vd = await ev(() => ({ up: [...(document.getElementById("vdSetUpscaler") || { options: [] }).options].map((o) => o.value),
      res: [...(document.getElementById("vdSetUpRes") || { options: [] }).options].map((o) => o.value) }));
    check("the video docker's ⚙: Upscaler 'RelayVSR', Upscale resolution '1920 × 1080'", vd.up.includes("relayvsr") && vd.res.includes("1920x1080"), vd);
    // Settings ▸ Add-ons
    const ad = await fetch(URL0 + "api/addons").then((r) => r.json()).catch(() => ({}));
    const rv = ((ad.addons || ad.list || ad) instanceof Array ? (ad.addons || ad.list || ad) : []).find((x) => x.id === "relayvsr");
    check("Settings ▸ Add-ons lists RelayVSR with its x2 (ticked by default) and x4 pairs", rv && Array.isArray(rv.items) && rv.items.map((i) => i.id).join() === "x2,x4"
      && rv.items[0].dflt === true && /ComfyUI newer than the v0.44.0/.test(rv.needs || ""), rv);
    check("no page errors", errs.length === 0, errs);
  } finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
