// bitGen Studio — lib/podRevive.js (2.761.0): A P_ STYLE MAKES ITS POD AGAIN WHEN IT IS GONE.
// Tim (verbatim): "when the style is created store the runpod template used and models etc, create a new pod if the pod
// doesn't exist for the style and start it automatically and upload the models + loras or get them from the link if the
// model is not on the computer"
//   RECIPE   a P_ style keeps pod_recipe = {template_id, template_name, gpu, count, cloud, disk, volume, port, name,
//            files: [{name, folder, path | url}]} - how its pod was made (lib/pods.js create -> rgpu.pod_made, or what
//            RunPod says of a pod made on its site) and what bitGen put on it (lib/podModels.js putFiles: ⬇ Models, a link,
//            ➕ Checkpoint / ➕ LoRA from this computer)
//   AT RENDER core.js asks gate(style) before a P_ job starts: the job waits ("[pod] …" in its log) while bitGen
//            - starts the pod when it is stopped,
//            - or, when RunPod no longer has it, creates a new pod from the recipe (same template, GPU, cloud, sizes),
//            - waits for its ComfyUI (and Jupyter),
//            - puts the recipe's files on it that it lacks: from this computer when the file is still there, else from
//              its link, else from bitGen's download list by its name,
//            then the job renders there. Every P_ style of the old pod (and Remote generation's pod) moves to the new one.
// Pure (scripts/test-podsetup761.js): cleanRecipe, recipeOf, missingOf, sourceOf.
"use strict";
const fs = require("fs");
const pid = (id) => String(id || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 40);
const str = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, "").trim().slice(0, n);

