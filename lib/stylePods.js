// bitGen Studio — lib/stylePods.js (2.763.0): YOUR OWN STYLES RENDER ON YOUR PODS - no P_ copies.
// Tim (verbatim): "we reuse the same styles, no p_ but when in pod mode we use the pod that uses that style ... if we are in
// pod mode and a style is selected, check if that style has a pod assigned to it and create the pod with the comfy cuda 13
// template" + "allow the user to have a separate pod for each type of style, llm, vllm,image,video if they want to and can
// afford too otherwise we use the one pod" + (agreed) ask before a pod is created: the GPU, its $/h, the disk, Create or
// Use my running pod.
//   POD MODE   Remote generation on + Basic Settings ▸ GPU ▸ RunPod ▸ Pods + Remote (every render) or Both (the Image /
//              Video box ticked, or the style has its own pod) - podJob()
//   WHICH POD  podFor(): 1. the style's own pod (rgpu.style_pods {style id: pod id} - My pods ▸ a pod's Styles)
//                        2. the pod ticked for the style's kind (rgpu.pod_cfg.<pod>.kinds - one pod per kind; Image edit
//                           falls back to the Image pod)
//                        3. the pod in use (Settings ▸ Remote generation ▸ RunPod) - "the one pod"
//              none -> the job waits and the page asks (job.pod_ask -> static/stylepodask.js): create a pod from RunPod's
//              "ComfyUI CUDA 13" template (gpu.minCudaVersion 13.0) on the GPU picked, or use one of your pods - either
//              way the style is linked to it, so next time it goes there by itself.
//   BEFORE THE JOB  the pod is started when stopped, made again from how it was made (rgpu.pod_made) when RunPod no
//              longer has it (lib/podRevive.js), waited for, and the style made ready on it (lib/podPrep.js: files, LoRAs,
//              node packs) once per run of the app; Override style's checkpoint goes to it (podRevive.modelGate).
//   2.763.1: a pod bitGen creates (asked, or made again) gets this computer's custom nodes first (lib/podNodes.js, once).
//   core.js puts params.pod_job {pod_id, port} on the job; lib/gpuSplit.js forJob sends it to that pod's ComfyUI.
// Pure (scripts/test-stylepods763.js): kindOfStyle, cleanLinks, podFor, podJob, pickGpu, vramFor, volumeFor, cuda13Template, portOf.
"use strict";
const pid = (id) => String(id || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 40);
const STYLE_KINDS = ["image", "image_edit", "video"];

/** a style's kind for pods (pure): video / music -> "video" (songs go with video - lib/gpuSplit.js), an image style
 *  whose graph follows an edit instruction -> "image_edit", else "image" */
function kindOfStyle(st, isEdit) {
  const k = String((st || {}).kind || "image");
  if (k === "video" || k === "music") return "video";
  return isEdit && isEdit(st) ? "image_edit" : "image";
}
/** {style id: pod id} tidied (pure) */
function cleanLinks(o) {
  const out = {};
  for (const [k, v] of Object.entries(o || {})) { const s = String(k).replace(/[^\w.-]/g, "").slice(0, 80), p = pid(v); if (s && p) out[s] = p; }
  return out;
}
/** the pod ticked for a kind (pure) */
function kindPod(r, kind) {
  const cfg = (r || {}).pod_cfg || {};
  const one = (k) => Object.keys(cfg).find((p) => ((cfg[p] || {}).kinds || []).includes(k)) || "";
  return one(kind) || (kind === "image_edit" ? one("image") : "");
}
/** which pod renders a style (pure) -> {pod_id, how: "style" | "kind" | "shared"} | null */
function podFor(r, st, kind) {
  const g = r || {}, links = cleanLinks(g.style_pods);
  if (st && links[st.id]) return { pod_id: links[st.id], how: "style" };
  const kp = kindPod(g, kind);
  if (kp) return { pod_id: pid(kp), how: "kind" };
  const rp = pid((g.runpod || {}).pod_id);
  return rp ? { pod_id: rp, how: "shared" } : null;
}
/** does a render go to a pod? (pure) on = Remote generation on, eng = engineOf(), sp = the split, box = "image" | "video",
 *  linked = the style has its own pod */
