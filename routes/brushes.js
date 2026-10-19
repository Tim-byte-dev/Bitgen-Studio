// bitGen Studio — routes/brushes.js (2.484.0): the image editor's brush presets (lib/brushStore.js:
// <install>/brushes/<name>.json). Mounted from routes/index.js (never server.js).
//   GET  /api/brushes                     {brushes: [{name, preset}]}
//   POST /api/brushes/save {name, preset} {name, size}   (the JSON as text/plain - big sampled tips)
//   POST /api/brushes/delete {name}       {removed}
"use strict";
const store = require("../lib/brushStore");

function mount(app) {
  const express = require("express");
  const fail = (res, e) => res.status(e.status || 500).json({ error: String((e && e.message) || e) });
  app.get("/api/brushes", (_req, res) => { try { res.json({ brushes: store.list() }); } catch (e) { fail(res, e); } });
  // sent as text/plain: a sampled brush is bigger than the app-wide JSON parser's 100 kB
  app.post("/api/brushes/save", express.text({ type: () => true, limit: store.MAX + 1024 }), (req, res) => {
    try { const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}); res.json(store.save(b.name, b.preset)); } catch (e) { fail(res, e.status ? e : Object.assign(e, { status: 400 })); }
  });
  app.post("/api/brushes/delete", express.json(), (req, res) => { try { res.json(store.remove((req.body || {}).name)); } catch (e) { fail(res, e); } });
}
module.exports = { mount };
