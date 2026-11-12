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
// Pure (scripts/test-pods756.js): isComfy, comfyPort, templateView, gpuView, createBody; 2.756.1 (scripts/test-pods7561.js):
// searchText, matches, mergeSources, sortTemplates - every template from all three sources, searched word by word.
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
  const vol = ((t.mounts || {}).persistent || {}).size;
  return { id: String(t.id || ""), name: String(t.name || t.id || ""), image: String(t.image || ""), disk: +t.disk || 0,
    ports: portsOf(t).map((p) => p.port + "/" + p.proto), comfy: isComfy(t), port: comfyPort(t), category: String(t.category || ""), source: source || "",
    volume: +vol || 0, ssh: !!t.startSsh, jupyter: !!t.startJupyter, cuda: Array.isArray(t.allowedCudaVersions) ? t.allowedCudaVersions.map(String) : [],
    page: "https://www.runpod.io/console/explore/" + encodeURIComponent(String(t.id || "")) };
}
/** 2.756.1: the words a search looks through (pure) - name, image, ports, kind, where it comes from, id */
function searchText(v) {
  return [v.name, v.image, (v.ports || []).join(" "), v.category, v.source, v.id, v.comfy ? "comfyui comfy" : ""].join(" ").toLowerCase();
}
/** 2.756.1: does a template match a search? every word must be found (pure) */
function matches(v, q) {
  const words = String(q || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = searchText(v);
  return words.every((w) => hay.includes(w));
}
const SOURCES = ["official", "verified", "community"];
/** 2.756.1: every source's templates in one list - pods only (no serverless ones), each template once (pure) */
function mergeSources(bySource) {
  const seen = new Set(), out = [];
  for (const src of SOURCES) {
    for (const t of (bySource && bySource[src]) || []) {
      if (!t || t.serverless || !t.id || seen.has(String(t.id))) continue;
      seen.add(String(t.id)); out.push(templateView(t, src));
    }
  }
  return out;
}
/** 2.756.1: the order the docker shows them: ComfyUI first, then Official / Verified / Community, then by name (pure) */
function sortTemplates(list) {
  return list.slice().sort((a, b) => (b.comfy - a.comfy) || (SOURCES.indexOf(a.source) - SOURCES.indexOf(b.source)) || a.name.localeCompare(b.name));
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
  const out = { name, templateId: String(o.templateId), gpu: { id: String(o.gpu), count }, cloud: String(o.cloud || "").toUpperCase() === "COMMUNITY" ? "COMMUNITY" : "SECURE",
    disk, mounts: { persistent: { size: vol, path: "/workspace" } } };
  // 2.763.0: a pod for a style (RunPod's "ComfyUI CUDA 13" template) lands on a host whose driver runs CUDA 13 - gpu.minCudaVersion
  if (/^\d{1,2}\.\d{1,2}$/.test(String(o.cuda || ""))) out.gpu.minCudaVersion = String(o.cuda);
  // 2.759.0 (Tim: "how do i choose what model ... and to dl it?"): bitGen's own Jupyter password for the pod (lib/podModels.js
  // downloads through it - env merges with the template's) and the template's ports + 8888/http (ports REPLACE the template's)
  // 2.769.1 (Tim: "when the pod is made with bitgen store that it was made with bitgen"): bitGen's mark on the pod itself
  // (lib/podMade.js) - known as bitGen's from RunPod's list even without this computer's record
  out.env = { BITGEN_MADE: "1" };
  if (o.jupyter) {
    out.env.JUPYTER_PASSWORD = String(o.jupyter);
    const ports = (Array.isArray(o.ports) ? o.ports : []).map(String).filter((p) => /^\d{1,5}\/(http|tcp|udp)$/.test(p));
    if (ports.length) out.ports = [...new Set(ports.concat(["8888/http"]))];
  }
  return out;
}

/* ---------------- live */
function core() { return require("./core"); }
function A() { return require("./runpodApi"); }
function rg() { return ((core().getConfig() || {}).rgpu) || {}; }
function key() { return String((rg().runpod || {}).key || "").trim(); }
const CACHE = {};
async function rawOf(src, refresh) {
  const c = CACHE["t:" + src];
  if (c && Date.now() - c.at < 600000 && !refresh) return c.data;
  const raw = await A().templates(src, key()); CACHE["t:" + src] = { at: Date.now(), data: raw };
  return raw;
}
/** RunPod's public templates. 2.756.1: source "all" (the default) = Official + Verified + Community together (RunPod gives at
 *  most 100 a source - no more pages yet); a source that fails is named in `failed`, the others still list */
async function templates(o) {
  const opt = o || {};
  const src = SOURCES.includes(opt.source) ? opt.source : "all";
  const want = src === "all" ? SOURCES : [src];
  const got = await Promise.allSettled(want.map((s) => rawOf(s, opt.refresh)));
  const bySource = {}, failed = [];
  got.forEach((r, i) => { if (r.status === "fulfilled") bySource[want[i]] = r.value; else failed.push(want[i]); });
  if (failed.length === want.length) throw got[0].reason;
  const all = mergeSources(bySource);
  const counts = {}; SOURCES.forEach((s) => { counts[s] = all.filter((t) => t.source === s).length; });
  const list = sortTemplates(all.filter((t) => (!opt.comfy || t.comfy) && matches(t, opt.q)));
  return { source: src, templates: list, total: all.length, counts, failed,
    error_detail: failed.length ? String((got.find((r) => r.status === "rejected").reason || {}).message || "") : undefined };
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
  const o = Object.assign({}, b || {});
  // 2.759.0: the template's own ports (from RunPod's list, cached) so 8888 can be added without losing ComfyUI's
  try { const all = await templates({}); const t = (all.templates || []).find((x) => x.id === o.templateId); if (t) o.ports = t.ports;
    // 2.763.3: a CUDA 13 template (RunPod's "ComfyUI - CUDA 13.0") lands on a host whose driver runs it
    if (t && !o.cuda && /cuda[\s_-]*13/i.test(String(t.name || "") + " " + String(t.image || ""))) o.cuda = "13.0"; } catch { /* without: no ports sent */ }
  o.jupyter = require("crypto").randomBytes(18).toString("base64url");
  const body = createBody(o);
  const p = await A().createPod(body, key());
  if (!p || !p.id) { const e = new Error("RunPod did not say which pod it made"); e.status = 502; throw e; }
  remember(p.id, body.name, "created");
  try { require("./podModels").setJupyter(p.id, o.jupyter); } catch { /* the password is only for downloads */ }
  // 2.763.3 (Tim: "if a pod doesn't exist for a style popup the pods docker to create the pod when generate button is pressed,
  // auto select the type and style"): made for a style = the style linked to it (no P_ copy any more), the kinds ticked on it
  // (one pod per kind), and this computer's custom nodes put on it once it loads (lib/stylePods.js, lib/podNodes.js)
  try {
    const SP = require("./stylePods");
    if (o.for_style) SP.link(o.for_style, p.id);
    if (Array.isArray(o.kinds) && o.kinds.length) SP.setKinds(p.id, o.kinds);
  } catch { /* the pod is made - linking is a nicety */ }
  const port = +(b || {}).port || 8188;
  // 2.761.0: how it was made - a P_ style from it keeps this as its recipe (lib/podRevive.js makes the pod again from it)
  try {
    const t = ((await templates({}).catch(() => ({}))).templates || []).find((x) => x.id === body.templateId) || {};
    const c = core().getConfig(); c.rgpu = c.rgpu || {};
    c.rgpu.pod_made = Object.assign({}, c.rgpu.pod_made || {}, { [p.id]: { template_id: body.templateId, template_name: String(t.name || "").slice(0, 120), gpu: body.gpu.id, count: body.gpu.count,
      cloud: body.cloud, disk: body.disk, volume: body.mounts.persistent.size, port, name: body.name, cuda: body.gpu.minCudaVersion || "" } });
    core().setConfig(c);
  } catch { /* the recipe is a nicety */ }
  // 2.764.0 (Tim: "add a create pod button to create a new pod for the style"): a pod made for a style is kept as a preset
  // (🖥 PODS ▸ 📦 Presets) - ▶ there makes it again with its styles after it is terminated. Not when a preset is making it.
  let preset = "";
  if (o.for_style && !o.preset) { try { preset = (await require("./podPresets").fromPod(p.id, String(body.name || "").replace(/^bitGen\s+/, ""))).name; } catch { preset = ""; } }
  // 2.769.1 (Tim: "... automatically treat it as such, don't wait for button press"): set up by itself once it loads
  try { require("./podMade").watch(p.id, port); } catch { /* a render still sets it up */ }
  return { pod: A().mapPod(p, port), port, preset };
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
  // 2.769.1: a pod carrying bitGen's mark (env BITGEN_MADE) is bitGen's - recorded and set up if this computer did not know it
  const PMd = require("./podMade"), made = rg().pod_made || {};
  return { pods: (await A().pods(key())).map((p) => { try { if (/RUNNING/.test(String(p.desiredStatus || p.status || ""))) PMd.adopt(p, port); } catch { /* fine */ }
    return Object.assign(A().mapPod(p, port), { bitgen: ours.has(p.id) || !!made[p.id] || PMd.isMadeEnv(p), made_by_bitgen: !!made[p.id] || PMd.isMadeEnv(p), setup: PMd.status(p.id) }); }) };
}

module.exports = { COMFY_PORTS, SOURCES, isComfy, comfyPort, templateView, searchText, matches, mergeSources, sortTemplates, gpuView, createBody, templates, gpus, create, act, mine, remember, forget, started };
