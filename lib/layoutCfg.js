// bitGen Studio — lib/layoutCfg.js (2.438.0): where windows were left - one JSON file each in the install folder.
//
// Tim (verbatim): "put message boxes and dialogs in the center of the screen by default. remember their locations if
// moved in file dialog_layout.cfg/ load their last positions from that file" + the floating dockers (the image editor's
// Layers / Colour groups, the empty named dockers) kept in panel_layout.cfg.
//   FILES               {dialog: "dialog_layout.cfg", panel: "panel_layout.cfg", basic: "basic.cfg" (2.559.0 Basic Settings),
//                        folders: "folder_filters.cfg" (2.559.0 the folder each folder filter dropdown was left on)}
//   file(name)          the path (throws 404 for another name)
//   read(name)          the object ({} when there is none / it is broken)
//   write(name, obj)    the whole object (<= 512 KB) -> it
//   merge(name, part)   top-level keys replaced (a key set to null is removed) -> the whole object
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");

// 2.559.0: + basic (Basic Settings - static/basiccfg.js) and folders (every folder filter's folder - static/folderfilter.js)
const FILES = { dialog: "dialog_layout.cfg", panel: "panel_layout.cfg", basic: "basic.cfg", folders: "folder_filters.cfg" };
const MAX = 512 * 1024;
let BASE_DIR = null;
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
function setBase(d) { BASE_DIR = d; }
function file(name) { const f = FILES[name]; if (!f) throw bad("no such layout: " + name, 404); return path.join(BASE_DIR || core.BASE, f); }
function read(name) {
  try { const o = JSON.parse(fs.readFileSync(file(name), "utf8")); return o && typeof o === "object" && !Array.isArray(o) ? o : {}; }
  catch (e) { if (e.status) throw e; return {}; }
}
function write(name, obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw bad("a layout is an object");
  const s = JSON.stringify(obj, null, 1);
  if (s.length > MAX) throw bad("the layout is over 512 KB");
  const p = file(name);
  fs.writeFileSync(p + ".part", s); fs.renameSync(p + ".part", p);
  return obj;
}
function merge(name, part) {
  const o = read(name);
  for (const [k, v] of Object.entries(part || {})) { if (v === null) delete o[k]; else o[k] = v; }
  return write(name, o);
}

module.exports = { FILES, setBase, file, read, write, merge, MAX };
