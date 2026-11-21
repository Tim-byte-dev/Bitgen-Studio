// bitGen Studio — routes/videoFrame.js (2.903.0): the preview's frame step + 📷 capture (lib/videoFrame.js)
//   GET  /api/videoframe/info?url=<the preview's address>   -> {fps, frames, dur, w, h, name}
//   POST /api/videoframe/capture {url, t | frame}            -> {ok, name, gallery, frame, t, w, h, fps} (PNG in Assets + Gallery)
"use strict";
function mount(app) {
  const V = require("../lib/videoFrame");
  const fail = (res, e) => res.status(e.status || 500).json({ error: String((e && e.message) || e) });
  app.get("/api/videoframe/info", (req, res) => { try { res.json(V.info(String(req.query.url || ""))); } catch (e) { fail(res, e); } });
  app.post("/api/videoframe/capture", require("express").json({ limit: "64kb" }), (req, res) => {
    const b = req.body || {};
    try { res.json(V.capture(String(b.url || ""), { t: b.t, frame: b.frame })); } catch (e) { fail(res, e); }
  });
}
module.exports = { mount };
