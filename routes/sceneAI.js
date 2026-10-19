// bitGen Studio — routes/sceneAI.js (2.404.0): ✨ Build a scene with AI (lib/sceneAI.js) and 🧊 a picture -> a 3D model
// (lib/mesh3d.js). Mounted from routes/index.js (never server.js).
//
//   POST /api/sceneai/build   {prompt, seconds, engine (auto|hunyuan|trellis), models (bool), maxModels, image_style_id}
//                             -> {id}: the LLM's plan -> pictures -> 3D models -> Blender -> the scene open in the preview
//   GET  /api/sceneai/status?id=   {state running|done|error|cancelled|none, stage, lines, jobs, plan, scene (when done)}
//   POST /api/sceneai/stop    {id}
//   POST /api/mesh3d          {name, where (output|project|final|images), engine, seed, model_name} -> the queue job
//                             (a gallery / asset picture -> <project>/models3d/<name>.glb)
//   GET  /api/mesh3d/info     the engines and the files each needs (for the page's words)
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("../lib/core");
const AI = require("../lib/sceneAI");
const mesh3d = require("../lib/mesh3d");

function pictureOf(name, where) {
  const n = path.basename(String(name || ""));
  if (!n) return null;
  const pd = core.projDir(core.getProject());
  const dirs = { project: pd, output: core.pDir("output"), final: path.join(pd, "final"), images: core.pDir("images") };
  const order = dirs[where] ? [dirs[where]] : [dirs.output, dirs.images, dirs.final, dirs.project];
  for (const d of order) { const f = path.join(d, n); if (fs.existsSync(f) && fs.statSync(f).isFile()) return f; }
  return null;
}

function mount(app) {
  const express = require("express");
  const J = express.json({ limit: "4mb" });
  const fail = (res, e) => res.status(e.status || 500).json({ error: String((e && e.message) || e) });
  app.post("/api/sceneai/build", J, (req, res) => {
    const b = req.body || {};
    try {
      res.json(AI.start({ prompt: String(b.prompt || "").slice(0, 4000), seconds: b.seconds, engine: b.engine, models: b.models !== false,
        maxModels: b.maxModels, image_style_id: b.image_style_id, width: b.width, height: b.height, name: b.name,
        plan: b.plan && typeof b.plan === "object" ? b.plan : undefined }));
    } catch (e) { fail(res, e); }
  });
  app.get("/api/sceneai/status", (req, res) => res.json(AI.status(req.query.id)));
  app.post("/api/sceneai/stop", J, (req, res) => res.json(AI.stop((req.body || {}).id)));

  app.post("/api/mesh3d", J, (req, res) => {
    const b = req.body || {};
    try {
      const pic = pictureOf(b.name, b.where);
      if (!pic) return res.status(404).json({ error: "that picture is not in this project: " + String(b.name || "") });
      const jp = mesh3d.jobParams({ picture: pic, name: b.model_name || path.basename(pic).replace(/\.[^.]+$/, ""),
        engine: b.engine, seed: b.seed, models_dir: require("../lib/m3d").dir() });
      if (jp.error) return res.status(400).json({ error: jp.error });
      const job = core.makeJob(jp.params);
      job.chunk = { i: 0, n: 1 };
      res.json({ ...core.jobDict(job), model: jp.params.name + ".glb" });
    } catch (e) { fail(res, e); }
  });
  app.get("/api/mesh3d/info", (_req, res) => res.json({ engines: mesh3d.ENGINES, names: mesh3d.ENGINE_NAME, files: mesh3d.FILES }));
}

module.exports = { mount, pictureOf };
