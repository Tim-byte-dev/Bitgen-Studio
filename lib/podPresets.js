// bitGen Studio — lib/podPresets.js (2.764.0): POD PRESETS - a pod's whole make-up (template, GPU, how many, cloud, disks, the
// styles it holds) kept as a file, so ▶ makes the pod again - with every style's files on it - after it was terminated.
// Tim (verbatim): "in pods docker add a presets tab, save all the pods details with the styles it holds and gpu and number of
// gpu's etc in a <preset name>.pod file in a folder called runpod\pods\presets. display the presets as accordian items. if user
// clicks the preset menu item , show all the details of whats in the pod, allow user to edit details , remove styles, add
// styles to preset. in the menu item titlebar show a play button a stop button and a delete button(delete button terminates
// the pod) icon only. show loading sequence, show running, show cost/hr, hrs used and total cost under the pod details. if
// user presses the play button and pod has been terminated the create a new pod with all those details and populate it with
// the styles files including workflows and text encoders and vae and models and loras in the style"
// + "delete should only terminate the pod x should delete the preset"
//
//   FILES     <bitGen>/runpod/pods/presets/<name>.pod (JSON; H3_POD_PRESETS_DIR = the tests' folder) - never an API key or a
//             password: {name, template_id, template_name, gpu, gpu_name, count, cloud, disk, volume, cuda, port, kinds,
//             styles: [style ids], pod_id, runs: [{pod, from, to, rate}], made_at, updated_at}
//   ▶ play    the preset's pod still on RunPod: started when stopped (nothing when running). Gone / terminated: a new pod made
//             with the preset's details (its GPU not free = the GPUs with as much memory or more to pick from), the styles
//             and kinds linked to it, then in the background: the pod loading -> its ComfyUI -> each style's custom nodes
//             (2.764.2: only the packs its workflows use) and files (workflows, models, text encoders, VAE, LoRAs -
//             lib/podPrep.js) -> ready
//   ⏹ stop    RunPod stop (the GPU charge ends, /workspace stays)        🗑 terminate   RunPod terminate (the preset stays)
//   ✕         the preset file deleted (the pod is left as it is)
//   runs      every time one of its pods runs, from / to and its $/h - hours used and the total cost survive the pod
//   A style linked to the preset's pod anywhere (the "no pod" dialog, My pods ▸ Styles) joins the preset (onLink / onSet).
// Pure (scripts/test-podpresets764.js): fileName, cleanPreset, usage, syncRuns, gpuOptions, stepsFor.
"use strict";
const fs = require("fs"), path = require("path");

