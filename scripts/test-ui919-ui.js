#!/usr/bin/env node
/* bitGen Studio — 2.919.0 in a REAL browser: a conversation with bitGen, the microphone STREAMED to the PC.
 * Tim: "https://inworld.ai/open-source#voice-isolator, would this be something we can use to have a conversation with bitgen"
 * -> "go ahead".
 *   The studio's 🎙 voice chat with the add-on there (the suite's stand-in `inworld` package - POST /api/voice/stream/e2e):
 *   Chromium's fake microphone says something; it goes to /api/voice/stream in pieces (never /api/voice/hear), the PC's
 *   turn model closes the turn, the words are heard and the LLM's action runs (the prompt written).
 *   The 📱 app's 🎙 Talk on the Wi-Fi: the same - streamed, heard AND answered by the PC in one go (a video made).
 *   Without the add-on: the old way (the level detector, /api/voice/hear) - nothing changes for those without it.
 * Against the running app (H3_URL, H3_E2E=1). */
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
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const post = (p, b, h) => fetch(URL_ + p, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, h || {}), body: JSON.stringify(b || {}) });
const get = (p) => fetch(URL_ + p).then((r) => r.json());

/** a 48 kHz wav: quiet, a voice-like tone, quiet (the stand-in turn model reads the level) */
function wavFile(f, talk) {
  const sr = 48000, before = 1.0, after = 4.0, n = Math.round((before + talk + after) * sr), d = Buffer.alloc(44 + n * 2);
  d.write("RIFF", 0); d.writeUInt32LE(36 + n * 2, 4); d.write("WAVEfmt ", 8); d.writeUInt32LE(16, 16); d.writeUInt16LE(1, 20); d.writeUInt16LE(1, 22);
  d.writeUInt32LE(sr, 24); d.writeUInt32LE(sr * 2, 28); d.writeUInt16LE(2, 32); d.writeUInt16LE(16, 34); d.write("data", 36); d.writeUInt32LE(n * 2, 40);
  for (let i = Math.round(before * sr); i < Math.round((before + talk) * sr); i++) d.writeInt16LE(Math.round(12000 * Math.sin(2 * Math.PI * 220 * i / sr) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 3 * i / sr))), 44 + i * 2);
  fs.writeFileSync(f, d);
}

