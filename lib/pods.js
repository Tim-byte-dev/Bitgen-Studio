// bitGen Studio — lib/pods.js (2.756.0): THE PODS DOCKER's server side - public RunPod templates, GPU prices, creating,
// starting, stopping and terminating pods, and which pods bitGen started (for the exit rule, 2.757.0).
// Tim (verbatim): "can we get the list of public pods from runpod in a docker called PODS(like model manager), button and
// docker only visible when runpod pods are selected as the generation engine? the user can choose/create a pod ... when
// bigen exits terminate all pods" (asked: "Only pods bitGen started").
//   templates  RunPod's public templates (lib/runpodApi.js templates - official / verified / community, 100 each at most),
//              10 minutes cached; "ComfyUI only" = the name or image says ComfyUI or it opens 8188 / 3000 over HTTP;
//              serverless templates left out (they are for endpoints, not pods)
//   gpus       GPU types with their price per hour on the cloud picked (secure / community) and availability
//   create     POST /pods from a template: the GPU, how many, the cloud, the container disk, /workspace's size
//   started    rgpu.pods_bitgen = [{id, name, how: created|started, at}] - the pods bitGen created or started (never the
//              ones made on RunPod's site unless bitGen starts them)
// Pure (scripts/test-pods756.js): isComfy, comfyPort, templateView, gpuView, createBody.
"use strict";

const COMFY_PORTS = [8188, 3000];
/** does a template run ComfyUI? (pure) */
function isComfy(t) {
  const x = t || {};
  if (/comfy/i.test(String(x.name || "")) || /comfy/i.test(String(x.image || ""))) return true;
  return portsOf(x).some((p) => p.proto === "http" && COMFY_PORTS.includes(p.port));
}
function portsOf(t) {
  const ps = Array.isArray(t.ports) ? t.ports : String(t.ports || "").split(",");
  return ps.map((s) => { const m = /^\s*(\d+)\/(\w+)/.exec(String(s)); return m ? { port: +m[1], proto: m[2].toLowerCase() } : null; }).filter(Boolean);
}
/** the port ComfyUI answers on (pure): 8188, else 3000, else the first HTTP port, else 8188 */
function comfyPort(t) {
  const http = portsOf(t || {}).filter((p) => p.proto === "http").map((p) => p.port);
  return http.includes(8188) ? 8188 : http.includes(3000) ? 3000 : (http[0] || 8188);
}
/** a template as the docker lists it (pure) */
function templateView(t, source) {
  return { id: String(t.id || ""), name: String(t.name || t.id || ""), image: String(t.image || ""), disk: +t.disk || 0,
    ports: portsOf(t).map((p) => p.port + "/" + p.proto), comfy: isComfy(t), port: comfyPort(t), category: String(t.category || ""), source: source || "",
    page: "https://www.runpod.io/console/explore/" + encodeURIComponent(String(t.id || "")) };
}
/** a GPU type for the picker (pure): its price on the cloud picked, memory, availability */
function gpuView(g, cloud) {
  const c = String(cloud || "").toUpperCase() === "COMMUNITY" ? "community" : "secure";
  const price = (g.price || {})[c];
  return { id: String(g.id || ""), name: String(g.name || g.id || ""), memory: +g.memory || 0, price: price == null ? null : +price,
    availability: String(g.availability || ""), offered: g[c] !== false && price != null && String(g.availability || "") !== "NONE", max: +((g.maxCount || {})[c]) || 1 };
}
/** the create-pod body (pure) - throws a plain reason when something is missing */
function createBody(b) {
  const o = b || {};
  const bad = (m) => { const e = new Error(m); e.status = 400; throw e; };
  if (!/^[A-Za-z0-9]{4,20}$/.test(String(o.templateId || ""))) bad("pick a template first");
  if (!String(o.gpu || "").trim()) bad("pick a GPU");
  const count = Math.max(1, Math.min(8, parseInt(o.count, 10) || 1));
  const disk = Math.max(10, Math.min(1000, parseInt(o.disk, 10) || 50));
  const vol = Math.max(10, Math.min(2000, parseInt(o.volume, 10) || 50));
  const name = String(o.name || "").replace(/[^\w .-]+/g, " ").trim().slice(0, 60) || "bitGen pod";
  return { name, templateId: String(o.templateId), gpu: { id: String(o.gpu), count }, cloud: String(o.cloud || "").toUpperCase() === "COMMUNITY" ? "COMMUNITY" : "SECURE",
    disk, mounts: { persistent: { size: vol, path: "/workspace" } } };
}

