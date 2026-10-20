// bitGen Studio — THE VIDEO DOCKER'S RENDER SETTINGS (2.312.0).
//
// Tim (verbatim): "add a settings button to the right of the video docker
// menu bar. in the video docker . on click show a dropdown, with
// resolution, steps, cfg, lora adder, sage attention checkbox, spectrum
// checkbox, comfy kitchen checkbox, upscaler dropdown, upscale resolution.
// Add a workflow for comfyui upscaler,
// https://github.com/bbaudio-2025/Comfyui-MMH3-UltimateUpscale".
//
// ONE record per project, projects/<p>/render_settings.json, read by every
// scene render the board queues (routes/characters.js queueScene and the
// H3_Video_Ref path). Blank = "the workflow's own" everywhere, so a project
// that never opens the ⚙ renders exactly as before.
//   res / aspect   the render size (the Basic Settings rule: the short side
//                  is `res`, 16-px aligned); "" = the app default size
//   steps / cfg    null = the graph's own. cfg reaches a node with a cfg
//                  input; on the H3 graphs (BasicGuider, no cfg) a cfg above
//                  1 switches to true CFG - scripts/truecfg.py (2.366.0)
//   sage/spectrum  the video accelerators (worker.apply_video_accel):
//                  sage "auto", spectrum "on" - checked ON, unchecked OFF
//   kitchen        Comfy Kitchen's kernels only run on FP8/NVFP4 weights,
//                  so this loads phase 1's model as fp8_e4m3fn_fast (the
//                  2.303.0 load precision); a file that is already int8 /
//                  fp8 / gguf is left as it is and the log says so
//   long_run       2.503.0 (Tim: "the secret sauce workflow is meant to be able to do 25 sec video"): LONG VIDEO -
//                  KJNodes' MiniMax low-VRAM attention + chunked feed-forward ride the graph (worker
//                  apply_video_accel, lib/h3Long) and ONE scene renders up to 30 s instead of 15 s; with
//                  `kitchen` also ticked the "comfy kitchen attention" backend goes in front (the export's order)
//   upscaler       a file in ComfyUI's models/latent_upscale_models
//                  ("" = off): the MMH3 Ultimate Upscale stage runs after
//                  the sampler (scripts/upscalestage.py splices
//                  comfy_workflows/MMH3_UltimateUpscale_stage.json in, or
//                  re-aims a stage the export already has)
//   upscale_res    the upscaled short side (720/1080/1440/2160), 32-px
//                  aligned, the render's aspect kept
//   upscale_auto   2.315.0 (Tim: "i would prefer to press the button so i
//                  can preview the scene") - false (the default): a render
//                  never upscales, ⏫ upscales the take you approved
//                  (lib/takeUpscale); true: every render runs the stage
//   png_size       2.313.0 - the take's last 2 s saved as PNGs at this short
//                  side ("off" = none); the next scene continues from them
//                  (lib/tailFrames.js, scripts/tailpngs.py)
//   png_upscaler   "" = lanczos, else a file in ComfyUI's models/upscale_models
//                  (ComfyUI's image upscale workflow)
//   basic_width / basic_height  2.357.0 (Tim: "does the native audio use the
//                  basic settings in the left docker? I would like to be able
//                  to change the resolution") - the left Basic Settings'
//                  width x height, sent with every board ▶ / ↻ / render
//                  selected and kept here so queued and auto renders use it
//                  too (16-px aligned, 256..2048; 0 = never sent). The ⚙
//                  Resolution still wins when it is set; blank = this size.
// The LoRA adder edits the SAME list as Basic Settings' video temp LoRAs
// (lib/tempLoras, projects/<p>/video-loras-temp.json) - one list, two views.
const fs = require("fs");
const path = require("path");

