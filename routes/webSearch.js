// routes/webSearch.js — 2.885.0: 🌐 the LLM's web search (lib/webTools.js, lib/llmAgent.js).
//   GET  /api/websearch/settings              {brave: {on, hasKey, tail}, searxng: {url}, engine} - the key never comes back
//   POST /api/websearch/settings  {braveOn?, braveKey?, searxngUrl?}   saved (the key encrypted - lib/secrets.js)
//   POST /api/websearch/test      {which?: brave | searxng | wikipedia}   one search -> {ok, engine, results, first}
//   2.886.0  GET /api/websearch/searxng {installed, running, url, log, job} · POST /searxng/install | start | stop
//   GET  /api/websearch/activity              what the chat's tool loop is doing now {busy, steps: [{tool, args, ok, detail}]}
"use strict";
const LIVE = { busy: false, steps: [], at: 0 };
function mount(app) {
  const T = () => require("../lib/webTools");
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ ok: false, error: e.message || String(e) }); } };
  app.get("/api/websearch/settings", wrap(() => T().view()));
  app.post("/api/websearch/settings", wrap((req) => T().save(req.body || {})));
  app.post("/api/websearch/test", wrap((req) => T().test(String((req.body || {}).which || ""))));
  // 2.886.0: 🔎 bitGen's own SearXNG (lib/searxngLocal.js) - installed from Settings ▸ General, started when a search needs it
  const SX = () => require("../lib/searxngLocal");
  const JOB = { state: "idle", error: "" };
  app.get("/api/websearch/searxng", wrap(async () => Object.assign(await SX().status(), { job: JOB })));
  app.post("/api/websearch/searxng/install", wrap(() => {
    if (JOB.state === "running") return { ok: true, job: JOB };
    Object.assign(JOB, { state: "running", error: "" });
    SX().install().then((r) => Object.assign(JOB, { state: r.ok ? "done" : "error", error: r.error || "" })).catch((e) => Object.assign(JOB, { state: "error", error: String((e && e.message) || e) }));
    return { ok: true, job: JOB };
  }));
  app.post("/api/websearch/searxng/start", wrap(() => SX().start()));
  app.post("/api/websearch/searxng/stop", wrap(() => ({ ok: true, stopped: SX().stop() })));
  app.get("/api/websearch/activity", (_req, res) => res.json({ busy: LIVE.busy, steps: LIVE.steps.slice(-6), at: LIVE.at }));
}
/** the chat turn with the web tools on (routes/index.js /api/chat calls this when context.web is true) */
async function chatTurn(core, opts) {
  LIVE.busy = true; LIVE.steps = []; LIVE.at = Date.now();
  try { return await require("../lib/llmAgent").run(core, Object.assign({}, opts, { onStep: (s) => LIVE.steps.push(s) })); }
  finally { LIVE.busy = false; }
}
module.exports = { mount, chatTurn, LIVE };
