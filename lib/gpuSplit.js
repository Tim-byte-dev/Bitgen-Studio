// bitGen Studio — lib/gpuSplit.js (2.745.0): BASIC SETTINGS ▸ GPU - which work runs on the remote GPU, which here.
// Tim (verbatim): "add a accordian menu item to basic settings - GPU - add checkboxes remote,local, both - if both, add
// checkboxes - llm,vllm,image,video" -> vllm = the VISION LLM (the describe model); ticked = runs on the remote GPU; the
// LLMs' remote = a RunPod vLLM endpoint (RunPod's vLLM worker, OpenAI-compatible: /v2/<id>/openai/v1, the same key).
//
//   rgpu.split = {where: "remote"|"local"|"both", llm, vlm, image, video}     rgpu.remote_mode = the remote GPU set up in
//   Settings ▸ Remote GPU (url | runpod | ssh | serverless - lib/remoteGpu.js remembers the last one Use it chose)
//   rgpu.vllm = {endpoint, model, vlm_endpoint, vlm_model}  (blank vision endpoint = the LLM's; blank model = asked of
//               the endpoint's /openai/v1/models)
//   REMOTE  every job on the remote GPU (= Settings ▸ Remote GPU ▸ Use it); the LLMs on the vLLM endpoint when one is set
//   LOCAL   everything on this computer (= This computer); the remote stays set up for later
//   2.746.0: a style says where it runs (runs_on / endpoint - lib/styles.js): in BOTH the style decides (decide()); the
//           style lists show only the local styles on Local, only the remote ones on Remote (lib/rpslStyles.js)
//   BOTH    ComfyUI's address stays THIS computer's (its ComfyUI starts as before); a job of a ticked kind gets the remote's
//           address in its own job.json (forJob - core.js), the rest render here. Image = pictures (image, upscale, a
//           graph, 3D); Video = video jobs AND songs (music) - every ComfyUI job that is not a picture; jobs that do not
//           use ComfyUI (export, karaoke, bridges, the native engine, training) always run here.
//           LLM / Vision LLM ticked = llmTarget() hands lib/llmChat.js, lib/quickPrompt.js, lib/captioner.js the vLLM
//           endpoint instead of llama-server here.
// Pure: kindOf, routeOf, decide, slsChatUrl (scripts/test-gpusplit745.js, test-remotestyles746.js).
"use strict";

const WHERE = ["remote", "local", "both"];
const BOXES = ["llm", "vlm", "image", "video"];
const IMAGE_MODES = ["image", "imgupscale", "graph", "mesh3d"];
// never ComfyUI: ffmpeg, the native engine, installs, training
const HERE_MODES = ["export", "karaoke", "bridge", "viggle_native", "flowhmr", "lora_train", "install_aitoolkit", "install_unsloth", "ft_llm", "ft_vision", "lora_merge"];

/** a job mode -> "image" | "video" | null (null = never leaves this computer) (pure) */
function kindOf(mode) {
  const m = String(mode || "");
  if (HERE_MODES.includes(m) || /^install_/.test(m)) return null;
  return IMAGE_MODES.includes(m) ? "image" : "video";
}
/** where a kind of work runs (pure): split + whether a remote is set up -> "remote" | "local" */
function routeOf(kind, split, hasRemote) {
  const s = split || {};
  if (!kind || !hasRemote) return "local";
  if (s.where === "remote") return "remote";
  if (s.where === "both") return s[kind] ? "remote" : "local";
  return "local";
}
const API = () => (process.env.H3_RUNPOD_SLS_API || "https://api.runpod.ai/v2").replace(/\/+$/, "");
/** RunPod's vLLM worker's OpenAI route (pure) */
const slsChatUrl = (ep) => `${API()}/${String(ep || "").replace(/[^A-Za-z0-9_-]/g, "")}/openai/v1/chat/completions`;

