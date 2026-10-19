// bitGen Studio — THE FILE DIALOG's file-system side (2.326.0).
//
// Tim (verbatim): "please create a file select and folder select dialog that
// looks and behaves like the windows 11 ones, but build it with nodejs and
// python. we will replace all the folder select and file select with these
// dialogs to try and make the app cross platform compatible".
// Answers: replace ALL three pickers (the Windows-only PowerShell picker,
// the old in-app path browser, the browser "Choose File" uploads) · Python
// does thumbnails + system info (scripts/fdlg_helper.py, lib/fdlgHelper.js)
// · thumbnails + view modes, search, new folder + rename, multi-select.
//
// This file is the plain file-system half, the same on Windows, macOS and
// Linux: list a folder, search under it, make a folder, rename an item,
// check a typed path. Names are validated by the STRICTEST rules (Windows'),
// so a project made on Linux still opens on Windows. Nothing here deletes.
// The page is static/filedialog.js; the routes are routes/filedialog.js.
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");

const MAX_ENTRIES = 5000;
const KINDS = {
  image: [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tif", ".tiff", ".avif", ".heic", ".exr", ".svg", ".jxl"],
  video: [".mp4", ".webm", ".mov", ".mkv", ".avi", ".m4v", ".mpg", ".mpeg", ".wmv", ".flv"],
  audio: [".wav", ".mp3", ".flac", ".ogg", ".opus", ".m4a", ".aac", ".wma", ".aiff"],
  model: [".safetensors", ".gguf", ".ckpt", ".pt", ".pth", ".bin", ".sft", ".onnx"],
  archive: [".zip", ".7z", ".rar", ".tar", ".gz", ".xz"],
  code: [".json", ".js", ".py", ".yaml", ".yml", ".ps1", ".bat", ".sh", ".html", ".css"],
  text: [".txt", ".md", ".srt", ".lrc", ".csv", ".log", ".seg", ".prj", ".profile"],
};
const SKIP = new Set(["$recycle.bin", "system volume information", "desktop.ini", "thumbs.db",
                      "$windows.~bt", "$windows.~ws", "recovery", "config.msi", ".ds_store"]);
const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;

function kindOf(name, isDir) {
  if (isDir) return "folder";
  const e = path.extname(String(name)).toLowerCase();
  for (const [k, list] of Object.entries(KINDS)) if (list.includes(e)) return k;
  return "file";
}

/** What Explorer's Type column says: "File folder", "PNG File", "File". */
function typeLabel(name, isDir) {
  if (isDir) return "File folder";
  const e = path.extname(String(name)).replace(/^\./, "").toUpperCase();
  return e ? `${e} File` : "File";
}

/** ".png,.JPG, webp" -> [".png", ".jpg", ".webp"]; "*" / "" = everything. */
function parseExts(csv) {
  return String(csv || "").split(/[,;\s]+/).map((s) => s.trim().toLowerCase())
    .filter((s) => s && s !== "*" && s !== "*.*" && s !== ".*")
    .map((s) => s.replace(/^\*/, "")).map((s) => (s.startsWith(".") ? s : "." + s));
}

function matches(name, exts) {
  return !exts.length || exts.includes(path.extname(String(name)).toLowerCase());
}

/** A new name is OK on every OS (Windows' rules are the strictest). */
function validName(n) {
  const s = String(n == null ? "" : n);
  if (!s.trim()) return "a name is required";
  if (s.length > 255) return "that name is too long";
  if (/[\\/:*?"<>|\x00-\x1f]/.test(s)) return 'a name cannot contain \\ / : * ? " < > |';
  if (s === "." || s === ".." || /[. ]$/.test(s)) return "a name cannot end with a dot or a space";
  if (RESERVED.test(s)) return `"${s}" is reserved by Windows`;
  return "";
}

function isHidden(name) {
  const n = String(name);
  return n.startsWith(".") || SKIP.has(n.toLowerCase());
}

/** Resolve what the page sent: "" = the start folder, "~" = home,
 *  relative = relative to `base` (the app folder). */
function resolveDir(dir, base) {
  let d = String(dir || "").trim();
  if (!d) return path.resolve(base || os.homedir());
  if (d === "~" || d.startsWith("~/") || d.startsWith("~\\")) d = path.join(os.homedir(), d.slice(1));
  if (/^[a-z]:$/i.test(d)) d += path.sep;                 // "D:" -> "D:\"
  return path.resolve(base || process.cwd(), d);
}

function statOf(p) {
  try { return fs.statSync(p); } catch { return null; }
}

/**
 * List a folder: {dir, parent, sep, entries[], error}. Every entry:
 * {name, dir, size, mtime, kind, type, hidden}. Folders are always listed;
 * files only when they match `exts` ("" = all). A folder that cannot be
 * read answers its error in words and an empty list (the page stays up).
 */
function list(dir, opts) {
  const o = opts || {};
  const exts = parseExts(o.exts);
  let d = resolveDir(dir, o.base);
  const st = statOf(d);
  if (st && st.isFile()) d = path.dirname(d);
  let guard = 0;
  while (!statOf(d) && guard++ < 64) {                    // nearest folder that exists
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  const entries = [];
  let error = null, truncated = false;
  try {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (entries.length >= MAX_ENTRIES) { truncated = true; break; }
      const hidden = isHidden(e.name);
      if (hidden && !o.hidden) continue;
      const full = path.join(d, e.name);
      let isDir = e.isDirectory();
      let s = null;
      if (e.isSymbolicLink()) { s = statOf(full); if (!s) continue; isDir = s.isDirectory(); }
      if (!isDir && !e.isFile() && !(s && s.isFile())) continue;
      if (!isDir && (o.foldersOnly || !matches(e.name, exts))) continue;
      s = s || statOf(full);
      entries.push({ name: e.name, dir: isDir, size: isDir ? null : (s ? s.size : null),
                     mtime: s ? Math.round(s.mtimeMs) : null, kind: kindOf(e.name, isDir),
                     type: typeLabel(e.name, isDir), hidden });
    }
  } catch (e) {
    error = e.code === "EACCES" || e.code === "EPERM"
      ? `You don't have permission to open ${d}` : e.message;
  }
  const parent = path.dirname(d);
  return { dir: d, parent: parent === d ? null : parent, sep: path.sep,
           root: path.parse(d).root, entries, error, truncated };
}

/** The search box: names containing `q` (or matching a * / ? pattern),
 *  under `dir`, breadth first, bounded in results, folders and time. */
function search(dir, q, opts) {
  const o = opts || {};
  const exts = parseExts(o.exts);
  const root = resolveDir(dir, o.base);
  const needle = String(q || "").trim().toLowerCase();
  if (!needle) return { dir: root, results: [], done: true };
  const rx = /[*?]/.test(needle)
    ? new RegExp("^" + needle.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$")
    : null;
  const hit = (n) => (rx ? rx.test(n.toLowerCase()) : n.toLowerCase().includes(needle));
  const limit = o.limit || 300, maxDirs = o.maxDirs || 4000;
  const until = Date.now() + (o.timeMs || 4000);
  const results = [];
  const queue = [root];
  let seen = 0, done = true;
  while (queue.length) {
    if (results.length >= limit || seen >= maxDirs || Date.now() > until) { done = false; break; }
    const d = queue.shift();
    seen++;
    let items;
    try { items = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of items) {
      if (isHidden(e.name) && !o.hidden) continue;
      const isDir = e.isDirectory();
      if (isDir) queue.push(path.join(d, e.name));
      if (!isDir && (o.foldersOnly || !matches(e.name, exts))) continue;
      if (!hit(e.name)) continue;
      const full = path.join(d, e.name);
      const s = statOf(full);
      results.push({ name: e.name, dir: isDir, folder: d, path: full,
                     size: isDir ? null : (s ? s.size : null), mtime: s ? Math.round(s.mtimeMs) : null,
                     kind: kindOf(e.name, isDir), type: typeLabel(e.name, isDir) });
      if (results.length >= limit) break;
    }
  }
  return { dir: root, results, done, searched: seen };
}

/** New folder: "New folder", then "New folder (2)"… - never an overwrite. */
function mkdir(dir, name) {
  const d = resolveDir(dir);
  const st = statOf(d);
  if (!st || !st.isDirectory()) return { error: `no such folder: ${d}` };
  let want = String(name || "").trim();
  if (want) { const bad = validName(want); if (bad) return { error: bad }; }
  const baseName = want || "New folder";
  let n = baseName, i = 2;
  while (fs.existsSync(path.join(d, n))) {
    if (want) return { error: `"${want}" already exists` };
    n = `${baseName} (${i++})`;
  }
  try { fs.mkdirSync(path.join(d, n)); }
  catch (e) { return { error: e.code === "EACCES" || e.code === "EPERM" ? `You don't have permission to create a folder in ${d}` : e.message }; }
  return { ok: true, dir: d, name: n, path: path.join(d, n) };
}

/** Rename inside one folder; refuses to replace anything. */
function rename(dir, from, to) {
  const d = resolveDir(dir);
  const a = String(from || ""), b = String(to || "").trim();
  if (!a || a !== path.basename(a)) return { error: "which item?" };
  const bad = validName(b);
  if (bad) return { error: bad };
  const src = path.join(d, a), dst = path.join(d, b);
  if (!statOf(src)) return { error: `"${a}" is gone` };
  if (a === b) return { ok: true, name: b, path: dst };
  // a case-only rename is allowed on a case-insensitive disk
  if (statOf(dst) && a.toLowerCase() !== b.toLowerCase()) return { error: `"${b}" already exists` };
  try { fs.renameSync(src, dst); }
  catch (e) { return { error: e.code === "EACCES" || e.code === "EPERM" ? "You don't have permission to rename that" : e.message }; }
  return { ok: true, name: b, path: dst };
}

/** What a typed path is: {path, exists, dir, size}. */
function stat(p, base) {
  const full = resolveDir(p, base);
  const s = statOf(full);
  return { path: full, exists: !!s, dir: !!(s && s.isDirectory()), size: s && s.isFile() ? s.size : null };
}

/** The app's own places for the navigation pane (never throws). */
function appPlaces(core, comfyDir) {
  const out = [];
  const add = (id, name, p) => { if (p && statOf(p)) out.push({ id, name, path: p }); };
  try { add("app", "bitGen Studio", core.BASE); } catch {}
  try { add("project", "This project", core.projDir(core.getProject())); } catch {}
  add("comfy", "ComfyUI", comfyDir);
  return out;
}

/** Node-only places when the Python helper cannot answer. */
function nodePlaces() {
  const home = os.homedir();
  const quick = [["desktop", "Desktop"], ["downloads", "Downloads"], ["documents", "Documents"],
                 ["pictures", "Pictures"], ["videos", process.platform === "darwin" ? "Movies" : "Videos"],
                 ["music", "Music"]]
    .map(([id, sub]) => ({ id, name: id === "videos" ? "Videos" : sub, path: path.join(home, sub) }))
    .filter((q) => statOf(q.path));
  const drives = [];
  if (process.platform === "win32") {
    for (let c = 67; c <= 90; c++) {
      const d = String.fromCharCode(c) + ":\\";
      if (statOf(d)) drives.push({ path: d, label: `Local Disk (${d.slice(0, 2)})`, kind: "fixed", total: null, free: null });
    }
  } else drives.push({ path: "/", label: process.platform === "darwin" ? "Macintosh HD" : "File System", kind: "fixed", total: null, free: null });
  return { os: process.platform, home, sep: path.sep, quick, drives, from: "node" };
}

/** Only this machine may browse its disk through the dialog routes. */
function isLoopback(req) {
  const a = String((req && req.socket && req.socket.remoteAddress) || "");
  return a === "127.0.0.1" || a === "::1" || a === "::ffff:127.0.0.1";
}

module.exports = { MAX_ENTRIES, KINDS, kindOf, typeLabel, parseExts, matches, validName, isHidden,
                   resolveDir, list, search, mkdir, rename, stat, appPlaces, nodePlaces, isLoopback };