const FILE = "render_settings.json";
const RES = ["", "480", "540", "720", "1080"];
const ASPECTS = ["16:9", "9:16", "4:3", "3:4", "1:1"];
const UPSCALE_RES = ["720", "1080", "1440", "2160"];
const PNG_SIZES = ["off", "720", "1080", "1440", "2160"];      // 2.313.0
const DEFAULTS = Object.freeze({ res: "", aspect: "16:9", steps: null, cfg: null,
  sage: false, spectrum: false, kitchen: false, long_run: false, upscaler: "", upscale_res: "1080",
  upscale_auto: false, png_size: "1080", png_upscaler: "", basic_width: 0, basic_height: 0,
  basic_override: false, basic_steps: 0, basic_cfg: null, basic_model: "", h3_fit: "down",
  seed_mode: "random", seed: -1, last_seed: null });
// 2.384.0 (Tim: "add option in settings of video docker to reuse same seed for all scenes and the seed input (show last
// seed used with option to set as seed)"): seed_mode "random" (each scene a fresh seed - unless the scene has its own)
// or "same" (every scene renders with `seed`; -1 there = the last seed used); last_seed = the seed of the last take
// the board filed (lib/sceneSeed.js).
const SEED_MODES = ["random", "same"];
// 2.380.0 (Tim: "add the 736 as an option in videodocker settings"): H3 renders in 32-px steps. "down" = round the
// size down (1280x720 -> 1280x704, the take is 704 high); "up" = render the next step up (1280x736) and crop the take
// back to the exact size asked for (1280x720) - about 4% more work. worker.py _h3_size / _crop_take.
const H3_FIT = ["down", "up"];
const KITCHEN_DTYPE = "fp8_e4m3fn_fast";

/** 2.357.0: one side of the Basic Settings size - 16-px aligned, 256..2048, else 0. */
function basicSide(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 256 || n > 2048) return 0;
  return Math.round(n / 16) * 16;
}

/** 2.357.0: the {width, height} a board render sent from the left Basic Settings
 *  -> the patch to save ({} when it is missing or out of range). */
