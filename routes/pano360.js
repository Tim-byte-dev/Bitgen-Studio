// bitGen Studio — 🌐 360 PANORAMA routes (2.971.0). Mounted from routes/index.js (never server.js). What it makes is
// lib/pano360.js; the canvas is built in the image editor (ext/imageeditdock/pcpano.js); every run is an ordinary image job
// (image_worker.py) - in the job list and the log like any other render. The canvas goes to the project's temp/pano360.
//
//   GET  /api/pano360   {ok, style_id, style_name, lora, lora_weight, trigger, sizes, seam_strip} - style_id null =
//                       no Qwen Image 2.1 edit style (Settings ▸ Styles ▸ restore the starters)
//   POST /api/pano360   multipart canvas (PNG - the 2:1 picture: the placed pictures + pure green), desc, size
//                       (2048 | 1408), seed, seam ("1" = the seam pass) -> {jobs:[{id, seed}], prompt, width, height}
"use strict";
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const core = require("../lib/core");
const styles = require("../lib/styles");
const imageSeed = require("../lib/imageSeed");
const P = require("../lib/pano360");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 64 * 1024 * 1024, files: 1 } });
function inputDir() { const d = path.join(core.tempDir(), "pano360"); fs.mkdirSync(d, { recursive: true }); return d; }
function theStyle() { try { return P.pickStyle(styles.read(core.STYLES_DIR)); } catch { return null; } }

function mount(app) {
  app.get("/api/pano360", (_req, res) => {
    const st = theStyle();
    res.json({ ok: true, style_id: st ? st.id : null, style_name: st ? st.name : null, lora: P.LORA, lora_weight: P.LORA_WEIGHT,
               trigger: P.TRIGGER, sizes: P.SIZES, seam_strip: P.SEAM_STRIP });
  });
  app.post("/api/pano360", upload.single("canvas"), (req, res) => {
    const f = req.file, b = req.body || {};
    if (!f || !f.buffer || f.buffer.length < 100) return res.status(400).json({ error: "no canvas in the request" });
    if (f.buffer.slice(1, 4).toString("latin1") !== "PNG") return res.status(400).json({ error: "the canvas must be a PNG" });
    const st = theStyle();
    if (!st) return res.status(400).json({ error: "the Qwen Image 2.1 edit style is not there - Settings ▸ Styles ▸ restore the starter styles" });
    const sz = P.size(b.size);
    const name = path.join(inputDir(), `pano360-${Date.now().toString(36)}${b.seam === "1" ? "-seam" : ""}.png`);
    fs.writeFileSync(name, f.buffer);
    const first = imageSeed.forRequest(styles.numOrNull(b.seed));
    const p = P.jobParams(st, { desc: b.desc, size: sz.id, file: name, seam: b.seam === "1" });
    p.seed = first.seed; p.seed_random = first.random;
    const job = core.makeJob(p);
    job.chunk = { i: 0, n: 1 };
    res.json({ jobs: [{ id: job.id, seed: p.seed }], prompt: p.prompt, width: sz.width, height: sz.height });
  });
}

module.exports = { mount };
