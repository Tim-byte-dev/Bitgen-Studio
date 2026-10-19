// bitGen Studio — routes/queuePresets.js (2.518.0): the menu bar's ⏱ queue presets (lib/queuePresets.js).
// Mounted from routes/index.js (never server.js).
//   GET  /api/queuepresets            {preset, presets, custom, holding, power, warnings}
//   POST /api/queuepresets  {id, custom?}   pick one (saved in custom.settings) -> {status, power}
"use strict";
const qp = require("../lib/queuePresets");

function mount(app) {
  const fail = (res, e) => res.status(500).json({ error: String((e && e.message) || e) });
  app.get("/api/queuepresets", (_req, res) => { try { res.json(qp.status()); } catch (e) { fail(res, e); } });
  app.post("/api/queuepresets", async (req, res) => {
    try {
      const b = req.body || {};
      if (!qp.PRESETS.some((p) => p.id === String(b.id || ""))) return res.status(400).json({ error: "unknown preset" });
      res.json(await qp.select(String(b.id), b.custom));
    } catch (e) { fail(res, e); }
  });
}
module.exports = { mount };
