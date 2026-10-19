"use strict";
/**
 * timelines.js — NAMED TIMELINES IN THE PROJECT FOLDER (2.107.0, by instruction).
 *
 * Tim: "save the timeline info in the projects\<project name> folder when
 * project is saved. Load the timeline when the project is loaded. Allow
 * multiple timelines."
 *
 *     projects/<p>/timelines/<name>.json      one file per timeline (the tl object)
 *     projects/<p>/<p>.prj  →  "timeline": "<name>"   which one is ACTIVE
 *
 * The .prj used to carry the timeline inline as `tl`; that still loads (it is
 * migrated into timelines/main.json the first time the project is read), and
 * readProject() always hands the client `data.tl` = the active timeline's
 * contents, so the rest of the app is unchanged. A save writes the active
 * timeline's file and records its name; the Timeline toolbar's dropdown /
 * Save / Save as… call the routes here directly.
 *
 * Nothing is ever deleted implicitly: "Save as" copies, switching changes
 * the active name, only DELETE /api/timelines/:name removes a file.
 */
const fs = require("fs");
const path = require("path");

const DIR = "timelines";
const DEFAULT = "main";
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,60}$/;

function dir(projDir) { const d = path.join(projDir, DIR); fs.mkdirSync(d, { recursive: true }); return d; }
function safe(name) {
  const n = String(name || "").trim();
  if (!n) return DEFAULT;
  if (!NAME_RE.test(n) || n.includes("..")) throw new Error("timeline name: letters, numbers, spaces, . _ - only (max 61 chars)");
  return n;
}
function file(projDir, name) { return path.join(dir(projDir), safe(name) + ".json"); }

/** Empty timeline shape the client expects (mirrors index.html's default tl). */
function empty() {
  const L = { opacity: 1, volume: 1, visible: true, solo: false, muted: false };
  return { video: [], v1: { name: "V1", ...L }, vlayers: [], audio: [], images: [], playhead: 0 };
}

function list(projDir) {
  return fs.readdirSync(dir(projDir)).filter((f) => f.endsWith(".json"))
    .map((f) => {
      const p = path.join(dir(projDir), f);
      let clips = 0;
      try { const t = JSON.parse(fs.readFileSync(p, "utf8")); clips = (t.video || []).length + (t.audio || []).length + (t.images || []).length; } catch { /* count 0 */ }
      return { name: f.slice(0, -5), clips, mtime: fs.statSync(p).mtimeMs / 1000 };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
function read(projDir, name) {
  const p = file(projDir, name);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}
function write(projDir, name, tl) {
  const t = tl && typeof tl === "object" ? tl : empty();
  fs.writeFileSync(file(projDir, name), JSON.stringify(t, null, 2));
  return safe(name);
}
function remove(projDir, name) {
  const p = file(projDir, name);
  if (!fs.existsSync(p)) return false;
  fs.unlinkSync(p);
  return true;
}

/**
 * Resolve the active timeline for a .prj `data` object on read: migrate a
 * legacy inline `tl` into a file, pick the active name, attach `tl`.
 * Mutates and returns data. Never throws on a broken file.
 */
function attach(projDir, data) {
  const d = data && typeof data === "object" ? data : {};
  let name = DEFAULT;
  try { name = safe(d.timeline); } catch { name = DEFAULT; }
  if (d.tl && !fs.existsSync(file(projDir, name))) write(projDir, name, d.tl);   // legacy inline -> file
  const t = read(projDir, name);
  d.timeline = name;
  d.tl = t || d.tl || empty();
  d.timelines = list(projDir);
  return d;
}

/** On save: write the active timeline's file, keep only its name in the .prj. */
function persist(projDir, data) {
  const d = data && typeof data === "object" ? data : {};
  let name = DEFAULT;
  try { name = safe(d.timeline); } catch { name = DEFAULT; }
  if (d.tl !== undefined) write(projDir, name, d.tl);
  d.timeline = name;
  delete d.tl;
  delete d.timelines;
  return d;
}

module.exports = { DIR, DEFAULT, safe, empty, list, read, write, remove, attach, persist };
