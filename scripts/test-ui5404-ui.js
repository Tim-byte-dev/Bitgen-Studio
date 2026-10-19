#!/usr/bin/env node
/* bitGen Studio — 2.540.4 in a REAL browser: Settings ▸ Add-ons.
 * The tab is there (after Extensions); YuE2 music + Viggle (native) as cards (for / needs / size / state); ⤓ Install
 * YuE2 asks first (the size), then the job's log streams into the tab - on this test machine (no NVIDIA GPU) it ends
 * with the honest refusal; the buttons are off while it runs. Against the running app (H3_URL, default :8311). */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.540.4 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  p.setDefaultTimeout(30000);
  const ev = (f, a) => p.evaluate(f, a);
  const dialogs = [];
  p.on("dialog", (d) => { dialogs.push(d.message()); d.accept(); });
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Addons, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    const tab = await ev(() => { const t = [...document.querySelectorAll("#settings .stabs button")].map((x) => x.dataset.stab); return { has: t.includes("addons"), afterExt: t.indexOf("addons") === t.indexOf("extensions") + 1 }; });
    check("Settings has an Add-ons tab, right after Extensions", tab.has && tab.afterExt, tab);
    await ev(() => window.H3Addons.open());
    await p.waitForFunction(() => document.querySelectorAll("#stab-addons .ao").length >= 2, null, { timeout: 60000 });   // the first look scans the ComfyUI folders (Viggle)
    const cards = await ev(() => [...document.querySelectorAll("#stab-addons .ao")].map((c) => ({ id: c.dataset.addon, txt: c.textContent, btns: [...c.querySelectorAll("button")].map((x) => x.textContent) })));
    const y = cards.find((c) => c.id === "yue2"), v = cards.find((c) => c.id === "viggle");
    check("…YuE2 music: for (the Music docker), needs (24 GB VRAM), size, not installed, ⤓ Install", y && /Music docker/.test(y.txt) && /24 GB VRAM/.test(y.txt) && /PyTorch/.test(y.txt) && /not installed/.test(y.txt) && y.btns.join() === "⤓ Install", y);
    check("…Viggle (native) with its state and ⤓ Install (its own installer)", v && /Viggle/.test(v.txt) && v.btns.includes("⤓ Install"), v);
    check("…the tab is shown (active)", await ev(() => document.getElementById("stab-addons").classList.contains("active")));
    await p.click('#stab-addons [data-ao="yue2"][data-act="install"]');
    await p.waitForFunction(() => document.getElementById("aoHead"), null, { timeout: 15000 });
    check("⤓ Install asks first, with the size and what it needs", dialogs.some((m) => /Install YuE2 music\?/.test(m) && /Size:/.test(m) && /VRAM/.test(m)), dialogs);
    await p.waitForFunction(() => /✗|✓/.test((document.getElementById("aoHead") || {}).textContent || ""), null, { timeout: 60000 });
    const job = await ev(() => ({ head: document.getElementById("aoHead").textContent, log: document.getElementById("aoLog").textContent, srv: null }));
    const api = await (await fetch(URL_ + "api/addons/job")).json();
    check("…the job runs on the server and its log streams into the tab; on this machine (no NVIDIA GPU) it ends with the honest refusal, nothing installed",
      api.job && api.job.id === "yue2" && api.job.state === "error" && /NVIDIA GPU/.test(api.job.error) && /✗ yue2/.test(job.head) && /\[failed\].*NVIDIA GPU/.test(job.log), { job, api });
    const after = await (await fetch(URL_ + "api/addons")).json();
    check("…GET /api/addons: YuE2 still not installed, the last job kept", after.addons.find((a) => a.id === "yue2").installed === false && after.job && after.job.state === "error", after);
    const busy = await (await fetch(URL_ + "api/addons/nothing/install", { method: "POST" })).json();
    check("POST /api/addons/<unknown>/install -> an error", !!busy.error, busy);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("crashed: " + (e.stack || e), false); }
  finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
