// bitGen Studio — routes/refKeep.js (2.548.0): the reference docker's autosave (lib/refKeep.js). Mounted from
// routes/index.js.
//   POST /api/projects/refs   multipart: project, data (the manifest JSON - {images, videos, audio, notes}), ref_images
//                             (only the pictures not stored yet, named as in the manifest); JSON {project, references}
//                             works too (no new pictures) -> {references} | 409 another project is open
"use strict";
const path = require("path");
const core = require("../lib/core");
const refKeep = require("../lib/refKeep");
const projectRefs = require("../lib/projectRefs");

function mount(app) {
  app.post("/api/projects/refs", refKeep.upload().array("ref_images", projectRefs.MAX_IMAGES), (req, res) => {
    try {
      const b = req.body || {};
      let m = b.data !== undefined ? b.data : b.references;
      if (typeof m === "string") { try { m = JSON.parse(m); } catch { return res.status(400).json({ error: "data is not JSON" }); } }
      if (!m || typeof m !== "object") return res.status(400).json({ error: "no references" });
      const cur = core.getProject();
      const stored = refKeep.keep({ project: b.project, current: cur, manifest: m, files: req.files || [],
        projDir: core.projDir(cur), prjPath: core.prjPath(cur), assetPath: (kind, n) => path.join(core.pDir(kind), n) });
      res.json({ references: stored, project: cur });
    } catch (e) { res.status(e.status || 500).json({ error: String((e && e.message) || e) }); }
  });
}
module.exports = { mount };
