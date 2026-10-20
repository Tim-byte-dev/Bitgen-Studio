// bitGen Studio — THE CHARACTER SWAP DIALOG routes (2.329.0). Mounted from
// routes/index.js (never server.js). The record + planning + the compile
// args are lib/swapSession.js; each render is a mode "swap" job
// (lib/swap.jobParams -> swap_worker.py), through the swap style
// (lib/swap.resolveStyle, mmh3_chr_swap by default).
//
//   GET  /api/swapdlg                   the record (queued / running results
//                                       synced with the job table first)
//   POST /api/swapdlg/set               {video, text, max}
//   POST /api/swapdlg/picture           multipart "image", or {asset} (an
//                                       Image asset) - the new character
//   GET  /api/swapdlg/picture           that picture
//   POST /api/swapdlg/segments          {op: auto|add|remove|clear, start, dur, max, id}
//   POST /api/swapdlg/run               {ids: [segment ids]} (or {start, dur}
//                                       = the box) + width / height / seed /
//                                       video_style_id / text
//   POST /api/swapdlg/retry             {id}  the same window, a new seed
//   POST /api/swapdlg/upscale           {id}  the same window + seed, with the
//                                       video docker ⚙ upscaler stage
//   POST /api/swapdlg/keep              {id, keep}  vidTemp <-> vidSwap
//   POST /api/swapdlg/discard           {id}  the file to the recycle bin
//   POST /api/swapdlg/save              {id}  a copy into the Video assets
//   POST /api/swapdlg/compile           {ids} the ticked kept segments joined
//                                       in time order -> the Video assets
//   GET  /api/swapdlg/info?name=        the loaded video (fps, frames, size)
//   GET  /api/swapdlg/file/:where/:name a result (where = temp | keep)
//   POST /api/swapdlg/import {path}     (2.330.0) a video picked in the app's
//                                       file dialog, by path - any size
//   POST /api/swapdlg/upload            a dropped video, streamed to disk
//   POST|GET /api/swapdlg/proxy         a small H.264 preview copy of a movie
//                                       the player cannot decode
//   GET  /api/swapdlg/vrview?t=         what the VR virtual camera sees (JPEG)
//   POST /api/swapdlg/writeprompt       (2.335.0) {t, llm_file, text} - ✎ Write
//                                       prompt: the vision model describes the
//                                       picture + the frame at t, the LLM writes
//                                       the swap prompt (lib/swapPrompt) -> it
//                                       lands in the Direction box (st.text)
//   (2.339.0) ENGINE LTX RIPPLE (lib/rippleSwap): {engine} on /set; per segment
//   POST /api/swapdlg/firstframe        {ids} ✎ Qwen 2.1 puts the character into
//                                       each segment's first frame
//   POST /api/swapdlg/firstframe/put    multipart "image" + id, or {id, asset}
//                                       (a touched-up frame from the Image assets)
//   POST /api/swapdlg/firstframe/clear  {id, file?}  (2.348.0: one candidate)
//   POST /api/swapdlg/firstframe/select {id, file}   (2.348.0: the one to use)
//   GET  /api/swapdlg/ff/:id            that segment's first frame
//   /run on Ripple queues the missing first frames first, then (next press)
//   the Ripple renders (mode "ltx", params.ripple -> ltx_worker.py)
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn, spawnSync } = require("child_process");
const multer = require("multer");
const core = require("../lib/core");
const comfy = require("../lib/comfy");
const trap = require("../lib/trap");
const styles = require("../lib/styles");
const swap = require("../lib/swap");
const SS = require("../lib/swapSession");
const refSelect = require("../lib/refSelect");
const recycleBin = require("../lib/recycleBin");
const renderSettings = require("../lib/renderSettings");
const takeUpscale = require("../lib/takeUpscale");
const captioner = require("../lib/captioner");
const llmChat = require("../lib/llmChat");
const swapPrompt = require("../lib/swapPrompt");
const RS = require("../lib/rippleSwap");              // 2.339.0
const VS = require("../lib/viggleSwap");              // 2.344.0: the Viggle engine
const VN = require("../lib/viggleNative");            // 2.351.0: Viggle (native) - our own engine
const ltx = require("../lib/ltx");
const sceneEdit = require("../lib/sceneEdit");
const aiEdit = require("../lib/aiEdit");
const imageSeed = require("../lib/imageSeed");
const tempLoras = require("../lib/tempLoras");       // 2.342.0: the ⚙ dialog's LoRAs (kind "swap")

const pdir = () => core.projDir(core.getProject());
const videoPath = (name) => path.join(core.pDir("video"), path.basename(String(name || "")));
const fileOf = (r) => path.join(SS.dirOf(pdir(), r.where), r.file);
const PIC_EXT = [".png", ".jpg", ".jpeg", ".webp", ".bmp"];

function jobOf(id) {
  const j = core.jobs.get(String(id || ""));
  // 2.343.0: a failed job says WHY (the worker's own ERROR line)
  return j ? { status: j.status, output: j.output, error: j.error || (j.status === "failed" ? SS.workerError(j.log) : ""),
               // 2.350.0: a black Viggle take that safe mode rendered (⚙ remembers)
               safe: j.status === "done" && (j.log || []).some((l) => /\[worker\] safe mode fixed it/.test(String(l))) } : null;
}

/** A finished job's file -> vidTemp under its segment name (moved, so the
 *  segment is not ALSO a loose file in output/). */
function take(state, r, output) {
  const src = path.join(core.pDir("output"), path.basename(String(output)));
  if (!fs.existsSync(src)) throw new Error(`${output} is not in the project's output folder`);
  const dir = SS.dirOf(pdir(), "temp");
  const name = SS.uniquify(dir, SS.resultName(r.video, SS.indexOf(state, r.seg), r.start, r.dur, r.upscaled, r.vr));
  const dst = path.join(dir, name);
  try { fs.renameSync(src, dst); }
  catch { fs.copyFileSync(src, dst); try { fs.unlinkSync(src); } catch { /* the copy is what counts */ } }
  return name;
}

/** 2.339.0: a finished ✎ first-frame job's picture -> vidTemp as the
 *  segment's first frame (moved; the one it replaces is deleted). */
function takeFirstFrame(seg, output) {
  const src = path.join(core.pDir("output"), path.basename(String(output)));
  if (!fs.existsSync(src)) throw new Error(`${output} is not in the project's output folder`);
  return putFirstFrame(seg, src, path.extname(src).toLowerCase() || ".png", true);
}
function putFirstFrame(seg, src, ext, move) {
  const dir = SS.dirOf(pdir(), "temp");
  // 2.348.0: every first frame is a CANDIDATE - a new one never deletes the others
  const e = PIC_EXT.includes(ext) ? ext : ".png";
  let n = 1, name = RS.ffCandName(seg.id, n, e);
  while (fs.existsSync(path.join(dir, name)) && n < 999) name = RS.ffCandName(seg.id, ++n, e);
  if (move) { try { fs.renameSync(src, path.join(dir, name)); } catch { fs.copyFileSync(src, path.join(dir, name)); try { fs.unlinkSync(src); } catch {} } }
  else fs.copyFileSync(src, path.join(dir, name));
  return name;
}
const ffPath = (seg, file) => (seg && seg.ff && (file || seg.ff.file) ? path.join(SS.dirOf(pdir(), "temp"), path.basename(file || seg.ff.file)) : "");
// 2.348.0: a picked candidate is ready even while more candidates are being made
const ffReady = (seg) => !!(seg && seg.ff && seg.ff.file && (seg.ff.status === "done" || seg.ff.status === "running") && fs.existsSync(ffPath(seg)));

