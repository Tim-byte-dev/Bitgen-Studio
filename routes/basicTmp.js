// bitGen Studio — routes/basicTmp.js (2.615.0): Basic Settings kept per style (lib/basicTmp.js -> misc/basic_settings.tmp).
// Mounted from routes/index.js.
//   GET  /api/basic-settings/styles            the whole file ({last, styles: {"video:<id>": {style, basic}}})
//   POST /api/basic-settings/styles            {kind, id, name, basic, last?} - that style's settings saved
//                                              {kind, id, op: "last"}        - only the last style
"use strict";
const tmp = require("../lib/basicTmp");

function mount(app) {
  const express = require("express");
  const fail = (res, e) => res.status(e.status || 500).json({ error: String((e && e.message) || e) });
  app.get("/api/basic-settings/styles", (_req, res) => { try { res.json(tmp.read()); } catch (e) { fail(res, e); } });
  // sendBeacon (closing the app) posts text/plain - read any body as JSON
  app.post("/api/basic-settings/styles", express.text({ type: () => true, limit: "2mb" }), (req, res) => {
    try {
      const b = typeof req.body === "string" && req.body ? JSON.parse(req.body) : (req.body || {});
      const o = b.op === "last" ? tmp.setLast(b.kind, b.id) : tmp.save(b);
      res.json({ ok: true, last: o.last, styles: Object.keys(o.styles).length });
    } catch (e) { fail(res, e.status ? e : Object.assign(e, { status: 400 })); }
  });
}
module.exports = { mount };
