// bitGen Studio — routes/panoDepth.js (2.994.0): ⛰ PANORAMA DEPTH - PaGeR reads a 360° panorama's shape (code Apache-2.0,
// weights CC BY-NC 4.0: NON-COMMERCIAL use only). Mounted from routes/index.js (never server.js). The add-on is
// lib/pagerAddon.js; each run is a job (misc/pager_worker.py, mode "panodepth").
//
//   GET  /api/panodepth   {installed, note, missing, notice}   (the download box's status; Settings ▸ Add-ons ▸ ⛰ Panorama depth)
//   POST /api/panodepth   the picture as raw bytes (?name=&scene=&ipd=&stereo=) or JSON {name, where, scene, ipd, stereo}
//                         -> {job, stem, notice}; 409 {needs: "pager"} when not installed
"use strict";
const express = require("express");
const core = require("../lib/core");
const A = require("../lib/pagerAddon");

function mount(app) {
  const J = express.json({ limit: "1mb" });
  const RAW = express.raw({ type: (r) => !/json/i.test(r.headers["content-type"] || ""), limit: 64 * 1024 * 1024 });
  app.get("/api/panodepth", (_req, res) => { try { res.json(Object.assign({ missing: A.missing(), notice: A.NOTICE }, A.status())); } catch (e) { res.status(500).json({ error: e.message }); } });
  app.post("/api/panodepth", J, RAW, (req, res) => {
    try {
      let pic = null, b = req.body || {};
      if (Buffer.isBuffer(req.body) && req.body.length) { b = req.query || {}; pic = require("../lib/to3d").savePicture(req.body, b.name || "panorama"); }
      else pic = require("./sceneAI").pictureOf(b.name, b.where);
      if (!pic) return res.status(404).json({ error: "that picture is not in this project: " + String(b.name || "") });
      const jp = A.jobParams(pic, { scene: b.scene, ipd: b.ipd, stereo: b.stereo !== false && b.stereo !== "0" });
      if (jp.error) return res.status(jp.missing ? 409 : 400).json({ error: jp.error, missing: jp.missing || null, needs: jp.missing ? "pager" : null, notice: A.NOTICE });
      const job = core.makeJob(jp.params); job.chunk = { i: 0, n: 1 };
      res.json({ job: core.jobDict(job), stem: jp.params.name, notice: A.NOTICE });
    } catch (e) { res.status(e.status || 500).json({ error: String(e.message || e) }); }
  });
}
module.exports = { mount };
