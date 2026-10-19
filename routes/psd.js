// bitGen Studio — the image editor's PSD files in the project (2.390.0). Mounted from routes/index.js (never server.js);
// the work is lib/psdStore.js. The PSD itself is read / written in the page (ext/imageeditdock/pcpsd.js + ag-psd).
//
//   POST /api/psd/save?name=<n>.psd   the bytes (application/octet-stream) -> {name, size}
//   GET  /api/psd/list                {files: [{name, size, mtime}]}
//   GET  /api/psd/file/:name          the file
"use strict";
const express = require("express");
const psdStore = require("../lib/psdStore");

function mount(app) {
  app.post("/api/psd/save", express.raw({ type: () => true, limit: psdStore.MAX }), (req, res) => {
    try { res.json(psdStore.save(req.query.name, req.body)); } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
  app.get("/api/psd/list", (_req, res) => res.json({ files: psdStore.list() }));
  app.get("/api/psd/file/:name", (req, res) => {
    try { res.type("application/octet-stream").sendFile(psdStore.file(req.params.name)); } catch (e) { res.status(e.status || 404).json({ error: e.message }); }
  });
}

module.exports = { mount };
