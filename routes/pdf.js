// bitGen Studio — the image editor's PDF files in the project (2.424.0). Mounted from routes/index.js (never server.js);
// the work is lib/pdfStore.js. The PDF itself is read / written in the page (ext/imageeditdock/pcpdf.js + pdf.js /
// pdf-lib from static/vendor).
//
//   POST /api/pdf/save?name=<n>.pdf   the bytes (application/octet-stream) -> {name, size}
//   GET  /api/pdf/list                {files: [{name, size, mtime}]}
//   GET  /api/pdf/file/:name          the file
"use strict";
const express = require("express");
const pdfStore = require("../lib/pdfStore");

function mount(app) {
  app.post("/api/pdf/save", express.raw({ type: () => true, limit: pdfStore.MAX }), (req, res) => {
    try { res.json(pdfStore.save(req.query.name, req.body)); } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
  app.get("/api/pdf/list", (_req, res) => res.json({ files: pdfStore.list() }));
  app.get("/api/pdf/file/:name", (req, res) => {
    try { res.type("application/pdf").sendFile(pdfStore.file(req.params.name)); } catch (e) { res.status(e.status || 404).json({ error: e.message }); }
  });
}

module.exports = { mount };
