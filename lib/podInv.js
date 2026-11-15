/* bitGen Studio — lib/podInv.js (2.787.0): EACH POD'S INVENTORY - the models, VAE, text encoders and LoRAs on it, kept in
 * runpod/pods/<pod id>.json so they are known while the pod is stopped too; its files listed in Basic Settings' model and
 * LoRA lists as "<pod name>/<file>" (routes/podInv.js adds them to /api/comfymodels - nothing else is taken out).
 *
 * Tim (verbatim, the agreed design): "the pod info will keep a list of styles and models + vae + textencoders in each pod" +
 * "add models to ... the override model dropdown (not the video/image styles) ... do the same for models in pods, but use pod
 * name/model name , also use the pods loras as pod name/lora name"
 *   THE FILE   <bitGen>/runpod/pods/<id>.json (H3_POD_INV_DIR = the tests' folder) - {v: 1, id, name, gone, at, listed_at,
 *              files: [{cat, rel, size, kind, state}]}: cat = the ComfyUI models folder ("checkpoints", "loras" …), rel = the
 *              name ComfyUI lists in it ("Krea2/x.gguf"), kind model | vae | te | lora | other, state "on" (seen on the pod) |
 *              "sent" (bitGen put it there since it last looked)
 *   FILLED BY  the pod's own listing (lib/podFiles.js list - PODS ▸ 📁 Files, ▸ 🗂 Inventory ⟳, a pod's item opened), every file
 *              bitGen puts on a pod (lib/podSend.js ensure, lib/remoteModels.js mark) and every one deleted (podFiles.remove)
 *   LISTS      entries(invs): {cat: [{name: "<pod name>/<rel>", folder: "<pod name>[/<sub>]", pod, remote: true}]} for
 *              checkpoints / diffusion_models / unet / loras - the folder filter shows one folder per pod
 *   RESOLVE    resolve(value, invs, cats): "<pod name>/<rel>" -> {pod_id, name, cat, rel} when that pod's inventory has the file
 *              (the longest pod name that fits first) - lib/podPick.js sends the render to that pod with the plain file name
 * Pure (scripts/test-podinv787.js): kindOf, fromListing, labelOf, entries, resolve, noteIn, dropIn, groupsOf, isInvFile.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const LIST_CATS = ["checkpoints", "diffusion_models", "unet", "loras"];
const MODEL_CATS = ["checkpoints", "diffusion_models", "unet", "diffusers"];
const GROUPS = [["model", "Models"], ["vae", "VAE"], ["te", "Text encoders"], ["lora", "LoRAs"], ["other", "Other"]];
const pid = (id) => String(id || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 40);
const norm = (p) => String(p || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");

/* ---------------- pure */
function kindOf(cat) {
  const c = String(cat || "").toLowerCase();
  if (MODEL_CATS.includes(c)) return "model";
  if (c === "vae" || c === "vae_approx") return "vae";
  if (c === "text_encoders" || c === "clip") return "te";
  if (c === "loras" || c === "lycoris") return "lora";
  return "other";
}
/** a pod's own listing (podFiles.shape) -> inventory files (pure); half-done downloads left out */
function fromListing(list) {
  const out = [];
  for (const f of (list && list.files) || []) {
    if (!f || f.partial) continue;
    const parts = norm(f.path).split("/").filter(Boolean);
    if (parts.length < 2) continue;
    out.push({ cat: parts[0], rel: parts.slice(1).join("/"), size: +f.size || 0, kind: kindOf(parts[0]), state: "on" });
  }
  return out;
}
/** the name a pod goes by in the lists (pure) */
function labelOf(inv) { return String((inv && inv.name) || (inv && inv.id) || "pod").replace(/[\\/]+/g, "-").trim() || String(inv.id); }
/** the lists' entries (pure): invs = live inventories -> {cat: [entry]} */
function entries(invs) {
  const out = {};
  for (const c of LIST_CATS) out[c] = [];
  for (const inv of invs || []) {
    if (!inv || inv.gone) continue;
    const lab = labelOf(inv);
    for (const f of inv.files || []) {
      if (!LIST_CATS.includes(f.cat)) continue;
      const sub = f.rel.split("/").slice(0, -1).join("/");
      out[f.cat].push({ name: lab + "/" + f.rel, folder: lab + (sub ? "/" + sub : ""), family: lab, pod: inv.id, pod_name: lab, size: f.size || 0, remote: true });
    }
  }
  for (const c of LIST_CATS) out[c].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return out;
}
/** "<pod name>/<rel>" -> {pod_id, name, cat, rel} | null (pure) - only a file that pod's inventory has, in one of `cats` */
function resolve(value, invs, cats) {
  const v = norm(value);
  if (!v || !v.includes("/")) return null;
  const want = cats && cats.length ? cats : LIST_CATS;
  const live = (invs || []).filter((i) => i && !i.gone).map((i) => ({ inv: i, lab: labelOf(i) })).sort((a, b) => b.lab.length - a.lab.length);
  for (const { inv, lab } of live) {
    if (!v.toLowerCase().startsWith(lab.toLowerCase() + "/")) continue;
    const rel = v.slice(lab.length + 1);
    const f = (inv.files || []).find((x) => want.includes(x.cat) && x.rel.toLowerCase() === rel.toLowerCase());
    if (f) return { pod_id: inv.id, name: lab, cat: f.cat, rel: f.rel };
  }
  return null;
}
/** a file bitGen put on the pod (pure): the inventory's files with it marked - its own category when the inventory knows it
 *  under one of `cats`, else the first of them */
