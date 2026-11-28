#!/usr/bin/env node
/* bitGen Studio — 3.11.2 in a REAL browser: the Audio docker's 📌 height pin on every tab - the 🎹 Edit Booth too (it had none:
 * it was not one of the dockers whose height the app keeps) - pinned at the height it shows, kept in docker_status, unpinned again.
 * Tim: "add the height pin button back to the audio docker titlebar" */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const status = async () => ((await (await fetch(URL_ + "api/docker-status")).json()).docks || {}).synthdock || {};
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Audio, null, { timeout: 60000 }); await sleep(1200);
    const tabs = {};
    for (const t of ["musicdock", "sfxdock", "synthdock"]) {
      await ev((x) => window.H3Audio.tab(x), t); await sleep(300);
      tabs[t] = await ev((x) => { const h = document.querySelector("#" + x + " > .bhead"), pb = h && h.querySelector(":scope > .pinbtn"); return !!pb && pb.offsetWidth > 0 && h.firstElementChild === pb; }, t);
    }
    check("📌 on the Audio docker's title bar, first on the left, on every tab - 🎵 Music, 💥 SFX and 🎹 Edit Booth", tabs.musicdock && tabs.sfxdock && tabs.synthdock, tabs);
    const s0 = await status();
    if (s0.max_height > 0) { await p.click("#synthdock > .bhead > .pinbtn"); await sleep(700); }
    const h0 = await ev(() => document.getElementById("synthdock").offsetHeight);
    await p.click("#synthdock > .bhead > .pinbtn"); await sleep(900);
    const on = await ev(() => { const d = document.getElementById("synthdock"), pb = d.querySelector(":scope > .bhead > .pinbtn"); return { pressed: pb.getAttribute("aria-pressed"), cls: pb.classList.contains("on"), max: d.style.maxHeight }; });
    const s1 = await status();
    check("📌 on the Edit Booth: pinned at the height it shows (its max-height), lit", on.pressed === "true" && on.cls && Math.abs(parseInt(on.max, 10) - h0) <= 2, { on, h0 });
    check("…kept in docker_status (the app keeps the Edit Booth's height now)", Math.abs(s1.max_height - h0) <= 2, s1);
    await p.click("#synthdock > .bhead > .pinbtn"); await sleep(900);
    const off = await ev(() => { const d = document.getElementById("synthdock"), pb = d.querySelector(":scope > .bhead > .pinbtn"); return { pressed: pb.getAttribute("aria-pressed"), max: d.style.maxHeight }; });
    check("…📌 again: unpinned (any height)", off.pressed === "false" && off.max === "" && (await status()).max_height === 0, off);
    check("the Edit Booth has its own height (--syh), like Music / SFX", await ev(() => parseInt(getComputedStyle(document.documentElement).getPropertyValue("--syh"), 10) > 0));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e && e.stack || e)); }
  await b.close();
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
