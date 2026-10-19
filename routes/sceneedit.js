// bitGen Studio — ✎ FIRST FRAME (QWEN IMAGE 2.1) routes (2.337.0). Mounted
// from routes/index.js (never server.js). The planning is lib/sceneEdit.js;
// the render is an ordinary image job (image_worker.py) through the picked
// edit style (Qwen Image 2.1 edit by default); a finished job is filed into
// the scene's First frame by routes/characters.js syncJobs -> sceneEdit.harvest.
//
//   GET  /api/sceneedit/engines           {edit:[{id,name}], default, cast:[{name,tag,url}]}
//   POST /api/scenes/:n/qedit             {base, prompt, chars, style_id} - the accordion's picks
//   POST /api/scenes/:n/qedit/pic         {slot: location|prop, kind: frame|project|gallery|asset, ...}
//   POST /api/scenes/:n/qedit/pic/upload  multipart image + slot
//   POST /api/scenes/:n/qedit/pic/delete  {slot, file}
//   GET  /api/scenes/:n/qedit/pic/:file   a location / prop picture
//   POST /api/scenes/:n/qedit/run         {width, height, seed} -> {job, prompt, roles, note}
"use strict";
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const core = require("../lib/core");
const trap = require("../lib/trap");
const scenes = require("../lib/scenes");
const sceneRefs = require("../lib/sceneRefs");
const sceneEdit = require("../lib/sceneEdit");
const chars = require("../lib/characters");
const styles = require("../lib/styles");
const aiEdit = require("../lib/aiEdit");
const imageSeed = require("../lib/imageSeed");
const projectMedia = require("../lib/projectMedia");

const upload = multer({ dest: path.join(require("os").tmpdir(), "bitgen-qedit"), limits: { fileSize: 64 * 1024 * 1024, files: 1 } });
const takeOf = (row) => row && row.output
  ? (path.isAbsolute(row.output) ? row.output : path.join(core.pDir("video"), path.basename(row.output))) : "";

/** The edit styles, Qwen Image 2.1 first. */
function editEngines() {
  const e = aiEdit.engines(styles.read(core.STYLES_DIR, "image"), core.BASE).edit;
  const pref = e.find((x) => /qwen.*2\.1/i.test(x.name)) || e.find((x) => /qwen/i.test(x.name)) || e[0];
  return { edit: e, default: pref ? pref.id : "" };
}

/** The cast with a sheet: [{name, tag, file, path}]. */
function castSheets(project) {
  const out = [];
  for (const c of chars.cast(project) || []) {
    const pick = chars.referenceImage(c, project);
    if (!pick) continue;
    out.push({ name: c.name, tag: chars.tagOf(c.tag || c.name), file: pick,
               path: path.join(chars.charDir(c.name, project), pick) });
  }
  return out;
}

// 2.338.0: the continuation frame lives in lib/sceneFrames.js (LTX scenes use it too)
const { contSource, contFrame } = require("../lib/sceneFrames");

function load(b, n) {
  const st = scenes.load(b && b.project);
  const r = scenes.at(st, n);
  return { st, r };
}
const dirOf = (project, r) => sceneRefs.dir(project, r.id);

