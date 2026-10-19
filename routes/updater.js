// bitGen Studio — routes/updater.js (2.540.5): ⟳ Update from GitHub (Settings ▸ General ▸ Updates).
// Mounted by routes/index.js (never server.js); the work is lib/updater.js.
//   GET  /api/update/info            {version, mode: git | zip, repo, branch}
//   POST /api/update/check           {current, latest, newer, behind, ahead, commits[], error}
//   POST /api/update/start           -> {ok} | 409 {error}   (one at a time)
//   GET  /api/update/job?from=N      {job: {state, from, to, restart, error}, lines[], next}
"use strict";
const U = require("../lib/updater");

function mount(app) {
  app.get("/api/update/info", (_req, res) => res.json(U.info()));
  app.post("/api/update/check", async (_req, res) => {
    try { res.json(await U.check()); } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
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
