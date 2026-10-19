"use strict";
/**
 * timelineSpan.js — how long the compiled movie must be (2.63.0).
 *
 * MIRROR of `scripts/timeline_span.py`. The worker does the padding, but the
 * ROUTE is the only place where each clip's source duration (`dur`) is still
 * known without touching the disk, so /api/export computes the span here and
 * stamps it on the job as `timeline.scene_end`. The worker recomputes it from
 * what it received and takes the larger of the two, so an older payload with
 * no hint still compiles to the right length — just with a few ffprobe calls.
 *
 * If you change a rule in here, change it in scripts/timeline_span.py too.
 * scripts/test-timeline.js and scripts/test-span.py run the same case table
 * against the two files for exactly this reason.
 *
 * THE BUG THIS EXISTS TO PREVENT: the compile used to end at the last frame of
 * the BASE video track, so anything on V2+, an image layer or a sound layer
 * that outlasted V1 was silently cut off.
 */

// AN UNKNOWN LENGTH CONTRIBUTES NOTHING. A clip with no `out` and no `dur` is
// SKIPPED here, not assumed to be some default number of seconds. The UI's
// effDur() does guess 5s, and copying that guess cost a full e2e cycle: this
// route sees no `dur` on an untrimmed clip, so every such compile invented a
// 5-second timeline and the worker faithfully padded a 2-second video with 3
// seconds of black. Guessing can only ever add footage that is not there;
// skipping can only ever fall back to the video that was actually rendered.
// The worker DOES have ffprobe and measures those clips properly, so hinting
// short from here is free.
const MIN_CLIP_SECONDS = 0.1;
// `len` is authoritative for an image and always present, so this only covers
// a malformed track. Video clips have NO equivalent — see the doctrine below.
const FALLBACK_IMAGE_SECONDS = 3;

/**
 * The value as a finite number, or null when there isn't one. null rather than
 * 0 matters: `out` and `dur` are tested for PRESENCE, and a garbage value read
 * as 0 would look like a trim to zero length and silently shrink the clip.
 */
function numOrNull(v) {
  if (v == null || v === "" || v === false) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function num(v, d = 0) {
  const n = numOrNull(v);
  return n == null ? d : n;
}

/** Flatten either track shape: {clips,...} (2.60.0+) or a bare array (older). */
function trackClips(track) {
  if (Array.isArray(track)) return track.filter((c) => c && typeof c === "object");
  if (track && typeof track === "object")
    return (track.clips || []).filter((c) => c && typeof c === "object");
  return [];
}

/** Seconds of this clip that play, after its in/out trim. */
function clipLength(c) {
  // 2.406.0: a retimed clip (speed / reverse / ramp - lib/clipFx.forJob) covers its TIMELINE length, not its source's
  const tl = numOrNull(c.tl_len);
  if (tl != null && tl > 0) return Math.max(MIN_CLIP_SECONDS, tl);
  const cin = num(c.in, 0);
  let end = numOrNull(c.out);
  if (end == null) end = numOrNull(c.dur);
  if (end == null || end <= 0) return null;   // unmeasurable: contributes nothing
  return Math.max(MIN_CLIP_SECONDS, end - cin);
}

/** The absolute second this clip stops covering the timeline. */
function clipEnd(c) {
  const ln = clipLength(c);
  return ln == null ? null : num(c.start, 0) + ln;
}

/** A still occupies `len` seconds from its start; it carries no in/out trim. */
function imageEnd(c) {
  let ln = numOrNull(c.len);
  if (ln == null || ln <= 0) ln = FALLBACK_IMAGE_SECONDS;
  return num(c.start, 0) + Math.max(MIN_CLIP_SECONDS, ln);
}

/** The last second of the WHOLE timeline — every layer, not just V1. */
function sceneEnd(tl) {
  if (!tl || typeof tl !== "object") return 0;
  const ends = [0];
  const add = (v) => { if (v != null) ends.push(v); };
  for (const c of trackClips(tl.video)) add(clipEnd(c));
  for (const L of tl.video_layers || [])
    for (const c of trackClips(Array.isArray(L) ? L : (L || {}).clips)) add(clipEnd(c));
  for (const track of tl.audio || []) for (const c of trackClips(track)) add(clipEnd(c));
  for (const track of tl.images || []) for (const c of trackClips(track)) add(imageEnd(c));
  return Math.max(...ends);
}

module.exports = {
  MIN_CLIP_SECONDS, FALLBACK_IMAGE_SECONDS,
  trackClips, clipLength, clipEnd, imageEnd, sceneEnd,
};
