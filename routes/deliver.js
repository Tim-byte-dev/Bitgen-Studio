// bitGen Studio — routes/deliver.js (2.407.0): the 📤 Export queue (lib/deliver.js). Mounted from routes/index.js
// (never server.js). The deliverables themselves ride on POST /api/export (`deliver`, `tc`) and scripts/deliver.py
// makes them at the end of the compile.
//
//   GET /api/deliver/presets          {presets, sizes, aspects, fits, fps, qualities}
//   GET /api/deliver/files            {files: [{name, size, mtime}]}   the master + every deliverable of this project
//   GET /api/deliver/file/:name       the file (a download)
//   POST /api/deliver/still?t=&fps=   2.410.0: 🖼 the frame at the position marker (the body: the canvas's PNG) ->
//                                     {name, size} beside the movies
"use strict";
const path = require("path");
const express = require("express");
const core = require("../lib/core");
const deliver = require("../lib/deliver");

const stem = () => String(core.getProject() || "project").replace(/[^A-Za-z0-9._ -]+/g, "_").replace(/^[ .]+|[ .]+$/g, "") || "project";

function mount(app) {
  const fail = (res, e) => res.status(e.status || 500).json({ ok: false, error: String((e && e.message) || e) });
  app.get("/api/deliver/presets", (_req, res) => { const { _, ...p } = deliver.PRESETS; res.json({ ok: true, ...p }); });
  app.get("/api/deliver/files", (_req, res) => {
    try { res.json({ ok: true, files: deliver.files(core.projDir(core.getProject()), stem()) }); } catch (e) { fail(res, e); }
  });
  app.post("/api/deliver/still", express.raw({ type: ["image/png", "application/octet-stream"], limit: "64mb" }), (req, res) => {
    try { res.json({ ok: true, ...deliver.saveStill(core.projDir(core.getProject()), stem(), req.body, req.query.t, req.query.fps) }); }
    catch (e) { fail(res, e); }
  });
  app.get("/api/deliver/file/:name", (req, res) => {
    try { const f = deliver.filePath(core.projDir(core.getProject()), stem(), req.params.name); res.download(f, path.basename(f)); }
    catch (e) { fail(res, e); }
  });
}

module.exports = { mount };
