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
//   2.763.5: GET /api/pods/account (?refresh=1) {balance, spend_hr, spend_limit, under, lasts_hr, at, error?} - lib/runpodAccount.js
//   2.761.0: GET /api/pods/costs (RunPod's bill + the running pods), GET|POST /api/pods/:id/setup {kinds, llm, pod_name, port}
//   (lib/podSetup.js), GET /api/pods/:id/folders, POST /api/pods/:id/folder {folder, name} (lib/podModels.js)
//   2.772.0: GET /api/pods/activity {pods: {id: {now, done, last, at}}} - what each pod is doing now and has done
//   (lib/podActivity.js); GET /api/pods/:id/install - ComfyUI installed on a blank pod (lib/podInstall.js status)
//   2.773.0: GET /api/pods/remote-stats - the pod in use's GPU / RAM / CPU / disks in /api/stats' shape (lib/remoteStats.js)
"use strict";
const P = require("../lib/pods");

function mount(app) {
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: String((e && e.message) || e) }); } };
  app.get("/api/pods/templates", wrap((req) => P.templates({ source: req.query.source, comfy: req.query.comfy === "1", q: req.query.q, refresh: req.query.refresh === "1" })));
  app.get("/api/pods/gpus", wrap((req) => P.gpus(req.query.cloud)));
  app.get("/api/pods/account", wrap((req) => require("../lib/runpodAccount").account(req.query.refresh === "1")));   // 2.763.5: the balance (the 💲 RunPod docker)
  app.post("/api/pods/create", wrap((req) => P.create(req.body || {})));
  app.get("/api/pods/mine", wrap(() => P.mine()));
  app.get("/api/pods/activity", wrap(() => ({ pods: require("../lib/podActivity").all() })));   // 2.772.0
  app.get("/api/pods/remote-stats", wrap(() => require("../lib/remoteStats").now()));   // 2.773.0: the left docker's System stats in remote mode
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
  // 2.763.4 (Tim: "in the pods docker show utilization, memory and disk visualizations and usage"): a running pod's GPU load,
  // GPU memory, RAM, CPU and disks (lib/podStats.js)
  app.get("/api/pods/:id/install", wrap((req) => ({ install: require("../lib/podInstall").status(req.params.id) })));   // 2.772.0
  // 2.775.0: the audio engines on a pod (lib/podAudio.js) - its ticks; ticking one installs it now
  app.get("/api/pods/:id/audio", wrap((req) => require("../lib/podAudio").status(req.params.id)));
  app.post("/api/pods/:id/audio", wrap((req) => { const A = require("../lib/podAudio"), before = A.kinds(req.params.id), now = A.setKinds(req.params.id, (req.body || {}).kinds);
    if (now.some((k) => !before.includes(k))) A.install(req.params.id, now, null, { noStart: true }).catch(() => null);   // a stopped pod is not started for it
    return A.status(req.params.id); }));
  app.get("/api/pods/:id/stats", wrap((req) => require("../lib/podStats").stats(req.params.id, +req.query.port || 0)));
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
