/* bitGen Studio — RelayVSR video upscaling routes (2.728.0, lib/relayvsr.js).
 *
 *   GET  /api/relayvsr/settings     the project's options + the choices + does this ComfyUI have the nodes
 *   POST /api/relayvsr/settings     save them
 *   POST /api/relayvsr/plan         {name, from?, size?, model?} -> what an upscale of that video would make (nothing queued)
 *   POST /api/relayvsr              {name, from?, size?, model?, detail?, seed?, start?, duration?, output_name?} -> queues it
 * A video is named, never pathed: a gallery output, a Video asset or a project-root export (lib/seedvr2.resolve). */
"use strict";
const core = require("../lib/core");
const relayvsr = require("../lib/relayvsr");

function mount(app) {
  const pdir = () => core.projDir(core.getProject());
  app.get("/api/relayvsr/settings", async (_req, res) => {
    let live = { online: false, nodes: false };
    try { live = await relayvsr.comfySupport(); } catch { /* unknown */ }
    let addon = null;
    try { addon = require("../lib/relayvsrAddon").status(); } catch { addon = null; }
    res.json({ settings: relayvsr.read(pdir()), sizes: relayvsr.SIZES, models: relayvsr.MODELS, choices: relayvsr.MODEL_CHOICES,
      upscaler: relayvsr.UPSCALER, note: relayvsr.INSTALL_NOTE, live, addon });
  });
  app.post("/api/relayvsr/settings", (req, res) => {
    try { res.json({ settings: relayvsr.save(pdir(), req.body || {}) }); }
    catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
  const source = (body) => {
    const name = String((body || {}).name || "");
    const file = relayvsr.resolve(pdir(), name, String((body || {}).from || ""));
    if (!file) return { error: name ? `${name} is not a video in this project (output, final, Video assets)` : "name a video first" };
    return { file, size: relayvsr.probe(file) };
  };
  app.post("/api/relayvsr/plan", (req, res) => {
    const s = source(req.body);
    if (s.error) return res.status(400).json({ error: s.error });
    const jp = relayvsr.jobParams(s.file, s.size, { ...relayvsr.read(pdir()), ...(req.body || {}) });
    if (jp.error) return res.status(400).json({ error: jp.error, source: s.size });
    res.json({ source: s.size, target: jp.target, note: jp.note });
  });
  app.post("/api/relayvsr", (req, res) => {
    const b = req.body || {};
    const s = source(b);
    if (s.error) return res.status(400).json({ error: s.error });
    const opts = relayvsr.save(pdir(), b);
    const jp = relayvsr.jobParams(s.file, s.size, opts, {
      start: parseFloat(b.start), duration: parseFloat(b.duration),
      output_name: b.output_name ? String(b.output_name).replace(/[\\/:*?"<>|]/g, "_").slice(0, 120) : "" });
    if (jp.error) return res.status(400).json({ error: jp.error });
    const job = core.makeJob(jp.params);
    res.json({ id: job.id, note: jp.note, target: jp.target });
  });
}

module.exports = { mount };
