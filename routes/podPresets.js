// bitGen Studio — routes/podPresets.js (2.764.0): POD PRESETS (lib/podPresets.js) - 🖥 PODS ▸ 📦 Presets.
//   GET    /api/podpresets                    {dir, presets: [preset + style_names, pod (on RunPod now), state, hours, total_usd,
//                                             bill_month, job {phase, note, steps}]}
//   POST   /api/podpresets                    {preset, was?} -> saved (was = its old name when renamed); its pod takes the styles
//   DELETE /api/podpresets/:name              ✕ - the preset file goes (the pod is left as it is)
//   POST   /api/podpresets/:name/styles       {add: [ids], remove: [ids]}
//   POST   /api/podpresets/:name/play         {gpu?} -> {state, pod_id} | {need_gpu, gpu, options}   ▶
//   POST   /api/podpresets/:name/stop         ⏹                POST /api/podpresets/:name/terminate   🗑 (the preset stays)
//   POST   /api/podpresets/from-pod/:id       {name?} - 💾 Save as preset (a pod in My pods)
"use strict";
const PP = require("../lib/podPresets");

function mount(app) {
  // 2.779.0: a pod that could not be created says why (problem: lib/podCreateErr.js - the dialog static/poderr.js)
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json(Object.assign({ error: String((e && e.message) || e) }, e && e.problem ? { problem: e.problem } : {})); } };
  const nm = (req) => decodeURIComponent(String(req.params.name || ""));
  app.get("/api/podpresets", wrap(() => PP.list()));
  app.post("/api/podpresets", wrap((req) => PP.save(req.body || {})));
  app.post("/api/podpresets/from-pod/:id", wrap((req) => PP.fromPod(req.params.id, (req.body || {}).name)));
  app.delete("/api/podpresets/:name", wrap((req) => PP.remove(nm(req))));
  app.post("/api/podpresets/:name/styles", wrap((req) => PP.styles(nm(req), (req.body || {}).add || [], (req.body || {}).remove || [])));
  app.post("/api/podpresets/:name/play", wrap((req) => PP.play(nm(req), req.body || {})));
  app.post("/api/podpresets/:name/stop", wrap((req) => PP.stop(nm(req))));
  app.post("/api/podpresets/:name/terminate", wrap((req) => PP.terminate(nm(req))));
}
module.exports = { mount };
