// bitGen Studio — lib/podSetup.js (2.761.0): WHAT A POD IS FOR - the ticks under its name in the PODS docker's My pods.
// Tim (verbatim): "make each pod name in my pods a accordian menuitem, add folder, checkpoint and add lora to each pod in my
// pod upload those files to the checkpoint and lora folder in the runpod pod comfyui space , add checkboxes under the pod
// name to tell if it is a video,llm,vllm,image,image-edit style. add a save button to the menu item that is disabled until
// changes are made and disabled again after save unless new changes are made. this will save the style P_"
// (asked: LLM / vLLM ticked = "Use the pod's LLM server")
//   config rgpu.pod_cfg.<podId> = {kinds: ["image", "image_edit", "video", "llm", "vlm"], llm: {port, model, vlm_model}}
//   💾 Save:
//     image / image_edit / video  P_ styles from the pod's model files for each ticked kind (lib/podStyles.js make with kinds:
//                                 P_<file>, P_<file> edit, P_<file> video, pod_setup: true); this pod's pod_setup styles of a
//                                 kind no longer ticked are removed (the ones 🎨 Styles made are left alone)
//     llm / vlm                   the prompt LLM / the picture-describing model talk to an OpenAI-compatible server ON the pod
//                                 (vLLM, Ollama …) at its port through RunPod's proxy: rgpu.pod_llm / rgpu.pod_vlm =
//                                 {pod_id, pod_name, port, model} - one pod each (ticking it on another pod moves it);
//                                 lib/gpuSplit.js llmTarget uses it while Remote generation is on RunPod ▸ Pods
// Pure (scripts/test-podsetup761.js): cleanSetup, viewOf, llmTargetOf.
"use strict";
const KINDS = ["video", "llm", "vlm", "image", "image_edit"];
const STYLE_KINDS = ["image", "image_edit", "video"];
const pid = (id) => String(id || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 40);

/** the body of a Save, tidied (pure) -> {kinds, llm: {port, model, vlm_model}} */
function cleanSetup(b) {
  const o = b || {}, kinds = KINDS.filter((k) => (o.kinds || []).includes(k)), l = o.llm || {};
  const port = Math.round(+l.port) || 8000;
  return { kinds, llm: { port: port >= 1 && port <= 65535 ? port : 8000, model: String(l.model || "").trim().slice(0, 200), vlm_model: String(l.vlm_model || "").trim().slice(0, 200) } };
}
/** one pod's setup as the docker shows it (pure): its ticks, its LLM server, whether the app's LLM / vision LLM is on it */
function viewOf(rgpu, id) {
  const r = rgpu || {}, p = pid(id), c = ((r.pod_cfg || {})[p]) || {};
  const s = cleanSetup(c);
  // the ticks for llm / vlm follow where the LLM really is (another pod's Save may have moved it)
  s.kinds = s.kinds.filter((k) => (k === "llm" ? (r.pod_llm || {}).pod_id === p : k === "vlm" ? (r.pod_vlm || {}).pod_id === p : true));
  return Object.assign(s, { pod_id: p, llm_here: (r.pod_llm || {}).pod_id === p, vlm_here: (r.pod_vlm || {}).pod_id === p });
}
/** the LLM / vision LLM on a pod (pure) -> {url, model, headers, label, pod_id} | null - only while Remote generation is on
 *  and on RunPod ▸ Pods; the proxy address is proxyUrl(pod, port) + /v1/chat/completions */
function llmTargetOf(rgpu, kind, proxyUrl, on) {
  if (!on) return null;
  const r = rgpu || {}, t = kind === "vlm" ? r.pod_vlm : r.pod_llm;
  if (!t || !t.pod_id) return null;
  return { url: proxyUrl(t.pod_id, +t.port || 8000).replace(/\/+$/, "") + "/v1/chat/completions", model: String(t.model || ""), headers: {},
    label: `the ${kind === "vlm" ? "vision LLM" : "LLM"} on RunPod pod ${t.pod_name || t.pod_id} (port ${+t.port || 8000})`, pod_id: t.pod_id, kind };
}

