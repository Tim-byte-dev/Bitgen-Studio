// lib/slideBrands.js — 🎞 the Slides' BRAND THEMES (2.835.0): <app>/brands/<name>.json, one a brand, for every project.
// Tim: "add charts and tables on slides, or a theme built from brand colours". A brand = {name, bg, title, text, accent,
// accent2, font, titleFont} (ext/slidesdock/slidecore.js cleanBrand checks it). Routes: routes/slides.js /api/slides/brands.
"use strict";
const fs = require("fs"), path = require("path");
const SC = require("../ext/slidesdock/slidecore.js");
let BASE = null;
function setBase(b) { BASE = b; }                         // tests
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });
function dir() { const d = path.join(BASE || require("./core").BASE, "brands"); fs.mkdirSync(d, { recursive: true }); return d; }
const slug = (n) => String(n || "").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 48);
function list() {
  const out = [];
  for (const f of fs.readdirSync(dir()).filter((x) => /\.json$/i.test(x)).sort((a, b) => a.localeCompare(b))) {
    try { const b = SC.cleanBrand(JSON.parse(fs.readFileSync(path.join(dir(), f), "utf8"))); if (b) out.push(b); } catch (e) { /* a broken file is left out */ }
  }
  return { brands: out };
}
function save(b) {
  const c = SC.cleanBrand(b); if (!c) throw bad("a brand needs a name and five #rrggbb colours (background, titles, text, accent 1, accent 2)");
  const n = slug(c.name); if (!n) throw bad("give the brand a name");
  c.name = n; fs.writeFileSync(path.join(dir(), n + ".json"), JSON.stringify(c, null, 2));
  return { brand: c };
}
function remove(name) {
  const n = slug(name); if (!n) throw bad("which brand?");
  fs.rmSync(path.join(dir(), n + ".json"), { force: true }); return { ok: true };
}
module.exports = { setBase, dir, list, save, remove };
