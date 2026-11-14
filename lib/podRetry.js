/* bitGen Studio — lib/podRetry.js (2.774.0): A RENDER THAT FAILED ON ITS POD GOES AGAIN WHEN THE POD IS READY.
 * Tim (verbatim): "after the pod is setup for the style start the generation that initiated the create pod or select pod
 * dialog" - it already did when the setup worked; then (agreed) "yes, please do that": a render that FAILED because its pod
 * could not be used (setup stopped, files not on it yet, its ComfyUI lacked a node …) is held, and queued again by itself when
 * that pod has something new done to it:
 *   - a pod job ends well (lib/podActivity.js finish ok: set up and ready, ComfyUI installed / updated, styles made ready)
 *   - a file sent from this computer lands on it (lib/podModels.js upload -> changed())
 * It goes again once the pod is quiet (no install / update / setup / preparation running on it), at most MAX_TRIES times per
 * render and within MAX_AGE of the failure. A failed render cleared from the Queue is not tried again (it is no longer in
 * core.jobs). Only in this run of the app (not kept over a restart).
 *   hold(job, pod, why)   core.js - a pod render failed (not cancelled)
 *   changed(pod, why)     something new on the pod -> the held renders go again when it is quiet
 *   held(pod?)            what is held (tests / the PODS docker)
 * Pure: pid, due(holds, pod, at) - which held renders a change at `at` sends again.
 */
"use strict";

const MAX_TRIES = 3;
const MAX_AGE = 12 * 3600 * 1000;
const HOLD = new Map();   // failed job id -> {id, pod, params, project, at, tries, style, why}
const pid = (x) => String(x || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 40);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let D = null;             // deps (tests replace them)
function deps() {
  return D || {
    core: () => require("./core"),
    busy: (pod) => {
      const k = pid(pod), on = (m, f) => { try { return !!f(require(m)); } catch { return false; } };
      return on("./podMade", (M) => M.WATCH && M.WATCH[k] && M.WATCH[k].running)
        || on("./podInstall", (M) => M.RUNS && M.RUNS[k] && M.RUNS[k].running)
        || on("./podComfyUpdate", (M) => M.RUNS && M.RUNS[k] && M.RUNS[k].running)
        || on("./podPrep", (M) => { const s = M.status(k); return s && s.running; });
    },
    wait: +(process.env.H3_POD_RETRY_WAIT || 15000),
  };
}
function setDeps(d) { D = d ? Object.assign({}, deps(), d) : null; }

/** which held renders a change on `pod` at `at` sends again (pure): the pod's, held before the change, tried < MAX_TRIES,
 *  younger than MAX_AGE - oldest first */
function due(holds, pod, at) {
  const k = pid(pod);
  return (holds || []).filter((h) => h.pod === k && h.at < at && (h.tries || 0) < MAX_TRIES && at - h.at < MAX_AGE).sort((a, b) => a.at - b.at);
}
function styleName(p) { const s = (p && (p.video_style || p.style)) || {}; return String(s.name || s.id || "the style"); }

function hold(job, pod, why) {
  const k = pid(pod), p = (job && job.params) || {};
  if (!k || !job || p.live) return null;
  const tries = +p._pod_retry || 0;
  const C = deps().core();
  if (tries >= MAX_TRIES) { C.log(job, `[pod] not tried again - it failed on the pod ${k} ${tries + 1} times. Press Generate when the pod is fixed.`); return null; }
  let params; try { params = JSON.parse(JSON.stringify(p)); } catch { return null; }
  delete params.pod_job;
  const h = { id: job.id, pod: k, params, project: job.project, at: Date.now(), tries, style: styleName(p), why: String(why || "").slice(0, 300) };
  HOLD.set(job.id, h);
  C.log(job, `[pod] it goes again by itself when the pod ${k} is ready - its setup finishes, ComfyUI is installed / updated or the files it lacks are put on it` + (tries ? ` (try ${tries + 1} of ${MAX_TRIES})` : "") + ". Clear it from the Queue to stop that.");
  return h;
}

const PENDING = {};   // pod -> timer (a change waits for the pod to be quiet)
function changed(pod, why) {
  const k = pid(pod); if (!k) return false;
  const at = Date.now();
  if (!due([...HOLD.values()], k, at).length) return false;
  if (PENDING[k]) return true;
  const go = async () => {
    const d = deps();
    for (let i = 0; i < 480 && d.busy(k); i++) await sleep(d.wait);   // at most ~2 h of other pod work first
    await sleep(Math.min(d.wait, 3000));
    delete PENDING[k];
    again(k, at, why);
  };
  PENDING[k] = true;
  go().catch(() => { delete PENDING[k]; });
  return true;
}
/** queue the pod's held renders again (now) */
function again(pod, at, why) {
  const C = deps().core(), out = [];
  for (const h of due([...HOLD.values()], pod, at === undefined ? Date.now() : at)) {
    HOLD.delete(h.id);
    const old = C.jobs.get(h.id);
    if (!old) continue;                                   // cleared from the Queue = not wanted any more
    const params = JSON.parse(JSON.stringify(h.params));
    params._pod_retry = h.tries + 1; params._pod_retry_of = h.id;
    const j = C.makeJob(params, null, null, { project: h.project, local: true });
    C.log(j, `[pod] again (try ${h.tries + 2}): ${h.style} failed on the pod ${h.pod} at ${new Date(h.at).toLocaleTimeString()} - the pod is ready now` + (why ? " (" + why + ")" : ""));
    old.retried_as = j.id;
    C.log(old, `[pod] went again as job ${j.id} - the pod ${h.pod} is ready now`);
    out.push(j.id);
  }
  return out;
}
/** 2.781.0: a pod made again in place of another (lib/podWatchdog.js) - its waiting renders wait for the new one */
function move(from, to) { const a = pid(from), b = pid(to); let n = 0; if (!a || !b) return 0; for (const h of HOLD.values()) if (h.pod === a) { h.pod = b; n++; } return n; }
function held(pod) { const k = pod ? pid(pod) : ""; return [...HOLD.values()].filter((h) => !k || h.pod === k).map((h) => ({ id: h.id, pod: h.pod, style: h.style, at: h.at, tries: h.tries, why: h.why })); }
function drop(jobId) { return HOLD.delete(String(jobId || "")); }

// a pod job that ended well = something new on the pod
try { require("./podActivity").onFinish((pod, ok, text) => { if (ok) changed(pod, String(text || "").slice(0, 120)); }); } catch { /* without: only changed() */ }

module.exports = { MAX_TRIES, MAX_AGE, pid, due, hold, changed, again, held, drop, move, setDeps, HOLD };
