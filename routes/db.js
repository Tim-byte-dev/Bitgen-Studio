// routes/db.js — 🗄 databases (2.842.0, lib/dbServer.js + lib/dbAi.js). Mounted from routes/index.js.
//   GET  /api/db/status                         the server program, the download, each scope, your server
//   POST /api/db/download                       ⬇ MariaDB into <app>/mariadb (progress in status().install)
//   POST /api/db/start|stop {scope}
//   POST /api/db/external {host, port, user, password, database}
//   GET  /api/db/databases?scope=   POST /api/db/create {scope, name}   POST /api/db/drop {scope, name}
//   GET  /api/db/schema?scope=&db=  GET /api/db/rows?scope=&db=&table=&limit=&offset=
//   POST /api/db/sql {scope, db, sql}           -> {results}
//   POST /api/db/ai {scope, db, ask}            -> {sql, explain} (shown before it runs)
"use strict";
const express = require("express");
function mount(app) {
  const D = () => require("../lib/dbServer"), A = () => require("../lib/dbAi");
  const J = express.json({ limit: "5mb" });
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || (e.code && /^ER_/.test(e.code) ? 400 : 500)).json({ error: e.sqlMessage || e.message || String(e) }); } };
  app.get("/api/db/status", wrap(() => D().status()));
  app.post("/api/db/download", J, wrap(() => ({ install: D().download() })));
  app.post("/api/db/start", J, wrap((req) => D().start(req.body.scope)));
  app.post("/api/db/stop", J, wrap((req) => D().stop(req.body.scope)));
  app.post("/api/db/external", J, wrap((req) => ({ external: D().setExternal(req.body || {}) })));
  app.get("/api/db/databases", wrap(async (req) => ({ databases: await D().databases(req.query.scope) })));
  app.post("/api/db/create", J, wrap((req) => D().createDb(req.body.scope, req.body.name)));
  app.post("/api/db/drop", J, wrap((req) => D().dropDb(req.body.scope, req.body.name)));
  app.get("/api/db/schema", wrap((req) => D().schema(req.query.scope, req.query.db)));
  app.get("/api/db/rows", wrap((req) => D().rows(req.query.scope, req.query.db, req.query.table, req.query.limit, req.query.offset)));
  app.post("/api/db/sql", J, wrap((req) => D().run(req.body.scope, req.body.db, req.body.sql)));
  app.post("/api/db/ai", J, wrap(async (req) => { const b = req.body || {}; let schema = null; try { if (b.db) schema = await D().schema(b.scope, b.db); } catch (e) { /* a new one */ } return A().design({ ask: b.ask, schema, db: b.db }); }));
}
module.exports = { mount };