function basicPatch(basic) {
  const b = basic || {};
  const w = basicSide(b.width), h = basicSide(b.height);
  const out = w && h ? { basic_width: w, basic_height: h } : {};
  // 2.375.0 (Tim: "i don't think the overide style in basic settings is working for video generation - i set it to
  // 15 steps but it is still rendering 20 steps"): the board never sent Basic Settings' Steps / CFG / Override
  // style - only the size. They ride with every ▶ now; Override style ON = they beat the ⚙ and the graph.
  if (b.override !== undefined) {
    out.basic_override = b.override === true || b.override === "true";
    const st = parseInt(b.steps, 10);
    out.basic_steps = Number.isFinite(st) && st >= 1 && st <= 200 ? st : 0;
    const c = b.cfg === "" || b.cfg == null ? NaN : Number(b.cfg);
    out.basic_cfg = Number.isFinite(c) && c >= 0 && c <= 30 ? Math.round(c * 100) / 100 : null;
    out.basic_model = modelName(b.model);                             // 2.409.0: Basic Settings' model
  }
  return out;
}
/** 2.409.0: a model name from Basic Settings (a ComfyUI dropdown value, maybe in a subfolder) or "" */
function modelName(v) {
  const m = String(v || "").trim().replace(/\\/g, "/");
  return m && m.length <= 240 && !/[\0<>|"?*]/.test(m) && !m.split("/").includes("..") ? m : "";
}

/** 2.357.0: keep the Basic Settings a board render sent (size; 2.375.0: + Override style, Steps, CFG) -
 *  nothing new to keep -> the record unchanged. */
function rememberBasic(projDir, basic) {
  const p = basicPatch(basic);
  if (!Object.keys(p).length) return read(projDir);
  const cur = read(projDir);
  if (Object.keys(p).every((k) => cur[k] === p[k])) return cur;
  return save(projDir, p);
}

function normalize(b, old) {
  const src = { ...DEFAULTS, ...(old || {}), ...(b || {}) };
  const out = { ...DEFAULTS };
  out.res = RES.includes(String(src.res)) ? String(src.res) : "";
  out.aspect = ASPECTS.includes(String(src.aspect)) ? String(src.aspect) : "16:9";
  const st = parseInt(src.steps, 10);
  out.steps = Number.isFinite(st) && st >= 1 && st <= 200 ? st : null;
  const c = src.cfg === "" || src.cfg == null ? NaN : Number(src.cfg);
  out.cfg = Number.isFinite(c) && c >= 0 && c <= 30 ? Math.round(c * 100) / 100 : null;
  for (const k of ["sage", "spectrum", "kitchen", "long_run", "upscale_auto"]) out[k] = src[k] === true;
  const up = String(src.upscaler || "").trim();
  out.upscaler = up && !up.includes("..") ? up.slice(0, 300) : "";
  out.upscale_res = UPSCALE_RES.includes(String(src.upscale_res)) ? String(src.upscale_res) : "1080";
  out.png_size = PNG_SIZES.includes(String(src.png_size)) ? String(src.png_size) : "1080";
  const pu = String(src.png_upscaler || "").trim();
  out.png_upscaler = pu && !pu.includes("..") ? pu.slice(0, 300) : "";
  const bw = basicSide(src.basic_width), bh = basicSide(src.basic_height);
  out.basic_width = bw && bh ? bw : 0;
  out.basic_height = bw && bh ? bh : 0;
  out.basic_override = src.basic_override === true;                  // 2.375.0
  const bst = parseInt(src.basic_steps, 10);
  out.basic_steps = Number.isFinite(bst) && bst >= 1 && bst <= 200 ? bst : 0;
  const bc = src.basic_cfg === "" || src.basic_cfg == null ? NaN : Number(src.basic_cfg);
  out.basic_cfg = Number.isFinite(bc) && bc >= 0 && bc <= 30 ? Math.round(bc * 100) / 100 : null;
  out.basic_model = modelName(src.basic_model);                       // 2.409.0
  out.h3_fit = H3_FIT.includes(String(src.h3_fit)) ? String(src.h3_fit) : "down";   // 2.380.0
  out.seed_mode = SEED_MODES.includes(String(src.seed_mode)) ? String(src.seed_mode) : "random";   // 2.384.0
  out.seed = seedVal(src.seed, -1);
  out.last_seed = seedVal(src.last_seed, null);
  if (out.last_seed === -1) out.last_seed = null;
  return out;
}

/* a seed: a whole number 0 .. 2^53, or -1 (random / unset); anything else -> dflt */
function seedVal(v, dflt) {
  if (v === "" || v == null) return dflt;
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  const i = Math.trunc(n);
  if (i < 0) return -1;
  return i <= Number.MAX_SAFE_INTEGER ? i : dflt;
}

function fileFor(projDir) { return path.join(projDir, FILE); }

function read(projDir) {
  try { return normalize(JSON.parse(fs.readFileSync(fileFor(projDir), "utf8"))); }
  catch { return normalize({}); }
}

function save(projDir, patch) {
  const n = normalize(patch, read(projDir));
  fs.mkdirSync(projDir, { recursive: true });
  fs.writeFileSync(fileFor(projDir), JSON.stringify(n, null, 2));
  return n;
}

const align = (v, a) => Math.max(a * 4, Math.round(v / a) * a);

/** The render size for a res + aspect (Basic Settings' rule), or null. */
function dims(res, aspect) {
  const p = parseInt(res, 10);
  if (!Number.isFinite(p) || p <= 0) return null;
  const [aw, ah] = String(aspect || "16:9").split(":").map(Number);
  if (!(aw > 0 && ah > 0)) return null;
  let w, h;
  if (aw >= ah) { h = align(p, 16); w = align(h * aw / ah, 16); }
  else { w = align(p, 16); h = align(w * ah / aw, 16); }
  return { width: w, height: h };
}

/** The upscaled size: short side = target, the render's aspect, 32-px
 *  aligned (the upscaler's step). */
function upscaleDims(target, width, height) {
  const t = parseInt(target, 10);
  if (!(t > 0 && width > 0 && height > 0)) return null;
  if (width >= height) {
    const h = align(t, 32);
    return { width: align(h * width / height, 32), height: h };
  }
  const w = align(t, 32);
  return { width: w, height: align(w * height / width, 32) };
}

/** What a scene job takes from the settings. base = {width, height, style}.
 *  Returns {width, height, steps, cfg, video_style, upscale_stage, upscale_auto, notes}. */
function jobOverrides(s, base) {
  s = normalize(s);
  const b = base || {};
  const notes = [];
  const d = dims(s.res, s.aspect);
  // 2.357.0: the ⚙ Resolution, else the left Basic Settings' size (the last board ▶), else the default
  const bs = !d && s.basic_width && s.basic_height ? { width: s.basic_width, height: s.basic_height } : null;
  const width = d ? d.width : bs ? bs.width : b.width, height = d ? d.height : bs ? bs.height : b.height;
  if (d) notes.push(`render size ${width}x${height} (${s.res}p ${s.aspect}, the StoryBoard's ⚙ - set its Resolution to default to use Basic Settings)`);
  else if (bs) notes.push(`render size ${width}x${height} (Basic Settings, the left dock)`);
  else if (width && height) notes.push(`render size ${width}x${height} (the app default - set Resolution in the left Basic Settings or the StoryBoard's ⚙)`);
  // 2.375.0: Basic Settings with Override style ON beat the ⚙ and the graph (that is what the switch says);
  // OFF: the ⚙, else the workflow's own count
  const ovSteps = s.basic_override && s.basic_steps ? s.basic_steps : 0;
  const steps = ovSteps || s.steps || 0;
  if (ovSteps) notes.push(`steps ${ovSteps} (Basic Settings - Override style is on`
    + (s.steps && s.steps !== ovSteps ? `; the StoryBoard's ⚙ says ${s.steps}` : "") + ")");
  else if (s.steps) notes.push(`steps ${s.steps} (the StoryBoard's ⚙)`);
  else notes.push(s.basic_override ? "steps: the workflow's own (Basic Settings Steps is on auto)"
                                   : "steps: the workflow's own (tick Override style in Basic Settings to use its Steps)");
  const ovCfg = s.basic_override && s.basic_cfg != null ? s.basic_cfg : null;
  const cfg = ovCfg != null ? ovCfg : s.cfg != null ? s.cfg : 1;
  const cfgWhy = ovCfg != null ? "Basic Settings - Override style" : "the StoryBoard's ⚙";
  if (ovCfg != null || s.cfg != null) notes.push(cfg > 1 ? `cfg ${cfg} (${cfgWhy}; true CFG on H3: a negative pass per step, about 2x time; turbo LoRA wants 1)`
                                  : `cfg ${cfg} (${cfgWhy}; H3's distilled single pass)`);
  let style = b.style ? { ...b.style } : null;
  // 2.409.0: Override style ON + a Basic Settings model -> phase 1's model (LTX styles also carry it as style.model)
  if (style && s.basic_override && s.basic_model) {
    const ph = Array.isArray(style.phases) && style.phases.length ? style.phases.map((p) => ({ ...(p || {}) })) : [{}];
    ph[0].model = s.basic_model;
    style.phases = ph;
    if ("model" in style) style.model = s.basic_model;
    notes.push(`model ${s.basic_model} (Basic Settings - Override style is on)`);
  }
  if (style) {
    style.accel = { ...(style.accel || {}), sage: s.sage ? "auto" : "off", spectrum: s.spectrum ? "on" : "off" };
    if (s.sage || s.spectrum)
      notes.push("accelerators: " + [s.sage ? "Sage attention" : "", s.spectrum ? "Spectrum" : ""]
        .filter(Boolean).join(" + ") + " (the StoryBoard's ⚙)");
    // 2.503.0: Long video - the ⚙ turns it on (a style that has it on keeps it); Comfy kitchen adds its attention
    if (s.long_run) style.accel.long = "on";
    if (style.accel.long === "on") {
      if (s.kitchen) style.accel.kitchen_attn = true;
      notes.push("Long video: MiniMax low-VRAM attention + chunked feed-forward"
        + (style.accel.kitchen_attn ? " + comfy kitchen attention" : "") + " - one run up to 30 s"
        + (s.sage ? " (Sage is skipped - the long run has its own attention patch)" : ""));
    }
    if (s.kitchen) {
      const ph = Array.isArray(style.phases) && style.phases.length
        ? style.phases.map((p) => ({ ...p })) : [{ model: "" }];
      if (!ph[0].dtype) ph[0].dtype = KITCHEN_DTYPE;
      style.phases = ph;
      notes.push(`Comfy Kitchen: phase 1 loads as ${ph[0].dtype} (its FP8 kernels need FP8 weights; `
        + "an int8/fp8/gguf file is left as it is)");
    }
  }
  let upscale_stage = null;
  // 2.400.0: "seedvr2" = SeedVR2 (video) - its own job on the finished take (lib/seedvr2.js), never an in-render stage
  if (s.upscaler === "seedvr2") {
    notes.push(s.upscale_auto
      ? `upscale: SeedVR2 -> ${s.upscale_res}p, queued as each take lands (its own job, the take kept)`
      : `upscaler ready: SeedVR2 -> ${s.upscale_res}p - ⏫ upscales a take once you have previewed it`);
  } else if (s.upscaler === "dlss5") {
    // 2.504.0: DLSS 5 (RunningHub's NVIDIA DLSS 5 nodes) - its own job on the finished take (lib/dlss5.js)
    notes.push(s.upscale_auto
      ? `upscale: DLSS 5 -> ${s.upscale_res}p, queued as each take lands (its own job, the take kept)`
      : `upscaler ready: DLSS 5 -> ${s.upscale_res}p - ⏫ enhances a take once you have previewed it`);
  } else if (s.upscaler) {
    const u = upscaleDims(s.upscale_res, width, height);
    if (u && (u.width > width || u.height > height)) {
      upscale_stage = { model: s.upscaler, width: u.width, height: u.height };
      notes.push(s.upscale_auto
        ? `upscale: ${s.upscaler} -> ${u.width}x${u.height} (MMH3 Ultimate Upscale, every render)`
        : `upscaler ready: ${s.upscaler} -> ${u.width}x${u.height} - ⏫ upscales a take once you have previewed it`);
    } else notes.push(`upscale skipped: ${s.upscale_res}p is not larger than the ${width}x${height} render`);
  }
  // 2.315.0: upscale_stage is WHAT the upscaler would do (the ⚙ preview
  // shows it); upscale_auto says whether a plain render runs it
  if (width && height && (width % 32 || height % 32)) {               // 2.380.0
    const r32 = (v, up) => (up ? Math.ceil(v / 32) : Math.floor(v / 32)) * 32;
    notes.push(s.h3_fit === "up"
      ? `H3 size: renders ${r32(width, true)}x${r32(height, true)}, the take cropped to ${width}x${height}`
      : `H3 size: ${r32(width, false)}x${r32(height, false)} (H3 renders in 32-px steps)`);
  }
  return { width, height, steps, cfg, video_style: style, upscale_stage,
           upscale_auto: s.upscale_auto, h3_fit: s.h3_fit, notes,
           // 2.409.0: what a model whose graph has no plain steps / cfg (LTX) is told - Override style ON only
           basic: s.basic_override ? { steps: s.basic_steps || 0, cfg: s.basic_cfg } : null };
}

module.exports = { FILE, RES, ASPECTS, UPSCALE_RES, PNG_SIZES, DEFAULTS, KITCHEN_DTYPE, H3_FIT, SEED_MODES, seedVal,
                   normalize, read, save, fileFor, dims, upscaleDims, jobOverrides,
                   basicSide, basicPatch, rememberBasic };
