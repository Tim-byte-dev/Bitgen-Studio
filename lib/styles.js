"use strict";
/**
 * styles.js — named image-generation styles (2.66.0).
 *
 * A style is "which model, which VAE, which text encoders, how many steps, and
 * which LoRAs at which weights" saved under a name, so the prompt docker's
 * Style dropdown can render the same look twice without retyping five paths.
 *
 * WHY NOT IN config.json: POST /api/config is an ALLOW-LIST. Every section has
 * to be named there or it saves, does nothing, and reads back as the default —
 * which is exactly what "tts" did before someone noticed. A user-owned list
 * that grows every time they click New does not belong behind an allow-list, so
 * styles get their own files (styles/<name>.json) and their own endpoints.
 *
 * ONE FILE PER STYLE, NAMED AFTER THE STYLE, so the store is browsable, hand
 * editable and copyable between installs — see the storage section below for
 * the rename/collision rules that come with keying files by name.
 *
 * WHY APP-GLOBAL AND NOT PER-PROJECT (unlike refgroups): refgroups reference
 * media that lives inside one project's folders, so they are project-scoped by
 * necessity. A style references models on disk, which are the same models for
 * every project — scoping it per project would mean re-entering five paths for
 * each new project, which is precisely the tedium this feature exists to end.
 *
 * NORMALIZATION HAPPENS HERE, ONCE. The route calls normalize() and stores what
 * it returns; it does not copy fields itself. One list of fields, in one file,
 * so adding one cannot be half-done.
 */
const fs = require("fs");
const path = require("path");

const CATALOGUE = path.join(__dirname, "imageArch.json");
let _cat = null;
/** The architecture catalogue — the same file scripts/image_gen.py reads. */
/* 2.303.0: ComfyUI UNETLoader weight_dtype values a video style may pin per
   phase. "" = leave the workflow's own. fp8_e4m3fn loads a bf16/fp16 model
   at 8 bits (about half the VRAM); _fast adds fp8 matmuls (RTX 40/50). */
const WEIGHT_DTYPES = ["", "default", "fp8_e4m3fn", "fp8_e4m3fn_fast", "fp8_e5m2"];

function catalogue() {
  if (_cat === null) _cat = JSON.parse(fs.readFileSync(CATALOGUE, "utf8"));
  return _cat;
}
const archs = () => catalogue().archs;
const archById = (id) => archs().find((a) => a.id === id) || null;
const archIds = () => archs().map((a) => a.id);

/**
 * TWO KINDS OF STYLE, ONE STORE (2.90.0).
 *
 * A music style is "which music model, which workflow, steps/cfg, and the long
 * caption that describes the sound" saved under a name — the same shape of
 * thing as an image style, stored the same way (one file, styles/<n>.json, a
 * permanent id, a unique name). `kind` says which: "image" (the default, so
 * every style file written before 2.90.0 keeps working untouched) or "music".
 *
 * The catalogue is per kind — lib/musicArch.json is the music counterpart of
 * lib/imageArch.json — but the storage, the id rules, the rename/collision
 * rules and the per-file layout are shared in THIS file on purpose. A second
 * musicStyles.js would be a second copy of all of that, and two copies of the
 * same rule is how worker.py and comfy_client.py drifted apart.
 */
const KINDS = ["image", "music", "video"];   // video: 2.110.0
const VIDEO_ROLES = ["", "swap"];             // 2.328.0: "swap" = a character-swap style
const MUSIC_CATALOGUE = path.join(__dirname, "musicArch.json");
let _mcat = null;
function musicCatalogue() {
  if (_mcat === null) _mcat = JSON.parse(fs.readFileSync(MUSIC_CATALOGUE, "utf8"));
  return _mcat;
}
const musicArchs = () => musicCatalogue().archs;
const musicArchById = (id) => musicArchs().find((a) => a.id === id) || null;
const musicArchIds = () => musicArchs().map((a) => a.id);

/** The catalogue / architecture lookups for a kind. */
// VIDEO (2.110.0): lib/videoArch.json — phases (checkpoint+steps+cfg per
// sampler), one te, one vae; workflows per generation mode.
const VIDEO_CATALOGUE = path.join(__dirname, "videoArch.json");
let _vcat = null;
function videoCatalogue() {
  if (!_vcat) _vcat = JSON.parse(fs.readFileSync(VIDEO_CATALOGUE, "utf8"));
  return _vcat;
}
const videoArchs = () => videoCatalogue().archs;
const videoArchById = (id) => videoArchs().find((a) => a.id === id) || null;
const videoArchIds = () => videoArchs().map((a) => a.id);

const VIDEO_RES = ["480", "540", "720", "1080"];              // short edge, like Basic Settings
const VIDEO_ASPECTS = ["16:9", "9:16", "4:3", "3:4", "1:1", "21:9", "2:1"];  // 2:1 = equirect 360 (2.119.0)
// VIDEO ACCELERATORS (2.116.0): what worker.apply_video_accel may inject.
// "memeff" = KJNodes' MiniMaxH3MemoryEfficientSageAttentionPatch (H3-only,
// lower peak VRAM); the long names are sageattention's own backends, passed
// straight through KJNodes' PathchSageAttentionKJ node. Spectrum "on" runs the
// node's own audio-safe defaults; "aggressive" is its README preset
// (blend_weight 0.75, flex_window 3.0) - faster, more trajectory drift.
const VIDEO_SAGE_MODES = ["off", "auto", "memeff",
  "sageattn_qk_int8_pv_fp16_cuda", "sageattn_qk_int8_pv_fp16_triton",
  "sageattn_qk_int8_pv_fp8_cuda", "sageattn_qk_int8_pv_fp8_cuda++",
  "sageattn3", "sageattn3_per_block_mean"];
const VIDEO_SPECTRUM_MODES = ["off", "on", "aggressive"];
// 2.536.0: Veda sparse attention (worker.VEDA_PRESETS): on = the authors' 90 % / 90 %, quality = denser (75 % / 50 %,
// full attention on step 0). Stored only when on, with veda_predictor (blank = the worker picks one ComfyUI lists).
const VIDEO_VEDA_MODES = ["off", "on", "quality"];
function normVideoAccel(v) {
  const o = (v && typeof v === "object") ? v : {};
  const s = String(o.sage ?? "").trim(), p = String(o.spectrum ?? "").trim();
  const out = { sage: VIDEO_SAGE_MODES.includes(s) ? s : "off",
                spectrum: VIDEO_SPECTRUM_MODES.includes(p) ? p : "off" };
  // 2.503.0 (Tim's "secret sauce" workflow, lib/h3Long.js): LONG VIDEO - low-VRAM attention + chunked feed-forward,
  // one H3 run up to 30 s; kitchen_attn adds the "comfy kitchen attention" backend in front. Stored only when on, so
  // every style saved before keeps exactly its shape.
  const vd = String(o.veda ?? "").trim();
  if (VIDEO_VEDA_MODES.includes(vd) && vd !== "off") {
    out.veda = vd;
    const pr = String(o.veda_predictor ?? "").trim().replace(/[\u0000-\u001f]/g, "").slice(0, 200);
    if (pr) out.veda_predictor = pr;
  }
  if (String(o.long ?? "").trim() === "on") {
    out.long = "on";
    if (o.kitchen_attn === true || o.kitchen_attn === "true") out.kitchen_attn = true;
  }
  return out;
}
const catalogueFor = (kind) => (kind === "music" ? musicCatalogue() : kind === "video" ? videoCatalogue() : catalogue());
const archFor = (kind, id) => (kind === "music" ? musicArchById(id) : kind === "video" ? videoArchById(id) : archById(id));
const archIdsFor = (kind) => (kind === "music" ? musicArchIds() : kind === "video" ? videoArchIds() : archIds());

/**
 * "image" | "music" — what a raw style (or the stored one it replaces) is.
 *
 * An EDIT keeps the stored kind, even if the body names another: a style
 * never changes kind, because every field below depends on it and a music
 * style "flipped" to image would come back with its caption gone and a
 * width it never had. Want the other kind? That is a new style. read()
 * stamps kind:"image" onto a pre-2.90 file, so a STORED style always carries
 * a kind; a prev without one (read() passes an id-only prev) is only an id
 * carrier and the body decides.
 */
function kindOf(raw, prev) {
  const pk = String((prev || {}).kind ?? "").trim();
  if (KINDS.includes(pk)) return pk;
  const k = String((raw || {}).kind ?? "").trim();
  return KINDS.includes(k) ? k : "image";
}

