// bitGen Studio — routes/textedit.js (2.408.0): EDIT BY TRANSCRIPT + SCENE CUTS for the timeline
// (ext/timelinedock/textedit.js; the cutting itself is static/textedit.js on the page). Mounted from routes/index.js
// (never server.js).
//
//   POST /api/textedit/words {name, fresh}         -> {words: [{start, end, word}], cached}   a clip's file, transcribed
//                                                    once on this machine (lib/captions' cache, shared with 💬 Captions)
//   POST /api/textedit/scenecuts {name, threshold, min} -> {cuts: [source seconds], threshold, cached}
"use strict";
const path = require("path");
const core = require("../lib/core");

function mount(app) {
  const fail = (res, e) => res.status(e.status || (/not installed/.test(e.message) ? 409 : 500)).json({ ok: false, error: String((e && e.message) || e) });
  app.post("/api/textedit/words", async (req, res) => {
    const b = req.body || {};
    try {
      const asr = require("../lib/asr");
      if (!asr.findAsset(b.name)) throw Object.assign(new Error("not in this project: " + b.name), { status: 404 });
      const st = await asr.status().catch(() => null);
      if (st && !st.installed) throw Object.assign(new Error("speech-to-text (faster-whisper) is not installed - Settings → Audio installs it"), { status: 409 });
      const caps = require("../lib/captions");
      const t = await caps.transcript(path.basename(String(b.name)), { fresh: !!b.fresh, language: b.language });
      res.json({ ok: true, words: caps.wordsOf(t.segments), cached: !!t.cached });
    } catch (e) { fail(res, e); }
  });
  app.post("/api/textedit/scenecuts", async (req, res) => {
    const b = req.body || {};
    try {
      const f = require("../lib/asr").findAsset(b.name);
      const r = await require("../lib/sceneCuts").detect(f, { threshold: b.threshold, min: b.min },
        path.join(core.projDir(core.getProject()), "temp", "scenecuts"));
      res.json({ ok: true, ...r });
    } catch (e) { fail(res, e); }
  });
}

module.exports = { mount };
