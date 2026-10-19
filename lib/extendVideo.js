// bitGen Studio — the H3_Video_Ref support lib (was EXTEND VIDEO, 2.223.13).
//
// 2.227.0 (Tim verbatim): "remove the extend workflow, this workflow needs a
// node that corrupts the other h3 nodes" — h3_video_extend.json and every
// flow that queued it (the Extend checkbox, queueExtend) are REMOVED. The
// pack behind MiniMaxH3VideoExtendPatched corrupts the other H3 nodes on
// install, so the workflow cannot ship. H3_Video_Ref now renders EVERY
// scene through the native ref2va export; continuity between scenes rides
// ref2va's OWN video-reference slots (the previous scene's take as
// ref_video_0) — no extra pack, nothing to corrupt.
//
// What remains here: the ref2va style constants and capacities, the
// duration snap (the pack's 17k+5 grid — ref2va's math is the same
// family), and priorTake (which take carries scene n-1 into scene n).
const fs = require("fs");
const path = require("path");
const core = require("./core");

/** The pack's own ref-image ceiling (confirmed model limit: 9 ref images). */
const MAX_REF_IMAGES = 9;

/** Seconds -> frames EXACTLY as the export's own math node (23) computes it:
 *    max(5, round(a * 24)) + (5 - (max(5, round(a * 24)) % 17)) % 17
 *  i.e. snap UP onto the pack's 17k+5 grid. The worker writes the result as
 *  a literal onto the gen node's `length` input (detaching the primitive +
 *  math helpers, its documented behaviour), so this formula and the export
 *  must agree — it is copied from the export, not invented. NO 2.223.5
 *  ladder here (handover: "start WITHOUT it, extend semantics differ from
 *  the chain"): the docker's duration is the duration, per position. */
function snapExtendFrames(seconds) {
  const sec = parseFloat(seconds);
  if (!Number.isFinite(sec) || sec <= 0) return null;
  const base = Math.max(5, Math.round(sec * 24));
  return Math.min(3592, base + ((5 - (base % 17)) % 17 + 17) % 17);
}

/** The extend duration in frames, from the SAME knobs chainOverrides reads
 *  (explicit chain-tab Length wins, then the docker's Seconds via
 *  gen.seconds, then the app default) — but snapped with the export's own
 *  formula above, ladder-free. Returns a frame count, never null. */
function extendFrames(project, chainOverrides, defaultLength) {
  const ov = chainOverrides || {};
  const raw = parseInt(ov.length, 10);
  const frames = Number.isFinite(raw) && raw > 0 ? raw
               : (parseInt(defaultLength, 10) || 141);
  return snapExtendFrames(frames / 24) || frames;
}

/** The PREVIOUS scene's take for scene n — "the video reference will be the
 *  video of the scene before this one". Board order (n - 1), upscaled take
 *  preferred (the keptOutputs rule). Returns { name, abs } when the file is
 *  really on disk, or { error } in words — scene 1 has no predecessor and is
 *  REFUSED (the handover's SCENE 1 RULE default: "render scene 1 normally
 *  first"); a predecessor without a rendered take is refused the same way. */
function priorTake(state, n, project) {
  const list = (state && state.list) || [];
  const num = parseInt(n, 10);
  if (num <= 1) return { error:
    "scene 1 has no previous take to continue from" };
  const prev = list.find((r) => r.n === num - 1);
  if (!prev) return { error: `scene ${num}: no scene ${num - 1} on the board` };
  const name = prev.upscaled || prev.output;
  if (!name) return { error: `scene ${num}: continuity rides scene ${num - 1}'s `
    + `take, and scene ${num - 1} has none yet — render it first (▶)` };
  const abs = path.join(core.projDir(project || core.getProject()), "video",
                        path.basename(name));
  if (!fs.existsSync(abs)) return { error: `scene ${num}: scene ${num - 1}'s `
    + `take (${name}) is no longer in the project's Video assets` };
  return { name: path.basename(name), abs };
}

/** H3_VIDEO_REF (2.223.16, by instruction: "use the ref2va workflow to
 *  generate the first scene and the extend workflow to do scene 2, using
 *  scene 1 as the reference video and all the reference pictures, global
 *  prompt, character sheets ... call the style H3_Video_Ref, character
 *  voices as well"). The style ships as styles/video/H3_Video_Ref.json
 *  (workflow = the native ref2va export); this name is what the scene board
 *  routes on. The native export's own capacities: 9 ref images, 3 ref
 *  audios, 3 ref videos. */
const REF_STYLE = "H3_Video_Ref";
const REF_WF = "ref2va.json";
const MAX_REF_AUDIOS = 3;

module.exports = { MAX_REF_IMAGES, snapExtendFrames, extendFrames, priorTake,
                   REF_STYLE, REF_WF, MAX_REF_AUDIOS };
