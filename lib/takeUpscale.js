/* bitGen Studio — ⏫ UPSCALE THE TAKE YOU PREVIEWED (2.315.0).
 *
 * Tim (verbatim): "does it upscale automatically or do i need to press the
 * upscale button in the scene. i would prefer to press the button so i can
 * preview the scene, however i would like a icon only button in the scene
 * menubar to upscale selected".
 *
 *  - A scene render no longer runs the ⚙ upscaler by itself: the ⚙'s new
 *    "Upscale every render" box (upscale_auto, OFF by default) brings the
 *    in-render stage back for whoever wants it.
 *  - ⏫ (per scene, or the menubar's ⏫ for the ticked scenes) upscales the
 *    TAKE on disk with the ⚙'s Upscaler + Upscale resolution: the scene's
 *    own graph is queued with the MMH3 stage reading the take (its lossless
 *    master when it has one) instead of a new sample (scripts/
 *    upscalestage.from_take) - the clip you previewed is the clip that gets
 *    upscaled, filed beside it as <take>_upscaled.
 * Pure helpers; routes/characters.js queueScene does the queueing. */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const renderSettings = require("./renderSettings");
const rawMaster = require("./rawMaster");

const NO_UPSCALER = "pick an Upscaler in the video docker's ⚙ first (a 3D latent upscaler "
  + "from ComfyUI's models/latent_upscale_models) - ⏫ upscales the take with it";

/** {width, height} of a video's first stream, or null. */
function probeSize(file) {
  try {
    const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0",
      "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", String(file)],
    { encoding: "utf8", timeout: 20000 });
    const m = /^(\d+)x(\d+)/.exec(String(r.stdout || "").trim());
    return m ? { width: parseInt(m[1], 10), height: parseInt(m[2], 10) } : null;
  } catch { return null; }
}

/** The take a board row points at: {mp4, file (the master when there is
 *  one), master}, or null when it is not on disk. */
function source(projDir, output) {
  if (!output) return null;
  const mp4 = path.join(projDir, "video", path.basename(String(output)));
  if (!fs.existsSync(mp4)) return null;
  let m = null;
  try { m = rawMaster.forTake(mp4); } catch { m = null; }
  return { mp4, file: m || mp4, master: !!m };
}

/** What the ⏫ does for a take of size `size` with the ⚙ record `s`:
 *  {stage: {model, width, height}, note} or {error}. */
function plan(s, src, size) {
  s = renderSettings.normalize(s);
  if (!s.upscaler) return { error: NO_UPSCALER };
  if (!src) return { error: "the scene's take is not in the project's Video assets any more - render it again, then ⏫" };
  if (!size) return { error: `could not read the size of ${path.basename(src.file)} (is ffprobe installed?)` };
  const u = renderSettings.upscaleDims(s.upscale_res, size.width, size.height);
  if (!(u && (u.width > size.width || u.height > size.height)))
    return { error: `the take is already ${size.width}x${size.height} - pick a larger Upscale resolution in the ⚙` };
  return { stage: { model: s.upscaler, width: u.width, height: u.height },
           note: `⏫ upscales the take you previewed: ${path.basename(src.file)} `
             + `(${src.master ? "its lossless master" : "the mp4 - it has no lossless master"}) `
             + `${size.width}x${size.height} -> ${u.width}x${u.height} with ${s.upscaler} `
             + "(one refine step at denoise 0.2 - no new sample)" };
}

/** The ticked scene numbers, unique, in board order. */
function ticked(ns) {
  return [...new Set((Array.isArray(ns) ? ns : []).map((x) => parseInt(x, 10))
    .filter((x) => Number.isFinite(x) && x > 0))].sort((a, b) => a - b);
}

module.exports = { NO_UPSCALER, probeSize, source, plan, ticked };
