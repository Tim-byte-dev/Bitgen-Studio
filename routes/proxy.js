// bitGen Studio — routes/proxy.js (2.416.0): PROXIES for heavy footage (lib/proxy.js). Mounted from routes/index.js.
//   POST /api/proxy/info {names}   -> {info: {name: {w, h, codec, fps, mbps, heavy, why, state, url}}}
//   POST /api/proxy/want {name}    -> {state, url}       makes the proxy once (the canvas then plays it)
//   GET  /api/proxy/file/:file     -> the proxy
"use strict";
const proxy = require("../lib/proxy");

function mount(app) {
  const express = require("express");
  const J = express.json({ limit: "1mb" });
  const fail = (res, e) => res.status(e.status || 500).json({ ok: false, error: String((e && e.message) || e) });
  app.post("/api/proxy/info", J, (req, res) => {
    try { res.json({ ok: true, info: proxy.info((req.body || {}).names) }); } catch (e) { fail(res, e); }
  });
  app.post("/api/proxy/want", J, (req, res) => {
    try {
      const r = proxy.want((req.body || {}).name);
      res.json(Object.assign({ ok: true }, r, r.state === "ready" ? { url: "/api/proxy/file/" + encodeURIComponent(r.file) } : {}));
    } catch (e) { fail(res, e); }
  });
  app.get("/api/proxy/file/:file", (req, res) => {
    const f = proxy.fileFor(req.params.file);
    if (!f) return res.status(404).json({ ok: false, error: "not made (yet)" });
    res.sendFile(f);
  });
}

module.exports = { mount };
