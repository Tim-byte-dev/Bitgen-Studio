// bitGen Studio — lib/styleConvert.js (3.14.1): a video style whose ComfyUI graph is CONVERTED from a UI export
// (routes/characters.js CONVERT_STYLES - MMH3_NativeAudio_MV: its ref2va graph comfy_workflows/MMH3_NativeAudio_MV.json is
// made from MMH3_NativeAudio_MV.ui.json with ComfyUI's /object_info) gets it converted before ANY job of it runs.
// Tim's log: "[worker] video style "MMH3_NativeAudio_MV": workflow for ref2va not found:
// E:\Bitgen-Studio\comfy_workflows\MMH3_NativeAudio_MV.json" - the scene board converted it (ensureChainBase), a plain
// Generate (the prompt docker, /api/generate) never did, so a fresh install that had never rendered a board could not render.
// lib/core.js pump() asks gate(params) before it starts a job (the same as the pod / card gates):
//   null                nothing to do (not such a style, or its converted graph is current)
//   {wait, note}        converting now (async - ComfyUI's /object_info); ask again in `wait` ms
//   {error}             it could not be converted - the job fails with the reason
//   {note}              converted just now (said in the job's log)
"use strict";
const path = require("path");
const state = new Map();                         // style name -> {done, r}
let C = null;
const chars = () => (C || (C = require("../routes/characters")));

/** which CONVERT_STYLES entry this job's video style renders through (by the graph file it names) -> name | null */
function needFor(params) {
  const st = params && params.video_style;
  if (!st) return null;
  const files = [st.workflow].concat(Object.values(st.workflows || {})).filter(Boolean).map((r) => path.basename(String(r)));
  if (!files.length) return null;
  const list = chars().CONVERT_STYLES || {};
  for (const [name, ch] of Object.entries(list)) if (ch && ch.ui && files.includes(ch.base)) return name;
  return null;
}

const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
/** ComfyUI up (started when it is not - its /object_info is where the node types come from), then the conversion */
async function convert(name, K, cf, waitMs) {
  try { await cf.objectInfo(5000); }
  catch {
    try { await cf.ensure({ force: true }); } catch { /* the conversion says it */ }
    const t0 = Date.now();
    while (Date.now() - t0 < (waitMs || 240000)) { await sleep(3000); try { await cf.objectInfo(5000); break; } catch { /* still starting */ } }
  }
  return K.ensureChainBase(name);
}

function gate(params, o) {
  let name = null;
  try { name = needFor(params); } catch { return null; }
  if (!name) return null;
  const K = (o && o.chars) || chars(), ch = K.CONVERT_STYLES[name];
  if (!state.has(name) && K.baseIsCurrent(ch)) return null;
  let s = state.get(name);
  if (!s) {
    s = { done: false, r: null };
    state.set(name, s);
    convert(name, K, (o && o.comfy) || require("./comfy"), o && o.waitMs).then((r) => { s.done = true; s.r = r || { ok: false, error: "no answer" }; })
      .catch((e) => { s.done = true; s.r = { ok: false, error: String((e && e.message) || e) }; });
    return { wait: 400, note: `the "${name}" style's ComfyUI graph (${ch.base}) is made from its export ${ch.ui} first - converting with ComfyUI's node list` };
  }
  if (!s.done) return { wait: 400 };
  state.delete(name);
  if (!s.r.ok) return { error: `the "${name}" style's ComfyUI graph ${ch.base} could not be made from ${ch.ui}: ${s.r.error}` };
  return { note: `${ch.base} made from ${ch.ui}` + (s.r.converted ? "" : " (already current)") + ((s.r.warnings || []).length ? " - " + s.r.warnings.length + " warning(s)" : "") };
}

module.exports = { gate, needFor, _state: state };
