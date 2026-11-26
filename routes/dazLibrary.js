// bitGen Studio — routes/dazLibrary.js (2.977.0): 📚 THE DAZ LIBRARY (lib/dazLib.js) - mounted from routes/index.js (never
// server.js). Not a replacement for Daz Studio: light tasks only; Daz Studio is a very powerful character creator.
//
//   GET  /api/dazlib                 {roots, detected, note}
//   POST /api/dazlib/roots           {roots: [folder ...]} -> {roots}
//   GET  /api/dazlib/scan?kind=&q=&root=   {items [{root, rel, name, kind, thumb}], encrypted, roots, note}
//   GET  /api/dazlib/thumb?root=&rel=      a thumbnail (.png) inside a library folder
//   GET  /api/dazlib/dials?root=&rel=&q=   the figure's shape dials [{url, label, group, min, max}]
//   POST /api/dazlib/build           {root, rel, dials [{url, value}], wear [{root, rel}], drape {kinds, frames} | false,
//                                     face {picture (a project picture)} | null, name, maxTex}
//                                    -> {model: "<name>.glb" in models3d, info}
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("../lib/core");
const D = require("../lib/dazLib");

const FACE_PROMPT = "Find the face in this photo. Answer ONLY with JSON giving points as [x, y] with coordinates from 0 to 1000 "
  + "(0,0 = top left): {\"left_eye\": [x, y], \"right_eye\": [x, y], \"mouth\": [x, y], \"chin\": [x, y]} - left_eye is the "
  + "PERSON'S left eye (on the right side of the picture), the centre of each eye, the middle of the mouth, the bottom of the chin.";
function fail(res, e) { res.status((e && e.status) || 500).json({ error: String((e && e.message) || e) }); }

function mount(app) {
  const J = require("express").json({ limit: "2mb" });
  app.get("/api/dazlib", (_req, res) => { try { res.json({ roots: D.roots(), detected: D.detectRoots(), note: D.NOT_DAZ }); } catch (e) { fail(res, e); } });
  app.post("/api/dazlib/roots", J, (req, res) => { try { res.json({ roots: D.setRoots((req.body || {}).roots) }); } catch (e) { fail(res, e); } });
  app.get("/api/dazlib/scan", (req, res) => { try { const q = req.query || {}; res.json(D.scan({ kind: q.kind || "", q: q.q || "", root: q.root || "", limit: q.limit })); } catch (e) { fail(res, e); } });
  app.get("/api/dazlib/thumb", (req, res) => {
    try { const f = D.abs(req.query.root, req.query.rel); if (!/\.(png|jpe?g)$/i.test(f)) return res.status(400).json({ error: "not a picture" }); res.sendFile(path.resolve(f)); } catch (e) { fail(res, e); }
  });
  app.get("/api/dazlib/dials", (req, res) => {
    try {
      const f = D.abs(req.query.root, req.query.rel), sc = D.sceneNodes(f);
      if (!sc.fig) return res.json({ dials: [] });
      res.json({ figure: sc.fig.url, dials: D.morphsFor(sc.fig.url, { q: req.query.q || "", limit: req.query.limit }) });
    } catch (e) { fail(res, e); }
  });
  app.post("/api/dazlib/build", J, async (req, res) => {
    const b = req.body || {};
    try {
      let face = null;
      if (b.face && b.face.picture) {
        const pic = require("./sceneAI").pictureOf(b.face.picture, b.face.where);
        if (!pic) return res.status(404).json({ error: "that photo is not in this project: " + b.face.picture });
        let lm = b.face.landmarks || null;
        if (!lm) { const t = (await require("../lib/captioner").describe(core, [{ path: pic, prompt: FACE_PROMPT, max_tokens: 300 }]))[0]; lm = require("../lib/dazFace").parseLandmarks(t); }
        if (!lm) return res.status(422).json({ error: "the Vision model found no face in that photo (is a Vision model chosen in the prompt docker?)" });
        face = { photo: pic, landmarks: lm };
      }
      const r = await D.build({ root: b.root, rel: b.rel, dials: b.dials, wear: b.wear, drape: b.drape || false, face, maxTex: b.maxTex });
      const stem = String(b.name || path.basename(String(b.rel || "character")).replace(/\.duf$/i, "")).replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 50) || "character";
      const m3d = require("../lib/m3d"); let name = stem + "_daz.glb";
      for (let i = 2; fs.existsSync(path.join(m3d.dir(), name)); i++) name = `${stem}_daz_${i}.glb`;
      m3d.saveModel(name, r.glb);
      res.json({ model: name, bytes: r.glb.length, info: r.info });
    } catch (e) { fail(res, e); }
  });
}
module.exports = { mount, FACE_PROMPT };
