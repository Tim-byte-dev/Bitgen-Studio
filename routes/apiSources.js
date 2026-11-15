// bitGen Studio — routes/apiSources.js (2.795.0): 🧩 Model manager ▸ ＋ Add source (lib/apiSources.js).
//   GET    /api/sources                      {sources (no keys), formats, use, kinds}
//   POST   /api/sources {name?, format?}     a new source (its tab) -> {..., id}
//   POST   /api/sources/test {id?, format, url, key, list_tpl, chat_tpl, auth}   ✓ Test in the ⚙ dialog -> {count, sample, endpoint}
//   GET    /api/sources/mine                 every source's models of yours + the picks (the prompt docker's lists)
//   POST   /api/sources/use {kind, source, model}   the LLM / Vision LLM pick (no source = cleared)
//   POST   /api/sources/:id {name, format, url, key, ...}   ⚙ Save (an empty key keeps the one kept)
//   DELETE /api/sources/:id
//   GET    /api/sources/:id/models?refresh=1  the API's models (each with its kind guess + the endpoint filled in)
//   POST   /api/sources/:id/mine {model, kind, add}   ＋ / 🗑
"use strict";
const AS = require("../lib/apiSources");

function mount(app) {
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: String((e && e.message) || e) }); } };
  app.get("/api/sources", wrap(async () => AS.list()));
  app.post("/api/sources", wrap(async (req) => AS.add(req.body || {})));
  app.post("/api/sources/test", wrap(async (req) => AS.test(req.body || {})));
  app.get("/api/sources/mine", wrap(async () => AS.mine()));
  app.post("/api/sources/use", wrap(async (req) => { const b = req.body || {}; return AS.use(String(b.kind || ""), b.source ? String(b.source) : "", String(b.model || "")); }));
  app.post("/api/sources/:id", wrap(async (req) => AS.update(req.params.id, req.body || {})));
  app.delete("/api/sources/:id", wrap(async (req) => AS.remove(req.params.id)));
  app.get("/api/sources/:id/models", wrap(async (req) => AS.models(req.params.id, req.query.refresh === "1")));
  app.post("/api/sources/:id/mine", wrap(async (req) => AS.setMine(req.params.id, req.body || {})));
}
module.exports = { mount };
