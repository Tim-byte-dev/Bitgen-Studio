// routes/cardStocks.js — 2.896.0: 📇 the label / card stocks the user types for the image editor's Business Card Sheet
// (lib/cardStocks.js -> <install>/business/card_stocks.json). 2.898.0: kept in the same database as the business details when
// they are (lib/businessDb.js - the file then this computer's copy; a list syncs first, a save / delete goes there).
// Mounted from routes/index.js (never server.js).
//   GET    /api/cardstocks        {stocks: [{id, name, paper: {w, h}, cols, rows, cw, ch, top, left, hpitch, vpitch}], store}
//   POST   /api/cardstocks        {stock} -> the kept stock (the same name replaces it; a wrong size -> 400 with why) + store
//   DELETE /api/cardstocks/:id    {ok, store}
"use strict";
const express = require("express");
function mount(app) {
  const S = () => require("../lib/cardStocks"), BD = () => require("../lib/businessDb");
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: e.sqlMessage || e.message || String(e) }); } };
  const withStore = (out, r) => Object.assign(out, { store: Object.assign(BD().status(), r && !r.ok ? { offline: r.offline } : {}, r && r.notes && r.notes.length ? { notes: r.notes } : {}) });
  app.get("/api/cardstocks", wrap(async () => { const r = await BD().sync(); return withStore(S().list(), r); }));
  app.post("/api/cardstocks", express.json({ limit: "64kb" }), wrap(async (req) => {
    const st = S().save((req.body || {}).stock || {}), r = await BD().changed("stock-save", st.id);
    // after a sync the database's copy is this computer's (the same name there = its id)
    const now = S().list().stocks.find((x) => x.name.toLowerCase() === st.name.toLowerCase()) || st;
    return withStore(Object.assign({}, now), r);
  }));
  app.delete("/api/cardstocks/:id", wrap(async (req) => { const ok = S().remove(req.params.id); const r = await BD().changed("stock-remove", req.params.id); return withStore({ ok }, r); }));
}
module.exports = { mount };
