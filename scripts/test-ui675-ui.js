#!/usr/bin/env node
/* bitGen Studio — 2.675.0 in a REAL browser: 📌 PINS KEPT THROUGH LAYOUT SWITCHES - a docker pinned, then ⊞ Docker configs /
 * a workspace / ↺ Reset (all through applyLayout) put other sizes in: the pin stays; right-click the 📌 ▸ ↺ Reset pin clears
 * it; right-click an unpinned 📌 ▸ 📌 Pin at this size pins it.
 * Tim (verbatim): "the red pins are resetting everytime i switch layout, they should only reset if i right click and click
 * reset in a context menu"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.675.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const api = async (m, u, body) => (await fetch(URL_ + u.replace(/^\//, ""), m === "GET" ? {} : { method: m, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const saved = await api("GET", "/api/docker-status");
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PinMenu, null, { timeout: 30000 });
    await ev(() => { const v = document.getElementById("videodock"); if (v.classList.contains("dockgone") && typeof toggleDockGone === "function") toggleDockGone("videodock", "tX_videodock"); if (v.classList.contains("collapsed")) toggleCollapse("videodock"); if (dsEntry("videodock").max_height > 0) resetPin("videodock"); });
    await p.waitForTimeout(400);
    await p.click("#videodock .pinbtn"); await p.waitForTimeout(400);
    const pinned = await ev(() => dsEntry("videodock").max_height);
    check("📌 clicked: the StoryBoard docker pinned (its max height set, the pin lit as set)", pinned > 30 && await ev(() => document.querySelector("#videodock .pinbtn").classList.contains("on")), pinned);
    // a layout switch: ⊞ Docker configs / a workspace / ↺ Reset all hand applyLayout sizes - and an unpinned entry
    await ev(() => { applyLayout({ videodock: { height: 240, max_height: 0, state: "open" }, ldock: { width: 250, max_width: 0 } }); });
    await p.waitForTimeout(500);
    const after = await ev(() => ({ max: dsEntry("videodock").max_height, on: document.querySelector("#videodock .pinbtn").classList.contains("on") }));
    check("a layout switched in (sizes + max 0): the pin STAYS as it was", after.max === pinned && after.on, { pinned, after });
    const ws = await ev(() => !!(window.H3DockReset || window.H3Workspace));
    check("…(the workspace / docker reset modules are on the page - they apply through applyLayout)", ws);
    // right-click the pin: the menu
    await p.click("#videodock .pinbtn", { button: "right" }); await p.waitForTimeout(200);
    const menu = await ev(() => [...document.querySelectorAll(".h3pin-menu > div")].map((d) => ({ t: d.textContent, act: d.dataset.act || null })));
    check("right-click the 📌: 📌 Pinned at <n> px high · ↺ Reset pin", menu.length === 2 && menu[0].t === "📌 Pinned at " + pinned + " px high" && !menu[0].act && menu[1].act === "reset", menu);
    await p.click('.h3pin-menu [data-act="reset"]'); await p.waitForTimeout(400);
    const reset = await ev(() => ({ max: dsEntry("videodock").max_height, on: document.querySelector("#videodock .pinbtn").classList.contains("on"), menu: !!document.querySelector(".h3pin-menu") }));
    check("…↺ Reset pin: unpinned (any height again), the menu gone", reset.max === 0 && !reset.on && !reset.menu, reset);
    await p.click("#videodock .pinbtn", { button: "right" }); await p.waitForTimeout(200);
    const m2 = await ev(() => [...document.querySelectorAll(".h3pin-menu > div")].map((d) => ({ t: d.textContent, act: d.dataset.act || null })));
    check("right-click an unpinned 📌: 📌 Pin at this size · ↺ Reset pin (greyed)", m2[0].act === "pin" && m2[1].act === null, m2);
    await p.click('.h3pin-menu [data-act="pin"]'); await p.waitForTimeout(400);
    check("…📌 Pin at this size: pinned again", (await ev(() => dsEntry("videodock").max_height)) > 30);
    await p.keyboard.press("Escape");
    let saved2 = null; for (let i = 0; i < 24; i++) { await p.waitForTimeout(250); saved2 = await api("GET", "/api/docker-status"); if (saved2.docks && saved2.docks.videodock && saved2.docks.videodock.max_height > 30) break; }   // the write is debounced
    check("the pin is saved (docker_status.json)", saved2.docks && saved2.docks.videodock && saved2.docks.videodock.max_height > 30, saved2.docks && saved2.docks.videodock);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  try { if (saved && saved.docks) await api("POST", "/api/docker-status", { docks: saved.docks }); } catch { /* fine */ }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
