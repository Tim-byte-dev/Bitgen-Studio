// bitGen Studio — the image editor's desktop-publishing exports in the project (2.799.0). Mounted from routes/index.js
// (never server.js); the work is lib/dtpStore.js. The files are written in the page (ext/imageeditdock/pcdtpout.js).
//
//   POST /api/dtp/save?name=<n>.pdf|.ai|.svg|.zip   the bytes (application/octet-stream) -> {name, size}
//   GET  /api/dtp/list                              {files: [{name, size, mtime}]}
//   GET  /api/dtp/file/:name                        the file
"use strict";
const express = require("express");
const path = require("path");
const dtpStore = require("../lib/dtpStore");
const TYPES = { ".pdf": "application/pdf", ".ai": "application/postscript", ".svg": "image/svg+xml", ".zip": "application/zip" };

function mount(app) {
  app.post("/api/dtp/save", express.raw({ type: () => true, limit: dtpStore.MAX }), (req, res) => {
    try { res.json(dtpStore.save(req.query.name, req.body)); } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
  app.get("/api/dtp/list", (_req, res) => res.json({ files: dtpStore.list() }));
  app.get("/api/dtp/file/:name", (req, res) => {
    try { const p = dtpStore.file(req.params.name); res.type(TYPES[path.extname(p).toLowerCase()] || "application/octet-stream").sendFile(p); } catch (e) { res.status(e.status || 404).json({ error: e.message }); }
  });
}

module.exports = { mount };
