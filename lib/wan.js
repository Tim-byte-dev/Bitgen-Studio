"use strict";
/**
 * wan.js — WAN 2.1 / WAN 2.2 VIDEO STYLES (2.368.0).
 *
 * Tim (verbatim): "add a wan2.1 style so we can use wan as well, also wan2.2".
 *
 * A video style whose arch is "wan21" or "wan22" (the starters "Wan 2.1" / "Wan 2.2") renders through
 * wan_worker.py (mode "wan"): the graph is built from ComfyUI's core Wan nodes (scripts/wan_graph.py) and the
 * model files are picked from what ComfyUI lists, so one style serves every mode. The app's modes map:
 *   t2va  -> t2v    text only
 *   ref2va-> ref    the first picture is the character (VACE); no VACE file = it starts the clip (i2v)
 *   fl2va -> i2v    one picture = the first frame;  flf2v with a second = the last frame
 * Wan makes no sound: the reference dock's first sound (from its start) is laid under the take. Wan renders
 * 16 fps; the worker interpolates to the app's 24.
 * POST /api/generate hands a Wan style here (fromGenerate) - the prompt docker needs no change.
 */
const path = require("path");
const fs = require("fs");

const ARCHS = { wan21: "Wan 2.1", wan22: "Wan 2.2" };
const FPS = 16;
const MAX_SECONDS = 10;
const IMAGE_EXT = [".png", ".jpg", ".jpeg", ".webp", ".bmp"];

const isWanStyle = (st) => !!st && st.kind === "video" && Object.prototype.hasOwnProperty.call(ARCHS, String(st.arch || ""));
const familyOf = (st) => (isWanStyle(st) ? String(st.arch) : null);

/** Wan's frame count (4k+1 at 16 fps) for a length in seconds. */
function framesFor(seconds) {
  const s = Math.max(0.3, Math.min(MAX_SECONDS, +seconds || 5));
  let n = Math.round(s * FPS) + 1;
  n = Math.max(5, Math.min(161, n));
  return n - ((n - 1) % 4);
}

/** 16-px aligned, 256..1920. */
function size(w, h) {
  const r = (v, d) => Math.max(256, Math.min(1920, Math.round((parseInt(v, 10) || d) / 16) * 16));
  return { width: r(w, 1280), height: r(h, 720) };
}

/** The app's mode + pictures -> Wan's mode. */
function wanMode(appMode, nImages) {
  if (appMode === "fl2va") return nImages >= 2 ? "flf2v" : nImages === 1 ? "i2v" : "t2v";
  if (appMode === "ref2va") return nImages >= 1 ? "ref" : "t2v";
  return "t2v";
}

/** H3's dialogue markup -> plain words for Wan (it would read the tags as text to draw). */
function plainPrompt(p) {
  return String(p || "")
    .replace(/<d>\s*(\[[A-Za-z]+\]\s*)?/gi, "\"").replace(/<\/d>/gi, "\"")
    .replace(/,?\s*in the timbre of <Audio \d+>,?/gi, ",")
    .replace(/<(Subject|Picture|Audio|Video)\s*(\d+)>/gi, (_m, k, n) => `${k.toLowerCase()} ${n}`)
    .replace(/\s+,/g, ",").replace(/\s{2,}/g, " ").trim();
}

/**
 * The job params, or {error}. o = { style, appMode (t2va|ref2va|fl2va) | wanMode, prompt, negative,
 * images:[abs], audio:{path, start}|null, seconds, width, height, seed, steps, cfg, output_name? }
 */
