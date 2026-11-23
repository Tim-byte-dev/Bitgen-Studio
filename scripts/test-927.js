#!/usr/bin/env node
// bitGen Studio 2.927.0 - 👂 "Hi Gemma": the 📱 app wakes on its name; the desktop names it.
// Tim: "can we make the chat with the phone more realistic" -> "when the app is running it is listening for keywords like Hi
// Gemma. the desktop app can give it a name in general settings".
// Units: lib/wakeWord.js (the name kept, match() - greetings, a sound-alike spelling, the name first, the rest as the first
// question, a TV's "Emma went…" not), mobile/www/lib/wake.js (bursts of speech: pre-roll, 0.6 s quiet, 6 s at most, too
// short / too long let go; the 16 kHz WAV), the LLM told its name, the kept-up Whisper told the name, the wiring (routes,
// /api/app/info, Settings ▸ General, the app). The browser run: test-ui927-ui.js. Run: node scripts/test-927.js
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n, got === undefined ? "" : JSON.stringify(got).slice(0, 500)); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const W = require("../lib/wakeWord"), core = require("../lib/core");

/* ---- match */
const M = (t, n) => W.match(t, n || "Gemma");
check("\"Hi Gemma.\" wakes it (nothing after)", M("Hi Gemma.").wake && M("Hi Gemma.").rest === "");
check("\"Hey, Jemma, what is the time in Sydney?\" - Whisper's spelling still is the name; the rest is the first question", M("Hey, Jemma, what is the time in Sydney?").wake && M("Hey, Jemma, what is the time in Sydney?").rest === "what is the time in Sydney?");
check("hello / ok / okay / g'day + the name", ["hello gemma", "Okay Gema", "ok gemma", "G'day Gemma"].every((t) => M(t).wake));
check("the name first, said clearly: \"Gemma what time is it\"", M("Gemma what time is it").wake && M("Gemma what time is it").rest === "what time is it");
check("not the name: \"Hi there\", \"I told Gemma yesterday\", a TV's \"Emma went to the shops\"", !M("Hi there").wake && !M("I told Gemma yesterday").wake && !M("Emma went to the shops").wake);
check("…but \"hi Emma\" is close enough with a greeting (Whisper often drops the G)", M("hi emma").wake);
check("a two-word name: \"hey Mister Bean how are you\"", W.match("hey mister bean how are you", "Mister Bean").wake && W.match("hey mister bean how are you", "Mister Bean").rest === "how are you");
check("sound(): Gemma = Jemma = Gemmah; Kate = Cate; Sophie = Sofi", W.sound("Gemma") === W.sound("Jemma") && W.sound("Gemma") === W.sound("Gemmah") && W.sound("Kate") === W.sound("Cate") && W.like("Sofi", "Sophie"));
check("empty text / no name -> no", !M("").wake && !W.match("hi", "").wake);

/* ---- the name kept */
const keep = JSON.parse(JSON.stringify(core.getConfig().app_voice || null));
try {
  const c0 = core.getConfig(); delete c0.app_voice; core.setConfig(c0);
  check("by default: \"Gemma\", listening on", JSON.stringify(W.settings()) === JSON.stringify({ name: "Gemma", wake: true }));
  check("setSettings: a name of your own, tidied (no markup, 30 letters at most)", W.setSettings({ name: " Nova! " }).name === "Nova" && W.setSettings({ name: "x".repeat(50) }).name.length === 30);
  W.setSettings({ name: "Nova", wake: false });
  check("…kept in config.app_voice, listening off", W.settings().name === "Nova" && W.settings().wake === false && core.getConfig().app_voice.name === "Nova");
  W.setSettings({ name: "   " });
  check("…an empty name keeps the old one", W.settings().name === "Nova");
  const A = require("../lib/appVoice");
  const n = A.handle.toString(), sys = src("lib/appVoice.js");
  check("the LLM is told its name (note(): \"Your name is …\")", /Your name is " \+ name/.test(sys) && /wakeWord"\)\.settings\(\)\.name/.test(sys) && !!n);
  const info = require("../lib/appApi").info();
  check("/api/app/info carries the assistant {name, wake} for the app", info.assistant && info.assistant.name === "Nova" && info.assistant.wake === false, info.assistant);
} finally { const c = core.getConfig(); if (keep) c.app_voice = keep; else delete c.app_voice; core.setConfig(c); }

