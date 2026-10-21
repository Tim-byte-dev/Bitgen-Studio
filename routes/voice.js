// bitGen Studio — routes/voice.js (2.564.0): the 🎙 voice chat - hear a spoken turn, answer it with the app's actions.
// Mounted from routes/index.js (never server.js). The page records (static/voicechat.js: a live, hands-free loop - it
// listens, hears the end of what you said, sends it, speaks the answer, runs the actions, listens again).
//   POST /api/voice/hear     multipart "audio" (a 16 kHz mono wav from the page) -> {text, language, device, live}
//   POST /api/voice/turn     {text, history: [{role, content}], state: the page's snapshot} -> {say, actions, dropped}
//   GET  /api/voice/status   {asr: {installed, model, device}, live: lib/asrLive.status()}
//   POST /api/voice/stop     the live transcriber stops (its model's memory back)
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const multer = require("multer");
const core = require("../lib/core");
const asrLive = require("../lib/asrLive");
const voiceAgent = require("../lib/voiceAgent");

const upload = multer({ dest: path.join(os.tmpdir(), "bitgen-voice"), limits: { fileSize: 40 * 1024 * 1024, files: 1 } });

function mount(app) {
  app.get("/api/voice/status", async (_req, res) => {
    let a = {};
    try { a = await require("../lib/asr").status(); } catch (e) { a = { error: e.message }; }
    res.json({ asr: { installed: !!a.installed, model: a.model || "", device: a.device || "" }, live: asrLive.status() });
  });

  app.post("/api/voice/hear", upload.single("audio"), async (req, res) => {
    const f = req.file;
    if (!f) return res.status(400).json({ error: "no audio" });
    const wav = f.path + ".wav";
    try {
      fs.renameSync(f.path, wav);
      const r = await asrLive.transcribe(wav, { language: (req.body || {}).language || "" });
      res.json({ text: r.text || "", language: r.language || "", device: r.device || "", live: !!r.live, note: r.note || "" });
    } catch (e) {
      const m = String(e && e.message || e);
      if (/nothing was transcribed/.test(m)) return res.json({ text: "", note: "nothing was heard" });
      res.status(/not installed/.test(m) ? 400 : 500).json({ error: m });
    } finally { fs.unlink(wav, () => {}); fs.unlink(f.path, () => {}); }
  });

  app.post("/api/voice/turn", async (req, res) => {
    const b = req.body || {};
    const text = String(b.text || "").trim();
    if (!text) return res.status(400).json({ error: "nothing to answer" });
    try {
      const llmChat = require("../lib/llmChat");
      const r = await llmChat.complete(core, { messages: voiceAgent.messages({ text, history: b.history, state: b.state }), temperature: 0.4, max_tokens: 900 });
      if (!r || r.ok === false) return res.status((r && r.status) || 502).json({ error: (r && r.error) || "the LLM did not answer - start one in Settings ▸ LLM" });
      const out = voiceAgent.parse(llmChat.stripThinking(r.text || ""));                // (complete() already answers readReply()'s {ok, text})
      if (!out.say && !out.actions.length) out.say = "Sorry, I didn't get that.";
      res.json(out);
    } catch (e) { res.status(502).json({ error: "the LLM did not answer - " + (e.message || e) }); }
  });

  app.post("/api/voice/stop", (_req, res) => { asrLive.stop(); res.json({ ok: true }); });
}

module.exports = { mount };
