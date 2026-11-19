// routes/agent.js — 2.887.0: 🧰 files and commands for the LLM (lib/agentTools.js; the tool loop is lib/llmAgent.js).
//   GET  /api/agent/settings                 {folder, timeout, exists, problem}
//   POST /api/agent/settings {folder?, timeout?}   the folder the LLM may work in (checked - never a drive, home or bitGen's own)
//   GET  /api/agent/asks                     the changes / commands waiting for the user's yes or no (the page polls this
//                                            while a chat turn runs - ext/promptdock/ptagent.js)
//   POST /api/agent/answer {id, ok, all?}    yes / no (all = yes to every change for the rest of this answer; never commands)
//   GET  /api/agent/log                      the last 200 changes and commands (newest first)
//   POST /api/agent/restore {backup}         ↶ put a changed file back from its backup
//   2.888.0: POST /api/agent/answer also takes {result, state, why} (an 🎛 app action done by the page);
//            GET /api/skills, GET /api/skills/:name, POST /api/skills {name, description, body, was?}, POST /api/skills/import
//            {text}, DELETE /api/skills/:name (yours only)
"use strict";
function mount(app) {
  const A = () => require("../lib/agentTools");
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ ok: false, error: e.message || String(e) }); } };
  app.get("/api/agent/settings", wrap(() => A().view()));
  app.post("/api/agent/settings", wrap((req) => A().save(req.body || {})));
  app.get("/api/agent/asks", (_req, res) => res.json({ asks: A().asks() }));
  app.post("/api/agent/answer", wrap((req) => { const b = req.body || {}; return { ok: A().answer(b.id, b.ok === true, b.all === true, { result: b.result == null ? undefined : String(b.result).slice(0, 2000), state: b.state && typeof b.state === "object" ? b.state : undefined, why: b.why }) }; }));
  // 2.888.0: 🎛 skills (lib/skills.js) - the built-in ones and yours (Settings ▸ General ▸ 🎛 Skills)
  const SK = () => require("../lib/skills");
  app.get("/api/skills", wrap(() => ({ skills: SK().list() })));
  app.get("/api/skills/:name", wrap((req) => SK().get(req.params.name)));
  app.post("/api/skills", wrap((req) => SK().save(req.body || {})));
  app.post("/api/skills/import", wrap((req) => { const b = req.body || {}; const p = SK().parse(b.text); return SK().save({ name: p.name || b.name, description: p.description, body: p.body }); }));
  app.delete("/api/skills/:name", wrap((req) => SK().remove(req.params.name)));
  app.get("/api/agent/log", wrap(() => ({ entries: A().readLog() })));
  app.post("/api/agent/restore", wrap((req) => A().restore("", (req.body || {}).backup)));
}
module.exports = { mount };
