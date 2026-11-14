/* bitGen Studio — lib/podMade.js (2.769.1): A POD BITGEN MADE IS KNOWN AS ONE, AND SET UP BY ITSELF WHEN IT LOADS.
 *
 * Tim (verbatim): "when the pod is made with bitgen store that it was made with bitgen and automatically treat it as such,
 * don't wait for button press"
 *   stored        rgpu.pod_made[id] (lib/pods.js create - its recipe) AND on the pod itself: the env BITGEN_MADE=1 (RunPod keeps
 *                 it) - a pod bitGen made is known again from RunPod's list even when this computer's record is gone (adopt)
 *   set up        watch(id): once the new pod's ComfyUI answers, by itself, in the background - no render or button needed:
 *                   1 its ComfyUI updated (lib/podComfyUpdate.js auto - once; a failed update is tried again, 3 times at most)
 *                   2 the styles linked to it made ready on it - their files and node packs (lib/podPrep.js, the same as 💾 Save)
 *                   3 no pod in use yet = it is the one used (what "Use it" does)
 *                 then rgpu.pod_made[id].setup_at. resume() picks the watch up again after bitGen restarts.
 *   status(id)    {phase: waiting | setting up | ready | failed, note} for PODS ▸ My pods.
 * Pure (scripts/test-podmade7691.js): isMadeEnv. MARK = "BITGEN_MADE".
 */
