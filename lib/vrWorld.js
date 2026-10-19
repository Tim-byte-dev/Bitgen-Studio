"use strict";
/**
 * vrWorld.js — VR WORLD: a performer inside a 360 / 180 picture (2.368.0).
 *
 * Tim (verbatim): "is it possible for bitgen to create vr 3d sbs movies from reference pictures and audio
 * references- maybe using a 360 sbs picture as reference?" -> "lets try route 2. and add a wan2.1 style so we
 * can use wan as well, also wan2.2".
 *
 * The 🥽 VR World dialog (static/vrworld.js, the video docker's button) keeps ONE session per project in
 * projects/<p>/vrworld/ (session.json + the files it names):
 *   world       the still 360 / 180 picture (mono, TB, side-by-side 180 or 360)
 *   view        where the virtual camera looks (yaw / pitch / field of view / shape) - click the panorama
 *   pictures    the performer (1-3), sound (a song / a voice), prompt, engine, seconds, seed, lock
 *   first       ✎ First frame: the image-edit style (Qwen 2.1 edit) puts the performer INTO the view - the
 *               render starts on it, so the place stays the place
 * ▶ Render queues one mode "vrworld" job (vr_world_worker.py): the views, the performer (worker.py for
 * MiniMax H3, wan_worker.py for Wan), the eyes, back into the sphere.
 * Engines: h3 (MiniMax H3 first frame -> video, its own sound / speech), h3song (MMH3_NativeAudio_MV: the
 * performer lip-syncs the session's sound), or any Wan style id (the sound laid under the take).
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const MODES = {
  mono360: { stereo: "", proj: "e", suffix: "_360", label: "360° mono", span: 360 },
  tb360: { stereo: "tb", proj: "e", suffix: "_360_TB", label: "360° stereo (top-bottom)", span: 360 },
  sbs360: { stereo: "sbs", proj: "e", suffix: "_360_LR", label: "360° stereo (side by side)", span: 360 },
  sbs180: { stereo: "sbs", proj: "hequirect", suffix: "_180_LR", label: "180° stereo (side by side)", span: 180 },
};
const SHAPES = ["1:1", "3:4", "9:16", "4:3", "16:9"];
const IMAGE_EXT = [".png", ".jpg", ".jpeg", ".webp", ".bmp"];
const AUDIO_EXT = [".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac", ".opus"];
const MAX_PICS = 3;
const MAX_SECONDS = 15;
const SONG_STYLE = "MMH3_NativeAudio_MV";

const r3 = (x) => Math.round(x * 1000) / 1000;
const pyf = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));

function dirOf(projDir) {
  const d = path.join(projDir, "vrworld");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function blank() {
  return { world: "", world_name: "", vr_mode: "", sure: false, world_w: 0, world_h: 0,
           view: { yaw: 0, pitch: 0, fov: 70, shape: "1:1" }, short_side: 0,
           pictures: [], sound: "", sound_name: "", sound_start: 0,
           prompt: "", engine: "h3", seconds: 5, seed: -1, lock: false,
           first: "", first_job: "", first_status: "", first_error: "", last_job: "" };
}

function view(v) {
  const o = v && typeof v === "object" ? v : {};
  return { yaw: r3((((+o.yaw || 0) + 180) % 360 + 360) % 360 - 180),
           pitch: r3(Math.max(-85, Math.min(85, +o.pitch || 0))),
           fov: r3(Math.max(20, Math.min(140, +o.fov || 70))),
           shape: SHAPES.includes(o.shape) ? o.shape : "1:1" };
}

const base = (s) => path.basename(String(s || ""));

/** The stored session, normalised. */
function safe(s) {
  const o = blank();
  if (!s || typeof s !== "object") return o;
  o.world = base(s.world); o.world_name = String(s.world_name || "").slice(0, 200);
  o.vr_mode = Object.prototype.hasOwnProperty.call(MODES, s.vr_mode) ? s.vr_mode : "";
  o.sure = s.sure === true;
  o.world_w = Math.max(0, parseInt(s.world_w, 10) || 0); o.world_h = Math.max(0, parseInt(s.world_h, 10) || 0);
  o.view = view(s.view);
  o.short_side = Math.max(0, Math.min(1088, parseInt(s.short_side, 10) || 0));
  o.pictures = (Array.isArray(s.pictures) ? s.pictures : []).map(base).filter(Boolean).slice(0, MAX_PICS);
  o.sound = base(s.sound); o.sound_name = String(s.sound_name || "").slice(0, 200);
  o.sound_start = Math.max(0, r3(+s.sound_start || 0));
  o.prompt = String(s.prompt || "").slice(0, 4000);
  o.engine = String(s.engine || "h3").slice(0, 64) || "h3";
  o.seconds = Math.max(1, Math.min(MAX_SECONDS, r3(+s.seconds || 5)));
  o.seed = Number.isFinite(parseInt(s.seed, 10)) ? Math.max(-1, parseInt(s.seed, 10)) : -1;
  o.lock = s.lock === true;
  o.first = base(s.first);
  o.first_job = String(s.first_job || ""); o.first_status = ["", "running", "done", "failed"].includes(s.first_status) ? s.first_status : "";
  o.first_error = String(s.first_error || "").slice(0, 400);
  o.last_job = String(s.last_job || "");
  return o;
}

