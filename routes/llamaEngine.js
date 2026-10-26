// bitGen Studio — routes/llamaEngine.js (2.596.0): Settings ▸ LLM ▸ the llama.cpp engine (lib/llamaEngine.js). Mounted from
// routes/index.js (never server.js).
//   GET  /api/llm/engine?check=1     {dir, installed, version, running, latest: {tag, url} | {error} (check=1 asks GitHub),
//                                    update: true when the newest is newer, job}
//   POST /api/llm/engine/install     -> {ok, job} | 409 {error}   (the engine is not there yet)
//   POST /api/llm/engine/update      -> {ok, job} | 409 {error}   (stops the LLM + vision servers, the newest over it)
//   GET  /api/llm/engine/job?from=n  {job: {action, state, lines (from n), n, error, before, after, seconds}}
"use strict";
const E = require("../lib/llamaEngine");

function jobOut(from) {
  const j = E.job();
  if (!j) return null;
  const f = Math.max(0, parseInt(from, 10) || 0);
  return { action: j.action, state: j.state, lines: j.lines.slice(f), n: j.lines.length, error: j.error, before: j.before, after: j.after,
           seconds: Math.round(((j.finished || Date.now()) - j.started) / 1000) };
}
function mount(app) {
  app.get("/api/llm/engine", async (req, res) => {
    try {
      const i = E.info();
      const out = Object.assign({}, i, { job: jobOut(1e9) });
      if (req.query.check) { out.latest = await E.latest(req.query.check === "force"); out.update = !!(out.latest && out.latest.tag && i.installed && E.newer(i.version, out.latest.tag)); }
      res.json(out);
    } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
  });
  for (const act of ["install", "update"]) {
    app.post("/api/llm/engine/" + act, (_req, res) => {
      const r = E.start(act);
      if (r.error) return res.status(409).json({ error: r.error });
      res.json({ ok: true, job: jobOut(0) });
    });
  }
  app.get("/api/llm/engine/job", (req, res) => res.json({ job: jobOut(req.query.from) }));
}
module.exports = { mount };
