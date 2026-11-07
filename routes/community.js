// bitGen Studio — routes/community.js (2.710.0): the 💬 Community panel's routes (lib/community.js does the work).
//   GET  /api/community                 {url, handle, display, joined}
//   POST /api/community/url    {url}    the community server's address
//   POST /api/community/join   {handle, password, display?, first_name, last_name, email (register), mode: register | login, url?}
//   POST /api/community/signout
//   POST /api/community/leave  {password}
//   POST /api/community/call/:action {…}  one community action for the signed-in user (lib/community.js ACTIONS)
// Tim: "i would like to make bitgen a community, can we add a little chat to bitgen like fb"
"use strict";
const C = require("../lib/community");

function mount(app) {
  const fail = (res, e) => res.status(e.status || 500).json({ ok: false, error: String(e.message || e) });
  app.get("/api/community", (_req, res) => { try { res.json(Object.assign({ ok: true }, C.state())); } catch (e) { fail(res, e); } });
  app.post("/api/community/url", (req, res) => { try { res.json(Object.assign({ ok: true }, C.setUrl((req.body || {}).url))); } catch (e) { fail(res, e); } });
  app.post("/api/community/join", async (req, res) => { try { res.json(Object.assign({ ok: true }, await C.join(req.body || {}))); } catch (e) { fail(res, e); } });
  app.post("/api/community/signout", async (_req, res) => { try { res.json(Object.assign({ ok: true }, await C.signOut())); } catch (e) { fail(res, e); } });
  app.post("/api/community/leave", async (req, res) => { try { res.json(Object.assign({ ok: true }, await C.leave((req.body || {}).password))); } catch (e) { fail(res, e); } });
  app.post("/api/community/call/:action", async (req, res) => {
    try { const j = await C.call(req.params.action, req.body || {}); res.status(j.ok ? 200 : (j.status >= 400 ? j.status : 502)).json(j); } catch (e) { fail(res, e); }
  });
}
module.exports = { mount };
