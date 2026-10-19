// bitGen Studio — routes/styleDoctor.js (2.527.0): 🩺 the Style doctor (lib/styleDoctor.js, static/styledoctor.js).
// Mounted from routes/index.js (never server.js). The test renders themselves go through POST /api/genimage.
//   GET  /api/doctor/styles          every image style [{id, name, arch, model, missing, skip, slots}]
//   POST /api/doctor/ref             the reference picture for the edit styles (Image assets) -> {name}
//   POST /api/doctor/ref/remove      ... removed again at the end of a run
//   GET  /api/doctor/explain/:job    why a job failed -> {kind, line, advice}
//   POST /api/doctor/collect         {job, style} - the test picture out of the gallery -> {thumb}
//   GET  /api/doctor/thumb/:name     a row's picture
//   GET  /api/doctor/report          the last run {at, mode, rows} | {rows: []}
//   POST /api/doctor/report          {mode, rows} - kept (projects/<p>/doctor/report.json)
//   DELETE /api/doctor/report        🗑 the last run and its pictures
//   GET  /api/doctor/report.md       the last run as a .md download
"use strict";
const D = require("../lib/styleDoctor");

function mount(app) {
  const fail = (res, e) => res.status(e.status || 500).json({ error: String((e && e.message) || e) });
  const wrap = (fn) => (req, res) => { try { fn(req, res); } catch (e) { fail(res, e); } };
  app.get("/api/doctor/styles", wrap((_req, res) => res.json(D.list())));
  app.post("/api/doctor/ref", wrap((_req, res) => res.json({ name: D.ensureRef() })));
  app.post("/api/doctor/ref/remove", wrap((_req, res) => res.json({ ok: D.removeRef() })));
  app.get("/api/doctor/explain/:job", wrap((req, res) => {
    const job = require("../lib/core").jobs.get(req.params.job);
    if (!job) return res.status(404).json({ error: "no such job (the app was restarted?)" });
    const out = D.explain(job.log || []);
    try { require("../lib/testPlan").event("style_doctor_explain", { what: req.params.job }); } catch { /* the 🧪 checklist (2.532.0) */ }
    res.json(out);
  }));
  app.post("/api/doctor/collect", wrap((req, res) => res.json(D.collect((req.body || {}).job, (req.body || {}).style))));
  app.get("/api/doctor/thumb/:name", wrap((req, res) => { const f = D.thumbPath(req.params.name); if (!f) return res.status(404).end(); res.set("Cache-Control", "no-store"); res.sendFile(f); }));
  app.get("/api/doctor/report", wrap((_req, res) => res.json(D.loadReport() || { rows: [] })));
  app.post("/api/doctor/report", wrap((req, res) => res.json(D.saveReport(req.body || {}))));
  app.delete("/api/doctor/report", wrap((_req, res) => res.json({ removed: D.clearReport() })));
  app.get("/api/doctor/report.md", wrap((_req, res) => {
    let v = ""; try { v = require("../package.json").version; } catch { v = ""; }
    res.set("Content-Type", "text/markdown; charset=utf-8");
    res.set("Content-Disposition", 'attachment; filename="style-doctor.md"');
    res.send(D.toMarkdown(D.loadReport() || { rows: [] }, v));
  }));
}
module.exports = { mount };
