#!/usr/bin/env node
/* bitGen Studio — 2.910.0 in a REAL browser: the 📱 bitGen app's 🎵 music and its Galaxy Z Fold layout (Tim: "add music,
 * and make the app resizable, i have a galaxy fold z , i would like to be able to use it in compact mode and fullscreen
 * mode"). The harness of test-ui909-ui.js: The gate's server listens on this computer only, so the phone's requests carry
 * X-Forwarded-For - lib/remoteGuard.js treats a proxied request as one from the network - and the app's page is served
 * as http://localhost (Capacitor's origin). Remote access is switched on for the test and off again at the end.
 *   🎵 Music on the cover screen (344 px): the style's sound words + length fill in, the lyrics, 30 s, mp3 -> the real
 *      worker (stub ComfyUI) makes the song with those; ⏱ for a song; the Gallery's Music tab plays it
 *   ⇔ unfolded (884 px): Create on the left, the Queue / Gallery on the right, the typed prompt kept; folded again: one pane
 *   ⛶ full screen toggles (in a browser: the Fullscreen API; in the app: Capacitor's SystemBars) and is remembered */
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
  const b = await chromium.launch({ args: ["--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests"] });
  try {
    const L = await (await post("/api/remote/link", {})).json();
    if (!L.url) { console.log("SKIP: this machine has no network address for a pairing link"); return; }
    const host = new URL(L.url).host;
    const ctx = await b.newContext({ viewport: { width: 344, height: 882 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true, extraHTTPHeaders: XFF });
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
    check("cover screen (344 px): compact - one pane, the bottom tabs with Create", await p.evaluate(() => !document.body.classList.contains("wide") && document.getElementById("v-queue").hidden
      && !!document.querySelector('#tabs button[data-v="create"]').offsetParent && document.documentElement.scrollWidth <= 344));
    // 🎵 music
    await p.click('#kindSeg button[data-kind="music"]');
    await p.waitForFunction(() => [...document.querySelectorAll("#styleSel option")].some((o) => /ACE-Step/.test(o.textContent)), null, { timeout: 8000 });
    await p.selectOption("#styleSel", { label: "ACE-Step 1.5" });
    const mu = await p.evaluate(() => ({ cap: document.getElementById("muCaption").value, secs: document.getElementById("muSecs").value,
      size: !document.getElementById("resSel").offsetParent, pics: !document.getElementById("pics").offsetParent, go: document.getElementById("goBtn").textContent }));
    check("🎵 Music: the style's sound words and length fill in; no size / pictures; 'Make the song'", /indie pop/i.test(mu.cap) && mu.secs === "120" && mu.size && mu.pics && mu.go === "Make the song", mu);
    await p.fill("#prompt", "[verse]\nneon rain on the glass\n[chorus]\nstay");
    await p.fill("#muSecs", "30"); await p.dispatchEvent("#muSecs", "change");
    await p.fill("#muTitle", "Neon Rain"); await p.selectOption("#muFormat", "mp3");
    const before = new Set(((d) => (Array.isArray(d) ? d : d.jobs || []))(await (await fetch(URL_ + "/api/jobs?all=1")).json()).map((j) => j.id));
    await p.click("#goBtn");
    let job = null;
    for (let i = 0; i < 60 && !job; i++) {
      await new Promise((ok) => setTimeout(ok, 1000));
      const nw = ((d) => (Array.isArray(d) ? d : d.jobs || []))(await (await fetch(URL_ + "/api/jobs?all=1")).json()).filter((j) => !before.has(j.id));
      if (nw.length) { const d = await (await fetch(URL_ + "/api/jobs/" + nw[nw.length - 1].id + "?log=0")).json(); if (!["queued", "running"].includes(d.status)) job = d; }
    }
    const jp = (job && job.params) || {};
    check("…the PC made the song: the lyrics, 30 s, mp3, the title, the sound words", job && job.status === "done" && /neon rain/.test(jp.prompt || "") && jp.max_duration === 30
      && jp.audio_format === "mp3" && jp.title === "Neon Rain" && /indie pop/i.test((jp.style || {}).caption || "") && /\.mp3$/.test(job.output || ""), [job && job.status, jp.max_duration, jp.audio_format, jp.title, job && job.output]);
    await p.click('#tabs button[data-v="create"]');
    await p.evaluate(() => { const e = document.getElementById("muSecs"); e.dispatchEvent(new Event("change")); });
    await p.waitForFunction(() => /^⏱ about/.test(document.getElementById("est").textContent), null, { timeout: 8000 }).catch(() => {});
    check("⏱ a song's estimate (from that render)", /^⏱ about/.test(await p.evaluate(() => document.getElementById("est").textContent)), await p.evaluate(() => document.getElementById("est").textContent));
    await p.click('#tabs button[data-v="gallery"]'); await p.click('#galSeg button[data-g="audio"]');
    await p.waitForFunction(() => !!document.querySelector("#gal .g.au"), null, { timeout: 10000 }).catch(() => {});
    await p.evaluate(() => document.querySelector("#gal .g.au").click());
    await p.waitForFunction(() => { const a = document.querySelector("#vBody audio"); return a && a.readyState >= 1; }, null, { timeout: 10000 }).catch(() => {});
    check("🖼 the Gallery's Music tab plays the song (through ?bgk=)", await p.evaluate(() => { const a = document.querySelector("#vBody audio"); return !!(a && a.readyState >= 1 && /\?bgk=/.test(a.src)); }));
    await p.click("#vClose");
    // ⇔ unfold
    await p.click('#tabs button[data-v="create"]');
    await p.click('#kindSeg button[data-kind="video"]');
    await p.fill("#prompt", "a lantern drifts over the river");
    await p.setViewportSize({ width: 884, height: 1028 });
    await p.waitForFunction(() => document.body.classList.contains("wide"), null, { timeout: 5000 }).catch(() => {});
    const wide = await p.evaluate(() => { const c = document.getElementById("v-create").getBoundingClientRect(), q = ["v-queue", "v-gallery", "v-settings"].map((id) => document.getElementById(id)).find((e) => !e.hidden);
      const r = q ? q.getBoundingClientRect() : null;
      return { wide: document.body.classList.contains("wide"), both: !!q && !document.getElementById("v-create").hidden, side: !!r && c.right <= r.left + 1 && c.width > 280, prompt: document.getElementById("prompt").value,
        createTab: !document.querySelector('#tabs button[data-v="create"]').offsetParent, overflow: document.documentElement.scrollWidth <= 884 };
    });
    check("unfolded (884 px): Create on the left, another tab on the right, the prompt kept, no Create tab, nothing wider than the screen", wide.wide && wide.both && wide.side && wide.prompt === "a lantern drifts over the river" && wide.createTab && wide.overflow, wide);
    await p.click('#tabs button[data-v="gallery"]');
    check("…the right-hand tab switches, Create stays", await p.evaluate(() => !document.getElementById("v-gallery").hidden && !document.getElementById("v-create").hidden && document.getElementById("v-queue").hidden));
    await p.setViewportSize({ width: 344, height: 882 });
    await p.waitForFunction(() => !document.body.classList.contains("wide"), null, { timeout: 5000 }).catch(() => {});
    check("folded again: one pane (the tab you were on), the prompt kept", await p.evaluate(() => !document.body.classList.contains("wide") && !document.getElementById("v-gallery").hidden && document.getElementById("v-create").hidden
      && document.getElementById("prompt").value === "a lantern drifts over the river"));
    // ⛶
    await p.click("#fsBtn");
    await p.waitForTimeout(300);
    check("⛶ full screen: on, and remembered", await p.evaluate(() => document.getElementById("fsBtn").classList.contains("on") && localStorage.getItem("bg.fullscreen") === "1"));
    await p.click("#fsBtn");
    check("⛶ again: off", await p.evaluate(() => !document.getElementById("fsBtn").classList.contains("on") && !localStorage.getItem("bg.fullscreen")));
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
