// bitGen Studio v2 — core state & logic (ported from the standalone server.js;
// server.js itself stays minimal per project rule). Everything here is shared
// by routes/index.js.
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const gguf = require("./gguf");
const autoAssets = require("./autoAssets");
const crypto = require("crypto");
const { snap4n1Up, MAX_SINGLE_RUN } = require("./framePlan");

const BASE = path.join(__dirname, "..");
const WORKSPACE = path.join(BASE, "workspace");
const JOBS_DIR = path.join(WORKSPACE, "jobs");
const OUTPUT_DIR = path.join(WORKSPACE, "outputs");
// Settings live in TWO files (2.99.0): default.settings (the defaults, shipped,
// never written by a Save) and custom.settings (only what differs). The old
// config.json is migrated on first boot. See lib/settings.js.
const settingsStore = require("./settings");
const DEFAULTS_PATH = path.join(BASE, "default.settings");
const CUSTOM_PATH = path.join(BASE, "custom.settings");
const LEGACY_CONFIG_PATH = path.join(BASE, "config.json");
const MODELS_DIR = path.join(BASE, "models");
const LORAS_DIR = path.join(BASE, "loras");
const LLM_DIR = path.join(BASE, "llm-models");
const ASSETS_DIR = path.join(WORKSPACE, "assets"); // legacy
// 2.583.0 (Team ▸ render farm): the projects folder can be the team's shared one on the NAS (config.projects_dir,
// Settings ▸ Team - read at start, so a change needs a restart). `let`: set once below, after the settings load.
let PROJECTS_DIR = path.join(BASE, "projects");
// Image-generation styles: one readable file per style, styles/<name>.json.
// Top level next to models/ and loras/ because a style IS user content of the
// same kind — something you browse, copy between installs and back up.
const STYLES_DIR = path.join(BASE, "styles");
// ComfyUI graph bindings (2.120.0): one file per wired workflow,
// graphs/<name>.json. Top level for the same reason styles/ is — it is user
// content you browse, copy between installs and back up. lib/comfyGraphs.js
// owns the format; nothing else may write into this folder.
const GRAPHS_DIR = path.join(BASE, "graphs");

let currentProject = "default";
const PKINDS = { images: [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".jxl"],   // 2.479.0: + JPEG XL (lib/jxl.js)
                 video: [".webm", ".avi", ".mp4", ".mov", ".mkv"],
                 sound: [".wav", ".mp3", ".ogg", ".flac", ".m4a", ".opus"] };
function kindOf(ext) {
  for (const [k, exts] of Object.entries(PKINDS)) if (exts.includes(ext)) return k;
  return null;
}
function projDir(name) { return path.join(PROJECTS_DIR, name.replace(/[^A-Za-z0-9._ -]+/g, "_")); }
function ensureProject(name) {
  const d = projDir(name);
  /* The full tree, present from the FIRST moment a project exists (2.82.0):
     chat for saved conversations, the asset folders, and references with one
     subfolder per reference type. Created here rather than lazily by whichever
     feature touches them first, because "the folder appears when the feature is
     used" reads as "the folder is missing" to anyone looking at the project on
     disk — and this runs on every open too, so projects made by older builds
     grow the new folders the next time they are touched. */
  for (const sub of ["", "output", "video", "images", "sound", "final", "chat",
                     "references",                    // reference GROUPS (<group>.json)
                     // 2.101.0: the project's own reference MEDIA, saved with
                     // the project and reloaded on open — lib/projectRefs.js
                     "reference",
                     "timelines",                     // 2.107.0: named timelines (lib/timelines.js)
                     path.join("reference", "images"),
                     path.join("reference", "videos"),
                     path.join("reference", "audio")])
    fs.mkdirSync(path.join(d, sub), { recursive: true });
  return d;
}
function pDir(kind) { return path.join(projDir(currentProject), kind); }
/** Every folder a finished job may write into, newest convention first.
 *  A timeline compile lands in the project ROOT as <project>.mp4; generations
 *  go to output/; older builds wrote exports to final/. ONE list, so a new
 *  output location cannot be added without the completion check seeing it —
 *  a job whose file lands somewhere unlisted is marked FAILED despite the
 *  worker exiting 0, which is what happened when compiles first moved. */
function outputDirs(project) {
  const pd = projDir(project || currentProject);           // 2.583.0: a job's own project (a farm job), else the open one
  return [pd, path.join(pd, "output"), path.join(pd, "final")];
}
function outputExists(name, project) {
  return outputDirs(project).some((d) => fs.existsSync(path.join(d, path.basename(name))));
}
/** <project>/temp — the ControlNet chain's staging ground (2.97.1, by
 *  instruction): stage 1's render and the ControlNet pass are saved here as
 *  <date+time>.png before stage 2 finishes into output/ like any image.
 *  DELIBERATELY NOT in outputDirs(): a temp file must never satisfy a job's
 *  completion check, and the gallery must not index it. Created on demand. */
function tempDir() {
  const d = pDir("temp");
  try { fs.mkdirSync(d, { recursive: true }); } catch { /* a race is fine */ }
  return d;
}
/** temp/<YYYYMMDD-HHMMSS[-n]>.png — collision-proof within a second. */
function tempName(ext) {
  const t = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stem = `${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}`
    + `-${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}`;
  const e = String(ext || "png").replace(/^\./, "");
  let name = `${stem}.${e}`;
  for (let n = 1; fs.existsSync(path.join(tempDir(), name)); n++) name = `${stem}-${n}.${e}`;
  return name;
}
function prjPath(name) { return path.join(projDir(name), path.basename(projDir(name)) + ".prj"); }
ensureProject("default");
for (const d of [WORKSPACE, JOBS_DIR, OUTPUT_DIR, MODELS_DIR, LORAS_DIR, LLM_DIR, ASSETS_DIR, STYLES_DIR, GRAPHS_DIR])
  fs.mkdirSync(d, { recursive: true });
// Ship-with styles for the bundled FLUX.2 Klein templates, written once (see
// seedStarters). A fresh install then has a working Style dropdown instead of
// an empty one and a Generate Image button that can only fail.
try { require("./styles").seedStarters(STYLES_DIR); } catch {}

// Relative paths in config.json are relative to the app folder.
const resolvePath = (p) => (path.isAbsolute(p) ? p : path.join(BASE, p));
function resolvedConfig() {
  const cfg = structuredClone(config);
  cfg.sd_cli = resolvePath(cfg.sd_cli);
  if (cfg.lora_dir) cfg.lora_dir = resolvePath(cfg.lora_dir);
  for (const k of Object.keys(cfg.models)) cfg.models[k] = resolvePath(cfg.models[k]);
  return cfg;
}