/** a recipe, tidied (pure) -> the recipe | null (no template = nothing to make a pod from) */
function cleanRecipe(r) {
  if (!r || typeof r !== "object") return null;
  const t = str(r.template_id, 40).replace(/[^A-Za-z0-9]/g, "");
  if (!t) return null;
  const files = (Array.isArray(r.files) ? r.files : []).filter((f) => f && f.name && f.folder).slice(0, 200).map((f) => Object.assign(
    { name: str(f.name, 200).replace(/[^\w.+ -]+/g, "_"), folder: str(f.folder, 200) },
    f.path ? { path: str(f.path, 1000) } : {}, /^https?:\/\//i.test(String(f.url || "")) ? { url: str(f.url, 2000) } : {}));
  const n = (v, lo, hi, d) => { const x = parseInt(v, 10); return x >= lo && x <= hi ? x : d; };
  return { template_id: t, template_name: str(r.template_name, 120), gpu: str(r.gpu, 80), count: n(r.count, 1, 8, 1), cloud: String(r.cloud || "").toUpperCase() === "COMMUNITY" ? "COMMUNITY" : "SECURE",
    disk: n(r.disk, 10, 1000, 50), volume: n(r.volume, 10, 2000, 50), port: n(r.port, 1, 65535, 8188), name: str(r.name, 60), files };
}
/** a pod's recipe (pure): how bitGen made it (rgpu.pod_made), else what RunPod's own record says (raw), + the files bitGen put
 *  on it (rgpu.pod_files) -> recipe | null */
function recipeOf(rgpu, id, raw) {
  const r = rgpu || {}, p = pid(id), made = (r.pod_made || {})[p], w = raw || {};
  const g = w.gpu || w.machine || {};
  const base = made || { template_id: w.templateId || w.template_id || (w.template && w.template.id) || "", template_name: (w.template && w.template.name) || "",
    gpu: g.id || g.gpuTypeId || w.gpuTypeId || "", count: g.count || w.gpuCount || 1, cloud: w.cloudType || w.cloud || "SECURE",
    disk: w.containerDiskInGb || w.containerDisk || w.disk, volume: w.volumeInGb || w.volume, port: 0, name: w.name || "" };
  return cleanRecipe(Object.assign({}, base, { files: ((r.pod_files || {})[p] || []) }));
}
/** the recipe files the pod lacks (pure): have = the pod's model lists {cat: [names]} */
function missingOf(files, have) {
  const on = new Set();
  for (const list of Object.values(have || {})) for (const n of list || []) on.add(String(n).split(/[\\/]/).pop());
  return (files || []).filter((f) => !on.has(String(f.name).split(/[\\/]/).pop()));
}
/** where a file comes from (pure): "path" (still on this computer) | "url" | "catalog" | "" ; exists = fs.existsSync-like */
function sourceOf(f, exists, catalogUrl) {
  if (f.path && exists(f.path)) return { how: "path" };
  if (f.url) return { how: "url", url: f.url };
  const u = catalogUrl && catalogUrl(f.name);
  return u ? { how: "url", url: u, catalog: true } : { how: "" };
}

/* ---------------- live */
function core() { return require("./core"); }
function rg() { return ((core().getConfig() || {}).rgpu) || {}; }
const REV = {};        // old pod id -> {phase, note, at, new_id}
const MOVED = {};      // old pod id -> new pod id (this run of the app)
const KNOWN = {};      // pod id -> {ok, at} - the pod answered lately
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const POLL = () => +(process.env.H3_POD_REVIVE_POLL || 10000);

/** the recipe for a P_ style made from pod `id` (lib/podStyles.js make) */
async function recipe(id) {
  const p = pid(id), r = rg();
  let raw = null;
  if (!(r.pod_made || {})[p]) { try { raw = await require("./runpodApi").pod(p, String((r.runpod || {}).key || "")); } catch { raw = null; } }
  return recipeOf(r, p, raw);
}
/** every P_ style (and Remote generation's pod) on pod `from` moves to pod `to` */
function moveStyles(from, to, name) {
  const S = require("./styles"), C = core();
  for (const st of S.read(C.STYLES_DIR)) if (st.runs_on === "pod" && st.pod_id === from) { try { S.save(C.STYLES_DIR, Object.assign({}, st, { pod_id: to, pod_name: name || st.pod_name })); } catch { /* the next one */ } }
  const c = C.getConfig(), r = c.rgpu || {};
  if (r.runpod && r.runpod.pod_id === from) { r.runpod.pod_id = to; if (name) r.runpod.pod_name = name; }
  for (const k of ["pod_llm", "pod_vlm"]) if (r[k] && r[k].pod_id === from) r[k].pod_id = to;
  if (r.pod_cfg && r.pod_cfg[from]) { r.pod_cfg[to] = r.pod_cfg[from]; }
  if (r.pod_files && r.pod_files[from]) { r.pod_files[to] = r.pod_files[from]; }
  C.setConfig(c);
}
async function waitReady(id, port, say) {
  const PM = require("./podModels"), t0 = Date.now(), MAX = +(process.env.H3_POD_REVIVE_MAX || 45 * 60000);
  for (;;) {
    try { const w = await PM.ways(id, port); if (w) return w; } catch (e) { if (e.status !== 409 && !/not answering/.test(String(e.message))) throw e; }
    if (Date.now() - t0 > MAX) throw new Error("the pod's ComfyUI did not answer in " + Math.round(MAX / 60000) + " minutes");
    say("loading pod - waiting for its ComfyUI (" + Math.round((Date.now() - t0) / 60000) + " min)");
    await sleep(POLL());
  }
}
async function pushFiles(id, port, files, say) {
  const PM = require("./podModels"), PS = require("./podStyles");
  let have = {}; try { have = (await PS.contents(id, port)).models; } catch { have = {}; }
  const todo = missingOf(files, have), cat = (() => { try { return PM.catalog(); } catch { return []; } })();
  const catUrl = (name) => { const m = (Array.isArray(cat) ? cat : []).find((x) => x.name === name); return m ? m.url : ""; };
  const skipped = [];
  for (const f of todo) {
    const src = sourceOf(f, (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } }, catUrl);
    if (!src.how) { skipped.push(f.name); continue; }
    say((src.how === "path" ? "uploading " : "downloading ") + f.name + " into " + f.folder);
    if (src.how === "path") await PM.upload(id, { path: f.path, folder: f.folder, port });
    else await PM.fromLink(id, { url: src.url, folder: f.folder, name: f.name, port });
    for (;;) {                                     // one at a time - the pod's Jupyter takes one upload
      await sleep(POLL());
      const s = await PM.state(id, port).catch(() => ({ running: false, files: [] }));
      const mine = (s.files || []).find((x) => String(x.name).startsWith(f.name));
      if (!s.running || (mine && mine.state && !["uploading", "downloading", "queued", "waiting"].includes(mine.state))) {
        if (mine && /^failed/.test(String(mine.state))) skipped.push(f.name + " (" + mine.state + ")");
        break;
      }
      if (mine && mine.size) say((src.how === "path" ? "uploading " : "downloading ") + f.name + " - " + Math.round(100 * (mine.done || 0) / mine.size) + "%");
    }
  }
  return skipped;
}
async function run(st) {
  const old = pid(st.pod_id), R = REV[old], say = (n) => { R.note = n; R.at = Date.now(); };
  const P = require("./pods"), A = require("./runpodApi");
  try {
    const port = +st.pod_port || +((st.pod_recipe || {}).port) || +((rg().runpod || {}).port) || 8188;
    say("checking the style's pod on RunPod");
    const list = (await P.mine()).pods || [];
    const p = list.find((x) => x.id === old);
    if (p && /RUNNING/.test(p.status)) {
      try { await require("./podModels").ways(old, port); KNOWN[old] = { ok: true, at: Date.now() }; R.phase = "ready"; R.new_id = old; return; } catch { /* still loading */ }
    }
    let id = old;
    const rc = cleanRecipe(st.pod_recipe);
    if (!p) {
      if (!rc) throw new Error(`the pod of ${st.name} is gone and the style does not say how it was made - create a pod in the PODS docker and press 💾 Save on it`);
      say("the pod is gone - creating a new one from " + (rc.template_name || "its template") + " on " + (rc.gpu || "the same GPU"));
      const made = await P.create({ templateId: rc.template_id, name: rc.name || st.pod_name || "bitGen pod", gpu: rc.gpu, count: rc.count, cloud: rc.cloud, disk: rc.disk, volume: rc.volume, port });
      id = made.pod.id; MOVED[old] = id; R.new_id = id;
      moveStyles(old, id, made.pod.name);
    } else if (/EXITED|STOPPED/.test(p.status)) {
      say("starting the stopped pod " + (p.name || old));
      await A.action(old, "start", String((rg().runpod || {}).key || ""));
    }
    await waitReady(id, port, say);
    const files = rc ? rc.files : [];
    const skipped = files.length ? await pushFiles(id, port, files, say) : [];
    KNOWN[id] = { ok: true, at: Date.now() };
    R.phase = "ready"; R.new_id = id;
    say(skipped.length ? "pod ready - could not put on it: " + skipped.join(", ") : "pod ready");
  } catch (e) {
    R.phase = "failed"; R.note = String((e && e.message) || e).slice(0, 300);
  }
}
/** core.js, before a P_ job starts -> null (go) | {wait: ms, note} | {error} | {pod_id} (go, on this pod - it moved) */
function gate(st) {
  if (!st || st.runs_on !== "pod" || !st.pod_id) return null;
  const old = pid(st.pod_id);
  if (MOVED[old] && !REV[old]) return { pod_id: MOVED[old] };
  const R = REV[old];
  if (R) {
    if (R.phase === "ready") { delete REV[old]; return R.new_id && R.new_id !== old ? { pod_id: R.new_id, note: R.note } : null; }
    if (R.phase === "failed") { delete REV[old]; return { error: R.note }; }
    return { wait: 5000, note: R.note };
  }
  const k = KNOWN[old];
  if (k && k.ok && Date.now() - k.at < 5 * 60000) return null;
  REV[old] = { phase: "checking", note: "checking the style's pod on RunPod", at: Date.now() };
  run(st);
  return { wait: 3000, note: REV[old].note };
}
/** the PODS docker / the queue: what is happening for a pod */
function status(id) { const r = REV[pid(id)]; return r ? { phase: r.phase, note: r.note, new_id: r.new_id || "" } : null; }
function mark(id) { KNOWN[pid(id)] = { ok: true, at: Date.now() }; }
module.exports = { cleanRecipe, recipeOf, missingOf, sourceOf, recipe, moveStyles, gate, status, mark, run };
