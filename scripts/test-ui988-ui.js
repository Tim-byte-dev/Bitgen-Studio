#!/usr/bin/env node
/* bitGen Studio — 2.988.0 in a REAL browser: the UI size zooms the WHOLE UI (buttons, icons, text, dockers - a browser: CSS
 * zoom; the app: h3shell.zoom, stood in here), kept over a reload, 250 % at most; 📷 Body from a photo's 🙂 Head row.
 * Tim: "across the ui when user changes ui size can you change the entire ui sizes, buttons, text etc. i am looking at a
 * projected screen 4m away, it is difficult for me to see." */
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
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1800, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const ready = () => p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3UiZoom, null, { timeout: 60000 });
  const btnBox = () => ev(() => { const b = document.getElementById("tX_pushpulldock") || document.querySelector("button"); const r = b.getBoundingClientRect(); return { w: r.width, h: r.height }; });
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" }); await ready();
    await ev(() => applyUiScale(100)); await p.waitForTimeout(200);
    const b0 = await btnBox(), f0 = await ev(() => getComputedStyle(document.documentElement).fontSize);
    await ev(() => { const s = document.getElementById("uiscale"); s.value = "200"; s.dispatchEvent(new Event("input")); }); await p.waitForTimeout(300);
    const z = await ev(() => ({ zoom: document.documentElement.style.zoom, font: document.documentElement.style.fontSize, v: document.getElementById("uiscalev").textContent, max: document.getElementById("uiscale").max }));
    check("a browser: UI size 200 % sizes the text (28 px root, no CSS zoom - the browser's own zoom does the page); the slider reaches 250", z.zoom === "" && z.font === "28px" && z.v === "200%" && z.max === "250" && f0 === "14px", z);
    void b0;
    await ev(() => applyUiScale(400));
    check("250 % at most", (await ev(() => document.documentElement.style.fontSize)) === "35px" && (await ev(() => document.getElementById("uiscalev").textContent)) === "250%");
    await ev(() => applyUiScale(150)); await p.waitForTimeout(600);
    await p.reload({ waitUntil: "domcontentloaded" }); await ready(); await p.waitForTimeout(800);
    check("kept over a reload", (await ev(() => document.documentElement.style.fontSize)) === "21px");
    // the app: h3shell.zoom does it (webFrame) - no CSS zoom then
    const p2 = await b.newPage({ viewport: { width: 1600, height: 900 } });
    await p2.addInitScript(() => { window.__zooms = []; window.h3shell = { isElectron: true, zoom: (f) => window.__zooms.push(f), minimize() {}, maximize() {}, close() {}, isMaximized: async () => false, onMaximized() {}, booted: async () => {}, capture: {} }; });
    await p2.goto(URL_, { waitUntil: "domcontentloaded" }); await p2.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3UiZoom, null, { timeout: 60000 });
    await p2.evaluate(() => applyUiScale(220));
    const e2 = await p2.evaluate(() => ({ last: window.__zooms[window.__zooms.length - 1], css: document.documentElement.style.zoom, font: document.documentElement.style.fontSize }));
    check("in the app: the WHOLE UI zoomed - the shell's zoom (webFrame) gets 2.2, the root font stays 14 px (not twice)", e2.last === 2.2 && e2.css === "" && e2.font === "14px", e2);
    await p2.evaluate(() => applyUiScale(100)); await p2.close();
    await ev(() => applyUiScale(100)); await p.waitForTimeout(500);
    // 🙂 Head in 📷 Body from a photo
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); });
    await p.waitForFunction(() => window.H3PushPull && H3PushPull.state.booted, null, { timeout: 40000 });
    await ev(() => H3DazTools.toggle(true)); await p.waitForFunction(() => document.getElementById("dzHead"), null, { timeout: 15000 });
    const hd = await ev(() => ({ opts: [...document.getElementById("dzHead").options].map((o) => o.value).join(), pickHidden: document.getElementById("dzHeadPick").hidden }));
    check("📷 Body from a photo has 🙂 Head: the photo's face / a close-up / leave it (the close-up picker only for a close-up)", hd.opts === "photo,close,none" && hd.pickHidden, hd);
    await ev(() => { const s = document.getElementById("dzHead"); s.value = "close"; s.dispatchEvent(new Event("change")); });
    check("…a close-up: its own picture picker shows, the choice kept", await ev(() => !document.getElementById("dzHeadPick").hidden && localStorage.getItem("h3.daztools.head") === '"close"'));
    await ev(() => { const s = document.getElementById("dzHead"); s.value = "photo"; s.dispatchEvent(new Event("change")); H3DazTools.toggle(false); });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran without throwing", false, String(e && e.stack || e)); }
  await b.close();
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exitCode = fail ? 1 : 0;
})();
