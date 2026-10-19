"use strict";
/**
 * ltx.js — WHAT AN LTX 2.5 JOB CARRIES (2.338.0).
 *
 * Tim: "can we add ltx2.5 for our music video and screenplay and first/last
 * frame from reference images/audio/video option and a dropdown in character
 * swap for ltx2 ripple, with ltx2 style".
 *
 * An LTX video style (arch "ltx-2.5", the "LTX 2.5" starter) renders through
 * Tim's all-in-one canvas (lib/ltxWorkflow.js picks the MODE, ltx_worker.py
 * converts + runs it). Three ways in, one job shape (mode "ltx"):
 *   the prompt docker   POST /api/ltx (routes/ltx.js) - the reference dock's
 *                       pictures (first / last / middle), its first audio and
 *                       its first video; the LTX mode dropdown (Auto = from
 *                       what is loaded)
 *   the scene board     the Video docker's "LTX 2.5" flow (routes/characters.js
 *                       queueScene -> lib/ltxScenes.js): Ref = text, First /
 *                       Cont = the frame it starts on, Trans = first + last;
 *                       with the board's song = the lipsync variants on the
 *                       scene's slice of the song
 *   (2.339.0) the swap  LTX Ripple
 */
const fs = require("fs");
const path = require("path");
const LW = require("./ltxWorkflow");

const ARCH = "ltx-2.5";
const WORKFLOW = "LTX25_All_In_One.json";
const FPS = 24;
const IMAGE_EXT = [".png", ".jpg", ".jpeg", ".webp", ".bmp"];
const AUDIO_EXT = [".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac", ".opus"];
const VIDEO_EXT = [".mp4", ".webm", ".mov", ".mkv", ".avi", ".m4v", ".gif"];

const ARCH23 = "ltx-2.3";        // 2.402.0: LTX 2.3 - Comfy-Org's templates + 3DREAL (lib/ltxOfficial family ltx23)
const LO = require("./ltxOfficial");
const isLtxStyle = (st) => !!st && st.kind === "video" && (st.arch === ARCH || st.arch === ARCH23
  || path.basename(String(st.workflow || (st.workflows || {}).ltx || "")) === WORKFLOW);

/** The canvas a style renders through (abs), or the shipped one. */
function workflowFor(style, base) {
  const rel = String((style && (style.workflow || (style.workflows || {}).ltx)) || "").trim();
  return rel ? path.resolve(base, rel) : path.join(base, "comfy_workflows", WORKFLOW);
}

/** LTX wants multiples of 32 (the canvas's ResolutionSelector). */
function size(w, h) {
  let W = parseInt(w, 10) || 960, H = parseInt(h, 10) || 544;
  const k = Math.min(W, H) < 256 ? 256 / Math.min(W, H) : 1;          // small = scaled up, aspect kept
  const r = (v) => Math.max(256, Math.min(2048, Math.round(v * k / 32) * 32));
  return { width: r(W), height: r(H) };
}

/**
 * The job params, or {error}. o = { style, workflow (abs), mode ("auto" | id),
 * prompt, negative, images:[abs], audio:{path, start}|null, video:{path, start}|null,
 * seconds, width, height, seed, transition (null = by mode), scene? }.
 */
