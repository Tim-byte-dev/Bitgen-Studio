// bitGen Studio — SAVE / SAVE AS (2.359.0). Mounted by routes/index.js (never server.js); the copying and the
// remembered folder are lib/saveAs.js, the folder + name picker is static/filedialog.js (mode "save"), the
// buttons are static/index.html (the preview dialog's 💾 Save, the gallery tiles' Save as).
//
// LOOPBACK ONLY, like the file dialog: these write anywhere on this disk. The phone remote and any other LAN
// device get a 403 in words (the page then downloads through the browser instead).
//
//   GET  /api/save-as/last                       {dir, exists} - the last save-as folder
//   POST /api/save-as {url, dest?, dir?, name?, overwrite?}
//        dest = Save as (the picked full path; the folder is remembered); none = Save (the last folder, a free
//        name - never an overwrite). 409 {need_dir} when there is no folder yet / it is gone.
//   POST /api/save-as/upload  multipart file + the same fields - for a picture only the page holds (blob:/data:)
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const multer = require("multer");
const saveAs = require("../lib/saveAs");
const fdlg = require("../lib/fileDialog");

const upload = multer({ dest: path.join(os.tmpdir(), "bitgen-saveas"), limits: { fileSize: 4 * 1024 * 1024 * 1024, files: 1 } });

function opts(b) {
  return { dest: b.dest || "", dir: b.dir || "", name: b.name || "", overwrite: b.overwrite === true || b.overwrite === "1" };
}

function answer(res, r, name) {
  if (r.error) return res.status(r.status || 400).json({ error: r.error, need_dir: !!r.need_dir });
  res.json({ ...r, note: r.same ? `${r.name} is already in ${r.dir}`
    : `saved ${r.name} to ${r.dir}` + (r.renamed ? ` (${name} was already there)` : "") });
}

function mount(app) {
  app.use("/api/save-as", (req, res, next) => {
    if (fdlg.isLoopback(req)) return next();
    res.status(403).json({ error: "Save / Save as write to the computer running bitGen Studio - use it there "
      + "(this device downloads through the browser instead)" });
  });
  app.get("/api/save-as/last", (_req, res) => res.json(saveAs.last()));
  app.post("/api/save-as", (req, res) => {
    const b = req.body || {};
    const src = saveAs.resolve(b.url);
    if (!src) return res.status(404).json({ error: "that file is not one this app serves from disk", upload: true });
    const o = opts(b);
    answer(res, saveAs.copyOut(src, o), saveAs.safeName(o.dest ? path.basename(o.dest) : (o.name || path.basename(src))));
  });
  app.post("/api/save-as/upload", upload.single("file"), (req, res) => {
    const f = req.file;
    if (!f) return res.status(400).json({ error: "no file in the request" });
    try {
      const b = req.body || {};
      const o = opts(b);
      if (!o.dest && !o.name) o.name = f.originalname;
      answer(res, saveAs.copyOut(f.path, o), saveAs.safeName(o.dest ? path.basename(o.dest) : o.name));
    } finally { try { fs.unlinkSync(f.path); } catch {} }
  });
}

module.exports = { mount };
