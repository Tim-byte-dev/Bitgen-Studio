// routes/h3LongVideo.js — 2.872.0: H3 Long Video from the prompt docker (lib/h3LongVideo.js builds the graph, lib/h3LongAddon.js
// installs what it needs). Mounted from routes/index.js (never server.js). The StoryBoard's long scenes go through the same
// lib (routes/characters.js queueScene).
//   GET  /api/h3long        {installed, note, items, comfy: {online, ok, missing, warnings} }
//   POST /api/h3long        multipart: first (the first frame), refs (up to 4 reference pictures); fields prompt, seconds,
//                           width, height, seed, steps, memory (character lines), shot_length, upscale2k, video_style_id,
//                           basic (2.905.0 - Basic Settings' Override style, lib/h3LongVideo.js withBasic)
//                           -> a graph job + {notes, shots, shot_seconds} | 400 / 409 {error, needs, missing} / 503
"use strict";
const fs = require("fs");
const path = require("path");

function err(status, message, extra) { return Object.assign(new Error(message), { status, extra }); }
function wrap(fn) {
  return async (req, res) => {
    try { res.json(await fn(req)); }
    catch (e) { res.status(e.status || 500).json(Object.assign({ error: e.message || String(e) }, e.extra || {})); }
  };
}
const truthy = (v) => v === true || v === "true" || v === "1" || v === 1 || v === "on";
const IMG = [".png", ".jpg", ".jpeg", ".webp", ".bmp"];

/** an uploaded picture kept in the project's images folder -> its full path */
function keep(core, f, stem) {
  const ext = (path.extname(f.originalname || "") || ".png").toLowerCase();
  if (!IMG.includes(ext)) throw err(400, `${f.originalname || "that file"} is not a picture (PNG, JPG, WebP or BMP)`);
  const dir = core.pDir("images");
  fs.mkdirSync(dir, { recursive: true });
  const name = `${stem}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}${ext}`;
  if (f.buffer) fs.writeFileSync(path.join(dir, name), f.buffer);
  else fs.copyFileSync(f.path, path.join(dir, name));
  return path.join(dir, name);
}

function mount(app) {
  const L = () => require("../lib/h3LongVideo");
  const A = () => require("../lib/h3LongAddon");
  const core = require("../lib/core");
  const upload = require("../lib/tempUpload").tempUpload({ fileSize: 100 * 1024 * 1024 });

  app.get("/api/h3long", wrap(async () => {
    const st = A().status();
    let comfy = { online: false };
    try { const rd = L().readiness(await L().prime({ force: true })); comfy = { online: true, ok: rd.ok, missing: rd.missing, warnings: rd.warnings }; }
    catch (e) { comfy = { online: false }; }
    return Object.assign({}, st, { comfy, shot_max: L().SHOT_MAX, max_seconds: L().MAX_SECONDS });
  }));

  app.post("/api/h3long", upload.fields([{ name: "first", maxCount: 1 }, { name: "refs", maxCount: 4 }]), wrap(async (req) => {
    const b = req.body || {};
    const files = req.files || {};
    if (((core.getConfig().engine || {}).backend) !== "comfy")
      throw err(400, "H3 Long Video renders in ComfyUI - switch Settings ▸ ComfyUI ▸ Engine to ComfyUI first");
    const prompt = String(b.prompt || "").trim();
    if (!prompt) throw err(400, "write the prompt first - the first paragraph is the scene + style, every later paragraph one shot");
    let info;
    try { info = await L().prime({ force: true }); }
    catch (e) { throw err(503, "ComfyUI is not running - start it (the ComfyUI docker's ▶ Start), then press Generate again", { needs: "comfy" }); }
    const first = files.first && files.first[0] ? keep(core, files.first[0], "h3long-first") : "";
    const refs = (files.refs || []).slice(0, 4).map((f, i) => keep(core, f, "h3long-ref" + (i + 1)));
    const seconds = Math.max(1, Math.min(L().MAX_SECONDS, parseFloat(b.seconds) || 40));
    // 2.905.0 (Tim: "make sure it works with all video models"): Override style - its steps / CFG / seed, the model and
    // temporary LoRAs as Use model / Use temporary LoRAs send them (the sampler / scheduler ride in the X-Bitgen-Sampler header)
    const ov = L().withBasic(b.basic, b);
    const p = L().params({ info, prompt, seconds, width: +b.width, height: +b.height,
      seed: ov.seed, steps: ov.steps, cfg: ov.cfg, model: ov.model, loras: ov.loras,
      first, refs, memory: String(b.memory || ""), shotLength: String(b.shot_length || "fixed"), upscale2k: truthy(b.upscale2k),
      prefix: "h3long", name: "H3 Long Video" });
    if (p.error) throw err(p.needs ? 409 : 503, p.error, { needs: p.needs || "comfy", missing: p.missing });
    const job = core.makeJob(Object.assign({}, p.params, { video_style_id: b.video_style_id || null, seed_random: ov.seed == null,
      // 2.908.0: what ⏱ the time estimate needs (the size and steps live in the graph here) - lib/timeEstimate.js features
      est: { style: b.video_style_id || "", kind: "video", w: +b.width || 0, h: +b.height || 0, steps: +ov.steps || 8, cfg: ov.cfg != null ? +ov.cfg : 1 } }));
    job.chunk = { i: 0, n: 1 };
    const bn = ov.bo ? require("../lib/basicOverride").note(ov.bo, "H3 Long Video") : "";
    if (bn) try { job.log.push("[bitgen-studio] " + bn); } catch { /* a log line */ }
    return Object.assign(core.jobDict(job), { notes: p.notes.concat(bn ? [bn] : []), shots: p.plan.shots, shot_seconds: p.plan.shotSeconds });
  }));
}
module.exports = { mount };
