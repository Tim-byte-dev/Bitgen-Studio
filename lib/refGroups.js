"use strict";
/**
 * refGroups.js — reference groups, ONE FILE PER GROUP (2.82.0).
 *
 * Tim: "reference groups will be stored as filename - reference type,
 * reference type in group name.json". So:
 *
 *     projects/<p>/references/<group name>.json
 *     {
 *       "name":  "band shoot",
 *       "saved": 1787390000,
 *       "items": [
 *         { "file": "a.png",    "type": "image", "subject": 1,
 *           "role": "person", "roleOther": "" },
 *         { "file": "clip.mp4", "type": "video" },
 *         { "file": "song.wav", "type": "sound" }
 *       ]
 *     }
 *
 * Each item is the FILENAME plus its REFERENCE TYPE (image | video | sound —
 * Tim's words, so "sound" rather than the UI's historical "audios"). Image
 * items keep their subject/role assignment, because dropping it would turn a
 * storage change into a feature regression.
 *
 * THE WIRE FORMAT DOES NOT CHANGE. The API and the UI keep speaking
 * {images, videos, audios}; toGroup()/toItems() convert at the edge. A storage
 * refactor that also rewrites the client is two changes wearing one changelog
 * entry, and only one of them was asked for.
 *
 * MIGRATION IS AUTOMATIC AND ONE-WAY. The old store was a single
 * refgroups.json holding every group. On first read, each legacy group is
 * written out as its own file and the old file is renamed to
 * refgroups.json.migrated — renamed, not deleted, because a migration that
 * destroys its input cannot be re-run after a bug in it is found. Per-group
 * files win over the legacy file if both somehow exist.
 *
 * Group names are sanitised to a safe filename charset ON WRITE, and reads
 * only ever path.basename() what they are given: these strings come from the
 * browser and end up in filesystem paths.
 */
const fs = require("fs");
const path = require("path");

const TYPES = ["image", "video", "sound"];

function refsDir(projDir) { return path.join(projDir, "references"); }

/* ONE normaliser, used identically by save, load and delete. The first version
   had byName() run path.basename() BEFORE this, and on Linux a backslash is not
   a separator — so "..\\evil" saved under one spelling and loaded under
   another, and the round trip silently failed. Leading dots are stripped too:
   they cannot traverse once the separators are gone, but ".._evil.json" is a
   hidden file on unix and an alarming one everywhere. */
function safeName(name) {
  return String(name || "").trim()
    .replace(/[^A-Za-z0-9._ -]+/g, "_")
    .replace(/^[. _]+/, "")
    .slice(0, 80).trim();
}

/** {images,videos,audios} (wire) -> items (storage). */
function noteOf(t) { return String(t == null ? "" : t).replace(/\s+/g, " ").trim().slice(0, 200); }   // 2.539.0
function toItems(group) {
  const items = [];
  for (const im of group.images || [])
    items.push({ file: path.basename(String(im.name || "")), type: "image",
                 subject: im.subject, role: im.role, roleOther: im.roleOther, desc: noteOf(im.desc) });
  // 2.539.0: the videos' and sounds' descriptions (the wire: notes {videos: {file: text}, audios | audio: {...}})
  const notes = group.notes || {};
  for (const n of group.videos || [])
    items.push({ file: path.basename(String(n)), type: "video", desc: noteOf((notes.videos || {})[n]) });
  for (const n of group.audios || [])
    items.push({ file: path.basename(String(n)), type: "sound", desc: noteOf((notes.audios || notes.audio || {})[n]) });
  return items.filter((i) => i.file);
}

/** items (storage) -> {images,videos,audios} (wire). */
function toGroup(name, doc) {
  const g = { name, saved: (doc && doc.saved) || 0, images: [], videos: [], audios: [], notes: { videos: {}, audios: {} } };
  for (const it of (doc && doc.items) || []) {
    const file = path.basename(String((it || {}).file || ""));
    if (!file) continue;
    if (it.type === "image")
      g.images.push({ name: file,
                      subject: Math.max(1, Math.min(9, parseInt(it.subject, 10) || 1)),
                      role: String(it.role || "person").slice(0, 40),
                      roleOther: String(it.roleOther || "").slice(0, 40), desc: noteOf(it.desc) });
    else if (it.type === "video") { g.videos.push(file); if (noteOf(it.desc)) g.notes.videos[file] = noteOf(it.desc); }
    else if (it.type === "sound") { g.audios.push(file); if (noteOf(it.desc)) g.notes.audios[file] = noteOf(it.desc); }
    // an unknown type is skipped, not guessed: guessing is how a "sound"
    // entry would end up submitted as a reference video
  }
  return g;
}

/** One-time split of the legacy all-groups file into per-group files. */
function migrate(projDir) {
  const legacy = path.join(projDir, "refgroups.json");
  let doc = null;
  try { doc = JSON.parse(fs.readFileSync(legacy, "utf8")); } catch { return; }
  const groups = Array.isArray(doc && doc.groups) ? doc.groups : [];
  fs.mkdirSync(refsDir(projDir), { recursive: true });
  for (const g of groups) {
    const name = safeName(g.name);
    if (!name) continue;
    const p = path.join(refsDir(projDir), name + ".json");
    // a per-group file that already exists WINS: it is newer by construction,
    // and a re-run of migration must never roll a group backwards
    if (fs.existsSync(p)) continue;
    fs.writeFileSync(p, JSON.stringify(
      { name, saved: g.saved || 0, items: toItems(g) }, null, 2));
  }
  try { fs.renameSync(legacy, legacy + ".migrated"); }
  catch { /* somebody is holding it open; next read tries again */ }
}

function read(projDir) {
  migrate(projDir);
  let files = [];
  try { files = fs.readdirSync(refsDir(projDir)).filter((f) => f.endsWith(".json")); }
  catch { return []; }
  const out = [];
  for (const f of files) {
    try {
      const doc = JSON.parse(fs.readFileSync(path.join(refsDir(projDir), f), "utf8"));
      out.push(toGroup(path.basename(f, ".json"), doc));
    } catch { /* one corrupt group must not hide the rest */ }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/** Save (create or overwrite) one group. Takes the WIRE shape. */
function save(projDir, group) {
  const name = safeName(group.name);
  if (!name) { const e = new Error("name required"); e.status = 400; throw e; }
  fs.mkdirSync(refsDir(projDir), { recursive: true });
  const doc = { name, saved: Date.now() / 1000, items: toItems(group) };
  if (!doc.items.length) {
    const e = new Error("nothing to save — the reference dock is empty");
    e.status = 400; throw e;
  }
  fs.writeFileSync(path.join(refsDir(projDir), name + ".json"),
                   JSON.stringify(doc, null, 2));
  return toGroup(name, doc);
}

function remove(projDir, name) {
  const n = safeName(name);
  const p = path.join(refsDir(projDir), n + ".json");
  if (!fs.existsSync(p)) return false;
  fs.unlinkSync(p);
  return true;
}

function byName(projDir, name) {
  const n = safeName(name);
  try {
    const doc = JSON.parse(fs.readFileSync(
      path.join(refsDir(projDir), n + ".json"), "utf8"));
    return toGroup(n, doc);
  } catch { return null; }
}

module.exports = { read, save, remove, byName, toItems, toGroup, safeName,
                   migrate, refsDir, TYPES };
