"use strict";
/**
 * comfyModels.js — THE list of model files ComfyUI can actually load (2.71.0).
 *
 * WHAT THIS IS FOR. In comfy mode a style's model / VAE / text-encoder / LoRA
 * fields are not paths on this machine: they are the strings from ComfyUI's own
 * dropdowns, resolved inside ComfyUI's OWN models folders. Typing one by hand
 * is how you get "Value not in list" with no idea why — the 2.12.x saga in
 * HANDOVER.md is several rounds of exactly that. So the Settings → Image fields
 * are populated from the real folders instead of being free text.
 *
 * TWO SOURCES, BOTH REQUIRED:
 *   1. <comfy dir>/models/<category>            the default tree
 *   2. <comfy dir>/extra_model_paths.yaml       every extra search path
 * Reading only the first would hide the models of anyone who keeps a shared
 * library elsewhere — which is most people with more than one UI installed, and
 * is the entire reason that file exists.
 *
 * WHY NOT ASK COMFYUI OVER HTTP (/object_info gives the literal dropdown
 * lists)? Because that only answers while ComfyUI is running, and Settings is
 * exactly where you configure things BEFORE starting it. The folder scan is
 * also what Tim asked for. The cost is that this mirrors ComfyUI's folder
 * conventions rather than observing them, so CATEGORIES below is a place that
 * can rot — see the note on it.
 *
 * THE NAME IS THE VALUE. What goes in the style field is the path RELATIVE to
 * the search root, extension kept, subfolder kept — that is what ComfyUI's
 * dropdown holds. It is built with the SERVER's path separator on purpose:
 * ComfyUI derives its names with os.path.relpath on the same machine, so on
 * Windows its dropdown values contain backslashes and a forward-slash string
 * will not match its combo validation.
 *
 * THIS MODULE NEVER THROWS. It runs behind a Settings dialog that must still
 * open when the ComfyUI folder is unset, missing, unreadable, or when the yaml
 * is malformed. Everything it could not do comes back in `warnings`, which the
 * UI shows, because a silently empty dropdown is indistinguishable from
 * "you own no models".
 */
const fs = require("fs");
const path = require("path");

/**
 * Canonical category -> the keys ComfyUI accepts for it.
 *
 * The aliases are not decoration. ComfyUI renamed `unet` to `diffusion_models`
 * and `clip` to `text_encoders` and kept BOTH working, so a real yaml in the
 * wild uses either, often listing them together under one block scalar. A
 * scanner that knew only the new names would silently miss half of a working
 * install.
 *
 * DELIBERATELY NOT EXHAUSTIVE: this is the set the image styles can address
 * (model / VAE / text encoder / LoRA), plus the few neighbours worth showing.
 * ComfyUI's folder_paths.py has many more (classifiers, photomaker, ipadapter,
 * whatever a custom node registered). Adding one here is a one-line change; the
 * point is that this file is the ONE place it goes.
 */
const CATEGORIES = {
  checkpoints: ["checkpoints"],
  diffusers: ["diffusers"],
  diffusion_models: ["diffusion_models", "unet"],
  vae: ["vae"],
  text_encoders: ["text_encoders", "clip"],
  loras: ["loras"],
  clip_vision: ["clip_vision"],
  controlnet: ["controlnet"],
  style_models: ["style_models"],
  upscale_models: ["upscale_models"],
  embeddings: ["embeddings"],
  // 2.312.0: the MMH3 Ultimate Upscale pack's 3D latent upscalers
  latent_upscale_models: ["latent_upscale_models"],
  // 2.322.0: Impact-Subpack's face / hand detectors (bbox/face_yolov8m.pt)
  ultralytics: ["ultralytics"],
};

/**
 * Categories whose entries are DIRECTORIES, not files, keyed by the marker file
 * that identifies one.
 *
 * `diffusers` is the odd one out and getting it wrong would be invisible until
 * a render failed. A diffusers model is a FOLDER — model_index.json plus
 * unet/, vae/, text_encoder/ subfolders — and ComfyUI's DiffusersLoader builds
 * its dropdown by walking for `model_index.json` and offering the RELATIVE
 * DIRECTORY. Listing the .safetensors files inside one would offer
 * "sdxl/unet/diffusion_pytorch_model.safetensors", which is a real file and a
 * value ComfyUI will never accept.
 */
