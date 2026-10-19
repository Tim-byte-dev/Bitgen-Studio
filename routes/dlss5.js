/* bitGen Studio — DLSS 5 enhance / upscale / frame generation routes (2.504.0, lib/dlss5.js).
 *
 *   GET  /api/dlss5/settings      the project's options + the choices
 *   POST /api/dlss5/settings      save them
 *   POST /api/dlss5/plan          {name, from?, mode?} -> what DLSS would make of that video (nothing queued)
 *   POST /api/dlss5               {name, from?, mode?, style?, intensity?, tone?, structure?, skin?, detail?, color?,
 *                                 fps?, start?, duration?, output_name?} -> queues the job (the options are remembered)
 * A video is named, never pathed: a gallery output, a Video asset or a project-root export (lib/seedvr2.resolve). */
"use strict";
const core = require("../lib/core");
const dlss5 = require("../lib/dlss5");

function mount(app) {
  const pdir = () => core.projDir(core.getProject());
  app.get("/api/dlss5/settings", (_req, res) => {
    res.json({ settings: dlss5.read(pdir()), modes: dlss5.MODES, styles: dlss5.STYLES, fps: dlss5.FPS_OUT, upscaler: dlss5.UPSCALER });
  });
  app.post("/api/dlss5/settings", (req, res) => {
    try { res.json({ settings: dlss5.save(pdir(), req.body || {}) }); }
    catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
  const source = (body) => {
    const name = String((body || {}).name || "");
    const file = dlss5.resolve(pdir(), name, String((body || {}).from || ""));
    if (!file) return { error: name ? `${name} is not a video in this project (output, final, Video assets)` : "name a video first" };
    return { file, size: dlss5.probe(file) };
  };
  app.post("/api/dlss5/plan", (req, res) => {
    const s = source(req.body);
    if (s.error) return res.status(400).json({ error: s.error });
    const jp = dlss5.jobParams(s.file, s.size, { ...dlss5.read(pdir()), ...(req.body || {}) });
    if (jp.error) return res.status(400).json({ error: jp.error, source: s.size });
    res.json({ source: s.size, target: jp.target, note: jp.note });
  });
  app.post("/api/dlss5", (req, res) => {
    const b = req.body || {};
    const s = source(b);
    if (s.error) return res.status(400).json({ error: s.error });
    const opts = dlss5.save(pdir(), b);
    const jp = dlss5.jobParams(s.file, s.size, opts, {
      start: parseFloat(b.start), duration: parseFloat(b.duration),
      output_name: b.output_name ? String(b.output_name).replace(/[\\/:*?"<>|]/g, "_").slice(0, 120) : "" });
    if (jp.error) return res.status(400).json({ error: jp.error });
    const job = core.makeJob(jp.params);
    res.json({ id: job.id, note: jp.note, target: jp.target });
  });
}

module.exports = { mount };
