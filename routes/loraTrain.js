// bitGen Studio — routes/loraTrain.js (2.520.0): the 🎓 LoRA trainer docker (lib/loraTrain.js, lora_worker.py).
// Mounted from routes/index.js (never server.js).
//   GET    /api/loratrain                        {presets, defaults, optimizers, aitk: {ready, dir}, jobs, captioning, gpu}
//   POST   /api/loratrain/job        {settings}  save a job (new or changed)          DELETE /api/loratrain/job/:name
//   GET    /api/loratrain/dataset/:name          [{file, caption, size}]
//   POST   /api/loratrain/dataset/:name/add?file=<name>   body = the picture (raw)  -> {file}
//   POST   /api/loratrain/dataset/:name/from     {names}  pictures from the gallery / the Image assets
//   POST   /api/loratrain/dataset/:name/caption  {file, caption}
//   DELETE /api/loratrain/dataset/:name/:file
//   POST   /api/loratrain/dataset/:name/autocaption {overwrite}   GET /api/loratrain/captioning
//   GET    /api/loratrain/img/:name/:file        a dataset picture     GET /api/loratrain/sample/:name/:file  a sample
//   GET    /api/loratrain/yaml/:name             {yaml, custom}       POST /api/loratrain/yaml/:name {yaml} ("" = back to generated)
//   POST   /api/loratrain/start/:name            queue the run -> {job}     POST /api/loratrain/install -> {job}
//   GET    /api/loratrain/export/:name           the job as a .zip (config.yaml + dataset) for another machine
//   2.521.0 FINE-TUNES (lib/fineTune.js): POST /api/loratrain/install {engine: "unsloth"} · GET/POST /api/loratrain/chat/:name
//   [{messages}] (an LLM job's examples) · POST /api/loratrain/chat/:name/import?file=&replace=1  body = JSONL / JSON / CSV text
//   · GET /api/loratrain/bases  ComfyUI's checkpoints + diffusion models · POST /api/loratrain/merge/:name {cat, base, strength, out}
"use strict";
const fs = require("fs");
const path = require("path");
const LT = require("../lib/loraTrain");
const FTM = require("../lib/fineTune");

