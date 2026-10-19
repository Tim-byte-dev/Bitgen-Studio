// bitGen Studio — lib/civitai.js (2.518.0): CIVITAI - search, download into the right ComfyUI folder, look a model up.
// Tim (verbatim): "Add civitai.red(if i can get an api key) so models can be downloaded to the appropriate folder on my
// machine without moving it or choosing save as. etc."
//
//   THE KEY       Settings -> General -> Civitai (config.civitai {token, site}) - civitai.red (everything, your account's
//                 content level) or civitai.com (safe-for-work only). Create one at civitai.com/user/account (API Keys).
//                 It is sent only to Civitai: the Authorization header on API calls, ?token= on a download (a redirect
//                 to Civitai's file host never carries the header - lib/setupExec.open drops it on another host).
//   THE API       https://<site>/api/v1 (models, model-versions, model-versions/by-hash/<sha256>, me); a site that
//                 does not answer the API falls back to civitai.com once (the API lives there)
//   WHERE IT GOES Civitai's type -> ComfyUI's folder (lib/comfyModels roots, the first that exists - lib/modelInstall
//                 .pickTarget): Checkpoint -> checkpoints (a GGUF, or a .safetensors with no VAE / text encoder inside,
//                 -> diffusion_models: that is what UNETLoader reads), LORA / LoCon / DoRA -> loras, VAE -> vae,
//                 TextualInversion -> embeddings, Controlnet -> controlnet, Upscaler -> upscale_models, Detection ->
//                 ultralytics; a subfolder you type is kept. Nothing to move, no Save As. The same file already there
//                 (same name + size) is not downloaded again; a different file with the same name gets _v<version>.
//   BESIDE IT     <stem>.bitgen.json (the version's answer: base model, trigger words, release date, rating, the
//                 example pictures' cfg / steps / sampler) + <stem>.preview.<ext> (its first picture) - lib/modelCards
//   LOOK UP       a model you already have: its SHA-256 (read once, kept in <stem>.bitgen.json) -> by-hash
//   2.538.0       folder: a model_folders.json key (lib/modelFolders) - the type's folder you picked beats ComfyUI's own
// Pure (scripts/test-modelmgr518.js): catFor, isBareDiffusion, pickFile, pickImage, safeName, mapModel, rating, siteBase.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SITES = ["civitai.red", "civitai.com"];
const TYPE_CAT = { Checkpoint: "checkpoints", LORA: "loras", LoCon: "loras", DoRA: "loras", LyCORIS: "loras", VAE: "vae",
  TextualInversion: "embeddings", Controlnet: "controlnet", Upscaler: "upscale_models", Detection: "ultralytics" };
const SEARCH_TYPES = ["Checkpoint", "LORA", "LoCon", "DoRA", "VAE", "TextualInversion", "Controlnet", "Upscaler"];
const SORTS = ["Highest Rated", "Most Downloaded", "Most Liked", "Newest"];
const IMG_HOSTS = /^(image\.civitai\.com|[a-z0-9-]+\.civitai\.com|civitai\.com|civitai\.red|[a-z0-9-]+\.civitai\.red)$/i;

