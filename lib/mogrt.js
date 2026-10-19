// bitGen Studio — lib/mogrt.js (2.417.0): MOTION GRAPHICS TEMPLATES on disk (Premiere's Essential Graphics .mogrt).
// The maths (capture / instantiate / the fields) is static/mogrt.js - shared with the page and the tests.
// Tim: "continue with the next part please the gap is getting smaller - soon bitgen should be superior".
//
//   <app>/mogrt/<id>.json (+ <app>/mogrt/<id>/ its pictures)            built in (shipped, read-only)
//   <app>/mogrt/user/<id>.json (+ <app>/mogrt/user/<id>/ its pictures)  saved from a timeline (every project sees them)
//
//   list()                   -> [{id, name, description, builtin, w, h, len, layers, fields}]
//   get(id)                  -> the template (+ id, builtin)
//   save(tpl)                -> {id} - the pictures it uses are COPIED from this project's images (it travels)
//   remove(id)               -> {ok} (a saved one only)
//   place(id)                -> the template, its pictures copied into this project's images as mg_<id>_<file> and
//                               the clips pointing at them (the page then instantiates it at the playhead)
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const M = require("../static/mogrt.js");

function core() { return require("./core"); }
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
function root() { return core().resolvePath("mogrt"); }
function userDir() { return path.join(root(), "user"); }
function safeId(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48); }
function okId(id) { return /^[a-z0-9][a-z0-9_-]{0,47}$/.test(String(id || "")); }

/** a picture's size (any format ffprobe reads) - null when unknown */
function natOf(file) {
  const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", file], { encoding: "utf8" });
  const m = /^(\d+)x(\d+)/.exec(String(r.stdout || "").trim());
  return m ? { w: +m[1], h: +m[2] } : null;
}

function locate(id) {
  if (!okId(id)) return null;
  const u = path.join(userDir(), id + ".json");
  if (fs.existsSync(u)) return { file: u, dir: path.join(userDir(), id), builtin: false };
  const b = path.join(root(), id + ".json");
  if (fs.existsSync(b)) return { file: b, dir: path.join(root(), id), builtin: true };
  return null;
}
function read(loc, id) {
  const t = M.clean(JSON.parse(fs.readFileSync(loc.file, "utf8")));
  return Object.assign(t, { id, builtin: loc.builtin });
}

function list() {
  const out = new Map();
  const scan = (d, builtin) => {
    let names = [];
    try { names = fs.readdirSync(d).filter((f) => /\.json$/.test(f)); } catch { return; }
    names.forEach((f) => {
      const id = f.replace(/\.json$/, "");
      if (!okId(id)) return;
      try {
        const t = M.clean(JSON.parse(fs.readFileSync(path.join(d, f), "utf8")));
        out.set(id, { id, name: t.name, description: t.description || "", builtin, w: t.w, h: t.h, len: t.len, layers: t.layers.length, fields: M.fields(t) });
      } catch { /* a broken file is skipped */ }
    });
  };
  scan(root(), true);
  scan(userDir(), false);                                    // a saved one with a built-in's id wins
  return Array.from(out.values()).sort((a, b) => (a.builtin === b.builtin ? a.name.localeCompare(b.name) : a.builtin ? -1 : 1));
}

function get(id) {
  const loc = locate(id);
  if (!loc) throw bad("no such template: " + id, 404);
  return read(loc, id);
}

function save(tpl) {
  const t = M.clean(tpl);
  if (!t.layers.length) throw bad("the template has nothing in it");
  const id = safeId(tpl && tpl.id ? tpl.id : t.name) || "template";
  if (!okId(id)) throw bad("give the template a name");
  const imgDir = core().pDir("images");
  const need = M.assets(t);
  const missing = need.filter((n) => !fs.existsSync(path.join(imgDir, n)));
  if (missing.length) throw bad("not in this project's pictures: " + missing.join(", "), 404);
  const dir = path.join(userDir(), id);
  fs.rmSync(dir, { recursive: true, force: true });
  if (need.length) fs.mkdirSync(dir, { recursive: true });
  need.forEach((n) => fs.copyFileSync(path.join(imgDir, n), path.join(dir, n)));
  t.layers.forEach((L) => L.clips.forEach((c) => { if (!c.text && c.name) { const z = natOf(path.join(dir, c.name)); if (z) c.nat = z; } }));
  fs.mkdirSync(userDir(), { recursive: true });
  fs.writeFileSync(path.join(userDir(), id + ".json"), JSON.stringify(t, null, 2) + "\n");
  return { id, name: t.name, fields: t.fields.length, layers: t.layers.length, pictures: need.length };
}

function remove(id) {
  const loc = locate(id);
  if (!loc) throw bad("no such template: " + id, 404);
  if (loc.builtin) throw bad("a built-in template stays (save your own under another name)");
  fs.rmSync(loc.file, { force: true });
  fs.rmSync(loc.dir, { recursive: true, force: true });
  return { ok: true };
}

function place(id) {
  const loc = locate(id);
  if (!loc) throw bad("no such template: " + id, 404);
  const t = read(loc, id);
  const imgDir = core().pDir("images");
  fs.mkdirSync(imgDir, { recursive: true });
  const map = {};
  M.assets(t).forEach((n) => {
    const src = path.join(loc.dir, n);
    if (!fs.existsSync(src)) throw bad("the template's picture is missing: " + n, 404);
    const dst = /^mg_/.test(n) ? n : "mg_" + id + "_" + n;
    const to = path.join(imgDir, dst);
    if (!fs.existsSync(to) || fs.statSync(to).size !== fs.statSync(src).size) fs.copyFileSync(src, to);
    map[n] = dst;
  });
  t.layers.forEach((L) => L.clips.forEach((c) => {
    if (c.text || !map[c.name]) return;
    if (!c.nat) { const z = natOf(path.join(loc.dir, c.name)); if (z) c.nat = z; }        // its size: the designed width kept (static/mogrt.js)
    c.name = map[c.name];
  }));
  return Object.assign(t, { copied: Object.values(map) });
}

module.exports = { list, get, save, remove, place, safeId };
