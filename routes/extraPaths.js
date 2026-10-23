// bitGen Studio — routes/extraPaths.js (2.580.0): the 🧩 Model manager's 📁 Model paths tab (lib/extraPaths.js) and its
// ⟳ Restart ComfyUI button (lib/comfyRestart.js).
//   GET  /api/comfy/extrapaths            {file, exists, mtime, also_found, groups[], keys[], next, warnings}
//   POST /api/comfy/extrapaths/group      {base_path, name?, mtime}            a new group other_ui<n>
//   POST /api/comfy/extrapaths/save       {name, rename?, base_path, is_default, paths: [{key, value}], mtime}
//   POST /api/comfy/extrapaths/delete     {name, mtime}
//   POST /api/comfy/restart               {ok, restarted | started | external, reason}
// Every write answers with the file read again; 409 = the file changed on disk since it was read.
"use strict";
const XP = require("../lib/extraPaths");
const CR = require("../lib/comfyRestart");

const send = (res, d) => res.status(d.error ? (d.status || 400) : 200).json(d);
const safe = (fn) => (req, res) => {
  try { send(res, fn(req.body || {})); } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};

function mount(app) {
  app.get("/api/comfy/extrapaths", safe(() => XP.read()));
  app.post("/api/comfy/extrapaths/group", safe((b) => XP.addGroup(b)));
  app.post("/api/comfy/extrapaths/save", safe((b) => XP.saveGroup(b)));
  app.post("/api/comfy/extrapaths/delete", safe((b) => XP.deleteGroup(b)));
  app.post("/api/comfy/restart", async (_req, res) => {
    const r = await CR.restart();
    res.status(r.error ? 400 : 200).json(r);
  });
}

module.exports = { mount };
