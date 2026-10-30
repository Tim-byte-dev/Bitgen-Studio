// bitGen Studio — lib/modelCards.js (2.518.0): THE MODEL + LoRA CARDS of the 🧩 Model manager docker.
// Tim (verbatim): "create a model and lora manager floating docker with checkbox to overide styles setting and a button
// to create new style from the model i select. a card for each model, thumbnail, description, date released, rating,
// cfg,steps,vae, text-encoder, the card will show thumbnail, name, rating, date released,model type(qwen,krea,flux,
// pony,sdxl,illustrious etc), model category(image, image edit)video,music ... Lora cards will have the same + keywords."
//
//   WHERE THE MODELS ARE   ComfyUI's own folders - lib/comfyModels.scan (models/<cat> + extra_model_paths.yaml):
//                          checkpoints + diffusion_models (unet) = models, loras = LoRAs
//   WHAT A CARD KNOWS      in this order, the later winning:
//                            1. the file itself - its name, its folder, the safetensors header (modelspec / kohya
//                               ss_* metadata, a few tensor names) or the GGUF header (general.architecture)
//                            2. what other tools left beside it: <stem>.civitai.info (A1111 Civitai Helper),
//                               <stem>.metadata.json (LoRA Manager's civitai block)
//                            3. <stem>.bitgen.json - ours: the Civitai answer (lib/civitai.js writes it) + YOUR edits
//                               on the card (✎: name, rating, type, category, cfg, steps, VAE, text encoder, keywords,
//                               description) - kept beside the model so it travels with it
//   THUMBNAIL              <stem>.preview.png|jpg|jpeg|webp or <stem>.png|jpg|jpeg|webp beside the model
//   card = {key, kind, cat, name, file, title, size, mtime, family, family_label, category, base_model, description,
//           released, file_date, rating, rating_count, user_rating, cfg, steps, sampler, vae, te, keywords, thumb,
//           civitai: {model_id, version_id, url} | null, sha256, source, edited}
//   styleFrom()            ✚ New style from the selection: the style that renders this family (a starter by name, or
//                          any style of its architecture) copied - its workflow, text encoder, VAE, sampler, negative -
//                          with this model, these LoRAs and the card's cfg / steps / VAE / text encoder
// Pure (scripts/test-modelmgr518.js): familyOf, categoryOf, baseFamily, nameFamily, headerFamily, parseSafetensorsHeader,
// parseGgufArch, topTags, cardFrom, mergeInfo, templateFor, styleFrom, sidecarPath, thumbCandidates, FAMILIES.
"use strict";
const fs = require("fs");
const path = require("path");

const FAMILIES = {
  sd15: { label: "SD 1.5", category: "image", arch: "sdxl", template: ["SDXL"], size: 512 },
  sdxl: { label: "SDXL", category: "image", arch: "sdxl", template: ["SDXL"] },
  pony: { label: "Pony", category: "image", arch: "sdxl", template: ["Pony", "SDXL"] },
  illustrious: { label: "Illustrious", category: "image", arch: "sdxl", template: ["Illustrious", "SDXL"] },
  noobai: { label: "NoobAI", category: "image", arch: "sdxl", template: ["Illustrious", "SDXL"] },
  flux: { label: "Flux.1", category: "image", arch: "flux", template: ["FLUX.1 Kontext edit", "FLUX Fill inpaint"] },
  flux2: { label: "Flux.2", category: "image", arch: "flux2klein9b", template: ["FLUX.2 Klein 9B", "FLUX.2 9B (verified)"] },
  flux3: { label: "Flux 3", category: "image", arch: "flux3klein", template: ["FLUX 3 Klein"] },
  krea: { label: "Krea", category: "image", arch: "krea2", template: ["Krea 2 Turbo", "Krea 2 Raw"], gguf: ["Krea 2 Turbo GGUF", "Krea 2 Raw GGUF"] },
  qwen: { label: "Qwen", category: "image", arch: "qwen-image", template: ["Qwen Image 2.1 edit", "Qwen Image Edit 2511"] },
  anima: { label: "Anima", category: "image", arch: "anima", template: ["Anima"] },
  moss: { label: "MOSS-Image", category: "image", arch: "moss", template: ["MOSS-Image", "MOSS-Image Base"] },   // 2.566.0
  fibo: { label: "Fibo 2.0", category: "image edit", arch: "fibo2", template: ["Fibo 2.0 Edit Turbo", "Fibo 2.0 Dev"] },   // 2.582.0
  "z-image": { label: "Z-Image", category: "image", arch: "z-image", template: [] },
  chroma: { label: "Chroma", category: "image", arch: "flux", template: [] },
  hidream: { label: "HiDream", category: "image", arch: "", template: [] },
  sd3: { label: "SD 3", category: "image", arch: "", template: [] },
  wan: { label: "Wan", category: "video", kind: "video", template: ["Wan 2.2", "Wan 2.1"] },
  ltx: { label: "LTX", category: "video", kind: "video", template: ["LTX 2.5", "LTX 2.3"] },
  h3: { label: "MiniMax H3", category: "video", kind: "video", template: ["MiniMax H3 SS"] },
  hunyuan: { label: "Hunyuan Video", category: "video", kind: "video", template: [] },
  music: { label: "Music", category: "music", kind: "music", template: ["MiniMax Music3"] },
  other: { label: "Other", category: "image", arch: "", template: [] },
};
const CATEGORIES = ["image", "image edit", "video", "music"];