/* ---- the app's bursts of speech */
const B = require("../mobile/www/lib/wake.js");
const R = 48000, N = 4096, tone = (amp) => { const a = new Float32Array(N); for (let i = 0; i < N; i++) a[i] = amp * Math.sin(i * 0.05) + (Math.random() - 0.5) * 0.004; return a; };
const run = (plan) => { const clips = []; const s = B.segmenter({ onClip: (c, r) => clips.push(+(c.length / r).toFixed(2)) }); for (const [ms, amp] of plan) for (let t = 0; t < ms; t += N / R * 1000) s.feed(tone(amp), R); return clips; };
let c = run([[1500, 0], [900, 0.2], [1000, 0]]);
check("a 0.9 s burst after quiet -> one clip, with half a second before it (so \"Hi\" is not cut) and the quiet after", c.length === 1 && c[0] >= 1.6 && c[0] <= 2.3, c);
c = run([[1500, 0], [8000, 0.2], [400, 0.2], [1000, 0]]);
check("8 s of talk (a TV, people in the room) - the first 6 s let go", !c.some((x) => x >= 6), c);
c = run([[1500, 0], [100, 0.3], [1000, 0]]);
check("a click / knock (0.1 s) - nothing", c.length === 0, c);
c = run([[1500, 0.004], [600, 0.004]]);
check("a steady quiet room - nothing", c.length === 0, c);
const wv = new DataView(B.wav(new Float32Array(48000).fill(0.25), 48000));
check("wav(): RIFF/WAVE, PCM, mono, 16 kHz, 16-bit, one second = 32000 bytes of samples", wv.getUint32(0) === 0x52494646 && wv.getUint32(8) === 0x57415645 && wv.getUint16(20, true) === 1 && wv.getUint16(22, true) === 1 && wv.getUint32(24, true) === 16000 && wv.getUint16(34, true) === 16 && wv.getUint32(40, true) === 32000 && Math.abs(wv.getInt16(44, true) - 8192) < 2);

/* ---- wiring */
const RV = src("routes/appVoice.js");
check("routes: POST /api/app/wake (the kept-up Whisper told \"Hi <name>\"), GET / POST /api/app/assistant", /app\.post\("\/api\/app\/wake"/.test(RV) && /asrLive"\)\.transcribe\(named, \{ prompt: "Hi " \+ set\.name/.test(RV) && /app\.get\("\/api\/app\/assistant"/.test(RV) && /app\.post\("\/api\/app\/assistant"/.test(RV));
check("…something after the name is answered in the same go (appVoice.handle with the rest)", /out\.result = await require\("\.\.\/lib\/appVoice"\)\.handle\(core, \{ text: m\.rest/.test(RV));
check("the kept-up Whisper passes the words to expect as initial_prompt", /prompt: opts\.prompt/.test(src("lib/asrLive.js")) && /initial_prompt=\(prompt or None\)/.test(src("scripts/asr_live.py")));
check("Settings ▸ General: 🗣 The assistant (static/assistantui.js after apkui.js)", /apkui\.js"><\/script>[^\n]*\n<script src="\/static\/assistantui\.js">/.test(src("static/index.html")) && /id="asName"/.test(src("static/assistantui.js")) && /id="asWake"/.test(src("static/assistantui.js")));
const AP = src("mobile/www/app.js"), IX = src("mobile/www/index.html");
check("the app loads lib/wake.js and has 👂 in the top bar", /lib\/wake\.js/.test(IX) && /id="wakeBtn"/.test(IX));
check("the app: never through the relay (only the Wi-Fi / tunnel), never in the background, never while it talks or records", /S\.via !== "relay" \|\| tunnel\(\)/.test(AP) && /if \(document\.hidden\) \{ wakeStop\(\); return; \}/.test(AP) && /!convo && !rec && !document\.hidden/.test(AP));
check("the app: its name heard -> the Talk screen, a reply, the conversation; it listens for its name again after", /function heardName\(j\)/.test(AP) && /startConvo\(function \(\)/.test(AP) && /setTimeout\(wakeStart, 1200\)/.test(AP));
check("the app is 1.12.0", JSON.parse(src("mobile/package.json")).version === "1.12.0");
check("server.js untouched", !/wakeWord|app\/wake/.test(src("misc/server.js")));

console.log("\n" + P + " passed, " + F + " failed");
process.exit(F ? 1 : 0);
