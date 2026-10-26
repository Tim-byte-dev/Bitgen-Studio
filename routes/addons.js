// bitGen Studio — routes/addons.js (2.540.4): Settings ▸ Add-ons. Mounted by routes/index.js (never server.js);
// the list, the installs and the job are lib/addons.js.
//   GET  /api/addons                  {addons: [...], job}
//   POST /api/addons/:id/install      (also reinstall; 2.557.0 JSON {items: [ids]} = what to download) -> {ok, job} | 409 {error}
//   POST /api/addons/:id/remove       -> {ok, job} | 409 {error}
//   POST /api/addons/:id/install-zip  2.589.0: raw zip bytes (an extension add-on - the Team render farm) -> {ok} | 400 / 409
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
    const reinstall = (req.body || {}).reinstall === true;   // 2.601.0: ⟳ Reinstall - fetch what is already there again
    const r = A.start(String(req.params.id || ""), action, { items, reinstall });
    if (r.error) return res.status(/already/.test(r.error) ? 409 : 400).json(r);
    const j = A.job();
    res.json({ ok: true, external: !!r.external, job: r.external ? null : { id: j.id, action: j.action, state: j.state } });
  };
  // 2.589.0: 📦 Install from a zip… for an add-on that is an extension zip (the Team render farm) - raw bytes
  app.post("/api/addons/:id/install-zip", require("express").raw({ type: () => true, limit: 50 * 1024 * 1024 }), (req, res) => {
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: "no zip was sent" });
    const r = A.startZip(String(req.params.id || ""), req.body);
    if (r.error) return res.status(/already/.test(r.error) ? 409 : 400).json(r);
    res.json({ ok: true });
  });
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
