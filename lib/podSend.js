// bitGen Studio — lib/podSend.js (2.762.0): A MODEL OF THIS COMPUTER ONTO A POD - picked from the same lists Basic Settings'
// Override style has (ComfyUI's models folders here), sent once, then used by its name.
// Tim (verbatim): "in pods for lora and checkpoint and folder filters use the same dropdown types like overide settings has.
// we only upload 1 checkpoint for each pod then this pod becomes the style, if overide settings is selected and pods are
// selected in basic settings then upload the selected checkpoint, the workflow for the style like a krea style will use our
// krea workflow, if the model is already on the pod the just select it as the model to use. this can simplify user experience"
//   findLocal(scan, cats, name)   the file behind a name in this computer's lists (lib/comfyModels.js scan: each file's root)
//   onPod(models, cats, name)     the pod already has it (the same name, else the same file name in another folder) -> its name
//   folderFor(cat, rel)           where it goes on the pod: the same category and sub-folder as here ("checkpoints/SDXL")
//   ensure(pod, cats, name)       on the pod already = its name; else sent from this computer (the pod's Jupyter), waited for
//   queue(pod, items)             several, one after the other, in the background (💾 Save in My pods) -> status(pod)
// Pure (scripts/test-podsend762.js): norm, findLocal, onPod, folderFor.
"use strict";
const path = require("path");
const CKPT_CATS = ["checkpoints", "diffusion_models", "unet"];
const norm = (s) => String(s || "").replace(/\\/g, "/").replace(/^\/+/, "");
const base = (s) => norm(s).split("/").pop().toLowerCase();

/** a name in this computer's lists -> {path, category, rel} | null (pure: scan = comfyModels.scan's answer) */
function findLocal(scan, cats, name) {
  const n = norm(name).toLowerCase(), cs = (scan && scan.categories) || {};
  let byBase = null;
  for (const c of cats || []) for (const f of ((cs[c] || {}).files || [])) {
    if (!f || !f.root) continue;
    const rel = norm(f.name);
    if (rel.toLowerCase() === n) return { path: path.join(f.root, ...rel.split("/")), category: c, rel };
    if (!byBase && base(rel) === base(n)) byBase = { path: path.join(f.root, ...rel.split("/")), category: c, rel };
  }
  return byBase;
}
/** the pod's own name for a model it already has (pure: models = the pod's lists {cat: [names]}) -> name | "" */
function onPod(models, cats, name) {
  const n = norm(name).toLowerCase(), m = models || {};
  let byBase = "";
  for (const c of cats || []) for (const x of m[c] || []) {
    if (norm(x).toLowerCase() === n) return x;
    if (!byBase && base(x) === base(n)) byBase = x;
  }
  return byBase;
}
/** where a file goes on the pod (pure): its category + its sub-folders here (two at most - deeper ones go in the second) */
function folderFor(cat, rel) {
  const dirs = norm(rel).split("/").slice(0, -1).filter((d) => /^[\w.+ -]{1,64}$/.test(d) && !/^\.+$/.test(d)).slice(0, 2);
  return [cat].concat(dirs).join("/");
}

/** 2.764.1: how far a file sent to the pod is (pure): "sending <name> to the pod - 1.2 of 6.5 GB (18%) · 3.4 MB/s · about
 *  25 min left"; secs = the time so far */
function progressText(name, done, size, secs) {
  const gb = (n) => (n >= 1e9 ? (n / 1e9).toFixed(1) + " GB" : Math.round(n / 1e6) + " MB");
  const nm = norm(name).split("/").pop();
  if (!(+size > 0)) return "sending " + nm + " to the pod";
  const d = Math.max(0, Math.min(+done || 0, +size)), pct = Math.floor(100 * d / size);
  const rate = secs > 2 && d > 0 ? d / secs : 0, left = rate > 0 ? (size - d) / rate : 0;
  const lt = left <= 0 ? "" : left < 90 ? " · under 2 min left" : left < 5400 ? " · about " + Math.round(left / 60) + " min left" : " · about " + (left / 3600).toFixed(1) + " h left";
  return "sending " + nm + " to the pod - " + gb(d) + " of " + gb(size) + " (" + pct + "%)" + (rate > 0 ? " · " + (rate / 1e6).toFixed(1) + " MB/s" + lt : "");
}