/** a Civitai baseModel ("SDXL 1.0", "Pony", "Flux.1 D", "Wan Video 2.2 T2V-A14B", ...) -> family | "" */
function baseFamily(b) {
  const s = String(b || "").toLowerCase();
  if (!s) return "";
  if (/pony/.test(s)) return "pony";
  if (/illustrious/.test(s)) return "illustrious";
  if (/noob/.test(s)) return "noobai";
  if (/^sd ?1\.[45]|^sd 1|sd1\.5/.test(s)) return "sd15";
  if (/sdxl|^sd ?xl/.test(s)) return "sdxl";
  if (/^sd ?3/.test(s)) return "sd3";
  if (/flux\.?\s?3/.test(s)) return "flux3";   // 2.538.0: before Klein - "Flux 3 Klein" is a Flux 3
  if (/flux\.?\s?2|klein/.test(s)) return "flux2";
  if (/krea/.test(s)) return "krea";
  if (/moss/.test(s)) return "moss";                 // 2.566.0: MOSS-Image
  if (/fibo/.test(s)) return "fibo";                 // 2.582.0: Bria Fibo 2.0
  if (/flux/.test(s)) return "flux";
  if (/qwen/.test(s)) return "qwen";
  if (/anima/.test(s)) return "anima";
  if (/z-?image|zimage/.test(s)) return "z-image";
  if (/chroma/.test(s)) return "chroma";
  if (/hidream/.test(s)) return "hidream";
  if (/wan/.test(s)) return "wan";
  if (/ltx/.test(s)) return "ltx";
  if (/hunyuan video|hunyuanvideo/.test(s)) return "hunyuan";
  if (/minimax|h3/.test(s)) return "h3";
  if (/ace|music|audio|yue/.test(s)) return "music";
  return "other";
}
/** from the file's name (+ its subfolder) -> family | "" */
function nameFamily(name) {
  const s = String(name || "").toLowerCase().replace(/\\/g, "/");
  if (/pony/.test(s)) return "pony";
  if (/illustrious|\billu|ilxl|\bil_/.test(s)) return "illustrious";
  if (/noob/.test(s)) return "noobai";
  if (/anima/.test(s)) return "anima";
  if (/moss[._ -]?image/.test(s)) return "moss";   // 2.566.0: moss_image_sft_int8_convrot ... (before qwen: its encoder is Qwen3.5)
  if (/fibo/.test(s)) return "fibo";               // 2.582.0: fibo2_edit_turbo-Q4_0.gguf, fibo2_dev_w4a8_convrot ...
  if (/krea/.test(s)) return "krea";
  if (/flux[._ -]?3|flux3/.test(s)) return "flux3";
  if (/flux[._ -]?2|flux2|klein/.test(s)) return "flux2";
  if (/flux|kontext/.test(s)) return "flux";
  if (/qwen/.test(s)) return "qwen";
  if (/z[-_ ]?image/.test(s)) return "z-image";
  if (/chroma/.test(s)) return "chroma";
  if (/hidream/.test(s)) return "hidream";
  if (/\bwan|wan2|wan_?2/.test(s)) return "wan";
  if (/ltx/.test(s)) return "ltx";
  if (/minimax|mmh3|\bh3[_-]/.test(s)) return "h3";
  if (/hunyuan/.test(s)) return "hunyuan";
  if (/ace[-_]?step|yue|music3|songgen/.test(s)) return "music";
  if (/sd[-_ ]?1[._-]?5|v1-5|sd15/.test(s)) return "sd15";
  if (/sd[-_ ]?3/.test(s)) return "sd3";
  if (/sdxl|[-_ ]xl[-_ .]|xl_|juggernaut|realvis/.test(s)) return "sdxl";
  return "";
}
/** a safetensors header {__metadata__, tensor names} -> family | "" ({keys: false} = its metadata only) */
function headerFamily(h, opt) {
  if (!h) return "";
  const m = h.meta || {};
  const arch = String(m["modelspec.architecture"] || "").toLowerCase();
  const base = String(m.ss_base_model_version || m["modelspec.implementation"] || "").toLowerCase();
  const cand = arch + " " + base + " " + String(m.ss_sd_model_name || "").toLowerCase();
  if (/pony/.test(cand)) return "pony";
  if (/illustrious/.test(cand)) return "illustrious";
  if (/flux[-_.]?2|klein/.test(cand)) return "flux2";
  if (/flux/.test(cand)) return "flux";
  if (/stable-diffusion-xl|sdxl/.test(cand)) return "sdxl";
  if (/stable-diffusion-v1|sd_v1|sd-v1/.test(cand)) return "sd15";
  if (/stable-diffusion-3|sd3/.test(cand)) return "sd3";
  if (/qwen/.test(cand)) return "qwen";
  if (/wan/.test(cand)) return "wan";
  if (/ltx/.test(cand)) return "ltx";
  if (opt && opt.keys === false) return "";
  const k = h.keys || [];
  const has = (re) => k.some((x) => re.test(x));
  if (has(/^conditioner\.embedders\.1\./)) return "sdxl";
  if (has(/^cond_stage_model\.transformer\./) && has(/^model\.diffusion_model\./)) return "sd15";
  if (has(/(^|\.)double_blocks\.\d+\./)) return "flux";
  if (has(/^lora_unet_input_blocks|lora_te2_/)) return "sdxl";
  if (has(/^lora_unet_double_blocks|lora_transformer_single_transformer_blocks/)) return "flux";
  if (has(/(^|\.)blocks\.\d+\.cross_attn\.k_img/)) return "wan";
  return "";
}
/** image / image edit / video / music */
function categoryOf(family, hints) {
  const f = FAMILIES[family] || FAMILIES.other;
  if (f.category !== "image") return f.category;
  const s = String((hints && hints.name) || "").toLowerCase() + " " + String((hints && hints.base_model) || "").toLowerCase();
  if (/edit|kontext|inpaint|[-_]fill\b|\bfill[-_]|instruct-?pix/.test(s)) return "image edit";
  return "image";
}
/** the family a card shows: your edit > Civitai's base model > the header > the name > the folder */
function familyOf(o) {
  const x = o || {};
  if (x.user && FAMILIES[x.user]) return x.user;
  const b = baseFamily(x.base_model); if (b) return b;
  const hm = headerFamily(x.header, { keys: false }), nm = nameFamily(x.name);
  // a generic header (SDXL / Flux / SD 1.5) loses to a more exact name: a Pony / Illustrious file IS an SDXL file
  const REFINES = { sdxl: ["pony", "illustrious", "noobai"], flux: ["flux2", "flux3", "krea", "chroma"], sd15: [] };
  if (hm && nm && (REFINES[hm] || []).includes(nm)) return nm;
  return hm || nm || headerFamily(x.header) || (x.gguf ? nameFamily(x.gguf) : "") || "other";
}

