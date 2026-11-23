// bitGen Studio — routes/updater.js (2.540.5): ⟳ Update from GitHub (Settings ▸ General ▸ Updates).
// Mounted by routes/index.js (never server.js); the work is lib/updater.js.
//   GET  /api/update/info            {version, mode: git | zip, repo, branch}
//   POST /api/update/check           {current, latest, newer, behind, ahead, commits[], error}
//   POST /api/update/start           -> {ok} | 409 {error}   (one at a time)
//   GET  /api/update/job?from=N      {job: {state, from, to, restart, error}, lines[], next}
//   GET/POST /api/update/settings    {auto_check} - 2.573.0: the check on startup (bitGen Studio + ComfyUI), on by default
//   2.925.0 (Tim: "is there a way to make the phone app update from github? instead of contantly copying and pasting?" ->
//   "B) PC auto-updates") - lib/autoUpdate.js, its loop started here:
//   GET  /api/update/auto            {settings: {auto, every_h, app}, state, busy}
//   POST /api/update/auto            {auto, every_h, app} -> settings
//   POST /api/update/auto/check      {app_only} - look now (in the background) -> state
//   POST /api/update/auto/later      the restart bar's Later (an hour)
//   POST /api/update/auto/e2e        H3_E2E only: {restart: {from, to}} | {clear: true} - the suite's way to show the bar
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
  const AU = require("../lib/autoUpdate");
  const autoView = () => ({ settings: AU.settings(), state: Object.assign(AU.state(), { busy: AU.busyNow() }) });   // busy: now, not at the last tick
  app.get("/api/update/auto", (_req, res) => { try { res.json(autoView()); } catch (e) { res.status(500).json({ error: String(e.message || e) }); } });
  app.post("/api/update/auto", (req, res) => { try { AU.setSettings(req.body || {}); res.json(autoView()); } catch (e) { res.status(500).json({ error: String(e.message || e) }); } });
  app.post("/api/update/auto/check", (req, res) => {
    const b = req.body || {};
    AU.tick({ force: !b.app_only, appOnly: !!b.app_only }).catch(() => {});
    setTimeout(() => res.json(autoView()), 300);
  });
  app.post("/api/update/auto/later", (_req, res) => { AU.later(3600000); res.json(autoView()); });
  app.post("/api/update/auto/e2e", (req, res) => {
    if (process.env.H3_E2E !== "1") return res.status(404).json({ error: "not here" });
    const b = req.body || {};
    if (b.clear) { AU._reset(); return res.json(autoView()); }
    if (b.restart) { AU._S.restart = { from: String(b.restart.from || ""), to: String(b.restart.to || ""), at: Date.now() }; AU._S.state = "restart"; AU._S.later_until = 0; AU._S.note = "updated (the suite)"; }
    res.json(autoView());
  });
  AU.startLoop();
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
