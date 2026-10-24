// bitGen Studio — lib/layouts.js (2.587.0): FULL DOCKER LAYOUTS - layouts/<name>.json in the install folder.
//
// Tim: "allow user to export/import theme and dockers layout . themes will be saved in themes and full docker layouts
// folder which i can copy into the repo and make it the default theme/layout".
//
//   A LAYOUT  {version, name, saved, files: {"docker_status.json", "docker.cfg", "panel_layout.cfg", "dialog_layout.cfg",
//             "workspaces.json"} (the install folder's layout files as they are), local: {h3.* keys - the page's own
//             layout memory: which dockers are hidden / turned off, their sizes}, theme: the theme record (static/themes.js
//             snapshot) | null}
//   save(name, {local, theme}) / list() / read(name) / remove(name) / importRec(rec, name?)
//   apply(name)   the files written back (one the layout has not = removed, so the app's default is used), and for a few
//                 seconds the page's own layout saves are ignored (lock / locked) - the page that asked reloads, and
//                 its closing saves must not write the old layout over the new one -> {local, theme}
//   seed()        a FRESH install (no docker_status.json yet) with layouts/default.json starts from it - copy a layout
//                 into the repo's layouts/ as default.json (and a theme as themes/default.json) to make it the default
// Pure: safeName, clean (scripts/test-layouts587.js).
"use strict";
const fs = require("fs");
const path = require("path");

const FILES = ["docker_status.json", "docker.cfg", "panel_layout.cfg", "dialog_layout.cfg", "workspaces.json"];
const LOCAL_KEY = /^h3\.[A-Za-z0-9_.:+-]{1,100}$/;
const MAX = 4 * 1024 * 1024;
let BASE_DIR = null, lockUntil = 0, seeded = null;
const base = () => BASE_DIR || require("./core").BASE;
function setBase(d) { BASE_DIR = d; }
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
function dir() { const d = path.join(base(), "layouts"); fs.mkdirSync(d, { recursive: true }); return d; }

/** a layout name that is a safe file name (pure) */
function safeName(n) {
  const s = String(n || "").replace(/\.json$/i, "").replace(/[^A-Za-z0-9 _()&+.-]+/g, "_").replace(/^[ ._-]+|[ ._-]+$/g, "").slice(0, 60);
  if (!s || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(s)) return "";
  return s;
}
/** a layout record with only what belongs in it (pure) */
function clean(rec, name) {
  const r = rec && typeof rec === "object" ? rec : {};
  const files = {};
  for (const f of FILES) { const v = r.files && r.files[f]; if (v && typeof v === "object" && !Array.isArray(v)) files[f] = v; }
  const local = {};
  let size = 0;
  for (const [k, v] of Object.entries(r.local && typeof r.local === "object" ? r.local : {})) {
    if (!LOCAL_KEY.test(k) || /^h3\.(theme|accent|scale|themeVars|themeName|themeStyles)/.test(k)) continue;   // the theme rides in `theme`
    const s = String(v == null ? "" : v); if (s.length > 20000) continue;
    size += k.length + s.length; if (size > 512 * 1024) break;
    local[k] = s;
  }
  const theme = r.theme && typeof r.theme === "object" && r.theme.vars ? r.theme : null;
  return { version: 1, name: safeName(name || r.name) || "layout", saved: r.saved || new Date().toISOString(), files, local, theme };
}
const readJ = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
function current() { const out = {}; for (const f of FILES) { const v = readJ(path.join(base(), f)); if (v) out[f] = v; } return out; }

function save(name, o) {
  const n = safeName(name); if (!n) throw bad("give the layout a name");
  const rec = clean({ name: n, saved: new Date().toISOString(), files: current(), local: (o || {}).local, theme: (o || {}).theme }, n);
  const txt = JSON.stringify(rec, null, 1);
  if (txt.length > MAX) throw bad("that layout is too big (" + Math.round(txt.length / 1024) + " KB)");
  fs.writeFileSync(path.join(dir(), n + ".json"), txt);
  return { name: n, file: "layouts/" + n + ".json", docks: Object.keys((rec.files["docker_status.json"] || {}).docks || {}).length, theme: rec.theme ? rec.theme.name || rec.theme.base : "" };
}
function list() {
  let fsx = []; try { fsx = fs.readdirSync(dir()).filter((f) => /\.json$/i.test(f)); } catch { fsx = []; }
  return fsx.map((f) => { const r = readJ(path.join(dir(), f)); if (!r) return null; return { name: f.replace(/\.json$/i, ""), saved: r.saved || "", files: Object.keys(r.files || {}), theme: r.theme ? r.theme.name || r.theme.base || "yes" : "", default: /^default\.json$/i.test(f) }; })
    .filter(Boolean).sort((a, b) => (b.default - a.default) || a.name.localeCompare(b.name));
}
function read(name) { const n = safeName(name); const r = n ? readJ(path.join(dir(), n + ".json")) : null; if (!r) throw bad("no layout " + name, 404); return clean(r, n); }
function remove(name) { const n = safeName(name); try { fs.unlinkSync(path.join(dir(), n + ".json")); return { removed: n }; } catch { throw bad("no layout " + name, 404); } }
function importRec(rec, name) {
  if (!rec || typeof rec !== "object" || !rec.files || typeof rec.files !== "object") throw bad("not a bitGen layout (.json with files)");
  const r = clean(rec, name || rec.name);
  if (!Object.keys(r.files).length && !Object.keys(r.local).length) throw bad("that layout has nothing in it");
  fs.writeFileSync(path.join(dir(), r.name + ".json"), JSON.stringify(r, null, 1));
  return { name: r.name, file: "layouts/" + r.name + ".json" };
}
function writeFiles(r) {
  for (const f of FILES) {
    const p = path.join(base(), f);
    if (r.files[f]) { const tmp = p + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(r.files[f], null, 2)); fs.renameSync(tmp, p); }
    else { try { fs.unlinkSync(p); } catch { /* none */ } }
  }
}
function apply(name, lockMs) {
  const r = read(name);
  writeFiles(r);
  lockUntil = Date.now() + (lockMs == null ? 6000 : lockMs);
  return { name: r.name, local: r.local, theme: r.theme, files: Object.keys(r.files) };
}
const locked = () => Date.now() < lockUntil;
function unlock() { lockUntil = 0; }
/** a fresh install starts from layouts/default.json (once: docker_status.json is then there) */
function seed() {
  try {
    if (fs.existsSync(path.join(base(), "docker_status.json"))) return null;
    const p = path.join(base(), "layouts", "default.json");
    if (!fs.existsSync(p)) return null;
    const r = clean(readJ(p) || {}, "default");
    writeFiles(r);
    seeded = { name: "default", token: String(r.saved || Date.now()), local: r.local, theme: r.theme };
    return seeded;
  } catch { return null; }
}
const seededInfo = () => seeded;

module.exports = { FILES, safeName, clean, current, save, list, read, remove, importRec, apply, locked, unlock, seed, seededInfo, setBase };
