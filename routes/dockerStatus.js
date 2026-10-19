// bitGen Studio — routes/dockerStatus.js (2.381.0): docker_status.json, THE dock layout (lib/dockerStatus.js).
//
// Tim: "create a file for docker status - docker_status.json / keep docker open, closed, hidden, height, width,
// max-height,max-width, maximized values in this file ... this will be loaded first".
//
//   GET  /api/docker-status   the whole record {version, docks: {<id>: {state, hidden, height, width, max_height,
//                             max_width, maximized}}} (first run: folded in from ui.docks + dockers.json and written)
//   POST /api/docker-status   {docks: {<id>: {...}}} - merged per dock (the dock just maximized wins), written
//                             atomically, the whole record back
//   page()                    routes/index.js serves "/" through it: the record goes into the page's <head> as
//                             window.H3_DOCK_STATUS, so it is applied before anything else paints
const dockerStatus = require("../lib/dockerStatus");
const core = require("../lib/core");

function opts() {
  try { return { uiDocks: ((core.getConfig() || {}).ui || {}).docks }; } catch { return {}; }
}
function record() { return dockerStatus.load(core.BASE, opts()); }
function page(html) {
  let out = html;
  try { out = dockerStatus.inject(out, record()); } catch { /* the page still serves */ }
  // 2.392.0: docker.cfg (the saved layouts of dockers open together) beside it - static/dockcfg.js reads it
  try { const dc = require("../lib/dockerCfg"); out = dc.inject(out, dc.load(core.BASE)); } catch { /* fine */ }
  // 2.526.0: the Workspace dropdown's record (lib/workspaces.js) - the current workspace's buttons hide before anything paints
  try { const ws = require("../lib/workspaces"); out = ws.inject(out, ws.load(core.BASE)); } catch { /* fine */ }
  return out;
}

function mount(app) {
  app.get("/api/docker-status", (_req, res) => {
    try { res.json(record()); } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
  app.post("/api/docker-status", (req, res) => {
    const b = req.body || {};
    // 2.393.0: or {floats: {basic | llmtok: {...}}} - the floating settings sections (static/secfloat.js)
    const okDocks = b.docks && typeof b.docks === "object", okFloats = b.floats && typeof b.floats === "object";
    if (!okDocks && !okFloats) return res.status(400).json({ error: "send {docks: {<id>: {...}}} or {floats: {<id>: {...}}}" });
    try { res.json(dockerStatus.save(core.BASE, b, opts())); }
    catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
}

module.exports = { mount, page, record };