function mount(app) {
  const express = require("express");
  const core = require("../lib/core");
  const fail = (res, e) => res.status(e.status || 500).json({ error: String((e && e.message) || e) });
  const wrap = (fn) => async (req, res) => { try { await fn(req, res); } catch (e) { fail(res, e); } };
  app.get("/api/loratrain", wrap((_req, res) => {
    let gpu = null;
    try { const p = require("../lib/setupGpu").detect(); gpu = p.main ? { name: p.main.name, vram_gb: p.vram_gb } : null; } catch { gpu = null; }
    res.json({ presets: LT.PRESETS, defaults: LT.DEFAULTS, optimizers: LT.OPTIMIZERS, aitk: LT.aitk(), jobs: LT.list(), captioning: LT.captionState(),
      loras_dir: LT.lorasDir(), gpu, kinds: LT.KINDS, ft: FTM.FT, quants: FTM.QUANTS, unsloth: FTM.unsloth(), vision_instruction: FTM.VISION_INSTRUCTION });
  }));
  app.post("/api/loratrain/job", wrap((req, res) => res.json({ ok: true, settings: LT.save((req.body || {}).settings || {}), jobs: LT.list() })));
  app.delete("/api/loratrain/job/:name", wrap((req, res) => res.json({ ok: LT.remove(req.params.name), jobs: LT.list() })));
  app.get("/api/loratrain/dataset/:name", wrap((req, res) => res.json(LT.dataset(req.params.name))));
  app.post("/api/loratrain/dataset/:name/add", express.raw({ type: () => true, limit: "64mb" }),
    wrap((req, res) => res.json({ ok: true, file: LT.addImage(req.params.name, String(req.query.file || "image.png"), req.body) })));
  app.post("/api/loratrain/dataset/:name/from", wrap((req, res) => {
    const b = req.body || {}, added = [];
    // the gallery's pictures (output/, final/, the project folder) and the Image assets
    const pd = core.projDir(core.getProject());
    const dirs = [core.pDir("output"), path.join(pd, "final"), pd, core.pDir("images")];
    for (const n of (Array.isArray(b.names) ? b.names : []).slice(0, 200)) {
      const base = path.basename(String(n));
      const f = dirs.map((d) => path.join(d, base)).find((p) => fs.existsSync(p));
      if (!f || !LT.IMG_EXT.test(f)) continue;
      added.push(LT.addImage(req.params.name, path.basename(f), fs.readFileSync(f)));
    }
    res.json({ ok: true, added });
  }));
  app.post("/api/loratrain/dataset/:name/caption", wrap((req, res) => res.json({ ok: LT.setCaption(req.params.name, (req.body || {}).file, (req.body || {}).caption) })));
  app.delete("/api/loratrain/dataset/:name/:file", wrap((req, res) => res.json({ ok: LT.removeImage(req.params.name, req.params.file) })));
  app.post("/api/loratrain/dataset/:name/autocaption", wrap(async (req, res) => res.json(await LT.autoCaption(req.params.name, !!(req.body || {}).overwrite))));
  app.get("/api/loratrain/captioning", wrap((_req, res) => res.json(LT.captionState())));
  app.get("/api/loratrain/img/:name/:file", wrap((req, res) => {
    const f = path.join(LT.jobDir(req.params.name), "dataset", path.basename(req.params.file));
    if (!LT.IMG_EXT.test(f) || !fs.existsSync(f)) return res.status(404).end();
    res.sendFile(f);
  }));
  app.get("/api/loratrain/sample/:name/:file", wrap((req, res) => {
    const n = LT.cleanName(req.params.name);
    const f = path.join(LT.jobDir(n), "output", n, "samples", path.basename(req.params.file));
    if (!fs.existsSync(f)) return res.status(404).end();
    res.sendFile(f);
  }));
  app.get("/api/loratrain/yaml/:name", wrap((req, res) => res.json(LT.yamlFor(req.params.name, { generated: req.query.generated === "1" }))));
  app.post("/api/loratrain/yaml/:name", wrap((req, res) => res.json({ ok: true, custom: LT.setYaml(req.params.name, (req.body || {}).yaml) })));
  app.post("/api/loratrain/start/:name", wrap((req, res) => res.json(LT.start(req.params.name))));
  app.post("/api/loratrain/install", wrap((req, res) => res.json(LT.install(String((req.body || {}).engine || "")))));
  app.get("/api/loratrain/chat/:name", wrap((req, res) => res.json(FTM.readChat(LT.jobDir(req.params.name)))));
  app.post("/api/loratrain/chat/:name", express.json({ limit: "64mb" }), wrap((req, res) => {
    const d = LT.jobDir(req.params.name); if (!fs.existsSync(d)) return res.status(404).json({ error: "no such job" });
    res.json({ ok: true, examples: FTM.writeChat(d, Array.isArray(req.body) ? req.body : (req.body || {}).chats) });
  }));
  app.post("/api/loratrain/chat/:name/import", express.text({ type: () => true, limit: "64mb" }), wrap((req, res) => {
    const d = LT.jobDir(req.params.name); if (!fs.existsSync(d)) return res.status(404).json({ error: "no such job" });
    res.json(Object.assign({ ok: true }, FTM.importChat(d, typeof req.body === "string" ? req.body : "", String(req.query.file || ""), req.query.replace === "1")));
  }));
  app.get("/api/loratrain/bases", wrap((_req, res) => res.json(FTM.bases())));
  app.post("/api/loratrain/merge/:name", wrap((req, res) => {
    const n = LT.cleanName(req.params.name), d = LT.jobDir(n);
    const s = LT.normalize(Object.assign(JSON.parse(fs.existsSync(path.join(d, "job.json")) ? fs.readFileSync(path.join(d, "job.json"), "utf8") : "{}"), { name: n }));
    if (s.kind !== "lora") return res.status(400).json({ error: "only a picture LoRA is baked into a checkpoint" });
    res.json(FTM.merge(n, d, s, req.body || {}));
  }));
  app.get("/api/loratrain/export/:name", wrap((req, res) => {
    const z = LT.exportZip(req.params.name);
    res.set("Content-Type", "application/zip");
    res.set("Content-Disposition", `attachment; filename="${z.name}"`);
    res.send(z.data);
  }));
}
module.exports = { mount };
