// bitGen Studio — routes/appVoice.js (2.914.0): 🎙 the 📱 app's voice (lib/appVoice.js).
//   POST /api/app/voice   multipart: audio (the recording), mode (talk | dictate), history (JSON), phrases (the app's own
//                         "phrase = kind" lines) -> {heard, intent, text, reply, sources, error}
// The paired app's key (lib/remoteGuard.js) - also through the relay / the tunnel (a voice clip is small).
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
      res.json(await require("../lib/appVoice").handle(core, { text, history, custom: phrases, mode: b.mode === "dictate" ? "dictate" : "talk" }));
    } catch (e) {
      res.status(500).json({ error: /not installed/i.test(String(e.message)) ? "speech to text is not set up on your PC: bitGen Studio ▸ Settings ▸ Audio ▸ Install faster-whisper" : String(e.message || e) });
    } finally { if (f) fs.unlink(f.path, () => {}); }
  });
}
module.exports = { mount };
