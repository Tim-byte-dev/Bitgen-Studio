// bitGen Studio — routes/security.js (2.940.0): 🔒 Settings ▸ Security (lib/security.js).
//   GET  /api/security          {ask, user, name, hasPassword} - never the hash
//   POST /api/security          {ask, user, name, password} -> the same; 400 with the reason when it can't be saved
//   POST /api/security/login    {user, password} -> {ok} - a wrong pair waits 0.8 s, so guessing is slow
"use strict";
function mount(app) {
  const S = () => require("../lib/security");
  app.get("/api/security", (_req, res) => { try { res.json(S().pub()); } catch (e) { res.status(500).json({ error: String(e.message || e) }); } });
  app.post("/api/security", (req, res) => {
    try { res.json(S().save(req.body || {})); } catch (e) { res.status(400).json({ error: String(e.message || e) }); }
  });
  app.post("/api/security/login", (req, res) => {
    const b = req.body || {};
    let ok = false; try { ok = S().login(b.user, b.password); } catch (e) { ok = false; }
    if (ok) return res.json({ ok: true, name: S().displayName() });
    setTimeout(() => res.status(401).json({ ok: false, error: "That username and password don't match." }), 800);
  });
}
module.exports = { mount };
