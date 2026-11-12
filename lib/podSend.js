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
/** one file sent and waited for -> "" | "why it failed" */
async function sendOne(id, port, local, cat, say) {
  const PM = require("./podModels"), tell = (t) => { if (say) try { say(t); } catch { /* fine */ } };
  const folder = folderFor(cat, local.rel), name = local.rel.split("/").pop();
  let size = 0; try { size = require("fs").statSync(local.path).size; } catch { size = 0; }
  // 2.765.0 (Tim: "can you find my checkpoint and send it to the pod via civitai or civitai.red . if is very slow from my pc ,
  // 0.5mb/sec"): the same file on Civitai = the pod downloads it from there; this computer sends it only when that fails
  const on = await viaCivitai(id, port, local, folder, name, size, tell);
  if (on === "") return "";
  for (let i = 0; i < 600; i++) {            // the pod's Jupyter takes one upload at a time - wait for one running
    try { await PM.upload(id, { path: local.path, folder, name, port }); break; }
    catch (e) { if (!/upload to this pod is running/.test(String(e.message))) throw e; tell("waiting to send " + name + " - another file is going to the pod"); await sleep(POLL()); }
  }
  const t0 = Date.now();
  tell(progressText(name, 0, size, 0));
  for (;;) {
    await sleep(POLL());
    const s = await PM.state(id, port).catch(() => ({ files: [] }));
    const f = (s.files || []).filter((x) => String(x.name).startsWith(name)).pop();
    if (f && f.state !== "uploading") return f.state === "done" ? "" : String(f.state);
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
/** 2.765.0: the file found on Civitai and downloaded by the pod -> "" (on the pod) | null (send it from this computer) */
async function viaCivitai(id, port, local, folder, name, size, tell) {
  if (process.env.H3_POD_NO_CIVITAI === "1") return null;
  const PO = require("./podOnline"), PM = require("./podModels");
  let found = null;
  try { found = await PO.find(local.path, tell); } catch { found = null; }
  if (!found || !found.url) return null;
  let why = "";
  for (const site of PO.sitesFor(found.site)) {
    tell(`${name} is on Civitai (${found.model || "found by " + found.from}) - the pod downloads it from ${site} instead of this computer sending it`);
    try { await PM.fromLink(id, { url: PO.dlUrl(found.url, site, ""), folder, name, size: found.size || size, port }); }
    catch (e) { why = String((e && e.message) || e); continue; }
    const t0 = Date.now();
    for (;;) {
      await sleep(POLL());
      const s = await PM.state(id, port).catch(() => ({ files: [] }));
      const f = (s.files || []).find((x) => x.name === name);
      if (f && /^(done|there already)$/.test(f.state)) { tell(name + " is on the pod (downloaded from " + site + ")"); return ""; }
      if (f && /^failed/.test(String(f.state))) { why = String(f.state).replace(/^failed: /, ""); break; }
      if (!f && !s.running && Date.now() - t0 > 60000) { why = "the pod did not say how the download went"; break; }
      if (SEND[id]) SEND[id].pct = f && f.size ? Math.round(100 * (f.done || 0) / f.size) : 0;
      tell(pullText(name, site, f ? f.done || 0 : 0, (f && f.size) || found.size || size, (Date.now() - t0) / 1000) + (f && f.note ? " (" + f.note + ")" : ""));
    }
  }
  tell(`the pod could not download ${name} from Civitai (${why || "no answer"}) - sending it from this computer`);
  return null;
}
/** the model on the pod by the name ComfyUI there knows it - sent first when it lacks it -> {name, sent} */
async function ensure(id, port, cats, name, say) {
  const PS = require("./podStyles");
  const have = await PS.contents(id, port);
  const there = onPod(have.models, cats, name);
  if (there) return { name: there, sent: false };
  const local = findLocal(localScan(), cats, name);
  if (!local) { const e = new Error(`${norm(name)} is not on the pod and not in this computer's ComfyUI models folders`); e.status = 404; throw e; }
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
module.exports = { CKPT_CATS, norm, findLocal, onPod, folderFor, progressText, pullText, viaCivitai, localScan, ensure, queue, status };
