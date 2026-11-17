// bitGen Studio — ▦ Spreadsheet (2.822.0). Mounted from routes/index.js (never server.js); the work is lib/sheetFiles.js.
//   GET    /api/sheets                  [{name, size, mtime}] - the project's workbooks
//   GET    /api/sheets/file?name=       the workbook
//   POST   /api/sheets/file             {name, doc} -> {name, size}
//   DELETE /api/sheets/file?name=
//   2.824.0 (lib/sheetXlsx.js, lib/sheetAi.js):
//   POST   /api/sheets/import?name=     an .xlsx (raw body) -> {doc, notes}
//   POST   /api/sheets/export           {name, doc, results} -> the .xlsx (also kept in the project's sheets folder)
//   POST   /api/sheets/ai/dashboard     {profile, ask} -> {plan} (the LLM's dashboard plan)
//   2.825.0 ✨ AI in the cells (lib/sheetAi.js; the page checks every answer):
//   POST   /api/sheets/ai/formula       {context, ask, functions} -> {formula, explain}
//   POST   /api/sheets/ai/explain       {context, formula, values} -> {text}
//   POST   /api/sheets/ai/fill          {context, examples, failed, functions} -> {formula, explain}
//   POST   /api/sheets/ai/fillvalues    {context, examples, rows} -> {values}
"use strict";
const express = require("express");
const SF = require("../lib/sheetFiles");
function wrap(fn) {
  return async (req, res) => { try { res.json(await fn(req, res)); } catch (e) { res.status(e.status || 500).json({ error: e.message || String(e) }); } };
}
function mount(app) {
  const J = express.json({ limit: "45mb" });
  app.get("/api/sheets", wrap(() => ({ files: SF.list() })));
  app.get("/api/sheets/file", wrap((req) => SF.read(req.query.name)));
  app.post("/api/sheets/file", J, wrap((req) => SF.write((req.body || {}).name, (req.body || {}).doc)));
  app.delete("/api/sheets/file", wrap((req) => SF.remove(req.query.name)));
  app.post("/api/sheets/import", express.raw({ type: () => true, limit: "60mb" }), wrap(async (req) => {
    if (!req.body || !req.body.length) throw Object.assign(new Error("no file came"), { status: 400 });
    if (req.body[0] !== 0x50 || req.body[1] !== 0x4b) throw Object.assign(new Error("that is not an .xlsx workbook (an older .xls? save it as .xlsx first)"), { status: 400 });
    const d = await require("../lib/sheetXlsx").fromXlsx(req.body);
    return { doc: SF.clean(d), notes: d.notes };
  }));
  app.post("/api/sheets/export", J, async (req, res) => {
    try {
      const b = req.body || {}, buf = await require("../lib/sheetXlsx").toXlsx(b.doc, b.results);
      const name = SF.safeName(b.name).replace(/\.bgs$/i, ".xlsx");
      try { require("fs").writeFileSync(require("path").join(SF.dir(), name), buf); } catch (e) { /* the download still goes */ }
      res.set({ "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${encodeURIComponent(name)}"`, "X-File-Name": encodeURIComponent(name) });
      res.send(buf);
    } catch (e) { res.status(e.status || 500).json({ error: e.message || String(e) }); }
  });
  app.post("/api/sheets/ai/dashboard", J, wrap((req) => require("../lib/sheetAi").dashboardPlan((req.body || {}).profile, (req.body || {}).ask)));
  const AI = () => require("../lib/sheetAi"), B = (req) => req.body || {};
  app.post("/api/sheets/ai/formula", J, wrap((req) => AI().writeFormula(B(req).context, B(req).ask, B(req).functions)));
  app.post("/api/sheets/ai/explain", J, wrap((req) => AI().explainFormula(B(req).context, B(req).formula, B(req).values)));
  app.post("/api/sheets/ai/fill", J, wrap((req) => AI().fillFormula(B(req).context, B(req).examples, B(req).failed, B(req).functions)));
  app.post("/api/sheets/ai/fillvalues", J, wrap((req) => AI().fillValues(B(req).context, B(req).examples, B(req).rows)));
}
module.exports = { mount };
