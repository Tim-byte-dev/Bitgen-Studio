// bitGen Studio — routes/lottie.js (2.512.0): ⤓ LOTTIE export (lib/lottie.js). Mounted from routes/index.js (never
// server.js).
//
//   POST /api/lottie/export   {name, W, H, fps, dur, layers} (the page's description: ext/timelinedock/tllottie.js)
//                             -> {name, size, layers, skipped}: <project>_lottie.json beside the movies - the pictures
//                             (images/, text pictures included) and the frames layers' pictures (sent first to
//                             /api/tlbake/frame, lib/layerBake.frameDir - removed once used) embedded; 📤 Export lists
//                             and downloads it
"use strict";
const fs = require("fs");
const path = require("path");
const express = require("express");
const core = require("../lib/core");
const lottie = require("../lib/lottie");
const layerBake = require("../lib/layerBake");

const stem = () => String(core.getProject() || "project").replace(/[^A-Za-z0-9._ -]+/g, "_").replace(/^[ .]+|[ .]+$/g, "") || "project";

function mount(app) {
  app.post("/api/lottie/export", express.json({ limit: "256mb" }), (req, res) => {
    try {
      const imgs = core.pDir("images");
      const read = (f) => { const p = path.join(imgs, path.basename(String(f || ""))); try { return fs.existsSync(p) ? fs.readFileSync(p) : null; } catch { return null; } };
      const used = new Set();
      const frame = (id, n) => { try { const d = layerBake.frameDir(id); used.add(d); const p = path.join(d, "f_" + String(Math.floor(n)).padStart(5, "0") + ".png"); return fs.existsSync(p) ? fs.readFileSync(p) : null; } catch { return null; } };
      const r = lottie.build(req.body || {}, read, frame);
      used.forEach((d) => { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* left */ } });
      res.json({ ok: true, ...lottie.save(core.projDir(core.getProject()), stem(), r.json), layers: r.json.layers.length, assets: r.json.assets.length, skipped: r.skipped });
    } catch (e) { res.status(e.status || 500).json({ ok: false, error: String((e && e.message) || e) }); }
  });
}

module.exports = { mount };
