// bitGen Studio — BRIDGE SCENES (2.358.0). Mounted by routes/index.js (never server.js); the logic is
// lib/sceneBridge.js, the staging lib/segBoard.js (POST /api/scenes/from-segments {gap, gap_type}), the
// render routes/characters.js queueScene (AI = fl2va on the native-audio board, else bridge_worker.py).
//
//   GET  /api/bridge/types          the bridge types: AI (fl2va) + the timeline's transitions
//   POST /api/scenes/:n/bridge      {type, project} - change one bridge's type (the card's picker)
const scenes = require("../lib/scenes");
const sceneBridge = require("../lib/sceneBridge");

function mount(app) {
  app.get("/api/bridge/types", (_req, res) => res.json({
    types: sceneBridge.types(), ai: sceneBridge.AI,
    gap: { min: sceneBridge.GAP_MIN, max: sceneBridge.GAP_MAX, default: 0.5 } }));
  app.post("/api/scenes/:n/bridge", (req, res) => {
    const b = req.body || {};
    try {
      const r = sceneBridge.setType(scenes.load(b.project), req.params.n, b.type);
      if (r.error) return res.status(r.status || 400).json({ error: r.error });
      if (r.changed) scenes.save(r.state, b.project);
      const t = sceneBridge.types().find((x) => x.id === r.row.bridge.type) || {};
      res.json({ ok: true, changed: r.changed, n: r.row.n, bridge: r.row.bridge,
                 note: `scene ${r.row.n} bridges with ${t.label || r.row.bridge.type}`
                   + (r.changed ? " - ▶ renders it" : "") });
    } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
}

module.exports = { mount };
