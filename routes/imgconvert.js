// bitGen Studio — routes/imgconvert.js (2.485.0): picture formats made on this computer (lib/imgConvert.js).
// Mounted from routes/index.js (never server.js).
//   GET  /api/imgconvert/caps           {avif, encoder}
//   POST /api/imgconvert/avif?q=80      body: the PNG (application/octet-stream)  →  image/avif
"use strict";
const conv = require("../lib/imgConvert");

function mount(app) {
  const express = require("express");
  const fail = (res, e) => res.status(e.status || 500).json({ error: String((e && e.message) || e) });
  app.get("/api/imgconvert/caps", (_req, res) => { try { res.json(conv.caps()); } catch (e) { fail(res, e); } });
  app.post("/api/imgconvert/avif", express.raw({ type: () => true, limit: conv.MAX }), (req, res) => {
    try { const out = conv.toAvif(req.body, req.query.q); res.set("Content-Type", "image/avif").send(out); } catch (e) { fail(res, e); }
  });
}
module.exports = { mount };