const siteBase = (site) => `https://${SITES.includes(site) ? site : SITES[0]}/api/v1`;
/** Civitai's model type + the file -> ComfyUI category | "" (not a model file ComfyUI loads) */
function catFor(modelType, file) {
  const ft = String((file && file.type) || "Model");
  if (/^vae$/i.test(ft)) return "vae";
  if (/text ?encoder/i.test(ft)) return "text_encoders";
  if (!/^(model|pruned model)$/i.test(ft)) return "";
  const c = TYPE_CAT[modelType] || "";
  if (c === "checkpoints") {
    const fmt = String(((file && file.metadata) || {}).format || "") + " " + String((file && file.name) || "");
    if (/gguf/i.test(fmt)) return "diffusion_models";
  }
  return c;
}
/** a downloaded checkpoint's header: no VAE and no text encoder inside = a bare diffusion model (UNETLoader's) */
function isBareDiffusion(header) {
  if (!header || !Array.isArray(header.keys) || !header.keys.length) return false;
  const k = header.keys;
  const vae = k.some((x) => /^(first_stage_model\.|vae\.|decoder\.conv_in)/.test(x));
  const te = k.some((x) => /^(cond_stage_model\.|conditioner\.|text_encoders?\.|clip_[lg]\.|t5xxl\.)/.test(x));
  return !vae && !te;
}
/** which file of a version: the one asked for, else the primary model file, else the first model file */
function pickFile(ver, fileId) {
  const fs_ = (ver && ver.files) || [];
  if (fileId) { const f = fs_.find((x) => String(x.id) === String(fileId)); if (f) return f; }
  return fs_.find((x) => x.primary && /model/i.test(x.type || "Model")) || fs_.find((x) => /^model$/i.test(x.type || "")) || fs_[0] || null;
}
/** the first still picture (no video), safe-for-work unless mature is on */
function pickImage(images, mature) {
  const list = (images || []).filter((i) => i && i.url && (i.type ? i.type === "image" : !/\.(mp4|webm|mov)(\?|$)/i.test(i.url)));
  const ok = list.filter((i) => mature || !(i.nsfw === true || i.nsfw === "X" || i.nsfw === "Mature" || (+i.nsfwLevel || 1) > 1));
  return ok[0] || null;
}
const safeName = (n) => path.basename(String(n || "")).replace(/[<>:"/\\|?*\x00-\x1f]+/g, "_").replace(/^\.+/, "").slice(0, 200);
/** thumbs up / down (or the old rating) -> {rating 0-5, count} */
function rating(stats) {
  const s = stats || {};
  if (+s.rating > 0) return { rating: Math.round(+s.rating * 10) / 10, count: +s.ratingCount || 0 };
  const up = +s.thumbsUpCount || 0, down = +s.thumbsDownCount || 0;
  return up + down > 0 ? { rating: Math.round((up / (up + down)) * 50) / 10, count: up + down } : { rating: null, count: 0 };
}
/** a /models item -> what the manager's Civitai cards show (pure) */
function mapModel(m, mature) {
  const cards = require("./modelCards");
  const vers = (m.modelVersions || []).map((v) => {
    const img = pickImage(v.images, mature);
    return { id: v.id, name: v.name || "", base_model: v.baseModel || "", released: String(v.publishedAt || v.createdAt || "").slice(0, 10),
      keywords: (v.trainedWords || []).slice(0, 30), thumb: img ? img.url : "",
      files: (v.files || []).map((f) => ({ id: f.id, name: f.name, size_kb: f.sizeKB || f.sizeKb || 0, type: f.type || "Model", primary: !!f.primary,
        format: (f.metadata || {}).format || "", fp: (f.metadata || {}).fp || "", cat: catFor(m.type, f), sha256: ((f.hashes || {}).SHA256 || "").toLowerCase() })) };
  });
  const v0 = vers[0] || {};
  const fam = cards.baseFamily(v0.base_model) || cards.nameFamily(m.name) || "other";
  const r = rating(m.stats);
  return { model_id: m.id, title: m.name || "", type: m.type || "", nsfw: !!m.nsfw, creator: (m.creator || {}).username || "",
    description: cards.textOf(m.description || "").slice(0, 3000), family: fam, family_label: (cards.FAMILIES[fam] || cards.FAMILIES.other).label,
    category: cards.categoryOf(fam, { name: m.name, base_model: v0.base_model }), released: v0.released || "", rating: r.rating, rating_count: r.count,
    downloads: (m.stats || {}).downloadCount || 0, keywords: v0.keywords || [], thumb: v0.thumb || "", versions: vers,
    url: `https://civitai.com/models/${m.id}` };
}

/* ---------------- live */
function cfg() {
  const c = (require("./core").getConfig().civitai) || {};
  return { token: String(c.token || "").trim(), site: SITES.includes(c.site) ? c.site : SITES[0], mature: !!c.mature };
}
function headers(tok) { return tok ? { Authorization: "Bearer " + tok, Accept: "application/json" } : { Accept: "application/json" }; }
async function api(p, query) {
  const ex = require("./setupExec"), c = cfg();
  const qs = query ? "?" + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== "" && v != null)).toString() : "";
  let r = await ex.getJson(siteBase(c.site) + p + qs, headers(c.token));
  if (c.site !== "civitai.com" && (r.status === 0 || r.status === 404 && !r.json || (r.status === 200 && !r.json)))
    r = await ex.getJson(siteBase("civitai.com") + p + qs, headers(c.token));       // the API lives on civitai.com
  if (r.status === 401 || r.status === 403) { const e = new Error(c.token ? "Civitai refused the API key (401) - check it in Settings -> General -> Civitai" : "this needs a Civitai API key - Settings -> General -> Civitai"); e.status = 401; throw e; }
  if (r.status === 0) { const e = new Error("Civitai could not be reached" + (r.error ? ": " + r.error : "")); e.status = 502; throw e; }
  if (r.status >= 400) { const e = new Error(`Civitai answered HTTP ${r.status}` + (r.json && (r.json.error || r.json.message) ? ": " + String(r.json.error || r.json.message).slice(0, 200) : "")); e.status = r.status; throw e; }
  return r.json;
}
async function test() {
  const c = cfg();
  if (!c.token) return { ok: false, error: "no key yet" };
  try { const me = await api("/me"); return { ok: true, user: (me && (me.username || me.name)) || "", site: c.site }; }
  catch (e) { return { ok: false, error: e.message }; }
}
async function search(q) {
  const o = q || {}, c = cfg();
  const types = (Array.isArray(o.types) ? o.types : String(o.types || "").split(",")).map((x) => x.trim()).filter((x) => SEARCH_TYPES.includes(x));
  const query = { limit: Math.max(1, Math.min(48, +o.limit || 24)), sort: SORTS.includes(o.sort) ? o.sort : "Highest Rated",
    nsfw: c.mature && o.nsfw !== false ? "true" : "false", query: String(o.query || "").slice(0, 120), cursor: o.cursor || "" };
  if (types.length) query.types = types.join(",");
  if (o.baseModels) query.baseModels = String(o.baseModels).slice(0, 60);
  if (!query.query) { delete query.query; if (!query.cursor) { delete query.cursor; } }
  const j = await api("/models", query);
  try { require("./testPlan").event("civitai_search", { what: query.query || "(top " + query.sort + ")" }); } catch { /* the 🧪 checklist */ }
  return { items: ((j && j.items) || []).map((m) => mapModel(m, c.mature)), next: (j && j.metadata && j.metadata.nextCursor) || "" };
}

