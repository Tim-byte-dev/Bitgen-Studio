#!/usr/bin/env node
/* bitGen Studio — 2.912.0 in a REAL browser (Tim: "debugging is disabled - can we use windows phone link?" -> "ok, lets build all
 * 3"): with the stand-in Java / SDK / Gradle of test-ui911 a build is made (its id and versionCode passed), then
 *   📲 Install with a QR: refused while Remote access is off; on, a QR + http://<this PC>/apk/<token>/bitGen.apk - fetched "from
 *      the network" it is the APK (no key needed, the token is it); a made-up token = 404
 *   📂 Show the APK answers with the file (the file manager opened)
 *   ⬆ Update in the app: paired, the PC's build is newer than the app's own (www/lib/build.js) -> the bar; Update fetches
 *      /api/app/apk with the app's key = the APK; Settings says the app's build.
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
  const was = await (await fetch(URL_ + "/api/remote/status")).json();
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg912-"));
  const b = await chromium.launch({ args: ["--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests"] });
  try {
    const jdk = path.join(T, "jdk"), sdk = path.join(T, "sdk");
    sh(path.join(jdk, "bin", "java"), 'echo \'openjdk version "21.0.5" 2024-10-15\' 1>&2\n');
    fs.mkdirSync(path.join(sdk, "platforms", "android-36"), { recursive: true });
    sh(path.join(sdk, "platform-tools", "adb"), "echo List of devices attached\n");
    const gw = path.join(T, "gradlew");
    sh(gw, 'echo "args: $@" > ' + path.join(T, "gradle-args") + '\nmkdir -p app/build/outputs/apk/debug && printf "PK-fake-apk-912" > app/build/outputs/apk/debug/app-debug.apk\necho "BUILD SUCCESSFUL"\n');
    await post("/api/apk/paths", { jdk, sdk, test_gradlew: gw, forget_phone: true });
    await post("/api/remote/enable", { on: false });
    const page = await b.newPage({ viewport: { width: 1500, height: 1000 } });
    const perrs = []; page.on("pageerror", (e) => perrs.push(e.message));
    await page.goto(URL_ + "/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.H3ApkUi && document.getElementById("apk_box"), null, { timeout: 60000 });
    await page.evaluate(() => { document.getElementById("openSettings").click(); });
    await page.waitForTimeout(800);
    await page.evaluate(() => { const t = document.querySelector('[data-stab="general"]'); if (t) t.click(); H3ApkUi.refresh(); });
    await page.waitForFunction(() => !document.getElementById("apk_build").disabled, null, { timeout: 10000 }).catch(() => {});
    await page.evaluate(() => { document.getElementById("apk_phase").textContent = ""; });
    await page.click("#apk_build");
    await page.waitForFunction(() => /✓ building the app - done|✗/.test(document.getElementById("apk_phase").textContent), null, { timeout: 300000 }).catch(() => {});
    const st = await (await fetch(URL_ + "/api/apk/status")).json();
    const ga = fs.existsSync(path.join(T, "gradle-args")) ? fs.readFileSync(path.join(T, "gradle-args"), "utf8") : "";
    const bjs = fs.readFileSync(path.join(st.apk ? path.dirname(path.dirname(st.apk.path)) : WWW, "www", "lib", "build.js"), "utf8");
    const id = (/"id":"(\d{14})"/.exec(bjs) || [])[1];
    check("🔨 the build passes a rising versionCode + the app's version to Gradle, and stamps its id into the app (www/lib/build.js)",
      st.apk && /-PbgVersionCode=\d{6,}/.test(ga) && /-PbgVersionName=\d+\.\d+\.\d+/.test(ga) && !!id, [ga, bjs.slice(0, 200)]);
    const upd0 = await (await fetch(URL_ + "/api/app/update")).json();
    check("/api/app/update says the build here: its id, version, size", upd0.available && upd0.id === id && upd0.size === 15 && /^\d+\.\d+\.\d+$/.test(upd0.version), upd0);
    // 📲 QR with Remote access off -> refused, said
    await page.click("#apk_qr");
    await page.waitForFunction(() => /✗/.test(document.getElementById("apk_phase").textContent), null, { timeout: 5000 }).catch(() => {});
    check("📲 Install with a QR with Remote access off: says to tick it", /tick Remote access/.test(await page.evaluate(() => document.getElementById("apk_phase").textContent)) && await page.evaluate(() => document.getElementById("apk_qrbox").hidden));
    await post("/api/remote/enable", { on: true });
    await post("/api/remote/e2e-bound", { host: "0.0.0.0" });
    await page.click("#apk_qr");
    await page.waitForFunction(() => !document.getElementById("apk_qrbox").hidden, null, { timeout: 5000 }).catch(() => {});
    const q = await page.evaluate(() => ({ url: document.getElementById("apk_qrurl").textContent, svg: !!document.querySelector("#apk_qrimg svg") }));
    const tokenPath = (/\/apk\/[A-Za-z0-9_-]+\/bitGen\.apk$/.exec(q.url) || [])[0];
    check("📲 Remote access on: a QR + the link http://<this PC>:<port>/apk/<token>/bitGen.apk", q.svg && !!tokenPath && /^http:\/\/[\d.]+:\d+\//.test(q.url), q);
    let r = await fetch(URL_ + tokenPath, { headers: XFF });
    const body = Buffer.from(await r.arrayBuffer()).toString();
    check("…the phone's browser (from the network, no key) gets the APK", r.status === 200 && /android\.package-archive/.test(r.headers.get("content-type") || "") && body === "PK-fake-apk-912", [r.status, r.headers.get("content-type"), body]);
    r = await fetch(URL_ + "/apk/" + "Z".repeat(24) + "/bitGen.apk", { headers: XFF });
    check("…a made-up token gets nothing (404)", r.status === 404, r.status);
    r = await fetch(URL_ + "/api/apk/file", { headers: XFF });
    check("…and the rest of the PC stays shut without a key (401)", r.status === 401, r.status);
    // 📂
    await page.click("#apk_reveal");
    await page.waitForFunction(() => /📂/.test(document.getElementById("apk_phase").textContent), null, { timeout: 5000 }).catch(() => {});
    check("📂 Show the APK: the file, and how to send it with Phone Link", /📂 \S+bitGen\.apk - drag it onto the phone screen in Phone Link/.test(await page.evaluate(() => document.getElementById("apk_phase").textContent)));
    check("no page errors in the studio", perrs.length === 0, perrs);
    // ⬆ Update in the app
    const L = await (await post("/api/remote/link", {})).json();
    if (L.url) {
      const host = new URL(L.url).host;
      const ctx = await b.newContext({ viewport: { width: 412, height: 880 }, extraHTTPHeaders: XFF });
      const p = await ctx.newPage();
      const errs = []; p.on("pageerror", (e) => errs.push(e.message));
      await p.route("http://localhost/**", (rt) => {
        const u = new URL(rt.request().url());
        if (u.pathname === "/lib/build.js") return rt.fulfill({ status: 200, contentType: "text/javascript", body: 'window.BG_BUILD = {"id":"20260101000000","version":"1.0.0"};' });
        const f = path.join(WWW, decodeURIComponent(u.pathname === "/" ? "/index.html" : u.pathname));
        if (!f.startsWith(WWW) || !fs.existsSync(f)) return rt.fulfill({ status: 404, body: "" });
        rt.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || "application/octet-stream", body: fs.readFileSync(f) });
      });
      const seen = []; ctx.on("request", (q) => seen.push(q.url()));
      await ctx.route((u) => u.host === host, (rt) => rt.continue({ url: rt.request().url().replace("//" + host, "//" + new URL(URL_).host) }));
      await p.goto("http://localhost/index.html");
      await p.waitForFunction(() => window.BG && !document.getElementById("v-connect").hidden, null, { timeout: 10000 });
      await p.fill("#linkIn", L.url); await p.click("#pairBtn");
      await p.waitForFunction(() => !document.getElementById("upd").hidden, null, { timeout: 15000 }).catch(() => {});
      const u = await p.evaluate(() => ({ shown: !document.getElementById("upd").hidden, text: document.getElementById("updText").textContent }));
      check("⬆ the app (build 20260101000000) sees the newer build on the PC: the Update bar", u.shown && /A newer bitGen app is on your PC \(\d+\.\d+\.\d+\)/.test(u.text), u);
      await p.click("#updBtn");
      await p.waitForTimeout(2500);
      const purl = seen.find((x) => /\/api\/app\/apk\?bgk=/.test(x)) || "";
      check("…Update fetches /api/app/apk with the app's key (in the app: the installer opens it)", /\/api\/app\/apk\?bgk=/.test(purl), purl);
      if (purl) { const rr = await fetch(purl.replace("//" + host, "//" + new URL(URL_).host), { headers: XFF }); check("…which is the APK", rr.status === 200 && (await rr.text()) === "PK-fake-apk-912", rr.status); }
      await p.click('#tabs button[data-v="settings"]');
      check("⚙ Settings says which build this app is", /This app: bitGen 1\.0\.0 \(build 20260101000000\)/.test(await p.evaluate(() => document.getElementById("aboutApp").textContent)));
      check("no page errors in the app", errs.length === 0, errs);
      await ctx.close();
    } else console.log("SKIP (update part): no network address for a pairing link");
  } finally {
    await b.close();
    await post("/api/remote/revoke", {});
    await post("/api/remote/enable", { on: !!was.enabled });
    await post("/api/remote/e2e-bound", { host: was.bound || "127.0.0.1" });
    await post("/api/apk/paths", { jdk: "", sdk: "", test_gradlew: "", forget_phone: true });
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
