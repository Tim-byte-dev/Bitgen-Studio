// bitGen Studio — lib/pageTemplates.js (2.846.0): your own PAGE templates for the image editor's 📄 Page Properties dialog -
// a page's size, orientation, dpi and margins under a name, kept for every project in <app>/page_templates.json.
// Tim (verbatim): "add a page properties dialog, with margin, size, dpi and template dropdown".
"use strict";
const fs = require("fs"), path = require("path");
let BASE = null;
function setBase(b) { BASE = b; }   // tests
const file = () => path.join(BASE || require("./core").BASE, "page_templates.json");
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });
const num = (v, lo, hi, d) => { const x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
function clean(t) {
  const o = t && typeof t === "object" ? t : {}, name = String(o.name || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 60);
  if (!name) throw bad("give the template a name");
  const m = o.margins && typeof o.margins === "object" ? o.margins : {};
  return { name, preset: String(o.preset || "Custom").slice(0, 30), wmm: num(o.wmm, 10, 5000, 210), hmm: num(o.hmm, 10, 5000, 297), orient: o.orient === "landscape" ? "landscape" : "portrait",
    dpi: num(o.dpi, 36, 600, 150), margins: { top: num(m.top, 0, 500, 0), right: num(m.right, 0, 500, 0), bottom: num(m.bottom, 0, 500, 0), left: num(m.left, 0, 500, 0) } };
}
function list() { try { const a = JSON.parse(fs.readFileSync(file(), "utf8")); return Array.isArray(a) ? a.map((t) => { try { return clean(t); } catch (e) { return null; } }).filter(Boolean) : []; } catch (e) { return []; } }
function write(a) { const f = file(); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + ".part", JSON.stringify(a, null, 2)); fs.renameSync(f + ".part", f); }
function save(t) { const c = clean(t), a = list().filter((x) => x.name.toLowerCase() !== c.name.toLowerCase()); a.push(c); a.sort((x, y) => x.name.localeCompare(y.name)); write(a); return c; }
function remove(name) { const a = list(), b = a.filter((x) => x.name.toLowerCase() !== String(name || "").toLowerCase()); if (a.length === b.length) throw bad("no template called " + name, 404); write(b); return { ok: true }; }
module.exports = { setBase, clean, list, save, remove };
