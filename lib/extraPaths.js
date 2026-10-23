/* bitGen Studio — lib/extraPaths.js (2.580.0): the 🧩 Model manager's 📁 Model paths tab - EVERY group of ComfyUI's
 * extra_model_paths.yaml, not only the `bitgen:` one Settings ▸ ComfyUI ▸ Folders writes (lib/comfyPaths.js).
 * Tim: "in modelmanager add a tab with comfyui extra model paths listed, allow user to add new group of paths and
 * chenge individual paths and delete a group of paths - group of paths will be other_ui<n> etc".
 *
 *   read()                         {file, exists, mtime, also_found[], groups: [{name, base_path, base_abs, is_default,
 *                                   paths: [{key, value, abs, exists}], managed}], keys[], next, warnings[]}
 *   addGroup({base_path, name})    a new group other_ui<n> (the first free n); its paths filled from the folders that
 *                                  exist under base_path (models/checkpoints …), else checkpoints + loras
 *   saveGroup({name, rename, base_path, is_default, paths: [{key, value}], mtime})
 *                                  ONE group rewritten in place - every other group, comment and blank line of the file
 *                                  stays byte for byte; several rows with the same key are written as a `|` block
 *   deleteGroup({name, mtime})     that group's lines removed
 * Each write keeps the previous file as extra_model_paths.yaml.bak and is refused (409) when the file changed on disk
 * since it was read (`mtime`). Which file: the one ComfyUI reads (lib/comfyModels.findYaml - the engine.comfy.extra_paths
 * override, beside main.py, the per-user data folder); none yet -> beside main.py. Pure helpers exported for the tests:
 * groupRanges, emitGroup, scalar, nextName, fillFrom. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");

const KNOWN_KEYS = ["checkpoints", "diffusion_models", "unet", "vae", "text_encoders", "clip", "clip_vision", "loras",
  "controlnet", "embeddings", "upscale_models", "latent_upscale_models", "style_models", "diffusers", "gligen",
  "hypernetworks", "photomaker", "vae_approx", "model_patches", "audio_encoders", "ultralytics", "configs", "custom_nodes"];
const KEY_RE = /^[A-Za-z0-9_]+$/;
const NAME_RE = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$/;
const INDENT = "    ";

/* ---------------------------------------------------------------- pure */
const lines = (text) => String(text || "").replace(/\r\n?/g, "\n").split("\n");
const indentOf = (s) => { let n = 0; while (n < s.length && (s[n] === " " || s[n] === "\t")) n++; return n; };
const isBlankOrComment = (s) => { const t = s.trim(); return !t || t[0] === "#"; };

/** each top-level group's line range: [{name, start, end}] (end exclusive; trailing blank / comment lines belong to
 *  whatever follows them, so deleting a group never eats the next group's heading comment) */
