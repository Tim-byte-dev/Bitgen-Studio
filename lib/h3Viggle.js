"use strict";
/**
 * h3Viggle.js — THE H3_Viggle VIDEO STYLE, THE APP SIDE (2.352.0).
 *
 * Tim: "I have looks at the h3ref workflow, we should have a fl2va workflow
 * too, can we incorporate viggle into these worklows but make it a new viggle
 * workflow?" - answered "New 'H3_Viggle' style".
 *
 * A scene rendered the Viggle-Animate way through ComfyUI: its MOTION VIDEO
 * drives the movement, a picture says WHO performs it -
 *   ref2va  comfy_workflows/H3_Viggle_ref2va.json  the character sheet / picture
 *   fl2va   comfy_workflows/H3_Viggle_fl2va.json   the scene's first frame
 * worker.py fills either graph with scripts/h3viggle.py (the motion clip cut
 * per chunk at the render size, the picture, the Viggle sigmas, the LoRAs).
 *
 * Ways in:
 *   the prompt docker  POST /api/generate with the H3_Viggle style: ref2va =
 *                      the first reference picture, fl2va = the first frame;
 *                      the reference dock's first VIDEO is the motion
 *                      (generateError refuses what cannot render, in words)
 *   the scene board    the Video docker's Workflow "H3_Viggle" (scenes.style
 *                      = FLOW): routes/characters.js queueScene -> queue()
 *                      here. Each scene has a 🎬 Motion video (row.motion, in
 *                      projects/<p>/scene_refs/<scene id>/, routes/h3Viggle.js)
 *                      and its type picks the variant: Ref = ref2va with the
 *                      first cast sheet (or the scene's first picture), First
 *                      / Cont / Trans = fl2va with its First picture or the
 *                      frame it continues from.
 */
const fs = require("fs");
const path = require("path");
const core = require("./core");

const FLOW = "H3_Viggle";
const STYLE_NAME = "H3_Viggle";
const WORKFLOWS = { ref2va: "comfy_workflows/H3_Viggle_ref2va.json", fl2va: "comfy_workflows/H3_Viggle_fl2va.json" };
const FPS = 24;
const CEILING = 362;                         // H3's single run (15 s)
const STEPS = 3;                             // Viggle's DMD schedule (not the H3 ⚙ steps)
const VIDEO_RE = /\.(mp4|webm|mov|mkv|avi|m4v|gif)$/i;

const isViggleFlow = (name) => String(name || "") === FLOW;
function isViggleStyle(st) {
  if (!st || st.kind !== "video") return false;
  if (st.name === STYLE_NAME) return true;
  const wf = [st.workflow, ...Object.values(st.workflows || {})].map((x) => path.basename(String(x || "")));
  return wf.some((x) => /^H3_Viggle_(ref2va|fl2va)\.json$/.test(x));
}

/** The starter's shape (lib/styles.js STARTER_STYLES seeds it by name). */
const STARTER = { name: STYLE_NAME, kind: "video", arch: "minimax-h3", workflows: { ...WORKFLOWS } };

/** /api/generate: why an H3_Viggle render cannot run, or "". */
function generateError(style, mode, refVideos, pictures) {
  if (!isViggleStyle(style)) return "";
  if (mode === "t2va")
    return `"${style.name}" renders a picture performing a motion video - pick ref2va (the character sheet / picture `
      + "performs it) or fl2va (the first frame performs it)";
  if (!(refVideos || []).length)
    return `"${style.name}" needs a motion video - add the clip whose movement the character performs to the `
      + "reference dock (its first video is the motion)";
  if (!pictures)
    return `"${style.name}" needs a picture - ${mode === "fl2va" ? "the first frame" : "the character sheet / picture"} `
      + "that performs the motion";
  return "";
}

