// bitGen Studio — routes/apis.js (2.757.0): Settings ▸ API (static/apis.js, lib/apis.js). Mounted from routes/index.js.
//   GET    /api/apis                {apis: [view - never a key], services: [...]}
//   POST   /api/apis                {name, service|"auto", key, use?, base?}   -> {api, styles}
//   POST   /api/apis/:id            {use?, llm?, name?, key?, base?, models?}  -> {api, styles} (Use = its API_ styles)
//   POST   /api/apis/:id/test       {ok, line | error}
//   DELETE /api/apis/:id            {ok} (its API_ styles go with it)
"use strict";
const A = require("../lib/apis");

function mount(app) {
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: String((e && e.message) || e) }); } };
  app.get("/api/apis", wrap(() => A.list()));
  app.post("/api/apis", wrap((req) => A.add(req.body || {})));
  app.post("/api/apis/:id/test", wrap((req) => A.test(req.params.id)));
  app.post("/api/apis/:id", wrap((req) => A.change(req.params.id, req.body || {})));
  app.delete("/api/apis/:id", wrap((req) => A.remove(req.params.id)));
}
module.exports = { mount };