/* ---------------- live */
function core() { return require("./core"); }
function rg() { return ((core().getConfig() || {}).rgpu) || {}; }
function view(id) { return viewOf(rg(), id); }
/** Save -> {setup, made, removed, skipped, llm, vlm} */
async function save(id, b) {
  const p = pid(id);
  if (!p) { const e = new Error("which pod?"); e.status = 400; throw e; }
  const s = cleanSetup(b), o = b || {}, PS = require("./podStyles"), S = require("./styles"), C = core();
  const out = { made: [], removed: [], skipped: [] };
  // P_ styles for the ticked kinds, from the pod's model files
  const want = s.kinds.filter((k) => STYLE_KINDS.includes(k));
  if (want.length) {
    const have = await PS.contents(p, o.port);
    const r = await PS.make(p, { models: have.known.map((k) => k.file), kinds: want, pod_name: o.pod_name || "", port: o.port || 0 });
    out.made = r.made; out.skipped = r.skipped;
    if (!r.made.length) out.skipped.push({ what: want.join(", "), why: "none of the pod's model files has a bitGen " + want.map((k) => k.replace("_", " ")).join(" / ") + " workflow - add a checkpoint, or use 🎨 Styles with the pod's own workflows" });
  }
  // this pod's Save-made P_ styles of kinds no longer ticked
  for (const st of S.read(C.STYLES_DIR)) {
    if (st.runs_on !== "pod" || !st.pod_setup || st.pod_id !== p || want.includes(st.pod_kind)) continue;
    try { S.remove(C.STYLES_DIR, st.id); out.removed.push(st.name); } catch (e) { out.skipped.push({ what: st.name, why: e.message || String(e) }); }
  }
  // the LLM / vision LLM
  const c = C.getConfig(), r = c.rgpu = c.rgpu || { mode: "local" };
  r.pod_cfg = Object.assign({}, r.pod_cfg || {}, { [p]: s });
  const name = String(o.pod_name || "").slice(0, 80);
  if (s.kinds.includes("llm")) r.pod_llm = { pod_id: p, pod_name: name, port: s.llm.port, model: s.llm.model };
  else if ((r.pod_llm || {}).pod_id === p) delete r.pod_llm;
  if (s.kinds.includes("vlm")) r.pod_vlm = { pod_id: p, pod_name: name, port: s.llm.port, model: s.llm.vlm_model || s.llm.model };
  else if ((r.pod_vlm || {}).pod_id === p) delete r.pod_vlm;
  // another pod that had them is not ticked for them any more
  for (const [k, cfg] of Object.entries(r.pod_cfg)) {
    if (k === p) continue;
    const ks = (cfg.kinds || []).filter((x) => !((x === "llm" && s.kinds.includes("llm")) || (x === "vlm" && s.kinds.includes("vlm"))));
    r.pod_cfg[k] = Object.assign({}, cfg, { kinds: ks });
  }
  C.setConfig(c);
  return Object.assign(out, { setup: viewOf(r, p), llm: !!r.pod_llm && r.pod_llm.pod_id === p, vlm: !!r.pod_vlm && r.pod_vlm.pod_id === p });
}
/** lib/gpuSplit.js llmTarget: the pod's LLM server, the model asked of it when none is typed */
const MODEL = {};
async function llmTarget(kind) {
  const G = require("./gpuSplit"), on = G.enabled() && (G.engineOf(rg()) || {}).pods;
  const t = llmTargetOf(rg(), kind, require("./runpodApi").proxyUrl, on);
  if (!t) return null;
  if (!t.model) {
    const base = t.url.replace(/\/chat\/completions$/, "");
    if (!MODEL[base]) {
      const r = await fetch(base + "/models", { signal: AbortSignal.timeout(30000) }).catch(() => null);
      const j = r && r.ok ? await r.json().catch(() => ({})) : {};
      const m = j && Array.isArray(j.data) && j.data[0] && j.data[0].id;
      if (!m) throw new Error(`the LLM server on pod ${t.pod_id} (port ${base.match(/-(\d+)\./) ? base.match(/-(\d+)\./)[1] : "?"}) did not say which model it serves - type its model in My pods`);
      MODEL[base] = m;
    }
    t.model = MODEL[base];
  }
  return t;
}
module.exports = { KINDS, STYLE_KINDS, cleanSetup, viewOf, llmTargetOf, view, save, llmTarget };
