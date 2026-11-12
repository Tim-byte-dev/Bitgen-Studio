// bitGen Studio — routes/remoteLlm.js (2.768.0): the prompt docker's LLM / Vision lists in remote mode (lib/remoteLlm.js).
//   GET  /api/remotellm         {llm, vlm}: each {kind, host ("" = this computer's list), label, models: [{id, name, note}],
//                               current, note, fixed?, error?}
//   POST /api/remotellm/pick    {kind: "llm" | "vlm", id} -> {ok, host, current}
"use strict";
function mount(app) {
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: String((e && e.message) || e) }); } };
  const RL = () => require("../lib/remoteLlm");
  app.get("/api/remotellm", wrap(() => RL().lists()));
  app.post("/api/remotellm/pick", wrap((req) => { const b = req.body || {}; return RL().pick(b.kind, b.id); }));
}
module.exports = { mount };
