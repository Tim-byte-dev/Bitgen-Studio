// bitGen Studio — routes/to3d.js (2.594.0): 🧊 Convert to 3D a picture the page SENDS (lib/to3d.js). Mounted from
// routes/index.js (never server.js).
//
//   POST /api/to3d/picture?name=<file name>&engine=auto|hunyuan|trellis   raw PNG / JPEG / WebP bytes (a reference-dock
//        picture, the image editor's picture or layer) -> it is kept in the project's images/ and the 3D job queued:
//        {job..., model: "<name>.glb", picture: "<the saved name>"}
// A project picture (Gallery, Assets) is queued by name with POST /api/mesh3d (routes/sceneAI.js) - the same queue.
"use strict";
const path = require("path");
const T = require("../lib/to3d");

function mount(app) {
  const RAW = require("express").raw({ type: () => true, limit: 64 * 1024 * 1024 });
  app.post("/api/to3d/picture", RAW, (req, res) => {
    try {
      const q = req.query || {};
      const pic = T.savePicture(req.body, q.name || "picture");
      res.json(Object.assign(T.queue(pic, { engine: q.engine, seed: q.seed }), { picture: path.basename(pic) }));
    } catch (e) { res.status(e.status || 500).json({ error: String((e && e.message) || e) }); }
  });
}
module.exports = { mount };
