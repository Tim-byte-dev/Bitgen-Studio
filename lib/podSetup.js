// bitGen Studio — lib/podSetup.js (2.761.0): WHAT A POD IS FOR - the ticks under its name in the PODS docker's My pods.
// Tim (verbatim): "make each pod name in my pods a accordian menuitem, add folder, checkpoint and add lora to each pod in my
// pod upload those files to the checkpoint and lora folder in the runpod pod comfyui space , add checkboxes under the pod
// name to tell if it is a video,llm,vllm,image,image-edit style. add a save button to the menu item that is disabled until
// changes are made and disabled again after save unless new changes are made. this will save the style P_"
// (asked: LLM / vLLM ticked = "Use the pod's LLM server")
//   config rgpu.pod_cfg.<podId> = {kinds: ["image", "image_edit", "video", "llm", "vlm"], llm: {port, model, vlm_model}}
//   💾 Save (2.763.0 - Tim: "can we use a dropdown of our styles for the mode selected ... add an all button so that it shows
//   all styles. then we send our styles workflow to the pod ... we reuse the same styles, no p_"):
//     styles                      your styles linked to this pod (rgpu.style_pods {style id: pod id}) and made ready on it
//                                 (lib/podPrep.js: their files, LoRAs and node packs) - no P_ copies any more
//     image / image_edit / video  this pod renders every style of that kind that has no pod of its own - ONE pod per kind
//                                 (ticking it here takes it from another pod); all ticked on one pod = "the one pod"
//     llm / vlm                   the prompt LLM / the picture-describing model talk to an OpenAI-compatible server ON the pod
//                                 (vLLM, Ollama …) at its port through RunPod's proxy: rgpu.pod_llm / rgpu.pod_vlm =
//                                 {pod_id, pod_name, port, model} - one pod each (ticking it on another pod moves it);
//                                 lib/gpuSplit.js llmTarget uses it while Remote generation is on RunPod ▸ Pods
// Pure (scripts/test-podsetup761.js): cleanSetup, viewOf, llmTargetOf.
"use strict";
const KINDS = ["video", "llm", "vlm", "image", "image_edit"];
const STYLE_KINDS = ["image", "image_edit", "video"];
const pid = (id) => String(id || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 40);

/** the body of a Save, tidied (pure) -> {kinds, llm: {port, model, vlm_model}, styles: [style ids]}
 *  2.763.0: the checkpoint / LoRA dropdowns are gone - a pod runs your STYLES (their files go with them, lib/podPrep.js) */
function cleanSetup(b) {
  const o = b || {}, kinds = KINDS.filter((k) => (o.kinds || []).includes(k)), l = o.llm || {};
  const port = Math.round(+l.port) || 8000;
  const styles = [...new Set((Array.isArray(o.styles) ? o.styles : []).map((x) => String(x || "").replace(/[^\w.-]/g, "").slice(0, 80)).filter(Boolean))].slice(0, 40);
  return { kinds, llm: { port: port >= 1 && port <= 65535 ? port : 8000, model: String(l.model || "").trim().slice(0, 200), vlm_model: String(l.vlm_model || "").trim().slice(0, 200) }, styles };
}
/** one pod's setup as the docker shows it (pure): its ticks (each kind on one pod - another pod's Save may have taken it),
 *  its LLM server, whether the app's LLM / vision LLM is on it, the styles linked to it (rgpu.style_pods) */
function viewOf(rgpu, id) {
  const r = rgpu || {}, p = pid(id), c = ((r.pod_cfg || {})[p]) || {};
  const s = cleanSetup(c);
  s.kinds = s.kinds.filter((k) => (k === "llm" ? (r.pod_llm || {}).pod_id === p : k === "vlm" ? (r.pod_vlm || {}).pod_id === p : true));
  const links = r.style_pods || {};
  s.styles = Object.keys(links).filter((k) => String(links[k]) === p);
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
function view(id) {
  const p = pid(id);
  let prep = null; try { prep = require("./podPrep").status(p); } catch { prep = null; }
  let run = null; try { run = require("./stylePods").status(p); } catch { run = null; }
  let nodes = null; try { nodes = require("./podNodes").status(p); } catch { nodes = null; }   // 2.763.1
  return Object.assign(viewOf(rg(), id), { sending: require("./podSend").status(p), prep, run, nodes });
}
/** Save -> {setup, llm, vlm, preparing}: the ticks (one pod per kind), the LLM server, the styles linked to this pod - made
 *  ready on it in the background when it is running (lib/podPrep.js) */
async function save(id, b) {
  const p = pid(id);
  if (!p) { const e = new Error("which pod?"); e.status = 400; throw e; }
  const s = cleanSetup(b), o = b || {}, C = core(), SP = require("./stylePods"), S = require("./styles");
  // the styles: only ones that exist
  s.styles = s.styles.filter((x) => { try { return !!S.byId(C.STYLES_DIR, x); } catch { return false; } });
  SP.setStylesOf(p, s.styles);
  const c = C.getConfig(), r = c.rgpu = c.rgpu || { mode: "local" };
  r.pod_cfg = Object.assign({}, r.pod_cfg || {}, { [p]: { kinds: s.kinds, llm: s.llm } });
  const name = String(o.pod_name || "").slice(0, 80);
  if (s.kinds.includes("llm")) r.pod_llm = { pod_id: p, pod_name: name, port: s.llm.port, model: s.llm.model };
  else if ((r.pod_llm || {}).pod_id === p) delete r.pod_llm;
  if (s.kinds.includes("vlm")) r.pod_vlm = { pod_id: p, pod_name: name, port: s.llm.port, model: s.llm.vlm_model || s.llm.model };
  else if ((r.pod_vlm || {}).pod_id === p) delete r.pod_vlm;
  // 2.763.0 (Tim: "allow the user to have a separate pod for each type of style ... otherwise we use the one pod"): ONE pod
  // per kind - another pod ticked for a kind this one takes now loses that tick
  for (const [k, cfg] of Object.entries(r.pod_cfg)) {
    if (k === p) continue;
    r.pod_cfg[k] = Object.assign({}, cfg, { kinds: (cfg.kinds || []).filter((x) => !s.kinds.includes(x)) });
  }
  C.setConfig(c);
  const out = { setup: viewOf(r, p), llm: !!r.pod_llm && r.pod_llm.pod_id === p, vlm: !!r.pod_vlm && r.pod_vlm.pod_id === p, preparing: false };
  // make the styles ready on it now when its ComfyUI answers (else when a render first needs it)
  if (s.styles.length) {
    const port = +o.port || SP.portOf(r, p);
    let up = false; try { await require("./podModels").ways(p, port); up = true; } catch { up = false; }
    if (up) {
      // 2.773.0: only the styles of the prompt docker's mode now (lib/remotePrep.js forMode) - the others later
      const fm = require("./remotePrep").forMode(s.styles.map((x) => S.byId(C.STYLES_DIR, x)).filter(Boolean));
      if (fm.now.length) { require("./podPrep").prepare(p, port, fm.now).catch(() => null); out.preparing = true; }
      out.later = fm.later.map((x) => x.name); out.mode = fm.kind;
    }
  }
  return out;
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
