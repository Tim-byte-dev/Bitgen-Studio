// bitGen Studio — routes/clipfx.js (2.406.0): the timeline clip fx's server side (lib/clipFx.js). Mounted from
// routes/index.js (never server.js).
//
//   GET  /api/luts                  {luts: [{name, where}], looks, ramps}       the 🎨 Colour panel's lists
//   GET  /api/luts/:name            the .cube text                              (the preview bakes it with the grade)
//   POST /api/luts?name=&app=1  (the .cube text as the body, text/plain)        ＋ LUT (checked by parsing it) - a 33³ LUT
//                                                                               is ~1 MB, past the app's JSON limit
//   POST /api/clipfx/afx-preview  {name, at, secs, afx}  -> audio/wav           🎧 before | after the sound clean-up
//   POST /api/clipfx/stabilise    {name, smooth, lock}   -> {state, url}       2.413.0: the canvas's steady preview
//   GET  /api/clipfx/stabilised/:file                    -> the steady file    (lib/stabilise.js, <project>/cache/stab)
//   POST /api/clipfx/retimesound  {name, in, out, dur, fx} -> {state, url}      2.417.0: a reversed / ramped clip's sound
//   GET  /api/clipfx/retimed/:file                       -> its Opus webm      (lib/retimeSound.js, <project>/cache/retime)
//   POST /api/clipfx/colourmatch {clip: {name, at, fx}, ref: {name, at, fx}, strength}
//        -> {curves: {r, g, b}, before, after, target}                     2.415.0: 🎯 Colour Match (lib/colourMatch.js)
//   POST /api/clipfx/track {name, from, to, x, y, w, h} -> {track, lost, gaps}  2.416.0: a mask tracked (lib/track.js)
"use strict";
const fs = require("fs");
const clipFx = require("../lib/clipFx");
const stabilise = require("../lib/stabilise");          // 2.413.0
const retimeSound = require("../lib/retimeSound");      // 2.417.0
const colourMatch = require("../lib/colourMatch");      // 2.415.0
const tracker = require("../lib/track");                // 2.416.0

function mount(app) {
  const express = require("express");
  const J = express.json({ limit: "16mb" });
  const fail = (res, e) => res.status(e.status || 500).json({ ok: false, error: String((e && e.message) || e) });
  app.get("/api/luts", (_req, res) => {
    try { res.json({ ok: true, luts: clipFx.list(), looks: clipFx.LOOKS, ramps: clipFx.RAMPS, size: clipFx.LUT_SIZE }); }
    catch (e) { fail(res, e); }
  });
  app.get("/api/luts/:name", (req, res) => {
    try { res.type("text/plain").send(clipFx.read(req.params.name)); } catch (e) { fail(res, e); }
  });
  const T = express.text({ type: () => true, limit: "32mb" });
  app.post("/api/luts", T, (req, res) => {
    const q = req.query || {};
    try { res.json({ ok: true, ...clipFx.save(q.name, typeof req.body === "string" ? req.body : "", q.app === "1"), luts: clipFx.list() }); }
    catch (e) { fail(res, Object.assign(e, { status: e.status || 400 })); }
  });
  app.post("/api/clipfx/afx-preview", J, (req, res) => {
    let f = null;
    try {
      f = clipFx.afxPreview(req.body || {});
      res.type("audio/wav").send(fs.readFileSync(f));
    } catch (e) { fail(res, e); }
    finally { if (f) try { fs.unlinkSync(f); } catch { /* gone */ } }
  });
  app.post("/api/clipfx/stabilise", J, (req, res) => {
    try { res.json(Object.assign({ ok: true }, stabilise.want(req.body || {}))); } catch (e) { fail(res, e); }
  });
  app.post("/api/clipfx/retimesound", J, (req, res) => {     // 2.417.0: a reversed / ramped clip's sound for the canvas
    try { res.json(Object.assign({ ok: true }, retimeSound.want(req.body || {}))); } catch (e) { fail(res, e); }
  });
  app.get("/api/clipfx/retimed/:file", (req, res) => {
    const f = retimeSound.fileFor(req.params.file);
    if (!f) return res.status(404).json({ ok: false, error: "not made (yet)" });
    res.type("audio/webm").sendFile(f);
  });
  app.post("/api/clipfx/colourmatch", J, (req, res) => {
    const b = req.body || {};
    try {
      const asr = require("../lib/asr");
      const side = (x, what) => {
        const f = x && x.name ? asr.findAsset(String(x.name)) : null;
        if (!f) throw Object.assign(new Error(what + " is not in this project: " + ((x && x.name) || "(none)")), { status: 404 });
        return { file: f, at: Math.max(0, +x.at || 0), fx: x.fx || null };
      };
      res.json(Object.assign({ ok: true }, colourMatch.match(side(b.clip, "the clip"), side(b.ref, "the reference"), { strength: b.strength, lut: (n) => clipFx.read(n) })));
    } catch (e) { fail(res, Object.assign(e, { status: e.status || 400 })); }
  });
  app.post("/api/clipfx/track", J, (req, res) => {
    tracker.run(req.body || {}).then((r) => res.json(Object.assign({ ok: true }, r))).catch((e) => fail(res, e));
  });
  app.get("/api/clipfx/stabilised/:file", (req, res) => {
    const f = stabilise.fileFor(req.params.file);
    if (!f) return res.status(404).json({ ok: false, error: "not made (yet)" });
    res.sendFile(f);
  });
}

module.exports = { mount };
