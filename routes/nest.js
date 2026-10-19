// bitGen Studio — routes/nest.js (2.414.0): NESTED SEQUENCES' server side (lib/nest.js). Mounted from routes/index.js.
//   GET  /api/nest/status?names=a,b      {a: {hash, exists, file}}      ↻ out of date when the hash moved on
//   POST /api/nest/check {outer, inner}  {ok} or 400 in words            a timeline cannot hold itself (or a loop)
//   POST /api/nest/adopt {name}          {file, dur, hash}               the compiled nest moved into video/
// /api/export takes `nest: <timeline name>` (routes/index.js): the master is nest_<name>.mp4, no deliverables.
"use strict";
const nest = require("../lib/nest");

function mount(app, core) {
  const express = require("express");
  const J = express.json({ limit: "2mb" });
  const pdir = () => core.projDir(core.getProject());
  const fail = (res, e) => res.status(e.status || 400).json({ ok: false, error: String((e && e.message) || e) });
  app.get("/api/nest/status", (req, res) => {
    try { res.json({ ok: true, status: nest.status(pdir(), String(req.query.names || "").split(",").map((s) => s.trim()).filter(Boolean)) }); }
    catch (e) { fail(res, e); }
  });
  app.post("/api/nest/check", J, (req, res) => {
    const b = req.body || {};
    try {
      if (String(b.outer) === String(b.inner)) throw new Error("a timeline cannot be nested in itself");
      if (nest.cycle(pdir(), String(b.outer || ""), String(b.inner || ""))) throw new Error(`"${b.inner}" already uses "${b.outer}" (directly or through its own nests) - that would be a loop`);
      res.json({ ok: true, hash: nest.hashOf(pdir(), b.inner) });
    } catch (e) { fail(res, e); }
  });
  app.post("/api/nest/adopt", J, (req, res) => {
    try { res.json(Object.assign({ ok: true }, nest.adopt(pdir(), (req.body || {}).name))); } catch (e) { fail(res, e); }
  });
}

module.exports = { mount };
