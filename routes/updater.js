// bitGen Studio — routes/updater.js (2.540.5): ⟳ Update from GitHub (Settings ▸ General ▸ Updates).
// Mounted by routes/index.js (never server.js); the work is lib/updater.js.
//   GET  /api/update/info            {version, mode: git | zip, repo, branch}
//   POST /api/update/check           {current, latest, newer, behind, ahead, commits[], error}
//   POST /api/update/start           -> {ok} | 409 {error}   (one at a time)
//   GET  /api/update/job?from=N      {job: {state, from, to, restart, error}, lines[], next}
//   GET/POST /api/update/settings    {auto_check} - 2.573.0: the check on startup (bitGen Studio + ComfyUI), on by default
"use strict";
const U = require("../lib/updater");
const core = require("../lib/core");

function mount(app) {
  app.get("/api/update/info", (_req, res) => res.json(U.info()));
  app.post("/api/update/check", async (_req, res) => {
    try { res.json(await U.check()); } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
  // 2.573.0 (Tim: "do an autocheck on startup for latest version of bitgen and comfyui"): its on/off switch
  app.get("/api/update/settings", (_req, res) => res.json({ auto_check: ((core.getConfig() || {}).update || {}).auto_check !== false }));
  app.post("/api/update/settings", (req, res) => {
    const b = req.body || {};
    const c = core.getConfig();
    c.update = Object.assign({}, c.update || {}, { auto_check: b.auto_check !== false });
    core.setConfig(c);
    res.json({ ok: true, auto_check: c.update.auto_check });
  });
  app.post("/api/update/start", (_req, res) => {
    const r = U.start();
    if (r.error) return res.status(409).json(r);
    res.json(r);
  });
  app.get("/api/update/job", (req, res) => {
    const j = U.job();
    if (!j) return res.json({ job: null, lines: [], next: 0 });
    const from = Math.max(0, Math.min(j.lines.length, parseInt(req.query.from, 10) || 0));
    res.json({ job: { state: j.state, from: j.from, to: j.to, mode: j.mode, restart: j.restart, error: j.error }, lines: j.lines.slice(from), next: j.lines.length });
  });
}
module.exports = { mount };
