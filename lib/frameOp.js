/**
 * bitGen Studio — APPEND / PREPEND a reference video from Generate (2.388.0).
 *
 * Tim (verbatim): "add option to dropdown in reference docker video dropdown -"Append" if this is selected then
 * continue this video, take the last frame, upscale the png then generate an i2v or fl2va video from that frame-append
 * the video / add option to dropdown in video reference -"prepend" if this is selected then continue this video, take
 * the first frame, upscale the png then generate an i2v or fl2va video from that frame-prepend the video. this will
 * work from the generate button in the prompt docker"
 *
 * POST /api/generate (routes/index.js) gets `ref_video_op` = {"name": <a reference video>, "op": "append"|"prepend"}
 * and at most ONE picture (the reference dock's "last frame" picture for an append, its "first frame" picture for a
 * prepend). build() here:
 *   - takes the video's LAST frame (append) / FIRST frame (prepend) out with ffmpeg -> <job>/frame_op.png
 *   - orders the render's frames (always fl2va = first [, last]):
 *       append  : [the video's last frame, the picture?]  -> fl2va from it (2.395.0: never ref2va / "i2v"), then video + part
 *       prepend : [the picture, the video's first frame]  -> fl2va ending ON the video's first frame, then part + video
 *       prepend, no picture: [the video's first frame], reverse -> made forward from it, played BACKWARDS, so it ends there
 *   - sizes the render to the video (32-px grid for H3; Wan snaps to 16 itself)
 *   - the job's `frame_op` {op, video, frame, width, height, upscaler, reverse}: the worker upscales the frame (the ⚙
 *     PNG upscaler, lib/renderSettings png_upscaler; lanczos without one) and joins (scripts/clipjoin.py)
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const OPS = ["append", "prepend"];

/** the request field -> {name, op} | null (anything else = no frame op) */
function parse(raw) {
  let j = raw;
  if (typeof raw === "string") { try { j = JSON.parse(raw || "null"); } catch { return null; } }
  if (!j || typeof j !== "object") return null;
  const op = String(j.op || "").toLowerCase();
  const name = path.basename(String(j.name || ""));
  return OPS.includes(op) && name ? { name, op } : null;
}

/** {w, h, frames} of a clip (ffprobe), zeros when unreadable */
function probe(file) {
  const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,nb_frames",
    "-of", "json", file], { encoding: "utf8" });
  try {
    const s = (JSON.parse(r.stdout || "{}").streams || [])[0] || {};
    return { w: +s.width || 0, h: +s.height || 0, frames: +s.nb_frames || 0 };
  } catch { return { w: 0, h: 0, frames: 0 }; }
}

/** the ffmpeg args that take the first / last frame out (scripts/clipjoin.py extract_cmd - the same) */
function extractArgs(video, which, out) {
  return which === "first"
    ? ["-y", "-loglevel", "error", "-i", video, "-frames:v", "1", out]
    : ["-y", "-loglevel", "error", "-sseof", "-1", "-i", video, "-update", "1", "-q:v", "1", out];
}

/** a side on the 32-px grid, 128..2048 */
const snap = (v) => Math.max(128, Math.min(2048, Math.round((+v || 0) / 32) * 32));

/**
 * o = { raw, videoDir, jobDir, files:[abs pictures sent], names?:[their names], upscaler, extract?(args)->ok }
 * -> null (no op) | {error} | { op, files, width, height, frame_op, note, video }
 */
function build(o) {
  const x = o || {};
  const fo = parse(x.raw);
  if (!fo) return null;
  const video = path.join(x.videoDir, fo.name);
  if (!fs.existsSync(video)) return { error: `${fo.op}: the reference video is gone (${fo.name})` };
  const files = (x.files || []).filter(Boolean);
  if (files.length > 1) return { error: `${fo.op} takes at most one picture with the video (the ${fo.op === "append" ? "last" : "first"} frame)` };
  const vi = probe(video);
  if (!vi.w || !vi.h) return { error: `${fo.op}: could not read ${fo.name}` };
  const frame = path.join(x.jobDir, "frame_op.png");
  const which = fo.op === "append" ? "last" : "first";
  const extract = x.extract || ((args) => spawnSync("ffmpeg", args, { encoding: "utf8" }).status === 0);
  if (!extract(extractArgs(video, which, frame)) || !fs.existsSync(frame))
    return { error: `${fo.op}: could not take the ${which} frame out of ${fo.name}` };
  const pair = files[0] || null;
  let ordered, reverse = false;
  if (fo.op === "append") ordered = pair ? [frame, pair] : [frame];
  else if (pair) ordered = [pair, frame];
  else { ordered = [frame]; reverse = true; }
  const width = snap(vi.w), height = snap(vi.h);
  const upscaler = String(x.upscaler || "");
  /* 2.395.0 (Tim: "when prepend or append video use fl2va not ref2a or i2v . if there are pictures in the ref images
     tab label the first picture as picture 2"): always fl2va (H3's first / last frame node, MiniMaxH3ImageToVideo) -
     <Picture 1> = the video's frame, <Picture 2> = the dock's picture (the page picks it: static/refroles.js) */
  const how = "fl2va";
  const pairName = pair ? String((x.names || [])[0] || path.basename(pair)) : "";
  const note = `${fo.op}: <Picture 1> = ${fo.name}'s ${which} frame (upscaled with ${upscaler || "lanczos"}) `
    + (fo.op === "append"
      ? (pair ? "is the FIRST frame, <Picture 2> (" + pairName + ") the LAST" : "is the first frame (no end picture)")
      : (pair ? "is the LAST frame, <Picture 2> (" + pairName + ") the FIRST"
              : "starts a part made forward and played backwards, so it ends on the video (no start picture, the part silent)"))
    + ` - ${how} at ${width}x${height}, then ${fo.op === "append" ? "video + part" : "part + video"} as one clip`;
  return {
    op: fo.op, files: ordered, width, height, video, note,
    frame_op: { op: fo.op, video, frame, width, height, upscaler, reverse },
  };
}

module.exports = { OPS, parse, probe, extractArgs, snap, build };
