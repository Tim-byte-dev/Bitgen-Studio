// bitGen Studio — THE FILE DIALOG routes (2.326.0). Mounted from
// routes/index.js (never server.js). The file system is lib/fileDialog.js,
// the places + thumbnails are scripts/fdlg_helper.py via lib/fdlgHelper.js,
// the dialog is static/filedialog.js.
//
// LOOPBACK ONLY. These routes browse - and /file READS - anything on this
// disk, so they answer only a page opened on this machine (the app window
// or a browser at 127.0.0.1). The phone remote and any other LAN device get
// a 403 in words and keep their own browser file pickers.
//
//   GET  /api/fdlg/places            quick access, drives, the app's places
//   GET  /api/fdlg/list?dir=&exts=&hidden=&folders=
//   GET  /api/fdlg/search?dir=&q=&exts=&folders=
//   GET  /api/fdlg/stat?path=
//   GET  /api/fdlg/thumb?path=&size= a cached JPEG (404 = show the icon)
//   GET  /api/fdlg/file?path=        the file's bytes (the upload shim)
//   POST /api/fdlg/mkdir {dir, name?}
//   POST /api/fdlg/rename {dir, from, to}
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("../lib/core");
const fdlg = require("../lib/fileDialog");
const helper = require("../lib/fdlgHelper");

function comfyDir() {
  try { return require("../lib/comfy").comfyCfg().dir || ""; } catch { return ""; }
}

function mount(app) {
  app.use("/api/fdlg", (req, res, next) => {
    if (fdlg.isLoopback(req)) return next();
    res.status(403).json({ error: "the file dialog only opens on the computer running bitGen Studio" });
  });
  const py = () => { helper.configure({ python: core.getConfig().python || "python" }); };

  app.get("/api/fdlg/places", async (_req, res) => {
    py();
    const p = await helper.places(fdlg.nodePlaces);
    res.json({ ...p, app: fdlg.appPlaces(core, comfyDir()), start: core.BASE });
  });
  app.get("/api/fdlg/list", (req, res) => {
    res.json(fdlg.list(req.query.dir, { exts: req.query.exts, base: core.BASE,
      hidden: req.query.hidden === "1", foldersOnly: req.query.folders === "1" }));
  });
  app.get("/api/fdlg/search", (req, res) => {
    res.json(fdlg.search(req.query.dir, req.query.q, { exts: req.query.exts, base: core.BASE,
      hidden: req.query.hidden === "1", foldersOnly: req.query.folders === "1" }));
  });
  app.get("/api/fdlg/stat", (req, res) => res.json(fdlg.stat(req.query.path, core.BASE)));
  app.get("/api/fdlg/thumb", async (req, res) => {
    py();
    const src = fdlg.resolveDir(req.query.path, core.BASE);
    const r = await helper.thumb(src, req.query.size, path.join(core.WORKSPACE, "thumbcache"));
    if (r.error) return res.status(404).json(r);
    res.set("Cache-Control", "private, max-age=3600");
    res.sendFile(r.path);
  });
  app.get("/api/fdlg/file", (req, res) => {
    const p = fdlg.resolveDir(req.query.path, core.BASE);
    let st;
    try { st = fs.statSync(p); } catch { return res.status(404).json({ error: `not found: ${p}` }); }
    if (!st.isFile()) return res.status(400).json({ error: "that is a folder, not a file" });
    res.set("X-File-Name", encodeURIComponent(path.basename(p)));
    res.set("X-File-Mtime", String(Math.round(st.mtimeMs)));
    res.sendFile(p, { dotfiles: "allow" });
  });
  app.post("/api/fdlg/mkdir", (req, res) => {
    const b = req.body || {};
    const r = fdlg.mkdir(fdlg.resolveDir(b.dir, core.BASE), b.name);
    res.status(r.error ? 400 : 200).json(r);
  });
  app.post("/api/fdlg/rename", (req, res) => {
    const b = req.body || {};
    const r = fdlg.rename(fdlg.resolveDir(b.dir, core.BASE), b.from, b.to);
    res.status(r.error ? 400 : 200).json(r);
  });
}

module.exports = { mount };
