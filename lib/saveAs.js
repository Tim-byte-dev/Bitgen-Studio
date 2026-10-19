"use strict";
/**
 * saveAs.js — SAVE / SAVE AS FOR A PICTURE, CLIP OR SONG (2.359.0).
 *
 * Tim: "add a save button to the image preview dialog next to the open externally button. add a save as button
 * to the top left of the thumbnails in the gallery button. on save the file to the last save as location".
 *
 *   Save as   the file dialog (static/filedialog.js, mode "save") picks the folder + name; the file is COPIED
 *             there and that folder becomes the last save-as location.
 *   Save      no dialog: the file is copied into the last save-as location under its own name (a name already
 *             there gets " (2)", " (3)" ... - a quick save never overwrites). No location yet = Save as.
 *
 * The source is the URL the page shows (resolve()): /outputs/<name> (the project folder, output/, final/),
 * /passets/<kind>/<name> (the project's assets), /api/fdlg/file?path=<abs>. Anything else (a blob: or data:
 * picture, a reference held only by the page) is uploaded by the page instead (routes/saveAs.js /upload).
 * The last location is workspace/save_as.json - one per install, every project.
 */
const fs = require("fs");
const path = require("path");
const core = require("./core");

const FILE_NAME = "save_as.json";
function file() { return path.join(core.WORKSPACE, FILE_NAME); }

/** The last save-as folder: {dir, exists} (dir "" = never saved). */
function last() {
  let dir = "";
  try { dir = String((JSON.parse(fs.readFileSync(file(), "utf8")) || {}).dir || ""); } catch { dir = ""; }
  let exists = false;
  try { exists = !!dir && fs.statSync(dir).isDirectory(); } catch { exists = false; }
  return { dir, exists };
}

function remember(dir) {
  try {
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    fs.writeFileSync(file(), JSON.stringify({ dir, at: new Date().toISOString() }, null, 2));
  } catch { /* the save itself happened - the memory is best effort */ }
}

/** The file behind a URL the page shows, or null (absolute path). */
function resolve(url) {
  let u;
  try { u = new URL(String(url || ""), "http://x"); } catch { return null; }
  const parts = u.pathname.split("/").filter(Boolean).map((x) => { try { return decodeURIComponent(x); } catch { return x; } });
  const proj = core.projDir(core.getProject());
  const hit = (p) => { try { return fs.statSync(p).isFile() ? p : null; } catch { return null; } };
  if (parts[0] === "outputs" && parts.length === 2) {
    const name = path.basename(parts[1]);
    for (const d of [proj, core.pDir("output"), path.join(proj, "final")]) {
      const p = hit(path.join(d, name));
      if (p) return p;
    }
    return null;
  }
  if (parts[0] === "passets" && parts.length === 3) {
    const kind = ["images", "video", "sound"].includes(parts[1]) ? parts[1] : "images";
    return hit(path.join(core.pDir(kind), path.basename(parts[2])));
  }
  if (u.pathname === "/api/fdlg/file" && u.searchParams.get("path"))
    return hit(path.resolve(u.searchParams.get("path")));
  return null;
}

/** "name.png" -> the first free "name.png" / "name (2).png" / ... in dir. */
function freeName(dir, name) {
  const ext = path.extname(name), stem = name.slice(0, name.length - ext.length);
  let n = name, k = 2;
  while (fs.existsSync(path.join(dir, n))) n = `${stem} (${k++})${ext}`;
  return n;
}

/** A file name the OS takes: no folders, no reserved characters, not empty. */
function safeName(name, fallback) {
  const b = path.basename(String(name || "").replace(/\\/g, "/")).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim();
  return b && b !== "." && b !== ".." ? b : (fallback || "file");
}

/**
 * Copy `src` (abs path) out. o = {dest (abs file path) | dir + name, overwrite}. With no dest and no dir the
 * last save-as location is used (Save). -> {ok, path, dir, name, renamed} | {error, status, need_dir}.
 * Only Save as (o.remember !== false with a dest) moves the remembered location.
 */
function copyOut(src, o) {
  const opt = o || {};
  if (!src || !fs.existsSync(src)) return { status: 404, error: "the file is not on disk any more" };
  let dir, name;
  if (opt.dest) {
    const d = path.resolve(String(opt.dest));
    dir = path.dirname(d); name = safeName(path.basename(d), path.basename(src));
  } else {
    dir = opt.dir ? path.resolve(String(opt.dir)) : last().dir;
    name = safeName(opt.name || path.basename(src), path.basename(src));
  }
  if (!dir) return { status: 409, need_dir: true, error: "no save-as location yet - use Save as once to pick one" };
  let st = null;
  try { st = fs.statSync(dir); } catch { st = null; }
  if (!st || !st.isDirectory()) return { status: 409, need_dir: true, error: `the save-as folder is gone: ${dir} - use Save as to pick another` };
  const asked = name;
  if (!opt.overwrite) name = freeName(dir, name);
  const dest = path.join(dir, name);
  if (path.resolve(dest) === path.resolve(src)) return { ok: true, path: dest, dir, name, same: true, renamed: false };
  try { fs.copyFileSync(src, dest); }
  catch (e) { return { status: 500, error: `could not write ${dest}: ${e.message}` }; }
  if (opt.dest && opt.remember !== false) remember(dir);
  return { ok: true, path: dest, dir, name, renamed: name !== asked };
}

module.exports = { FILE_NAME, file, last, remember, resolve, freeName, safeName, copyOut };