function podJob(on, eng, sp, box, linked) {
  if (!on || !eng || !eng.pods) return false;
  const s = sp || {};
  if (s.where === "remote") return true;
  if (s.where === "both") return !!s[box] || !!linked;
  return false;
}
/** the GPU offered first (pure): the cheapest one offered with at least minGb of memory, else the biggest offered */
function pickGpu(gpus, minGb) {
  const ok = (gpus || []).filter((g) => g && g.offered && g.price != null);
  const big = ok.filter((g) => +g.memory >= minGb).sort((a, b) => a.price - b.price || a.memory - b.memory);
  return big[0] || ok.sort((a, b) => b.memory - a.memory)[0] || null;
}
/** the GPU memory a style's model files want (pure): bytes of its diffusion model / checkpoint -> GB (24 at least) */
function vramFor(bytes) {
  const need = (+bytes || 0) / 1e9 * 1.3 + 4;
  return [24, 32, 48, 80, 96, 141].find((t) => t >= need) || 141;
}
/** the pod's disk for a style's files (pure) -> GB */
function volumeFor(bytes) { return Math.min(2000, Math.max(50, Math.ceil((+bytes || 0) / 1e9 * 1.25 + 30))); }
/** RunPod's "ComfyUI CUDA 13" template in the template list (pure) - by its name; an Official one first */
function cuda13Template(list) {
  const fits = (list || []).filter((t) => t && /comfy/i.test(t.name || "") && /cuda[\s_-]*13/i.test((t.name || "") + " " + (t.image || "")));
  const rank = (t) => ["official", "verified", "community"].indexOf(t.source) + (/^comfyui cuda 13$/i.test(String(t.name).trim()) ? -10 : 0);
  return fits.sort((a, b) => rank(a) - rank(b))[0] || null;
}
/** a pod's ComfyUI port (pure): how bitGen made it, else the pod in use's, else 8188 */
function portOf(r, id) {
  const g = r || {}, p = pid(id);
  return +(((g.pod_made || {})[p]) || {}).port || (pid((g.runpod || {}).pod_id) === p ? +((g.runpod || {}).port) : 0) || 8188;
}

/* ---------------- live */
function core() { return require("./core"); }
function rg() { return ((core().getConfig() || {}).rgpu) || {}; }
const G = () => require("./gpuSplit");
function isEdit(st) { try { return require("./aiEdit").isEditGraph(core().BASE, st.workflow); } catch { return false; } }
/** a style id -> its pod */
function link(styleId, podId) {
  const c = core().getConfig(), r = c.rgpu = c.rgpu || { mode: "local" };
  const l = cleanLinks(r.style_pods), s = String(styleId || "").replace(/[^\w.-]/g, "").slice(0, 80);
  if (!s) { const e = new Error("which style?"); e.status = 400; throw e; }
  if (podId) l[s] = pid(podId); else delete l[s];
  r.style_pods = l; core().setConfig(c);
  if (podId) require("./podPresets").onLink(pid(podId), s);   // 2.764.0: the pod's preset holds it too
  return l;
}
/** the styles linked to one pod */
function stylesOf(podId) { const p = pid(podId), l = cleanLinks(rg().style_pods); return Object.keys(l).filter((s) => l[s] === p); }
/** the pod's styles become `ids` (My pods ▸ 💾 Save) */
function setStylesOf(podId, ids) {
  const c = core().getConfig(), r = c.rgpu = c.rgpu || { mode: "local" }, p = pid(podId);
  const l = cleanLinks(r.style_pods);
  for (const s of Object.keys(l)) if (l[s] === p) delete l[s];
  for (const s of ids || []) { const k = String(s).replace(/[^\w.-]/g, "").slice(0, 80); if (k) l[k] = p; }
  r.style_pods = l; core().setConfig(c);
  require("./podPresets").onSet(p, stylesOf(p));   // 2.764.0
  return stylesOf(p);
}
/** a moved pod (made again) keeps its styles */
function movePod(from, to) {
  const c = core().getConfig(), r = c.rgpu = c.rgpu || {}, l = cleanLinks(r.style_pods);
  for (const s of Object.keys(l)) if (l[s] === pid(from)) l[s] = pid(to);
  r.style_pods = l; core().setConfig(c);
}

