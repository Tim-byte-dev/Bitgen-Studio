// routes/layoutRescue.js — 2.891.0: POST /api/layout/rescue {storage, files, why} -> {dir, moved, keys}. The page sends its
// whole browser storage (static/safelayout.js, before it clears it), so this is mounted before the 100 KB json parser with its
// own limit. Mounted from routes/index.js (never server.js). lib/layoutRescue.js does the work.
"use strict";
function mount(app) {
  const express = require("express");
  const core = require("../lib/core");
  app.post("/api/layout/rescue", express.json({ limit: "12mb" }), (req, res) => {
    try { res.json(require("../lib/layoutRescue").rescue(core.BASE, req.body || {})); }
    catch (e) { res.status(500).json({ error: e.message || String(e) }); }
  });
}
module.exports = { mount };
