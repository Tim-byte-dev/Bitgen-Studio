// bitGen Studio — routes/costs.js (2.771.0): 💲 the Costs docker (lib/costs.js). Mounted from routes/index.js.
//   GET /api/costs?range=today|week|month|last|all(&refresh=1)   {range, from, to, currency, rows: [...], total}
//   GET /api/costs/:id?range=…                                    one platform's list (local, runpod, openrouter, api:<id>, remote)
"use strict";
const C = require("../lib/costs");

function mount(app) {
  const rg = (q) => (C.RANGES.includes(String(q.range || "")) ? String(q.range) : "month");
  app.get("/api/costs", async (req, res) => {
    try { res.json(await C.summary(rg(req.query), req.query.refresh === "1")); } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
  });
  app.get("/api/costs/:id", async (req, res) => {
    const id = String(req.params.id || "").replace(/[^A-Za-z0-9:_-]/g, "").slice(0, 60);
    try { res.json(await C.detail(id, rg(req.query), req.query.refresh === "1")); } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
  });
}
module.exports = { mount };
