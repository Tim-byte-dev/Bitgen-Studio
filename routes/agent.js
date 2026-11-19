// routes/agent.js — 2.887.0: 🧰 files and commands for the LLM (lib/agentTools.js; the tool loop is lib/llmAgent.js).
//   GET  /api/agent/settings                 {folder, timeout, exists, problem}
//   POST /api/agent/settings {folder?, timeout?}   the folder the LLM may work in (checked - never a drive, home or bitGen's own)
//   GET  /api/agent/asks                     the changes / commands waiting for the user's yes or no (the page polls this
//                                            while a chat turn runs - ext/promptdock/ptagent.js)
//   POST /api/agent/answer {id, ok, all?}    yes / no (all = yes to every change for the rest of this answer; never commands)
//   GET  /api/agent/log                      the last 200 changes and commands (newest first)
//   POST /api/agent/restore {backup}         ↶ put a changed file back from its backup
"use strict";
function mount(app) {
  const A = () => require("../lib/agentTools");
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ ok: false, error: e.message || String(e) }); } };
  app.get("/api/agent/settings", wrap(() => A().view()));
  app.post("/api/agent/settings", wrap((req) => A().save(req.body || {})));
  app.get("/api/agent/asks", (_req, res) => res.json({ asks: A().asks() }));
  app.post("/api/agent/answer", wrap((req) => { const b = req.body || {}; return { ok: A().answer(b.id, b.ok === true, b.all === true) }; }));
  app.get("/api/agent/log", wrap(() => ({ entries: A().readLog() })));
  app.post("/api/agent/restore", wrap((req) => A().restore("", (req.body || {}).backup)));
}
module.exports = { mount };
