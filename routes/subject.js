// bitGen Studio — routes/subject.js (2.488.0): Select Subject with the AI matte (lib/subjectMatte.js).
// Mounted from routes/index.js (never server.js).
//   GET  /api/subject/status                 {ai, installing, models}
//   POST /api/subject/install                the AI matte's venv, in the background (lib/matte.js)
//   POST /api/subject/matte?model=&fake=1    body: the PNG  →  the mask PNG (fake only with H3_E2E=1 - the tests)
"use strict";
const subj = require("../lib/subjectMatte");

function mount(app) {
  const express = require("express");
  const fail = (res, e) => res.status(e.status || 500).json({ error: String((e && e.message) || e) });
  app.get("/api/subject/status", (_req, res) => { try { res.json(subj.status()); } catch (e) { fail(res, e); } });
  app.post("/api/subject/install", express.json(), (req, res) => { try { res.json(subj.install(req.body || {})); } catch (e) { fail(res, e); } });
  app.post("/api/subject/matte", express.raw({ type: () => true, limit: subj.MAX }), async (req, res) => {
    try {
      const fake = req.query.fake === "1" && process.env.H3_E2E === "1";
      const out = await subj.run(req.body, { model: String(req.query.model || ""), fake });
      res.set("Content-Type", "image/png").send(out);
    } catch (e) { fail(res, e); }
  });
}
module.exports = { mount };