/* ---------------- headers */
/** the first bytes of a .safetensors -> {meta, keys} | null (pure: buf = the file's first up-to-N bytes, total = its size) */
function parseSafetensorsHeader(buf) {
  if (!buf || buf.length < 10) return null;
  const n = Number(buf.readBigUInt64LE(0));
  if (!(n > 1 && n < 100 * 1024 * 1024) || buf.length < 8 + n) return null;
  try {
    const j = JSON.parse(buf.slice(8, 8 + n).toString("utf8"));
    const meta = j.__metadata__ && typeof j.__metadata__ === "object" ? j.__metadata__ : {};
    const keys = Object.keys(j).filter((k) => k !== "__metadata__");
    return { meta, keys: keys.slice(0, 4000), nkeys: keys.length };
  } catch { return null; }
}
/** a GGUF file's first bytes -> general.architecture | "" (pure) */
function parseGgufArch(buf) {
  try {
    if (!buf || buf.length < 24 || buf.toString("latin1", 0, 4) !== "GGUF") return "";
    let o = 4;
    const ver = buf.readUInt32LE(o); o += 4;
    if (ver < 2) return "";
    o += 8;                                            // tensor count
    const kv = Number(buf.readBigUInt64LE(o)); o += 8;
    const str = () => { const l = Number(buf.readBigUInt64LE(o)); o += 8; const s = buf.toString("utf8", o, o + l); o += l; return s; };
    const SIZE = { 0: 1, 1: 1, 2: 2, 3: 2, 4: 4, 5: 4, 6: 4, 7: 1, 10: 8, 11: 8, 12: 8 };
    const skip = (t) => {
      if (SIZE[t] != null) { o += SIZE[t]; return; }
      if (t === 8) { str(); return; }
      if (t === 9) { const et = buf.readUInt32LE(o); o += 4; const c = Number(buf.readBigUInt64LE(o)); o += 8; for (let i = 0; i < c; i++) skip(et); return; }
      throw new Error("type " + t);
    };
    for (let i = 0; i < kv && o < buf.length - 12; i++) {
      const key = str(); const t = buf.readUInt32LE(o); o += 4;
      if (key === "general.architecture" && t === 8) return str();
      skip(t);
    }
  } catch { /* past the bytes we read */ }
  return "";
}
/** kohya's ss_tag_frequency -> the most used tags (a LoRA's keywords when Civitai does not know it) */
function topTags(meta, n) {
  let f = meta && meta.ss_tag_frequency;
  if (typeof f === "string") { try { f = JSON.parse(f); } catch { f = null; } }
  if (!f || typeof f !== "object") return [];
  const c = new Map();
  for (const set of Object.values(f)) if (set && typeof set === "object") for (const [t, k] of Object.entries(set)) c.set(t.trim(), (c.get(t.trim()) || 0) + (+k || 0));
  return [...c.entries()].filter(([t]) => t).sort((a, b) => b[1] - a[1]).slice(0, n || 8).map(([t]) => t);
}