/* downloads, one at a time */
const D = { list: [], busy: false, seq: 0 };
const lookups = new Map();
function scanRoots(cat) {
  const sc = require("./modelCards").comfyScan();
  return (((sc.categories || {})[cat] || {}).roots || []);
}
function download(opts) {
  const o = opts || {};
  const vid = String(o.version_id || "").replace(/\D/g, "");
  if (!vid) return { error: "which version? (version_id)" };
  const sub = String(o.subfolder || "").replace(/\\/g, "/").split("/").map((x) => safeName(x)).filter((x) => x && x !== "." && x !== "..").join(path.sep);
  // 2.538.0: folder = a model_folders.json key (lib/modelFolders) - the folder itself is read HERE, never taken from the request
  const fkey = o.folder ? String(o.folder) : "";
  if (fkey) { const mf = require("./modelFolders"); if (!mf.parseKey(fkey)) return { error: "unknown model type: " + fkey }; if (!mf.get(fkey)) return { error: "no folder set for " + mf.labelOf(fkey) + " yet", need_folder: true, key: fkey }; }
  const d = { id: "d" + (++D.seq), version_id: vid, file_id: o.file_id || null, subfolder: sub, folder: fkey, status: "queued", got: 0, total: 0, name: o.title || "", note: "", error: "", at: Date.now() };
  D.list.unshift(d); D.list.splice(30);
  pumpDl();
  return { ok: true, download: d };
}
async function pumpDl() {
  if (D.busy) return;
  const d = D.list.slice().reverse().find((x) => x.status === "queued"); if (!d) return;
  D.busy = true;
  try { await runDl(d); } catch (e) { d.status = "failed"; d.error = String(e.message || e); }
  D.busy = false;
  pumpDl();
}
async function runDl(d) {
  const ex = require("./setupExec"), cards = require("./modelCards"), mi = require("./modelInstall"), c = cfg();
  d.status = "starting";
  const ver = await api("/model-versions/" + d.version_id);
  const file = pickFile(ver, d.file_id);
  if (!file) throw new Error("that version has no file");
  const mtype = (ver.model && ver.model.type) || "";
  let cat = catFor(mtype, file);
  if (!cat) throw new Error(`a ${mtype || "?"} / ${file.type || "?"} file is not a model ComfyUI loads - download it from the site`);
  // 2.538.0: the folder you picked for this model type (model_folders.json) beats ComfyUI's own folder
  const mine = d.folder ? require("./modelFolders").get(d.folder) : "";
  const target = mine ? { dir: mine } : mi.pickTarget(scanRoots(cat));
  if (!target) throw new Error(`ComfyUI has no ${cat} folder here - set the ComfyUI folder in Settings -> ComfyUI`);
  let dir = d.subfolder ? path.join(target.dir, d.subfolder) : target.dir;
  if (mine) { const mf = require("./modelFolders"), roots = scanRoots(cat).map((r) => r.dir).concat(cat === "checkpoints" ? scanRoots("diffusion_models").map((r) => r.dir) : []);
    if (roots.length && !mf.inside(mine, roots)) d.note = "saved outside ComfyUI's " + cat + " folders - add it to extra_model_paths.yaml so ComfyUI lists it"; }
  let name = safeName(file.name) || ("civitai_" + d.version_id + ".safetensors");
  d.name = d.name || ((ver.model && ver.model.name) || name);
  d.file = name; d.cat = cat;
  let dest = path.join(dir, name);
  const want = Math.round((file.sizeKB || file.sizeKb || 0) * 1024);
  if (fs.existsSync(dest)) {
    const have = fs.statSync(dest).size;
    if (!want || Math.abs(have - want) < 4096) { d.status = "done"; d.note = "already in " + (mine ? path.basename(dir) : cat) + " - not downloaded again"; d.dest = dest; await afterDl(d, ver, file, dest, c); return; }
    name = name.replace(/(\.[^.]+)$/, `_v${d.version_id}$1`); dest = path.join(dir, name); d.file = name;
  }
  fs.mkdirSync(dir, { recursive: true });
  const url = (file.downloadUrl || `https://civitai.com/api/download/models/${d.version_id}`);
  const u = new URL(url);
  if (c.token) u.searchParams.set("token", c.token);
  d.status = "downloading"; d.total = want;
  const r = await ex.download(u.toString(), dest, { size: want, onProgress: (p) => { d.got = p.got; if (p.total) d.total = p.total; } });
  if (!r.ok) {
    if (r.status === 401 || r.status === 403) throw new Error(c.token ? "Civitai refused the download (" + r.status + ") - the creator may need you signed in / your key's permissions" : "this model needs a Civitai API key - Settings -> General -> Civitai");
    throw new Error(r.error || ("HTTP " + r.status));
  }
  // a "Checkpoint" with no VAE / text encoder inside is a bare diffusion model: UNETLoader reads diffusion_models
  if (cat === "checkpoints" && !mine && /\.(safetensors|sft)$/i.test(dest)) {   // 2.538.0: not when you chose the folder
    let st = 0; try { st = fs.statSync(dest).size; } catch { st = 0; }
    const h = cards.readHead(dest, st, Date.now());
    if (isBareDiffusion(h.header)) {
      const t2 = mi.pickTarget(scanRoots("diffusion_models"));
      if (t2) {
        const nd = d.subfolder ? path.join(t2.dir, d.subfolder) : t2.dir;
        const nf = path.join(nd, path.basename(dest));
        try {
          fs.mkdirSync(nd, { recursive: true });
          if (!fs.existsSync(nf)) { fs.renameSync(dest, nf); dest = nf; d.cat = cat = "diffusion_models"; d.note = "no VAE / text encoder inside - put in diffusion_models (UNETLoader)"; }
        } catch { /* another volume: it stays in checkpoints (Settings -> Image -> Make visible to UNETLoader links it) */ }
      }
    }
  }
  d.dest = dest; d.status = "done"; d.got = d.total || d.got;
  if (mine) d.note = d.note || "saved to " + dir;
  await afterDl(d, ver, file, dest, c);
  try { require("./testPlan").event("civitai_download", { cat: d.cat, what: d.file }); } catch { /* the 🧪 checklist */ }
}
async function afterDl(d, ver, file, dest, c) {
  const cards = require("./modelCards");
  let model = null;
  try { model = await api("/models/" + ver.modelId); } catch { model = null; }
  const keep = slim(ver, model);
  try { cards.writeCivitai(dest, keep, { sha256: ((file.hashes || {}).SHA256 || "").toLowerCase() || undefined }); } catch (e) { d.note = (d.note ? d.note + "; " : "") + "could not write its card: " + e.message; }
  try { await savePreview(dest, ver.images, c.mature); } catch { /* the card shows no picture */ }
  cards.invalidate();
}
/** what <stem>.bitgen.json keeps of a version (small) */
function slim(ver, model) {
  const imgs = (ver.images || []).slice(0, 8).map((i) => ({ url: i.url, type: i.type, nsfwLevel: i.nsfwLevel, width: i.width, height: i.height,
    meta: i.meta ? { cfgScale: i.meta.cfgScale, steps: i.meta.steps, sampler: i.meta.sampler } : undefined }));
  return { id: ver.id, modelId: ver.modelId, name: ver.name, baseModel: ver.baseModel, trainedWords: ver.trainedWords || [], publishedAt: ver.publishedAt || ver.createdAt,
    stats: ver.stats || {}, images: imgs,
    model: { name: (ver.model || {}).name || (model || {}).name, type: (ver.model || {}).type || (model || {}).type, nsfw: !!((ver.model || {}).nsfw || (model || {}).nsfw),
      description: model ? String(model.description || "").slice(0, 8000) : "", stats: model ? model.stats || {} : {} },
    description: String(ver.description || "").slice(0, 4000) };
}
async function savePreview(dest, images, mature) {
  const img = pickImage(images, mature); if (!img) return null;
  const ex = require("./setupExec");
  const url = String(img.url).replace(/\/width=\d+\//, "/width=512/");
  const r = await ex.open(url, {});
  if (r.status !== 200) { r.res.resume(); return null; }
  const ct = String(r.headers["content-type"] || "");
  const ext = /png/.test(ct) ? ".png" : /webp/.test(ct) ? ".webp" : ".jpeg";
  const out = dest.replace(/\.[^./\\]+$/, "") + ".preview" + ext;
  await new Promise((ok, bad) => { const w = fs.createWriteStream(out); r.res.pipe(w); w.on("finish", ok); w.on("error", bad); r.res.on("error", bad); });
  return out;
}
function downloads() { return D.list.map((d) => Object.assign({}, d)); }

/** look a model you have up by its SHA-256 (read once) */
function lookup(key) {
  const cards = require("./modelCards");
  const h = cards.find(key); if (!h) return { error: "no such model" };
  if (lookups.has(key) && lookups.get(key).status === "hashing") return { ok: true, lookup: lookups.get(key) };
  const L = { key, status: "hashing", got: 0, total: h.card.size || 0, error: "" };
  lookups.set(key, L);
  (async () => {
    try {
      let sha = h.card.sha256;
      if (!sha) sha = await sha256(h.abs, (g) => { L.got = g; });
      L.status = "asking";
      const c = cfg();
      let ver = null;
      try { ver = await api("/model-versions/by-hash/" + sha.toUpperCase()); }
      catch (e) { if (e.status === 404) { L.status = "unknown"; L.error = "Civitai does not know this file"; cards.writeCivitai(h.abs, (readOurs(h.abs).civitai || null), { sha256: sha }); return; } throw e; }
      let model = null; try { model = await api("/models/" + ver.modelId); } catch { model = null; }
      cards.writeCivitai(h.abs, slim(ver, model), { sha256: sha });
      try { await savePreview(h.abs, ver.images, c.mature); } catch { /* no picture */ }
      L.status = "done";
      try { require("./testPlan").event("civitai_lookup", { what: h.card.file }); } catch { /* the 🧪 checklist */ }
    } catch (e) { L.status = "failed"; L.error = String(e.message || e); }
    cards.invalidate();
  })();
  return { ok: true, lookup: L };
}
function readOurs(abs) { try { return JSON.parse(fs.readFileSync(require("./modelCards").sidecarPath(abs), "utf8")); } catch { return {}; } }
function sha256(abs, onProgress) {
  return new Promise((ok, bad) => {
    const hsh = crypto.createHash("sha256"); let got = 0, last = 0;
    const s = fs.createReadStream(abs, { highWaterMark: 4 * 1024 * 1024 });
    s.on("data", (b) => { hsh.update(b); got += b.length; if (onProgress && got - last > 64 * 1024 * 1024) { last = got; onProgress(got); } });
    s.on("end", () => ok(hsh.digest("hex"))); s.on("error", bad);
  });
}
function lookupState() { return [...lookups.values()].map((x) => Object.assign({}, x)); }

/** stream one Civitai picture through the app (only Civitai's hosts) */
async function image(u, res) {
  let url;
  try { url = new URL(String(u || "")); } catch { res.status(400).end(); return; }
  if (url.protocol !== "https:" || !IMG_HOSTS.test(url.hostname)) { res.status(403).end(); return; }
  const ex = require("./setupExec");
  try {
    const r = await ex.open(url.toString().replace(/\/width=\d+\//, "/width=450/"), {});
    if (r.status !== 200) { r.res.resume(); res.status(r.status || 502).end(); return; }
    res.set("Content-Type", r.headers["content-type"] || "image/jpeg"); res.set("Cache-Control", "max-age=86400");
    r.res.pipe(res);
  } catch { res.status(502).end(); }
}

module.exports = { scanRoots, SITES, TYPE_CAT, SEARCH_TYPES, SORTS, siteBase, catFor, isBareDiffusion, pickFile, pickImage, safeName, rating, mapModel, slim,
  cfg, api, test, search, download, downloads, lookup, lookupState, image, sha256 };
