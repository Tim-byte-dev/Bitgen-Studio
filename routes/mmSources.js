// bitGen Studio — routes/mmSources.js (2.790.0): 🧩 Model manager's cards from RunPod and OpenRouter (lib/mmSources.js) - the page
// merges them with this computer's (GET /api/modelmgr/cards?local=1) and filters by ☐ Local ☐ RunPod ☐ OpenRouter (static/mmsrc.js).
//   GET  /api/modelmgr/sources?src=runpod|openrouter   {models, loras, source}
//   POST /api/modelmgr/sources/remove {key}            a RunPod / OpenRouter card taken off its list -> {ok, said}
"use strict";
const MS = require("../lib/mmSources");

function mount(app) {
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: String((e && e.message) || e) }); } };
  app.get("/api/modelmgr/sources", wrap((req) => {
    const s = String(req.query.src || "");
    if (s === "runpod") return Object.assign(MS.runpod(), { source: s });
    if (s === "openrouter") return Object.assign(MS.openrouter(), { source: s });
    throw Object.assign(new Error("src must be runpod or openrouter (this computer's: /api/modelmgr/cards?local=1)"), { status: 400 });
  }));
  app.post("/api/modelmgr/sources/remove", wrap((req) => MS.remove((req.body || {}).key)));
}
module.exports = { mount };
