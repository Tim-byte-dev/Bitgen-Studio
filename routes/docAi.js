// routes/docAi.js — 📄 ✨ the WP layer's document by the LLM (2.837.0, lib/docAi.js). Mounted from routes/index.js.
//   POST /api/docai/plan     {ask, text, kind, words, pictures, charts, tables} -> {doc}
//   POST /api/docai/extract?name=  (raw body: a .txt / .md / .csv / .docx) -> {text}
"use strict";
const express = require("express");
function mount(app) {
  const J = express.json({ limit: "20mb" });
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: e.message || String(e) }); } };
  const A = () => require("../lib/docAi");
  app.post("/api/docai/plan", J, wrap((req) => A().planDoc(req.body || {})));
  app.post("/api/docai/extract", express.raw({ type: () => true, limit: "60mb" }), wrap((req) => A().extract(req.query.name, req.body)));
}
module.exports = { mount };