/* ---------------- live */
function core() { return require("./core"); }
function R() { return require("./remoteGpu"); }
function rg() { return ((core().getConfig() || {}).rgpu) || {}; }
/** the split as saved; an install from before = what Remote GPU is doing now */
function split() {
  const r = rg(), s = r.split || {};
  const where = WHERE.includes(s.where) ? s.where : (r.mode && r.mode !== "local" ? "remote" : "local");
  const o = { where };
  for (const b of BOXES) o[b] = !!s[b];
  return o;
}
/** the remote GPU set up in Settings ▸ Remote GPU -> describe() or null */
function remote() {
  const r = rg();
  const mode = r.mode && r.mode !== "local" ? r.mode : r.remote_mode;
  if (!mode || mode === "local") return null;
  const d = R().describe(Object.assign({}, r, { mode }));
  return d.url ? d : null;
}
function vllm() { const v = rg().vllm || {}; return { endpoint: String(v.endpoint || ""), model: String(v.model || ""), vlm_endpoint: String(v.vlm_endpoint || ""), vlm_model: String(v.vlm_model || "") }; }
function view() {
  const sp = split(), rm = remote(), v = vllm();
  return Object.assign(sp, { remote: rm ? { mode: rm.mode, label: rm.label } : null, vllm: v, vllm_ready: !!(v.endpoint && ((rg().runpod || {}).key)),
    routes: { image: routeOf("image", sp, !!rm), video: routeOf("video", sp, !!rm), llm: llmRoute("llm", sp), vlm: llmRoute("vlm", sp) } });
}
/** BASIC SETTINGS ▸ GPU: save the choice and put ComfyUI's address where it belongs */
function set(b) {
  const c = core().getConfig(), r = c.rgpu = c.rgpu || { mode: "local" };
  const was = split();
  const sp = Object.assign({}, was);
  if (b && WHERE.includes(b.where)) sp.where = b.where;
  for (const k of BOXES) if (b && k in b) sp[k] = !!b[k];
  const rm = remote();
  if (sp.where === "remote" && !rm) { const e = new Error("set up a remote GPU first - Settings ▸ Remote GPU (a pod, RunPod Serverless, another computer or an SSH tunnel), then Use it"); e.status = 400; throw e; }
  r.split = sp; core().setConfig(c);
  // ComfyUI's address: the remote one for Remote, this computer's for Local / Both (its ComfyUI then starts as before)
  if (sp.where === "remote" && rg().mode === "local") R().use(rm.mode, { keepSplit: true });
  if (sp.where !== "remote" && rg().mode !== "local") R().use("local", { keepSplit: true });
  if (sp.where === "both" && rm && rm.mode === "ssh") R().tunnel(true);   // Both's remote jobs go through the tunnel
  return view();
}
/** 2.746.0: where ONE job renders (pure): kind, its style (runs_on / endpoint) or null, the split, the remote GPU
 *  (describe() or null), the serverless adapter's base + the key -> {route, target, why}
 *    Local = here; Remote = the remote; Both = the STYLE decides (Tim: "The style decides") - a remote style there, a
 *    local style here; a job with no style (an upscale, a graph, the video template) follows the Image / Video boxes.
 *    A remote style's own endpoint wins over the remote GPU's (it is a RunPod Serverless endpoint, the same key). */