/* ---------------- what other tools left beside it */
/** <stem>.civitai.info (the Civitai version JSON) / <stem>.metadata.json ({civitai: version}) / ours -> the fields a card uses */
function mergeInfo(v) {
  if (!v || typeof v !== "object") return {};
  const ver = v.civitai && typeof v.civitai === "object" && (v.civitai.modelId || v.civitai.id) ? v.civitai : v;
  if (!ver.modelId && !ver.baseModel && !ver.trainedWords && !ver.model) return {};
  const imgs = Array.isArray(ver.images) ? ver.images : [];
  const med = (k) => {
    const xs = imgs.map((i) => i && i.meta && +i.meta[k]).filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
    return xs.length ? xs[Math.floor(xs.length / 2)] : null;
  };
  const sampler = (() => { const m = imgs.find((i) => i && i.meta && i.meta.sampler); return m ? String(m.meta.sampler) : ""; })();
  const st = ver.stats || {}, mst = (ver.model && ver.model.stats) || {};
  const up = +(st.thumbsUpCount || mst.thumbsUpCount || 0), down = +(st.thumbsDownCount || mst.thumbsDownCount || 0);
  let rating = +(st.rating || mst.rating || 0), count = +(st.ratingCount || mst.ratingCount || 0);
  if (!(rating > 0) && up + down > 0) { rating = Math.round((up / (up + down)) * 50) / 10; count = up + down; }
  return {
    title: (ver.model && ver.model.name) ? String(ver.model.name) + (ver.name ? " · " + ver.name : "") : "",
    base_model: String(ver.baseModel || ""),
    description: textOf((ver.model && ver.model.description) || ver.description || ""),
    released: String(ver.publishedAt || ver.createdAt || "").slice(0, 10),
    rating: rating > 0 ? rating : null, rating_count: count || null,
    cfg: med("cfgScale"), steps: med("steps"), sampler,
    keywords: Array.isArray(ver.trainedWords) ? ver.trainedWords.map(String).filter(Boolean).slice(0, 30) : [],
    civitai: ver.modelId || ver.id ? { model_id: ver.modelId || null, version_id: ver.id || null,
      url: ver.modelId ? `https://civitai.com/models/${ver.modelId}${ver.id ? "?modelVersionId=" + ver.id : ""}` : "" } : null,
    model_type: String((ver.model && ver.model.type) || ""),
  };
}
/** Civitai's HTML description -> plain text (paragraphs kept; nothing executable ever reaches the page) */
function textOf(html) {
  return String(html || "").replace(/<\s*br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h\d)>/gi, "\n").replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n").trim().slice(0, 6000);
}

/* ---------------- a card */
const stemOf = (abs) => abs.replace(/\.[^./\\]+$/, "");
const sidecarPath = (abs) => stemOf(abs) + ".bitgen.json";
const thumbCandidates = (abs) => {
  const s = stemOf(abs), out = [];
  for (const e of [".preview.png", ".preview.jpg", ".preview.jpeg", ".preview.webp", ".png", ".jpg", ".jpeg", ".webp",
                   ".preview.gif", ".preview.mp4", ".preview.webm", ".gif"]) out.push(s + e);   // 2.581.0: + animated / video previews
  return out;
};
/** 2.581.0: a thumbnail file -> "video" (drawn as a looping muted <video>) | "image" (stills and animated GIF / WebP) (pure) */
const thumbKind = (f) => (/\.(mp4|webm|mov|m4v)$/i.test(String(f || "")) ? "video" : "image");
const USER_FIELDS = ["title", "user_rating", "family", "category", "model_type", "nsfw", "cfg", "steps", "vae", "te", "keywords", "description", "released"];
/* 2.575.0 (Tim: "also add model type(checkpoint/lora/etc) to modelmanager editor"): what KIND of file it is - its own
   field, apart from the family (Qwen, FLUX …); the default follows the folder ComfyUI found it in */