function mount(app) {
  app.get("/api/sceneedit/engines", (req, res) => {
    try {
      const project = req.query.project || core.getProject();
      res.json({ ...editEngines(),
                 cast: castSheets(project).map((c) => ({ name: c.name, tag: c.tag,
                   url: `/api/characters/${encodeURIComponent(c.name)}/file/${encodeURIComponent(c.file)}` })) });
    } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });

  app.post("/api/scenes/:n/qedit", trap.guard((req, res) => {
    const b = req.body || {};
    const { st, r } = load(b, req.params.n);
    if (!r) return res.status(404).json({ error: `no scene ${req.params.n}` });
    const q = sceneEdit.safe(r.qedit);
    if (b.base != null) q.base = sceneEdit.BASES.includes(b.base) ? b.base : "auto";
    if (b.prompt != null) q.prompt = String(b.prompt).slice(0, sceneEdit.MAX_TEXT);
    if (Array.isArray(b.chars)) q.chars = b.chars.map(String).filter(Boolean).slice(0, sceneEdit.MAX_CHARS);
    if (b.style_id != null) q.style_id = String(b.style_id).slice(0, 64);
    r.qedit = q;
    scenes.save(st, b.project);
    res.json({ ok: true, n: r.n, qedit: q });
  }));

  app.post("/api/scenes/:n/qedit/pic", trap.guard((req, res) => {
    const b = req.body || {};
    const { st, r } = load(b, req.params.n);
    if (!r) return res.status(404).json({ error: `no scene ${req.params.n}` });
    const slot = String(b.slot || "").replace(/^qe_/, "");
    let src = "", label = "", tmp = null;
    if (b.kind === "frame") {
      const from = scenes.at(st, b.scene);
      if (!from) return res.status(404).json({ error: `no scene ${b.scene}` });
      const t = b.time === undefined || b.time === null || b.time === "" ? null : +b.time;
      tmp = sceneRefs.extractFrame(takeOf(from), Number.isFinite(t) ? t : null);
      if (!tmp) return res.status(400).json({ error: `scene ${from.n} has no rendered take to take a frame from` });
      src = tmp;
      label = Number.isFinite(t) ? `scene ${from.n} at ${Math.round(t * 10) / 10}s` : `last frame of scene ${from.n}`;
    } else if (b.kind === "project") {
      src = projectMedia.resolve(b.project, b.rel);
      if (!src || projectMedia.kindOfFile(src) !== "images")
        return res.status(404).json({ error: `${b.rel} is not a picture in this project` });
      label = `${projectMedia.groupFor(b.project, b.rel)}: ${path.basename(String(b.rel))}`;
    } else if (b.kind === "gallery" || b.kind === "asset") {
      src = sceneRefs.resolveImage(b.project, b.kind, b.name);
      if (!src) return res.status(404).json({ error: `${b.name} is not a picture in the ${b.kind === "asset" ? "image assets" : "gallery"}` });
      label = `${b.kind}: ${path.basename(String(b.name))}`;
    } else return res.status(400).json({ error: "kind must be frame, project, gallery or asset" });
    const out = sceneEdit.setPic(dirOf(b.project, r), r.qedit, slot, src, label);
    if (tmp) try { fs.unlinkSync(tmp); } catch {}
    if (!out.ok) return res.status(400).json({ error: out.error });
    r.qedit = out.qedit;
    scenes.save(st, b.project);
    res.json({ ok: true, n: r.n, slot, qedit: r.qedit, note: `scene ${r.n}'s ✎ ${slot}: ${label}` });
  }));

  app.post("/api/scenes/:n/qedit/pic/upload", upload.single("image"), trap.guard((req, res) => {
    const b = req.body || {};
    const f = req.file;
    const clean = () => { if (f) fs.unlink(f.path, () => {}); };
    const { st, r } = load(b, req.params.n);
    if (!r) { clean(); return res.status(404).json({ error: `no scene ${req.params.n}` }); }
    if (!f || !/\.(png|jpe?g|webp|bmp|gif)$/i.test(f.originalname || "")) { clean(); return res.status(400).json({ error: "upload one picture" }); }
    const withExt = f.path + path.extname(f.originalname).toLowerCase();
    let out;
    try {
      fs.renameSync(f.path, withExt);
      out = sceneEdit.setPic(dirOf(b.project, r), r.qedit, String(b.slot || "").replace(/^qe_/, ""), withExt,
                             "upload: " + path.basename(f.originalname));
    } finally { try { fs.unlinkSync(withExt); } catch {} clean(); }
    if (!out.ok) return res.status(400).json({ error: out.error });
    r.qedit = out.qedit;
    scenes.save(st, b.project);
    res.json({ ok: true, n: r.n, qedit: r.qedit });
  }));

  app.post("/api/scenes/:n/qedit/pic/delete", trap.guard((req, res) => {
    const b = req.body || {};
    const { st, r } = load(b, req.params.n);
    if (!r) return res.status(404).json({ error: `no scene ${req.params.n}` });
    const out = sceneEdit.delPic(dirOf(b.project, r), r.qedit, String(b.slot || "").replace(/^qe_/, ""), b.file);
    if (!out.ok) return res.status(400).json({ error: out.error });
    r.qedit = out.qedit;
    scenes.save(st, b.project);
    res.json({ ok: true, n: r.n, qedit: r.qedit });
  }));

  app.get("/api/scenes/:n/qedit/pic/:file", (req, res) => {
    const { r } = load(req.query, req.params.n);
    const p = r && sceneEdit.picPath(dirOf(req.query.project, r), req.params.file);
    if (!p) return res.status(404).json({ error: "no such picture" });
    res.sendFile(p);
  });

  app.post("/api/scenes/:n/qedit/run", trap.guard((req, res) => {
    const b = req.body || {};
    const project = b.project;
    const { st, r } = load(b, req.params.n);
    if (!r) return res.status(404).json({ error: `no scene ${req.params.n}` });
    const q = sceneEdit.safe(r.qedit);
    if (q.job) {
      const j = core.jobs.get(q.job);
      if (j && !j.finished) return res.status(409).json({ error: `scene ${r.n}'s first frame is already being made` });
    }
    if (b.prompt != null) q.prompt = String(b.prompt).slice(0, sceneEdit.MAX_TEXT);
    if (b.base != null && sceneEdit.BASES.includes(b.base)) q.base = b.base;
    if (Array.isArray(b.chars)) q.chars = b.chars.map(String).filter(Boolean).slice(0, sceneEdit.MAX_CHARS);
    const eng = editEngines();
    const styleId = String(b.style_id || q.style_id || eng.default || "");
    const style = styles.byId(core.STYLES_DIR, styleId);
    if (!style) return res.status(400).json({ error: "no edit style - Settings -> Image styles needs \"Qwen Image 2.1 edit\" (restart the app to seed it) or another Qwen / Kontext edit style" });
    let eg;
    try { eg = aiEdit.editGraph(style, core.BASE); } catch (e) { return res.status(400).json({ error: e.message }); }
    const d = dirOf(project, r);
    const cast = castSheets(project);
    let wanted = q.chars;
    if (!wanted.length) {                // none ticked: the @tags the scene's prompt names
      const txt = (r.prompt || []).join(" ").toLowerCase();
      wanted = cast.filter((c) => txt.includes("@" + c.tag)).map((c) => c.name).slice(0, sceneEdit.MAX_CHARS);
    }
    const picked = wanted.map((nm) => cast.find((c) => c.name === nm)).filter(Boolean);
    const locationPath = q.location ? sceneEdit.picPath(d, q.location.file) : null;
    const props = q.props.map((p) => ({ path: sceneEdit.picPath(d, p.file), label: p.label })).filter((p) => p.path);
    const firstSlot = sceneRefs.slotFor(project, r, "first");
    const canContinue = ["first", "continue", "transition", "last"].includes(String(r.anchor || "")) && !!contSource(st, r);
    const base = sceneEdit.resolveBase(q.base, { canContinue, hasLocation: !!locationPath, hasFirst: !!firstSlot, nChars: picked.length });
    let baseFile = null, baseLabel = "", tmp = null;
    if (base === "continue") {
      const cf = contFrame(project, st, r);
      if (cf) { baseFile = tmp = cf.file; baseLabel = cf.label; }
    } else if (base === "first" && firstSlot) {
      // copied: the result REPLACES the First slot, so the job must not read the file it overwrites
      tmp = path.join(core.tempDir(), `qedit_first_${Date.now()}${path.extname(firstSlot.file) || ".png"}`);
      fs.copyFileSync(firstSlot.file, tmp);
      baseFile = tmp; baseLabel = firstSlot.label;
    }
    let pl;
    try {
      pl = sceneEdit.plan({ base, baseFile, chars: picked, locationPath, props,
                            text: q.prompt, sceneText: (r.prompt || []).join(" ") });
    } catch (e) { if (tmp && base !== "continue") try { fs.unlinkSync(tmp); } catch {} return res.status(400).json({ error: e.message }); }
    if (pl.images.length > (eg.slots || 0))
      return res.status(400).json({ error: `${style.name} has ${eg.slots || 0} picture slot(s) and this frame needs ${pl.images.length} - use Qwen Image 2.1 edit (8), or drop a prop / a character` });
    const cfg = core.getConfig();
    const cv = sceneEdit.canvasFor(parseInt(b.width, 10) || (cfg.defaults || {}).width, parseInt(b.height, 10) || (cfg.defaults || {}).height);
    const w = cv.width, h = cv.height;
    const seed = imageSeed.forRequest(styles.numOrNull(b.seed));
    const p = { mode: "image", prompt: pl.prompt, style: styles.applyLoraWeights(style, null), style_id: style.id,
                style_name: style.name, width: w, height: h, batch: 1, workflow: eg.workflow,
                workflow_note: `✎ first frame for scene ${r.n} (${base}${baseLabel ? ": " + baseLabel : ""}) - ` + pl.roles.map((x, i) => `<image${i + 1}> ${x}`).join(", "),
                images: pl.images, no_assets: true, qedit_scene: r.id, seed: seed.seed, seed_random: seed.random };
    const job = core.makeJob(p);
    job.chunk = { i: 0, n: 1 };
    q.job = job.id; q.status = "running"; q.error = ""; q.at = Date.now(); q.style_id = style.id;
    r.qedit = q;
    scenes.save(st, project);
    res.json({ ok: true, n: r.n, job: job.id, base, prompt: pl.prompt, roles: pl.roles, qedit: q,
               note: `✎ scene ${r.n}: ${style.name} makes the first frame from ${pl.roles.join(" + ")} - it lands in the First slot` });
  }));
}

module.exports = { mount, contSource, castSheets };