const DIR_CATEGORIES = { diffusers: "model_index.json" };

/**
 * Which categories a style's Model field may draw from, in menu order.
 * Served to the UI so the dropdown and this file cannot disagree.
 *
 * All three are legitimate answers to "what model does this workflow load",
 * and which one applies is decided by the workflow's loader node, not by the
 * user: scripts/comfy_image.py MODEL_KEYS accepts ckpt_name, unet_name,
 * model_name AND model_path. One dropdown over all three means nobody has to
 * know which kind of loader their graph happens to use.
 */
const MODEL_CATEGORIES = ["checkpoints", "diffusers", "diffusion_models"];

/**
 * ComfyUI's own supported_pt_extensions, plus the two that custom loaders add
 * (.gguf for the GGUF nodes, .onnx for upscalers). Taken from ComfyUI rather
 * than invented: a file it will not load has no business in a dropdown, and a
 * file it WILL load must not be missing from one.
 */
const MODEL_EXT = new Set([".ckpt", ".pt", ".pt2", ".bin", ".pth",
                           ".safetensors", ".pkl", ".sft", ".gguf", ".onnx"]);

const MAX_DEPTH = 6;          // deep enough for models/loras/flux/style/x.sft
const MAX_FILES = 4000;       // per category; a guard, not a policy

/* ------------------------------------------------------------------ yaml */
/**
 * Parse the SUBSET of YAML that extra_model_paths.yaml actually uses.
 *
 * WHY NOT A YAML LIBRARY: this project has exactly two runtime dependencies
 * (express, multer) and installs on a machine that may be offline. Pulling in a
 * parser to read a dozen lines of `key: value` would be the largest dependency
 * in the tree. The subset is small and fixed by ComfyUI's own example file:
 *
 *   group:                       <- top level, indent 0
 *       base_path: D:/AI/        <- scalar
 *       is_default: true
 *       checkpoints: models/checkpoints/
 *       text_encoders: |         <- block scalar, one path per line
 *           models/text_encoders/
 *           models/clip/         # legacy location still supported
 *
 * WHAT IT HANDLES BEYOND THE OBVIOUS, each because a real file in the wild does
 * it: quoted values (`is_default: "true"`), Windows values with backslashes and
 * a trailing separator, trailing `#` comments INCLUDING on block-scalar lines,
 * `|-` / `|+` chomping indicators, CRLF, and tabs used as indentation.
 *
 * WHAT IT DOES NOT HANDLE, and says so rather than guessing: flow sequences
 * (`loras: [a, b]`), anchors, multiple documents. Those get reported as a
 * warning; they do not silently produce a wrong path.
 */
function parseExtraPaths(text) {
  const groups = {};
  const warnings = [];
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");

  // A '#' only starts a comment at line start or after whitespace — otherwise a
  // path containing '#' would be truncated.
  const strip = (s) => {
    const m = s.match(/(^|\s)#/);
    return (m ? s.slice(0, m.index + (m[1] ? m[1].length : 0)) : s);
  };
  const indentOf = (s) => {
    // tabs count as one column; we only ever COMPARE indents, never measure them
    let n = 0;
    while (n < s.length && (s[n] === " " || s[n] === "\t")) n++;
    return n;
  };
  const unquote = (s) => {
    const t = s.trim();
    if (t.length > 1 && ((t[0] === '"' && t.endsWith('"')) || (t[0] === "'" && t.endsWith("'"))))
      return t.slice(1, -1);
    return t;
  };

  let group = null, groupIndent = 0;
  let block = null, blockIndent = -1;   // the key currently collecting a scalar

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const ind = indentOf(raw);
    const bare = strip(raw).trim();

    // inside a block scalar: any line indented deeper than the key belongs to it
    if (block) {
      if (raw.trim() === "") continue;
      if (ind > blockIndent) {
        if (bare) groups[group][block].push(bare);
        continue;
      }
      block = null;                     // dedented: the block ended
    }
    if (!bare) continue;
    if (bare.startsWith("---") || bare.startsWith("%")) continue;   // doc markers

    const colon = bare.indexOf(":");
    if (colon < 0) { warnings.push(`line ${i + 1}: not a key: value pair, ignored`); continue; }
    const key = bare.slice(0, colon).trim();
    let val = bare.slice(colon + 1).trim();

    if (!group || ind <= groupIndent) {
      // a top-level key. With a value it is a stray scalar outside any group,
      // which is the single most common way this file is written WRONG (see
      // ComfyUI issue #11404) — say so instead of ignoring it.
      if (val) {
        warnings.push(`"${key}" sits at the top level; ComfyUI needs it nested `
                      + `under a group name such as "comfyui:"`);
        continue;
      }
      group = key; groupIndent = ind;
      groups[group] = groups[group] || {};
      continue;
    }
    groups[group] = groups[group] || {};
    if (val.startsWith("[") || val.startsWith("{")) {
      warnings.push(`"${group}.${key}": inline lists are not supported here, ignored`);
      continue;
    }
    if (val === "|" || /^[|>][-+]?$/.test(val)) {
      groups[group][key] = [];
      block = key; blockIndent = ind;
      continue;
    }
    val = unquote(val);
    groups[group][key] = val === "" ? [] : [val];
  }
  return { groups, warnings };
}

