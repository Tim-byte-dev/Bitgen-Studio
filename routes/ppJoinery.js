// bitGen Studio — routes/ppJoinery.js (2.689.0): the Sketcher's cupboard / shelving templates (lib/ppJoinery.js). Mounted
// from routes/index.js.
//   GET    /api/pushpull-joinery        {templates}
//   POST   /api/pushpull-joinery        {id?, name, spec} -> {template, templates}
//   DELETE /api/pushpull-joinery/:id    {ok, templates}
"use strict";
const lib = require("../lib/ppJoinery");

function mount(app) {
  const express = require("express");
  const J = express.json({ limit: "1mb" });
  const fail = (res, e) => res.status(e.status || 500).json({ error: String((e && e.message) || e) });
  app.get("/api/pushpull-joinery", (_req, res) => { try { res.json({ templates: lib.list() }); } catch (e) { fail(res, e); } });
  app.post("/api/pushpull-joinery", J, (req, res) => { try { res.json(lib.save(req.body || {})); } catch (e) { fail(res, e); } });
  app.delete("/api/pushpull-joinery/:id", (req, res) => { try { res.json(lib.remove(String(req.params.id))); } catch (e) { fail(res, e); } });
}
module.exports = { mount };
