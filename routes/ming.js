// bitGen Studio — routes/ming.js (3.9.0): 🧩 MING LAYERED DESIGN - Ming-Image makes a design from a layer list and splits it into
// those layers (lib/mingAddon.js, lib/mingLayers.js; each run is a job - misc/ming_worker.py, mode "ming").
// 3.12.0 (Tim: "replace our ming image with this one, https://huggingface.co/Comfy-Org/Ming-Image"): "This computer" = ComfyUI's
// own Ming-Image nodes with Comfy-Org's files (engine "comfy"; 3.9.0's "local" means the same); the add-on is "mingimage".
// Mounted from routes/index.js (never server.js).
//
//   GET  /api/ming   {comfy: {installed, ready, have: {gen, layer, gen16, layer16}, note, missing, addon}, local (= comfy, for an
//                     old page), openrouter: {key}, where: {id: label}, max}
//   POST /api/ming   {rows: [{name, desc, where}] (front first), engine "comfy" | "openrouter", split (true), image (a data: URL -
//                     the picture to split instead of making one), w, h (the canvas), level 1024 | 2048, layer_res 512 | 1024,
//                     style, lighting, steps, seed, name} -> {job, rows}
//                    409 {needs: "mingimage", missing} when its files are not downloaded (the page opens its Download box)
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("../lib/core");
const A = require("../lib/mingAddon");
const ML = require("../lib/mingLayers");

/** a data: URL (png / jpeg / webp) -> a temp file of this project | null */
function saveInput(dataUrl) {
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl || ""));
  if (!m) return null;
  const buf = Buffer.from(m[2], "base64"); if (buf.length < 64) return null;
  const f = path.join(core.tempDir(), "ming_in_" + Date.now() + "." + (m[1] === "jpeg" ? "jpg" : m[1]));
  fs.writeFileSync(f, buf); return f;
}
function orKey() { try { return require("../lib/openRouter").cfg().key || ""; } catch { return ""; } }

function mount(app) {
  const J = require("express").json({ limit: "80mb" });
  app.get("/api/ming", (_req, res) => {
    try {
      const pl = require("../lib/aiFillAddon").place(), s = A.status(pl);
      const here = { installed: s.installed, ready: A.ready(pl), have: A.haveWeights(pl), note: s.note, missing: A.missing(pl), addon: A.ID };
      res.json({ comfy: here, local: here, openrouter: { key: !!orKey(), models: A.OR },
        where: ML.WHERE_LABEL, max: ML.MAX });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/ming", J, (req, res) => {
    try {
      const b = req.body || {};
      let input = null;
      if (b.image) { input = saveInput(b.image); if (!input) return res.status(400).json({ error: "the picture to split did not come through (a PNG / JPEG / WebP data URL)" }); }
      const jp = A.jobParams({ rows: b.rows, engine: b.engine, split: b.split !== false, input, w: b.w, h: b.h, level: b.level, layer_res: b.layer_res,
        style: b.style, lighting: b.lighting, steps: b.steps, seed: b.seed, name: b.name, orKey: b.engine === "openrouter" ? orKey() : "" });
      if (jp.error) return res.status(jp.status || 400).json({ error: jp.error, missing: jp.missing || null, needs: jp.status === 409 ? A.ID : null });
      const job = core.makeJob(jp.params); job.chunk = { i: 0, n: 1 };
      res.json({ job: core.jobDict(job), rows: jp.params.rows, generate: jp.params.generate, split: jp.params.split });
    } catch (e) { res.status(e.status || 500).json({ error: String(e.message || e) }); }
  });
}
module.exports = { mount, saveInput };
