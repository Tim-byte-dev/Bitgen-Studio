// bitGen Studio — routes/refmodLib.js (2.588.0): 🧬 THE REFMOD LIBRARY (lib/refmodLib.js) - the 🎓 docker's 🧬 RefMods.
//   GET    /api/refmodlib                              {types, items, captioning, comfy: {backend, dir}}
//   POST   /api/refmodlib                  {name, type, description} -> the new one
//   GET    /api/refmodlib/:name                        meta + media (captions) + counts + has_mod
//   PATCH  /api/refmodlib/:name            {type, description}
//   DELETE /api/refmodlib/:name                        the folder (dataset + mod)
//   POST   /api/refmodlib/:name/upload     multipart "files" (pictures, videos, sounds, .txt captions) -> sorted
//   GET    /api/refmodlib/:name/file/:kind/:file       the file (thumbnails, players)
//   DELETE /api/refmodlib/:name/file/:kind/:file
//   POST   /api/refmodlib/:name/caption    {kind, file, caption}
//   POST   /api/refmodlib/:name/autocaption {overwrite}    GET /api/refmodlib/captioning
//   POST   /api/refmodlib/:name/extract                a queue job (the pack's Extract node, ComfyUI) -> {job, mod, pictures, notes}
//   POST   /api/refmodlib/:name/adopt                  after the job: the mod into refmod/<name>/
//   POST   /api/refmodlib/tags             {prompt}    what @tags a prompt uses (the prompt docker's hint)
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const multer = require("multer");
const core = require("../lib/core");
const R = require("../lib/refmodLib");

const upload = multer({ storage: multer.diskStorage({ destination: os.tmpdir(), filename: (_q, f, cb) => cb(null, "bgrm-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8)) }),
  limits: { fileSize: 2 * 1024 * 1024 * 1024, files: 200 } });
const comfyDir = () => {
  try { const d = require("../lib/comfy").comfyCfg().dir; return d ? (path.isAbsolute(d) ? d : path.join(core.BASE, d)) : ""; } catch { return ""; }
};
const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (e) { res.status(e.status || 500).json({ error: String((e && e.message) || e) }); }
};

function mount(app) {
  app.get("/api/refmodlib", wrap((_q, res) => res.json({ types: R.TYPES, items: R.list(), captioning: R.captionState(), root: "refmod",
    comfy: { backend: ((core.getConfig().engine || {}).backend) || "", dir: comfyDir() } })));
  app.get("/api/refmodlib/captioning", wrap((_q, res) => res.json(R.captionState())));
  app.post("/api/refmodlib/tags", wrap((q, res) => { const r = R.forPrompt((q.body || {}).prompt, ""); res.json({ used: r.used, notes: r.notes, prompt: r.prompt }); }));
  app.post("/api/refmodlib", wrap((q, res) => { const b = q.body || {}; res.json(R.create(b.name, b.type, b.description)); }));
  app.get("/api/refmodlib/:name", wrap((q, res) => res.json(R.info(q.params.name))));
  app.patch("/api/refmodlib/:name", wrap((q, res) => res.json(R.update(q.params.name, q.body || {}))));
  app.delete("/api/refmodlib/:name", wrap((q, res) => res.json(R.remove(q.params.name))));
  app.post("/api/refmodlib/:name/upload", upload.array("files", 200), wrap((q, res) => {
    try { res.json(R.addFiles(q.params.name, q.files || [])); }
    finally { for (const f of q.files || []) if (f.path) { try { fs.rmSync(f.path, { force: true }); } catch { /* moved */ } } }
  }));
  app.get("/api/refmodlib/:name/file/:kind/:file", wrap((q, res) => {
    const p = R.fileIn(q.params.name, q.params.kind, q.params.file);
    if (!fs.existsSync(p)) return res.status(404).json({ error: "no such file" });
    res.sendFile(p);
  }));
  app.delete("/api/refmodlib/:name/file/:kind/:file", wrap((q, res) => res.json(R.removeFile(q.params.name, q.params.kind, q.params.file))));
  app.post("/api/refmodlib/:name/caption", wrap((q, res) => { const b = q.body || {}; res.json(R.setCaption(q.params.name, b.kind, b.file, b.caption)); }));
  app.post("/api/refmodlib/:name/autocaption", wrap((q, res) => res.json(R.autoCaption(q.params.name, !!(q.body || {}).overwrite))));
  app.post("/api/refmodlib/:name/extract", wrap((q, res) => {
    if ((core.getConfig().engine || {}).backend !== "comfy")
      return res.status(400).json({ error: "RefMod extraction runs through ComfyUI - set Settings ▸ ComfyUI ▸ Engine to ComfyUI API first" });
    const ex = R.extractJob(q.params.name);
    const job = core.makeJob(ex.params);
    job.chunk = { i: 0, n: 1 };
    res.json(Object.assign(core.jobDict(job), { job: job.id, mod: ex.mod, pictures: ex.pictures, notes: ex.notes }));
  }));
  app.post("/api/refmodlib/:name/adopt", wrap((q, res) => res.json(R.adopt(q.params.name, comfyDir()))));
}

module.exports = { mount, comfyDir };