/**
 * A number if one was PRESENT, else null.
 *
 * `+v || fallback` is the idiom this exists to kill: it turns every legitimate
 * 0 into the fallback. A LoRA weight of 0, a clip_skip of 0 and a cfg of 0 are
 * all real, meaningful settings, and a slider that silently refuses to reach
 * one end is a bug the user cannot even describe. Same fix as numOrNull() in
 * lib/timelineSpan.js.
 */
function numOrNull(v) {
  if (v == null || v === "" || v === false) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function numOr(v, d) {
  const n = numOrNull(v);
  return n == null ? d : n;
}
function clampOrNull(v, lo, hi) {
  const n = numOrNull(v);
  return n == null ? null : Math.max(lo, Math.min(hi, n));
}

/** A path-ish string, trimmed and length-capped. Never a path.basename() —
 *  these are real locations on the user's disk, not asset names. */
const str = (v, max = 400) => String(v == null ? "" : v).trim().slice(0, max);

/**
 * Style ids are random and permanent.
 *
 * NEVER an array index and never derived from the name: the cache-keying rule
 * (see lib/waveform.js) is that indices are reused the moment something is
 * deleted or reordered, and a renamed style must stay the same style so a
 * saved selection does not silently point at a different one.
 */
function newId() {
  return "st_" + require("crypto").randomBytes(6).toString("hex");
}

/**
 * Coerce anything the UI posts into a stored style.
 *
 * Every field is listed HERE and only here. `prev` is the style being replaced
 * on an edit, so a PATCH-shaped request cannot blank fields it did not mention.
 */
function normalize(raw, prev) {
  const b = raw || {};
  const old = prev || {};
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k);

  // THE KIND IS DECIDED FIRST, because everything below — which catalogue the
  // architecture comes from, which numbers exist, which engine is allowed — is
  // a function of it. A style never changes kind on edit: an image style that
  // is PATCHed without a kind stays an image style.
  const kind = kindOf(b, old);

  const arch = archFor(kind, str(b.arch)) ? str(b.arch)
             : archFor(kind, str(old.arch)) ? str(old.arch)
             : archIdsFor(kind)[0];
  const a = archFor(kind, arch);
  const d = a.defaults;

  const pick = (k, fallback) => (has(k) ? b[k] : old[k]) ?? fallback;
  // 2.598.0 (Tim: "add seed input ... in the styles - have a toggle button for random/fixed"): lib/seedPick.js
  const seedOf = () => require("./seedPick").norm(str(pick("seed_mode", "")), pick("seed", null));

  // te is positional: slot i belongs to arch.te[i]. Storing it as a plain array
  // keeps it in step with the catalogue; storing it keyed by flag name would
  // strand the value the day a flag is renamed upstream.
  const teIn = has("te") ? b.te : old.te;
  const te = a.te.map((_slot, i) => str(Array.isArray(teIn) ? teIn[i] : ""));

  const lorasIn = has("loras") ? b.loras : old.loras;
  const loras = (Array.isArray(lorasIn) ? lorasIn : [])
    .map((l) => ({
      path: str((l || {}).path),
      // Weight is a FLOAT out of a slider and 0 is legitimate. numOr, not `||`.
      weight: Math.max(-4, Math.min(4, numOr((l || {}).weight, 1))),
    }))
    .filter((l) => l.path)
    .slice(0, 12);

  const name = str(b.name || old.name || "", 80) || "Untitled style";

  if (kind === "video") {
    // VIDEO STYLE (2.110.0): ComfyUI only. `workflows` per mode (blank = the
    // Settings -> ComfyUI template for that mode), `phases` = one
    // {model, steps, cfg} per sampler/loader pair in graph order (Wan 2.2
    // high/low = two), a single te slot, vae, loras, negative, size.
    const wfIn = has("workflows") ? b.workflows : old.workflows;
    const workflows = {};
    for (const m of (a.modes || ["t2va", "ref2va", "fl2va"])) workflows[m] = str((wfIn || {})[m]);
    const phIn = has("phases") ? b.phases : old.phases;
    let phases = (Array.isArray(phIn) ? phIn : []).map((p) => ({
      model: str((p || {}).model),
      steps: clampOrNull((p || {}).steps, 0, 200),
      cfg: clampOrNull((p || {}).cfg, 0, 50),
      // 2.303.0 (Tim: "add the 8-bit loading option for users who are using
      // the bf16 models"): how ComfyUI's UNETLoader loads THIS phase's model
      // ("" = the workflow's own; fp8 halves a bf16/fp16 file in VRAM)
      dtype: WEIGHT_DTYPES.includes(str((p || {}).dtype)) ? str((p || {}).dtype) : "",
    })).slice(0, Math.max(1, a.phases_max || 4));
    if (!phases.length) phases = [{ model: str(has("model") ? b.model : old.model), steps: clampOrNull(pick("steps"), 0, 200), cfg: clampOrNull(pick("cfg"), 0, 50) }];
    return {
      id: str(old.id) || str(b.id) || newId(),
      name, kind: "video", engine: "comfy", arch,
      workflow: str(pick("workflow", "")),          // one graph for every mode, if set
      workflows, phases,
      te: [str(Array.isArray(teIn) ? teIn[0] : (teIn || ""))],
      vae: str(pick("vae", "")),
      loras, negative: str(pick("negative", ""), 2000),
      // 2.116.0 (Tim: "add sage + spectrum accelerators to our minimax
      // style"): what the worker injects in front of the guider/sampler.
      accel: normVideoAccel(has("accel") ? b.accel : old.accel),
      // 2.111.3 (Tim): PRESETS, not pixels — Basic Settings inherits them when
      // the style is picked and is what the render actually uses
      res: VIDEO_RES.includes(str(pick("res", ""))) ? str(pick("res", "")) : "",
      aspect: VIDEO_ASPECTS.includes(str(pick("aspect", ""))) ? str(pick("aspect", "")) : "",
      // 2.328.0: what the style is FOR. "" = a normal render style; "swap" =
      // a CHARACTER-SWAP style (mmh3_chr_swap): Swap mode renders through it
      // and /api/generate refuses it (lib/swap.isSwapStyle)
      role: VIDEO_ROLES.includes(str(pick("role", ""))) ? str(pick("role", "")) : "",
      ...seedOf(),
    };
  }

  if (kind === "music") {
    // MUSIC IS COMFYUI-ONLY. There is no sd-cli path for a song, so the engine
    // field is not a choice here — it is stored anyway so every consumer that
    // reads `style.engine` (the worker, the preflight, the combos) keeps working
    // without a special case for the kind.
    const cat = musicCatalogue();
    const lim = a.limits || {};
    return {
      id: str(old.id) || newId(),
      name,
      kind: "music",
      engine: "comfy",
      arch,
      workflow: str(pick("workflow", "")),
      // Loader OVERRIDES, ComfyUI dropdown values. Blank = the workflow's own.
      model: str(pick("model", "")),
      vae: str(pick("vae", "")),
      te,
      steps: clampOrNull(pick("steps", d.steps), 1, 200) ?? d.steps,
      cfg: clampOrNull(pick("cfg", d.cfg), 0, 30) ?? d.cfg,
      sampler: (cat.samplers || []).includes(str(pick("sampler", "")))
        ? str(pick("sampler", "")) : d.sampler,
      scheduler: (cat.schedulers || []).includes(str(pick("scheduler", "")))
        ? str(pick("scheduler", "")) : d.scheduler,
      // THE CAPTION IS THE STYLE: genre, BPM, key, mood, vocal, arrangement —
      // the text that is reusable across songs. The lyrics are NOT here; they
      // are the prompt, sent per render. Long on purpose: the Music3 template
      // ships a ~1,500-character caption and that is a normal one.
      caption: str(pick("caption", ""), 6000),
      // Seconds of song. The catalogue caps it (Music3's node tops out well
      // under five minutes); 0 is not a length, so the floor is 1.
      max_duration: clampOrNull(pick("max_duration", d.max_duration), 1,
                                numOr(lim.max_duration, 600)) ?? d.max_duration,
      loras,
      ...seedOf(),
      saved: Date.now() / 1000,
    };
  }

  // WHICH RENDERER. ComfyUI is the default because that is what this install
  // already runs for video, and requiring a second inference engine (and a
  // second copy of every model) just to make a still would be absurd. "sdcli"
  // stays available for anyone who does have stable-diffusion.cpp set up.
  const engine = ["comfy", "sdcli"].includes(str(pick("engine", "")))
    ? str(pick("engine", "")) : "comfy";

  const out = {
    id: str(old.id) || newId(),
    name,
    kind: "image",
    engine,
    arch,
    // comfy only: the Export (API) workflow this style renders through. The
    // template carries the models; the fields below OVERRIDE its loaders when
    // they are filled in, and mean nothing when they are not.
    workflow: str(pick("workflow", "")),
    inpaint_workflow: str(pick("inpaint_workflow", "")),   // 2.108.0: the image editor's infill graph
    model: str(pick("model", "")),
    vae: str(pick("vae", "")),
    te,
    // Numbers: absent -> the architecture's default, never 0-by-accident.
    steps: clampOrNull(pick("steps", d.steps), 1, 200) ?? d.steps,
    cfg: clampOrNull(pick("cfg", d.cfg), 0, 30) ?? d.cfg,
    clip_skip: clampOrNull(pick("clip_skip", d.clip_skip), -1, 12) ?? d.clip_skip,
    width: clampOrNull(pick("width", d.width), 64, 4096) ?? d.width,
    height: clampOrNull(pick("height", d.height), 64, 4096) ?? d.height,
    sampler: catalogue().samplers.includes(str(pick("sampler", "")))
      ? str(pick("sampler", "")) : d.sampler,
    // Only meaningful on architectures that use one, but stored either way so
    // switching arch back and forth does not lose the text.
    negative: str(pick("negative", ""), 2000),
    extra_args: str(pick("extra_args", ""), 500),
    loras,
    ...seedOf(),
    saved: Date.now() / 1000,
  };
  // 2.340.0: the reference pictures are optional (qwen2_1: none = text-to-image)
  if (pick("refs_optional", false) === true) out.refs_optional = true;
  /* ControlNet CHAIN (2.97.0): an image style may instead describe a chain —
     stage-1 style id, a controlnet model file, stage-2 style id. Only the
     SHAPE is checked here; whether the ids resolve to real image styles is
     the route's business, because only it holds the folder. The chain rides
     the normal style file, so it lists, selects and deletes like any style. */
  const chSrc = has("chain") ? b.chain : old.chain;
  if (chSrc && typeof chSrc === "object") {
    const ch = { first_id: str(chSrc.first_id, 80), controlnet: str(chSrc.controlnet, 300),
                 second_id: str(chSrc.second_id, 80) };
    /* 2.305.0 (by instruction): the chain's TYPE (pose / scribble / lineart /
       depth) and its INPUT model - the preprocessor that makes the control
       map (lib/controlnetTypes.js). Both optional; an unknown type is "". */
    const cnType = require("./controlnetTypes").normType(chSrc.cn_type);
    if (cnType) ch.cn_type = cnType;
    const pre = str(chSrc.preprocessor, 500);
    if (pre) ch.preprocessor = pre;
    if (ch.first_id && ch.controlnet && ch.second_id) out.chain = ch;
  }
  return out;
}

