/* bitGen Studio — RTX VFX VIDEO FINISHER for videos (2.708.0): NVIDIA RTX Video Super Resolution / Deblur / High Bitrate.
 *
 * Tim: "Add the RTX upscale". The DENO pack's DenoRTXVFXVideoFinisher (https://github.com/Deno2026/comfyui-deno-custom-nodes)
 * as another take upscaler beside SeedVR2 and DLSS 5. One job (mode "rtxvfx", misc/rtxvfx_worker.py) runs one video
 * through it (scripts/rtxvfx_graph.py). Three doors, the same as DLSS 5's:
 *  - the preview dock's ✨ RTX VFX - the video you are looking at (static/rtxvfxpanel.js);
 *  - the video docker's ⚙ Upscaler "RTX VFX" - a scene's ⏫ runs its take through it (routes/characters.js queueScene)
 *    and "Upscale every render" queues it as each take lands (onTake);
 *  - POST /api/rtxvfx (routes/rtxvfx.js).
 * The options (preset A VSR / B Deblur + High Bitrate / custom passes, scale, frames per batch) are the project's
 * rtxvfx.json. The combo choices are whatever THIS ComfyUI's node offers (liveOptions - /object_info); the strings here
 * are only Tim's export's defaults. NVIDIA RTX on Windows; NVIDIA's runtime goes in with the pack's installer.
 * The size estimate is scripts/rtxvfx_graph.target (one copy, Python) - this file asks it. */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const seedvr2 = require("./seedvr2");                  // resolve (a named video) + probe - the same as SeedVR2's

const FILE = "rtxvfx.json";
const UPSCALER = "rtxvfx";                               // the ⚙ Upscaler value that means "RTX VFX"
const NODE = "DenoRTXVFXVideoFinisher";
const PASS_KEYS = ["first_pass", "first_quality", "upscale_pass", "upscale_quality"];
const PRESETS = {                                        // Tim's two (his export)
  vsr: { first_pass: "Off", first_quality: "Ultra", upscale_pass: "VSR", upscale_quality: "High" },
  twopass: { first_pass: "Deblur", first_quality: "Ultra", upscale_pass: "High Bitrate", upscale_quality: "High" },
};
const PRESET_LABELS = { vsr: "A - Super Resolution (VSR)", twopass: "B - Deblur, then High Bitrate", custom: "Custom" };
const DEFAULTS = { preset: "vsr", ...PRESETS.vsr, scale: 2, batch: 48 };   // batch = frames per run (the worker's chunks), 0 = one run
const INSTALL_NOTE = "NVIDIA RTX on Windows only. Settings → ComfyUI → Install DENO nodes (RTX VFX), then NVIDIA's runtime: "
  + "extract the official installer zip into ComfyUI/custom_nodes/deno-custom-nodes/tools/, close ComfyUI, run install_rtx_vfx.bat, "
  + "restart ComfyUI (https://deno2026.github.io/comfyui-deno-custom-nodes/rtx-vfx-install/)";
