// bitGen Studio — routes/rig.js (2.976.0): 🦴 RIG IT - UniRig gives a project 3D model a skeleton + skin weights. Mounted from
// routes/index.js (never server.js). The add-on is lib/rigAddon.js; each run is a job (misc/rig_worker.py, mode "rig").
//
//   GET  /api/rig        {installed, note, missing}  (Settings ▸ Add-ons ▸ 🦴 Rig it (UniRig))
//   POST /api/rig        {name (a file in the project's models3d), skin (default true), faces, seed} -> {job, model}
"use strict";
const path = require("path");
const core = require("../lib/core");
const A = require("../lib/rigAddon");

function mount(app) {
  const J = require("express").json({ limit: "1mb" });
  app.get("/api/rig", (_req, res) => { try { res.json(Object.assign({ missing: A.missing() }, A.status())); } catch (e) { res.status(500).json({ error: e.message }); } });
  app.post("/api/rig", J, (req, res) => {
    try {
      const b = req.body || {}, file = require("../lib/m3d").modelPath(path.basename(String(b.name || "")));
      if (!file) return res.status(404).json({ error: "that 3D model is not in this project's models3d: " + String(b.name || "") });
      const jp = A.jobParams(file, { skin: b.skin !== false && b.skin !== "0", faces: b.faces, seed: b.seed });
      if (jp.error) return res.status(jp.missing ? 409 : 400).json({ error: jp.error, missing: jp.missing || null, needs: jp.missing ? "unirig" : null });
      const job = core.makeJob(jp.params); job.chunk = { i: 0, n: 1 };
      res.json({ job: core.jobDict(job), model: jp.params.name + "_rigged.glb" });
    } catch (e) { res.status(e.status || 500).json({ error: String(e.message || e) }); }
  });
}
module.exports = { mount };
