// bitGen Studio — routes/testPlan.js (2.518.0): the 🧪 Testing docker (lib/testPlan.js).
// Mounted from routes/index.js (never server.js).
//   GET  /api/testplan              {version, groups, rows: [{id, title, group, state, how, note, manual, auto}], pass, fail, todo}
//   POST /api/testplan/mark  {id, state: pass|fail|skip|"", note, suggest}
//   POST /api/testplan/retest {id}                2.534.0: ↺ test it again (its mark + the events that ticked it go)
//   POST /api/testplan/mode  {on}                 2.534.0: 🧪 Test mode (off = nothing ticks, nothing is suggested)
//   POST /api/testplan/event {event, what}   2.532.0: what the page saw (palette_run, house_select ... - lib/testPlan CLIENT_EVENTS)
//   POST /api/testplan/clear
//   GET  /api/testplan/report       the log as a download (text/plain, attachment)
"use strict";
const tp = require("../lib/testPlan");

function mount(app) {
  const fail = (res, e) => res.status(500).json({ error: String((e && e.message) || e) });
  app.get("/api/testplan", async (_req, res) => { try { res.json(await tp.status()); } catch (e) { fail(res, e); } });
  app.post("/api/testplan/mark", (req, res) => {
    try { const b = req.body || {}; const r = tp.mark(String(b.id || ""), String(b.state || ""), b.note, b.suggest); if (r.error) return res.status(400).json(r); res.json(r); } catch (e) { fail(res, e); }
  });
  app.post("/api/testplan/retest", (req, res) => { try { const r = tp.retest(String((req.body || {}).id || "")); if (r.error) return res.status(400).json(r); res.json(r); } catch (e) { fail(res, e); } });
  app.post("/api/testplan/mode", (req, res) => { try { res.json(tp.setMode(!!(req.body || {}).on)); } catch (e) { fail(res, e); } });   // 2.534.0
  app.post("/api/testplan/event", (req, res) => {
    try { const b = req.body || {}; const r = tp.clientEvent(b.event, b.what); if (r.error) return res.status(400).json(r); res.json(r); } catch (e) { fail(res, e); }
  });
  app.post("/api/testplan/clear", (_req, res) => { try { res.json(tp.clear()); } catch (e) { fail(res, e); } });
  app.get("/api/testplan/report", async (_req, res) => {
    try {
      const r = await tp.report();
      res.set("Content-Type", "text/plain; charset=utf-8");
      res.set("Content-Disposition", `attachment; filename="${r.name}"`);
      res.send(r.text);
    } catch (e) { fail(res, e); }
  });
}
module.exports = { mount };
