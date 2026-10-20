// bitGen Studio — routes/addons.js (2.540.4): Settings ▸ Add-ons. Mounted by routes/index.js (never server.js);
// the list, the installs and the job are lib/addons.js.
//   GET  /api/addons                  {addons: [...], job}
//   POST /api/addons/:id/install      (also reinstall; 2.557.0 JSON {items: [ids]} = what to download) -> {ok, job} | 409 {error}
//   POST /api/addons/:id/remove       -> {ok, job} | 409 {error}
//   GET  /api/addons/job?from=N       {job: {id, action, state, error}, lines: [from…], next}
"use strict";
const A = require("../lib/addons");

function mount(app) {
  app.get("/api/addons", (_req, res) => {
    const j = A.job();
    res.json({ addons: A.list(), job: j ? { id: j.id, action: j.action, state: j.state, error: j.error, lines: j.lines.length } : null });
  });
  const go = (action) => (req, res) => {
    // 2.557.0: {items: [ids]} - what to download (AI fill models)
    const items = Array.isArray((req.body || {}).items) ? req.body.items.map(String).slice(0, 20) : undefined;
    const r = A.start(String(req.params.id || ""), action, { items });
    if (r.error) return res.status(/already/.test(r.error) ? 409 : 400).json(r);
    const j = A.job();
    res.json({ ok: true, external: !!r.external, job: r.external ? null : { id: j.id, action: j.action, state: j.state } });
  };
  app.post("/api/addons/:id/install", go("install"));
  app.post("/api/addons/:id/remove", go("remove"));
  app.get("/api/addons/job", (req, res) => {
    const j = A.job();
    if (!j) return res.json({ job: null, lines: [], next: 0 });
    const from = Math.max(0, Math.min(j.lines.length, parseInt(req.query.from, 10) || 0));
    res.json({ job: { id: j.id, action: j.action, state: j.state, error: j.error }, lines: j.lines.slice(from), next: j.lines.length });
  });
}
module.exports = { mount };