const DEFAULT_CONFIG = {
  python: process.platform === "win32" ? "python" : "python3",
  sd_cli: "sd-cpp/sd-cli.exe",
  lora_dir: "loras",
  models: {
    fl2va: "models/minimax_h3_fl2va_pruned-Q6_K.gguf",
    ref2va: "models/minimax_h3_ref2va_pruned-Q6_K.gguf",
    text_encoder: "models/qwen3vl_32b_minimax_h3-Q4_K_M.gguf",
    video_vae: "models/minimax_h3_video_vae_fp16.safetensors",
    audio_vae: "models/minimax_h3_audio_vae_fp32.safetensors",
  },
  // Editable because sd.cpp's H3 support is new; check `sd-cli --help`.
  flags: {
    ref_image: "--ref-image",
    first_frame: "--init-img",
    last_frame: "--end-img",
    convert_mode: "--mode convert",   // sd-cli conversion invocation
    convert_type: "--type",           // quant type flag (q8_0 = int8)
    offload_cpu: "--offload-to-cpu",  // park weights in RAM, stream to VRAM
  },
  extra_args: "--diffusion-fa",
  gpu: { diffusion: "cuda0", te: "cpu", vae: "cuda0", vae_tiling: false, offload_cpu: false, cuda_stability: false, engine_env: "" },
  llm: { dir: "llm-models", engine_dir: "llama-cpp", port: 8090,
    autostart: false,   // 2.205.0: start llama-server with the app
    last_file: "",      // the Prompt dock dropdown's choice (what autostart loads)
         device: "cuda1", external_url: "", external_model: "local",
         // 2.148.0: the default reply budget every LLM call falls back to
         // (the ldock slider writes it), and how many transformer layers
         // llama-server keeps on the GPU: -1 = all (the old -ngl 99), >=0 =
         // hybrid GPU + CPU/RAM offload (-ngl N).
         max_tokens: 600, gpu_layers: -1,
         // 2.152.0: llama-server's own default context is 4096 tokens — the
         // screenplay's system prompt alone can pass that, and a truncated
         // prompt answers with garbage or a refusal. 0 = the model's own
         // training context (llama-server -c 0).
         ctx: 8192,
         // 2.174.0 ("clear the chat context when using models >12gb"): after
         // a SUCCESSFUL screenplay, a picked model at or above this many GiB
         // gets the chat archived and a fresh session — the story already
         // rode into the plan via recall, and a big model's turns are the
         // ones that bloat the next prompt. 0 disables the rotation.
         big_model_gb: 12 },
  // 2.233.0: the VISION model (lib/captioner.js) — a second llama-server that
  // describes pictures attached to the prompt. model/mmproj are absolute
  // paths (the Prompt dock's Vision dropdown writes them); the mmproj is
  // mandatory (no projector = the model cannot see). keep=false stops the
  // server after idle_min minutes without a caption — VRAM courtesy beside
  // the chat model.
  captioner: { model: "", mmproj: "", dir: "", device: "", port: 8199, keep: false, idle_min: 5 },
  // 2.150.0: overrides for the character chain's per-shot settings (steps,
  // length, continuation_mode, context_length, audio_context_length,
  // video_blend_frames, source_reference, generated_continuity). Empty = the
  // MM3 export's own defaults; only keys the export defines are honoured.
  chain: {},
  // A HuggingFace token is only needed for gated or private repos; public
  // downloads work without one. Used by the download worker mode.
  hf: { repo: "Comfy-Org/MiniMax-H3", token: "" },
  engine: { backend: "comfy",           // "sdcli" | "comfy" — SAME as default.settings (2.100.0)
            comfy: { url: "http://127.0.0.1:8188",
                     autostart: false,   // 2.205.0: start ComfyUI with the app
                     dir: "",           // ComfyUI install folder (launcher)
                     launch: "",        // optional custom launch command
                     lora_4step: false, // use the workflow's turbo LoRA (fast, lower quality)
                     keep_alive: true,  // leave ComfyUI running when the studio exits
                     // 2.175.0: user-pinned widget values {"Class.input": value},
                     // applied after schema sync — the escape hatch when a
                     // node-pack update adds a widget the export predates
                     widget_overrides: {},
                     // 2.177.0: user bypass list ["ClassName" or "#nodeid"] —
                     // physically removed per run with passthrough rewiring;
                     // enable again by removing the entry
                     node_bypass: [],
                     // 2.98.0: POST /free (unload every model + empty the torch
                     // cache) before each generation, so a 15 s clip is not
                     // squeezed into whatever a day of stills and songs left.
                     free_before_gen: true,
                     // 2.99.0: the VRAM-safe single-run ceiling, in frames.
                     // 0 = the model's own ceiling (362). The video worker
                     // LEARNS a lower one when a single run dies of GPU
                     // out-of-memory (it re-plans that render into chunks that
                     // fit and reports the value back over @@CFG), so the next
                     // long clip goes straight to the plan that renders. The
                     // note says when and why; Settings -> ComfyUI can reset it.
                     // 2.99.2: pin the (32B) text encoder in system RAM so it
                     // never competes with the sampler for VRAM. "default"
                     // hands the choice back to ComfyUI's own management.
                     // 2.99.3: OPT-IN. Pinning the 32B encoder in system RAM
                     // costs ~110 s of prompt encoding per run and did NOT fix
                     // Tim's failure (a 3 s clip failed identically), so the
                     // default hands the choice back to ComfyUI. Worth turning
                     // on only when a run really is short of VRAM.
                     clip_device: "default",
                     // 2.99.4 (Tim: "don't do chunks"). OFF = a clip that will
                     // not render is REPORTED, never silently split into
                     // segments with a hand-off seam. The learned VRAM ceiling
                     // is ignored for planning while this is off, so Auto keeps
                     // making one run.
                     chunk_on_oom: false,
                     // 2.100.0: where a ComfyUI that H3 launches writes its
                     // console. "file" = <H3>/comfy.log, tailed into the app
                     // (a file write cannot raise the Windows [Errno 22]
                     // stderr-flush crash a pipe can); "console" = a real
                     // console window of its own, nothing captured.
                     stdio: "file",
                     vram_ceiling: 0,
                     vram_ceiling_note: "",

                     workflows: { t2va: "comfy_workflows/t2va.json",
                                  ref2va: "comfy_workflows/ref2va.json",
                                  fl2va: "comfy_workflows/fl2va.json" } },
            // 2.197.0 (by instruction): render on a RunPod SERVERLESS
            // ComfyUI endpoint (worker-comfyui protocol). When enabled the
            // worker sends the SAME graph it builds locally, refs as base64
            // (~10 MB /run request cap), polls /status, and takes the
            // outputs from the response. endpoint = the endpoint ID;
            // api_key = a RunPod API key; base_url stays default outside
            // tests. A pod running plain ComfyUI needs NONE of this — just
            // point engine.comfy.url at the pod's 8188 proxy (docs/RUNPOD.md).
            runpod: { enabled: false, endpoint: "", api_key: "",
                      poll_seconds: 5, base_url: "https://api.runpod.ai" } },
  // steps 0 = AUTO (2.100.0): the video worker takes the step count from the
  // workflow itself — the turbo LoRA's count (parsed from its file name,
  // "..._8step_...") when Settings -> ComfyUI enables the LoRA, else the
  // template's base literal (20 in the official exports). Tim's own exports
  // run the base model at 20; the old fixed 8 was the LoRA count patched into
  // a base-model run, which underbakes it. A non-zero value is an override.
  defaults: { width: 960, height: 544, frames: 121, steps: 0, seed: -1, format: "mp4" },   // mp4 (2.102.1): webm does not share over Messenger
  // OpenAudio (fish-speech) text-to-speech + voice cloning. dialect picks the
  // request shape: openaudio (tools.api_server) | openai (compatible wrappers)
  // | fishaudio (hosted). See lib/tts.js — they are genuinely different APIs.
  // Local only — each tool gets its own venv, see lib/venv.js for why they are
  // not shared. No URLs, no API keys: nothing leaves this machine.
  // 2.103.0: dock sizes + open/closed/max, restored on open — lib/uiLayout.js
  // confirm_delete (2.223.15): ON = ask + really delete; OFF (the shipped
  // default) = no dialog, gallery deletes move to projects/<n>/recycle_bin
  ui: { confirm_delete: false, expert: false, builtin_dialogs: true, docks: require("./uiLayout").defaults() },   // 2.304.0: + expert; 2.326.0: + builtin_dialogs
  // 2.264.0: OmniVoice is THE speech engine (openaudio removed; a legacy
  // config's engine/venv/checkpoint keys are read over harmlessly).
  tts: { engine: "omnivoice", device: "cuda", timeout_ms: 900000,
         omnivoice: { venv: "", model: "k2-fsa/OmniVoice", num_step: 32 } },
  // Speech-to-text / lyric extraction. Any Whisper server exposing the
  // OpenAI-compatible /v1/audio/transcriptions endpoint. See lib/asr.js.
  // 2.269.0: demucs stem separation (the Stems dock)
  stems: { venv: "", model: "htdemucs", device: "auto", timeout_ms: 1200000 },
  // 2.352.0: the native engine behind Viggle (native) (lib/nativeEngine.js): a resident
  // server in venvs/native keeping Viggle int8 in RAM; the sources / base / python /
  // lora_dirs are filled by routes/native.js (and refreshed before each job)
  native: { venv: "", dir: "", port: 8199, prefer: "both", pack: "int8", pin: true,
            ram_budget_gb: 0, idle_unload_min: 20, idle_exit_min: 120, free_comfy: true, device: "auto",
            picks: {}, checks: {}, sources: {}, base: "", lora_dirs: [], python: "" },
  asr: { venv: "", model: "base", model_dir: "", device: "auto",
         compute_type: "", language: "", vad: false, timeout_ms: 1800000 },
  // last opened project — restored on boot so the gallery/timeline keep
  // pointing at the folder your videos were rendered into.
  current_project: "default",
  // 2.583.0: "" = <app>/projects; else a folder (the team's projects folder on the NAS) - read at start
  projects_dir: "",
};

