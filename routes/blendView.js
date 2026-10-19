// bitGen Studio — routes/blendView.js (2.403.0): a .blend in the preview canvas (lib/blendView.js). Mounted from
// routes/index.js (never server.js).
//
//   POST /api/blendview/open      {path, fresh}   the .blend -> <project>/blender/<stem>.tmp + the preview's .glb
//   GET  /api/blendview/current                   the open scene {stem, source, mode, meta, edits, glb} | {open: false}
//   POST /api/blendview/close
//   GET  /api/blendview/glb?stem=                 the preview's .glb
//   POST /api/blendview/edits     {stem, edits}   the page's edits (glTF-local)
//   POST /api/blendview/mode      {stem, mode}    bitgen | writeback | copy (the toolbox dropdown)
//   POST /api/blendview/save      {stem, mode}    💾 Save -> {written: [paths], notes, ...the scene again}
//   POST /api/blendview/render    {stem, start, end, view?, engine, prompt, ic_lora, ic_strength, render, realrefs?} -> {id}
//        (2.540.0: realrefs {token, items, style_id} = the reference docker's pictures, uploaded with /api/realrefs/upload:
//         Blender also renders the first frame + the objects' boxes, the first frame is made real with them, 3DREAL follows)
//   GET  /api/blendview/render/:id                {state, done, of, error, name, job, note, realrefs, objects2d}
"use strict";
const bv = require("../lib/blendView");

function mount(app) {
  const express = require("express");
  const J = express.json({ limit: "16mb" });
  const fail = (res, e) => res.status(e.status || 500).json({ error: String((e && e.message) || e) });
  app.post("/api/blendview/open", J, async (req, res) => {
    try { res.json(await bv.open((req.body || {}).path, { fresh: !!(req.body || {}).fresh })); } catch (e) { fail(res, e); }
  });
  app.get("/api/blendview/current", (_req, res) => { try { res.json(bv.current() || { open: false }); } catch (e) { fail(res, e); } });
  app.post("/api/blendview/close", (_req, res) => res.json(bv.close()));
  app.get("/api/blendview/glb", (req, res) => {
    const f = bv.glbPath(req.query.stem);
    if (!f) return res.status(404).json({ error: "no scene preview - open the .blend again" });
    res.type("model/gltf-binary");
    res.sendFile(f);
  });
  app.post("/api/blendview/edits", J, (req, res) => {
    try { res.json(bv.setEdits((req.body || {}).stem, (req.body || {}).edits)); } catch (e) { fail(res, e); }
  });
  app.post("/api/blendview/mode", J, (req, res) => {
    try { res.json(bv.setMode((req.body || {}).stem, (req.body || {}).mode)); } catch (e) { fail(res, e); }
  });
  app.post("/api/blendview/save", J, async (req, res) => {
    try { res.json(await bv.save((req.body || {}).stem, { mode: (req.body || {}).mode })); } catch (e) { fail(res, e); }
  });
  app.post("/api/blendview/render", J, (req, res) => {
    const b = req.body || {};
    try { res.json(bv.render(b.stem, b)); } catch (e) { fail(res, e); }
  });
  app.get("/api/blendview/render/:id", (req, res) => res.json(bv.renderStatus(req.params.id)));
}

module.exports = { mount };
