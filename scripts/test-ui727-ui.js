#!/usr/bin/env node
/* bitGen Studio — 2.727.0 in a REAL browser: THE BRAIN COMES ALIVE IN THE SPLASH.
 *   static/splash.html as electron/main.js loads it (a file): #neural plays static/splash-neural.webm - Tim's 15 s clip of
 *   the bitGen brain picture (lightning, a flash, the big bitGen Studio title) - full window, the picture as its poster,
 *   silent, the credits over it, the picture itself hidden; it closes when the film ends (well inside electron/main.js's
 *   16.5 s), a key skips; 2.752.0: always the brain, #film too. (Without the webm the picture stands in: test-ui726-ui.js.)
 *   No Playwright = SKIP. Tim (verbatim): "can u check this video and upload it to the website and intergrate in our
 *   bitgen-studio repo if it is good enough" */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.727.0 browser test did not run"); process.exit(0); }
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
(async () => {
  const b = await chromium.launch();
  try {
    const errs = [];
    const page = async (w, h) => { const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage(); p.on("pageerror", (e) => errs.push(e.message));
      await p.addInitScript(() => { window.__closed = 0; window.close = () => { window.__closed++; }; }); return p; };
    const file = "file://" + path.join(ROOT, "static", "splash.html");
    const s = await page(1280, 720);
    await s.goto(file + "#neural");
    await s.waitForFunction(() => { const v = document.getElementById("v"); return v && v.readyState >= 2 && v.currentTime > 0.3; }, null, { timeout: 15000 });
    await s.waitForTimeout(2600);
    const a = await s.evaluate(() => { const v = document.getElementById("v"), i = document.getElementById("pic"), c = document.getElementById("cred");
      return { pick: document.body.dataset.splash, src: v.getAttribute("src"), poster: v.getAttribute("poster"), playing: !v.paused, muted: v.muted, t: v.currentTime, dur: v.duration,
        w: v.offsetWidth, h: v.offsetHeight, vw: v.videoWidth, vd: getComputedStyle(v).display, pic: getComputedStyle(i).display,
        cred: +getComputedStyle(c).opacity, credText: c.textContent, closed: window.__closed }; });
    check("splash #neural: the brain FILM plays (splash-neural.webm, 1920 wide - upscaled in 2.752.0, 15 s, muted), full window, the picture as its poster and itself hidden",
      a.pick === "neural" && a.src === "splash-neural.webm" && a.poster === "splash-neural.jpg" && a.playing && a.muted && a.vw === 1920 && Math.abs(a.dur - 15) < 0.3
      && a.w === 1280 && a.h === 720 && a.vd === "block" && a.pic === "none", a);
    check("…the credits over it (Timothy Nolan Paul, Claude Opus 5.5); not closed yet", a.cred > 0.9 && /Timothy Nolan Paul/.test(a.credText) && /Claude Opus 5\.5/.test(a.credText) && a.closed === 0, a);
    await s.evaluate(() => { const v = document.getElementById("v"); v.currentTime = v.duration - 0.4; });
    await s.waitForFunction(() => window.__closed >= 1, null, { timeout: 8000 }).catch(() => {});
    check("…it closes when the film ends (15 s - inside electron/main.js's 16.5 s)", (await s.evaluate(() => window.__closed)) >= 1);
    const k = await page(1280, 720);
    await k.goto(file + "#neural"); await k.waitForTimeout(600); await k.keyboard.press("a");
    check("…a key skips it", (await k.evaluate(() => window.__closed)) === 1);
    // 2.752.0: the orange film is not the splash any more - even #film plays the brain (scripts/test-ui752-ui.js)
    const f = await page(1280, 720);
    await f.goto(file + "#film");
    await f.waitForFunction(() => { const v = document.getElementById("v"); return v && v.readyState >= 2; }, null, { timeout: 15000 });
    const fv = await f.evaluate(() => { const v = document.getElementById("v"); return { src: v.getAttribute("src"), playing: !v.paused }; });
    check("2.752.0: #film no longer picks the orange film - the brain plays", fv.src === "splash-neural.webm" && fv.playing, fv);
    check("no page errors", errs.length === 0, errs);
  } finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
