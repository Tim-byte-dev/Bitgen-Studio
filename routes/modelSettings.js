// bitGen Studio — routes/modelSettings.js (2.680.0): GET / POST /api/model-settings - the prompt docker's ⇄ (the current and
// previous settings of each model type) in <app>/model_settings.tmp (lib/modelSettings.js). Mounted from routes/index.js.
"use strict";
function mount(app) {
  const MS = () => require("../lib/modelSettings");
  app.get("/api/model-settings", (req, res) => res.json(MS().read()));
  app.post("/api/model-settings", (req, res) => {
    try { res.json(MS().write((req.body || {}).settings || req.body || {})); } catch (e) { res.status(500).json({ error: e.message }); }
  });
}
module.exports = { mount };
