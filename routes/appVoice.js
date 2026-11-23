// bitGen Studio — routes/appVoice.js (2.914.0): 🎙 the 📱 app's voice (lib/appVoice.js).
//   POST /api/app/voice   multipart: audio (the recording), mode (talk | dictate), history (JSON), phrases (the app's own
//                         "phrase = kind" lines), 2.921.0 web (1 = 🌐 may search), persona (assistant | friend)
//                         -> {heard, intent, text, reply, sources, persona, web, error}
// The paired app's key (lib/remoteGuard.js) - also through the relay / the tunnel (a voice clip is small).
// 2.927.0 👂 the wake word (lib/wakeWord.js):
//   POST /api/app/wake    multipart: audio (a short burst of speech, WAV), history, phrases, web, persona
//                         -> {wake, heard, rest, result?}  result = the first question's answer when something followed the
//                         name ("Hi Gemma, what's the time?") - the same shape as /api/app/voice
//   GET  /api/app/assistant -> {name, wake}     POST /api/app/assistant {name, wake} (Settings ▸ General ▸ 🗣 The assistant)
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const multer = require("multer");
const core = require("../lib/core");

function mount(app) {
  const up = multer({ dest: path.join(os.tmpdir(), "bitgen-voice"), limits: { fileSize: 12 * 1024 * 1024, files: 1 } });
  app.post("/api/app/voice", up.single("audio"), async (req, res) => {
    const f = req.file, b = req.body || {};
    try {
      let text = "";
      if (process.env.H3_E2E === "1" && b.test_heard) text = String(b.test_heard);          // the suite has no speech to text
      else {
        if (!f) return res.status(400).json({ error: "no recording" });
        const ext = /webm/.test(f.mimetype || "") ? ".webm" : /ogg/.test(f.mimetype || "") ? ".ogg" : /mp4|aac|m4a/.test(f.mimetype || "") ? ".m4a" : /wav/.test(f.mimetype || "") ? ".wav" : ".webm";
        const named = f.path + ext; fs.renameSync(f.path, named); f.path = named;
        text = String(((await require("../lib/asr").transcribeFile(named)) || {}).text || "").trim();
      }
      let history = []; try { history = JSON.parse(b.history || "[]"); } catch { history = []; }
      let phrases = []; try { phrases = JSON.parse(b.phrases || "[]"); } catch { phrases = String(b.phrases || ""); }
      res.json(await require("../lib/appVoice").handle(core, { text, history, custom: phrases, mode: b.mode === "dictate" ? "dictate" : "talk",
        web: b.web === "1" || b.web === "true", persona: b.persona === "friend" ? "friend" : "assistant" }));
    } catch (e) {
      res.status(500).json({ error: /not installed/i.test(String(e.message)) ? "speech to text is not set up on your PC: bitGen Studio ▸ Settings ▸ Audio ▸ Install faster-whisper" : String(e.message || e) });
    } finally { if (f) fs.unlink(f.path, () => {}); }
  });
  // 2.927.0: 👂 "Hi Gemma" - was the assistant's name called? (the kept-up Whisper, told the name; ~0.5-1 s a burst)
  app.post("/api/app/wake", up.single("audio"), async (req, res) => {
    const f = req.file, b = req.body || {}, W = require("../lib/wakeWord"), set = W.settings();
    try {
      if (!set.wake) return res.json({ wake: false, off: true, heard: "" });
      let text = "";
      if (process.env.H3_E2E === "1" && b.test_heard != null && b.test_heard !== "") text = String(b.test_heard);
      else if (process.env.H3_E2E === "1" && !process.env.H3_E2E_ASR) return res.json({ wake: false, heard: "" });   // the suite has no speech to text: a burst of the fake microphone is nothing
      else {
        if (!f) return res.status(400).json({ error: "no recording" });
        const named = f.path + ".wav"; fs.renameSync(f.path, named); f.path = named;
        text = String(((await require("../lib/asrLive").transcribe(named, { prompt: "Hi " + set.name + ". Hey " + set.name + "." })) || {}).text || "").trim();
      }
      const m = W.match(text, set.name);
      if (!m.wake) return res.json({ wake: false, heard: text });
      const out = { wake: true, heard: text, rest: m.rest, name: set.name };
      if (m.rest.split(/\s+/).filter(Boolean).length >= 2) {                // "Hi Gemma, what's the time?" - the first question too
        let history = []; try { history = JSON.parse(b.history || "[]"); } catch { history = []; }
        let phrases = []; try { phrases = JSON.parse(b.phrases || "[]"); } catch { phrases = String(b.phrases || ""); }
        out.result = await require("../lib/appVoice").handle(core, { text: m.rest, history, custom: phrases, mode: "talk",
          web: b.web === "1" || b.web === "true", persona: b.persona === "friend" ? "friend" : "assistant" });
      }
      res.json(out);
    } catch (e) {
      res.status(500).json({ error: /not installed/i.test(String(e.message)) ? "speech to text is not set up on your PC: bitGen Studio ▸ Settings ▸ Audio ▸ Install faster-whisper" : String(e.message || e) });
    } finally { if (f) fs.unlink(f.path, () => {}); }
  });
  app.get("/api/app/assistant", (_req, res) => { try { res.json(require("../lib/wakeWord").settings()); } catch (e) { res.status(500).json({ error: String(e.message || e) }); } });
  app.post("/api/app/assistant", (req, res) => { try { res.json(require("../lib/wakeWord").setSettings(req.body || {})); } catch (e) { res.status(500).json({ error: String(e.message || e) }); } });
}
module.exports = { mount };