/** "true"/true/1/yes -> true. is_default arrives quoted in real files. */
function truthy(v) {
  const s = String(Array.isArray(v) ? v[0] : v || "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "on";
}

/**
 * Every search directory per canonical category.
 * Returns [{ dir, category, source }] — source is "models" for the default tree
 * or "yaml:<group>", which the UI shows so a surprising file can be traced back
 * to the line that added it.
 */
function searchRoots(comfyDirAbs, opts) {
  const o = opts || {};
  const out = [];
  const warnings = [];
  const seen = new Set();
  const add = (dir, category, source, first) => {
    if (!dir) return;
    let abs;
    try { abs = path.resolve(dir); } catch { return; }
    const key = category + "\u0000" + abs.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const entry = { dir: abs, category, source, exists: false };
    try { entry.exists = fs.statSync(abs).isDirectory(); } catch { entry.exists = false; }
    if (first) out.unshift(entry); else out.push(entry);
  };

  // 1. the default tree
  if (comfyDirAbs) {
    for (const [cat, aliases] of Object.entries(CATEGORIES))
      for (const a of aliases)
        add(path.join(comfyDirAbs, "models", a), cat, "models");
  }

  // 2. extra_model_paths.yaml
  const yamlPath = o.yamlPath || findYaml(comfyDirAbs, o.extraPaths);
  if (yamlPath) {
    let text = null;
    try { text = fs.readFileSync(yamlPath, "utf8"); }
    catch (e) { warnings.push(`could not read ${path.basename(yamlPath)}: ${e.message}`); }
    if (text != null) {
      const { groups, warnings: w } = parseExtraPaths(text);
      for (const x of w) warnings.push(`${path.basename(yamlPath)}: ${x}`);
      for (const [gname, g] of Object.entries(groups)) {
        let base = (g.base_path || [])[0] || "";
        base = expandHome(base);
        // a relative base_path is resolved against the yaml's own folder, which
        // is the only anchor that makes sense for a file you can point at with
        // --extra-model-paths-config from anywhere
        if (base && !path.isAbsolute(base)) base = path.resolve(path.dirname(yamlPath), base);
        const first = truthy(g.is_default);
        for (const [cat, aliases] of Object.entries(CATEGORIES)) {
          for (const a of aliases) {
            for (const v of g[a] || []) {
              let p = expandHome(String(v).replace(/[\\/]+$/, ""));
              if (!p) continue;
              if (!path.isAbsolute(p)) p = base ? path.join(base, p) : path.resolve(path.dirname(yamlPath), p);
              add(p, cat, `yaml:${gname}`, first);
            }
          }
        }
      }
    }
  }
  return { roots: out, warnings, yamlPath };
}

function expandHome(p) {
  const s = String(p || "").trim();
  if (s === "~" || s.startsWith("~/") || s.startsWith("~\\"))
    return path.join(require("os").homedir(), s.slice(1));
  return s;
}

/** extra_model_paths.yaml (or .yml) beside main.py, or null. */
/**
 * Every place an extra_model_paths.yaml could be, in the order ComfyUI itself
 * would find one. Exported so the UI can SHOW them: "is it reading my yaml"
 * is not a question anybody should have to answer by inference.
 *
 * ComfyUI reads exactly ONE (the default beside main.py, or whatever
 * --extra-model-paths-config points at), so this loads only the first match too.
 * Loading all of them would list models the running ComfyUI cannot see, which
 * is the "Value not in list" failure this whole area keeps producing. The rest
 * are reported as `also_found` so a second copy is visible rather than silently
 * losing to the first.
 *
 * `override` is engine.comfy.extra_paths from the config — the answer when
 * ComfyUI is launched with --extra-model-paths-config and the file is somewhere
 * this cannot guess.
 */
function yamlCandidates(comfyDirAbs, override) {
  const out = [];
  const add = (p) => { if (p && !out.includes(p)) out.push(p); };
  if (override) add(path.resolve(expandHome(override)));
  for (const n of ["extra_model_paths.yaml", "extra_model_paths.yml"]) {
    if (comfyDirAbs) add(path.join(comfyDirAbs, n));
    // ComfyUI Desktop keeps its copy in the per-user data folder, not beside
    // main.py, so a Desktop install would otherwise look like "no yaml at all"
    const home = (() => { try { return require("os").homedir(); } catch { return ""; } })();
    if (process.env.APPDATA) add(path.join(process.env.APPDATA, "ComfyUI", n));
    if (home) {
      add(path.join(home, ".config", "ComfyUI", n));
      add(path.join(home, "Library", "Application Support", "ComfyUI", n));
    }
  }
  return out;
}

function findYaml(comfyDirAbs, override) {
  for (const p of yamlCandidates(comfyDirAbs, override)) {
    try { if (fs.statSync(p).isFile()) return p; } catch { /* next */ }
  }
  return null;
}

/**
 * Files under `root`, named the way ComfyUI names them: relative to the root,
 * FORWARD SLASHES, extension and subfolder kept.
 *
 * The separator is not cosmetic. ComfyUI matches these combo values exactly, and
 * 2.71.0 shipped a version of this that used the platform separator on the
 * reasoning that ComfyUI derives its own names with os.path.relpath. That
 * reasoning was wrong in practice — a real render died with
 * "Value not in list [unet_name] = flux_klein_9B\model.safetensors" while the
 * file sat exactly where it should (fixed in 2.72.0). Only names with a
 * SUBFOLDER can carry the bug, which is why it took a nested model to expose it.
 */
function listFiles(root, acc, warnings, marker) {
  const walk = (dir, depth) => {
    if (depth > MAX_DEPTH || acc.length >= MAX_FILES) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (e) { warnings.push(`${dir}: ${e.code || e.message}`); return; }
    /* DIRECTORY MODE (diffusers). A folder holding the marker IS the entry, and
       we stop there: descending would list the sub-models inside a diffusers
       model as if they were models of their own. Named with relpath from the
       root exactly as DiffusersLoader does — including "." when the search path
       itself is a diffusers model, which is what ComfyUI would offer. */
    if (marker) {
      if (entries.some((e) => e.isFile() && e.name === marker)) {
        const rel = entryName(root, dir) || ".";
        acc.push({ name: rel, folder: folderOf(rel), size: 0, dir: true });
        return;
      }
      for (const e of entries) {
        if (acc.length >= MAX_FILES) return;
        if (e.name.startsWith(".")) continue;
        if (e.isDirectory()) walk(path.join(dir, e.name), depth + 1);
      }
      return;
    }
    for (const e of entries) {
      if (acc.length >= MAX_FILES) return;
      if (e.name.startsWith(".")) continue;          // .git, .cache, dotfiles
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full, depth + 1); continue; }
      if (!e.isFile()) continue;
      if (!MODEL_EXT.has(path.extname(e.name).toLowerCase())) continue;
      const rel = entryName(root, full);
      let size = 0;
      try { size = fs.statSync(full).size; } catch { /* raced */ }
      acc.push({ name: rel, folder: folderOf(rel), size });
    }
  };
  walk(root, 0);
}

