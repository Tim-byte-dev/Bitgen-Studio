#!/usr/bin/env node
/* bitGen Studio — 2.711.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311): 💬 Community
 * is a FLOATING DOCKER (static/secfloat.js -> static/dockfloat.js): 💬 Community shows / hides it, it floats with the
 * docker title bar (▁ ⛶ ✕) and every edge sizing it, docks INSIDE another docker as a tab and floats again, and where
 * it is + whether it is open are kept (docker_status.json floats.community) across a reload. No server / no
 * Playwright = SKIP.  Tim (verbatim): "make it a floating docker too" */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.711.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.711.0 browser test did not run"); process.exit(0); }
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1500, height: 950 } });
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(URL0); await p.waitForFunction(() => window.H3Community && window.SecFloat && SecFloat.windows && SecFloat.windows.community, null, { timeout: 30000 });
    await p.evaluate(() => { if (SecFloat.state("community").shown) SecFloat.show("community", false); });
    await p.click("#tCm"); await p.waitForTimeout(500);
    const a = await p.evaluate(() => { const w = document.getElementById("sf-community"), r = w.getBoundingClientRect();
      return { shown: SecFloat.state("community").shown, float: w.classList.contains("df-float"), title: w.querySelector(".sfhead .sft").textContent,
        btns: [...w.querySelectorAll(".sfhead button")].map((x) => x.textContent), inside: !!w.querySelector("#cmPanel #cmTabs"), w: Math.round(r.width), h: Math.round(r.height),
        grips: w.querySelectorAll(".dfg").length, lit: document.getElementById("tCm").classList.contains("on") }; });
    check("💬 Community shows it as a floating docker of its own: the docker title bar (▁ ⛶ ✕), the panel inside, every edge sizes it, the button lit",
      a.shown && a.float && /bitGen Community/.test(a.title) && a.btns.join("") === "▁⛶✕" && a.inside && a.grips >= 4 && a.lit && a.w >= 280 && a.h >= 220, a);
    // move it as the docker system does (its state + float), then reload: kept
    await p.evaluate(() => { SecFloat.windows.community.panel.float(222, 133, 410, 500); });
    await p.waitForTimeout(800);
    await p.reload(); await p.waitForFunction(() => window.SecFloat && SecFloat.windows && SecFloat.windows.community && SecFloat.windows.community.placed, null, { timeout: 30000 });
    await p.waitForTimeout(600);
    const k = await p.evaluate(() => { const w = document.getElementById("sf-community"); return { shown: SecFloat.state("community").shown, x: parseInt(w.style.left, 10), y: parseInt(w.style.top, 10), w: parseInt(w.style.width, 10), hidden: w.classList.contains("sf-hidden") }; });
    check("…where it floats, its size and that it is open are kept across a reload (docker_status.json floats.community)", k.shown && !k.hidden && k.x === 222 && k.y === 133 && k.w === 410, k);
    // dock it INSIDE another docker as a tab, then float it again
    const tab = await p.evaluate(() => { const host = document.getElementById("timelinedock") || document.getElementById("previewdock"); const P = SecFloat.windows.community.panel;
      P.dockTo(host, "inside"); return new Promise((res) => setTimeout(() => { const w = document.getElementById("sf-community"); res({ mode: P.mode(), tabbed: w.classList.contains("df-tabbed"), inHost: host.contains(w) || (w.parentElement && w.parentElement.classList.contains("df-host")),
        tabs: [...document.querySelectorAll("[data-dft]")].map((x) => x.dataset.dft) }); }, 400)); });
    check("…it docks INSIDE another docker as a tab", tab.mode === "tab" && tab.tabbed && tab.inHost, tab);
    const fl = await p.evaluate(() => { const P = SecFloat.windows.community.panel; P.float(300, 120, 380, 520); const w = document.getElementById("sf-community"); return { mode: P.mode(), float: w.classList.contains("df-float"), chat: !!w.querySelector("#cmBody") }; });
    check("…and floats again with the chat still in it", fl.float && fl.mode === "float" && fl.chat, fl);
    await p.click("#tCm"); await p.waitForTimeout(300);
    check("💬 Community again hides it (the button unlit)", await p.evaluate(() => !SecFloat.state("community").shown && document.getElementById("sf-community").classList.contains("sf-hidden") && !document.getElementById("tCm").classList.contains("on")));
    await p.click("#tCm"); await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector("#sf-community .sfx").click()); await p.waitForTimeout(300);
    check("the docker's own ✕ closes it too", await p.evaluate(() => !SecFloat.state("community").shown));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
