// routes/pan2.js — 2.890.0: PAN 2 from the prompt docker (lib/pan2.js writes the caption + the job, misc/pan2_worker.py
// renders it, lib/pan2Addon.js installs the files). Mounted from routes/index.js (never server.js).
//   GET  /api/pan2           {installed, note, items, comfy: {online, nodes}, max_seconds, defaults}
//   POST /api/pan2/caption   {prompt, seconds, pretty} (+ multipart first) -> {caption, how, notes, seconds, pretty} - the
//                            caption PAN 2 would get (nothing queued); the prompt docker's { } JSON puts it in the prompt box
//   POST /api/pan2           multipart: first (the first picture - image to video); fields prompt, seconds, width, height,
//                            seed, steps, cfg, negative, video_style_id, ref_audio (a project sound's name - laid under the take),
//                            basic (2.904.0 - Basic Settings' Override style, lib/basicOverride.js: on = its steps / CFG / seed;
//                            its model and temporary LoRAs only as Use model / Use temporary LoRAs send them; the sampler /
//                            scheduler come in the X-Bitgen-Sampler header like every video render's)
//                            -> a pan2 job + {notes, caption_how} | 400 / 409 {error, needs} / 503
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
  const L = () => require("../lib/pan2");
  const A = () => require("../lib/pan2Addon");
  const core = require("../lib/core");
  const styles = require("../lib/styles");
  const upload = require("../lib/tempUpload").tempUpload({ fileSize: 100 * 1024 * 1024 });

  app.get("/api/pan2", wrap(async () => {
    let st = {};
    try { st = A().status(); } catch (e) { st = { installed: false, note: String(e.message || e) }; }
    const comfy = await L().comfySupport();
    return Object.assign({}, st, { comfy, max_seconds: L().MAX_SECONDS, defaults: L().DEFAULTS, update: L().UPDATE });
  }));

  // 2.891.0 (Tim: "pan 2 is meant to submit the prompt in json format, can we format the prompt automatically"): JSON or
  // multipart (a `first` picture = image to video - the vision model describes it for the writer); `pretty` = indented
  app.post("/api/pan2/caption", upload.fields([{ name: "first", maxCount: 1 }]), wrap(async (req) => {
    const b = req.body || {};
    const files = req.files || {};
    const seconds = L().secondsOf(L().framesFor(parseFloat(b.seconds) || L().DEFAULT_SECONDS));
    const image = files.first && files.first[0] ? keep(core, files.first[0], "pan2-first") : "";
    const r = await L().caption({ prompt: String(b.prompt || ""), seconds, image });
    const truthy = (v) => v === true || v === "1" || v === "true";
    return Object.assign(r, { seconds, pretty: truthy(b.pretty) ? JSON.stringify(JSON.parse(r.caption), null, 2) : undefined });
  }));

  app.post("/api/pan2", upload.fields([{ name: "first", maxCount: 1 }]), wrap(async (req) => {
    const b = req.body || {};
    const files = req.files || {};
    if (((core.getConfig().engine || {}).backend) !== "comfy")
      throw err(400, "PAN 2 renders in ComfyUI - switch Settings ▸ ComfyUI ▸ Engine to ComfyUI first");
    const st = b.video_style_id ? styles.byId(core.STYLES_DIR, String(b.video_style_id)) : null;
    if (!st || !L().isPan2Style(st)) throw err(400, "pick the PAN 2 video style in the prompt docker first");
    const prompt = String(b.prompt || "").trim();
    if (!prompt) throw err(400, "write what happens in the video first - PAN 2 turns it into its own caption");
    const cs = await L().comfySupport();
    if (!cs.online) throw err(503, "ComfyUI is not running - start it (the ComfyUI docker's ▶ Start), then press Generate again", { needs: "comfy" });
    if (!cs.nodes) throw err(409, "this ComfyUI does not know PAN 2 yet - " + L().UPDATE, { needs: "comfy-update" });
    let addon = null;
    try { addon = A().status(); } catch { addon = null; }
    if (addon && addon.installed === false && !/not found/.test(String(addon.note || "")))
      throw err(409, "PAN 2's files are not downloaded yet - Settings ▸ Add-ons ▸ PAN 2", { needs: "pan2" });
    const image = files.first && files.first[0] ? keep(core, files.first[0], "pan2-first") : "";
    const sound = b.ref_audio ? path.join(core.pDir("sound"), path.basename(String(b.ref_audio))) : "";
    const frames = L().framesFor(parseFloat(b.seconds) || L().DEFAULT_SECONDS);
    const seconds = L().secondsOf(frames);
    const cap = await L().caption({ prompt, seconds, image });
    // 2.904.0 (Tim: "when overide is checked overide style settings even when loras and checkpoint are unchecked"): Override
    // style on - Basic Settings' steps / CFG / seed beat the style; its model / LoRAs ride only when they were sent
    const ov = L().withBasic(st, b.basic, b), bo = ov.bo;
    const p = L().params({ style: ov.style, caption: cap.caption, negative: L().negative(seconds, [st.negative, b.negative].filter(Boolean).join(", ")),
      image, seconds, width: +b.width, height: +b.height,
      seed: ov.seed, steps: ov.steps, cfg: ov.cfg,
      audio: sound && fs.existsSync(sound) ? { path: sound, start: 0 } : null });
    if (p.error) throw err(400, p.error);
    const job = core.makeJob(p);
    job.chunk = { i: 0, n: 1 };
    const notes = [L().summary(p)].concat(bo ? [require("../lib/basicOverride").note(bo, "PAN 2")] : [], cap.notes || []);
    for (const n of notes) try { job.log.push("[bitgen-studio] " + n); } catch { /* a log line */ }
    return Object.assign(core.jobDict(job), { notes, caption_how: cap.how });
  }));
}
module.exports = { mount };
