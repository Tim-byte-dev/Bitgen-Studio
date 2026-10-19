// bitGen Studio — lib/tlRender.js (2.418.0): ⚡ RENDER PREVIEWS (Premiere's "Render In to Out" + the green render bar).
// A stretch the canvas cannot draw in real time (static/tlrender.js costs it: layers, grades, effects, masks, retimes,
// 3D, adjustment layers) is compiled ONCE by the real compile (POST /api/export with `preview: <id>` - its own file,
// no deliverables) and kept in <project>/cache/preview/<id>.mp4; the canvas then plays that file over every stretch
// whose fingerprint it was made from (ext/timelinedock/tlrender.js) - exactly the movie, at full speed.
// Tim: "continue with the next part please the gap is getting smaller - soon bitgen should be superior".
//
//   okId(id) / outName(id)  -> "preview_<id>.mp4" (the compile's file in the project root)
//   adopt(pdir, id)         -> {file, url, dur} - moved into cache/preview (the newest KEEP kept)
//   fileFor(pdir, file)     -> the cached file's path or null
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const KEEP = 4;
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
function okId(id) { return /^[0-9a-f]{8,32}$/.test(String(id || "")); }
function outName(id) { if (!okId(id)) throw bad("a preview id is 8 - 32 hex digits"); return "preview_" + id + ".mp4"; }
function dir(pdir) { const d = path.join(pdir, "cache", "preview"); fs.mkdirSync(d, { recursive: true }); return d; }
function probeDur(f) {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" });
  const d = parseFloat(String(r.stdout || "").trim());
  return Number.isFinite(d) ? +d.toFixed(3) : null;
}
function adopt(pdir, id) {
  const name = outName(id), src = path.join(pdir, name);
  if (!fs.existsSync(src)) throw bad("the preview render is not there (compile it first)", 404);
  const d = dir(pdir), dst = path.join(d, id + ".mp4");
  try { fs.unlinkSync(dst); } catch { /* none */ }
  try { fs.renameSync(src, dst); } catch { fs.copyFileSync(src, dst); fs.unlinkSync(src); }
  try { fs.unlinkSync(src.replace(/\.mp4$/, ".srt")); } catch { /* none */ }
  const now = new Date(); try { fs.utimesSync(dst, now, now); } catch { /* fine */ }   // adopted now (the prune's order)
  // the newest KEEP renders stay (an older one is only good for stretches nobody has changed since - rarely)
  const all = fs.readdirSync(d).filter((f) => /^[0-9a-f]{8,32}\.mp4$/.test(f))
    .map((f) => ({ f, t: fs.statSync(path.join(d, f)).mtimeMs })).sort((a, b) => b.t - a.t);
  all.slice(KEEP).forEach((x) => { try { fs.unlinkSync(path.join(d, x.f)); } catch { /* in use */ } });
  return { file: id + ".mp4", url: "/api/tlrender/file/" + id + ".mp4", dur: probeDur(dst) };
}
function fileFor(pdir, file) {
  const f = path.basename(String(file || ""));
  if (!/^[0-9a-f]{8,32}\.mp4$/.test(f)) return null;
  const p = path.join(pdir, "cache", "preview", f);
  return fs.existsSync(p) ? p : null;
}

module.exports = { okId, outName, adopt, fileFor, KEEP };
