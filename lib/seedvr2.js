/* bitGen Studio — SeedVR2 VIDEO UPSCALING (2.400.0).
 *
 * Tim (verbatim): "add seedvr2 for upscaling videos - seedvr2_7b_sharp_fp16.safetensors -
 * https://github.com/Comfy-Org/workflow_templates/blob/main/templates/utility_seedvr2_3b_int8_upscale_video.json"
 *
 * One job (mode "seedvr2", seedvr2_worker.py) upscales one video with ComfyUI's core SeedVR2 nodes
 * (scripts/seedvr2_graph.py). Two doors:
 *  - the preview dock's ⏫ SeedVR2 - the video you are looking at, at the size picked there;
 *  - the video docker's ⚙ Upscaler "SeedVR2 (video)" - a scene's ⏫ upscales its take with it (routes/characters.js
 *    queueScene), and "Upscale every render" queues it as each take lands (onTake).
 * The options (size, colour match, temporal split, model) are the project's seedvr2.json.
 * Pure helpers + the job params; routes/seedvr2.js serves them. */
"use strict";
const fs = require("fs");
const path = require("path");

const FILE = "seedvr2.json";
const UPSCALER = "seedvr2";                 // the ⚙ Upscaler value that means "SeedVR2 (video)"
const DEFAULT_MODEL = "seedvr2_7b_sharp_fp16.safetensors";
const COLORS = ["lab", "wavelet", "adain", "none"];
const SIZES = ["720", "1080", "1440", "2160", "x2", "x3", "x4"];
const DEFAULTS = { size: "1080", color: "lab", chunk: "auto", overlap: 0, denoise: 1, model: "", seed: -1 };

function normalize(o) {
  const s = { ...DEFAULTS };
  const src = o && typeof o === "object" ? o : {};
  if (SIZES.includes(String(src.size))) s.size = String(src.size);
  if (COLORS.includes(String(src.color))) s.color = String(src.color);
  const c = String(src.chunk == null ? "auto" : src.chunk).trim().toLowerCase();
  if (c === "auto" || c === "off") s.chunk = c;
  else if (/^\d+$/.test(c) && +c >= 5) { const n = +c; s.chunk = String(n - ((n - 1) % 4)); }   // 4n+1
  const ov = parseInt(src.overlap, 10);
  if (Number.isFinite(ov)) s.overlap = Math.max(0, Math.min(16, ov));
  const d = parseFloat(src.denoise);
  if (Number.isFinite(d)) s.denoise = Math.max(0.05, Math.min(1, Math.round(d * 100) / 100));
  const m = String(src.model || "").trim();
  s.model = m && !m.includes("..") && /\.(safetensors|gguf|ckpt|pt)$/i.test(m) ? m.slice(0, 300) : "";
  const sd = parseInt(src.seed, 10);
  s.seed = Number.isSafeInteger(sd) && sd >= 0 ? sd : -1;
  return s;
}

function fileFor(projDir) { return path.join(projDir, FILE); }
function read(projDir) {
  try { return normalize(JSON.parse(fs.readFileSync(fileFor(projDir), "utf8"))); } catch { return normalize({}); }
}
function save(projDir, patch) {
  const s = normalize({ ...read(projDir), ...(patch || {}) });
  fs.mkdirSync(projDir, { recursive: true });
  fs.writeFileSync(fileFor(projDir), JSON.stringify(s, null, 2));
  return s;
}

const even = (v) => Math.max(2, Math.round(v / 2) * 2);
/** The output size for a source of w x h: a short side (720 / 1080 / 1440 / 2160, the aspect kept) or a factor
 *  (x2 / x3 / x4). {width, height, mult} or {error}. */
function target(size, w, h) {
  if (!(w > 0 && h > 0)) return { error: "could not read the video's size (is ffprobe installed?)" };
  const sz = String(size || DEFAULTS.size);
  let mult;
  if (/^x\d$/.test(sz)) mult = parseInt(sz.slice(1), 10);
  else {
    const t = parseInt(sz, 10);
    if (!(t > 0)) return { error: `unknown size ${sz}` };
    mult = t / Math.min(w, h);
  }
  mult = Math.round(mult * 10000) / 10000;
  if (mult < 1) return { error: `the video is already ${w}x${h} - pick a larger size than ${sz}p` };
  return { width: even(w * mult), height: even(h * mult), mult };
}

/** {width, height, duration} of a video's first stream, or null. */
function probe(file) {
  try {
    const r = require("child_process").spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0",
      "-show_entries", "stream=width,height:format=duration", "-of", "json", String(file)],
    { encoding: "utf8", timeout: 20000 });
    const j = JSON.parse(r.stdout || "{}");
    const s = (j.streams || [])[0] || {};
    if (!(s.width > 0 && s.height > 0)) return null;
    return { width: +s.width, height: +s.height, duration: parseFloat((j.format || {}).duration) || 0 };
  } catch { return null; }
}

const VIDEO_RX = /\.(mp4|webm|mov|mkv|m4v|avi)$/i;
/** A video the app can name (a gallery output, a Video asset, a project-root export) -> its absolute path, or null.
 *  Names only - never a path from the client. `from` (asset | ref) looks in video/ first. */
