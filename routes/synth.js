// bitGen Studio — THE SYNTH STATION's ROUTES (2.953.0). Mounted by routes/index.js (never server.js); the library is
// lib/synthSamples.js (<install>/synth_samples), the docker is ext/synthdock (the Audio docker's 🎹 Synth tab).
//
//   GET  /api/synth/samples                {dir, samples: [{name, size, mtime}]}
//   POST /api/synth/samples                multipart "files" (🎙 Sample it sends its WAV the same way) -> {added, errors, samples}
//   GET  /api/synth/samples/file/:name     the file (the looper's rows)
//   POST /api/synth/samples/delete {name}
//   POST /api/synth/to-project             multipart "file" + to = sfx | sound, name -> the loop / a take in this project's
//                                          SFX (lib/sfx.js - a 48 kHz WAV), for "sound" its Sound assets too
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const express = require("express");
const multer = require("multer");
const sfx = require("../lib/sfx");
const S = require("../lib/synthSamples");

function mount(app) {
  const upload = multer({ dest: path.join(os.tmpdir(), "bitgen-synth"), limits: { fileSize: S.MAX_MB * 1024 * 1024, files: 50 } });
  const gone = (fl) => (fl || []).forEach((f) => { try { fs.unlinkSync(f.path); } catch { /* gone */ } });
  app.get("/api/synth/samples", (_req, res) => {
    try { res.json({ dir: S.dir(), samples: S.list() }); } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/synth/samples", upload.array("files", 50), (req, res) => {
    const added = [], errors = [];
    for (const f of req.files || []) {
      try { const r = S.add(f.path, f.originalname); if (r.error) errors.push(r.error); else added.push(r); }
      catch (e) { errors.push(`${f.originalname}: ${e.message}`); }
    }
    gone(req.files);
    res.status(added.length || !errors.length ? 200 : 400).json({ added, errors, samples: S.list() });
  });
  app.get("/api/synth/samples/file/:name", (req, res) => {
    const p = S.fileOf(req.params.name);
    if (!p) return res.status(404).json({ error: "no such sample" });
    res.set("Cache-Control", "no-store");
    res.sendFile(p);
  });
  app.post("/api/synth/samples/delete", express.json({ limit: "4kb" }), (req, res) => {
    const r = S.remove((req.body || {}).name);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json({ ok: true, ...r, samples: S.list() });
  });
  app.post("/api/synth/to-project", upload.single("file"), (req, res) => {
    const f = req.file, to = String((req.body || {}).to || "sfx");
    try {
      if (!f) return res.status(400).json({ error: "no sound came" });
      if (!["sfx", "sound"].includes(to)) return res.status(400).json({ error: "to is sfx or sound" });
      const r = sfx.add(f.path, S.exportName((req.body || {}).name, f.originalname));
      if (r.error) return res.status(400).json({ error: r.error });
      if (to === "sound") {
        const s = sfx.toSound(r.name);
        if (s.error) return res.status(s.status || 400).json({ error: s.error });
        return res.json({ ok: true, name: s.name, sfx: r.name, seconds: r.seconds, note: `${s.name} is in the Sound assets (and the SFX tab as ${r.name})` });
      }
      res.json({ ok: true, name: r.name, seconds: r.seconds, note: `${r.name} is in this project's SFX (the 💥 SFX tab)` });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { gone(f ? [f] : []); }
  });
}
module.exports = { mount };
