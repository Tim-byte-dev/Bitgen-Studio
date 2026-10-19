// bitGen Studio — routes/captions.js (2.406.0): the timeline's caption track (lib/captions.js). Mounted from
// routes/index.js (never server.js).
//
//   GET  /api/captions/info                     {style (the defaults), fonts, asr: {installed, model}}
//   POST /api/captions/build {tl, maxChars, maxSecs, language, fresh}
//                                               -> {cues, sources, skipped}   transcribes what speaks (cached per file)
//   POST /api/captions/srt {cues}               -> the .srt text (the panel's ⬇ .srt)
"use strict";
const captions = require("../lib/captions");

function mount(app) {
  const express = require("express");
  const J = express.json({ limit: "16mb" });
  const fail = (res, e) => res.status(e.status || 500).json({ ok: false, error: String((e && e.message) || e) });
  app.get("/api/captions/info", async (_req, res) => {
    let a = { installed: false };
    try { const s = await require("../lib/asr").status(); a = { installed: !!s.installed, model: s.model }; } catch { /* no asr */ }
    res.json({ ok: true, style: captions.STYLE, fonts: captions.FONTS, asr: a });
  });
  app.post("/api/captions/build", J, async (req, res) => {
    const b = req.body || {};
    try {
      res.json({ ok: true, ...(await captions.build(b.tl, { maxChars: b.maxChars, maxSecs: b.maxSecs,
                                                             language: b.language, fresh: !!b.fresh })) });
    } catch (e) { fail(res, Object.assign(e, { status: e.status || (/not installed/.test(e.message) ? 409 : 500) })); }
  });
  app.post("/api/captions/srt", J, (req, res) => {
    res.type("text/plain").send(captions.toSrt((req.body || {}).cues));
  });
}

module.exports = { mount };
