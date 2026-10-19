// bitGen Studio — A SCENE'S TAIL PNGs (2.313.0).
//
// Tim (verbatim): "can we save the last 2 seconds of the video as 1080p png,
// and use one of those frames to continue the video or first frame for next
// video, i am still losing a lot of quality when getting to scene 8. save
// the png's to song name\scene_<n>\song name_scene_<n>_x.png. add option in
// video docker settings for png size, upscaler dropdown."
//
// After a board render the worker (scripts/tailpngs.py) writes the take's
// last 2 s (48 frames) as PNGs at the ⚙'s "Tail PNG size" - lanczos, or
// ComfyUI's image upscale workflow with the chosen upscale model - into
//   projects/<p>/<song name>/scene_<n>/<song name>_scene_<n>_<x>.png
// (x = 1..48 in time order; the last is the take's final frame) with a
// tail.json beside them naming the take they came from. The NEXT scene's
// continuation frame - its First / Cont / Trans start, the default tail or
// a frame picked on the filmstrip inside those 2 s - is read from here
// instead of from the video, so every scene starts from a clean,
// full-size picture rather than one more generation of the last one.
// A board with no song uses the project name for the folder.
const fs = require("fs");
const path = require("path");
const core = require("./core");

const SECONDS = 2;
const FPS = 24;
const META = "tail.json";
const SIZES = ["off", "720", "1080", "1440", "2160"];

/** A name that is safe as ONE folder / file stem on every OS. */
function safe(s) {
  return String(s || "").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/\s+/g, " ").trim()
    .replace(/[. ]+$/, "").slice(0, 80) || "scenes";
}

/** The board's song name (no extension), else the project's name. */
function songStem(st, project) {
  const a = st && st.audio ? path.parse(path.basename(String(st.audio))).name : "";
  return safe(a || project || core.getProject());
}

function dirFor(project, st, n) {
  const p = project || core.getProject();
  return path.join(core.projDir(p), songStem(st, p), `scene_${parseInt(n, 10) || 0}`);
}
function stemFor(project, st, n) {
  return `${songStem(st, project || core.getProject())}_scene_${parseInt(n, 10) || 0}`;
}

/** The PNG size: short side = size, the render's aspect, even pixels. */
function dims(size, width, height) {
  const s = parseInt(size, 10);
  if (!(s > 0 && width > 0 && height > 0)) return null;
  const ev = (v) => Math.max(2, Math.round(v / 2) * 2);
  return width >= height ? { width: ev(s * width / height), height: ev(s) }
                         : { width: ev(s), height: ev(s * height / width) };
}

/** The job's tail_pngs spec (null when the ⚙ says off). */
function spec(project, st, n, settings, width, height) {
  const size = String((settings || {}).png_size || "1080");
  if (size === "off") return null;
  const d = dims(size, width, height);
  if (!d) return null;
  return { dir: dirFor(project, st, n), stem: stemFor(project, st, n), width: d.width, height: d.height,
           upscaler: String((settings || {}).png_upscaler || ""), seconds: SECONDS, fps: FPS };
}

function readMeta(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, META), "utf8")); } catch { return null; }
}

/** The board registered the take under its scene name: the tail follows. */
function adopt(project, st, n, fromName, toName) {
  const dir = dirFor(project, st, n);
  const m = readMeta(dir);
  if (!m || !toName || path.basename(String(m.take || "")) !== path.basename(String(fromName || ""))) return false;
  m.take = path.basename(String(toName));
  try { fs.writeFileSync(path.join(dir, META), JSON.stringify(m, null, 2)); return true; }
  catch { return false; }
}

/** The tail of row's CURRENT take, or null (none, or another take's). */
function forRow(project, st, row) {
  if (!row || !row.output) return null;
  const dir = dirFor(project, st, row.n);
  const m = readMeta(dir);
  if (!m || path.basename(String(m.take || "")) !== path.basename(String(row.output))) return null;
  const files = (m.files || []).filter((f) => fs.existsSync(path.join(dir, f)));
  if (!files.length) return null;
  return { ...m, dir, files };
}

/** The PNG to continue from: t = null -> the last frame; t (seconds into
 *  the take) inside the tail window -> that frame; outside -> null (the
 *  caller extracts from the video as before). */
function pick(project, st, row, t) {
  const m = forRow(project, st, row);
  if (!m) return null;
  let i = m.files.length - 1;
  if (t != null && Number.isFinite(+t)) {
    const k = Math.round((+t - (m.time_from || 0)) * (m.fps || FPS));
    if (k < -1) return null;                     // before the tail: not ours
    i = Math.max(0, Math.min(m.files.length - 1, k));
  }
  const name = m.files[i];
  return { file: path.join(m.dir, name), name, x: i + 1, width: m.width, height: m.height,
           upscaler: m.upscaler, count: m.files.length };
}

module.exports = { SECONDS, FPS, META, SIZES, safe, songStem, dirFor, stemFor, dims, spec,
                   readMeta, adopt, forRow, pick };