function groupRanges(text) {
  const L = lines(text), out = [];
  let cur = null, lastContent = -1;
  for (let i = 0; i < L.length; i++) {
    const s = L[i];
    if (isBlankOrComment(s)) continue;
    if (indentOf(s) === 0) {
      if (cur) { cur.end = lastContent + 1; out.push(cur); cur = null; }
      const m = /^([^:#\s][^:#]*?)\s*:\s*(#.*)?$/.exec(s);
      if (m) cur = { name: m[1].replace(/^["']|["']$/g, ""), start: i, end: i + 1 };
      lastContent = i;
      continue;
    }
    lastContent = i;
  }
  if (cur) { cur.end = lastContent + 1; out.push(cur); }
  return out;
}

/** one path value the way YAML (ComfyUI's yaml.safe_load) and lib/comfyModels.parseExtraPaths both read back
 *  unchanged: plain when it is safe, else single-quoted; null = needs a `|` block (it holds a ' itself) */
function scalar(v) {
  const s = String(v);
  const plain = s && s === s.trim() && !/^[-?:,[\]{}#&*!|>'"%@`]/.test(s) && !/: |\s#|:$/.test(s)
    && !/^(true|false|yes|no|on|off|null|~)$/i.test(s) && !/^[-+.\d]/.test(s);
  if (plain) return s;
  if (s.indexOf("'") < 0) return "'" + s + "'";
  return null;
}

/** a group's text: name, base_path, is_default, then the keys in the order first met (several values = a `|` block) */
function emitGroup(name, g) {
  const out = [name + ":"];
  const bp = String(g.base_path || "").trim();
  if (bp) { const q = scalar(bp); out.push(INDENT + "base_path: " + (q == null ? "|\n" + INDENT + INDENT + bp : q)); }
  if (g.is_default) out.push(INDENT + "is_default: true");
  const order = [], by = {};
  for (const p of g.paths || []) {
    const k = String(p.key || "").trim(), v = String(p.value || "").trim();
    if (!k || !v) continue;
    if (!by[k]) { by[k] = []; order.push(k); }
    if (by[k].indexOf(v) < 0) by[k].push(v);
  }
  for (const k of order) {
    const vs = by[k], q = vs.length === 1 ? scalar(vs[0]) : null;
    if (q != null) out.push(INDENT + k + ": " + q);
    else { out.push(INDENT + k + ": |"); for (const v of vs) out.push(INDENT + INDENT + v); }
  }
  return out.join("\n");
}

/** the first free other_ui<n> (n from 1) */
function nextName(names) {
  const have = new Set((names || []).map((n) => String(n).toLowerCase()));
  for (let n = 1; ; n++) if (!have.has("other_ui" + n)) return "other_ui" + n;
}

/** the paths of a new group: the standard folders that exist under base (models/<key> or <key>), else the two most
 *  people add one for. `exists` is injectable for the tests. */
function fillFrom(base, exists) {
  const ex = exists || ((p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } });
  const out = [];
  if (base) {
    for (const k of KNOWN_KEYS) {
      if (k === "custom_nodes" || k === "unet" || k === "clip") continue;   // the old names - their new ones are listed
      if (ex(path.join(base, "models", k))) out.push({ key: k, value: "models/" + k });
      else if (ex(path.join(base, k))) out.push({ key: k, value: k });
    }
    // an A1111 / Forge install keeps its checkpoints + LoRAs under these names
    if (!out.some((p) => p.key === "checkpoints") && ex(path.join(base, "models", "Stable-diffusion"))) out.push({ key: "checkpoints", value: "models/Stable-diffusion" });
    if (!out.some((p) => p.key === "loras") && ex(path.join(base, "models", "Lora"))) out.push({ key: "loras", value: "models/Lora" });
  }
  if (!out.length) out.push({ key: "checkpoints", value: "models/checkpoints" }, { key: "loras", value: "models/loras" });
  return out;
}

/* ---------------------------------------------------------------- the file */
let deps = null;   // the tests point these at a fixture
function D() {
  if (deps) return deps;
  const core = require("./core"), comfyModels = require("./comfyModels"), comfyPaths = require("./comfyPaths");
  return {
    where() {
      const c = (core.getConfig().engine || {}).comfy || {};
      const dirAbs = c.dir ? core.resolvePath(c.dir) : "";
      const cands = comfyModels.yamlCandidates(dirAbs, c.extra_paths || "");
      const found = comfyModels.findYaml(dirAbs, c.extra_paths || "");
      const fallback = c.extra_paths ? path.resolve(c.extra_paths) : (comfyPaths.yamlFile() || (dirAbs ? path.join(dirAbs, "extra_model_paths.yaml") : null));
      return { file: found || fallback, also: cands.filter((p) => p !== found && (() => { try { return fs.statSync(p).isFile(); } catch { return false; } })()) };
    },
    parse: (t) => comfyModels.parseExtraPaths(t),
    changed() { try { require("./modelCards").invalidate(); } catch { /* fine */ } },
  };
}
function setDeps(d) { deps = d; }

const expandHome = (p) => { const s = String(p || "").trim(); return s === "~" || /^~[\\/]/.test(s) ? path.join(os.homedir(), s.slice(1)) : s; };
const stamp = (f) => { try { return Math.round(fs.statSync(f).mtimeMs); } catch { return 0; } };

function load() {
  const w = D().where();
  if (!w.file) return { error: "no ComfyUI install configured or discovered - set the ComfyUI folder in Settings ▸ ComfyUI" };
  let text = "", exists = false;
  try { text = fs.readFileSync(w.file, "utf8"); exists = true; } catch { /* not made yet */ }
  return { w, text, exists };
}

function read() {
  const l = load(); if (l.error) return l;
  const { groups, warnings } = D().parse(l.text);
  const dir = path.dirname(l.w.file);
  const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
  const out = groupRanges(l.text).filter((r) => groups[r.name]).map((r) => {
    const g = groups[r.name];
    const bp = (g.base_path || [])[0] || "";
    let base = expandHome(bp);
    if (base && !path.isAbsolute(base)) base = path.resolve(dir, base);
    const paths = [];
    for (const [k, vs] of Object.entries(g)) {
      if (k === "base_path" || k === "is_default") continue;
      for (const v of vs) {
        let abs = expandHome(String(v).replace(/[\\/]+$/, ""));
        if (abs && !path.isAbsolute(abs)) abs = base ? path.join(base, abs) : path.resolve(dir, abs);
        paths.push({ key: k, value: v, abs, exists: isDir(abs) });
      }
    }
    return { name: r.name, base_path: bp, base_abs: base, base_exists: !base || isDir(base),
             is_default: /^(true|yes|on|1)$/i.test(String((g.is_default || [])[0] || "")), paths,
             managed: r.name === "bitgen" ? "Settings ▸ ComfyUI ▸ Folders writes this group too" : "" };
  });
  return { file: l.w.file, exists: l.exists, mtime: stamp(l.w.file), also_found: l.w.also, groups: out,
           keys: KNOWN_KEYS, next: nextName(out.map((g) => g.name)), warnings };
}

function guard(l, mtime) {
  if (mtime != null && l.exists && Math.abs(stamp(l.w.file) - Number(mtime)) > 1)
    return { error: "extra_model_paths.yaml changed on disk since this tab read it - it has been read again, make the change once more", status: 409 };
  return null;
}
function write(l, text) {
  fs.mkdirSync(path.dirname(l.w.file), { recursive: true });
  if (l.exists) fs.writeFileSync(l.w.file + ".bak", l.text);
  fs.writeFileSync(l.w.file, text.replace(/\n*$/, "\n"));
  D().changed();
}
/** the file with one group's lines swapped for `block` ("" = removed); a new group goes at the end */
function splice(text, name, block) {
  const L = lines(text), r = groupRanges(text).find((x) => x.name === name);
  if (!r) {
    if (!block) return text;
    const body = L.join("\n").replace(/\s+$/, "");
    return (body ? body + "\n\n" : "") + block + "\n";
  }
  const before = L.slice(0, r.start), after = L.slice(r.end);
  if (!block) {   // removed: drop the blank line it leaves behind too
    while (before.length && !before[before.length - 1].trim() && after.length && !after[0].trim()) after.shift();
    return before.concat(after).join("\n");
  }
  return before.concat(block.split("\n"), after).join("\n");
}

function cleanPaths(name, list) {
  const out = [];
  for (const p of list || []) {
    const k = String((p || {}).key || "").trim(), v = String((p || {}).value || "").trim();
    if (!k && !v) continue;
    if (!KEY_RE.test(k)) return { error: `"${k || "(empty)"}" is not a folder type - letters, digits and _ only (checkpoints, loras …)` };
    if (k === "base_path" || k === "is_default") return { error: `${k} has its own field` };
    if (!v) return { error: `${k} has no path` };
    if (/[\r\n]/.test(v)) return { error: `${k}: one path per row` };
    out.push({ key: k, value: v });
  }
  if (name === "bitgen") {
    const seen = {};
    for (const p of out) { if (seen[p.key]) return { error: "the bitgen group takes one path per folder type (Settings ▸ ComfyUI ▸ Folders reads it)" }; seen[p.key] = 1; }
  }
  return { paths: out };
}

function addGroup(b) {
  const o = b || {};
  const l = load(); if (l.error) return l;
  const g = guard(l, o.mtime); if (g) return g;
  const names = groupRanges(l.text).map((r) => r.name);
  const name = String(o.name || "").trim() || nextName(names);
  if (!NAME_RE.test(name)) return { error: `"${name}" is not a group name - letters, digits, _ . - only` };
  if (names.some((n) => n.toLowerCase() === name.toLowerCase())) return { error: `there already is a group "${name}"` };
  const base = String(o.base_path || "").trim();
  if (/[\r\n]/.test(base)) return { error: "base_path: one line" };
  let abs = expandHome(base);
  if (abs && !path.isAbsolute(abs)) abs = path.resolve(path.dirname(l.w.file), abs);
  const paths = Array.isArray(o.paths) ? cleanPaths(name, o.paths) : { paths: fillFrom(abs) };
  if (paths.error) return paths;
  write(l, splice(l.text, name, emitGroup(name, { base_path: base, is_default: !!o.is_default, paths: paths.paths })));
  return { ok: true, name, ...read() };
}

function saveGroup(b) {
  const o = b || {};
  const l = load(); if (l.error) return l;
  const g = guard(l, o.mtime); if (g) return g;
  const name = String(o.name || "").trim();
  const names = groupRanges(l.text).map((r) => r.name);
  if (!names.includes(name)) return { error: `no group "${name}" in the file`, status: 404 };
  const to = String(o.rename || "").trim() || name;
  if (!NAME_RE.test(to)) return { error: `"${to}" is not a group name - letters, digits, _ . - only` };
  if (to !== name && names.some((n) => n.toLowerCase() === to.toLowerCase())) return { error: `there already is a group "${to}"` };
  const base = String(o.base_path || "").trim();
  if (/[\r\n]/.test(base)) return { error: "base_path: one line" };
  const paths = cleanPaths(to, o.paths); if (paths.error) return paths;
  write(l, splice(l.text, name, emitGroup(to, { base_path: base, is_default: !!o.is_default, paths: paths.paths })));
  return { ok: true, name: to, ...read() };
}

function deleteGroup(b) {
  const o = b || {};
  const l = load(); if (l.error) return l;
  const g = guard(l, o.mtime); if (g) return g;
  const name = String(o.name || "").trim();
  if (!groupRanges(l.text).some((r) => r.name === name)) return { error: `no group "${name}" in the file`, status: 404 };
  write(l, splice(l.text, name, ""));
  return { ok: true, deleted: name, ...read() };
}

module.exports = { read, addGroup, saveGroup, deleteGroup, setDeps, KNOWN_KEYS,
                   groupRanges, emitGroup, scalar, nextName, fillFrom, splice };