/** The Qwen edit style for ✎ first frames: Qwen Image 2.1 first. */
function editStyle() {
  const e = aiEdit.engines(styles.read(core.STYLES_DIR, "image"), core.BASE).edit;
  const pick = e.find((x) => /qwen.*2\.1/i.test(x.name)) || e.find((x) => /qwen/i.test(x.name)) || e[0];
  return pick ? styles.byId(core.STYLES_DIR, pick.id) : null;
}

/** ✎ one segment's first frame: the frame at its start + the character -> Qwen. */
function queueFirstFrame(st, seg, o) {
  const pic = st.picture ? path.join(SS.dirOf(pdir(), "temp"), st.picture) : "";
  if (!pic || !fs.existsSync(pic)) return { error: "pick the new character's picture first (the box on the left)" };
  if (!st.video || !fs.existsSync(videoPath(st.video))) return { error: "load the video to swap first (📂 Load video)" };
  if (SS.vrParams(st.vr)) return { error: `${engineName(st.engine)} swaps flat video - turn VR off (or use the MiniMax H3 engine)` };
  const style = editStyle();
  if (!style) return { error: "no edit style - Settings -> Image styles needs \"Qwen Image 2.1 edit\" (restart the app to seed it)" };
  let eg;
  try { eg = aiEdit.editGraph(style, core.BASE); } catch (e) { return { error: e.message }; }
  if ((eg.slots || 0) < 2) return { error: `${style.name} takes ${eg.slots || 0} picture(s) - the first frame needs 2 (the frame + the character)` };
  const id = crypto.randomBytes(6).toString("hex");
  const dir = path.join(core.JOBS_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  const frame = path.join(dir, "ripple_frame.png");
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", (+seg.start || 0).toFixed(3), "-i", videoPath(st.video),
    "-frames:v", "1", frame], { timeout: 60000 });
  if (r.status !== 0 || !fs.existsSync(frame)) { fs.rmSync(dir, { recursive: true, force: true }); return { error: `could not read the frame at ${seg.start}s of ${st.video}` }; }
  const image = path.join(dir, "swap_character" + path.extname(pic).toLowerCase());
  fs.copyFileSync(pic, image);
  const info = refSelect.probe(videoPath(st.video)) || {};
  const cv = sceneEdit.canvasFor(info.width, info.height);
  const seed = imageSeed.forRequest(Number.isFinite(o.seed) ? o.seed : null);
  const p = { mode: "image", prompt: RS.editPrompt(o.text != null ? o.text : st.text), style: styles.applyLoraWeights(style, null),
              style_id: style.id, style_name: style.name, width: cv.width, height: cv.height, batch: 1, workflow: eg.workflow,
              workflow_note: `✎ Ripple first frame for the segment at ${seg.start}s - <image1> the frame, <image2> the new character`,
              images: [frame, image], no_assets: true, seed: seed.seed, seed_random: seed.random };
  const job = core.makeJob(p, id, dir);
  job.chunk = { i: 0, n: 1 };
  return { job };
}

/** A newly loaded video's VR: a name that says VR switches it on; 2.345.0
 *  (Tim's H3 swap of a flat video failed on "stereo VR needs OpenCV" - VR
 *  was still on from an earlier video) a video that looks nothing like VR
 *  (not square, not 2:1, no VR name) switches it OFF. */
function vrForNew(st, d) {
  if (d.sure && st.vr.mode === "off") st.vr = SS.vrSafe({ ...st.vr, mode: d.mode });
  else if (!d.mode && st.vr.mode !== "off") st.vr = SS.vrSafe({ ...st.vr, mode: "off" });
}

/** The record, synced with the job table and the disk. */
function current() {
  let st = SS.load(pdir());
  const f = RS.syncFirstFrames(st, jobOf, takeFirstFrame);             // 2.339.0
  // 2.343.0 (Tim: "ltx doesn't start the render after the picture is
  // generated"): a first frame ▶ Swap asked for goes straight on to render
  for (const w of f.ready || []) {
    const seg = st.segments.find((x) => x.id === w.id);
    if (!seg || !RS.usesFirstFrame(st.engine) || !st.picture) continue;
    if (st.results.some((r) => r.seg === seg.id && (r.status === "queued" || r.status === "running"))) continue;
    const q = queue(st, seg, { text: w.text });
    if (q.error) { seg.ff = { ...seg.ff, error: "▶ could not start the render: " + q.error }; continue; }
    st = SS.addResult(st, { seg: seg.id, video: st.video, start: seg.start, dur: seg.dur, frames: seg.frames,
                            seed: q.seed, job: q.job.id, vr: "", aim: null, engine: st.engine }).state;
    f.changed = true;
  }
  const s = SS.sync(st, jobOf, (r, out) => take(st, r, out));
  if (f.changed) s.changed = true;
  // 2.350.0: safe mode fixed a black Viggle take -> ⚙ Viggle safe mode on
  if (s.safe && s.state.settings.viggle_safe !== true) s.state.settings = RS.settingsSafe({ ...s.state.settings, viggle_safe: true });
  const p = SS.prune(s.state, (r) => fs.existsSync(fileOf(r)));
  if (s.changed || p.dropped) return SS.save(pdir(), p.state);
  return p.state;
}

/** 2.342.0: the loaded video's size (asked once per file). */
const _sizes = new Map();
function videoInfo(name) {
  if (!name || !fs.existsSync(videoPath(name))) return null;
  const k = name + "|" + fs.statSync(videoPath(name)).mtimeMs;
  if (!_sizes.has(k)) { const i = refSelect.probe(videoPath(name)) || {}; _sizes.set(k, { width: i.width || 0, height: i.height || 0, fps: i.fps || 0, duration: i.duration || 0 }); }
  return _sizes.get(k);
}
const swapLoras = () => tempLoras.read(pdir(), "swap");

function view(st) {
  const ceil = swap.ceiling(core.getConfig());
  const vi = videoInfo(st.video);
  return { ...st, ceiling: ceil, max_seconds: SS.maxSeconds(ceil), best_seconds: SS.bestSeconds(ceil), qualities: swap.QUALITIES,
           engines: RS.ENGINES,
           // 2.342.0: the ⚙ dialog - the video's own size, the size a render uses, the swap LoRAs
           video_info: vi, render_size: (RS.isViggle(st.engine) ? VS : RS).sizeFor(st.settings, vi && vi.width, vi && vi.height), loras: swapLoras(),
           picture_url: st.picture ? "/api/swapdlg/picture?v=" + encodeURIComponent(st.picture) : "" };
}

