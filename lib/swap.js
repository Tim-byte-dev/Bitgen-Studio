// bitGen Studio — CHARACTER SWAP (2.324.0): what a swap job carries.
//
// Tim (verbatim): "can we use this workflow to add another functionality to
// bitgen studio. to load a reference video and change the character in the
// reference video with a character from a reference image. this should be
// able to work from a video prompt or from a scene (we add the reference
// image to a rendered scene) and run this workflow. and from the video
// prompt in prompt docker we use the reference image and reference video
// loaded". Answers: keep the ORIGINAL audio · a START + DURATION window,
// one run (the single-run ceiling) · the scene's picture is a cast sheet or
// a dropped picture · the prompt is the workflow's template + the user's
// text.
//
// TWO WAYS IN, ONE JOB (mode "swap", swap_worker.py):
//   the prompt docker  Basic Settings' Swap mode: the reference dock's
//                      first picture + first video (POST /api/swap)
//   a rendered scene   ⇄ on the take bar: the scene's take + a cast sheet
//                      or a dropped picture (POST /api/scenes/:n/swap); the
//                      result is the scene's NEXT take (scene_<n>_<x>)
// The worker cuts the window, renders comfy_workflows/MiniMax_H3_Swap.json
// (Tim's minimax-h3-swap export) and puts the original audio back.
"use strict";
const fs = require("fs");
const path = require("path");

const WORKFLOW = "MiniMax_H3_Swap.json";
/* 2.328.0 (Tim: "is there a style for this workflow, if not can you make one
   mmh3_chr_swap"): the swap has its own VIDEO STYLE, seeded as a starter
   (lib/styles.js) - styles/video/mmh3_chr_swap.json. It names the workflow
   and carries the usual overrides (model / te / vae / LoRAs / load
   precision / accelerators), which swap_worker.py writes into the graph with
   worker.py's own apply_video_style / apply_video_accel. */
const STYLE_NAME = "mmh3_chr_swap";
const VIDEO_EXT = [".mp4", ".webm", ".mov", ".mkv", ".avi", ".gif", ".m4v"];
const IMAGE_EXT = [".png", ".jpg", ".jpeg", ".webp", ".bmp"];
const MAX_TEXT = 1500;
const CEILING = 362;
/* 2.336.0: the swap QUALITY (scripts/swap_graph.QUALITIES does the graph):
   fast = the export's turbo LoRA at 4 steps; full = turbo off, 20 steps,
   beta (ComfyUI's own H3 reference template); best = turbo off, 28 steps
   (the swap LoRA's own test renders). */
const QUALITIES = [
  { id: "fast", label: "Fast (turbo, 4 steps)" },
  { id: "full", label: "Full (20 steps)" },
  { id: "best", label: "Best (28 steps)" },
];
const DEFAULT_QUALITY = "full";
const qualityOf = (q) => (QUALITIES.some((x) => x.id === q) ? q : DEFAULT_QUALITY);          // framePlan.MAX_SINGLE_RUN_COMFY (17*21+5)

/** The workflow's own swap instructions, from Tim's export - with H3's REAL
 *  picture tag. 2.334.0 (Tim: "the character swap worked for the first 2
 *  seconds of a video, then it wouldn't work at all ... it seems to not be
 *  using the reference image at all"): the export said <Image 1>; H3 names a
 *  reference picture <Picture n> (its template: "reference the inputs by tag,
 *  in the exact order they were connected, for example <Picture 1>, <Video
 *  1>, <Audio 1>"), so the text never pointed at the character and the
 *  performance in <Video 1> won. The opening line is the swap LoRA's own
 *  caption shape (akatz-ai/MiniMax-H3-Character-Swap-LoRA). */
const TEMPLATE = "Replace the subject in <Video 1> with the character in <Picture 1>. "
  + "Keep the replacement character's identity, outfit and art style from <Picture 1>. \n\n"
  + "Match the character’s exact facial features, hair structure, garments, material textures, "
  + "and proportions from <Picture 1> across every frame. Retain the master performance from "
  + "<Video 1> precisely, including full-body kinematics, spatial trajectory, timing, head tilt, "
  + "and facial expressions.\n\n"
  + "Seamlessly composite the new character into the environment: match the existing directional "
  + "key lighting, contact shadows, ambient occlusion, depth of field, and optical motion blur from "
  + "<Video 1>. Maintain accurate physical occlusion whenever hands, arms, or props cross in front "
  + "of the torso and face. Preserve the original background, camera framing, and continuous "
  + "single-take motion without structural alterations.";