/** a pod bitGen made that still wants this computer's custom nodes (rgpu.pod_nodes {pod: "todo" | "done"}) */
function nodesTodo(pod, set) {
  const c = core().getConfig(), r = c.rgpu = c.rgpu || {};
  if (set) { r.pod_nodes = Object.assign({}, r.pod_nodes || {}, { [pid(pod)]: "todo" }); core().setConfig(c); return true; }
  return ((r.pod_nodes || {})[pid(pod)]) === "todo";
}
/** 2.763.3: a pod renders these kinds (image / image_edit / video) - taken from any other pod (one pod per kind) */
function setKinds(pod, kinds) {
  const c = core().getConfig(), r = c.rgpu = c.rgpu || {}, p = pid(pod), ks = STYLE_KINDS.filter((k) => (kinds || []).includes(k));
  const cfg = Object.assign({}, r.pod_cfg || {});
  for (const [k, v] of Object.entries(cfg)) if (k !== p) cfg[k] = Object.assign({}, v, { kinds: (v.kinds || []).filter((x) => !ks.includes(x)) });
  const mine = cfg[p] || { kinds: [], llm: { port: 8000, model: "", vlm_model: "" } };
  cfg[p] = Object.assign({}, mine, { kinds: [...new Set((mine.kinds || []).concat(ks))] });
  r.pod_cfg = cfg; core().setConfig(c);
  return cfg[p].kinds;
}
function nodesDone(pod) { const c = core().getConfig(), r = c.rgpu = c.rgpu || {}; r.pod_nodes = Object.assign({}, r.pod_nodes || {}, { [pid(pod)]: "done" }); core().setConfig(c); }
const GONE = {};      // style id -> how its pod that RunPod no longer has was made (the new one's form starts from it)
/** a pod RunPod no longer has: the styles linked to it, the kinds ticked on it and "the pod in use" let go of it */
function forgetPod(pod) {
  const c = core().getConfig(), r = c.rgpu = c.rgpu || {}, p = pid(pod), l = cleanLinks(r.style_pods);
  for (const s of Object.keys(l)) if (l[s] === p) delete l[s];
  r.style_pods = l;
  if (r.pod_cfg && r.pod_cfg[p]) r.pod_cfg[p] = Object.assign({}, r.pod_cfg[p], { kinds: [] });
  if (r.runpod && pid(r.runpod.pod_id) === p) { r.runpod.pod_id = ""; r.runpod.pod_name = ""; }
  core().setConfig(c);
}
const ASKS = {};      // ask id -> {id, style_id, style_name, kind, at, state: open | done | cancel, pod_id, note}
let ASKN = 0;
const RUN = {};       // pod id -> {phase: checking | ready | failed, note, at, new_id}
const READY = {};     // "<pod>|<style id>" -> made ready this run of the app
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function askFor(st, kind) {
  let a = Object.values(ASKS).find((x) => x.style_id === st.id && x.state !== "gone");
  if (!a) { const id = "pa" + (++ASKN); a = ASKS[id] = { id, style_id: st.id, style_name: st.name || st.id, kind, at: Date.now(), state: "open", note: "" }; }
  return a;
}
function askView(id) { const a = ASKS[String(id || "")]; return a ? { id: a.id, style_id: a.style_id, style_name: a.style_name, kind: a.kind, state: a.state, note: a.note, pod_id: a.pod_id || "" } : null; }
/** the job's style: the bytes of its model files (from this computer's lists / the catalogue) for the GPU + disk offer */
function sizeOf(st) {
  let bytes = 0, model = 0;
  try {
    const PP = require("./podPrep"), MF = require("./modelsFound"), fs = require("fs"), path = require("path"), C = core();
    const cat = JSON.parse(fs.readFileSync(path.join(C.BASE, "lib", "modelCatalog.json"), "utf8")).models || [];
    const list = (() => { try { return MF.read().models || []; } catch { return []; } })();
    const seen = new Set();
    for (const rel of PP.workflowsOf(st, C.getConfig())) {
      let g = null; try { g = JSON.parse(fs.readFileSync(path.isAbsolute(rel) ? rel : path.join(C.BASE, rel), "utf8")); } catch { g = null; }
      for (const n of MF.needs(g, st, st.kind || "image", {})) {
        const b = String(n.name).split(/[\\/]/).pop().toLowerCase(); if (seen.has(b)) continue; seen.add(b);
        const m = cat.find((x) => x && x.file && String(x.as || String(x.file).split("/").pop()).toLowerCase() === b);
        const l = list.find((x) => String(x.name).split(/[\\/]/).pop().toLowerCase() === b);
        const sz = +((l && l.size) || (m && m.size) || 0);
        bytes += sz;
        if (["checkpoints", "diffusion_models", "unet"].includes(n.cat)) model = Math.max(model, sz);
      }
    }
  } catch { /* the offer falls back to 24 GB / 50 GB */ }
  return { bytes, model };
}
/** what the ask box offers: GPUs (the first = bitGen's pick), your pods, the template, sizes */
/** 2.764.0: the presets whose pod is not on RunPod now (stopped ones are in the pods list) - name, GPU, the styles */
function PP0(pod) { try { return require("./podPresets").ofPod(pod); } catch { return null; } }
function presetsFor(pods) {
  let ps = []; try { ps = require("./podPresets").all(); } catch { ps = []; }
  const S = require("./styles"), on = new Set((pods || []).filter((p) => !/TERMINATED/.test(p.status)).map((p) => p.id));
  return ps.filter((p) => !(pods && p.pod_id && on.has(p.pod_id))).map((p) => ({ name: p.name, gpu: p.gpu_name || p.gpu, count: p.count, cloud: p.cloud,
    styles: p.styles.map((x) => { try { const s1 = S.byId(core().STYLES_DIR, x); return s1 ? s1.name : x; } catch { return x; } }) }));
}
async function offer(id, cloud) {
  const a = ASKS[String(id || "")];
  if (!a) { const e = new Error("that question is gone - press Generate again"); e.status = 404; throw e; }
  const S = require("./styles"), P = require("./pods"), st = S.byId(core().STYLES_DIR, a.style_id) || { id: a.style_id, name: a.style_name };
  const sz = sizeOf(st), need = vramFor(sz.model), vol = volumeFor(sz.bytes);
  const was0 = GONE[a.style_id] || null;
  const [g, t, m] = await Promise.allSettled([P.gpus(cloud || (was0 && was0.cloud)), P.templates({}), P.mine()]);
  const gpus = g.status === "fulfilled" ? g.value.gpus : [];
  const tpl = t.status === "fulfilled" ? cuda13Template(t.value.templates) : null;
  let pick = pickGpu(gpus, need);
  // 2.763.4: its pod is gone - the new one starts as that one was made (its GPU when offered, how many, the cloud, the disk,
  // its template when RunPod still lists it)
  const was = GONE[a.style_id] || null;
  let tplUse = tpl;
  if (was) {
    const g0 = gpus.find((g) => g.id === was.gpu && g.offered); if (g0) pick = g0;
    const t0 = t.status === "fulfilled" ? (t.value.templates || []).find((x) => x.id === was.template_id) : null; if (t0) tplUse = t0;
  }
  void presetsFor;   // 2.769.2: no presets of gone pods in the question (kept for 🖥 PODS ▸ 📦 Presets' own use)
  return { ask: askView(a.id), need_gb: need, volume_gb: Math.max(vol, (was && was.volume) || 0), size_gb: Math.round(sz.bytes / 1e8) / 10, gpus, pick: pick ? pick.id : "",
    count: (was && was.count) || 1, cloud: (was && was.cloud) || "SECURE", was: was ? { name: was.name, gpu: was.gpu } : null,
    template: tplUse ? { id: tplUse.id, name: tplUse.name, image: tplUse.image || "", ports: tplUse.ports || [] } : null, template_error: tpl ? "" : "RunPod's \"ComfyUI CUDA 13\" template was not found in its template list" + (t.status === "rejected" ? " (" + String((t.reason || {}).message || t.reason) + ")" : ""),
    // 2.769.2 (Tim: "if pods have been terminated or does not exist in my pods remove them from the dialog when a style is
    // chosen and no pod is selected for the style"): only the pods RunPod lists now (My pods), none terminated or being
    // terminated; the presets of pods that are gone are not offered here (🖥 PODS ▸ 📦 Presets still makes them again)
    pods_error: m.status === "rejected" ? String((m.reason && m.reason.message) || m.reason || "").slice(0, 200) : "",
    pods: m.status === "fulfilled" ? (m.value.pods || []).filter((p) => !/TERMINATED/.test(String(p.status || "") + " " + String(p.desired || ""))).map((p) => {
      // 2.764.0: what each pod holds + its GPU memory (the dialog says whether the style fits) + its preset
      const g = gpus.find((x) => x.id === p.gpu || x.name === p.gpu || String(x.id).replace(/^NVIDIA (GeForce )?/, "") === p.gpu), pr = PP0(p.id);
      return { id: p.id, name: p.name, status: p.status, gpu: p.gpu, gpus: p.gpus, cost_hr: p.cost_hr, memory: g ? (+g.memory || 0) * (p.gpus || 1) : 0,
        styles: stylesOf(p.id).map((x) => { const s1 = S.byId(core().STYLES_DIR, x); return s1 ? s1.name : x; }), preset: pr ? pr.name : "" };
    }) : [],
    presets: [] };
}
/** the answer: {action: create | use | cancel, gpu, cloud, volume, pod_id} */
async function answer(id, b) {
  const a = ASKS[String(id || "")], o = b || {};
  if (!a) { const e = new Error("that question is gone - press Generate again"); e.status = 404; throw e; }
  if (o.action === "cancel") { a.state = "cancel"; a.note = "cancelled"; return askView(a.id); }
  if (o.action === "use") {
    const p = pid(o.pod_id); if (!p) { const e = new Error("pick one of your pods"); e.status = 400; throw e; }
    link(a.style_id, p); a.state = "done"; a.pod_id = p; a.note = "using your pod " + p; return askView(a.id);
  }
  // 2.764.0 (Tim: "if a user clicks a style that is not assigned to a pod bring up a dialog with my pods and a + style
  // button"): ＋ on a preset - the style joins it and ▶ starts it (a terminated preset's pod is made again, its GPU not free =
  // the dialog asks which); the render then waits for that pod
  if (o.action === "preset") {
    const PP = require("./podPresets");
    await PP.styles(String(o.name || ""), [a.style_id], []);
    const r = await PP.play(String(o.name || ""), { gpu: o.gpu });
    if (r.need_gpu) return Object.assign(askView(a.id), r);
    link(a.style_id, r.pod_id); a.state = "done"; a.pod_id = r.pod_id; a.note = "using the preset " + o.name + " (pod " + r.pod_id + ")";
    return Object.assign(askView(a.id), { preset: String(o.name), play: r });
  }
  if (o.action !== "create") { const e = new Error("create, use, preset or cancel?"); e.status = 400; throw e; }
  const P = require("./pods"), t = cuda13Template((await P.templates({})).templates);
  if (!t) { const e = new Error("RunPod's \"ComfyUI CUDA 13\" template was not found - create a pod in the PODS docker and use it"); e.status = 404; throw e; }
  if (!String(o.gpu || "").trim()) { const e = new Error("pick a GPU"); e.status = 400; throw e; }
  a.note = "creating a pod on " + o.gpu;
  const made = await P.create({ templateId: t.id, name: ("bitGen " + a.style_name).slice(0, 60), gpu: o.gpu, count: 1, cloud: o.cloud, disk: 50,
    volume: +o.volume || 50, port: P.comfyPort(t) || 8188, cuda: "13.0" });
  link(a.style_id, made.pod.id);
  a.state = "done"; a.pod_id = made.pod.id; a.note = "created pod " + made.pod.name;
  return Object.assign(askView(a.id), { pod: made.pod });
}
/** start / make again / wait / make the style ready - in the background */
async function ready(pod, st, port) {
  const R = RUN[pod], say = (n) => { R.note = n; R.at = Date.now(); };
  const P = require("./pods"), A = require("./runpodApi"), RV = require("./podRevive");
  try {
    say("checking the pod on RunPod");
    const list = (await P.mine()).pods || [];
    const p = list.find((x) => x.id === pod);
    let id = pod;
    if (!p || /TERMINATED/.test(p.status)) {
      // 2.763.4 (Tim: "the pod was created automatically, i didn't get to choose the gpu pod, show all the details before i
      // create the pod"): a pod RunPod no longer has is never made again by itself - its links go, and the render asks
      // (the PODS docker, filled in with how the old pod was made: its template, GPU, how many, cloud, disk)
      let rc = null; try { rc = await RV.recipe(pod); } catch { rc = null; }
      GONE[st.id] = { pod, name: (rc && rc.name) || pod, template_id: (rc && rc.template_id) || "", gpu: (rc && rc.gpu) || "", count: (rc && rc.count) || 1,
        cloud: (rc && rc.cloud) || "SECURE", volume: (rc && rc.volume) || 0, at: Date.now() };
      forgetPod(pod);
      R.phase = "gone"; R.note = "the pod for " + st.name + " is gone on RunPod - make a new one (the PODS docker)";
      return;
    }
    // 2.771.0: a stopped pod started (and waited for) is a pod preparation in 📊 Statistics (lib/genStats.js)
    const t0 = Date.now(), started = /EXITED|STOPPED|ERROR/.test(p.status);
    if (started) {
      say("starting the stopped pod " + (p.name || pod));
      await A.action(pod, "start", String((rg().runpod || {}).key || ""));
      try { P.remember(pod, p.name, "started"); } catch { /* the exit rule */ }
    }
    await RV.waitReady(id, port, say);
    if (started || Date.now() - t0 > 20000) { try { require("./genStats").recordPrep({ pod: id, kind: "start", at: t0, phases: { start: Date.now() - t0 }, styles: [st.name] }); } catch { /* never block */ } }
    // 2.763.1 (Tim: "we may have to upload all of the nodes in comfy custom nodes to the pod and restart the pod when
    // created"): a pod bitGen made for a style gets every custom node pack of this computer's ComfyUI, once
    // 2.764.2 (Tim: "only upload nodes that are necessary for the workflows we are using to the pod"): no longer every custom
    // node pack of this computer - lib/podPrep.js puts on the pod only the packs whose nodes the style's workflows use
    const key = id + "|" + st.id;
    if (!READY[key]) {
      const r = await require("./podPrep").prepare(id, port, [st], { say: (t) => say("making " + st.name + " ready: " + t) });
      // 2.763.3: files the pod still lacks = the render would fail - the job stops with them named
      // 2.769.1: what is known about the missing files first (where each is / why), then the rest
      const about = (p) => (r.notThere || []).some((n) => String(p).startsWith(n + " ")) ? 0 : 1;
      if ((r.notThere || []).length) throw new Error(`${st.name} cannot render on the pod yet - these files are not on it: ${r.notThere.join(", ")}` + (r.problems.length ? " (" + r.problems.slice().sort((a, b) => about(a) - about(b)).join("; ") + ")" : ""));
      // 2.766.4: a node the pod's ComfyUI still lacks = the render would fail there - stopped here with why (and tried again
      // the next time - not kept as ready)
      if ((r.lacks || []).length) throw new Error(`${st.name} cannot render on the pod yet - its ComfyUI lacks ${r.lacks.slice(0, 6).join(", ")}` + (r.problems.length ? " (" + r.problems.join("; ") + ")" : ""));
      READY[key] = { at: Date.now(), problems: r.problems };
    }
    R.phase = "ready"; R.new_id = id; R.at = Date.now(); RV.mark(id);
  } catch (e) { R.phase = "failed"; R.note = String((e && e.message) || e).replace(/\x1b\[[0-9;]*[A-Za-z]/g, "").slice(0, 2000); }   // 2.769.1: the whole reason (was cut at 400)
}
/** core.js, before a job starts: null (not a pod job) | {wait, note, ask?} | {error} | {pod_id, port, model?} */
function gate(params) {
  const q = params || {}, st0 = q.video_style || q.style;
  if (!st0 || ["pod", "api", "remote"].includes(st0.runs_on)) return null;
  const st = st0.id ? st0 : Object.assign({}, st0, { id: String(q.video_style_id || q.style_id || "") });
  if (!st.id) return null;
  const box = G().kindOf(q.mode); if (!box) return null;
  const r = rg(), links = cleanLinks(r.style_pods), kind = kindOfStyle(st, isEdit);
  const on = G().enabled(), eng = G().engineOf(r), sp = G().split();
  // 2.763.1: a style with a pod of its own, or of its kind (a pod's ticks), goes to it on Both too
  if (!podJob(on, eng, sp, box, !!links[st.id] || !!kindPod(r, kind))) {
    if (on && eng.pods && sp.where === "both")
      return { local: true, note: `${st.name} renders on this computer - Basic Settings ▸ GPU is Both and ${box === "video" ? "Video" : "Image"} is not ticked. Tick it, or give the style a pod (🖥 PODS ▸ My pods ▸ a pod ▸ Styles), to render it on a pod` };
    return null;
  }
  let t = podFor(r, st, kind);
  if (!t) {
    const a = askFor(st, kind);
    if (a.state === "cancel") { a.state = "gone"; return { error: `not rendered - you cancelled the question (no pod renders ${st.name}; 🖥 PODS ▸ My pods ▸ a pod ▸ Styles links a style to a pod)`, cancelled: true }; }
    if (a.state !== "done") return { wait: 3000, note: `waiting for you - no pod renders ${st.name} yet: create one or use one of yours (the box on screen)`, ask: a.id };
    a.state = "gone"; t = { pod_id: a.pod_id, how: "style" };
  }
  const pod = t.pod_id, port = portOf(r, pod);
  const R = RUN[pod];
  if (R && R.phase === "failed") { delete RUN[pod]; return { error: R.note }; }
  if (R && R.phase === "gone") { delete RUN[pod]; return gate(params); }   // 2.763.4: asks now (its links are gone)
  if (R && R.phase !== "ready") return { wait: 5000, note: R.note };
  const use = (R && R.new_id) || pod;
  // checked lately and this style made ready on it = go; else (again) start / make again / wait / make ready
  if (!(R && READY[use + "|" + st.id] && Date.now() - R.at < 5 * 60000)) {
    RUN[pod] = { phase: "checking", note: "checking the pod on RunPod", at: Date.now() };
    ready(pod, st, port);
    return { wait: 3000, note: RUN[pod].note };
  }
  const mg = require("./podRevive").modelGate(st, use, portOf(rg(), use));   // 2.766.1: the pod's own port
  if (mg && (mg.wait || mg.error)) return mg;
  const pr = (READY[use + "|" + st.id] || {}).problems || [];   // 2.763.3: what making it ready could not do is in the log
  return Object.assign({ pod_id: use, port: portOf(rg(), use), note: `${st.name} renders on pod ${use}` + (t.how === "kind" ? " (the pod for " + kind.replace("_", " ") + " styles)" : t.how === "shared" ? " (the pod in use)" : "")
    + (pr.length ? " - note: " + pr.join("; ") : "") }, mg && mg.model ? { model: mg.model } : {});
}
/** 2.763.2 (Tim: the render failed at once and his own ComfyUI was started): does a render of this style go to a RunPod pod?
 *  -> {pod: bool, why} - the page then skips what only this computer's ComfyUI can answer (starting it, its model lists,
 *  its dropdowns) and the server's "models not found" check */
function willUsePod(mode, st) {
  if (!st) return { pod: false, why: "no style" };
  if (st.runs_on === "pod") return { pod: true, why: "a P_ pod style" };
  if (st.runs_on === "api" || st.runs_on === "remote") return { pod: false, why: "an " + st.runs_on + " style" };
  const box = G().kindOf(mode || (st.kind === "image" ? "image" : "video"));
  if (!box) return { pod: false, why: "this job never leaves this computer" };
  const r = rg(), links = cleanLinks(r.style_pods), kind = kindOfStyle(st, isEdit);
  const on = podJob(G().enabled(), G().engineOf(r), G().split(), box, !!links[st.id] || !!kindPod(r, kind));
  return { pod: on, why: on ? "Basic Settings ▸ GPU ▸ RunPod ▸ Pods" : "this computer" };
}
/** the PODS docker: a pod's state */
function status(podId) { const r = RUN[pid(podId)]; return r ? { phase: r.phase, note: r.note } : null; }
module.exports = { STYLE_KINDS, kindOfStyle, cleanLinks, kindPod, podFor, podJob, pickGpu, vramFor, volumeFor, cuda13Template, portOf,
  link, stylesOf, setStylesOf, movePod, gate, offer, answer, askView, askFor, status, sizeOf, sleep, willUsePod, setKinds, nodesTodo, nodesDone };
