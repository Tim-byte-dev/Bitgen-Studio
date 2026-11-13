// bitGen Studio — routes/genStats.js (2.771.0): 📊 the Statistics dialog (lib/genStats.js). Mounted from routes/index.js.
//   GET /api/genstats?from=YYYY-MM-DD&to=YYYY-MM-DD        {gens, preps, totals}
//   GET /api/genstats/csv?kind=gens|preps&from&to           the same as a .csv download
"use strict";
const G = require("../lib/genStats");

function mount(app) {
  const day = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : "");
  app.get("/api/genstats", (req, res) => {
    try { res.json(G.query(day(req.query.from), day(req.query.to))); } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
  });
  app.get("/api/genstats/csv", (req, res) => {
    try {
      const kind = req.query.kind === "preps" ? "preps" : "gens", from = day(req.query.from), to = day(req.query.to), q = G.query(from, to);
      res.set("Content-Type", "text/csv; charset=utf-8");
      res.set("Content-Disposition", `attachment; filename="bitgen-statistics-${kind}${from ? "-" + from : ""}${to ? "-to-" + to : ""}.csv"`);
      res.send(G.toCsv(kind, kind === "preps" ? q.preps : q.gens));
    } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
  });
}
module.exports = { mount };
