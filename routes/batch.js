// bitGen Studio — the image editor's BATCH results in the project (2.427.0). Mounted from routes/index.js (never
// server.js); the work is lib/batchStore.js. The actions themselves are played in the page (ext/imageeditdock/pcactions.js).
//
//   POST /api/batch/save?run=<r>&name=<n>   the picture's bytes (PNG / JPEG) -> {run, name, size}
//   GET  /api/batch/runs                    {runs: [{run, files, mtime}]}
//   GET  /api/batch/list?run=<r>            {files: [{name, size, mtime}]}
//   GET  /api/batch/file/:run/:name         the picture
"use strict";
const express = require("express");
const batchStore = require("../lib/batchStore");

function mount(app) {
  app.post("/api/batch/save", express.raw({ type: () => true, limit: batchStore.MAX }), (req, res) => {
    try { res.json(batchStore.save(req.query.run, req.query.name, req.body)); } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
  app.get("/api/batch/runs", (_req, res) => res.json({ runs: batchStore.runs() }));
  app.get("/api/batch/list", (req, res) => res.json({ files: batchStore.list(req.query.run) }));
  app.get("/api/batch/file/:run/:name", (req, res) => {
    try { res.sendFile(batchStore.file(req.params.run, req.params.name)); } catch (e) { res.status(e.status || 404).json({ error: e.message }); }
  });
}

module.exports = { mount };
