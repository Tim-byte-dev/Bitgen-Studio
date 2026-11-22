#!/usr/bin/env node
/* bitGen Studio — 2.924.0 in a REAL browser: the 📱 app built from bitGen wears the studio's theme colours.
 * Tim: "when building the app from bitgen can we use the theme colors currently selected for the app?"
 * Against the running studio (H3_URL, default the e2e server on :8311), the way test-ui911-ui.js builds the app: stand-ins
 * for Java / the SDK / Gradle, npm install + cap sync for real. The studio is put on the Light theme with an accent of its
 * own and a Customize colour, 🔨 Build is pressed, then the BUILT app (android/app/src/main/assets/public) is opened in
 * Chromium: its colours must be the studio's, its status bar icons dark. Then the Dark look, built again. SKIP without
 * Playwright, on Windows (the stand-ins are shell scripts) or without the app's source. */
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
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json" };
const sh = (f, body) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, "#!/bin/sh\n" + body); fs.chmodSync(f, 0o755); };

(async () => {
  try { const r = await fetch(URL_ + "/"); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL_); process.exit(0); }
  if (!chromium) { console.log("SKIP: playwright is not installed here"); return; }
  if (process.platform === "win32") { console.log("SKIP: the stand-in tools are shell scripts"); return; }
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg924-"));
  const jdk = path.join(T, "jdk"), sdk = path.join(T, "sdk");
  sh(path.join(jdk, "bin", "java"), 'echo \'openjdk version "21.0.5" 2024-10-15\' 1>&2\n');
  fs.mkdirSync(path.join(sdk, "platforms", "android-36"), { recursive: true });
  sh(path.join(sdk, "platform-tools", "adb"), 'echo "List of devices attached"\n');
  const gw = path.join(T, "gradlew");
  sh(gw, 'echo "> Task :app:assembleDebug"\nmkdir -p app/build/outputs/apk/debug && printf "PK-fake-apk" > app/build/outputs/apk/debug/app-debug.apk\necho "BUILD SUCCESSFUL in 3s"\n');
  const b = await chromium.launch();
  try {
    await post("/api/apk/paths", { jdk, sdk, test_gradlew: gw, forget_phone: true });
    const page = await b.newPage({ viewport: { width: 1500, height: 1000 } });
    const perrs = []; page.on("pageerror", (e) => perrs.push(e.message));
    await page.goto(URL_ + "/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.H3ApkUi && window.H3Theme && document.getElementById("apk_build"), null, { timeout: 60000 });
    const build = async () => {
      await page.evaluate(() => { document.getElementById("apk_phase").textContent = ""; document.getElementById("apk_build").click(); });
      await page.waitForFunction(() => /✓ building the app - done|✗/.test(document.getElementById("apk_phase").textContent), null, { timeout: 600000 }).catch(() => {});
      return page.evaluate(() => ({ phase: document.getElementById("apk_phase").textContent, log: document.getElementById("apk_log").textContent }));
    };
    const assetsOf = async () => { const s = await (await fetch(URL_ + "/api/apk/status")).json(); return path.join(s.apk.path, "..", "..", "android", "app", "src", "main", "assets", "public"); };
    /** the BUILT app in Chromium (its own files, a stand-in Capacitor that records SystemBars.setStyle) -> its colours */
    const look = async (pub) => {
      const ctx = await b.newContext({ viewport: { width: 412, height: 880 } });
      await ctx.addInitScript(() => { window.__bars = []; window.Capacitor = { Plugins: { SystemBars: { setStyle: (o) => { window.__bars.push(o.style); return Promise.resolve(); }, hide: () => Promise.resolve(), show: () => Promise.resolve() }, LanInfo: { get: () => Promise.resolve({ wifi: false }) } } }; });
      await ctx.route("http://localhost/**", (rt) => {
        const u = new URL(rt.request().url()), f = path.join(pub, decodeURIComponent(u.pathname === "/" ? "/index.html" : u.pathname));
        if (!f.startsWith(pub) || !fs.existsSync(f)) return rt.fulfill({ status: 404, body: "" });
        rt.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || "application/octet-stream", body: fs.readFileSync(f) });
      });
      const a = await ctx.newPage(); const errs = []; a.on("pageerror", (e) => errs.push(e.message));
      await a.goto("http://localhost/index.html"); await a.waitForTimeout(800);
      const v = await a.evaluate(() => { const cs = getComputedStyle(document.documentElement), body = getComputedStyle(document.body), go = document.querySelector(".btn.go");
        return { bg: cs.getPropertyValue("--bg").trim(), ink: cs.getPropertyValue("--ink").trim(), tiger: cs.getPropertyValue("--tiger").trim(), on: cs.getPropertyValue("--on-tiger").trim(),
          body: body.backgroundColor, text: body.color, goBg: go ? getComputedStyle(go).backgroundColor : "", goFg: go ? getComputedStyle(go).color : "", scheme: cs.colorScheme, theme: window.BG_THEME, bars: window.__bars.slice() }; });
      await ctx.close();
      return { v, errs };
    };

    // ---- the studio on Light + an accent of its own + one Customize colour
    await page.evaluate(() => H3Theme.choose("light", "#2b6cd6", { panel: "#fdfcf8" }, "My Light"));
    const r1 = await build();
    check("🔨 Build with the studio on Light (+ accent #2b6cd6, a Customize panel): built, the log names the colours used", /building the app - done/.test(r1.phase) && /🎨 the app's colours: bitGen Studio's theme "My Light" \(light, accent #2b6cd6\)/.test(r1.log), r1.phase + " | " + r1.log.slice(-600));
    const pub = await assetsOf();
    const tf = path.join(pub, "lib", "theme.js");
    check("…the theme went into the Android project with the app (assets/public/lib/theme.js, after cap sync)", fs.existsSync(tf) && /"My Light"/.test(fs.readFileSync(tf, "utf8")));
    const L = await look(pub);
    check("the BUILT app wears it: the studio's light background, its text, the accent - the page painted with them (rgb 243,241,236)",
      L.v.bg === "#f3f1ec" && L.v.ink === "#26221b" && L.v.tiger === "#2b6cd6" && L.v.body === "rgb(243, 241, 236)" && L.v.text === "rgb(38, 34, 27)" && L.v.scheme === "light", L.v);
    check("…GENERATE in the accent with white words (they read on blue); the phone's bar icons dark (SystemBars LIGHT)",
      L.v.goBg === "rgb(43, 108, 214)" && L.v.on === "#ffffff" && L.v.goFg === "rgb(255, 255, 255)" && L.v.bars[0] === "LIGHT", L.v);
    check("…the Customize colour came along (--panel #fdfcf8)", /"--panel":"#fdfcf8"/.test(fs.readFileSync(tf, "utf8")));
    check("no page errors in the built app", L.errs.length === 0, L.errs);

    // ---- back to Dark
    await page.evaluate(() => H3Theme.choose("dark", "", {}, ""));
    const r2 = await build();
    const D = await look(await assetsOf());
    check("built again on Dark: the app is dark again, the accent bitGen's orange with dark words, light bar icons (DARK)",
      /theme "Dark" \(dark, accent #f59e2c\)/.test(r2.log) && D.v.bg === "#14120f" && D.v.tiger === "#f59e2c" && D.v.goFg === "rgb(26, 18, 6)" && D.v.bars[0] === "DARK", D.v);
    check("no page errors in the studio", perrs.length === 0, perrs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally {
    await b.close();
    await post("/api/apk/paths", { jdk: "", sdk: "", test_gradlew: "", forget_phone: true });
    fs.rmSync(T, { recursive: true, force: true });
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
