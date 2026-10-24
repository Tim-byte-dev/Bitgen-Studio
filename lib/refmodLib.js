// bitGen Studio — lib/refmodLib.js (2.588.0): THE REFMOD LIBRARY - reference mods every project can use.
//
// Tim (verbatim): "in the lora docker add an option for refmod - create remod\refmod name folder in root so all projects
// can use it . store datasets and safetensors here. allow user to upload media and sort it into the appropriate
// folder.use vision model for autocaption if user clicks autocaption button. allow user to choose refmod as character
// reference or location or vehicle or object or prop or flora or animal."
//
// A RefMod is MiniMax H3's no-training reference mod (ComfyUI-MiniMaxH3Mod, pinned in lib/refmods.js): the pictures
// are VAE-encoded once into a small .safetensors that a render loads instead of spending reference slots. 2.225.0 made
// one per character (the character creator); this is the LIBRARY - any subject, outside the projects:
//   <app>/refmod/<name>/meta.json            {name, type, description, mod, created, updated, extracted}
//   <app>/refmod/<name>/images|videos|audio/  the dataset - an upload is sorted by what it is; a caption is <file>.txt
//   <app>/refmod/<name>/frames/               pictures taken from the videos for the extraction (made on 🧬 Extract)
//   <app>/refmod/<name>/<mod>.safetensors     the mod (copied here from ComfyUI's models/refmods after the job - and
//                                             back into ComfyUI when a render needs it and ComfyUI does not have it)
// The pack's Extract node takes PICTURES (refs_image, up to 16 - verified); a video gives frames, a sound is kept with
// the dataset (the verified node has no audio input). The TYPE goes into the mod's description (the verified
// concept_type is "identity" - the pack's other values were never checked, so they are not sent).
// A render uses a mod by its name in the prompt: @name (lib: forPrompt) - MiniMax H3 renders (References / First-last
// frame) splice it in before the sampler (worker.py _apply_refmods), the @ is taken out of the prompt.
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const RM = require("./refmods");

const TYPES = [
  { id: "character", icon: "🧑", label: "Character reference", words: "a character - the same person, face, body and clothes" },
  { id: "location", icon: "🏞", label: "Location", words: "a location - the same place, its layout, materials and light" },
  { id: "vehicle", icon: "🚗", label: "Vehicle", words: "a vehicle - the same make, shape, colours and details" },
  { id: "object", icon: "📦", label: "Object", words: "an object - the same shape, material and markings" },
  { id: "prop", icon: "🪄", label: "Prop", words: "a prop - the same item a character holds or uses" },
  { id: "flora", icon: "🌿", label: "Flora", words: "flora - the same plants, trees or flowers" },
  { id: "animal", icon: "🐾", label: "Animal", words: "an animal - the same creature, its markings and build" },
];
const KINDS = ["images", "videos", "audio"];
const EXT = {
  images: [".png", ".jpg", ".jpeg", ".webp", ".bmp"],
  videos: [".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v", ".gif"],
  audio: [".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac", ".opus"],
};
const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".bmp": "image/bmp" };

let BASE = null;
const base = () => BASE || require("./core").BASE;
const root = () => path.join(base(), "refmod");
const setBase = (b) => { BASE = b; };

