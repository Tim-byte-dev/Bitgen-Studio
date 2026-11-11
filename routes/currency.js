// bitGen Studio — routes/currency.js (2.760.0): Settings ▸ General ▸ Currency (lib/currency.js, static/currency.js).
//   GET  /api/currency           {code, rate, source, date, codes, manual, rates} - stale rates are fetched again
//   POST /api/currency           {code?, manual?}  -> the same (manual = the typed rate for the picked code, "" = fetched)
//   POST /api/currency/refresh   {ok, date | error} -> fetch the day's rates now
"use strict";
const C = require("../lib/currency");

function mount(app) {
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: String((e && e.message) || e) }); } };
  app.get("/api/currency", wrap(() => C.get()));
  app.post("/api/currency/refresh", wrap(async () => Object.assign(await C.refresh(), { view: C.view() })));
  app.post("/api/currency", wrap((req) => C.set(req.body || {})));
}
module.exports = { mount };
