// routes/rgbMocap.js — 2.869.0 🕺 RGB MoCap for the timeline (lib/rgbMocap.js). Mounted from routes/index.js.
//   GET  /api/mocap/rgb              {status, results [{rel, name, kind, size, mtime, inTimeline}], folder}
//   POST /api/mocap/rgb/prepare      {name, src, in, out} -> {video, folder, rel}   the clip's used part, for RGB MoCap to open
//   POST /api/mocap/rgb/open         RGB MoCap's window (Windows, installed)
//   POST /api/mocap/rgb/bring        {rel} -> {model}   an .fbx (or a .bvh through Blender) into models3d for a 3D layer
"use strict";
const express = require("express");
function wrap(fn) { return async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: e.message || String(e) }); } }; }
function mount(app) {
  const R = () => require("../lib/rgbMocap"), J = express.json({ limit: "1mb" });
  app.get("/api/mocap/rgb", wrap(() => R().results()));
  app.post("/api/mocap/rgb/prepare", J, wrap((req) => R().prepare(req.body || {})));
  app.post("/api/mocap/rgb/open", J, wrap(() => R().open()));
  app.post("/api/mocap/rgb/bring", J, wrap((req) => R().bring(req.body || {})));
}
module.exports = { mount };