function jobParams(o) {
  const x = o || {};
  if (!x.workflow || !fs.existsSync(x.workflow))
    return { error: `the LTX workflow comfy_workflows/${path.basename(String(x.workflow || WORKFLOW))} is missing - unzip the workflows zip at the install root` };
  const images = (x.images || []).filter(Boolean).slice(0, 3);
  for (const p of images) {
    if (!IMAGE_EXT.includes(path.extname(p).toLowerCase())) return { error: `${path.basename(p)} is not a picture` };
    if (!fs.existsSync(p)) return { error: `the picture is gone: ${path.basename(p)}` };
  }
  const audio = x.audio && x.audio.path ? x.audio : null;
  if (audio && (!fs.existsSync(audio.path) || !AUDIO_EXT.includes(path.extname(audio.path).toLowerCase())))
    return { error: `the audio ${path.basename(audio.path)} is not an audio file on disk` };
  const video = x.video && x.video.path ? x.video : null;
  if (video && (!fs.existsSync(video.path) || !VIDEO_EXT.includes(path.extname(video.path).toLowerCase())))
    return { error: `the video ${path.basename(video.path)} is not a video file on disk` };
  const have = { images: images.length, audio: !!audio, video: !!video };
  const fam = LO.familyOf(x.style);
  let mode, m;
  if (fam === "ltx23") {
    // 2.402.0: LTX 2.3 - text / picture / first-last / 3D render -> real (a video in the dock = 3DREAL)
    mode = !x.mode || x.mode === "auto" ? auto23(have) : String(x.mode);
    m = modesFor(x.style).find((q) => q.id === mode);
    if (!m) return { error: `LTX 2.3 renders ${modesFor(x.style).map((q) => q.label).join(" / ")} - "${mode}" is an LTX 2.5 mode (pick the LTX 2.5 style)` };
    const n = m.needs.images || 0;
    if (have.images < n) return { error: `${m.label} needs ${n} picture${n > 1 ? "s" : ""} - load ${n > 1 ? "them" : "it"} in the reference dock (or pick another LTX mode)` };
    if (m.needs.video && !have.video) return { error: `${m.label} needs the render: a video in the reference dock (or send the scene from Blender: bitGen panel -> Render to bitGen)` };
  } else {
    mode = !x.mode || x.mode === "auto" ? LW.autoMode(have) : String(x.mode);
    const miss = LW.missing(mode, have);
    if (miss) return { error: miss + " - load it in the reference dock (or pick another LTX mode)" };
    m = LW.modeById(mode);
    if (!m) return { error: `unknown LTX mode "${mode}"` };
  }
  // 3DREAL: a picture in the dock is a real FIRST frame (optional)
  const need = mode === "3dreal" ? Math.min(1, images.length) : (m.needs.images || 0);
  const sz = size(x.width, x.height);
  const seed = parseInt(x.seed, 10);
  const st = x.style || null;
  return {
    mode: "ltx", ltx_mode: mode, ltx_label: m.label,
    workflow: x.workflow,
    prompt: String(x.prompt || "").slice(0, 8000),
    negative: x.negative ? String(x.negative).slice(0, 2000) : "",
    images: images.slice(0, need),                          // only what the mode reads
    audio: m.needs.audio && audio ? { path: audio.path, start: Math.max(0, +audio.start || 0) } : null,
    video: m.needs.video && video ? { path: video.path, start: Math.max(0, +video.start || 0) } : null,
    seconds: LW.seconds(x.seconds),
    fps: FPS,
    width: sz.width, height: sz.height,
    seed: Number.isFinite(seed) ? seed : -1,
    transition: x.transition === true || x.transition === false ? x.transition : null,
    // 2.401.5: text / picture / first-last run on Comfy-Org's LTX 2.5 templates when ComfyUI has their files;
    // "canvas" keeps them on Tim's all-in-one canvas
    ltx_engine: x.engine === "canvas" ? "canvas" : "",
    ltx_family: fam,                                        // 2.402.0
    ...(mode === "3dreal" ? { ic_lora: String(x.ic_lora || "").slice(0, 200),
                               ic_strength: Number.isFinite(+x.ic_strength) && x.ic_strength !== "" && x.ic_strength != null ? Math.max(0, Math.min(2, +x.ic_strength)) : 1 } : {}),
    format: "mp4",
    video_style: st, video_style_id: st && st.id ? st.id : null, video_style_name: st ? st.name : null,
    ...(x.scene ? { scene: x.scene } : {}),
    // 2.409.0: Basic Settings' Override style - the steps / cfg written into the graph (scripts/basic_apply.py)
    ...(x.basic && (x.basic.steps || x.basic.cfg != null) ? { basic: { steps: x.basic.steps || 0, cfg: x.basic.cfg != null ? x.basic.cfg : null } } : {}),
  };
}

/** A human line for the queue. */
function summary(p) {
  const bits = [`${p.ltx_family === "ltx23" ? "LTX 2.3" : "LTX 2.5"} ${p.ltx_label}`, `${p.seconds}s`, `${p.width}x${p.height}`];
  if (p.ic_lora !== undefined) bits.push(`3DREAL ${p.ic_lora || "(the newest in ComfyUI's loras)"} @ ${p.ic_strength}`);
  if (p.images && p.images.length) bits.push(`${p.images.length} picture(s)`);
  if (p.audio) bits.push(`audio ${path.basename(p.audio.path)} from ${p.audio.start}s`);
  if (p.video) bits.push(`video ${path.basename(p.video.path)}`);
  return bits.join(" · ");
}

/** 2.402.0: the modes a style offers - LTX 2.3's four, or the LTX 2.5 canvas's eight. */
function modesFor(style) { return LO.familyOf(style) === "ltx23" ? LO.FAMILY_MODES.ltx23 : LW.MODES; }
/** LTX 2.3's Auto: a video = 3D render -> real, 2 pictures = first / last, 1 = image to video, none = text. */
function auto23(have) { return have.video ? "3dreal" : have.images >= 2 ? "flf" : have.images === 1 ? "i2v" : "t2v"; }

module.exports = { ARCH, ARCH23, WORKFLOW, FPS, isLtxStyle, workflowFor, size, jobParams, summary, modesFor, auto23,
                   MODES: LW.MODES, autoMode: LW.autoMode };