/** <Image n> -> <Picture n> (H3's tag; swap_graph.fix_tags does the same
 *  on the worker side for anything already queued). */
function fixTags(text) {
  return String(text == null ? "" : text).replace(/<\s*image\s+(\d+)\s*>/gi, (_m, n) => `<Picture ${n}>`);
}

/** A WHOLE swap prompt: it names the performance AND the character
 *  (the swap dialog's ✎ Write prompt writes one - lib/swapPrompt). */
function isFullPrompt(text) {
  const t = fixTags(text);
  return /<Video 1>/.test(t) && /<Picture 1>/.test(t);
}

/** Template + the user's text ("Template + my text"). The user's words are
 *  EXTRA direction - they never replace the swap instructions. 2.335.0: a
 *  text that is a WHOLE swap prompt (it names both <Video 1> and <Picture 1>
 *  - what ✎ Write prompt writes) is sent as it is: the template would only
 *  say the same things again, less precisely. */
function promptFor(text) {
  const t = fixTags(String(text == null ? "" : text).replace(/\r/g, "").trim().slice(0, MAX_TEXT));
  if (t && isFullPrompt(t)) return t;
  return t ? `${TEMPLATE}\n\nAdditional direction: ${t}` : TEMPLATE;
}

/** A seconds field: a finite number >= 0, else null (blank = default). */
function secs(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) / 1000 : null;
}

/** The single-run ceiling this machine renders (the learned VRAM ceiling
 *  when there is one - the same rule as routes/index.js effectiveCeiling:
 *  below 107 frames a "ceiling" is a bad value, not a limit). */
function ceiling(cfg) {
  let v = +(((cfg || {}).engine || {}).comfy || {}).vram_ceiling || 0;
  if (v > 0 && v < 107) v = 0;
  if (!(v > 0)) return CEILING;
  const snapped = 5 + 17 * Math.floor((Math.min(CEILING, v) - 5) / 17);
  return Math.max(5, snapped);
}

/** The render's short side: the given size's short side, 16-px aligned,
 *  256..1440 (default 544 - the app default 960x544). */
function shortSide(width, height) {
  const w = parseInt(width, 10), h = parseInt(height, 10);
  const s = w > 0 && h > 0 ? Math.min(w, h) : 544;
  return Math.max(256, Math.min(1440, Math.round(s / 16) * 16));
}

const isVideo = (f) => VIDEO_EXT.includes(path.extname(String(f || "")).toLowerCase());
const isImage = (f) => IMAGE_EXT.includes(path.extname(String(f || "")).toLowerCase());

/** A graph that can do a character swap: the H3 reference-to-video node,
 *  a picture loader and a video loader. Takes the parsed API graph. */
function isSwapGraph(g) {
  if (!g || typeof g !== "object") return false;
  const cls = new Set(Object.values(g).map((n) => String((n && n.class_type) || "")));
  return cls.has("MiniMaxH3ReferenceToVideo") && cls.has("LoadImage")
    && (cls.has("VHS_LoadVideo") || cls.has("LoadVideo"));
}

/** The absolute workflow a video style renders through (its one `workflow`,
 *  else its ref2va one), or null when it names none. */
function styleWorkflow(style, base) {
  const st = style || {};
  const rel = String(st.workflow || (st.workflows || {}).ref2va || "").trim();
  return rel ? path.resolve(base, rel) : null;
}

const _swapCache = new Map();
/** Is this video style a CHARACTER-SWAP style? It says so (role "swap", or
 *  it names MiniMax_H3_Swap.json itself) AND its workflow is a swap graph.
 *  The graph alone cannot decide it: the plain ref2va export has the same
 *  node classes. Cached on path + mtime - the styles list asks for every style. */
function isSwapStyle(style, base) {
  if (!style || style.kind !== "video") return false;
  const wfName = path.basename(String(style.workflow || (style.workflows || {}).ref2va || ""));
  if (style.role !== "swap" && wfName !== WORKFLOW) return false;
  const wf = styleWorkflow(style, base);
  if (!wf) return false;
  let st;
  try { st = fs.statSync(wf); } catch { return false; }
  const key = wf + "|" + st.mtimeMs;
  if (!_swapCache.has(key)) {
    let ok = false;
    try { ok = isSwapGraph(JSON.parse(fs.readFileSync(wf, "utf8"))); } catch { ok = false; }
    _swapCache.set(key, ok);
  }
  return _swapCache.get(key);
}

