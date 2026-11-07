// bitGen Studio — routes/vram16.js (2.708.0): 16 GB mode's status for Settings ▸ ComfyUI (lib/vram16.js).
//   GET /api/vram16   {mode, scale, turbo, items, packs, ready, note, card: [{name, total GB}]}
// Tim: "this workflow is meant to work with 16gb vram - minimax"
"use strict";
const V = require("../lib/vram16");

function mount(app) {
  app.get("/api/vram16", async (_req, res) => {
    try {
      const st = V.status();
      let card = [];
      try { const c = require("../lib/comfy"); card = (await c.vram(c.comfyCfg().url)).map((d) => ({ name: d.name, gb: Math.round(d.total / 2 ** 30 * 10) / 10 })); } catch (e) { card = []; }
      res.json(Object.assign(st, { card }));
    } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
}
module.exports = { mount };
