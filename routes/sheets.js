// bitGen Studio — ▦ Spreadsheet (2.822.0). Mounted from routes/index.js (never server.js); the work is lib/sheetFiles.js.
//   GET    /api/sheets                  [{name, size, mtime}] - the project's workbooks
//   GET    /api/sheets/file?name=       the workbook
//   POST   /api/sheets/file             {name, doc} -> {name, size}
//   DELETE /api/sheets/file?name=
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
}
module.exports = { mount };
