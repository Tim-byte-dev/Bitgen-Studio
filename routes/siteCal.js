// bitGen Studio — routes/siteCal.js (2.846.0): 📅 a web project's booking calendar in its database (lib/siteCal.js).
//   POST /api/sitecal/install  {cal}   the tables + this calendar's row and opening hours
//   POST /api/sitecal/bookings {cal}   its bookings from today on
"use strict";
const express = require("express");
function mount(app) {
  const L = () => require("../lib/siteCal");
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: e.message || String(e) }); } };
  const J = express.json({ limit: "1mb" });
  app.post("/api/sitecal/install", J, wrap((req) => L().install((req.body || {}).cal)));
  app.post("/api/sitecal/bookings", J, wrap((req) => L().bookings((req.body || {}).cal)));
}
module.exports = { mount };