/** Required-but-empty fields, for a warning in the UI and a hard stop in the
 *  worker. Mirrors missing_slots() in scripts/image_gen.py.
 *
 *  THE TWO ENGINES NEED DIFFERENT THINGS, and conflating them is how a user
 *  ends up filling in five model paths that nothing reads. sd-cli needs every
 *  file named, because it is handed a command line. ComfyUI needs a workflow,
 *  because the workflow already names its own models — the style's model/VAE/TE
 *  fields are OPTIONAL overrides there, not requirements. */
function missingSlots(style) {
  const s = style || {};
  // A VIDEO style may leave every workflow blank: the worker then uses the
  // Settings -> ComfyUI template for that mode (_style_workflow, 2.110.0), so
  // nothing is required of it here. 2.116.0's MiniMax H3 SS starter ships
  // exactly this shape — accelerators only, everything else the defaults.
  if (kindOf(s) === "video") return [];
  // A music style whose ARCH names a non-comfy engine (2.229.0: yue2 rides
  // its own pinned pipeline in a venv) needs no workflow at all — the
  // catalogue's engine field is the truth. Every OTHER music style renders
  // through ComfyUI and the workflow is the one thing it cannot do without.
  if (kindOf(s) === "music") {
    const ma = musicArchById(str(s.arch));
    if (ma && ma.engine && ma.engine !== "comfy") return [];
    return str(s.workflow) ? [] : ["workflow"];
  }
  if ((s.engine || "comfy") === "comfy") {
    return str(s.workflow) ? [] : ["workflow"];
  }
  const a = archById(str(s.arch));
  if (!a) return [`unknown architecture: ${s.arch}`];
  const miss = [];
  if (!str(s.model)) miss.push("model");
  if (a.vae.required && !str(s.vae)) miss.push("VAE");
  a.te.forEach((slot, i) => {
    if (slot.required && !str((s.te || [])[i])) miss.push(slot.label);
  });
  return miss;
}

/**
 * How many reference-image slots a comfy style's workflow has.
 *
 * The UI needs this to decide whether to send the reference dock at all:
 * handing images to a text-to-image workflow is refused (rightly — silently
 * dropping them would be worse), so the button must know before it asks.
 * Counted by class_type, which is all that is needed here; the real work of
 * filling and bypassing the slots is scripts/comfy_image.py's.
 */
function imageSlots(style, baseDir) {
  const rel = str((style || {}).workflow);
  if ((style || {}).engine !== "comfy" || !rel) return 0;
  try {
    const p = path.isAbsolute(rel) ? rel : path.join(baseDir, rel);
    const g = JSON.parse(fs.readFileSync(p, "utf8"));
    return Object.entries(g).filter(([k, v]) => !k.startsWith("_") && v
      && /loadimage/i.test(String(v.class_type || ""))).length;
  } catch { return 0; }
}

/**
 * Which ComfyUI model CATEGORY this style's workflow can actually accept, by
 * looking at the loader key its graph uses. Returns [] when it cannot tell.
 *
 * THIS EXISTS BECAUSE OF A REAL FAILURE. The Model dropdown merges checkpoints,
 * diffusers and diffusion_models into one list so nobody has to know which kind
 * of loader their graph uses. But scripts/comfy_image.py writes the chosen name
 * into whichever MODEL_KEY the graph HAS — so a checkpoint name picked from the
 * merged list lands in `unet_name`, and ComfyUI validates that against its
 * diffusion_models list and refuses:
 *
 *     node 70: Value not in list [unet_name] = flux_klein_9B/....safetensors
 *       not in (list of length 24)
 *
 * The name was real, the file existed, and the separator (which two releases
 * were spent on) was never the problem: it was the wrong KIND of model. The
 * merged dropdown is still right — it just has to be narrowed to what the
 * workflow's loader will take.
 *
 * The key set is mirrored from MODEL_KEYS in scripts/comfy_image.py; if one
 * changes the other must. `model_name` is deliberately unmapped: it belongs to
 * upscalers as often as to model loaders, so it answers "cannot tell" rather
 * than guessing a category.
 */
const MODEL_KEY_CATEGORY = {
  unet_name: "diffusion_models",
  ckpt_name: "checkpoints",
  model_path: "diffusers",
};

function modelKinds(style, baseDir) {
  const rel = str((style || {}).workflow);
  if ((style || {}).engine !== "comfy" || !rel) return [];
  try {
    const p = path.isAbsolute(rel) ? rel : path.join(baseDir, rel);
    const g = JSON.parse(fs.readFileSync(p, "utf8"));
    const out = [];
    for (const [k, node] of Object.entries(g)) {
      if (k.startsWith("_") || !node || typeof node !== "object") continue;
      for (const key of Object.keys(node.inputs || {})) {
        const cat = MODEL_KEY_CATEGORY[key];
        if (cat && !out.includes(cat)) out.push(cat);
      }
    }
    return out;
  } catch { return []; }
}

// ------------------------------------------------------------------ storage
/**
 * ONE FILE PER STYLE, named after the style: styles/<name>.json.
 *
 * The point is that the store is browsable and hand-editable — you can open
 * styles/Cinematic.json, read it, tweak a path, copy it to another install or
 * email it to someone, and back one up by copying one file. A single
 * styles.json blob gives none of that and turns "send me your Portrait style"
 * into an editing exercise.
 *
 * THE NAME IS THE FILENAME, BUT THE ID IS STILL THE KEY. A style keeps a
 * permanent random id inside the file, and the API addresses styles by it, so
 * renaming a style is still a RENAME (the file moves, the id survives, and a
 * saved selection in the prompt docker keeps pointing at the same style)
 * rather than a delete-plus-create. Filenames answer "what is this file";
 * ids answer "which style is this".
 *
 * NAMES MUST THEREFORE BE UNIQUE, and a clash is REFUSED rather than
 * overwritten or silently uniquified. Overwriting is data loss; uniquifying
 * the file while leaving the name alone would put two identical-looking
 * entries in the dropdown backed by different files, which is worse than an
 * error message.
 */
