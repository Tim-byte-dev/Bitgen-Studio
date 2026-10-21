#!/usr/bin/env node
/* bitGen Studio — 2.564.0 in a REAL browser, the whole 🎙 voice chat loop: a (fake) microphone talks - the page hears the
 * start and the end of it, sends the turn as a 16 kHz wav, the live transcriber answers (the e2e stand-in), the LLM (a
 * stand-in llama-server speaking like a real one: a think block, prose, a code fence, trailing commas) answers with what to
 * say and do - the prompt is written, Basic Settings / Generate changed, the actions listed - and it listens again; typing
 * works too; ✕ ends it and the transcriber stops (static/voicechat.js, routes/voice.js, lib/asrLive.js, lib/voiceAgent.js).
 * Tim: "i think we just use a mic to talk to the app instead to ask for prompt, change style, create..." / "can it be like
 * live chat". Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.564.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const BASE = URL_.replace(/\/$/, "");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, b) => { const r = await fetch(BASE + u, b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined); return r.json(); };

/** a "voice": 1.5 s quiet, 1.4 s of speech-like sound (noise at a syllable rhythm), 2.5 s quiet - 48 kHz mono */
function voiceWav(file) {
  const rate = 48000, secs = 5.4, n = Math.round(rate * secs), b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const on = t > 1.5 && t < 2.9 ? 0.55 + 0.45 * Math.sin(2 * Math.PI * 4 * t) : 0;
    const v = on * (0.45 * Math.sin(2 * Math.PI * 180 * t) + 0.25 * Math.sin(2 * Math.PI * 360 * t) + 0.15 * rnd());
    b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), 44 + i * 2);
  }
  fs.writeFileSync(file, b);
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "voice564-"));
  const wav = path.join(tmp, "voice.wav"); voiceWav(wav);
  // the stand-in llama-server
  const asked = [];
  const FOX = "A red fox trots through deep snow at dawn, low golden sun, breath steaming, slow tracking shot, wind hiss";
  const llm = http.createServer((req, res) => {
    let body = ""; req.on("data", (d) => { body += d; });
    req.on("end", () => {
      let j = {}; try { j = JSON.parse(body); } catch { /* fine */ }
      asked.push(j);
      const said = String(((j.messages || []).slice(-1)[0] || {}).content || "");
      const typed = /\[the user said\] hello there/.test(said);
      const sys0 = String(((j.messages || [])[0] || {}).content || "");
      if (/image-editing model/.test(sys0)) {                          // the ✎ 🤖 Write request (2.563.0's, read twice there)
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: "<think>ok</think>This scene starts from <image1> (Picture A): the same pose and framing, now in a snowy forest at dawn." } }] }));
      }
      const content = typed ? "Hi! What shall we make?"
        : "<think>The user wants { a fox } prompt... JSON.</think>\nSure, here it is:\n```json\n{\"say\": \"A red fox in the snow at dawn - set to eight seconds.\", \"actions\": ["
          + "{\"do\": \"set_prompt\", \"text\": \"" + FOX + "\"}, {\"do\": \"set_setting\", \"name\": \"seconds\", \"value\": \"8\"}, {\"do\": \"set_generate\", \"what\": \"Image\"}, {\"do\": \"launch_rockets\"},],}\n```\nAnything else?";
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content } }] }));
    });
  });
  await new Promise((r) => llm.listen(0, "127.0.0.1", r));
  const port = llm.address().port;
  const cfg0 = await api("/api/config");
  const llm0 = (cfg0 && cfg0.llm) || {};
  await api("/api/config", { llm: { external_url: `http://127.0.0.1:${port}/v1/chat/completions`, external_model: "stub" } });
  const b = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--use-file-for-fake-audio-capture=" + wav, "--autoplay-policy=no-user-gesture-required"] });
  const ctx = await b.newContext({ viewport: { width: 1700, height: 1050 }, permissions: ["microphone"] });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  // the wav each turn sends (read in the page: a multipart Blob body is not visible to the request event)
  await p.addInitScript(() => { const f0 = window.fetch; window.__wavs = []; window.fetch = function (u, o) {
    try { if (/\/api\/voice\/hear$/.test(String(u)) && o && o.body instanceof FormData) { const a = o.body.get("audio"); if (a) a.arrayBuffer().then((ab) => { const v = new DataView(ab); window.__wavs.push({ riff: v.getUint32(0, false) === 0x52494646, rate: v.getUint32(24, true), ch: v.getUint16(22, true), secs: v.getUint32(40, true) / 2 / v.getUint32(24, true) }); }); } } catch (e) { /* fine */ }
    return f0.apply(this, arguments); }; });
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Voice && document.getElementById("tVoice") && document.getElementById("prompt"), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => { const s = document.getElementById("seconds"); s.value = "5"; s.dispatchEvent(new Event("change")); const g = document.getElementById("genModeSel"); g.value = "video"; g.dispatchEvent(new Event("change")); document.getElementById("prompt").value = ""; });
    const btn = await ev(() => ({ text: document.getElementById("tVoice").textContent, title: document.getElementById("tVoice").title }));
    check("🎙 Voice in the statusbar (Ctrl+Alt+V)", btn.text === "🎙 Voice" && /Ctrl\+Alt\+V/.test(btn.title), btn);
    await p.keyboard.press("Control+Alt+KeyV");
    await p.waitForSelector("#vcPanel", { timeout: 8000 });
    await p.waitForFunction((fox) => document.getElementById("prompt").value === fox, FOX, { timeout: 45000 }).catch(() => {});
    const r1 = await ev(() => ({ prompt: document.getElementById("prompt").value, secs: document.getElementById("seconds").value, gen: document.getElementById("genModeSel").value,
      me: [...document.querySelectorAll("#vcLog .vcb.me")].map((x) => x.textContent), ai: [...document.querySelectorAll("#vcLog .vcb.ai")].map((x) => x.textContent),
      did: [...document.querySelectorAll("#vcLog .vcb.did")].map((x) => x.textContent), errs: [...document.querySelectorAll("#vcLog .vcb.err")].map((x) => x.textContent), state: document.getElementById("vcState").textContent }));
    check("talking (the fake microphone): the page heard the start and the end, the transcriber's words show as what you said", r1.me.includes("make the prompt a red fox in the snow"), r1);
    check("...the LLM's answer (dressed like a real local model) is said and its actions RUN: the prompt written, Seconds 8, Generate makes Image - each listed; the unknown action dropped",
      r1.prompt.startsWith("A red fox trots through deep snow") && r1.secs === "8" && r1.gen === "image" && r1.ai.some((x) => /red fox in the snow at dawn/.test(x))
      && r1.did.some((x) => /prompt written/.test(x)) && r1.did.some((x) => /seconds: 8/.test(x)) && r1.did.some((x) => /Generate makes: .*Image/.test(x)) && !r1.did.some((x) => /rocket/.test(x)), r1);
    const h = (await ev(() => window.__wavs))[0];
    check("...the turn went up as a 16 kHz mono wav with its whole utterance (about 1.4 s + the half second kept before it, + the end's pause)",
      !!h && h.riff && h.rate === 16000 && h.ch === 1 && h.secs > 1.2 && h.secs < 4.5, h);
    const q = asked.find((x) => /make the prompt a red fox/.test(JSON.stringify(x.messages || "")));
    const last = q ? String(q.messages[q.messages.length - 1].content) : "";
    check("...the LLM was asked with the catalogue and the app's state (the prompt, Basic Settings, the styles) + what was said", !!q && q.messages[0].content.includes('"do": "set_prompt"') && /\[the app now\]/.test(last) && /Basic Settings: /.test(last) && /\[the user said\] make the prompt a red fox in the snow/.test(last), last.slice(0, 400));
    const st1 = await api("/api/voice/status");
    check("...the live transcriber is up (one process, the model loaded once)", st1.live && st1.live.running && st1.live.ready, st1);
    // typing works too
    await ev(() => { window.H3Voice._S.listen = false; });
    await p.waitForFunction(() => !window.H3Voice._S.busy && !window.H3Voice._S.speaking, null, { timeout: 30000 }).catch(() => {});
    await p.fill("#vcText", "hello there"); await p.press("#vcText", "Enter");
    await p.waitForFunction(() => [...document.querySelectorAll("#vcLog .vcb.ai")].some((x) => /What shall we make/.test(x.textContent)), null, { timeout: 20000 }).catch(() => {});
    const t2 = await ev(() => [...document.querySelectorAll("#vcLog .vcb")].map((x) => x.className.replace("vcb ", "") + ":" + x.textContent).slice(-2));
    check("typing instead of talking: the same turn (a plain answer, nothing done)", t2.join("|") === "me:hello there|ai:Hi! What shall we make?", t2);
    // 2.563.0's 🤖 Write read the LLM's answer twice ("[object Object]") - now its words land in the direction
    await api("/api/projects/new", { name: "zz-voice564" }); await api("/api/projects/load", { name: "zz-voice564" });
    await api("/api/scenes/add", { text: "Mara at the door" });
    const png = path.join(tmp, "a.png");
    execSync(`ffmpeg -y -loglevel error -f lavfi -i color=c=0x3366aa:s=64x48 -frames:v 1 "${png}"`);
    const fd = new FormData(); fd.append("slot", "qe_pica"); fd.append("image", new Blob([fs.readFileSync(png)], { type: "image/png" }), "a.png");
    await (await fetch(BASE + "/api/scenes/1/qedit/pic/upload", { method: "POST", body: fd })).json();
    const wr = await api("/api/scenes/1/qedit/write", { base: "picture" });
    check("✎ 🤖 Write (2.563.0) - the LLM's words are the direction (not \"[object Object]\")", wr.ok && /^This scene starts from <image1> \(Picture A\): the same pose and framing, now in a snowy forest at dawn\./.test(wr.prompt) && !/object Object/.test(wr.prompt), wr);
    await api("/api/projects/load", { name: "default" });
    try { fs.rmSync(path.join(__dirname, "..", "projects", "zz-voice564"), { recursive: true, force: true }); } catch { /* fine */ }
    // ✕
    await p.click("#vcClose"); await p.waitForTimeout(800);
    const st2 = await api("/api/voice/status");
    check("✕ ends it: the window closes, the microphone and the live transcriber stop", !(await ev(() => !!document.getElementById("vcPanel"))) && !st2.live.running, st2);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    await b.close();
    await api("/api/config", { llm: { external_url: llm0.external_url || "", external_model: llm0.external_model || "" } }).catch(() => {});
    llm.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
