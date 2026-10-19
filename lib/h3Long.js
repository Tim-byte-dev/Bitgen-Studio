/* bitGen Studio — lib/h3Long.js (2.503.0): MINIMAX H3 LONG SINGLE RUNS (up to 30 s in ONE generation).
 *
 * Tim (verbatim): "the secret sauce workflow is meant to be able to do 25 sec video according to the youtube video"
 * (his upload: "Minimax H3 Secret-Sauce 4K Direct-Output Workflow"). What makes that graph render 15-28 s in one pass
 * instead of joined 15 s chunks is not a different model - it is three MODEL patches in front of the sampler:
 *   ModelAttentionBackend        "comfy kitchen attention" (ComfyUI core, 0.32+; needs comfy-kitchen installed)
 *   MiniMaxLowVRAMAttention      head_chunks 4   (KJNodes: attention heads in groups, buffers freed early)
 *   MiniMaxChunkFeedForward      chunks 2, seq_threshold 4096 (KJNodes: the feed-forward split along the tokens -
 *                                exact, since H3 quantizes activations per token)
 * (+ its turbo LoRA at 8 steps, which a style / Basic Settings LoRA already gives). The class names, widget names and
 * values are the ones in Tim's export - nothing guessed. worker.apply_video_accel injects them when a video style's
 * accel.long is "on" (the style editor) or the video docker's ⚙ "Long video" is ticked (lib/renderSettings).
 *
 * With them on, an H3 render may run as ONE generation up to LONG_CEILING frames (17*42+5 = 719, 29.96 s) on the
 * native 17k+5 grid, instead of the normal 362 (15.08 s) - longer still is chunked as before. A VRAM ceiling the
 * worker LEARNED (a single run that died of out-of-memory) still wins: it is a fact about this machine.
 */
"use strict";
const LONG_CEILING = 719;                    // 17*42+5 = 29.96 s at 24 fps - on the native H3 grid
const NORMAL_CEILING = 362;                  // 17*21+5 - framePlan.MAX_SINGLE_RUN_COMFY
const MODES = ["off", "on"];

/** Does this VIDEO style ask for long single runs? (MiniMax H3 only - LTX / Wan / Viggle have their own graphs) */
function on(style) {
  const s = style || {};
  if (s.kind && s.kind !== "video") return false;
  if (s.arch && s.arch !== "minimax-h3") return false;
  return !!(s.accel && s.accel.long === "on");
}
/** The single-run ceiling for a grid: the long one when `long` and the grid is the native H3 one (17k5); `learned` =
 *  a VRAM ceiling this machine learned (0 = none) - it still caps the run. */
function ceiling(grid, gridCeiling, long, learned) {
  const base = grid === "17k5" && long ? LONG_CEILING : gridCeiling;
  const v = +learned || 0;
  return v > 0 ? Math.min(base, v) : base;
}
/** The model's own ceiling for the grid (what a Single run may ask for) */
function modelCeiling(grid, gridCeiling, long) { return grid === "17k5" && long ? LONG_CEILING : gridCeiling; }

module.exports = { LONG_CEILING, NORMAL_CEILING, MODES, on, ceiling, modelCeiling };
