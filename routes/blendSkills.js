// routes/blendSkills.js — 2.855.0 🟧 Blender skills (lib/blendSkills.js; the sheets + scripts in blender/skills/, MIT).
// Mounted from routes/index.js.
//   GET  /api/blendskills                 -> {skills, tools, need}   need = null when Blender 5.2+ is there, else the Download box's words
//   POST /api/blendskills/plan  {ask, skill?, scene?}        -> {skill, script, problems}   ✨ the LLM's script, shown before it runs
//   POST /api/blendskills/model {ask, script, skill?, blend?} -> {ok, path, preview, tries, qa}   run on a copy, fixed up to 3 tries
//   POST /api/blendskills/tool  {tool, blend, args}          -> {ok, result, path?, exported?}  🧰 a skill script on a copy
//   GET  /api/blendskills/preview?f=      a preview picture made in the project's blender folder
"use strict";
const express = require("express"), path = require("path"), fs = require("fs");
function mount(app) {
  const K = () => require("../lib/blendSkills");
  const J = express.json({ limit: "2mb" });
  const send = (res, e) => res.status(e.status || 500).json(Object.assign({ error: e.message || String(e) }, e.need ? { need: e.need } : {}));
  app.get("/api/blendskills", async (_req, res) => { try { res.json(Object.assign(K().list(), { need: await K().need() })); } catch (e) { send(res, e); } });
  app.post("/api/blendskills/plan", J, async (req, res) => { try { res.json(await K().plan(req.body || {})); } catch (e) { send(res, e); } });
  app.post("/api/blendskills/model", J, async (req, res) => { try { res.json(await K().model(req.body || {})); } catch (e) { send(res, e); } });
  app.post("/api/blendskills/tool", J, async (req, res) => { try { res.json(await K().tool(req.body || {})); } catch (e) { send(res, e); } });
  app.get("/api/blendskills/preview", (req, res) => {
    try {
      const d = path.resolve(require("../lib/blendView").dir()), f = path.resolve(String(req.query.f || ""));
      if (!f.startsWith(d + path.sep) || !/\.png$/i.test(f) || !fs.existsSync(f)) return res.status(404).json({ error: "no such preview" });
      res.set("Cache-Control", "no-store").sendFile(f);
    } catch (e) { send(res, e); }
  });
}
module.exports = { mount };
