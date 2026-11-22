#!/usr/bin/env node
/* bitGen Studio — 2.916.0 in a REAL browser (Tim: "in the android app add a button for reference images and video and audio, user
 * can select from phone gallery, camera or the pc it is connected to using the host bitgen"): the paired app on the Wi-Fi -
 *   ＋ 🎬 Video ▸ 💻 From my PC: the PC's videos (GET /api/app/files) - one picked
 *   ＋ 🎵 Audio ▸ 🎵 Phone files: a sound from the phone (sent to the project first)
 *   ＋ 🖼 Picture ▸ 💻 From my PC (when the PC has a picture)
 *   Generate (a MiniMax-style video): the job on the PC has the video + the sound as references, the picture too.
 * Against the running app (H3_URL) in the e2e gate (H3_E2E=1). */
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
const WWW = path.join(__dirname, "..", "mobile", "www");
const XFF = { "x-forwarded-for": "10.9.8.7" };
const PC = "10.9.8.42:" + new URL(URL_).port;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const post = (p, b, h) => fetch(URL_ + p, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, h || {}), body: JSON.stringify(b || {}) });
const get = (p) => fetch(URL_ + p).then((r) => r.json());
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };
(async () => {
  try { const r = await fetch(URL_ + "/"); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL_); process.exit(0); }
  if (!chromium) { console.log("SKIP: playwright is not installed here"); return; }
  const was = await get("/api/remote/status");
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg916-"));
  const b = await chromium.launch({ args: ["--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests"] });
  try {
    await post("/api/remote/revoke", {});
    await post("/api/remote/enable", { on: true });
    await post("/api/remote/e2e-bound", { host: "0.0.0.0" });
    await post("/api/remote/away", { mode: "none" });
    await post("/api/remote/lanpair/window", {});
    const lp = await (await post("/api/remote/lanpair", { device: "Fold (bitGen app)" }, XFF)).json();
    const KEY = lp.token;
    const vids = (await (await fetch(URL_ + "/api/app/files?kind=video", { headers: Object.assign({ "X-Bitgen-Key": KEY }, XFF) })).json()).files || [];
    const pics = (await (await fetch(URL_ + "/api/app/files?kind=images", { headers: Object.assign({ "X-Bitgen-Key": KEY }, XFF) })).json()).files || [];
    check("GET /api/app/files: the PC's videos / pictures (the app's key)", Array.isArray(vids) && Array.isArray(pics), [vids.length, pics.length]);
    if (!vids.length) { console.log("SKIP: no video on the PC to pick (run after a render)"); }
    const wav = path.join(T, "phone-voice.wav");
    { const n = 8000, d = Buffer.alloc(44 + n * 2); d.write("RIFF", 0); d.writeUInt32LE(36 + n * 2, 4); d.write("WAVEfmt ", 8); d.writeUInt32LE(16, 16); d.writeUInt16LE(1, 20); d.writeUInt16LE(1, 22);
      d.writeUInt32LE(8000, 24); d.writeUInt32LE(16000, 28); d.writeUInt16LE(2, 32); d.writeUInt16LE(16, 34); d.write("data", 36); d.writeUInt32LE(n * 2, 40); fs.writeFileSync(wav, d); }

    const ctx = await b.newContext({ viewport: { width: 412, height: 880 }, extraHTTPHeaders: XFF });
    await ctx.addInitScript((o) => {
      window.Capacitor = { Plugins: { LanInfo: { get: () => Promise.resolve({ wifi: true, ip: "10.9.8.7", prefix: 24 }) } } };
      localStorage.setItem("bg.base", "http://10.9.8.42:" + o.port); localStorage.setItem("bg.key", o.key); localStorage.setItem("bg.pcName", "vm"); localStorage.setItem("bg.lanAt", String(Date.now()));
      localStorage.setItem("bg.kind", "video");
    }, { key: KEY, port: new URL(URL_).port });
    await ctx.route(/^http:\/\/10\.9\.8\.\d+(:\d+)?\//, (rt) => { const u = new URL(rt.request().url()); return u.host === PC ? rt.continue({ url: rt.request().url().replace("//" + PC, "//" + new URL(URL_).host) }) : rt.abort("addressunreachable"); });
    await ctx.route("http://localhost/**", (rt) => {
      const u = new URL(rt.request().url());
      if (u.pathname === "/lib/build.js") return rt.fulfill({ status: 200, contentType: "text/javascript", body: 'window.BG_BUILD = {"id":"dev","version":"1.7.0"};' });
      const f = path.join(WWW, decodeURIComponent(u.pathname === "/" ? "/index.html" : u.pathname));
      if (!f.startsWith(WWW) || !fs.existsSync(f)) return rt.fulfill({ status: 404, body: "" });
      rt.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || "application/octet-stream", body: fs.readFileSync(f) });
    });
    const p = await ctx.newPage();
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto("http://localhost/index.html");
    await p.waitForFunction(() => /● 10\.9\.8\.42/.test(document.getElementById("conn").textContent) && document.querySelectorAll("#styleSel option").length > 0, null, { timeout: 30000 }).catch(() => {});
    check("the Create screen (video): ＋ 🖼 Picture, ＋ 🎬 Video, ＋ 🎵 Audio", await p.evaluate(() => ["image", "video", "audio"].every((k) => { const x = document.querySelector('[data-add="' + k + '"]'); return x && x.offsetParent !== null; })));
    // ＋ 🎬 Video ▸ 💻 From my PC
    await p.click('[data-add="video"]');
    const sheet = await p.evaluate(() => ({ open: !document.getElementById("srcSheet").hidden, t: document.getElementById("srcTitle").textContent, cam: document.getElementById("srcCam").textContent, lib: document.getElementById("srcLib").textContent }));
    check("＋ 🎬 Video: where from - 📹 Camera, 🖼 Phone gallery, 💻 From my PC", sheet.open && /Add a video/.test(sheet.t) && /Camera/.test(sheet.cam) && /Phone gallery/.test(sheet.lib), sheet);
    if (vids.length) {
      await p.click("#srcPc");
      await p.waitForSelector("#pcList .f1", { timeout: 15000 }).catch(() => {});
      const n = await p.evaluate(() => document.querySelectorAll("#pcList .f1").length);
      check("💻 From my PC: the PC's videos to pick from", n > 0 && /🎬 Videos on vm/.test(await p.textContent("#pcTitle")), n);
      await p.click("#pcList .f1");
    } else await p.click("#srcCancel");
    // ＋ 🎵 Audio ▸ the phone's files
    await p.click('[data-add="audio"]');
    check("＋ 🎵 Audio: 🎙 Record, 🎵 Phone files, 💻 From my PC", /Record/.test(await p.textContent("#srcCam")) && /Phone files/.test(await p.textContent("#srcLib")));
    await p.click("#srcCancel");
    await p.setInputFiles("#audLib", wav);
    // ＋ 🖼 Picture ▸ 💻
    if (pics.length) {
      await p.click('[data-add="image"]'); await p.click("#srcPc");
      await p.waitForSelector("#pcList .f1", { timeout: 15000 }).catch(() => {});
      await p.click("#pcList .f1");
    }
    const chips = await p.evaluate(() => [...document.querySelectorAll("#pics .p")].map((d) => d.textContent.replace("✕", "").trim()));
    check("the references on Create: the PC's video (V1 💻), the phone's sound (A1)" + (pics.length ? ", the PC's picture" : ""), (!vids.length || chips.some((c) => /^V1💻/.test(c))) && chips.some((c) => /A1phone-voice\.wav/.test(c)) && (!pics.length || chips.some((c) => /^1💻/.test(c))), chips);
    // Generate with a /api/generate style
    const info = await (await fetch(URL_ + "/api/app/info", { headers: Object.assign({ "X-Bitgen-Key": KEY }, XFF) })).json();
    const st = (info.video_styles || []).find((s) => s.route === "generate");
    if (!st) { console.log("SKIP (generate): no MiniMax-style video style on this PC"); }
    else {
      await p.selectOption("#styleSel", st.id);
      await p.fill("#prompt", "a kite over the sea, the song playing");
      const wr = p.waitForResponse((r) => /\/api\/app\/video$/.test(r.url()), { timeout: 120000 }).catch(() => null);
      await p.click("#goBtn");
      const r = await wr; const j = r ? await r.json() : null;
      const job = j && j.id ? await get("/api/jobs/" + j.id + "?log=0") : null;
      const prm = (job && (job.params || job)) || {};
      const rv = (prm.ref_videos || []).map((x) => path.basename(x)), ra = (prm.ref_audios || []).map((x) => path.basename(x));
      check("Generate: the job on the PC has the references - the video" + (vids.length ? " (" + vids[0].name + ")" : "") + " and the phone's sound" + (pics.length ? " and the picture" : ""),
        j && j.id && ra.some((n) => /phone_.*\.wav$/.test(n)) && (!vids.length || rv.length === 1) && (!pics.length || (prm.reference_files || []).length >= 1), [j && j.id, rv, ra, (prm.reference_files || []).length, j && j.error, await p.textContent("#goMsg")]);
    }
    check("no page errors", !errs.length, errs);
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
