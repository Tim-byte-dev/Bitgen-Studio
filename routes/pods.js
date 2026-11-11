// bitGen Studio — routes/pods.js (2.756.0): the PODS docker (static/podsdock.js, lib/pods.js). Mounted from routes/index.js.
//   GET  /api/pods/templates?source=all|official|verified|community&comfy=1&q=&refresh=1   {source, templates, total, counts, failed}
//        (2.756.1: all = the default - the docker loads every template once and searches them itself)
//   GET  /api/pods/gpus?cloud=SECURE|COMMUNITY        {cloud, gpus: [{id, name, memory, price, availability, offered, max}]}
//   POST /api/pods/create  {templateId, name, gpu, count, cloud, disk, volume, port}   -> {pod, port} (remembered as bitGen's)
//   GET  /api/pods/mine                               {pods: [... + bitgen]}
//   POST /api/pods/:id/:action   start | stop | terminate
//   GET  /api/pods/:id/comfy?port=              2.758.0: the pod's ComfyUI - its models, the bitGen style each fits, its
//                                               saved workflows (lib/podStyles.js contents)
//   POST /api/pods/:id/styles {models, workflows, pod_name, port}   2.758.0: P_ styles from them -> {made, skipped}
//   2.759.0 ⬇ Models: GET /api/pods/catalog (bitGen's ComfyUI files), POST /api/pods/plan {styles} (a style's files),
//   GET /api/pods/:id/ways (Manager / Jupyter), POST /api/pods/:id/models {files, jupyter_password?, port}, GET /api/pods/:id/models
//   2.761.0: GET /api/pods/costs (RunPod's bill + the running pods), GET|POST /api/pods/:id/setup {kinds, llm, pod_name, port}
//   (lib/podSetup.js), GET /api/pods/:id/folders, POST /api/pods/:id/folder {folder, name} (lib/podModels.js)
"use strict";
const P = require("../lib/pods");

function mount(app) {
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: String((e && e.message) || e) }); } };
  app.get("/api/pods/templates", wrap((req) => P.templates({ source: req.query.source, comfy: req.query.comfy === "1", q: req.query.q, refresh: req.query.refresh === "1" })));
  app.get("/api/pods/gpus", wrap((req) => P.gpus(req.query.cloud)));
  app.post("/api/pods/create", wrap((req) => P.create(req.body || {})));
  app.get("/api/pods/mine", wrap(() => P.mine()));
  // 2.758.0 (Tim: "when pods are chosen only show pod styles ... how can i choose the model?"): before /:id/:action
  app.get("/api/pods/:id/comfy", wrap((req) => require("../lib/podStyles").contents(req.params.id, +req.query.port || 0)));
  app.post("/api/pods/:id/styles", wrap((req) => require("../lib/podStyles").make(req.params.id, req.body || {})));
  // 2.759.0 (Tim: "how do i choose what model comfyui template to use and to dl it?"): ⬇ Models (lib/podModels.js)
  app.get("/api/pods/catalog", wrap(() => ({ files: require("../lib/podModels").catalog() })));
  app.post("/api/pods/plan", wrap((req) => require("../lib/podModels").planFor((req.body || {}).styles || [])));
  app.get("/api/pods/:id/ways", wrap((req) => require("../lib/podModels").ways(req.params.id, +req.query.port || 0)));
  app.get("/api/pods/:id/models", wrap((req) => require("../lib/podModels").state(req.params.id, +req.query.port || 0)));
  app.post("/api/pods/:id/models", wrap((req) => require("../lib/podModels").start(req.params.id, req.body || {})));
  // + Tim: "add mounting the model in the pod from the hdd or link?" - a file from a link / from this computer (Jupyter)
  app.post("/api/pods/:id/link", wrap((req) => require("../lib/podModels").fromLink(req.params.id, req.body || {})));
  app.post("/api/pods/:id/upload", wrap((req) => require("../lib/podModels").upload(req.params.id, req.body || {})));
  // 2.761.0 (Tim: "make each pod name in my pods a accordian menuitem, add folder, checkpoint and add lora ... checkboxes ...
  // video,llm,vllm,image,image-edit ... a save button ... add the cost in basics settings refresh after every minute")
  app.get("/api/pods/costs", wrap((req) => require("../lib/podCosts").costs(req.query.refresh === "1")));
  app.get("/api/pods/:id/setup", wrap((req) => Object.assign(require("../lib/podSetup").view(req.params.id), { revive: require("../lib/podRevive").status(req.params.id) })));
  app.post("/api/pods/:id/setup", wrap((req) => require("../lib/podSetup").save(req.params.id, req.body || {})));
  app.get("/api/pods/:id/folders", wrap((req) => require("../lib/podModels").folders(req.params.id, { port: +req.query.port || 0 })));
  app.post("/api/pods/:id/folder", wrap((req) => require("../lib/podModels").newFolder(req.params.id, req.body || {})));
  app.post("/api/pods/:id/:action", wrap((req) => {
    if (!["start", "stop", "terminate"].includes(req.params.action)) { const e = new Error("start, stop or terminate"); e.status = 400; throw e; }
    return P.act(req.params.id, req.params.action);
  }));
}
module.exports = { mount };
