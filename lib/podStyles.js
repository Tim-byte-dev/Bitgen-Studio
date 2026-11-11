// bitGen Studio — lib/podStyles.js (2.758.0): P_ STYLES MADE FROM WHAT IS ON A RUNPOD POD.
// Tim (verbatim): "when pods are chosen only show pod styles, I am trying with this pod ComfyUI - Qwen Image - ZiT - Boogu -
// Krea , how can i choose the model?" (asked: "Both" - the pod's models AND its saved workflows).
//   contents(pod)   the pod's ComfyUI through RunPod's proxy: its model files (object_info, as Settings' model lists read
//                   them - lib/comfyModels.js liveLists), the workflows saved in it (/api/userdata?dir=workflows), and for
//                   each model file bitGen knows, the bitGen style it fits (starterFor)
//   make(pod, picks) a P_ style per picked model (bitGen's own workflow for that model type, with the pod's file names put
//                   in: the model, and the text encoder / VAE closest to the ones the workflow names) and per picked
//                   workflow (the pod's own graph, turned into ComfyUI's API format with the pod's /object_info -
//                   lib/graphToApi.js); the graphs go to comfy_workflows/pod/. Pictures only for now - a video / song
//                   workflow is listed with the reason.
// A P_ style renders on its pod (lib/gpuSplit.js forJob); Basic Settings' Override style gives it steps / seed / CFG / size,
// never a checkpoint or LoRAs (routes/index.js).
// Pure (scripts/test-pods758.js): starterFor, closest, swapFiles, kindOfGraph, safeName, styleName.
"use strict";
const fs = require("fs");
const path = require("path");

const MODEL_CATS = ["diffusion_models", "checkpoints", "unet", "unet_gguf"];
/** bitGen's own picture style for a model file name (pure) -> the starter's name, or "" */
function starterFor(file) {
  const f = String(file || "").toLowerCase().split(/[\\/]/).pop();
  const gguf = /\.gguf$/.test(f);
  if (/qwen[-_. ]?image.*edit/.test(f)) return "Qwen Image Edit 2511";
  if (/qwen[-_. ]?image/.test(f)) return "qwen2_1";
  if (/z[-_. ]?image|zimage/.test(f)) return "R_Z-Image Turbo";
  if (/krea[-_. ]?2/.test(f)) return "Krea 2 " + (/turbo|distill/.test(f) ? "Turbo" : "Raw") + (gguf ? " GGUF" : "");
  if (/flux[-_. ]?1[-_. ]?krea|krea[-_. ]?dev|flux.*krea/.test(f)) return "R_FLUX.1 dev";
  if (/flux[-_. ]?1[-_. ]?schnell/.test(f)) return "R_FLUX.1 schnell";
  if (/flux[-_. ]?1[-_. ]?dev/.test(f)) return "R_FLUX.1 dev";
  if (/flux[-_. ]?2.*klein/.test(f)) return "FLUX.2 Klein 9B";
  if (/sd[-_. ]?3/.test(f)) return "R_SD3 Medium";
  if (/sd[-_. ]?xl|sdxl|illustrious|pony/.test(f)) return "SDXL";
  return "";
}
/** 2.761.0: bitGen's own style for a model file and the KIND of P_ style wanted (pure): "image" | "image_edit" | "video"
 *  -> the starter's name, or "" (that model has no style of that kind in bitGen) */