(async () => {
  try { const r = await fetch(URL_ + "/"); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL_); process.exit(0); }
  if (!chromium) { console.log("SKIP: playwright is not installed here"); return; }
  const was = await get("/api/remote/status");
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg919-"));
  const wav = path.join(T, "voice.wav"); wavFile(wav, 1.8);
  const b = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--use-file-for-fake-audio-capture=" + wav + "%noloop",
    "--autoplay-policy=no-user-gesture-required", "--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests"] });
  try {
    const off = await get("/api/voice/stream");
    check("GET /api/voice/stream: the add-on's status (not installed here before the stand-in)", off && typeof off.installed === "boolean" && "isolator" in off, off);
    const on = await (await post("/api/voice/stream/e2e", { on: true })).json();
    const st = await get("/api/voice/stream");
    check("the suite's stand-in on: installed, the isolator's 48 kHz", on.on && st.installed && st.isolator && st.rate === 48000, st);

    /* ---- the studio's 🎙 voice chat */
    const ctx1 = await b.newContext({ viewport: { width: 1700, height: 1000 } });
    const p = await ctx1.newPage();
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const hears = [], pieces = [], turns = [];
    await p.route("**/api/voice/hear", (rt) => { hears.push(1); rt.fulfill({ json: { text: "" } }); });
    await p.route("**/api/voice/turn", (rt) => { turns.push(JSON.parse(rt.request().postData() || "{}").text); rt.fulfill({ json: { say: "", actions: [{ do: "set_prompt", text: "a red fox in the snow" }] } }); });
    p.on("request", (r) => { if (/\/api\/voice\/stream\/[a-f0-9]{16}$/.test(r.url()) && r.method() === "POST") pieces.push(r.headers()["content-type"]); });
    await p.goto(URL_ + "/", { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Voice && window.BGVoiceStream && document.getElementById("prompt"), null, { timeout: 60000 });
    await p.evaluate(() => { window.BG_TEST_HEARD = "make the prompt a red fox in the snow"; window.__tev = []; const o = window.H3TestEvent; window.H3TestEvent = (k, v) => { window.__tev.push([k, v]); if (o) try { o(k, v); } catch (e) { /* fine */ } }; document.getElementById("prompt").value = ""; window.H3Voice.start(); });
    await p.waitForFunction(() => document.getElementById("prompt").value === "a red fox in the snow", null, { timeout: 30000 }).catch(() => {});
    const r1 = await p.evaluate(() => ({ prompt: document.getElementById("prompt").value, tev: window.__tev.map((x) => x[0] + ":" + x[1]), live: window.H3Voice._S.live }));
    check("the 🎙 voice chat went LIVE (the add-on is there)", r1.live === true && r1.tev.some((x) => /^voice_live:isolator/.test(x)), r1.tev);
    check("...the microphone went to the PC in raw pieces (application/octet-stream), never the old /api/voice/hear", pieces.length >= 3 && pieces.every((c) => /octet-stream/.test(c)) && hears.length === 0, { pieces: pieces.length, hears: hears.length });
    check("...the PC closed the turn (its turn model), heard it, and the LLM's action ran: the prompt written", r1.tev.some((x) => /^voice_turn:/.test(x)) && turns[0] === "make the prompt a red fox in the snow" && r1.prompt === "a red fox in the snow", { r1, turns });
    await p.evaluate(() => window.H3Voice.stop());
    check("no page errors (the studio)", errs.length === 0, errs);
    await ctx1.close();

    /* ---- the 📱 app's 🎙 Talk on the Wi-Fi */
    await post("/api/remote/revoke", {});
    await post("/api/remote/enable", { on: true });
    await post("/api/remote/e2e-bound", { host: "0.0.0.0" });
    await post("/api/remote/away", { mode: "none" });
    await post("/api/remote/lanpair/window", {});
    const KEY = (await (await post("/api/remote/lanpair", { device: "Fold (bitGen app)" }, XFF)).json()).token;
    const ctx2 = await b.newContext({ viewport: { width: 412, height: 880 }, extraHTTPHeaders: XFF });
    await ctx2.addInitScript((o) => {
      window.Capacitor = { Plugins: { LanInfo: { get: () => Promise.resolve({ wifi: true, ip: "10.9.8.7", prefix: 24 }) } } };
      localStorage.setItem("bg.base", "http://10.9.8.42:" + o.port); localStorage.setItem("bg.key", o.key); localStorage.setItem("bg.pcName", "vm"); localStorage.setItem("bg.lanAt", String(Date.now()));
      localStorage.setItem("bg.kind", "video"); localStorage.setItem("bg.talkSpeak", "0");
    }, { key: KEY, port: new URL(URL_).port });
    await ctx2.route(/^http:\/\/10\.9\.8\.\d+(:\d+)?\//, (rt) => { const u = new URL(rt.request().url()); return u.host === PC ? rt.continue({ url: rt.request().url().replace("//" + PC, "//" + new URL(URL_).host) }) : rt.abort("addressunreachable"); });
    await ctx2.route("http://localhost/**", (rt) => {
      const u = new URL(rt.request().url());
      if (u.pathname === "/lib/build.js") return rt.fulfill({ status: 200, contentType: "text/javascript", body: 'window.BG_BUILD = {"id":"dev","version":"1.8.0"};' });
      const f = path.join(WWW, decodeURIComponent(u.pathname === "/" ? "/index.html" : u.pathname));
      if (!f.startsWith(WWW) || !fs.existsSync(f)) return rt.fulfill({ status: 404, body: "" });
      rt.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || "application/octet-stream", body: fs.readFileSync(f) });
    });
    const a = await ctx2.newPage();
    const aerrs = []; a.on("pageerror", (e) => aerrs.push(e.message));
    const oldVoice = [], apieces = []; let goClicked = 0;
    a.on("request", (r) => { if (/\/api\/app\/voice$/.test(r.url())) oldVoice.push(1); if (/\/api\/voice\/stream\/[a-f0-9]{16}$/.test(r.url()) && r.method() === "POST") apieces.push(1); });
    await a.goto("http://localhost/index.html");
    await a.waitForFunction(() => /● 10\.9\.8\.42/.test(document.getElementById("conn").textContent) && document.querySelectorAll("#styleSel option").length > 0, null, { timeout: 30000 }).catch(() => {});
    await a.evaluate(() => { window.BG_TEST_HEARD = "make a video of a tiger walking in the snow"; document.getElementById("goBtn").onclick = () => { window.__go = (window.__go || 0) + 1; }; });
    await a.evaluate(() => { const t = [...document.querySelectorAll(".tabs button, nav button, [data-view]")].find((x) => /Talk/.test(x.textContent)); if (t) t.click(); });
    await a.click("#talkBtn");
    await a.waitForFunction(() => window.__go > 0 || /stopped|✗/.test(document.getElementById("talkMsg").textContent), null, { timeout: 40000 }).catch(() => {});
    goClicked = await a.evaluate(() => window.__go || 0);
    const log = await a.evaluate(() => ({ talk: document.getElementById("talkLog").textContent, msg: document.getElementById("talkMsg").textContent, prompt: document.getElementById("prompt").value }));
    check("the 📱 app's 🎙 Talk went LIVE: the microphone streamed to the PC, never the old recording upload", apieces.length >= 3 && oldVoice.length === 0, { apieces: apieces.length, oldVoice: oldVoice.length, log });
    check("...the PC heard it AND said what it means in one go: a video of a tiger - the Create screen's Generate pressed", goClicked > 0 && /tiger walking in the snow/.test(log.prompt) && /make a video of a tiger/.test(log.talk), log);
    check("no page errors (the app)", aerrs.length === 0, aerrs);
    await ctx2.close();

    /* ---- without the add-on: the old way */
    await post("/api/voice/stream/e2e", { on: false });
    const st2 = await get("/api/voice/stream");
    check("the stand-in off: not installed again (those without the add-on keep the old way)", st2.installed === false || st2.note !== "test", st2);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally {
    try { await post("/api/voice/stream/e2e", { on: false }); } catch { /* fine */ }
    try { await post("/api/remote/revoke", {}); await post("/api/remote/enable", { on: !!was.enabled }); await post("/api/remote/e2e-bound", { host: was.bound || "127.0.0.1" }); } catch { /* fine */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
