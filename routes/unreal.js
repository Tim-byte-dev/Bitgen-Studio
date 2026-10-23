// bitGen Studio — the Unreal Engine 5.8 bridge (2.472.0). Mounted from routes/index.js (never server.js); the work is
// lib/unreal.js, the Unreal side the bitGen Bridge plugin (ue/bitGenBridge).
//
//   GET  /api/unreal/settings          {port, alphaInverted}      POST {port?, alphaInverted?} -> the settings
//   GET  /api/unreal/status            {connected, engine, project, level, bridge} | {connected: false, error}
//   GET  /api/unreal/list/:kind        levels | sequences | metahumans | anims (?skeleton=) | cameras -> {items}
//   GET  /api/unreal/viewport          the level viewport's camera {loc, rot, fov}
//   POST /api/unreal/viewport          {loc, rot} -> the viewport looks through it (2.475.0)
//   POST /api/unreal/focus             {camera, u, v, aspect} -> {hit, focus (cm)} - click to focus (2.475.0)
//   POST /api/unreal/still             {level?, camera, metahuman?, onlyMetahuman?, w, h, alpha} -> {name, w, h, camera}
//   GET  /api/unreal/file/:name        a still (PNG)
//   POST /api/unreal/render            {sequence? | camera_keys?, metahuman?, level?, fps, frames, w, h, alpha} -> {job, of}
//   GET  /api/unreal/job/:id           {state, frames, of, video, dur, error}
//   POST /api/unreal/actors            2.540.0: {camera, level?, w, h} (the still's) -> {camera, objects: [{name, cls, box}]} the
//                                      mesh actors in view (bitGen Bridge 1.3.0) - the 🖼 References lists
//   POST /api/unreal/import            2.579.0: {model} a file in the project's 3D models -> a Static Mesh in /Game/bitGen/SolidCraft,
//                                      placed in the open level (lib/ueImport.js - bitGen Bridge 1.4.0's import_mesh)
"use strict";
const express = require("express");
const ue = require("../lib/unreal");

const fail = (res, e) => res.status(e.status || 500).json({ error: e.message });
function mount(app) {
  app.get("/api/unreal/settings", (req, res) => res.json(ue.settings()));
  app.post("/api/unreal/settings", express.json(), (req, res) => { try { res.json(ue.saveSettings(req.body || {})); } catch (e) { fail(res, e); } });
  app.get("/api/unreal/status", (req, res) => { ue.status().then((s) => res.json(s), (e) => fail(res, e)); });
  app.get("/api/unreal/list/:kind", (req, res) => { ue.list(req.params.kind, req.query.skeleton ? { skeleton: String(req.query.skeleton) } : {}).then((items) => res.json({ items }), (e) => fail(res, e)); });
  app.get("/api/unreal/viewport", (req, res) => { ue.call("viewport", {}, 10000).then((j) => res.json({ loc: j.loc, rot: j.rot, fov: j.fov }), (e) => fail(res, e)); });
  app.post("/api/unreal/viewport", express.json(), (req, res) => { ue.setViewport(req.body).then((j) => res.json(j), (e) => fail(res, e)); });   // 2.475.0
  app.post("/api/unreal/focus", express.json(), (req, res) => { ue.focusAt(req.body).then((j) => res.json(j), (e) => fail(res, e)); });           // 2.475.0
  app.post("/api/unreal/still", express.json(), (req, res) => { let p; try { p = ue.still(req.body); } catch (e) { return fail(res, e); } p.then((j) => res.json(j), (e) => fail(res, e)); });
  app.get("/api/unreal/file/:name", (req, res) => { try { res.set("Cache-Control", "no-store").type("png").sendFile(ue.stillPath(req.params.name)); } catch (e) { fail(res, e); } });
  app.post("/api/unreal/render", express.json({ limit: "4mb" }), (req, res) => { let p; try { p = ue.render(req.body); } catch (e) { return fail(res, e); } p.then((j) => res.json(j), (e) => fail(res, e)); });
  app.post("/api/unreal/actors", express.json(), (req, res) => { let p; try { p = ue.actorsInView(req.body); } catch (e) { return fail(res, e); } p.then((j) => res.json(j), (e) => fail(res, e)); });   // 2.540.0
  // 2.579.0: a model from the project's 3D models -> a Static Mesh in the open level (lib/ueImport.js, plugin 1.4.0)
  app.post("/api/unreal/import", express.json(), (req, res) => { require("../lib/ueImport").send((req.body || {}).model).then((j) => res.json(j), (e) => fail(res, /unknown command/.test(e.message) ? Object.assign(e, { message: "the bitGen Bridge plugin in your Unreal project is older than 1.4.0 - update it (🎮 Load UE project updates it) to import meshes" }) : e)); });
  app.get("/api/unreal/job/:id", (req, res) => { ue.job(req.params.id).then((j) => res.json(j), (e) => fail(res, e)); });
}

module.exports = { mount };