const KINDS = ["video", "llm", "vlm", "image", "image_edit"];
function starterOf(file, kind) {
  const f = String(file || "").toLowerCase().split(/[\\/]/).pop();
  if (kind === "image") { const s0 = starterFor(f); return /edit/i.test(s0) ? "" : s0; }
  if (kind === "image_edit") {
    if (/qwen[-_. ]?image/.test(f)) return /2[._]?1/.test(f) ? "Qwen Image 2.1 edit" : "Qwen Image Edit 2511";
    if (/kontext/.test(f)) return "FLUX.1 Kontext edit";
    if (/flux[-_. ]?2.*klein/.test(f)) return "FLUX.2 Klein 9B edit";
    if (/flux[-_. ]?3.*klein/.test(f)) return "FLUX 3 Klein edit";
    if (/p[-_. ]?h3/.test(f)) return "P-H3 Image Edit";
    if (/fibo/.test(f)) return "Fibo 2.0 Edit Turbo";
    if (/flux.*fill|fill.*flux/.test(f)) return "FLUX Fill inpaint";
    return "";
  }
  if (kind === "video") {
    if (/wan[-_. ]?2[._]?2/.test(f)) return "Wan 2.2";
    if (/wan[-_. ]?2[._]?1/.test(f)) return "Wan 2.1";
    if (/ltx[-_. ]?2[._]?5/.test(f)) return "LTX 2.5";
    if (/ltx/.test(f)) return "LTX 2.3";
    if (/minimax|(^|[^a-z])h3([^a-z0-9]|$)|mmh3/.test(f)) return "MiniMax H3 SS";
    return "";
  }
  return "";
}
const words = (s) => String(s || "").toLowerCase().replace(/\.[a-z0-9]+$/, "").split(/[^a-z0-9]+/).filter((w) => w.length > 1);
/** the pod file closest to the one a workflow names (pure): the same name, else the most shared words - "" = none share any */
function closest(want, have) {
  const list = (have || []).map(String);
  if (list.includes(want)) return want;
  const base = String(want).split(/[\\/]/).pop();
  const same = list.find((h) => h.split(/[\\/]/).pop() === base);
  if (same) return same;
  const w = new Set(words(want));
  let best = "", score = 0;
  for (const h of list) {
    const s = words(h).filter((x) => w.has(x)).length;
    if (s > score) { score = s; best = h; }
  }
  return score >= 1 ? best : "";
}
/** a bitGen API graph with the pod's files in its loaders (pure) -> {graph, swapped: [[from, to]], kept: [names]}
 *  cats = the pod's model lists {diffusion_models, checkpoints, text_encoders, vae, ...} */
function swapFiles(graph, model, cats) {
  const g = JSON.parse(JSON.stringify(graph || {})), swapped = [], kept = [];
  const c = cats || {};
  const pick = (key, name, pool) => {
    if (!name) return name;
    if (key === "model") { swapped.push([name, model]); return model; }
    const to = closest(name, pool);
    if (to && to !== name) { swapped.push([name, to]); return to; }
    if (!to) kept.push(name);
    return name;
  };
  const enc = [].concat(c.text_encoders || [], c.clip || []), vae = c.vae || [];
  for (const n of Object.values(g)) {
    if (!n || typeof n !== "object" || !n.inputs) continue;
    const t = String(n.class_type || ""), i = n.inputs;
    if ((t === "UNETLoader" || t === "UnetLoaderGGUF") && typeof i.unet_name === "string") i.unet_name = pick("model", i.unet_name);
    else if (t === "CheckpointLoaderSimple" && typeof i.ckpt_name === "string") i.ckpt_name = pick("model", i.ckpt_name);
    else if (/CLIPLoader/.test(t)) for (const k of Object.keys(i)) { if (/^clip_name\d?$/.test(k) && typeof i[k] === "string") i[k] = pick("te", i[k], enc); }
    else if (t === "VAELoader" && typeof i.vae_name === "string") i.vae_name = pick("vae", i.vae_name, vae);
  }
  return { graph: g, swapped, kept };
}
/** what an API graph makes (pure): "video" | "music" | "image" | "" (no output) */
function kindOfGraph(g) {
  const types = Object.values(g || {}).map((n) => String((n && n.class_type) || ""));
  if (types.some((t) => /SaveVideo|VideoCombine|CreateVideo|SaveWEBM|SaveAnimated/.test(t))) return "video";
  if (types.some((t) => /SaveAudio/.test(t))) return "music";
  if (types.some((t) => /SaveImage|PreviewImage|ImageSave/.test(t))) return "image";
  return "";
}
const safeName = (s) => String(s || "").replace(/\.json$/i, "").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
/** the P_ style's name (pure): P_<what> - the pod's name is in the style's pod_name, not its name */
function styleName(what) { return "P_" + safeName(what).replace(/^P_/, ""); }

