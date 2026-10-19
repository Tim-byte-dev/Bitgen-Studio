// bitGen Studio — routes/layerBake.js (2.490.0): baked timeline layers (lib/layerBake.js). Mounted from routes/index.js.
//   POST /api/tlbake/frame?id=&i=   raw PNG -> one frame (frame 0 starts the bake afresh)
//   POST /api/tlbake/encode         {id, fps, frames, lossless?} -> video/tlb_<id>.webm {name, dur, frames} (2.505.0: lossless = a data video)
"use strict";
const bake = require("../lib/layerBake");

function mount(app) {
  const express = require("express");
  const fail = (res, e) => res.status(e.status || 500).json({ error: String((e && e.message) || e) });
  app.post("/api/tlbake/frame", express.raw({ type: () => true, limit: 24 * 1024 * 1024 }), (req, res) => {
    try { res.json(bake.saveFrame(req.query.id, req.query.i, req.body)); } catch (e) { fail(res, e); }
  });
  app.post("/api/tlbake/encode", express.json(), async (req, res) => {
    try { const b = req.body || {}; res.json(await bake.encode(b.id, b)); } catch (e) { fail(res, e); }
  });
}
module.exports = { mount };