let settingsBase = null;          // the default layer the custom diff is against
function loadConfig() {
  const r = settingsStore.load({ defaults: DEFAULT_CONFIG, defaultsPath: DEFAULTS_PATH,
                                 customPath: CUSTOM_PATH, legacyPath: LEGACY_CONFIG_PATH });
  settingsBase = r.base;
  // Repair a nonsense VRAM ceiling written by 2.99.0-2.99.3 before anything
  // reads it: below the 107f floor it is not a memory limit, it is a bug.
  try {
    const cc = ((r.config.engine || {}).comfy) || {};
    if (+cc.vram_ceiling > 0 && +cc.vram_ceiling < 107) {
      console.log(`[settings] clearing a bogus VRAM ceiling of ${cc.vram_ceiling}f (below the 107f floor)`);
      cc.vram_ceiling = 0; cc.vram_ceiling_note = "";
    }
  } catch { /* never fatal */ }
  for (const n of r.notes) console.log(`[settings] ${n}`);
  return r.config;
}
let config = loadConfig();
/** 2.583.0: the projects folder this run uses: config.projects_dir when it is set and reachable, else <app>/projects (pure
 *  apart from the existence check) - an unreachable NAS at start falls back to the local folder and says so */
function projectsRoot(c, exists) {
  const want = String((c && c.projects_dir) || "").trim();
  if (!want) return path.join(BASE, "projects");
  const abs = path.isAbsolute(want) ? want : path.join(BASE, want);
  const ok = (exists || ((d) => { try { return fs.statSync(d).isDirectory(); } catch { return false; } }))(abs);
  if (!ok) { console.log(`[settings] the projects folder ${abs} is not reachable - using ${path.join(BASE, "projects")} for this run`); return path.join(BASE, "projects"); }
  return abs;
}
PROJECTS_DIR = projectsRoot(config);
const saveConfig = () => settingsStore.save({ config, base: settingsBase, customPath: CUSTOM_PATH });
/** Settings -> General -> Reset: back to default.settings; the open project is kept. */
function resetConfig() {
  config = settingsStore.reset({ base: settingsBase, customPath: CUSTOM_PATH,
                                 current: config, keep: ["current_project"] });
  return config;
}
/** Where the layers live (for the UI's General tab and the tests). */
function settingsPaths() {
  return { defaults: DEFAULTS_PATH, custom: CUSTOM_PATH,
           custom_exists: fs.existsSync(CUSTOM_PATH),
           custom_keys: Object.keys(settingsStore.readJson(CUSTOM_PATH) || {}) };
}

// Restore the last opened project. Without this the server always came back
// as "default" after a restart while the UI (and your rendered videos) still
// belonged to a named project — the gallery and timeline then read an empty
// projects/default/output.
try {
  const want = config.current_project || "default";
  if (want !== "default" && fs.existsSync(projDir(want))) {
    ensureProject(want);
    currentProject = path.basename(projDir(want));
  }
} catch {}

