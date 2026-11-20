// routes/cardStocks.js — 2.896.0: 📇 the label / card stocks the user types for the image editor's Business Card Sheet
// (lib/cardStocks.js -> <install>/business/card_stocks.json). Mounted from routes/index.js (never server.js).
//   GET    /api/cardstocks        {stocks: [{id, name, paper: {w, h}, cols, rows, cw, ch, top, left, hpitch, vpitch}]}
//   POST   /api/cardstocks        {stock} -> the kept stock (the same name replaces it; a wrong size -> 400 with why)
//   DELETE /api/cardstocks/:id    {ok}
"use strict";
const express = require("express");
function mount(app) {
  const S = () => require("../lib/cardStocks");
  const wrap = (fn) => (req, res) => { try { res.json(fn(req)); } catch (e) { res.status(e.status || 500).json({ error: e.message || String(e) }); } };
  app.get("/api/cardstocks", wrap(() => S().list()));
  app.post("/api/cardstocks", express.json({ limit: "64kb" }), wrap((req) => S().save((req.body || {}).stock || {})));
  app.delete("/api/cardstocks/:id", wrap((req) => ({ ok: S().remove(req.params.id) })));
}
module.exports = { mount };