function load(dir) {
  try { return safe(JSON.parse(fs.readFileSync(path.join(dir, "session.json"), "utf8"))); } catch { return blank(); }
}
function save(dir, s) {
  const out = safe(s);
  fs.writeFileSync(path.join(dir, "session.json"), JSON.stringify(out, null, 1));
  return out;
}

/** The format a picture most likely is: (mode, sure). Mirrors scripts/vr_world.detect_mode. */
function detectMode(name, w, h) {
  const n = String(name || "").toLowerCase();
  const tok = (re) => re.test(n);
  const is180 = tok(/(^|[^a-z0-9])180([^0-9]|$)|vr180/), is360 = tok(/(^|[^a-z0-9])360([^0-9]|$)|vr360/);
  const tb = tok(/(^|[_\-. ])(tb|ou|3dv|top.?bottom|over.?under)([_\-. ]|$)/);
  const lr = tok(/(^|[_\-. ])(lr|sbs|3dh|side.?by.?side)([_\-. ]|$)/);
  w = +w || 0; h = +h || 0;
  if (is180 && (lr || !tb)) return { mode: "sbs180", sure: true };
  if (is360 && tb) return { mode: "tb360", sure: true };
  if (is360 && lr) return { mode: "sbs360", sure: true };
  if (lr && w && h && Math.abs(w - 4 * h) <= 8) return { mode: "sbs360", sure: true };
  if (tb && w && h && Math.abs(w - h) <= 4) return { mode: "tb360", sure: true };
  if (is360) return { mode: "mono360", sure: true };
  if (w && h && Math.abs(w - h) <= 4) return { mode: "tb360", sure: false };
  if (w && h && Math.abs(w - 4 * h) <= 8) return { mode: "sbs360", sure: false };
  if (w && h && Math.abs(w - 2 * h) <= 4) return { mode: "mono360", sure: false };
  return { mode: "", sure: false };
}

function eyeCrop(mode, eye) {
  const m = MODES[mode];
  if (!m || !m.stereo) return "";
  if (m.stereo === "tb") return eye === "L" ? "crop=iw:ih/2:0:0" : "crop=iw:ih/2:0:ih/2";
  return eye === "L" ? "crop=iw/2:ih:0:0" : "crop=iw/2:ih:iw/2:0";
}
function vfovOf(hfov, w, h) {
  const hf = Math.max(10, Math.min(150, +hfov));
  return (2 * Math.atan(Math.tan((hf * Math.PI / 180) / 2) * h / w)) * 180 / Math.PI;
}
/** The virtual camera's view of one eye: the exact filter scripts/vr_swap.flat_vf builds. */
function flatVf(mode, eye, v, w, h) {
  const m = MODES[mode];
  if (!m) return "";
  const a = view(v);
  const vf = `v360=input=${m.proj}:output=flat:yaw=${pyf(a.yaw)}:pitch=${pyf(a.pitch)}`
    + `:h_fov=${pyf(a.fov)}:v_fov=${vfovOf(a.fov, w, h).toFixed(4)}:w=${w}:h=${h}`;
  const c = eyeCrop(mode, eye);
  return c ? `${c},${vf}` : vf;
}
/** A click on the left eye's panorama (u, v in 0..1) -> the aim. */
function aimFromClick(mode, u, v) {
  const m = MODES[mode];
  if (!m) return null;
  return { yaw: r3((Math.max(0, Math.min(1, +u)) - 0.5) * m.span), pitch: r3((0.5 - Math.max(0, Math.min(1, +v))) * 180) };
}
/** The render size of the view - vr_swap.view_size. */
function viewSize(shortSide, shape) {
  const [a, b] = String(SHAPES.includes(shape) ? shape : "1:1").split(":").map(Number);
  const s = Math.max(128, parseInt(shortSide, 10) || 544);
  const q = (x) => Math.max(128, Math.round(x / 16) * 16);
  return a >= b ? { width: q(s * a / b), height: q(s) } : { width: q(s), height: q(s * b / a) };
}
/** The short side that matches the sphere's sharpness for this view (384..1088) - vr_world.view_short_side_for. */
function autoShortSide(mode, w, h, fov, shape) {
  const m = MODES[mode];
  if (!m || !w || !h) return 544;
  const ew = m.stereo === "sbs" ? w / 2 : w;
  const ppd = ew / m.span;
  const [a, b] = String(SHAPES.includes(shape) ? shape : "1:1").split(":").map(Number);
  const horiz = ppd * (+fov || 70);
  const short = a >= b ? horiz * b / a : horiz;
  return Math.max(384, Math.min(1088, Math.floor(short / 16) * 16));
}

