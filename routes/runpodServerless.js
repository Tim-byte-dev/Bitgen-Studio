// bitGen Studio — routes/runpodServerless.js (2.743.0): the RUNPOD SERVERLESS adapter, shaped like ComfyUI (lib/runpodServerless.js).
// Mounted from routes/index.js: early() BEFORE the app's express.json() (a workflow is bigger than its 100 kB default;
// an upload is multipart), mount() with the other routes.
//   GET  /rpsl/system_stats             what the endpoint is (no card here: devices [])
//   /rpsl/ep/<endpoint>/...  (2.746.0)  the same, for a remote style's own endpoint
//   POST /rpsl/upload/image             multipart "image" -> kept for the next job {name, subfolder, type}
//   POST /rpsl/prompt   {prompt}        -> {prompt_id, number, node_errors}  (400 {error, node_errors} as ComfyUI does)
//   GET  /rpsl/history[/:id]            ComfyUI's history shape, once the job is done
//   GET  /rpsl/view?filename&subfolder  a result file          GET/POST /rpsl/queue · POST /rpsl/interrupt · POST /rpsl/free
//   GET  /rpsl/object_info[...], /rpsl/ws   404 - the workers go on without them
//   POST /api/remotegpu/serverless/test {key?, endpoint?}  -> {ok, line, health} (RunPod's /health)
//   GET  /api/remotegpu/serverless/jobs                    the jobs this session sent
//   GET/POST /api/remotegpu/serverless/image  (2.749.0)  {endpoint, image, image_name}; POST {detect: true} asks RunPod, {image} = the pick
//   GET  /api/remotegpu/serverless/styles  (2.744.0)       {on, filter, comfy, show_all, versions, styles: {id: {ok, why}}, template}
"use strict";
const express = require("express");
const S = require("../lib/runpodServerless");

function early(app) {
  app.use("/rpsl", express.json({ limit: "64mb" }));
  app.use("/rpsl/upload", express.raw({ type: "multipart/form-data", limit: "1gb" }));
}
function mount(app) {
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: String((e && e.message) || e) }); } };
  // 2.746.0: /rpsl/ep/<endpoint>/... = the same ComfyUI shape for ONE remote style's own endpoint (lib/gpuSplit.js forJob);
  // /rpsl/... = the endpoint in Settings ▸ Remote generation. Mounted ep first - /rpsl would otherwise see /ep/... and pass it on.
  const epOf = (req) => String((req.params || {}).ep || "").replace(/[^A-Za-z0-9_-]/g, "");
  const r = express.Router({ mergeParams: true });
  r.get("/system_stats", (req, res) => res.json(S.stats(epOf(req))));
  r.post("/upload/image", (req, res) => {
    const f = S.parseMultipart(req.body, req.headers["content-type"]);
    if (!f) { res.status(400).json({ error: "no file in the upload" }); return; }
    res.json(S.upload(f.name, f.buf));
  });
  r.post("/prompt", async (req, res) => {
    try { res.json(await S.prompt(req.body || {}, epOf(req))); }
    catch (e) {   // ComfyUI's rejection shape - scripts/comfy_client.describe_rejection prints error.message
      res.status(e.status === 401 || e.status === 404 || e.status === 413 || e.status === 400 ? 400 : 502)
        .json({ error: { type: "runpod_serverless", message: "RunPod Serverless: " + String((e && e.message) || e), details: "" }, node_errors: {} });
    }
  });
  r.get("/history/:id", (req, res) => res.json(S.history(req.params.id)));
  r.get("/history", (req, res) => res.json(S.history()));
  r.get("/view", (req, res) => {
    const p = S.viewPath(req.query.filename, req.query.subfolder);
    if (!p) { res.status(404).json({ error: "no such file" }); return; }
    res.sendFile(p);
  });
  r.get("/queue", (req, res) => res.json(S.queueView()));
  r.post("/queue", (req, res) => res.json({}));
  r.post("/interrupt", wrap(() => S.interrupt()));
  r.post("/free", (req, res) => res.json({}));
  r.get(/^\/(object_info|ws)(\/.*)?$/, (req, res) => res.status(404).json({ error: "a RunPod Serverless endpoint cannot answer this" }));
  app.use("/rpsl/ep/:ep", r);
  app.use("/rpsl", r);
  app.post("/api/remotegpu/serverless/test", wrap((req) => {
    const b = req.body || {}, o = {};
    if (b.key) o.key = String(b.key).trim();
    if (b.endpoint) o.endpoint = String(b.endpoint).trim().replace(/[^A-Za-z0-9_-]/g, "");
    return S.test(o);
  }));
  app.get("/api/remotegpu/serverless/jobs", wrap(() => ({ jobs: S.jobs() })));
  // 2.744.0: which styles the endpoint can render (lib/rpslStyles.js) - the style lists hide the rest (static/rpstyles.js)
  app.get("/api/remotegpu/serverless/styles", wrap(() => require("../lib/rpslStyles").all()));
  // 2.749.0: the worker image the endpoint runs (lib/runpodImage.js) - the ready-made R_ styles for the others hide
  app.get("/api/remotegpu/serverless/image", wrap(() => require("../lib/runpodImage").known()));
  app.post("/api/remotegpu/serverless/image", wrap((req) => { const b = req.body || {}, I = require("../lib/runpodImage"); return b.detect ? I.detect() : I.set(b.image); }));
}
module.exports = { early, mount };
