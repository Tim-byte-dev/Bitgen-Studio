#!/usr/bin/env node
/* bitGen Studio — 2.701.0 in a REAL browser: static/splash.html plays its film (2.752.0: the brain, 15 s, muted), shows the skip
 * hint, and a key closes it; the setup page shows the logo. Opens the files directly (no server). No Playwright = SKIP.
 * Tim (verbatim): "can u make a splash screen with the video, but add produced and developed by Timothy Nolan Paul, programmed by
 * claude opus 5.5 15seconds, and add the logo to the setup" */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.701.0 browser test did not run"); process.exit(0); }
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
(async () => {
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto("file://" + path.join(ROOT, "static", "splash.html"));   // 2.752.0: always the brain film
    await p.waitForFunction(() => { const v = document.getElementById("v"); return v && v.readyState >= 2; }, null, { timeout: 15000 });
    const v = await p.evaluate(() => { const v = document.getElementById("v"); return { dur: v.duration, w: v.videoWidth, h: v.videoHeight, muted: v.muted, playing: !v.paused, err: v.error && v.error.code }; });
    check("the splash film plays: 15 s, muted, no error (2.752.0: the brain film, 1920 x 1080)", Math.abs(v.dur - 15) < 0.3 && v.w === 1920 && v.h === 1080 && v.muted && v.playing && !v.err, v);
    await p.waitForTimeout(1700);
    check("…the skip hint shows after 1.5 s", await p.evaluate(() => document.body.classList.contains("hint")));
    const closes = await p.evaluate(() => { let c = 0; window.close = () => { c++; }; document.dispatchEvent(new KeyboardEvent("keydown", { key: "a" })); document.dispatchEvent(new MouseEvent("mousedown")); return c; });
    check("…any key or a click closes it", closes === 2, closes);
    check("no page errors", errs.length === 0, errs);
    const q = await b.newPage({ viewport: { width: 960, height: 640 } }); await q.goto("file://" + path.join(ROOT, "electron", "installer.html")); await q.waitForTimeout(600);
    const s = await q.evaluate(async () => { const bg = (sel) => getComputedStyle(document.querySelector(sel)).backgroundImage; const im = new Image(); im.src = "../static/icon.png"; await im.decode().catch(() => {}); return { tbar: bg("#tbar .logo"), mark: bg(".page.on .mark"), loaded: im.naturalWidth }; });
    check("the setup: its title bar + the welcome page's mark show the logo (icon.png, loads)", /static\/icon\.png/.test(s.tbar) && /static\/icon\.png/.test(s.mark) && s.loaded === 512, s);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
