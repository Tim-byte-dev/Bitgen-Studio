// bitGen Studio — routes/cardUse.js (2.794.0): Settings ▸ General ☐ "Offload to CPU / RAM when a model does not fit" (lib/cardUse.js).
//   GET  /api/carduse              {offload, picks: rgpu.local_cards}
//   POST /api/carduse/offload {on} {offload, picks, note} - the LLM / vision LLM start again with the next prompt; a card's ComfyUI
//                                  with its next start (stopped now, so the next render starts it the new way)
"use strict";
const CU = require("../lib/cardUse");

function mount(app) {
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: String((e && e.message) || e) }); } };
  app.get("/api/carduse", wrap(async () => CU.view()));
  app.post("/api/carduse/offload", wrap(async (req) => {
    const on = CU.setOffload(!!(req.body || {}).on);
    try { require("../lib/gpuCards").stopAll(); } catch { /* none running */ }
    return Object.assign(CU.view(), { note: on
      ? "Offload is on - a model that does not fit its card keeps the rest in RAM (slower, never refused)"
      : "Offload is off - everything on the card; a model that does not fit is refused with what it needs. bitGen's ComfyUI takes it at its next start (⟳ Restart ComfyUI)" });
  }));
}
module.exports = { mount };
