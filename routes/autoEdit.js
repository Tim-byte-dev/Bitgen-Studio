// bitGen Studio — routes/autoEdit.js (2.894.0): ✨ Auto edit on the timeline (lib/autoEdit.js). Mounted from routes/index.js.
//   POST /api/autoedit/plan {assets, beats, tempo, total, brief, feel, titles, cards, llm} -> {plan, grid, by, assets}
//   POST /api/autoedit/base {W, H, dur} -> {name, dur}   the black base clip for V1 (⚙ Compile needs one)
"use strict";
const express = require("express");
function mount(app) {
  const J = express.json({ limit: "2mb" });
  app.post("/api/autoedit/plan", J, async (req, res) => {
    try { res.json(Object.assign({ ok: true }, await require("../lib/autoEdit").plan(req.body || {}))); }
    catch (e) { res.status(e.status || 500).json({ ok: false, error: e.message || String(e) }); }
  });
  app.post("/api/autoedit/base", J, async (req, res) => {
    try { res.json(Object.assign({ ok: true }, await require("../lib/autoEdit").base(req.body || {}))); }
    catch (e) { res.status(e.status || 500).json({ ok: false, error: e.message || String(e) }); }
  });
}
module.exports = { mount };
