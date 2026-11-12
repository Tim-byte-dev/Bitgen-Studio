/* bitGen Studio — lib/remoteModels.js (2.766.0): THE MODELS YOUR PODS USE - runpod/pods/remote_models.json.
 *
 * Tim (verbatim): "add a remote_models.json in our pods folder. this is where we will keep a list of the models we use for the
 * style like folder=krea raw,model= model name, location = url to download etc. local models won't be available if in remote
 * mode. these will be the models listed in remote mode in model manager and the overide settings dropdowns instead of the
 * local models. if user has a model/lora on their hdd without a link. user can search for it in model manager and it will
 * upload to the selected pod. add a checkbox to the left of the pod name to select the pod(mulitple pods can be selected)"
 * + "go with your suggestions and add a progress bar for each transfer to the pod"
 *
 *   THE FILE    <bitGen>/runpod/pods/remote_models.json (H3_REMOTE_MODELS = the tests' file) - {v: 1, models: [entry]}
 *               entry = {id, label, group ("Krea raw"), folder (the ComfyUI folder: "checkpoints/SDXL", "loras"), name (the
 *               file), url (where a pod downloads it), source (catalog | huggingface | civitai | your-hf | link), sha256, size,
 *               styles: [style ids], pods: {pod id: "done"}, added}. Never a key or token (links are kept without ?token=).
 *   FILLED BY   the styles your pods use (a style linked to a pod, a preset's styles - their catalog files, Hugging Face);
 *               a model found on Civitai and downloaded by a pod (2.765.0); a model of this computer put in your private
 *               Hugging Face repo (lib/hfUpload.js); a Civitai ⤓ in Model manager in remote mode; a link you add.
 *   REMOTE MODE remote generation on with RunPod pods (Basic Settings): Model manager and Basic Settings' Override dropdowns
 *               (GET /api/comfymodels, the temporary LoRA rows) list THESE instead of this computer's models
 *               (routes/remoteModels.js). Local mode is as before.
 *   SELECTED    rgpu.pod_selected [{id, name}] - the ☐ left of each pod's name in PODS ▸ My pods; ⇪ Send sends to them.
 *   SEND        send(id, pods): each pod downloads the entry's link (lib/podSend.js pullWait - a progress bar each,
 *               lib/podTransfers.js); addLocal(cat, name): a model of this computer -> Civitai (the same SHA-256) ->
 *               your private Hugging Face repo -> the list, then sent; no token that can write -> straight to each
 *               selected pod from this computer (it says so).
 * Pure (scripts/test-remotemodels766.js): clean, keyOf, merge, sourceOf, comfyName, asComfyModels, byName, cardOf.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const FOLDERS = ["checkpoints", "diffusion_models", "unet", "loras", "vae", "text_encoders", "clip", "clip_vision", "controlnet", "upscale_models", "embeddings", "style_models", "latent_upscale_models"];
const MODEL_CATS = ["checkpoints", "diffusion_models", "unet"];
const SOURCES = ["catalog", "huggingface", "civitai", "your-hf", "link"];

/* ---------------- pure */
function folderOk(f) {
  const parts = String(f || "").replace(/\\/g, "/").split("/").filter(Boolean);
  if (!parts.length || parts.length > 3 || !FOLDERS.includes(parts[0])) return "";
  return parts.slice(1).every((x) => /^[\w.+ -]{1,64}$/.test(x) && !/^\.+$/.test(x)) ? parts.join("/") : "";
}
/** where a link is from (pure) */
function sourceOf(url, hfBase) {
  const u = String(url || ""), hf = String(hfBase || "https://huggingface.co").replace(/\/+$/, "");
  if (/^https:\/\/(civitai\.com|civitai\.red)\//i.test(u)) return "civitai";
  if (u.startsWith(hf + "/") || /^https:\/\/huggingface\.co\//i.test(u)) return /\/bitgen-models\/resolve\//.test(u) ? "your-hf" : "huggingface";
  return u ? "link" : "";
}
function stripToken(u) { try { const x = new URL(String(u)); x.searchParams.delete("token"); return x.toString(); } catch { return ""; } }
/** an entry made safe (pure) -> entry | null */
function clean(e, hfBase) {
  const x = e || {}, folder = folderOk(x.folder), name = String(x.name || "").split(/[\\/]/).pop().replace(/[^\w.+ -]+/g, "_").slice(0, 200);
  if (!folder || !name || /^\.+$/.test(name)) return null;
  const url = /^https?:\/\//i.test(String(x.url || "")) ? stripToken(x.url).slice(0, 1000) : "";
  const pods = {}; for (const [k, v] of Object.entries(x.pods || {})) { const p = String(k).replace(/[^A-Za-z0-9]/g, ""); if (p) pods[p] = String(v || "").slice(0, 40); }
  return {
    id: String(x.id || "").replace(/[^\w-]/g, "").slice(0, 40) || "m" + Math.random().toString(36).slice(2, 10),
    label: String(x.label || name.replace(/\.[^.]+$/, "").replace(/_+/g, " ")).slice(0, 120),
    group: String(x.group || "").slice(0, 80),
    folder, name, url,
    source: SOURCES.includes(x.source) ? x.source : (sourceOf(url, hfBase) || "link"),
    sha256: /^[a-f0-9]{64}$/i.test(String(x.sha256 || "")) ? String(x.sha256).toLowerCase() : "",
    base_model: String(x.base_model || "").slice(0, 60),   // 2.766.2: Civitai's base model (its family)
    size: Math.max(0, Math.round(+x.size || 0)),
    styles: [...new Set((Array.isArray(x.styles) ? x.styles : []).map((s) => String(s).replace(/[^\w.-]/g, "").slice(0, 80)).filter(Boolean))].slice(0, 60),
    pods,
    added: x.added || new Date().toISOString().slice(0, 10),
  };
}
const cat = (e) => String(e.folder).split("/")[0];
/** the same model? (pure) - the same SHA-256, else the same category + file name */
function keyOf(e) { return e.sha256 ? "sha:" + e.sha256 : "nm:" + cat(e) + "/" + String(e.name).toLowerCase(); }
function same(a, b) { return (a.sha256 && b.sha256) ? a.sha256 === b.sha256 : (cat(a) === cat(b) && String(a.name).toLowerCase() === String(b.name).toLowerCase()); }
/** the list with e in it (pure) -> {list, entry}: a model already there keeps its id / label / group (unless they are empty)
 *  and gains the new link (when it had none, or when the new one is a download link and the old one was not), styles, pods */
function merge(list, e0, hfBase) {
  const e = clean(e0, hfBase); if (!e) return { list: (list || []).slice(), entry: null };
  const out = (list || []).slice(), i = out.findIndex((x) => same(x, e));
  if (i < 0) { out.push(e); return { list: out, entry: e }; }
  const o = out[i], keepLabel = e0 && e0.relabel ? e.label : o.label || e.label;
  const m = Object.assign({}, o, {
    label: keepLabel, group: e0 && e0.regroup ? e.group : o.group || e.group,
    url: o.url && !(e0 && e0.relink) ? o.url : e.url || o.url, source: o.url && !(e0 && e0.relink) ? o.source : (e.url ? e.source : o.source),
    sha256: o.sha256 || e.sha256, size: o.size || e.size, base_model: o.base_model || e.base_model,
    styles: [...new Set(o.styles.concat(e.styles))].slice(0, 60), pods: Object.assign({}, o.pods, e.pods),
  });
  out[i] = m;
  return { list: out, entry: m };
}
/** the name ComfyUI lists for it (pure): the folder past its category + the file - "SDXL/x.safetensors" */
function comfyName(e) { return String(e.folder).split("/").slice(1).concat([e.name]).join("/"); }
/** 2.766.2 (Tim: "clear the folders in folder filer in basic settings and show the model families instead ... filter by
 *  family"): a model's family - by its Civitai base model, else its name (lib/modelCards.js) -> "Krea", "Flux", "SDXL" … */
function familyOf(e) {
  try {
    const MC = require("./modelCards"), k = MC.familyOf({ base_model: e.base_model || "", name: e.folder + "/" + e.name + " " + (e.group || "") + " " + (e.label || "") });
    return k && k !== "other" && MC.FAMILIES[k] ? MC.FAMILIES[k].label : "Other";
  } catch { return "Other"; }
}
/** the list as /api/comfymodels answers it (pure) - Basic Settings' combos and LoRA rows read this shape */
function asComfyModels(list) {
  const categories = {};
  for (const c of FOLDERS) categories[c] = { files: [] };
  for (const e of list || []) {
    const c = cat(e);
    categories[c].files.push({ name: comfyName(e), folder: familyOf(e), family: familyOf(e), group: e.group || "", size: e.size || 0, remote: true, url: e.url, id: e.id });   // 2.766.2: the folder filter = the families
  }
  for (const c of FOLDERS) categories[c].files.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return { ok: true, remote: true, source: "remote", dir: "runpod/pods/remote_models.json", dir_exists: true, categories, model_categories: ["checkpoints", "diffusers", "diffusion_models"],
    warnings: ["Remote mode (RunPod pods): these are the models in runpod/pods/remote_models.json - this computer's models are not listed. Model manager ▸ ＋ From this computer adds one."] };
}
/** the entry behind a name a style / Override uses (pure): the same ComfyUI name, else the same file name, in these categories */
function byName(list, cats, name) {
  const n = String(name || "").replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase(), b = n.split("/").pop(), cs = cats && cats.length ? cats : FOLDERS;
  const L = (list || []).filter((e) => cs.includes(cat(e)));
  return L.find((e) => comfyName(e).toLowerCase() === n) || L.find((e) => String(e.name).toLowerCase() === b) || null;
}
/** a Model manager card for it (pure; mk = lib/modelCards.cardFrom) */
function cardOf(e, mk) {
  const c = mk({ cat: cat(e), name: comfyName(e), size: e.size }, null, null, { title: e.label }, {});
  return Object.assign(c, { key: "rm:" + e.id, rm: true, rm_id: e.id, folder: familyOf(e), group: e.group || "", url: e.url, source_rm: e.source, pods: e.pods || {}, styles_rm: e.styles || [],
    file_date: e.added || "", description: c.description || (e.url ? "Downloaded by the pod from " + (e.source === "civitai" ? "Civitai" : e.source === "your-hf" ? "your private Hugging Face repo" : e.source === "link" ? "its link" : "Hugging Face") : "No link yet - ⇪ sends it from this computer") });
}

/* ---------------- live */
function core() { return require("./core"); }
function HF() { return require("./podModels").HF; }
function FILE() { return process.env.H3_REMOTE_MODELS || path.join(core().BASE, "runpod", "pods", "remote_models.json"); }
function rg() { return ((core().getConfig() || {}).rgpu) || {}; }
function load() {
  let j = null; try { j = JSON.parse(fs.readFileSync(FILE(), "utf8")); } catch { j = null; }
  return ((j && Array.isArray(j.models)) ? j.models : []).map((e) => clean(e, HF())).filter(Boolean);
}
function save(list) {
  const f = FILE(); fs.mkdirSync(path.dirname(f), { recursive: true });
  const t = f + ".tmp"; fs.writeFileSync(t, JSON.stringify({ v: 1, about: "bitGen Studio: the models your RunPod pods use (no keys or tokens)", models: list }, null, 2)); fs.renameSync(t, f);
}
function add(e) { const r = merge(load(), e, HF()); if (r.entry) save(r.list); return r.entry; }
function get(id) { return load().find((e) => e.id === String(id)) || null; }
function remove(id) { const L = load(), n = L.filter((e) => e.id !== String(id)); if (n.length === L.length) return false; save(n); return true; }
function patch(id, f) {
  const L = load(), i = L.findIndex((e) => e.id === String(id)); if (i < 0) return null;
  const x = f || {}, n = clean(Object.assign({}, L[i], x.label != null ? { label: x.label } : {}, x.group != null ? { group: x.group } : {}, x.url != null ? { url: x.url, source: "" } : {}, x.folder != null ? { folder: x.folder } : {}), HF());
  if (!n) { const e = new Error("that folder is not a ComfyUI models folder"); e.status = 400; throw e; }
  L[i] = n; save(L); return n;
}
function mark(e, pod, state) {
  const L = load(), i = L.findIndex((x) => same(x, e)); if (i < 0) return;
  L[i].pods = Object.assign({}, L[i].pods, { [String(pod).replace(/[^A-Za-z0-9]/g, "")]: state }); save(L);
}
/** remote mode: remote generation on, with RunPod pods */
function podsMode() {
  // 2.766.2 (Tim: "when local is selected in basic settings go to local mode"): Basic Settings ▸ GPU on Local = local mode,
  // whatever remote generation is set up
  try { const G = require("./gpuSplit"), r = rg(); return G.enabledOf(r) && G.engineOf(r).pods && require("./modeSwitch").remoteWhere(G.split()); } catch { return false; }
}
/** the pods ticked in My pods -> [{id, name}] */
function selected() { return (Array.isArray(rg().pod_selected) ? rg().pod_selected : []).map((p) => ({ id: String((p && p.id) || p || "").replace(/[^A-Za-z0-9]/g, ""), name: String((p && p.name) || "").slice(0, 80) })).filter((p) => p.id); }
function setSelected(list) {
  const c = core().getConfig(); c.rgpu = c.rgpu || {};
  const seen = new Set();
  c.rgpu.pod_selected = (Array.isArray(list) ? list : []).map((p) => ({ id: String((p && p.id) || p || "").replace(/[^A-Za-z0-9]/g, ""), name: String((p && p.name) || "").slice(0, 80) }))
    .filter((p) => p.id && !seen.has(p.id) && seen.add(p.id)).slice(0, 20);
  core().setConfig(c); return selected();
}
/** the styles your pods use: linked to a pod, in a preset -> [style id] */
function podStyles() {
  const ids = new Set();
  try { const l = require("./stylePods").cleanLinks(rg().style_pods); Object.keys(l).forEach((s) => ids.add(s)); } catch { /* none */ }
  try { for (const p of require("./podPresets").all()) for (const s of (p.styles || [])) ids.add(String(s.id || s)); } catch { /* none */ }
  return [...ids];
}
/** their catalog files into the list (each with the styles that use it) -> how many were new */
function fill() {
  const PM = require("./podModels"), S = require("./styles"), C = core();
  let L = load(); const n0 = L.length;
  for (const id of podStyles()) {
    let pl = null; try { pl = PM.planFor([id]); } catch { pl = null; }
    const st = (() => { try { return S.byId(C.STYLES_DIR, id); } catch { return null; } })();
    for (const f of ((pl && pl.files) || [])) {
      L = merge(L, { label: f.name.replace(/\.[^.]+$/, "").replace(/_+/g, " "), group: st ? st.name : "", folder: f.folder, name: f.name, url: f.url, size: f.size, source: "catalog", styles: [id] }, HF()).list;
    }
  }
  save(L);
  return L.length - n0;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function portOfPod(id) { try { return require("./stylePods").portOf(rg(), id); } catch { return 8188; } }
/** each selected pod (or `pods`) downloads the entry - in the background, a progress bar each -> {sending: [pod ids]} */
function send(id, pods) {
  const e = get(id); if (!e) { const x = new Error("no such model in the list"); x.status = 404; throw x; }
  const to = (pods && pods.length ? pods.map((p) => ({ id: String(p.id || p).replace(/[^A-Za-z0-9]/g, ""), name: String(p.name || "") })) : selected()).filter((p) => p.id);
  if (!to.length) { const x = new Error("tick the pods to send it to (☐ beside each pod's name in PODS ▸ My pods)"); x.status = 400; throw x; }
  if (!e.url) { const x = new Error(e.label + " has no link yet - ＋ From this computer puts it in your Hugging Face repo (or sends it)"); x.status = 409; throw x; }
  const SD = require("./podSend");
  for (const p of to) {
    SD.pullWait(p.id, portOfPod(p.id), { url: e.url, folder: e.folder, name: e.name, size: e.size, from: e.source === "civitai" ? "Civitai" : e.source === "link" ? "its link" : e.source === "your-hf" ? "your Hugging Face" : "Hugging Face", pod_name: p.name }, null)
      .then((why) => mark(e, p.id, why ? "failed" : "done")).catch(() => mark(e, p.id, "failed"));
  }
  return { sending: to.map((p) => p.id) };
}
/** a model of this computer into the list and onto the selected pods (in the background) -> {started: true} */
function addLocal(o) {
  const x = o || {}, SD = require("./podSend");
  const c = FOLDERS.includes(x.cat) ? x.cat : "";
  if (!c) { const e = new Error("pick a model or LoRA of this computer"); e.status = 400; throw e; }
  const local = SD.findLocal(SD.localScan(), [c], String(x.name || ""));
  if (!local) { const e = new Error(String(x.name) + " is not in this computer's ComfyUI folders"); e.status = 404; throw e; }
  const to = selected();
  (async () => { try { await keepLocal(local, to, x); } catch { /* the transfers list says it */ } })();
  return { started: true, name: local.rel, pods: to.map((p) => p.id) };
}
/** find it online (Civitai) / put it in your Hugging Face repo -> its entry; then each pod downloads it - or, with no
 *  token that can write, this computer sends it to each pod */
async function keepLocal(local, to, opt) {
  const SD = require("./podSend"), PT = require("./podTransfers"), PO = require("./podOnline");
  const folder = SD.folderFor(local.category, local.rel), name = local.rel.split("/").pop();
  let size = 0; try { size = fs.statSync(local.path).size; } catch { size = 0; }
  const hx = PT.begin({ pod: "", name, how: "hash", from: "this computer", size });
  let found = null;
  try { found = await PO.find(local.path, null, { sha256: (abs, cb) => require("./civitai").sha256(abs, (g) => { PT.step(hx, g); if (cb) cb(g); }) }); } catch { found = null; }
  PT.end(hx, "done");
  let e = null;
  if (found && found.url) e = add({ label: (opt && opt.label) || found.model || name, group: (opt && opt.group) || "", folder, name, url: found.url, source: "civitai", sha256: found.sha256, size: found.size || size });
  if (!e) {
    const tok = String((((core().getConfig() || {}).hf) || {}).token || "");
    const ux = PT.begin({ pod: "", name, how: "hf", from: "this computer", size });
    try {
      const sha = (() => { try { return String(JSON.parse(fs.readFileSync(require("./modelCards").sidecarPath(local.path), "utf8")).sha256 || ""); } catch { return ""; } })();
      const r = await require("./hfUpload").upload(local.path, { token: tok, folder, name, sha256: sha, onProgress: (n) => PT.step(ux, n) });
      PT.end(ux, "done");
      e = add({ label: (opt && opt.label) || name.replace(/\.[^.]+$/, "").replace(/_+/g, " "), group: (opt && opt.group) || "", folder, name, url: r.url, source: "your-hf", sha256: r.sha256, size: r.size });
    } catch (err) {
      PT.end(ux, "failed: " + String((err && err.message) || err) + " - sending it from this computer instead");
      // no repo of yours: this computer sends it to each selected pod (slow) and the list keeps it without a link
      e = add({ label: name.replace(/\.[^.]+$/, "").replace(/_+/g, " "), folder, name, size, source: "link" });
      for (const p of to) {
        const port = portOfPod(p.id);
        const why = await SD.sendOne(p.id, port, local, local.category, null, { noCivitai: true, noHf: true, pod_name: p.name }).catch((x) => String((x && x.message) || x));
        if (e) mark(e, p.id, why ? "failed" : "done");
      }
      return e;
    }
  }
  if (e && to.length) send(e.id, to);
  return e;
}
/** a link you paste (Hugging Face / Civitai / any https) -> its entry */
function addLink(o) {
  const x = o || {};
  if (!/^https:\/\/[^\s]+$/i.test(String(x.url || ""))) { const e = new Error("paste a download link (https://…)"); e.status = 400; throw e; }
  const folder = folderOk(x.folder); if (!folder) { const e = new Error("pick the ComfyUI folder it goes in"); e.status = 400; throw e; }
  const name = String(x.name || "").trim() || require("./podModels").nameFromLink(x.url);
  const e = add({ label: x.label, group: x.group, folder, name, url: x.url, relink: true });
  if (!e) { const er = new Error("that file name is not allowed"); er.status = 400; throw er; }
  return e;
}
/** Model manager's ⤓ on a Civitai card in remote mode: the version's file into the list (a Civitai link), then to the
 *  selected pods -> {entry, sending} */
async function fromCivitai(o) {
  const x = o || {}, CV = require("./civitai");
  const ver = await CV.api("/model-versions/" + encodeURIComponent(String(x.version_id || "")));
  const f = CV.pickFile(ver, x.file_id);
  if (!f || !f.downloadUrl) { const e = new Error("that Civitai version has no file to download"); e.status = 404; throw e; }
  const c = CV.catFor((ver.model || {}).type, f) || "checkpoints";
  const sub = String(x.subfolder || "").replace(/[^\w.+ -]/g, "").slice(0, 64);
  const site = ((core().getConfig() || {}).civitai || {}).site;
  const e = add({ label: [String(x.title || (ver.model || {}).name || ""), ver.name].filter(Boolean).join(" - "), group: String(ver.baseModel || ""), base_model: String(ver.baseModel || ""), folder: c + (sub ? "/" + sub : ""),
    name: CV.safeName ? CV.safeName(f.name) : f.name, url: require("./podOnline").dlUrl(f.downloadUrl, site, "") || f.downloadUrl, source: "civitai", sha256: ((f.hashes || {}).SHA256 || "").toLowerCase(), size: Math.round((+f.sizeKB || 0) * 1024) });
  let sending = [];
  if (e && selected().length) sending = send(e.id).sending;
  return { entry: e, sending };
}
/** the first time remote mode is used: the list starts with the files of the styles your pods use */
function ensureFilled() { try { if (!fs.existsSync(FILE())) fill(); } catch { /* an empty list */ } }
/** Model manager's cards in remote mode */
function cards() {
  const mk = require("./modelCards").cardFrom, L = load();
  const all = L.map((e) => cardOf(e, mk));
  return { models: all.filter((c) => c.kind === "model" && MODEL_CATS.includes(c.cat)), loras: all.filter((c) => c.kind === "lora"), other: all.filter((c) => c.kind !== "lora" && !MODEL_CATS.includes(c.cat)) };
}
module.exports = { FOLDERS, MODEL_CATS, SOURCES, folderOk, sourceOf, stripToken, clean, keyOf, same, merge, comfyName, familyOf, asComfyModels, byName, cardOf,
  FILE, ensureFilled, load, save, add, get, remove, patch, mark, podsMode, selected, setSelected, podStyles, fill, send, addLocal, keepLocal, addLink, fromCivitai, cards, sleep };
