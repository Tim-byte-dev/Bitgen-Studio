// bitGen Studio — the image editor's CAD files (2.464.0): sketch layers as .dxf / .svg in the project. Mounted from
// routes/index.js (never server.js); the work is lib/cadStore.js. The files are written / read in the page
// (ext/imageeditdock/pcsketchcad.js + pcsketchcadui.js).
//
//   POST /api/cad/save?name=<n>.dxf|.svg   the text -> {name, size}
//   GET  /api/cad/list[?ext=dxf|svg]       {files: [{name, size, mtime}]}
//   GET  /api/cad/file/:name               the file
"use strict";
const express = require("express");
const cadStore = require("../lib/cadStore");

function mount(app) {
  app.post("/api/cad/save", express.text({ type: () => true, limit: cadStore.MAX }), (req, res) => {
    try { res.json(cadStore.save(req.query.name, req.body)); } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
  app.get("/api/cad/list", (req, res) => res.json({ files: cadStore.list(req.query.ext) }));
  app.get("/api/cad/file/:name", (req, res) => {
    try { const p = cadStore.file(req.params.name); res.type(cadStore.extOf(p) === "svg" ? "image/svg+xml" : "application/dxf").sendFile(p); } catch (e) { res.status(e.status || 404).json({ error: e.message }); }
  });
}

module.exports = { mount };
