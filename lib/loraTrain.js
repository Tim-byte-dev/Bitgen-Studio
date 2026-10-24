// bitGen Studio — lib/loraTrain.js (2.520.0): THE LoRA TRAINER - datasets, settings, an ai-toolkit config, the runs.
// Tim (verbatim): "build a lora floating docker for creating lora's like ai toolkit by ostris. keep our theme."
//
//   ENGINE        ostris/ai-toolkit (MIT) - cloned into <app>/ai-toolkit, its own venv venvs/aitoolkit with the PyTorch
//                 build for this card (lib/setupGpu.torchIndexes) + its requirements.txt; ⚙ Install runs it as a queue job
//                 (lora_worker.py install). Training = `python run.py <config.yaml>` (lora_worker.py train)
//   A JOB         projects/<p>/lora/<name>/: job.json (the docker's settings), dataset/ (pictures + same-name .txt captions -
//                 ai-toolkit's format), config.yaml (written at ▶ Start; ✎ your own YAML replaces it: custom.yaml),
//                 output/<name>/ (ai-toolkit's training folder: checkpoints, samples/)
//   BASE MODELS   lib/loraTrainPresets.json (Z-Image Turbo / base, FLUX.1 dev / schnell, Qwen-Image, SDXL, SD 1.5, Chroma,
//                 Wan 2.1) - ai-toolkit's model / train / sample keys, the VRAM each needs
//   THE RESULT    the final <name>.safetensors is copied into ComfyUI's loras folder as trained/<name>.safetensors with a
//                 <name>.bitgen.json card (type, the trigger word as its keyword, how it was trained) + a sample as its
//                 preview - it shows in the 🧩 Model manager's LoRAs at once
//   ELSEWHERE     ⤓ Export job: a .zip of config.yaml (relative paths) + dataset/ for ai-toolkit on another machine
//                 (a RunPod pod - Settings -> Remote GPU)
// 2.521.0 (Tim: "can we add a checkpoint finetune option to the lora creator docker to build on existing llm, vision
//   and image models?"): a job has a KIND - lora (as before) / ckpt (a FULL fine-tune of a picture model with ai-toolkit:
//   the presets marked "full" - no network block, every weight, saved in diffusers format and joined into ONE
//   .safetensors in ComfyUI's diffusion_models/trained by lora_worker.py) / llm / vision (lib/fineTune.js - Unsloth).
// Pure (scripts/test-lora520.js): PRESETS, DEFAULTS, cleanName, normalize, buildConfig, toYaml, withTrigger, parseSteps,
// finalName.
"use strict";
const fs = require("fs");
const path = require("path");

const PRESETS = JSON.parse(fs.readFileSync(path.join(__dirname, "loraTrainPresets.json"), "utf8")).presets;
const IMG_EXT = /\.(png|jpe?g|webp)$/i;
const DEFAULTS = {
  preset: "zimage_turbo", model_path: "", trigger: "", steps: 0, lr: 0, rank: 16, alpha: 16, batch: 1,
  resolutions: [512, 768, 1024], optimizer: "adamw8bit", save_every: 250, keep: 4, sample_every: 250,
  sample_prompts: ["[trigger] portrait, soft window light", "[trigger] standing in a city street at night, neon signs"],
  low_vram: false, quantize: true, caption_dropout: 0.05, flip: false, device: "cuda:0", trigger_in_captions: true, notes: "",
};
const OPTIMIZERS = ["adamw8bit", "adamw", "prodigy", "adafactor"];
const KINDS = ["lora", "ckpt", "llm", "vision"];
function FTM() { return require("./fineTune"); }
const isFt = (k) => k === "llm" || k === "vision";
/** the picture presets for a kind: lora = the LoRA ones, ckpt = the full fine-tune ones */
function presetsFor(kind) { return PRESETS.filter((p) => !!p.full === (kind === "ckpt")); }

