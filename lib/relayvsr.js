/* bitGen Studio — RelayVSR VIDEO UPSCALING (2.728.0), ComfyUI's core nodes.
 *
 * Tim (verbatim): "yes please add a 1920x1080 automatic preset and add https://github.com/kopperx/RelayVSR"
 *
 * RelayVSR (kopperx/RelayVSR, Apache-2.0; ComfyUI core since PR #17511, 2026-11-05) upscales by the MODEL's factor:
 * the x2 pair (LightX2V's, trained on MiniMax H3 clips) or the x4 pair - Comfy-Org/RelayVSR's int8 repacks, downloaded by
 * Settings ▸ Add-ons ▸ RelayVSR (lib/relayvsrAddon.js). One job (mode "relayvsr", misc/relayvsr_worker.py,
 * scripts/relayvsr_graph.py). The size asked for is SeedVR2's list (lib/seedvr2.js target: 720 ... 2160 short side,
 * x2 / x3 / x4, the 1920x1080 frame) or "native" (just the model's factor); "auto" picks the SMALLEST pair that reaches
 * it (x2 for a 960x544 clip -> 1920x1080, x4 for 2160p) and the worker's ffmpeg takes the result to the exact size.
 * Three doors, the same as SeedVR2's: the preview dock's 🔁 RelayVSR (static/relayvsrpanel.js), the video docker's
 * ⚙ Upscaler "RelayVSR" (a scene's ⏫, "Upscale every render"), POST /api/relayvsr (routes/relayvsr.js). */
"use strict";
const fs = require("fs");
const path = require("path");
const seedvr2 = require("./seedvr2");                  // resolve (a named video) + probe + target - the same as SeedVR2's

const FILE = "relayvsr.json";
const UPSCALER = "relayvsr";                             // the ⚙ Upscaler value that means "RelayVSR"
const MODELS = {
  x2: { factor: 2, unet: "relayvsr_x2_lightx2v_int8_convrot.safetensors", vae: "relayvsr_flash_vae_x2_fp32.safetensors",
    label: "x2 (LightX2V - trained on H3 clips)" },
  x4: { factor: 4, unet: "relayvsr_x4_int8_convrot.safetensors", vae: "relayvsr_flash_vae_x4_fp32.safetensors",
    label: "x4 (the original)" },
};
const MODEL_CHOICES = ["auto", "x2", "x4"];
const SIZES = ["native", ...seedvr2.SIZES];
const DEFAULTS = { size: "1920x1080", model: "auto", detail: 1, seed: -1 };
const INSTALL_NOTE = "RelayVSR runs in ComfyUI's own nodes - ComfyUI newer than the v0.44.0 release (Settings ▸ ComfyUI ▸ "
  + "⤓ Update ComfyUI, \"latest\"). Settings ▸ Add-ons ▸ RelayVSR downloads the model files (x2 5.2 GB, x4 5.2 GB).";

