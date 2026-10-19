"use strict";
/**
 * bitGen Studio — CHAPTER REFERENCE IMAGES (2.180.0, by instruction: "add
 * load image nodes on demand to [the character-ref] tmp workflow so we can
 * add reference images, like clothing, positions, pose, pose of 2
 * characters (woman riding horse)... these reference images will be saved
 * for each chapter, each chapter will have different reference images").
 *
 * The one store: the .prj's `chapterRefs` key — { "<chapter>": [{ file,
 * label, tag }] } — files themselves under projects/<p>/refs/. Injection
 * happens per QUEUE: the tmp is rebuilt with ONLY the rendered scene's
 * chapter (the pack's `scenes` field format beyond "all" is UNVERIFIED, so
 * scoping is app-side: one graph per queue, one chapter's refs in it, and
 * scenes:"all" stays safe because only that scene renders). "" is a real
 * chapter (the un-chaptered scenes) and gets its own refs.
 */
const fs = require("fs");
const path = require("path");
const core = require("./core");
const chars = require("./characters");

// 2.266.0 (by instruction: "add a sound reference to the chapter in video
// docker, so our character can lipsync a song"): a chapter reference can be
// a SOUND — a song or any audio clip. It rides the same chain as pictures,
// through VHS_LoadAudioUpload + MiniMaxH3ScheduledAudioReference (exactly
// how character voices already travel), and the screenplay steers lipsync
// at its @tag in prose.
const SOUND_RE = /\.(wav|mp3|flac|ogg|m4a)$/i;
function kindOf(file, kind) {
  if (kind === "sound" || kind === "image") return kind;
  return SOUND_RE.test(String(file || "")) ? "sound" : "image";
}

function readPrj(project) {
  try { return JSON.parse(fs.readFileSync(
    core.prjPath(project || core.getProject()), "utf8")) || {}; }
  catch { return {}; }
}

function writeMap(project, map) {
  const p = project || core.getProject();
  const d = readPrj(p);
  d.chapterRefs = map;
  fs.mkdirSync(path.dirname(core.prjPath(p)), { recursive: true });
  fs.writeFileSync(core.prjPath(p), JSON.stringify(d, null, 2), "utf8");
}

function load(project) {
  const raw = readPrj(project).chapterRefs;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [ch, arr] of Object.entries(raw)) {
    out[String(ch)] = (Array.isArray(arr) ? arr : []).filter((e) => e
      && typeof e === "object" && e.file).map((e) => ({
        file: String(e.file), label: String(e.label || ""),
        tag: chars.tagOf(String(e.tag || e.label || e.file)),
        type: String(e.type || ""), description: String(e.description || ""),
        kind: kindOf(e.file, e.kind),
        // 2.270.0: scene-bound EXTERNAL entries (music-video segments) —
        // `dir` is the file's own folder (music/temp), `scene` binds the
        // entry to ONE board scene; both optional, absent = the old shape
        dir: e.dir ? String(e.dir) : "",
        scene: Number.isInteger(e.scene) && e.scene > 0 ? e.scene : 0 }));
  }
  return out;
}

function dir(project) {
  return path.join(core.projDir(project || core.getProject()), "refs");
}

/** Store an uploaded file (from a temp path) and record it on the chapter.
 *  The stored name keeps the original extension under a slug of the label
 *  (or original name) so the ComfyUI upload carries a stable, tag-friendly
 *  name; a same-named file in the chapter is replaced, not duplicated. */
