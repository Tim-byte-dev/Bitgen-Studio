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
//   POST /api/scenes/:n/qedit/write       2.563.0 🤖 the LLM writes the instruction (the <imageN> tags) -> {prompt, roles}
//   GET  /api/scenes/pictures?except=n    2.563.0 every scene's own pictures, by scene (lib/scenePictures) - the 🎬 tab
// 2.563.0 (Tim: "... use a reference image as the start frame but keep location the same ..."): base "picture" =
// Picture A (slot pica); with no 📍 location picture the place is the location the scene / the global prompt names
// (lib/sceneEdit.pickPlace -> its view picture).
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
const envs = require("../lib/environments");
const scenePictures = require("../lib/scenePictures");

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

/** 2.563.0: the place a Picture A frame keeps without a 📍 picture - {name, path?} or null */
function placeFor(project, st, r) {
  const env = sceneEdit.pickPlace(envs.list(project), (r.prompt || []).join(" "), (st.plan || {}).prompt_prefix);
  if (!env) return null;
  let p = env.view ? path.join(envs.envDir(env.name, project), env.view) : null;
  if (!p && env.pano) { try { const v = envs.extractView(env.name, project); if (v && v.ok) p = v.view; } catch { p = null; } }
  return { name: env.name, tag: env.tag, path: p && fs.existsSync(p) ? p : null };
}

/** what a ✎ frame of row r is made from (the run and 🤖 Write share it): {base, baseFile, baseLabel, tmp, picked, locationPath,
 *  props, picAPath, picALabel, place} - tmp = a temp copy to delete after (not for "continue": that file is the board's) */
