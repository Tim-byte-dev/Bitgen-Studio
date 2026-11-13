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
 * 2.773.0 (Tim: "if in any image mode then only upload or check image styles, if in video mode , then only upload/check the
 * video styles"): start() also gets the prompt docker's Generate mode (gen_mode) and the Image style (image_style_id) -
 *   image modes (🖼 Image, ⚙ Graph)    the picked IMAGE style is made ready on its pod (nothing of the video styles)
 *   video modes (🎬 Video, 🎶 Music)   the picked VIDEO style (as before)
 *   the rest (Speech, Chat)            no style
 * and the mode is kept (MODE) so a pod setting itself up / 💾 Save / a preset makes ready only the styles of that kind
 * (wants(st)); the others are made ready when you switch to their mode, or when a render first uses them.
 * Pure (scripts/test-modeprep773.js): kindOfGen, fits.
 */
"use strict";
const VIDEO = { state: null }, IMAGE = { state: null };
const MODE = { kind: null, gen: "", at: 0 };   // 2.773.0: the prompt docker's Generate mode, as the page said it last
const BOX = { image: IMAGE, video: VIDEO };
/** the kind of styles a Generate mode renders (pure): "image" | "video" | null (no style - Speech, Chat, unknown) */
function kindOfGen(m) {
  const g = String(m || "").toLowerCase();
  if (["image", "graph", "imgupscale", "edit"].includes(g)) return "image";
  if (["video", "audio", "music", "t2va", "ref2va", "fl2va", "swap"].includes(g)) return "video";
  return null;
}
/** does a style belong to the kind of the mode (pure)? kind null = every style */
function fits(st, kind) {
  if (!kind) return true;
  const k = String((st || {}).kind || "image");
  return kind === "video" ? (k === "video" || k === "music") : !(k === "video" || k === "music");
}
/** 2.773.0: the styles of the mode the page is in (all of them when it has not said) - lib/podMade.js, lib/podSetup.js,
 *  routes/stylePods.js, lib/podPresets.js; -> {now: [styles], later: [styles of the other kind]} */
function forMode(styles) {
  const k = MODE.kind, now = [], later = [];
  for (const s of styles || []) (fits(s, k) ? now : later).push(s);
  return { now, later, kind: k };
}
function wants(st) { return fits(st, MODE.kind); }
function core() { return require("./core"); }
function rg() { return ((core().getConfig() || {}).rgpu) || {}; }
function enginePods() { try { const G = require("./gpuSplit"); return !!(G.engineOf(rg()) || {}).pods; } catch { return false; } }
function prepareVideo(styleId) { return prepareStyle(styleId, "video"); }
/** the picked style of a kind made ready on its pod (2.773.0: image too) */
function prepareStyle(styleId, box) {
  const S = require("./styles"), C = core(), SP = require("./stylePods"), B = BOX[box] || VIDEO;
  const st = (() => { try { return S.byId(C.STYLES_DIR, String(styleId || "")); } catch { return null; } })();
  if (!st) return;
  const cur = B.state;
  if (cur && cur.style_id === st.id && (cur.phase === "preparing" || cur.phase === "ready")) return;
  const p = SP.podFor(rg(), st, box === "video" ? "video" : SP.kindOfStyle(st));
  if (!p) { B.state = { style_id: st.id, style: st.name, phase: "failed", note: "no pod for " + box + " styles yet - tick " + (box === "video" ? "Video" : "Image") + " on a pod in PODS ▸ My pods", at: Date.now() }; return; }
  const V = B.state = { style_id: st.id, style: st.name, pod: p.pod_id, phase: "preparing", note: "starting", at: Date.now() };
  const say = (t) => { V.note = t; V.at = Date.now(); };
  require("./podPrep").prepare(p.pod_id, SP.portOf(rg(), p.pod_id), [st], { say }).then((r) => {
    if ((r.notThere || []).length) { V.phase = "failed"; say("not on the pod: " + r.notThere.join(", ") + (r.problems.length ? " (" + r.problems.join("; ") + ")" : "")); return; }
    if ((r.lacks || []).length) { V.phase = "failed"; say("its ComfyUI lacks " + r.lacks.join(", ")); return; }
    V.phase = "ready"; say(r.problems.length ? "ready - " + r.problems.join("; ") : "ready on the pod");
  }).catch((e) => { V.phase = "failed"; say(String((e && e.message) || e).slice(0, 300)); });
}
function start(o) {
  const x = o || {}, RM = require("./remoteModels"), PL = require("./podLlm");
  // 2.773.0: the Generate mode decides which style is made ready (an older page sends no gen_mode = the video style, as before)
  if (x.gen_mode !== undefined) { MODE.kind = kindOfGen(x.gen_mode); MODE.gen = String(x.gen_mode || ""); MODE.at = Date.now(); }
  if (!RM.podsMode()) return status();
  const k = x.gen_mode !== undefined ? MODE.kind : "video";
  if (k === "video" && x.video_style_id) prepareStyle(x.video_style_id, "video");
  if (k === "image" && x.image_style_id) prepareStyle(x.image_style_id, "image");
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
    video: VIDEO.state ? { style: VIDEO.state.style, phase: VIDEO.state.phase, note: VIDEO.state.note } : null,
    image: IMAGE.state ? { style: IMAGE.state.style, phase: IMAGE.state.phase, note: IMAGE.state.note } : null, mode: MODE.kind,   // 2.773.0
    openrouter_ready: orReady, vllm_ready: vllmReady };
}
module.exports = { start, status, prepareVideo, prepareStyle, kindOfGen, fits, forMode, wants, VIDEO, IMAGE, MODE };
