// bitGen Studio — routes/solar.js (2.588.0): SolarRenderer's workflows for Settings ▸ ComfyUI ▸ Graphs ▸ ☀ SolarRenderer
// (lib/solarAddon.js). The page reads one and sends it through ⤒ Import & check (routes/graphCheck.js) like a file.
//   GET /api/solar                 {installed, pack, note, workflows: [{file, name, size}]}
//   GET /api/solar/workflow?file=  {name, graph}   the pack's workflow (JSON)
"use strict";
const S = require("../lib/solarAddon");

function mount(app) {
  app.get("/api/solar", (_q, res) => {
    try { const st = S.status(); res.json({ installed: st.installed, pack: st.pack, note: st.note, workflows: st.pack ? S.workflows() : [] }); }
    catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
  app.get("/api/solar/workflow", (q, res) => {
    try {
      const w = S.readWorkflow(String(q.query.file || ""));
      let graph; try { graph = JSON.parse(w.text); } catch (e) { return res.status(400).json({ error: `${w.name} is not JSON: ${e.message}` }); }
      res.json({ name: w.name, graph });
    } catch (e) { res.status(e.status || 500).json({ error: String(e.message || e) }); }
  });
}

module.exports = { mount };