/* ---------------- live */
function core() { return require("./core"); }
function localScan() {
  const c = ((core().getConfig() || {}).engine || {}).comfy || {};
  const t = require("./comfyDetect").scanTarget(c);
  return require("./comfyModels").scan(t.dirAbs, { extraPaths: t.extraPaths });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const POLL = () => +(process.env.H3_POD_REVIVE_POLL || 3000);
/** one file sent and waited for -> "" | "why it failed"
 *  2.766.0: 1. the same file on Civitai (the pod downloads it), 2. your private Hugging Face repo (this computer puts it
 *  there ONCE - every pod then downloads it; it goes in runpod/pods/remote_models.json), 3. this computer sends it to the
 *  pod - each with a progress bar (lib/podTransfers.js). opts: {noCivitai, noHf, pod_name} */
async function sendOne(id, port, local, cat, say, opts) {
  const PM = require("./podModels"), PT = require("./podTransfers"), o = opts || {}, tell = (t) => { if (say) try { say(t); } catch { /* fine */ } };
  const folder = folderFor(cat, local.rel), name = local.rel.split("/").pop();
  let size = 0; try { size = require("fs").statSync(local.path).size; } catch { size = 0; }
  // 2.765.0 (Tim: "can you find my checkpoint and send it to the pod via civitai or civitai.red . if is very slow from my pc ,
  // 0.5mb/sec"): the same file on Civitai = the pod downloads it from there; this computer sends it only when that fails
  const on = o.noCivitai ? null : await viaCivitai(id, port, local, folder, name, size, tell, o);
  if (on === "") return "";
  const hf = o.noHf ? null : await viaHf(id, port, local, folder, name, size, tell, o);
  if (hf === "") return "";
  for (let i = 0; i < 600; i++) {            // the pod's Jupyter takes one upload at a time - wait for one running
    try { await PM.upload(id, { path: local.path, folder, name, port }); break; }
    catch (e) { if (!/upload to this pod is running/.test(String(e.message))) throw e; tell("waiting to send " + name + " - another file is going to the pod"); await sleep(POLL()); }
  }
  const t0 = Date.now(), x = PT.begin({ pod: id, pod_name: o.pod_name, name, how: "upload", from: "this computer", size });
  tell(progressText(name, 0, size, 0));
  for (;;) {
    await sleep(POLL());
    const s = await PM.state(id, port).catch(() => ({ files: [] }));
    const f = (s.files || []).filter((y) => String(y.name).startsWith(name)).pop();
    if (f && f.state !== "uploading") { PT.end(x, f.state === "done" ? "done" : String(f.state)); return f.state === "done" ? "" : String(f.state); }
    if (f) PT.step(x, f.done || 0, f.size || size);
    if (SEND[id]) SEND[id].pct = f && f.size ? Math.round(100 * (f.done || 0) / f.size) : 0;
    tell(progressText(name, f ? f.done || 0 : 0, (f && f.size) || size, (Date.now() - t0) / 1000));   // 2.764.1
  }
}
/** 2.765.0: how far the pod's download from Civitai is (pure) */
function pullText(name, site, done, size, secs) {
  const gb = (n) => (n >= 1e9 ? (n / 1e9).toFixed(1) + " GB" : Math.round(n / 1e6) + " MB");
  const nm = norm(name).split("/").pop(), head = "the pod is downloading " + nm + " from " + site;
  if (!(+size > 0)) return head;
  const d = Math.max(0, Math.min(+done || 0, +size)), rate = secs > 2 && d > 0 ? d / secs : 0, left = rate > 0 ? (size - d) / rate : 0;
  const lt = left <= 0 ? "" : left < 90 ? " · under 2 min left" : " · about " + Math.round(left / 60) + " min left";
  return head + " - " + gb(d) + " of " + gb(size) + " (" + Math.floor(100 * d / size) + "%)" + (rate > 0 ? " · " + (rate / 1e6).toFixed(1) + " MB/s" + lt : "");
}
/** 2.766.0: one pod downloads at a time (its status file is one) - the next waits */
const LOCK = {};
function locked(id, fn) { const prev = LOCK[id] || Promise.resolve(); const next = prev.then(fn, fn); LOCK[id] = next.catch(() => null); return next; }
/** 2.766.0: the pod downloads a link into models/<folder>/<name> and it is waited for, with its progress bar -> "" | why
 *  o = {url, folder, name, size, from (where - for the words), pod_name} */
function pullWait(id, port, o, say) {
  return locked(id, async () => {
    const PM = require("./podModels"), PT = require("./podTransfers"), tell = (t) => { if (say) try { say(t); } catch { /* fine */ } };
    const x = PT.begin({ pod: id, pod_name: o.pod_name, name: o.name, how: "download", from: o.from, size: o.size });
    try { await PM.fromLink(id, { url: o.url, folder: o.folder, name: o.name, size: o.size || 0, port }); }
    catch (e) { const w = String((e && e.message) || e); PT.end(x, "failed: " + w); return w; }
    const t0 = Date.now();
    for (;;) {
      await sleep(POLL());
      const s = await PM.state(id, port).catch(() => ({ files: [] }));
      const f = (s.files || []).find((y) => y.name === o.name);
      if (f && /^(done|there already)$/.test(f.state)) { PT.end(x, "done"); return ""; }
      if (f && /^failed/.test(String(f.state))) { const w = String(f.state).replace(/^failed: /, ""); PT.end(x, "failed: " + w); return w; }
      if (!f && !s.running && Date.now() - t0 > 60000) { PT.end(x, "failed: the pod did not say how the download went"); return "the pod did not say how the download went"; }
      if (f) PT.step(x, f.done || 0, f.size || o.size);
      if (SEND[id]) SEND[id].pct = f && f.size ? Math.round(100 * (f.done || 0) / f.size) : 0;
      tell(pullText(o.name, o.from, f ? f.done || 0 : 0, (f && f.size) || o.size, (Date.now() - t0) / 1000) + (f && f.note ? " (" + f.note + ")" : ""));
    }
  });
}
/** 2.765.0: the file found on Civitai and downloaded by the pod -> "" (on the pod) | null (send it from this computer) */
async function viaCivitai(id, port, local, folder, name, size, tell, opts) {
  if (process.env.H3_POD_NO_CIVITAI === "1") return null;
  const PO = require("./podOnline");
  let found = null;
  try { found = await PO.find(local.path, tell); } catch { found = null; }
  if (!found || !found.url) return null;
  let why = "";
  for (const site of PO.sitesFor(found.site)) {
    tell(`${name} is on Civitai (${found.model || "found by " + found.from}) - the pod downloads it from ${site} instead of this computer sending it`);
    why = await pullWait(id, port, { url: PO.dlUrl(found.url, site, ""), folder, name, size: found.size || size, from: site, pod_name: (opts || {}).pod_name }, tell);
    if (!why) {
      tell(name + " is on the pod (downloaded from " + site + ")");
      try { require("./remoteModels").add({ label: found.model || name, folder, name, url: PO.dlUrl(found.url, site, ""), source: "civitai", sha256: found.sha256, size: found.size || size, pods: { [id]: "done" } }); } catch { /* the list is a nicety here */ }
      return "";
    }
  }
  tell(`the pod could not download ${name} from Civitai (${why || "no answer"}) - sending it from this computer`);
  return null;
}
/** 2.766.0: not on Civitai - this computer puts it in your private Hugging Face repo (once), the pod downloads it from
 *  there -> "" | null (send it from this computer: no token that can write, or the upload failed - it says why) */
async function viaHf(id, port, local, folder, name, size, tell, opts) {
  if (process.env.H3_POD_NO_HF === "1") return null;
  const tok = String((((core().getConfig() || {}).hf) || {}).token || "");
  if (!tok) { tell(`${name} is not on Civitai - this computer sends it (add a Hugging Face token that can write in Settings ▸ Models: it then goes up once to your private repo and every pod downloads it)`); return null; }
  const PT = require("./podTransfers"), RM = require("./remoteModels");
  const x = PT.begin({ pod: "", name, how: "hf", from: "this computer", size });
  const t0 = Date.now();
  let r = null;
  try {
    tell(`putting ${name} in your private Hugging Face repo (once - every pod downloads it from there)`);
    r = await require("./hfUpload").upload(local.path, { token: tok, folder, name, onProgress: (n) => { PT.step(x, n); tell(progressText(name, n, size, (Date.now() - t0) / 1000).replace(/^sending (\S+) to the pod/, "putting $1 in your Hugging Face repo")); } });
    PT.end(x, "done");
  } catch (e) {
    const w = String((e && e.message) || e); PT.end(x, "failed: " + w);
    tell(`${name}: not put in your Hugging Face repo (${w}) - this computer sends it to the pod`);
    return null;
  }
  try { RM.add({ label: name.replace(/\.[^.]+$/, "").replace(/_+/g, " "), folder, name, url: r.url, source: "your-hf", sha256: r.sha256, size: r.size }); } catch { /* the list is a nicety here */ }
  const why = await pullWait(id, port, { url: r.url, folder, name, size: r.size || size, from: "your Hugging Face", pod_name: (opts || {}).pod_name }, tell);
  if (!why) { try { RM.mark({ folder, name, sha256: r.sha256 }, id, "done"); } catch { /* fine */ } return ""; }
  tell(`the pod could not download ${name} from your Hugging Face repo (${why}) - this computer sends it`);
  return null;
}
/** the model on the pod by the name ComfyUI there knows it - fetched first when it lacks it -> {name, sent}
 *  2.766.0: a model in runpod/pods/remote_models.json with a link = the pod downloads it (remote mode lists only these) */
async function ensure(id, port, cats, name, say) {
  const PS = require("./podStyles"), tell = (t) => { if (say) try { say(t); } catch { /* fine */ } };
  const have = await PS.contents(id, port);
  const there = onPod(have.models, cats, name);
  if (there) return { name: there, sent: false };
  let why0 = "";
  try {
    const RM = require("./remoteModels"), e = RM.byName(RM.load(), cats, name);
    if (e && e.url) {
      const from = e.source === "civitai" ? "Civitai" : e.source === "your-hf" ? "your Hugging Face" : e.source === "link" ? "its link" : "Hugging Face";
      tell(`the pod downloads ${e.name} from ${from} (remote_models.json)`);
      why0 = await pullWait(id, port, { url: e.url, folder: e.folder, name: e.name, size: e.size, from }, say);
      if (!why0) { RM.mark(e, id, "done"); return { name: RM.comfyName(e), sent: true }; }
      tell(`the pod could not download ${e.name} (${why0}) - looking for it on this computer`);
    }
  } catch { /* the list could not be read - this computer's copy */ }
  const local = findLocal(localScan(), cats, name);
  if (!local) { const e = new Error(`${norm(name)} is not on the pod` + (why0 ? ` (its download failed: ${why0})` : "") + ` and not in this computer's ComfyUI models folders`); e.status = 404; throw e; }
  const why = await sendOne(id, port, local, local.category, say);
  if (why) { const e = new Error(`sending ${local.rel} to the pod: ${why}`); e.status = 502; throw e; }
  return { name: norm(local.rel), sent: true };
}
const SEND = {};     // pod -> {items, current, pct, done: [], failed: [], running}
/** several in the background: items = [{name, cats}] */
function queue(id, port, items) {
  const s = SEND[id] = { items: items.map((x) => norm(x.name)), current: "", pct: 0, done: [], failed: [], running: true };
  (async () => {
    for (const it of items) {
      s.current = norm(it.name); s.pct = 0;
      try { const r = await ensure(id, port, it.cats, it.name, (t) => { s.note = t; }); s.done.push({ name: r.name, sent: r.sent }); }
      catch (e) { s.failed.push({ name: norm(it.name), why: String((e && e.message) || e).slice(0, 200) }); }
    }
    s.current = ""; s.running = false;
  })();
  return s;
}
function status(id) { const s = SEND[String(id || "")]; return s ? { items: s.items, current: s.current, pct: s.pct, note: s.note || "", done: s.done, failed: s.failed, running: s.running } : null; }
module.exports = { CKPT_CATS, norm, findLocal, onPod, folderFor, progressText, pullText, pullWait, locked, viaCivitai, viaHf, sendOne, localScan, ensure, queue, status };
