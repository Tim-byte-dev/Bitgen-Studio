// bitGen Studio — routes/patterns.js (2.437.0): the image editor's pattern library (lib/patternStore.js:
// <install>/patterns/<name>.png). Mounted from routes/index.js (never server.js).
//   GET  /api/patterns                     {patterns: [{name, w, h, size, mtime}]}
//   GET  /api/patterns/file/:name          the PNG
//   POST /api/patterns/save?name=<n>       the PNG's bytes -> {name, w, h, size}
//   POST /api/patterns/delete {name}       {removed}
"use strict";
const store = require("../lib/patternStore");

function mount(app) {
  const express = require("express");
  const fail = (res, e) => res.status(e.status || 500).json({ error: String((e && e.message) || e) });
  app.get("/api/patterns", (_req, res) => { try { res.json({ patterns: store.list() }); } catch (e) { fail(res, e); } });
  app.get("/api/patterns/file/:name", (req, res) => { try { res.type("image/png").sendFile(store.file(req.params.name)); } catch (e) { fail(res, e); } });
  app.post("/api/patterns/save", express.raw({ type: () => true, limit: store.MAX }), (req, res) => { try { res.json(store.save(req.query.name, req.body)); } catch (e) { fail(res, e); } });
  app.post("/api/patterns/delete", express.json(), (req, res) => { try { res.json(store.remove((req.body || {}).name)); } catch (e) { fail(res, e); } });
}

module.exports = { mount };