function gather(project, st, r, q, cast) {
  const d = dirOf(project, r);
  let wanted = q.chars;
  if (!wanted.length) {                // none ticked: the @tags the scene's prompt names
    const txt = (r.prompt || []).join(" ").toLowerCase();
    wanted = cast.filter((c) => txt.includes("@" + c.tag)).map((c) => c.name).slice(0, sceneEdit.MAX_CHARS);
  }
  const picked = wanted.map((nm) => cast.find((c) => c.name === nm)).filter(Boolean);
  const locationPath = q.location ? sceneEdit.picPath(d, q.location.file) : null;
  const picAPath = q.pica ? sceneEdit.picPath(d, q.pica.file) : null;
  const props = q.props.map((p) => ({ path: sceneEdit.picPath(d, p.file), label: p.label })).filter((p) => p.path);
  const firstSlot = sceneRefs.slotFor(project, r, "first");
  const canContinue = ["first", "continue", "transition", "last"].includes(String(r.anchor || "")) && !!contSource(st, r);
  const base = sceneEdit.resolveBase(q.base, { hasPicA: !!picAPath, canContinue, hasLocation: !!locationPath, hasFirst: !!firstSlot, nChars: picked.length });
  let baseFile = null, baseLabel = "", tmp = null;
  if (base === "continue") {
    const cf = contFrame(project, st, r);
    if (cf) { baseFile = cf.file; baseLabel = cf.label; }
  } else if (base === "first" && firstSlot) {
    // copied: the result REPLACES the First slot, so the job must not read the file it overwrites
    tmp = path.join(core.tempDir(), `qedit_first_${Date.now()}${path.extname(firstSlot.file) || ".png"}`);
    fs.copyFileSync(firstSlot.file, tmp);
    baseFile = tmp; baseLabel = firstSlot.label;
  } else if (base === "picture" && picAPath) baseLabel = "Picture A" + (q.pica.label ? ": " + q.pica.label : "");
  const place = base === "picture" && !locationPath ? placeFor(project, st, r) : null;
  return { base, baseFile, baseLabel, tmp, picked, locationPath, props, picAPath, picALabel: q.pica ? q.pica.label : "", place };
}

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
      label = b.label ? String(b.label).slice(0, 80)            // 2.563.0: the 🎬 tab says what it is ("scene 2 · First frame")
        : `${projectMedia.groupFor(b.project, b.rel)}: ${path.basename(String(b.rel))}`;
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
    const cast = castSheets(project);
    const g = gather(project, st, r, q, cast);
    const { base, baseLabel, tmp } = g;
    let pl;
    try {
      pl = sceneEdit.plan({ base, baseFile: g.baseFile, chars: g.picked, locationPath: g.locationPath, props: g.props,
                            picAPath: g.picAPath, picALabel: g.picALabel, place: g.place,
                            text: q.prompt, sceneText: (r.prompt || []).join(" ") });
    } catch (e) { if (tmp) try { fs.unlinkSync(tmp); } catch {} return res.status(400).json({ error: e.message }); }
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
               note: `✎ scene ${r.n}: ${style.name} makes the first frame from ${pl.roles.join(" + ")} - it lands in the First slot`
                 + (g.place && !g.place.path ? ` (the place: ${g.place.name}, in words - it has no view picture)` : "") });
  }));

  /* 2.563.0: 🤖 Write - the LLM writes this frame's instruction with the pictures' tags (it becomes the direction, editable) */
  app.post("/api/scenes/:n/qedit/write", trap.guard(async (req, res) => {
    const b = req.body || {};
    const project = b.project;
    const { st, r } = load(b, req.params.n);
    if (!r) return res.status(404).json({ error: `no scene ${req.params.n}` });
    const q = sceneEdit.safe(r.qedit);
    if (b.base != null && sceneEdit.BASES.includes(b.base)) q.base = b.base;
    if (Array.isArray(b.chars)) q.chars = b.chars.map(String).filter(Boolean).slice(0, sceneEdit.MAX_CHARS);
    const g = gather(project, st, r, q, castSheets(project));
    let pl;
    try {
      pl = sceneEdit.plan({ base: g.base, baseFile: g.baseFile, chars: g.picked, locationPath: g.locationPath, props: g.props,
                            picAPath: g.picAPath, picALabel: g.picALabel, place: g.place, text: "", sceneText: (r.prompt || []).join(" ") });
    } catch (e) { if (g.tmp) try { fs.unlinkSync(g.tmp); } catch {} return res.status(400).json({ error: e.message }); }
    if (g.tmp) try { fs.unlinkSync(g.tmp); } catch {}
    const notes = String(b.notes != null ? b.notes : (sceneEdit.isFull(q.prompt) ? "" : q.prompt) || "").trim();
    const llmChat = require("../lib/llmChat");
    let reply = "";
    try {
      const rr = await llmChat.complete(core, { messages: sceneEdit.llmMessages({ base: g.base, roles: pl.roles, prefix: (st.plan || {}).prompt_prefix,
        sceneText: (r.prompt || []).join(" "), notes }) });
      if (!rr || rr.ok === false) return res.status(502).json({ error: "the LLM did not answer - " + ((rr && rr.error) || "start one in Settings ▸ LLM") });
      reply = llmChat.stripThinking(llmChat.readReply(rr));
    } catch (e) { return res.status(502).json({ error: "the LLM did not answer - " + (e.message || e) }); }
    let text = sceneEdit.cleanWritten(reply, pl.images.length);
    if (!text) return res.status(502).json({ error: "the LLM answered nothing usable - try again, or write the direction yourself" });
    if (!sceneEdit.isFull(text)) text = "<image1> " + text;      // (it must name the pictures: the start is <image1>)
    const st2 = scenes.load(project), r2 = scenes.at(st2, r.n);  // (the board may have moved while the LLM wrote)
    if (r2) { const q2 = sceneEdit.safe(r2.qedit); q2.prompt = text; if (b.base != null && sceneEdit.BASES.includes(b.base)) q2.base = b.base; r2.qedit = q2; scenes.save(st2, project); }
    res.json({ ok: true, n: r.n, prompt: text, roles: pl.roles, base: g.base,
               note: `🤖 scene ${r.n}: the LLM wrote the first frame's instruction (${pl.roles.length} picture(s)) - edit it, then ✎ Make first frame` });
  }));

  /* 2.563.0: every scene's own pictures, by scene - the pickers' 🎬 Scenes tab */
  app.get("/api/scenes/pictures", (req, res) => {
    try {
      const project = req.query.project;
      const st = scenes.load(project);
      res.json({ scenes: scenePictures.list(project, st, parseInt(req.query.except, 10) || 0) });
    } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
}

module.exports = { mount, contSource, castSheets };
