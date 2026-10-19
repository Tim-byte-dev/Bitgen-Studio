// bitGen Studio — routes/pathGen.js (2.387.0): the PATH LAYERS' generation (ext/timelinedock/paths.js).
//
// Tim: "can we add a paths layer, then generate parts of the scene on each path layer so animals, cars, people can be
// rendered separately have transparent backgrounds and compose the scene" - asked: per layer "Along the path (Wan ATI)"
// or "In place + follow path", and "Green screen + AI matte".
//
//   POST /api/pathgen/ati            multipart: start (PNG - the subject at the path's start on green), tracks (JSON:
//                                    [[{x, y}, ...]] in the video's pixels, the times already in them), prompt, seconds,
//                                    width, height, style_id (a Wan 2.1 style), seed -> a Wan ATI job {id, ...}
//   GET  /api/pathgen/matte          lib/matte.status(): is the AI matte installed
//   POST /api/pathgen/matte/install  builds venvs/matte (rembg + BiRefNet) in the background
//   POST /api/pathgen/matte          {id, output, method: auto | ai | key, model} -> cut the green screen away
//   GET  /api/pathgen/matte/:id      {state, done, of, result: {name, left, w, h, dur, bbox, height, key}}
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const core = require("../lib/core");
const styles = require("../lib/styles");
const wan = require("../lib/wan");
const matte = require("../lib/matte");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 32 * 1024 * 1024, files: 1 } });
const isPng = (b) => Buffer.isBuffer(b) && b.length > 8 && b.slice(0, 8).toString("hex") === "89504e470d0a1a0a";

function mount(app) {
  const express = require("express");
  const fail = (res, e) => res.status(e.status || 500).json({ error: String(e && e.message || e) });

  app.post("/api/pathgen/ati", upload.single("start"), (req, res) => {
    const b = req.body || {};
    try {
      const st = styles.byId(core.STYLES_DIR, String(b.style_id || ""));
      if (!st || !wan.isWanStyle(st)) return res.status(400).json({ error: "pick a Wan 2.1 video style for Along the path (ATI)" });
      if (!req.file || !isPng(req.file.buffer)) return res.status(400).json({ error: "the start picture (PNG) is missing" });
      let tracks = [];
      try { tracks = JSON.parse(String(b.tracks || "[]")); } catch { return res.status(400).json({ error: "tracks is not JSON" }); }
      const prompt = String(b.prompt || "").trim();
      if (!prompt) return res.status(400).json({ error: "write what walks / drives along the path" });
      const id = require("crypto").randomBytes(6).toString("hex");
      const dir = path.join(core.JOBS_DIR, id);
      fs.mkdirSync(dir, { recursive: true });
      const img = path.join(dir, "path_start.png");
      fs.writeFileSync(img, req.file.buffer);
      const p = wan.jobParams({ style: st, wanMode: "ati", prompt, images: [img], tracks, seconds: +b.seconds || 5,
        width: b.width, height: b.height, seed: b.seed != null ? b.seed : -1, steps: b.steps, cfg: b.cfg, output_name: b.output_name });
      if (p.error) return res.status(400).json({ error: p.error });
      p.path_layer = String(b.layer || "").slice(0, 60);
      const job = core.makeJob(p, id, dir);
      job.chunk = { i: 0, n: 1 };
      const note = wan.summary(p);
      try { job.log.push("[bitgen-studio] " + note); } catch { /* fine */ }
      res.json({ ...core.jobDict(job), note });
    } catch (e) { fail(res, e); }
  });
  app.get("/api/pathgen/matte", (_req, res) => { try { res.json(matte.status()); } catch (e) { fail(res, e); } });
  app.post("/api/pathgen/matte/install", express.json(), (req, res) => {
    try { res.json(matte.install(req.body || {})); } catch (e) { fail(res, e); }
  });
  app.post("/api/pathgen/matte", express.json(), (req, res) => {
    try { res.json({ ok: true, ...matte.start(req.body || {}) }); } catch (e) { fail(res, e); }
  });
  app.get("/api/pathgen/matte/:id", (req, res) => res.json(matte.job(req.params.id)));
}

module.exports = { mount };