const KINDS = ["image", "image_edit", "video"];
const pid = (v) => String(v || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 40);
const str = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const int = (v, lo, hi, d) => { const x = parseInt(v, 10); return x >= lo && x <= hi ? x : d; };
/** a preset's name -> its file's name (pure); "" = not a usable name */
function fileName(name) {
  const n = str(name, 60).replace(/[<>:"/\\|?*]+/g, "").replace(/\s+/g, " ").replace(/^[.\s]+|[.\s]+$/g, "");
  return n ? n + ".pod" : "";
}
/** what is kept (pure) - only known fields, sizes kept in bounds */
function cleanPreset(o) {
  const x = o || {};
  const runs = (Array.isArray(x.runs) ? x.runs : []).filter((r) => r && pid(r.pod) && isFinite(+r.from)).slice(-500)
    .map((r) => ({ pod: pid(r.pod), from: +r.from, to: r.to == null ? null : +r.to, rate: Math.max(0, +r.rate || 0) }));
  return {
    name: str(x.name, 60).replace(/[<>:"/\\|?*]+/g, ""),
    template_id: str(x.template_id, 40).replace(/[^A-Za-z0-9]/g, ""), template_name: str(x.template_name, 120),
    gpu: str(x.gpu, 80), gpu_name: str(x.gpu_name, 80), count: int(x.count, 1, 8, 1),
    cloud: String(x.cloud || "").toUpperCase() === "COMMUNITY" ? "COMMUNITY" : "SECURE",
    disk: int(x.disk, 10, 1000, 50), volume: int(x.volume, 10, 2000, 50),
    cuda: /^\d{1,2}\.\d{1,2}$/.test(String(x.cuda || "")) ? String(x.cuda) : "",
    port: int(x.port, 1, 65535, 8188),
    kinds: [...new Set((Array.isArray(x.kinds) ? x.kinds : []).filter((k) => KINDS.includes(k)))],
    styles: [...new Set((Array.isArray(x.styles) ? x.styles : []).map((s) => String(s).replace(/[^\w.-]/g, "").slice(0, 80)).filter(Boolean))].slice(0, 200),
    pod_id: pid(x.pod_id), runs,
    made_at: x.made_at || new Date().toISOString(), updated_at: x.updated_at || new Date().toISOString(),
  };
}
/** hours used + what it cost, from the runs (pure; an open run counts up to `now`) */
function usage(runs, now) {
  let ms = 0, usd = 0;
  for (const r of runs || []) {
    const t = Math.max(0, (r.to == null ? (now || Date.now()) : r.to) - r.from);
    ms += t; usd += (t / 3600000) * (+r.rate || 0);
  }
  return { hours: Math.round(ms / 36000) / 100, usd: Math.round(usd * 100) / 100 };
}
/** the runs brought up to date with the pod now (pure): running and no open run = one opens (at the pod's start when RunPod
 *  says it); not running = the open one closes. -> {runs, changed} */
function syncRuns(runs, pod, now) {
  const l = (runs || []).map((r) => Object.assign({}, r)), t = now || Date.now();
  const open = l.find((r) => r.to == null);
  const on = !!pod && /RUNNING/.test(String(pod.status || ""));
  if (on && open && open.pod !== pod.id) { open.to = t; }
  if (on && !(open && open.pod === pod.id && open.to == null)) {
    const st = Date.parse(pod.started_at || "");
    l.push({ pod: pod.id, from: isFinite(st) && st <= t && st > t - 30 * 86400000 ? st : t, to: null, rate: +pod.cost_hr || 0 });
    return { runs: l, changed: true };
  }
  if (!on && open) { open.to = t; return { runs: l, changed: true }; }
  if (on && open && open.pod === pod.id && !open.rate && pod.cost_hr) { open.rate = +pod.cost_hr; return { runs: l, changed: true }; }
  return { runs: l, changed: false };
}
/** the preset's GPU is not free: the GPUs that are, with as much memory or more, cheapest first (pure) */
function gpuOptions(gpus, want) {
  const w = (gpus || []).find((g) => g.id === want) || null, mem = w ? +w.memory || 0 : 0;
  return (gpus || []).filter((g) => g.offered && g.id !== want && (+g.memory || 0) >= mem).sort((a, b) => a.price - b.price).slice(0, 12)
    .map((g) => ({ id: g.id, name: g.name, memory: g.memory, price: g.price, availability: g.availability }));
}
/** the loading sequence (pure): the steps a pod goes through, each todo / doing / done / failed */
function stepsFor(made, styleNames) {
  return [].concat(made ? [{ id: "create", label: "Creating the pod" }] : [],
    [{ id: "load", label: "Pod loading on RunPod" }, { id: "comfy", label: "ComfyUI starting" }],
    // 2.764.2: each style's step puts on the custom nodes its workflows use, then its model files
    (styleNames || []).map((n, i) => ({ id: "style" + i, label: n + ": its nodes and files" })), [{ id: "ready", label: "Ready" }])
    .map((s) => Object.assign(s, { state: "todo", note: "" }));
}

/* ---------------- live */
function core() { return require("./core"); }
function rg() { return ((core().getConfig() || {}).rgpu) || {}; }
function dir() { return process.env.H3_POD_PRESETS_DIR || path.join(core().BASE, "runpod", "pods", "presets"); }
function fileOf(name) { const f = fileName(name); if (!f) { const e = new Error("give the preset a name"); e.status = 400; throw e; } return path.join(dir(), f); }
function readOne(f) { try { const o = JSON.parse(fs.readFileSync(f, "utf8")); return o && typeof o === "object" ? cleanPreset(o) : null; } catch { return null; } }
function all() {
  let names = []; try { names = fs.readdirSync(dir()).filter((n) => /\.pod$/i.test(n)); } catch { names = []; }
  return names.map((n) => readOne(path.join(dir(), n))).filter((p) => p && p.name).sort((a, b) => a.name.localeCompare(b.name));
}
function get(name) { const p = readOne(fileOf(name)); if (!p) { const e = new Error("no preset called " + name); e.status = 404; throw e; } return p; }
function write(p) {
  const c = cleanPreset(Object.assign({}, p, { updated_at: new Date().toISOString() }));
  if (!c.name) { const e = new Error("give the preset a name"); e.status = 400; throw e; }
  fs.mkdirSync(dir(), { recursive: true });
  const f = fileOf(c.name), tmp = f + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(c, null, 2)); fs.renameSync(tmp, f);
  return c;
}
let MINE = null;
async function mine(force) {
  if (!force && MINE && Date.now() - MINE.at < 4000) return MINE.pods;
  const pods = ((await require("./pods").mine()) || {}).pods || [];
  MINE = { at: Date.now(), pods };
  return pods;
}
const live = (pods, id) => (id ? (pods || []).find((p) => p.id === id && !/TERMINATED/.test(p.status)) || null : null);
const PLAY = {};   // preset name -> {steps, phase: working | ready | failed, note, pod, at}
function step(J, id, state, note) { const s = J.steps.find((x) => x.id === id); if (s) { s.state = state; if (note != null) s.note = String(note).slice(0, 300); } J.at = Date.now(); if (note) J.note = String(note).slice(0, 300); }
function styleObjs(ids) { const S = require("./styles"), C = core(); return (ids || []).map((x) => { try { return S.byId(C.STYLES_DIR, x); } catch { return null; } }).filter(Boolean); }

/** the list for the docker: each preset + its pod now + the loading sequence + hours / cost */
async function list() {
  const ps = all();
  let pods = [], err = "";
  try { pods = await mine(); } catch (e) { err = String((e && e.message) || e); }
  let bill = {}; try { bill = (await require("./podCosts").costs()).pods || {}; } catch { bill = {}; }
  const names = {}; for (const st of styleObjs([...new Set(ps.flatMap((p) => p.styles))])) names[st.id] = st.name;
  const out = [];
  for (const p of ps) {
    const pod = live(pods, p.pod_id);
    if (!err) { const s = syncRuns(p.runs, pod); if (s.changed) { p.runs = s.runs; try { write(p); } catch { /* read-only */ } } }
    const u = usage(p.runs), J = PLAY[p.name] || null;
    const ids = [...new Set(p.runs.map((r) => r.pod).concat(p.pod_id ? [p.pod_id] : []))];
    out.push(Object.assign({}, p, {
      style_names: p.styles.map((id) => ({ id, name: names[id] || id, missing: !names[id] })),
      pod: pod ? { id: pod.id, name: pod.name, status: pod.status, gpu: pod.gpu, gpus: pod.gpus, cost_hr: pod.cost_hr, started_at: pod.started_at } : null,
      state: J && J.phase === "working" ? "loading" : pod ? (/RUNNING/.test(pod.status) ? (J && J.phase === "failed" ? "failed" : "running") : /PROVISIONING|STARTING/.test(pod.status) ? "loading" : "stopped") : (p.pod_id ? "terminated" : "none"),
      hours: u.hours, total_usd: u.usd, bill_month: Math.round(ids.reduce((a, id) => a + ((bill[id] || {}).month || 0), 0) * 100) / 100,
      job: J ? { phase: J.phase, note: J.note, steps: J.steps, at: J.at } : null,
    }));
  }
  return { dir: dir(), presets: out, error: err || undefined };
}
/** save (new or edited); was = its old name when renamed. A pod running for it takes the styles / kinds at once */
async function save(b) {
  const o = b || {}, was = str(o.was, 60);
  let old = null; if (was) { try { old = get(was); } catch { old = null; } }
  const p = cleanPreset(Object.assign({}, old || {}, o.preset || o, { runs: old ? old.runs : [], pod_id: old ? old.pod_id : pid((o.preset || o).pod_id), made_at: old ? old.made_at : undefined }));
  if (!p.name) { const e = new Error("give the preset a name"); e.status = 400; throw e; }
  if (!old || fileName(was) !== fileName(p.name)) { let exists = false; try { fs.accessSync(fileOf(p.name)); exists = true; } catch { exists = false; } if (exists) { const e = new Error("there is a preset called " + p.name + " already"); e.status = 409; throw e; } }
  const out = write(p);
  if (old && fileName(was) !== fileName(p.name)) { try { fs.unlinkSync(fileOf(was)); } catch { /* gone */ } if (PLAY[was]) { PLAY[p.name] = PLAY[was]; delete PLAY[was]; } }
  await applyToPod(out, old ? old.styles : []);
  return out;
}
/** the styles / kinds onto its pod when it is on RunPod; styles added while it runs are made ready on it now */
async function applyToPod(p, before) {
  if (!p.pod_id) return;
  let pods = []; try { pods = await mine(true); } catch { return; }
  const pod = live(pods, p.pod_id); if (!pod) return;
  const SP = require("./stylePods");
  QUIET = true; try { SP.setStylesOf(p.pod_id, p.styles); if (p.kinds.length) SP.setKinds(p.pod_id, p.kinds); } finally { QUIET = false; }
  const added = p.styles.filter((s) => !(before || []).includes(s));
  if (added.length && /RUNNING/.test(pod.status)) require("./podPrep").prepare(p.pod_id, p.port, styleObjs(added)).catch(() => null);
}
function remove(name) { const f = fileOf(name); try { fs.unlinkSync(f); } catch (e) { const x = new Error("no preset called " + name); x.status = 404; throw x; } delete PLAY[name]; return { ok: true, name }; }
/** add / take away styles (the "no pod" dialog adds one) */
async function styles(name, add, take) {
  const p = get(name), before = p.styles.slice();
  p.styles = [...new Set(p.styles.concat(add || []))].filter((s) => !(take || []).includes(s));
  const out = write(p);
  await applyToPod(out, before);
  return out;
}
/** a pod -> a preset: how bitGen made it (else RunPod's own record), the styles linked to it, its kinds */
async function fromPod(id, name) {
  const p = pid(id); if (!p) { const e = new Error("which pod?"); e.status = 400; throw e; }
  const rc = await require("./podRevive").recipe(p);
  if (!rc) { const e = new Error("bitGen does not know how that pod was made (its template) - make a preset with ＋ New preset"); e.status = 404; throw e; }
  let pod = null; try { pod = live(await mine(true), p); } catch { pod = null; }
  const SP = require("./stylePods"), r = rg();
  let n = str(name || rc.name || (pod && pod.name) || p, 60).replace(/[<>:"/\\|?*]+/g, "");
  const taken = new Set(all().map((x) => fileName(x.name).toLowerCase()));
  if (taken.has(fileName(n).toLowerCase())) { let k = 2; while (taken.has(fileName(n + " " + k).toLowerCase())) k++; n = n + " " + k; }
  return write({ name: n, template_id: rc.template_id, template_name: rc.template_name, gpu: rc.gpu, gpu_name: (pod && pod.gpu) || rc.gpu.replace(/^NVIDIA (GeForce )?/, ""),
    count: rc.count, cloud: rc.cloud, disk: rc.disk, volume: rc.volume, cuda: rc.cuda, port: rc.port || SP.portOf(r, p),
    kinds: (((r.pod_cfg || {})[p]) || {}).kinds || [], styles: SP.stylesOf(p), pod_id: p, runs: [] });
}
/** the preset that holds pod `id` (null = none) */
function ofPod(id) { const p = pid(id); return p ? all().find((x) => x.pod_id === p) || null : null; }
/** lib/stylePods.js link / setStylesOf: a style put on a pod joins the pod's preset */
let QUIET = false;
function onLink(podId, styleId) {
  if (QUIET) return;
  try { const p = ofPod(podId); if (p && !p.styles.includes(styleId)) { p.styles.push(styleId); write(p); } } catch { /* a nicety */ }
}
function onSet(podId, ids) {
  if (QUIET) return;
  try { const p = ofPod(podId); if (p) { p.styles = [...new Set(ids || [])]; write(p); } } catch { /* a nicety */ }
}

/** ▶ -> {state: running | starting | creating, pod_id} | {need_gpu: true, gpu, options} */
async function play(name, o) {
  const opt = o || {}, p = get(name);
  if (PLAY[p.name] && PLAY[p.name].phase === "working") return { state: "loading", pod_id: PLAY[p.name].pod, note: PLAY[p.name].note };
  const P = require("./pods"), SP = require("./stylePods");
  const pods = await mine(true), pod = live(pods, p.pod_id);
  if (pod) {
    if (/RUNNING/.test(pod.status)) return { state: "running", pod_id: pod.id };
    if (/EXITED|STOPPED|ERROR/.test(pod.status)) await P.act(pod.id, "start");
    MINE = null;
    populate(p, pod.id, false).catch(() => null);
    return { state: "starting", pod_id: pod.id };
  }
  // terminated / never made: a new pod with every detail (its GPU free now, else one picked)
  if (!p.template_id) { const e = new Error("the preset has no template - pick one in its details"); e.status = 400; throw e; }
  if (opt.gpu && opt.gpu !== p.gpu) { p.gpu = str(opt.gpu, 80); p.gpu_name = p.gpu.replace(/^NVIDIA (GeForce )?/, ""); write(p); }
  let gl = []; try { gl = (await P.gpus(p.cloud)).gpus || []; } catch { gl = []; }
  const g = gl.find((x) => x.id === p.gpu);
  if (gl.length && !(g && g.offered && (+g.max || 1) >= p.count)) return { need_gpu: true, gpu: p.gpu, count: p.count, cloud: p.cloud, options: gpuOptions(gl, p.gpu) };
  const J = PLAY[p.name] = { steps: stepsFor(true, styleObjs(p.styles).map((s) => s.name)), phase: "working", note: "creating the pod", pod: "", at: Date.now() };
  step(J, "create", "doing", "creating a pod on " + (p.gpu_name || p.gpu) + (p.count > 1 ? " × " + p.count : ""));
  let made;
  try {
    made = await P.create({ templateId: p.template_id, name: ("bitGen " + p.name).slice(0, 60), gpu: p.gpu, count: p.count, cloud: p.cloud, disk: p.disk,
      volume: p.volume, port: p.port, cuda: p.cuda || undefined, preset: p.name });
  } catch (e) { step(J, "create", "failed", String((e && e.message) || e)); J.phase = "failed"; throw e; }
  const id = made.pod.id;
  step(J, "create", "done", "made " + made.pod.name); J.pod = id;
  p.pod_id = id; write(p);
  QUIET = true; try { SP.setStylesOf(id, p.styles); if (p.kinds.length) SP.setKinds(id, p.kinds); } finally { QUIET = false; }
  MINE = null;
  populate(p, id, true, J).catch(() => null);
  return { state: "creating", pod_id: id, pod: made.pod };
}
/** the background part of ▶: wait for the pod, its ComfyUI, the custom nodes (a new pod), every style's files */
async function populate(p, id, made, J0) {
  const sts = styleObjs(p.styles);
  const J = J0 || (PLAY[p.name] = { steps: stepsFor(false, sts.map((s) => s.name)), phase: "working", note: "starting the pod", pod: id, at: Date.now() });
  J.pod = id;
  try {
    step(J, "load", "doing", "the pod is loading on RunPod");
    const RV = require("./podRevive"), SP = require("./stylePods");
    let loaded = false;
    await RV.waitReady(id, p.port, (t) => { if (!loaded) { step(J, "load", "done"); step(J, "comfy", "doing", t); loaded = true; } else step(J, "comfy", "doing", t); });
    step(J, "load", "done"); step(J, "comfy", "done", "ComfyUI answers");
    for (let i = 0; i < sts.length; i++) {
      step(J, "style" + i, "doing", "making " + sts[i].name + " ready");
      try {
        const r = await require("./podPrep").prepare(id, p.port, [sts[i]], { say: (t) => step(J, "style" + i, "doing", sts[i].name + ": " + t) });
        const miss = r.notThere || [];
        step(J, "style" + i, miss.length || (r.problems || []).length ? "failed" : "done", miss.length ? "not on the pod: " + miss.join(", ") + ((r.problems || []).length ? " - " + r.problems.join("; ") : "") : (r.problems || []).join("; ") || "ready");
      } catch (e) { step(J, "style" + i, "failed", String((e && e.message) || e)); }
    }
    step(J, "ready", "done", "the pod is ready - " + sts.length + " style" + (sts.length === 1 ? "" : "s") + " on it");
    J.phase = J.steps.some((s) => s.state === "failed") ? "failed" : "ready";
    try { RV.mark(id); } catch { /* fine */ }
  } catch (e) { J.phase = "failed"; J.note = String((e && e.message) || e).slice(0, 300); const cur = J.steps.find((s) => s.state === "doing"); if (cur) { cur.state = "failed"; cur.note = J.note; } }
}
/** ⏹ / 🗑 (terminate - the preset stays) */
async function stop(name) {
  const p = get(name); if (!p.pod_id) { const e = new Error("the preset has no pod"); e.status = 409; throw e; }
  const r = await require("./pods").act(p.pod_id, "stop"); MINE = null;
  const s = syncRuns(p.runs, null); if (s.changed) { p.runs = s.runs; write(p); }
  if (PLAY[p.name] && PLAY[p.name].phase !== "working") delete PLAY[p.name];
  return Object.assign({ ok: true }, r);
}
async function terminate(name) {
  const p = get(name); if (!p.pod_id) { const e = new Error("the preset has no pod"); e.status = 409; throw e; }
  let pod = null; try { pod = live(await mine(true), p.pod_id); } catch { pod = null; }
  if (pod) await require("./pods").act(p.pod_id, "terminate");
  MINE = null;
  const s = syncRuns(p.runs, null); if (s.changed) p.runs = s.runs;
  write(p); delete PLAY[p.name];
  return { ok: true, terminated: !!pod };
}
module.exports = { KINDS, fileName, cleanPreset, usage, syncRuns, gpuOptions, stepsFor, dir, all, get, list, save, remove, styles, fromPod, ofPod, onLink, onSet, play, stop, terminate };