// ----- Comfy-Org/MiniMax-H3 manifest (ComfyUI repo layout).
// int8_convrot is the repo's recommended quant for the diffusion models;
// fp8_scaled only if convrot can't be used. Sizes approximate (GB).
const MODEL_MANIFEST = [
  // unsloth pre-quantized GGUFs — the known-good baseline set. If a convrot
  // safetensors is rejected (esp. the TEXT ENCODER), swap to these.
  { repo: "unsloth/MiniMax-H3-GGUF", path: "qwen3vl_32b_minimax_h3-Q4_K_M.gguf", gb: 19, tag: "text encoder · GGUF Q4_K_M ✓safe" },
  { repo: "unsloth/MiniMax-H3-GGUF", path: "minimax_h3_ref2va_pruned-Q6_K.gguf", gb: 16, tag: "ref2va pruned · GGUF Q6_K ✓safe" },
  { repo: "unsloth/MiniMax-H3-GGUF", path: "minimax_h3_fl2va_pruned-Q6_K.gguf", gb: 16, tag: "fl2va pruned · GGUF Q6_K ✓safe" },
  { path: "diffusion_models/minimax_h3_fl2va_pruned_int8_convrot.safetensors", gb: 21,  tag: "fl2va pruned · int8_convrot ★" },
  { path: "diffusion_models/minimax_h3_ref2va_pruned_int8_convrot.safetensors", gb: 21, tag: "ref2va pruned · int8_convrot ★" },
  { path: "diffusion_models/minimax_h3_fl2va_int8_convrot.safetensors", gb: 34,  tag: "fl2va full · int8_convrot" },
  { path: "diffusion_models/minimax_h3_ref2va_int8_convrot.safetensors", gb: 34, tag: "ref2va full · int8_convrot" },
  { path: "diffusion_models/minimax_h3_fl2va_pruned_fp8_scaled.safetensors", gb: 21, tag: "fl2va pruned · fp8_scaled" },
  { path: "diffusion_models/minimax_h3_ref2va_pruned_fp8_scaled.safetensors", gb: 21, tag: "ref2va pruned · fp8_scaled" },
  { path: "diffusion_models/minimax_h3_fl2va_pruned_bf16.safetensors", gb: 40, tag: "fl2va pruned · bf16 (convert source)" },
  { path: "diffusion_models/minimax_h3_ref2va_pruned_bf16.safetensors", gb: 40, tag: "ref2va pruned · bf16 (convert source)" },
  { path: "text_encoders/qwen3vl_32b_minimax_h3_int8_convrot.safetensors", gb: 27, tag: "text encoder · int8_convrot (27 GB — too big beside a 21 GB model on 32 GB)" },
  { path: "text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors", gb: 17, tag: "text encoder · nvfp4_awq ★ (the one the shipped workflows load, 2.100.0)" },
  { path: "vae/minimax_h3_video_vae_fp16.safetensors", gb: 1.4, tag: "video VAE" },
  { path: "vae/minimax_h3_audio_vae_fp32.safetensors", gb: 0.4, tag: "audio VAE" },
];

// ------------------------------------------------------------------- jobs
const jobs = new Map();
const order = [];
const queue = [];
let running = null;

// STABLE worker log protocol (UI progress + preview reload depend on these):
//   "[worker] ===== chunk i/N"        -> chunk progress
//   "[worker] joined preview updated" -> job-dir preview.<fmt> was rewritten
const RX_CHUNK = /\[worker\] ===== chunk (\d+)\/(\d+)/;
const RX_JOINED = /\[worker\] joined preview updated/;

function jobDict(job, logFrom = null) {
  const d = {
    id: job.id, status: job.status, project: job.project || null, created: job.created, started: job.started,
    finished: job.finished, output: job.output, outputs: job.outputs || null,
    command: job.command,
    params: job.params, chunk: job.chunk, preview_version: job.preview_version,
    // 2.384.0: what it renders with (seed, cfg, steps, models, loras) and how far it has got (lib/jobMeta)
    meta: require("./jobMeta").metaOf(job), progress: require("./jobMeta").progress(job),
    energy: job.energy || null,                                       // 2.517.0: ⚡ what it used (lib/power.js)
    remote: job.remote || null,                                       // 2.583.0: rendering on a team member's PC (lib/farm.js)
    farm: job.farm ? { member: job.farm.member } : null,              // 2.583.0: rendering HERE for a team member
  };
  if (logFrom !== null) { d.log = job.log.slice(logFrom); d.log_next = job.log.length; }
  return d;
}

function log(job, line) {
  job.log.push(line.replace(/\r?\n$/, ""));
  if (job.log.length > 4000) job.log.splice(0, job.log.length - 4000);
  const m = RX_CHUNK.exec(line);
  if (m) job.chunk = { i: +m[1], n: +m[2] };
  if (RX_JOINED.test(line)) job.preview_version += 1;
  try { require("./jobMeta").onLine(job, line); } catch { /* 2.384.0: metadata never breaks a job's log */ }
}

// job modes that succeed purely on exit code (no video output check)
const TOOL_MODES = ["install_llm", "install_sdcli", "download", "convert",
                    "install_whisper", "install_omnivoice",
                    "install_demucs",    // 2.269.0: stems joins the tool modes
                    "install_viggle",    // 2.351.0: Viggle (native) venv + weights
                    "install_native",    // 2.352.0: the native engine's venv + weights
                    "install_aitoolkit", "lora_train",   // 2.520.0: the LoRA trainer (lora_worker.py)
                    "install_unsloth", "ft_llm", "ft_vision", "lora_merge"];   // 2.521.0: fine-tunes + ⧉ bake (finetune_worker.py)

/**
 * Which worker script runs a mode.
 *
 * Video and images are DELIBERATELY separate processes: worker.py owns the
 * frame grids, the single-run ceiling, chunked hand-off, seam-drop joining and
 * the timeline compile, none of which mean anything for a still image, and all
 * of which would have to grow an "unless it is an image" branch to share one
 * file. Keeping them apart means an image change cannot perturb a render.
 *
 * ONE map, so a new mode cannot be added without deciding which worker runs it
 * — the alternative (an `if` at the spawn site) is exactly how a mode ends up
 * silently handed to the wrong script.
 */
const WORKER_FOR = { image: "image_worker.py", music: "music_worker.py",
                     // 2.120.0: a user-wired ComfyUI graph. Its own worker by the
                     // same rule as the other two — running an arbitrary graph has
                     // nothing to do with frame grids or style validation, and must
                     // not be able to perturb either.
                     graph: "graph_worker.py",
                     // 2.324.0: a CHARACTER SWAP (lib/swap.js) - cuts the
                     // reference window, renders MiniMax_H3_Swap.json, puts
                     // the original audio back
                     swap: "swap_worker.py",
                     // 2.338.0: LTX 2.5 - one mode of Tim's all-in-one canvas,
                     // converted against the live ComfyUI (lib/ltx.js)
                     ltx: "ltx_worker.py", ripple: "ripple_worker.py",   // 2.342.0: Tim's LTX Ripple workflow
                     viggle: "viggle_worker.py",                       // 2.344.0: Viggle-Animate on MiniMax H3 (the swap dialog)
                     viggle_native: "viggle_native_worker.py",         // 2.351.0: the same, our own engine (no ComfyUI)
                     bridge: "bridge_worker.py",                       // 2.358.0: a bridge scene as a standard transition (ffmpeg)
                     wan: "wan_worker.py",                             // 2.368.0: Wan 2.1 / 2.2 (core Wan nodes, lib/wan.js)
                     vrworld: "vr_world_worker.py",                    // 2.368.0: a performer inside a 360 / 180 stereo picture (lib/vrWorld.js)
                     karaoke: "karaoke_worker.py",                     // 2.373.0: a scene's lyrics + bouncing ball, transparent (lib/karaoke.js)
                     seedvr2: "seedvr2_worker.py",                     // 2.400.0: SeedVR2 video upscaling (core ComfyUI nodes, lib/seedvr2.js)
                     dlss5: "dlss5_worker.py",                         // 2.504.0: DLSS 5 enhance / upscale / frame generation (RH DLSS 5, lib/dlss5.js)
                     mesh3d: "mesh3d_worker.py",                       // 2.404.0: a picture -> a .glb (Hunyuan3D / TRELLIS.2, lib/mesh3d.js)
                     lora_train: "lora_worker.py", install_aitoolkit: "lora_worker.py",
                     install_unsloth: "finetune_worker.py", ft_llm: "finetune_worker.py", ft_vision: "finetune_worker.py", lora_merge: "finetune_worker.py" };   // 2.520.0: the LoRA trainer (ai-toolkit, lib/loraTrain.js)
