// bitGen Studio — routes/trackpts.js (2.499.0): 🎯 tracking points / a plane through a clip (lib/trackPoints.js).
// Mounted from routes/index.js.
//   POST /api/track/points {name, from, to, mode: "points" | "planar", pts: [[x, y], ...], box, width}
//     -> {fps, track: [{t, pts}], method, lost, frames}
"use strict";
const tp = require("../lib/trackPoints");

function mount(app) {
  const express = require("express");
  app.post("/api/track/points", express.json({ limit: "64kb" }), async (req, res) => {
    try { res.json(await tp.run(req.body || {})); } catch (e) { res.status(e.status || 500).json({ error: String((e && e.message) || e) }); }
  });
}
module.exports = { mount };
