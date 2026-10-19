// bitGen Studio — lib/tempUpload.js (2.378.0): uploads that land in the CURRENT project's temp/ folder, and API
// errors that always answer in JSON.
//
// Tim: "fix Unexpected token '<', "<!DOCTYPE "... is not valid JSON when trying to add new character".
// Cause: routes/characters.js (and h3Viggle.js, remote.js) built their multer with `dest: core.tempDir()` ONCE, at
// start - the temp/ folder of the project open when the app started. After ↺ Reset project (the folder deleted and made
// again without temp/), a deleted project, or any project change, that folder is gone or belongs to another project:
// the upload of the new character's picture failed inside multer (ENOENT), the error went to Express's default
// handler, and the page got its HTML error page where it expected JSON.
//   tempUpload(limits)  -> { single, array, fields, any, none } like multer's, but the folder is resolved for EVERY
//                          request (core.tempDir() - the current project's temp/, created when missing) and an upload
//                          error answers JSON ({error}, 413 for a file too big, 400 for a bad upload, 500 otherwise)
//   jsonErrors(app)     -> mounted last (routes/index.js): any error under /api answers JSON instead of an HTML page,
//                          and an /api address that does not exist answers a JSON 404
const multer = require("multer");
const core = require("./core");

function message(err) {
  if (!err) return "upload failed";
  if (err.code === "LIMIT_FILE_SIZE") return "the file is too big for this upload";
  if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") return `too many files, or an unexpected field (${err.field || "?"})`;
  return String(err.message || err);
}
function statusOf(err) {
  if (err && err.code === "LIMIT_FILE_SIZE") return 413;
  if (err instanceof multer.MulterError) return 400;
  return (err && (err.status || err.statusCode)) || 500;
}

function tempUpload(limits) {
  const m = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => { try { cb(null, core.tempDir()); } catch (e) { cb(e); } },
    }),
    limits: limits || {},
  });
  const wrap = (mw) => (req, res, next) => mw(req, res, (err) => {
    if (!err) return next();
    res.status(statusOf(err)).json({ error: "upload failed: " + message(err) });
  });
  return {
    single: (f) => wrap(m.single(f)),
    array: (f, n) => wrap(m.array(f, n)),
    fields: (spec) => wrap(m.fields(spec)),
    any: () => wrap(m.any()),
    none: () => wrap(m.none()),
  };
}

function jsonErrors(app) {
  // eslint-disable-next-line no-unused-vars
  app.use("/api", (err, req, res, next) => {
    if (res.headersSent) return;
    const st = err && err.type === "entity.too.large" ? 413 : statusOf(err);
    res.status(st).json({ error: st === 413 && err && err.type === "entity.too.large"
      ? "the request is too big" : message(err) });
  });
  app.use("/api", (req, res) => {
    if (res.headersSent) return;
    res.status(404).json({ error: `no such API: ${req.method} ${req.originalUrl.split("?")[0]}` });
  });
}

module.exports = { tempUpload, jsonErrors };
