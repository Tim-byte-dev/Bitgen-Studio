/* bitGen Studio — DLSS 5 ENHANCE / UPSCALE / FRAME GENERATION for videos (2.504.0).
 *
 * Tim linked https://github.com/RH-RunningHub/ComfyUI-RH-DLSS5 with his "secret sauce" H3 workflow (which ends in
 * RH_DLSS5Enhance at 4K). One job (mode "dlss5", dlss5_worker.py) runs one video through it (scripts/dlss5_graph.py).
 * Three doors, the same as SeedVR2's:
 *  - the preview dock's ⚡ DLSS 5 - the video you are looking at (static/dlss5panel.js);
 *  - the video docker's ⚙ Upscaler "DLSS 5" - a scene's ⏫ runs its take through it (routes/characters.js queueScene)
 *    and "Upscale every render" queues it as each take lands (onTake);
 *  - POST /api/dlss5 (routes/dlss5.js).
 * The options (mode, style, strengths, frame generation) are the project's dlss5.json. NVIDIA RTX only; NVIDIA's DLLs
 * are the user's own (ComfyUI/models/dlss5/). The size rule is scripts/dlss5_graph.target (one copy, Python) - this
 * file asks it, never re-implements it. */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const seedvr2 = require("./seedvr2");                  // resolve (a named video) + probe - the same as SeedVR2's

const FILE = "dlss5.json";
const UPSCALER = "dlss5";                                // the ⚙ Upscaler value that means "DLSS 5"
const MODES = ["1x (DLAA / native)", "1.5x (Quality)", "1.724x (Balanced)", "2x (Performance)", "3x (Ultra Performance)",
  "1K", "2K", "4K", "8K"];
