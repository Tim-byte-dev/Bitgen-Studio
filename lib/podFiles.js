/* bitGen Studio — lib/podFiles.js (2.781.2): THE MODEL FILES ON A POD - listed, and deleted when you want the room back.
 *
 * Tim (verbatim): "yue2 comfui model transferred onto same pod works (add model files available on pod, allow user to delete
 * model files from pod)"
 *   list(id, {port})    every model file in the pod's ComfyUI models folder (all its folders, any depth; dot-folders left
 *                       out), with its size and whether it is a link bitGen made (2.769.0 links a file into the folder ComfyUI
 *                       reads), half-done downloads (.part / .tmp) marked, and the pod's disk (total / used / free)
 *                       -> {comfy_dir, files: [{path, folder, name, size, link, partial}], total, disk}
 *   remove(id, {paths, port})   those files deleted on the pod (a link: only the link; nothing outside the models folder -
 *                       every path is checked here AND on the pod against the real folder); bitGen forgets them for that pod:
 *                       runpod/pods/remote_models.json's pods map and the pod's recipe (rgpu.pod_files - so a pod made again
 *                       from it does not bring them back). A style that needs one sends / downloads it again on its next
 *                       render. -> {deleted: [path], failed: [{path, why}], files, disk}
 *   cleanPaths(paths)   (pure) the paths that are safe to ask for: relative, inside models, no "..", no hidden parts
 * Server: routes/podFiles.js. Page: static/podfiles.js (PODS ▸ My pods ▸ 📁 Files).
 */