/** (w, h) of a picture via ffprobe, or {0,0}. */
function probeSize(p) {
  const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                                  "-of", "csv=p=0", p], { encoding: "utf8" });
  const m = String(r.stdout || "").trim().match(/^(\d+),(\d+)/);
  return m ? { w: +m[1], h: +m[2] } : { w: 0, h: 0 };
}

/** ffmpeg -> a file; {ok} | {error}. */
function ff(args) {
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { encoding: "utf8", timeout: 120000 });
  if (r.error) return { error: r.error.code === "ENOENT" ? "ffmpeg is not installed (winget install Gyan.FFmpeg)" : r.error.message };
  if (r.status !== 0) return { error: String(r.stderr || "ffmpeg failed").trim().slice(-300) };
  return { ok: true };
}

/** The left eye's panorama as a small JPEG (the dialog's aiming map). */
function panoArgs(src, dst, mode, width) {
  const c = eyeCrop(mode, "L");
  return ["-i", src, "-vf", (c ? c + "," : "") + `scale=${width || 1024}:-2`, "-frames:v", "1", "-q:v", "4", dst];
}
/** The virtual camera's left view as a PNG at (w, h). */
function viewArgs(src, dst, mode, v, w, h) {
  return ["-i", src, "-vf", flatVf(mode, "L", v, w, h) + ",setsar=1", "-frames:v", "1", dst];
}

/** File a picture / sound into the session. slot: world | picture | sound | first. -> {session} | {error}. */
function put(dir, s0, slot, srcPath, original) {
  const s = safe(s0);
  const ext = path.extname(original || srcPath).toLowerCase();
  if (!fs.existsSync(srcPath)) return { error: "the file is not on disk" };
  if (["world", "picture", "first"].includes(slot) && !IMAGE_EXT.includes(ext))
    return { error: `${base(original)} is not a picture (${IMAGE_EXT.join(" ")})` };
  if (slot === "sound" && !AUDIO_EXT.includes(ext))
    return { error: `${base(original)} is not a sound (${AUDIO_EXT.join(" ")})` };
  const drop = (n) => { if (n) try { fs.unlinkSync(path.join(dir, n)); } catch {} };
  const stamp = Date.now().toString(36);
  if (slot === "world") {
    drop(s.world);
    const name = `world_${stamp}${ext}`;
    fs.copyFileSync(srcPath, path.join(dir, name));
    const sz = probeSize(path.join(dir, name));
    const d = detectMode(original, sz.w, sz.h);
    Object.assign(s, { world: name, world_name: base(original), world_w: sz.w, world_h: sz.h,
                       vr_mode: d.mode || "mono360", sure: d.sure });
    drop(s.first); s.first = ""; s.first_status = ""; s.first_error = "";       // a new place: the old frame is wrong
    for (const f of fs.readdirSync(dir)) if (/^(pano|view)_/.test(f)) drop(f);
    return { session: s, note: `${base(original)}: ${sz.w}x${sz.h}, ${d.mode ? MODES[d.mode].label : "?"}`
      + (d.sure ? " (from its name)" : " - check the type: the name does not say") };
  }
  if (slot === "picture") {
    if (s.pictures.length >= MAX_PICS) return { error: `the performer takes up to ${MAX_PICS} pictures - remove one first` };
    const name = `pic_${stamp}${ext}`;
    fs.copyFileSync(srcPath, path.join(dir, name));
    s.pictures.push(name);
    return { session: s };
  }
  if (slot === "sound") {
    drop(s.sound);
    const name = `sound_${stamp}${ext}`;
    fs.copyFileSync(srcPath, path.join(dir, name));
    s.sound = name; s.sound_name = base(original); s.sound_start = 0;
    return { session: s };
  }
  if (slot === "first") {
    drop(s.first);
    const name = `first_${stamp}${ext}`;
    fs.copyFileSync(srcPath, path.join(dir, name));
    s.first = name; s.first_status = "done"; s.first_error = "";
    return { session: s };
  }
  return { error: "slot must be world, picture, sound or first" };
}