/**
 * WHICH STYLE A SWAP RENDERS WITH: the style picked in the prompt bar when it
 * is a swap style; otherwise mmh3_chr_swap; otherwise (deleted) no style and
 * the built-in comfy_workflows/MiniMax_H3_Swap.json. `list` = the video
 * styles. Returns { style, workflow (abs), note }.
 */
function resolveStyle(list, wantId, base) {
  const all = Array.isArray(list) ? list : [];
  const fallback = path.join(base, "comfy_workflows", WORKFLOW);
  const want = wantId ? all.find((st) => st.id === String(wantId)) : null;
  if (want && isSwapStyle(want, base))
    return { style: want, workflow: styleWorkflow(want, base), note: `style "${want.name}"` };
  const named = all.find((st) => st.name === STYLE_NAME && isSwapStyle(st, base));
  const skipped = want ? `"${want.name}" is not a swap style, so ` : "";
  if (named) return { style: named, workflow: styleWorkflow(named, base), note: `${skipped}style "${named.name}"` };
  return { style: null, workflow: fallback, note: `${skipped}no swap style - the built-in ${WORKFLOW}` };
}

/**
 * The job params, or {error}. o = { workflow (abs), video (abs), image
 * (abs), text, start, dur, width, height, seed, cfg, scene?, style? }.
 */
function jobParams(o) {
  const x = o || {};
  if (!x.workflow || !fs.existsSync(x.workflow))
    return { error: `the swap workflow comfy_workflows/${path.basename(String(x.workflow || WORKFLOW))} `
      + "is missing - unzip the workflows zip at the install root" };
  if (!x.video || !isVideo(x.video))
    return { error: "a character swap needs a reference VIDEO (mp4 / webm / mov / mkv)" };
  if (!fs.existsSync(x.video)) return { error: `the reference video is gone: ${path.basename(x.video)}` };
  if (!x.image || !isImage(x.image))
    return { error: "a character swap needs a reference PICTURE of the new character (png / jpg / webp)" };
  if (!fs.existsSync(x.image)) return { error: `the character picture is gone: ${path.basename(x.image)}` };
  const seed = parseInt(x.seed, 10);
  return {
    mode: "swap",
    workflow: x.workflow, video: x.video, image: x.image,
    prompt: promptFor(x.text), user_text: String(x.text || "").trim().slice(0, MAX_TEXT),
    start: secs(x.start) || 0, dur: secs(x.dur),
    short_side: shortSide(x.width, x.height),
    ceiling: ceiling(x.cfg),
    seed: Number.isFinite(seed) ? seed : -1,
    format: "mp4",
    // 2.334.0: the character picture at up to a 2048-px short edge (H3's
    // stronger identity) and the swap LoRA stacked when ComfyUI has it
    ref_image_size: ["match", "max"].includes(String(x.ref_image_size || "")) ? String(x.ref_image_size) : "max",
    swap_lora: x.swap_lora !== false,
    quality: qualityOf(String(x.quality || "")),
    // 2.328.0: the swap style's overrides (swap_worker applies them)
    video_style: x.style || null, video_style_id: x.style && x.style.id ? x.style.id : null,
    video_style_name: x.style ? x.style.name : null,
    ...(x.scene ? { scene: x.scene } : {}),
  };
}

/** The pictures a scene can swap in: every cast member with a sheet. */
function castPictures(chars, project) {
  const out = [];
  for (const c of chars.cast(project) || []) {
    const pick = chars.referenceImage(c, project);
    if (!pick) continue;
    out.push({ name: c.name, tag: chars.tagOf(c.tag || c.name), file: pick,
               path: path.join(chars.charDir(c.name, project), pick) });
  }
  return out;
}

/** A human line for the queue / the card. */
function summary(p) {
  const w = p.dur ? `${p.start}s + ${p.dur}s` : (p.start ? `from ${p.start}s` : "from the start");
  const sty = p.video_style_name ? `style ${p.video_style_name}, ` : "";
  return `character swap: ${path.basename(p.image)} into ${path.basename(p.video)} (${w}, ${sty}`
    + (p.quality ? `quality ${p.quality}, ` : "")
    + `short side ${p.short_side}, one run of up to ${p.ceiling} frames; the original audio is kept)`;
}

module.exports = { QUALITIES, DEFAULT_QUALITY, qualityOf, WORKFLOW, STYLE_NAME, isSwapGraph, styleWorkflow, isSwapStyle, resolveStyle, TEMPLATE, VIDEO_EXT, IMAGE_EXT, CEILING, MAX_TEXT,
                   promptFor, fixTags, isFullPrompt, secs, ceiling, shortSide, isVideo, isImage, jobParams,
                   castPictures, summary };
