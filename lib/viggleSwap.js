"use strict";
/**
 * bitGen Studio — the swap dialog's Viggle engine (2.344.0).
 *
 * Tim (with API-viggle-animate-h3_workflow-v1.2.0.json): "https://github.com/
 * deepbeepmeep/Wan2GP, uses a 3 step viggle animate. i have seen it on
 * youtube. can you see if we can add viggle to our styles\workflow".
 *
 * Viggle-Animate (a MiniMax H3 finetune + a DMD LoRA) replaces the character
 * in a clip from ONE of the clip's own frames with the character repainted -
 * the same ✎ first frame the LTX Ripple engine makes (Qwen Image 2.1), so it
 * shares that flow (lib/rippleSwap: first frames, auto-render, ⚙). The render
 * is viggle_worker.py on comfy_workflows/viggle_animate_h3_api.json (his
 * upload), patched by scripts/viggle_graph.py.
 *
 * Pure: no ComfyUI, no files.
 */
const RS = require("./rippleSwap");

const WORKFLOW = "viggle_animate_h3_api.json";
const STEPS = 3;                 // "a 3 step viggle animate": the 4-point DMD sigmas
const STRENGTH = 1;              // the DMD LoRA
const SHORT = 480;               // Viggle's reference canvas is 480x832
const FPS = 24;
const MODEL = "minimax_h3_ref2va_viggle_pruned_int8_convrot.safetensors";

/** The render size: the ⚙ fixed size, else the video's aspect at 480 (32-multiples). */
function sizeFor(settings, videoW, videoH) {
  const s = RS.settingsSafe(settings);
  if (!s.auto_size && s.width && s.height) return { width: s.width, height: s.height, auto: false };
  return { ...RS.size(videoW || 832, videoH || 480, SHORT), auto: true };
}

/**
 * The Viggle job's params (or {error}). o = { workflow (abs), video (abs),
 * start, frames (the segment's), image (the ✎ first frame, abs), seed,
 * width, height, steps, strength, loras [{path, weight}] }.
 */
function jobParams(o) {
  const x = o || {};
  const frames = Math.floor(+x.frames || 0);
  if (!(frames >= 5)) return { error: "that segment is too short for a Viggle swap" };
  if (!x.workflow) return { error: `the Viggle workflow comfy_workflows/${WORKFLOW} is missing - it ships in the full zip` };
  const strength = Number.isFinite(+x.strength) ? +x.strength : STRENGTH;
  return {
    mode: "viggle", workflow: x.workflow, video: x.video, image: x.image,
    start: +x.start || 0, frames, dur: frames / FPS,
    width: +x.width || 0, height: +x.height || 0, short_side: SHORT, steps: Math.round(+x.steps || STEPS),
    seed: Number.isFinite(+x.seed) ? Math.floor(+x.seed) : -1, strength,
    speed_patch: x.solattn === true,              // 2.346.0: Sol-Attn (2.350.0: + fp16 accumulation) only when ⚙ asks
    safe: x.safe === true,                        // 2.350.0: ⚙ Viggle safe mode (learned from a black take)
    loras: (Array.isArray(x.loras) ? x.loras : []).filter((l) => l && l.path).map((l) => ({ path: String(l.path), weight: Number.isFinite(+l.weight) ? +l.weight : 1 })),
    viggle: { model: MODEL, strength, frames, start: +x.start || 0, dur: frames / FPS },
  };
}

function summary(p) {
  const v = p.viggle || {};
  return `Viggle swap (H3) · ${v.frames} frames (${(v.dur || 0).toFixed(2)}s from ${(+v.start || 0).toFixed(2)}s) · DMD LoRA @ ${v.strength}`
    + (p.width && p.height ? ` · ${p.width}x${p.height}` : "") + (p.steps ? ` · ${p.steps} steps` : "")
    + ((p.loras || []).length ? ` · +${p.loras.length} LoRA(s)` : "");
}

module.exports = { WORKFLOW, STEPS, STRENGTH, SHORT, FPS, MODEL, sizeFor, jobParams, summary };