const STYLES = ["default", "natural", "cinematic", "off (bypass NR)"];
const FPS_OUT = ["off", "2x", "3x", "4x", "48", "50", "60", "72", "90", "96", "120", "144"];
const DEFAULTS = { mode: "2K", style: "default", intensity: 1, tone: 1, structure: 1.5, skin: 1, detail: 1, color: 1, fps: "off" };
const num = (v, d, lo, hi) => { const x = parseFloat(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };

function normalize(o) {
  const s = o && typeof o === "object" ? o : {};
  return {
    mode: MODES.includes(s.mode) ? s.mode : DEFAULTS.mode,
    style: STYLES.includes(s.style) ? s.style : DEFAULTS.style,
    intensity: num(s.intensity, 1, 0, 2), tone: num(s.tone, 1, 0, 2), structure: num(s.structure, 1.5, 0, 2),
    skin: num(s.skin, 1, -1, 2), detail: num(s.detail, 1, 0, 2), color: num(s.color, 1, 0, 1),
    fps: FPS_OUT.includes(String(s.fps)) ? String(s.fps) : "off",
  };
}
const fileFor = (projDir) => path.join(projDir, FILE);
function read(projDir) { try { return normalize(JSON.parse(fs.readFileSync(fileFor(projDir), "utf8"))); } catch { return normalize({}); } }
function save(projDir, patch) {
  const s = normalize({ ...read(projDir), ...(patch || {}) });
  fs.mkdirSync(projDir, { recursive: true });
  fs.writeFileSync(fileFor(projDir), JSON.stringify(s, null, 2));
  return s;
}

/** What DLSS makes from w x h in `mode` - scripts/dlss5_graph.target (the one copy of the rule). {width, height, factor} | {error} */
function target(w, h, mode) {
  const py = process.env.H3_PYTHON || "python3";
  const code = "import sys,json; sys.path.insert(0, sys.argv[1]); import dlss5_graph as D; print(json.dumps(D.target(int(sys.argv[2]), int(sys.argv[3]), sys.argv[4])))";
  try {
    const r = spawnSync(py, ["-c", code, path.join(__dirname, "..", "scripts"), String(w | 0), String(h | 0), String(mode)],
      { encoding: "utf8", timeout: 20000, windowsHide: true });
    return JSON.parse((r.stdout || "").trim());
  } catch (e) { return { error: "could not work out the DLSS size: " + String((e && e.message) || e) }; }
}

/** The job's params for `file` (absolute) of `size` with the options `o`. {params, note, target} | {error} */
function jobParams(file, size, o, extra) {
  const s = normalize(o);
  if (!size) return { error: `could not read ${path.basename(String(file))} (is ffprobe installed?)` };
  const t = target(size.width, size.height, s.mode);
  if (!t || t.error) return { error: (t && t.error) || "no DLSS size" };
  const x = extra || {};
  const label = x.label || `DLSS 5 ⚡ ${path.basename(file)}`;
  const params = {
    mode: "dlss5", source: file, prompt: label, label, dlss: s, width: t.width, height: t.height,
    ...(Number.isFinite(x.start) && x.start > 0 ? { start: x.start } : {}),
    ...(Number.isFinite(x.duration) && x.duration > 0 ? { duration: x.duration } : {}),
    ...(x.output_name ? { output_name: String(x.output_name) } : {}),
    ...(x.scene ? { scene: x.scene } : {}),
  };
  const note = `DLSS 5 ${s.mode} (${s.style}) on ${path.basename(file)} ${size.width}x${size.height} -> about ${t.width}x${t.height}`
    + (s.fps !== "off" ? ` + frame generation ${s.fps}` : "") + " (NVIDIA RTX; the DLLs in ComfyUI/models/dlss5/)";
  return { params, note, target: t };
}

const isUpscaler = (rs) => !!rs && String(rs.upscaler || "") === UPSCALER;
/** the ⚙ Upscale resolution as a DLSS bucket (720 -> 1x DLAA, 1080 -> 1K, 1440 -> 2K, 2160 -> 4K) */
function modeFromSettings(rs) {
  return { 720: "1x (DLAA / native)", 1080: "1K", 1440: "2K", 2160: "4K" }[String((rs && rs.upscale_res) || "")] || DEFAULTS.mode;
}

/** ⏫ on a board scene with the ⚙ Upscaler on DLSS 5: its take (the lossless master when there is one) at the ⚙'s
 *  resolution, the rest from dlss5.json; filed as the scene's upscaled take like SeedVR2's. {job, notes} | {status, error} */
function queueTake(project, n) {
  const core = require("./core"), scenes = require("./scenes");
  const takeUpscale = require("./takeUpscale"), renderSettings = require("./renderSettings");
  const pdir = core.projDir(project || core.getProject());
  const st = scenes.load(project);
  const r = scenes.at(st, n);
  if (!r) return { status: 404, error: "no such scene" };
  if (!r.output) return { status: 400, error: `scene ${n} has no rendered take to enhance - press ▶ first` };
  const running = r.job && core.jobs.get(r.job);
  if (running && !running.finished) return { status: 409, error: `scene ${n} is still rendering` };
  const up = r.upjob && core.jobs.get(r.upjob);
  if (up && !up.finished) return { status: 409, error: `scene ${n} is already in the upscale queue` };
  const src = takeUpscale.source(pdir, r.output);
  if (!src) return { status: 400, error: `scene ${n}: the take is not in the project's Video assets any more - render it again, then ⏫` };
  const rs = renderSettings.read(pdir);
  const jp = jobParams(src.file, seedvr2.probe(src.file), { ...read(pdir), mode: modeFromSettings(rs) }, {
    label: `scene ${n} · DLSS 5 ⏫ ${path.basename(src.mp4)}`,
    output_name: path.basename(src.mp4).replace(/\.[^.]+$/, "") + "_dlss5.mp4",
    scene: { n: r.n, chapter: r.chapter, upscale: true } });
  if (jp.error) return { status: 400, error: `scene ${n}: ${jp.error}` };
  if (src.master) jp.params.audio_source = src.mp4;
  const job = core.makeJob(jp.params);
  scenes.save(scenes.upscaling(st, n, job.id).state, project);
  return { job, notes: [jp.note + (src.master ? " - read from its lossless master" : "")] };
}
/** A take just landed: the ⚙ on DLSS 5 with "Upscale every render" queues it. */
function onTake(project, n) {
  try {
    const core = require("./core"), renderSettings = require("./renderSettings");
    const rs = renderSettings.read(core.projDir(project || core.getProject()));
    if (!isUpscaler(rs) || !rs.upscale_auto) return null;
    return queueTake(project, n);
  } catch (e) { return { status: 500, error: String((e && e.message) || e) }; }
}

module.exports = { FILE, UPSCALER, MODES, STYLES, FPS_OUT, DEFAULTS, normalize, read, save, fileFor, target, jobParams,
  isUpscaler, modeFromSettings, queueTake, onTake, resolve: seedvr2.resolve, probe: seedvr2.probe };
