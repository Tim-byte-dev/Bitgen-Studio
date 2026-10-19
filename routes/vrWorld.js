// bitGen Studio — 🥽 VR WORLD (2.368.0). Mounted by routes/index.js (never server.js); the session and the job are
// lib/vrWorld.js, the dialog is static/vrworld.js (the video docker's 🥽 VR World), the render is
// vr_world_worker.py (mode "vrworld").
//
//   GET  /api/vrworld                      {session, modes, engines, edit:{ok, name}, view_size, ready}
//   POST /api/vrworld/upload               multipart file + slot (world | picture | sound | first)
//   POST /api/vrworld/asset {slot, kind, name}   a project asset (Image / Sound) into the session
//   POST /api/vrworld/set {view, vr_mode, short_side, prompt, engine, seconds, seed, lock, sound_start}
//   POST /api/vrworld/clear {slot, index}
//   GET  /api/vrworld/file/:name           a session file (the pictures, the sound, the first frame)
//   GET  /api/vrworld/pano                 the left eye's panorama (the aiming map, JPEG)
//   GET  /api/vrworld/view                 what the virtual camera sees (PNG, the dialog's preview)
//   POST /api/vrworld/first {style_id?}    ✎ First frame: the edit style puts the performer INTO the view
//   POST /api/vrworld/render               ▶ the VR clip (one mode "vrworld" job)
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const multer = require("multer");
const core = require("../lib/core");
const styles = require("../lib/styles");
const VW = require("../lib/vrWorld");

const upload = multer({ dest: path.join(os.tmpdir(), "bitgen-vrworld"), limits: { fileSize: 1024 * 1024 * 1024, files: 1 } });

const dir = () => VW.dirOf(core.projDir(core.getProject()));
const fail = (res, e, code) => res.status(code || 500).json({ error: e && e.message ? e.message : String(e) });
const outPath = (name) => path.join(core.pDir("output"), path.basename(String(name)));

function videoStyles() { try { return styles.read(core.STYLES_DIR, "video"); } catch { return []; } }

function editEngine(styleId) {
  const aiEdit = require("../lib/aiEdit");
  const all = aiEdit.engines(styles.read(core.STYLES_DIR, "image"), core.BASE).edit;
  const pick = (styleId && all.find((x) => x.id === styleId))
    || all.find((x) => /qwen.*2\.1/i.test(x.name)) || all.find((x) => /qwen/i.test(x.name)) || all[0];
  return pick ? styles.byId(core.STYLES_DIR, pick.id) : null;
}

function state(note) {
  const d = dir();
  const s = VW.load(d);
  if (VW.harvest(d, s, core.jobs, outPath)) VW.save(d, s);
  const ed = editEngine();
  const ss = s.short_side || VW.autoShortSide(s.vr_mode, s.world_w, s.world_h, s.view.fov, s.view.shape);
  return { session: s, modes: Object.entries(VW.MODES).map(([id, m]) => ({ id, label: m.label })),
           engines: VW.engines(videoStyles()), edit: { ok: !!ed, name: ed ? ed.name : "" },
           view_size: VW.viewSize(ss, s.view.shape), auto_short_side: !s.short_side, ready: VW.notReady(s, d),
           ...(note ? { note } : {}) };
}