/** The subfolder part of a ComfyUI name; "" for a file loose in the root. */
/**
 * THE NAME OF ONE ENTRY, spelled the way ComfyUI would spell it.
 *
 * ComfyUI builds a combo value with `os.path.relpath`, so on Windows the value
 * contains BACKSLASHES: `flux_klein_9B\\model.safetensors`. This scan used to
 * force forward slashes, which meant a style saved while ComfyUI was NOT
 * running held a name ComfyUI's validator rejects — for a file sitting right
 * there in the folder. Combo validation is an exact string match, so a
 * separator is not cosmetic here.
 *
 * `sep` is a parameter because the whole bug is platform-specific and the test
 * suite runs on Linux, where the native separator is already "/" and a
 * regression would be invisible. test-comfymodels.js exercises both.
 *
 * The DERIVED folder key stays normalised to "/" in folderOf() — that one is a
 * grouping label, not a value anybody validates.
 *
 * The yaml's own slashes are irrelevant: the name is relative to the search
 * root, so the root's spelling never appears in it.
 */
const entryName = (root, full, sep = path.sep) =>
  path.relative(root, full).split(path.sep).join(sep);

/**
 * The subfolder part of an entry's name, for the folder-filter dropdowns.
 *
 * BOTH SEPARATORS, and this is not defensive coding — it is the bug. The FOLDER
 * SCAN emits forward slashes (2.72.0), but ComfyUI's own /object_info on
 * Windows returns names built with os.path.relpath, so they contain
 * BACKSLASHES: "flux_klein_9B\model.safetensors". Splitting on "/" alone gave
 * every live entry a folder of "", so on Windows the filter dropdowns listed
 * nothing at all the moment ComfyUI became the authoritative source — with 190
 * checkpoints and 433 LoRAs sitting in subfolders.
 *
 * The result is normalised to forward slashes because it is only a GROUPING KEY
 * and a label. Without that, a category fed by both sources would show the same
 * folder twice, once per spelling. The ENTRY NAME is never touched: that has to
 * stay byte-identical to whatever ComfyUI said, or it fails combo validation.
 */
