#!/usr/bin/env node
/* bitGen Studio — 2.701.0: THE START-UP SPLASH + THE LOGO IN THE SETUP. electron/main.js createSplash / maybeShowMain (the studio
 * shown when the splash is done AND its window is ready; 16.5 s at most; BITGEN_NO_SPLASH=1), static/splash.html + splash.webm,
 * misc/intro (the 15 s #splash with the credits), electron/installer.html's logo. The browser: scripts/test-ui701-ui.js.
 * Tim (verbatim): "can u make a splash screen with the video, but add produced and developed by Timothy Nolan Paul, programmed by
 * claude opus 5.5 15seconds, and add the logo to the setup" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 400))); } };
const rd = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const M = rd("electron/main.js"), SP = rd("static/splash.html"), IN = rd("misc/intro/intro.html"), RN = rd("misc/intro/render.js"), IS = rd("electron/installer.html");
check("main.js: a splash window (frameless, on top, 16:9) loads static/splash.html before the server starts", /function createSplash\(\)/.test(M) && /frame: false, resizable: false, center: true, alwaysOnTop: true/.test(M) && /splash\.loadFile\(f\)/.test(M) && /createSplash\(\);\s+\/\/ 2\.701\.0: the splash while the studio starts\s+try \{ await startServer\(\); \}/.test(M));
check("…the studio is shown only when the splash is done AND its window is ready; 16.5 s at most; BITGEN_NO_SPLASH=1 / no files = none (2.752.0: the brain's picture is what must be there)",
  /win\.once\("ready-to-show", \(\) => \{ winReady = true; maybeShowMain\(\); \}\)/.test(M) && /winReady && splashDone/.test(M) && /setTimeout\(done, 16500\)/.test(M) && /BITGEN_NO_SPLASH === "1"/.test(M) && /existsSync\(path\.join\(ROOT, "static", "splash-neural\.jpg"\)\)/.test(M) && /let splash = null, splashDone = true/.test(M));
check("splash.html: plays a film (muted, autoplay) full window (2.752.0: always the brain film, splash-neural.webm); ended / a click / any key closes it; the skip hint", /<video id="v" muted playsinline><\/video>/.test(SP) && /v\.autoplay = true; v\.src = "splash-neural\.webm";/.test(SP) && !/"splash\.webm"/.test(SP) && /addEventListener\("ended", end\)/.test(SP) && /addEventListener\("mousedown", end\)/.test(SP) && /addEventListener\("keydown", end\)/.test(SP) && /click or press any key to skip/.test(SP));
const wb = path.join(ROOT, "static", "splash-neural.webm"), mp = path.join(ROOT, "docs", "images", "bitgen-studio-splash.mp4");
check("the films are there: static/splash-neural.webm (the app's, 2.752.0) + docs/images/bitgen-studio-splash.mp4 + the 10 s intro", fs.existsSync(wb) && fs.statSync(wb).size > 200000 && fs.readFileSync(wb).slice(0, 4).toString("hex") === "1a45dfa3" && fs.existsSync(mp) && fs.existsSync(path.join(ROOT, "docs", "images", "bitgen-studio-intro.mp4")));
check("the credits, exactly as Tim gave them: Produced and developed by Timothy Nolan Paul, Programmed by Claude Opus 5.5 (the 15 s #splash)",
  /<i>Produced and developed by<\/i><b>Timothy Nolan Paul<\/b>/.test(IN) && /<i>Programmed by<\/i><b>Claude Opus 5\.5<\/b>/.test(IN) && /DUR = SPLASH \? 15 : 10/.test(IN) && /N = SPL \? 450 : 300/.test(RN));
check("the setup: every page's mark + its title bar are the logo (static/icon.png - pictures, a CSS mask does not load over file://)",
  /\.mark \{[^}]*url\("\.\.\/static\/icon\.png"\)/.test(IS) && /#tbar \.logo \{[^}]*url\("\.\.\/static\/icon\.png"\)/.test(IS) && !/#tbar \.logo \{[^}]*mask:/.test(IS));
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
