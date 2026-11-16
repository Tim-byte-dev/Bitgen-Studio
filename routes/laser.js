// bitGen Studio — the image editor's laser toolpaths in the project (2.803.0). Mounted from routes/index.js (never
// server.js); the work is lib/laserStore.js. The G-code is written in the page (ext/imageeditdock/pclaser.js).
//
//   POST /api/laser/save?name=<n>.gcode   the G-code (text) -> {name, size}
//   GET  /api/laser/list                  {files: [{name, size, mtime}]}
//   GET  /api/laser/file/:name            the file
"use strict";
const express = require("express");
const laserStore = require("../lib/laserStore");

function mount(app) {
  app.post("/api/laser/save", express.raw({ type: () => true, limit: laserStore.MAX }), (req, res) => {
    try { res.json(laserStore.save(req.query.name, req.body)); } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
  app.get("/api/laser/list", (_req, res) => res.json({ files: laserStore.list() }));
  app.get("/api/laser/file/:name", (req, res) => {
    try { res.type("text/plain").sendFile(laserStore.file(req.params.name)); } catch (e) { res.status(e.status || 404).json({ error: e.message }); }
  });
}

module.exports = { mount };