function folderOf(name) {
  const s = String(name || "");
  const i = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\"));
  return i < 0 ? "" : s.slice(0, i).replace(/\\/g, "/");
}

/**
 * The whole picture for the UI.
 *
 * { ok, dir, dir_exists, yaml, categories: { <cat>: { roots:[], folders:[],
 *   files:[{name, folder, size, root, source}] } }, warnings: [] }
 *
 * `folders` is the distinct subfolder list for that category, which is what the
 * folder filter dropdowns are built from. "" means "loose in the root" and the
 * UI labels it as such rather than showing a blank option.
 */
function scan(comfyDir, opts) {
  const o = opts || {};
  const res = { ok: false, dir: comfyDir || "", dir_exists: false, yaml: null,
                categories: {}, warnings: [] };
  try {
    const dirAbs = comfyDir ? path.resolve(comfyDir) : "";
    res.dir = dirAbs;
    try { res.dir_exists = !!dirAbs && fs.statSync(dirAbs).isDirectory(); } catch { res.dir_exists = false; }

    const { roots, warnings, yamlPath } = searchRoots(dirAbs, o);
    res.yaml = yamlPath || null;
    // every place one COULD be, and which of them exist — so "is it reading my
    // yaml" is answerable by looking rather than by inference
    res.yaml_candidates = yamlCandidates(dirAbs, o.extraPaths).map((p) => {
      let exists = false;
      try { exists = fs.statSync(p).isFile(); } catch {}
      return { path: p, exists, used: p === yamlPath };
    });
    res.yaml_also_found = res.yaml_candidates
      .filter((c) => c.exists && !c.used).map((c) => c.path);
    if (res.yaml_also_found.length)
      res.warnings.push(
        "more than one extra_model_paths file exists; ComfyUI reads one, and "
        + `this used ${yamlPath}. Others: ${res.yaml_also_found.join(", ")}`);
    res.warnings.push(...warnings);

    for (const cat of Object.keys(CATEGORIES))
      res.categories[cat] = { roots: [], folders: [], files: [] };

    for (const r of roots) {
      const c = res.categories[r.category];
      c.roots.push({ dir: r.dir, source: r.source, exists: r.exists });
      if (!r.exists) continue;
      const acc = [];
      listFiles(r.dir, acc, res.warnings, DIR_CATEGORIES[r.category]);
      for (const f of acc) c.files.push({ ...f, root: r.dir, source: r.source });
    }

    for (const c of Object.values(res.categories)) {
      // Two roots can legitimately hold the same relative name (a shared
      // library plus the default tree). ComfyUI shows ONE entry and resolves it
      // by search order, so showing two identical strings would be a menu with
      // two indistinguishable rows.
      const seen = new Set();
      c.files = c.files.filter((f) => {
        const k = f.name.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k); return true;
      });
      c.files.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      c.folders = [...new Set(c.files.map((f) => f.folder))]
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    }
    res.ok = true;
    if (!dirAbs)
      res.warnings.push("No ComfyUI folder is set — Settings → ComfyUI → Folder.");
    else if (!res.dir_exists)
      res.warnings.push(`The ComfyUI folder does not exist: ${dirAbs}`);
    return res;
  } catch (e) {
    res.warnings.push(String(e.message || e));
    return res;
  }
}

