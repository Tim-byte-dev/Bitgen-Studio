// bitGen Studio — lib/pushPull.js (2.619.0): the 📏 PushPull docker's MODELS, kept per project
// (projects/<project>/pushpull/<name>.pp3d - JSON: {model, view, saved}). Used by routes/pushPull.js.
// Tim (verbatim): "can we add a final docker, i feel this one will complete bitgen ... looks like a sketchup".
//   list()            [{name, saved, size}] newest first
//   read(name)        the file's object (404 when there is none)
//   write(name, obj)  {model: {v, f, e, g, n}, view?} (<= 32 MB) -> {name, saved}
//   remove(name)      moved to the project's recycle bin when there is one, else deleted
//   nameOf(s)         a safe file name (letters, digits, space . _ - ( ))
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");

const MAX = 32 * 1024 * 1024;
let DIR = null;
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
function setDir(d) { DIR = d; }
function dir() { const d = DIR || path.join(core.projDir(core.getProject()), "pushpull"); fs.mkdirSync(d, { recursive: true }); return d; }
function nameOf(s) {
  const n = String(s == null ? "" : s).split(/[\\/]/).pop().replace(/\.pp3d$/i, "").replace(/[^\w .()-]+/g, "_").replace(/^[.\s_]+/, "").trim().slice(0, 80);
  if (!n) throw bad("give the model a name");
  return n;
}
const fileOf = (name) => path.join(dir(), nameOf(name) + ".pp3d");
function list() {
  return fs.readdirSync(dir()).filter((f) => /\.pp3d$/i.test(f)).map((f) => { const st = fs.statSync(path.join(dir(), f)); return { name: f.replace(/\.pp3d$/i, ""), saved: st.mtimeMs, size: st.size }; })
    .sort((a, b) => b.saved - a.saved);
}
function read(name) {
  const f = fileOf(name);
  if (!fs.existsSync(f)) throw bad("no model " + nameOf(name), 404);
  try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { throw bad("that model file is damaged", 422); }
}
function write(name, obj) {
  const o = obj || {}, m = o.model;
  if (!m || typeof m !== "object" || !Array.isArray(m.v) || !Array.isArray(m.f)) throw bad("a model is {v, f, e, g}");
  const s = JSON.stringify({ model: { v: m.v, f: m.f, e: Array.isArray(m.e) ? m.e : [], g: Array.isArray(m.g) ? m.g : [], n: +m.n || 1, ...(m.arch && typeof m.arch === "object" ? { arch: m.arch } : {}) }, view: o.view && typeof o.view === "object" ? o.view : null, saved: Date.now() });
  if (s.length > MAX) throw bad("the model is over 32 MB", 413);
  const f = fileOf(name);
  fs.writeFileSync(f + ".part", s); fs.renameSync(f + ".part", f);
  return { name: nameOf(name), saved: Date.now() };
}
function remove(name) {
  const f = fileOf(name);
  if (!fs.existsSync(f)) throw bad("no model " + nameOf(name), 404);
  if (!DIR) { try { require("./recycleBin").recycle(f, core.getProject()); return { ok: true, recycled: true }; } catch { /* plain delete */ } }
  fs.unlinkSync(f); return { ok: true };
}
module.exports = { list, read, write, remove, nameOf, setDir, MAX };
