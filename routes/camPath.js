// bitGen Studio — routes/camPath.js (2.399.0): the timeline's 🎥 CAMERA PATH. Mounted from routes/index.js.
//
//   POST /api/campath/frame?id=&kind=rgb|depth&i=   raw PNG -> one guide frame (lib/camGuide.saveFrame)
//   POST /api/campath/encode    {id, fps, frames}   -> {rgb, depth} video/camguide_<id>_<kind>.mp4 (lib/camGuide.encode)
//   POST /api/campath/plan      {cam, seconds}      -> what MiniMax H3 / Wan / LTX are told (lib/camPlan, static/campath.js)
//   GET  /api/campath/models                        -> what ComfyUI has for it: Wan Fun Camera / VACE models, the LTX
//                                                      camera LoRAs, the depth preprocessor (lib/camPlan.inventory)
"use strict";
const express = require("express");
const guide = require("../lib/camGuide");
const camPlan = require("../lib/camPlan");
const CP = require("../static/campath.js");

function fail(res, e) { res.status(e.status || 500).json({ error: e.message || String(e) }); }

function mount(app) {
  app.post("/api/campath/frame", express.raw({ type: "image/png", limit: 40 * 1024 * 1024 }), (req, res) => {
    try { res.json({ ok: true, ...guide.saveFrame(req.query.id, String(req.query.kind || ""), req.query.i, req.body) }); } catch (e) { fail(res, e); }
  });
  app.post("/api/campath/encode", async (req, res) => {
    const b = req.body || {};
    try { res.json({ ok: true, ...(await guide.encode(b.id, b)) }); } catch (e) { fail(res, e); }
  });
  app.post("/api/campath/plan", (req, res) => {
    const b = req.body || {};
    try {
      const cam = CP.norm(b.cam), secs = Number(b.seconds) || cam.dur;
      const pk = { cam: Object.assign({}, cam, { use: true }), exact: cam.exact, rgb: null, depth: null, rgbName: "", depthName: "" };
      res.json({ plan: CP.plan(cam, { seconds: secs }), h3: camPlan.forH3(pk, { seconds: secs, mode: b.mode || "ref2va" }),
                 wan: camPlan.forWan(pk, { seconds: secs }), ltx: camPlan.forLtx(pk, { seconds: secs }) });
    } catch (e) { fail(res, e); }
  });
  app.get("/api/campath/models", async (_req, res) => {
    let info = null, why = "";
    try { info = await require("../lib/comfy").objectInfo(8000); } catch (e) { why = e.message || String(e); }
    res.json({ reachable: !!info, ...(info ? camPlan.inventory(info) : {}), ...(why ? { why } : {}) });
  });
}

module.exports = { mount };
