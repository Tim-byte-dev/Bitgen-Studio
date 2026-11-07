// bitGen Studio — routes/langPacks.js (2.715.0): LANGUAGE PACKS (lib/langPacks.js) - Settings ▸ Languages and the app's
// language list. Mounted from routes/index.js (never server.js).
// Tim: "lets do number 2, this way we don't have to create all the packs at once - if we could have a master pack so users
// can translate the strings and upload to tigerart for the community it would be ideal"
//   GET  /api/langpacks                 {packs: [{id, name, native, browser, keepAll, words, source, replaces, version, …}]}
//   GET  /api/langpacks/master.zip      the master pack (every part in English, id "xx") to translate
//   GET  /api/langpacks/:id/ui.json     a pack's app words (static/uilang.js loads it)
//   GET  /api/langpacks/:id/coverage    {ui, patterns, guide, shortcuts, help, features, site: {done, total}}
//   GET  /api/langpacks/:id/export.zip  the pack with today's English parts added, its translations kept
//   POST /api/langpacks/check           (the .zip as the body) {pack, warnings, installed} - read, nothing written
//   POST /api/langpacks/install[?replace=1]  (the .zip) {pack, warnings, coverage}; 409 {exists} when installed and no replace
//   POST /api/langpacks/remove          {id} -> {removed}
"use strict";
const express = require("express");
const LP = require("../lib/langPacks");
const fail = (res, e) => res.status(e.status || 500).json(Object.assign({ error: String((e && e.message) || e) }, e && e.exists ? { exists: true, id: e.id, native: e.native } : {}));
const zipOut = (res, name, buf) => { res.set("Content-Type", "application/zip"); res.set("Content-Disposition", `attachment; filename="${name}"`); res.set("Cache-Control", "no-store"); res.send(buf); };
const raw = express.raw({ type: () => true, limit: LP.MAX_ZIP + 1024 });

function mount(app) {
  app.get("/api/langpacks", (_req, res) => { try { res.set("Cache-Control", "no-store"); res.json({ packs: LP.list() }); } catch (e) { fail(res, e); } });
  app.get("/api/langpacks/master.zip", (_req, res) => { try { zipOut(res, "bitGen-language-pack-master.zip", LP.masterZip()); } catch (e) { fail(res, e); } });
  app.get("/api/langpacks/:id/ui.json", (req, res) => {
    try {
      const f = LP.files(req.params.id);
      if (!f) return res.status(404).json({ error: "no language pack " + req.params.id });
      res.set("Cache-Control", "no-cache"); res.type("application/json").sendFile(f.ui, (err) => { if (err && !res.headersSent) res.status(404).json({ error: "the pack has no ui.json" }); });
    } catch (e) { fail(res, e); }
  });
  app.get("/api/langpacks/:id/coverage", (req, res) => { try { res.json(LP.coverage(req.params.id)); } catch (e) { fail(res, e); } });
  app.get("/api/langpacks/:id/export.zip", (req, res) => { try { zipOut(res, "bitGen-language-pack-" + req.params.id.replace(/[^A-Za-z0-9-]/g, "") + ".zip", LP.exportZip(req.params.id)); } catch (e) { fail(res, e); } });
  app.post("/api/langpacks/check", raw, (req, res) => {
    try { const r = LP.check(req.body); const was = LP.get(r.pack.id); res.json({ pack: r.pack, warnings: r.warnings, installed: was ? { source: was.source, version: was.version } : null }); } catch (e) { fail(res, e); }
  });
  app.post("/api/langpacks/install", raw, (req, res) => { try { res.json(LP.install(req.body, { replace: String(req.query.replace || "") === "1" })); } catch (e) { fail(res, e); } });
  app.post("/api/langpacks/remove", (req, res) => { try { res.json(LP.remove((req.body || {}).id)); } catch (e) { fail(res, e); } });
}
module.exports = { mount };