/** a job / file name that is safe as a folder and a LoRA file */
function cleanName(n) { return String(n || "").trim().replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60); }
const num = (v, lo, hi, d) => { const x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
/** the docker's settings, cleaned (absent = the default / the preset's) */
function normalize(s) {
  const kind = KINDS.includes((s || {}).kind) ? s.kind : "lora";
  if (isFt(kind)) return FTM().normalizeFt(Object.assign({}, s, { kind }), kind);
  const o = Object.assign({}, DEFAULTS, s || {});
  const list = presetsFor(kind);
  const pre = list.find((p) => p.id === o.preset) || list[0];
  const res = (Array.isArray(o.resolutions) ? o.resolutions : String(o.resolutions || "").split(/[ ,]+/)).map(Number).filter((x) => [256, 512, 768, 1024, 1280, 1536].includes(x));
  return {
    name: cleanName(o.name), kind, preset: pre.id, model_path: String(o.model_path || "").trim().slice(0, 400),
    trigger: String(o.trigger || "").trim().replace(/[\r\n]+/g, " ").slice(0, 60),
    steps: Math.round(num(o.steps, 0, 100000, 0)) || pre.train.steps || 2000, lr: num(o.lr, 0, 1, 0) || pre.train.lr || 0.0001,
    rank: Math.round(num(o.rank, 1, 256, 16)), alpha: Math.round(num(o.alpha, 1, 256, 16)), batch: Math.round(num(o.batch, 1, 16, 1)),
    resolutions: res.length ? [...new Set(res)].sort((a, b) => a - b) : [512, 768, 1024],
    // a full fine-tune trains with the preset's optimizer (adafactor - parameter swapping only works with it)
    optimizer: pre.full ? (pre.train.optimizer || "adafactor") : OPTIMIZERS.includes(o.optimizer) ? o.optimizer : "adamw8bit",
    param_swap: !!(pre.full && o.param_swap), swap_factor: num(o.swap_factor, 0.05, 1, 0.9),
    save_every: Math.round(num(o.save_every, 50, 100000, 250)), keep: Math.round(num(o.keep, 1, 100, 4)),
    sample_every: Math.round(num(o.sample_every, 0, 100000, 250)),
    sample_prompts: (Array.isArray(o.sample_prompts) ? o.sample_prompts : String(o.sample_prompts || "").split(/\r?\n/)).map((x) => String(x).trim()).filter(Boolean).slice(0, 8),
    low_vram: !!o.low_vram, quantize: o.quantize !== false, caption_dropout: num(o.caption_dropout, 0, 0.5, 0.05), flip: !!o.flip,
    device: /^(cuda:\d+|cpu|mps)$/.test(String(o.device)) ? String(o.device) : "cuda:0", trigger_in_captions: o.trigger_in_captions !== false,
    notes: String(o.notes || "").slice(0, 2000),
  };
}
/** a caption with the trigger word in front (once) */
function withTrigger(caption, trigger) {
  const c = String(caption || "").trim(), t = String(trigger || "").trim();
  if (!t) return c;
  if (new RegExp("(^|[\\s,])" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([\\s,.]|$)", "i").test(c)) return c;
  return c ? `${t}, ${c}` : t;
}
/** the ai-toolkit job for these settings: paths = {dataset, training_folder} (forward slashes) -> the config object */
function buildConfig(settings, paths) {
  const s = normalize(settings);
  const pre = PRESETS.find((p) => p.id === s.preset) || PRESETS[0];
  const fwd = (p) => String(p || "").replace(/\\/g, "/");
  const model = Object.assign({}, pre.model);
  if (s.model_path) model.name_or_path = fwd(s.model_path);
  if (!s.quantize) { delete model.quantize; delete model.qtype; delete model.quantize_te; delete model.qtype_te; }
  if (s.low_vram) model.low_vram = true;
  const tr = Object.assign({}, pre.train);
  delete tr.steps; delete tr.lr;
  const cacheTe = !!tr.cache_text_embeddings;
  const sp = pre.sample || {};
  const proc = {
    type: "sd_trainer", training_folder: fwd(paths && paths.training_folder || "output"), device: s.device,
  };
  // caching the text embeddings cannot use trigger_word (ai-toolkit) - the trigger is in the captions instead
  if (s.trigger && !cacheTe) proc.trigger_word = s.trigger;
  // 2.521.0: a full fine-tune has NO network block (ai-toolkit trains every weight) and saves in diffusers format
  if (!pre.full) proc.network = { type: "lora", linear: s.rank, linear_alpha: s.alpha };
  proc.save = pre.full ? { dtype: "bf16", save_every: s.save_every, max_step_saves_to_keep: Math.min(s.keep, 3), save_format: "diffusers" }
    : { dtype: "float16", save_every: s.save_every, max_step_saves_to_keep: s.keep };
  const ds = { folder_path: fwd(paths && paths.dataset || "dataset"), caption_ext: "txt", caption_dropout_rate: s.caption_dropout,
    shuffle_tokens: false, cache_latents_to_disk: true, resolution: s.resolutions };
  if (s.flip) ds.flip_x = true;
  if (pre.kind === "video" && sp.num_frames) ds.num_frames = 1;
  proc.datasets = [ds];
  proc.train = Object.assign({ batch_size: s.batch, steps: s.steps, gradient_accumulation_steps: 1, train_unet: true, train_text_encoder: false,
    gradient_checkpointing: true, optimizer: s.optimizer, lr: s.lr, dtype: "bf16" }, tr);
  if (pre.full) { proc.train.optimizer = s.optimizer; if (s.param_swap) Object.assign(proc.train, { do_paramiter_swapping: true, paramiter_swapping_factor: s.swap_factor }); }
  proc.model = model;
  const prompts = (s.sample_prompts.length ? s.sample_prompts : DEFAULTS.sample_prompts)
    .map((p) => (cacheTe || !s.trigger ? p.replace(/\[trigger\]/g, s.trigger || "").replace(/^\s*,?\s*/, "") : p));
  if (s.sample_every > 0) {
    proc.sample = Object.assign({ sampler: sp.sampler || "flowmatch", sample_every: s.sample_every, width: sp.width || 1024, height: sp.height || 1024,
      prompts, neg: "", seed: 42, walk_seed: true, guidance_scale: sp.guidance_scale == null ? 4 : sp.guidance_scale, sample_steps: sp.sample_steps || 20 },
      sp.num_frames ? { num_frames: sp.num_frames, fps: sp.fps || 16 } : {});
  }
  return { job: "extension", config: { name: s.name || "my_lora", process: [proc] }, meta: { name: "[name]", version: "1.0", made_by: "bitGen Studio" } };
}
/** a YAML emitter for the config's shapes (maps, lists of scalars inline, lists of maps as blocks) */
function toYaml(v, ind) {
  const pad = " ".repeat(ind || 0);
  const scalar = (x) => {
    if (x === null || x === undefined) return "null";
    if (typeof x === "boolean") return x ? "true" : "false";
    // PyYAML reads "1e-05" as a string - small numbers are written out in full
    if (typeof x === "number") return Number.isInteger(x) ? String(x) : /e/i.test(String(x)) ? x.toFixed(12).replace(/0+$/, "") : String(x);
    return JSON.stringify(String(x));
  };
  if (Array.isArray(v)) {
    if (v.every((x) => x === null || typeof x !== "object")) return "[" + v.map(scalar).join(", ") + "]";
    return v.map((x) => { const body = toYaml(x, (ind || 0) + 2).replace(/^\s+/, ""); return `\n${pad}- ${body}`; }).join("");
  }
  if (v && typeof v === "object") {
    return Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x], i) => {
      const key = /^[A-Za-z_][A-Za-z0-9_]*$/.test(k) ? k : JSON.stringify(k);
      const lead = i === 0 && ind ? "" : (i === 0 ? "" : "\n") + pad;
      if (x && typeof x === "object" && !(Array.isArray(x) && x.every((y) => y === null || typeof y !== "object")))
        return `${i === 0 ? (ind ? "" : "") : "\n" + pad}${i === 0 && ind ? "" : ""}${key}:` + (Array.isArray(x) ? toYaml(x, ind || 0) : "\n" + " ".repeat((ind || 0) + 2) + toYaml(x, (ind || 0) + 2));
      return `${lead}${key}: ${Array.isArray(x) ? toYaml(x, ind) : scalar(x)}`;
    }).join("").replace(/^\n/, "");
  }
  return scalar(v);
}
/** "my_lora:  12%|█▏ | 240/2000 [05:12<38:00, 1.3s/it, lr: 1.0e-04 loss: 3.2e-01]" -> {step, total, loss} | null */
function parseSteps(line) {
  const m = /(\d+)\/(\d+)\s*\[/.exec(String(line || ""));
  if (!m) return null;
  const l = /loss[:=]\s*([0-9.eE+-]+)/.exec(line);
  return { step: +m[1], total: +m[2], loss: l ? +l[1] : null };
}
/** the finished LoRA in a training folder: <name>.safetensors, else the newest checkpoint */
function finalName(files, name) {
  const f = (files || []).filter((x) => /\.safetensors$/i.test(x));
  if (f.includes(name + ".safetensors")) return name + ".safetensors";
  return f.filter((x) => x.startsWith(name + "_")).sort().pop() || f.sort().pop() || null;
}

/* ---------------- live */
function core() { return require("./core"); }
function root() { return path.join(core().projDir(core().getProject()), "lora"); }
function jobDir(name) { const n = cleanName(name); if (!n) { const e = new Error("a job needs a name (letters, digits, _ -)"); e.status = 400; throw e; } return path.join(root(), n); }
function aitk() {
  const c = core(), V = require("./venv");
  const dir = path.join(c.BASE, "ai-toolkit");
  const v = V.venvReady("aitoolkit");
  const ready = fs.existsSync(path.join(dir, "run.py")) && v.ready && fs.existsSync(path.join(dir, ".bitgen-installed"));
  return { dir, venv: v.dir, python: v.python, ready, cloned: fs.existsSync(path.join(dir, "run.py")) };
}
function readJson(p, d) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } }
function dataset(name) {
  const d = path.join(jobDir(name), "dataset");
  let files = [];
  try { files = fs.readdirSync(d).filter((f) => IMG_EXT.test(f)).sort(); } catch { files = []; }
  return files.map((f) => {
    const t = path.join(d, f.replace(/\.[^.]+$/, ".txt"));
    let caption = ""; try { caption = fs.readFileSync(t, "utf8"); } catch { caption = ""; }
    let size = 0; try { size = fs.statSync(path.join(d, f)).size; } catch { size = 0; }
    return { file: f, caption, size };
  });
}
function runInfo(name, kind) {
  if (isFt(kind)) return FTM().runInfo(jobDir(name));
  const n = cleanName(name), out = path.join(jobDir(n), "output", n);
  let files = [], samples = [];
  try { files = fs.readdirSync(out).filter((f) => /\.safetensors$/i.test(f)).sort(); } catch { files = []; }
  try { samples = fs.readdirSync(path.join(out, "samples")).filter((f) => IMG_EXT.test(f) || /\.(mp4|webm)$/i.test(f)).sort(); } catch { samples = []; }
  return { checkpoints: files, samples: samples.slice(-60), final: finalName(files, n), installed: readJson(path.join(jobDir(n), "installed.json"), null) };
}
function list() {
  let names = [];
  try { names = fs.readdirSync(root()).filter((d) => fs.existsSync(path.join(root(), d, "job.json"))).sort(); } catch { names = []; }
  return names.map((n) => {
    const s = readJson(path.join(root(), n, "job.json"), {});
    const st = normalize(Object.assign({}, s, { name: n }));
    const ft = isFt(st.kind);
    return { name: n, kind: st.kind, settings: st, images: dataset(n).length, examples: st.kind === "llm" ? FTM().readChat(path.join(root(), n)).length : dataset(n).filter((x) => x.caption.trim()).length,
      custom_yaml: fs.existsSync(path.join(root(), n, ft ? "custom.json" : "custom.yaml")), run: runInfo(n, st.kind) };
  });
}
function save(settings) {
  const s = normalize(settings);
  const d = jobDir(s.name);
  fs.mkdirSync(path.join(d, "dataset"), { recursive: true });
  fs.writeFileSync(path.join(d, "job.json"), JSON.stringify(s, null, 2));
  return s;
}
function remove(name) { const d = jobDir(name); if (!fs.existsSync(d)) return false; fs.rmSync(d, { recursive: true, force: true }); return true; }
function safeFile(f) { const b = path.basename(String(f || "")); if (!b || b.startsWith(".") || !(IMG_EXT.test(b) || /\.txt$/i.test(b))) { const e = new Error("not a dataset file"); e.status = 400; throw e; } return b; }
/** a picture into the dataset (buffer + name); an existing name gets _2, _3 ... */
function addImage(name, fileName, buf) {
  const d = path.join(jobDir(name), "dataset");
  fs.mkdirSync(d, { recursive: true });
  let b = safeFile(String(fileName || "image.png").replace(/[^A-Za-z0-9._-]+/g, "_"));
  if (!IMG_EXT.test(b)) { const e = new Error("pictures only (png, jpg, webp)"); e.status = 400; throw e; }
  const stem = b.replace(/\.[^.]+$/, ""), ext = path.extname(b);
  for (let i = 2; fs.existsSync(path.join(d, b)); i++) b = `${stem}_${i}${ext}`;
  fs.writeFileSync(path.join(d, b), buf);
  return b;
}
function setCaption(name, file, caption) {
  const d = path.join(jobDir(name), "dataset"), f = safeFile(file);
  if (!fs.existsSync(path.join(d, f))) { const e = new Error("no such picture"); e.status = 404; throw e; }
  fs.writeFileSync(path.join(d, f.replace(/\.[^.]+$/, ".txt")), String(caption || "").replace(/\r?\n+/g, " ").trim().slice(0, 4000), "utf8");
  return true;
}
function removeImage(name, file) {
  const d = path.join(jobDir(name), "dataset"), f = safeFile(file);
  for (const x of [f, f.replace(/\.[^.]+$/, ".txt")]) try { fs.unlinkSync(path.join(d, x)); } catch { /* gone */ }
  return true;
}
function yamlFor(name, opts) {
  const d = jobDir(name), s = normalize(Object.assign(readJson(path.join(d, "job.json"), {}), { name: cleanName(name) }));
  if (isFt(s.kind)) {      // 2.521.0: an LLM / vision job's config is Unsloth's run as JSON (scripts/ft_unsloth.py)
    if (!(opts && opts.generated) && fs.existsSync(path.join(d, "custom.json"))) return { yaml: fs.readFileSync(path.join(d, "custom.json"), "utf8"), custom: true, format: "json" };
    const rel = opts && opts.relative;
    const cfg = FTM().buildFtConfig(s, rel ? { data: "dataset/chat.jsonl", images: "dataset", output: "output" }
      : { data: FTM().chatFile(d), images: path.join(d, "dataset"), output: path.join(d, "output") });
    return { yaml: JSON.stringify(cfg, null, 2) + "\n", custom: false, format: "json" };
  }
  if (!(opts && opts.generated) && fs.existsSync(path.join(d, "custom.yaml"))) return { yaml: fs.readFileSync(path.join(d, "custom.yaml"), "utf8"), custom: true };
  const rel = opts && opts.relative;
  const cfg = buildConfig(s, rel ? { dataset: "dataset", training_folder: "output" } : { dataset: path.join(d, "dataset"), training_folder: path.join(d, "output") });
  return { yaml: "# made by bitGen Studio's LoRA trainer (ai-toolkit)\n" + toYaml(cfg) + "\n", custom: false };
}
function setYaml(name, yaml) {
  const d0 = jobDir(name), k = normalize(readJson(path.join(d0, "job.json"), {})).kind;
  const p = path.join(d0, isFt(k) ? "custom.json" : "custom.yaml");
  if (isFt(k) && yaml) { try { JSON.parse(String(yaml)); } catch (e) { const er = new Error("not valid JSON: " + e.message); er.status = 400; throw er; } }
  if (yaml == null || yaml === "") { try { fs.unlinkSync(p); } catch { /* none */ } return false; }
  fs.writeFileSync(p, String(yaml).slice(0, 200000));
  return true;
}
/** the ComfyUI loras folder a finished LoRA goes to */
function lorasDir() {
  try {
    const sc = require("./modelCards").comfyScan(), mi = require("./modelInstall");
    const t = mi.pickTarget((((sc.categories || {}).loras) || {}).roots || []);
    return t ? t.dir : "";
  } catch { return ""; }
}
/** ▶ Start: check, put the trigger in the captions (when asked), write config.yaml, queue the run -> the job */
function start(name) {
  const n = cleanName(name), d = jobDir(n);
  const s = normalize(Object.assign(readJson(path.join(d, "job.json"), {}), { name: n }));
  if (isFt(s.kind)) return FTM().start(n, s, d, dataset(n), yamlFor(n).yaml);
  const a = aitk();
  if (!a.ready) { const e = new Error("ai-toolkit is not installed yet - ⚙ Install ai-toolkit first (a queue job, ~10 GB)"); e.status = 409; throw e; }
  const imgs = dataset(n);
  if (!imgs.length) { const e = new Error("the dataset is empty - add pictures first (10-30 is a good start)"); e.status = 400; throw e; }
  if (s.trigger && s.trigger_in_captions) for (const im of imgs) { const c = withTrigger(im.caption, s.trigger); if (c !== im.caption.trim()) setCaption(n, im.file, c); }
  const y = yamlFor(n);
  fs.writeFileSync(path.join(d, "config.yaml"), y.yaml);
  const pre = PRESETS.find((p) => p.id === s.preset) || PRESETS[0];
  const C = core();
  const job = C.makeJob({ mode: "lora_train", prompt: `${pre.full ? "Fine-tune" : "LoRA"} ${n} (${pre.label.replace(/ \(.*$/, "").replace(/ - full fine-tune.*$/, "")}, ${s.steps} steps, ${imgs.length} pictures)`, no_assets: true,
    lora: { name: n, config: path.join(d, "config.yaml"), aitk_dir: a.dir, python: a.python, job_dir: d, output: path.join(d, "output", n),
            loras_dir: lorasDir(), family: pre.family, base: pre.label, trigger: s.trigger, steps: s.steps, images: imgs.length, custom_yaml: y.custom,
            full: !!pre.full, models_dir: pre.full ? modelsDir("diffusion_models") : "" } });
  return { job: C.jobDict(job), custom_yaml: y.custom };
}
/** a ComfyUI models folder (checkpoints / diffusion_models) a full fine-tune goes to */
function modelsDir(cat) {
  try {
    const sc = require("./modelCards").comfyScan(), mi = require("./modelInstall");
    const t = mi.pickTarget((((sc.categories || {})[cat]) || {}).roots || []);
    return t ? t.dir : "";
  } catch { return ""; }
}
/** ⚙ Install ai-toolkit (a queue job); engine "unsloth" = the LLM / vision fine-tuner (lib/fineTune.js) */
function install(engine) {
  if (engine === "unsloth") return FTM().install();
  const C = core(), a = aitk(), G = require("./setupGpu");
  const p = G.detect();
  const job = C.makeJob({ mode: "install_aitoolkit", prompt: "Install ai-toolkit (the LoRA trainer)", no_assets: true,
    lora: { aitk_dir: a.dir, venv: a.venv, python: a.python, torch: (p.torch || [])[0] || "", cuda: !!p.cuda } });
  return { job: C.jobDict(job) };
}
/** ⤓ Export: config.yaml (relative paths) + dataset/ as a zip */
function exportZip(name) {
  const n = cleanName(name), d = jobDir(n);
  const k = normalize(readJson(path.join(d, "job.json"), {})).kind;
  if (isFt(k)) {
    const e = [{ name: `${n}/config.json`, data: yamlFor(n, { relative: true, generated: !fs.existsSync(path.join(d, "custom.json")) }).yaml }];
    if (k === "llm") { try { e.push({ name: `${n}/dataset/chat.jsonl`, data: fs.readFileSync(FTM().chatFile(d)) }); } catch { /* no chats */ } }
    else for (const im of dataset(n)) { e.push({ name: `${n}/dataset/${im.file}`, data: fs.readFileSync(path.join(d, "dataset", im.file)) }); e.push({ name: `${n}/dataset/${im.file.replace(/\.[^.]+$/, ".txt")}`, data: im.caption || "" }); }
    let sc = ""; try { sc = fs.readFileSync(path.join(core().BASE, "scripts", "ft_unsloth.py")); } catch { sc = ""; }
    if (sc) e.push({ name: `${n}/ft_unsloth.py`, data: sc });
    e.push({ name: `${n}/README.txt`, data: `bitGen Studio ${k === "llm" ? "LLM" : "vision"} fine-tune "${n}" for Unsloth (unsloth.ai).\nOn the other machine: pip install unsloth (uv pip install unsloth --torch-backend=auto), cd into this folder and run\n  python ft_unsloth.py config.json\nThe merged model lands in output/merged - convert it with llama.cpp's convert_hf_to_gguf.py (${k === "vision" ? "and --mmproj for the projector" : "then llama-quantize"}).\n` });
    return { name: `${n}-${k}-job.zip`, data: require("./zipWrite").zip(e) };
  }
  const entries = [{ name: `${n}/config.yaml`, data: yamlFor(n, { relative: true, generated: !fs.existsSync(path.join(d, "custom.yaml")) }).yaml }];
  for (const im of dataset(n)) {
    entries.push({ name: `${n}/dataset/${im.file}`, data: fs.readFileSync(path.join(d, "dataset", im.file)) });
    entries.push({ name: `${n}/dataset/${im.file.replace(/\.[^.]+$/, ".txt")}`, data: im.caption || "" });
  }
  entries.push({ name: `${n}/README.txt`, data: `bitGen Studio LoRA job "${n}" for ai-toolkit (github.com/ostris/ai-toolkit).\nOn the other machine: put this folder next to ai-toolkit, cd into it and run\n  python <ai-toolkit>/run.py config.yaml\nThe LoRA lands in output/${n}/${n}.safetensors - copy it into ComfyUI/models/loras.\n` });
  return { name: `${n}-lora-job.zip`, data: require("./zipWrite").zip(entries) };
}
/** ✨ captions from the vision model: the pictures without one (or all) - one at a time */
const CAP = { busy: false, done: 0, total: 0, error: "", name: "" };
async function autoCaption(name, overwrite) {
  if (CAP.busy) { const e = new Error("captioning is already running"); e.status = 409; throw e; }
  const n = cleanName(name), d = path.join(jobDir(n), "dataset");
  const todo = dataset(n).filter((x) => overwrite || !x.caption.trim());
  Object.assign(CAP, { busy: true, done: 0, total: todo.length, error: "", name: n });
  (async () => {
    const C = core(), cap = require("./captioner"), s = normalize(readJson(path.join(jobDir(n), "job.json"), {}));
    for (const im of todo) {
      try {
        const mt = /\.png$/i.test(im.file) ? "image/png" : /\.webp$/i.test(im.file) ? "image/webp" : "image/jpeg";
        const r = await cap.describe(C, [{ path: path.join(d, im.file), mimetype: mt, max_tokens: s.kind === "vision" ? 400 : 160,
          // a vision job's "caption" is the answer the model should learn - its own instruction asks for it
          prompt: s.kind === "vision" ? s.instruction : "Write a training caption for this picture in one plain sentence: the subject, what they wear / hold, the pose, the setting, the light and the style. No preamble." }]);
        const text = String((Array.isArray(r) ? r[0] : r) || "").replace(/\s+/g, " ").trim();
        if (text) setCaption(n, im.file, s.trigger && s.trigger_in_captions ? withTrigger(text, s.trigger) : text);
      } catch (e) { CAP.error = String(e.message || e); }
      CAP.done++;
    }
    CAP.busy = false;
  })();
  return Object.assign({}, CAP);
}
function captionState() { return Object.assign({}, CAP); }

module.exports = { PRESETS, DEFAULTS, OPTIMIZERS, KINDS, presetsFor, modelsDir, cleanName, normalize, withTrigger, buildConfig, toYaml, parseSteps, finalName,
  root, jobDir, aitk, dataset, runInfo, list, save, remove, addImage, setCaption, removeImage, yamlFor, setYaml, lorasDir, start, install,
  exportZip, autoCaption, captionState, IMG_EXT };
