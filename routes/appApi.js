// bitGen Studio — routes/appApi.js (2.909.0): the 📱 bitGen app's own endpoints (lib/appApi.js). Mounted from
// routes/index.js. Reached from the network only with the paired device's key (lib/remoteGuard.js); from this computer too
// (the tests).
//   GET  /api/app/info    {app, version, project, video_styles: [{id, name, arch, route}], image_styles, ui, defaults}
//   POST /api/app/video   multipart: prompt, style_id, width, height, seconds, steps, cfg, seed, override, negative,
//                         pictures (up to 9) -> the endpoint the style renders through (its answer + route / endpoint)
"use strict";
const multer = require("multer");
const A = require("../lib/appApi");

function port() { return parseInt(process.env.H3_PORT, 10) || 8311; }

function mount(app) {
  const up = multer({ storage: multer.memoryStorage(), limits: { fileSize: 40 * 1024 * 1024, files: 9 } });
  app.get("/api/app/info", (_req, res) => {
    try { res.json(A.info()); } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
  });
  app.post("/api/app/video", up.array("pictures", 9), async (req, res) => {
    try {
      const pics = (req.files || []).filter((f) => /^image\//.test(String(f.mimetype || "")))
        .map((f) => ({ name: f.originalname || "picture.png", mime: f.mimetype, buffer: f.buffer }));
      const r = await A.submitVideo(req.body || {}, pics, port());
      res.status(r.status).json(r.body);
    } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
  });
}
module.exports = { mount };
