// bitGen Studio — lib/nest.js (2.414.0): NESTED SEQUENCES - a named timeline used as a clip on another (Premiere's
// nest). The nested timeline is compiled like any timeline (the page builds its payload - ext/timelinedock/timelinedock.js
// TlExportBody - and /api/export takes `nest`: the master is written as nest_<name>.mp4, no deliverables), then ADOPTED
// into the project's video folder, so everything that reads a video clip (the canvas, thumbnails, waveforms, the
// compile, the exchange) reads the nested sequence as an ordinary clip. The clip remembers which timeline and which
// version of it (hash); when that timeline is saved again the clip shows ↻ out of date until it is re-rendered.
// Tim: "lets do the medium jobs now" (Premiere's "Nested sequences" was the first).
//
//   outName(name, hash)      -> "nest_<safe>_<hash8>.mp4"   (the compile's file in the project root)
//   hashOf(pdir, name)       -> the stored timeline's fingerprint (null when there is none)
//   status(pdir, names)      -> {name: {hash, exists, file}}
//   adopt(pdir, name)        -> {file, dur, hash} - the render moved into video/ (a re-render replaces it)
//   uses(tl, name) / cycle(pdir, outer, inner) -> does a timeline use the nest (directly or through others)
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const timelines = require("./timelines");

function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
function safeFile(name) { return String(timelines.safe(name)).replace(/[^\w.-]+/g, "_").slice(0, 60); }
/** the render's file: the name + the version it was made from (a re-render is a new file - no stale cached picture) */
function outName(name, hash) { return "nest_" + safeFile(name) + (hash ? "_" + String(hash).slice(0, 8) : "") + ".mp4"; }

/** what makes a timeline look different: everything but the session's own state (the marker, the selection) */
function fingerprint(t) {
  const c = JSON.parse(JSON.stringify(t || {}));
  ["playhead", "sel", "selLayer", "deliver", "deliverRange", "deliverHw", "previewRender", "previewUse", "playRes", "glComp"].forEach((k) => { delete c[k]; });
  return crypto.createHash("sha1").update(JSON.stringify(c)).digest("hex").slice(0, 16);
}
function hashOf(pdir, name) {
  const t = timelines.read(pdir, name);
  return t ? fingerprint(t) : null;
}
function status(pdir, names) {
  const out = {};
  (names || []).forEach((n) => {
    try {
      const h = hashOf(pdir, n), f = path.join(pdir, "video", outName(n, h));
      out[n] = { hash: h, exists: fs.existsSync(f), file: outName(n, h) };
    } catch (e) { out[n] = { error: e.message }; }
  });
  return out;
}
function probeDur(f) {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" });
  const d = parseFloat(String(r.stdout || "").trim());
  return Number.isFinite(d) ? Math.round(d * 1000) / 1000 : null;
}
function adopt(pdir, name) {
  const n = timelines.safe(name), h = hashOf(pdir, n), src = path.join(pdir, outName(n, h));
  if (!fs.existsSync(src)) throw bad(`the render of "${n}" is not there yet (compile it first)`, 404);
  const vd = path.join(pdir, "video");
  fs.mkdirSync(vd, { recursive: true });
  const dst = path.join(vd, outName(n, h));
  try { fs.unlinkSync(dst); } catch { /* none yet */ }
  try { fs.renameSync(src, dst); } catch { fs.copyFileSync(src, dst); fs.unlinkSync(src); }
  try { fs.unlinkSync(src.replace(/\.mp4$/, ".srt")); } catch { /* none */ }
  return { file: outName(n, h), dur: probeDur(dst), hash: h };
}
/** the nested names a timeline object uses (its clips' `nest`) */
function uses(t) {
  const out = new Set();
  const look = (c) => { if (c && c.nest) out.add(String(c.nest)); };
  ((t && t.video) || []).forEach(look);
  ((t && t.vlayers) || []).forEach((L) => ((L && L.clips) || []).forEach(look));
  return [...out];
}
/** would nesting `inner` into `outer` make a loop (inner uses outer, directly or through its own nests)? */
function cycle(pdir, outer, inner) {
  const seen = new Set();
  const walk = (n) => {
    if (n === outer) return true;
    if (seen.has(n)) return false;
    seen.add(n);
    const t = timelines.read(pdir, n);
    return uses(t).some(walk);
  };
  return walk(inner);
}

module.exports = { outName, fingerprint, hashOf, status, adopt, uses, cycle };