const LEGACY_FILE = "styles.json";   // the single-blob store from 2.66.0

/** Windows will not create these, whatever the user typed. */
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * A style name turned into a safe filename stem.
 *
 * Path separators and traversal are stripped, not escaped: a style called
 * "../../config" must become a file in the styles folder, never a write
 * anywhere else. Trailing dots and spaces go because Windows silently drops
 * them, which would make the file the app writes and the file it looks for
 * two different names.
 */
function fileStem(name) {
  let s = String(name || "").trim()
    .replace(/[\\/]+/g, "-")
    .replace(/[<>:"|?*\x00-\x1f]/g, "")
    // Collapse runs of dots so "../../config" cannot leave ".." fragments in
    // the filename. A single dot is legitimate ("v1.5 look") and is kept.
    .replace(/\.{2,}/g, ".")
    .replace(/^[.\-\s]+/, "")
    .replace(/[. ]+$/, "")
    .slice(0, 80)
    .trim();
  if (!s) s = "style";
  if (RESERVED.test(s)) s = "_" + s;
  return s;
}
const fileFor = (dir, name) => path.join(dir, fileStem(name) + ".json");

/**
 * A stable id for a file somebody dropped in by hand.
 *
 * Derived from the filename so it is the SAME id on every read — an id minted
 * fresh each time would make the style a different style after every refresh,
 * and the prompt docker's saved selection would never stick.
 */
function idForFile(stem) {
  return "st_f" + require("crypto").createHash("sha1")
    .update(stem.toLowerCase()).digest("hex").slice(0, 11);
}

/** Migrate the 2.66.0 single-blob store, once, then leave it alone. */
function migrateLegacy(dir) {
  const legacy = path.join(dir, LEGACY_FILE);
  try {
    if (!fs.existsSync(legacy)) return;
    const j = JSON.parse(fs.readFileSync(legacy, "utf8"));
    if (!Array.isArray(j.styles)) return;
    for (const s of j.styles) {
      const f = fileFor(dir, s.name);
      if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify(s, null, 2));
    }
    fs.renameSync(legacy, legacy + ".migrated");
  } catch { /* a bad legacy file must never stop the app reading the folder */ }
}

/**
 * Every style in the folder.
 *
 * A single unreadable or hand-mangled file is SKIPPED, never fatal: one bad
 * file must not empty the dropdown and make it look like every style was lost.
 */
/**
 * Styles bitGen Studio ships with, written on first run if the folder is empty.
 *
 * They point at the bundled FLUX.2 Klein 9B templates, which carry four
 * bypassed LoRA slots, so a fresh install has something that works the moment
 * the models are in ComfyUI's folders — rather than an empty dropdown and a
 * Generate Image button that can only fail. Written ONCE: delete one and it
 * stays deleted, because the folder is no longer empty.
 */
const STARTER_STYLES = [
  /* TIM'S OWN EXPORTS, CONFIRMED WORKING IN COMFYUI (2.75.0). They are listed
     FIRST so a fresh install picks a known-good template rather than one of the
     older ones below. Both drive their prompt and size from shared Primitive
     nodes, which is what broke the patcher until 2.75.0 — see is_primitive() in
     scripts/comfy_image.py. Neither carries LoRA nodes: the patcher BUILDS them
     from the style when there are any, so the templates stay clean. */
  { name: "FLUX.2 9B (verified)", arch: "flux2klein9b", engine: "comfy",
    workflow: "comfy_workflows/img_flux2_9b_t2i_verified.json",
    steps: 20, cfg: 5, width: 1024, height: 1024, negative: "" },
  // Image EDIT with TWO reference slots. Output size follows the first
  // reference image (GetImageSize), so the style carries no width/height.
  { name: "FLUX.2 9B edit (verified)", arch: "flux2klein9b", engine: "comfy",
    workflow: "comfy_workflows/img_flux2_9b_edit_verified.json",
    steps: 20, cfg: 5, negative: "" },
  /* INPAINT for the image editor (2.109.0, by instruction): Tim's FLUX
     inpaint export. Same file as its workflow AND its inpaint_workflow, so it
     can be picked as an image style (renders the whole picture from a
     reference's alpha) and is the editor's default Infill style. The model
     (unet_name) and LoRAs set in Settings -> Image are applied. */
  /* SDXL FAMILY (2.112.0, Tim: "do you need a template for pony/illustrious/
     sdxl?"). Core-node graphs: img_sdxl_t2i.json and img_sdxl_i2i.json
     (img2img from the reference dock's first picture, denoise 0.65). The
     three styles differ only in negative prompt + clip skip; set the
     checkpoint in Settings -> Image. Infill goes through Tim's SDXL inpaint
     export (checkpoint loaders pick it automatically). */
  { name: "SDXL", arch: "sdxl", engine: "comfy",
    workflow: "comfy_workflows/img_sdxl_t2i.json",
    steps: 28, cfg: 6, clip_skip: 1, width: 1024, height: 1024,
    negative: "worst quality, low quality, blurry, deformed, extra fingers, text, watermark" },
  { name: "SDXL img2img", arch: "sdxl", engine: "comfy",
    workflow: "comfy_workflows/img_sdxl_i2i.json",
    steps: 28, cfg: 6, clip_skip: 1,
    negative: "worst quality, low quality, blurry, deformed, extra fingers, text, watermark" },
  { name: "Pony", arch: "sdxl", engine: "comfy",
    workflow: "comfy_workflows/img_sdxl_t2i.json",
    steps: 28, cfg: 6, clip_skip: 2, width: 1024, height: 1024,
    negative: "score_6, score_5, score_4, worst quality, low quality, text, watermark, extra limbs" },
  { name: "Illustrious", arch: "sdxl", engine: "comfy",
    workflow: "comfy_workflows/img_sdxl_t2i.json",
    steps: 28, cfg: 5.5, clip_skip: 2, width: 1024, height: 1024,
    negative: "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digits, jpeg artifacts, signature, watermark, blurry" },
  { name: "FLUX Fill inpaint", arch: "flux", engine: "comfy",
    workflow: "comfy_workflows/img_flux_fill_inpaint.json",
    inpaint_workflow: "comfy_workflows/img_flux_fill_inpaint.json",
    negative: "" },
  /* INSTRUCTION EDIT for the image editor's ✨ AI panel (2.332.0, Tim: "select
     and edit via qwen edit, kontext or regenerate that portion like krita ai
     diffusion does"). Both graphs are ComfyUI's own templates in API form
     (comfy_workflows/*, their _comment says what changed): the picture is
     Picture 1, the output keeps its aspect (~1 MP). Qwen runs 4 steps with
     the Lightning LoRA in slot 1 - keep it, or raise steps to ~40 / cfg 4.
     Kontext shares clip_l / t5xxl_fp16 / ae with FLUX Fill inpaint. */
  { name: "Qwen Image Edit 2511", arch: "qwen-image", engine: "comfy",
    workflow: "comfy_workflows/img_qwen_edit_2511.json",
    steps: 4, cfg: 1, negative: "",
    loras: [{ path: "Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors", weight: 1 }] },
  /* 2.337.0 (Tim: "can we use qwen2.1 to put the character in the location
     with the props as first frame?"): Qwen Image 2.1 edit - up to 8 pictures
     (<image1>..<image8>), image1 the one being edited. The scene cards' ✎
     First frame builds with it (lib/sceneEdit.js); the image editor's Edit
     lists it too. 25 steps, cfg 1 (the official pipeline uses 40-50). */
  { name: "Qwen Image 2.1 edit", arch: "qwen-image", engine: "comfy",
    workflow: "comfy_workflows/img_qwen21_edit.json",
    steps: 25, cfg: 1, negative: "" },
  /* 2.340.0 (Tim: "allow qwen 2.1 to use reference docker images as it's
     reference images. add a style , qwen2_1 , should be able to use up to 10
     images"): the reference dock's pictures, in order, are <image1>..<image10>
     (lib/qwenRefs.js names them from their Type when the prompt does not);
     an empty dock = text-to-image (refs_optional: the unused slots feed an
     optional input and are bypassed - scripts/comfy_image.slots_optional). */
  { name: "qwen2_1", arch: "qwen-image", engine: "comfy",
    workflow: "comfy_workflows/img_qwen21_edit_10.json",
    steps: 25, cfg: 1, negative: "", width: 1024, height: 1024, refs_optional: true },
  { name: "FLUX.1 Kontext edit", arch: "flux", engine: "comfy",
    workflow: "comfy_workflows/img_flux_kontext_edit.json",
    steps: 20, cfg: 1, negative: "" },
  { name: "FLUX.2 Klein 9B", arch: "flux2klein9b", engine: "comfy",
    workflow: "comfy_workflows/img_flux2_klein_9b_t2i.json",
    steps: 4, cfg: 1, width: 1024, height: 1024 },
  { name: "FLUX.2 Klein 9B base", arch: "flux2klein9b", engine: "comfy",
    workflow: "comfy_workflows/img_flux2_klein_base_9b_t2i.json",
    steps: 20, cfg: 5, width: 1024, height: 1024,
    negative: "" },
  // Image EDIT: needs at least one reference image, and takes its output size
  // from that image rather than from the style.
  { name: "FLUX.2 Klein 9B edit", arch: "flux2klein9b", engine: "comfy",
    workflow: "comfy_workflows/img_flux2_klein_edit_9b.json",
    steps: 20, cfg: 5, negative: "" },
  /* FLUX 3 IMAGE KLEIN (2.502.0, Tim: "add flux 3 klein model"): BFL's 5.6B open model (15 Oct 2026, ComfyUI
     0.41.0+). Distilled = 16 steps cfg 1; base = 50 steps cfg 3.5 with a real negative; edit = up to 4 pictures
     (<ref_image_0>.. in the prompt). A text-to-image style given reference pictures runs its edit sibling
     (lib/imageRefs.js - FLUX 3 swaps only to FLUX 3 graphs). */
  { name: "FLUX 3 Klein", arch: "flux3klein", engine: "comfy",
    workflow: "comfy_workflows/img_flux3_klein_t2i.json",
    steps: 16, cfg: 1, width: 1024, height: 1024 },
  { name: "FLUX 3 Klein base", arch: "flux3klein", engine: "comfy",
    workflow: "comfy_workflows/img_flux3_klein_base_t2i.json",
    steps: 50, cfg: 3.5, width: 1024, height: 1024, negative: "" },
  { name: "FLUX 3 Klein edit", arch: "flux3klein", engine: "comfy",
    workflow: "comfy_workflows/img_flux3_klein_edit.json",
    steps: 16, cfg: 1, negative: "" },
  /* KREA 2 (2.516.0, Tim: "create workflows for krea2 gguff and safetensors"): Krea's 12B open image model through
     ComfyUI (CLIPLoader type krea2 + Qwen3-VL 4B, the Qwen-Image VAE). Turbo = 8 steps cfg 1 (er_sde / simple, a
     zeroed negative); Raw = the undistilled base, 52 steps cfg 3.5 with a real negative. safetensors in
     models/diffusion_models; GGUF in models/unet on ComfyUI-GGUF's UnetLoaderGGUF (any quant - set Model). */
  { name: "Krea 2 Turbo", arch: "krea2", engine: "comfy",
    workflow: "comfy_workflows/img_krea2_turbo_t2i.json",
    steps: 8, cfg: 1, width: 1024, height: 1024, negative: "" },
  { name: "Krea 2 Raw", arch: "krea2", engine: "comfy",
    workflow: "comfy_workflows/img_krea2_raw_t2i.json",
    steps: 52, cfg: 3.5, width: 1024, height: 1024,
    negative: "lowres, blurry, jpeg artifacts, watermark, text, deformed" },
  { name: "Krea 2 Turbo GGUF", arch: "krea2", engine: "comfy",
    workflow: "comfy_workflows/img_krea2_turbo_gguf_t2i.json",
    steps: 8, cfg: 1, width: 1024, height: 1024, negative: "" },
  { name: "Krea 2 Raw GGUF", arch: "krea2", engine: "comfy",
    workflow: "comfy_workflows/img_krea2_raw_gguf_t2i.json",
    steps: 52, cfg: 3.5, width: 1024, height: 1024,
    negative: "lowres, blurry, jpeg artifacts, watermark, text, deformed" },
  /* ANIMA (2.517.0, Tim: "create workflow for anima safetensors"): CircleStone Labs' 2B anime / illustration model through
     ComfyUI (Qwen3 0.6B text encoder, the Qwen-Image VAE). 30 steps, cfg 4, er_sde, the model card's negative. Start the
     prompt with "masterpiece, best quality, score_7, safe, " (Danbooru tags, plain words or both). */
  { name: "Anima", arch: "anima", engine: "comfy",
    workflow: "comfy_workflows/img_anima_aesthetic_t2i.json",
    steps: 30, cfg: 4, width: 1024, height: 1024,
    negative: "worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration" },
  { name: "Anima base", arch: "anima", engine: "comfy",
    workflow: "comfy_workflows/img_anima_base_t2i.json",
    steps: 30, cfg: 4, width: 1024, height: 1024,
    negative: "worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration" },
  /* MOSS-IMAGE (2.566.0, Tim: "can you add this model type to bitgen please...https://huggingface.co/Comfy-Org/MOSS-Image,
     add an option in add-ons to download and install it"): OpenMOSS's open 5B image model (Apache-2.0) through ComfyUI
     (16 Oct 2026+: CLIPLoader type moss_image + Qwen3.5 9B, the small FLUX.2 VAE). SFT = the instruction-tuned one (the
     default), Base = no post-training (for LoRAs). 25 steps, cfg 2.5, er_sde, skip layer guidance on layer 22 - ComfyUI's
     template; about 1 MP. Settings ▸ Add-ons ▸ MOSS-Image downloads the files (lib/mossAddon.js). */
  { name: "MOSS-Image", arch: "moss", engine: "comfy",
    workflow: "comfy_workflows/img_moss_image_t2i.json",
    steps: 25, cfg: 2.5, width: 1024, height: 1024,
    negative: "nsfw, worst quality, bad anatomy, watermark, jpeg artifact" },
  { name: "MOSS-Image Base", arch: "moss", engine: "comfy",
    workflow: "comfy_workflows/img_moss_image_base_t2i.json",
    steps: 25, cfg: 2.5, width: 1024, height: 1024,
    negative: "nsfw, worst quality, bad anatomy, watermark, jpeg artifact" },
  /* FIBO 2.0 (2.582.0, Tim: "please add fibo to the model edit tools https://huggingface.co/realrebelai/Fibo-2.0_GGUFs ...
     this model should work with very low vram"): Bria's 8B model (CC BY-NC 4.0 - non-commercial) through ComfyUI's own
     nodes (21 Oct 2026+: CLIPLoader type fibo2, TextEncodeFibo2). The graphs follow that repo's workflow; the pictures
     are <image_1>..<image_4> (image_1 = the one being edited). Low VRAM: the w4a8 ConvRot file (6.6 GB) - pick
     fibo2_*-Q4_0.gguf / Q5_0 / Q8_0 as the style's Model for GGUF (UnetLoaderGGUF swapped in by the file's kind).
     Settings ▸ Add-ons ▸ Fibo 2.0 downloads the files (lib/fiboAddon.js). */
  { name: "Fibo 2.0 Edit Turbo", arch: "fibo2", engine: "comfy",
    workflow: "comfy_workflows/img_fibo2_edit.json",
    steps: 4, cfg: 1, negative: "" },
  { name: "Fibo 2.0 Dev", arch: "fibo2", engine: "comfy",
    workflow: "comfy_workflows/img_fibo2_dev.json",
    steps: 30, cfg: 5, width: 1024, height: 1024, negative: "", refs_optional: true },
  /* THE MUSIC STARTER (2.90.0). Tim's own ComfyUI export, shipped as the
     template. The caption is the one the export carried — a complete worked
     example of the Global Metadata / Vocal Details / Arrangement form, which is
     worth more as a starting point than an empty box with a hint. */
  /* YuE2 (2.229.0, Tim: "use dropdown to change from minimax to yue2(we
     will probably add more models later"). engine "yue2" rides the pinned
     official pipeline in its own venv (misc\\get-yue2.ps1; music_worker
     .run_yue2) — no ComfyUI workflow, so `workflow` stays empty on
     purpose. The caption IS YuE2's style prompt. Seeded BY NAME like every
     starter (the 2.90.1 stamp). */
  { name: "YuE2", kind: "music", arch: "yue2", engine: "yue2",
    caption: "English, warm piano pop, expressive female voice, acoustic "
      + "piano, rounded bass and light drums, lyrical memorable melody, "
      + "unhurried phrasing, 88 BPM" },
  /* YuE2 through ComfyUI (2.236.0, Tim's yue2_full.json export): the song
     is WRITTEN AS ABC SHEET NOTATION first, then sung from the score — the
     music dock's Sheet Music tab shows it, Cover sings a reference track's
     transcription. The caption is the export's own worked example (the
     template-is-a-better-default rule). Sampler/scheduler/steps/cfg are the
     export's KSampler values verbatim. */
  { name: "YuE2 ComfyUI", kind: "music", arch: "yue2-comfy", engine: "comfy",
    workflow: "comfy_workflows/audio_yue2.json",
    model: "yue2_convrot_int8.safetensors",
    steps: 32, cfg: 1, sampler: "dpm_2", scheduler: "sgm_uniform",
    max_duration: 360,
    caption: "violin with girl singing jpop anime" },
  { name: "MiniMax Music3", kind: "music", arch: "minimax-music3",
    workflow: "comfy_workflows/audio_minimax_music3.json",
    steps: 30, cfg: 1.7, max_duration: 60,
    caption: "Global Metadata: Lo-fi hip-hop, chillhop. 78 BPM, D flat major, "
      + "major scale with jazzy extensions. Laid-back and dreamy throughout, a "
      + "gentle warm drift with a subtle late-night glow that deepens in the "
      + "middle and dissolves softly at the end. Studying, raining-outside, "
      + "headphones-on late-night listening. Bedroom production: muddy warm "
      + "texture, heavy vinyl crackle, tape hiss and wow-flutter pitch wobble, "
      + "low-passed dusty mix, soft-clipped drums, everything slightly detuned "
      + "and cozy.\n\nVocal Details: Soft androgynous vocal, hushed half-sung "
      + "half-spoken delivery, sitting low in the mix like another instrument, "
      + "lazy behind-the-beat phrasing, gentle breathy timbre. Sparse murmured "
      + "double-tracked harmonies, occasional wordless \"mmm\" and \"ooh\" hums "
      + "drenched in tape delay and warm spring reverb. Long stretches with no "
      + "vocals at all.\n\nArrangement: Dusty boom-bap drums with a soft thumping "
      + "kick, cracked snare with lazy swing, brushed hi-hats, low round sub "
      + "bass. Warm Rhodes piano chords with slow chorus wobble as the harmonic "
      + "bed, mellow jazzy guitar licks answering the vocal lines, constant "
      + "vinyl crackle as texture. Intro: rain and vinyl noise, solo Rhodes "
      + "chords fading in, drums slipping in halfway. Verses: minimal — drums, "
      + "bass, Rhodes, soft guitar fills between lines. Bridge: drums drop away "
      + "to rain, crackle, and floating detuned Rhodes, then the beat eases "
      + "back in. Outro: elements fade one by one until only vinyl crackle and "
      + "a last unresolved Rhodes chord remain." },
  /* SAGE + SPECTRUM (2.116.0, Tim: "add sage + spectrum accelerators to our
     minimax style ... make this a separate style - minimax h3 SS.json don't
     overwrite existing style"). A READY-MADE accelerated H3 video style:
     blank workflows/model = the Settings -> ComfyUI templates and Basic
     Settings, so it differs from a plain render ONLY by the two injected
     accelerator nodes — Sage attention "auto" (KJNodes patch) + Spectrum
     "on" (the node's own audio-safe conservative defaults). Needs the packs
     installed: Settings -> ComfyUI -> Video accelerators. seedStarters
     guarantees the "don't overwrite" part: an existing file by this name is
     kept, and deleting the style keeps it deleted (stamped by name). */
  { name: "MiniMax H3 SS", kind: "video", arch: "minimax-h3",
    accel: { sage: "auto", spectrum: "on" } },
  /* LONG SINGLE RUNS (2.503.0, Tim: "the secret sauce workflow is meant to be able to do 25 sec video according to
     the youtube video"): the Settings -> ComfyUI templates like "MiniMax H3 SS", with the export's three model
     patches instead of Sage + Spectrum (low-VRAM attention, chunked feed-forward, comfy kitchen attention) - one
     generation up to 30 s. Steps / LoRAs (the export ran its turbo LoRA at 8 steps) come from Basic Settings. */
  { name: "MiniMax H3 Long (30 s)", kind: "video", arch: "minimax-h3",
    accel: { sage: "off", spectrum: "off", long: "on", kitchen_attn: true } },
  /* THE BLUEPRINT AS A STYLE (2.128.0, Tim: "can you make it a style so i can
     use it alongside the working style, call it minimaxH3-I.json").

     THE NAME IS THE FILENAME (styles.js's own rule), so this seeds as
     styles/minimaxH3-I.json exactly as asked.

     It differs from "MiniMax H3 SS" in ONE way, deliberately, so that running
     the two side by side is an experiment rather than a guess: SS leaves its
     workflows BLANK (the Settings -> ComfyUI templates), while this one brings
     its own graph — the single shot lifted out of Tim's H3 Longform blueprint.
     Same accelerators, same arch, same Basic Settings. If one renders better,
     the graph is the reason.

     model/te/vae ARE DELIBERATELY BLANK. The graph's own loaders already carry
     the filenames from Tim's ComfyUI 0.34 export, which are by definition the
     names his install has. Repeating them here would be a second source for one
     fact, and the style's copy would win — so a filename fixed on the canvas
     would silently not take effect. */
  { name: "minimaxH3-I", kind: "video", arch: "minimax-h3",
    workflow: "comfy_workflows/h3_scene_api.json",
    accel: { sage: "auto", spectrum: "on" } },
  /* MM3_Characters (2.135.0) — Tim's Short Film Director pipeline, tested and
     exported from his own ComfyUI. It renders through the TMP file, because the
     character chain is rebuilt into it from the Video docker's cast every time
     that cast changes; MM3_Characters.json is the untouched original.
     NO model/te/vae here, by instruction: "we will use the workflows paths
     because it is made specifically for comfyui" — the graph's own loaders are
     the single source of truth, which is also this project's standing rule. */
  { name: "MM3_Characters", kind: "video", arch: "minimax-h3",
    workflow: "comfy_workflows/MM3_Characters_tmp.json" },
  /* MMH3_Music_Video STARTER RETIRED (2.284.0, Tim's pivot: "lets scrap
     the continuous reference workflows ... too complicated and
     restrictive"). The chain machinery (CHAIN_STYLES, writePlan, the
     Contex-Loop conversion) STAYS so existing boards keep rendering;
     new installs simply do not receive the style. Per-scene rendering
     with the timeline dock assembling replaced it. Original note:
     (2.268.0, Tim: "can we add this workflow as a style,
     call it MMH3_Music_Video"). The AI BRIEF's Music Video Ai (Latent
     Upscale) pack: H3 chain + latent upscale + three references —
     @character (a cast sheet), @typo (a chapter reference picture), and
     @music (a chapter SOUND, 2.266). Ships as the UI export
     (MMH3_Music_Video.ui.json — the pack's own file, untouched); the API
     base is converted ON FIRST RENDER through live ComfyUI's
     /object_info (widget names are never guessed), then this style
     renders through its OWN cast-rebuilt tmp exactly like
     MM3_Characters. Needs the Contex-Loop + KJNodes packs installed. */

  /* MM3H-Character-ref (2.143.0, Tim: "add this workflow for another style
     MM3H-Character-ref, the other is using fl2va, this one uses ref2va").
     His Short Film Director + Upscale export, verbatim (API format, chain +
     scheduled references + in-graph Sage accel + upscale stage). Served for
     ref2va via the per-mode map; the graph is untouched — unlike
     MM3_Characters it does NOT render through the cast-rebuilt TMP file, so
     its own two demo references stay as exported. No model/te/vae, standing
     rule: the graph's loaders are the single source of truth. */
  { name: "MM3H-Character-ref", kind: "video", arch: "minimax-h3",
    workflows: { ref2va: "comfy_workflows/MM3H_Character_ref.json" } },
  /* OBVPM_Timeline REMOVED (2.291.0, Tim: "remove the ovpm timeline, we
     will use our timeline docker"; its starter was retired at 2.284.0).
     A store entry an old install adopted is hidden by REMOVED_STYLES. */

  /* MMH3_NativeAudio_MV (2.284.0, Tim's per-scene pivot). One reference,
     the scene's segment audio-locked, one lipsync clip out (MIT, see
     NOTICE.md). ref2va starts a scene; fl2va continues one; the
     timeline dock assembles the film. */
  { name: "MMH3_NativeAudio_MV", kind: "video", arch: "minimax-h3",
    workflows: { ref2va: "comfy_workflows/MMH3_NativeAudio_MV.json",
                 // 2.292.0: the fl2va twin (MiniMaxH3ImageToVideo + the lock)
                 fl2va: "comfy_workflows/MMH3_NativeAudio_MV_fl2va.json" } },
  /* H3_Video_Ref (2.223.16; reshaped 2.227.0, Tim verbatim: "remove the
     extend workflow, this workflow needs a node that corrupts the other h3
     nodes"). The scene board routes on THIS NAME (lib/extendVideo
     .REF_STYLE): EVERY scene renders through the NATIVE ref2va export with
     the reference pictures, character sheets, character voices and the
     global prompt as its references; scene n carries scene n-1's take in
     ref2va's own video-reference slot. `workflow` pins the graph; no
     model/te/vae, standing rule — the export's own loaders are the truth.
     Starters are seeded BY NAME (the 2.90.1 stamp), so a fresh install and
     the e2e's wiped styles/ both get it, and deleting it keeps it deleted. */
  { name: "H3_Video_Ref", kind: "video", arch: "minimax-h3",
    workflow: "comfy_workflows/ref2va.json" },
  /* FASTH3 OMNI (2.573.0, Tim: "please add this workflow https://www.fasth3-omni.com/en, fasth3 omni"): FastVideo's
     8-step distillation of H3's reference-to-video model - Comfy-Org's template video_fasth3_ominiref_r2v as an API
     graph: the native MiniMaxH3ReferenceToVideo, shift 12/3, comfy kitchen attention + VSA sparse attention (keep 10),
     8 steps euler, cfg 1. ComfyUI 0.43+ (no node pack). The board renders it like H3_Video_Ref (lib/extendVideo
     .REF_FLOWS); Settings ▸ Add-ons ▸ FastH3 Omni downloads the model (lib/fasth3Addon.js). */
  { name: "FastH3 Omni", kind: "video", arch: "minimax-h3",
    workflow: "comfy_workflows/fasth3_omni_r2v.json" },
  /* mmh3_chr_swap (2.328.0, Tim: "is there a style for this workflow, if not
     can you make one mmh3_chr_swap"). The CHARACTER SWAP style: Tim's
     minimax-h3-swap export (reference video + picture of the new character
     -> the same performance, the new character). Swap mode and the scene ⇄
     render through it (lib/swap.resolveStyle); picking it in the prompt
     bar switches to Swap mode, and /api/generate refuses it for the other
     modes (it has no text/first-frame path). No model/te/vae - standing
     rule, the graph's loaders are the truth; accelerators off (Spectrum is
     approximate and a swap has to hold the performance frame for frame).
     role "swap" marks it (the plain ref2va graph has the same node classes,
     so the graph alone cannot tell); the workflow sits in the ref2va slot so
     the style editor shows it. Edit it in Settings -> Video styles. */
  /* 2.338.0 (Tim: "can we add ltx2.5 for our music video and screenplay
     and first/last frame from reference images/audio/video option ... with
     ltx2 style"): LTX 2.5 - Tim's all-in-one canvas, one mode per job
     (lib/ltx.js -> ltx_worker.py). No model / te / vae: the canvas's own
     loaders are the truth (a .gguf model picks its GGUF loader). */
  { name: "LTX 2.5", kind: "video", arch: "ltx-2.5",
    workflow: "comfy_workflows/LTX25_All_In_One.json" },
  /* 2.402.0 (Tim: "https://huggingface.co/fal/LTX-2.3-3DREAL-LoRA, can we use this lora and our blender bridge to
     layout a 3d scene in blender and render it in bitgen using ltx2.3 - please add a style for ltx2.3"): LTX 2.3 on
     Comfy-Org's templates (lib/ltxOfficial family ltx23): text, picture, first-last, and 3D render -> real (fal's
     3DREAL IC-LoRA, the render as its guide). No model / te: the checkpoint and the Gemma 3 encoder are picked from
     what ComfyUI lists; set them here to force a file. */
  { name: "LTX 2.3", kind: "video", arch: "ltx-2.3",
    negative: "blurry, out of focus, overexposed, underexposed, low contrast, washed out colors, excessive noise, grainy texture, flickering, distorted, deformed, cartoon, CGI, 3d render, video game, plastic" },
  { name: "mmh3_chr_swap", kind: "video", arch: "minimax-h3", role: "swap",
    workflows: { ref2va: "comfy_workflows/MiniMax_H3_Swap.json" } },
  /* H3_Viggle (2.352.0, Tim: "we should have a fl2va workflow too, can we
     incorporate viggle into these worklows but make it a new viggle
     workflow?"): Viggle-Animate through ComfyUI - the scene's motion video
     drives, the character sheet (ref2va) or the first frame (fl2va)
     performs. worker.py fills both graphs with scripts/h3viggle.py; the
     board's Workflow "H3_Viggle" and the prompt docker both reach it
     (lib/h3Viggle.js). No model/te/vae - the graphs' loaders are the truth. */
  { name: "H3_Viggle", kind: "video", arch: "minimax-h3",
    workflows: { ref2va: "comfy_workflows/H3_Viggle_ref2va.json", fl2va: "comfy_workflows/H3_Viggle_fl2va.json" } },
  /* Wan 2.1 / Wan 2.2 (2.368.0, Tim: "add a wan2.1 style so we can use wan as well, also wan2.2"): no
     workflow - wan_worker.py builds the graph from ComfyUI's core Wan nodes and picks the model files ComfyUI
     lists for each mode (lib/wan.js, scripts/wan_graph.py). Phases left blank on purpose: set one only to
     force a file. */
  { name: "Wan 2.1", kind: "video", arch: "wan21", negative: "blurry, low quality, distorted, deformed, static, watermark, text" },
  { name: "Wan 2.2", kind: "video", arch: "wan22", negative: "blurry, low quality, distorted, deformed, static, watermark, text" },
];
/** The starters every install before 2.90.0 already had — see seedStarters.
 *  PINNED (2.113.1): this used to be "every image starter in the code", which
 *  made a pre-2.90.1 stamp swallow every starter added since (SDXL, Pony,
 *  Illustrious, FLUX Fill inpaint never appeared on such an install). */
const LEGACY_STARTER_NAMES = () => [
  "FLUX.2 9B (verified)", "FLUX.2 9B edit (verified)", "FLUX.2 Klein 9B",
  "FLUX.2 Klein 9B base", "FLUX.2 Klein 9B edit",
];

/* 2.547.0 (Tim: "the krea2 style is gone, please add them back"): starters seeded AGAIN, once per tag, when their
   file is missing (a deleted starter normally stays deleted - its name is in the stamp). The tag goes in the stamp. */
const RESEED = [
  { tag: "reseed:2.547.0:krea2", names: ["Krea 2 Turbo", "Krea 2 Raw", "Krea 2 Turbo GGUF", "Krea 2 Raw GGUF"] },
];
/** the built-in styles whose file is not there (of one kind, or all) -> [names] (pure over the folder) */
function missingStarters(dir, kind) {
  const out = [];
  for (const st of STARTER_STYLES) {
    const style = normalize(st, null);
    if (kind && style.kind !== kind) continue;
    if (fs.existsSync(fileFor(kindDir(dir, style.kind), style.name)) || fs.existsSync(fileFor(dir, style.name))) continue;
    out.push(style.name);
  }
  return out;
}
/** 2.547.0: write the built-in styles that are missing (only these names when given; never overwrites) -> [made] */
function restoreStarters(dir, names, kind) {
  const want = Array.isArray(names) && names.length ? new Set(names.map(String)) : null;
  const made = [];
  try {
    fs.mkdirSync(dir, { recursive: true });
    for (const name of missingStarters(dir, kind)) {
      if (want && !want.has(name)) continue;
      const st = STARTER_STYLES.find((x) => normalize(x, null).name === name);
      if (!st) continue;
      writeStyle(dir, normalize(st, null)); made.push(name);
    }
  } catch { /* a folder we cannot write: nothing made */ }
  return made;
}

function seedStarters(dir) {
  // EACH STARTER ONCE, recorded by NAME in a stamp file — not "whenever the
  // folder looks empty". Seeding on emptiness means deleting every style
  // resurrects them all on the next read, which is the opposite of what
  // deleting something means. Called explicitly at startup (lib/core.js), so
  // read() stays a pure listing.
  //
  // WHY BY NAME (2.90.1): the stamp used to be a single "seeded once" mark,
  // so a starter ADDED in a later release — the MiniMax Music3 style — never
  // reached an install that already had the mark. Tim's Music tab was empty
  // and he asked for the style to be created. Now the stamp lists what was
  // seeded; anything not in the list is seeded exactly once, and a deleted
  // starter stays deleted because its name stays in the list. A pre-2.90.1
  // stamp (an ISO date, not JSON) means every image starter of that era.
  try {
    fs.mkdirSync(dir, { recursive: true });
    const stamp = path.join(dir, ".starters");
    let seen = null;
    if (fs.existsSync(stamp)) {
      try { seen = JSON.parse(fs.readFileSync(stamp, "utf8")); } catch { seen = null; }
      if (!Array.isArray(seen)) seen = LEGACY_STARTER_NAMES();
    }
    seen = seen || [];
    const made = [];
    for (const st of STARTER_STYLES) {
      const style = normalize(st, null);
      if (seen.includes(style.name)) continue;                 // seeded before
      seen.push(style.name);
      // never overwrite: the user's file may sit in the kind folder or (pre-2.110) the root
      if (fs.existsSync(fileFor(kindDir(dir, style.kind), style.name)) || fs.existsSync(fileFor(dir, style.name))) continue;
      writeStyle(dir, style);
      made.push(style.name);
    }
    for (const r of RESEED) {                                   // 2.547.0: once per tag, the missing ones again
      if (seen.includes(r.tag)) continue;
      seen.push(r.tag);
      for (const n of restoreStarters(dir, r.names)) if (!made.includes(n)) made.push(n);
    }
    fs.writeFileSync(stamp, JSON.stringify(seen, null, 2) + "\n");
    return made;
  } catch { return []; }   // a folder we cannot seed is not one to fail on
}

/**
 * Every style in the folder, optionally of one `kind`.
 *
 * ONE FOLDER FOR BOTH KINDS, filtered on read rather than split into two
 * folders: the name-uniqueness rule is per folder, so "Cinematic" cannot be
 * both an image style and a music style — which is what you want, since the
 * prompt dock names a style by its name alone. The kind lives INSIDE the file,
 * so a file dropped in by hand is classified by its own content.
 */
/* ONE FOLDER PER KIND (2.110.0, Tim: "keep the video styles in styles\video
   and image styles will go in styles\image"): styles/image, styles/video,
   styles/music. A file still in the root (pre-2.110) is moved into its kind's
   folder the first time it is read. `_file` is the path RELATIVE to `dir`. */
const kindDir = (dir, kind) => path.join(dir, KINDS.includes(kind) ? kind : "image");

/** Video styles REMOVED from the app (2.291.0, Tim: "remove the ovpm
 *  timeline, we will use our timeline docker"). An install that adopted
 *  one keeps the file; read() just never lists it. */
const REMOVED_STYLES = ["OBVPM_Timeline"];

function read(dir, kind) {
  const out = [];
  try {
    fs.mkdirSync(dir, { recursive: true });
    migrateLegacy(dir);
    for (const k of KINDS) fs.mkdirSync(path.join(dir, k), { recursive: true });
    const entries = [];                                   // [relative file, absolute path]
    for (const f of fs.readdirSync(dir)) {
      if (!f.toLowerCase().endsWith(".json") || f === LEGACY_FILE) continue;
      entries.push([f, path.join(dir, f), true]);       // legacy root file
    }
    for (const k of KINDS)
      for (const f of fs.readdirSync(path.join(dir, k)))
        if (f.toLowerCase().endsWith(".json")) entries.push([path.join(k, f), path.join(dir, k, f), false]);
    for (const [rel, abs, legacy] of entries) {
      const stem = path.basename(rel).slice(0, -5);
      try {
        const s = JSON.parse(fs.readFileSync(abs, "utf8"));
        if (!s || typeof s !== "object") continue;
        // A hand-written file may have no id and no name; fall back to the
        // filename for both so it is still usable rather than invisible.
        const style = normalize({ ...s, name: s.name || stem },
                                { id: str(s.id) || idForFile(stem) });
        let file = rel;
        if (legacy) {
          // move it into its kind's folder; on a name clash the folder copy wins
          const target = path.join(kindDir(dir, style.kind), path.basename(rel));
          try {
            if (!fs.existsSync(target)) fs.renameSync(abs, target); else fs.unlinkSync(abs);
            file = path.join(style.kind, path.basename(rel));
            if (fs.existsSync(target) && entries.some((e) => e[1] === target)) continue;   // already listed
          } catch { /* leave it where it is */ }
        }
        style._file = file;
        if (kind && style.kind !== kind) continue;
        // 2.291.0: a REMOVED style never lists (its file stays on disk)
        if (style.kind === "video" && REMOVED_STYLES.includes(style.name)) continue;
        if (out.some((o) => o.id === style.id)) continue;
        out.push(style);
      } catch { /* skip this one file */ }
    }
  } catch { return []; }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function writeStyle(dir, style) {
  const d = kindDir(dir, style.kind);
  fs.mkdirSync(d, { recursive: true });
  const { _file, ...body } = style;
  fs.writeFileSync(fileFor(d, style.name), JSON.stringify(body, null, 2));
  return style;
}

/**
 * Create or update.
 *
 * Throws an Error with `code = "duplicate-name"` when the name is already
 * taken by a DIFFERENT style — see the header for why that is refused rather
 * than resolved silently.
 */
function save(dir, raw) {
  const existing = read(dir);
  const id = str((raw || {}).id);
  const prev = id ? existing.find((s) => s.id === id) || null : null;
  const style = normalize(raw, prev);

  const clash = existing.find((s) => s.id !== style.id && s.kind === style.kind
    && fileStem(s.name).toLowerCase() === fileStem(style.name).toLowerCase());
  if (clash) {
    const e = new Error(`a style called "${clash.name}" already exists — `
      + "styles are saved as styles/<kind>/<name>.json, so names have to be unique");
    e.code = "duplicate-name";
    throw e;
  }

  // A rename MOVES the file. Without this the old name would linger as a
  // second, stale style file and the dropdown would show the style twice.
  const rel = path.join(style.kind, fileStem(style.name) + ".json");
  if (prev && prev._file && prev._file !== rel) {
    try { fs.unlinkSync(path.join(dir, prev._file)); } catch {}
  }
  writeStyle(dir, style);
  style._file = rel;
  return style;
}

function remove(dir, id) {
  const styles = read(dir);
  const hit = styles.find((s) => s.id === id);
  if (!hit) return null;
  try { fs.unlinkSync(path.join(dir, hit._file)); } catch { return null; }
  return read(dir);
}

/** Per-render LoRA weight overrides (2.93.0): `map` is { "<lora path>": w }
 *  from the Basic-Settings sliders. Returns the SAME style object when the
 *  map changes nothing (unknown paths, same weights, no loras), and a shallow
 *  copy with a new loras array when it does — callers can compare by
 *  identity. Weights clamp to the same -4..4 the style editor uses, and 0 is
 *  a legitimate weight (numOrNull, never truthiness). */
function applyLoraWeights(style, map) {
  if (!style || !map || typeof map !== "object" || Array.isArray(map)) return style;
  if (!Array.isArray(style.loras) || !style.loras.length) return style;
  let changed = false;
  const loras = style.loras.map((l) => {
    const w = numOrNull(map[l.path]);
    if (w === null) return l;
    const c = Math.max(-4, Math.min(4, w));
    if (c === l.weight) return l;
    changed = true;
    return { ...l, weight: c };
  });
  return changed ? { ...style, loras } : style;
}

function byId(dir, id) {
  return read(dir).find((s) => s.id === id) || null;
}

module.exports = { WEIGHT_DTYPES, VIDEO_ROLES,
  REMOVED_STYLES,
  catalogue, archs, archById, archIds,
  KINDS, kindOf, musicCatalogue, musicArchs, musicArchById, musicArchIds,
  videoCatalogue, videoArchs, videoArchById, videoArchIds, kindDir, VIDEO_RES, VIDEO_ASPECTS,
  VIDEO_SAGE_MODES, VIDEO_SPECTRUM_MODES, VIDEO_VEDA_MODES,
  catalogueFor, archFor, archIdsFor,
  normalize, missingSlots, imageSlots, modelKinds, MODEL_KEY_CATEGORY,
  numOrNull, numOr, newId,
  read, save, remove, byId, applyLoraWeights, writeStyle, fileStem, fileFor, idForFile,
  STARTER_STYLES, LEGACY_STARTER_NAMES, seedStarters, RESEED, missingStarters, restoreStarters,
};