/* ---------------- live */
function core() { return require("./core"); }
function rp() { return (((core().getConfig() || {}).rgpu) || {}).runpod || {}; }
function podUrl(id, port) { return require("./runpodApi").proxyUrl(id, +port || +rp().port || 8188); }
async function getJson(url, ms) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms || 20000) });
  if (!r.ok) { const e = new Error(`the pod's ComfyUI answered HTTP ${r.status} at ${url.replace(/^https?:\/\/[^/]+/, "")}`); e.status = 502; throw e; }
  return r.json();
}
/** -> {url, pod_id, models: {cat: [names]}, known: [{file, cat, starter}], workflows: [path]} */
async function contents(id, port) {
  const pid = String(id || "").replace(/[^A-Za-z0-9]/g, "");
  if (!pid) { const e = new Error("which pod?"); e.status = 400; throw e; }
  const url = podUrl(pid, port);
  try { await getJson(url + "/system_stats", 15000); }
  catch (e) { const x = new Error("the pod's ComfyUI is not answering yet - wait for \"pod loaded\" (" + (e.message || e) + ")"); x.status = 409; throw x; }
  const live = await require("./comfyModels").liveLists(url, { timeout: 20000 });
  const models = live.categories || {};
  const known = [];
  for (const cat of MODEL_CATS) for (const f of models[cat] || []) known.push({ file: f, cat, starter: starterFor(f) });
  let workflows = [];
  try {
    const w = await getJson(url + "/api/userdata?dir=workflows&recurse=true&split=false", 20000);
    workflows = (Array.isArray(w) ? w : []).map((x) => (typeof x === "string" ? x : (x && (x.path || x.name)) || "")).filter((x) => /\.json$/i.test(x));
  } catch { workflows = []; }
  return { url, pod_id: pid, models, known, workflows, warnings: live.warnings || [] };
}
/** picks = {models: [file], workflows: [path], pod_name, port} -> {made: [names], skipped: [{what, why}]} */
async function make(id, picks) {
  const o = picks || {}, S = require("./styles"), C = core();
  const have = await contents(id, o.port);
  const dir = path.join(C.BASE, "comfy_workflows", "pod");
  fs.mkdirSync(dir, { recursive: true });
  const made = [], skipped = [];
  const podFields = { runs_on: "pod", pod_id: have.pod_id, pod_name: String(o.pod_name || "").slice(0, 80), pod_port: +o.port || 0, pod_auto: true };
  // 2.761.0: how to make this pod again (its template, GPU, sizes, the files bitGen put on it) - lib/podRevive.js
  try { const rc = await require("./podRevive").recipe(have.pod_id); if (rc) podFields.pod_recipe = rc; } catch { /* a style without one still renders while its pod is there */ }
  const save = (st) => {
    const all = S.read(C.STYLES_DIR), old = all.find((x) => x.name === st.name);
    return S.save(C.STYLES_DIR, old ? Object.assign({}, old, st, { id: old.id }) : st);   // made again = updated, not a second one
  };
  // a P_ style per model: bitGen's workflow for its type, the pod's files in it
  // 2.761.0: with o.kinds (the pod's ticks in My pods) - one per model AND kind (image / image_edit / video), named
  // P_<file>, P_<file> edit, P_<file> video, marked pod_setup (Save in My pods owns them)
  const jobs = [];
  for (const file of o.models || []) {
    if (!o.kinds) { jobs.push({ file, kind: "" }); continue; }
    for (const kd of o.kinds) if (["image", "image_edit", "video"].includes(kd)) jobs.push({ file, kind: kd });
  }
  for (const { file, kind: wantKind } of jobs) {
    const k = have.known.find((x) => x.file === file);
    if (!k) { skipped.push({ what: file, why: "not on the pod" }); continue; }
    const starter = S.STARTER_STYLES.find((s) => s.name === (wantKind ? starterOf(file, wantKind) : k.starter));
    if (!starter) { if (!wantKind) skipped.push({ what: file, why: "bitGen has no workflow for this model type - use one of the pod's own workflows" }); continue; }
    let g; try { g = JSON.parse(fs.readFileSync(path.join(C.BASE, starter.workflow), "utf8")); } catch (e) { skipped.push({ what: file, why: "its workflow could not be read" }); continue; }
    const sw = swapFiles(g, file, have.models);
    const name = styleName(file.split(/[\\/]/).pop().replace(/\.(safetensors|gguf|ckpt|pt|bin)$/i, "") + (wantKind === "image_edit" ? " edit" : wantKind === "video" ? " video" : ""));
    const wf = path.join(dir, name.replace(/[^A-Za-z0-9._-]+/g, "_") + ".json");
    fs.writeFileSync(wf, JSON.stringify(sw.graph, null, 1));
    const st = Object.assign({}, starter, { id: undefined, name, workflow: path.relative(C.BASE, wf).split(path.sep).join("/"), model: "", vae: "",
      te: Array.isArray(starter.te) ? starter.te.map(() => "") : [""], loras: [] }, podFields,
      { pod_note: sw.kept.length ? "the pod has none of: " + sw.kept.join(", ") : "" }, wantKind ? { pod_setup: true, pod_kind: wantKind } : {});
    delete st.runpod_image; delete st.endpoint;
    try { made.push(save(st).name); } catch (e) { skipped.push({ what: file, why: e.message || String(e) }); }
  }
  // a P_ style per workflow: the pod's own graph
  if ((o.workflows || []).length) {
    let info = null;
    try { info = await getJson(have.url + "/object_info", 60000); } catch (e) { for (const w of o.workflows) skipped.push({ what: w, why: "the pod's node list could not be read (" + (e.message || e) + ")" }); }
    for (const w of info ? o.workflows : []) {
      if (!have.workflows.includes(w)) { skipped.push({ what: w, why: "not on the pod" }); continue; }
      let ui;
      try { ui = await getJson(have.url + "/api/userdata/" + encodeURIComponent("workflows/" + w), 30000); }
      catch (e) { skipped.push({ what: w, why: e.message || String(e) }); continue; }
      let api = ui;
      if (ui && Array.isArray(ui.nodes)) {
        let out; try { out = require("./graphToApi").convert(ui, info); } catch (e) { skipped.push({ what: w, why: e.message || String(e) }); continue; }
        if (!out.graph) { skipped.push({ what: w, why: "nodes the pod does not have: " + out.unknown.join(", ") }); continue; }
        api = out.graph;
      }
      const kind = kindOfGraph(api);
      if (kind !== "image") { skipped.push({ what: w, why: kind ? `a ${kind} workflow - P_ styles are pictures for now` : "it saves nothing (no Save Image)" }); continue; }
      const name = styleName(w.split("/").pop());
      const wf = path.join(dir, name.replace(/[^A-Za-z0-9._-]+/g, "_") + ".json");
      fs.writeFileSync(wf, JSON.stringify(api, null, 1));
      const st = Object.assign({ name, kind: "image", engine: "comfy", arch: "custom", workflow: path.relative(C.BASE, wf).split(path.sep).join("/"),
        model: "", vae: "", te: [""], loras: [], negative: "" }, podFields);
      try { made.push(save(st).name); } catch (e) { skipped.push({ what: w, why: e.message || String(e) }); }
    }
  }
  return { made, skipped };
}
/** 2.759.0: a pod made "for a style" (lib/pods.js create, rgpu.pod_for) has loaded: its P_ style(s) from the pod's models of
 *  that style's family -> {made, skipped} | null (nothing of that family on the pod) */
async function autoFor(id, styleId, o) {
  const S = require("./styles"), C = core(), st = S.byId(C.STYLES_DIR, String(styleId || ""));
  if (!st) return null;
  const have = await contents(id, (o || {}).port);
  const fam = (name) => { const s0 = S.STARTER_STYLES.find((x) => x.name === name); return s0 ? String(s0.arch || "") : ""; };
  const files = have.known.filter((k) => k.starter && (k.starter === st.name || fam(k.starter) === String(st.arch || ""))).map((k) => k.file);
  if (!files.length) return null;
  return make(id, { models: files, pod_name: (o || {}).pod_name || "", port: (o || {}).port || 0 });
}
module.exports = { KINDS, starterOf, autoFor, MODEL_CATS, starterFor, closest, swapFiles, kindOfGraph, safeName, styleName, contents, make };
