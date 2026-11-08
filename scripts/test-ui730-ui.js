#!/usr/bin/env node
/* bitGen Studio — 2.730.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311): 🕺 MOTION.
 * Tim (verbatim): "https://flowhmr.github.io/ . we can add a reference video for motion?" + "add it to addons with a
 * disclaimer that it is for non commercial use only"
 *   - the preview bar has 🕺 Motion; its panel always shows the NON-COMMERCIAL notice; FlowHMR not installed = what is
 *     missing + Settings ▸ Add-ons ▸ FlowHMR, 🕺 Capture motion off; still camera greys out "Camera every";
 *   - one panel of the bar at a time (🔁 RelayVSR closes it and back);
 *   - Settings ▸ Add-ons: the FlowHMR card titled "(non-commercial use only)", the warning, the links (MANO, the two
 *     gated Hugging Face pages, GitHub);
 *   - POST /api/flowhmr while not installed = refused in words (409).
 * No server / no Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.730.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.730.0 browser test did not run"); process.exit(0); }
  const st = await fetch(URL0 + "api/flowhmr/status").then((r) => r.json()).catch(() => ({}));
  if (st.installed) { console.log("SKIP: FlowHMR is installed on this studio - this test checks the not-installed state"); process.exit(0); }
  const b = await chromium.launch();
  try {
    const p = await (await b.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.FlowHmrPanel && document.getElementById("pvFlowhmr") && window.RelayVsrPanel, null, { timeout: 30000 });
    const btn = await ev(() => { const x = document.getElementById("pvFlowhmr"); return { text: x.textContent.trim(), title: x.title, sib: x.parentElement === document.getElementById("pvRelayvsr").parentElement }; });
    check("the preview bar has 🕺 Motion beside 🔁 RelayVSR; its tooltip says non-commercial", btn.text === "🕺 Motion" && btn.sib && /Non-commercial use only/.test(btn.title), btn);
    await ev(() => document.getElementById("pvFlowhmr").click());
    await p.waitForFunction(() => FlowHmrPanel.shown(), null, { timeout: 15000 }).catch(() => {});
    const a = await ev(() => { const r = document.getElementById("fhPanel").getBoundingClientRect();
      return { shown: FlowHmrPanel.shown(), notice: document.getElementById("fhNotice").textContent, state: document.getElementById("fhState").textContent,
        go: document.getElementById("fhGo").disabled, onScreen: r.width > 200 && r.top >= 0 && r.bottom <= innerHeight,
        cam: document.getElementById("fhCamera").value, every: document.getElementById("fhEvery").value }; });
    check("the panel: the NON-COMMERCIAL notice, 'not ready - Settings ▸ Add-ons ▸ FlowHMR' with what is missing, 🕺 Capture motion off; moving camera every 10 frames",
      a.shown && a.onScreen && /NON-COMMERCIAL USE ONLY/.test(a.notice) && /SMPL-H/.test(a.notice) && /not ready - Settings ▸ Add-ons ▸ FlowHMR/.test(a.state)
      && /missing/.test(a.state) && a.go && a.cam === "moving" && a.every === "10", a);
    await p.selectOption("#fhCamera", "still");
    const dis = await ev(() => document.getElementById("fhEvery").disabled);
    await p.selectOption("#fhCamera", "moving");
    check("a still camera greys out 'Camera every'", dis === true && !(await ev(() => document.getElementById("fhEvery").disabled)));
    await ev(() => document.getElementById("pvRelayvsr").click());
    await p.waitForFunction(() => RelayVsrPanel.shown(), null, { timeout: 15000 }).catch(() => {});
    const one = await ev(() => ({ fh: FlowHmrPanel.shown(), rv: RelayVsrPanel.shown() }));
    await ev(() => document.getElementById("pvFlowhmr").click());
    await p.waitForFunction(() => FlowHmrPanel.shown(), null, { timeout: 15000 }).catch(() => {});
    const two = await ev(() => ({ fh: FlowHmrPanel.shown(), rv: RelayVsrPanel.shown() }));
    check("one panel of the bar at a time: 🔁 closes 🕺's, 🕺 closes 🔁's", !one.fh && one.rv && two.fh && !two.rv, { one, two });
    await ev(() => FlowHmrPanel.close());
    await ev(() => { const d = document.getElementById("settings"); if (!d.open) { if (typeof openSettings === "function") openSettings(); else d.showModal(); } });
    await p.waitForTimeout(300);
    await ev(() => document.querySelector('#settings [data-stab="addons"]').click());
    await p.waitForFunction(() => /FlowHMR motion capture/.test((document.getElementById("aoList") || {}).textContent || ""), null, { timeout: 15000 }).catch(() => {});
    const c = await ev(() => { const card = [...document.querySelectorAll("#aoList .ao")].find((x) => /FlowHMR motion capture/.test(x.textContent));
      return card ? { text: card.textContent, links: [...card.querySelectorAll("a[href]")].map((a) => a.href), install: !!card.querySelector('[data-ao="flowhmr"][data-act="install"]') } : null; });
    check("Settings ▸ Add-ons: 'FlowHMR motion capture (non-commercial use only)', the warning, Install, links to MANO + the two gated pages + GitHub",
      c && /FlowHMR motion capture \(non-commercial use only\)/.test(c.text) && /NON-COMMERCIAL USE ONLY/.test(c.text) && c.install
      && ["https://mano.is.tue.mpg.de/", "https://huggingface.co/facebook/VGGT-Omega", "https://huggingface.co/facebook/sam-3d-body-dinov3", "https://github.com/flowhmr/flowhmr"].every((u) => c.links.includes(u)), c);
    const q = await fetch(URL0 + "api/flowhmr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "nothing.mp4" }) });
    check("POST /api/flowhmr for a video that is not there: refused (400) in words", q.status === 400 && /not a video in this project/.test((await q.json()).error || ""));
    check("no page errors", errs.length === 0, errs);
  } finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
