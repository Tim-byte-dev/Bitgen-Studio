#!/usr/bin/env node
// bitGen Studio 2.919.0 - the live voice stream, LIVE: lib/voiceStream.js keeping scripts/voice_stream.py up with the stand-in
// `inworld` package (scripts/fixtures/voicekit_fake - SAVA / the Voice Isolator's API, numpy only), the microphone sent in
// ~200 ms pieces: a spoken turn found and closed by the end-of-turn model, heard, and for the 📱 app answered (lib/appVoice);
// silence = nothing; a tap closes the turn; the stream's own process survives a bad piece. Needs python3 with numpy.
// Run: node scripts/test-919-live.js   (child_process: the e2e legs run it, not ci-units)
"use strict";
require("child_process");
const fs = require("fs");
const path = require("path");
process.env.H3_E2E = "1";
const V = require("../lib/voiceStream");
const VS = require("../static/voicestream.js");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n, got === undefined ? "" : JSON.stringify(got).slice(0, 600)); } };
V.configure({ python: process.platform === "win32" ? "python" : "python3", env: { PYTHONPATH: path.join(__dirname, "fixtures", "voicekit_fake") } });

/** silence, a "voice" (a 220 Hz tone) for `talk` seconds, silence - at `rate` as Float32 */
function speech(rate, before, talk, after) {
  const n = Math.round((before + talk + after) * rate), x = new Float32Array(n);
  for (let i = Math.round(before * rate); i < Math.round((before + talk) * rate); i++) x[i] = 0.3 * Math.sin(2 * Math.PI * 220 * i / rate);
  return x;
}
/** what the page does: the voicestream client fed 4096-sample blocks of the "microphone" at 48 kHz, in time (sped up x4) */
function client(kind, extra, audio, tapAt) {
  const req = async (method, p, body, json) => {
    const m = p.match(/^\/api\/voice\/stream(?:\/([a-f0-9]+))?(\/close)?$/);
    if (p === "/api/voice/stream/open") return V.open(body);
    if (m && m[2]) return V.close(m[1]);
    if (method === "GET") return V.poll(m[1]);
    return V.push(m[1], Buffer.from(body));
  };
  const evs = [];
  const vs = VS.create({ request: req, kind, extra, every: 50, quietMs: 3000, maxMs: 20000, onEvent: (e) => evs.push(e.type) });
  let i = 0;
  const t = setInterval(() => {
    if (i >= audio.length) { clearInterval(t); return; }
    vs.feed(audio.subarray(i, i + 4096), 48000); i += 4096;
    if (tapAt && i >= tapAt * 48000) { clearInterval(t); vs.finish(); }
  }, 21);
  return vs.result.then((r) => { clearInterval(t); return Object.assign(r, { evs }); });
}

(async () => {
  const st = V.status();
  check("status: installed (the stand-in), not running yet", st.installed && !st.running, st);
  const r1 = await client("chat", { test_heard: "change the style to anime" }, speech(48000, 1.0, 1.6, 2.0));
  check("a spoken turn: speech -> turn (closed by the end-of-turn model) -> heard, in that order", r1.heard === "change the style to anime"
    && r1.evs.indexOf("speech") >= 0 && r1.evs.indexOf("turn") > r1.evs.indexOf("speech") && r1.evs.indexOf("heard") > r1.evs.indexOf("turn"), r1);
  check("...the session spoke 48 kHz (the Voice Isolator's rate)", r1.rate === 48000 && r1.isolator === true, r1);
  const s2 = V.status();
  check("the process stays up between turns (the models loaded once)", s2.running && s2.ready && s2.rate === 48000, s2);
  const r2 = await client("app", { test_heard: "make a video of a tiger walking in the snow", mode: "talk", history: [], phrases: [] }, speech(48000, 0.5, 1.2, 1.5));
  check("the 📱 app's turn: heard AND answered by lib/appVoice in one go (intent video, the words)", r2.result && r2.result.intent === "video"
    && /tiger walking in the snow/.test(r2.result.text || "") && r2.heard === "make a video of a tiger walking in the snow", r2);
  const r3 = await client("chat", { test_heard: "x" }, speech(48000, 3.5, 0, 0));
  check("nothing said for the quiet time = nothing (no turn, nothing heard)", r3.nothing === true && !r3.heard && r3.evs.indexOf("turn") < 0, r3);
  const r4 = await client("chat", { test_heard: "stop the job" }, speech(48000, 0.4, 6, 1), 1.6);
  check("a tap (I'm done) while still talking closes the turn and it is heard", r4.heard === "stop the job" && r4.evs.indexOf("turn") >= 0, r4);
  // a turn too short to be words (a click): dropped, nothing heard
  const r5 = await client("chat", { test_heard: "never" }, speech(48000, 0.5, 0.15, 3.5));
  check("a click (150 ms) is dropped by the turn policy - nothing heard", !r5.heard && r5.evs.indexOf("heard") < 0, r5);
  // the API around it
  let bad = null; try { await V.push("nope", Buffer.alloc(10)); } catch (e) { bad = e; }
  check("a gone session: 404 in words", bad && bad.status === 404 && /start talking again/.test(bad.message), bad && bad.message);
  const o = await V.open({ kind: "chat" });
  let big = null; try { await V.push(o.sid, Buffer.alloc(48000 * 2 * 6)); } catch (e) { big = e; }
  check("a piece over 5 seconds is refused (413)", big && big.status === 413, big && big.message);
  const odd = await V.push(o.sid, Buffer.alloc(3));                 // an odd byte count: the process copes
  check("an odd-sized piece does not break the process", Array.isArray(odd.events) && V.status().running, odd);
  await V.close(o.sid);
  V.stop();
  check("stop(): the process down", !V.status().running);
  console.log(`RESULT: ${P} passed, ${F} failed`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log("FAIL:", e.stack || e); process.exit(1); });
