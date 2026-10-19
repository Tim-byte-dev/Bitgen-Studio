"use strict";
/**
 * projectRefs.js — THE PROJECT'S REFERENCE MEDIA (2.101.0, by instruction).
 *
 * Tim: "save all the reference images/videos/audio to project name\reference\
 * images, ...\reference\videos, ...\reference\audio. In the project name file
 * add the names of the reference media and load them when project is opened."
 *
 * So a project owns its reference media on disk:
 *
 *     projects/<p>/reference/images/<file>     the picture tray (subject slots)
 *     projects/<p>/reference/videos/<file>     reference videos
 *     projects/<p>/reference/audio/<file>      reference sound
 *
 * and the .prj file (projects/<p>/<p>.prj) carries the MANIFEST under
 * `references`:
 *
 *     "references": {
 *       "images": [ { "file": "a.png", "subject": 1, "role": "person", "roleOther": "" } ],
 *       "videos": [ "clip.mp4" ],
 *       "audio":  [ "song.wav" ]
 *     }
 *
 * Opening the project rebuilds the reference dock from that manifest — the
 * picture tray from reference/images, the video/sound lists from their
 * folders — instead of starting empty as it did before.
 *
 * WHAT THIS IS NOT. Reference GROUPS (lib/refGroups.js, references/<group>.json,
 * a named set you can swap in) are unchanged: a group still names files in the
 * project's asset folders. This is the project's CURRENT reference dock, saved
 * with the project. The two folders (`reference/` here, `references/` for
 * groups) are deliberately different words because they hold different things.
 *
 * NOTHING IS EVER DELETED HERE. A save writes what the dock holds; a file that
 * is no longer referenced stays on disk (media is the user's — a save must
 * never destroy it). A manifest entry whose file has gone is dropped on load
 * and reported, not guessed.
 */
const fs = require("fs");
const path = require("path");

const KINDS = { images: "images", videos: "videos", audio: "audio" };
const ROOT = "reference";

function safeFile(name) {
  return path.basename(String(name || "")).replace(/[^A-Za-z0-9._ -]+/g, "_").replace(/^[. ]+/, "").slice(0, 120);
}
function dirFor(projDir, kind) {
  if (!KINDS[kind]) throw new Error(`unknown reference kind: ${kind}`);
  return path.join(projDir, ROOT, KINDS[kind]);
}
function ensureDirs(projDir) {
  for (const k of Object.keys(KINDS)) fs.mkdirSync(dirFor(projDir, k), { recursive: true });
}

/** A unique target name in the kind folder: same name + same bytes = reuse,
 *  same name + different bytes = "name-2.ext". */
function placeBytes(projDir, kind, name, buf) {
  ensureDirs(projDir);
  const d = dirFor(projDir, kind);
  const base = safeFile(name) || "reference.bin";
  const ext = path.extname(base), stem = base.slice(0, base.length - ext.length);
  let out = base;
  for (let n = 2; fs.existsSync(path.join(d, out)); n++) {
    try { if (Buffer.compare(fs.readFileSync(path.join(d, out)), buf) === 0) return out; } catch { /* reread below */ }
    out = `${stem}-${n}${ext}`;
  }
  fs.writeFileSync(path.join(d, out), buf);
  return out;
}

/** Copy a file that already lives somewhere (a project asset) into the kind
 *  folder. Returns the stored name, or null when the source is missing. */
function placeFile(projDir, kind, srcPath) {
  let buf;
  try { buf = fs.readFileSync(srcPath); } catch { return null; }
  return placeBytes(projDir, kind, path.basename(srcPath), buf);
}

/** Normalise a manifest from the wire/disk into the stored shape. */
function normalize(m) {
  const src = m && typeof m === "object" ? m : {};
  const images = (Array.isArray(src.images) ? src.images : []).map((im) => {
    const it = typeof im === "string" ? { file: im } : (im || {});
    const file = safeFile(it.file || it.name);
    if (!file) return null;
    return { file,
             subject: Math.max(1, Math.min(9, parseInt(it.subject, 10) || 1)),
             role: String(it.role || "person").slice(0, 40),
             roleOther: String(it.roleOther || "").slice(0, 40),
             desc: descOf(it.desc) };
  }).filter(Boolean).slice(0, 9);
  const names = (a) => (Array.isArray(a) ? a : []).map((x) => safeFile(typeof x === "string" ? x : (x || {}).file)).filter(Boolean).slice(0, 3);
  const videos = names(src.videos), audio = names(src.audio != null ? src.audio : src.audios);
  return { images, videos, audio, notes: notesKept(src.notes, { videos, audio }) };
}
/* 2.539.0 (Tim: "add an input for all types of references so user can add a brief description of the references"):
   a picture's description rides on its entry (desc); the videos' and sounds' in notes {videos: {file: text}, audio: {...}} */
function descOf(t) { return String(t == null ? "" : t).replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 200); }
/** notes for the files that are in the lists (non-empty only) */
function notesKept(notes, lists) {
  const n = notes && typeof notes === "object" ? notes : {}, out = { videos: {}, audio: {} };
  const L = lists || {};
  for (const f of L.videos || []) { const d = descOf(((n.videos || {})[f])); if (d) out.videos[f] = d; }
  for (const f of L.audio || []) { const d = descOf(((n.audio || n.audios || {})[f])); if (d) out.audio[f] = d; }
  return out;
}

/** Drop manifest entries whose file is not on disk. Returns {manifest, missing}. */
function verify(projDir, manifest) {
  const m = normalize(manifest), missing = [];
  const keep = (kind, file) => {
    if (fs.existsSync(path.join(dirFor(projDir, kind), file))) return true;
    missing.push(`${kind}/${file}`); return false;
  };
  m.images = m.images.filter((im) => keep("images", im.file));
  m.videos = m.videos.filter((f) => keep("videos", f));
  m.audio = m.audio.filter((f) => keep("audio", f));
  m.notes = notesKept(m.notes, m);
  return { manifest: m, missing };
}

function isEmpty(m) {
  const n = normalize(m);
  return !n.images.length && !n.videos.length && !n.audio.length;
}

/** Serve path for GET /projrefs/:kind/:name — basename'd, never traverses. */
function servePath(projDir, kind, name) {
  return path.join(dirFor(projDir, kind), path.basename(String(name || "")));
}

module.exports = { KINDS, ROOT, safeFile, dirFor, ensureDirs, placeBytes, placeFile,
                   normalize, verify, isEmpty, servePath, descOf, notesKept };
