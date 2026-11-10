// bitGen Studio — routes/openRouter.js (2.753.0): OpenRouter (lib/openRouter.js) - Settings ▸ Remote generation ▸ 🧠 LLM.
// Mounted from routes/index.js.
//   GET  /api/openrouter                      {key, model, vlm_model, free_only, provider, ready}
//   POST /api/openrouter   {key?, model?, vlm_model?, free_only?, provider?: "runpod"|"openrouter"}   save (the key encrypted)
//   GET  /api/openrouter/models?free=1&vision=1&refresh=1   {models: [{id, name, free, vision, ctx, in, out}], total}
//   POST /api/openrouter/test  {kind: llm|vlm}  the key + the model
"use strict";
const O = require("../lib/openRouter");

function mount(app) {
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 502).json({ error: String((e && e.message) || e) }); } };
  app.get("/api/openrouter", wrap(() => O.view()));
  app.post("/api/openrouter", wrap((req) => O.save(req.body || {})));
  app.get("/api/openrouter/models", wrap((req) => O.list({ free: req.query.free === "1", vision: req.query.vision === "1", refresh: req.query.refresh === "1" })));
  app.post("/api/openrouter/test", wrap((req) => O.test(String((req.body || {}).kind || "llm") === "vlm" ? "vlm" : "llm")));
}
module.exports = { mount };
