// bitGen Studio — routes/remoteGpu.js (2.520.0): Settings -> Remote generation (lib/remoteGpu.js). Mounted from routes/index.js.
//   GET  /api/remotegpu                          {mode, current, url, cost_hr, runpod, ssh, tunnel, comfy_url}
//   POST /api/remotegpu/save    {url?, cost_hr?, runpod?, ssh?}     keep the fields (no switch)
//   POST /api/remotegpu/use     {mode: local|url|runpod|ssh}        switch the ComfyUI the app renders with
//   POST /api/remotegpu/test    {url}            <url>/system_stats -> {ok, devices, comfyui}
//   POST /api/remotegpu/pods    {key?}           your RunPod pods      POST /api/remotegpu/pod/:id/start|stop
//   GET  /api/remotegpu/pod/:id                  2.755.0: its state {status, word, uptime, cost_hr, ready} (RunPod REST v2)
//   POST /api/remotegpu/tunnel  {on}             the SSH tunnel
"use strict";
const R = require("../lib/remoteGpu");

function mount(app) {
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: String((e && e.message) || e) }); } };
  app.get("/api/remotegpu", wrap(() => R.view()));
  app.post("/api/remotegpu/save", wrap((req) => R.save(req.body || {})));
  app.post("/api/remotegpu/use", wrap((req) => R.use(String((req.body || {}).mode || ""))));
  app.post("/api/remotegpu/test", wrap((req) => R.test((req.body || {}).url)));
  app.post("/api/remotegpu/pods", wrap((req) => R.pods((req.body || {}).key, (req.body || {}).port).then((pods) => ({ pods }))));
  app.post("/api/remotegpu/pod/:id/:action", wrap((req) => R.podAction(req.params.id, req.params.action)));
  app.get("/api/remotegpu/pod/:id", wrap((req) => R.podState(req.params.id, +req.query.port || 0)));   // 2.755.0: loading pod / pod loaded / stopping / stopped + uptime
  app.post("/api/remotegpu/tunnel", wrap((req) => R.tunnel(!!(req.body || {}).on)));
}
module.exports = { mount };
