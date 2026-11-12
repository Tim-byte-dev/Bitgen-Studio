/* bitGen Studio — lib/remotePrep.js (2.767.0): REMOTE MODE PREPARES WHAT THE NEXT JOBS NEED - the picked video style's models
 * and node packs on its pod, and the LLM / Vision LLM where Basic Settings says they run.
 *
 * Tim (verbatim): "when in remote mode, prepare the llm and video models for remote use" + "give user option to use openrouter
 * or runpod for llm/vllm or local" (when: not answered - bitGen starts as soon as Remote is picked, in the background)
 *
 *   start({video_style_id, llm_file})   the page calls it when Remote is picked, when the Video style or the LLM changes
 *                                       in remote mode, and when an LLM choice is set to RunPod:
 *                                         video  lib/podPrep.js on the style's pod (its files, LoRAs, node packs - a bar
 *                                                each download) - the same as before a render, done ahead
 *                                         llm / vlm "runpod" + Pods -> set up on the pod when the first prompt is sent
 *                                         (lib/podLlm.js target - Tim: "when user presses enter button to send prompt to llm")
 *   status()    {pods_mode, engine_pods, where: {llm, vlm}, llm, vlm, video, openrouter_ready, vllm_ready}
 * Pure parts: none - the routes are routes/remotePrep.js.
 */
"use strict";
const VIDEO = { state: null };
function core() { return require("./core"); }
function rg() { return ((core().getConfig() || {}).rgpu) || {}; }
function enginePods() { try { const G = require("./gpuSplit"); return !!(G.engineOf(rg()) || {}).pods; } catch { return false; } }
function prepareVideo(styleId) {
  const S = require("./styles"), C = core(), SP = require("./stylePods");
  const st = (() => { try { return S.byId(C.STYLES_DIR, String(styleId || "")); } catch { return null; } })();
  if (!st) return;
  const cur = VIDEO.state;
  if (cur && cur.style_id === st.id && (cur.phase === "preparing" || cur.phase === "ready")) return;
  const p = SP.podFor(rg(), st, "video");
  if (!p) { VIDEO.state = { style_id: st.id, style: st.name, phase: "failed", note: "no pod for video styles yet - tick Video on a pod in PODS ▸ My pods", at: Date.now() }; return; }
  const V = VIDEO.state = { style_id: st.id, style: st.name, pod: p.pod_id, phase: "preparing", note: "starting", at: Date.now() };
  const say = (t) => { V.note = t; V.at = Date.now(); };
  require("./podPrep").prepare(p.pod_id, SP.portOf(rg(), p.pod_id), [st], { say }).then((r) => {
    if ((r.notThere || []).length) { V.phase = "failed"; say("not on the pod: " + r.notThere.join(", ") + (r.problems.length ? " (" + r.problems.join("; ") + ")" : "")); return; }
    if ((r.lacks || []).length) { V.phase = "failed"; say("its ComfyUI lacks " + r.lacks.join(", ")); return; }
    V.phase = "ready"; say(r.problems.length ? "ready - " + r.problems.join("; ") : "ready on the pod");
  }).catch((e) => { V.phase = "failed"; say(String((e && e.message) || e).slice(0, 300)); });
}
function start(o) {
  const x = o || {}, RM = require("./remoteModels"), PL = require("./podLlm");
  if (!RM.podsMode()) return status();
  if (x.video_style_id) prepareVideo(x.video_style_id);
  // the LLM / Vision LLM on the pod are set up when a prompt is first sent to them (Tim: "when user presses enter button to
  // send prompt to llm") - lib/podLlm.js target(); x.prepare_llm = now (a button may ask for it)
  if (enginePods() && x.prepare_llm) for (const k of PL.KINDS) if (require("./remoteLlm").hostOf(rg(), k) === "runpod") PL.prepare(k, { file: k === "llm" ? x.llm_file : "" });
  return status();
}
/** 2.768.0: where each runs now - the choice, else OpenRouter in Remote mode (lib/remoteLlm.js hostOf) */
function whereNow(PL) { const r = rg(), w = {}, RL = require("./remoteLlm"); for (const k of PL.KINDS) w[k] = PL.whereOf(r, k) || RL.hostOf(r, k); return w; }   // 2.770.0: "remote" = the Settings platform
function status() {
  const PL = require("./podLlm");
  let orReady = false, vllmReady = false;
  try { orReady = require("./openRouter").ready(); } catch { orReady = false; }
  try { const G = require("./gpuSplit"); vllmReady = !!(G.vllm ? G.vllm().endpoint : false); } catch { vllmReady = false; }
  return { pods_mode: require("./remoteModels").podsMode(), engine_pods: enginePods(), where: whereNow(PL), where_set: PL.cleanWhere(rg().llm_where), llm: PL.view("llm"), vlm: PL.view("vlm"),
    video: VIDEO.state ? { style: VIDEO.state.style, phase: VIDEO.state.phase, note: VIDEO.state.note } : null, openrouter_ready: orReady, vllm_ready: vllmReady };
}
module.exports = { start, status, prepareVideo, VIDEO };
