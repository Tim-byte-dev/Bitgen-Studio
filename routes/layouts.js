// bitGen Studio — routes/layouts.js (2.587.0): Settings ▸ Dockers ▸ Layouts - full docker layouts (lib/layouts.js).
//   guard(app)                       mounted FIRST: while a layout is being applied the page's own layout saves
//                                    (docker status, docker.cfg, panel / dialog layout, workspaces) are ignored, and a
//                                    fresh install starts from layouts/default.json (lib/layouts.seed)
//   GET  /api/layouts                {layouts, seeded}
//   GET  /api/layouts/:name          the layout (?download=1 = as a file)
//   POST /api/layouts/save           {name, local, theme}
//   POST /api/layouts/import         text/plain: a layout .json (+ ?name=)
//   POST /api/layouts/apply          {name} -> {local, theme} (the page sets them and reloads)
//   POST /api/layouts/delete         {name}
"use strict";
const express = require("express");
const L = require("../lib/layouts");

const GUARDED = /^\/api\/(docker-status|docker-cfg\/(save|settings)|layout\/(panel|dialog)|workspaces\/(snapshot|switch))$/;
const fail = (res, e) => res.status(e.status || 500).json({ error: String((e && e.message) || e) });

function guard(app) {
  try { const s = L.seed(); if (s) console.log("[layouts] a fresh install - started from layouts/default.json"); } catch { /* fine */ }
  app.use((req, res, next) => {
    if (req.method === "POST" && L.locked() && GUARDED.test(req.path)) return res.json({ ok: true, ignored: "a layout is being applied" });
    next();
  });
}
function mount(app) {
  app.get("/api/layouts", (_req, res) => { try { const s = L.seededInfo(); res.json({ layouts: L.list(), dir: "layouts", seeded: s ? { name: s.name, token: s.token, local: s.local, theme: s.theme } : null }); } catch (e) { fail(res, e); } });
  app.get("/api/layouts/:name", (req, res) => {
    try {
      const r = L.read(req.params.name);
      if (req.query.download === "1") { res.setHeader("Content-Disposition", `attachment; filename="${r.name}.json"`); res.type("application/json").send(JSON.stringify(r, null, 1)); return; }
      res.json(r);
    } catch (e) { fail(res, e); }
  });
  app.post("/api/layouts/save", express.json({ limit: "4mb" }), (req, res) => { try { const b = req.body || {}; res.json(Object.assign({ ok: true }, L.save(b.name, { local: b.local, theme: b.theme }))); } catch (e) { fail(res, e); } });
  app.post("/api/layouts/import", express.text({ type: () => true, limit: "8mb" }), (req, res) => {
    try { let rec; try { rec = JSON.parse(String(req.body || "")); } catch (e) { throw Object.assign(new Error("not a layout (JSON): " + e.message), { status: 400 }); } res.json(Object.assign({ ok: true }, L.importRec(rec, req.query.name))); }
    catch (e) { fail(res, e); }
  });
  app.post("/api/layouts/apply", (req, res) => { try { res.json(Object.assign({ ok: true }, L.apply((req.body || {}).name))); } catch (e) { fail(res, e); } });
  app.post("/api/layouts/delete", (req, res) => { try { res.json(Object.assign({ ok: true }, L.remove((req.body || {}).name))); } catch (e) { fail(res, e); } });
}

module.exports = { guard, mount, GUARDED };
