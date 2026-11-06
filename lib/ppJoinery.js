// bitGen Studio — lib/ppJoinery.js (2.689.0): THE SKETCHER'S CUPBOARD / SHELVING TEMPLATES - the ones you save from the
// 🗄 Cupboards & shelving dialog (ext/pushpulldock/ppjoinerydlg.js). Kept for EVERY project in <app>/joinery/templates.json
// ({templates: [{id, name, spec, saved}], saved}) - user data (.gitignore). The built-in ones live in the page
// (ext/pushpulldock/ppjoinery.js PRESETS). Used by routes/ppJoinery.js.
// Tim (verbatim): "add a shelf/cupboard dialog for builtin cupboards, walk-in robes etc. must be customizable and be able to
// save as template"
//   list()         [{id, name, spec, saved}]
//   save(t)        {id?, name, spec}: a new one gets an id; the same id (or the same name) is replaced -> {template, templates}
//   remove(id)     -> {ok, templates}
//   dir / file     where they are (tests point CORE's BASE elsewhere through BITGEN_JOINERY_DIR)
"use strict";
const fs = require("fs");
const path = require("path");
const J = require("../ext/pushpulldock/ppjoinery.js");

const MAX = 300;
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
const dir = () => process.env.BITGEN_JOINERY_DIR || path.join(require("./core").BASE, "joinery");
const file = () => path.join(dir(), "templates.json");
function read() {
  try { const o = JSON.parse(fs.readFileSync(file(), "utf8")); return Array.isArray(o.templates) ? o.templates : []; } catch { return []; }
}
function soft(t) {
  if (!t || typeof t !== "object" || typeof t.id !== "string" || !/^[a-z0-9_-]{1,40}$/.test(t.id)) return null;
  const spec = J.clean(t.spec);
  return { id: t.id, name: String(t.name || spec.name).trim().slice(0, 60) || spec.name, spec, saved: typeof t.saved === "string" ? t.saved : "" };
}
function list() { return read().map(soft).filter(Boolean); }
function write(all) {
  fs.mkdirSync(dir(), { recursive: true });
  const tmp = file() + ".part";
  fs.writeFileSync(tmp, JSON.stringify({ templates: all, saved: new Date().toISOString() }, null, 1));
  fs.renameSync(tmp, file());
}
function save(t) {
  if (!t || typeof t !== "object" || !t.spec || typeof t.spec !== "object") throw bad("a template is {name, spec}");
  const name = String(t.name || (t.spec && t.spec.name) || "").trim().slice(0, 60);
  if (!name) throw bad("give the template a name");
  if (t.id != null && t.id !== "" && (typeof t.id !== "string" || !/^[a-z0-9_-]{1,40}$/.test(t.id))) throw bad("that id is not one of yours (a built-in template cannot be changed - save it under a new name)");
  const all = list(), spec = J.clean(Object.assign({}, t.spec, { name }));
  let i = t.id ? all.findIndex((x) => x.id === t.id) : -1;
  if (i < 0) i = all.findIndex((x) => x.name.toLowerCase() === name.toLowerCase());   // the same name = replace it
  const one = { id: i >= 0 ? all[i].id : "j" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, spec, saved: new Date().toISOString() };
  if (i >= 0) all[i] = one; else { if (all.length >= MAX) throw bad("there are " + MAX + " templates already - delete some first"); all.push(one); }
  write(all);
  return { template: one, templates: all };
}
function remove(id) {
  const all = list(), next = all.filter((x) => x.id !== id);
  if (next.length === all.length) throw bad("no template " + id, 404);
  write(next);
  return { ok: true, templates: next };
}
module.exports = { list, save, remove, dir, file, MAX };
