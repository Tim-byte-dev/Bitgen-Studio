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
//   2.857.0 🗄 the CRM's live database (lib/webDb.js): GET /api/web/db {linked, scope, name, ok, counts} · POST /api/web/db/create
//   {scope project|external, name?, importLocal?} · POST /api/web/db/unlink. While linked, /api/web/records for clients / bookings /
//   orders / messages read + write that database (posts / products stay in www/data/content.json).
//   2.859.0 🧩: GET /api/web/skills · POST /api/web/skills/add {id} -> {copied, kept, head, scripts, snippet} · POST /api/web/skills/ai {ask, skills?}
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
  const DB = () => require("../lib/webDb"), live = (k) => DB().CRM.includes(k) && !!DB().link();
  app.get("/api/web/records", wrap((req) => live(req.query.kind) ? DB().list(req.query.kind) : W().records(req.query.kind)));
  app.post("/api/web/records", J, wrap((req) => live(req.body.kind) ? DB().put(req.body.kind, req.body.record) : W().saveRecord(req.body.kind, req.body.record)));
  // 2.859.0 🧩 web skills (lib/webSkills.js; web/skills/<id>/): the list, ＋ add one (its files into www), ✨ a section by the LLM
  const SK = () => require("../lib/webSkills");
  app.get("/api/web/skills", wrap(() => SK().list()));
  app.post("/api/web/skills/add", J, wrap((req) => SK().install((req.body || {}).id)));
  app.post("/api/web/skills/ai", J, wrap((req) => SK().ai(req.body || {})));
  app.get("/api/web/db", wrap(() => DB().status()));
  // 2.858.0: ⤴ publish www to GitHub (lib/sitePublish.js pushDir - the same rules as Build Website's publish)
  app.get("/api/web/publish", wrap(() => require("../lib/sitePublish").wwwSettings()));
  app.post("/api/web/publish", J, wrap((req) => require("../lib/sitePublish").publishWww(req.body || {})));
  app.post("/api/web/db/create", J, wrap((req) => DB().create(req.body || {})));
  app.post("/api/web/db/unlink", J, wrap(() => DB().unlink()));
  app.get(/^\/web-preview(\/.*)?$/, (req, res) => {
    try { const rel = decodeURIComponent((req.params[0] || "/").slice(1)); res.set("Cache-Control", "no-store"); res.sendFile(W().file(rel), { dotfiles: "deny" }); }
    catch (e) { res.status(e.status || 500).type("text/plain").send(e.message); }
  });
}
module.exports = { mount };