// ---- the scene's 🎬 motion video (row.motion) ------------------------------
function sceneDir(project, row) {
  const id = String((row && row.id) || "").replace(/[^\w-]/g, "_").slice(0, 64) || "scene";
  return path.join(core.projDir(project || core.getProject()), "scene_refs", id);
}
/** {file (abs), name, label} or null. */
function motionFor(project, row) {
  const m = row && row.motion;
  if (!m || !m.file) return null;
  const d = sceneDir(project, row);
  const p = path.join(d, path.basename(String(m.file)));
  return path.dirname(p) === d && fs.existsSync(p) ? { file: p, name: path.basename(p), label: m.label || m.file } : null;
}
function clearMotion(project, row) {
  const cur = motionFor(project, row);
  if (cur) try { fs.unlinkSync(cur.file); } catch {}
  const had = !!(row && row.motion);
  if (row) row.motion = undefined;
  return had;
}
/** Copy `src` in as the scene's motion video (replacing one). -> {ok, file} | {ok:false, error}. */
function setMotion(project, row, src, label) {
  if (!row) return { ok: false, error: "no such scene" };
  if (!src || !fs.existsSync(src)) return { ok: false, error: "the video is not on disk" };
  const ext = (path.extname(String(label || src)) || path.extname(src) || ".mp4").toLowerCase();
  if (!VIDEO_RE.test("x" + ext) && !VIDEO_RE.test(src)) return { ok: false, error: "that is not a video" };
  const d = sceneDir(project, row);
  fs.mkdirSync(d, { recursive: true });
  clearMotion(project, row);
  const file = "motion" + (VIDEO_RE.test("x" + ext) ? ext : path.extname(src).toLowerCase());
  fs.copyFileSync(src, path.join(d, file));
  row.motion = { file, label: String(label || path.basename(src)).slice(0, 80) };
  return { ok: true, file };
}

/** Seconds of a video (0 when ffprobe cannot tell). */
function seconds(file) {
  try {
    const out = require("child_process").execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration",
      "-of", "csv=p=0", file], { encoding: "utf8", timeout: 30000 });
    const s = parseFloat(out);
    return Number.isFinite(s) ? s : 0;
  } catch { return 0; }
}

/**
 * The job params for scene row r, or {error}. d = {
 *   r, style, motion {file, label}|null, sheet {file, label}|null (the first
 *   cast sheet), picture {file, label}|null (the scene's first picture),
 *   first {file, label}|null (its First slot), cont {file, label}|null (the
 *   frame it continues from), secs (the motion's length, s), win {start, dur}
 *   (the board song's window) | null, width, height, plan (framePlan.planChunks) }
 * -> {params, note} | {error}.
 */
function plan(d) {
  const r = d.r;
  if (!d.motion) return { error: `scene ${r.n} has no motion video - 🎬 Motion on the scene card: the clip whose `
    + "movement the character performs (H3_Viggle)" };
  const anchor = String(r.anchor || "reference");
  const wantsFirst = ["first", "continue", "transition", "last"].includes(anchor);
  const opening = d.first || d.cont || null;
  const who = d.sheet || d.picture || null;
  let mode, pic, why;
  if (wantsFirst && opening) { mode = "fl2va"; pic = opening; why = d.first ? "its First picture" : d.cont.label || "the frame it continues from"; }
  else if (who) { mode = "ref2va"; pic = who; why = d.sheet ? `the sheet ${d.sheet.label}` : `the scene picture ${d.picture.label}`; }
  else if (opening) { mode = "fl2va"; pic = opening; why = d.first ? "its First picture" : "the frame it continues from"; }
  else return { error: `scene ${r.n} has no one to perform the motion - a cast sheet, a scene picture, or (First / Cont) `
    + "a first frame" };
  // the length: the song's window, else the row's own, else the motion clip (at most 15 s)
  let secs = d.win && d.win.dur > 0 ? d.win.dur : (Number.isFinite(r.length) && r.length > 0 ? r.length / FPS : (d.secs || 5));
  const notes = [];
  if (d.secs && secs > d.secs + 0.05) notes.push(`the motion video is ${Math.round(d.secs * 10) / 10}s - its last frame is held to ${Math.round(secs * 10) / 10}s`);
  const frames = Math.max(5, Math.round(secs * FPS));
  const params = {
    mode, prompt: (r.prompt || []).filter(Boolean).join("\n") || `scene ${r.n}`,
    video_style: d.style, video_style_id: (d.style && d.style.id) || null, video_style_name: (d.style && d.style.name) || STYLE_NAME,
    width: d.width, height: d.height, frames, steps: 0, cfg: 1, seed: r.seed === "" || r.seed === undefined ? -1 : parseInt(r.seed, 10),
    viggle: true, viggle_steps: STEPS,
    format: "mp4", speed: "quality", segment_frames: CEILING, raw_master: true, upscale: false, upscale_workflow: "",
    pipeline: frames > CEILING ? "chunked" : "single", requested_pipeline: "auto", plan: d.plan, trim_exact: true,
    force_chunks: false, extra_args: "",
    reference_files: [pic.file], reference_names: [path.basename(pic.file)],
    ref_videos: [d.motion.file], ref_audios: [],
    scene: { n: r.n, chapter: r.chapter, upscale: false, viggle: true },
  };
  return { params, note: `scene ${r.n}: H3_Viggle ${mode} - ${why} performs the motion video ${d.motion.label}, `
    + `${frames} frames (${Math.round(frames / FPS * 10) / 10}s) at ${d.width}x${d.height}` + (notes.length ? "; " + notes.join("; ") : "") };
}

