// bitGen Studio — routes/createAi.js (2.849.0): ✨ Create With the AI (lib/createAi.js). Mounted from routes/index.js.
//   POST /api/create/plan {kind: flyer | brochure | card | website, ask} -> {plan}   the words, colours and picture ideas
"use strict";
const express = require("express");
function mount(app) {
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: e.message || String(e) }); } };
  app.post("/api/create/plan", express.json({ limit: "1mb" }), wrap((req) => require("../lib/createAi").plan(req.body || {})));
}
module.exports = { mount };
