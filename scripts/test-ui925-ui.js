#!/usr/bin/env node
/* bitGen Studio — 2.925.0 in a REAL browser: bitGen Studio keeps itself and the 📱 app up to date from GitHub.
 * Tim: "is there a way to make the phone app update from github? instead of contantly copying and pasting?" -> "B) PC auto-updates".
 * Against the running studio (H3_URL, default the e2e server on :8311):
 *  1. Settings ▸ General ▸ ⟳ Updates has the switches (by itself / every N hours / then the 📱 app), saved on the server;
 *  2. the restart bar (a restart waiting, shown through /api/update/auto/e2e): in a browser it asks for start.bat; in the
 *     desktop app it counts down and restarts; Later hides it for an hour;
 *  3. the app built AGAIN by itself (stand-in Java / SDK / Gradle, as test-ui924-ui.js): 🔨 Build once on Light, the studio
 *     put back on Dark, a file of the app's source changed -> the look builds it again, in the LAST build's colours (Light).
 * No GitHub is asked (⟳ Look now is not pressed). SKIP without Playwright, on Windows or without the app's source. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = (process.env.H3_URL || "http://127.0.0.1:8311/").replace(/\/$/, "");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const post = (p, b) => fetch(URL_ + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) });
const getj = async (p) => (await fetch(URL_ + p)).json();
const sh = (f, body) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, "#!/bin/sh\n" + body); fs.chmodSync(f, 0o755); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  try { const r = await fetch(URL_ + "/"); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL_); process.exit(0); }
  if (!chromium) { console.log("SKIP: playwright is not installed here"); return; }
  if (process.platform === "win32") { console.log("SKIP: the stand-in tools are shell scripts"); return; }
  const au0 = await getj("/api/update/auto");
  if (!au0.settings) { console.log("SKIP: this studio has no /api/update/auto"); return; }
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg925-"));
  const jdk = path.join(T, "jdk"), sdk = path.join(T, "sdk");
  sh(path.join(jdk, "bin", "java"), 'echo \'openjdk version "21.0.5" 2024-10-15\' 1>&2\n');
  fs.mkdirSync(path.join(sdk, "platforms", "android-36"), { recursive: true });
  sh(path.join(sdk, "platform-tools", "adb"), 'echo "List of devices attached"\n');
  const gw = path.join(T, "gradlew");
  sh(gw, 'echo "> Task :app:assembleDebug"\nmkdir -p app/build/outputs/apk/debug && printf "PK-fake-apk" > app/build/outputs/apk/debug/app-debug.apk\necho "BUILD SUCCESSFUL in 3s"\n');
  const b = await chromium.launch();
  let marker = "";
  try {
    await post("/api/update/auto/e2e", { clear: true });
    const page = await b.newPage({ viewport: { width: 1500, height: 1000 } });
    const perrs = []; page.on("pageerror", (e) => perrs.push(e.message));
    await page.goto(URL_ + "/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.H3AutoUpdate && document.getElementById("auBox") && document.getElementById("auLine").textContent, null, { timeout: 60000 });

    // ---- 1. the switches
    const ui = await page.evaluate(() => ({ inUpdates: !!document.querySelector("#upSec #auBox"), on: document.getElementById("auOn").checked, every: document.getElementById("auEvery").value, app: document.getElementById("auApp").checked, appOff: document.getElementById("auApp").disabled, line: document.getElementById("auLine").textContent }));
    check("⟳ Updates has the switches: off at first, every 6 hours, the 📱 app ticked (greyed while off), the line says Off", ui.inUpdates && !ui.on && ui.every === "6" && ui.app && ui.appOff && /^Off/.test(ui.line), ui);
    await page.evaluate(() => { const s = document.getElementById("auEvery"); s.value = "12"; s.dispatchEvent(new Event("change")); });
    await page.evaluate(() => { const c = document.getElementById("auOn"); c.checked = true; c.dispatchEvent(new Event("change")); });
    await page.waitForFunction(() => !document.getElementById("auApp").disabled, null, { timeout: 10000 }).catch(() => {});
    let s = await getj("/api/update/auto");
    check("ticking it saves on the server (auto, every 12 hours); the app switch comes alive", s.settings.auto === true && s.settings.every_h === 12 && await page.evaluate(() => !document.getElementById("auApp").disabled), s.settings);
    await page.evaluate(() => { const c = document.getElementById("auOn"); c.checked = false; c.dispatchEvent(new Event("change")); });
    await sleep(500);
    s = await getj("/api/update/auto");
    check("…and unticking it switches it off again", s.settings.auto === false, s.settings);

    // ---- 2. the restart bar
    await post("/api/update/auto/e2e", { restart: { from: "2.925.0", to: "2.926.0" } });
    await page.evaluate(() => { delete window.h3shell; return H3AutoUpdate.poll(); });
    await page.waitForSelector("#auBar", { timeout: 10000 }).catch(() => {});
    const br = await page.evaluate(() => { const b = document.getElementById("auBar"); return b && { text: b.textContent, go: !document.getElementById("auBarGo").hidden }; });
    check("a restart waiting, in a browser: the bar says updated 2.925.0 → 2.926.0 and to start start.bat again (no countdown)", br && /2\.925\.0 → 2\.926\.0/.test(br.text) && /start\.bat/.test(br.text) && !br.go && !/restarting in/.test(br.text), br);
    // the desktop app: a countdown, then the restart
    await page.evaluate(() => { document.getElementById("auBar").remove(); window.__relaunched = 0; window.h3shell = { relaunch: () => { window.__relaunched++; } }; return H3AutoUpdate.poll(); });
    await page.waitForSelector("#auBarN", { timeout: 10000 }).catch(() => {});
    const cd = await page.evaluate(() => ({ text: (document.getElementById("auBar") || {}).textContent || "", n: +((document.getElementById("auBarN") || {}).textContent || 0) }));
    check("…in the desktop app: \"restarting in 60 s\" (nothing running), ⟳ Restart now and Later", /restarting in\s*\d+\s*s/.test(cd.text) && cd.n > 50 && /Restart now/.test(cd.text) && /Later/.test(cd.text), cd);
    await page.evaluate(() => { H3AutoUpdate.state.count = 2; });
    await page.waitForFunction(() => window.__relaunched > 0, null, { timeout: 8000 }).catch(() => {});
    check("…the countdown ends -> the desktop app restarts itself (h3shell.relaunch)", await page.evaluate(() => window.__relaunched) === 1);
    await page.evaluate(() => { const b = document.getElementById("auBar"); if (b) b.remove(); return H3AutoUpdate.poll(); });
    await page.waitForSelector("#auBarLater", { timeout: 10000 }).catch(() => {});
    await page.evaluate(() => document.getElementById("auBarLater").click());
    await page.waitForFunction(() => !document.getElementById("auBar"), null, { timeout: 10000 }).catch(() => {});
    s = await getj("/api/update/auto");
    check("Later hides the bar for an hour (later_until on the server)", await page.evaluate(() => !document.getElementById("auBar")) && s.state.later_until > Date.now() + 50 * 60000, s.state);
    await post("/api/update/auto/e2e", { clear: true });
    await page.evaluate(() => { delete window.h3shell; return H3AutoUpdate.poll(); });

    // ---- 3. the app built again by itself, in the last build's colours
    const st0 = await getj("/api/apk/status");
    if (!st0.mobile) { console.log("SKIP (part 3): no mobile/ in this install"); }
    else {
      await post("/api/apk/paths", { jdk, sdk, test_gradlew: gw, forget_phone: true });
      await page.waitForFunction(() => window.H3ApkUi && window.H3Theme && document.getElementById("apk_build"), null, { timeout: 60000 });
      await page.evaluate(() => H3Theme.choose("light", "#2b6cd6", {}, "Tim Light"));
      await sleep(1100);   // a new apk's time differs from the last one
      await page.evaluate(() => { document.getElementById("apk_phase").textContent = ""; document.getElementById("apk_build").click(); });
      let j1 = {};   // the server's job (the page's phase line is the same job - read at the source): a NEW apk, then not running
      for (let i = 0; i < 600; i++) { const x = await getj("/api/apk/status"); j1 = x.job || {}; if (j1.state !== "running" && x.apk && (!st0.apk || x.apk.at !== st0.apk.at)) break; await sleep(1000); }
      check("🔨 Build once by hand (the studio on \"Tim Light\")", j1.state === "done" && /Tim Light/.test(j1.log.join("\n")), { state: j1.state, log: (j1.log || []).slice(-4) });
      await page.evaluate(() => H3Theme.choose("dark", "", {}, ""));   // the studio changes look afterwards
      await post("/api/update/auto/check", { app_only: true });
      for (let i = 0; i < 20; i++) { s = await getj("/api/update/auto"); if (s.state.app.state !== "building") break; await sleep(500); }
      check("the app's source unchanged: the look builds nothing (\"up to date\")", s.state.app.state !== "built" && /up to date/.test(s.state.app.note), s.state.app);
      const stB = await getj("/api/apk/status"), mobile = path.join(path.dirname(path.dirname(stB.apk.path)), "www");
      marker = path.join(mobile, "zz-test925.txt");
      fs.writeFileSync(marker, "a change to the app's source " + Date.now());
      await post("/api/update/auto/check", { app_only: true });
      for (let i = 0; i < 600; i++) { s = await getj("/api/update/auto"); if (s.state.app.state === "built" || s.state.app.state === "error") break; await sleep(1000); }
      check("a file of the app's source changed -> the look builds the 📱 app again by itself", s.state.app.state === "built" && /1\.11\.0/.test(s.state.app.note), s.state.app);
      const st1 = await getj("/api/apk/status");
      const log = (st1.job && st1.job.log || []).join("\n");
      check("…in the colours of the last build you pressed (\"Tim Light\"), not the studio's look now", /theme "Tim Light" \(light, accent #2b6cd6\)/.test(log), log.slice(-500));
      const tf = path.join(path.dirname(path.dirname(st1.apk.path)), "android", "app", "src", "main", "assets", "public", "lib", "theme.js");
      check("…the built app carries them (assets/public/lib/theme.js)", fs.existsSync(tf) && /"Tim Light"/.test(fs.readFileSync(tf, "utf8")));
      await page.evaluate(() => H3AutoUpdate.poll());
      const line = await page.evaluate(() => document.getElementById("auLine").textContent);
      check("the status line in Settings: Off (it was switched off) - the app built by ⟳ is shown when on", /^Off/.test(line), line);
    }
    check("no page errors", perrs.length === 0, perrs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally {
    await b.close();
    if (marker) try { fs.unlinkSync(marker); } catch { /* gone */ }
    await post("/api/update/auto", { auto: false, every_h: 6, app: true });
    await post("/api/update/auto/e2e", { clear: true });
    await post("/api/apk/paths", { jdk: "", sdk: "", test_gradlew: "", forget_phone: true });
    fs.rmSync(T, { recursive: true, force: true });
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