const num = (v, d, lo, hi) => { const x = parseFloat(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
const word = (v, d) => { const s = String(v == null ? "" : v).trim(); return s && s.length <= 60 && !/[\x00-\x1f]/.test(s) ? s : d; };

function normalize(o) {
  const s = o && typeof o === "object" ? o : {};
  const preset = ["vsr", "twopass", "custom"].includes(s.preset) ? s.preset : DEFAULTS.preset;
  const base = PRESETS[preset] || PRESETS.vsr;
  const out = { preset };
  for (const k of PASS_KEYS) out[k] = PRESETS[preset] ? base[k] : word(s[k], base[k]);
  out.scale = Math.round(num(s.scale, DEFAULTS.scale, 1, 4) * 1000) / 1000;
  out.batch = Math.round(num(s.batch, DEFAULTS.batch, 0, 4096));
  return out;
}
const fileFor = (projDir) => path.join(projDir, FILE);
function read(projDir) { try { return normalize(JSON.parse(fs.readFileSync(fileFor(projDir), "utf8"))); } catch { return normalize({}); } }
function save(projDir, patch) {
  const s = normalize({ ...read(projDir), ...(patch || {}) });
  fs.mkdirSync(projDir, { recursive: true });
  fs.writeFileSync(fileFor(projDir), JSON.stringify(s, null, 2));
  return s;
}

/** ABOUT what the finisher makes from w x h at `scale` - scripts/rtxvfx_graph.target (the one copy). {width, height, factor} | {error} */
function target(w, h, scale) {
  const py = process.env.H3_PYTHON || "python3";
  const code = "import sys,json; sys.path.insert(0, sys.argv[1]); import rtxvfx_graph as R; print(json.dumps(R.target(int(sys.argv[2]), int(sys.argv[3]), float(sys.argv[4]))))";
  try {
    const r = spawnSync(py, ["-c", code, path.join(__dirname, "..", "scripts"), String(w | 0), String(h | 0), String(+scale || DEFAULTS.scale)],
      { encoding: "utf8", timeout: 20000, windowsHide: true });
    return JSON.parse((r.stdout || "").trim());
  } catch (e) { return { error: "could not work out the RTX VFX size: " + String((e && e.message) || e) }; }
}

/** The job's params for `file` (absolute) of `size` with the options `o`. {params, note, target} | {error} */
function jobParams(file, size, o, extra) {
  const s = normalize(o);
  if (!size) return { error: `could not read ${path.basename(String(file))} (is ffprobe installed?)` };
  const t = target(size.width, size.height, s.scale);
  if (!t || t.error) return { error: (t && t.error) || "no RTX VFX size" };
  const x = extra || {};
  const label = x.label || `RTX VFX ✨ ${path.basename(file)}`;
  const params = {
    mode: "rtxvfx", source: file, prompt: label, label, rtx: s, width: t.width, height: t.height,
    ...(Number.isFinite(x.start) && x.start > 0 ? { start: x.start } : {}),
    ...(Number.isFinite(x.duration) && x.duration > 0 ? { duration: x.duration } : {}),
    ...(x.output_name ? { output_name: String(x.output_name) } : {}),
    ...(x.scene ? { scene: x.scene } : {}),
  };
  const passes = (s.first_pass === "Off" ? "" : `${s.first_pass} (${s.first_quality}) + `) + `${s.upscale_pass} (${s.upscale_quality})`;
  const note = `RTX VFX ${passes} x${s.scale} on ${path.basename(file)} ${size.width}x${size.height} -> about ${t.width}x${t.height}`
    + (s.batch ? `, ${s.batch} frames per run` : ", every frame in one run") + ` (NVIDIA RTX; the runtime from the DENO pack's install_rtx_vfx.bat)`;
  return { params, note, target: t };
}

const isUpscaler = (rs) => !!rs && String(rs.upscaler || "") === UPSCALER;
/** the ⚙ Upscale resolution (the upscaled short side) as a scale for a take of `size`: 1..4, 1x when it is there already */
function scaleFromSettings(rs, size) {
  const res = parseInt(require("./renderSettings").resShort((rs && rs.upscale_res) || ""), 10);   // 2.728.0: "1920x1080" = 1080
  const short = size ? Math.min(size.width | 0, size.height | 0) : 0;
  if (!(res > 0) || !(short > 0)) return DEFAULTS.scale;
  return Math.round(Math.max(1, Math.min(4, res / short)) * 1000) / 1000;
}

/** What THIS ComfyUI's node offers for each combo (/object_info) - {online, pack, options: {widget: [..]}}; never throws */
async function liveOptions(o) {
  const opt = o || {};
  let url = opt.url != null ? String(opt.url) : "";
  if (opt.url == null) { try { url = require("./comfy").comfyCfg().url; } catch { url = ""; } }
  const f = opt.fetch || (typeof fetch === "function" ? fetch : null);
  const out = { online: false, pack: false, options: {} };
  if (!url || !f) return out;
  const base = String(url).replace(/\/$/, "");
  try {
    const r = await f(`${base}/object_info/${encodeURIComponent(NODE)}`, { signal: AbortSignal.timeout(opt.timeout || 4000) });
    if (!r.ok) return out;
    const j = await r.json();
    out.online = true;
    out.pack = !!(j && j[NODE]);
    if (out.pack) {
      const { comboFrom } = require("./comfyModels");
      for (const k of [...PASS_KEYS, "resize_type"]) { const l = comboFrom(j, NODE, k); if (l && l.length) out.options[k] = l; }
    }
  } catch { /* offline: the defaults stand, the worker checks against the live list */ }
  return out;
}

/** ⏫ on a board scene with the ⚙ Upscaler on RTX VFX: its take (the lossless master when there is one) scaled to the
 *  ⚙'s resolution, the passes from rtxvfx.json; filed as the scene's upscaled take like SeedVR2's. {job, notes} | {status, error} */
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
  const size = seedvr2.probe(src.file);
  const jp = jobParams(src.file, size, { ...read(pdir), scale: scaleFromSettings(rs, size) }, {
    label: `scene ${n} · RTX VFX ⏫ ${path.basename(src.mp4)}`,
    output_name: path.basename(src.mp4).replace(/\.[^.]+$/, "") + "_rtxvfx.mp4",
    scene: { n: r.n, chapter: r.chapter, upscale: true } });
  if (jp.error) return { status: 400, error: `scene ${n}: ${jp.error}` };
  if (src.master) jp.params.audio_source = src.mp4;
  const job = core.makeJob(jp.params);
  scenes.save(scenes.upscaling(st, n, job.id).state, project);
  return { job, notes: [jp.note + (src.master ? " - read from its lossless master" : "")] };
}
/** A take just landed: the ⚙ on RTX VFX with "Upscale every render" queues it. */
function onTake(project, n) {
  try {
    const core = require("./core"), renderSettings = require("./renderSettings");
    const rs = renderSettings.read(core.projDir(project || core.getProject()));
    if (!isUpscaler(rs) || !rs.upscale_auto) return null;
    return queueTake(project, n);
  } catch (e) { return { status: 500, error: String((e && e.message) || e) }; }
}

module.exports = { FILE, UPSCALER, NODE, PASS_KEYS, PRESETS, PRESET_LABELS, DEFAULTS, INSTALL_NOTE, normalize, read, save, fileFor,
  target, jobParams, isUpscaler, scaleFromSettings, liveOptions, queueTake, onTake, resolve: seedvr2.resolve, probe: seedvr2.probe };
