// bitGen Studio — lib/modelsWhere.js (2.806.0): A MISSING MODEL / LoRA - ON THE POD IT RENDERS ON, OR FOUND ONLINE FOR HERE.
//
// Tim (verbatim): "If any lora/model is missing popup a message box asking if bitgen should download it, download it to local
// if generation is in local mode or send to the pod if in runpod mode."
//
//   LOCAL   lib/modelsFound.js checks the files a render loads against ComfyUI's model paths here; a file in bitGen's download
//           list downloads through Settings ▸ Models (as before). NEW: a file that is not in the list (a LoRA, a fine-tune) is
//           looked for online by its name (lib/podFind.js: remote_models.json, its Civitai info card, a Civitai search) -
//           online(missing) adds {online: {from, size, model}} - and ⬇ Download fetches it into ComfyUI's models/<folder>
//           here: fetchLocal(items) finds the address again HERE (never one the page sends), Civitai's key on its downloads,
//           a .part file renamed when it is whole. fetchState() = the bars.
//   RUNPOD  a render that goes to a pod (lib/stylePods.js / lib/podPick.js) was not checked before ("its files are put on the
//           pod" - sent without asking). NEW: checkPod(rows, pod) asks the pod's ComfyUI what it lists (lib/podStyles.js
//           contents) and names the files it lacks; the box asks ⬆ Send to <pod>, then sendPod(pod, items) -> lib/podSend.js
//           queue (on the pod already / its download link / Civitai / sent from this computer) and podSendState(pod) = the bar.
//           A pod that does not answer (stopped, still loading) = not checked: the render's own pod preparation goes on as before.
// Pure (scripts/test-modelswhere806.js): catsFor, podMissing, cleanItems, partName.
"use strict";
const fs = require("fs");
const path = require("path");

const CKPT = ["checkpoints", "diffusion_models", "unet"];
/** the folders a needed file may be in on a pod (pure): a model in any of the model folders, the rest in its own */
function catsFor(cat) { return CKPT.includes(cat) ? CKPT.slice() : cat === "text_encoders" ? ["text_encoders", "clip"] : [String(cat || "checkpoints")]; }
/** the rows a pod lacks (pure): rows = modelsFound.needs(), models = the pod's lists {cat: [names]} */
function podMissing(rows, models) {
  const onPod = require("./podSend").onPod;
  return (rows || []).filter((r) => r && r.name && !onPod(models || {}, catsFor(r.cat), r.name));
}
/** the page's list -> [{name, cat}] (pure): names only - the address is always looked up again here */
function cleanItems(items) {
  return (Array.isArray(items) ? items : []).slice(0, 20).map((x) => ({ name: String((x && x.name) || "").replace(/\\/g, "/").replace(/^\/+/, "").slice(0, 300), cat: String((x && x.cat) || "checkpoints").replace(/[^a-z_]/gi, "") }))
    .filter((x) => x.name && !x.name.split("/").includes(".."));
}
const partName = (f) => f + ".part";

/* ---------------- RunPod */
function core() { return require("./core"); }
/** the pod a render goes to (kind image | video | music, st = its style, w = podPick.wouldPod's answer) -> {pod_id, name} | null */
function podOf(kind, st, w) {
  if (w && w.pod_id) return { pod_id: String(w.pod_id), name: nameOf(w.pod_id) };
  try {
    const SP = require("./stylePods"), mode = kind === "music" ? "music" : kind === "video" ? "t2va" : "image";
    if (!st || !SP.willUsePod(mode, st).pod) return null;
    const r = (core().getConfig() || {}).rgpu || {}, k = SP.kindOfStyle(st, (x) => { try { return require("./aiEdit").isEditGraph(core().BASE, x.workflow); } catch { return false; } });
    const p = SP.podFor(r, st, k);
    return p && p.pod_id ? { pod_id: p.pod_id, name: nameOf(p.pod_id) } : null;
  } catch { return null; }
}
function nameOf(id) { try { return require("./podInv").nameOf(id) || String(id); } catch { return String(id); } }
async function checkPod(rows, pod, o) {
  const want = (rows || []).filter((r) => r && r.name);
  const base = { checked: false, place: "pod", pod_id: pod.pod_id, pod_name: pod.name, needed: want.length, found: 0, missing: [] };
  if (!want.length) return Object.assign(base, { checked: true });
  let have = null;
  try {
    const get = (o && o.contents) || ((id) => require("./podStyles").contents(id));
    have = await Promise.race([get(pod.pod_id), new Promise((_, no) => setTimeout(() => no(new Error("the pod did not answer in 25 s")), (o && o.wait) || 25000))]);
  } catch (e) { return Object.assign(base, { why: "the pod " + pod.name + " could not be asked (" + String((e && e.message) || e).slice(0, 160) + ") - its own preparation puts the files on it" }); }
  const miss = podMissing(want, have.models);
  let local = null;
  const here = (name, cat) => { try { local = local || require("./podSend").localScan(); return !!require("./podSend").findLocal(local, catsFor(cat), name); } catch { return false; } };
  const FL = require("./modelsFound").FOLDER_LABEL || {};
  return Object.assign(base, { checked: true, found: want.length - miss.length,
    missing: miss.map((m) => ({ name: m.name, cat: m.cat, folder: FL[m.cat] || "models/" + m.cat, from: m.from, here: here(m.name, m.cat) })) });
}
const SENT = {};   // pod -> the podSend status of this box's send
function sendPod(podId, items) {
  const id = String(podId || "").replace(/[^A-Za-z0-9]/g, ""); if (!id) { const e = new Error("which pod?"); e.status = 400; throw e; }
  const list = cleanItems(items).map((x) => ({ name: x.name, cats: catsFor(x.cat) }));
  if (!list.length) { const e = new Error("nothing to send"); e.status = 400; throw e; }
  SENT[id] = require("./podSend").queue(id, null, list);
  return { ok: true, pod_id: id, items: list.map((x) => x.name) };
}
function podSendState(podId) { const id = String(podId || "").replace(/[^A-Za-z0-9]/g, ""); return require("./podSend").status(id) || { running: false, items: [], done: [], failed: [] }; }

