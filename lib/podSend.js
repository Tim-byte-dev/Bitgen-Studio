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
async function sendOne(id, port, local, cat) {
  const PM = require("./podModels");
  const folder = folderFor(cat, local.rel), name = local.rel.split("/").pop();
  for (let i = 0; i < 600; i++) {            // the pod's Jupyter takes one upload at a time - wait for one running
    try { await PM.upload(id, { path: local.path, folder, name, port }); break; }
    catch (e) { if (!/upload to this pod is running/.test(String(e.message))) throw e; await sleep(POLL()); }
  }
  for (;;) {
    await sleep(POLL());
    const s = await PM.state(id, port).catch(() => ({ files: [] }));
    const f = (s.files || []).filter((x) => String(x.name).startsWith(name)).pop();
    if (f && f.state !== "uploading") return f.state === "done" ? "" : String(f.state);
    if (SEND[id]) SEND[id].pct = f && f.size ? Math.round(100 * (f.done || 0) / f.size) : 0;
  }
}
/** the model on the pod by the name ComfyUI there knows it - sent first when it lacks it -> {name, sent} */
async function ensure(id, port, cats, name) {
  const PS = require("./podStyles");
  const have = await PS.contents(id, port);
  const there = onPod(have.models, cats, name);
  if (there) return { name: there, sent: false };
  const local = findLocal(localScan(), cats, name);
  if (!local) { const e = new Error(`${norm(name)} is not on the pod and not in this computer's ComfyUI models folders`); e.status = 404; throw e; }
  const why = await sendOne(id, port, local, local.category);
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
      try { const r = await ensure(id, port, it.cats, it.name); s.done.push({ name: r.name, sent: r.sent }); }
      catch (e) { s.failed.push({ name: norm(it.name), why: String((e && e.message) || e).slice(0, 200) }); }
    }
    s.current = ""; s.running = false;
  })();
  return s;
}
function status(id) { const s = SEND[String(id || "")]; return s ? { items: s.items, current: s.current, pct: s.pct, done: s.done, failed: s.failed, running: s.running } : null; }
module.exports = { CKPT_CATS, norm, findLocal, onPod, folderFor, localScan, ensure, queue, status };
