// routes/businessProfiles.js — 2.875.0: the business details for cards / letterheads / flyers / posters (lib/businessProfiles.js -
// a JSON file for now, MariaDB later). Mounted from routes/index.js (never server.js).
//   GET    /api/business/profiles               {profiles: [{id, company, name, role, address, phone, email, website, services,
//                                                colours, logo, logo_url, front, back, created, updated}], last}
//   POST   /api/business/profiles               {profile, logo (data: URL) | drop_logo} -> the kept profile
//   DELETE /api/business/profiles/:id           {ok}
//   GET    /api/business/profiles/:id/logo      the logo picture
"use strict";
const express = require("express");
function mount(app) {
  const B = () => require("../lib/businessProfiles");
  const wrap = (fn) => (req, res) => { try { res.json(fn(req)); } catch (e) { res.status(e.status || 500).json({ error: e.message || String(e) }); } };
  app.get("/api/business/profiles", wrap(() => B().list()));
  app.post("/api/business/profiles", express.json({ limit: "16mb" }), wrap((req) => {
    const b = req.body || {};
    return B().save(b.profile || {}, { logoDataUrl: b.logo || "", dropLogo: !!b.drop_logo });
  }));
  app.delete("/api/business/profiles/:id", wrap((req) => ({ ok: B().remove(req.params.id) })));
  app.get("/api/business/profiles/:id/logo", (req, res) => {
    const p = B().logoPath(req.params.id);
    if (!p) return res.status(404).json({ error: "no logo" });
    res.sendFile(p);
  });
}
module.exports = { mount };
