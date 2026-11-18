// routes/docTemplates.js — 🧾 the image editor's document templates (2.841.0, lib/docTemplates.js). Mounted from routes/index.js.
//   GET  /api/doctemplates                     -> {templates}
//   POST /api/doctemplates/save?name=&kind=&prefix=…   raw .bgi body -> {meta}
//   GET  /api/doctemplates/file?name=          -> the .bgi
//   POST /api/doctemplates/meta  {name, meta}  -> {meta}        (the number counter, defaults, tax …)
//   POST /api/doctemplates/number {name, peek} -> {number, meta}
//   POST /api/doctemplates/delete {name}
//   POST /api/doctemplates/ai {ask, fields, kind, currency, today, items} -> {fields, items}
"use strict";
const express = require("express");
function mount(app) {
  const T = () => require("../lib/docTemplates");
  const J = express.json({ limit: "2mb" });
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: e.message || String(e) }); } };
  app.get("/api/doctemplates", wrap(() => ({ templates: T().list() })));
  app.post("/api/doctemplates/save", express.raw({ type: () => true, limit: "210mb" }), wrap((req) => {
    const q = req.query || {}, meta = {}; for (const k of ["kind", "prefix", "digits", "taxRate", "currency", "dueDays"]) if (q[k] != null) meta[k] = q[k];
    return { meta: T().save(q.name, req.body, meta) };
  }));
  app.get("/api/doctemplates/file", (req, res) => { try { res.type("application/zip").sendFile(T().file(req.query.name)); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } });
  app.post("/api/doctemplates/meta", J, wrap((req) => ({ meta: T().setMeta(req.body.name, req.body.meta) })));
  app.post("/api/doctemplates/number", J, wrap((req) => T().nextNumber(req.body.name, !!req.body.peek)));
  app.post("/api/doctemplates/delete", J, wrap((req) => T().remove(req.body.name)));
  app.post("/api/doctemplates/ai", J, wrap((req) => T().fillPlan(req.body || {})));
}
module.exports = { mount };
