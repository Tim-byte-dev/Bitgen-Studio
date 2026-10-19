// bitGen Studio — routes/dockerCfg.js (2.392.0): docker.cfg, the saved layouts of dockers open together
// (lib/dockerCfg.js; the page part is static/dockcfg.js). Mounted from routes/index.js (never server.js).
//
//   GET  /api/docker-cfg            the whole file {version, auto, configs: {<key>: {variants: [...]}}}
//   POST /api/docker-cfg/save       {open: [ids], window: {w, h}, col: {h}, docks: {...}, prompt: {...}} -> {key, cfg}
//   POST /api/docker-cfg/delete     {key, w?, h?} - one window size's layout, or the set's every layout -> {cfg}
//   POST /api/docker-cfg/settings   {auto: bool} -> {cfg}
"use strict";
const core = require("../lib/core");
const dockerCfg = require("../lib/dockerCfg");

function mount(app) {
  const fail = (res, e) => res.status(e.status || 500).json({ error: String(e.message || e) });
  app.get("/api/docker-cfg", (_req, res) => { try { res.json(dockerCfg.load(core.BASE)); } catch (e) { fail(res, e); } });
  app.post("/api/docker-cfg/save", (req, res) => { try { res.json(dockerCfg.save(core.BASE, req.body || {})); } catch (e) { fail(res, e); } });
  app.post("/api/docker-cfg/delete", (req, res) => {
    const b = req.body || {};
    try { res.json({ cfg: dockerCfg.remove(core.BASE, b.key, +b.w || 0, +b.h || 0) }); } catch (e) { fail(res, e); }
  });
  app.post("/api/docker-cfg/settings", (req, res) => { try { res.json({ cfg: dockerCfg.settings(core.BASE, req.body || {}) }); } catch (e) { fail(res, e); } });
}

module.exports = { mount };
