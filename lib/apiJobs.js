// bitGen Studio — lib/apiJobs.js (2.757.0): a VIDEO render with an API_ style (Settings ▸ API, lib/apis.js).
// routes/index.js /api/generate hands it over before any MiniMax H3 work (chunk plans, the H3 speech shape, the 15 s
// ceiling): the online service renders the request as typed - misc/api_worker.py. Pictures and songs need nothing
// here (/api/genimage, /api/genmusic already queue the style; lib/core.js workerFor picks the API worker).
// Pure (scripts/test-apis757.js): isApiStyle, videoParams.
"use strict";

const isApiStyle = (st) => !!(st && st.runs_on === "api");
const MAX_FRAMES = 24 * 60;     // a minute - the services' own limits are lower and say so

/** the job's params for an API_ video style (pure) -> {params} | {error}
 *  o = {style, mode, prompt, files: [path], width, height, frames, seed, format, negative} */
function videoParams(o) {
  const st = o.style || {}, files = o.files || [];
  if (!st.api_id) return { error: `"${st.name}" runs on an API but has none picked - choose it in the style's Runs on` };
  const mode = ["t2va", "fl2va", "ref2va"].includes(o.mode) ? o.mode : "t2va";
  if (mode === "fl2va" && !files.length) return { error: "First / last frame needs a first frame picture" };
  if (!String(o.prompt || "").trim()) return { error: "prompt is required" };
  const clamp = (v, d, lo, hi) => { const n = parseInt(v, 10); return Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : d)); };
  return { params: {
    mode, prompt: String(o.prompt).trim(), video_style: st, video_style_id: st.id || null, video_style_name: st.name || null,
    width: clamp(o.width, 1280, 128, 4096), height: clamp(o.height, 720, 128, 4096), frames: clamp(o.frames, 120, 1, MAX_FRAMES),
    seed: clamp(o.seed, -1, -1, 2 ** 31 - 1), format: ["mp4", "webm"].includes(o.format) ? o.format : "mp4",
    reference_files: files, api: true, ...(o.negative ? { negative_prompt: String(o.negative).slice(0, 2000) } : {}),
  } };
}
module.exports = { isApiStyle, videoParams, MAX_FRAMES };
