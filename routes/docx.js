// bitGen Studio — .docx out of / into the image editor's document text (2.814.0). Mounted from routes/index.js (never
// server.js); the work is lib/docxFiles.js, the page side ext/imageeditdock/pcdocx.js.
//
//   POST /api/docx/export?name=<n>   {model} (JSON) -> the .docx written to projects/<p>/docs -> {name, size, url}
//   POST /api/docx/import            the .docx bytes -> {html, messages}
//   GET  /api/docx/list              {files: [{name, size, mtime}]}
//   GET  /api/docx/file/:name        the file
"use strict";
const express = require("express");
const docx = require("../lib/docxFiles");

function mount(app) {
  app.post("/api/docx/export", express.json({ limit: "50mb" }), async (req, res) => {
    try {
      const buf = await docx.build(req.body && req.body.model);
      const r = docx.save(req.query.name || (req.body && req.body.name) || "document", buf);
      res.json(Object.assign(r, { url: "/api/docx/file/" + encodeURIComponent(r.name) }));
    } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
  app.post("/api/docx/import", express.raw({ type: () => true, limit: docx.MAX }), async (req, res) => {
    try { res.json(await docx.read(req.body)); } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
  app.get("/api/docx/list", (_req, res) => res.json({ files: docx.list() }));
  app.get("/api/docx/file/:name", (req, res) => {
    try { res.type("application/vnd.openxmlformats-officedocument.wordprocessingml.document").sendFile(docx.file(req.params.name)); } catch (e) { res.status(e.status || 404).json({ error: e.message }); }
  });
}

module.exports = { mount };
