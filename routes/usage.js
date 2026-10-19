// bitGen Studio — routes/usage.js (2.520.0): 📊 the usage log (lib/usageLog.js). Mounted from routes/index.js.
//   GET /api/usage?from=YYYY-MM-DD&to=YYYY-MM-DD     {days, jobs, totals}
//   GET /api/usage/csv?kind=jobs|days&from&to        the same as a .csv download
"use strict";
const U = require("../lib/usageLog");

function mount(app) {
  U.start();                                            // the 5-minute day ticker
  const day = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : "");
  app.get("/api/usage", (req, res) => {
    try { res.json(U.query(day(req.query.from), day(req.query.to))); } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
  app.get("/api/usage/csv", (req, res) => {
    try {
      const kind = req.query.kind === "days" ? "days" : "jobs", from = day(req.query.from), to = day(req.query.to);
      const q = U.query(from, to);
      res.set("Content-Type", "text/csv; charset=utf-8");
      res.set("Content-Disposition", `attachment; filename="bitgen-usage-${kind}${from ? "-" + from : ""}${to ? "-to-" + to : ""}.csv"`);
      res.send(U.toCsv(kind, kind === "days" ? q.days : q.jobs));
    } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
}
module.exports = { mount };
