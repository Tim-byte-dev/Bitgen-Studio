// bitGen Studio — routes/podInv.js (2.787.0): each pod's inventory (lib/podInv.js) + its files in Basic Settings' lists.
// Mounted from routes/index.js BEFORE routes/remoteModels.js (its /api/comfymodels answer is wrapped here too).
//   GET  /api/podinv                  {pods: [{id, name, label, gone, count, listed_at}]} - names kept up to date from RunPod
//                                     (pods.mine(), a minute at most) when a RunPod key is set
//   GET  /api/podinv/:id[?refresh=1&port=]   {inv: {id, name, label, gone, groups: [{kind, label, files}], styles}} -
//                                     refresh = the pod lists its files now (it must be running)
//   GET  /api/comfymodels             whoever answers it (this computer / remote mode): each live pod's checkpoints,
//                                     diffusion models, unets and LoRAs ADDED as "<pod name>/<file>" (pod_models: true)
"use strict";
const PI = require("../lib/podInv");

let SYNC = 0;
async function syncNames() {
  if (Date.now() - SYNC < 60000) return;
  SYNC = Date.now();
  try {
    const C = require("../lib/core"), key = String((((C.getConfig() || {}).rgpu || {}).runpod || {}).key || "");
    if (!key) return;
    PI.sync((await require("../lib/pods").mine()).pods || []);
  } catch { SYNC = 0; /* RunPod did not answer - the names stay */ }
}
/** this computer's / the remote answer with the pods' files added (pure on its inputs) */
function withPods(j, invs) {
  if (!j || !j.categories || !(invs || []).some((i) => !i.gone && (i.files || []).length)) return j;
  const add = PI.entries(invs), out = Object.assign({}, j, { categories: Object.assign({}, j.categories), pod_models: true });
  for (const [c, list] of Object.entries(add)) {
    if (!list.length) continue;
    const L = (out.categories[c] && Array.isArray(out.categories[c].files)) ? out.categories[c].files.slice() : [];
    const have = new Set(L.map((f) => String((f && f.name) || f).toLowerCase()));
    for (const f of list) if (!have.has(f.name.toLowerCase())) L.push(f);
    out.categories[c] = Object.assign({}, out.categories[c] || {}, { files: L });
  }
  return out;
}
function mount(app) {
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: String((e && e.message) || e) }); } };
  app.get("/api/comfymodels", (req, res, next) => {
    let invs = []; try { invs = PI.live(); } catch { invs = []; }
    if (invs.length) { const json = res.json.bind(res); res.json = (j) => json(withPods(j, invs)); }
    syncNames();
    next();
  });
  app.get("/api/podinv", wrap(async () => {
    await syncNames();
    return { pods: PI.all().map((i) => ({ id: i.id, name: i.name, label: PI.labelOf(i), gone: !!i.gone, count: (i.files || []).length, listed_at: i.listed_at || 0 })) };
  }));
  app.get("/api/podinv/:id", wrap(async (req) => {
    if (req.query.refresh === "1") await PI.refresh(req.params.id, { port: +req.query.port || 0 });
    const v = PI.view(req.params.id);
    if (!v) { const e = new Error("bitGen has no inventory of that pod yet - open its 📁 Files or render on it"); e.status = 404; throw e; }
    return { inv: v };
  }));
}
module.exports = { mount, withPods };
