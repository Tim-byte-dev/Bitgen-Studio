// bitGen Studio — THE SYNTH STATION's ROUTES (2.953.0). Mounted by routes/index.js (never server.js); the library is
// lib/synthSamples.js (<install>/synth_samples), the docker is ext/synthdock (the Audio docker's 🎹 Synth tab).
//
//   GET  /api/synth/samples                {dir, samples: [{name, size, mtime}]}
//   POST /api/synth/samples                multipart "files" (🎙 Sample it sends its WAV the same way) -> {added, errors, samples}
//   GET  /api/synth/samples/file/:name     the file (the looper's rows)
//   POST /api/synth/samples/delete {name}
//   POST /api/synth/to-project             multipart "file" + to = sfx | sound, name -> the loop / a take in this project's
//                                          SFX (lib/sfx.js - a 48 kHz WAV), for "sound" its Sound assets too
//   GET  /api/synth/sources                2.954.0: every sound the timeline can take, grouped (lib/synthSources.js)
//   GET  /api/synth/source/:group/:name    one of them (my | sfx | snd | out)
//   GET  /api/synth/files                  2.956.0: the project's synth files (.sfx: timeline / loop / key - lib/synthFiles.js)
//   GET  /api/synth/files/:name            one (JSON)
//   POST /api/synth/files {name, data, overwrite}   save (409 when it is there and overwrite is not set)
//   POST /api/synth/files/delete {name}
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const express = require("express");
const multer = require("multer");
const sfx = require("../lib/sfx");
const S = require("../lib/synthSamples");
const SRC = require("../lib/synthSources");
const SF = require("../lib/synthFiles");

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
  app.get("/api/synth/sources", (_req, res) => {
    try { res.json({ groups: SRC.groups() }); } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.get("/api/synth/source/:group/:name", (req, res) => {
    const p = SRC.fileOf(req.params.group, req.params.name);
    if (!p) return res.status(404).json({ error: "no such sound" });
    res.set("Cache-Control", "no-store");
    res.sendFile(p);
  });
  app.get("/api/synth/files", (_req, res) => {
    try { res.json({ dir: SF.dir(), files: SF.list() }); } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.get("/api/synth/files/:name", (req, res) => {
    try { res.json(SF.read(req.params.name)); } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
  app.post("/api/synth/files", express.json({ limit: "9mb" }), (req, res) => {
    const b = req.body || {}, r = SF.write(b.name, b.data, !!b.overwrite);
    if (r.error) return res.status(r.status || 400).json(r);
    res.json({ ok: true, ...r });
  });
  app.post("/api/synth/files/delete", express.json({ limit: "4kb" }), (req, res) => {
    const r = SF.remove((req.body || {}).name);
    if (r.error) return res.status(r.status || 400).json(r);
    res.json({ ok: true, ...r });
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
