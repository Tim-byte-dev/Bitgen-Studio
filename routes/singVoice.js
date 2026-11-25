// bitGen Studio — routes/singVoice.js (2.965.0): 🎤 SING IT IN MY VOICE - the 🎹 Synth tab's 🎤 row (ext/synthdock/synthsing.js).
// Mounted by routes/index.js (never server.js); the work is lib/singVoice.js, the installs lib/singVoiceAddon.js.
//
//   GET  /api/sing                         {engines [{id, label, short, ref, installed, note}], clips, models, quality, busy}
//   GET  /api/sing/status?engine=seedvc    {installed} (static/needinstall.js "sing_<engine>")
//   POST /api/sing/clips                   multipart "files" (a 🎙 recording or files) -> {added [{name, seconds}], errors, clips}
//   GET  /api/sing/clips/file/:name        a clip (▶ in the row)
//   POST /api/sing/clips/delete {name}
//   POST /api/sing/convert {engine, sample, clip | model, shift (-24..24 | "auto" - 2.967.0), quality}   -> {job}   (409 {needs} when not installed)
//   POST /api/sing/separate {sample}       -> {job}  (409 {needs: "demucs"})
//   POST /api/sing/train {name, clips, epochs}   -> {job}
//   GET  /api/sing/job/:id?from=n          {job: {id, kind, label, state, result, error}, lines, next}
//   POST /api/sing/job/:id/cancel          2.967.0: ■ Stop - its processes ended; state -> "cancelled" (nothing added)
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const express = require("express");
const multer = require("multer");
const SV = require("../lib/singVoice");

function mount(app) {
  const upload = multer({ dest: path.join(os.tmpdir(), "bitgen-sing"), limits: { fileSize: 300 * 1024 * 1024, files: 20 } });
  const J = express.json({ limit: "16kb" });
  const fail = (res, e) => res.status(e.status || 500).json(Object.assign({ error: e.message || String(e) }, e.needs ? { needs: e.needs } : {}));
  const jobOut = (j) => ({ id: j.id, kind: j.kind, label: j.label, state: j.state, result: j.result, error: j.error });
  app.get("/api/sing", (_req, res) => { try { res.json(SV.status()); } catch (e) { fail(res, e); } });
  app.get("/api/sing/status", (req, res) => res.json(SV.engineStatus(String(req.query.engine || ""))));
  app.post("/api/sing/clips", upload.array("files", 20), (req, res) => {
    const added = [], errors = [];
    for (const f of req.files || []) {
      try { const r = SV.addClip(f.path, (req.body && req.body.name) || f.originalname); if (r.error) errors.push(r.error); else added.push(r); }
      catch (e) { errors.push(String(e.message || e)); }
      try { fs.unlinkSync(f.path); } catch { /* gone */ }
    }
    res.status(added.length || !errors.length ? 200 : 400).json({ added, errors, clips: SV.listClips() });
  });
  app.get("/api/sing/clips/file/:name", (req, res) => {
    const f = SV.clipFile(req.params.name);
    if (!f) return res.status(404).json({ error: "no such clip" });
    res.sendFile(f);
  });
  app.post("/api/sing/clips/delete", J, (req, res) => { const r = SV.removeClip((req.body || {}).name); res.status(r.status || 200).json(Object.assign(r, { clips: SV.listClips() })); });
  const go = (fn) => (req, res) => { try { res.json({ job: jobOut(fn(req.body || {})) }); } catch (e) { fail(res, e); } };
  app.post("/api/sing/convert", J, go((b) => SV.convert(b)));
  app.post("/api/sing/separate", J, go((b) => SV.separate(b)));
  app.post("/api/sing/train", J, go((b) => SV.train(b)));
  app.post("/api/sing/job/:id/cancel", (req, res) => { try { res.json(SV.cancel(String(req.params.id || ""))); } catch (e) { fail(res, e); } });
  app.get("/api/sing/job/:id", (req, res) => {
    const j = SV.job(String(req.params.id || ""));
    if (!j) return res.status(404).json({ error: "no such job (bitGen was restarted?)" });
    const from = Math.max(0, Math.min(j.lines.length, parseInt(req.query.from, 10) || 0));
    res.json({ job: jobOut(j), lines: j.lines.slice(from), next: j.lines.length });
  });
}
module.exports = { mount };
