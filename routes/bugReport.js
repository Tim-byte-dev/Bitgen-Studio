// bitGen Studio — routes/bugReport.js (2.522.0): the 🐞 Bug report docker (lib/bugReport.js, static/bugreport.js).
// Mounted from routes/index.js (never server.js). Starts the app-console ring (lib/appLog.js).
//   GET    /api/bugreport/preview        {system, settings (secrets hidden), logs {file: {lines, tail}}, severities}
//   POST   /api/bugreport                body = JSON as TEXT (the screenshot makes it big - the global JSON parser stops at
//                                        100 kb): {title, severity, area, happened, expected, steps, recorded, page_errors,
//                                        failed_requests, page, include, screenshot (a data:image/png;base64 URL)} -> {id}
//   GET    /api/bugreport                the saved reports, newest first
//   GET    /api/bugreport/zip/:id        the report as one .zip (the file to send)
//   GET    /api/bugreport/shot/:id       its screenshot          DELETE /api/bugreport/:id
"use strict";
const B = require("../lib/bugReport");

function mount(app) {
  require("../lib/appLog").start();
  const express = require("express");
  const fail = (res, e) => res.status(e.status || 500).json({ error: String((e && e.message) || e) });
  const wrap = (fn) => async (req, res) => { try { await fn(req, res); } catch (e) { fail(res, e); } };
  app.get("/api/bugreport/preview", wrap(async (_req, res) => res.json(await B.preview())));
  app.get("/api/bugreport", wrap((_req, res) => res.json(B.list())));
  app.post("/api/bugreport", express.text({ type: () => true, limit: "40mb" }), wrap(async (req, res) => {
    let body = {};
    try { body = JSON.parse(typeof req.body === "string" ? req.body : "{}"); } catch { return res.status(400).json({ error: "the report is not JSON" }); }
    const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(body.screenshot || ""));
    res.json(Object.assign({ ok: true }, await B.save(body, m ? Buffer.from(m[1], "base64") : null)));
  }));
  app.get("/api/bugreport/zip/:id", wrap((req, res) => {
    const z = B.zip(req.params.id);
    res.set("Content-Type", "application/zip");
    res.set("Content-Disposition", `attachment; filename="${z.name}"`);
    res.send(z.data);
  }));
  app.get("/api/bugreport/shot/:id", wrap((req, res) => { const f = B.screenshot(req.params.id); if (!f) return res.status(404).end(); res.sendFile(f); }));
  app.delete("/api/bugreport/:id", wrap((req, res) => res.json({ ok: B.remove(req.params.id) })));
}
module.exports = { mount };
