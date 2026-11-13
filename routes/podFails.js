/* bitGen Studio — routes/podFails.js (2.778.0): FILES THAT DID NOT GET ONTO A POD - the page asks ↻ Try again (lib/podFails.js).
 *   GET  /api/pods/fails              -> {fails: [{id, pod, name, how, why, words, styles, at, asked, tries, retrying}]}
 *   POST /api/pods/fails/:id/retry    -> {started, pod, styles, files} (the pod's failed styles made ready again)
 *   POST /api/pods/fails/:id/dismiss  -> {ok} (not asked again until it fails again)
 */
"use strict";
function mount(app) {
  const F = () => require("../lib/podFails");
  app.get("/api/pods/fails", (req, res) => res.json({ fails: F().list() }));
  app.post("/api/pods/fails/:id/retry", (req, res) => { try { res.json(F().retry(req.params.id)); } catch (e) { res.status(e.status || 500).json({ error: String(e.message || e) }); } });
  app.post("/api/pods/fails/:id/dismiss", (req, res) => res.json({ ok: F().dismiss(req.params.id) }));
  // the browser test's failures (H3_E2E=1 only) - {pod, styles: [{id, name}], fails: [{name, how, why}]}
  if (process.env.H3_E2E === "1") app.post("/api/pods/fails-e2e", (req, res) => { const b = req.body || {}; F().note(b.pod, b.styles || [], b.fails || []); res.json({ fails: F().list() }); });
}
module.exports = { mount };
