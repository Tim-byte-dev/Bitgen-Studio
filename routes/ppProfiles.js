// bitGen Studio — routes/ppProfiles.js (2.640.0): the Sketcher's own profiles (lib/ppProfiles.js). Mounted from routes/index.js.
//   GET    /api/pushpull-profiles        {profiles}
//   POST   /api/pushpull-profiles        {id?, name, kind, pts} -> {profile, profiles}
//   DELETE /api/pushpull-profiles/:id    {ok, profiles}
"use strict";
const lib = require("../lib/ppProfiles");

function mount(app) {
  const express = require("express");
  const J = express.json({ limit: "2mb" });
  const fail = (res, e) => res.status(e.status || 500).json({ error: String((e && e.message) || e) });
  app.get("/api/pushpull-profiles", (_req, res) => { try { res.json({ profiles: lib.list() }); } catch (e) { fail(res, e); } });
  app.post("/api/pushpull-profiles", J, (req, res) => { try { res.json(lib.save(req.body || {})); } catch (e) { fail(res, e); } });
  app.delete("/api/pushpull-profiles/:id", (req, res) => { try { res.json(lib.remove(req.params.id)); } catch (e) { fail(res, e); } });
}
module.exports = { mount };