function normalize(o) {
  const s = o && typeof o === "object" ? o : {};
  const out = { ...DEFAULTS };
  if (SIZES.includes(String(s.size))) out.size = String(s.size);
  if (MODEL_CHOICES.includes(String(s.model))) out.model = String(s.model);
  const d = parseFloat(s.detail);
  if (Number.isFinite(d)) out.detail = Math.max(0, Math.min(1, Math.round(d * 100) / 100));
  const sd = parseInt(s.seed, 10);
  out.seed = Number.isSafeInteger(sd) && sd >= 0 ? sd : -1;
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

/** What RelayVSR makes of w x h: {width, height, fit?, factor, model, made: {width, height}, scaled, note} | {error}.
 *  made = the model's own x2 / x4 output; width x height = the size asked for (the worker's ffmpeg gets there). */
function plan(size, model, w, h) {
  if (!(w > 0 && h > 0)) return { error: "could not read the video's size (is ffprobe installed?)" };
  const sz = String(size || DEFAULTS.size), m = MODEL_CHOICES.includes(String(model)) ? String(model) : "auto";
  if (sz === "native") {
    const f = m === "x4" ? 4 : 2;
    return { width: w * f, height: h * f, factor: f, model: "x" + f, made: { width: w * f, height: h * f }, scaled: false };
  }
  const t = seedvr2.target(sz, w, h);
  if (t.error) return { error: t.error };
  const need = t.fit === "crop" ? t.mult : Math.max(t.width / w, t.height / h);   // the factor the size asks for
  let f = m === "x4" ? 4 : m === "x2" ? 2 : need <= 2.0001 ? 2 : 4;
  if (need > f + 0.0001) {
    if (m === "x2") return { error: `${t.width}x${t.height} is more than RelayVSR x2 makes from ${w}x${h} (${w * 2}x${h * 2}) - pick x4 or auto` };
    return { error: `${t.width}x${t.height} is more than RelayVSR x4 makes from ${w}x${h} (${w * 4}x${h * 4}) - pick a smaller size` };
  }
  const made = { width: w * f, height: h * f };
  return { width: t.width, height: t.height, ...(t.fit ? { fit: t.fit } : {}), factor: f, model: "x" + f, made,
    scaled: made.width !== t.width || made.height !== t.height, mult: t.mult };
}

/** The job's params for `file` (absolute) of `size` with the options `o`. {params, note, target} | {error} */
function jobParams(file, size, o, extra) {
  const s = normalize(o);
  if (!size) return { error: `could not read ${path.basename(String(file))} (is ffprobe installed?)` };
  const t = plan(s.size, s.model, size.width, size.height);
  if (t.error) return { error: t.error };
  const x = extra || {};
  const M = MODELS[t.model];
  const label = x.label || `RelayVSR 🔁 ${path.basename(file)}`;
  const params = {
    mode: "relayvsr", source: file, width: t.width, height: t.height, ...(t.fit ? { fit: t.fit } : {}),
    factor: t.factor, unet: M.unet, vae: M.vae, detail: s.detail, seed: s.seed, prompt: label, label,
    ...(Number.isFinite(x.start) && x.start > 0 ? { start: x.start } : {}),
    ...(Number.isFinite(x.duration) && x.duration > 0 ? { duration: x.duration } : {}),
    ...(x.output_name ? { output_name: String(x.output_name) } : {}),
    ...(x.scene ? { scene: x.scene } : {}),
  };
  const after = !t.scaled ? "" : t.fit === "crop" && (t.made.width !== t.width || t.made.height !== t.height)
    ? `, then ${t.width}x${t.height} (lanczos to cover the frame, the edges trimmed)` : `, then ${t.width}x${t.height} (lanczos)`;
  const note = `RelayVSR ${M.label} upscales ${path.basename(file)} ${size.width}x${size.height} -> ${t.made.width}x${t.made.height}${after}`
    + ` (${M.unet}, detail ${s.detail})`;
  return { params, note, target: t };
}

const isUpscaler = (rs) => !!rs && String(rs.upscaler || "") === UPSCALER;
/** The ⚙ Upscale resolution (720 / 1080 / 1440 / 2160 / 1920x1080) as a RelayVSR size */
function sizeFromSettings(rs) {
  const r = String((rs && rs.upscale_res) || "");
  return SIZES.includes(r) ? r : DEFAULTS.size;
}

/** Does the running ComfyUI have the RelayVSR nodes? {online, nodes} (never throws) */
async function comfySupport(o) {
  const opt = o || {};
  let url = opt.url != null ? String(opt.url) : "";
  if (opt.url == null) { try { url = require("./comfy").comfyCfg().url; } catch { url = ""; } }
  const f = opt.fetch || (typeof fetch === "function" ? fetch : null);
  if (!url || !f) return { online: false, nodes: false };
  try {
    const r = await f(`${String(url).replace(/\/$/, "")}/object_info/RelayVSRConditioning`, { signal: AbortSignal.timeout(opt.timeout || 4000) });
    if (!r.ok) return { online: true, nodes: false };
    const j = await r.json();
    return { online: true, nodes: !!(j && j.RelayVSRConditioning) };
  } catch { return { online: false, nodes: false }; }
}

/** ⏫ on a board scene with the ⚙ Upscaler on RelayVSR: its take (the lossless master when there is one) at the ⚙'s
 *  Upscale resolution; filed as the scene's upscaled take like SeedVR2's. {job, notes} | {status, error} */
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
  const jp = jobParams(src.file, seedvr2.probe(src.file), { ...read(pdir), size: sizeFromSettings(rs) }, {
    label: `scene ${n} · RelayVSR ⏫ ${path.basename(src.mp4)}`,
    output_name: path.basename(src.mp4).replace(/\.[^.]+$/, "") + "_relayvsr.mp4",
    scene: { n: r.n, chapter: r.chapter, upscale: true } });
  if (jp.error) return { status: 400, error: `scene ${n}: ${jp.error}` };
  if (src.master) jp.params.audio_source = src.mp4;
  const job = core.makeJob(jp.params);
  scenes.save(scenes.upscaling(st, n, job.id).state, project);
  return { job, notes: [jp.note + (src.master ? " - read from its lossless master" : "")] };
}
/** A take just landed: the ⚙ on RelayVSR with "Upscale every render" queues it. */
function onTake(project, n) {
  try {
    const core = require("./core"), renderSettings = require("./renderSettings");
    const rs = renderSettings.read(core.projDir(project || core.getProject()));
    if (!isUpscaler(rs) || !rs.upscale_auto) return null;
    return queueTake(project, n);
  } catch (e) { return { status: 500, error: String((e && e.message) || e) }; }
}

module.exports = { FILE, UPSCALER, MODELS, MODEL_CHOICES, SIZES, DEFAULTS, INSTALL_NOTE, normalize, read, save, fileFor, plan,
  jobParams, isUpscaler, sizeFromSettings, comfySupport, queueTake, onTake, resolve: seedvr2.resolve, probe: seedvr2.probe };
