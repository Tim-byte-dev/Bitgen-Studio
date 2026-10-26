#!/usr/bin/env node
/* bitGen Studio — scripts/test-seed598.js (2.598.0): THE SEED'S 🎲 RANDOM / 📌 FIXED TOGGLE - Basic Settings and the styles.
 * Tim: "add seed input in basic settings docker and in the styles - have a toggle button for random/fixed".
 *   lib/seedPick.js     norm (a style's seed_mode + seed), styleSeed, pick: Basic Settings' fixed seed > (Override style
 *                       on: Random stays random) > the style's fixed seed > random; the video cap 2^31-1
 *   lib/styles.js       image / video / music styles keep seed_mode + seed (random keeps the number for the toggle back;
 *                       an old style's bare seed is NOT fixed)
 *   routes              the video job (main + Wan), LTX, /api/genimage (no seed sent = the style's), the selection fill,
 *                       music use seedPick
 *   static/seedctl.js   pure: valueOf / fromValue / next / clean
 *   the page            Basic Settings' toggles (video #seed hidden, image #imgSeed sent with the image settings)
 * No server; nothing written. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const SP = require("../lib/seedPick");
const S = require("../lib/styles");
const C = require("../static/seedctl.js");

check("norm: fixed + a number = fixed; fixed without a number = random; random keeps its number; junk = random, null",
  JSON.stringify(SP.norm("fixed", 42)) === '{"seed_mode":"fixed","seed":42}' && JSON.stringify(SP.norm("fixed", "")) === '{"seed_mode":"random","seed":null}'
  && JSON.stringify(SP.norm("random", 7)) === '{"seed_mode":"random","seed":7}' && JSON.stringify(SP.norm("x", -3)) === '{"seed_mode":"random","seed":null}' && SP.norm("fixed", 2 ** 33).seed_mode === "random");
const fixed = { seed_mode: "fixed", seed: 1234 }, rand = { seed_mode: "random", seed: 1234 }, old = { seed: 99 };
check("styleSeed: only a FIXED style gives its seed (an old style's bare seed does not)", SP.styleSeed(fixed) === 1234 && SP.styleSeed(rand) === null && SP.styleSeed(old) === null && SP.styleSeed(null) === null);
check("pick: Basic Settings' fixed seed wins; Random + override = random; Random + no override = the style's fixed; none = -1; the video cap",
  SP.pick(5, fixed) === 5 && SP.pick(-1, fixed, { override: true }) === -1 && SP.pick(-1, fixed) === 1234 && SP.pick(null, fixed) === 1234
  && SP.pick(-1, rand) === -1 && SP.pick(undefined, null) === -1 && SP.pick(-1, { seed_mode: "fixed", seed: 2 ** 32 - 1 }, { max: 2 ** 31 - 1 }) === 2 ** 31 - 1);
const kinds = ["image", "video", "music"].map((k) => { const a = S.normalize({ name: "x", kind: k, seed_mode: "fixed", seed: 42 }); const b = S.normalize({ seed_mode: "random" }, a); const c = S.normalize({ name: "y", kind: k }); return [a.seed_mode, a.seed, b.seed_mode, b.seed, c.seed_mode, c.seed]; });
check("styles: image / video / music keep seed_mode + seed; switching to random keeps the number; a new style = random", kinds.every((r) => JSON.stringify(r) === '["fixed",42,"random",42,"random",null]'), kinds);
const R = rd("routes", "index.js");
check("routes: the video job + the Wan path + LTX + /api/genimage (no seed sent) + the selection fill + music go through seedPick",
  (R.match(/seedPick\.pick\(bo \? bo\.seed : clamp\("seed"/g) || []).length === 2 && /seedPick\.pick\(p\.seed, style\)\);/.test(R) && /seedPick\.pick\(null, style\)/.test(R)
  && /b\.seed === undefined \|\| b\.seed === null \|\| b\.seed === "" \? seedPick\.pick\(p\.seed, style\) : p\.seed/.test(R) && /seedPick"\)\.pick\(bo \? bo\.seed : b\.seed, style/.test(rd("routes", "ltx.js")));
check("seedctl pure: valueOf / fromValue / clean", C.valueOf({ mode: "fixed", seed: 9 }) === 9 && C.valueOf({ mode: "random", seed: 9 }) === -1 && C.valueOf({ mode: "fixed", seed: null }) === -1
  && JSON.stringify(C.fromValue("-1", 5)) === '{"mode":"random","seed":5}' && JSON.stringify(C.fromValue("77")) === '{"mode":"fixed","seed":77}' && C.clean("1.5") === null && C.clean("") === null);
check("seedctl next: random -> fixed takes its own number, else the last used, else a new one; fixed -> random keeps the number",
  JSON.stringify(C.next({ mode: "random", seed: 12 }, 50)) === '{"mode":"fixed","seed":12}' && JSON.stringify(C.next({ mode: "random", seed: null }, 50)) === '{"mode":"fixed","seed":50}'
  && C.next({ mode: "random", seed: null }, null, () => 777).seed === 777 && JSON.stringify(C.next({ mode: "fixed", seed: 12 })) === '{"mode":"random","seed":12}');
const H = rd("static", "index.html");
check("the page: Basic Settings' video seed = the toggle + number + hidden #seed + ♻; the image settings' seed (sent with them); seedctl.js loaded",
  /id="seedMode"[^>]*>🎲 Random/.test(H.replace(/\n\s*/g, " ")) && /<input type="hidden" id="seed" value="-1">/.test(H) && /id="seedNum"/.test(H) && /id="seedLast"/.test(H)
  && /id="imgSeedMode"/.test(H) && /<input type="hidden" id="imgSeed" value="-1">/.test(H) && /body\.seed = parseInt\(\$\("imgSeed"\)\.value, 10\)/.test(H)
  && /<script src="\/static\/seedctl\.js">/.test(H) && !/id="seedRand"/.test(H));
const J = rd("static", "seedctl.js");
check("seedctl wraps the three style editors (readStyleForm / vsReadForm / readMusicForm + their paint) and leaves a ControlNet chain alone",
  /read: "readStyleForm", paint: "paintStyleForm"/.test(J) && /read: "vsReadForm", paint: "vsPaintForm"/.test(J) && /read: "readMusicForm", paint: "paintMusicForm"/.test(J) && /!b\.chain/.test(J));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
