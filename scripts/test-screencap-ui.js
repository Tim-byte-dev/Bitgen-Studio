#!/usr/bin/env node
/* bitGen Studio — 2.367.0: the left dock's 📷 / ⏺ in a REAL browser (Chromium through Playwright).
 * Tim: "can we add a screen capture and screen record button in the left docker menubar, icon only. so i can
 * make a promotional video and tutorials". Run against the running app (H3_URL, default the e2e server on
 * :8311). No Playwright here, or no display on Linux (use xvfb-run) = SKIP (exit 0).
 *   1. 📷 and ⏺ sit in the left dock's menu bar, icon only;
 *   2. 📷 = the browser shares this tab, one frame -> a real PNG screenshot_<stamp>.png in the project's
 *      output (the gallery lists it);
 *   3. ⏺ ... ⏺ = MediaRecorder chunks every second -> the server -> screenrec_<stamp>.mp4 (H.264), listed in
 *      the gallery; the button pulses red while it records and comes back as ⏺.
 * The files it made are deleted afterwards.
 *   node scripts/test-screencap-ui.js */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the screen capture browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); }
};
(async () => {
  const proj = await fetch(URL_ + "api/projects/current").then((r) => r.json()).then((j) => j.name).catch(() => "default");
  const OUT = path.join(ROOT, "projects", proj, "output");
  const made = [];
  // screen capture needs a real (or virtual) display: headless Chromium answers NotSupported. The e2e runs this
  // under xvfb-run; with no display on Linux the test SKIPs rather than fails.
  if (process.platform === "linux" && !process.env.DISPLAY) {
    console.log("SKIP: no display (run under xvfb-run) - the screen capture browser test did not run"); process.exit(0);
  }
  const b = await chromium.launch({ headless: false, args: ["--auto-accept-this-tab-capture",
    "--autoplay-policy=no-user-gesture-required"] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForSelector("#capShot", { timeout: 20000 });
    const bar = await p.evaluate(() => [...document.querySelectorAll("#menubar .projbtns > button")].map((x) => x.id + "=" + x.textContent.trim()));
    // 2.374.0: 🗑 Recycle bin and ↺ Reset project sit between ⏺ and ⚙ (static/recyclebin.js)
    check("📷 and ⏺ in the menu bar (2.382.1: under the title bar), icon only, before ⚙ (then 🗑 ↺)",
      bar.join(" ").includes("capShot=📷 capRec=⏺ projBin=🗑 projReset=↺ openSettings=⚙"), bar);
    // the browser path: no app shell here
    await p.evaluate(() => { window.ScreenCap.prefs.target = "window"; window.ScreenCap.prefs.countdown = 0;
                             window.ScreenCap.prefs.mic = false; window.ScreenCap.prefs.systemAudio = false; });
    const shot = await p.evaluate(() => window.ScreenCap.shot());
    if (shot && shot.name) made.push(shot.name);
    const pf = shot && path.join(OUT, shot.name);
    const sig = pf && fs.existsSync(pf) ? fs.readFileSync(pf).subarray(0, 8).toString("hex") : "";
    const dim = pf && fs.existsSync(pf) ? spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", pf],
      { encoding: "utf8" }).stdout.trim() : "";
    check("📷 (a browser tab): this tab shared, one frame -> a real PNG screenshot_<stamp>.png in the project's output",
      shot && /^screenshot_\d{8}-\d{6}(_\d+)?\.png$/.test(shot.name) && sig === "89504e470d0a1a0a" && /^\d{3,4},\d{3,4}$/.test(dim),
      { shot, sig, dim, errs });
    await p.click("#capRec");
    await p.waitForFunction(() => window.ScreenCap.recording(), null, { timeout: 15000 });
    const during = await p.evaluate(() => { const r = document.getElementById("capRec"); return { cls: r.className, txt: r.textContent }; });
    check("⏺ starts: the button is a red ■ (class rec)", /\brec\b/.test(during.cls) && during.txt === "■", during);
    await p.waitForTimeout(3200);
    await p.click("#capRec");
    await p.waitForFunction(() => { const r = document.getElementById("capRec"); return !window.ScreenCap.recording() && r.textContent === "⏺" && !r.disabled; },
      null, { timeout: 60000 });
    const names = fs.readdirSync(OUT).filter((n) => /^screenrec_.*\.(mp4|webm)$/.test(n));
    const newest = names.map((n) => ({ n, t: fs.statSync(path.join(OUT, n)).mtimeMs })).sort((a, c) => c.t - a.t)[0];
    if (newest) made.push(newest.n);
    const vf = newest ? path.join(OUT, newest.n) : "";
    const pr = vf ? spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name:format=duration",
      "-of", "csv=p=0", vf], { encoding: "utf8" }).stdout.trim().split(/\s+/) : [];
    check("⏺ stop: a ~3 s H.264 screenrec_<stamp>.mp4 in the project's output, the button back to ⏺",
      newest && /\.mp4$/.test(newest.n) && pr[0] === "h264" && Number(pr[1]) > 1.5, { newest, pr, errs });
    const vids = JSON.stringify(await fetch(URL_ + "api/outputs").then((r) => r.json()).catch(() => null));
    const imgs = JSON.stringify(await fetch(URL_ + "api/outputs?kind=images").then((r) => r.json()).catch(() => null));
    check("...the gallery lists both: the PNG in its Images, the mp4 in its Videos",
      shot && newest && imgs.includes(shot.name) && vids.includes(newest.n), [imgs.slice(0, 200), vids.slice(0, 200)]);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: threw " + (e && e.stack || e)); }
  finally {
    for (const n of made) { try { fs.unlinkSync(path.join(OUT, n)); } catch {} }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
