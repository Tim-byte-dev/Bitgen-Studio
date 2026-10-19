// bitGen Studio — the FILE DIALOG's bridge to scripts/fdlg_helper.py (2.326.0).
//
// ONE long-lived `python fdlg_helper.py serve` answers JSON lines: the
// places (the user's real Desktop / Documents / Downloads / Pictures /
// Videos / Music and the drives with labels and free space) and
// thumbnails (ffmpeg, four at a time). Started on first use, restarted if
// it dies; every call has a timeout, and when Python cannot answer the
// places fall back to lib/fileDialog.nodePlaces() - the dialog never
// depends on the helper to open.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const SCRIPT = path.join(__dirname, "..", "scripts", "fdlg_helper.py");
const THUMB_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tif", ".tiff", ".avif", ".heic", ".exr", ".jxl",
                    ".mp4", ".webm", ".mov", ".mkv", ".avi", ".m4v", ".mpg", ".mpeg", ".wmv", ".flv"];

let child = null, buf = "", seq = 0;
const pending = new Map();
let python = process.env.H3_PYTHON || "python";
let placesCache = null, placesAt = 0;

function configure(opts) {
  if (opts && opts.python) python = opts.python;
}

function kill() {
  if (child) { try { child.stdin.end(JSON.stringify({ cmd: "quit" }) + "\n"); } catch {} try { child.kill(); } catch {} }
  child = null; buf = "";
  for (const [, p] of pending) { clearTimeout(p.t); p.reject(new Error("helper stopped")); }
  pending.clear();
}

function ensure() {
  if (child && child.exitCode === null && !child.killed) return child;
  buf = "";
  const c = spawn(python, ["-u", SCRIPT, "serve"], { stdio: ["pipe", "pipe", "ignore"], windowsHide: true, env: { ...process.env, BITGEN_NODE: process.execPath } });   // 2.479.0: .jxl thumbnails
  c.on("error", () => { if (child === c) child = null; for (const [, p] of pending) { clearTimeout(p.t); p.reject(new Error("python not runnable")); } pending.clear(); });
  c.on("exit", () => { if (child === c) child = null; });
  c.stdout.setEncoding("utf8");
  c.stdout.on("data", (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      let m; try { m = JSON.parse(line); } catch { continue; }
      const p = pending.get(m.id);
      if (p) { pending.delete(m.id); clearTimeout(p.t); p.resolve(m.result || {}); }
    }
  });
  child = c;
  return c;
}

function call(cmd, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    let c;
    try { c = ensure(); } catch (e) { return reject(e); }
    const id = ++seq;
    const t = setTimeout(() => { pending.delete(id); reject(new Error(`helper timed out (${cmd})`)); }, timeoutMs || 15000);
    pending.set(id, { resolve, reject, t });
    try { c.stdin.write(JSON.stringify({ id, cmd, ...(args || {}) }) + "\n"); }
    catch (e) { pending.delete(id); clearTimeout(t); reject(e); }
  });
}

/** The places, cached for 30 s; `fallback()` answers when Python cannot. */
async function places(fallback) {
  if (placesCache && Date.now() - placesAt < 30000) return placesCache;
  try {
    const r = await call("places", {}, 8000);
    if (r && !r.error && Array.isArray(r.drives)) {
      placesCache = { ...r, from: "python" }; placesAt = Date.now();
      return placesCache;
    }
  } catch { /* fall through */ }
  return fallback ? fallback() : { quick: [], drives: [], from: "none" };
}

const canThumb = (p) => THUMB_EXTS.includes(path.extname(String(p)).toLowerCase());

/** The cached thumbnail file for `src` at `size`, made on first ask.
 *  Keyed by path + mtime + byte size, so an edited picture gets a new one. */
async function thumb(src, size, cacheDir) {
  if (!canThumb(src)) return { error: "no thumbnail for this type" };
  let st;
  try { st = fs.statSync(src); } catch { return { error: "not found" }; }
  if (!st.isFile()) return { error: "not a file" };
  const sz = Math.max(32, Math.min(512, parseInt(size, 10) || 256));
  const key = crypto.createHash("sha1").update([src, st.mtimeMs, st.size, sz].join("|")).digest("hex");
  const dst = path.join(cacheDir, key.slice(0, 2), key + ".jpg");
  if (fs.existsSync(dst)) return { path: dst, cached: true };
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  try {
    const r = await call("thumb", { src, dst, size: sz }, 30000);
    if (r && r.ok && fs.existsSync(dst)) return { path: dst, cached: false };
    return { error: (r && r.error) || "thumbnail failed" };
  } catch (e) { return { error: e.message }; }
}

module.exports = { SCRIPT, THUMB_EXTS, configure, call, places, thumb, canThumb, kill };
