// bitGen Studio — routes/podInv.js (2.787.0): each pod's inventory (lib/podInv.js) + its files in Basic Settings' lists.
// Mounted from routes/index.js BEFORE routes/remoteModels.js (its /api/comfymodels answer is wrapped here too).
//   GET  /api/podinv                  {pods: [{id, name, label, gone, count, listed_at}]} - names kept up to date from RunPod
//                                     (pods.mine(), a minute at most) when a RunPod key is set
//   GET  /api/podinv/:id[?refresh=1&port=]   {inv: {id, name, label, gone, groups: [{kind, label, files}], styles}} -
//                                     refresh = the pod lists its files now (it must be running)
//   2.789.0 NO_Pod (lib/noPod.js, static/nopod.js):
//   GET  /api/podinv/asks             {asks: [{id, name, count, groups, recipe_line, gone_at}]} - terminated pods waiting for your answer
//   POST /api/podinv/:id/keep {keep}  keep = its files stay as "NO_Pod (<old name>)/<file>"; false = taken out (the inventory deleted)
//   GET  /api/podinv/nopod?name=<"NO_Pod (x)/file">   {pod: {id, name, label, recipe, recipe_line, remake_ok, count}, file} | 404
//   POST /api/podinv/:id/remake {ok}  "Make the pod again" (ok) / not now - a render with its file makes it again only when ok
//   2.793.0 NO_Pod part 2 (lib/noPodWhere.js, lib/noPod.js useOn, static/nopod.js):
//   GET  /api/podinv/nopod/where?name=<"NO_Pod (x)/file">   {file, kind, companions, pod (as /nopod), has: [pods that have it],
//                                     others: [pods to put it on - running first], runpod_error} - RunPod asked which pods run
//                                     (the inventories' names kept up to date), the running ones list their files first
//   POST /api/podinv/nopod/use {name, pod}   the file (+ its VAE / text encoders the pod lacks) onto that pod - started first
//                                     when stopped; the pick renamed to "<pod name>/<file>" -> {name, pod_id, started, sending}
//   GET  /api/podinv/nopod/now?name=  the name a stored pick goes by now ({name}) - a NO_Pod made again = "<name>/<file>"
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
  if (!j || !j.categories || !(invs || []).some((i) => PI.listed(i) && (i.files || []).length)) return j;   // 2.789.0: a NO_Pod alone counts
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
    return { pods: PI.all().map((i) => ({ id: i.id, name: i.name, label: PI.labelOf(i), gone: !!i.gone, keep: !!i.keep, ask: !!i.ask, count: (i.files || []).length, listed_at: i.listed_at || 0 })) };
  }));
  // 2.789.0 NO_Pod - before /api/podinv/:id (whose :id would take "asks" / "nopod")
  const NP = () => require("../lib/noPod");
  app.get("/api/podinv/asks", wrap(async () => ({ asks: PI.asks().map((i) => ({ id: i.id, name: i.name, label: PI.baseLabel(i), count: (i.files || []).length,
    groups: PI.groupsOf(i.files).map((g) => ({ label: g.label, n: g.files.length })), recipe_line: NP().recipeLine(require("../lib/podRevive").cleanRecipe(i.recipe)), gone_at: i.gone_at || 0 })) })));
  app.get("/api/podinv/nopod", wrap(async (req) => {
    const v = String(req.query.name || ""), ref = PI.resolve(v, PI.live(), null);
    if (!ref || !ref.nopod) { const e = new Error("no NO_Pod file of that name"); e.status = 404; throw e; }
    const i = PI.load(ref.pod_id), rc = require("../lib/podRevive").cleanRecipe(i.recipe);
    return { pod: { id: i.id, name: i.name, label: PI.labelOf(i), recipe: rc, recipe_line: NP().recipeLine(rc), remake_ok: !!i.remake_ok, count: (i.files || []).filter((f) => f.kind === "model" || f.kind === "lora").length,
      groups: PI.groupsOf(i.files).map((g) => ({ label: g.label, n: g.files.length })) }, file: ref.rel };   // 2.793.0: + groups (the VAE / text encoders go back too)
  }));
  // 2.793.0: where a NO_Pod file can run now - and onto a pod you have
  const rgp = () => { try { return (require("../lib/core").getConfig() || {}).rgpu || {}; } catch { return {}; } };
  const hasKey = () => !!String((rgp().runpod || {}).key || "");
  const portOf = () => +((rgp().runpod || {}).port) || 8188;
  async function podsNow() {
    if (!hasKey()) return { status: {}, error: "" };
    try {
      const mine = (await require("../lib/pods").mine()).pods || [];
      try { PI.sync(mine); } catch { /* names are a nicety */ }
      const status = {};
      for (const p of mine) status[String(p.id).replace(/[^A-Za-z0-9]/g, "")] = { status: p.status, gpu: p.gpu, gpus: p.gpus };
      return { status, error: "" };
    } catch (e) { return { status: {}, error: String((e && e.message) || e).slice(0, 300) }; }
  }
  const within = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);
  app.get("/api/podinv/nopod/where", wrap(async (req) => {
    const v = String(req.query.name || ""), ref = PI.resolve(v, PI.live(), null);
    if (!ref || !ref.nopod) { const e = new Error("no NO_Pod file of that name"); e.status = 404; throw e; }
    const W = require("../lib/noPodWhere"), old = PI.load(ref.pod_id), f = (old.files || []).find((y) => y.cat === ref.cat && y.rel === ref.rel);
    const comps = W.companions(old, f), now = await podsNow();
    // the running pods list their files now (a few seconds at most - a pod that does not answer keeps what bitGen saw last)
    const run = PI.all().filter((i) => !i.gone && i.id !== old.id && /RUNNING/.test(String((now.status[i.id] || {}).status || "")));
    await Promise.all(run.map((i) => within(PI.refresh(i.id, { port: portOf() }).catch(() => null), +(process.env.H3_NOPOD_LIST_MS || 8000))));
    const w = W.where(f, comps, PI.all(), now.status, old.id), words = (L) => L.map((r) => Object.assign(r, { words: W.rowWords(r) }));
    const rc = require("../lib/podRevive").cleanRecipe(old.recipe);
    return { file: f.rel, kind: f.kind, size: f.size || 0, companions: comps.map((c) => c.rel.split("/").pop()), has: words(w.has), others: words(w.others), runpod_error: now.error,
      pod: { id: old.id, name: old.name, label: PI.labelOf(old), recipe: rc, recipe_line: NP().recipeLine(rc), remake_ok: !!old.remake_ok, count: NP().todo({ files: (old.files || []).map((y) => Object.assign({}, y, { state: "todo" })) }).length,
        groups: PI.groupsOf(old.files).map((g) => ({ label: g.label, n: g.files.length })) } };
  }));
  app.post("/api/podinv/nopod/use", wrap(async (req) => {
    const b = req.body || {}, pod = String(b.pod || "").replace(/[^A-Za-z0-9]/g, ""), now = await podsNow();
    const st = String((now.status[pod] || {}).status || "");
    return NP().useOn(String(b.name || ""), pod, { stopped: /EXITED|STOPPED/.test(st), port: portOf() });
  }));
  app.get("/api/podinv/nopod/now", wrap(async (req) => {
    const v = String(req.query.name || ""), r = PI.resolve(v, PI.live(), null);
    if (!r || r.nopod) return { name: v, nopod: !!(r && r.nopod), found: !!r };
    return { name: PI.labelOf(PI.load(r.pod_id)) + "/" + r.rel, pod_id: r.pod_id, found: true };
  }));
  app.post("/api/podinv/:id/keep", wrap(async (req) => {
    const r = PI.decide(req.params.id, !!(req.body || {}).keep);
    if (!r) { const e = new Error("bitGen has no inventory of that pod"); e.status = 404; throw e; }
    return { ok: true, removed: !!r.removed, label: r.removed ? "" : PI.labelOf(r) };
  }));
  app.post("/api/podinv/:id/remake", wrap(async (req) => {
    const r = PI.okRemake(req.params.id, !!(req.body || {}).ok);
    if (!r) { const e = new Error("bitGen has no inventory of that pod"); e.status = 404; throw e; }
    return { ok: true, remake_ok: !!r.remake_ok };
  }));
  app.get("/api/podinv/:id", wrap(async (req) => {
    if (req.query.refresh === "1") await PI.refresh(req.params.id, { port: +req.query.port || 0 });
    const v = PI.view(req.params.id);
    if (!v) { const e = new Error("bitGen has no inventory of that pod yet - open its 📁 Files or render on it"); e.status = 404; throw e; }
    return { inv: v };
  }));
}
module.exports = { mount, withPods };