/**
 * ASK COMFYUI INSTEAD OF MIRRORING IT.
 *
 * Everything above derives what ComfyUI's dropdown *should* contain from its
 * folder conventions. That is a mirror, and 2.72.0 is the record of a mirror
 * being wrong: a scan that found the file, named it the way the code reasoned
 * ComfyUI would, and produced a value ComfyUI rejected. The list ComfyUI serves
 * from /object_info is not a mirror — it IS the dropdown, including anything a
 * custom node registered and any folder convention that changes tomorrow.
 *
 * So the live list WINS whenever ComfyUI is reachable, and the folder scan is
 * the fallback for the case that made the scan necessary in the first place:
 * Settings is where you configure things BEFORE ComfyUI is running.
 *
 * One small request per loader class rather than the whole /object_info, which
 * is several megabytes on an install with many custom nodes.
 */
const LIVE_CLASSES = {
  checkpoints: [["CheckpointLoaderSimple", "ckpt_name"]],
  // DiffusersLoader's dropdown holds DIRECTORIES, which is why diffusers is its
  // own category rather than being folded into checkpoints: a live list from
  // CheckpointLoaderSimple would not contain them, and the live-wins merge
  // would then erase every diffusers model the folder scan found.
  diffusers: [["DiffusersLoader", "model_path"]],
  diffusion_models: [["UNETLoader", "unet_name"]],
  vae: [["VAELoader", "vae_name"]],
  text_encoders: [["CLIPLoader", "clip_name"], ["DualCLIPLoader", "clip_name1"]],
  loras: [["LoraLoader", "lora_name"]],
  clip_vision: [["CLIPVisionLoader", "clip_name"]],
  controlnet: [["ControlNetLoader", "control_net_name"]],
  style_models: [["StyleModelLoader", "style_model_name"]],
  upscale_models: [["UpscaleModelLoader", "model_name"]],
  embeddings: [],
  latent_upscale_models: [["MMH3LatentUpscaleWithModelParams", "model_name"]],   // 2.312.0
  ultralytics: [["UltralyticsDetectorProvider", "model_name"]],                 // 2.322.0
};

/** Pull the combo list out of an /object_info/<Class> answer, or null. */
function comboFrom(body, cls, key) {
  try {
    const spec = ((((body || {})[cls] || {}).input || {}).required || {})[key]
              || ((((body || {})[cls] || {}).input || {}).optional || {})[key];
    // 2.280.0: all three /object_info spec generations (the same family
    // that emptied the converted loaders) — classic [list], modern
    // ["COMBO", {options}], and OBJECT-form {type: "COMBO", options}.
    let list = null;
    if (Array.isArray(spec)) {
      if (Array.isArray(spec[0])) list = spec[0];
      else if (spec[1] && typeof spec[1] === "object")
        list = spec[1].options || spec[1].values || null;
    } else if (spec && typeof spec === "object") {
      list = spec.options || spec.values || null;
    }
    if (!Array.isArray(list)) return null;
    return list.filter((x) => typeof x === "string");
  } catch { return null; }
}

/**
 * The literal dropdown contents, per category, straight from ComfyUI.
 * Resolves to { categories: {cat: [names]}, warnings: [] }; an unreachable or
 * unhappy ComfyUI yields empty categories and a warning, never a throw.
 */
