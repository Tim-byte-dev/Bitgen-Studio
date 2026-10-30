// bitGen Studio — the computer's font files (2.435.0) for the image editor's PDF save ("Embed fonts"). Mounted from
// routes/index.js (never server.js); the work is lib/fontFiles.js.
//   GET /api/fonts                         {families: [...]}
//   GET /api/fonts/file?family=&bold=&italic=   the .ttf / .otf bytes (X-Font-File: its name), 404 when not here
//   POST /api/fonts/install?name=<file>    (2.617.0) the font's bytes -> <install>/fonts (lib/fontInstall.js) {name, family, existed}
"use strict";
const path = require("path");
const fontFiles = require("../lib/fontFiles");
function mount(app) {
  // 2.617.0: a .ttf / .otf into the studio's own font folder (<install>/fonts - lib/fontInstall.js): the text effect
  // zips bring their fonts with them (static/textfx.js importZip)
  app.post("/api/fonts/install", require("express").raw({ type: () => true, limit: "41mb" }), (req, res) => {
    try { res.json(Object.assign({ ok: true }, require("../lib/fontInstall").install((req.query || {}).name, req.body))); }
    catch (e) { res.status(e.status || 500).json({ ok: false, error: e.message }); }
  });
  app.get("/api/fonts", (_req, res) => { try { res.json({ families: fontFiles.families() }); } catch (e) { res.status(500).json({ error: e.message }); } });
  app.get("/api/fonts/file", (req, res) => {
    try {
      const q = req.query || {};
      const f = fontFiles.find(q.family, q.bold === "1" || q.bold === "true", q.italic === "1" || q.italic === "true");
      if (!f) return res.status(404).json({ error: "no font file for " + q.family });
      res.set("X-Font-File", encodeURIComponent(path.basename(f.file)));
      res.type(/\.otf$/i.test(f.file) ? "font/otf" : "font/ttf").sendFile(f.file);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
}
module.exports = { mount };
