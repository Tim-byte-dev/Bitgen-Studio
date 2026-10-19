// bitGen Studio — RECYCLE BIN (2.223.15, by instruction: "add a checkbox in
// settings-general to confirm delete, if unchecked move the files into
// project name\recycle_bin when the x is pressed on the thumbnail or the
// thumbnail is selected and the del button is pressed. add button at the top
// of the gallery to clear gallery (this just moves the files to the project
// name\recycle_bin)").
//
// One decision lives here: WHERE a "deleted" gallery file goes and HOW it
// gets there. The routes decide WHEN (the ui.confirm_delete flag), the page
// decides whether to ask first. Moves are rename-first (same volume: instant,
// atomic) with a copy+unlink fallback (a project on another drive), and a
// name clash in the bin never overwrites — the incoming file is uniquified
// (name-1.ext, name-2.ext …), because a recycle bin that eats an older
// version of the same name is just a slower delete.
const fs = require("fs");
const path = require("path");
const core = require("./core");

/** The project's bin folder — projects/<name>/recycle_bin, created on use. */
function binDir(project) {
  const d = path.join(core.projDir(project || core.getProject()), "recycle_bin");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/** A name that does not exist in dir yet: name.ext, name-1.ext, name-2.ext … */
function uniquify(dir, name) {
  const ext = path.extname(name), stem = path.basename(name, ext);
  let cand = name, i = 0;
  while (fs.existsSync(path.join(dir, cand))) cand = `${stem}-${++i}${ext}`;
  return cand;
}

/** Move one file into the project's recycle bin. Returns { name, to } —
 *  the name it landed under (possibly uniquified) and the bin folder. */
function recycle(absPath, project) {
  const dir = binDir(project);
  const name = uniquify(dir, path.basename(absPath));
  const dest = path.join(dir, name);
  let size = 0;
  try { size = fs.statSync(absPath).size; } catch { /* reported as 0 */ }
  try { fs.renameSync(absPath, dest); }
  catch {                                   // cross-device: copy, then unlink
    fs.copyFileSync(absPath, dest);
    fs.unlinkSync(absPath);
  }
  // 2.374.0: WHERE it came from, so the bin dialog's ↩ Restore can put it back
  try {
    const root = core.projDir(project || core.getProject());
    const rel = path.relative(root, absPath);
    const from = rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel.split(path.sep).join("/") : absPath;
    const m = readManifest(dir);
    m[name] = { from, at: new Date().toISOString(), size };
    writeManifest(dir, m);
  } catch { /* a missing record only means Restore guesses the folder */ }
  return { name, to: dir };
}

/* ---- THE RECYCLE BIN DIALOG (2.374.0, Tim: "add a recycle bin(icon only) button to the menubar in the left
   docker, create a dialog for the recycle bin, add a menubar to the dialog, restore, delete, empty buttons to the
   menubar. add a titlebar to the recycle bin dialog"). recycle_bin/.recycle.json records each binned file's
   origin (relative to the project folder) and when it was binned. Files binned before 2.374.0 have no record:
   Restore puts them in the project's asset folder for their kind (images / video / sound). ---- */
const MANIFEST = ".recycle.json";
function readManifest(dir) {
  try { const m = JSON.parse(fs.readFileSync(path.join(dir, MANIFEST), "utf8")); return m && typeof m === "object" ? m : {}; }
  catch { return {}; }
}
function writeManifest(dir, m) { fs.writeFileSync(path.join(dir, MANIFEST), JSON.stringify(m, null, 1)); }

const KIND_DIR = [[/\.(png|jpe?g|webp|bmp|gif)$/i, "images", "image"], [/\.(mp4|webm|mov|mkv|avi)$/i, "video", "video"],
                  [/\.(wav|mp3|flac|ogg|m4a|opus)$/i, "sound", "audio"]];
function kindOf(name) { const k = KIND_DIR.find(([rx]) => rx.test(name)); return k ? k[2] : "file"; }
function guessFrom(name) { const k = KIND_DIR.find(([rx]) => rx.test(name)); return (k ? k[1] + "/" : "") + name; }

/** What is in the bin: [{name, from, at, size, kind, guessed}] newest first. */
function list(project) {
  const dir = binDir(project);
  const m = readManifest(dir);
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (f.startsWith(".")) continue;
    let st;
    try { st = fs.statSync(path.join(dir, f)); } catch { continue; }
    if (!st.isFile()) continue;
    const r = m[f] || {};
    out.push({ name: f, from: r.from || guessFrom(f), guessed: !r.from, at: r.at || new Date(st.mtimeMs).toISOString(),
               size: st.size, kind: kindOf(f) });
  }
  return out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

/** A bin entry's file, never outside the bin (null when it is not there). */
function filePath(project, name) {
  const base = path.basename(String(name || ""));
  if (!base || base.startsWith(".")) return null;
  const p = path.join(binDir(project), base);
  return fs.existsSync(p) ? p : null;
}

/** Put entries back where they came from (a name now taken there gets name-1.ext). */
function restore(project, names) {
  const dir = binDir(project);
  const root = core.projDir(project || core.getProject());
  const m = readManifest(dir);
  const restored = [], missing = [];
  for (const n of names || []) {
    const src = filePath(project, n);
    if (!src) { missing.push(String(n)); continue; }
    const base = path.basename(src);
    let from = (m[base] && m[base].from) || guessFrom(base);
    let target = path.isAbsolute(from) ? from : path.join(root, ...from.split("/"));
    // a record that points outside the project (or nowhere sensible) comes back into its asset folder
    const rel = path.relative(root, target);
    if (rel.startsWith("..") || path.isAbsolute(rel)) target = path.join(root, ...guessFrom(base).split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const finalName = fs.existsSync(target) ? uniquify(path.dirname(target), path.basename(target)) : path.basename(target);
    const dest = path.join(path.dirname(target), finalName);
    try { fs.renameSync(src, dest); } catch { fs.copyFileSync(src, dest); fs.unlinkSync(src); }
    delete m[base];
    restored.push({ name: base, to: path.relative(root, dest).split(path.sep).join("/") });
  }
  writeManifest(dir, m);
  return { restored, missing };
}

/** Delete entries for good. */
function remove(project, names) {
  const dir = binDir(project);
  const m = readManifest(dir);
  const deleted = [], missing = [];
  for (const n of names || []) {
    const p = filePath(project, n);
    if (!p) { missing.push(String(n)); continue; }
    fs.unlinkSync(p);
    delete m[path.basename(p)];
    deleted.push(path.basename(p));
  }
  writeManifest(dir, m);
  return { deleted, missing };
}

/** Empty the bin: every file in it deleted for good. */
function empty(project) {
  const names = list(project).map((e) => e.name);
  const r = remove(project, names);
  writeManifest(binDir(project), {});
  return { deleted: r.deleted.length };
}

module.exports = { binDir, uniquify, recycle, list, filePath, restore, remove, empty, kindOf, MANIFEST };
