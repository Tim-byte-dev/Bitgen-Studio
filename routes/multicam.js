// bitGen Studio — routes/multicam.js (2.416.0): 🎥 MULTI-CAMERA's server side (lib/multicam.js). Mounted from
// routes/index.js (never server.js).
//   POST /api/multicam/sync {names: [reference, other ...]} -> {results: [{name, lag, score, ok, why}]}
"use strict";
const multicam = require("../lib/multicam");

function mount(app) {
  const express = require("express");
  const J = express.json({ limit: "1mb" });
  app.post("/api/multicam/sync", J, (req, res) => {
    let p;
    try { p = multicam.sync((req.body || {}).names); } catch (e) { p = Promise.reject(e); }
    p.then((r) => res.json(Object.assign({ ok: true }, r)))
      .catch((e) => res.status(e.status || 500).json({ ok: false, error: String((e && e.message) || e) }));
  });
}

module.exports = { mount };
