// bitGen Studio — routes/d3v3.js (3.7.0): 💎 FINE DETAIL - Direct3D-V3 carves fine detail into a rough 3D model of a picture.
// Mounted from routes/index.js (never server.js). The add-on is lib/d3v3Addon.js; each run is a job (misc/d3v3_worker.py,
// mode "d3v3").
//
//   GET  /api/d3v3   {installed, note, missing, standins}  (Settings ▸ Add-ons ▸ 💎 Fine detail (Direct3D-V3))
//   POST /api/d3v3   {picture, where (output | images | project | final), model (a file in the project's models3d),
//                     resolution 512 | 1024 | 1536, steps, cfg, seed, faces (number | "all"), low} -> {job, model}
//                    409 {needs: "d3v3", missing} when the add-on is not installed (the page opens its Download box)
"use strict";
const path = require("path");
const core = require("../lib/core");
const A = require("../lib/d3v3Addon");

function mount(app) {
  const J = require("express").json({ limit: "1mb" });
  app.get("/api/d3v3", (_req, res) => { try { res.json(Object.assign({ missing: A.missing(), standins: A.standIns() }, A.status())); } catch (e) { res.status(500).json({ error: e.message }); } });
  app.post("/api/d3v3", J, (req, res) => {
    try {
      const b = req.body || {};
      const pic = require("../lib/to3d").pictureOf(b.picture, b.where);
      if (!pic) return res.status(404).json({ error: "that picture is not in this project: " + String(b.picture || "") });
      const file = require("../lib/m3d").modelPath(path.basename(String(b.model || "")));
      if (!file) return res.status(404).json({ error: "that 3D model is not in this project's models3d: " + String(b.model || "") });
      const jp = A.jobParams(pic, file, { resolution: b.resolution, steps: b.steps, cfg: b.cfg, seed: b.seed, faces: b.faces, low: !!b.low });
      if (jp.error) return res.status(jp.missing ? 409 : 400).json({ error: jp.error, missing: jp.missing || null, needs: jp.missing ? "d3v3" : null });
      const job = core.makeJob(jp.params); job.chunk = { i: 0, n: 1 };
      res.json({ job: core.jobDict(job), model: jp.params.name + "_detail.glb" });
    } catch (e) { res.status(e.status || 500).json({ error: String(e.message || e) }); }
  });
}
module.exports = { mount };
