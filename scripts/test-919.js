#!/usr/bin/env node
// bitGen Studio 2.919.0 - a conversation with bitGen: Inworld's SAVA (end of turn) + Voice Isolator, the microphone streamed
// to the PC (Tim: "https://inworld.ai/open-source#voice-isolator, would this be something we can use to have a conversation
// with bitgen" -> "go ahead"). Units only (the live stream: scripts/test-919-live.js). Run: node scripts/test-919.js
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n, got === undefined ? "" : JSON.stringify(got).slice(0, 500)); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

(async () => {
  // the client, one file in both places
  check("voicestream.js is ONE file: the studio's and the 📱 app's copies are identical", src("static/voicestream.js") === src("mobile/www/lib/voicestream.js"));
  const VS = require("../static/voicestream.js");
  const d = VS.resample(new Float32Array([0, 1, 2, 3, 4, 5]), 48000, 16000), u = VS.resample(new Float32Array([0, 1]), 16000, 48000);
  check("resample: 48 kHz -> 16 kHz averages each span, up interpolates", d.length === 2 && d[0] === 1 && d[1] === 4 && u.length === 6 && Math.abs(u[1] - 1 / 3) < 1e-6);
  const pcm = new Int16Array(VS.toPcm16(new Float32Array([0.5, -1, 2])));
  check("toPcm16: little-endian int16, clipped", pcm[0] === 16383 && pcm[1] === -32768 && pcm[2] === 32767);
  // a whole turn against a stand-in PC (no Python): open -> pieces -> turn -> heard
  const calls = [];
  let n = 0;
  const fake = async (method, p, body, json) => {
    calls.push([method, p, json ? body : (body ? body.byteLength : 0)]);
    if (p === "/api/voice/stream/open") return { sid: "abc", rate: 16000, isolator: false };
    if (/close$/.test(p)) return { events: [], hearing: false, done: false };
    if (method === "GET") return { events: [{ type: "heard", text: "make it blue" }], hearing: false, done: true };
    n++;
    return n === 2 ? { events: [{ type: "speech" }], hearing: false } : n === 4 ? { events: [{ type: "turn", seconds: 1.2 }], hearing: true } : { events: [], hearing: false };
  };
  const evs = [];
  const vs = VS.create({ request: fake, kind: "chat", every: 10, onEvent: (e) => evs.push(e.type) });
  const feed = setInterval(() => vs.feed(new Float32Array(4800), 48000), 5);
  const r = await vs.result; clearInterval(feed);
  const pieces = calls.filter((c) => c[0] === "POST" && /\/abc$/.test(c[1]));
  check("a turn: opened (kind chat), pieces sent as 16 kHz int16 (48 kHz made 16), speech -> turn -> polled -> heard", calls[0][1] === "/api/voice/stream/open" && calls[0][2].kind === "chat"
    && pieces.length >= 4 && pieces.every((c) => c[2] % 2 === 0) && evs.join() === "speech,turn,heard" && r.heard === "make it blue" && !calls.some((c) => /close$/.test(c[1])), { calls: calls.slice(0, 8), evs, r });
  const quiet = VS.create({ request: async (m, p) => (p === "/api/voice/stream/open" ? { sid: "q", rate: 16000 } : { events: [], hearing: false }), kind: "app", every: 10, quietMs: 60 });
  const rq = await quiet.result;
  check("nothing said for quietMs: closed, nothing", rq.nothing === true);
  const err = VS.create({ request: async (m, p) => { if (p === "/api/voice/stream/open") { const e = new Error("the voice conversation add-on is not installed"); e.status = 409; throw e; } }, kind: "chat" });
  const re = await err.result;
  check("not installed: the result says so (the page goes back to the simple way)", /not installed/.test(re.error) && re.status === 409, re);

  // the add-on
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "vk919-"));
  process.env.BITGEN_ADDON_BASE = base;
  const K = require("../lib/voiceKitAddon");
  check("add-on: not installed in an empty folder", K.status().installed === false && K.status().note === "not installed");
  const ran = [];
  const run = async (exe, args, o) => {
    ran.push([path.basename(exe), args.join(" ")]);
    if (args[0] === "-c" && /PYV/.test(args[1])) o.log("PYV 3.11");
    if (args[0] === "-m" && args[1] === "venv") { const py = K.paths().python; fs.mkdirSync(path.dirname(py), { recursive: true }); fs.writeFileSync(py, ""); }
    if (args[0] === "-c" && /VKIT/.test(args[1])) o.log('VKIT {"sava": true, "isolator": true, "device": "cuda"}');
    return 0;
  };
  const logs = [];
  const res = await K.install({ log: (l) => logs.push(String(l)), run, python: "python3", gpu: { cuda: true, torch: ["cu128"] }, env: {} });
  check("add-on install: its own venv, PyTorch (this card's CUDA wheels) + torchaudio, inworld-sava + inworld-voice-isolation + soxr, the weights loaded once",
    res.ok && ran.some((x) => /-m venv/.test(x[1])) && ran.some((x) => /pip install torch torchaudio/.test(x[1])) && ran.some((x) => /inworld-sava soxr/.test(x[1]))
    && ran.some((x) => /inworld-voice-isolation soxr/.test(x[1])) && ran.some((x) => x[1].startsWith("-c") && true), { res, ran });
  const s1 = K.status();
  check("add-on: installed now - turn detection + noise isolation on the card", s1.installed && s1.isolator && s1.device === "cuda" && /noise isolation/.test(s1.note), s1);
  const ran2 = [];
  const pypi = await K.install({ log: () => {}, python: "python3", gpu: {}, env: {}, run: async (exe, args, o) => {
    ran2.push(args.join(" "));
    if (args[0] === "-c" && /PYV/.test(args[1])) o.log("PYV 3.12");
    if (args[0] === "-c" && /VKIT/.test(args[1])) o.log('VKIT {"sava": true, "isolator": false, "isolator_error": "no", "device": "cpu"}');
    return args.includes("inworld-sava") ? 1 : 0;            // not on PyPI here
  } });
  check("add-on: a package not on PyPI comes from its GitHub repository; the isolator failing = turn detection alone (said)",
    pypi.ok && ran2.some((x) => /git\+https:\/\/github\.com\/inworld-ai\/sava/.test(x)) && K.status().installed && !K.status().isolator && /did not load/.test(K.status().note), ran2);
  fs.rmSync(base, { recursive: true, force: true });

  // the server side, wired
  const vsl = src("lib/voiceStream.js"), rv = src("routes/voiceStream.js"), ri = src("routes/index.js");
  check("routes: /api/voice/stream (status, open, a piece as raw PCM, close, poll) mounted from routes/index.js (not server.js); 409 needs voicekit",
    /require\("\.\/voiceStream"\)\.mount\(app\)/.test(ri) && /\/api\/voice\/stream\/open/.test(rv) && /express\.raw\(/.test(rv) && /\/close"/.test(rv)
    && /needs: "voicekit"/.test(rv) && !/voiceStream/.test(src("misc/server.js")));
  check("lib/voiceStream: one kept-up process (10 idle minutes), the turn heard by the kept-up Whisper, the app's answered by lib/appVoice, one turn a session",
    /IDLE_MS = 10 \* 60 \* 1000/.test(vsl) && /require\("\.\/asrLive"\)\.transcribe\(ev\.wav/.test(vsl) && /require\("\.\/appVoice"\)\.handle\(core/.test(vsl) && /if \(!s\.done\) \{ s\.done = true; hear\(s, ev\); \}/.test(vsl));
  const py = src("scripts/voice_stream.py");
  check("voice_stream.py: the isolator (48 kHz, streaming, 20 ms look-ahead) before SAVA (16 kHz), SAVA's own TurnSegmenter + Policy, the turn's CLEANED audio written",
    /VoiceIsolator\(conf\.get\("isolator"\) or "inworld\/voice-isolator", \*\*kw\)/.test(py) && /"lookahead_frames": 2/.test(py) && /TurnSegmenter\(k\.sava\.Policy\(\), k\.model\.lookahead_frames\)/.test(py)
    && /self\.iso\.push\(self\.to_iso\(x\)\)/.test(py) && /writeframes/.test(py));
  const A = require("../lib/addons").LIST.find((a) => a.id === "voicekit");
  check("Settings ▸ Add-ons ▸ Voice conversation: SAVA + Voice Isolator, Apache-2.0, its links", A && /SAVA/.test(A.label) && /Apache-2\.0/.test(A.needs) && A.links().length === 2);
  // the clients
  const vc = src("static/voicechat.js"), app = src("mobile/www/app.js"), html = src("static/index.html"), mh = src("mobile/www/index.html");
  check("the studio's 🎙 voice chat: voicestream.js loaded first; live when the add-on is there; the PC's turn instead of the level; falls back on an error",
    html.indexOf('src="/static/voicestream.js"') > 0 && html.indexOf('src="/static/voicestream.js"') < html.indexOf('src="/static/voicechat.js"')
    && /S\.live = !!\(vs && vs\.installed && root\.BGVoiceStream\)/.test(vc) && /if \(S\.live\) \{ if \(!S\.cur\) S\.cur = liveTurn\(\); S\.cur\.feed\(buf, S\.rate\); return; \}/.test(vc)
    && /S\.live = false; bubble\("err", "⚠ the live turn detection stopped/.test(vc));
  check("the 📱 app's 🎙 Talk: lib/voicestream.js loaded; asks the PC once; live on the Wi-Fi / Cloudflare (not the relay); the answer handled as before; falls back on an error",
    /<script src="lib\/voicestream\.js"><\/script>/.test(mh) && /liveReq\("GET", "\/api\/voice\/stream"\)/.test(app) && /S\.via !== "relay" \|\| tunnel\(\)/.test(app)
    && /talkAnswer\(r\.result\)/.test(app) && /voiceLive = false; msg\("talkMsg", "The live listening stopped/.test(app) && /kind: "app"/.test(app));
  check("NOTICE + credits: Inworld's SAVA and Voice Isolator (Apache-2.0)", /SAVA/.test(src("misc/NOTICE.md")) && /Voice Isolator/.test(src("lib/credits.json")));
  console.log(`RESULT: ${P} passed, ${F} failed`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log("FAIL:", e.stack || e); process.exit(1); });
