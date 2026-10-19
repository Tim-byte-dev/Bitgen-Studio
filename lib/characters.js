// bitGen Studio — characters: the profile store, and the reference chain the
// MM3_Characters style is built from.
//
// ON DISK (one folder per character, so a character is a thing you can copy,
// back up or hand to someone):
//
//   projects/<project>/characters/<name>/<name>.profile   JSON: the facts
//   projects/<project>/characters/<name>/<image files>    the character sheet
//   projects/<project>/characters/<name>/<audio files>    the voice reference
//
// The .profile is JSON on purpose: the LLM reads it directly to learn who the
// character is, so it has to be something a model can parse without a parser of
// ours in the middle.
//
// IN THE GRAPH. MM3_Characters.json wires its references as a linked CHAIN -
// each MiniMaxH3Scheduled*Reference points at the one before through `previous`,
// and the LAST one feeds MiniMaxH3ScheduledReferenceToVideo.reference_schedule.
// Pictures and voices share the one chain. buildChain() rebuilds that chain from
// whatever characters the user has, which is what MM3_Characters_tmp.json is:
// the style, plus this session's character nodes, never edited by hand.
const fs = require("fs");
const path = require("path");
const core = require("./core");

const PROFILE_EXT = ".profile";
const IMG = [".png", ".jpg", ".jpeg", ".webp", ".bmp"];
const AUD = [".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac"];

/** Safe folder name: a character name is user text and becomes a path. */
function slug(name) {
  return String(name || "").trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, " ").slice(0, 64).trim();
}

/**
 * A STABLE reference tag (2.145.0, from a live node error on Tim's machine:
 * "Reference tag must be a stable tag such as 'hero_face' or '@hero-face'").
 * The Scheduled*Reference pack validates its tag widget: lowercase word
 * characters and hyphens only, no spaces. Everything else becomes "_", runs
 * collapse, edges trim; an empty result falls back to "ref" because a
 * reference with no tag is a reference nothing can address.
 */
function tagOf(name) {
  return String(name || "").toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_").replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "").slice(0, 64) || "ref";
}

function charsRoot(project) {
  return path.join(core.projDir(project || core.getProject()), "characters");
}

/** 2.216.0 (by instruction): every character gets a unique id, and the id IS
 *  the folder name — projects/<p>/characters/<id>/. */
function newId() {
  return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function _readProfileFile(dir) {
  try {
    const f = fs.readdirSync(dir).find((x) => x.endsWith(PROFILE_EXT));
    if (!f) return null;
    const p = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    return { ...blank(p.name || f.slice(0, -PROFILE_EXT.length)), ...p,
             name: slug(p.name || f.slice(0, -PROFILE_EXT.length)) };
  } catch { return null; }
}

/**
 * The one reader of the characters root: [{dir, profile}] for every folder
 * holding a profile. Pre-2.216.0 folders were named by SLUG — they are
 * adopted here, once and silently: a profile without an id is assigned one
 * and written back, and a folder not named after its id is RENAMED to it.
 * Nothing else in the app addresses these folders directly, so the whole
 * id-folder scheme lives behind this index.
 */
function _index(project) {
  const root = charsRoot(project);
  let dirs = [];
  try { dirs = fs.readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name); } catch { return []; }
  const out = [];
  for (const dn of dirs) {
    let dir = path.join(root, dn);
    const p = _readProfileFile(dir);
    if (!p) continue;
    if (!p.id) {
      p.id = newId();
      try { fs.writeFileSync(path.join(dir, p.name + PROFILE_EXT),
                             JSON.stringify(p, null, 2), "utf8"); }
      catch { /* read-only fs: the id holds for this call */ }
    }
    if (dn !== p.id) {
      const want = path.join(root, p.id);
      try { if (!fs.existsSync(want)) { fs.renameSync(dir, want); dir = want; } }
      catch { /* the slug folder keeps working until it can be renamed */ }
    }
    out.push({ dir, profile: p });
  }
  return out;
}

