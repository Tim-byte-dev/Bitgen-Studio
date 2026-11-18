// routes/webEditor.js — 2.856.0 🌐 the Web editor docker's server side (lib/webProject.js). Mounted from routes/index.js.
//   GET  /api/web                      {has, root, folders}        has = the open project has a www folder
//   POST /api/web/create               {site?} -> {made, kept}     make projects/<p>/www + its folders + starter pages
//   GET  /api/web/tree                 {files [{path, dir, size, mtime, text, pic}]}
//   GET  /api/web/file?path=           {path, text, mtime}  (text files)
//   POST /api/web/file                 {path, text, mtime?} -> {path, size, mtime}   409 = changed on disk since
//   POST /api/web/mkdir {path} · /api/web/rename {from, to} · /api/web/delete {path} (moved to web/trash) · /api/web/upload {path, b64}
//   GET  /api/web/pages                🗂 CMS pages {pages [{path, title, description, h1}]};  POST /api/web/pages {path, title?, description?, h1?}
//   GET  /api/web/records?kind=        posts | products (www/data/content.json) · clients | bookings | orders | messages (web/crm.json)
//   POST /api/web/records              {kind, record} (record.remove = take it out) -> {items, saved}
//   GET  /web-preview/<path>           the site as files (the Preview + WYSIWYG tabs; no PHP is run)
"use strict";
const express = require("express");
function wrap(fn) { return async (req, res) => { try { res.json(await fn(req, res)); } catch (e) { res.status(e.status || 500).json({ error: e.message || String(e) }); } }; }
function mount(app) {
  const W = () => require("../lib/webProject"), J = express.json({ limit: "90mb" });
  app.get("/api/web", wrap(() => ({ has: W().has(), root: "www", folders: W().FOLDERS })));
  app.post("/api/web/create", J, wrap((req) => W().create(undefined, (req.body || {}).site)));
  app.get("/api/web/tree", wrap(() => W().tree()));
  app.get("/api/web/file", wrap((req) => W().read(req.query.path)));
  app.post("/api/web/file", J, wrap((req) => W().write(req.body.path, req.body.text, req.body.mtime)));
  app.post("/api/web/mkdir", J, wrap((req) => W().mkdir(req.body.path)));
  app.post("/api/web/rename", J, wrap((req) => W().rename(req.body.from, req.body.to)));
  app.post("/api/web/delete", J, wrap((req) => W().remove(req.body.path)));
  app.post("/api/web/upload", J, wrap((req) => W().upload(req.body.path, req.body.b64)));
  app.get("/api/web/pages", wrap(() => W().pages()));
  app.post("/api/web/pages", J, wrap((req) => W().setPage(req.body.path, req.body)));
  app.get("/api/web/records", wrap((req) => W().records(req.query.kind)));
  app.post("/api/web/records", J, wrap((req) => W().saveRecord(req.body.kind, req.body.record)));
  app.get(/^\/web-preview(\/.*)?$/, (req, res) => {
    try { const rel = decodeURIComponent((req.params[0] || "/").slice(1)); res.set("Cache-Control", "no-store"); res.sendFile(W().file(rel), { dotfiles: "deny" }); }
    catch (e) { res.status(e.status || 500).type("text/plain").send(e.message); }
  });
}
module.exports = { mount };
