// bitGen Studio — routes/house.js (2.524.0): the 🏠 House builder docker (lib/house.js, static/housegeo.js).
// Mounted from routes/index.js (never server.js).
//   GET    /api/house                        the project's houses [{slug, name, floors, rooms, area, plan, renders}]
//   GET    /api/house/styles                 the image styles ✨ Make it real can use (they take a picture)
//   POST   /api/house/charref               {char, house} - 2.528.0: a character's picture into the Image assets for ✨ -> {name}
//   GET    /api/house/:name                  a house (the model)
//   POST   /api/house                        body = the model as JSON TEXT (a big house passes the 100 kb JSON parser)
//   DELETE /api/house/:name[?assets=1]        (?assets=1: its shots leave the Images assets too)
//   POST   /api/house/:name/render?kind=plan|shot|depth|normal|pano&cam=<camera>   body = the PNG -> {file, asset}
//   GET    /api/house/:name/render/:file     a render       GET /api/house/:name/plan.png   the plan picture
//   GET    /api/house/:name/obj              house.obj + house.mtl as a .zip
//   GET    /api/house/:name/glb              2.529.0: the house as one .glb (binary glTF)
//   POST   /api/house/:name/trace            2.529.0: the floor-plan picture to trace over (raw PNG / JPEG / WebP) -> {file}
//   GET    /api/house/:name/trace            ... that picture
//   POST   /api/house/:name/ref?name=<file name>   2.539.0: a picture from the References docker (raw PNG / JPEG / WebP) -> {file}
//   GET    /api/house/:name/ref/:file   ... that picture (a wall's / floor's texture, a piece's look)
//   POST   /api/house/refasset {house, file}   2.539.0: a house reference into the Image assets for ✨ Make it real -> {name}
//   POST   /api/house/furnish                2.529.0: {model, room, prompt, llm?} as JSON text -> {by, kind, items, skipped}
"use strict";
const H = require("../lib/house");

function mount(app) {
  const express = require("express");
  const fail = (res, e) => res.status(e.status || 500).json({ error: String((e && e.message) || e) });
  const wrap = (fn) => async (req, res) => { try { await fn(req, res); } catch (e) { fail(res, e); } };
  app.get("/api/house", wrap((_req, res) => res.json(H.list())));
  app.get("/api/house/styles", wrap((_req, res) => res.json(H.editStyles())));
  // 2.529.0: 🪄 furnish a room (lib/houseFurnish.js - the LLM picks from the library, the rules place)
  app.post("/api/house/furnish", express.text({ type: () => true, limit: "20mb" }), async (req, res) => {
    let b = null; try { b = JSON.parse(typeof req.body === "string" ? req.body : "null"); } catch { b = null; }
    if (!b || typeof b !== "object") return res.status(400).json({ error: "not JSON" });
    try { res.json(await require("../lib/houseFurnish").furnish(b)); } catch (e) { fail(res, e); }
  });
  app.post("/api/house/refasset", wrap((req, res) => res.json(H.refAsset((req.body || {}).house, (req.body || {}).file))));   // 2.539.0
  app.post("/api/house/charref", wrap((req, res) => res.json(H.charRef((req.body || {}).char, (req.body || {}).house))));   // 2.528.0
  app.get("/api/house/:name", wrap((req, res) => res.json(H.get(req.params.name))));
  app.post("/api/house", express.text({ type: () => true, limit: "20mb" }), wrap((req, res) => {
    let m = null;
    try { m = JSON.parse(typeof req.body === "string" ? req.body : "null"); } catch { m = null; }
    if (!m || typeof m !== "object") return res.status(400).json({ error: "the house is not JSON" });
    res.json(Object.assign({ ok: true }, H.save(m)));
  }));
  app.delete("/api/house/:name", wrap((req, res) => res.json({ ok: H.remove(req.params.name, req.query.assets === "1") })));
  app.post("/api/house/:name/render", express.raw({ type: () => true, limit: "60mb" }),
    wrap((req, res) => res.json(Object.assign({ ok: true }, H.saveRender(req.params.name, String(req.query.kind || ""), String(req.query.cam || "view"), req.body)))));
  app.get("/api/house/:name/render/:file", wrap((req, res) => { const f = H.renderPath(req.params.name, req.params.file); if (!f) return res.status(404).end(); res.sendFile(f); }));
  app.get("/api/house/:name/plan.png", wrap((req, res) => {
    const f = require("path").join(H.dirOf(req.params.name), "plan.png");
    if (!require("fs").existsSync(f)) return res.status(404).end();
    res.sendFile(f);
  }));
  app.get("/api/house/:name/glb", wrap((req, res) => {          // 2.529.0
    const z = H.exportGlb(req.params.name);
    res.set("Content-Type", "model/gltf-binary");
    res.set("Content-Disposition", `attachment; filename="${z.name}"`);
    res.send(z.data);
  }));
  app.post("/api/house/:name/trace", express.raw({ type: () => true, limit: "40mb" }), wrap((req, res) => res.json(H.saveTrace(req.params.name, req.body))));
  app.post("/api/house/:name/ref", express.raw({ type: () => true, limit: "40mb" }), wrap((req, res) => res.json(H.saveRef(req.params.name, req.body, String(req.query.name || "")))));   // 2.539.0
  app.get("/api/house/:name/ref/:file", wrap((req, res) => { const f = H.refPath(req.params.name, req.params.file); if (!f) return res.status(404).end(); res.sendFile(f); }));
  app.get("/api/house/:name/trace", wrap((req, res) => { const f = H.tracePath(req.params.name); if (!f) return res.status(404).end(); res.set("Cache-Control", "no-store"); res.sendFile(f); }));
  app.get("/api/house/:name/obj", wrap((req, res) => {
    const z = H.exportObj(req.params.name);
    res.set("Content-Type", "application/zip");
    res.set("Content-Disposition", `attachment; filename="${z.name}"`);
    res.send(z.data);
  }));
}
module.exports = { mount };
