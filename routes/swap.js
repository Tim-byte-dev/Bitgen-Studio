// bitGen Studio — CHARACTER SWAP routes (2.324.0). Mounted from
// routes/index.js (never server.js). What a job carries is lib/swap.js;
// the work is swap_worker.py (mode "swap", lib/core WORKER_FOR).
//
//   GET  /api/swap/cast            the cast pictures a scene can swap in
//   POST /api/swap                 the prompt docker's Swap mode: a picture
//                                  (multipart "image") + a project video
//                                  asset by name ("video") + text/start/dur
//   POST /api/scenes/:n/swap       a rendered scene's take + a cast sheet
//                                  ("character") or a dropped picture
//                                  ("image"); the result is the scene's
//                                  next take (harvested like any render)
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const core = require("../lib/core");
const comfy = require("../lib/comfy");
const trap = require("../lib/trap");
const scenes = require("../lib/scenes");
const chars = require("../lib/characters");
const swap = require("../lib/swap");

const styles = require("../lib/styles");
const WF = () => path.join(core.BASE, "comfy_workflows", swap.WORKFLOW);
/** 2.328.0: the swap STYLE (the picked one if it is a swap style, else
 *  mmh3_chr_swap, else the built-in workflow) - lib/swap.resolveStyle. */
const pickStyle = (id) => swap.resolveStyle(styles.read(core.STYLES_DIR, "video"), id, core.BASE);

/** A fresh job dir + the uploaded picture written into it. */
function stage(file) {
  const id = crypto.randomBytes(6).toString("hex");
  const dir = path.join(core.JOBS_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  let image = null;
  if (file && file.buffer) {
    let ext = path.extname(file.originalname || "").toLowerCase();
    if (!swap.IMAGE_EXT.includes(ext)) ext = ".png";
    image = path.join(dir, "swap_character" + ext);
    fs.writeFileSync(image, file.buffer);
  }
  return { id, dir, image };
}

async function comfyUp(res) {
  try { await comfy.ensure({ force: true }); return true; }
  catch (e) {
    res.status(502).json({ error: "ComfyUI is not up and could not be started: "
      + String((e && e.message) || e) });
    return false;
  }
}

function mount(app) {
  const upload = multer({ storage: multer.memoryStorage(),
                          limits: { fileSize: 64 * 1024 * 1024, files: 1 } });

  app.get("/api/swap/cast", (req, res) => {
    const project = req.query.project || undefined;
    res.json({ cast: swap.castPictures(chars, project).map((c) => ({
      name: c.name, tag: c.tag, file: c.file,
      url: `/api/characters/${encodeURIComponent(c.name)}/file/${encodeURIComponent(c.file)}`
        + (project ? `?project=${encodeURIComponent(project)}` : ""),
    })), workflow: fs.existsSync(WF()), style: (pickStyle().style || {}).name || null });
  });

  app.post("/api/swap", upload.single("image"), trap.guard(async (req, res) => {
    const b = req.body || {};
    const vname = path.basename(String(b.video || ""));
    if (!req.file) return res.status(400).json({ error: "Swap mode needs ONE picture of the new character "
      + "in the reference dock's Image tab" });
    if (!vname) return res.status(400).json({ error: "Swap mode needs a reference video - drag one into "
      + "the reference dock's Video tab" });
    const s = stage(req.file);
    const ps = pickStyle(b.video_style_id);
    const p = swap.jobParams({ workflow: ps.workflow, style: ps.style, video: path.join(core.pDir("video"), vname),
      image: s.image, text: b.prompt, start: b.start, dur: b.dur,
      width: b.width, height: b.height, seed: b.seed, cfg: core.getConfig(), quality: b.quality });
    if (p.error) { fs.rmSync(s.dir, { recursive: true, force: true }); return res.status(400).json({ error: p.error }); }
    if (!await comfyUp(res)) return;
    const job = core.makeJob(p, s.id, s.dir);
    res.json({ ...core.jobDict(job), note: swap.summary(p) });
  }));

  app.post("/api/scenes/:n/swap", upload.single("image"), trap.guard(async (req, res) => {
    const b = req.body || {};
    const project = b.project || undefined;
    const st = scenes.load(project);
    const r = scenes.at(st, req.params.n);
    if (!r) return res.status(404).json({ error: `no scene ${req.params.n}` });
    if (r.status === "running" || r.job) return res.status(409).json({ error: `scene ${r.n} is still rendering` });
    const take = r.upscaled || r.output;
    if (!take) return res.status(400).json({ error: `scene ${r.n} has no take yet - render it first, then swap its character` });
    const video = path.join(core.projDir(project || core.getProject()), "video", path.basename(take));
    let pic = null, who = "";
    const s = stage(req.file);
    if (s.image) { pic = s.image; who = req.file.originalname || "the dropped picture"; }
    else if (b.character) {
      const c = swap.castPictures(chars, project).find((x) => x.name === String(b.character)
        || x.tag === String(b.character).replace(/^@/, "").toLowerCase());
      if (!c) { fs.rmSync(s.dir, { recursive: true, force: true });
        return res.status(400).json({ error: `no cast character "${b.character}" with a character sheet` }); }
      pic = c.path; who = `@${c.tag}`;
    } else {
      fs.rmSync(s.dir, { recursive: true, force: true });
      return res.status(400).json({ error: "pick a cast character or drop a picture of the new character" });
    }
    const rs = require("../lib/renderSettings").read(core.projDir(project || core.getProject()));
    const d = core.getConfig().defaults || {};
    const size = require("../lib/renderSettings").dims(rs.res, rs.aspect) || { width: d.width, height: d.height };
    const ps = pickStyle(b.video_style_id);
    const p = swap.jobParams({ workflow: ps.workflow, style: ps.style, video, image: pic, text: b.prompt,
      start: b.start, dur: b.dur, width: size.width, height: size.height, seed: b.seed,
      cfg: core.getConfig(), quality: b.quality, scene: { n: r.n, chapter: r.chapter, swap: true } });
    if (p.error) { fs.rmSync(s.dir, { recursive: true, force: true }); return res.status(400).json({ error: p.error }); }
    if (!await comfyUp(res)) return;
    const job = core.makeJob(p, s.id, s.dir);
    scenes.save(scenes.starting(scenes.load(project), r.n, job.id).state, project);
    res.json({ ok: true, n: r.n, job: job.id,
               note: `scene ${r.n}: ${who} swapped into ${path.basename(take)} - `
                 + "the result is this scene's next take; " + swap.summary(p) });
  }));
}

module.exports = { mount };
