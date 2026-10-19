"use strict";
/**
 * bitGen Studio — Viggle (native): the swap dialog's Viggle-Animate on bitGen's OWN engine (2.351.0; 2.352.0
 * runs it on the shared native engine - lib/nativeEngine.js, scripts/native/).
 *
 * Tim: "can we use wan2gp technique to render viggle ... just the technique not the libraries" -> "can we
 * build our own wan2gp engine?" -> "can we make the engine replace comfy engine so we can package independent
 * of comfy?"
 *
 * viggle_native_worker.py cuts the segment (17n+5 frames), the resident native server renders it (Viggle's
 * transformer + DMD LoRA + frozen prompt, streamed from RAM - the model stays loaded between segments), the
 * worker trims back and puts the clip's sound back. Weights: your ComfyUI Viggle files when the engine can read
 * them, else the official download (the swap dialog's ⚙ -> Viggle native).
 *
 * Pure.
 */
const FPS = 24;
const MIN_FRAMES = 124;          // H3 makes 5..15 s; the VAE encodes 17n+5 frames
const MAX_FRAMES = 345;          // diffusers' H3: at most 15.0 s (the ComfyUI route takes 362)
const STEPS = 4;                 // 4 sigmas = 3 forward passes: the distilled operating point
const SHIFT = 3;                 // "the base model's released default is 12; the few-step student wants 3"

/** 17n+5, at least 124 (the frames H3 renders for a segment of n). */
function alignFrames(n) {
  let f = Math.max(MIN_FRAMES, Math.floor(+n || 0));
  while (f % 17 !== 5) f++;
  return f;
}

/** ⚙ settings -> the safe values (the keys live in rippleSwap.settingsSafe). */
function settingsOf(set) {
  const s = set || {};
  const num = (v, d, lo, hi) => (Number.isFinite(+v) && v !== "" && v !== null ? Math.max(lo, Math.min(hi, +v)) : d);
  return { steps: Math.round(num(s.vn_steps, STEPS, 1, 12)), shift: Math.round(num(s.vn_shift, SHIFT, 0.5, 12) * 100) / 100 };
}

/** The job's params (or {error}). o = { video, image (abs), start, frames, seed, width, height, settings }. */
function jobParams(o) {
  const x = o || {};
  const frames = Math.floor(+x.frames || 0);
  if (!(frames >= 5)) return { error: "that segment is too short for a Viggle swap" };
  const render = alignFrames(frames);
  if (render > MAX_FRAMES) return { error: `a Viggle segment can be at most ${(MAX_FRAMES / FPS).toFixed(2)} s (${MAX_FRAMES} frames) - split it` };
  const s = settingsOf(x.settings);
  return {
    mode: "viggle_native", video: x.video, image: x.image, start: +x.start || 0, frames, render_frames: render,
    dur: frames / FPS, width: +x.width || 0, height: +x.height || 0,
    seed: Number.isFinite(+x.seed) ? Math.floor(+x.seed) : -1, steps: s.steps, shift: s.shift,
    viggle: { frames, render, start: +x.start || 0, dur: frames / FPS },
  };
}

function summary(p) {
  const v = p.viggle || {};
  return `Viggle (native) · ${v.frames} frames (${(v.dur || 0).toFixed(2)}s from ${(+v.start || 0).toFixed(2)}s)`
    + (v.render !== v.frames ? ` rendered as ${v.render}` : "")
    + (p.width && p.height ? ` · ${p.width}x${p.height}` : "") + ` · ${p.steps} steps · shift ${p.shift} · bitGen's own engine`;
}

module.exports = { FPS, MIN_FRAMES, MAX_FRAMES, STEPS, SHIFT, alignFrames, settingsOf, jobParams, summary };
