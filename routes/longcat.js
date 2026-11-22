// routes/longcat.js — 2.918.0: LongCat-Video-Avatar 1.6 from the prompt docker (lib/longcat.js makes the job,
// misc/longcat_worker.py renders it, lib/longcatAddon.js installs the node pack + files). Mounted from routes/index.js
// (never server.js).
//   GET  /api/longcat   {installed, pack, note, items, comfy: {online, nodes}, fps}
//   POST /api/longcat   multipart: first (the person - optional); fields prompt, width, height, seed, video_style_id,
//                       ref_audio (a project sound's name - the speech, needed), max_seconds (0 / none = the whole sound),
//                       basic (Basic Settings' Override style - its seed, its model when Use model sends one)
//                       -> a longcat job + {notes} | 400 / 409 {error, needs} / 503
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

/** an uploaded picture kept in the project's images folder -> its full path */
function keep(core, f, stem) {
  const L = require("../lib/longcat");
  const ext = (path.extname(f.originalname || "") || ".png").toLowerCase();
  if (!L.IMAGE_EXT.includes(ext)) throw err(400, `${f.originalname || "that file"} is not a picture (PNG, JPG, WebP or BMP)`);
  const dir = core.pDir("images");
  fs.mkdirSync(dir, { recursive: true });
  const name = `${stem}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}${ext}`;
  if (f.buffer) fs.writeFileSync(path.join(dir, name), f.buffer);
  else fs.copyFileSync(f.path, path.join(dir, name));
  return path.join(dir, name);
}

function mount(app) {
  const L = () => require("../lib/longcat");
  const A = () => require("../lib/longcatAddon");
  const core = require("../lib/core");
  const styles = require("../lib/styles");
  const upload = require("../lib/tempUpload").tempUpload({ fileSize: 100 * 1024 * 1024 });

  app.get("/api/longcat", wrap(async () => {
    let st = {};
    try { st = A().status(); } catch (e) { st = { installed: false, note: String(e.message || e) }; }
    const comfy = await L().comfySupport();
    return Object.assign({}, st, { comfy, fps: L().FPS });
  }));

  app.post("/api/longcat", upload.fields([{ name: "first", maxCount: 1 }]), wrap(async (req) => {
    const b = req.body || {};
    const files = req.files || {};
    if (((core.getConfig().engine || {}).backend) !== "comfy")
      throw err(400, "LongCat Avatar renders in ComfyUI - switch Settings ▸ ComfyUI ▸ Engine to ComfyUI first");
    const st = b.video_style_id ? styles.byId(core.STYLES_DIR, String(b.video_style_id)) : null;
    if (!st || !L().isLongcatStyle(st)) throw err(400, "pick the LongCat Avatar 1.6 video style in the prompt docker first");
    if (!String(b.prompt || "").trim()) throw err(400, "write the prompt first - who is talking, how they look and move, where they are");
    if (!b.ref_audio) throw err(400, "LongCat Avatar makes the person talk or sing to a sound - put the speech (or a song's vocals) in the References docker first");
    let addon = null;
    try { addon = A().status(); } catch { addon = null; }
    if (addon && addon.installed === false && !/not found/.test(String(addon.note || "")))
      throw err(409, "LongCat Avatar's node pack and files are not installed yet - Settings ▸ Add-ons ▸ LongCat Avatar 1.6", { needs: "longcat" });
    const cs = await L().comfySupport();
    if (!cs.online) throw err(503, "ComfyUI is not running - start it (the ComfyUI docker's ▶ Start), then press Generate again", { needs: "comfy" });
    if (!cs.nodes) throw err(409, "ComfyUI has not loaded the LongCat Avatar nodes - restart ComfyUI once (the ComfyUI docker's ⟳ Restart) after the add-on installed them", { needs: "comfy-restart" });
    const image = files.first && files.first[0] ? keep(core, files.first[0], "longcat-person") : "";
    const sound = path.join(core.pDir("sound"), path.basename(String(b.ref_audio)));
    const ov = L().withBasic(st, b.basic, b), bo = ov.bo;
    const p = L().params({ style: ov.style, prompt: b.prompt, image, audio: { path: sound, start: +b.ref_audio_start || 0 },
      width: +b.width, height: +b.height, seed: ov.seed, max_seconds: b.max_seconds });
    if (p.error) throw err(400, p.error);
    const job = core.makeJob(p);
    job.chunk = { i: 0, n: 1 };
    const notes = [L().summary(p)].concat(bo ? ["Basic Settings ▸ Override style: its seed" + (bo.model ? " and model" : "")
      + " - LongCat's 8 distilled steps and cfg 1 are the model's own"] : []);
    for (const n of notes) try { job.log.push("[bitgen-studio] " + n); } catch { /* a log line */ }
    return Object.assign(core.jobDict(job), { notes });
  }));
}
module.exports = { mount };
