// routes/businessProfiles.js — 2.875.0: the business details for cards / letterheads / flyers / posters (lib/businessProfiles.js -
// a JSON file on this computer; 2.897.0: kept in MariaDB when picked - lib/businessDb.js, the file then this computer's copy).
// Mounted from routes/index.js (never server.js).
//   GET    /api/business/profiles               {profiles: [{id, company, name, role, address, phone, email, website, services,
//                                                colours, logo, logo_url, front, back, created, updated}], last, store}
//                                                (2.897.0: in a database it syncs first - store.offline says why it could not)
//   POST   /api/business/profiles               {profile, logo (data: URL) | drop_logo} -> the kept profile (+ store)
//   DELETE /api/business/profiles/:id           {ok}
//   GET    /api/business/profiles/:id/logo      the logo picture
//   2.897.0  GET /api/business/store            where they are kept {mode file | db, scope global | external, db, waiting, lastSync, lastError, where}
//            POST /api/business/store           {mode: "db", scope, db} -> moved there (this computer's sent, the database's here) | {mode: "file"}
//            POST /api/business/store/sync      sync now
"use strict";
const express = require("express");
function mount(app) {
  const B = () => require("../lib/businessProfiles"), S = () => require("../lib/businessDb");
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: e.sqlMessage || e.message || String(e) }); } };
  const withStore = (out, r) => Object.assign(out, { store: Object.assign(S().status(), r && !r.ok ? { offline: r.offline } : {}, r && r.notes && r.notes.length ? { notes: r.notes } : {}) });
  app.get("/api/business/profiles", wrap(async () => { const r = await S().sync(); return withStore(B().list(), r); }));
  app.post("/api/business/profiles", express.json({ limit: "16mb" }), wrap(async (req) => {
    const b = req.body || {};
    const p = B().save(b.profile || {}, { logoDataUrl: b.logo || "", dropLogo: !!b.drop_logo });
    const r = await S().changed("save", p.id);
    return withStore(Object.assign({}, B().get(p.id) || p), r);
  }));
  app.delete("/api/business/profiles/:id", wrap(async (req) => { const ok = B().remove(req.params.id); const r = ok ? await S().changed("remove", req.params.id) : null; return withStore({ ok }, r); }));
  app.get("/api/business/profiles/:id/logo", (req, res) => {
    const p = B().logoPath(req.params.id);
    if (!p) return res.status(404).json({ error: "no logo" });
    res.sendFile(p);
  });
  app.get("/api/business/store", wrap(() => S().status()));
  app.post("/api/business/store", express.json({ limit: "16kb" }), wrap((req) => S().move(req.body || {})));
  app.post("/api/business/store/sync", wrap(async () => { const r = await S().sync(); return Object.assign(S().status(), r); }));
}
module.exports = { mount };
