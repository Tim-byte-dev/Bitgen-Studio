// bitGen Studio — the parametric 3D bodies (2.471.0). Mounted from routes/index.js (never server.js); the work is
// lib/body3d.js (the engine setting + the Blender engine) - the OpenCascade engine runs in the page (static/body3docc.js).
//
//   GET  /api/body3d/settings      {engine: "occ" | "blender", blender: {found, path}}
//   POST /api/body3d/settings      {engine} -> the settings
//   POST /api/body3d/build         a job (static/body3d.js plan()) -> {mesh: {vertices, triangles}, volume, warnings}
"use strict";
const express = require("express");
const body3d = require("../lib/body3d");
const blender = require("../lib/blender");

function mount(app) {
  app.get("/api/body3d/settings", (req, res) => { const exe = blender.find(); res.json(Object.assign(body3d.settings(), { blender: { found: !!exe, path: exe || "" } })); });
  app.post("/api/body3d/settings", express.json(), (req, res) => {
    try { res.json(body3d.saveSettings(req.body || {})); } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
  app.post("/api/body3d/build", express.json({ limit: "20mb" }), (req, res) => {
    let p; try { p = body3d.build(req.body); } catch (e) { return res.status(e.status || 500).json({ error: e.message }); }
    p.then((out) => res.json(out)).catch((e) => res.status(e.status || 500).json({ error: e.message, warnings: e.warnings || [] }));
  });
}

module.exports = { mount };
