// bitGen Studio — routes/speechDialog.js (2.621.0): the SFX docker's 🗣 SPEECH & DIALOG (lib/speechDialog.js).
// Mounted from routes/index.js (never server.js).
//   GET  /api/speech              {engines: [{id, label, installed}], engine (Settings ▸ Audio's), voices, emotions, tags, formats}
//   POST /api/speech/parse        {text, mode} -> {lines, speakers}
//   POST /api/speech/speak        {name, description, text, engine, format, mode, voice, emotion, cast, pause} -> the saved file
//   GET  /api/speech/progress     the running read
//   POST /api/speech/write        {brief, speakers, lines, emotion} -> {text} - the LLM writes the lines
//   GET  /api/speech/meta?name=   the metadata a sound asset carries (title, date, description, text, voices)
"use strict";
const express = require("express");
const core = require("../lib/core");
const SD = require("../lib/speechDialog");

function mount(app) {
  const J = express.json({ limit: "2mb" });
  const fail = (res, e, code) => res.status((e && e.status) || code || 400).json({ error: String((e && e.message) || e) });
  app.get("/api/speech", async (_req, res) => {
    try {
      const tts = require("../lib/tts"), st = await tts.status();
      res.json({ engine: st.engine, engines: [{ id: "omnivoice", label: "OmniVoice", installed: !!st.omnivoice.installed }, { id: "ming", label: "Ming-3.0 TTS", installed: !!st.ming.installed }],
        voices: (st.voices || []).filter((v) => v.ok).map((v) => ({ name: v.name, kind: v.kind })), emotions: Object.keys(SD.EMOTIONS), tags: SD.TAGS, formats: SD.FORMATS });
    } catch (e) { fail(res, e, 500); }
  });
  app.post("/api/speech/parse", J, (req, res) => { const b = req.body || {}; res.json(SD.parse(b.text, { mode: b.mode })); });
  app.post("/api/speech/speak", J, async (req, res) => {
    try { res.json(await SD.speak(req.body || {})); } catch (e) { fail(res, e); }
  });
  app.get("/api/speech/progress", (_req, res) => res.json(SD.progressState()));
  app.post("/api/speech/write", J, async (req, res) => {
    try {
      const llmChat = require("../lib/llmChat");
      const r = await llmChat.complete(core, { messages: SD.llmMessages(req.body || {}), temperature: 0.8, max_tokens: 1200 });
      if (!r || r.ok === false) return res.status((r && r.status) || 502).json({ error: (r && r.error) || "the LLM did not answer - start one in Settings ▸ LLM" });
      const text = SD.tidyLlm(llmChat.stripThinking ? llmChat.stripThinking(r.text || "") : r.text);
      if (!text) return res.status(502).json({ error: "the LLM wrote nothing usable - try again" });
      res.json({ text, speakers: SD.parse(text).speakers });
    } catch (e) { fail(res, "the LLM did not answer - " + (e.message || e), 502); }
  });
  app.get("/api/speech/meta", (req, res) => { try { res.json(SD.readMeta(req.query.name)); } catch (e) { fail(res, e); } });
}

module.exports = { mount };