const MODEL_TYPES = ["Checkpoint", "Diffusion model", "LoRA", "LyCORIS / LoCon", "DoRA", "VAE", "Text encoder", "ControlNet", "Upscaler", "Embedding", "Motion module", "Other"];
const typeOf = (cat) => (cat === "loras" ? "LoRA" : cat === "diffusion_models" ? "Diffusion model" : "Checkpoint");
/** a rating -> 0..5 in half stars, null for none (pure) */
const halfStars = (v) => (v === "" || v == null || !Number.isFinite(+v) ? null : Math.max(0, Math.min(5, Math.round(+v * 2) / 2)));
/** f {cat, name, size, mtime}, header, gguf, info (merged other tools + ours), mine (our sidecar's `user`) -> card (pure) */
function cardFrom(f, header, gguf, info, mine) {
  const i = info || {}, u = mine || {};
  const base = i.base_model || "";
  const family = familyOf({ user: u.family, base_model: base, gguf, header, name: (f.cat || "") + "/" + (f.name || "") });
  const kind = f.cat === "loras" ? "lora" : "model";
  const file = String(f.name || "").split(/[\\/]/).pop();
  const fam = FAMILIES[family] || FAMILIES.other;
  const kwHeader = kind === "lora" && header ? topTags(header.meta, 8) : [];
  const num = (v) => (v === "" || v == null || !Number.isFinite(+v) ? null : +v);
  const card = {
    key: f.cat + "|" + f.name, kind, cat: f.cat, name: f.name, file, size: f.size || 0, mtime: f.mtime || 0,
    title: u.title || i.title || file.replace(/\.[^.]+$/, "").replace(/[_]+/g, " "),
    family, family_label: fam.label,
    category: CATEGORIES.includes(u.category) ? u.category : categoryOf(family, { name: f.name, base_model: base }),
    base_model: base,
    description: u.description != null && u.description !== "" ? String(u.description) : (i.description || ""),
    released: u.released || i.released || "",
    file_date: f.mtime ? new Date(f.mtime).toISOString().slice(0, 10) : "",
    rating: i.rating || null, rating_count: i.rating_count || null,
    user_rating: halfStars(u.user_rating),
    model_type: MODEL_TYPES.includes(u.model_type) ? u.model_type : typeOf(f.cat),
    nsfw: u.nsfw === true || (u.nsfw == null && i.nsfw === true),       // 2.575.0 (Tim: "add a nsfw checkbox to modelmanager editor and to the filter menu")
    cfg: num(u.cfg) != null ? num(u.cfg) : i.cfg != null ? i.cfg : null,
    steps: num(u.steps) != null ? num(u.steps) : i.steps != null ? i.steps : null,
    sampler: i.sampler || "",
    vae: u.vae || "", te: u.te || "",
    keywords: Array.isArray(u.keywords) && u.keywords.length ? u.keywords.map(String) : (i.keywords && i.keywords.length ? i.keywords : kwHeader),
    thumb: false, civitai: i.civitai || null, sha256: i.sha256 || "",
    source: i.civitai ? "civitai" : header || gguf ? "file" : "name",
    edited: Object.keys(u).some((k) => USER_FIELDS.includes(k)),
  };
  return card;
}

/* ---------------- styles */
/** the style a card's family renders with: a starter by name (GGUF -> its GGUF twin), else any style of the arch */
function templateFor(card, all) {
  const fam = FAMILIES[card && card.family] || FAMILIES.other;
  const kind = fam.kind || "image";
  const list = (all || []).filter((s) => (s.kind || "image") === kind);
  const gguf = /\.gguf$/i.test((card && card.name) || "");
  const names = (gguf && fam.gguf ? fam.gguf : []).concat(fam.template || []);
  for (const n of names) { const s = list.find((x) => x.name === n); if (s) return s; }
  if (card && card.category === "image edit") { const s = list.find((x) => fam.arch && x.arch === fam.arch && /edit/i.test(x.name)); if (s) return s; }
  if (fam.arch) { const s = list.find((x) => x.arch === fam.arch && !/edit|inpaint|img2img|fill/i.test(x.name)) || list.find((x) => x.arch === fam.arch); if (s) return s; }
  return null;
}
/** ✚ New style: the template copied with this model + these LoRAs -> {raw, template, notes} | {error} (pure) */
function styleFrom(card, opts, all) {
  const o = opts || {};
  if (!card || card.kind !== "model") return { error: "pick a model card first (a LoRA rides along with one)" };
  const tpl = o.template_id ? (all || []).find((s) => s.id === o.template_id) : templateFor(card, all);
  if (!tpl) return { error: `no style renders ${card.family_label} models here yet - pick a template style that does (its workflow is copied)` };
  const raw = JSON.parse(JSON.stringify(tpl));
  for (const k of ["id", "_file", "saved", "chain", "role"]) delete raw[k];
  const notes = [];
  raw.name = String(o.name || card.title || card.file).slice(0, 80);
  const loras = (o.loras || []).map((l) => ({ path: String(l.path || l.name || ""), weight: Number.isFinite(+l.weight) ? +l.weight : 1 })).filter((l) => l.path);
  const kind = tpl.kind || "image";
  if (kind === "video") {
    raw.phases = Array.isArray(raw.phases) && raw.phases.length ? raw.phases : [{ model: "", steps: null, cfg: null }];
    raw.phases[0] = Object.assign({}, raw.phases[0], { model: card.name });
    if (card.steps != null) raw.phases[0].steps = card.steps;
    if (card.cfg != null) raw.phases[0].cfg = card.cfg;
    if (raw.phases.length > 1) notes.push(`"${tpl.name}" has ${raw.phases.length} sampler phases - this model went into the first; set the others in Settings -> Video`);
    if (card.te) raw.te = [card.te];
  } else {
    raw.model = card.name;
    if (card.steps != null) raw.steps = Math.round(card.steps);
    if (card.cfg != null) raw.cfg = card.cfg;
    if (card.te) { const te = Array.isArray(raw.te) ? raw.te.slice() : []; te[0] = card.te; raw.te = te; }
    const sz = (FAMILIES[card.family] || {}).size;
    if (sz) { raw.width = sz; raw.height = sz; }
  }
  if (card.vae) raw.vae = card.vae;
  raw.loras = (Array.isArray(raw.loras) ? raw.loras : []).concat(loras).slice(0, 12);
  notes.unshift(`made from "${tpl.name}" (its workflow${kind === "image" ? ", text encoder, VAE, sampler and negative" : " and settings"})`);
  return { raw, template: { id: tpl.id, name: tpl.name, kind }, notes };
}