/** One board scene through H3_Viggle: {job, notes} | {status, error}. The
 *  caller (routes/characters.js queueScene) has checked the row is idle. */
function queue(project, st, r) {
  const styles = require("./styles");
  const chars = require("./characters");
  const scenes = require("./scenes");
  const sceneRefs = require("./sceneRefs");
  const sceneFrames = require("./sceneFrames");
  const sceneTimeline = require("./sceneTimeline");
  const renderSettings = require("./renderSettings");
  const framePlan = require("./framePlan");
  const all = styles.read(core.STYLES_DIR, "video").filter(isViggleStyle);
  const rsRec = renderSettings.read(core.projDir(project || core.getProject()));
  const style = all.find((x) => x.id === (rsRec || {}).video_style_id) || all.find((x) => x.name === STYLE_NAME) || all[0]
    || { ...STARTER };
  for (const rel of Object.values(style.workflows || {}).filter(Boolean))
    if (!fs.existsSync(path.resolve(core.BASE, rel)))
      return { status: 400, error: `${rel} is missing - unzip the full package at the install root` };
  const d0 = core.getConfig().defaults || {};
  const rs = renderSettings.jobOverrides(rsRec, { width: d0.width, height: d0.height, style });
  let sheet = null;
  for (const c of chars.cast(project) || []) {
    const pick = chars.referenceImage(c, project);
    if (pick) { sheet = { file: path.join(chars.charDir(c.name, project), pick), label: `${c.name} (${pick})` }; break; }
  }
  const sp = ((sceneRefs.forRender(project, r) || {}).refs || [])[0];
  const first = sceneRefs.slotFor(project, r, "first");
  const needCont = !first && ["first", "continue", "transition", "last"].includes(String(r.anchor || ""));
  const cont = needCont ? sceneFrames.contFrame(project, st, r) : null;
  const motion = motionFor(project, r);
  let win = null;
  if (st.audio) { const w0 = sceneTimeline.windowFor(st, r.n); if (w0.dur) win = { start: w0.start || 0, dur: w0.dur }; }
  const secs = motion ? seconds(motion.file) : 0;
  const w = Math.round((rs.width || 864) / 32) * 32, h = Math.round((rs.height || 480) / 32) * 32;
  const pre = plan({ r, style: rs.video_style || style, motion, sheet, picture: sp ? { file: sp.file, label: sp.label || sp.name } : null,
                     first: first ? { file: first.file, label: first.label } : null, cont, secs, win, width: w, height: h, plan: null });
  if (pre.error) return { status: 400, error: pre.error };
  const grid = framePlan.gridFor("comfy");
  pre.params.plan = framePlan.planChunks(pre.params.frames, CEILING, grid, false, CEILING);
  const job = core.makeJob(pre.params);
  job.chunk = { i: 0, n: pre.params.plan.chunks.length };
  scenes.save(scenes.starting(st, r.n, job.id).state, project);
  return { job, notes: [pre.note, ...(rs.notes || []).filter((x) => !/^steps /.test(x))] };
}

const STYLE_NOTE = "H3_Viggle - ▶ renders each scene the Viggle-Animate way through ComfyUI: its 🎬 Motion video "
  + "drives the movement; Ref scenes are performed by the first cast sheet (ref2va), First / Cont / Trans by the "
  + "frame they start on (fl2va)";

module.exports = { FLOW, STYLE_NAME, WORKFLOWS, STARTER, STEPS, CEILING, VIDEO_RE, STYLE_NOTE, isViggleFlow, isViggleStyle,
                   generateError, sceneDir, motionFor, setMotion, clearMotion, seconds, plan, queue };
