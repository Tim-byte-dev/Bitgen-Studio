// bitGen Studio — routes/workspaces.js (2.526.0): the WORKSPACE dropdown's memory (lib/workspaces.js, static/workspaces.js).
// Mounted from routes/index.js (never server.js).
//   GET  /api/workspaces              {version, current, saved: {<workspace>: snapshot}}
//   POST /api/workspaces/switch       {from, snap, to} - keeps `from` as it is now, `to` becomes current -> the record
//   POST /api/workspaces/snapshot     {id, snap} - keeps one as it is now (leaving the app: sendBeacon) -> the record
//   POST /api/workspaces/reset        {id | "all"} - its default layout comes back -> the record
"use strict";
const core = require("../lib/core");
const W = require("../lib/workspaces");

function mount(app) {
  const fail = (res, e) => res.status(e.status || 500).json({ error: String((e && e.message) || e) });
  app.get("/api/workspaces", (_req, res) => { try { res.json(W.load(core.BASE)); } catch (e) { fail(res, e); } });
  app.post("/api/workspaces/switch", (req, res) => { try { res.json(W.switchTo(core.BASE, req.body || {})); } catch (e) { fail(res, e); } });
  app.post("/api/workspaces/snapshot", (req, res) => { const b = req.body || {}; try { res.json(W.snapshot(core.BASE, b.id, b.snap)); } catch (e) { fail(res, e); } });
  app.post("/api/workspaces/reset", (req, res) => { try { res.json(W.reset(core.BASE, (req.body || {}).id)); } catch (e) { fail(res, e); } });
}
module.exports = { mount };