/* ---------------- live */
function core() { return require("./core"); }
function A() { return require("./runpodApi"); }
function rg() { return ((core().getConfig() || {}).rgpu) || {}; }
function key() { return String((rg().runpod || {}).key || "").trim(); }
const CACHE = {};
async function templates(o) {
  const src = ["official", "verified", "community"].includes((o || {}).source) ? o.source : "official";
  const c = CACHE["t:" + src];
  let raw = c && Date.now() - c.at < 600000 && !(o || {}).refresh ? c.data : null;
  if (!raw) { raw = await A().templates(src, key()); CACHE["t:" + src] = { at: Date.now(), data: raw }; }
  const q = String((o || {}).q || "").trim().toLowerCase();
  const list = raw.filter((t) => t && !t.serverless).map((t) => templateView(t, src))
    .filter((t) => (!(o || {}).comfy || t.comfy) && (!q || (t.name + " " + t.image).toLowerCase().includes(q)))
    .sort((a, b) => (b.comfy - a.comfy) || a.name.localeCompare(b.name));
  return { source: src, templates: list, total: raw.length };
}
async function gpus(cloud) {
  const c = String(cloud || "").toUpperCase() === "COMMUNITY" ? "COMMUNITY" : "SECURE";
  const raw = await A().gpus(c, key());
  return { cloud: c, gpus: raw.map((g) => gpuView(g, c)).filter((g) => g.price != null).sort((a, b) => (b.offered - a.offered) || (a.price - b.price)) };
}
/** remember a pod bitGen created or started (the exit rule) */
function remember(id, name, how) {
  const c = core().getConfig(), r = c.rgpu = c.rgpu || { mode: "local" };
  const list = (Array.isArray(r.pods_bitgen) ? r.pods_bitgen : []).filter((x) => x && x.id !== id);
  list.push({ id: String(id), name: String(name || id).slice(0, 80), how, at: new Date().toISOString() });
  r.pods_bitgen = list.slice(-50); core().setConfig(c);
}
function forget(id) {
  const c = core().getConfig(), r = c.rgpu = c.rgpu || { mode: "local" };
  r.pods_bitgen = (Array.isArray(r.pods_bitgen) ? r.pods_bitgen : []).filter((x) => x && x.id !== id); core().setConfig(c);
}
const started = () => (Array.isArray(rg().pods_bitgen) ? rg().pods_bitgen : []).slice();
async function create(b) {
  const body = createBody(b);
  const p = await A().createPod(body, key());
  if (!p || !p.id) { const e = new Error("RunPod did not say which pod it made"); e.status = 502; throw e; }
  remember(p.id, body.name, "created");
  const port = +(b || {}).port || 8188;
  return { pod: A().mapPod(p, port), port };
}
async function act(id, action) {
  const p = await A().action(id, action, key());
  if (action === "start") remember(id, (p && p.name) || id, "started");
  if (action === "terminate") forget(id);
  return { ok: true, pod: p && p.id ? A().mapPod(p) : null };
}
/** your pods, each saying whether bitGen started it */
async function mine() {
  const port = +((rg().runpod || {}).port) || 8188, ours = new Set(started().map((x) => x.id));
  return { pods: (await A().pods(key())).map((p) => Object.assign(A().mapPod(p, port), { bitgen: ours.has(p.id) })) };
}

module.exports = { COMFY_PORTS, isComfy, comfyPort, templateView, gpuView, createBody, templates, gpus, create, act, mine, remember, forget, started };
