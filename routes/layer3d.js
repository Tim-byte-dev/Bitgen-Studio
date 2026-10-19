// bitGen Studio — routes/layer3d.js (2.460.0): a Daz / Blender scene as a 3D layer of the image editor (lib/layer3d.js).
// Mounted from routes/index.js (never server.js).
//
//   GET  /api/layer3d/sources                 the scenes to pick {items: [{path, name, kind: daz | blender, at}]}
//   GET  /api/layer3d                         the project's opened scenes {items}
//   POST /api/layer3d/open    {path}          -> {id, name, source, meta}
//   GET  /api/layer3d/:id                     {id, name, source, meta}
//   POST /api/layer3d/:id/render {cam, pose, w, h, engine, samples, transparent, frame, objects (2.541.0: the model's edits)} -> {rid}
//   GET  /api/layer3d/render/:rid             {state, error, ms, png}
//   GET  /api/layer3d/:id/png?f=              a render
//   POST /api/layer3d/:id/close               ends that scene's Blender
"use strict";
const l3 = require("../lib/layer3d");

function mount(app) {
  const express = require("express");
  const J = express.json({ limit: "2mb" });
  const fail = (res, e) => res.status(e.status || 500).json({ error: String((e && e.message) || e) });
  app.get("/api/layer3d/sources", (_req, res) => { try { res.json({ items: l3.sources() }); } catch (e) { fail(res, e); } });
  app.get("/api/layer3d/render/:rid", (req, res) => res.json(l3.renderStatus(req.params.rid)));
  app.get("/api/layer3d", (_req, res) => { try { res.json({ items: l3.list() }); } catch (e) { fail(res, e); } });
  app.post("/api/layer3d/open", J, async (req, res) => { try { res.json(await l3.open((req.body || {}).path)); } catch (e) { fail(res, e); } });
  app.get("/api/layer3d/:id", (req, res) => { try { res.json(l3.get(req.params.id)); } catch (e) { fail(res, e); } });
  app.post("/api/layer3d/:id/render", J, (req, res) => { try { res.json(l3.render(req.params.id, req.body || {})); } catch (e) { fail(res, e); } });
  app.get("/api/layer3d/:id/png", (req, res) => {
    let f = null; try { f = l3.pngPath(req.params.id, req.query.f); } catch { /* bad id */ }
    if (!f) return res.status(404).json({ error: "no such render" });
    res.set("Cache-Control", "no-store"); res.type("png"); res.sendFile(f);
  });
  app.post("/api/layer3d/:id/close", (req, res) => res.json(l3.close(req.params.id)));
}

module.exports = { mount };