"use strict";
const MARK = "BITGEN_MADE";
/** does RunPod's pod carry bitGen's mark? (pure) - env as {K: V} or ["K=V"] or [{key, value}] */
function isMadeEnv(p) {
  const e = (p && p.env) || {};
  if (Array.isArray(e)) return e.some((x) => (typeof x === "string" ? x === MARK + "=1" : x && x.key === MARK && String(x.value) === "1"));
  return String(e[MARK] || "") === "1";
}
function core() { return require("./core"); }
function rg() { return ((core().getConfig() || {}).rgpu) || {}; }
const pid = (x) => String(x || "").replace(/[^A-Za-z0-9]/g, "");
function madeOf(id) { return (rg().pod_made || {})[pid(id)] || null; }
function mark(id, fields) {
  const c = core().getConfig(), r = c.rgpu = c.rgpu || {}, k = pid(id);
  r.pod_made = Object.assign({}, r.pod_made || {}); r.pod_made[k] = Object.assign({}, r.pod_made[k] || {}, fields); core().setConfig(c);
}
const WATCH = {};   // pod -> {running, phase, note, at}
function status(id) { const w = WATCH[pid(id)]; return w ? { phase: w.phase, note: w.note, at: w.at, running: w.running } : null; }
/** a pod in RunPod's list with bitGen's mark but no record here (another install, a lost config): recorded + set up */
function adopt(p, port) {
  if (!p || !p.id || !isMadeEnv(p) || madeOf(p.id)) return false;
  mark(p.id, { port: +port || 8188, name: String(p.name || "").slice(0, 80), recovered: true });
  try { require("./pods").remember(p.id, p.name, "created"); } catch { /* the list says bitGen anyway */ }
  module.exports.watch(p.id, port);
  return true;
}
/** what a loaded pod bitGen made gets, by itself */
async function afterLoad(id, port, D, W) {
  const say = (t) => { W.note = t; W.at = Date.now(); };
  // 2.772.0: its own lines in the pod's activity (lib/podActivity.js - the PODS docker); the update's and the preparation's
  // lines are said there by themselves
  const PA = require("./podActivity"), own = (t) => { say(t); PA.note(id, t); };
  W.phase = "setting up";
  const u = await D.autoUpdate(id, port, say).catch((e) => ({ ok: false, why: String((e && e.message) || e) }));
  const problems = [];
  if (u && !u.ok) problems.push("ComfyUI not updated: " + (u.why || "it stopped"));
  // 2.773.0 (Tim: "if in any image mode then only upload or check image styles, if in video mode , then only upload/check the
  // video styles"): only the styles of the mode the prompt docker is in now - the others when you switch to their mode or render
  const all = D.styles(id), fm = D.forMode ? D.forMode(all) : { now: all, later: [] }, styles = fm.now;
  if (fm.later.length) own("left for " + (fm.kind === "image" ? "Video" : "Image") + " mode: " + fm.later.map((s) => s.name).join(", ") + " (made ready when you switch to it or render one)");
  if (styles.length) {
    own("making its styles ready: " + styles.map((s) => s.name).join(", "));
    const r = await D.prepare(id, port, styles, say).catch((e) => ({ problems: [String((e && e.message) || e)], notThere: [] }));
    (r.problems || []).forEach((p) => problems.push(p));
    if ((r.notThere || []).length) problems.push("not on it yet: " + r.notThere.join(", "));
  }
  // nothing in use yet = this pod is the one used (what "Use it" in PODS ▸ My pods does)
  try { if (D.useIfNone(id, port)) own("it is the pod in use now"); } catch { /* "Use it" still works */ }
  mark(id, { setup_at: Date.now() });
  W.phase = problems.length ? "failed" : "ready";
  say(problems.length ? problems.join("; ").slice(0, 1500) : "set up" + (u && u.version ? " - ComfyUI " + u.version : "") + (styles.length ? ", its styles ready" : ""));
  PA.finish(id, !problems.length, problems.length ? "set up with problems: " + problems.join("; ").slice(0, 600) : "set up and ready" + (u && u.version ? " - ComfyUI " + u.version : "") + (styles.length ? ", its styles ready" : ""));
  // 2.775.0: the audio engines ticked for the pod (Text to speech, Speech to text, Song separation - lib/podAudio.js)
  try { if (D.audio) D.audio(id); } catch { /* installed before its first job instead */ }
}
function defaults() {
  return {
    up: async (id, port) => !!(await require("./podModels").comfyAt(id, port)).url,
    audio: (id) => { const A = require("./podAudio"); if (A.kinds(id).length) A.install(id).catch(() => null); },
    // 2.772.0: a pod made from a template without ComfyUI (RunPod's PyTorch) - bitGen installs ComfyUI on it (lib/podInstall.js)
    installable: (id) => require("./podInstall").installable(id),
    blank: async (id, port) => { let w = null; try { w = await require("./podModels").ways(id, port); } catch { return false; } return require("./podInstall").looksBlank(id, w); },
    forMode: (styles) => require("./remotePrep").forMode(styles),   // 2.773.0
    install: (id, port, say) => require("./podInstall").ensure(id, port, say),
    autoUpdate: (id, port, say) => require("./podComfyUpdate").waitAuto(id, port, say).then((r) => r || { ok: true }),
    styles: (id) => { const S = require("./styles"), C = core(); return require("./stylePods").stylesOf(id).map((x) => { try { return S.byId(C.STYLES_DIR, x); } catch { return null; } }).filter(Boolean); },
    prepare: (id, port, styles, say) => require("./podPrep").prepare(id, port, styles, { say }),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    useIfNone: (id, port) => {
      const r = rg(); if ((r.runpod || {}).pod_id) return false;
      const RG = require("./remoteGpu"), m = madeOf(id) || {};
      RG.save({ runpod: { pod_id: pid(id), pod_name: m.name || pid(id), port: +port || +m.port || 8188 } }); RG.use("runpod");
      return true;
    },
  };
}
/** wait (45 min at most) for the pod bitGen made to load, then set it up - in the background; -> its watch */
function watch(id, port, deps) {
  const k = pid(id);
  if (!k || (WATCH[k] && WATCH[k].running)) return WATCH[k] || null;
  const W = WATCH[k] = { running: true, phase: "waiting", note: "waiting for the pod to load", at: Date.now() };
  // 2.781.0 (Tim: "check pod for activity, if no activity after 5 minutes terminate the pod and start a new pod (this is only on
  // first run for the pod …)"): a pod not set up yet is watched for signs of life (lib/podWatchdog.js)
  if (!deps) { try { require("./podWatchdog").start(k, port); } catch { /* the setup goes on without it */ } }
  try { require("./podActivity").note(k, "waiting for the pod to load"); } catch { /* fine */ }
  const D = Object.assign(defaults(), deps || {}), POLL = +(process.env.H3_POD_MADE_POLL || 15000), until = Date.now() + 45 * 60000;
  W.promise = (async () => {
    try {
      while (Date.now() < until) {
        if (!madeOf(k)) { W.phase = "failed"; W.note = "no longer a pod bitGen made (terminated?)"; return; }
        let ok = false; try { ok = await D.up(k, port); } catch { ok = false; }
        if (ok) { await afterLoad(k, port, D, W); return; }
        // 2.772.0 (Tim: "is there an empty pod template that we can install our comfy ui on from scratch" … "lets do that"): a
        // blank pod - its ComfyUI installed (or, after a restart, started) through its Jupyter, then it is set up as any other
        if (D.installable && (D.installable(k) || (D.blank && await D.blank(k, port).catch(() => false)))) {   // 2.773.1: blank by what it is
          W.phase = "installing";
          const r = await D.install(k, port, (t) => { W.note = t; W.at = Date.now(); }).catch((e) => ({ ok: false, why: String((e && e.message) || e) }));
          if (r && r.ok) { await afterLoad(k, port, D, W); return; }
          W.phase = "failed"; W.note = "ComfyUI was not installed on the pod: " + ((r && r.why) || "it stopped"); return;
        }
        await D.sleep(POLL);
      }
      W.phase = "failed"; W.note = "the pod did not load in 45 minutes - it is set up when a render first uses it";
    } catch (e) { W.phase = "failed"; W.note = String((e && e.message) || e).slice(0, 400); }
    finally { W.running = false; W.at = Date.now(); }
  })();
  return W;
}
/** after bitGen starts: pods it made that were never set up are watched again */
function resume(deps) {
  const out = [];
  for (const [id, m] of Object.entries(rg().pod_made || {})) if (m && !m.setup_at) { const w = watch(id, m.port || 0, deps); if (w) out.push(id); }
  return out;
}
module.exports = { MARK, isMadeEnv, madeOf, adopt, watch, resume, status, afterLoad, WATCH };
