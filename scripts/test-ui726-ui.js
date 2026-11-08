#!/usr/bin/env node
/* bitGen Studio — 2.726.0 in a REAL browser: THE NEURAL BLUE THEME + THE BRAIN PICTURE AS A STARTING IMAGE.
 *   the splash page (static/splash.html, as electron/main.js loads it - a file): #neural shows the picture (loaded, 16:9, full
 *   window), the credits after a moment, closes itself at 8 s, a key skips; #film plays the film; with nothing asked both
 *   come up over several starts. Against a running studio (H3_URL / H3_PORT, default 8311): Settings ▸ Themes has a Neural blue
 *   card; a click turns the app navy and blue, a reload keeps it; Dark back. No Playwright = SKIP (the studio part SKIPs
 *   without a server). Tim (verbatim): "use this as one of the starting images and change the theme to match" */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.726.0 browser test did not run"); process.exit(0); }
const ROOT = path.join(__dirname, "..");
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
(async () => {
  const b = await chromium.launch();
  try {
    const errs = [];
    const page = async (w, h) => { const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage(); p.on("pageerror", (e) => errs.push(e.message)); return p; };
    const file = "file://" + path.join(ROOT, "static", "splash.html");
    // ---- the splash: the picture
    const s = await page(1280, 720);
    await s.addInitScript(() => { window.__closed = 0; window.close = () => { window.__closed++; }; });
    await s.goto(file + "#neural"); await s.waitForTimeout(2800);
    const a = await s.evaluate(() => { const i = document.getElementById("pic"), r = { width: i.offsetWidth, height: i.offsetHeight }, v = document.getElementById("v"), c = document.getElementById("cred");
      return { pick: document.body.dataset.splash, loaded: i.complete && i.naturalWidth, nh: i.naturalHeight, w: r.width, h: r.height, op: +getComputedStyle(i).opacity, video: getComputedStyle(v).display, src: v.getAttribute("src"),
        cred: +getComputedStyle(c).opacity, credText: c.textContent, closed: window.__closed }; });
    check("splash #neural: the brain picture fills the window (1920 x 1080 loaded, faded in), no film loaded", a.pick === "neural" && a.loaded === 1920 && a.nh === 1080 && a.w === 1280 && a.h === 720 && a.op > 0.95 && a.video === "none" && !a.src, a);
    check("…the credits show (Timothy Nolan Paul, Claude Opus 5.5); not closed yet", a.cred > 0.9 && /Produced and developed byTimothy Nolan Paul/.test(a.credText) && /Programmed byClaude Opus 5\.5/.test(a.credText) && a.closed === 0, a);
    const zoom = await s.evaluate(() => getComputedStyle(document.getElementById("pic")).transform);
    check("…a slow push-in (scaled past 1 by now)", /^matrix\(1\.0[1-6]/.test(zoom), zoom);
    await s.waitForTimeout(5600);
    check("…it closes itself at 8 s", (await s.evaluate(() => window.__closed)) >= 1);
    const k = await page(1280, 720);
    await k.addInitScript(() => { window.__closed = 0; window.close = () => { window.__closed++; }; });
    await k.goto(file + "#neural"); await k.waitForTimeout(500); await k.keyboard.press("a");
    check("…a key skips it", (await k.evaluate(() => window.__closed)) === 1);
    // ---- the film
    const f = await page(1280, 720);
    await f.goto(file + "#film");
    await f.waitForFunction(() => { const v = document.getElementById("v"); return v && v.readyState >= 2; }, null, { timeout: 15000 });
    const fv = await f.evaluate(() => { const v = document.getElementById("v"); return { pick: document.body.dataset.splash, playing: !v.paused, pic: getComputedStyle(document.getElementById("pic")).display, cred: getComputedStyle(document.getElementById("cred")).display }; });
    check("splash #film: the film plays, the picture and its credits hidden (the film has its own)", fv.pick === "film" && fv.playing && fv.pic === "none" && fv.cred === "none", fv);
    // ---- at random
    const r = await page(640, 360), seen = new Set();
    for (let i = 0; i < 16 && seen.size < 2; i++) { await r.goto(file + "?n=" + i); seen.add(await r.evaluate(() => document.body.dataset.splash)); }
    check("splash with nothing asked: one of the two at random (both come up)", seen.has("film") && seen.has("neural"), [...seen]);

    // ---- the theme, in the studio
    let up = true; try { const rr = await fetch(URL0); if (!rr.ok) throw 0; } catch { up = false; }
    if (!up) console.log("SKIP: no studio at " + URL0 + " - the Neural blue theme part did not run");
    else {
      const p = await page(1500, 950);
      await p.goto(URL0); await p.waitForFunction(() => window.H3Theme && document.getElementById("settings"), null, { timeout: 30000 }); await p.waitForTimeout(500);
      await p.evaluate(() => { document.getElementById("settings").showModal(); document.querySelector('#settings [data-stab="themes"]').click(); }); await p.waitForTimeout(200);
      const card = await p.evaluate(() => { const c = document.querySelector('#s_themes [data-theme-id="neural"]'); return c ? { title: c.title, bg: getComputedStyle(c).backgroundColor, order: [...document.querySelectorAll("#s_themes [data-theme-id]")].map((x) => x.dataset.themeId) } : null; });
      check("Settings ▸ Themes: a Neural blue card (navy), after Slate", card && card.title === "Neural blue" && card.bg === "rgb(6, 19, 42)" && card.order.join() === "dark,darker,slate,neural,light,contrast", card);
      await p.click('#s_themes [data-theme-id="neural"]'); await p.waitForTimeout(200);
      const on = await p.evaluate(() => { const cs = getComputedStyle(document.documentElement); return { theme: document.documentElement.dataset.theme, ink: cs.getPropertyValue("--ink").trim(), tiger: cs.getPropertyValue("--tiger").trim(), body: getComputedStyle(document.body).backgroundColor,
        pressed: document.querySelector('#s_themes [data-theme-id="neural"]').getAttribute("aria-pressed") }; });
      check("…a click turns the app navy with the electric-blue accent", on.theme === "neural" && on.ink === "#020a17" && on.tiger === "#52baff" && on.pressed === "true", on);
      await p.reload(); await p.waitForFunction(() => window.H3Theme, null, { timeout: 30000 });
      check("…kept after a reload", (await p.evaluate(() => document.documentElement.dataset.theme + " " + getComputedStyle(document.documentElement).getPropertyValue("--tiger").trim())) === "neural #52baff");
      await p.evaluate(() => H3Theme.choose("dark"));
      check("…Dark back (the default)", (await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--tiger").trim())) === "#f59e2c");
    }
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