/** The character's folder — resolved through the index, NEVER derived from
 *  the name (the folder is the id). A missing character resolves to a path
 *  that cannot exist, so existsSync-style guards keep their meaning. */
function charDir(name, project) {
  const hit = _index(project).find((e) => e.profile.name === slug(name));
  return hit ? hit.dir : path.join(charsRoot(project), "__no_such__", slug(name) || "_");
}
function profilePath(name, project) {
  return path.join(charDir(name, project), slug(name) + PROFILE_EXT);
}

/** The blank a new character starts from, so every profile has the same shape. */
function blank(name) {
  return { name: slug(name), tag: tagOf(name),
           // TYPE (2.166.0, by instruction): person | animal | vehicle. The
           // detail fields are stored for every type and SHOWN per type —
           // subtype is the kind (dog / sedan / ...), breed is the animal's,
           // color/model/year are the vehicle's (and color any type's).
           type: "person", subtype: "", breed: "", color: "",
           model: "", year: "",
           age: "", height: "", weight: "", notes: "",
           // `pronouns` shapes the subject definition's wording; `slot` is the
           // (S1)/(S2) voice this character speaks in, assigned once and kept,
           // because a character whose slot moves between scenes swaps voices.
           pronouns: "they", slot: "", wardrobe: "",
           // 2.216.0 (by instruction): a stable unique ID — the character's
           // FOLDER name — plus the writer-facing persona and backstory tabs
           id: "", persona: "", backstory: "",
           // 2.224.0 (by instruction): the CLOTHING manifest — entries of
           // {file, type, color, notes}; the files live in dataset/clothing/
           // and lib/clothing.js decides which entries ride which scene
           clothing: [],
           // 2.225.0: the character's extracted H3 identity mod (the name in
           // ComfyUI's models/refmods) — "" until 🧬 Extract RefMod adopts one
           refmod: "",
           images: [], voices: [], scenes: "all",
           created: new Date().toISOString(), updated: new Date().toISOString() };
}

function readProfile(name, project) {
  const hit = _index(project).find((e) => e.profile.name === slug(name));
  return hit ? hit.profile : null;
}

function writeProfile(profile, project) {
  const p = { ...blank(profile.name), ...profile,
              name: slug(profile.name), updated: new Date().toISOString() };
  if (!p.name) throw new Error("a character needs a name");
  // resolve the folder ONCE: an existing name keeps its id and folder; a new
  // name mints its id and the id names the folder (2.216.0)
  const hit = _index(project).find((e) => e.profile.name === p.name);
  if (hit && !p.id) p.id = hit.profile.id;
  if (!p.id) p.id = newId();
  const dir = hit ? hit.dir : path.join(charsRoot(project), p.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, p.name + PROFILE_EXT),
                   JSON.stringify(p, null, 2), "utf8");
  return p;
}

function list(project) {
  const cast = _index(project).map((e) => e.profile);
  // PICTURE NUMBERS NEVER SHIFT (2.204.0, Tim: "when the character is
  // assigned an image like joan picture c1, don't change it when new
  // characters are added"). Picture N derives from CAST ORDER everywhere —
  // the board's labels, the guide's rule 10, buildChain's reference upload
  // order — and the old alphabetical sort renumbered everyone the moment
  // "Adam" joined, silently re-aiming every prompt that named a Picture.
  // Now each profile carries a persisted `order`, assigned ONCE: a one-time
  // migration freezes the alphabetical order casts already have, and every
  // newcomer takes max+1 — appended, shifting no one. Editing and saving a
  // character keeps its order (writeProfile spreads the stored profile).
  const missing = cast.filter((c) => !Number.isFinite(c.order));
  if (missing.length) {
    let next = cast.reduce((m, c) =>
      Number.isFinite(c.order) ? Math.max(m, c.order) : m, 0);
    missing.sort((a, b) => a.name.localeCompare(b.name));
    for (const c of missing) {
      c.order = ++next;
      try { writeProfile(c, project); } catch { /* read-only fs: sort holds for this call */ }
    }
  }
  return cast.sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name));
}