function resolve(projDir, name, from) {
  const base = path.basename(String(name || ""));
  if (!base || !VIDEO_RX.test(base)) return null;
  const outs = [projDir, path.join(projDir, "output"), path.join(projDir, "final")], vid = path.join(projDir, "video");
  // 2.401.0: a Video asset / a reference video (both live in video/) wins a name clash when that is where it was picked
  const dirs = from === "asset" || from === "ref" ? [vid, ...outs] : [...outs, vid];
  for (const d of dirs) {
    const p = path.join(d, base);
    try { if (fs.statSync(p).isFile()) return p; } catch { /* next */ }
  }
  return null;
}

/** The job's params for `file` (absolute) of `size` ({width, height}) with the options `o`. {params, note} | {error} */
function jobParams(file, size, o, extra) {
  const s = normalize(o);
  if (!size) return { error: `could not read ${path.basename(String(file))} (is ffprobe installed?)` };
  const t = target(s.size, size.width, size.height);
  if (t.error) return { error: t.error };
  const x = extra || {};
  const label = x.label || `SeedVR2 ⏫ ${path.basename(file)}`;
  const params = {
    mode: "seedvr2", source: file, width: t.width, height: t.height,
    prompt: label, label,
    model: s.model, color: s.color, chunk: s.chunk, overlap: s.overlap, denoise: s.denoise, seed: s.seed,
    ...(Number.isFinite(x.start) && x.start > 0 ? { start: x.start } : {}),
    ...(Number.isFinite(x.duration) && x.duration > 0 ? { duration: x.duration } : {}),
    ...(x.output_name ? { output_name: String(x.output_name) } : {}),
    ...(x.scene ? { scene: x.scene } : {}),
  };
  const note = `SeedVR2 upscales ${path.basename(file)} ${size.width}x${size.height} -> ${t.width}x${t.height} `
    + `(x${t.mult}, ${s.model || DEFAULT_MODEL + " or the best SeedVR2 file ComfyUI lists"}, colour match ${s.color}, `
    + `temporal split ${s.chunk})`;
  return { params, note, target: t };
}

/** The ⚙ says SeedVR2? */
const isUpscaler = (rs) => !!rs && String(rs.upscaler || "") === UPSCALER;

/** The ⚙ Upscale resolution (720 / 1080 / 1440 / 2160) as a SeedVR2 size. */
function sizeFromSettings(rs) {
  const r = String((rs && rs.upscale_res) || "");
  return SIZES.includes(r) ? r : DEFAULTS.size;
}

/** ⏫ on a board scene with the ⚙ Upscaler on SeedVR2: its take (the lossless master when there is one) at the ⚙'s
 *  Upscale resolution, the rest from seedvr2.json. The finished file is filed as the scene's _upscaled take by the
 *  same harvest every upscale uses (routes/characters.js syncJobs -> scenes.recordUpscale).
 *  {job, notes} | {status, error} */
function queueTake(project, n) {
  const core = require("./core"), scenes = require("./scenes");
  const takeUpscale = require("./takeUpscale"), renderSettings = require("./renderSettings");
  const pdir = core.projDir(project || core.getProject());
  const st = scenes.load(project);
  const r = scenes.at(st, n);
  if (!r) return { status: 404, error: "no such scene" };
  if (!r.output) return { status: 400, error: `scene ${n} has no rendered take to upscale - press ▶ first` };
  const running = r.job && core.jobs.get(r.job);
  if (running && !running.finished) return { status: 409, error: `scene ${n} is still rendering` };
  const up = r.upjob && core.jobs.get(r.upjob);
  if (up && !up.finished) return { status: 409, error: `scene ${n} is already in the upscale queue` };
  const src = takeUpscale.source(pdir, r.output);
  if (!src) return { status: 400, error: `scene ${n}: the take is not in the project's Video assets any more - render it again, then ⏫` };
  const rs = renderSettings.read(pdir);
  const jp = jobParams(src.file, probe(src.file), { ...read(pdir), size: sizeFromSettings(rs) }, {
    label: `scene ${n} · SeedVR2 ⏫ ${path.basename(src.mp4)}`,
    output_name: path.basename(src.mp4).replace(/\.[^.]+$/, "") + "_seedvr2.mp4",
    scene: { n: r.n, chapter: r.chapter, upscale: true } });
  if (jp.error) return { status: 400, error: `scene ${n}: ${jp.error}` };
  if (src.master) jp.params.audio_source = src.mp4;          // the master may be picture only - the take has the sound
  const job = core.makeJob(jp.params);
  scenes.save(scenes.upscaling(st, n, job.id).state, project);
  return { job, notes: [jp.note + (src.master ? " - read from its lossless master" : "")] };
}

/** A take just landed (routes/characters.js syncJobs): the ⚙ on SeedVR2 with "Upscale every render" queues it. */
function onTake(project, n) {
  try {
    const core = require("./core"), renderSettings = require("./renderSettings");
    const rs = renderSettings.read(core.projDir(project || core.getProject()));
    if (!isUpscaler(rs) || !rs.upscale_auto) return null;
    return queueTake(project, n);
  } catch (e) { return { status: 500, error: String((e && e.message) || e) }; }
}

module.exports = { queueTake, onTake, FILE, UPSCALER, DEFAULT_MODEL, COLORS, SIZES, DEFAULTS, normalize, read, save, fileFor,
                   target, probe, resolve, jobParams, isUpscaler, sizeFromSettings };
