// bitGen Studio — lib/podProgress.js (2.758.0): HOW FAR A RUNPOD POD HAS GOT WITH LOADING.
// Tim (verbatim): "can you show progess of pod loading?" (asked: "Stages + timed bar"). RunPod's API says nothing about
// download percentages, so the stages are the ones bitGen can see, and the bar is the time so far against how long this
// pod (or another pod of the same template image) took last time.
//   0 waiting for a GPU machine        RunPod has the pod but no machine has it yet (no runtime)
//   1 starting the container           a machine has it - the template's image is being downloaded / started
//   2 ComfyUI starting                 the container runs; ComfyUI does not answer yet (a template may be downloading
//                                      its models now - often the longest part)
//   3 pod loaded                       ComfyUI answers through RunPod's proxy
// lib/remoteGpu.js podState() adds progress() to what it sends; the time a load took is kept (rgpu.pod_loads, by image and
// by pod) when a watched pod becomes ready. Pure (scripts/test-pods758.js): stageOf, progress, remember, expectOf.
"use strict";

const STAGES = ["waiting for a GPU machine", "starting the container", "ComfyUI starting", "pod loaded"];
// where each stage starts on the bar when there is no time from before
const STAGE_PCT = [4, 15, 40, 100];

/** the stage now (pure): st = {status, uptime, ready, has_runtime} */
function stageOf(st) {
  const s = String((st || {}).status || "").toUpperCase();
  if (st && st.ready) return 3;
  if (s === "RUNNING" || s === "STARTING") return (+st.uptime > 0 || st.has_runtime) ? 2 : 1;
  return 0;
}
/** {stage, of, word, pct, elapsed, expect, left} (pure) - elapsed / expect in seconds; expect 0 = never seen loading */
function progress(st, elapsed, expect) {
  const stage = stageOf(st), e = Math.max(0, Math.round(+elapsed || 0)), x = Math.max(0, Math.round(+expect || 0));
  let pct = STAGE_PCT[stage];
  if (stage < 3) {
    if (x > 0) pct = Math.max(pct, Math.min(97, Math.round(e / x * 100)));
    else pct = Math.min(STAGE_PCT[stage + 1] - 3, pct + Math.round(e / 30));     // creeps on a little; never reaches the next stage
  }
  return { stage, of: STAGES.length - 1, word: STAGES[stage], pct, elapsed: e, expect: x, left: stage < 3 && x > e ? x - e : 0 };
}
/** the seconds a load took, kept by the pod and by its image (pure) -> the new map (at most 40 entries) */
function remember(loads, pod, image, secs) {
  const out = Object.assign({}, loads || {}), s = Math.round(+secs || 0);
  if (!(s > 0 && s < 6 * 3600)) return out;
  if (pod) out["pod:" + pod] = s;
  if (image) out["img:" + image] = s;
  const keys = Object.keys(out);
  while (keys.length > 40) delete out[keys.shift()];
  return out;
}
/** the time to expect for a pod (pure): its own last load, else its image's, else 0 */
function expectOf(loads, pod, image) {
  const l = loads || {};
  return +(l["pod:" + pod] || l["img:" + image] || 0);
}
module.exports = { STAGES, STAGE_PCT, stageOf, progress, remember, expectOf };
