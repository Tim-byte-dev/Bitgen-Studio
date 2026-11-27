// bitGen Studio — routes/sketcherPhoto.js (2.998.0): ✨ PHOTO'S FINISHED PICTURE IN THE GALLERY, ITS STEPS OUT OF IT.
// Mounted from routes/index.js (never server.js).
// Tim: "edit sketcher is working better but it shows both renders in gallery, only show the finished render". Each step of
// ✨ Photo / ✏ Edit (Sketcher) is an ordinary /api/aiedit job, so its picture lands in the project's output/ folder - the
// gallery listed step 1, step 2 (and any second try) but not the finished photo (which went to the Image assets only).
//   POST /api/sketcher/photo   multipart: file (the finished picture), name, drop (JSON [output file names of its steps])
//                              -> the steps' pictures MOVED to temp/sketcher-steps (out of the gallery, not the recycle bin -
//                              they are working files), the finished picture written to output/ -> {name, dropped}
"use strict";
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const core = require("../lib/core");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 64 * 1024 * 1024, files: 1 } });
/** a safe output name (pure): letters, digits, . _ - only; a .png at the end */
function safeName(n) {
  const b = path.basename(String(n || "sketcher_real.png")).replace(/[^\w.-]+/g, "_").replace(/^\.+/, "").slice(0, 100) || "sketcher_real.png";
  return /\.(png|jpe?g|webp)$/i.test(b) ? b : b + ".png";
}
/** the name not taken yet in dir (pure-ish): x.png, x_2.png, x_3.png … */
function freeName(dir, n) {
  const ext = path.extname(n), stem = n.slice(0, -ext.length);
  for (let i = 1; ; i++) { const c = i === 1 ? n : `${stem}_${i}${ext}`; if (!fs.existsSync(path.join(dir, c))) return c; }
}
/** move a step's picture out of output/ (never anything outside it) -> true when moved */
function dropStep(outDir, stepsDir, name) {
  const b = path.basename(String(name || ""));
  if (!b || !/\.(png|jpe?g|webp)$/i.test(b)) return false;
  const from = path.join(outDir, b); if (!fs.existsSync(from)) return false;
  fs.mkdirSync(stepsDir, { recursive: true });
  const to = path.join(stepsDir, freeName(stepsDir, b));
  try { fs.renameSync(from, to); } catch { fs.copyFileSync(from, to); fs.unlinkSync(from); }
  return true;
}
function mount(app) {
  app.post("/api/sketcher/photo", upload.single("file"), (req, res) => {
    try {
      const f = req.file; if (!f || !f.buffer || !f.buffer.length) return res.status(400).json({ error: "the finished picture is missing" });
      const outDir = core.pDir("output"), stepsDir = path.join(core.tempDir(), "sketcher-steps");
      let drop = []; try { drop = JSON.parse((req.body || {}).drop || "[]"); } catch { drop = []; }
      const dropped = (Array.isArray(drop) ? drop : []).slice(0, 20).filter((n) => dropStep(outDir, stepsDir, n)).length;
      fs.mkdirSync(outDir, { recursive: true });
      const name = freeName(outDir, safeName((req.body || {}).name || f.originalname));
      fs.writeFileSync(path.join(outDir, name), f.buffer);
      res.json({ name, dropped });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
}
module.exports = { mount, safeName, freeName, dropStep };
