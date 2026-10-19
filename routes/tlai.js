// bitGen Studio — routes/tlai.js (2.420.0): 🤖 AI inside the timeline (lib/tlAi.js). Mounted from routes/index.js.
// The renders themselves go through /api/generate and /api/ltx (the prompt docker + the ⊖ negative docker).
//
//   POST /api/tlai/frame {name, t}           -> {ok, file, url}   a clip's picture at source second t (PNG)
//   GET  /api/tlai/frame/<file>              -> the PNG
//   POST /api/tlai/probe {name}              -> {ok, name, src, dur, w, h}   a job's file as a clip
//   POST /api/tlai/beats {name, start, dur}  -> {ok, tempo, beats, dur, cached}
"use strict";
const tlAi = require("../lib/tlAi");

function mount(app) {
  const express = require("express");
  const J = express.json({ limit: "1mb" });
  const fail = (res, e) => res.status(e.status || 500).json({ ok: false, error: String((e && e.message) || e) });
  app.post("/api/tlai/frame", J, (req, res) => { try { res.json(Object.assign({ ok: true }, tlAi.frame(req.body || {}))); } catch (e) { fail(res, e); } });
  app.get("/api/tlai/frame/:file", (req, res) => {
    const f = tlAi.fileFor(req.params.file);
    if (!f) return res.status(404).json({ ok: false, error: "no such frame" });
    res.type("image/png").sendFile(f);
  });
  app.post("/api/tlai/probe", J, (req, res) => { try { res.json(Object.assign({ ok: true }, tlAi.probe(req.body || {}))); } catch (e) { fail(res, e); } });
  app.post("/api/tlai/beats", J, (req, res) => {
    Promise.resolve().then(() => tlAi.beats(req.body || {})).then((r) => res.json(Object.assign({ ok: true }, r))).catch((e) => fail(res, e));
  });
}

module.exports = { mount };
