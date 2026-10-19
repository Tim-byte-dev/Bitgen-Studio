// bitGen Studio — routes/scene.js (2.515.0): the timeline's SCENE TOOLS (lib/sceneTools.js) - the AI cut-out through a
// shot, the 3D camera tracker, content-aware fill for video. Mounted from routes/index.js (never server.js).
//   GET  /api/scene/status                 {cutout: {methods, sam2, ai}, cv2, python}
//   POST /api/scene/sam2/install           Segment Anything 2 into the AI matte's venv (in the background)
//   POST /api/scene/cutout   {name, src, from, to, prompts: [{t, pts: [[x, y, 1|0]], box}], method, model, work, refine}
//   POST /api/scene/camtrack {name, src, from, to, fov, mode: auto|free|tripod, width, features, ignore: {name, t0}}
//   POST /api/scene/fill     {name, src, from, to, hole: {name, kind: alpha|grey, t0, invert}, grow, feather, reach,
//                             method: auto|spatial, ref: {name, t}, work}
//        -> {id, state}
//   GET  /api/scene/cam/:name              a kept camera solve {mode, fps, W, H, f, fov, err, frames: [{t, R, C}], points}
//   GET  /api/scene/job/:id                {state: working|done|failed|cancelled, p, stage, error, result}
//   POST /api/scene/job/:id/cancel
"use strict";
const st = require("../lib/sceneTools");

function mount(app) {
  const express = require("express");
  const J = express.json({ limit: "256kb" });
  const send = (res, f) => { try { res.json(f()); } catch (e) { res.status(e.status || 500).json({ error: String((e && e.message) || e) }); } };
  app.get("/api/scene/status", (_q, res) => send(res, () => st.status()));
  app.post("/api/scene/sam2/install", J, (_q, res) => send(res, () => st.installSam2()));
  app.post("/api/scene/cutout", J, (q, res) => send(res, () => st.cutout(q.body || {})));
  app.post("/api/scene/camtrack", J, (q, res) => send(res, () => st.camtrack(q.body || {})));
  app.post("/api/scene/fill", J, (q, res) => send(res, () => st.fill(q.body || {})));
  app.get("/api/scene/cam/:name", (q, res) => send(res, () => st.camSolve(q.params.name)));
  app.get("/api/scene/job/:id", (q, res) => send(res, () => st.job(q.params.id)));
  app.post("/api/scene/job/:id/cancel", J, (q, res) => send(res, () => st.cancel(q.params.id)));
}
module.exports = { mount };
