// bitGen Studio — Segment Anything routes (2.390.0). Mounted from routes/index.js (never server.js); the work is
// lib/segment.js (a local SAM + CLIPSeg server in venvs/segment).
//
//   GET  /api/segment/status          what is installed / loaded (lib/segment.status)
//   POST /api/segment/settings        {model: vit_b|vit_l|vit_h, checkpoint}
//   POST /api/segment/install         {model, device: auto|cpu} - in the background; poll status
//   POST /api/segment                 multipart: image (PNG - the layer or the picture) + op (points | text | auto) +
//                                     points (JSON [[x, y, 1|0]]) / box (JSON [x0, y0, x1, y1]) / prompt, threshold,
//                                     refine, instances / max, min_area, points_per_side
//                                     -> {masks: [{name, url, label, bbox, area, score}], w, h, took, note, fake}
//   GET  /api/segment/mask/:name      a mask PNG (255 = the segment), kept a day in the project's temp/segment
"use strict";
const multer = require("multer");
const segment = require("../lib/segment");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 128 * 1024 * 1024, files: 1 } });

function mount(app) {
  app.get("/api/segment/status", (_req, res) => res.json(segment.status()));
  app.post("/api/segment/settings", (req, res) => {
    try { res.json(segment.settings(req.body || {})); } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
  app.post("/api/segment/install", (req, res) => {
    try { res.json(segment.install(req.body || {})); } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
  app.post("/api/segment", upload.single("image"), async (req, res) => {
    const b = req.body || {};
    try {
      const r = await segment.run(Object.assign({}, b, { image: req.file && req.file.buffer, fake: false }));
      res.json(r);
    } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
  app.get("/api/segment/mask/:name", (req, res) => {
    try { res.type("png").sendFile(segment.maskPath(req.params.name)); } catch (e) { res.status(e.status || 404).json({ error: e.message }); }
  });
}

module.exports = { mount };
