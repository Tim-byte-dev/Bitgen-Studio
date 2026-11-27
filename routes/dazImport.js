"use strict";
/**
 * bitGen Studio — routes/dazImport.js (2.993.0): ⤓ Import Daz content zips into a library folder (lib/dazImport.js).
 *   POST /api/dazlib/library    {parent, name, add}  a new library folder + its layout (add = also one of "my library" folders)
 *   POST /api/dazlib/structure  {dir}                the library layout made in a folder (nothing removed)
 *   POST /api/dazlib/zips       {folders, recursive} every .zip found + what each holds (peek: kind dim | daz | zips | none)
 *   POST /api/dazlib/import     {library, zips, overwrite}  starts the import (one at a time) -> the job
 *   GET  /api/dazlib/import                          the job: {state running | done | cancelled, total, done, current, written,
 *                                                    kept, bytes, results [{file, written, kept, skipped, nested, errors, kind}]}
 *   POST /api/dazlib/import/cancel
 */
const DI = require("../lib/dazImport");
const D = require("../lib/dazLib");

function fail(res, e) { res.status((e && e.status) || 500).json({ error: String((e && e.message) || e) }); }

function mount(app) {
  const J = require("express").json({ limit: "2mb" });
  const addRoot = (dir) => { const now = D.roots(); return now.some((r) => String(r).toLowerCase() === String(dir).toLowerCase()) ? now : D.setRoots(now.concat([dir])); };
  app.post("/api/dazlib/library", J, (req, res) => {
    try { const b = req.body || {}, r = DI.newLibrary(b.parent, b.name); res.json(Object.assign(r, b.add === false ? {} : { roots: addRoot(r.dir) })); } catch (e) { fail(res, e); }
  });
  app.post("/api/dazlib/structure", J, (req, res) => {
    try { const b = req.body || {}, made = DI.makeStructure(b.dir); res.json(Object.assign({ dir: b.dir, made }, b.add ? { roots: addRoot(b.dir) } : {})); } catch (e) { fail(res, e); }
  });
  app.post("/api/dazlib/zips", J, async (req, res) => {
    try {
      const b = req.body || {}, zips = DI.findZips(b.folders, { recursive: b.recursive !== false });
      for (let i = 0; i < zips.length && i < 2000; i++) Object.assign(zips[i], await DI.peek(zips[i].path));
      res.json({ zips, more: zips.length >= 5000 });
    } catch (e) { fail(res, e); }
  });
  app.post("/api/dazlib/import", J, (req, res) => {
    try { const b = req.body || {}; res.json(DI.start(b.zips, b.library, { overwrite: !!b.overwrite })); } catch (e) { fail(res, e); }
  });
  app.get("/api/dazlib/import", (_req, res) => res.json(DI.job() || { state: "none" }));
  app.post("/api/dazlib/import/cancel", (_req, res) => res.json(DI.cancel() || { state: "none" }));
}

module.exports = { mount };