/* ---------------- live: the folders */
const headCache = new Map();
function readHead(abs, size, mtime) {
  const k = abs + "|" + size + "|" + mtime;
  if (headCache.has(k)) return headCache.get(k);
  let out = { header: null, gguf: "" };
  try {
    const fd = fs.openSync(abs, "r");
    try {
      const ext = path.extname(abs).toLowerCase();
      if (ext === ".gguf") {
        const b = Buffer.alloc(Math.min(size, 256 * 1024)); fs.readSync(fd, b, 0, b.length, 0);
        out.gguf = parseGgufArch(b);
      } else if (ext === ".safetensors" || ext === ".sft") {
        const h8 = Buffer.alloc(8); fs.readSync(fd, h8, 0, 8, 0);
        const n = Number(h8.readBigUInt64LE(0));
        if (n > 1 && n < 64 * 1024 * 1024 && n + 8 <= size) {
          const b = Buffer.alloc(8 + n); h8.copy(b); fs.readSync(fd, b, 8, n, 8);
          out.header = parseSafetensorsHeader(b);
        }
      }
    } finally { fs.closeSync(fd); }
  } catch { /* unreadable - the name decides */ }
  if (headCache.size > 4000) headCache.clear();
  headCache.set(k, out);
  return out;
}
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } }
function infoFor(abs, library) {
  const s = stemOf(abs);
  const ours = readJson(sidecarPath(abs)) || {};
  let info = mergeInfo(readJson(s + ".civitai.info")) || {};
  const lm = mergeInfo(readJson(s + ".metadata.json"));
  if (Object.keys(lm).length) info = Object.assign({}, info, lm);
  // 2.537.0: the shared model_info library (lib/modelInfo.js) - above other tools' files, below our own sidecar
  const li = library && library.status === "found" ? mergeInfo(library.civitai || null) : {};
  if (Object.keys(li).length) info = Object.assign({}, info, li);
  const mine = mergeInfo(ours.civitai || null);
  if (Object.keys(mine).length) info = Object.assign({}, info, mine);
  if (ours.sha256) info.sha256 = ours.sha256;
  return { info, user: ours.user || {}, ours };
}
function absOf(f) { return path.join(f.root, String(f.name).split(/[\\/]/).join(path.sep)); }