/** a folder name: letters, digits, space, _ and - (never a path or a device name) */
function safeName(n) {
  const s = String(n || "").replace(/\.[a-z0-9]{1,5}$/i, "").replace(/[\\/:*?"<>|]+/g, "_").replace(/[^\p{L}\p{N} _-]+/gu, "").replace(/\s+/g, " ").replace(/^[\s_-]+|[\s_-]+$/g, "").slice(0, 60);
  return /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(s) ? "" : s;
}
/** the @tag of a mod: letters / digits / _ (the prompt's word) */
const tagOf = (name) => String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
/** the mod's file name (the pack's dropdown shows it): bitgen_<type>_<tag> */
const modNameOf = (name, type) => "bitgen_" + (TYPES.some((t) => t.id === type) ? type + "_" : "") + (tagOf(name) || "refmod");
const typeOf = (id) => TYPES.find((t) => t.id === id) || TYPES[0];
/** what folder a file goes in -> images | videos | audio | null */
function kindOf(file, mime) {
  const e = path.extname(String(file || "")).toLowerCase();
  for (const k of KINDS) if (EXT[k].includes(e)) return k;
  const m = String(mime || "");
  if (/^image\/gif/.test(m)) return "videos";
  if (/^image\//.test(m)) return "images";
  if (/^video\//.test(m)) return "videos";
  if (/^audio\//.test(m)) return "audio";
  return null;
}
const safeFile = (f) => { const b = path.basename(String(f || "")).replace(/[\\/:*?"<>|]+/g, "_").replace(/^\.+/, "").slice(0, 120); return b && !/\.txt$/i.test(b) ? b : ""; };
const dirOf = (name) => { const n = safeName(name); if (!n) { const e = new Error("a RefMod needs a name"); e.status = 400; throw e; } return path.join(root(), n); };
const readJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } };
const notFound = (name) => { const e = new Error(`no RefMod "${name}"`); e.status = 404; return e; };

function meta(name) {
  const d = dirOf(name);
  const m = readJson(path.join(d, "meta.json"), null);
  if (!m) return null;
  return Object.assign({ name: path.basename(d), type: "character", description: "" }, m, { name: path.basename(d) });
}
function writeMeta(m) {
  const d = dirOf(m.name);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, "meta.json"), JSON.stringify(Object.assign({}, m, { updated: Date.now() }), null, 1));
}

function create(name, type, description) {
  const n = safeName(name);
  if (!n) { const e = new Error("a RefMod needs a name (letters, digits, spaces)"); e.status = 400; throw e; }
  if (meta(n)) { const e = new Error(`there is already a RefMod "${n}"`); e.status = 409; throw e; }
  const t = typeOf(type).id;
  const d = dirOf(n);
  for (const k of KINDS) fs.mkdirSync(path.join(d, k), { recursive: true });
  const m = { name: n, type: t, description: String(description || "").slice(0, 300), mod: modNameOf(n, t), created: Date.now() };
  writeMeta(m);
  return info(n);
}
function update(name, patch) {
  const m = meta(name); if (!m) throw notFound(name);
  const p = patch || {};
  if (p.type != null && typeOf(p.type).id !== m.type) {
    // the mod's name says its type (bitgen_<type>_<tag>) - a mod already made is renamed with it (extract again for ComfyUI)
    const old = modFile(m);
    m.type = typeOf(p.type).id; m.mod = modNameOf(m.name, m.type);
    try { if (fs.existsSync(old)) fs.renameSync(old, modFile(m)); } catch { /* kept under its old name */ }
  }
  if (p.description != null) m.description = String(p.description).slice(0, 300);
  writeMeta(m);
  return info(m.name);
}
function remove(name) {
  const d = dirOf(name);
  if (!fs.existsSync(path.join(d, "meta.json"))) throw notFound(name);
  fs.rmSync(d, { recursive: true, force: true });
  return { removed: path.basename(d) };
}

function media(name) {
  const d = dirOf(name), out = {};
  for (const k of KINDS) {
    let fl = [];
    try { fl = fs.readdirSync(path.join(d, k)).filter((f) => !f.startsWith(".") && EXT[k].includes(path.extname(f).toLowerCase())).sort(); } catch { fl = []; }
    out[k] = fl.map((f) => {
      let cap = ""; try { cap = fs.readFileSync(path.join(d, k, f.replace(/\.[^.]+$/, ".txt")), "utf8").trim(); } catch { cap = ""; }
      let size = 0; try { size = fs.statSync(path.join(d, k, f)).size; } catch { size = 0; }
      return { file: f, caption: cap, size };
    });
  }
  return out;
}
const modFile = (m) => path.join(dirOf(m.name), m.mod + ".safetensors");
function info(name) {
  const m = meta(name); if (!m) throw notFound(name);
  const md = media(m.name);
  let size = 0; try { size = fs.statSync(modFile(m)).size; } catch { size = 0; }
  return Object.assign({}, m, { tag: "@" + tagOf(m.name), media: md, counts: { images: md.images.length, videos: md.videos.length, audio: md.audio.length },
    uncaptioned: KINDS.reduce((s, k) => s + md[k].filter((x) => !x.caption).length, 0), has_mod: size > 0, mod_size: size, folder: path.join("refmod", m.name) });
}
function list() {
  let names = [];
  try { names = fs.readdirSync(root()).filter((n) => fs.existsSync(path.join(root(), n, "meta.json"))); } catch { names = []; }
  return names.map((n) => { const i = info(n); return { name: i.name, type: i.type, tag: i.tag, counts: i.counts, has_mod: i.has_mod, mod: i.mod, description: i.description }; })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** uploads -> sorted into images / videos / audio; a .txt with the same name is that file's caption */
function addFiles(name, files) {
  const m = meta(name); if (!m) throw notFound(name);
  const d = dirOf(m.name), added = [], refused = [], caps = [];
  for (const f of files || []) {
    const orig = safeFile(f.originalname || f.name);
    if (/\.txt$/i.test(String(f.originalname || f.name || ""))) { caps.push(f); continue; }
    const k = orig ? kindOf(orig, f.mimetype) : null;
    if (!k || !(f.buffer || f.path)) { refused.push(String(f.originalname || f.name || "?")); if (f.path) fs.rmSync(f.path, { force: true }); continue; }
    fs.mkdirSync(path.join(d, k), { recursive: true });
    let fn = orig, i = 2;
    const stem = orig.replace(/\.[^.]+$/, ""), ext = path.extname(orig) || (k === "images" ? ".png" : k === "videos" ? ".mp4" : ".wav");
    while (fs.existsSync(path.join(d, k, fn))) fn = `${stem}_${i++}${ext}`;
    if (f.buffer) fs.writeFileSync(path.join(d, k, fn), f.buffer);
    else { try { fs.renameSync(f.path, path.join(d, k, fn)); } catch { fs.copyFileSync(f.path, path.join(d, k, fn)); fs.rmSync(f.path, { force: true }); } }   // a big video: multer's temp file
    added.push({ kind: k, file: fn, from: orig });
  }
  // the captions that came along (picture.png + picture.txt - a dataset from another tool)
  let captioned = 0;
  for (const c of caps) {
    const stem = path.basename(String(c.originalname || c.name || "")).replace(/\.txt$/i, "");
    const hit = added.find((a) => a.from.replace(/\.[^.]+$/, "") === stem);
    let txt = ""; try { txt = c.buffer ? String(c.buffer) : fs.readFileSync(c.path, "utf8"); } catch { txt = ""; }
    if (c.path) fs.rmSync(c.path, { force: true });
    if (hit) { setCaption(m.name, hit.kind, hit.file, txt); captioned++; }
  }
  return { added, refused, captioned, info: info(m.name) };
}
function fileIn(name, kind, file) {
  if (!KINDS.includes(kind)) { const e = new Error("kind is images, videos or audio"); e.status = 400; throw e; }
  const f = safeFile(file); if (!f) { const e = new Error("no such file"); e.status = 400; throw e; }
  return path.join(dirOf(name), kind, f);
}
function setCaption(name, kind, file, text) {
  const p = fileIn(name, kind, file);
  if (!fs.existsSync(p)) throw notFound(name + "/" + file);
  const t = String(text || "").replace(/\r/g, "").trim().slice(0, 2000);
  const cp = p.replace(/\.[^.]+$/, ".txt");
  if (t) fs.writeFileSync(cp, t); else fs.rmSync(cp, { force: true });
  return { ok: true, caption: t };
}
function removeFile(name, kind, file) {
  const p = fileIn(name, kind, file);
  fs.rmSync(p, { force: true }); fs.rmSync(p.replace(/\.[^.]+$/, ".txt"), { force: true });
  return { ok: true };
}

/* ---------------- ✨ autocaption (the vision model) */
const CAP = { busy: false, done: 0, total: 0, skipped: 0, error: "", name: "" };
function captionPrompt(type, kind) {
  const t = typeOf(type);
  return `This ${kind === "videos" ? "is a frame of a video of" : "picture shows"} ${t.words.split(" - ")[0]} for a reference library (${t.label}). `
    + `Describe it in one plain sentence: what it is, its look (shape, colours, materials, markings${t.id === "character" ? ", face, hair, clothes" : ""}), the view and the light. No preamble.`;
}
/** a frame of a video as a picture (ffmpeg) -> the png's path or null */
function frameOf(video, out, at) {
  const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-ss", String(at || 0), "-i", video, "-frames:v", "1", out], { timeout: 120000 });
  return r.status === 0 && fs.existsSync(out) ? out : null;
}
function autoCaption(name, overwrite, deps) {
  if (CAP.busy) { const e = new Error("captioning is already running"); e.status = 409; throw e; }
  const m = meta(name); if (!m) throw notFound(name);
  const d = deps || {};
  const md = media(m.name);
  const todo = [].concat(md.images.map((x) => ({ kind: "images", it: x })), md.videos.map((x) => ({ kind: "videos", it: x })))
    .filter((x) => overwrite || !x.it.caption);
  const skipped = md.audio.filter((x) => overwrite || !x.caption).length;
  Object.assign(CAP, { busy: true, done: 0, total: todo.length, skipped, error: "", name: m.name });
  const run = (async () => {
    const C = d.core || require("./core"), cap = d.captioner || require("./captioner");
    const tmp = path.join(dirOf(m.name), "frames", ".cap");
    for (const x of todo) {
      try {
        let p = path.join(dirOf(m.name), x.kind, x.it.file), mt = MIME[path.extname(p).toLowerCase()] || "image/png";
        if (x.kind === "videos") {
          fs.mkdirSync(tmp, { recursive: true });
          let dur = null; try { dur = C.probeDuration ? C.probeDuration(p) : null; } catch { dur = null; }
          p = (d.frameOf || frameOf)(p, path.join(tmp, x.it.file + ".png"), dur ? Math.min(dur / 2, 3) : 0.5);
          mt = "image/png";
          if (!p) throw new Error(`could not take a frame of ${x.it.file} (ffmpeg)`);
        }
        const r = await cap.describe(C, [{ path: p, mimetype: mt, max_tokens: 160, prompt: captionPrompt(m.type, x.kind) }]);
        const text = String((Array.isArray(r) ? r[0] : r) || "").replace(/\s+/g, " ").trim();
        if (text) setCaption(m.name, x.kind, x.it.file, text);
      } catch (e) { CAP.error = String(e.message || e); }
      CAP.done++;
    }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ }
    CAP.busy = false;
  })();
  if (d.wait) return run.then(() => captionState());
  return captionState();
}
function captionState() { return Object.assign({}, CAP); }

/* ---------------- 🧬 extraction */
/** the pictures the Extract node gets: the images first, then frames from each video (evenly), max 16 */
function extractFiles(name, deps) {
  const m = meta(name); if (!m) throw notFound(name);
  const d = deps || {};
  const md = media(m.name), dir = dirOf(m.name);
  const pics = md.images.map((x) => path.join(dir, "images", x.file)).slice(0, RM.MAX_REFS);
  const notes = [];
  if (md.images.length > RM.MAX_REFS) notes.push(`${md.images.length - RM.MAX_REFS} picture(s) beyond the pack's ${RM.MAX_REFS}-picture limit stay out`);
  const room = RM.MAX_REFS - pics.length;
  if (md.videos.length && room > 0) {
    const fd = path.join(dir, "frames");
    fs.rmSync(fd, { recursive: true, force: true }); fs.mkdirSync(fd, { recursive: true });
    const per = Math.max(1, Math.floor(room / md.videos.length));
    let left = room;
    for (const v of md.videos) {
      if (left <= 0) break;
      const vp = path.join(dir, "videos", v.file);
      let dur = null; try { dur = (d.probe || require("./core").probeDuration)(vp); } catch { dur = null; }
      const n = Math.min(per + (v === md.videos[md.videos.length - 1] ? left - per : 0), left);
      for (let i = 0; i < n; i++) {
        const at = dur ? (dur * (i + 0.5)) / n : i * 0.5;
        const out = (d.frameOf || frameOf)(vp, path.join(fd, `${v.file.replace(/\.[^.]+$/, "")}_${String(i + 1).padStart(2, "0")}.png`), at);
        if (out) { pics.push(out); left--; }
      }
    }
    notes.push(`${pics.length - Math.min(md.images.length, RM.MAX_REFS)} frame(s) from ${md.videos.length} video(s)`);
  } else if (md.videos.length) notes.push(`the videos stay out - ${RM.MAX_REFS} pictures fill the pack's slots`);
  if (md.audio.length) notes.push(`${md.audio.length} sound(s) stay with the dataset - the RefMod node takes pictures (no audio input)`);
  return { files: pics, notes };
}
function descriptionOf(m, md) {
  const t = typeOf(m.type);
  const caps = [].concat(md.images, md.videos).map((x) => x.caption).filter(Boolean);
  return [`${t.label}: ${m.name}`, m.description, caps[0] || ""].filter(Boolean).join(". ").slice(0, 300);
}
/** the queue job's params for 🧬 Extract (core.makeJob) */
function extractJob(name, deps) {
  const m = meta(name); if (!m) throw notFound(name);
  const ex = extractFiles(m.name, deps);
  if (!ex.files.length) { const e = new Error(`${m.name} has no pictures yet - add pictures or a video (＋ Media…)`); e.status = 400; throw e; }
  const built = RM.extractGraph(m.name, ex.files, { name: m.mod, description: descriptionOf(m, media(m.name)) });
  return {
    params: { mode: "graph", graph: built.graph, graph_name: "RefMod extract: " + m.name, graph_file: `(built from refmod/${m.name})`, graph_uploads: built.uploads,
      graph_applied: [`mod "${built.name}" (${typeOf(m.type).label}) ← ${built.uploads.length} picture(s), Full Reference @1024 - saves to ComfyUI's models/refmods/, then into refmod/${m.name}/`],
      graph_warnings: ex.notes, seed: -1, prompt: "", refmod_lib: m.name, no_assets: true },   // its preview picture is not a project asset
    mod: built.name, pictures: built.uploads.length, notes: ex.notes,
  };
}
const comfyMods = (comfyDir) => path.join(comfyDir, "models", "refmods");
/** after the job: ComfyUI's models/refmods/<mod>.safetensors -> refmod/<name>/ (the library keeps it) */
function adopt(name, comfyDir) {
  const m = meta(name); if (!m) throw notFound(name);
  if (!comfyDir) { const e = new Error("no ComfyUI folder is configured or found (Settings ▸ ComfyUI) - the mod cannot be fetched"); e.status = 400; throw e; }
  const src = RM.modPath(comfyDir, m.mod);
  if (!fs.existsSync(src)) { const e = new Error(`the extraction finished but ${src} is not there - see the job log (the pack may have refused the save, or ComfyUI runs from another folder)`); e.status = 404; throw e; }
  fs.copyFileSync(src, modFile(m));
  m.extracted = { at: Date.now(), size: fs.statSync(src).size };
  writeMeta(m);
  return { ok: true, mod: m.mod, file: path.join("refmod", m.name, m.mod + ".safetensors"), size: m.extracted.size };
}
/** a mod the library has, into ComfyUI when it is not there (a fresh ComfyUI, another PC) -> true when it is there */
function ensureInComfy(m, comfyDir) {
  if (!comfyDir) return false;
  const dst = RM.modPath(comfyDir, m.mod);
  if (fs.existsSync(dst)) return true;
  const src = modFile(m);
  if (!fs.existsSync(src)) return false;
  try { fs.mkdirSync(comfyMods(comfyDir), { recursive: true }); fs.copyFileSync(src, dst); return true; } catch { return false; }
}
/** the @tags in a prompt -> {mods: [mod names], prompt (the @ taken out), used: [{tag, name, mod}], notes} */
function forPrompt(prompt, comfyDir) {
  const p = String(prompt || "");
  const out = { mods: [], prompt: p, used: [], notes: [] };
  if (!/@[A-Za-z0-9_]/.test(p)) return out;
  const lib = list();
  if (!lib.length) return out;
  const byTag = new Map(lib.map((x) => [x.tag.slice(1), x]));
  out.prompt = p.replace(/@([A-Za-z0-9_]+)/g, (all, t) => {
    const x = byTag.get(t.toLowerCase());
    if (!x) return all;
    if (!out.used.some((u) => u.name === x.name)) {
      if (!x.has_mod) out.notes.push(`@${t}: ${x.name} has no mod yet - 🧬 Extract it in the 🎓 docker ▸ 🧬 RefMods`);
      else if (out.mods.length >= RM.MAX_MOD_SLOTS) out.notes.push(`@${t}: more than ${RM.MAX_MOD_SLOTS} RefMods - the loader has ${RM.MAX_MOD_SLOTS} slots`);
      else {
        const m = meta(x.name);
        if (comfyDir && !ensureInComfy(m, comfyDir)) out.notes.push(`@${t}: could not copy ${m.mod} into ComfyUI's models/refmods`);
        out.mods.push(m.mod); out.used.push({ tag: "@" + t, name: x.name, mod: m.mod });
      }
    }
    return t.replace(/_/g, " ");
  });
  return out;
}

module.exports = { TYPES, KINDS, EXT, setBase, root, safeName, tagOf, modNameOf, typeOf, kindOf, meta, create, update, remove, media, info, list,
  addFiles, setCaption, removeFile, fileIn, captionPrompt, autoCaption, captionState, extractFiles, extractJob, descriptionOf, adopt, ensureInComfy, forPrompt, modFile };
