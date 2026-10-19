// bitGen Studio — THE SFX DOCK'S ROUTES (2.360.0). Mounted by routes/index.js (never server.js); the library
// is lib/sfx.js (projects/<p>/sfx), the dock is ext/sfxdock.
//
//   GET  /api/sfx                       {dir, files: [{name, size, mtime, undo}]}
//   POST /api/sfx/add                   multipart "files" (audio or video, .mov included) -> {added, errors}
//   GET  /api/sfx/file/:name            the WAV (the dock's player)
//   GET  /api/sfx/peaks/:name           lib/waveform peaks (0..255) + seconds
//   POST /api/sfx/trim {name, start, end, mode: keep|delete, as_new}
//   POST /api/sfx/undo {name}           the version before the last in-place cut
//   POST /api/sfx/to-sound {name}       a copy into the project's Sound assets
//   POST /api/sfx/delete {name}
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const multer = require("multer");
const core = require("../lib/core");
const sfx = require("../lib/sfx");
const waveform = require("../lib/waveform");

const upload = multer({ dest: path.join(os.tmpdir(), "bitgen-sfx"),
                        limits: { fileSize: 8 * 1024 * 1024 * 1024, files: 50 } });

function send(res, r) {
  if (r && r.error) return res.status(r.status || 400).json({ error: r.error });
  res.json({ ok: true, ...r });
}

function mount(app) {
  app.get("/api/sfx", (_req, res) => {
    try { res.json({ dir: sfx.dir(), files: sfx.list() }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/sfx/add", upload.array("files", 50), (req, res) => {
    const added = [], errors = [];
    for (const f of req.files || []) {
      try {
        const r = sfx.add(f.path, f.originalname);
        if (r.error) errors.push(r.error); else added.push(r);
      } catch (e) { errors.push(`${f.originalname}: ${e.message}`); }
      finally { try { fs.unlinkSync(f.path); } catch {} }
    }
    if (!added.length && !errors.length) return res.status(400).json({ error: "no files in the request" });
    res.status(added.length ? 200 : 400).json({ ok: added.length > 0, added, errors,
      note: added.map((a) => `${a.name} (${a.from === "video" ? "audio extracted from " + a.original : "from " + a.original})`).join(", ")
        + (errors.length ? (added.length ? " · " : "") + errors.join(" · ") : "") });
  });
  app.get("/api/sfx/file/:name", (req, res) => {
    const p = sfx.fileOf(req.params.name);
    if (!p) return res.status(404).json({ error: "no such sound effect" });
    res.sendFile(p);
  });
  app.get("/api/sfx/peaks/:name", async (req, res) => {
    const p = sfx.fileOf(req.params.name);
    if (!p) return res.status(404).json({ error: "no such sound effect" });
    try { res.json({ name: path.basename(p), ...(await waveform.peaks(p, core.projDir(core.getProject()))) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/sfx/trim", (req, res) => {
    const b = req.body || {};
    try { send(res, sfx.trim(b.name, b.start, b.end, b.mode, b.as_new === true)); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/sfx/undo", (req, res) => { try { send(res, sfx.undo((req.body || {}).name)); } catch (e) { res.status(500).json({ error: e.message }); } });
  app.post("/api/sfx/to-sound", (req, res) => { try { send(res, sfx.toSound((req.body || {}).name)); } catch (e) { res.status(500).json({ error: e.message }); } });
  app.post("/api/sfx/delete", (req, res) => { try { send(res, sfx.remove((req.body || {}).name)); } catch (e) { res.status(500).json({ error: e.message }); } });
}

module.exports = { mount };
