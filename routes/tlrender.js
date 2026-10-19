// bitGen Studio — routes/tlrender.js (2.418.0): ⚡ render previews (lib/tlRender.js). Mounted from routes/index.js.
// The render itself is POST /api/export with `preview: <id>` (routes/index.js - its own file, no deliverables).
//
//   POST /api/tlrender/adopt {id}        -> {ok, file, url, dur}   the compile's preview_<id>.mp4 -> cache/preview
//   GET  /api/tlrender/file/<id>.mp4     -> the rendered preview
"use strict";
const tlRender = require("../lib/tlRender");

function mount(app, core) {
  const express = require("express");
  const J = express.json({ limit: "1mb" });
  const pdir = () => core.projDir(core.getProject());
  app.post("/api/tlrender/adopt", J, (req, res) => {
    try { res.json(Object.assign({ ok: true }, tlRender.adopt(pdir(), (req.body || {}).id))); }
    catch (e) { res.status(e.status || 500).json({ ok: false, error: String(e.message || e) }); }
  });
  app.get("/api/tlrender/file/:file", (req, res) => {
    const f = tlRender.fileFor(pdir(), req.params.file);
    if (!f) return res.status(404).json({ ok: false, error: "no such preview render" });
    res.sendFile(f);
  });
}

module.exports = { mount };
