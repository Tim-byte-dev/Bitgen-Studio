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
 *
 * 2.789.0 NO_POD (Tim, the agreed design: "if pod is terminated ask user if they want to remove models from the list, if no,
 * change the podname to NO_Pod, but keep all the model details in a file so if user clicks a nopod/model name, the pod will be
 * recreated and the models uploaded to the new pod"):
 *   a pod terminated (lib/pods.js act, or found gone by sync) = gone + gone_at + recipe (how it was made - lib/podRevive.recipe)
 *   + ask (it had files and nothing is decided); the page asks (static/nopod.js) -> decide(id, keep):
 *     keep    = its files stay in the lists as "NO_Pod (<old name>)/<file>" (labelOf) - live() / entries() / resolve() take it
 *     remove  = its inventory file is deleted (nothing left in the lists)
 *   remake_ok = you said "Make the pod again" for it (the box on picking a NO_Pod file - its recipe shown) - only then does a
 *   render make it (lib/noPod.js remake); moveTo(old, new) = the inventory goes over to the new pod (remade_from: a stored
 *   "NO_Pod (<name>)/<file>" still resolves to it), its files "todo" until they are put back.
 * Pure: labelOf, entries, resolve, gonePatch (scripts/test-nopod789.js).
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
/** the name a pod goes by in the lists (pure) - 2.789.0: a terminated pod whose files you kept = "NO_Pod (<old name>)" */
function baseLabel(inv) { return String((inv && inv.name) || (inv && inv.id) || "pod").replace(/[\\/]+/g, "-").trim() || String(inv.id); }
function labelOf(inv) { return inv && inv.gone && inv.keep ? "NO_Pod (" + baseLabel(inv) + ")" : baseLabel(inv); }
/** listed in the lists (pure): alive, or gone with its files kept */
const listed = (i) => !!i && (!i.gone || !!i.keep);
/** the lists' entries (pure): invs = live inventories -> {cat: [entry]} */
function entries(invs) {
  const out = {};
  for (const c of LIST_CATS) out[c] = [];
  for (const inv of invs || []) {
    if (!listed(inv)) continue;
    const lab = labelOf(inv), nopod = !!inv.gone;
    for (const f of inv.files || []) {
      if (!LIST_CATS.includes(f.cat)) continue;
      const sub = f.rel.split("/").slice(0, -1).join("/");
      out[f.cat].push(Object.assign({ name: lab + "/" + f.rel, folder: lab + (sub ? "/" + sub : ""), family: lab, pod: inv.id, pod_name: lab, size: f.size || 0, remote: true }, nopod ? { nopod: true } : {}));
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
  // 2.789.0: a gone pod whose files you kept answers to "NO_Pod (<name>)"; a pod made again from one still answers to it too
  const live = [];
  for (const i of (invs || []).filter(listed)) {
    live.push({ inv: i, lab: labelOf(i) });
    if (i.remade_from && !i.gone) live.push({ inv: i, lab: "NO_Pod (" + baseLabel(i) + ")", alias: true });
  }
  live.sort((a, b) => b.lab.length - a.lab.length);
  for (const { inv, lab, alias } of live) {
    if (!v.toLowerCase().startsWith(lab.toLowerCase() + "/")) continue;
    const rel = v.slice(lab.length + 1);
    const f = (inv.files || []).find((x) => want.includes(x.cat) && x.rel.toLowerCase() === rel.toLowerCase());
    if (f) return Object.assign({ pod_id: inv.id, name: alias ? baseLabel(inv) : lab, cat: f.cat, rel: f.rel }, inv.gone ? { nopod: true } : {});
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
/** 2.789.0: a pod found terminated (pure) -> the fields to set: gone + when, the recipe when there is one, ask when it had
 *  files and nothing was decided (a pod already gone keeps what it had) */
function gonePatch(inv, recipe, now) {
  if (!inv || inv.gone) return {};
  const p = { gone: true, gone_at: now || Date.now() };
  if (recipe && !inv.recipe) p.recipe = recipe;
  if ((inv.files || []).length && inv.keep === undefined) p.ask = true;
  return p;
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
  // 2.789.0: NO_Pod - kept / asked / how it was made / made again from
  for (const k of ["gone_at", "keep", "ask", "recipe", "remade_from", "remake_ok"]) if (inv[k] !== undefined && inv[k] !== null) o[k] = inv[k];
  const tmp = FILE(o.id) + ".part";
  fs.writeFileSync(tmp, JSON.stringify(o, null, 1));
  fs.renameSync(tmp, FILE(o.id));
  return o;
}
function all() {
  let names = []; try { names = fs.readdirSync(DIR()).filter(isInvFile); } catch { names = []; }
  return names.map((f) => load(f.replace(/\.json$/, ""))).filter(Boolean);
}
/** the inventories the lists show: alive pods + gone ones whose files you kept (2.789.0 - NO_Pod) */
function live() { return all().filter(listed); }
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
    else if ((!p || /TERMINATED/.test(String(p.status || ""))) && !inv.gone) markGone(inv.id);   // 2.789.0: asked keep / remove
  }
  // a pod bitGen knows with no inventory yet gets an empty one (its files come with the first listing / transfer)
  for (const p of pods || []) if (p && p.bitgen && !load(p.id) && !/TERMINATED/.test(String(p.status || ""))) save({ id: p.id, name: p.name, files: [] });
}
/** 2.789.0: the pod is terminated - remember how it was made and ask about its files (static/nopod.js) */
function markGone(id, recipe) {
  const inv = load(id); if (!inv) return null;
  let rc = recipe || null;
  if (!rc) { try { rc = require("./podRevive").recipeOf((core().getConfig() || {}).rgpu || {}, inv.id, null); } catch { rc = null; } }
  const patch = gonePatch(inv, rc);
  if (!patch.gone) return inv;
  return save(Object.assign(inv, patch));
}
/** your answer: keep its files as NO_Pod (true) or take them out of the lists (false = the inventory is deleted) */
function decide(id, keep) {
  const inv = load(id); if (!inv) return null;
  if (!keep) { try { fs.unlinkSync(FILE(inv.id)); } catch { /* gone */ } return { removed: true, id: inv.id }; }
  delete inv.ask; inv.keep = true;
  return save(inv);
}
/** the terminated pods waiting for your answer */
function asks() { return all().filter((i) => i.gone && i.ask); }
/** "Make the pod again" pressed for a NO_Pod (the box on picking one of its files) */
function okRemake(id, ok) { const inv = load(id); if (!inv) return null; if (ok) inv.remake_ok = true; else delete inv.remake_ok; return save(inv); }
/** the pod was made again as newId: the inventory goes over, its files to be put back ("todo") */
function moveTo(oldId, newId, name) {
  const inv = load(oldId); if (!inv) return null;
  const o = { id: pid(newId), name: name || inv.name, files: (inv.files || []).map((f) => Object.assign({}, f, { state: "todo" })), remade_from: inv.id, recipe: inv.recipe, listed_at: 0 };
  const saved = save(o);
  if (pid(newId) !== inv.id) { try { fs.unlinkSync(FILE(inv.id)); } catch { /* fine */ } }
  return saved;
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
    groups: groupsOf(inv.files), styles: styles(inv.id),
    keep: !!inv.keep, ask: !!inv.ask, gone_at: inv.gone_at || 0, recipe: inv.recipe || null, remade_from: inv.remade_from || "", remake_ok: !!inv.remake_ok };
}
module.exports = { LIST_CATS, MODEL_CATS, GROUPS, kindOf, fromListing, baseLabel, labelOf, listed, entries, resolve, gonePatch, noteIn, dropIn, groupsOf, isInvFile,
  DIR, FILE, load, save, all, live, nameOf, fromList, noteSent, noteDeleted, sync, markGone, decide, asks, okRemake, moveTo, refresh, styles, view };
