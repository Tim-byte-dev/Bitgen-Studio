#!/usr/bin/env node
/* bitGen Studio — 2.911.0 in a REAL browser:
 *   ✨ Write the song (Tim: "does the music prompt work the same as in bitgen? the llm writes it?"): the 📱 app (served as
 *      http://localhost, its requests "from the network" - the test-ui909 harness) sends an idea; the PC's LLM (the e2e stub
 *      LLM, answering the way chat models do: a think block, bold labels) writes the title, the sound and the lyrics into
 *      the app's fields - lib/songwriter.js, the chat's own songwriter.
 *   📱 build + install (Tim: "can we compile the apk in bitgen, general tab remote - and install it to the phone
 *      automatically?"): Settings ▸ General ▸ Remote shows the 📱 box; with stand-ins for Java 21, the Android SDK, adb and
 *      Gradle (the real ones need Google's servers) the page pairs the phone with its 6-digit code (found again by mDNS),
 *      then 🔨 Build + install runs npm install + cap sync for real, Gradle (the stand-in) makes the APK, adb installs it
 *      with -r and starts the app. A phone's key cannot reach /api/apk/* (403).
 * Against the running app (H3_URL) in the e2e gate (H3_E2E=1). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync, spawn } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = (process.env.H3_URL || "http://127.0.0.1:8311/").replace(/\/$/, "");
const WWW = path.join(__dirname, "..", "mobile", "www");
const XFF = { "x-forwarded-for": "192.168.1.50" };
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const post = (p, b, h) => fetch(URL_ + p, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, h || {}), body: JSON.stringify(b || {}) });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };
const sh = (f, body) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, "#!/bin/sh\n" + body); fs.chmodSync(f, 0o755); };
(async () => {
  try { const r = await fetch(URL_ + "/"); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL_); process.exit(0); }
  if (!chromium) { console.log("SKIP: playwright is not installed here"); return; }
  if (process.platform === "win32") { console.log("SKIP: the stand-in tools are shell scripts"); return; }
  const cfg0 = await (await fetch(URL_ + "/api/config")).json();
  const was = await (await fetch(URL_ + "/api/remote/status")).json();
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg911-"));
  const llm = spawn("python3", [path.join(__dirname, "stub-llm.py"), "8399", path.join(T, "llm")], { stdio: "ignore" });
  const b = await chromium.launch({ args: ["--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests"] });
  try {
    await new Promise((ok) => setTimeout(ok, 700));
    await post("/api/config", { llm: { external_url: "http://127.0.0.1:8399/v1/chat/completions" } });
    // ---- ✨ Write the song, from the app
    await post("/api/remote/enable", { on: true });
    await post("/api/remote/e2e-bound", { host: "0.0.0.0" });
    const L = await (await post("/api/remote/link", {})).json();
    if (L.url) {
      const host = new URL(L.url).host;
      const ctx = await b.newContext({ viewport: { width: 344, height: 882 }, extraHTTPHeaders: XFF });
      const p = await ctx.newPage();
      const errs = []; p.on("pageerror", (e) => errs.push(e.message));
      await p.route("http://localhost/**", (rt) => {
        const u = new URL(rt.request().url()), f = path.join(WWW, decodeURIComponent(u.pathname === "/" ? "/index.html" : u.pathname));
        if (!f.startsWith(WWW) || !fs.existsSync(f)) return rt.fulfill({ status: 404, body: "" });
        rt.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || "application/octet-stream", body: fs.readFileSync(f) });
      });
      await p.route((u) => u.host === host, (rt) => rt.continue({ url: rt.request().url().replace("//" + host, "//" + new URL(URL_).host) }));
      await p.goto("http://localhost/index.html");
      await p.waitForFunction(() => window.BG && !document.getElementById("v-connect").hidden, null, { timeout: 10000 });
      await p.fill("#linkIn", L.url); await p.click("#pairBtn");
      await p.waitForFunction(() => !document.getElementById("v-create").hidden, null, { timeout: 15000 });
      await p.click('#kindSeg button[data-kind="music"]');
      await p.waitForFunction(() => [...document.querySelectorAll("#styleSel option")].some((o) => /ACE-Step/.test(o.textContent)), null, { timeout: 8000 });
      await p.selectOption("#styleSel", { label: "ACE-Step 1.5" });
      await p.fill("#prompt", "a song about neon rain in Bangkok");
      await p.click("#writeSong");
      await p.waitForFunction(() => /written/.test(document.getElementById("goMsg").textContent) || /bad/.test(document.getElementById("goMsg").className), null, { timeout: 60000 }).catch(() => {});
      const w = await p.evaluate(() => ({ msg: document.getElementById("goMsg").textContent, title: document.getElementById("muTitle").value, cap: document.getElementById("muCaption").value, lyr: document.getElementById("prompt").value }));
      check("✨ Write the song: the PC's LLM wrote the title, the sound and the lyrics into the app (bold labels + think block seen through)",
        /written/.test(w.msg) && w.title === "Lanterns on Neon Rain" && /dreamy synth-pop/.test(w.cap) && /^\[verse\]\nLights on the water, neon rain at night\n\[chorus\]/.test(w.lyr), w);
      const reqs = fs.readdirSync(path.join(T, "llm")).filter((f) => /^llm_request_/.test(f)).map((f) => JSON.parse(fs.readFileSync(path.join(T, "llm", f), "utf8")));
      const last = reqs[reqs.length - 1] || {}, sys = ((last.messages || [])[0] || {}).content || "";
      check("…the LLM was given the songwriter's shape and the style's own sound words", /THE USER IS ASKING FOR A SONG/.test(sys) && /indie pop/i.test(sys) && /neon rain in Bangkok/.test(JSON.stringify(last.messages || [])), sys.slice(0, 300));
      check("no page errors in the app", errs.length === 0, errs);
      // a phone's key cannot reach the build
      const tok = await p.evaluate(() => localStorage.getItem("bg.key"));
      const r = await fetch(URL_ + "/api/apk/status", { headers: Object.assign({ "X-Bitgen-Key": tok || "" }, XFF) });
      check("a paired phone's key does not reach /api/apk/* (403 - the PC's business)", r.status === 403, r.status);
      await ctx.close();
    } else console.log("SKIP (songwriter part): no network address for a pairing link");
    await post("/api/remote/revoke", {});
    await post("/api/remote/enable", { on: !!was.enabled });
    await post("/api/remote/e2e-bound", { host: was.bound || "127.0.0.1" });

    // ---- 📱 build + install, with stand-ins for the tools
    const jdk = path.join(T, "jdk"), sdk = path.join(T, "sdk"), st = path.join(T, "adb-state");
    sh(path.join(jdk, "bin", "java"), 'echo \'openjdk version "21.0.5" 2024-10-15\' 1>&2\n');
    fs.mkdirSync(path.join(sdk, "platforms", "android-36"), { recursive: true });
    fs.mkdirSync(st, { recursive: true });
    sh(path.join(sdk, "platform-tools", "adb"), `S=${st}
echo "$@" >> $S/calls
case "$1" in
  pair) if [ "$3" = "123456" ]; then echo "Successfully paired to $2 [guid=adb-R5CT30XYZ-AbCdEf]"; touch $S/paired; else echo "Failed: Wrong password or connection was dropped."; fi ;;
  mdns) echo "List of discovered mdns services"; [ -f $S/paired ] && printf 'adb-R5CT30XYZ-AbCdEf\\t_adb-tls-connect._tcp\\t192.168.7.23:41234\\n' ;;
  connect) if [ -f $S/paired ]; then echo "connected to $2"; touch $S/connected; else echo "failed to connect to $2"; fi ;;
  devices) echo "List of devices attached"; [ -f $S/connected ] && echo "192.168.7.23:41234     device product:q6qxxx model:SM_F956B device:q6q transport_id:4" ;;
  -s) case "$3" in install) [ -f "$5" ] && echo "Performing Streamed Install" && echo "Success" ;; shell) echo "Events injected: 1" ;; esac ;;
esac
`);
    const gw = path.join(T, "gradlew");
    sh(gw, 'echo "> Task :app:assembleDebug"\nmkdir -p app/build/outputs/apk/debug && printf "PK-fake-apk" > app/build/outputs/apk/debug/app-debug.apk\necho "BUILD SUCCESSFUL in 3s"\n');
    await post("/api/apk/paths", { jdk, sdk, test_gradlew: gw, forget_phone: true });
    const page = await b.newPage({ viewport: { width: 1500, height: 1000 } });
    const perrs = []; page.on("pageerror", (e) => perrs.push(e.message));
    await page.goto(URL_ + "/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.H3ApkUi && document.getElementById("apk_box") && /Java/.test(document.getElementById("apk_tools").textContent), null, { timeout: 60000 });
    await page.evaluate(() => { document.getElementById("openSettings").click(); });
    await page.waitForTimeout(800);
    await page.evaluate(() => { const t = document.querySelector('[data-stab="general"]'); if (t) t.click(); });
    await page.evaluate(() => H3ApkUi.refresh());
    await page.waitForFunction(() => /✓ Java 21 \(Settings\)/.test(document.getElementById("apk_tools").textContent), null, { timeout: 10000 }).catch(() => {});
    check("Settings ▸ General ▸ Remote: the 📱 box finds Java 21 and the SDK (with adb); ⬇ Get the build tools hidden",
      await page.evaluate(() => /✓ Java 21 \(Settings\)/.test(document.getElementById("apk_tools").textContent) && /✓ Android SDK \(Settings\)/.test(document.getElementById("apk_tools").textContent)
        && document.getElementById("apk_get").hidden && document.getElementById("apk_box").parentNode.id === "stab-general"), await page.evaluate(() => document.getElementById("apk_tools").textContent));
    // pair
    await page.evaluate(() => { document.getElementById("apk_phone").open = true; });
    await page.fill("#apk_paddr", "192.168.7.23:37123"); await page.fill("#apk_pcode", "654321"); await page.click("#apk_pair");
    await page.waitForFunction(() => /✗/.test(document.getElementById("apk_phase").textContent), null, { timeout: 15000 }).catch(() => {});
    check("a wrong pairing code says the phone did not pair", /did not pair/.test(await page.evaluate(() => document.getElementById("apk_phase").textContent)), await page.evaluate(() => document.getElementById("apk_phase").textContent));
    await page.fill("#apk_pcode", "123456");
    await page.evaluate(() => { document.getElementById("apk_phase").textContent = ""; });
    await page.click("#apk_pair");
    await page.waitForFunction(() => /✓ pairing the phone - done/.test(document.getElementById("apk_phase").textContent) || /✗/.test(document.getElementById("apk_phase").textContent), null, { timeout: 30000 }).catch(() => {});
    check("Pair with the 6-digit code -> paired, connected by mDNS, the phone remembered (SM F956B)", await page.evaluate(() => /done/.test(document.getElementById("apk_phase").textContent) && /SM F956B at 192\.168\.7\.23/.test(document.getElementById("apk_phoneline").textContent)),
      await page.evaluate(() => [document.getElementById("apk_phase").textContent, document.getElementById("apk_phoneline").textContent]));
    fs.rmSync(path.join(st, "connected"), { force: true });         // Wireless debugging switched off and on: a new port, not connected
    // build + install
    await page.evaluate(() => { document.getElementById("apk_phase").textContent = ""; });
    await page.click("#apk_buildinst");
    await page.waitForFunction(() => /✓ installing the app - done|✗/.test(document.getElementById("apk_phase").textContent), null, { timeout: 300000 }).catch(() => {});
    const ph = await page.evaluate(() => ({ phase: document.getElementById("apk_phase").textContent, log: document.getElementById("apk_log").textContent.slice(-1500), apk: document.getElementById("apk_apk").textContent }));
    check("🔨 Build + install: npm install + cap sync + Gradle -> mobile/dist/bitGen.apk, then installed and started on the phone", /installing the app - done/.test(ph.phase) && /Built: bitGen/.test(ph.apk), ph);
    const calls = fs.readFileSync(path.join(st, "calls"), "utf8");
    check("…the phone found again by mDNS (its new port), install -r of the built APK, the app started", /mdns services/.test(calls) && /connect 192\.168\.7\.23:41234/.test(calls)
      && /-s 192\.168\.7\.23:41234 install -r \S+mobile\/dist\/bitGen\.apk/.test(calls) && /monkey -p au\.com\.tigerart\.bitgen/.test(calls), calls);
    const s2 = await (await fetch(URL_ + "/api/apk/status")).json();
    check("…cap sync really ran (the web files are in the Android project) and local.properties names the SDK", s2.apk && fs.existsSync(path.join(s2.apk.path, "..", "..", "android", "app", "src", "main", "assets", "public", "index.html"))
      && fs.readFileSync(path.join(s2.apk.path, "..", "..", "android", "local.properties"), "utf8").includes("sdk.dir=" + sdk), s2.apk);
    check("⬇ APK file downloads it", (await fetch(URL_ + "/api/apk/file")).status === 200);
    check("no page errors in the studio", perrs.length === 0, perrs);
  } finally {
    await b.close();
    try { llm.kill(); } catch { /* gone */ }
    await post("/api/config", { llm: { external_url: ((cfg0.llm || {}).external_url) || "" } });
    await post("/api/apk/paths", { jdk: "", sdk: "", test_gradlew: "", forget_phone: true });
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