function decide(kind, st, sp, rm, sls) {
  if (!kind) return { route: "local", target: null, why: "" };
  const s = sp || {}, remoteStyle = !!st && st.runs_on === "remote";
  const route = s.where === "remote" ? "remote" : s.where === "local" ? "local"
    : st ? (remoteStyle ? "remote" : "local") : (s[kind] ? "remote" : "local");
  if (route === "local") return { route, target: null, why: "" };
  if (remoteStyle && st.endpoint && sls && sls.key)
    return { route, target: { url: `${sls.base}/ep/${st.endpoint}`, label: "RunPod Serverless " + st.endpoint, mode: "serverless", cost_hr: +sls.cost_hr || 0 }, why: "" };
  if (rm) return { route, target: rm, why: "" };
  return { route: "local", target: null, why: "no remote GPU is set up (Settings ▸ Remote GPU) and the style names no endpoint" };
}
function styleOf(params) {
  const id = (params || {}).video_style_id || (params || {}).style_id;
  if (!id) return null;
  try { return require("./styles").byId(core().STYLES_DIR, String(id)); } catch { return null; }
}
/** core.js, as a job starts: its config with ComfyUI's address for where it renders; -> {config, note, gpu} */
function forJob(config, params) {
  const kind = kindOf((params || {}).mode);
  if (!kind || !(config.rgpu && (config.rgpu.split || config.rgpu.mode))) return { config, note: "", gpu: null };
  const sp = split(), st = styleOf(params), r = rg();
  const sls = { base: R().slsUrl(), key: (r.runpod || {}).key || "", cost_hr: (r.serverless || {}).cost_hr || 0 };
  const d = decide(kind, st, sp, remote(), sls);
  const what = `this ${kind} job` + (st ? ` (${st.name}${st.runs_on === "remote" ? " - a remote style" : ""})` : "");
  const tag = ` (Basic Settings ▸ GPU: ${sp.where})`;
  if (d.route !== "remote") {
    if (sp.where === "local" && !d.why) return { config, note: "", gpu: null };
    const cfg = sp.where === "remote" ? localCfg(config) : config;   // Remote but no way there = here
    return { config: cfg, note: `[gpu] ${what} renders on this computer${d.why ? " - " + d.why : ""}${tag}`, gpu: { mode: "local" } };
  }
  const cur = ((config.engine || {}).comfy || {}).url;
  if (sp.where === "remote" && d.target.url === cur) return { config, note: "", gpu: null };   // the remote GPU in use already
  const cfg = JSON.parse(JSON.stringify(config));
  cfg.engine = cfg.engine || {}; cfg.engine.comfy = Object.assign({}, cfg.engine.comfy, { url: d.target.url, autostart: false });
  return { config: cfg, note: `[gpu] ${what} renders on ${d.target.label}${tag}`, gpu: { mode: d.target.mode, label: d.target.label, cost_hr: d.target.cost_hr } };
}
function localCfg(config) {
  const prev = ((config.rgpu || {}).prev || {});
  if (!prev.url) return config;
  const cfg = JSON.parse(JSON.stringify(config));
  cfg.engine.comfy = Object.assign({}, cfg.engine.comfy, { url: prev.url });
  return cfg;
}
function llmRoute(kind, sp) {
  const s = sp || split(), v = vllm(), key = (rg().runpod || {}).key;
  if (!v.endpoint || !key) return "local";
  if (s.where === "remote") return "remote";
  if (s.where === "both" && s[kind]) return "remote";
  return "local";
}
const MODEL = {};       // endpoint -> the served model name (from /openai/v1/models)
async function modelOf(ep, given) {
  if (given) return given;
  if (MODEL[ep]) return MODEL[ep];
  const key = (rg().runpod || {}).key;
  const r = await fetch(`${API()}/${ep}/openai/v1/models`, { headers: { Authorization: "Bearer " + key }, signal: AbortSignal.timeout(180000) });
  if (r.status === 401 || r.status === 403) throw new Error("RunPod refused the API key");
  const j = await r.json().catch(() => ({}));
  const id = j && Array.isArray(j.data) && j.data[0] && j.data[0].id;
  if (!id) throw new Error(`the vLLM endpoint ${ep} did not say which model it serves (HTTP ${r.status}) - type the model's name in Settings ▸ Remote GPU`);
  return (MODEL[ep] = id);
}
/** the LLM / vision LLM to call: null = llama-server here; else {url, model, headers, label} (the vLLM endpoint) */
async function llmTarget(kind) {
  if (llmRoute(kind) !== "remote") return null;
  const v = vllm(), key = (rg().runpod || {}).key;
  const ep = kind === "vlm" && v.vlm_endpoint ? v.vlm_endpoint : v.endpoint;
  const given = kind === "vlm" ? (v.vlm_model || (v.vlm_endpoint ? "" : v.model)) : v.model;
  const model = await modelOf(ep, given);
  return { url: slsChatUrl(ep), model, headers: { Authorization: "Bearer " + key }, label: `RunPod vLLM ${ep}` };
}
/** ✓ Test for the vLLM endpoint: its health + the model it serves */
async function testVllm(kind) {
  const v = vllm(), key = (rg().runpod || {}).key;
  const ep = kind === "vlm" && v.vlm_endpoint ? v.vlm_endpoint : v.endpoint;
  if (!key) return { ok: false, error: "a RunPod API key first" };
  if (!ep) return { ok: false, error: "the vLLM endpoint ID first" };
  try {
    const h = await fetch(`${API()}/${ep}/health`, { headers: { Authorization: "Bearer " + key }, signal: AbortSignal.timeout(20000) });
    if (h.status === 401 || h.status === 403) return { ok: false, error: "RunPod refused the API key" };
    if (h.status === 404) return { ok: false, error: `RunPod does not know the endpoint ${ep}` };
    const line = require("./runpodServerless").health(await h.json().catch(() => ({})));
    const given = kind === "vlm" ? (v.vlm_model || (v.vlm_endpoint ? "" : v.model)) : v.model;
    let model = given;
    if (!model) { try { model = await modelOf(ep, ""); } catch (e) { model = ""; } }
    return { ok: true, line, model: model || "(asked at the first chat - a cold start can take minutes)" };
  } catch (e) { return { ok: false, error: `RunPod did not answer (${String(e.message || e).slice(0, 120)})` }; }
}
function saveVllm(b) {
  const c = core().getConfig(), r = c.rgpu = c.rgpu || { mode: "local" }, v = Object.assign({}, r.vllm || {});
  const id = (x) => String(x || "").trim().replace(/[^A-Za-z0-9_-]/g, "");
  if (b.endpoint != null) v.endpoint = id(b.endpoint);
  if (b.vlm_endpoint != null) v.vlm_endpoint = id(b.vlm_endpoint);
  if (b.model != null) v.model = String(b.model).trim().slice(0, 200);
  if (b.vlm_model != null) v.vlm_model = String(b.vlm_model).trim().slice(0, 200);
  r.vllm = v; core().setConfig(c);
  for (const k of Object.keys(MODEL)) delete MODEL[k];
  return view();
}

module.exports = { WHERE, BOXES, IMAGE_MODES, HERE_MODES, kindOf, routeOf, decide, slsChatUrl, split, remote, vllm, view, set, forJob, llmRoute, llmTarget, testVllm, saveVllm };