function remove(name, project) {
  const d = charDir(name, project);
  if (!d || !fs.existsSync(d)) return false;
  fs.rmSync(d, { recursive: true, force: true });
  return true;
}

/**
 * Take a file already on disk into the character's folder and record it in the
 * profile. `kind` is inferred from the extension, so an image dropped on the
 * voice slot is filed as an image rather than silently becoming a broken voice.
 */
function addAsset(name, srcPath, originalName, project) {
  const prof = readProfile(name, project) || writeProfile(blank(name), project);
  const ext = (path.extname(originalName || srcPath) || "").toLowerCase();
  const kind = IMG.includes(ext) ? "images" : AUD.includes(ext) ? "voices" : "";
  if (!kind) throw new Error(`not a character sheet or a voice clip: ${ext || "no extension"}`);
  const base = path.basename(originalName || srcPath).replace(/[<>:"/\\|?*]/g, "_");
  const dest = path.join(charDir(name, project), base);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(srcPath, dest);
  if (!prof[kind].includes(base)) prof[kind].push(base);
  // 2.224.0: every picture that joins the character also lands in the
  // DATASET folder — the RefMod training set (additive; voices stay out)
  if (kind === "images") datasetAdd(name, dest, base, project);
  return { profile: writeProfile(prof, project), kind, file: base };
}

/* ---- THE DATASET FOLDER (2.224.0, Tim verbatim: "store it in project
 * name\character name\dataset, a place for our refmod to get the folder to
 * train"). ADDITIVE storage — the existing top-level layout keeps feeding
 * the chain and H3_Video_Ref; this folder collects every generated sheet,
 * uploaded source, stitched composite and clothing image so the coming
 * RefMod extraction (and the pack's Load H3 RefMod Folder node, which
 * reads every image in a folder) can point at ONE place per character. */
const DATASET = "dataset";

function datasetDir(name, project) {
  return path.join(charDir(name, project), DATASET);
}

/** Copy a picture into the character's dataset. Same base name overwrites
 *  (idempotent — a re-saved sheet is one training image, not a pile of
 *  copies); returns the filename, or null when the copy could not happen
 *  (a dataset miss must never fail the save that triggered it). */
function datasetAdd(name, srcPath, baseName, project, sub) {
  try {
    const dir = sub ? path.join(datasetDir(name, project), sub)
                    : datasetDir(name, project);
    if (!fs.existsSync(path.dirname(dir))) return null;   // no such character
    fs.mkdirSync(dir, { recursive: true });
    const base = path.basename(baseName || srcPath).replace(/[<>:"/\\|?*]/g, "_");
    const dest = path.join(dir, base);
    if (path.resolve(srcPath) !== path.resolve(dest))
      fs.copyFileSync(srcPath, dest);
    return base;
  } catch { return null; }
}

/** Create the character's dataset folder EXPLICITLY (2.228.0, by
 *  instruction: "Create dataset folder for the character") — mkdir plus a
 *  census, so the button can say what is already in it. datasetAdd still
 *  auto-creates on first landing; this makes the folder real and browsable
 *  before anything lands. Throws in words when the character doesn't exist. */
function datasetCreate(name, project) {
  if (!readProfile(name, project)) throw new Error(`no such character: ${name}`);
  const dir = datasetDir(name, project);
  fs.mkdirSync(path.join(dir, "clothing"), { recursive: true });
  const files = fs.readdirSync(dir).filter((f) =>
    fs.statSync(path.join(dir, f)).isFile()).length;
  return { dir, files };
}

/* ---- CLOTHING STORAGE (2.224.0, by instruction) ------------------------
 * Each entry = a picture (a clothing photo, or a sheet wearing it) + type +
 * color + free text; MULTIPLE entries per character. The files live under
 * dataset/clothing/ (part of the RefMod training set) and the manifest
 * rides the PROFILE — lib/clothing.js reads it to decide which entries
 * ride which scene. */
function clothingAdd(name, srcPath, meta, project) {
  const prof = readProfile(name, project);
  if (!prof) throw new Error(`no such character: ${name}`);
  const m = meta || {};
  const type = String(m.type || "").trim().slice(0, 80);
  if (!type) throw new Error("a clothing entry needs a type (jacket, armor, …)");
  const ext = (path.extname(m.original || srcPath) || ".png").toLowerCase();
  if (!IMG.includes(ext)) throw new Error(`not a picture: ${ext}`);
  const base = (slug(type).replace(/\s+/g, "-") + "-" + Date.now().toString(36) + ext)
    .replace(/[<>:"/\\|?*]/g, "_");
  const file = datasetAdd(name, srcPath, base, project, "clothing");
  if (!file) throw new Error("could not store the clothing picture");
  prof.clothing = (prof.clothing || []).concat([{
    file, type,
    color: String(m.color || "").trim().slice(0, 80),
    notes: String(m.notes || "").trim().slice(0, 300) }]);
  return { profile: writeProfile(prof, project), file };
}

function clothingRemove(name, file, project) {
  const prof = readProfile(name, project);
  if (!prof) return null;
  const base = path.basename(String(file || ""));
  prof.clothing = (prof.clothing || []).filter((e) => e && e.file !== base);
  try { fs.rmSync(path.join(datasetDir(name, project), "clothing", base),
                  { force: true }); } catch { /* the manifest is the truth */ }
  return writeProfile(prof, project);
}

/** Absolute path of one clothing picture (for the reference walks). */
function clothingPath(name, file, project) {
  return path.join(datasetDir(name, project), "clothing",
                   path.basename(String(file || "")));
}

// ---- the ACTORS IN THE SCENE (2.216.0, by instruction: "make a dialog with
// a thumbnail grid to select which Actors will be in the current scene") ----
function castPath(project) { return path.join(charsRoot(project), "cast.json"); }

function activeIds(project) {
  try {
    const j = JSON.parse(fs.readFileSync(castPath(project), "utf8"));
    return Array.isArray(j.active) ? j.active.map(String) : null;
  } catch { return null; }
}

function setActive(ids, project) {
  fs.mkdirSync(charsRoot(project), { recursive: true });
  fs.writeFileSync(castPath(project), JSON.stringify(
    { active: [...new Set((ids || []).map(String))].filter(Boolean) }, null, 2), "utf8");
  return activeIds(project) || [];
}

/** The roster the CHAIN and the WRITER see: everyone, filtered by the 🎭
 *  selection. No selection — or a selection of ghosts — means everyone, so a
 *  project that never opens the dialog behaves exactly as it always did. */
function cast(project) {
  const all = list(project);
  const act = activeIds(project);
  if (!act || !act.length) return all;
  const chosen = all.filter((c) => act.includes(c.id));
  return chosen.length ? chosen : all;
}

// ---- chapter MEMORY (2.216.0, by instruction: "store every chapter that
// they are in in their folder ... as chapter name.history files") -----------
function historyFile(chapter) {
  return (slug(chapter) || "chapter") + ".history";
}

function writeHistory(name, chapter, text, project) {
  const d = charDir(name, project);
  if (!fs.existsSync(d)) return false;
  fs.writeFileSync(path.join(d, historyFile(chapter)), String(text || ""), "utf8");
  return true;
}

/** The character's memory, newest chapter first, hard-capped — the 26B
 *  lesson: memory that overflows the model's window is amnesia with extra
 *  steps, so the cap is enforced here rather than hoped for upstream. */
function readHistories(name, project, capChars = 4000) {
  const d = charDir(name, project);
  let files = [];
  try {
    files = fs.readdirSync(d).filter((f) => f.endsWith(".history"))
      .map((f) => ({ f, m: fs.statSync(path.join(d, f)).mtimeMs }))
      .sort((a, b) => b.m - a.m);
  } catch { return ""; }
  let out = "", used = 0;
  for (const { f } of files) {
    let t = "";
    try { t = fs.readFileSync(path.join(d, f), "utf8").trim(); } catch { continue; }
    if (!t) continue;
    const head = `[${f.slice(0, -".history".length)}]\n`;
    const room = capChars - used - head.length;
    if (room <= 0) break;
    if (t.length > room) t = t.slice(0, room);
    out += head + t + "\n";
    used += head.length + t.length + 1;
  }
  return out.trim();
}

/** What the LLM is given so it knows who it is writing for — the SCENE'S
 *  cast (2.216.0), each with persona, backstory and chapter memory riding
 *  along capped, so the writer can "rag" the character rather than reinvent
 *  them. */
function briefing(project) {
  const cs = cast(project);
  if (!cs.length) return "";
  return "Characters in this scene:\n" + cs.map((c) => {
    const bits = [c.age && `age ${c.age}`, c.height && `height ${c.height}`,
                  c.weight && `weight ${c.weight}`].filter(Boolean).join(", ");
    const hist = readHistories(c.name, project, 1500);
    return `- ${c.name}${bits ? ` (${bits})` : ""}`
         + `${c.notes ? `: ${c.notes}` : ""}`
         + `${c.images.length ? ` [reference sheet: ${c.images.length}]` : ""}`
         + `${c.voices.length ? ` [voice reference]` : ""}`
         + `${c.persona ? `\n  persona: ${String(c.persona).slice(0, 1200)}` : ""}`
         + `${c.backstory ? `\n  backstory: ${String(c.backstory).slice(0, 1200)}` : ""}`
         + `${hist ? `\n  what has happened to them so far:\n  ${hist.replace(/\n/g, "\n  ")}` : ""}`;
  }).join("\n");
}

// ---- the graph half -------------------------------------------------------
const PIC_NODE = "MiniMaxH3ScheduledPictureReference";
const AUD_NODE = "MiniMaxH3ScheduledAudioReference";
const SCHED_CONSUMER = "MiniMaxH3ScheduledReferenceToVideo";

/** Every node id whose class is one of the scheduled-reference kinds. */
function chainNodes(g) {
  return Object.keys(g).filter((k) => {
    const ct = (g[k] || {}).class_type;
    return ct === PIC_NODE || ct === AUD_NODE;
  });
}

/**
 * Rebuild the reference chain from `characters`, returning a NEW graph.
 *
 * Every existing scheduled reference and its loader is removed first - the
 * style's own two example characters are a demo, not something to inherit - and
 * a fresh chain is built: for each character, its picture reference then its
 * voice reference, each pointing at the one before through `previous`. The last
 * node is wired into whatever consumes `reference_schedule`.
 *
 * `resolve(character, file, kind)` turns a profile filename into the name
 * ComfyUI knows it by (the caller uploads it and passes the returned name), so
 * this function stays pure and testable with no HTTP in it.
 */
/** The one-reference rule (2.168.0, Tim: "2 separate images are being
 *  loaded as the same character twice which is not allowed"): a character
 *  with several sheets gets them STITCHED side by side into ONE composite
 *  reference, built with ffmpeg at save time (and rebuilt whenever a source
 *  is newer). The pack reads one picture per character; a second angle now
 *  rides IN the same picture instead of registering the character twice. */
const COMPOSITE = "_composite.png";

/** Stitch several pictures side by side into ONE file — the 2.168.0 ffmpeg
 *  chain, extracted (2.224.0) so the multi-sheet Stitch button rides the
 *  SAME implementation as the save-time composite instead of duplicating
 *  it. Every source scales to one height, then a horizontal stack. */
function stitchFiles(srcs, out) {
  try {
    const ok = (srcs || []).filter((f) => f && fs.existsSync(f));
    if (ok.length < 2) return false;
    const { spawnSync } = require("child_process");
    const fc = ok.map((_, i) => `[${i}:v]scale=-2:768[s${i}]`).join(";")
      + ";" + ok.map((_, i) => `[s${i}]`).join("") + `hstack=inputs=${ok.length}[o]`;
    const args = ["-y", "-loglevel", "error"];
    for (const f of ok) args.push("-i", f);
    args.push("-filter_complex", fc, "-map", "[o]", out);
    const r = spawnSync("ffmpeg", args, { encoding: "utf8" });
    return r.status === 0 && fs.existsSync(out);
  } catch { return false; }
}

function buildComposite(name, project) {
  try {
    const dir = charDir(name, project);
    const p = readProfile(name, project);
    const imgs = (p && p.images) || [];
    if (imgs.length < 2) return null;                    // one sheet needs no stitch
    const out = path.join(dir, COMPOSITE);
    const srcs = imgs.map((i) => path.join(dir, i)).filter((f) => fs.existsSync(f));
    if (srcs.length < 2) return null;
    const newest = Math.max(...srcs.map((f) => fs.statSync(f).mtimeMs));
    if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= newest)
      return COMPOSITE;                                  // already current
    if (!stitchFiles(srcs, out)) return null;
    // 2.224.0: the stitched composite is training material too
    datasetAdd(name, out, "composite.png", project);
    return COMPOSITE;
  } catch { return null; }
}

/** The ONE picture this character shows the chain: the stitched composite
 *  when several sheets exist (built on demand), else the single sheet. */
function referenceImage(c, project) {
  const imgs = (c && c.images) || [];
  if (imgs.length > 1 && buildComposite(c.name, project)) return COMPOSITE;
  return imgs[0] || null;
}

function buildChain(graph, characters, resolve, environments, project, chapterRefs, clothing) {
  const g = JSON.parse(JSON.stringify(graph));
  // 1. drop the old chain, and any loader that only fed it
  const old = chainNodes(g);
  const feeders = new Set();
  for (const id of old) {
    for (const v of Object.values(g[id].inputs || {})) {
      if (Array.isArray(v) && v.length === 2) feeders.add(String(v[0]));
    }
  }
  for (const id of old) delete g[id];
  for (const f of feeders) {
    if (!g[f]) continue;
    const stillUsed = Object.values(g).some((n) => Object.values(n.inputs || {})
      .some((v) => Array.isArray(v) && String(v[0]) === f));
    const ct = (g[f] || {}).class_type;
    if (!stillUsed && (ct === "LoadImage" || ct === "VHS_LoadAudioUpload")) delete g[f];
  }
  // 2. build the new chain
  let prev = null, n = 0;
  const notes = [];
  const add = (id, node) => { g[id] = node; prev = id; };
  for (const c of (characters || [])) {
    // even a STORED tag is sanitized: a hand-edited profile must not put
    // a space or punctuation into a widget the node pack validates
    const tag = tagOf(c.tag || c.name);
    const scenes = c.scenes || "all";
    // ONE PICTURE PER CHARACTER (2.168.0, by instruction — REVERSES the
    // 2.144.0 every-sheet rule after Tim's live finding: "2 separate images
    // are being loaded as the same character twice which is not allowed").
    // Several sheets are STITCHED into one composite at save time; the
    // chain gets exactly one loader + reference per character, so a tag
    // never registers twice. Voices keep the 2.144.0 many-clips rule — the
    // pack's complaint named pictures, not voices.
    const imgs = c.images || [];
    // the SAME decision queueScene uploads by: the composite only when it
    // could actually be built (ffmpeg present), else the first sheet — the
    // graph must never name a file the upload list does not carry
    const pick = referenceImage(c, project);
    if (pick) {
      const loader = `char_img_${n}`, ref = `char_pic_${n}`;
      g[loader] = { class_type: "LoadImage",
                    inputs: { image: resolve(c, pick, "images") } };
      add(ref, { class_type: PIC_NODE,
                 inputs: { tag, scenes, image: [loader, 0],
                           ...(prev ? { previous: [prev, 0] } : {}) } });
      if (imgs.length > 1)
        notes.push(`${c.name}: ${imgs.length} sheets stitched into one composite reference`);
    }
    if (!imgs.length) notes.push(`${c.name}: no character sheet, so no picture reference`);
    const voices = c.voices || [];
    voices.forEach((voice, j) => {
      const sfx = j ? `_${n}_${j}` : `_${n}`;
      const loader = `char_aud${sfx}`, ref = `char_voice${sfx}`;
      g[loader] = { class_type: "VHS_LoadAudioUpload",
                    inputs: { audio: resolve(c, voice, "voices"),
                              start_time: 0, duration: 30 } };
      add(ref, { class_type: AUD_NODE,
                 // `<tag>_voice`, by instruction (2.145.0) - the old
                 // "<tag> voice" carried a SPACE and the node pack refuses
                 // it as an unstable reference tag
                 inputs: { tag: `${tag}_voice`, scenes, audio: [loader, 0],
                           ...(prev ? { previous: [prev, 0] } : {}) } });
    });
    if (!voices.length) notes.push(`${c.name}: no voice clip, so no audio reference`);
    n++;
  }
  // 2b. ENVIRONMENTS (2.142.0) ride the same chain, AFTER the cast — the
  // characters' <Picture i> numbering must never shift when a location is
  // added, and the env loaders' ids sort after char_img_* so the worker's
  // slot assignment stays aligned with the reference file order. Each is a
  // scheduled picture reference with the environment's own tag and scene
  // range; `resolve(env, view, "environments")` names the extracted VIEW
  // (never the raw pano — an equirect unroll is not what a camera sees).
  let ne = 0;
  for (const e of (environments || [])) {
    if (!e || !e.view) {
      if (e && e.name) notes.push(`${e.name}: no extracted view, so no environment reference`);
      continue;
    }
    const loader = `env_img_${ne}`, ref = `env_pic_${ne}`;
    g[loader] = { class_type: "LoadImage",
                  inputs: { image: resolve(e, e.view, "environments") } };
    add(ref, { class_type: PIC_NODE,
               inputs: { tag: tagOf(e.tag || e.name),
                         scenes: e.scenes || "all", image: [loader, 0],
                         ...(prev ? { previous: [prev, 0] } : {}) } });
    ne++;
  }
  // 2c. CHAPTER REFERENCE IMAGES (2.180.0, by instruction) ride LAST —
  // clothing, poses, two-character compositions — so the cast's and the
  // environments' <Picture i> numbering never shifts when a chapter gains
  // a reference. Loader ids sort after env_img_* (ref_img_*), keeping the
  // worker's insertion-order slot fill aligned with the upload list. The
  // caller passes ONLY the rendered chapter's entries (the pack's `scenes`
  // format beyond "all" is unverified; scoping is per-queue, app-side).
  let nr = 0, ns = 0;
  for (const cr of (chapterRefs || [])) {
    if (!cr || !cr.file) continue;
    // 2.266.0 (by instruction): a chapter reference can be a SOUND — a
    // song the character lipsyncs to. It rides the SAME scheduled chain,
    // through the same two node classes character voices use; start_time 0
    // and duration 0 mean the WHOLE clip (a song is not a 30s voice
    // sample). ref_aud_* ids sort after char_aud_*, so the worker's
    // insertion-order audio slot fill lines up with the queue's
    // ref_audios list (cast voices first, chapter sounds after).
    if (cr.kind === "sound") {
      const loader = `ref_aud_${ns}`, ref = `ref_snd_${ns}`;
      g[loader] = { class_type: "VHS_LoadAudioUpload",
                    inputs: { audio: cr.file, start_time: 0, duration: 0 } };
      add(ref, { class_type: AUD_NODE,
                 inputs: { tag: tagOf(cr.tag || cr.file), scenes: "all",
                           audio: [loader, 0],
                           ...(prev ? { previous: [prev, 0] } : {}) } });
      notes.push(`chapter sound @${tagOf(cr.tag || cr.file)} rides this render as an audio reference`);
      ns++;
      continue;
    }
    const loader = `ref_img_${nr}`, ref = `ref_pic_${nr}`;
    g[loader] = { class_type: "LoadImage", inputs: { image: cr.file } };
    add(ref, { class_type: PIC_NODE,
               inputs: { tag: tagOf(cr.tag || cr.file), scenes: "all",
                         image: [loader, 0],
                         ...(prev ? { previous: [prev, 0] } : {}) } });
    notes.push(`chapter reference @${tagOf(cr.tag || cr.file)} rides this render`);
    nr++;
  }
  // 2d. CLOTHING (2.224.0, by instruction) rides LAST of all — one picture
  // reference per ACTIVE entry, tag <chartag>_<typeslug>, resolved per
  // rendered scene by lib/clothing.js (mention selects, silence inherits,
  // a new mention replaces). The caller passes ONLY the rendered scene's
  // active entries — the same app-side per-queue scoping chapter refs use,
  // because the pack's `scenes` format beyond "all" is unverified. Riding
  // after everything keeps every existing <Picture i> number stable (the
  // 2.142.0/2.180.0 doctrine); the tag does the binding. Loader ids
  // (wear_img_*) sort after ref_img_*, and the worker's stable sort keeps
  // insertion order for non-numeric ids — either way the upload list and
  // the loaders line up.
  let nw = 0;
  for (const w of (clothing || [])) {
    if (!w || !w.file) continue;
    const loader = `wear_img_${nw}`, ref = `wear_pic_${nw}`;
    g[loader] = { class_type: "LoadImage",
                  inputs: { image: resolve(w, w.file, "clothing") } };
    add(ref, { class_type: PIC_NODE,
               inputs: { tag: tagOf(w.tag || w.type), scenes: "all",
                         image: [loader, 0],
                         ...(prev ? { previous: [prev, 0] } : {}) } });
    notes.push(`clothing @${tagOf(w.tag || w.type)} (${w.char || "?"}: ${w.type}) rides this render`);
    nw++;
  }
  // 3. wire the tail into whoever wanted the schedule
  let wired = 0;
  for (const [id, node] of Object.entries(g)) {
    const ins = node.inputs || {};
    if (!("reference_schedule" in ins)) continue;
    if (prev) { ins.reference_schedule = [prev, 0]; wired++; }
    else { delete ins.reference_schedule; notes.push(
      `${id} (${node.class_type}): no characters, so it runs with no reference schedule`); }
  }
  if (prev && !wired) notes.push(
    `built a chain of ${n} character(s) but no ${SCHED_CONSUMER} wanted it - `
    + "the template has no reference_schedule input");
  return { graph: g, notes, tail: prev, count: n };
}

/* 2.223.7 (by instruction): the character creator tab keeps "thumbnails of
 * this characters generations (not all the images in the gallery)" — a tiny
 * per-character list of generated-image URLs, keyed by the character NAME
 * (slugged) so it works while the character is still being created and has
 * no id yet. Stored at projects/<p>/characters/_gens/<slug>.json; the files
 * themselves are ordinary /outputs renders — this is only the membership
 * list that scopes the strip. */
function gensPath(name) {
  const slug = String(name || "unnamed").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unnamed";
  const dir = path.join(core.projDir(core.getProject()), "characters", "_gens");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, slug + ".json");
}
function gensList(name) {
  try { return JSON.parse(fs.readFileSync(gensPath(name), "utf8")) || []; }
  catch { return []; }
}
function gensAdd(name, urls) {
  const cur = gensList(name);
  for (const u of Array.isArray(urls) ? urls : [])
    if (typeof u === "string" && u && !u.includes("..") && !cur.includes(u))
      cur.push(u.slice(0, 400));
  fs.writeFileSync(gensPath(name), JSON.stringify(cur.slice(-200)));
  return cur;
}

module.exports = { gensList, gensAdd,
  COMPOSITE, buildComposite, referenceImage, stitchFiles,
  DATASET, datasetDir, datasetAdd, datasetCreate, clothingAdd, clothingRemove, clothingPath,
  slug, tagOf, charsRoot, charDir, profilePath, blank, readProfile, writeProfile,
  newId, cast, activeIds, setActive, writeHistory, readHistories, historyFile,
  list, remove, addAsset, briefing, buildChain, chainNodes,
  PIC_NODE, AUD_NODE, SCHED_CONSUMER, PROFILE_EXT, IMG, AUD,
};