function clear(dir, s0, slot, index) {
  const s = safe(s0);
  const drop = (n) => { if (n) try { fs.unlinkSync(path.join(dir, n)); } catch {} };
  if (slot === "picture") {
    const i = parseInt(index, 10);
    if (!(i >= 0 && i < s.pictures.length)) return { error: "no such picture" };
    drop(s.pictures[i]); s.pictures.splice(i, 1);
  } else if (slot === "sound") { drop(s.sound); s.sound = ""; s.sound_name = ""; s.sound_start = 0; }
  else if (slot === "first") { drop(s.first); s.first = ""; s.first_status = ""; s.first_error = ""; s.first_job = ""; }
  else if (slot === "world") {
    drop(s.world); drop(s.first);
    Object.assign(s, { world: "", world_name: "", world_w: 0, world_h: 0, vr_mode: "", sure: false, first: "", first_status: "" });
  } else return { error: "slot must be world, picture, sound or first" };
  return { session: s };
}

/** Apply the dialog's fields. */
function set(s0, b) {
  const s = safe(s0);
  const x = b || {};
  if (x.view) s.view = view({ ...s.view, ...x.view });
  if (x.vr_mode != null && MODES[x.vr_mode]) { s.vr_mode = x.vr_mode; s.sure = true; }
  for (const k of ["short_side", "sound_start", "prompt", "engine", "seconds", "seed"]) if (x[k] != null) s[k] = x[k];
  if (x.lock != null) s.lock = x.lock === true || x.lock === "true";
  return safe(s);
}

/** The engines the dialog offers: H3, H3 + the sound lip-synced, every Wan style. */
function engines(videoStyles) {
  const wan = require("./wan");
  const out = [{ id: "h3", label: "MiniMax H3 (first frame -> video, its own sound)" },
               { id: "h3song", label: "MiniMax H3 + the sound lip-synced (MMH3_NativeAudio_MV)" }];
  for (const st of videoStyles || []) if (wan.isWanStyle(st)) out.push({ id: st.id, label: `${st.name} (the sound laid under it)`, wan: true });
  return out;
}

/** What is missing before ▶ Render, in words ("" = ready). */
function notReady(s, dir) {
  if (!s.world || !fs.existsSync(path.join(dir, s.world))) return "load a 360 / 180 picture first (🌐 World)";
  if (!MODES[s.vr_mode]) return "pick the picture's VR type";
  if (s.engine === "h3song" && !s.sound) return "H3 + lip-sync needs a sound (♪)";
  if (!String(s.prompt || "").trim() && !s.first) return "describe the performer (or make a ✎ first frame)";
  return "";
}

/**
 * The vrworld job params, or {error}. o = { session, dir, style (a Wan style or the song style), grid (17k5 | 4n1) }.
 */
