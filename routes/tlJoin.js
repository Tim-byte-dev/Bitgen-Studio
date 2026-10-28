// bitGen Studio — routes/tlJoin.js (2.612.0): a cut clip's parts joined into ONE file (lib/tlJoin.js). Mounted from routes/index.js.
//   POST /api/timeline/join   {kind: "video" | "audio", name, src, parts: [[in, out], ...]} -> {name, dur, src?}
"use strict";
const tlJoin = require("../lib/tlJoin");

function mount(app) {
  const express = require("express");
  app.post("/api/timeline/join", express.json(), async (req, res) => {
    try { res.json(await tlJoin.join(req.body || {})); }
    catch (e) { res.status(e.status || 500).json({ error: String((e && e.message) || e) }); }
  });
}
module.exports = { mount };