/* ---------------- this computer: found online */
let D = null;   // deps (tests)
function deps() { return D || { find: (cats, name) => require("./podFind").find(cats, name), fetch: (u, o) => fetch(u, o), dir: () => require("./modelsFound").target().dir, key: () => { try { return require("./civitai").cfg().token || ""; } catch { return ""; } } }; }
function setDeps(d) { D = d; }
/** rows the download list does not have -> each with {online: {from, size, model}} when found online (8 s a file, 15 s in all) */
async function online(missing, budgetMs) {
  const d = deps(), until = Date.now() + (budgetMs || 15000);
  for (const m of missing || []) {
    if (!m || m.source) continue;
    if (Date.now() > until) break;                                  // the box must not wait long - the rest stay "not in the list" 
    try {
      const hit = await Promise.race([d.find(catsFor(m.cat), m.name), new Promise((ok) => setTimeout(() => ok(null), 8000))]);
      if (hit && hit.url) m.online = { from: hit.from || "online", size: +hit.size || 0, model: hit.model || "" };
    } catch { /* not found online */ }
  }
  return missing;
}
const FETCH = {};   // name -> {name, cat, state queued|run|ok|err, got, total, error}
function fetchState() { return { busy: Object.values(FETCH).some((f) => f.state === "queued" || f.state === "run"), files: Object.assign({}, FETCH) }; }
function fetchLocal(items) {
  const list = cleanItems(items);
  if (!list.length) { const e = new Error("nothing to download"); e.status = 400; throw e; }
  for (const it of list) {
    if (FETCH[it.name] && (FETCH[it.name].state === "run" || FETCH[it.name].state === "queued")) continue;
    FETCH[it.name] = { name: it.name, cat: it.cat, state: "queued", got: 0, total: 0, error: "" };
  }
  (async () => { for (const it of list) { const f = FETCH[it.name]; if (f.state === "queued") await one(it, f); } })();
  return { ok: true, items: list.map((x) => x.name) };
}
async function one(it, f) {
  const d = deps();
  f.state = "run";
  try {
    const root = d.dir(); if (!root) throw new Error("no ComfyUI folder here (Settings ▸ ComfyUI)");
    const hit = await d.find(catsFor(it.cat), it.name);
    if (!hit || !hit.url) throw new Error("not found online any more");
    const folder = it.cat === "unet" ? "diffusion_models" : it.cat;
    const dest = path.join(root, "models", folder, ...it.name.split("/"));
    const u = new URL(hit.url);
    if (/civitai\.(com|red)$/i.test(u.hostname)) { const k = d.key(); if (k && !u.searchParams.get("token")) u.searchParams.set("token", k); }
    const r = await d.fetch(u.toString(), { redirect: "follow" });
    if (!r.ok || !r.body) throw new Error("HTTP " + r.status + (r.status === 401 || r.status === 403 ? " - Civitai wants your API key (Settings ▸ General ▸ Civitai)" : ""));
    f.total = +r.headers.get("content-length") || +hit.size || 0;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const part = partName(dest), out = fs.createWriteStream(part);
    const rd = r.body.getReader();
    for (;;) {
      const { done, value } = await rd.read(); if (done) break;
      f.got += value.length;
      if (!out.write(Buffer.from(value))) await new Promise((ok) => out.once("drain", ok));
    }
    await new Promise((ok, no) => out.end((e) => (e ? no(e) : ok())));
    if (f.total && f.got < f.total) throw new Error("the download stopped at " + Math.round(100 * f.got / f.total) + " %");
    fs.renameSync(part, dest);
    f.state = "ok";
  } catch (e) { f.state = "err"; f.error = String((e && e.message) || e).slice(0, 240); }
}

module.exports = { CKPT, catsFor, podMissing, cleanItems, partName, podOf, checkPod, sendPod, podSendState, online, fetchLocal, fetchState, setDeps };
