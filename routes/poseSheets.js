// bitGen Studio — routes/poseSheets.js (2.577.0): the Character creator's 🧍 Pose sheet dialog.
// The pose sheets are the user's own pictures in <install>/pose_sheets/ (lib/poseSheets.js).
//   GET  /api/pose-sheets                 {dir, items: [{id, name, folder, size, mtime}]}
//   GET  /api/pose-sheets/file?id=<id>    the picture (the dialog's thumbnails)
//   POST /api/pose-sheets/open            shows the folder in the file manager -> {ok, dir}
"use strict";
const PS = require("../lib/poseSheets");

function mount(app) {
  app.get("/api/pose-sheets", (req, res) => {
    try { res.json({ dir: PS.dir(), items: PS.list() }); } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
  app.get("/api/pose-sheets/file", (req, res) => {
    const f = PS.file(req.query.id);
    if (!f) return res.status(404).json({ error: "no such pose sheet" });
    res.set("Cache-Control", "no-cache");
    res.sendFile(f);
  });
  app.post("/api/pose-sheets/open", (req, res) => {
    try { res.json(Object.assign({ ok: true }, PS.openDir())); } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
}

module.exports = { mount };