function mount(app) {
  app.get("/api/vrworld", (_req, res) => { try { res.json(state()); } catch (e) { fail(res, e); } });

  app.post("/api/vrworld/upload", upload.single("file"), (req, res) => {
    const f = req.file;
    try {
      if (!f) return res.status(400).json({ error: "no file in the request" });
      const d = dir();
      const r = VW.put(d, VW.load(d), String((req.body || {}).slot || ""), f.path, f.originalname || "file");
      if (r.error) return res.status(400).json({ error: r.error });
      VW.save(d, r.session);
      res.json(state(r.note));
    } catch (e) { fail(res, e); } finally { if (f) try { fs.unlinkSync(f.path); } catch {} }
  });

  app.post("/api/vrworld/asset", (req, res) => {
    const b = req.body || {};
    try {
      const kind = ["images", "sound", "output"].includes(b.kind) ? b.kind : "";
      if (!kind) return res.status(400).json({ error: "kind must be images, sound or output" });
      const src = path.join(core.pDir(kind), path.basename(String(b.name || "")));
      if (!fs.existsSync(src)) return res.status(404).json({ error: `no ${kind} asset named ${path.basename(String(b.name || ""))}` });
      const d = dir();
      const r = VW.put(d, VW.load(d), String(b.slot || ""), src, path.basename(src));
      if (r.error) return res.status(400).json({ error: r.error });
      VW.save(d, r.session);
      res.json(state(r.note));
    } catch (e) { fail(res, e); }
  });

  app.post("/api/vrworld/set", (req, res) => {
    try { const d = dir(); VW.save(d, VW.set(VW.load(d), req.body || {})); res.json(state()); } catch (e) { fail(res, e); }
  });

  app.post("/api/vrworld/clear", (req, res) => {
    const b = req.body || {};
    try {
      const d = dir();
      const r = VW.clear(d, VW.load(d), String(b.slot || ""), b.index);
      if (r.error) return res.status(400).json({ error: r.error });
      VW.save(d, r.session);
      res.json(state());
    } catch (e) { fail(res, e); }
  });

  app.get("/api/vrworld/file/:name", (req, res) => {
    const p = path.join(dir(), path.basename(req.params.name));
    if (path.basename(req.params.name) === "session.json" || !fs.existsSync(p)) return res.status(404).json({ error: "no such file" });
    res.sendFile(p);
  });

  app.get("/api/vrworld/pano", (_req, res) => {
    try {
      const d = dir();
      const s = VW.load(d);
      if (!s.world || !VW.MODES[s.vr_mode]) return res.status(404).json({ error: "no world picture yet" });
      const out = path.join(d, `pano_${s.vr_mode}_${path.parse(s.world).name}.jpg`);
      if (!fs.existsSync(out)) {
        const r = VW.ff(VW.panoArgs(path.join(d, s.world), out, s.vr_mode, 1024));
        if (r.error) return res.status(500).json({ error: r.error });
      }
      res.sendFile(out);
    } catch (e) { fail(res, e); }
  });

  app.get("/api/vrworld/view", (req, res) => {
    try {
      const d = dir();
      const s = VW.load(d);
      if (!s.world || !VW.MODES[s.vr_mode]) return res.status(404).json({ error: "no world picture yet" });
      const v = VW.view({ ...s.view, ...(req.query.yaw != null ? { yaw: req.query.yaw } : {}),
        ...(req.query.pitch != null ? { pitch: req.query.pitch } : {}), ...(req.query.fov != null ? { fov: req.query.fov } : {}),
        ...(req.query.shape ? { shape: req.query.shape } : {}) });
      const sz = VW.viewSize(384, v.shape);
      for (const f of fs.readdirSync(d)) if (/^view_prev_/.test(f)) try { fs.unlinkSync(path.join(d, f)); } catch {}
      const out = path.join(d, `view_prev_${Date.now().toString(36)}.png`);
      const r = VW.ff(VW.viewArgs(path.join(d, s.world), out, s.vr_mode, v, sz.width, sz.height));
      if (r.error) return res.status(500).json({ error: r.error });
      res.sendFile(out);
    } catch (e) { fail(res, e); }
  });

  app.post("/api/vrworld/first", (req, res) => {
    const b = req.body || {};
    try {
      const d = dir();
      const s = VW.load(d);
      if (!s.world || !VW.MODES[s.vr_mode]) return res.status(400).json({ error: "load a 360 / 180 picture first (🌐 World)" });
      if (!s.pictures.length) return res.status(400).json({ error: "add the performer's picture first (＋ Performer)" });
      if (s.first_job) { const j = core.jobs.get(s.first_job); if (j && !j.finished) return res.status(409).json({ error: "the first frame is already being made" }); }
      const style = editEngine(b.style_id);
      if (!style) return res.status(400).json({ error: "no image-edit style - Settings -> Image styles needs \"Qwen Image 2.1 edit\" (or another Qwen / Kontext edit style)" });
      const aiEdit = require("../lib/aiEdit");
      const sceneEdit = require("../lib/sceneEdit");
      let eg;
      try { eg = aiEdit.editGraph(style, core.BASE); } catch (e) { return res.status(400).json({ error: e.message }); }
      const ss = s.short_side || VW.autoShortSide(s.vr_mode, s.world_w, s.world_h, s.view.fov, s.view.shape);
      const vs = VW.viewSize(ss, s.view.shape);
      const cv = sceneEdit.canvasFor(vs.width, vs.height);
      const viewPng = path.join(d, `edit_view_${Date.now().toString(36)}.png`);
      for (const f of fs.readdirSync(d)) if (/^edit_view_/.test(f)) try { fs.unlinkSync(path.join(d, f)); } catch {}
      const r = VW.ff(VW.viewArgs(path.join(d, s.world), viewPng, s.vr_mode, s.view, cv.width, cv.height));
      if (r.error) return res.status(500).json({ error: r.error });
      let pl;
      try { pl = VW.firstPlan(viewPng, s.pictures.map((n) => path.join(d, n)), s.prompt); }
      catch (e) { return res.status(400).json({ error: e.message }); }
      if (pl.images.length > (eg.slots || 0))
        return res.status(400).json({ error: `${style.name} has ${eg.slots || 0} picture slot(s) and this needs ${pl.images.length} - drop a performer picture` });
      const seed = require("../lib/imageSeed").forRequest(styles.numOrNull(b.seed));
      const job = core.makeJob({ mode: "image", prompt: pl.prompt, style: styles.applyLoraWeights(style, null), style_id: style.id,
        style_name: style.name, width: cv.width, height: cv.height, batch: 1, workflow: eg.workflow,
        workflow_note: "✎ VR World first frame - " + pl.roles.map((x, i) => `<image${i + 1}> ${x}`).join(", "),
        images: pl.images, no_assets: true, seed: seed.seed, seed_random: seed.random });
      job.chunk = { i: 0, n: 1 };
      s.first_job = job.id; s.first_status = "running"; s.first_error = "";
      VW.save(d, s);
      res.json({ ...state(`✎ ${style.name} puts the performer into the view (${cv.width}x${cv.height}) - it becomes the first frame`), job: job.id });
    } catch (e) { fail(res, e); }
  });

  app.post("/api/vrworld/render", (req, res) => {
    try {
      const d = dir();
      const s = VW.set(VW.load(d), req.body || {});
      VW.save(d, s);
      const eng = VW.engines(videoStyles()).find((x) => x.id === s.engine);
      if (!eng) return res.status(400).json({ error: "that engine is not available - pick another" });
      let style = null;
      if (s.engine === "h3song") style = videoStyles().find((x) => x.name === VW.SONG_STYLE) || null;
      else if (eng.wan) style = styles.byId(core.STYLES_DIR, s.engine);
      const fp = require("../lib/framePlan");
      const p = VW.jobParams({ session: s, dir: d, style, grid: fp.gridFor((core.getConfig().engine || {}).backend) });
      if (p.error) return res.status(400).json({ error: p.error });
      const job = core.makeJob(p);
      job.chunk = { i: 0, n: 1 };
      const note = VW.summary(p, eng.label);
      try { job.log.push("[bitgen-studio] " + note); } catch {}
      s.last_job = job.id;
      VW.save(d, s);
      res.json({ ...core.jobDict(job), note });
    } catch (e) { fail(res, e); }
  });
}

module.exports = { mount };