const workerScript = (mode) => path.join(BASE, WORKER_FOR[mode] || "worker.py");

/* 2.113.0: every transition is written to the job's PROJECT's jobs.info
   (lib/jobsInfo.js) so the queue reloads with the project. The project is
   remembered on the job at creation — a job keeps belonging to the project
   it was started from even if the user switches projects while it runs. */
const jobsInfo = require("./jobsInfo");
function recordJob(job) {
  if (job && job.discarded) return;            // 2.378.0: a job of a project that was reset never writes into the new one
  try { jobsInfo.record(projDir(job.project || currentProject), job); } catch { /* never block a job */ }
}

function makeJob(params, preId = null, preDir = null, opts = null) {
  // 2.583.0: opts.project - a render-farm job runs for ANOTHER member's project (the shared projects folder);
  // opts.farm - {member, machine}: it renders here for them (lib/farmNode.js); opts.local - never sent to the farm
  const o = opts || {};
  const proj = o.project ? path.basename(projDir(o.project)) : currentProject;
  // 2.384.0: a board scene's seed rule (lib/sceneSeed: the card's own seed, the video docker's ⚙ "same seed for every
  // scene", an upscale reusing its take's seed) - set before the job can start
  let seedNote = null;
  try { seedNote = require("./sceneSeed").beforeJob(params, proj); } catch { seedNote = null; }
  const id = preId || crypto.randomBytes(6).toString("hex");
  const dir = preDir || path.join(JOBS_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  const job = {
    id, dir, status: "queued", project: proj,
    created: Date.now() / 1000, started: null, finished: null,
    output: null, command: null, child: null, log: [],
    chunk: { i: 0, n: 1 }, preview_version: 0,
    params,
  };
  if (o.farm) job.farm = o.farm;
  if (seedNote) job.log.push("[bitgen-studio] " + seedNote);
  jobs.set(id, job);
  order.push(id);
  // 2.583.0: Team ▸ Render on another member's PC - the job is sent there (lib/farm.js) and mirrored here, so the queue,
  // the scene cards and the finish (assets, the song record) work as for a local job
  let target = null;
  if (!o.local && !o.farm) { try { target = require("./farm").route(params); } catch { target = null; } }
  if (target) {
    job.remote = { machine: target.id, name: target.name, member: target.member };
    log(job, `[team] rendering on ${target.name} (${target.member})`);
    recordJob(job);
    require("./farm").dispatch(job, target);
    return job;
  }
  queue.push(job);
  recordJob(job);
  pump();
  return job;
}

let pumpTimer = null;
function pump() {
  if (running || queue.length === 0) return;
  // 2.518.0: the queue preset (lib/queuePresets.js - the menu bar's ⏱): a rest between jobs, a hot GPU = not yet
  if (queue[0] && queue[0].status !== "cancelled" && !["export", "karaoke", "install_aitoolkit", "install_unsloth"].includes((queue[0].params || {}).mode)) {   // ffmpeg-only jobs / installs never wait
    let g = null;
    try { g = require("./queuePresets").check(); } catch { g = null; }
    if (g && g.wait > 0) { if (!pumpTimer) pumpTimer = setTimeout(() => { pumpTimer = null; pump(); }, g.wait); return; }
  }
  const job = queue.shift();
  if (job.status === "cancelled") return pump();

  running = job;
  job.status = "running";
  job.started = Date.now() / 1000;
  try { job._energy0 = require("./power").mark(); } catch { /* 2.517.0: the energy meters are optional */ }
  try { const n = require("./queuePresets").takeNote(); if (n) log(job, n); } catch { /* 2.518.0 */ }
  recordJob(job);

  // 2.352.0: the native engine's sources follow the disk (an install that just
  // finished, a ComfyUI file added) without Settings being opened first
  if ((job.params || {}).mode === "viggle_native") {
    try {
      require("./nativeEngine").refreshConfig(config, { BASE, MODELS_DIR, resolvePath, save: saveConfig,
        comfyExtra: () => { try { return require("./comfyPaths").read(); } catch { return {}; } } });
    } catch { /* never block a job on the refresh */ }
  }
  const jobFile = path.join(job.dir, "job.json");
  fs.writeFileSync(jobFile, JSON.stringify({
    params: job.params, config: resolvedConfig(), app_dir: BASE,
    models_dir: MODELS_DIR,
    // A timeline compile is THE project's movie, so it lands in the project
    // root as <project>.mp4 rather than in final/ alongside the numbered
    // renders. routes/index.js serves the project root as the "project" output
    // location so the gallery and player can still reach it.
    output_dir: job.params.mode === "export"
      ? projDir(job.project || currentProject) : path.join(projDir(job.project || currentProject), "output"),   // 2.583.0: the JOB's project
    // 2.301.0: a scene render's LOSSLESS master lands in projects/<p>/raw
    // (scripts/rawmaster.py writes it, lib/rawMaster.js finds it)
    ...(job.params.raw_master ? { raw_dir: path.join(projDir(job.project || currentProject), "raw") } : {}),
    // 2.338.0: the node that runs this server (Electron as node, or node) -
    // ltx_worker.py converts the LTX canvas with the app's own converter
    node_exe: process.execPath,
    // 2.380.0: how an H3 render meets its 32-px steps (the video docker's ⚙ "H3 size": down = 704, up = 736 + crop)
    h3_fit: job.params.h3_fit || (() => {
      try { return require("./renderSettings").read(projDir(job.project || currentProject)).h3_fit; } catch { return "down"; }
    })(),
  }, null, 2));

  // 2.235.0 (Tim verbatim: "keep them both loaded until an image or video
  // model is going to be loaded"): a warm vision model hands its VRAM to
  // the generation job right here, whatever card it sits on — every worker
  // mode loads models except the export compile (ffmpeg only), so export
  // alone skips the free. Lazy require: captioner is a leaf lib, but core
  // must not depend on it at load.
  if (!["export", "karaoke"].includes((job.params || {}).mode)) {   // 2.373.0: karaoke is ffmpeg only too
    try { require("./captioner").freeForJob(`a ${(job.params || {}).mode || "video"} job is starting`, { getConfig }); }
    catch { /* never block a job on the courtesy */ }
  }

  // 2.308.0 (Tim: "the queued scene doesn't stop running, and next scene is
  // queued even when the comfyui job is completed"): the worker gets NO
  // stdin (the null device) - every ffmpeg / ffprobe it starts inherits
  // that instead of an open pipe to this server that never reaches EOF.
  const child = spawn(config.python, ["-u", workerScript(job.params.mode), jobFile],
                      { cwd: job.dir, stdio: ["ignore", "pipe", "pipe"],
                        env: { ...process.env, BITGEN_NODE: process.execPath } });   // 2.479.0: scripts/jxl_png.py reads .jxl with it
  job.child = child;
  // ...and a job ends when the WORKER exits. "close" waits for every
  // holder of the worker's output pipes; a process the worker left behind
  // (an ffmpeg that outlived it, a tool that forked) kept the job - and so
  // the scene and the render queue behind it - "running" for good. After
  // the exit, give the pipes a moment to drain, then close them ourselves.
  child.on("exit", () => {
    setTimeout(() => {
      if (job.finished) return;
      log(job, "[bitgen-studio] the worker exited but a process it started still held its "
        + "output open - finishing the job anyway");
      try { child.stdout.destroy(); } catch {}
      try { child.stderr.destroy(); } catch {}
    }, 5000).unref();
  });

  let buf = "";
  const onData = (data) => {
    buf += data.toString();
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      if (line.startsWith("@@CMD ")) job.command = JSON.parse(line.slice(6));
      // @@CFG <json>: the worker learned something worth keeping (2.99.0: the
      // VRAM-safe single-run ceiling after an out-of-memory re-plan). Only
      // these keys are accepted — a worker must never be able to rewrite
      // arbitrary settings from a log line.
      else if (line.startsWith("@@CFG ")) {
        try {
          const want = (((JSON.parse(line.slice(6)) || {}).engine || {}).comfy) || {};
          const c = config.engine.comfy;
          // 2.99.4: never store a ceiling below the floor. A 5f "ceiling"
          // (what 2.99.1's ladder learned from a NON-memory failure) turns
          // every later render into dozens of hand-offs.
          const v = Math.max(0, Math.round(+want.vram_ceiling));
          if (Number.isFinite(+want.vram_ceiling) && (v === 0 || v >= 107)) c.vram_ceiling = v;
          if (typeof want.vram_ceiling_note === "string") c.vram_ceiling_note = want.vram_ceiling_note.slice(0, 300);
          saveConfig();
        } catch { /* a malformed line is ignored, never fatal */ }
      }
      // @@OUTS carries EVERY file a job produced (an image batch); @@OUT is
      // still the one output the completion check tests for. Order matters:
      // "@@OUTS " also starts with "@@OUT", so it must be tested first or a
      // batch line would be parsed as a filename called `S [...]`.
      else if (line.startsWith("@@OUTS ")) {
        try {
          const arr = JSON.parse(line.slice(7));
          if (Array.isArray(arr)) job.outputs = arr.map((s) => String(s));
        } catch { /* a malformed batch line must not kill the job */ }
      } else if (line.startsWith("@@OUT ")) job.output = line.slice(6).trim();
      else log(job, line);
    }
  };
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);
  child.on("error", (err) => log(job, `[bitgen-studio] failed to start python: ${err.message}`));
  child.on("close", (code) => {
    if (buf) log(job, buf);
    job.finished = Date.now() / 1000;
    job.child = null;
    if (job.status === "cancelled") {
      log(job, "[bitgen-studio] cancelled.");
    } else if (code === 0 && TOOL_MODES.includes(job.params.mode)) {
      job.status = "done";
      log(job, "[bitgen-studio] finished.");
    } else if (code === 0 && job.output && outputExists(job.output, job.project)) {
      finishDone(job);
    } else {
      job.status = "failed";
      job.output = null;
      log(job, `[bitgen-studio] worker exited with code ${code}.`);
    }
    // 2.517.0 (Tim: "when a job is completed add total power consumed"): the energy from its start to now (lib/power.js)
    try {
      const pw = require("./power"), e = pw.since(job._energy0);
      delete job._energy0;
      if (e) { job.energy = e; log(job, `[power] ${pw.words(e, pw.priceOf(config))}`); }   // 2.518.0: + its cost
    } catch { /* never block a job */ }
    recordJob(job);
    try { require("./usageLog").recordJob(job); } catch { /* 2.520.0: the usage log (📊 Usage) never blocks a job */ }
    running = null;
    try { require("./queuePresets").finished(); } catch { /* 2.518.0: the rest between jobs starts now */ }
    pump();
  });
}