async function liveLists(url, opts) {
  const o = opts || {};
  const fetchFn = o.fetch || (typeof fetch === "function" ? fetch : null);
  const out = { categories: {}, warnings: [] };
  if (!url || !fetchFn) return out;
  const base = String(url).replace(/\/$/, "");
  for (const [cat, pairs] of Object.entries(LIVE_CLASSES)) {
    const names = [];
    for (const [cls, key] of pairs) {
      try {
        const r = await fetchFn(`${base}/object_info/${cls}`,
                                { signal: AbortSignal.timeout(o.timeout || 4000) });
        if (!r.ok) continue;
        const list = comboFrom(await r.json(), cls, key);
        if (list) for (const n of list) if (!names.includes(n)) names.push(n);
      } catch (e) {
        // one class failing is not the others failing; a custom-node install
        // can be missing DualCLIPLoader and still have CLIPLoader
        out.warnings.push(`${cls}: ${e.name === "TimeoutError" ? "timed out" : (e.message || e)}`);
      }
    }
    if (names.length) out.categories[cat] = names;
  }
  return out;
}

/**
 * scan() plus the live lists, merged. THIS is what the endpoint serves.
 *
 * Live wins per category — a name ComfyUI does not offer cannot be selected,
 * however certain the folder scan is that the file exists. The folder scan still
 * supplies size and which root a name came from, so the browser can still show
 * where a file lives and which yaml group put it there.
 */
async function list(comfyDir, url, opts) {
  const res = scan(comfyDir, opts);
  res.source = "folders";
  let live = { categories: {}, warnings: [] };
  try { live = await liveLists(url, opts); }
  catch (e) { res.warnings.push(String(e.message || e)); }
  const gotAny = Object.keys(live.categories).length > 0;
  if (!gotAny) {
    if (url) res.warnings.push(
      "ComfyUI is not answering, so this list comes from the model folders. "
      + "Start ComfyUI and rescan to see exactly what its dropdowns hold.");
    return res;
  }
  res.source = "comfyui";
  /* KEEP THE DISK LISTING TOO. The live list REPLACES the scan below, and that
     loses the one distinction that matters when something is refused: a name
     ComfyUI does not offer might not exist at all, or might be sitting on disk
     in a folder ComfyUI searches while ComfyUI simply has not noticed it —
     which is what happens when a LoRA is added after ComfyUI started, since it
     caches its filename lists. Those two need completely different advice, and
     without this the refusal has to guess. Names only; the files themselves are
     already in the answer. */
  res.disk = {};
  for (const [cat, c] of Object.entries(res.categories))
    res.disk[cat] = (c.files || []).map((f) => f.name);
  for (const [cat, names] of Object.entries(live.categories)) {
    /* Cross-reference live names against the scan to recover each entry's size
       and which root it came from. The key must be SEPARATOR-NORMALISED: the
       scan emits "flux/grain.safetensors" and ComfyUI on Windows says
       "flux\\grain.safetensors", so keying on the raw name silently matched
       nothing for every entry in a subfolder — size 0, root blank, the 📁
       browser unable to say which yaml group a model came from. */
    const key = (n) => String(n).replace(/\\/g, "/").toLowerCase();
    const known = new Map(((res.categories[cat] || {}).files || [])
                            .map((f) => [key(f.name), f]));
    res.categories[cat] = res.categories[cat] || { roots: [], folders: [], files: [] };
    res.categories[cat].files = names.map((n) => {
      const m = known.get(key(n));
      return { name: n, folder: folderOf(n), size: m ? m.size : 0,
               root: m ? m.root : "", source: m ? m.source : "comfyui" };
    });
    res.categories[cat].files.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    res.categories[cat].folders = [...new Set(res.categories[cat].files.map((f) => f.folder))]
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }
  return res;
}

module.exports = { scan, list, liveLists, comboFrom, searchRoots, parseExtraPaths,
                   entryName,
                   findYaml, yamlCandidates, truthy, folderOf,
                   CATEGORIES, DIR_CATEGORIES, MODEL_CATEGORIES, MODEL_EXT,
                   LIVE_CLASSES };
