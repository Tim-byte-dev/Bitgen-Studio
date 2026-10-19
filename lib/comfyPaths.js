/* extra_model_paths.yaml management (2.223.11, by instruction: Settings →
 * ComfyUI → Folders — "let the user add folders for base folder, diffusion
 * models, checkpoints, vae, text encoders, controlnet etc ... this will be
 * added to the comfyui extramodelpaths.yaml file if it is not in the file
 * already").
 *
 * The file lives next to ComfyUI's main.py. Everything bitGen writes sits in
 * ONE top-level `bitgen:` section — the rest of the file (a user's own
 * comfyui: section, a1111 blocks, comments) is preserved verbatim. A path
 * that already appears ANYWHERE in the file — whoever put it there — is
 * SKIPPED, per the instruction, and reported as such. No yaml dependency:
 * the two-level subset this file needs is parsed and emitted by hand, with
 * values double-quoted so Windows drive colons and backslashes survive. */
"use strict";
const fs = require("fs");
const path = require("path");
const comfy = require("./comfy");

/* The standard model folders of ComfyUI's own extra_model_paths.yaml.example
 * (plus text_encoders, the newer name clip aliases). Auto-add fills exactly
 * these, relative to the chosen base. */
const TYPES = ["checkpoints", "diffusion_models", "vae", "text_encoders",
               "clip", "clip_vision", "controlnet", "loras", "embeddings",
               "upscale_models", "configs"];

function yamlFile() {
  // resolve the launchable ComfyUI root the same way custom-node install
  // does: cfg dir (or discovery), then the folder that holds main.py
  const dir = (comfy.comfyCfg().dir || "").trim();
  if (!dir) return null;
  const core = require("./core");
  const dirAbs = path.isAbsolute(dir) ? dir : path.join(core.BASE, dir);
  for (const c of [path.join(dirAbs, "ComfyUI"), dirAbs])
    if (fs.existsSync(path.join(c, "main.py")))
      return path.join(c, "extra_model_paths.yaml");
  return null;
}

const norm = (p) => String(p || "").trim().replace(/[\\/]+/g, "/")
  .replace(/\/$/, "").toLowerCase();

function parseOwn(text) {
  const m = /^bitgen:[ \t]*\r?\n((?:[ \t]+.*(?:\r?\n|$))*)/m.exec(text);
  const out = { base_path: "", entries: {} };
  if (!m) return out;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^[ \t]+([A-Za-z_]+):[ \t]*(.*)$/.exec(line);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith('"') && v.endsWith('"'))
      v = v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    if (kv[1] === "base_path") out.base_path = v;
    else if (kv[1] === "is_default") { /* kept on emit */ }
    else out.entries[kv[1]] = v;
  }
  return out;
}

function emitOwn(state) {
  const q = (v) => '"' + String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  const lines = ["bitgen:"];
  if (state.base_path) lines.push("  base_path: " + q(state.base_path));
  lines.push("  is_default: true");
  for (const t of Object.keys(state.entries).sort())
    if (state.entries[t]) lines.push("  " + t + ": " + q(state.entries[t]));
  return lines.join("\n") + "\n";
}

function read() {
  const file = yamlFile();
  if (!file) return { error: "no ComfyUI install configured or discovered", types: TYPES };
  let text = "";
  try { text = fs.readFileSync(file, "utf8"); } catch { /* not created yet */ }
  const own = parseOwn(text);
  return { file, exists: !!text, base_path: own.base_path,
           entries: own.entries, types: TYPES };
}

/** Merge, never clobber: only the keys given change; "" deletes a key; a
 *  path already anywhere in the file is skipped and named. */
function save(input) {
  const file = yamlFile();
  if (!file) return { error: "no ComfyUI install configured or discovered" };
  let text = "";
  try { text = fs.readFileSync(file, "utf8"); } catch { /* fresh file */ }
  const own = parseOwn(text);
  const foreign = text.replace(/^bitgen:[ \t]*\r?\n(?:[ \t]+.*(?:\r?\n|$))*/m, "");
  const skipped = [], written = [];
  const b = input || {};
  if (b.base_path !== undefined) own.base_path = String(b.base_path || "").trim();
  /* "if it is not in the file already" — WHOLE-VALUE comparison, resolved
     against base_paths (a bare "checkpoints" is NOT "already there" just
     because some other section's absolute path happens to END in the same
     word — substring matching false-skipped exactly that in testing). */
  const isAbs = (v) => /^([A-Za-z]:|[\\/])/.test(v);
  const resolved = (base, v) => isAbs(v) || !base ? norm(v) : norm(base + "/" + v);
  const fBases = [""], fVals = [];
  for (const line of foreign.split(/\r?\n/)) {
    const kv = /^[ \t]+([A-Za-z_]+):[ \t]*(.+)$/.exec(line);
    if (!kv) continue;
    let v = kv[2].trim().replace(/^"|"$/g, "");
    if (!v || v === "|") continue;
    if (kv[1] === "base_path") fBases.push(v);
    else fVals.push(v);
  }
  const foreignSet = new Set();
  for (const v of fVals) for (const fb of fBases) foreignSet.add(resolved(fb, v));
  for (const [t, raw] of Object.entries(b.entries || {})) {
    if (!TYPES.includes(t)) continue;
    const v = String(raw || "").trim();
    if (!v) { delete own.entries[t]; continue; }
    if (own.entries[t] && norm(own.entries[t]) === norm(v)) continue;   // unchanged
    const mine = resolved(own.base_path, v);
    const already = foreignSet.has(mine)
      || Object.values(own.entries).some((x) => resolved(own.base_path, x) === mine);
    if (already) { skipped.push(t); continue; }
    own.entries[t] = v; written.push(t);
  }
  const head = foreign.length && !/\n$/.test(foreign) ? foreign + "\n" : foreign;
  fs.writeFileSync(file, head + emitOwn(own));
  return { ok: true, file, written, skipped,
           base_path: own.base_path, entries: own.entries };
}

module.exports = { TYPES, yamlFile, read, save };