/** A job whose output exists: done, its files into the project's assets, a song's record + lyrics. 2.583.0: one
 *  function for a local job and a job rendered on another member's PC (lib/farm.js) - the JOB's project, not the open one.
 *  A job rendered HERE for another member (job.farm) stops at "done": the asking PC files it into its project. */
function finishDone(job) {
  const jp = (k) => path.join(projDir(job.project || currentProject), k);
  if (job.farm) { job.status = "done"; log(job, `[bitgen-studio] done for ${job.farm.member} in ${((job.finished - job.started) / 60).toFixed(1)} min -> ${job.output}`); return; }
      job.status = "done";
      log(job, `[bitgen-studio] done in ${((job.finished - job.started) / 60).toFixed(1)} min -> ${job.output}`);
      // A finished render belongs in the asset dock, not just the gallery.
      // lib/autoAssets.js hard-links it into the project's video assets so it
      // can be dropped on the timeline or used as a continuation source
      // without being hunted down and re-imported by hand. It NEVER throws and
      // never changes job.status: a render that finished has finished, and a
      // missing dock entry must not turn that into a failure.
      // A batch (image generation) produces several files and every one of
      // them belongs in the dock — job.output is only the last. De-duplicated
      // because @@OUT repeats the final @@OUTS entry.
      const produced = [...new Set([...(job.outputs || []), job.output])];
      let soundName = "";
      // 2.329.0: a character-swap DIALOG segment files itself into the
      // project's vidTemp (routes/swapdlg.js) - it is not a Video asset
      if (job.params && job.params.no_assets) produced.length = 0;
      for (const name of produced) {
        const reg = autoAssets.register(name, {
          mode: job.params.mode,
          outputDir: jp("output"),
          videoDir: jp("video"),
          imageDir: jp("images"),
          // a generated SONG (2.90.0) lands in the Sound column, beside the
          // speech the TTS path already writes there
          soundDir: jp("sound"),
        });
        if (reg.kind === "audio" && reg.name) soundName = reg.name;      // 2.373.0: the lyrics file follows it
        const where = reg.kind === "image" ? "Image"
                    : reg.kind === "audio" ? "Sound" : "Video";
        if (reg.added)
          log(job, `[bitgen-studio] added to ${where} assets as "${reg.name}"`
                   + (reg.how === "copy" ? " (copied — could not hard-link)" : ""));
        else if (reg.reason === "error")
          log(job, `[bitgen-studio] could not add it to ${where} assets: ${reg.error}`);
      }
      // 2.250.0 (Tim: "save the filename.ext, song title, lyrics, date
      // created, created by in a file <songname>.music"): a finished MUSIC
      // job writes its render record the moment it exists — the Load
      // dialog's ▶ then plays a RECORDED filename, never a guess. Never
      // throws, never changes job.status (the autoAssets rule).
      if (job.params && job.params.mode === "music") {
        try {
          const audio = produced.find((n) => /\.(flac|mp3|wav)$/i.test(n)) || "";
          const rec = require("./songs").recordRender(projDir(job.project || currentProject), {
            filename: audio,
            title: job.params.title || "",
            lyrics: job.params.prompt || "",
            created_by: job.params.style_name || "bitGen Studio",
          });
          if (rec) log(job, `[bitgen-studio] render recorded -> songs/${rec.file}`);
          // 2.373.0 (Tim: "when bitgen produces a song save the lyrics in a txt file in the project folder"):
          // lyrics/<song>.txt - named after the Sound asset, so the karaoke overlay finds them by the song
          const lyr = require("./karaoke").saveLyrics(projDir(job.project || currentProject), soundName || audio, job.params.prompt || "");
          if (lyr) log(job, `[bitgen-studio] lyrics saved -> lyrics/${lyr}`);
        } catch (e) {
          log(job, `[bitgen-studio] could not write the render record: ${e.message}`);
        }
      }
}