function noteIn(files, cats, rel, size) {
  const r = norm(rel), L = (files || []).slice(), cs = (cats && cats.length ? cats : ["checkpoints"]).map(String);
  if (!r) return L;
  const i = L.findIndex((f) => cs.includes(f.cat) && f.rel.toLowerCase() === r.toLowerCase());
  if (i >= 0) { L[i] = Object.assign({}, L[i], { state: L[i].state === "on" ? "on" : "sent", size: L[i].size || +size || 0 }); return L; }
  L.push({ cat: cs[0], rel: r, size: +size || 0, kind: kindOf(cs[0]), state: "sent" });
  return L;
}
/** the files left when `paths` ("loras/x.safetensors") are deleted (pure) */
function dropIn(files, paths) {
  const gone = new Set((paths || []).map((p) => norm(p).toLowerCase()));
  return (files || []).filter((f) => !gone.has((f.cat + "/" + f.rel).toLowerCase()));
}
/** the inventory grouped for the PODS docker (pure) */
function groupsOf(files) {
  return GROUPS.map(([k, label]) => ({ kind: k, label, files: (files || []).filter((f) => f.kind === k).sort((a, b) => a.rel.localeCompare(b.rel)) })).filter((g) => g.files.length);
}
/** is a file name in runpod/pods an inventory (pure) - not remote_models.json / presets */
function isInvFile(f) { return /^[A-Za-z0-9]{4,40}\.json$/.test(f) && f !== "remote_models.json"; }

/* ---------------- live */
function core() { return require("./core"); }
function DIR() { return process.env.H3_POD_INV_DIR || path.join(core().BASE, "runpod", "pods"); }
function FILE(id) { return path.join(DIR(), pid(id) + ".json"); }
function load(id) {
  try { const j = JSON.parse(fs.readFileSync(FILE(id), "utf8")); if (j && j.id) return Object.assign({ files: [] }, j); } catch { /* none yet */ }
  return null;
}
function save(inv) {
  fs.mkdirSync(DIR(), { recursive: true });
  const o = { v: 1, id: pid(inv.id), name: String(inv.name || inv.id).slice(0, 80), gone: !!inv.gone, at: Date.now(), listed_at: inv.listed_at || 0, files: inv.files || [] };
  const tmp = FILE(o.id) + ".part";
  fs.writeFileSync(tmp, JSON.stringify(o, null, 1));
  fs.renameSync(tmp, FILE(o.id));
  return o;
}
function all() {
  let names = []; try { names = fs.readdirSync(DIR()).filter(isInvFile); } catch { names = []; }
  return names.map((f) => load(f.replace(/\.json$/, ""))).filter(Boolean);
}
function live() { return all().filter((i) => !i.gone); }
function nameOf(id) {
  const p = pid(id), inv = load(p);
  if (inv && inv.name && inv.name !== p) return inv.name;
  try { const b = ((core().getConfig().rgpu || {}).pods_bitgen || []).find((x) => x && x.id === p); if (b && b.name) return b.name; } catch { /* fine */ }
  return p;
}
function ensure(id, name) { const p = pid(id); return load(p) || { id: p, name: name || nameOf(p), files: [] }; }
/** the pod's own listing came back (lib/podFiles.js list) - the inventory is what the pod has now */
function fromList(id, listing, name) {
  const inv = ensure(id, name);
  inv.files = fromListing(listing); inv.listed_at = Date.now(); inv.gone = false;
  if (name) inv.name = name;
  return save(inv);
}
/** bitGen put a file on the pod (podSend / remoteModels) */
function noteSent(id, cats, rel, size) {
  try { const inv = ensure(id); inv.files = noteIn(inv.files, Array.isArray(cats) ? cats : [cats], rel, size); return save(inv); } catch { return null; }
}
function noteDeleted(id, paths) {
  try { const inv = load(id); if (!inv) return null; inv.files = dropIn(inv.files, paths); return save(inv); } catch { return null; }
}
/** the names RunPod gives the pods now; a pod RunPod no longer has = gone (pods = pods.mine().pods) */
function sync(pods) {
  const by = new Map((pods || []).map((p) => [pid(p.id), p]));
  for (const inv of all()) {
    const p = by.get(inv.id);
    if (p && (p.name !== inv.name || inv.gone) && !/TERMINATED/.test(String(p.status || ""))) { inv.name = p.name || inv.name; inv.gone = false; save(inv); }
    else if ((!p || /TERMINATED/.test(String(p.status || ""))) && !inv.gone) { inv.gone = true; save(inv); }
  }
  // a pod bitGen knows with no inventory yet gets an empty one (its files come with the first listing / transfer)
  for (const p of pods || []) if (p && p.bitgen && !load(p.id) && !/TERMINATED/.test(String(p.status || ""))) save({ id: p.id, name: p.name, files: [] });
}
async function refresh(id, o) {
  const x = o || {};
  const L = await require("./podFiles").list(id, { port: x.port });
  return fromList(id, L, x.name);
}
function styles(id) {
  try {
    const S = require("./styles"), ids = require("./stylePods").stylesOf(id), list = S.read(core().STYLES_DIR);
    return ids.map((s) => { const st = list.find((y) => y.id === s); return { id: s, name: st ? st.name : s }; });
  } catch { return []; }
}
function view(id) {
  const inv = load(id);
  if (!inv) return null;
  return { id: inv.id, name: inv.name, label: labelOf(inv), gone: !!inv.gone, at: inv.at, listed_at: inv.listed_at, count: inv.files.length,
    groups: groupsOf(inv.files), styles: styles(inv.id) };
}
module.exports = { LIST_CATS, MODEL_CATS, GROUPS, kindOf, fromListing, labelOf, entries, resolve, noteIn, dropIn, groupsOf, isInvFile,
  DIR, FILE, load, save, all, live, nameOf, fromList, noteSent, noteDeleted, sync, refresh, styles, view };
