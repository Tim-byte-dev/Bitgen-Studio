// bitGen Studio — routes/mediaMeta.js (2.575.0): what a picture / video / song was made with (lib/mediaMeta.js).
// Mounted from routes/index.js (never server.js).
//   GET  /api/media-meta?src=output|images|video|sound&name=   {meta, from} | 404   (a project file by name)
//   POST /api/media-meta  multipart {file}                       {meta, from} | 404   (a References picture - a blob)
// Tim: "add a button for the prompt from metadata to send to prompt - this will use the seed, cfg and steps of the
// image/video/music (do this for gallery,assets and reference too)" - static/usemeta.js asks here.
"use strict";
const M = require("../lib/mediaMeta");

function mount(app) {
  const fs = require("fs"), os = require("os"), path = require("path");
  let up = null;
  const upload = () => { if (!up) up = require("multer")({ dest: os.tmpdir(), limits: { fileSize: 512 * 1024 * 1024, files: 1 } }).single("file"); return up; };
  app.get("/api/media-meta", (req, res) => {
    try {
      const name = String(req.query.name || "").trim();
      if (!name) return res.status(400).json({ error: "name is required" });
      const hit = M.lookup({ src: String(req.query.src || "output"), name });
      if (!hit || !hit.meta || !Object.keys(hit.meta).length) return res.status(404).json({ error: "no prompt or settings found in " + path.basename(name) });
      res.json({ name: path.basename(name), ...hit });
    } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
  });
  app.post("/api/media-meta", (req, res) => {
    upload()(req, res, (err) => {
      if (err) return res.status(400).json({ error: String(err.message || err) });
      const f = req.file;
      if (!f) return res.status(400).json({ error: "no file" });
      try {
        // the reader goes by the extension - the temp file has none
        const ext = path.extname(String(f.originalname || "")).toLowerCase() || (/png/.test(f.mimetype || "") ? ".png" : "");
        const p = f.path + ext; fs.renameSync(f.path, p);
        try {
          // a picture this app made (dragged from the gallery into References) - its job record by name first
          const hit = M.lookup({ src: "output", name: f.originalname }) || (() => { const m = M.read(p); return m ? { meta: m, from: m.from || "file" } : null; })();
          if (!hit || !hit.meta || !Object.keys(hit.meta).length) return res.status(404).json({ error: "no prompt or settings found in " + (f.originalname || "that file") });
          res.json({ name: f.originalname || "", ...hit });
        } finally { fs.unlink(p, () => {}); }
      } catch (e) { fs.unlink(f.path, () => {}); res.status(500).json({ error: String((e && e.message) || e) }); }
    });
  });
}
module.exports = { mount };