function add(project, chapter, tmpPath, originalName, label, type, description, kind) {
  const ch = String(chapter == null ? "" : chapter);
  const ext = (path.extname(originalName || "") || ".png").toLowerCase();
  // tagOf, not slug: the stored NAME becomes a ComfyUI upload name and the
  // reference tag's twin — it must be space-free exactly like the tag is
  // (the e2e caught "horse pose.png" riding a space into the upload)
  const base = chars.tagOf(label || path.basename(originalName || "ref", ext))
    || "ref";
  const name = `${base}${ext}`;
  fs.mkdirSync(dir(project), { recursive: true });
  fs.copyFileSync(tmpPath, path.join(dir(project), name));
  const map = load(project);
  const list = (map[ch] = map[ch] || []).filter((e) => e.file !== name);
  list.push({ file: name, label: String(label || ""),
              tag: chars.tagOf(label || base),
              kind: kindOf(name, kind),
              // 2.183.0 (by instruction): the dialog's details — the type
              // and description are what the WRITER reads to use the
              // reference in the screenplay
              type: String(type || ""), description: String(description || "") });
  map[ch] = list;
  writeMap(project, map);
  return { chapter: ch, file: name, tag: chars.tagOf(label || base),
           kind: kindOf(name, kind) };
}

/** 2.270.0 (Tim: "automatically split the track into 15 second files, and
 *  add them to each scene as audio reference"): record a file that lives
 *  OUTSIDE refs/ (music/temp segments) without copying it, optionally bound
 *  to ONE scene — forChain sends a scene-bound entry only to that scene's
 *  queue. Same-file entries in the chapter are replaced, like add(). */
function addExternal(project, chapter, absDir, file, opts) {
  const o = opts || {};
  const ch = String(chapter == null ? "" : chapter);
  const name = path.basename(String(file || ""));
  if (!name) return null;
  const map = load(project);
  const list = (map[ch] = map[ch] || []).filter((e) => e.file !== name);
  list.push({ file: name, label: String(o.label || name),
              tag: chars.tagOf(o.label || name.replace(/\.[^.]+$/, "")),
              type: String(o.type || ""),
              description: String(o.description || ""),
              kind: kindOf(name, o.kind),
              dir: String(absDir || ""),
              scene: Number.isInteger(o.scene) && o.scene > 0 ? o.scene : 0 });
  map[ch] = list;
  writeMap(project, map);
  return list[list.length - 1];
}

/** Drop every scene-bound external segment entry (a new split replaces the
 *  old assignment wholesale — one music video at a time). Files under
 *  music/temp are the split's own to clear; entries only, here. */
function clearExternalSegments(project) {
  const map = load(project);
  let gone = 0;
  for (const ch of Object.keys(map)) {
    const before = map[ch].length;
    map[ch] = map[ch].filter((e) => !(e.dir && e.scene));
    gone += before - map[ch].length;
    if (!map[ch].length) delete map[ch];
  }
  if (gone) writeMap(project, map);
  return gone;
}

function remove(project, chapter, file) {
  const ch = String(chapter == null ? "" : chapter);
  const map = load(project);
  const before = (map[ch] || []).length;
  // 2.270.0: an external entry's file (music/temp segment) is the split's
  // property — removing the ENTRY never unlinks it
  const wasExternal = (map[ch] || []).some((e) =>
    e.file === String(file) && e.dir);
  map[ch] = (map[ch] || []).filter((e) => e.file !== String(file));
  const gone = before - map[ch].length;
  if (!map[ch].length) delete map[ch];
  writeMap(project, map);
  if (gone) {
    // the file leaves the disk only when NO other chapter still lists it
    const stillUsed = Object.values(map).some((arr) =>
      arr.some((e) => e.file === String(file)));
    if (!stillUsed && !wasExternal) {
      try { fs.unlinkSync(path.join(dir(project), String(file))); }
      catch { /* already gone */ }
    }
  }
  return { removed: gone };
}

/** The chain-builder's view: the entries of ONE chapter, with full paths
 *  for the queue's upload list. Missing files are reported, never sent. */
