// bitGen Studio — routes/comfyDetect.js (2.622.0): the ComfyUI installed on this computer (lib/comfyDetect.js).
// Mounted from routes/index.js (never server.js).
//   GET  /api/comfy/detect[?refresh=1]   {found: {root, main, models, kind, source, configured} | null}
//   POST /api/comfy/detect/use           Settings ▸ ComfyUI ▸ Folder := the one found (the folder ComfyUI launches from)
"use strict";
const core = require("../lib/core");
const CD = require("../lib/comfyDetect");

function mount(app) {
  app.get("/api/comfy/detect", (req, res) => {
    try { res.json({ found: CD.detect({ refresh: req.query.refresh === "1" }) }); } catch (e) { res.json({ found: null, error: String(e.message || e) }); }
  });
  // the gate's browser test: one more folder to look in (refused unless the app runs as the e2e stub)
  app.post("/api/comfy/detect/e2e", require("express").json(), (req, res) => {
    if (process.env.H3_E2E !== "1") return res.status(403).json({ error: "test only" });
    const d = String((req.body || {}).dir || ""); CD.E2E.extra = d ? [d] : []; CD.reset(); res.json({ ok: true, extra: CD.E2E.extra });
  });
  app.post("/api/comfy/detect/use", (_req, res) => {
    try {
      const d = CD.detect({ refresh: true });
      if (!d) return res.status(404).json({ error: "no ComfyUI found on this computer - pick its folder with 📁" });
      if (d.configured) return res.json({ ok: true, dir: d.root, already: true });
      if (d.kind === "desktop") return res.status(400).json({ error: "that is ComfyUI Desktop's model folder (" + d.root + ") - its models are listed already; the Desktop app runs its own ComfyUI, so there is no folder to launch from" });
      const cfg = core.getConfig(); cfg.engine = cfg.engine || {}; cfg.engine.comfy = cfg.engine.comfy || {};
      cfg.engine.comfy.dir = d.root; core.setConfig(cfg); CD.reset();
      res.json({ ok: true, dir: d.root });
    } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
}

module.exports = { mount };