function jobParams(o) {
  const s = safe(o.session);
  const dir = o.dir;
  const why = notReady(s, dir);
  if (why) return { error: why };
  const size = viewSize(s.short_side || autoShortSide(s.vr_mode, s.world_w, s.world_h, s.view.fov, s.view.shape), s.view.shape);
  const soundPath = s.sound ? path.join(dir, s.sound) : null;
  const firstPath = s.first ? path.join(dir, s.first) : "";
  let render;
  if (s.engine === "h3" || s.engine === "h3song") {
    const fp = require("./framePlan");
    const grid = o.grid || "17k5";
    const G = fp.GRIDS[grid];
    const frames = Math.min(G.ceiling, G.up(Math.round(s.seconds * 24)));
    const plan = fp.planChunks(frames, G.ceiling, grid, false, G.ceiling);
    let prompt = String(s.prompt || "");
    const audioNames = s.sound && s.engine === "h3song" ? [s.sound_name || s.sound] : [];
    try { prompt = require("./voiceStyle").formatSpeech(prompt, { audioNames }).text; } catch { /* plain */ }
    render = {
      mode: "fl2va", prompt, width: size.width, height: size.height, frames,
      steps: 0, cfg: 1, seed: s.seed, format: "mp4", speed: "quality", segment_frames: G.ceiling,
      pipeline: "single", requested_pipeline: "single", plan, trim_exact: true, force_chunks: false, extra_args: "",
      reference_files: [], reference_names: [], ref_videos: [],
      ref_audios: s.engine === "h3song" && soundPath ? [soundPath] : [],
      ...(s.engine === "h3song" ? { audio_start: s.sound_start, audio_dur: s.seconds } : {}),
      video_style: s.engine === "h3song" ? (o.style || null) : null,
      video_style_id: s.engine === "h3song" && o.style ? o.style.id : null,
      video_style_name: s.engine === "h3song" && o.style ? o.style.name : null,
    };
    if (s.engine === "h3song" && !o.style)
      return { error: `the ${SONG_STYLE} video style is missing - restore it (Settings -> Video styles) or pick MiniMax H3` };
  } else {
    const wan = require("./wan");
    if (!wan.isWanStyle(o.style)) return { error: "that engine's Wan style no longer exists - pick another engine" };
    // the start picture is filled by the worker (the ✎ first frame, else the view it cuts)
    render = wan.jobParams({ style: o.style, wanMode: "i2v", prompt: s.prompt,
      audio: soundPath ? { path: soundPath, start: s.sound_start } : null,
      seconds: Math.min(wan.MAX_SECONDS, s.seconds), width: size.width, height: size.height, seed: s.seed });
    if (render.error) return { error: render.error };
  }
  return {
    mode: "vrworld",
    world: path.join(dir, s.world), world_name: s.world_name, vr_mode: s.vr_mode, view: s.view,
    short_side: Math.min(size.width, size.height), lock: s.lock,
    first_frame: firstPath && fs.existsSync(firstPath) ? firstPath : "",
    render, seconds: s.seconds, format: "mp4",
  };
}

/** A human line for the queue / the reply. */
function summary(p, engineLabel) {
  const m = MODES[p.vr_mode] || {};
  const v = p.view || {};
  return [`VR World ${m.label || p.vr_mode}`, `aim ${v.yaw}° / ${v.pitch}°, ${v.fov}° ${v.shape}`,
          `${p.render.width}x${p.render.height}`, `${p.seconds}s`, engineLabel || p.render.mode,
          p.first_frame ? "from the ✎ first frame" : "from the empty view", p.lock ? "background locked" : ""]
    .filter(Boolean).join(" · ");
}

/** The ✎ First frame edit: {images, prompt, roles} via lib/sceneEdit.plan (the view is the location). */
function firstPlan(viewPng, picturePaths, text) {
  const sceneEdit = require("./sceneEdit");
  return sceneEdit.plan({ base: "location", locationPath: viewPng,
    chars: picturePaths.map((p, i) => ({ name: picturePaths.length > 1 ? `performer ${i + 1}` : "the performer", path: p })),
    text: String(text || "") + (text ? " " : "") + "Keep the camera exactly where it is; the place must not change." });
}

/** A finished ✎ job -> the session's first frame (mutates; true when anything changed). */
function harvest(dir, s, jobs, outputPath) {
  if (!s.first_job) return false;
  const job = jobs.get(s.first_job);
  if (job && !job.finished) { if (s.first_status !== "running") { s.first_status = "running"; return true; } return false; }
  const src = job && job.status === "done" && job.output ? outputPath(job.output) : null;
  if (src && fs.existsSync(src)) {
    const r = put(dir, s, "first", src, src);
    if (r.session) Object.assign(s, r.session);
    else { s.first_status = "failed"; s.first_error = r.error; }
  } else {
    s.first_status = "failed";
    s.first_error = job ? (job.log || []).filter((l) => /error|failed/i.test(l)).slice(-1)[0] || "the edit failed"
      : "the job vanished (server restarted?)";
  }
  s.first_job = "";
  return true;
}

module.exports = { MODES, SHAPES, MAX_PICS, MAX_SECONDS, SONG_STYLE, dirOf, blank, safe, load, save, view,
                   detectMode, flatVf, aimFromClick, viewSize, autoShortSide, probeSize, ff, panoArgs, viewArgs,
                   put, clear, set, engines, notReady, jobParams, summary, firstPlan, harvest };
