// bitGen Studio — routes/timeEstimate.js (2.908.0): ⏱ the time estimate beside Generate (lib/timeEstimate.js). Mounted from
// routes/index.js.
//   POST /api/timeestimate {style, name, kind: video|image|music, mode, width, height, seconds | frames, steps, cfg, where}
//     -> {text, title, estimate: {ms, gen_ms, startup_ms, lo, hi, n, basis, warm} | null}
"use strict";
const T = require("../lib/timeEstimate");

function mount(app) {
  app.post("/api/timeestimate", (req, res) => {
    try {
      const b = req.body || {};
      res.json(T.forRequest({ style_id: String(b.style || ""), name: String(b.name || "").slice(0, 120), kind: String(b.kind || "video"),
        mode: String(b.mode || ""), width: +b.width || 0, height: +b.height || 0, frames: +b.frames || 0, seconds: +b.seconds || 0,
        steps: +b.steps || 0, cfg: b.cfg === "" || b.cfg == null ? null : +b.cfg, where: String(b.where || "") }));
    } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
  });
}
module.exports = { mount };
