// bitGen Studio — lib/layoutRescue.js (2.891.0): put the dockers back to the default, keeping what was there.
//
// Tim (verbatim): "bitgen crashed again until i reset the dockers and cache". What misc\reset-layout.bat does by hand, the app
// now does by itself (electron/recover.js: the window did not come up twice, it crashed, or the user pressed Reset in
// Settings ▸ Dockers): the install folder's layout files are MOVED (never deleted) into backups\layout-auto-<time>\, and the
// page's own browser storage (the docker memory, the theme ...) is written there as local-storage.json before the page
// clears it - copy them back to undo.
//   FILES                      the layout files (the same list as reset-layout.bat)
//   stamp(d)                   2026-11-20_1405-33 (pure)
//   moveFiles(base, why)       -> {dir, moved: [names]}  (dir made only when something moves or `why` is written)
//   saveStorage(base, storage, dir?) -> {dir, keys}  (local-storage.json, at most 8 MB of keys + values)
//   rescue(base, {storage, files, why}) -> {dir, moved, keys}
"use strict";
const fs = require("fs");
const path = require("path");

const FILES = ["docker_status.json", "docker_status.json.tmp", "dockers.json", "dockers.json.tmp", "docker.cfg", "dialog_layout.cfg",
  "panel_layout.cfg", "workspaces.json", "workspaces.json.tmp"];
const MAX_STORAGE = 8 * 1024 * 1024;

const pad = (n) => String(n).padStart(2, "0");
function stamp(d) { const t = d || new Date(); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}_${pad(t.getHours())}${pad(t.getMinutes())}-${pad(t.getSeconds())}`; }
function newDir(base) {
  const root = path.join(base, "backups");
  let d = path.join(root, "layout-auto-" + stamp()), i = 1;
  while (fs.existsSync(d)) d = path.join(root, "layout-auto-" + stamp() + "-" + (++i));
  fs.mkdirSync(d, { recursive: true });
  return d;
}
function moveFiles(base, why) {
  const there = FILES.filter((f) => { try { return fs.statSync(path.join(base, f)).isFile(); } catch { return false; } });
  if (!there.length && !why) return { dir: "", moved: [] };
  const dir = newDir(base), moved = [];
  for (const f of there) {
    try { fs.renameSync(path.join(base, f), path.join(dir, f)); moved.push(f); }
    catch { try { fs.copyFileSync(path.join(base, f), path.join(dir, f)); fs.unlinkSync(path.join(base, f)); moved.push(f); } catch { /* in use - left */ } }
  }
  try { fs.writeFileSync(path.join(dir, "why.txt"), `${new Date().toISOString()} - ${why || "the dockers were reset"}\nmoved: ${moved.join(", ") || "nothing"}\nCopy these files back into the bitGen Studio folder (with the app closed) to undo.\n`); } catch { /* fine */ }
  return { dir, moved };
}
function saveStorage(base, storage, dir) {
  const s = storage && typeof storage === "object" && !Array.isArray(storage) ? storage : null;
  if (!s) return { dir: dir || "", keys: 0 };
  const out = {}; let size = 0, n = 0;
  for (const [k, v] of Object.entries(s)) {
    const val = String(v == null ? "" : v); size += k.length + val.length;
    if (size > MAX_STORAGE) break;
    out[String(k).slice(0, 300)] = val; n++;
  }
  const d = dir || newDir(base);
  fs.writeFileSync(path.join(d, "local-storage.json"), JSON.stringify(out, null, 1));
  return { dir: d, keys: n };
}
function rescue(base, o) {
  const x = o || {};
  const m = x.files ? moveFiles(base, String(x.why || "Reset the dockers").slice(0, 200)) : { dir: "", moved: [] };
  const st = saveStorage(base, x.storage, m.dir || "");
  const dir = m.dir || st.dir;
  return { dir: dir ? path.relative(base, dir) : "", moved: m.moved, keys: st.keys };
}
module.exports = { FILES, stamp, moveFiles, saveStorage, rescue };
