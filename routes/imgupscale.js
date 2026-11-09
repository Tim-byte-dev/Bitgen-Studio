/* bitGen Studio — picture upscaling routes (2.733.0, lib/imgUpscale.js). Mounted from routes/index.js (never server.js).
 *
 *   GET  /api/imgupscale/settings          the project's choices + the lists
 *   POST /api/imgupscale/plan              {name, from, size} -> what it would make (nothing queued)
 *   POST /api/imgupscale                   {name, from, size?, method?, model?, color?, denoise?} -> queues the job (the
 *                                          choices become the project's)
 *   POST /api/imgupscale/upload?name=<n>   the bytes of a reference-dock picture (it lives in the browser) -> {name, from}
 * A picture is named, never pathed: a gallery image (output / project / final), an Image asset, or an upload's token. */
"use strict";
const express = require("express");
const core = require("../lib/core");
const iu = require("../lib/imgUpscale");

function mount(app) {
  const pdir = () => core.projDir(core.getProject());
  const tmp = () => core.tempDir();
  app.get("/api/imgupscale/settings", (_req, res) => {
    res.json({ settings: iu.read(pdir()), sizes: iu.SIZES, methods: iu.METHODS, colors: iu.COLORS });
  });
  const source = (b) => {
    const name = String((b || {}).name || ""), from = String((b || {}).from || "");
    const file = iu.resolve(pdir(), name, from, tmp());
    if (!file) return { error: name ? `${name} is not a picture in this project (output, final, Image assets)` : "pick a picture first" };
    return { file, size: iu.probe(file) };
  };
  app.post("/api/imgupscale/plan", (req, res) => {
    const s = source(req.body);
    if (s.error) return res.status(400).json({ error: s.error });
    const jp = iu.jobParams(s.file, s.size, { ...iu.read(pdir()), ...(req.body || {}) });
    if (jp.error) return res.status(400).json({ error: jp.error, source: s.size });
    res.json({ source: s.size, target: jp.target, note: jp.note });
  });
  app.post("/api/imgupscale", (req, res) => {
    const b = req.body || {};
    const s = source(b);
    if (s.error) return res.status(400).json({ error: s.error });
    const opts = iu.save(pdir(), b);
    const stem = b.from === "upload" ? String(b.name).replace(/^[0-9a-f]{12}_/, "").replace(/\.[^.]+$/, "") : "";
    const jp = iu.jobParams(s.file, s.size, opts, stem ? { stem, display_name: stem } : {});
    if (jp.error) return res.status(400).json({ error: jp.error });
    const job = core.makeJob(jp.params);
    res.json({ id: job.id, note: jp.note, target: jp.target, output: jp.params.output_name });
  });
  app.post("/api/imgupscale/upload", express.raw({ type: () => true, limit: 64 * 1024 * 1024 + 1024 }), (req, res) => {
    try { res.json(iu.saveUpload(tmp(), req.body, req.query.name)); } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
}

module.exports = { mount };
