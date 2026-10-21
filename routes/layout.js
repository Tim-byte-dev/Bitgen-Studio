// bitGen Studio — routes/layout.js (2.438.0): window positions (lib/layoutCfg.js). Mounted from routes/index.js.
//   GET  /api/layout/:name          the object (name = dialog | panel | basic | folders - 2.559.0)
//   POST /api/layout/:name          {set: {key: value | null}} merged, or {all: {...}} replaced -> the object
"use strict";
const store = require("../lib/layoutCfg");

function mount(app) {
  const express = require("express");
  const fail = (res, e) => res.status(e.status || 500).json({ error: String((e && e.message) || e) });
  app.get("/api/layout/:name", (req, res) => { try { res.json(store.read(req.params.name)); } catch (e) { fail(res, e); } });
  app.post("/api/layout/:name", express.json({ limit: "1mb" }), (req, res) => {
    try { const b = req.body || {}; res.json(b.all ? store.write(req.params.name, b.all) : store.merge(req.params.name, b.set || {})); } catch (e) { fail(res, e); }
  });
}

module.exports = { mount };
