// bitGen Studio — routes/orModels.js (2.786.0): OpenRouter models - the dialog's lists, your list, the check before a render.
// lib/orModels.js (lists + your list), lib/orRender.js (rendering pictures / video there). Mounted from routes/index.js.
//   GET  /api/ormodels?type=image|video|llm|vlm[&refresh=1]  {type, types, families, models, mine, removed, error, key}
//   GET  /api/ormodels/mine[?check=1]                         {removed (check=1: taken off - OpenRouter no longer lists them), mine: {image, video, llm, vlm}, runs, use, prefix, key, llm: {model, vlm_model}}
//   POST /api/ormodels/add     {type, id}                     {mine, added}
//   POST /api/ormodels/remove  {type, id}                     {mine, removed}
//   POST /api/ormodels/use     {type, id}                     image / video: the model Runs on = OpenRouter uses;
//                                                             llm / vlm: OpenRouter's model + the LLM / Vision LLM runs on OpenRouter
//   POST /api/ormodels/check   {kind: image|video, model, n, seconds, w, h}   {openrouter: false} | {openrouter, id, name, estimate, ignored} | {openrouter, error}
"use strict";
const OM = require("../lib/orModels");
const ORR = require("../lib/orRender");

function mount(app) {
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 502).json({ error: String((e && e.message) || e) }); } };
  const id = (v) => String(v || "").trim().replace(/[^A-Za-z0-9_.:/@~+-]/g, "").slice(0, 200);
  app.get("/api/ormodels", wrap((req) => OM.view(String(req.query.type || "image"), req.query.refresh === "1")));
  app.get("/api/ormodels/mine", wrap(async (req) => { const O = require("../lib/openRouter").cfg();
    const removed = req.query.check === "1" ? await OM.checkMine() : [];   // a model OpenRouter no longer lists is taken off (said)
    return { removed, mine: OM.mine(), runs: ORR.runs(), use: { image: ORR.useOf("image"), video: ORR.useOf("video") }, prefix: ORR.PREFIX, key: !!O.key, llm: { model: O.model, vlm_model: O.vlm_model } }; }));
  app.post("/api/ormodels/add", wrap((req) => OM.add(String((req.body || {}).type || ""), id((req.body || {}).id))));
  app.post("/api/ormodels/remove", wrap((req) => OM.remove(String((req.body || {}).type || ""), id((req.body || {}).id))));
  app.post("/api/ormodels/use", wrap((req) => {
    const b = req.body || {}, t = String(b.type || ""), m = id(ORR.idOf(b.id) || b.id);
    if (!OM.TYPE_IDS.includes(t)) throw Object.assign(new Error("type must be image, video, llm or vlm"), { status: 400 });
    if (t === "image" || t === "video") { ORR.setUse(t, m); return { ok: true, type: t, id: m }; }
    // the LLM / Vision LLM: OpenRouter's model, and it runs there (☁ Runs on ▸ LLM / Vision LLM = OpenRouter)
    require("../lib/openRouter").save(t === "vlm" ? { vlm_model: m } : { model: m });
    const v = require("../lib/remoteHosts").set(t, "openrouter");
    return { ok: true, type: t, id: m, hosts: v.hosts };
  }));
  app.post("/api/ormodels/check", wrap((req) => {
    const b = req.body || {}, k = b.kind === "video" ? "video" : "image";
    return ORR.check(k, String(b.model || ""), { n: +b.n || 1, seconds: +b.seconds || 5, w: +b.w || 0, h: +b.h || 0 });
  }));
}
module.exports = { mount };
