// bitGen Studio — routes/gpuCards.js (2.791.0): this computer's graphics cards for ☁ Runs on ▸ "Local - <card>" (lib/gpuCards.js).
//   GET  /api/gpucards            {cards: [{index, name, vram_mb}], picks: rgpu.local_cards, procs: {N: {phase, note, port}}}
//   POST /api/gpucards/stop       stops the per-card ComfyUIs bitGen started (they start again with the next render)
"use strict";
const GC = require("../lib/gpuCards");

function mount(app) {
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: String((e && e.message) || e) }); } };
  app.get("/api/gpucards", wrap(async () => ({ cards: await GC.list(), picks: (((require("../lib/core").getConfig() || {}).rgpu) || {}).local_cards || {}, procs: GC.status() })));
  app.post("/api/gpucards/stop", wrap(() => { GC.stopAll(); return { ok: true }; }));
}
module.exports = { mount };
