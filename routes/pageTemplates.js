// bitGen Studio — routes/pageTemplates.js (2.846.0): your page templates (lib/pageTemplates.js).
//   GET /api/pagetemplates   POST /api/pagetemplates/save {template}   POST /api/pagetemplates/delete {name}
"use strict";
const express = require("express");
function mount(app) {
  const L = () => require("../lib/pageTemplates");
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: e.message || String(e) }); } };
  const J = express.json({ limit: "64kb" });
  app.get("/api/pagetemplates", wrap(() => ({ templates: L().list() })));
  app.post("/api/pagetemplates/save", J, wrap((req) => ({ template: L().save((req.body || {}).template) })));
  app.post("/api/pagetemplates/delete", J, wrap((req) => L().remove((req.body || {}).name)));
}
module.exports = { mount };
