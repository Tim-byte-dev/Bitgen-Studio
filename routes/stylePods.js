// bitGen Studio — routes/stylePods.js (2.763.0): YOUR STYLES ON YOUR PODS (lib/stylePods.js, lib/podPrep.js).
//   GET  /api/stylepods                    {links: {style id: pod id}, kinds: {image, image_edit, video: pod id}}
//   POST /api/stylepods/link               {style_id, pod_id | ""} -> links (one style to a pod / off it)
//   GET  /api/stylepods/ask/:id            the box's offer: GPUs (the first bitGen's pick), your pods, the CUDA 13 template,
//                                          the GPU memory + disk the style wants (?cloud=SECURE|COMMUNITY)
//   POST /api/stylepods/ask/:id            {action: create | use | preset (2.764.0: {name, gpu?}) | cancel, gpu, cloud, volume, pod_id}
//   POST /api/stylepods/prepare/:pod       {styles: [ids], port} -> make them ready on the pod now (background)
//   GET  /api/stylepods/prepare/:pod       how far that is (lib/podPrep.js status)
//   GET  /api/stylepods/route?mode=&style_id=  2.763.2: {pod, why} - a render of the style goes to a pod (the page skips this
//                                          computer's ComfyUI checks)
//   POST /api/stylepods/nodes/:pod         2.763.1: this computer's custom nodes onto the pod (lib/podNodes.js; GET setup .nodes)
"use strict";
const SP = require("../lib/stylePods");

function mount(app) {
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: String((e && e.message) || e) }); } };
  const rg = () => ((require("../lib/core").getConfig() || {}).rgpu) || {};
  app.get("/api/stylepods", wrap(() => ({ links: SP.cleanLinks(rg().style_pods), kinds: { image: SP.kindPod(rg(), "image"), image_edit: SP.kindPod(rg(), "image_edit"), video: SP.kindPod(rg(), "video") } })));
  app.post("/api/stylepods/link", wrap((req) => ({ links: SP.link((req.body || {}).style_id, (req.body || {}).pod_id || "") })));
  // 2.763.2: does a render of this style go to a pod? (the page skips its own ComfyUI's checks then)
  app.get("/api/stylepods/route", wrap((req) => {
    const S = require("../lib/styles"), C = require("../lib/core"), st = S.byId(C.STYLES_DIR, String(req.query.style_id || ""));
    return SP.willUsePod(String(req.query.mode || ""), st);
  }));
  app.get("/api/stylepods/ask/:id", wrap((req) => SP.offer(req.params.id, req.query.cloud)));
  app.post("/api/stylepods/ask/:id", wrap((req) => SP.answer(req.params.id, req.body || {})));
  app.post("/api/stylepods/prepare/:pod", wrap(async (req) => {
    const S = require("../lib/styles"), C = require("../lib/core"), b = req.body || {};
    const sts = (Array.isArray(b.styles) ? b.styles : SP.stylesOf(req.params.pod)).map((x) => S.byId(C.STYLES_DIR, String(x))).filter(Boolean);
    if (!sts.length) { const e = new Error("no styles linked to this pod - pick them in My pods ▸ Styles"); e.status = 400; throw e; }
    const port = +b.port || SP.portOf(rg(), req.params.pod);
    await require("../lib/podModels").ways(req.params.pod, port);
    // 2.773.0: the styles of the prompt docker's mode now (an explicit list = as asked), the others when their mode is used
    const fm = Array.isArray(b.styles) ? { now: sts, later: [] } : require("../lib/remotePrep").forMode(sts);
    if (fm.now.length) require("../lib/podPrep").prepare(req.params.pod, port, fm.now).catch(() => null);
    return { started: fm.now.map((s) => s.name), later: fm.later.map((s) => s.name) };
  }));
  // 2.763.1: My pods ▸ ⬆ My custom nodes; 2.764.2: ⬆ Nodes its styles need - only the packs the pod's styles' workflows use
  // (lib/podPrep.js nodesOnly -> lib/podNodes.js mirror of those folders), in the background
  app.post("/api/stylepods/nodes/:pod", wrap(async (req) => {
    const port = +(req.body || {}).port || SP.portOf(rg(), req.params.pod), PN = require("../lib/podNodes");
    if (!PN.localDir()) { const e = new Error("bitGen did not find this computer's ComfyUI custom_nodes folder - Settings ▸ ComfyUI ▸ Folder"); e.status = 404; throw e; }
    const w = await require("../lib/podModels").ways(req.params.pod, port);
    if (!w.jupyter) { const e = new Error("bitGen puts custom nodes on a pod through its Jupyter - paste its password in ⬇ Models"); e.status = 409; throw e; }
    // 2.764.2 (Tim: "only upload nodes that are necessary for the workflows we are using to the pod"): the packs the pod's
    // styles' workflows use (and it lacks) - not every custom node of this computer
    const S = require("../lib/styles"), C = require("../lib/core"), pod = String(req.params.pod).replace(/[^A-Za-z0-9]/g, "");
    const sts = SP.stylesOf(pod).map((id) => { try { return S.byId(C.STYLES_DIR, id); } catch { return null; } }).filter(Boolean);
    if (!sts.length) { const e = new Error("the pod has no styles yet - put a style on it (Styles, then 💾 Save) and its workflows' nodes go with it"); e.status = 409; throw e; }
    require("../lib/podPrep").prepare(pod, port, sts, { nodesOnly: true }).catch(() => null);
    return { started: sts.length, styles: sts.map((s) => s.name) };
  }));
  // 2.763.4: how many custom node packs this computer would put on a pod (the PODS docker's summary before Create pod)
  app.get("/api/stylepods/nodes", wrap(() => { const L = require("../lib/podNodes").list(); return { count: L.length, folders: L.map((k) => k.folder) }; }));
  app.get("/api/stylepods/prepare/:pod", wrap((req) => ({ prep: require("../lib/podPrep").status(String(req.params.pod).replace(/[^A-Za-z0-9]/g, "")) })));
}
module.exports = { mount };
