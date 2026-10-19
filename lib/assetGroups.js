// bitGen Studio — ASSET GROUPS + asset delete (2.327.0).
//
// Tim (verbatim): "allow user to select multiple items from the asset folder
// and group them. allow user to delete assets (send to recycle bin) create
// new folders for groups, allow user to add assets to group or send asset to
// a group". Answers: groups are FOLDERS IN THE DOCK (the files never move -
// every scene take, timeline clip, reference and the .prj keep finding them
// by name) · a group can mix pictures, videos and sounds · ADD = the asset
// is also in that group (it can sit in several), SEND = it moves out of its
// current group into the new one.
//
// One record per project: projects/<p>/asset_groups.json
//   { groups: [ { id, name, items: [ {kind, name} ] } ] }
// kind is images | video | sound (the asset folders). Pure state functions
// (tested) + load / save; routes/assets.js is the HTTP skin. Deleting an
// asset is lib/recycleBin (projects/<p>/recycle_bin, never a hard delete)
// plus dropping it from every group; usage() warns when a file is still
// named in the project file (a scene take, a timeline clip, a reference).
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = "asset_groups.json";
const KINDS = ["images", "video", "sound"];
const MAX_NAME = 80;

function blank() { return { groups: [] }; }

function cleanItem(it) {
  if (!it || typeof it !== "object") return null;
  const kind = String(it.kind || "");
  const name = path.basename(String(it.name || ""));
  if (!KINDS.includes(kind) || !name || name === "." || name === "..") return null;
  return { kind, name };
}
const keyOf = (it) => it.kind + "/" + it.name;

function safe(s) {
  const out = blank();
  if (!s || !Array.isArray(s.groups)) return out;
  const seenNames = new Set();
  for (const g of s.groups) {
    if (!g || typeof g !== "object") continue;
    const name = String(g.name || "").trim().slice(0, MAX_NAME);
    if (!name || seenNames.has(name.toLowerCase())) continue;
    seenNames.add(name.toLowerCase());
    const seen = new Set(), items = [];
    for (const it of Array.isArray(g.items) ? g.items : []) {
      const c = cleanItem(it);
      if (c && !seen.has(keyOf(c))) { seen.add(keyOf(c)); items.push(c); }
    }
    out.groups.push({ id: String(g.id || "").replace(/[^a-z0-9]/gi, "").slice(0, 24) || newId(), name, items });
  }
  return out;
}

function newId() { return crypto.randomBytes(6).toString("hex"); }

function fileFor(projDir) { return path.join(projDir, FILE); }
function load(projDir) {
  try { return safe(JSON.parse(fs.readFileSync(fileFor(projDir), "utf8"))); } catch { return blank(); }
}
function save(projDir, state) {
  const s = safe(state);
  fs.mkdirSync(projDir, { recursive: true });
  fs.writeFileSync(fileFor(projDir), JSON.stringify(s, null, 2));
  return s;
}

function items(list) {
  const out = [], seen = new Set();
  for (const it of Array.isArray(list) ? list : []) {
    const c = cleanItem(it);
    if (c && !seen.has(keyOf(c))) { seen.add(keyOf(c)); out.push(c); }
  }
  return out;
}

function checkName(state, name, exceptId) {
  const n = String(name == null ? "" : name).trim();
  if (!n) return { error: "a group needs a name" };
  if (n.length > MAX_NAME) return { error: `a group name is at most ${MAX_NAME} characters` };
  if (state.groups.some((g) => g.id !== exceptId && g.name.toLowerCase() === n.toLowerCase()))
    return { error: `there is already a group called "${n}"` };
  return { name: n };
}

const find = (state, id) => state.groups.find((g) => g.id === String(id || ""));

/** A new group, optionally holding `list` already (the "Group" button). */
function create(state, name, list) {
  const s = safe(state);
  const c = checkName(s, name);
  if (c.error) return { state: s, error: c.error };
  const g = { id: newId(), name: c.name, items: items(list) };
  s.groups.push(g);
  return { state: s, group: g };
}

function rename(state, id, name) {
  const s = safe(state);
  const g = find(s, id);
  if (!g) return { state: s, error: "no such group" };
  const c = checkName(s, name, g.id);
  if (c.error) return { state: s, error: c.error };
  g.name = c.name;
  return { state: s, group: g };
}

/** Delete a GROUP: its assets stay (in their other groups, or ungrouped). */
function remove(state, id) {
  const s = safe(state);
  const before = s.groups.length;
  s.groups = s.groups.filter((g) => g.id !== String(id || ""));
  return before === s.groups.length ? { state: s, error: "no such group" } : { state: s };
}

/** ADD: also in this group (other groups untouched). */
function add(state, id, list) {
  const s = safe(state);
  const g = find(s, id);
  if (!g) return { state: s, error: "no such group" };
  const have = new Set(g.items.map(keyOf));
  let added = 0;
  for (const it of items(list)) if (!have.has(keyOf(it))) { g.items.push(it); have.add(keyOf(it)); added++; }
  return { state: s, group: g, added };
}

/** SEND: moves into this group. `from` (a group id) = out of that group
 *  only; no `from` = out of every other group. */
function send(state, id, list, from) {
  const s = safe(state);
  const g = find(s, id);
  if (!g) return { state: s, error: "no such group" };
  const keys = new Set(items(list).map(keyOf));
  for (const o of s.groups) {
    if (o.id === g.id) continue;
    if (from && o.id !== String(from)) continue;
    o.items = o.items.filter((it) => !keys.has(keyOf(it)));
  }
  const r = add(s, id, list);
  return { ...r, state: r.state };
}

/** Take assets out of one group (the files stay). */
function ungroup(state, id, list) {
  const s = safe(state);
  const g = find(s, id);
  if (!g) return { state: s, error: "no such group" };
  const keys = new Set(items(list).map(keyOf));
  g.items = g.items.filter((it) => !keys.has(keyOf(it)));
  return { state: s, group: g };
}

/** Drop assets from EVERY group (after a delete). */
function forget(state, list) {
  const s = safe(state);
  const keys = new Set(items(list).map(keyOf));
  for (const g of s.groups) g.items = g.items.filter((it) => !keys.has(keyOf(it)));
  return { state: s };
}

/** Drop items whose file is gone (renamed / deleted outside the app). */
function prune(state, exists) {
  const s = safe(state);
  let dropped = 0;
  for (const g of s.groups) {
    const keep = g.items.filter((it) => exists(it));
    dropped += g.items.length - keep.length;
    g.items = keep;
  }
  return { state: s, dropped };
}

/** Which of `list` the project file still names (a scene take, a timeline
 *  clip, a reference) - the delete asks before moving those. */
function usage(prjText, list) {
  const t = String(prjText || "");
  return items(list).filter((it) => t.includes(JSON.stringify(it.name).slice(1, -1)));
}

module.exports = { FILE, KINDS, MAX_NAME, blank, safe, load, save, fileFor, items, create, rename, remove,
                   add, send, ungroup, forget, prune, usage, keyOf };
