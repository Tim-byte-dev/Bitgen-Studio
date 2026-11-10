// bitGen Studio — lib/runpodImage.js (2.749.0): WHICH RUNPOD WORKER IMAGE THE SERVERLESS ENDPOINT RUNS.
//
// Tim: "please add the remote styles" - lib/styles.js ships R_ styles for RunPod's stock worker-comfyui images, and each
// image bakes in ONE model set (sdxl, sd3, flux1-schnell, flux1-dev, flux1-dev-fp8, z-image-turbo - RunPod's
// Dockerfile), so the style lists show only the ones the endpoint's image can render (lib/rpslStyles.js hideWhy).
//   detect()   RunPod's REST API: GET https://rest.runpod.io/v1/endpoints/<id>?includeTemplate=true (Authorization:
//              Bearer <key>) -> template.imageName, e.g. "runpod/worker-comfyui:5.10.0-sdxl" -> "sdxl"
//   set(image) the user's own pick (Settings ▸ Remote generation ▸ RunPod Serverless ▸ Your endpoint's image)
//   kept in rgpu.serverless {image, image_name, image_ep} - for THAT endpoint only (another endpoint = not known again)
//   image "" = not known, "base" = the base image (models on a network volume), "own" = another image: every remote
//   style shows for those three.
"use strict";
const IMAGES = () => require("./styles").RUNPOD_IMAGES;
const API = () => (process.env.H3_RUNPOD_REST_API || "https://rest.runpod.io/v1").replace(/\/+$/, "");
const CHOICES = ["", "base", "own"];

/** an image name -> "sdxl" | ... | "base" | "own" (pure) */
function parse(imageName) {
  const n = String(imageName || "").trim();
  const m = /(?:^|\/)worker-comfyui:([^\s@]+)/.exec(n);
  if (!m) return n ? "own" : "";
  const suffix = m[1].replace(/^v?\d+(?:\.\d+)*(?:-|$)/, "");     // "5.10.0-flux1-dev-fp8" -> "flux1-dev-fp8"
  if (!suffix || suffix === "base") return "base";
  return IMAGES().includes(suffix) ? suffix : "own";
}

function core() { return require("./core"); }
function sls() { const r = (core().getConfig() || {}).rgpu || {}; return { r, s: r.serverless || {}, key: String((r.runpod || {}).key || "").trim() }; }
/** what is known for the endpoint set now -> {image, image_name, endpoint} */
function known() {
  const { s } = sls(), ep = String(s.endpoint || "");
  const same = ep && s.image_ep === ep;
  return { endpoint: ep, image: same ? String(s.image || "") : "", image_name: same ? String(s.image_name || "") : "" };
}
function store(image, name) {
  const c = core().getConfig(); c.rgpu = c.rgpu || { mode: "local" };
  const s = c.rgpu.serverless = Object.assign({}, c.rgpu.serverless || {});
  s.image = image; s.image_name = String(name || "").slice(0, 200); s.image_ep = String(s.endpoint || "");
  core().setConfig(c);
  return known();
}
/** the user's pick */
function set(image) {
  const v = String(image || "");
  if (!IMAGES().includes(v) && !CHOICES.includes(v)) { const e = new Error("not a RunPod worker image: " + v); e.status = 400; throw e; }
  return store(v, v && v !== "own" ? "chosen in Settings" : "");
}
/** ask RunPod -> known() (throws with a plain reason) */
async function detect(opts) {
  const o = opts || {}, { s, key } = sls(), ep = String(s.endpoint || "").replace(/[^A-Za-z0-9_-]/g, "");
  if (!ep || !key) { const e = new Error("the endpoint ID and the RunPod API key first"); e.status = 400; throw e; }
  const f = o.fetch || fetch;
  let r;
  try { r = await f(`${API()}/endpoints/${ep}?includeTemplate=true`, { headers: { Authorization: "Bearer " + key, Accept: "application/json" }, signal: AbortSignal.timeout(15000) }); }
  catch (e) { const x = new Error("RunPod did not answer (" + ((e && e.message) || e) + ")"); x.status = 502; throw x; }
  if (r.status === 401 || r.status === 403) { const e = new Error("RunPod refused the API key"); e.status = 400; throw e; }
  if (r.status === 404) { const e = new Error("RunPod does not know endpoint " + ep); e.status = 400; throw e; }
  if (!r.ok) { const e = new Error("RunPod answered HTTP " + r.status); e.status = 502; throw e; }
  const j = await r.json().catch(() => ({}));
  const name = String(((j && j.template) || {}).imageName || "");
  if (!name) { const e = new Error("RunPod did not say which image the endpoint runs - pick it below"); e.status = 502; throw e; }
  return store(parse(name), name);
}
module.exports = { parse, known, set, detect, CHOICES };
