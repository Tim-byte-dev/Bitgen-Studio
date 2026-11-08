/* bitGen Studio — FlowHMR motion capture routes (2.730.0, lib/flowhmr.js).
 *
 *   GET  /api/flowhmr/status    {installed, note, missing[], notice, defaults, cameras, every}
 *   POST /api/flowhmr           {name, from?, camera?, every?, steps?} -> queues the job (the motion -> models3d/)
 * A video is named, never pathed: a gallery output, a Video asset or a project-root export (lib/seedvr2.resolve). */
"use strict";
const core = require("../lib/core");
const flowhmr = require("../lib/flowhmr");

function mount(app) {
  const pdir = () => core.projDir(core.getProject());
  app.get("/api/flowhmr/status", (_req, res) => {
    const A = require("../lib/flowhmrAddon");
    const st = A.status();
    res.json({ installed: st.installed, note: st.note, missing: A.missing(), notice: A.NOTICE,
      defaults: flowhmr.DEFAULTS, cameras: flowhmr.CAMERAS, every: flowhmr.EVERY });
  });
  app.post("/api/flowhmr", (req, res) => {
    const b = req.body || {};
    const name = String(b.name || "");
    const file = flowhmr.resolve(pdir(), name, String(b.from || ""));
    if (!file) return res.status(400).json({ error: name ? `${name} is not a video in this project (output, final, Video assets)` : "name a video first" });
    const jp = flowhmr.jobParams(file, b);
    if (jp.error) return res.status(409).json({ error: jp.error, missing: jp.missing });
    jp.params.models_dir = require("path").join(pdir(), "models3d");
    const job = core.makeJob(jp.params);
    res.json({ id: job.id, note: jp.note });
  });
}

module.exports = { mount };