async function comfyUp() {
  try { await comfy.ensure({ force: true }); return null; }
  catch (e) { return "ComfyUI is not up and could not be started: " + String((e && e.message) || e); }
}

let _x265 = null;
/** Is libx265 in this ffmpeg (8K VR is H.265)? Asked once. */
function hasX265() {
  if (_x265 === null) {
    try { _x265 = / libx265 /.test(spawnSync("ffmpeg", ["-hide_banner", "-encoders"], { encoding: "utf8" }).stdout || ""); }
    catch { _x265 = false; }
  }
  return _x265;
}

/** The spherical metadata on a joined VR movie (scripts/vr_swap.py inject). */
function vrInject(file, mode) {
  return new Promise((resolve) => {
    let out = "";
    const py = (core.getConfig() || {}).python || "python";
    const p = spawn(py, [path.join(core.BASE, "scripts", "vr_swap.py"), "inject", file, mode],
      { stdio: ["ignore", "pipe", "pipe"] });
    p.stdout.on("data", (d) => { out += d; });
    p.on("error", () => resolve("not tagged (python did not start)"));
    p.on("close", () => resolve(out.trim()));
  });
}

/** Queue one window as a swap job; -> {result} or {error}. */
function queue(st, seg, o) {
  if (RS.usesFirstFrame(o.engine || st.engine)) return queueRipple(st, seg, { ...o, engine: o.engine || st.engine });
  const pic = st.picture ? path.join(SS.dirOf(pdir(), "temp"), st.picture) : "";
  if (!pic || !fs.existsSync(pic)) return { error: "pick the new character's picture first (the box on the left)" };
  if (!st.video || !fs.existsSync(videoPath(st.video))) return { error: "load the video to swap first (📂 Load video)" };
  // the picture is COPIED into the job's own folder: changing the picture
  // while segments wait in the queue must not change what they render
  const id = crypto.randomBytes(6).toString("hex");
  const dir = path.join(core.JOBS_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  const image = path.join(dir, "swap_character" + path.extname(pic).toLowerCase());
  fs.copyFileSync(pic, image);
  // 2.342.0: the ⚙ dialog - a fixed seed / a set size ride the H3 render too
  const seed = Number.isFinite(o.seed) && o.seed >= 0 ? o.seed : RS.seedFor(st.settings, () => crypto.randomInt(0, 2 ** 31));
  if (st.settings && st.settings.auto_size === false && st.settings.width && st.settings.height) { o = { ...o, width: st.settings.width, height: st.settings.height }; }
  const ps = swap.resolveStyle(styles.read(core.STYLES_DIR, "video"), o.styleId, core.BASE);
  const p = swap.jobParams({ workflow: ps.workflow, style: ps.style, video: videoPath(st.video), image,
    text: o.text != null ? o.text : st.text, start: seg.start, dur: seg.dur,
    quality: o.quality || st.quality,
    width: o.width, height: o.height, seed, cfg: core.getConfig() });
  if (p.error) { fs.rmSync(dir, { recursive: true, force: true }); return { error: p.error }; }
  // 2.329.0: a dialog segment files itself into vidTemp (routes: take), not
  // into the Video assets - no_assets tells lib/core to leave it alone
  p.no_assets = true;
  p.swapdlg = { seg: seg.id || "", upscaled: !!o.stage };
  if (o.stage) p.upscale_stage = o.stage;
  // 2.330.0: VR - the virtual camera's aim rides the job (swap_worker ->
  // scripts/vr_swap.py); o.vr (a retry / upscale of a VR result) wins
  const vr = o.vr !== undefined ? o.vr : SS.vrParams(st.vr);
  if (vr) p.vr = vr;
  const job = core.makeJob(p, id, dir);
  return { job, seed, vr, note: swap.summary(p) + (vr ? ` - VR ${vr.mode}: the virtual camera at yaw ${vr.yaw}, pitch ${vr.pitch}, ${vr.fov}° (${vr.shape})` : "") };
}

const engineName = (e) => (RS.ENGINES.find((x) => x.id === e) || RS.ENGINES[0]).label;
/** 2.339.0: one segment through LTX Ripple - 2.344.0: or Viggle (its ✎ first frame must be done). */
function queueRipple(st, seg, o) {
  const eng = o.engine || st.engine, viggle = RS.isViggle(eng), native = eng === "viggle_native", nm = engineName(eng);
  if (!st.video || !fs.existsSync(videoPath(st.video))) return { error: "load the video to swap first (📂 Load video)" };
  if (o.stage) return { error: `⏫ upscale is for MiniMax H3 takes - a ${nm} take is rendered at its size (set the size and ↻)` };
  if ((o.vr !== undefined ? o.vr : SS.vrParams(st.vr))) return { error: `${nm} swaps flat video - turn VR off (or use the MiniMax H3 engine)` };
  const g = st.segments.find((x) => x.id === seg.id) || seg;
  if (!ffReady(g)) return { error: "that segment has no first frame yet - ✎ make it first", needFirst: true };
  // 2.351.0: Viggle (native) - our own engine; refused in words until it is installed
  // 2.352.0: on the native engine server (routes/native.js)
  if (native) { const why = require("./viggleNative").statusView().note; if (why) return { error: why }; }
  // 2.342.0: Tim's own workflow (comfy_workflows/LTX_Ripple_FFAF_Edit_v11_api.json)
  // 2.344.0: Viggle = his viggle_animate_h3_api.json
  const WF = viggle ? VS.WORKFLOW : RS.WORKFLOW;
  const wf = path.join(core.BASE, "comfy_workflows", WF);
  if (!native && !fs.existsSync(wf)) return { error: `comfy_workflows/${WF} is missing - it ships in the full zip (unzip it over the install)` };
  const id = crypto.randomBytes(6).toString("hex");
  const dir = path.join(core.JOBS_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  const image = path.join(dir, (viggle ? "viggle_first" : "ripple_first") + path.extname(g.ff.file).toLowerCase());
  fs.copyFileSync(ffPath(g), image);                       // the job keeps ITS frame
  const set = RS.settingsSafe(st.settings);
  const vi = videoInfo(st.video) || {};
  const sz = (viggle ? VS : RS).sizeFor(set, vi.width, vi.height);
  const seed = Number.isFinite(o.seed) && o.seed >= 0 ? o.seed : RS.seedFor(set, () => crypto.randomInt(0, 2 ** 31));
  const p = native
    ? VN.jobParams({ video: videoPath(st.video), image, start: seg.start, frames: seg.frames, seed,
        width: sz.width, height: sz.height, settings: set })
    : viggle
    ? VS.jobParams({ workflow: wf, video: videoPath(st.video), start: seg.start, frames: seg.frames, image, seed,
        width: sz.width, height: sz.height, steps: set.viggle_steps, strength: set.viggle_strength, loras: swapLoras(),
        solattn: set.viggle_solattn, safe: set.viggle_safe })
    : RS.jobParams({ workflow: wf, video: videoPath(st.video), start: seg.start, frames: seg.frames, image,
        text: o.text != null ? o.text : st.text, seed, width: sz.width, height: sz.height, steps: set.steps,
        strength: set.strength, loras: swapLoras() });
  if (p.error) { fs.rmSync(dir, { recursive: true, force: true }); return { error: p.error }; }
  p.no_assets = true;
  p.swapdlg = { seg: seg.id || "", upscaled: false };
  const job = core.makeJob(p, id, dir);
  return { job, seed, vr: null, engine: eng, note: (native ? VN : viggle ? VS : RS).summary(p) };
}

/** One JPEG frame of the dialog's video at t (the VR virtual camera's view
 *  when VR is on) for the vision model, or null. */
function frameAt(st, t) {
  if (!st.video || !fs.existsSync(videoPath(st.video))) return null;
  let vf = "scale='min(768,iw)':-2";
  const v = SS.vrParams(st.vr);
  if (v) { const sz = SS.vrViewSize(512, v.shape); vf = SS.vrFlatVf(v.mode, "L", v, sz.width, sz.height); }
  const r = spawnSync("ffmpeg", ["-loglevel", "error", "-ss", Math.max(0, +t || 0).toFixed(3), "-i", videoPath(st.video),
    "-vf", vf, "-frames:v", "1", "-f", "image2", "-c:v", "mjpeg", "-q:v", "3", "pipe:1"],
    { maxBuffer: 32 * 1024 * 1024, timeout: 60000 });
  return r.status === 0 && r.stdout && r.stdout.length ? { buffer: r.stdout, mimetype: "image/jpeg" } : null;
}
let writing = false;

function mount(app) {
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 64 * 1024 * 1024, files: 1 } });

  app.get("/api/swapdlg", (_req, res) => res.json(view(current())));

  app.post("/api/swapdlg/set", trap.guard((req, res) => {
    const b = req.body || {};
    const st = current();
    if (b.video != null) {
      const v = path.basename(String(b.video));
      if (v && !fs.existsSync(videoPath(v))) return res.status(400).json({ error: `${v} is not in the project's Video assets` });
      if (v !== st.video) {
        st.segments = [];                            // a new video = a new plan
        // 2.330.0: a name that says VR (_180_LR, _360_TB ...) switches VR on
        const info = v ? refSelect.probe(videoPath(v)) || {} : {};
        vrForNew(st, SS.detectVr(v, info.width, info.height));
      }
      st.video = v;
    }
    if (b.text != null) st.text = String(b.text).slice(0, 1500);
    if (b.max != null) st.max = SS.clampMax(b.max, swap.ceiling(core.getConfig()));
    if (b.quality != null) st.quality = swap.qualityOf(String(b.quality));        // 2.336.0
    if (b.engine != null) st.engine = RS.engineOf(b.engine);                     // 2.339.0
    if (b.settings && typeof b.settings === "object") st.settings = RS.settingsSafe({ ...st.settings, ...b.settings });   // 2.342.0: ⚙
    if (b.vr && typeof b.vr === "object") st.vr = SS.vrSafe({ ...st.vr, ...b.vr });   // 2.330.0
    res.json(view(SS.save(pdir(), st)));
  }));

  app.post("/api/swapdlg/picture", upload.single("image"), trap.guard((req, res) => {
    const st = current();
    const dir = SS.dirOf(pdir(), "temp");
    let buf = null, ext = ".png";
    if (req.file && req.file.buffer) {
      buf = req.file.buffer;
      ext = path.extname(req.file.originalname || "").toLowerCase();
    } else if ((req.body || {}).asset) {
      const a = path.join(core.pDir("images"), path.basename(String(req.body.asset)));
      if (!fs.existsSync(a)) return res.status(400).json({ error: "that picture is not in the Image assets" });
      buf = fs.readFileSync(a);
      ext = path.extname(a).toLowerCase();
    }
    if (!buf) return res.status(400).json({ error: "send a picture (png / jpg / webp)" });
    if (!PIC_EXT.includes(ext)) return res.status(400).json({ error: "the new character must be a picture (png / jpg / webp / bmp)" });
    for (const f of fs.readdirSync(dir)) if (/^_swap_character\./.test(f)) fs.rmSync(path.join(dir, f), { force: true });
    const name = "_swap_character" + ext;
    fs.writeFileSync(path.join(dir, name), buf);
    st.picture = name;
    res.json(view(SS.save(pdir(), st)));
  }));

  // 2.335.0 (Tim: "the vllm can describe the picture the llm can make the
  // prompt, add a button under the prompt input in the character swap dialog
  // Write Prompt"). Slow (two models load in turn) - one at a time.
  app.post("/api/swapdlg/writeprompt", trap.guard(async (req, res) => {
    const b = req.body || {};
    const st = current();
    const pic = st.picture ? path.join(SS.dirOf(pdir(), "temp"), st.picture) : "";
    if (!pic || !fs.existsSync(pic)) return res.status(400).json({ error: "pick the new character's picture first (the box on the left)" });
    if (writing) return res.status(409).json({ error: "already writing a prompt - wait for it" });
    writing = true;
    try {
      const frame = frameAt(st, b.t);
      const out = await swapPrompt.write({
        describe: (files) => captioner.describe(core, files),
        complete: (o) => llmChat.complete(core, o),
        guide: swapPrompt.guide(core.STYLES_DIR),
      }, { picture: { path: pic, mimetype: /\.jpe?g$/i.test(pic) ? "image/jpeg" : /\.webp$/i.test(pic) ? "image/webp" : "image/png" },
           frame, wishes: b.text != null ? String(b.text) : st.text, llm_file: b.llm_file ? String(b.llm_file) : undefined });
      const fresh = current();
      fresh.text = out.prompt;
      const saved = SS.save(pdir(), fresh);
      const said = [out.described ? "the picture described" : "the picture NOT described",
                    out.framed ? `the performer = ${out.performer.main}` : (frame ? "the frame not described" : "no video frame"),
                    out.fallback ? "prompt composed from the descriptions" : "prompt written by the LLM"];
      res.json({ ...view(saved), prompt: out.prompt, fallback: out.fallback, described: out.described, framed: out.framed,
                 character: out.character, performer: out.performer, notes: out.notes,
                 note: "✎ " + said.join(" · ") + (out.notes.length ? " - " + out.notes.join("; ") : "") });
    } catch (e) {
      res.status(e.status || 500).json({ error: String((e && e.message) || e) });
    } finally { writing = false; }
  }));

  app.get("/api/swapdlg/picture", (_req, res) => {
    const st = SS.load(pdir());
    const f = st.picture ? path.join(SS.dirOf(pdir(), "temp"), st.picture) : "";
    if (!f || !fs.existsSync(f)) return res.status(404).json({ error: "no picture yet" });
    res.sendFile(f);
  });

  app.post("/api/swapdlg/segments", trap.guard((req, res) => {
    const b = req.body || {};
    let st = current();
    const ceil = swap.ceiling(core.getConfig());
    const op = String(b.op || "");
    if (op === "clear") st.segments = [];
    else if (op === "remove") st = SS.removeSegment(st, b.id);
    else {
      if (!st.video || !fs.existsSync(videoPath(st.video))) return res.status(400).json({ error: "load a video first" });
      const info = refSelect.probe(videoPath(st.video));
      if (!info || !(info.duration > 0)) return res.status(400).json({ error: `could not read ${st.video} (is ffprobe installed?)` });
      if (op === "auto") {
        if (b.max != null) st.max = SS.clampMax(b.max, ceil);
        const pl = SS.plan(info.duration, 0, st.max || SS.bestSeconds(ceil), ceil);
        st = SS.setSegments(st, pl.segments);
        const saved = SS.save(pdir(), st);
        return res.json({ ...view(saved), note: `${pl.segments.length} segment(s) of up to ${(pl.frames / SS.FPS).toFixed(2)}s`
          + (pl.tail > 0 ? ` - the last ${pl.tail.toFixed(2)}s (under 17 frames, H3's grid) is left unswapped` : "") });
      } else if (op === "add") {
        const g = SS.one(info.duration, b.start, b.dur, ceil);
        if (!g) return res.status(400).json({ error: "that window is shorter than 5 frames or past the end" });
        const r = SS.addSegment(st, g);
        return res.json({ ...view(SS.save(pdir(), r.state)), seg: r.seg });
      } else return res.status(400).json({ error: "op must be auto, add, remove or clear" });
    }
    res.json(view(SS.save(pdir(), st)));
  }));

  app.post("/api/swapdlg/run", trap.guard(async (req, res) => {
    const b = req.body || {};
    let st = current();
    let segs = [];
    if (Array.isArray(b.ids) && b.ids.length) {
      const want = new Set(b.ids.map(String));
      segs = st.segments.filter((g) => want.has(g.id));
    } else if (b.start != null) {
      const info = st.video && fs.existsSync(videoPath(st.video)) ? refSelect.probe(videoPath(st.video)) : null;
      if (!info) return res.status(400).json({ error: "load the video to swap first (📂 Load video)" });
      const g = SS.one(info.duration, b.start, b.dur, swap.ceiling(core.getConfig()));
      if (!g) return res.status(400).json({ error: "that window is shorter than 5 frames or past the end" });
      const r = SS.addSegment(st, g);
      st = r.state; segs = [r.seg];
    }
    if (!segs.length) return res.status(400).json({ error: "nothing to swap - pick a segment (or ✂ Auto segment)" });
    // a segment already waiting in the queue is not queued twice
    const busy = new Set(st.results.filter((r) => r.status === "queued" || r.status === "running").map((r) => r.seg));
    const todo = segs.filter((g) => !busy.has(g.id));
    if (!todo.length) return res.status(409).json({ error: "those segments are already in the queue", ...view(st) });
    if (!st.picture) return res.status(400).json({ error: "pick the new character's picture first (the box on the left)" });
    // 2.351.0: Viggle (native) renders without ComfyUI - only a missing ✎ first frame (Qwen) needs it
    const down = st.engine !== "viggle_native" || todo.some((g) => !ffReady(g)) ? await comfyUp() : "";
    if (down) return res.status(502).json({ error: down });
    const queued = [];
    // 2.339.0: LTX Ripple - a segment without its ✎ first frame gets that
    // made first (look at it / touch it up, then ▶ Swap again)
    const firsts = [];
    if (RS.usesFirstFrame(st.engine)) {                              // 2.344.0: + Viggle
      for (const g of todo.filter((x) => !ffReady(x))) {
        const seg = st.segments.find((x) => x.id === g.id);
        if (seg.ff && seg.ff.status === "running") { firsts.push(seg.id); continue; }
        // 2.348.0: ✎ ×N makes several candidates to pick from - then nothing renders on its own
        const n = Math.max(1, Math.min(RS.FF_MAX_COUNT, Math.round(+b.ff_count || 1)));
        const ids = [];
        for (let i = 0; i < n; i++) {
          const q = queueFirstFrame(st, seg, { text: b.text });
          if (q.error) { SS.save(pdir(), st); return res.status(400).json({ error: q.error, queued }); }
          ids.push(q.job.id);
        }
        const ff0 = RS.ffSafe(seg.ff);
        seg.ff = { ...ff0, jobs: [...ff0.jobs, ...ids], job: "", status: "running", error: "",
                   // 2.343.0: ⚙ "render as soon as the first frame is made" (on by default)
                   ...(n === 1 && RS.settingsSafe(st.settings).auto_render ? { auto: true, text: b.text != null ? String(b.text) : st.text || "" } : {}) };
        firsts.push(seg.id);
      }
    }
    for (const g of todo.filter((x) => !firsts.includes(x.id))) {
      const q = queue(st, g, { width: b.width, height: b.height, styleId: b.video_style_id, text: b.text });
      if (q.error) { SS.save(pdir(), st); return res.status(400).json({ error: q.error, queued }); }
      const r = SS.addResult(st, { seg: g.id, video: st.video, start: g.start, dur: g.dur, frames: g.frames,
                                   seed: q.seed, job: q.job.id, vr: q.vr ? q.vr.mode : "", aim: q.vr, engine: st.engine });
      st = r.state; queued.push(r.result.id);
    }
    const auto = RS.settingsSafe(st.settings).auto_render;
    const said = [queued.length ? `${queued.length} segment(s) queued - they render one at a time` : "",
                  firsts.length ? (auto ? `✎ ${firsts.length} first frame(s) being made with Qwen 2.1 - each segment renders as soon as its frame is made`
                                        : `✎ ${firsts.length} first frame(s) being made with Qwen 2.1 - check them (touch up if needed), then ▶ Swap again`) : ""];
    res.json({ ...view(SS.save(pdir(), st)), queued, firsts, note: said.filter(Boolean).join("; ") });
  }));

  // Retry = the same window, a NEW seed. Upscale = the same window and the
  // SAME seed with the ⚙ upscaler spliced in (the same take, bigger).
  async function again(req, res, upscale) {
    const b = req.body || {};
    let st = current();
    const r0 = st.results.find((x) => x.id === String(b.id));
    if (!r0) return res.status(404).json({ error: "no such result" });
    let stage = null;
    if (upscale && RS.usesFirstFrame(r0.engine))
      return res.status(400).json({ error: `⏫ upscale is for MiniMax H3 takes - a ${engineName(r0.engine)} take is rendered at its size (set the size and ↻)` });
    if (upscale) {
      if (r0.status !== "done") return res.status(400).json({ error: "that segment has not finished yet" });
      const rs = renderSettings.read(pdir());
      if (!rs.upscaler) return res.status(400).json({ error: takeUpscale.NO_UPSCALER });
      // a VR result is the whole sphere - what is upscaled is the VIEW the swap rendered
      const size = r0.vr ? SS.vrViewSize(swap.shortSide(b.width, b.height), (r0.aim || {}).shape)
        : takeUpscale.probeSize(fileOf(r0));
      if (!size) return res.status(400).json({ error: `could not read the size of ${r0.file} (is ffprobe installed?)` });
      const u = renderSettings.upscaleDims(rs.upscale_res, size.width, size.height);
      if (!(u && (u.width > size.width || u.height > size.height)))
        return res.status(400).json({ error: `${r0.file} is already ${size.width}x${size.height} - pick a larger Upscale resolution in the StoryBoard's ⚙` });
      stage = { model: rs.upscaler, width: u.width, height: u.height };
    }
    const down = r0.engine === "viggle_native" ? "" : await comfyUp();          // 2.351.0: no ComfyUI for native
    if (down) return res.status(502).json({ error: down });
    const seg = { id: r0.seg, start: r0.start, dur: r0.dur, frames: r0.frames };
    const saveVideo = st.video;
    st.video = r0.video || st.video;         // the window belongs to ITS video
    const q = queue(st, seg, { width: b.width, height: b.height, styleId: b.video_style_id,
                               seed: upscale ? r0.seed : undefined, stage, engine: r0.engine,
                               vr: r0.vr ? { mode: r0.vr, ...(r0.aim || {}) } : null });
    st.video = saveVideo;
    if (q.error) return res.status(400).json({ error: q.error });
    const r = SS.addResult(st, { seg: r0.seg, video: r0.video, start: r0.start, dur: r0.dur, frames: r0.frames,
                                 seed: q.seed, job: q.job.id, upscaled: !!stage, vr: r0.vr, aim: r0.aim, engine: r0.engine });
    st = r.state;
    res.json({ ...view(SS.save(pdir(), st)), queued: [r.result.id],
               note: upscale ? `⏫ ${r0.file}: the same window and seed ${r0.seed} again with ${stage.model} -> `
                 + `${stage.width}x${stage.height}`
                 : q.seed === r0.seed ? `↻ ${r0.file}: the same window, the same seed (${q.seed} - fixed in ⚙ Settings)`
                 : `↻ ${r0.file}: the same window with a new seed (${q.seed})` });
  }
  // 2.339.0: LTX Ripple's ✎ first frames
  app.post("/api/swapdlg/firstframe", trap.guard(async (req, res) => {
    const b = req.body || {};
    const st = current();
    const want = new Set((Array.isArray(b.ids) ? b.ids : [b.id]).map(String));
    const segs = st.segments.filter((g) => want.has(g.id));
    if (!segs.length) return res.status(400).json({ error: "pick a segment (or ✂ Auto segment) first" });
    // 2.348.0: ✎ adds candidates (count 1-4 per press, a new seed each) - a
    // segment already making some just gets more, up to the job cap
    const n = Math.max(1, Math.min(RS.FF_MAX_COUNT, Math.round(+b.count || 1)));
    const room = (g) => RS.FF_MAX_COUNT * 2 - RS.ffSafe(g.ff).jobs.length;
    if (!segs.some((g) => room(g) > 0)) return res.status(409).json({ error: "those first frames are already being made - wait for some", ...view(st) });
    const down = await comfyUp();
    if (down) return res.status(502).json({ error: down });
    const made = [];
    let total = 0;
    for (const g of segs) {
      const k = Math.min(n, room(g));
      if (k <= 0) continue;
      const ids = [];
      for (let i = 0; i < k; i++) {
        const q = queueFirstFrame(st, g, { text: b.text, seed: k === 1 && Number.isFinite(+b.seed) && b.seed !== "" && b.seed != null ? +b.seed : undefined });
        if (q.error) { SS.save(pdir(), st); return res.status(400).json({ error: q.error, made }); }
        ids.push(q.job.id);
      }
      const ff0 = RS.ffSafe(g.ff);
      g.ff = { ...ff0, jobs: [...ff0.jobs, ...ids], job: "", status: "running", error: "" };
      made.push(g.id); total += k;
    }
    res.json({ ...view(SS.save(pdir(), st)), made, note: `✎ ${total} first frame(s) queued (Qwen Image 2.1: the character put into the segment's first frame)`
      + (total > made.length ? " - click the one to use, double-click to see it big" : "") });
  }));

  app.post("/api/swapdlg/firstframe/put", upload.single("image"), trap.guard((req, res) => {
    const b = req.body || {};
    const st = current();
    const g = st.segments.find((x) => x.id === String(b.id || ""));
    if (!g) return res.status(404).json({ error: "no such segment" });
    let src = null, ext = ".png", label = "";
    const tmp = path.join(core.tempDir(), `ripple_put_${Date.now()}`);
    if (req.file && req.file.buffer) {
      ext = path.extname(req.file.originalname || "").toLowerCase() || ".png";
      src = tmp + ext; fs.writeFileSync(src, req.file.buffer); label = "⤒ " + path.basename(req.file.originalname || "upload");
    } else if (b.asset) {
      let a = path.join(core.pDir("images"), path.basename(String(b.asset)));
      if (String(b.asset) === "@latest") {                // ⤓ the touch-up the Image editor saved last
        const dir = core.pDir("images");
        const pics = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => PIC_EXT.includes(path.extname(f).toLowerCase()))
          .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs })).sort((x, y) => y.t - x.t) : [];
        if (!pics.length) return res.status(400).json({ error: "the Image assets are empty - 💾 Save the touched-up frame in the Image editor first" });
        a = path.join(dir, pics[0].f);
      }
      if (!fs.existsSync(a)) return res.status(400).json({ error: "that picture is not in the Image assets" });
      ext = path.extname(a).toLowerCase(); src = a; label = "asset: " + path.basename(a);
    }
    if (!src) return res.status(400).json({ error: "send a picture (png / jpg / webp), or {asset}" });
    if (!PIC_EXT.includes(ext)) return res.status(400).json({ error: "the first frame must be a picture (png / jpg / webp / bmp)" });
    const name = putFirstFrame(g, src, ext, src.startsWith(tmp));
    // 2.348.0: a candidate too - added and used
    const ff0 = RS.ffSafe(g.ff), at = Date.now();
    g.ff = { ...ff0, cands: [...ff0.cands, { file: name, label, at }], file: name, label, at, error: "",
             status: ff0.jobs.length ? "running" : "done" };
    res.json({ ...view(SS.save(pdir(), st)), note: `segment at ${g.start}s: first frame = ${label}` });
  }));

  app.post("/api/swapdlg/firstframe/clear", trap.guard((req, res) => {
    const st = current();
    const b = req.body || {};
    const g = st.segments.find((x) => x.id === String(b.id || ""));
    if (!g) return res.status(404).json({ error: "no such segment" });
    // 2.348.0: ✕ drops ONE candidate (b.file, default the used one); the newest left is used
    const d = RS.ffDrop(g.ff, b.file);
    if (d.removed) fs.rmSync(ffPath(g, d.removed), { force: true });
    if (d.ff) g.ff = d.ff; else delete g.ff;
    res.json(view(SS.save(pdir(), st)));
  }));
  // 2.348.0: pick which candidate the segment renders from
  app.post("/api/swapdlg/firstframe/select", trap.guard((req, res) => {
    const b = req.body || {};
    const st = current();
    const g = st.segments.find((x) => x.id === String(b.id || ""));
    if (!g) return res.status(404).json({ error: "no such segment" });
    const ff = RS.ffSelect(g.ff, b.file);
    if (!ff) return res.status(400).json({ error: "that picture is not one of this segment's first frames" });
    g.ff = ff;
    res.json({ ...view(SS.save(pdir(), st)), note: `segment at ${g.start}s: first frame = ${ff.label || ff.file}` });
  }));

  app.get("/api/swapdlg/ff/:id", (req, res) => {
    const g = SS.load(pdir()).segments.find((x) => x.id === String(req.params.id));
    // 2.348.0: ?f=<candidate> serves that one (only a candidate of THIS segment)
    const want = req.query && req.query.f ? path.basename(String(req.query.f)) : "";
    if (want && !(g && RS.ffSafe(g.ff).cands.some((c) => c.file === want))) return res.status(404).json({ error: "no such first frame" });
    const f = ffPath(g, want);
    if (!f || !fs.existsSync(f)) return res.status(404).json({ error: "no first frame yet" });
    res.sendFile(f);
  });

  app.post("/api/swapdlg/retry", trap.guard((req, res) => again(req, res, false)));
  app.post("/api/swapdlg/upscale", trap.guard((req, res) => again(req, res, true)));

  app.post("/api/swapdlg/keep", trap.guard((req, res) => {
    const b = req.body || {};
    const st = current();
    const r = st.results.find((x) => x.id === String(b.id));
    if (!r || r.status !== "done") return res.status(404).json({ error: "no finished segment with that id" });
    const to = b.keep === false ? "temp" : "keep";
    if (r.where !== to) {
      const src = fileOf(r);
      const dir = SS.dirOf(pdir(), to);
      const name = SS.uniquify(dir, r.file);
      fs.renameSync(src, path.join(dir, name));
      r.where = to; r.file = name;
    }
    res.json(view(SS.save(pdir(), st)));
  }));

  app.post("/api/swapdlg/discard", trap.guard((req, res) => {
    const st = current();
    const r = st.results.find((x) => x.id === String((req.body || {}).id));
    if (!r) return res.status(404).json({ error: "no such result" });
    let moved = null;
    if (r.file && fs.existsSync(fileOf(r))) moved = recycleBin.recycle(fileOf(r)).name;
    st.results = st.results.filter((x) => x.id !== r.id);
    res.json({ ...view(SS.save(pdir(), st)), moved });
  }));

  app.post("/api/swapdlg/save", trap.guard((req, res) => {
    const st = current();
    const r = st.results.find((x) => x.id === String((req.body || {}).id));
    if (!r || r.status !== "done") return res.status(404).json({ error: "no finished segment with that id" });
    const dir = core.pDir("video");
    fs.mkdirSync(dir, { recursive: true });
    const name = SS.uniquify(dir, r.file);
    fs.copyFileSync(fileOf(r), path.join(dir, name));
    res.json({ ok: true, name, note: `${r.file} saved to the Video assets as ${name}` });
  }));

  app.post("/api/swapdlg/compile", trap.guard(async (req, res) => {
    const st = current();
    const list = SS.toCompile(st, (req.body || {}).ids);
    if (!list.length) return res.status(400).json({ error: "tick the kept segments (vidSwap) to join" });
    const files = list.map((r) => {
      const info = refSelect.probe(fileOf(r)) || {};
      return { path: fileOf(r), audio: !!info.audio, dur: info.duration || r.dur, w: info.width, h: info.height };
    });
    const w = files[0].w || 960, h = files[0].h || 544;
    // 2.330.0: a VR movie is joined only with segments of the same VR format
    const vrm = list[0].vr || "";
    if (list.some((r) => (r.vr || "") !== vrm))
      return res.status(400).json({ error: "those kept segments mix VR and flat (or two VR formats) - tick one kind" });
    const dir = core.pDir("video");
    fs.mkdirSync(dir, { recursive: true });
    const name = SS.uniquify(dir, SS.compileName(list[0].video || st.video, vrm));
    const dst = path.join(dir, name);
    const opts = { vr: !!vrm, codec: SS.codecArgs(w, h, hasX265()) };
    const code = await new Promise((resolve) => {
      let err = "";
      const p = spawn("ffmpeg", SS.compileArgs(files, dst, w, h, opts), { stdio: ["ignore", "ignore", "pipe"] });
      p.stderr.on("data", (d) => { err += d; });
      p.on("error", (e) => resolve({ code: -1, err: e.message }));
      p.on("close", (c) => resolve({ code: c, err }));
    });
    if (code.code !== 0) {
      try { fs.rmSync(dst, { force: true }); } catch { /* nothing written */ }
      return res.status(500).json({ error: "the join failed: " + String(code.err || "").trim().slice(-400) });
    }
    let tag = "";
    if (vrm) tag = await vrInject(dst, vrm);
    const ov = SS.overlaps(list);
    res.json({ ok: true, name, count: list.length, vr: vrm, tag,
               note: `${list.length} segment(s) joined -> ${name} (Video assets)`
                 + (ov.length ? ` - ⚠ ${ov.length} overlap(s): those frames play twice` : "") });
  }));

  // the loaded video's facts for the filmstrip (the file itself - unlike
  // /api/refvideo/select, a cut is NOT reopened on its source here)
  app.get("/api/swapdlg/info", (req, res) => {
    const name = path.basename(String(req.query.name || ""));
    const f = videoPath(name);
    if (!name || !fs.existsSync(f)) return res.status(404).json({ error: `${name || "the video"} is not in the Video assets` });
    const info = refSelect.probe(f);
    if (!info) return res.status(400).json({ error: `could not read ${name} (is ffprobe installed?)` });
    res.json({ name, ...info });
  });

  // ---- 2.330.0: LOADING BIG MOVIES. Tim: "the video dialog is not
  // loading movies, is there a maximum duration of movie that can be
  // uploaded?" - no duration limit anywhere; the dialog uploaded through
  // /api/passets (a 64 MB in-memory limit, and the refusal was not JSON,
  // so the dialog said nothing). Now: a file picked in the app's file
  // dialog is IMPORTED by path (hard link, else a streamed copy - any size),
  // and a dropped / browser-picked file streams to disk (no size limit).
  const VEXT = [".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v", ".mpg", ".mpeg", ".ts", ".wmv"];
  const isVideoName = (n) => VEXT.includes(path.extname(String(n || "")).toLowerCase());
  function freeName(n) {
    const safe = path.basename(String(n)).replace(/[^A-Za-z0-9._ -]+/g, "_") || "video.mp4";
    const dir = core.pDir("video");
    fs.mkdirSync(dir, { recursive: true });
    const ext = path.extname(safe), stem = path.basename(safe, ext);
    let name = safe;
    for (let k = 2; fs.existsSync(path.join(dir, name)); k++) name = `${stem} (${k})${ext}`;
    return name;
  }
  function setVideo(name) {
    const st = current();
    if (name !== st.video) st.segments = [];
    st.video = name;
    const info = refSelect.probe(videoPath(name)) || {};
    const d = SS.detectVr(name, info.width, info.height);
    vrForNew(st, d);
    return { ...view(SS.save(pdir(), st)), detected: d, info };
  }
  app.post("/api/swapdlg/import", trap.guard(async (req, res) => {
    if (!require("../lib/fileDialog").isLoopback(req))
      return res.status(403).json({ error: "importing by path works only on this computer - upload the file instead" });
    const src = path.resolve(String((req.body || {}).path || ""));
    let stt;
    try { stt = fs.statSync(src); } catch { return res.status(404).json({ error: `not found: ${src}` }); }
    if (!stt.isFile()) return res.status(400).json({ error: "that is a folder, not a video" });
    if (!isVideoName(src)) return res.status(400).json({ error: `${path.basename(src)} is not a video (${VEXT.join(" ")})` });
    const vdir = path.resolve(core.pDir("video"));
    if (path.dirname(src) === vdir) return res.json({ ...setVideo(path.basename(src)), how: "already in the Video assets" });
    const name = freeName(src);
    const dst = path.join(vdir, name);
    let how = "linked";
    try { fs.linkSync(src, dst); }
    catch { how = "copied"; await fs.promises.copyFile(src, dst); }
    res.json({ ...setVideo(name), how, note: `${path.basename(src)} ${how} into the Video assets as ${name}` });
  }));
  const bigUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _f, cb) => { try { const d = core.tempDir(); cb(null, d); } catch (e) { cb(e); } },
      filename: (_req, _f, cb) => cb(null, "upload_" + crypto.randomBytes(6).toString("hex")),
    }),
    limits: { files: 1 },
  });
  app.post("/api/swapdlg/upload", (req, res) => {
    bigUpload.single("file")(req, res, async (err) => {
      if (err) return res.status(400).json({ error: "the upload failed: " + (err.message || err) });
      const f = req.file;
      if (!f) return res.status(400).json({ error: "send the video as multipart field \"file\"" });
      if (!isVideoName(f.originalname)) { fs.rmSync(f.path, { force: true }); return res.status(400).json({ error: `${f.originalname} is not a video` }); }
      const name = freeName(f.originalname);
      try { fs.renameSync(f.path, videoPath(name)); }
      catch { await fs.promises.copyFile(f.path, videoPath(name)); fs.rmSync(f.path, { force: true }); }
      res.json({ ...setVideo(name), note: `${f.originalname} uploaded to the Video assets as ${name}` });
    });
  });

  // A movie the app's player cannot decode (H.265 / 8K VR in some builds)
  // gets a small H.264 PREVIEW copy - the swap itself always reads the
  // original. POST starts it (once), GET says where it is.
  const proxies = new Map();
  const proxyPath = (name) => path.join(SS.dirOf(pdir(), "temp"), "_proxy", path.basename(name, path.extname(name)) + ".mp4");
  app.post("/api/swapdlg/proxy", trap.guard((req, res) => {
    const name = path.basename(String((req.body || {}).name || ""));
    const src = videoPath(name), dst = proxyPath(name);
    if (!name || !fs.existsSync(src)) return res.status(404).json({ error: "no such video" });
    if (fs.existsSync(dst) && !proxies.has(dst)) return res.json({ status: "ready" });
    if (!proxies.has(dst)) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      const part = dst + ".part.mp4";
      const p = spawn("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-vf", "scale='min(1920,iw)':-2",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart", part], { stdio: "ignore" });
      proxies.set(dst, "building");
      p.on("close", (c) => {
        if (c === 0) { try { fs.renameSync(part, dst); } catch { /* next POST rebuilds */ } proxies.delete(dst); }
        else { proxies.set(dst, "failed"); try { fs.rmSync(part, { force: true }); } catch { /* none */ } }
      });
      p.on("error", () => proxies.set(dst, "failed"));
    }
    res.json({ status: proxies.get(dst) || "ready" });
  }));
  app.get("/api/swapdlg/proxy", (req, res) => {
    const name = path.basename(String(req.query.name || ""));
    const dst = proxyPath(name);
    const st = proxies.get(dst) || (fs.existsSync(dst) ? "ready" : "none");
    if (st === "ready" && req.query.file) return res.sendFile(dst);
    res.json({ status: st, url: st === "ready" ? "/api/swapdlg/proxy?file=1&name=" + encodeURIComponent(name) : "" });
  });

  // 2.330.0: what the virtual camera sees at time t (the left eye) - one JPEG
  app.get("/api/swapdlg/vrview", (req, res) => {
    const st = SS.load(pdir());
    const v = SS.vrParams({ ...st.vr, ...(req.query.mode ? { mode: req.query.mode } : {}) });
    if (!v) return res.status(400).json({ error: "VR is off" });
    if (!st.video || !fs.existsSync(videoPath(st.video))) return res.status(400).json({ error: "load a video first" });
    const aim = SS.vrSafe({ ...v, yaw: req.query.yaw ?? v.yaw, pitch: req.query.pitch ?? v.pitch,
                            fov: req.query.fov ?? v.fov, shape: req.query.shape ?? v.shape });
    const sz = SS.vrViewSize(384, aim.shape);
    const t = Math.max(0, +req.query.t || 0);
    const p = spawn("ffmpeg", ["-loglevel", "error", "-ss", t.toFixed(3), "-i", videoPath(st.video),
      "-vf", SS.vrFlatVf(aim.mode, "L", aim, sz.width, sz.height), "-frames:v", "1", "-f", "image2", "-c:v", "mjpeg",
      "-q:v", "4", "pipe:1"], { stdio: ["ignore", "pipe", "pipe"] });
    const chunks = [];
    let err = "";
    p.stdout.on("data", (d) => chunks.push(d));
    p.stderr.on("data", (d) => { err += d; });
    p.on("error", (e) => res.status(500).json({ error: e.message }));
    p.on("close", (c) => {
      if (c !== 0 || !chunks.length) return res.status(500).json({ error: "could not cut the view: " + err.slice(-300) });
      res.set("Content-Type", "image/jpeg");
      res.set("Cache-Control", "no-store");
      res.end(Buffer.concat(chunks));
    });
  });

  app.get("/api/swapdlg/file/:where/:name", (req, res) => {
    const where = req.params.where === "keep" ? "keep" : "temp";
    const f = path.join(SS.dirOf(pdir(), where), path.basename(req.params.name));
    if (!fs.existsSync(f)) return res.status(404).json({ error: "not found" });
    res.sendFile(f);
  });
}

module.exports = { mount };
