// bitGen Studio — lib/brushStore.js (2.484.0): the image editor's BRUSH PRESETS - brushes/<name>.json in the install
// folder (shared by every project, like patterns/ and themes/). The 🖌 Brush tab's 💾 New Brush Preset… and
// ⤒ Import .abr… keep them here (ext/imageeditdock/brushdyn.js); copy .json files into the folder to share them.
//   dir()               <install>/brushes (made on first use)
//   safeName(n)         a brush name that is a safe file name
//   list()              [{name, preset}] by name (unreadable files are skipped)
//   save(name, preset)  -> {name, size} (a JSON preset up to 8 MB - a sampled tip's picture is in it; same name = replaced)
//   remove(name)        -> {removed}
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");

const MAX = 8 * 1024 * 1024;
let BASE_DIR = null;                                 // tests point it elsewhere (setBase)
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
function setBase(d) { BASE_DIR = d; }
function dir() { const d = path.join(BASE_DIR || core.BASE, "brushes"); fs.mkdirSync(d, { recursive: true }); return d; }
function safeName(n) { return String(n == null ? "" : n).replace(/\.json$/i, "").replace(/[^A-Za-z0-9 ._()&+-]+/g, "_").replace(/^[.\s_]+/, "").replace(/\s+/g, " ").trim().slice(0, 80); }
function list() {
  const out = [];
  for (const f of fs.readdirSync(dir()).filter((x) => /\.json$/i.test(x)).sort((a, b) => a.localeCompare(b))) {
    try { const j = JSON.parse(fs.readFileSync(path.join(dir(), f), "utf8")); if (j && j.preset && j.preset.id) out.push({ name: f.slice(0, -5), preset: j.preset }); } catch { /* skipped */ }
  }
  return out;
}
function save(name, preset) {
  const n = safeName(name); if (!n) throw bad("no brush name");
  if (!preset || typeof preset !== "object") throw bad("no brush preset");
  const p = Object.assign({}, preset, { id: "user:" + n, name: n });
  if (p.tip === "sampled" && (!p.sample || !(p.sample.w > 0) || !(p.sample.h > 0) || typeof p.sample.data !== "string")) throw bad("a sampled brush needs its picture (w, h, base64 data)");
  const text = JSON.stringify({ version: 1, preset: p });
  if (Buffer.byteLength(text) > MAX) throw bad("the brush is too big (8 MB at most)");
  fs.writeFileSync(path.join(dir(), n + ".json"), text);
  return { name: n, size: Buffer.byteLength(text) };
}
function remove(name) {
  const n = safeName(name), p = path.join(dir(), n + ".json");
  if (!n || !fs.existsSync(p)) return { removed: false };
  fs.unlinkSync(p); return { removed: true };
}
module.exports = { dir, safeName, list, save, remove, setBase, MAX };
