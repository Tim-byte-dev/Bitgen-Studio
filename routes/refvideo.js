// bitGen Studio — REFERENCE VIDEO SELECTION routes (2.325.0). Mounted
// from routes/index.js (never server.js); the logic is lib/refSelect.js,
// the dialog static/refselect.js.
//
//   GET  /api/refvideo/select?name=   the SOURCE of a clicked reference
//                                     video, its probe (fps, frames, size,
//                                     duration) and the remembered selection
//   POST /api/refvideo/select         {source, start, dur} -> the frames
//                                     cut into <stem>_sel_f<a>-f<b>.mp4
//                                     (the whole video = no cut)
"use strict";
const core = require("../lib/core");
const trap = require("../lib/trap");
const rsel = require("../lib/refSelect");

function mount(app) {
  app.get("/api/refvideo/select", (req, res) => {
    const d = rsel.describe(core.projDir(core.getProject()), core.pDir("video"), req.query.name);
    if (d.error) return res.status(/no such/.test(d.error) ? 404 : 400).json(d);
    res.json(d);
  });
  app.post("/api/refvideo/select", trap.guard((req, res) => {
    const b = req.body || {};
    const r = rsel.select(core.projDir(core.getProject()), core.pDir("video"), b.source, b.start, b.dur);
    if (r.error) return res.status(/no such/.test(r.error) ? 404 : 400).json(r);
    res.json(r);
  }));
}

module.exports = { mount };
