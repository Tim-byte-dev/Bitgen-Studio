// bitGen Studio — linked smart objects' files (2.469.0), projects/<p>/linked. Mounted from routes/index.js (never
// server.js); the work is lib/linkedStore.js; the page side is ext/imageeditdock/pclinked.js.
//   POST /api/linked/save?name=<n>   PNG / JPEG bytes -> {name, size, mtime}
//   GET  /api/linked/list            {files: [{name, size, mtime}]}
//   GET  /api/linked/stat?names=a,b  {mtimes: {name: mtime | 0}}
//   GET  /api/linked/file/:name      the picture (no cache)
"use strict";
const express = require("express");
const linkedStore = require("../lib/linkedStore");

function mount(app) {
  app.post("/api/linked/save", express.raw({ type: () => true, limit: linkedStore.MAX }), (req, res) => {
    try { res.json(linkedStore.save(req.query.name, req.body)); } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
  app.get("/api/linked/list", (_req, res) => res.json({ files: linkedStore.list() }));
  app.get("/api/linked/stat", (req, res) => res.json({ mtimes: linkedStore.stat(String(req.query.names || "").split(",").filter(Boolean)) }));
  app.get("/api/linked/file/:name", (req, res) => {
    try { res.set("Cache-Control", "no-store"); res.sendFile(linkedStore.file(req.params.name)); } catch (e) { res.status(e.status || 404).json({ error: e.message }); }
  });
}
module.exports = { mount };
