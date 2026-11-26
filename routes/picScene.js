// bitGen Studio — routes/picScene.js (2.975.0): 🧱 PICTURE → 3D SCENE (the Sketcher). Mounted from routes/index.js (never
// server.js). The work is lib/picScene.js; it runs in the server, so the page can close and come back.
//
//   GET  /api/picscene              {scenes: [{id, name, status, created, objects, sceneGlb}]}  (the project's, newest first)
//   GET  /api/picscene/needs?engine=&sound=   2.978.0: every file the run needs besides the edit style (the 3D engine's +
//                                   Stable Audio Open's) {files, checked, missing} - lib/modelsFound's check
//                                   {checked, missing:[{name, cat, folder, source}]} for the Download / Cancel box
//   POST /api/picscene              JSON {name (a project picture: Gallery / images), where, max, sound, pano, engine, hfov}
//                                   or raw picture bytes with ?name=&max=&sound=&pano=&engine= -> the scene {id, steps, ...}
//   GET  /api/picscene/:id          the scene: {status, msg, steps{find, cut, pano, mesh, sound, scene}, objects[...], ...}
//   GET  /api/picscene/:id/file?f=  a file of the scene (a cut-out, the plate, the panorama, a sound, the .glb) - only its own
//   POST /api/picscene/:id/cancel   stop it
//   POST /api/picscene/:id/retry    2.978.0: ↻ Try again - carry on from the step that failed (what was made is kept)
//   GET  /api/picscene/world        the 🌍 walk-in world's add-on (HunyuanWorld 1.0): {installed, note, missing}
//   POST /api/picscene/:id/world    🌍 on a finished scene: its panorama -> the walk-in world (HunyuanWorld 1.0 job)
"use strict";
const fs = require("fs");
const path = require("path");
const S = require("../lib/picScene");

function fail(res, e) { res.status((e && e.status) || 500).json({ error: String((e && e.message) || e) }); }
function bool(v, d) { if (v === undefined || v === null || v === "") return d; return !(v === false || v === "0" || v === "false" || v === 0); }
function opts(b) { return { max: +b.max || 5, sound: bool(b.sound, true), pano: bool(b.pano, true), world: bool(b.world, false), engine: b.engine || "", hfov: +b.hfov || 0, name: b.scene_name || "" }; }
/** the files a scene may hand out (nothing else on the disk) */
function filesOf(s) {
  const f = [s.picture, s.plate, s.pano, s.ambient, s.sceneGlb, s.worldGlb];
  (s.objects || []).forEach((o) => f.push(o.cut, o.glb, o.sfx));
  return f.filter(Boolean);
}
function brief(s) {
  const b = (f) => (f ? path.basename(f) : "");
  return { id: s.id, name: s.name, status: s.status, msg: s.msg, error: s.error || "", created: s.created, steps: s.steps, opts: s.opts, place: s.place,
    picture: b(s.picture), plate: b(s.plate), pano: b(s.pano), ambient: b(s.ambient), sceneGlb: b(s.sceneGlb), worldGlb: b(s.worldGlb), indoor: !!s.indoor,
    objects: (s.objects || []).map((o) => ({ name: o.name, box: o.box, sound: o.sound, cut: b(o.cut), glb: b(o.glb), sfx: b(o.sfx), place: o.place || null })) };
}

function mount(app) {
  const express = require("express");
  const J = express.json({ limit: "1mb" });
  const RAW = express.raw({ type: (r) => !/json/i.test(r.headers["content-type"] || ""), limit: 64 * 1024 * 1024 });
  app.get("/api/picscene", (_req, res) => { try { res.json({ scenes: S.list() }); } catch (e) { fail(res, e); } });
  app.get("/api/picscene/needs", (req, res) => {
    const q = req.query || {};
    // 2.978.0: ?engine=&sound= -> files (everything the run needs besides the style) + the check of them
    try {
      const MF = require("../lib/modelsFound");
      let files = S.runFiles({ engine: q.engine, sound: q.sound });
      // auto: TRELLIS.2 already here and Hunyuan3D not -> TRELLIS.2's files (auto would use it), nothing asked for
      if (!q.engine || q.engine === "auto") { const t = S.runFiles({ engine: "trellis", sound: q.sound }), ct = MF.check(t), ch = MF.check(files); if (ct.checked && !ct.missing.length && ch.missing.length) files = t; }
      res.json(Object.assign({ files }, MF.check(files)));
    } catch (e) { res.json({ checked: false, files: [], missing: [], error: String(e.message || e) }); }
  });
  app.get("/api/picscene/world", (_req, res) => {
    try { const A = require("../lib/hyworldAddon"); res.json(Object.assign({ missing: A.missing() }, A.status())); } catch (e) { fail(res, e); }
  });
  app.post("/api/picscene/:id/retry", (req, res) => { try { res.json(brief(S.retry(req.params.id))); } catch (e) { fail(res, e); } });   // 2.978.0 ↻
  app.post("/api/picscene/:id/world", (req, res) => { try { res.json(brief(S.world(req.params.id))); } catch (e) { fail(res, e); } });
  app.post("/api/picscene", J, RAW, (req, res) => {
    try {
      let pic = null, b = req.body || {};
      if (Buffer.isBuffer(req.body) && req.body.length) {   // a picture the page sends (a reference-dock / editor picture)
        b = req.query || {};
        pic = require("../lib/to3d").savePicture(req.body, b.name || "picture");
      } else pic = require("./sceneAI").pictureOf(b.name, b.where);
      if (!pic) return res.status(404).json({ error: "that picture is not in this project: " + String(b.name || "") });
      res.json(brief(S.create(pic, opts(b))));
    } catch (e) { fail(res, e); }
  });
  app.get("/api/picscene/:id", (req, res) => {
    const s = S.read(req.params.id); if (!s) return res.status(404).json({ error: "no such scene" }); res.json(brief(s));
  });
  app.get("/api/picscene/:id/file", (req, res) => {
    const s = S.read(req.params.id); if (!s) return res.status(404).json({ error: "no such scene" });
    const want = path.basename(String((req.query || {}).f || "")), f = filesOf(s).find((x) => path.basename(x) === want);
    if (!f || !fs.existsSync(f)) return res.status(404).json({ error: "not a file of this scene" });
    res.sendFile(path.resolve(f));
  });
  app.post("/api/picscene/:id/cancel", (req, res) => res.json({ ok: S.cancel(req.params.id) }));
}

module.exports = { mount, brief, filesOf };
