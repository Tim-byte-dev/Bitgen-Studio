// routes/voiceStream.js — 2.919.0: the live voice stream (lib/voiceStream.js - SAVA's end of turn + the Voice Isolator).
// Mounted from routes/index.js (never server.js). The 📱 app's 🎙 Talk and the studio's 🎙 voice chat send the microphone
// while you talk, ~200 ms a piece (little-endian int16 mono at the session's rate), and read what happened from each answer.
//   GET  /api/voice/stream             {installed, isolator, running, ready, device, rate, note}
//   POST /api/voice/stream/open        {kind: app | chat, history, phrases, mode, language, web, persona} -> {sid, rate, isolator, device}
//                                      | 409 {needs: "voicekit"} (Settings ▸ Add-ons ▸ Voice conversation)
//   POST /api/voice/stream/:sid        the raw PCM (application/octet-stream) -> {events, hearing, done}
//   POST /api/voice/stream/:sid/close  -> {events, hearing, done}    GET /api/voice/stream/:sid -> the same (a poll)
// events: speech (a turn opened) · turn {seconds, reason} · heard {text} · result {...lib/appVoice.handle} (kind app) ·
// dropped {reason} · error {error}
"use strict";
const express = require("express");

function mount(app) {
  const V = () => require("../lib/voiceStream");
  const fail = (res, e) => res.status(e.status || (e.notInstalled ? 409 : 500)).json(Object.assign({ error: String(e.message || e) }, e.notInstalled ? { needs: "voicekit" } : {}));
  app.get("/api/voice/stream", (_req, res) => { try { res.json(V().status()); } catch (e) { fail(res, e); } });
  // the suite only (H3_E2E): {on} = the stand-in `inworld` package (scripts/fixtures/voicekit_fake) on the system Python
  if (process.env.H3_E2E === "1") app.post("/api/voice/stream/e2e", (req, res) => {
    const on = !!(req.body || {}).on, path = require("path");
    V().configure(on ? { python: process.env.BITGEN_VOICEKIT_PYTHON || (process.platform === "win32" ? "python" : "python3"),
      env: { PYTHONPATH: path.join(require("../lib/core").BASE, "scripts", "fixtures", "voicekit_fake") } } : null);
    res.json({ ok: true, on });
  });
  app.post("/api/voice/stream/open", async (req, res) => { try { res.json(await V().open(req.body || {})); } catch (e) { fail(res, e); } });
  app.post("/api/voice/stream/:sid/close", async (req, res) => { try { res.json(await V().close(req.params.sid)); } catch (e) { fail(res, e); } });
  app.get("/api/voice/stream/:sid", (req, res) => { try { res.json(V().poll(req.params.sid)); } catch (e) { fail(res, e); } });
  app.post("/api/voice/stream/:sid", express.raw({ type: () => true, limit: "2mb" }), async (req, res) => {
    try { res.json(await V().push(req.params.sid, Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0))); } catch (e) { fail(res, e); }
  });
}
module.exports = { mount };
