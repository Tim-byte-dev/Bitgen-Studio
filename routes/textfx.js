// bitGen Studio — routes/textfx.js (2.411.0): the text effect presets (lib/textFx.js). Mounted from routes/index.js (never
// server.js).
//   GET    /api/textfx/presets               {presets}   built in (from PSD text effects) + your imports
//   POST   /api/textfx/presets  {preset}     -> {id, preset}  an imported PSD text effect (static/textfx.js fromPsd)
//   POST   /api/textfx/presets/:id/rename {name}
//   DELETE /api/textfx/presets/:id           your imports only
"use strict";
const express = require("express");
const tfx = require("../lib/textFx");

function mount(app) {
  const J = express.json({ limit: "8mb" });
  const fail = (res, e) => res.status(e.status || 500).json({ ok: false, error: String((e && e.message) || e) });
  app.get("/api/textfx/presets", (_req, res) => { try { res.json({ ok: true, presets: tfx.list() }); } catch (e) { fail(res, e); } });
  app.post("/api/textfx/presets", J, (req, res) => {
    try { const p = tfx.save((req.body || {}).preset); res.json({ ok: true, id: p.id, preset: p }); } catch (e) { fail(res, e); }
  });
  app.post("/api/textfx/presets/:id/rename", J, (req, res) => {
    try { res.json({ ok: true, preset: tfx.rename(req.params.id, (req.body || {}).name) }); } catch (e) { fail(res, e); }
  });
  app.delete("/api/textfx/presets/:id", (req, res) => { try { tfx.remove(req.params.id); res.json({ ok: true }); } catch (e) { fail(res, e); } });
}

module.exports = { mount };
