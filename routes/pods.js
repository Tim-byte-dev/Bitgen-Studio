// bitGen Studio — routes/pods.js (2.756.0): the PODS docker (static/podsdock.js, lib/pods.js). Mounted from routes/index.js.
//   GET  /api/pods/templates?source=official|verified|community&comfy=1&q=&refresh=1   {source, templates, total}
//   GET  /api/pods/gpus?cloud=SECURE|COMMUNITY        {cloud, gpus: [{id, name, memory, price, availability, offered, max}]}
//   POST /api/pods/create  {templateId, name, gpu, count, cloud, disk, volume, port}   -> {pod, port} (remembered as bitGen's)
//   GET  /api/pods/mine                               {pods: [... + bitgen]}
//   POST /api/pods/:id/:action   start | stop | terminate
"use strict";
const P = require("../lib/pods");

function mount(app) {
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: String((e && e.message) || e) }); } };
  app.get("/api/pods/templates", wrap((req) => P.templates({ source: req.query.source, comfy: req.query.comfy === "1", q: req.query.q, refresh: req.query.refresh === "1" })));
  app.get("/api/pods/gpus", wrap((req) => P.gpus(req.query.cloud)));
  app.post("/api/pods/create", wrap((req) => P.create(req.body || {})));
  app.get("/api/pods/mine", wrap(() => P.mine()));
  app.post("/api/pods/:id/:action", wrap((req) => {
    if (!["start", "stop", "terminate"].includes(req.params.action)) { const e = new Error("start, stop or terminate"); e.status = 400; throw e; }
    return P.act(req.params.id, req.params.action);
  }));
}
module.exports = { mount };