function killTree(job) {
  if (!job.child) return;
  if (process.platform === "win32")
    spawnSync("taskkill", ["/pid", String(job.child.pid), "/T", "/F"]);
  else job.child.kill("SIGTERM");
}

// ---------------------------------------------------------------- probing
const durCache = new Map();
function probeDuration(p) {
  const key = p + ":" + fs.statSync(p).mtimeMs;
  if (durCache.has(key)) return durCache.get(key);
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p], { encoding: "utf8" });
  const d = r.status === 0 ? parseFloat(r.stdout) || null : null;
  durCache.set(key, d);
  return d;
}

/** Does the file carry an AUDIO stream? true/false, or null when ffprobe is
 *  unavailable (2.161.0, Tim: "the sound doesn't work" — a silent take must
 *  SAY it is silent, or a graph problem masquerades as a speaker problem). */
function probeAudio(p) {
  try {
    const key = "a:" + p + ":" + fs.statSync(p).mtimeMs;
    if (durCache.has(key)) return durCache.get(key);
    const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "a",
                                    "-show_entries", "stream=codec_type",
                                    "-of", "csv=p=0", p], { encoding: "utf8" });
    const a = r.status === 0 ? /audio/.test(r.stdout) : null;
    durCache.set(key, a);
    return a;
  } catch { return null; }
}

// ------------------------------------------------------------------ stats
let prevCpu = os.cpus().map((c) => ({ ...c.times }));
let gpuCache = { at: 0, gpus: [] };
function cpuPercent() {
  const now = os.cpus().map((c) => ({ ...c.times }));
  let idle = 0, total = 0;
  now.forEach((c, i) => {
    const p = prevCpu[i] || c;
    for (const k of Object.keys(c)) total += c[k] - (p[k] || 0);
    idle += c.idle - (p.idle || 0);
  });
  prevCpu = now;
  return total > 0 ? Math.round((1 - idle / total) * 100) : 0;
}
function readGpus() {
  if (Date.now() - gpuCache.at < 2000) return Promise.resolve(gpuCache.gpus);
  return new Promise((resolve) => {
    const p = spawn("nvidia-smi", [
      "--query-gpu=name,memory.used,memory.total,utilization.gpu,temperature.gpu",
      "--format=csv,noheader,nounits"]);
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    const done = () => {
      const gpus = out.trim().split("\n").filter(Boolean).map((line) => {
        const [name, used, total, util, temp] = line.split(",").map((x) => x.trim());
        return { name, mem_used: +used, mem_total: +total, util: +util, temp: +temp };
      });
      gpuCache = { at: Date.now(), gpus };
      resolve(gpus);
    };
    p.on("close", done);
    p.on("error", () => { gpuCache = { at: Date.now(), gpus: [] }; resolve([]); });
    setTimeout(() => { try { p.kill(); } catch {} }, 3000);
  });
}
let cpuTempCache = { at: 0, v: null };
function readCpuTemp() {
  if (Date.now() - cpuTempCache.at < 5000) return Promise.resolve(cpuTempCache.v);
  return new Promise((resolve) => {
    const done = (v) => { cpuTempCache = { at: Date.now(), v }; resolve(v); };
    if (process.platform === "linux") {
      try {
        const base = "/sys/class/thermal";
        let best = null;
        for (const z of fs.readdirSync(base).filter((d) => d.startsWith("thermal_zone"))) {
          const t = parseInt(fs.readFileSync(path.join(base, z, "temp"), "utf8"), 10) / 1000;
          const type = fs.readFileSync(path.join(base, z, "type"), "utf8").trim();
          if (!isNaN(t) && t > 1 && (best === null || /pkg|cpu|core/i.test(type))) best = t;
        }
        return done(best);
      } catch { return done(null); }
    }
    if (process.platform === "win32") {
      const p = spawn("powershell", ["-NoProfile", "-Command",
        "(Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty CurrentTemperature)"]);
      let out = "";
      p.stdout.on("data", (d) => (out += d));
      p.on("close", () => {
        const raw = parseInt(out.trim(), 10);
        done(raw > 0 ? Math.round((raw / 10 - 273.15) * 10) / 10 : null);
      });
      p.on("error", () => done(null));
      setTimeout(() => { try { p.kill(); } catch {} done(null); }, 4000);
      return;
    }
    done(null);
  });
}

// ---------------------------------------------- managed llama-server (LLM)
let llama = { proc: null, file: null, ready: false };
function llmPaths() {
  const dir = path.isAbsolute(config.llm.dir) ? config.llm.dir : path.join(BASE, config.llm.dir);
  const eng = path.isAbsolute(config.llm.engine_dir) ? config.llm.engine_dir : path.join(BASE, config.llm.engine_dir);
  const exe = path.join(eng, process.platform === "win32" ? "llama-server.exe" : "llama-server");
  return { dir, eng, exe };
}
/** 2.258.0 (Tim: "clear vram, ram and cache on the gpu and cpu that is
 *  loading a model first switching models, don't add to the vram stack
 *  until it is cleared"): wait until a killed model's GPU memory has
 *  actually been RELEASED before any new allocation. taskkill returns
 *  before the driver finishes draining, so back-to-back stop+spawn briefly
 *  stacks BOTH models — the OOM/sysmem-spill Tim sees. This polls
 *  nvidia-smi's memory.used for the card until the reading stops falling
 *  (two stable reads = settled), capped at 10s; no nvidia-smi = a 1.5s
 *  blind grace. RAM is freed by the process death itself; the .gguf's
 *  page cache is the OS's to reclaim (dropping it needs admin and only
 *  slows the reload). */
async function gpuSettle(dev) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  if (!dev || !String(dev).startsWith("cuda")) { await sleep(500); return; }
  const idx = String(dev).replace("cuda", "") || "0";
  let prev = Infinity, stable = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 10000) {
    let used = null;
    try {
      const out = spawnSync("nvidia-smi",
        ["--query-gpu=memory.used", "--format=csv,noheader,nounits", "-i", idx],
        { encoding: "utf8", timeout: 3000 });
      used = parseInt(String(out.stdout || "").trim(), 10);
    } catch { /* no nvidia-smi on this box */ }
    if (!Number.isFinite(used)) { await sleep(1500); return; }
    if (used >= prev && ++stable >= 2) return;
    if (used < prev) stable = 0;
    prev = used;
    await sleep(500);
  }
}