function jobParams(o) {
  const x = o || {};
  const st = x.style;
  if (!isWanStyle(st)) return { error: "not a Wan style" };
  const images = (x.images || []).filter(Boolean).slice(0, 2);
  for (const p of images) {
    if (!IMAGE_EXT.includes(path.extname(p).toLowerCase())) return { error: `${path.basename(p)} is not a picture` };
    if (!fs.existsSync(p)) return { error: `the picture is gone: ${path.basename(p)}` };
  }
  const mode = x.wanMode || wanMode(x.appMode, images.length);
  // 2.387.0: ati = a start picture + the path layers' drawn tracks (Wan 2.1 ATI) - tracks in the video's pixels
  let tracks;
  if (mode === "ati") {
    if (familyOf(st) !== "wan21") return { error: "Wan ATI (paths) is a Wan 2.1 model - pick a Wan 2.1 style" };
    if (!images.length) return { error: "Wan ATI needs a start picture" };
    tracks = (Array.isArray(x.tracks) ? x.tracks : []).slice(0, 16).map((t) => (Array.isArray(t) ? t : [])
      .filter((p) => p && Number.isFinite(+p.x) && Number.isFinite(+p.y)).slice(0, 2000)
      .map((p) => ({ x: Math.round(+p.x * 100) / 100, y: Math.round(+p.y * 100) / 100 }))).filter((t) => t.length >= 2);
    if (!tracks.length) return { error: "draw a path first (at least two points)" };
  }
  const pics = mode === "i2v" || mode === "ati" ? { start: images[0] }
    : mode === "flf2v" ? { start: images[0], end: images[1] }
    : mode === "ref" ? { ref: images[0] } : {};
  const audio = x.audio && x.audio.path && fs.existsSync(x.audio.path)
    ? { path: x.audio.path, start: Math.max(0, +x.audio.start || 0) } : null;
  const seconds = Math.max(0.3, Math.min(MAX_SECONDS, +x.seconds || 5));
  const sz = size(x.width, x.height);
  const seed = parseInt(x.seed, 10);
  const steps = parseInt(x.steps, 10);
  const cfg = parseFloat(x.cfg);
  return {
    mode: "wan", wan_family: familyOf(st), wan_mode: mode,
    prompt: plainPrompt(x.prompt).slice(0, 8000),
    negative: String(x.negative || st.negative || "").slice(0, 2000),
    images: pics, audio, seconds, frames: framesFor(seconds),
    ...(tracks ? { tracks } : {}),
    ...(cameraOf(x.camera) ? { camera: cameraOf(x.camera) } : {}),       // 2.399.0: the timeline's camera path
    width: sz.width, height: sz.height,
    seed: Number.isFinite(seed) ? seed : -1,
    // 0 / unset = the family's (or the fast LoRA's); H3's cfg 1 default is not Wan's
    steps: Number.isFinite(steps) && steps > 0 ? steps : 0,
    // 2.409.0: Basic Settings' Override style sends its cfg exactly (1 included - the fast LoRAs want 1)
    cfg: Number.isFinite(cfg) && (cfg > 1 || (x.cfgExact && cfg > 0)) ? cfg : 0,
    interpolate: x.interpolate !== false,
    format: "mp4",
    video_style: st, video_style_id: st.id || null, video_style_name: st.name || ARCHS[familyOf(st)],
    ...(x.output_name ? { output_name: String(x.output_name) } : {}),
  };
}

/** 2.399.0: the timeline's camera for a Wan job (lib/camPlan.forWan) made safe: {pose, speed, approx, exact, depth}
 *  - wan_worker.py renders the Fun Camera move when ComfyUI has a Fun Camera model, the depth guide through VACE when
 *  exact and it has a VACE model, else the words (already in the prompt) carry it */
const WAN_POSES = ["Static", "Pan Up", "Pan Down", "Pan Left", "Pan Right", "Zoom In", "Zoom Out", "Anti Clockwise (ACW)", "ClockWise (CW)"];
function cameraOf(c) {
  if (!c || typeof c !== "object") return null;
  const pose = WAN_POSES.includes(c.pose) ? c.pose : "Static";
  const speed = Math.max(0.1, Math.min(10, +c.speed || 1));
  const depth = c.depth && fs.existsSync(String(c.depth)) ? String(c.depth) : "";
  return { pose, speed, approx: !!c.approx, exact: !!c.exact && !!depth, depth };
}

/** A human line for the queue / the reply. */
function summary(p) {
  const fam = ARCHS[p.wan_family] || "Wan";
  const what = { t2v: "text", i2v: "from a first frame", flf2v: "first + last frame", ref: "character reference (VACE)",
                 ati: `along ${(p.tracks || []).length} drawn path(s) (ATI)` }[p.wan_mode] || p.wan_mode;
  const bits = [`${fam} ${what}`, `${p.seconds}s (${p.frames} frames at ${FPS} fps -> 24)`, `${p.width}x${p.height}`];
  if (p.audio) bits.push(`sound ${path.basename(p.audio.path)} from ${p.audio.start}s`);
  if (p.camera) bits.push(`camera ${p.camera.exact ? "the exact path (VACE depth guide, else " + p.camera.pose + ")" : p.camera.pose}`);
  return bits.join(" · ");
}

/**
 * /api/generate with a Wan style: the request's own fields -> a Wan job. o = { style, mode, prompt, files:[abs],
 * refAudios:[abs], frames (24 fps), width, height, seed, steps, cfg }. -> params or {error}.
 */
function fromGenerate(o) {
  const x = o || {};
  return jobParams({
    style: x.style, appMode: x.mode, prompt: x.prompt, images: x.files || [],
    audio: (x.refAudios || [])[0] ? { path: x.refAudios[0], start: 0 } : null,
    seconds: (parseInt(x.frames, 10) || 120) / 24, width: x.width, height: x.height,
    seed: x.seed, steps: x.steps, cfg: x.cfg, cfgExact: x.cfgExact, camera: x.camera,
    negative: x.negative || undefined,                     // 2.419.0: ⊖ the negative docker (empty = the style's)
  });
}

module.exports = { ARCHS, FPS, MAX_SECONDS, isWanStyle, familyOf, framesFor, size, wanMode, plainPrompt,
                   jobParams, summary, fromGenerate, cameraOf, WAN_POSES };
