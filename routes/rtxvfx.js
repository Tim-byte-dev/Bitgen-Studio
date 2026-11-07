/* bitGen Studio — RTX VFX video finisher routes (2.708.0, lib/rtxvfx.js).
 *
 *   GET  /api/rtxvfx/settings     the project's options + the presets + what THIS ComfyUI's node offers (/object_info)
 *   POST /api/rtxvfx/settings     save them
 *   POST /api/rtxvfx/plan         {name, from?, scale?} -> about what the finisher would make of that video (nothing queued)
 *   POST /api/rtxvfx              {name, from?, preset?, first_pass?, first_quality?, upscale_pass?, upscale_quality?,
 *                                 scale?, batch?, start?, duration?, output_name?} -> queues the job (the options are remembered)
 * A video is named, never pathed: a gallery output, a Video asset or a project-root export (lib/seedvr2.resolve). */
"use strict";
const core = require("../lib/core");
const rtxvfx = require("../lib/rtxvfx");

function mount(app) {
  const pdir = () => core.projDir(core.getProject());
  app.get("/api/rtxvfx/settings", async (_req, res) => {
    let live = { online: false, pack: false, options: {} };
    try { live = await rtxvfx.liveOptions(); } catch { /* the defaults stand */ }
    res.json({ settings: rtxvfx.read(pdir()), presets: rtxvfx.PRESETS, labels: rtxvfx.PRESET_LABELS, defaults: rtxvfx.DEFAULTS,
      upscaler: rtxvfx.UPSCALER, note: rtxvfx.INSTALL_NOTE, live });
  });
  app.post("/api/rtxvfx/settings", (req, res) => {
    try { res.json({ settings: rtxvfx.save(pdir(), req.body || {}) }); }
    catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
  const source = (body) => {
    const name = String((body || {}).name || "");
    const file = rtxvfx.resolve(pdir(), name, String((body || {}).from || ""));
    if (!file) return { error: name ? `${name} is not a video in this project (output, final, Video assets)` : "name a video first" };
    return { file, size: rtxvfx.probe(file) };
  };
  app.post("/api/rtxvfx/plan", (req, res) => {
    const s = source(req.body);
    if (s.error) return res.status(400).json({ error: s.error });
    const jp = rtxvfx.jobParams(s.file, s.size, { ...rtxvfx.read(pdir()), ...(req.body || {}) });
    if (jp.error) return res.status(400).json({ error: jp.error, source: s.size });
    res.json({ source: s.size, target: jp.target, note: jp.note });
  });
  app.post("/api/rtxvfx", (req, res) => {
    const b = req.body || {};
    const s = source(b);
    if (s.error) return res.status(400).json({ error: s.error });
    const opts = rtxvfx.save(pdir(), b);
    const jp = rtxvfx.jobParams(s.file, s.size, opts, {
      start: parseFloat(b.start), duration: parseFloat(b.duration),
      output_name: b.output_name ? String(b.output_name).replace(/[\\/:*?"<>|]/g, "_").slice(0, 120) : "" });
    if (jp.error) return res.status(400).json({ error: jp.error });
    const job = core.makeJob(jp.params);
    res.json({ id: job.id, note: jp.note, target: jp.target });
  });
}

module.exports = { mount };