"use strict";
const EXT = [".safetensors", ".gguf", ".ckpt", ".pt", ".pth", ".bin", ".sft", ".onnx"];
const PART = [".part", ".tmp", ".download", ".incomplete"];
/** (pure) the paths that may be deleted: "loras/x.safetensors", "checkpoints/Krea2/y.gguf" … (max 500) */
function cleanPaths(paths) {
  const out = [];
  for (const p0 of Array.isArray(paths) ? paths : []) {
    const parts = String(p0 || "").replace(/\\/g, "/").split("/").filter((x) => x !== "");
    if (parts.length < 2 || parts.length > 8) continue;
    if (parts.some((x) => x === "." || x === ".." || x.startsWith(".") || x.length > 200 || /[\u0000-\u001f]/.test(x))) continue;
    if (String(p0).startsWith("/")) continue;
    const p = parts.join("/");
    if (!out.includes(p)) out.push(p);
  }
  return out.slice(0, 500);
}
const LIST_PY = (cdir) => [
  "import os, json, shutil",
  `root = os.path.join(${JSON.stringify(cdir)}, 'models')`,
  `EXT = ${JSON.stringify(EXT)}; PART = ${JSON.stringify(PART)}`,
  "out = []",
  "for dp, dn, fn in os.walk(root):",
  "    dn[:] = sorted(d for d in dn if not d.startswith('.'))",
  "    for f in sorted(fn):",
  "        low = f.lower()",
  "        if f.startswith('.'): continue",
  "        part = any(low.endswith(x) for x in PART)",
  "        if not part and not any(low.endswith(x) for x in EXT): continue",
  "        p = os.path.join(dp, f); rel = os.path.relpath(p, root).replace(os.sep, '/')",
  "        link = os.path.islink(p)",
  "        try: size = os.stat(p).st_size",
  "        except Exception: size = 0",
  "        out.append({'path': rel, 'size': size, 'link': link, 'partial': part, 'target': os.readlink(p) if link else ''})",
  "try: du = shutil.disk_usage(root); disk = {'total': du.total, 'used': du.used, 'free': du.free}",
  "except Exception: disk = None",
  "print('bitgen-files ' + json.dumps({'files': out, 'disk': disk}))",
].join("\n");
const DEL_PY = (cdir, paths) => [
  "import os, json, shutil",
  `root = os.path.realpath(os.path.join(${JSON.stringify(cdir)}, 'models'))`,
  `paths = ${JSON.stringify(paths)}`,
  "done, bad = [], []",
  "for rel in paths:",
  "    p = os.path.join(root, *rel.split('/'))",
  // the folder it sits in must be inside models (the file itself may be a link pointing elsewhere - only the link goes)
  "    if not os.path.realpath(os.path.dirname(p)).startswith(root + os.sep) and os.path.realpath(os.path.dirname(p)) != root:",
  "        bad.append({'path': rel, 'why': 'not in the models folder'}); continue",
  "    if not os.path.lexists(p): bad.append({'path': rel, 'why': 'not on the pod'}); continue",
  "    if os.path.isdir(p) and not os.path.islink(p): bad.append({'path': rel, 'why': 'a folder'}); continue",
  "    try: os.remove(p); done.append(rel)",
  "    except Exception as e: bad.append({'path': rel, 'why': str(e)[:160]})",
  "try: du = shutil.disk_usage(root); disk = {'total': du.total, 'used': du.used, 'free': du.free}",
  "except Exception: disk = None",
  "print('bitgen-deleted ' + json.dumps({'deleted': done, 'failed': bad, 'disk': disk}))",
].join("\n");
let D = null;
function deps() {
  return D || {
    ways: (id, port) => require("./podModels").ways(id, port),
    kernel: (w, code) => { const PM = require("./podModels"); return PM.runKernel(w.jupyter_url, PM.jupyterOf(w.pod_id), code); },
  };
}
function setDeps(d) { D = d ? Object.assign({}, deps(), d) : null; }
const pid = (id) => String(id || "").replace(/[^A-Za-z0-9]/g, "");
async function pod(id, port) {
  const w = await deps().ways(pid(id), +port || 0);
  if (!w.jupyter) { const e = new Error("the pod's Jupyter does not answer - bitGen reads and deletes its files through it (is the pod running?)"); e.status = 409; throw e; }
  if (!w.comfy_dir) { const e = new Error("bitGen could not find the pod's ComfyUI folder"); e.status = 502; throw e; }
  return w;
}
/** (pure) the list's rows -> with folder / name, and the total */
function shape(j) {
  const files = ((j && j.files) || []).map((f) => { const parts = String(f.path).split("/"); return { path: String(f.path), folder: parts.slice(0, -1).join("/"), name: parts[parts.length - 1], size: +f.size || 0, link: !!f.link, partial: !!f.partial, target: String(f.target || "") }; });
  return { files, total: files.reduce((a, f) => a + (f.link ? 0 : f.size), 0), disk: (j && j.disk) || null };
}
async function list(id, o) {
  const w = await pod(id, (o || {}).port);
  const said = await deps().kernel(w, LIST_PY(w.comfy_dir));
  const m = /bitgen-files (\{.*\})/.exec(String(said || ""));
  if (!m) { const e = new Error("the pod did not list its files" + (said ? ": " + String(said).slice(-200) : "")); e.status = 502; throw e; }
  return Object.assign({ pod_id: pid(id), comfy_dir: w.comfy_dir }, shape(JSON.parse(m[1])));
}
/** bitGen forgets deleted files for that pod: remote_models.json + the pod's recipe */
function forget(id, deleted) {
  const p = pid(id), gone = new Set(deleted.map((x) => x.toLowerCase()));
  const key = (folder, name) => (String(folder || "").replace(/\\/g, "/").replace(/\/+$/, "") + "/" + String(name || "")).toLowerCase();
  try {
    const RM = require("./remoteModels"), L = RM.load(); let changed = false;
    for (const e of L) if (e.pods && e.pods[p] && gone.has(key(e.folder, e.name))) { delete e.pods[p]; changed = true; }
    if (changed) RM.save(L);
  } catch { /* a nicety */ }
  try {
    const C = require("./core"), c = C.getConfig(), r = c.rgpu || {};
    const pf = (r.pod_files || {})[p];
    if (Array.isArray(pf)) { const keep = pf.filter((f) => !gone.has(key(f.folder, f.name))); if (keep.length !== pf.length) { r.pod_files = Object.assign({}, r.pod_files, { [p]: keep }); C.setConfig(c); } }
  } catch { /* a nicety */ }
}
async function remove(id, o) {
  const x = o || {}, paths = cleanPaths(x.paths);
  if (!paths.length) { const e = new Error("pick the files to delete"); e.status = 400; throw e; }
  const w = await pod(id, x.port);
  const said = await deps().kernel(w, DEL_PY(w.comfy_dir, paths));
  const m = /bitgen-deleted (\{.*\})/.exec(String(said || ""));
  if (!m) { const e = new Error("the pod did not say what it deleted" + (said ? ": " + String(said).slice(-200) : "")); e.status = 502; throw e; }
  const j = JSON.parse(m[1]);
  if ((j.deleted || []).length) {
    forget(id, j.deleted);
    try { require("./podActivity").note(pid(id), "deleted from the pod: " + j.deleted.map((s) => s.split("/").pop()).join(", ")); } catch { /* fine */ }
  }
  return { deleted: j.deleted || [], failed: j.failed || [], disk: j.disk || null };
}
module.exports = { EXT, PART, cleanPaths, shape, LIST_PY, DEL_PY, list, remove, forget, setDeps };
