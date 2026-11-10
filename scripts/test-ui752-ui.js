#!/usr/bin/env node
/* bitGen Studio — 2.752.0 in a REAL browser: THE START-UP SPLASH IS THE BRAIN FILM, ALWAYS, WITH THE LOGO TOP LEFT.
 * Tim (verbatim): "only use the brain video for the splash screen and the tigerart video, maybe just add the logo to the top left"
 *   static/splash.html as electron/main.js loads it (a file): every start plays static/splash-neural.webm (no random pick, no
 *   orange film - static/splash.webm is gone), the credits over it, the official logo (static/icon.png, 512) fades in at the
 *   top left - small, clear of the brain - and stays when the picture stands in for the film. The film itself is the sharp
 *   one (Tim: "are you able to upscale the video and make the text more sharp?"): 1920 x 1080. No Playwright = SKIP. */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.752.0 browser test did not run"); process.exit(0); }
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
    const r = await page(640, 360), seen = new Set();
    for (let i = 0; i < 8; i++) { await r.goto(file + "?n=" + i); seen.add(await r.evaluate(() => document.body.dataset.splash + " " + document.getElementById("v").getAttribute("src"))); }
    check("every start: the brain film (8 starts, never the orange film); static/splash.webm is gone", seen.size === 1 && seen.has("neural splash-neural.webm") && !fs.existsSync(path.join(ROOT, "static", "splash.webm")), [...seen]);
    const s = await page(1280, 720);
    await s.goto(file);
    await s.waitForFunction(() => { const v = document.getElementById("v"); return v && v.readyState >= 2 && v.currentTime > 0.3; }, null, { timeout: 15000 });
    await s.waitForTimeout(2600);
    const a = await s.evaluate(() => { const m = document.getElementById("mark"), q = m.getBoundingClientRect(), v = document.getElementById("v");
      return { loaded: m.complete && m.naturalWidth, src: m.getAttribute("src"), op: +getComputedStyle(m).opacity, x: q.left, y: q.top, w: q.width, h: q.height,
        playing: !v.paused, cred: +getComputedStyle(document.getElementById("cred")).opacity, top: document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2) === m || getComputedStyle(m).pointerEvents === "none" }; });
    check("the official logo (icon.png, 512) in the top left: faded in, small (about a tenth of the width), square, over the playing film",
      a.loaded === 512 && a.src === "icon.png" && a.op > 0.95 && a.x > 10 && a.x < 60 && a.y > 10 && a.y < 50 && a.w > 90 && a.w < 140 && Math.abs(a.w - a.h) < 1 && a.playing && a.top, a);
    check("…the credits still show", a.cred > 0.9, a);
    const vs = await s.evaluate(() => { const v = document.getElementById("v"); return [v.videoWidth, v.videoHeight]; });
    check("…the brain film is the sharp one: 1920 x 1080 (upscaled from 960 x 544 - Tim: \"upscale the video and make the text more sharp\")", vs[0] === 1920 && vs[1] === 1080, vs);
    const z = await s.evaluate(() => { const m = document.getElementById("mark"), v = document.getElementById("v"); return { mz: +getComputedStyle(m).zIndex || 0, after: !!(v.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING), pe: getComputedStyle(m).pointerEvents }; });
    check("…drawn above the film, and a click goes through it (a click still skips)", z.after && z.pe === "none", z);
    const ph = await page(480, 270);
    await ph.goto(file); await ph.waitForTimeout(1500);
    const sm = await ph.evaluate(() => document.getElementById("mark").getBoundingClientRect().width);
    check("…never smaller than 48 px in a small window", sm >= 48, sm);
    // the film cannot play: the picture stands in, the logo stays
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "splash752-"));
    for (const n of ["splash.html", "splash-neural.jpg", "icon.png"]) fs.copyFileSync(path.join(ROOT, "static", n), path.join(tmp, n));
    const st = await page(1280, 720);
    await st.goto("file://" + path.join(tmp, "splash.html")); await st.waitForTimeout(2200);
    const sv = await st.evaluate(() => ({ still: document.body.classList.contains("still"), op: +getComputedStyle(document.getElementById("mark")).opacity, loaded: document.getElementById("mark").naturalWidth }));
    check("the film missing: the brain picture stands in and the logo stays", sv.still && sv.op > 0.95 && sv.loaded === 512, sv);
    fs.rmSync(tmp, { recursive: true, force: true });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
