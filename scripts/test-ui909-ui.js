#!/usr/bin/env node
/* bitGen Studio — 2.909.0 in a REAL browser: the 📱 bitGen app (mobile/www) driving this studio "from the network"
 * (Tim: "lets do my pc first"). The gate's server listens on this computer only, so the phone's requests carry
 * X-Forwarded-For - lib/remoteGuard.js treats a proxied request as one from the network - and the app's page is served
 * as http://localhost (Capacitor's origin). Remote access is switched on for the test and off again at the end.
 *   the guard: no key = 401 (before 2.909.0 every endpoint but /api/remote/* was open to the Wi-Fi); hello is open
 *   📷 the QR from Settings ▸ General ▸ Remote access, as a photo -> jsQR -> paired (the app becomes THE device)
 *   ✨ a FastH3 Omni 9:16 render with a picture -> the real worker (stub ComfyUI) gives its H3 node 544x960; ⏱ shows
 *   ⏳ the queue follows it to done; 🖼 the Gallery plays it through ?bgk=
 *   ⛔ revoked on the PC -> the app goes back to Connect. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
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
(async () => {
  try { const r = await fetch(URL_ + "/"); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL_); process.exit(0); }
  if (!chromium) { console.log("SKIP: playwright is not installed here"); return; }
  if (!fs.existsSync(path.join(WWW, "vendor", "jsQR.js"))) { console.log("SKIP: mobile/www/vendor/jsQR.js missing (cd mobile && npm run vendor)"); return; }
  const was = await (await fetch(URL_ + "/api/remote/status")).json();
  await post("/api/remote/enable", { on: true });
  await post("/api/remote/e2e-bound", { host: "0.0.0.0" });
  // the test points the PC's LAN address at this server (127.0.0.1): Chromium's local-network checks would see a "public"
  // address answered from loopback and refuse it - a phone talks to a real LAN address, where they do not apply
  const b = await chromium.launch({ args: ["--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests"] });
  try {
    // the guard, from "the network"
    let r = await fetch(URL_ + "/api/config", { headers: XFF });
    const j401 = await r.json().catch(() => ({}));
    check("from the network without a key: 401 (every endpoint, not just /api/remote/*)", r.status === 401 && j401.unpaired === true, [r.status, j401]);
    r = await fetch(URL_ + "/api/remote/hello", { headers: XFF });
    check("…/api/remote/hello is open: says it is bitGen Studio", r.status === 200 && (await r.json()).app === "bitGen Studio");
    check("…this computer itself is never asked for a key", (await fetch(URL_ + "/api/app/info")).status === 200);
    const L = await (await post("/api/remote/link", {})).json();
    if (!L.url) { console.log("SKIP: this machine has no network address for a pairing link: " + JSON.stringify(L).slice(0, 200)); return; }
    const host = new URL(L.url).host;
    // the phone: the app's page as http://localhost, its requests "from the network", the PC's address -> this server
    const ctx = await b.newContext({ viewport: { width: 412, height: 880 }, extraHTTPHeaders: XFF });
    const p = await ctx.newPage();
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    if (process.env.DBG) { p.on("requestfailed", (q) => console.log("requestfailed", q.method(), q.url(), q.failure() && q.failure().errorText)); p.on("console", (m) => console.log("console", m.text())); }
    await p.route("http://localhost/**", (rt) => {
      const u = new URL(rt.request().url()), f = path.join(WWW, decodeURIComponent(u.pathname === "/" ? "/index.html" : u.pathname));
      if (!f.startsWith(WWW) || !fs.existsSync(f)) return rt.fulfill({ status: 404, body: "" });
      rt.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || "application/octet-stream", body: fs.readFileSync(f) });
    });
    await p.route((u) => u.host === host, (rt) => rt.continue({ url: rt.request().url().replace("//" + host, "//" + new URL(URL_).host) }));
    await p.goto("http://localhost/index.html");
    await p.waitForFunction(() => window.BG && !document.getElementById("v-connect").hidden, null, { timeout: 10000 });
    // 📷 the QR as a photo
    const qp = await b.newPage({ viewport: { width: 420, height: 420 } });
    await qp.setContent(`<body style="margin:0;background:#fff;display:flex;align-items:center;justify-content:center;height:420px">${L.qr}</body>`);
    await qp.screenshot({ path: "/tmp/bg909-qr.png" });
    await qp.close();
    await p.fill("#devName", "Test phone");
    await p.setInputFiles("#qrFile", "/tmp/bg909-qr.png");
    await p.waitForFunction(() => !document.getElementById("v-create").hidden && /●/.test(document.getElementById("conn").textContent), null, { timeout: 20000 }).catch(() => {});
    const paired = await p.evaluate(() => ({ conn: document.getElementById("conn").textContent, msg: document.getElementById("pairMsg").textContent, create: !document.getElementById("v-create").hidden }));
    check("📷 the QR read from a photo pairs the app (the Create screen, the PC shown)", paired.create && /Connected to bitGen Studio/.test(paired.msg), paired);
    const st = await (await fetch(URL_ + "/api/remote/status")).json();
    check("…the PC says the 📱 bitGen app is the device", st.connected && st.app && /Test phone \(bitGen app\)/.test(st.device), st);
    // ✨ a render
    await p.waitForFunction(() => [...document.querySelectorAll("#styleSel option")].some((o) => o.textContent === "FastH3 Omni"), null, { timeout: 10000 });
    await p.selectOption("#styleSel", { label: "FastH3 Omni" });
    await p.selectOption("#resSel", "540"); await p.selectOption("#arSel", "9:16");
    await p.fill("#prompt", "a red cat walks through a garden");
    await p.setInputFiles("#picLib", path.join(__dirname, "..", "static", "icon.png"));
    await p.fill("#seconds", "4"); await p.dispatchEvent("#seconds", "change");
    await p.waitForFunction(() => /^⏱/.test(document.getElementById("est").textContent), null, { timeout: 8000 }).catch(() => {});
    check("⏱ the estimate shows on the phone", /^⏱/.test(await p.evaluate(() => document.getElementById("est").textContent)));
    check("…540p 9:16 = 544 × 960", /544 × 960/.test(await p.evaluate(() => document.getElementById("whLine").textContent)));
    const before = new Set(((d) => (Array.isArray(d) ? d : d.jobs || []))(await (await fetch(URL_ + "/api/jobs?all=1")).json()).map((j) => j.id));
    await p.click("#goBtn");
    await p.waitForFunction(() => !document.getElementById("v-queue").hidden, null, { timeout: 30000 }).catch(() => {});
    check("Generate -> on its way, the Queue tab", await p.evaluate(() => !document.getElementById("v-queue").hidden && /On its way/.test(document.getElementById("goMsg").textContent)),
      await p.evaluate(() => document.getElementById("goMsg").textContent));
    let job = null;
    for (let i = 0; i < 60 && !job; i++) {
      await new Promise((ok) => setTimeout(ok, 1000));
      const nw = ((d) => (Array.isArray(d) ? d : d.jobs || []))(await (await fetch(URL_ + "/api/jobs?all=1")).json()).filter((j) => !before.has(j.id));
      if (nw.length) { const d = await (await fetch(URL_ + "/api/jobs/" + nw[nw.length - 1].id + "?log=0")).json(); if (!["queued", "running"].includes(d.status)) job = d; }
    }
    const L2 = ((job || {}).log || []).find((l) => /render size asked/.test(l)) || "";
    check("the PC rendered it: FastH3 Omni's H3 node got 544x960, the picture mapped", job && job.status === "done" && /render size asked 544x960: 544x960/.test(L2) && /<Subject 1> is in <Picture 1>/i.test((job.params || {}).prompt || ""), [job && job.status, L2, job && (job.params || {}).prompt]);
    await p.waitForFunction(() => /done/.test(document.getElementById("jobs").textContent), null, { timeout: 15000 }).catch(() => {});
    check("⏳ the app's queue shows it done with ▶ Open", await p.evaluate(() => /done/.test(document.getElementById("jobs").textContent) && !!document.querySelector("#jobs [data-open]")));
    await p.click('#tabs button[data-v="gallery"]');
    await p.waitForFunction(() => { const v = document.querySelector("#gal .g video"); return v && v.readyState >= 1; }, null, { timeout: 15000 }).catch(() => {});
    const gv = await p.evaluate(() => { const v = document.querySelector("#gal .g video"); return v ? { rs: v.readyState, src: v.src } : null; });
    check("🖼 the Gallery plays the take through ?bgk= (an <img> / <video> cannot send the key header)", gv && gv.rs >= 1 && /\?bgk=/.test(gv.src), gv);
    // ⛔ revoked on the PC
    await post("/api/remote/revoke", {});
    await p.click('#tabs button[data-v="create"]');
    await p.click('#tabs button[data-v="queue"]');
    await p.waitForFunction(() => !document.getElementById("v-connect").hidden, null, { timeout: 10000 }).catch(() => {});
    check("⛔ disconnected on the PC -> the app is back on Connect, saying why", await p.evaluate(() => !document.getElementById("v-connect").hidden && /no longer knows this phone/.test(document.getElementById("pairMsg").textContent)));
    check("no page errors in the app", errs.length === 0, errs);
    await ctx.close();
  } finally {
    await b.close();
    await post("/api/remote/revoke", {});
    await post("/api/remote/enable", { on: !!was.enabled });
    await post("/api/remote/e2e-bound", { host: was.bound || "127.0.0.1" });
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
