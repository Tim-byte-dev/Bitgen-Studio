// bitGen Studio — lib/basicTmp.js (2.615.0): BASIC SETTINGS KEPT PER STYLE in misc/basic_settings.tmp.
//
// Tim (verbatim): "when user changes a style anywhere in bitgen, save the all basic settings+style name in basic settings
// docker to misc\basic_settings.tmp. if the file does not exist , create it . this operation must be done before changing
// the style. load the basic settings on start with the last style used before previous session closed and when style
// changes. if basic settings change for a style change the settings in the file when user changes style - so if user is
// testing different styles and basic settings it will be easier".
//
// The file (JSON):  {version: 1, last: {video: id, image: id}, lastKind, updated,
//                    styles: {"video:<id>": {kind, id, style: <name>, saved: <iso>, basic: {<field id>: value ...}}, ...}}
//   key(kind, id)          "video:<id>" / "image:<id>" ("" = no style picked - "— template —")
//   read()                 the object (a fresh one when there is no file / it is broken)
//   save(o)                {kind, id, name, basic, last?} -> that style's entry written (the file made when missing);
//                          last !== false also makes it the kind's last style
//   setLast(kind, id)      the kind's last style only
// Used by routes/basicTmp.js (GET / POST /api/basic-settings/styles) - static/stylebasic.js is the page side.
"use strict";
const fs = require("fs");
const path = require("path");

const MAX = 2 * 1024 * 1024, MAX_STYLES = 500;
let FILE = null;
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
function file() { return FILE || path.join(require("./core").MISC, "basic_settings.tmp"); }
function setFile(f) { FILE = f; }
const KINDS = ["video", "image"];
function kindOf(k) { if (KINDS.indexOf(String(k)) < 0) throw bad("kind is video or image"); return String(k); }
function key(kind, id) { return kindOf(kind) + ":" + String(id == null ? "" : id).slice(0, 200); }
function fresh() { return { version: 1, last: {}, lastKind: "", updated: "", styles: {} }; }
function read() {
  try {
    const o = JSON.parse(fs.readFileSync(file(), "utf8"));
    if (!o || typeof o !== "object" || Array.isArray(o)) return fresh();
    return Object.assign(fresh(), o, { last: o.last && typeof o.last === "object" ? o.last : {}, styles: o.styles && typeof o.styles === "object" ? o.styles : {} });
  } catch { return fresh(); }
}
/** only plain values: {id: string | number | boolean} (the Basic Settings fields) */
function cleanBasic(b) {
  if (!b || typeof b !== "object" || Array.isArray(b)) throw bad("basic is an object of field values");
  const o = {};
  for (const [k, v] of Object.entries(b)) {
    if (!/^[\w.:-]{1,80}$/.test(k)) continue;
    if (typeof v === "boolean" || typeof v === "number") o[k] = v;
    else if (typeof v === "string") o[k] = v.slice(0, 4000);
  }
  return o;
}
function write(o) {
  const s = JSON.stringify(o, null, 1);
  if (s.length > MAX) throw bad("basic_settings.tmp would be over 2 MB");
  const f = file();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f + ".part", s); fs.renameSync(f + ".part", f);
  return o;
}
function save(b) {
  const p = b || {}, kind = kindOf(p.kind), id = String(p.id == null ? "" : p.id), k = key(kind, id);
  const o = read();
  o.styles[k] = { kind, id, style: String(p.name == null ? id : p.name).slice(0, 200), saved: new Date().toISOString(), basic: cleanBasic(p.basic) };
  const keys = Object.keys(o.styles);
  if (keys.length > MAX_STYLES) keys.sort((x, y) => String(o.styles[x].saved).localeCompare(String(o.styles[y].saved))).slice(0, keys.length - MAX_STYLES).forEach((x) => { delete o.styles[x]; });
  if (p.last !== false) { o.last[kind] = id; o.lastKind = kind; }
  o.updated = new Date().toISOString();
  return write(o);
}
function setLast(kind, id) {
  const o = read(); o.last[kindOf(kind)] = String(id == null ? "" : id); o.lastKind = kind; o.updated = new Date().toISOString();
  return write(o);
}
module.exports = { file, setFile, key, read, save, setLast, cleanBasic, fresh, MAX_STYLES };
