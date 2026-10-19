// bitGen Studio — routes/mogrt.js (2.417.0): 🧩 MOTION GRAPHICS TEMPLATES (lib/mogrt.js). Mounted from routes/index.js.
//
//   GET    /api/mogrt              -> {ok, templates: [{id, name, description, builtin, w, h, len, layers, fields}]}
//   GET    /api/mogrt/:id          -> {ok, template}
//   POST   /api/mogrt              {name, w, h, layers, fields}  (static/mogrt.js capture) -> {ok, id, ...}
//   POST   /api/mogrt/:id/place    -> {ok, template}  its pictures copied into this project's images
//   DELETE /api/mogrt/:id          -> {ok}            a saved one only
"use strict";
const mogrt = require("../lib/mogrt");

function mount(app) {
  const express = require("express");
  const J = express.json({ limit: "8mb" });
  const fail = (res, e) => res.status(e.status || 500).json({ ok: false, error: String((e && e.message) || e) });
  app.get("/api/mogrt", (req, res) => { try { res.json({ ok: true, templates: mogrt.list() }); } catch (e) { fail(res, e); } });
  app.get("/api/mogrt/:id", (req, res) => { try { res.json({ ok: true, template: mogrt.get(req.params.id) }); } catch (e) { fail(res, e); } });
  app.post("/api/mogrt", J, (req, res) => { try { res.json(Object.assign({ ok: true }, mogrt.save(req.body || {}))); } catch (e) { fail(res, e); } });
  app.post("/api/mogrt/:id/place", J, (req, res) => { try { res.json({ ok: true, template: mogrt.place(req.params.id) }); } catch (e) { fail(res, e); } });
  app.delete("/api/mogrt/:id", (req, res) => { try { res.json(mogrt.remove(req.params.id)); } catch (e) { fail(res, e); } });
}

module.exports = { mount };