function comfyScan() {
  const core = require("./core"), comfyModels = require("./comfyModels");
  const c = (core.getConfig().engine || {}).comfy || {};
  // 2.622.0: Settings' folder, else the ComfyUI installed on this computer (lib/comfyDetect.js)
  const tgt = require("./comfyDetect").scanTarget(c);
  // 2.598.0: + the folders the running ComfyUI reports (lib/comfyFolders.js; the route asks it before listing)
  const sc = comfyModels.scan(tgt.dirAbs, { extraPaths: tgt.extraPaths, extraRoots: require("./comfyFolders").cached().roots });
  if (tgt.detected) sc.detected = { root: tgt.detected.root, kind: tgt.detected.kind, source: tgt.detected.source };
  return sc;
}
let cache = null;
/** every model + LoRA card (30 s cache; refresh = rescan) */
function list(opts) {
  const o = opts || {};
  // 2.522.0: the cache belongs to ONE ComfyUI folder - a changed folder (Settings, a test's fixture) scans again
  let key = "";
  try { const c = (require("./core").getConfig().engine || {}).comfy || {}; key = String(c.dir || "") + "|" + String(c.extra_paths || ""); if (!c.dir) { const d = require("./comfyDetect").detect(); key += "|" + (d ? d.root : ""); } } catch { key = ""; }
  const live = o.live || require("./comfyFolders").cached();             // 2.598.0: the running ComfyUI's folders + lists
  key += "|" + (live.at || 0);
  if (!o.refresh && !o.scan && cache && cache.key === key && Date.now() - cache.at < 30000) return cache.data;
  const sc = o.scan || comfyScan();
  const cats = sc.categories || {};
  const out = { models: [], loras: [], vae: [], te: [], warnings: (sc.warnings || []).slice(0, 20), dir: sc.dir || "" };
  if (sc.detected) { out.detected = sc.detected; out.warnings.unshift("ComfyUI found at " + sc.detected.root + " (" + sc.detected.source + ") - its checkpoints and diffusion models are listed; set it in Settings ▸ ComfyUI ▸ Folder to keep it"); }
  for (const cat of ["checkpoints", "diffusion_models", "loras"]) {
    for (const f of ((cats[cat] || {}).files || [])) {
      if (f.dir || !f.root) continue;
      const abs = absOf(f);
      let mtime = 0; try { mtime = fs.statSync(abs).mtimeMs; } catch { /* raced */ }
      let lib = null;
      try { lib = require("./modelInfo").infoFor({ kind: cat === "loras" ? "lora" : "model", name: f.name, size: f.size }); } catch { lib = null; }
      const { info, user } = infoFor(abs, lib);
      const known = info && (info.base_model || info.civitai);
      const h = known ? { header: null, gguf: "" } : readHead(abs, f.size || 0, mtime);
      const card = cardFrom({ cat, name: f.name, size: f.size, mtime }, h.header, h.gguf, info, user);
      let mine = null; try { mine = require("./modelMedia").list(card); } catch { mine = null; }       // 2.575.0: your thumbnail + files
      const beside = mine && mine.thumb ? "" : thumbCandidates(abs).find((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } }) || "";
      card.thumb = !!(mine && mine.thumb) || !!beside || !!(lib && lib.thumb);
      card.media = mine ? mine.items.length : 0;
      card.thumb_v = mine && mine.thumb ? mine.thumb : !beside && lib && lib.thumb ? lib.thumb + "." + (lib.fetched_at || 0) : "";
      card.thumb_kind = thumbKind((mine && mine.thumb) || beside || (lib && lib.thumb) || "");      // 2.581.0
      card.info_status = lib ? lib.status || "" : "";                            // 2.537.0: found | nomatch | ""
      card.examples = lib && Array.isArray(lib.examples) ? lib.examples.length : 0;
      card.folder = folderOf(f.name);
      (cat === "loras" ? out.loras : out.models).push(card);
    }
  }
  // 2.598.0: every model / LoRA the running ComfyUI offers in its dropdowns gets a card, even when its file is not
  // where this computer can read it (a name-only card: no size, no header - its type from the name / Civitai)
  const norm = (n) => String(n).replace(/\\/g, "/").toLowerCase();
  const have = new Set(out.models.concat(out.loras).map((c) => (c.cat || "") + "|" + norm(c.name)));
  for (const cat of ["checkpoints", "diffusion_models", "loras"]) {
    for (const name of ((live.names || {})[cat] || [])) {
      if (have.has(cat + "|" + norm(name))) continue;
      have.add(cat + "|" + norm(name));
      let lib = null;
      try { lib = require("./modelInfo").infoFor({ kind: cat === "loras" ? "lora" : "model", name, size: 0 }); } catch { lib = null; }
      const li = lib && lib.status === "found" ? mergeInfo(lib.civitai || null) : {};
      const card = cardFrom({ cat, name, size: 0, mtime: 0 }, null, "", li, {});
      card.thumb = !!(lib && lib.thumb); card.thumb_v = lib && lib.thumb ? lib.thumb + "." + (lib.fetched_at || 0) : ""; card.thumb_kind = thumbKind((lib && lib.thumb) || "");
      card.media = 0; card.info_status = lib ? lib.status || "" : ""; card.examples = lib && Array.isArray(lib.examples) ? lib.examples.length : 0;
      card.folder = folderOf(name); card.on_disk = false;
      (cat === "loras" ? out.loras : out.models).push(card);
    }
  }
  if ((live.roots || []).length) out.comfy_roots = live.roots.length;
  out.vae = ((cats.vae || {}).files || []).map((f) => f.name);
  out.te = ((cats.text_encoders || {}).files || []).map((f) => f.name);
  cache = { at: Date.now(), data: out, scan: sc, key };
  return out;
}
/** key "cat|name" -> {card, abs} (only names the scan found - never a path from the request) */
function find(key) {
  const d = list();
  const card = d.models.concat(d.loras).find((c) => c.key === key);
  if (!card) return null;
  const sc = cache && cache.scan;
  const f = (((sc && sc.categories) || {})[card.cat] || {}).files || [];
  const hit = f.find((x) => x.name === card.name);
  return hit ? { card, abs: absOf(hit) } : null;
}
function thumbFile(key) {
  const h = find(key); if (!h) return null;
  try { const mine = require("./modelMedia").thumbPath(h.card); if (mine) return mine; } catch { /* 2.575.0: your thumbnail first */ }
  const beside = thumbCandidates(h.abs).find((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } });
  if (beside) return beside;
  try { return require("./modelInfo").thumbPath(h.card); } catch { return null; }     // 2.537.0: the model_info library
}
/** 2.537.0: the folder a model sits in under its category - "checkpoints/SDXL/x.safetensors" -> "SDXL" (pure) */
function folderOf(name) {
  const parts = String(name || "").split(/[\\/]/).filter(Boolean);
  return parts.length > 1 ? parts[0] : "";
}
/** 2.537.0: the folder tabs - every first-level folder of these cards, case-insensitive, with counts (pure) */
function folderTabs(list) {
  const m = new Map();
  for (const c of list || []) {
    const f = c.folder != null ? c.folder : folderOf(c.name);
    if (!f) continue;
    const k = f.toLowerCase();
    if (!m.has(k)) m.set(k, { id: k, label: f, count: 0 });
    m.get(k).count++;
  }
  return [...m.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}
/** 2.537.0: the cards THIS project used - its jobs' models / LoRAs (by file name) (pure) */
function usedKeys(cards, jobs) {
  const want = new Set();
  const add = (n) => { const b = String(n || "").split(/[\\/]/).pop().toLowerCase(); if (b) want.add(b); };
  for (const j of jobs || []) {
    const m = (j && j.meta) || {};
    for (const x of m.models || []) add(typeof x === "string" ? x : x && (x.name || x.model));
    for (const x of m.loras || []) add(typeof x === "string" ? x : x && (x.name || x.lora || x.path));
    const p = (j && j.params) || {};
    add(p.model); add(p.ckpt); add(p.checkpoint);
  }
  return (cards || []).filter((c) => want.has(String(c.file || "").toLowerCase())).map((c) => c.key);
}
/** ✎ the card: your fields into <stem>.bitgen.json `user` ("" / null clears one) */
function edit(key, fields) {
  const h = find(key); if (!h) return { error: "no such model" };
  const p = sidecarPath(h.abs), cur = readJson(p) || {};
  const u = Object.assign({}, cur.user || {});
  for (const k of USER_FIELDS) {
    if (!(k in (fields || {}))) continue;
    let v = fields[k];
    if (k === "keywords") v = (Array.isArray(v) ? v : String(v || "").split(",")).map((x) => String(x).trim()).filter(Boolean).slice(0, 40);
    else if (k === "user_rating") v = halfStars(v);                        // 2.575.0: half stars
    else if (k === "model_type") v = MODEL_TYPES.includes(v) ? v : "";
    else if (k === "nsfw") v = v === true || v === "true" || v === 1 || v === "1" || v === "on" ? true : "";
    else if (["cfg", "steps"].includes(k)) v = v === "" || v == null ? null : Math.max(0, Math.min(k === "steps" ? 200 : 30, +v || 0));
    else v = v == null ? "" : String(v).slice(0, k === "description" ? 6000 : 300);
    if (v === "" || v == null || (Array.isArray(v) && !v.length)) delete u[k]; else u[k] = v;
  }
  cur.v = 1; cur.user = u;
  try { fs.writeFileSync(p, JSON.stringify(cur, null, 2)); } catch (e) { return { error: "could not write " + path.basename(p) + ": " + e.message }; }
  cache = null;
  return { ok: true, card: find(key) && find(key).card };
}
/** our sidecar's civitai block (lib/civitai.js) */
function writeCivitai(abs, version, extra) {
  const p = sidecarPath(abs), cur = readJson(p) || {};
  cur.v = 1; cur.civitai = version; Object.assign(cur, extra || {});
  fs.writeFileSync(p, JSON.stringify(cur, null, 2));
  cache = null;
}
function invalidate() { cache = null; }

module.exports = { invalidate: () => { cache = null; }, MODEL_TYPES, typeOf, halfStars, FAMILIES, CATEGORIES, USER_FIELDS, baseFamily, nameFamily, headerFamily, categoryOf, familyOf, parseSafetensorsHeader,
  parseGgufArch, topTags, mergeInfo, textOf, cardFrom, templateFor, styleFrom, sidecarPath, thumbCandidates, stemOf,
  thumbKind, list, find, thumbFile, edit, writeCivitai, invalidate, readHead, absOf, comfyScan, folderOf, folderTabs, usedKeys };
