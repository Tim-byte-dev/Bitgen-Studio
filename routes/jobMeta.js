// bitGen Studio — routes/jobMeta.js (2.384.0): a render's metadata and the seeds to reuse.
//
// Tim: "when the job is done add a slideout to the div to show metadata - seed,cfg,steps, model used,loras used (make
// this a dialog and show these details in the preview images/video dialog in a right pane). add a seed input in the
// basic settings so user can reuse seed ... add the seed input to the scenes in videodocker too, so user can reuse
// scene".
//
//   GET  /api/job-meta?name=<file>   the metadata of the job that made the file (lib/jobMeta.findByOutput: the jobs in
//                                    memory, this project's jobs.info, the board's scene takes) - 404 when none
//   GET  /api/job-meta/last-seed     {seed, id} - the last finished job that said its seed (Basic Settings' ♻)
//   POST /api/scenes/:n/seed         {seed} - the scene card's own seed (blank / -1 = none, back to the ⚙ rule)
const jobMeta = require("../lib/jobMeta");
const sceneSeed = require("../lib/sceneSeed");
const renderSettings = require("../lib/renderSettings");
const core = require("../lib/core");

function mount(app) {
  app.get("/api/job-meta/last-seed", (_req, res) => {
    const j = jobMeta.lastSeed();
    let board = null;
    try { board = renderSettings.read(core.projDir(core.getProject())).last_seed; } catch { board = null; }
    res.json({ seed: j ? j.seed : null, id: j ? j.id : null, board_last_seed: board });
  });
  app.get("/api/job-meta", (req, res) => {
    const name = String(req.query.name || "").trim();
    if (!name) return res.status(400).json({ error: "name is required" });
    try {
      const hit = jobMeta.findByOutput(name);
      if (!hit) return res.status(404).json({ error: "no render metadata for " + name });
      res.json({ name, ...hit });
    } catch (e) { res.status(500).json({ error: String(e && e.message || e) }); }
  });
  app.post("/api/scenes/:n/seed", (req, res) => {
    const b = req.body || {};
    try { res.json({ ok: true, ...sceneSeed.setSceneSeed(b.project, parseInt(req.params.n, 10), b.seed) }); }
    catch (e) { res.status(e.status || 500).json({ error: String(e && e.message || e) }); }
  });
}

module.exports = { mount };
