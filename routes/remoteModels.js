// bitGen Studio — routes/remoteModels.js (2.766.0): THE MODELS YOUR PODS USE (lib/remoteModels.js) + every transfer's
// progress (lib/podTransfers.js) + the pods ticked in My pods. Mounted FIRST in routes/index.js: in remote mode it answers
// /api/comfymodels and /api/modelmgr/cards with runpod/pods/remote_models.json (?local=1 = this computer's, as before).
//   GET    /api/remotemodels                 {pods_mode, file, models, selected}
//   GET    /api/remotemodels/mode            {pods_mode}
//   POST   /api/remotemodels/fill            the styles your pods use -> their catalog files in the list {added}
//   POST   /api/remotemodels/link            {url, folder, name?, label?, group?} -> the entry
//   POST   /api/remotemodels/local           {cat, name, label?, group?} a model of this computer -> Civitai / your Hugging
//                                            Face repo / straight to the selected pods (in the background) {started}
//   POST   /api/remotemodels/civitai         {version_id, file_id?, title?, subfolder?} Model manager's ⤓ in remote mode
//   POST   /api/remotemodels/:id/send        {pods?: [{id, name}]} -> {sending: [pod ids]} (the selected pods by default)
//   POST   /api/remotemodels/:id             {label?, group?, url?, folder?} -> the entry      DELETE /api/remotemodels/:id
//   GET    /api/pods/transfers               {transfers: [{id, pod, pod_name, name, how, from, size, done, pct, state, rate, left}]}
//   POST   /api/pods/transfers/clear         the finished ones go
//   GET    /api/pods/selected                {selected}         POST /api/pods/selected {pods: [{id, name}]}
"use strict";
const RM = require("../lib/remoteModels");

function mount(app) {
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: String((e && e.message) || e) }); } };
  const remote = (req) => req.query.local !== "1" && RM.podsMode();
  // remote mode: Basic Settings' combos + LoRA rows list the remote models (the page's loadComfyModels)
  app.get("/api/comfymodels", (req, res, next) => { if (!remote(req)) return next(); try { RM.ensureFilled(); res.json(RM.asComfyModels(RM.load())); } catch (e) { next(); } });
  // remote mode: Model manager's cards are the remote models
  app.get("/api/modelmgr/cards", (req, res, next) => {
    if (!remote(req)) return next();
    try {
      const MC = require("../lib/modelCards"), core = require("../lib/core"), styles = require("../lib/styles");
      RM.ensureFilled();
      const c = RM.cards(), all = styles.read(core.STYLES_DIR);
      res.json({ models: c.models, loras: c.loras, vae: [], te: [], warnings: [], remote_list: true, file: "runpod/pods/remote_models.json", selected: RM.selected(),
        families: Object.entries(MC.FAMILIES).map(([id, f]) => ({ id, label: f.label, category: f.category })), categories: MC.CATEGORIES, model_types: MC.MODEL_TYPES,
        templates: all.filter((s) => !s.chain).map((s) => ({ id: s.id, name: s.name, kind: s.kind || "image", arch: s.arch || "" })) });
    } catch (e) { next(); }
  });
  app.get("/api/remotemodels", wrap(() => ({ pods_mode: RM.podsMode(), file: "runpod/pods/remote_models.json", models: RM.load(), selected: RM.selected() })));
  app.get("/api/remotemodels/mode", wrap(() => ({ pods_mode: RM.podsMode() })));
  app.post("/api/remotemodels/fill", wrap(() => ({ added: RM.fill() })));
  app.post("/api/remotemodels/link", wrap((req) => ({ entry: RM.addLink(req.body || {}) })));
  app.post("/api/remotemodels/local", wrap((req) => RM.addLocal(req.body || {})));
  app.post("/api/remotemodels/civitai", wrap((req) => RM.fromCivitai(req.body || {})));
  app.post("/api/remotemodels/:id/send", wrap((req) => RM.send(req.params.id, (req.body || {}).pods)));
  app.post("/api/remotemodels/:id", wrap((req) => { const e = RM.patch(req.params.id, req.body || {}); if (!e) { const x = new Error("no such model in the list"); x.status = 404; throw x; } return { entry: e }; }));
  app.delete("/api/remotemodels/:id", wrap((req) => ({ ok: RM.remove(req.params.id) })));
  app.get("/api/pods/transfers", wrap(() => ({ transfers: require("../lib/podTransfers").list() })));
  app.post("/api/pods/transfers/clear", wrap(() => { require("../lib/podTransfers").clear(); return { ok: true }; }));
  app.get("/api/pods/selected", wrap(() => ({ selected: RM.selected() })));
  app.post("/api/pods/selected", wrap((req) => ({ selected: RM.setSelected((req.body || {}).pods) })));
}
module.exports = { mount };
