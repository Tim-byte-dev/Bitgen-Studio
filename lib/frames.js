// bitGen Studio — frame-exact strip extraction for the timeline's frame inspector.
//
// Why this exists: the UI used to grab thumbnails by seeking a hidden <video>
// once per thumbnail. That is fine for a 6-thumb filmstrip, but "show me every
// frame in this second" is 24 seeks, and browser seeking is neither fast nor
// frame-exact — you get the nearest keyframe-decoded frame, not frame n.
// One ffmpeg pass with `fps=` gives exactly n frames per second, in order, and
// the result is cached on disk so re-opening the same range is instant.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const core = require("./core");

const FPS = 24;
const CACHE_DIR = () => path.join(core.WORKSPACE, "framecache");
const KEEP_RANGES = 48;          // most-recent strips kept on disk
const MAX_FRAMES = 480;          // 20 s at 24 fps — hard ceiling per request

// Where a timeline clip's media actually lives.
//   video  -> the project's Video assets      (dragged in from the asset tray)
//   sound  -> the project's Sound assets
//   output -> the project's renders, else the exports folder
function resolveMedia(name, src) {
  const base = path.basename(String(name || ""));
  if (!base) return null;
  const tries = [];
  if (src === "video") tries.push(core.pDir("video"));
  else if (src === "sound") tries.push(core.pDir("sound"));
  else if (src === "final") tries.push(path.join(core.projDir(core.getProject()), "final"));
  else tries.push(core.pDir("output"));
  // always fall back across the other homes — a clip can be re-filed between
  // output/ and final/ by an export without the timeline knowing
  tries.push(core.pDir("output"),
             path.join(core.projDir(core.getProject()), "final"),
             core.pDir("video"), core.pDir("sound"));
  for (const d of tries) {
    const p = path.join(d, base);
    try { if (fs.existsSync(p)) return p; } catch { /* unreadable dir */ }
  }
  return null;
}

function prune() {
  const root = CACHE_DIR();
  let dirs = [];
  try {
    dirs = fs.readdirSync(root).map((d) => {
      const p = path.join(root, d);
      return { p, at: fs.statSync(p).mtimeMs };
    });
  } catch { return; }
  dirs.sort((a, b) => b.at - a.at);
  for (const d of dirs.slice(KEEP_RANGES)) {
    try { fs.rmSync(d.p, { recursive: true, force: true }); } catch {}
  }
}

// Extract [start, end) at `fps` and return the frame list. Cached by
// (file, mtime, range, fps, width) so a second open costs one stat().
function extract(opts) {
  const file = opts.file;
  const fps = Math.min(60, Math.max(1, parseFloat(opts.fps) || FPS));
  const width = Math.min(640, Math.max(48, parseInt(opts.width, 10) || 160));
  const start = Math.max(0, parseFloat(opts.start) || 0);
  let end = Math.max(start + 1 / fps, parseFloat(opts.end) || start + 1);
  let count = Math.round((end - start) * fps);
  let truncated = false;
  if (count > MAX_FRAMES) { count = MAX_FRAMES; end = start + count / fps; truncated = true; }

  let mtime = 0, size = 0;
  try { const st = fs.statSync(file); mtime = st.mtimeMs; size = st.size; } catch {
    throw new Error("media not found: " + path.basename(file));
  }
  const key = crypto.createHash("sha1")
    .update([file, mtime, size, start.toFixed(4), end.toFixed(4), fps, width].join("|"))
    .digest("hex").slice(0, 16);
  const dir = path.join(CACHE_DIR(), key);
  const idx = path.join(dir, "index.json");

  if (fs.existsSync(idx)) {
    try {
      const cached = JSON.parse(fs.readFileSync(idx, "utf8"));
      fs.utimesSync(dir, new Date(), new Date());          // touch for the LRU
      return Object.assign({}, cached, { key, cached: true, truncated });
    } catch { /* corrupt index — fall through and rebuild */ }
  }

  fs.mkdirSync(dir, { recursive: true });
  const args = ["-hide_banner", "-loglevel", "error", "-y",
                "-ss", start.toFixed(4), "-i", file,
                "-t", (end - start).toFixed(4),
                "-vf", `fps=${fps},scale=${width}:-2`,
                "-vsync", "0", "-q:v", "4",
                "-frames:v", String(count),
                path.join(dir, "f%05d.jpg")];
  const r = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (r.error) throw new Error("ffmpeg not runnable: " + r.error.message);
  if (r.status !== 0) throw new Error("ffmpeg failed: " + String(r.stderr || "").trim().split("\n").pop());

  const files = fs.readdirSync(dir).filter((f) => /^f\d+\.jpg$/.test(f)).sort();
  const frames = files.map((f, i) => ({
    i,                                             // index within the strip
    frame: Math.round(start * fps) + i,            // absolute frame in the media
    t: Math.round((start + i / fps) * 1e6) / 1e6,  // media timestamp, seconds
    file: f,
  }));
  const payload = { key, fps, width, start, end, count: frames.length, frames };
  fs.writeFileSync(idx, JSON.stringify(payload));
  prune();
  return Object.assign({}, payload, { cached: false, truncated });
}

function framePath(key, file) {
  const k = path.basename(String(key || ""));
  const f = path.basename(String(file || ""));
  if (!/^[a-f0-9]{4,}$/.test(k) || !/^f\d+\.jpg$/.test(f)) return null;
  const p = path.join(CACHE_DIR(), k, f);
  return fs.existsSync(p) ? p : null;
}

module.exports = { FPS, MAX_FRAMES, resolveMedia, extract, framePath };
