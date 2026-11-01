// bitGen Studio — lib/themeStore.js (2.435.0): saved THEMES, one file each - themes/<name>.json in the install folder.
//
// Tim (verbatim): "allow user to save/load themes (save themes to themes\theme name.json)".
//   dir(base?)           <install>/themes (made on first use)
//   safeName(n)          a theme name that is a safe file name ("My Dark", not "../x")
//   clean(t)             a theme record {name, base, vars {ink, panel, ... hex}, accent, scale, saved, styles (2.443.0:
//                        the element styles - static/themeedit.js cleanStyles)}: junk dropped
//   list()               [{name, file, base, vars, accent, scale, saved}] by name
//   read(name)           one, or throws 404
//   save(name, theme)    -> the clean record (the same name = replaced)
//   remove(name)         -> {removed}
// The page side is static/themes.js (Settings ▸ Themes); routes/themes.js serves these.
// 2.636.0 (Tim: "create a default theme that i can revert to in case a theme malfunctions"): "bitGen Default" is BUILT IN -
//   always first in list(), read() gives it, save / remove refuse its name (a theme file can never replace it);
//   static/safetheme.js puts it on (Ctrl+Alt+Shift+T, ?theme=default).
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");
const TE = require("../static/themeedit.js");       // 2.443.0: the element styles' cleaner (the page uses the same)

const VARS = ["ink", "panel", "panel-2", "line", "text", "dim", "tiger", "tiger-deep", "ok", "bad", "ui-hover", "ui-canvas", "ui-on"];
const BASES = ["dark", "darker", "slate", "light", "contrast"];
const MAX = 2 * 1024 * 1024;                         // 2.443.0: element styles may carry small icon pictures
let BASE_DIR = null;                                 // tests point it elsewhere (setBase)
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
function setBase(d) { BASE_DIR = d; }
function dir() { const d = path.join(BASE_DIR || core.BASE, "themes"); fs.mkdirSync(d, { recursive: true }); return d; }
function safeName(n) {
  const b = String(n == null ? "" : n).replace(/\.json$/i, "").replace(/[^A-Za-z0-9 ._()&+-]+/g, "_").replace(/^[.\s_]+/, "").replace(/\s+/g, " ").trim().slice(0, 60);
  return b;
}
const isHex = (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);
function clean(t, name) {
  const o = t && typeof t === "object" ? t : {};
  const vars = {};
  const v = o.vars && typeof o.vars === "object" ? o.vars : {};
  for (const k of VARS) if (isHex(v[k])) vars[k] = v[k].toLowerCase();
  const sc = Math.round(Number(o.scale));
  return { name: safeName(name != null ? name : o.name) || "Theme", base: BASES.includes(o.base) ? o.base : "dark", vars,
    accent: isHex(o.accent) ? o.accent.toLowerCase() : "", scale: Number.isFinite(sc) ? Math.max(60, Math.min(175, sc)) : 100,
    scheme: o.scheme === "light" ? "light" : "dark", styles: TE.cleanStyles(o.styles), saved: typeof o.saved === "string" ? o.saved.slice(0, 40) : new Date().toISOString() };
}
const fileOf = (name) => path.join(dir(), safeName(name) + ".json");
function list() {
  let names = [];
  try { names = fs.readdirSync(dir()).filter((f) => /\.json$/i.test(f)); } catch { names = []; }
  const out = [];
  for (const f of names) {
    try { const raw = JSON.parse(fs.readFileSync(path.join(dir(), f), "utf8")); out.push(Object.assign(clean(raw, f.replace(/\.json$/i, "")), { file: f })); } catch { /* not a theme */ }
  }
  return [defaultTheme()].concat(out.filter((t) => !isDefault(t.name)).sort((a, b) => a.name.localeCompare(b.name)));   // 2.636.0: the default first
}
const DEFAULT_NAME = "bitGen Default";
const isDefault = (n) => safeName(n).toLowerCase() === DEFAULT_NAME.toLowerCase();
/** the built-in default: bitGen's Dark, its own accent, no element styles, UI size 100 % */
function defaultTheme() {
  const T = require("../static/themes.js").THEMES.dark, vars = {};
  for (const k of VARS) if (isHex(T[k])) vars[k] = T[k];
  return Object.assign(clean({ name: DEFAULT_NAME, base: "dark", vars, accent: "", scale: 100, scheme: "dark", styles: {}, saved: "built in" }, DEFAULT_NAME), { file: "", builtin: true });
}
function read(name) {
  const n = safeName(name); if (!n) throw bad("no theme name");
  if (isDefault(n)) return defaultTheme();
  const p = fileOf(n); if (!fs.existsSync(p)) throw bad("no theme called " + n, 404);
  let raw; try { raw = JSON.parse(fs.readFileSync(p, "utf8")); } catch { throw bad("that theme file is not JSON", 422); }
  return Object.assign(clean(raw, n), { file: path.basename(p) });
}
function save(name, theme) {
  const n = safeName(name || (theme && theme.name)); if (!n) throw bad("give the theme a name");
  if (isDefault(n)) throw bad(`"${DEFAULT_NAME}" is built in - save your theme under another name`);
  const rec = clean(Object.assign({}, theme, { saved: new Date().toISOString() }), n);
  if (!Object.keys(rec.vars).length) throw bad("the theme has no colours");
  const txt = JSON.stringify(rec, null, 2) + "\n"; if (txt.length > MAX) throw bad("too big");
  fs.writeFileSync(fileOf(n), txt);
  return Object.assign(rec, { file: n + ".json" });
}
function remove(name) {
  const n = safeName(name); if (!n) throw bad("no theme name");
  if (isDefault(n)) throw bad(`"${DEFAULT_NAME}" is built in - it cannot be deleted`);
  const p = fileOf(n); if (!fs.existsSync(p)) return { removed: false };
  fs.unlinkSync(p); return { removed: true };
}
/* 2.514.0: the WORKING COPY while edit theme mode is on - themes/<name>.tmp (Tim: "when working on theme use theme
   name.tmp"); list() never shows it (only .json), a save / reset removes it */
const tmpOf = (name) => path.join(dir(), safeName(name) + ".tmp");
function saveTmp(name, theme) {
  const n = safeName(name || (theme && theme.name)); if (!n) throw bad("no theme name");
  const rec = clean(Object.assign({}, theme, { saved: new Date().toISOString() }), n);
  const txt = JSON.stringify(rec, null, 2) + "\n"; if (txt.length > MAX) throw bad("too big");
  fs.writeFileSync(tmpOf(n), txt);
  return { name: n, file: n + ".tmp" };
}
function readTmp(name) {
  const n = safeName(name); if (!n) throw bad("no theme name");
  const p = tmpOf(n); if (!fs.existsSync(p)) throw bad("no working copy for " + n, 404);
  let raw; try { raw = JSON.parse(fs.readFileSync(p, "utf8")); } catch { throw bad("that working copy is not JSON", 422); }
  return Object.assign(clean(raw, n), { file: n + ".tmp" });
}
function removeTmp(name) {
  const n = safeName(name); if (!n) throw bad("no theme name");
  const p = tmpOf(n); if (!fs.existsSync(p)) return { removed: false };
  fs.unlinkSync(p); return { removed: true };
}
module.exports = { VARS, BASES, DEFAULT_NAME, defaultTheme, setBase, dir, safeName, clean, list, read, save, remove, saveTmp, readTmp, removeTmp };
