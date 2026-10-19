// bitGen Studio — routes/modelFolders.js (2.538.0): the folder each model type downloads to (lib/modelFolders.js,
// <app>/model_folders.json). Mounted from routes/index.js (never server.js).
//   GET  /api/modelfolders                     {file, folders: [{key, label, dir}], mains, types, kinds}
//   POST /api/modelfolders {key, dir}          set one type's folder (dir "" forgets it) -> {ok, key, dir, label}
//   POST /api/modelfolders/resolve {base_model, name, category?, family?, cat?, type?}
//                                              -> {key, label, dir (set) | "", suggest, cat, outside}
"use strict";
const mf = require("../lib/modelFolders");

function mount(app) {
  const fail = (res, e) => res.status(500).json({ error: String((e && e.message) || e) });
  app.get("/api/modelfolders", (_req, res) => { try { res.json(mf.list()); } catch (e) { fail(res, e); } });
  app.post("/api/modelfolders", (req, res) => {
    try { const b = req.body || {}; const r = mf.set(String(b.key || ""), String(b.dir || "")); if (r.error) return res.status(400).json(r); res.json(r); } catch (e) { fail(res, e); }
  });
  app.post("/api/modelfolders/resolve", (req, res) => { try { res.json(mf.resolve(req.body || {})); } catch (e) { fail(res, e); } });
}
module.exports = { mount };