function forChain(project, chapter, scene) {
  const ch = String(chapter == null ? "" : chapter);
  const sn = Number.isInteger(scene) && scene > 0 ? scene
    : (parseInt(scene, 10) > 0 ? parseInt(scene, 10) : 0);
  const out = { refs: [], missing: [] };
  for (const e of (load(project)[ch] || [])) {
    // 2.270.0: a scene-bound entry (music-video segment) rides ONLY its own
    // scene's queue — other scenes never hear another scene's 15 seconds.
    // Callers that pass no scene get only the unbound entries.
    if (e.scene && e.scene !== sn) continue;
    const p = e.dir ? path.join(e.dir, e.file) : path.join(dir(project), e.file);
    if (fs.existsSync(p)) out.refs.push({ tag: e.tag, file: e.file, path: p,
                                          kind: kindOf(e.file, e.kind),
                                          scene: e.scene || 0 });
    else out.missing.push(`${ch || "(no chapter)"}: ${e.file} is missing from `
      + (e.dir ? e.dir : "refs/"));
  }
  return out;
}

/** The WRITER'S view of every chapter's references (2.183.0): one compact
 *  block teaching the model each reference's @tag, type and description so
 *  a screenplay can steer at them ("@jinx wearing @picture_1's jacket").
 *  Empty when there are none. Pure text; capped. */
/**
 * The reference pictures as SHARED-PROMPT paragraphs (2.191.0, Tim: "put
 * the reference picture name, type, description in the scene board (global
 * prompt)"). One line per reference — name, type, description, and the
 * chapter it rides — appended into prompt_prefix by buildPrefix, so the
 * board's shared prompt SHOWS them and every scene render CARRIES them.
 * Descriptions cap at 300 chars each and the block at ~2000 total.
 */
/** 2.270.0: the music-video segments as ONE compact teaching line per song
 *  (a 4-minute track is 16+ entries — per-entry lines would drown the
 *  brief). isSegment/segGroups feed both writer-facing blocks. */
function isSegment(e) {
  return !!(e.dir && e.scene && kindOf(e.file, e.kind) === "sound");
}
function segGroups(map) {
  const g = {};
  for (const arr of Object.values(map)) {
    for (const e of arr) {
      if (!isSegment(e)) continue;
      const m = e.file.match(/^(.+)_(\d+)\.([^.]+)$/);
      const base = m ? m[1] : e.file, n = m ? parseInt(m[2], 10) : e.scene;
      (g[base] = g[base] || { base, ext: m ? m[3] : "", max: 0 });
      if (n > g[base].max) g[base].max = n;
    }
  }
  return Object.values(g);
}

function prefixParagraphs(project) {
  const map = load(project);
  const out = [];
  let used = 0;
  for (const g of segGroups(map)) {
    const line = `Song segments "${g.base}" (@${g.base}_1 … @${g.base}_${g.max}, `
      + `15s each): scene n's soundtrack is ${g.base}_n.${g.ext} — the scene `
      + "renders against exactly its 15 seconds of the song.";
    out.push(line); used += line.length;
  }
  for (const [ch, arr] of Object.entries(map)) {
    for (const e of arr) {
      if (isSegment(e)) continue;
      const snd = kindOf(e.file, e.kind) === "sound";
      const line = `Reference ${snd ? "sound" : "picture"} "${e.label || e.tag}" (@${e.tag}`
        + (e.type ? `, ${e.type}` : "")
        + (ch ? `, chapter "${ch}"` : "") + ")"
        + (e.description
           ? `: ${e.description.replace(/\s+/g, " ").trim().slice(0, 300)}`
           : "")
        + (/[.!?]$/.test((e.description || "").trim()) ? "" : ".");
      if (used + line.length > 2000) return out;
      out.push(line); used += line.length;
    }
  }
  return out;
}

/** Every reference tag in the project, lowercase — validate's third kind
 *  (2.194.0): a tag that steers appearance but can never act or speak. */
function tags(project) {
  const map = load(project);
  const out = [];
  for (const arr of Object.values(map))
    for (const e of arr) if (e.tag) out.push(String(e.tag).toLowerCase());
  return [...new Set(out)];
}

