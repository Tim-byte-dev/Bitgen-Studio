// routes/sheetLibrary.js — 2.874.0: your own mannequins + character sheet templates for the 🪪 Character sheet (lib/sheetLibrary.js).
// Mounted from routes/index.js (never server.js).
//   GET    /api/charsheet/library                      {mannequins: [{id, name, w, h, url}], templates: [...]}
//   POST   /api/charsheet/library/:kind                multipart file (+ name) -> the item   (kind mannequins | templates)
//   DELETE /api/charsheet/library/:kind/:id            {ok}
//   GET    /api/charsheet/library/:kind/:id/file       the picture
"use strict";
function mount(app) {
  const L = () => require("../lib/sheetLibrary");
  const upload = require("../lib/tempUpload").tempUpload({ fileSize: 40 * 1024 * 1024 });
  const fail = (res, e, code) => res.status(code || 400).json({ error: e.message || String(e) });
  app.get("/api/charsheet/library", (req, res) => { try { res.json(L().list()); } catch (e) { fail(res, e, 500); } });
  app.post("/api/charsheet/library/:kind", upload.single("file"), (req, res) => {
    try {
      const f = req.file;
      if (!f) return fail(res, new Error("choose a picture first"));
      res.json(L().add(req.params.kind, { buffer: f.buffer, path: f.buffer ? null : f.path, name: (req.body || {}).name, original: f.originalname }));
    } catch (e) { fail(res, e); }
  });
  app.delete("/api/charsheet/library/:kind/:id", (req, res) => {
    try { res.json({ ok: L().remove(req.params.kind, req.params.id) }); } catch (e) { fail(res, e); }
  });
  app.get("/api/charsheet/library/:kind/:id/file", (req, res) => {
    const p = L().file(req.params.kind, req.params.id);
    if (!p) return res.status(404).json({ error: "no such picture" });
    res.sendFile(p);
  });
}
module.exports = { mount };
