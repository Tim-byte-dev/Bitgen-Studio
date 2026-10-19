/* bitGen Studio — SeedVR2 video upscaling routes (2.400.0, lib/seedvr2.js).
 *
 *   GET  /api/seedvr2/settings      the project's options + the choices
 *   POST /api/seedvr2/settings      save them
 *   POST /api/seedvr2/plan          {name, size} -> what an upscale of that video would make (nothing queued)
 *   POST /api/seedvr2               {name, from?, size?, color?, chunk?, overlap?, denoise?, model?, start?, duration?}
 *                                   (from: gallery | asset | ref | preview - 2.401.0, the prompt docker's ⏫ Enhance)
 *                                   -> queues the job (the options become the project's defaults)
 * A video is named, never pathed: a gallery output, a Video asset or a project-root export. */
"use strict";
const core = require("../lib/core");
const seedvr2 = require("../lib/seedvr2");

function mount(app) {
  const pdir = () => core.projDir(core.getProject());

  app.get("/api/seedvr2/settings", (_req, res) => {
    res.json({ settings: seedvr2.read(pdir()), sizes: seedvr2.SIZES, colors: seedvr2.COLORS,
               default_model: seedvr2.DEFAULT_MODEL, upscaler: seedvr2.UPSCALER });
  });

  app.post("/api/seedvr2/settings", (req, res) => {
    try { res.json({ settings: seedvr2.save(pdir(), req.body || {}) }); }
    catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });

  const source = (body) => {
    const name = String((body || {}).name || "");
    const file = seedvr2.resolve(pdir(), name, String((body || {}).from || ""));   // 2.401.0: where it was picked
    if (!file) return { error: name ? `${name} is not a video in this project (output, final, Video assets)` : "name a video first" };
    return { file, size: seedvr2.probe(file) };
  };

  app.post("/api/seedvr2/plan", (req, res) => {
    const s = source(req.body);
    if (s.error) return res.status(400).json({ error: s.error });
    const jp = seedvr2.jobParams(s.file, s.size, { ...seedvr2.read(pdir()), ...(req.body || {}) });
    if (jp.error) return res.status(400).json({ error: jp.error, source: s.size });
    res.json({ source: s.size, target: jp.target, note: jp.note });
  });

  app.post("/api/seedvr2", (req, res) => {
    const b = req.body || {};
    const s = source(b);
    if (s.error) return res.status(400).json({ error: s.error });
    const opts = seedvr2.save(pdir(), b);                   // the choices are remembered for the next one
    const jp = seedvr2.jobParams(s.file, s.size, opts, {
      start: parseFloat(b.start), duration: parseFloat(b.duration),
      output_name: b.output_name ? String(b.output_name).replace(/[\\/:*?"<>|]/g, "_").slice(0, 120) : "" });
    if (jp.error) return res.status(400).json({ error: jp.error });
    const job = core.makeJob(jp.params);
    res.json({ id: job.id, note: jp.note, target: jp.target });
  });
}

module.exports = { mount };
