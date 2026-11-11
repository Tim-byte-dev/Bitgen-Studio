// bitGen Studio — routes/stylePods.js (2.763.0): YOUR STYLES ON YOUR PODS (lib/stylePods.js, lib/podPrep.js).
//   GET  /api/stylepods                    {links: {style id: pod id}, kinds: {image, image_edit, video: pod id}}
//   POST /api/stylepods/link               {style_id, pod_id | ""} -> links (one style to a pod / off it)
//   GET  /api/stylepods/ask/:id            the box's offer: GPUs (the first bitGen's pick), your pods, the CUDA 13 template,
//                                          the GPU memory + disk the style wants (?cloud=SECURE|COMMUNITY)
//   POST /api/stylepods/ask/:id            {action: create | use | cancel, gpu, cloud, volume, pod_id}
//   POST /api/stylepods/prepare/:pod       {styles: [ids], port} -> make them ready on the pod now (background)
//   GET  /api/stylepods/prepare/:pod       how far that is (lib/podPrep.js status)
"use strict";
const SP = require("../lib/stylePods");

function mount(app) {
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: String((e && e.message) || e) }); } };
  const rg = () => ((require("../lib/core").getConfig() || {}).rgpu) || {};
  app.get("/api/stylepods", wrap(() => ({ links: SP.cleanLinks(rg().style_pods), kinds: { image: SP.kindPod(rg(), "image"), image_edit: SP.kindPod(rg(), "image_edit"), video: SP.kindPod(rg(), "video") } })));
  app.post("/api/stylepods/link", wrap((req) => ({ links: SP.link((req.body || {}).style_id, (req.body || {}).pod_id || "") })));
  app.get("/api/stylepods/ask/:id", wrap((req) => SP.offer(req.params.id, req.query.cloud)));
  app.post("/api/stylepods/ask/:id", wrap((req) => SP.answer(req.params.id, req.body || {})));
  app.post("/api/stylepods/prepare/:pod", wrap(async (req) => {
    const S = require("../lib/styles"), C = require("../lib/core"), b = req.body || {};
    const sts = (Array.isArray(b.styles) ? b.styles : SP.stylesOf(req.params.pod)).map((x) => S.byId(C.STYLES_DIR, String(x))).filter(Boolean);
    if (!sts.length) { const e = new Error("no styles linked to this pod - pick them in My pods ▸ Styles"); e.status = 400; throw e; }
    const port = +b.port || SP.portOf(rg(), req.params.pod);
    await require("../lib/podModels").ways(req.params.pod, port);
    require("../lib/podPrep").prepare(req.params.pod, port, sts).catch(() => null);
    return { started: sts.map((s) => s.name) };
  }));
  app.get("/api/stylepods/prepare/:pod", wrap((req) => ({ prep: require("../lib/podPrep").status(String(req.params.pod).replace(/[^A-Za-z0-9]/g, "")) })));
}
module.exports = { mount };