function refsBrief(project) {
  const map = load(project);
  const lines = [];
  for (const [ch, arr] of Object.entries(map)) {
    for (const e of arr) {
      if (isSegment(e)) continue;
      lines.push(`- @${e.tag}`
        + (kindOf(e.file, e.kind) === "sound" ? " (sound)" : "")
        + (e.type ? ` (${e.type})` : "")
        + (ch ? ` [chapter "${ch}"]` : "")
        + (e.label ? ` "${e.label}"` : "")
        + (e.description ? `: ${e.description.replace(/\s+/g, " ").trim()}` : ""));
    }
  }
  for (const g of segGroups(map)) {
    lines.push(`- @${g.base}_1 … @${g.base}_${g.max} (sound segments, 15s `
      + `each): scene n carries ${g.base}_n.${g.ext} as its own soundtrack `
      + "slice - when a scene sings, name ITS segment, e.g. a scene-3 "
      + `prompt line "@jinx sings along to @${g.base}_3, lips synced to it"; `
      + "never name another scene's segment.");
  }
  if (!lines.length) return "";
  // 2.194.0 (Tim: "can we tell the llm automatically which are character
  // references and the other types of references, so it doesn't get
  // confused?"): the taxonomy is stated OUTRIGHT — pictures are not people.
  const anySound = Object.values(map).some((arr) =>
    arr.some((e) => kindOf(e.file, e.kind) === "sound"));
  return "\n\nREFERENCE IMAGES available to this story. These are "
    + "PICTURES, NOT characters: a reference tag can never act, speak or "
    + "take a speaker slot — the ONLY characters are the @tags listed in "
    + "rule 3, and locations are the environment tags. Use a reference "
    + "tag only inside a prompt line to steer appearance toward that "
    + "picture, per its type (clothing = wardrobe, pose = body position, "
    + "composition = framing, location = set dressing, prop = an object), "
    + "e.g. \"@jinx posed as @the_tag\"; each rides its chapter's renders "
    + "as a picture reference"
    + (anySound
       ? ". Entries marked (sound) are AUDIO references, not pictures: to "
         + "make a character sing or lipsync to one, write a prompt line "
         + "naming the character and the sound tag together, e.g. \"@jinx "
         + "sings along to @the_song, her lips and breathing synced to "
         + "it\" — the render carries that audio as a reference the "
         + "performance follows"
       : "")
    + ":\n" + lines.join("\n").slice(0, 2500);
}

/** Merge a saved movie's reference map back in (2.195.0): entries land in
 *  their chapters unless an entry with the same file is already there —
 *  the file name is the identity, as everywhere in the project tree. */
function restore(project, savedMap) {
  const map = load(project);
  let added = 0;
  for (const [ch, arr] of Object.entries(savedMap || {})) {
    const list = (map[ch] = map[ch] || []);
    for (const e of (arr || [])) {
      if (!e || !e.file || list.some((x) => x.file === e.file)) continue;
      list.push({ file: String(e.file), label: String(e.label || ""),
                  tag: String(e.tag || ""), type: String(e.type || ""),
                  description: String(e.description || ""),
                  kind: kindOf(e.file, e.kind) });
      added++;
    }
  }
  if (added) writeMap(project, map);
  return added;
}

/** Edit one reference's details in place (2.198.0, "make them editable"):
 *  the file is the identity and never changes here — label, type and
 *  description do. Returns the updated map, or null when no such entry. */
function update(project, chapter, file, patch) {
  const map = load(project);
  const list = map[chapter || ""] || [];
  const e = list.find((x) => x && x.file === file);
  if (!e) return null;
  for (const k of ["label", "type", "description"]) {
    if (patch && patch[k] !== undefined) e[k] = String(patch[k]);
  }
  writeMap(project, map);
  return map;
}

module.exports = { load, add, remove, forChain, dir, refsBrief, prefixParagraphs, tags, restore, update,
                   addExternal, clearExternalSegments, isSegment };
