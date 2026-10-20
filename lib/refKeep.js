// bitGen Studio — lib/refKeep.js (2.548.0): the reference docker kept as it changes, not only on 💾 Save.
// Tim: "keep the references in the reference docker on close and on project save. they clear right now".
//   upload()           the multer for the dock's pictures - up to projectRefs.MAX_IMAGES (the shared one stops at 9 files:
//                      a 10th picture refused the whole project save)
//   keep(project, current, manifest, files, assetPath)
//                      the page's own autosave: refused (409) when the page's project is not the server's (a page left
//                      open on another project must never write into this one); stores the pictures (projectRefs.store)
//                      and writes ONLY `references` into the .prj -> the stored manifest
"use strict";
const projectRefs = require("./projectRefs");

let up = null;
function upload() {
  if (!up) { const multer = require("multer"); up = multer({ storage: multer.memoryStorage(), limits: { fileSize: 64 * 1024 * 1024, files: projectRefs.MAX_IMAGES } }); }
  return up;
}
function keep(o) {
  const p = String((o && o.project) || "").trim(), cur = String((o && o.current) || "");
  if (p && p.toLowerCase() !== cur.toLowerCase()) { const e = new Error(`this page shows "${p}" - the open project is "${cur}" (not written)`); e.status = 409; throw e; }
  const stored = projectRefs.store(o.projDir, o.manifest, o.files || [], o.assetPath);
  projectRefs.writeManifest(o.prjPath, stored);
  return stored;
}
module.exports = { upload, keep };