function stopLlama() {
  if (llama.proc) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(llama.proc.pid), "/T", "/F"]);
    else llama.proc.kill("SIGTERM");
  }
  llama = { proc: null, file: null, ready: false };
}
async function llamaHealthy() {
  try {
    const r = await fetch(`http://127.0.0.1:${config.llm.port}/health`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch { return false; }
}
async function ensureLlama(file) {
  const env = { ...process.env };
  const dev = config.llm.device || "cuda1";
  // 2.148.0, by instruction ("use the gpu + cpu/ram offloading"): -ngl says
  // how many transformer layers sit in VRAM; the rest stream from system RAM.
  // gpu_layers -1 (or absent/junk) keeps the old all-on-GPU behavior.
  const nl = parseInt(config.llm.gpu_layers, 10);
  const layers = Number.isFinite(nl) && nl >= 0 ? nl : 99;
  const nc = parseInt(config.llm.ctx, 10);
  const ctx = Number.isFinite(nc) && nc >= 0 ? nc : 8192;
  // THE LAUNCH SIGNATURE (2.157.0, Tim: "i have set the context to 64k — is
  // the slider working?"): it saved and the launch line used it, but a
  // RUNNING model was reused on a file match alone, so the old -c kept
  // serving until the next model swap. A settings change is a reason to
  // restart — the signature says so.
  const sig = `${dev}|${config.llm.port}|${ctx}|${layers}`;
  if (llama.file === file && llama.sig === sig && llama.proc
      && (await llamaHealthy())) return;
  // 2.258.0: the old model must be GONE — VRAM drained on ITS card (the
  // sig remembers which), RAM released with the process — before the new
  // one allocates a byte. Cold start (nothing running) skips the wait.
  const hadProc = !!llama.proc;
  const oldDev = hadProc && llama.sig ? String(llama.sig).split("|")[0] : dev;
  stopLlama();
  if (hadProc) await gpuSettle(oldDev);
  const { dir, exe } = llmPaths();
  if (!fs.existsSync(exe)) throw new Error(`llama-server not found at ${exe} — run get-llama.ps1 or set the engine folder in Settings → LLM.`);
  const model = path.join(dir, path.basename(file));
  if (!fs.existsSync(model)) throw new Error(`model not found: ${model}`);
  // THE 118-GB 13B (2.193.0, Tim: "why is chronos hermes 13b and synthia
  // 13b using 23gb vram on the 3090 and 118gb system ram"): the Settings
  // ctx — set to 64k+ for the 26B, whose GQA keeps KV cheap — was passed
  // to EVERY model. A Llama-2-era 13B has 40 FULL KV heads (~0.8 MB of KV
  // per token): a 128k -c allocates ~100 GB, fills the card and spills the
  // rest into system RAM via the driver's sysmem fallback, for context the
  // model never trained past 4k on. The .gguf header carries the trained
  // context and attention shape, so the launcher asks the FILE and clamps;
  // llm.ctx_force launches as configured for rope-scaled finetunes.
  const shape = gguf.llmShape(model);
  const clamped = gguf.clampCtx(ctx, shape, !!config.llm.ctx_force);
  if (clamped.note) console.log(`[llm] ${path.basename(model)}: ${clamped.note}`);
  const ctxEff = clamped.ctx;
  const args = ["-m", model, "--port", String(config.llm.port), "--host", "127.0.0.1",
                "-c", String(ctxEff)];
  if (dev === "cpu") args.push("-ngl", "0");
  else { env.CUDA_VISIBLE_DEVICES = dev.replace("cuda", ""); args.push("-ngl", String(layers)); }
  const proc = spawn(exe, args, { env, stdio: "ignore" });
  proc.on("exit", () => { if (llama.proc === proc) llama = { proc: null, file: null, ready: false }; });
  llama = { proc, file, sig, ready: false };
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    if (!llama.proc || llama.proc !== proc) throw new Error("llama-server exited while loading — wrong build or not enough memory?");
    if (await llamaHealthy()) { llama.ready = true; return; }
    await new Promise((r) => setTimeout(r, 1000));
  }
  stopLlama();
  throw new Error("llama-server did not become ready within 3 minutes");
}

// ---------------------------------------------- server-side path browser
// Browsers can't return real OS paths from a native picker, so Settings uses
// an in-app browser backed by this listing (localhost-only app by design).
function fsBrowse(dirRaw, extsCsv) {
  const exts = String(extsCsv || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  let dir = dirRaw ? resolvePath(dirRaw) : BASE;
  try { if (fs.existsSync(dir) && fs.statSync(dir).isFile()) dir = path.dirname(dir); } catch {}
  let guard = 0;
  while (!fs.existsSync(dir) && guard++ < 40) {          // climb to nearest existing ancestor
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  const dirs = [], files = [];
  let error = null;
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (dirs.length + files.length > 2000) break;
      if (e.isDirectory()) dirs.push(e.name);
      else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (exts.length && !exts.includes(ext)) continue;
        let size = null;
        try { size = fs.statSync(path.join(dir, e.name)).size; } catch {}
        files.push({ name: e.name, size });
      }
    }
    const ci = (a, b) => a.toLowerCase().localeCompare(b.toLowerCase());
    dirs.sort(ci);
    files.sort((a, b) => ci(a.name, b.name));
  } catch (e) { error = e.message; }
  const parent = path.dirname(dir);
  let drives = null;
  if (process.platform === "win32") {
    drives = [];
    for (let c = 65; c <= 90; c++) {
      const d = String.fromCharCode(c) + ":\\";
      try { if (fs.existsSync(d)) drives.push(d); } catch {}
    }
  }
  return { dir, parent: parent === dir ? null : parent, drives, dirs, files,
           base: BASE, sep: path.sep, error };
}

module.exports = {
  BASE, WORKSPACE, JOBS_DIR, OUTPUT_DIR, MODELS_DIR, LORAS_DIR, LLM_DIR, STYLES_DIR, GRAPHS_DIR,
  ASSETS_DIR, PROJECTS_DIR, PKINDS, kindOf, outputDirs, outputExists,
  projDir, ensureProject, pDir, prjPath, tempDir, tempName,
  getProject: () => currentProject,
  setProject: (n) => {
    currentProject = path.basename(projDir(n));
    durCache.clear();
    config.current_project = currentProject;   // survives an app restart
    saveConfig();
  },
  getConfig: () => config, setConfig: (c) => { config = c; saveConfig(); },
  resetConfig, settingsPaths, settingsStore,
  resolvedConfig, resolvePath, DEFAULT_CONFIG, MODEL_MANIFEST, MAX_SINGLE_RUN, snap4n1Up,
  jobs, order, queue, isRunning: () => running, jobDict, makeJob, killTree, recordJob, finishDone, log, projectsRoot,
  probeDuration, probeAudio, cpuPercent, readGpus, readCpuTemp,
  llmPaths, ensureLlama, stopLlama, gpuSettle, llamaState: () => llama,
  fsBrowse,
};
