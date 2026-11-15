/* bitGen Studio — lib/podPick.js (2.787.0): THE PICKED MODEL DECIDES THE POD - a "<pod name>/<file>" model or LoRA from Basic
 * Settings' lists, or Basic Settings ▸ Use model / Use temporary LoRAs ▸ ☐ Remote + a pod, sends the render to that pod.
 *
 * Tim (verbatim, the agreed design): "the picked model decides where it runs" + "do the same for models in pods, but use pod
 * name/model name , also use the pods loras as pod name/lora name" + "in basic settings add a checkbox under use model, "remote",
 * so if user clicks a local model with this setting enabled bitgen will look for the model on civitai/hf and upload to a
 * selected pod (pod dropdown will be next remote checkbox, same with the loras"
 *   apply(params)  lib/core.js, before the pod gate (lib/stylePods.js gate): the job's style copy (params.style /
 *                  params.video_style) - its Override checkpoint (style.model), the video model (phases[0].model) and its
 *                  LoRAs - "<pod>/<file>" names become the plain file name and params.pod_pick = {pod_id, why}; none of those,
 *                  but Remote ticked for the kind (lib/basicUse.js *_pod) with an Override model / temporary LoRAs ->
 *                  that pod, and the files go onto it before the render (lib/podRevive.js modelGate -> lib/podSend.js ensure:
 *                  found online first - Civitai / Hugging Face - and downloaded by the pod, else sent from this computer).
 *                  Two different pods asked for = params.pod_pick.error (said, not rendered).
 *   wouldPod(kind, model, loras)  the page / the models-found check: does this pick render on a pod? -> {pod_id, why} | null
 * Pure (scripts/test-podinv787.js): picksOf.
 */
"use strict";
const MODEL_CATS = ["checkpoints", "diffusion_models", "unet"];

/** the pod refs in a style copy (pure) -> {refs: [{where, pod_id, rel, name}], fix(st)} - fix(st) rewrites them in place */
function picksOf(st, invs, resolve) {
  const refs = [];
  if (!st) return { refs, fix: () => {} };
  const r = (v, cats) => (v ? resolve(String(v), invs, cats) : null);
  const m = st.model_override || st.basic_model ? r(st.model, MODEL_CATS) : null;
  if (m) refs.push(Object.assign({ where: "model" }, m));
  const ph0 = Array.isArray(st.phases) && st.phases[0] ? st.phases[0] : null;
  const pm = ph0 && st.basic_model ? r(ph0.model, MODEL_CATS) : null;
  if (pm) refs.push(Object.assign({ where: "phase" }, pm));
  (Array.isArray(st.loras) ? st.loras : []).forEach((l, i) => {
    const n = l && (l.path || l.name || l.file);
    const x = r(n, ["loras"]);
    if (x) refs.push(Object.assign({ where: "lora", i, key: l.path ? "path" : l.name ? "name" : "file" }, x));
  });
  const fix = (s) => {
    for (const x of refs) {
      if (x.where === "model") s.model = x.rel;
      else if (x.where === "phase") { s.phases = s.phases.map((p, j) => (j === 0 ? Object.assign({}, p, { model: x.rel }) : p)); if (s.basic_model) s.basic_model = x.rel; }
      else if (x.where === "lora") s.loras = s.loras.map((l, j) => (j === x.i ? Object.assign({}, l, { [x.key]: x.rel }) : l));
    }
  };
  return { refs, fix };
}

/* ---------------- live */
function PI() { return require("./podInv"); }
function kindOfMode(mode) { try { return require("./gpuSplit").kindOf(mode); } catch { return null; } }
function apply(params) {
  const q = params || {};
  if (q.pod_pick_done) return q.pod_pick || null;
  q.pod_pick_done = true;
  const st = q.video_style || q.style;
  if (!st || ["pod", "api", "remote"].includes(st.runs_on)) return null;
  const kind = kindOfMode(q.mode);
  if (kind !== "image" && kind !== "video") return null;
  const P = picksOf(st, PI().live(), PI().resolve);
  if (P.refs.length) {
    const pods = [...new Set(P.refs.map((x) => x.pod_id))];
    if (pods.length > 1) {
      q.pod_pick = { error: "the picked files are on different pods (" + [...new Set(P.refs.map((x) => x.name))].join(", ") + ") - pick them from one pod, or send them to one (Basic Settings ▸ Remote)" };
      return q.pod_pick;
    }
    P.fix(st);
    q.pod_pick = { pod_id: pods[0], why: "picked " + P.refs.map((x) => x.name + "/" + x.rel).join(", ") };
    return q.pod_pick;
  }
  // ☐ Remote + a pod: the model / LoRAs picked on this computer go to that pod (found online first, else sent) and render there
  let R = { model: "", loras: "" }; try { R = require("./basicUse").remote(kind); } catch { /* none */ }
  const hasModel = !!(st.model_override && st.model) || !!st.basic_model, hasLoras = Array.isArray(st.temp_loras) && st.temp_loras.length > 0;
  const pod = (hasModel && R.model) || (hasLoras && R.loras) || "";
  if (!pod) return null;
  // the video model goes through modelGate like Override's checkpoint (lib/podRevive.js itemsOf)
  if (st.basic_model && !st.model_override) { st.model_override = true; st.model = st.basic_model; }
  q.pod_pick = { pod_id: pod, why: "Basic Settings ▸ " + (hasModel && R.model ? "Use model" : "Use temporary LoRAs") + " ▸ Remote (" + PI().nameOf(pod) + ")", remote: true };
  return q.pod_pick;
}
/** does this pick render on a pod? (the page's GET /api/stylepods/route, the models-found check) */
function wouldPod(kind, model, loras) {
  const k = kind === "image" ? "image" : "video", invs = PI().live();
  const m = model ? PI().resolve(model, invs, MODEL_CATS) : null;
  if (m) return { pod_id: m.pod_id, why: "the model is on the pod " + m.name };
  for (const l of loras || []) { const n = typeof l === "string" ? l : l && (l.path || l.name || l.file); const x = n ? PI().resolve(n, invs, ["loras"]) : null; if (x) return { pod_id: x.pod_id, why: "a LoRA is on the pod " + x.name }; }
  let R = { model: "", loras: "" }; try { R = require("./basicUse").remote(k); } catch { /* none */ }
  if (model && R.model) return { pod_id: R.model, why: "Basic Settings ▸ Use model ▸ Remote" };
  if ((loras || []).length && R.loras) return { pod_id: R.loras, why: "Basic Settings ▸ Use temporary LoRAs ▸ Remote" };
  return null;
}
module.exports = { MODEL_CATS, picksOf, apply, wouldPod };
