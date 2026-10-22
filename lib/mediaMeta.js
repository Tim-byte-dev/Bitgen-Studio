// bitGen Studio — lib/mediaMeta.js (2.575.0): WHAT A PICTURE / VIDEO / SONG WAS MADE WITH - its prompt, seed, cfg, steps.
//
// Tim: "add images, sound or video of the model and example prompts or metadata from the image/video/music ... add a
// button for the prompt from metadata to send to prompt - this will use the seed, cfg and steps of the image/video/music
// (do this for gallery, assets and reference too)".
// Where it comes from, the first that answers:
//   job        a render of THIS app - lib/jobMeta.findByOutput (the job in memory, jobs.info, a scene's take)
//   png        PNG text chunks (tEXt / iTXt / zTXt): ComfyUI's "prompt" (the API graph its SaveImage writes) -> the
//              sampler's seed / steps / cfg / sampler and the positive / negative text; A1111 / Forge "parameters"
//   tags       a video's / song's container tags (ffprobe): comment / description / prompt / parameters - A1111 text,
//              a ComfyUI graph as JSON, or plain words (the prompt)
// Answer: {prompt, negative, seed, cfg, steps, sampler, model, width, height, from} - only what was found.
//   read(absPath) -> meta | null          lookup({src, name}) -> {meta, from} | null (src: output | images | video | sound)
//   resolve(src, name) -> an absolute path inside the project (never outside it) | ""
// Pure (scripts/test-modelmedia575.js): pngText(buf), fromA1111(text), fromComfy(graph), fromTags(tags).
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const num = (v) => (v === "" || v == null || !Number.isFinite(+v) ? null : +v);
const clip = (s, n) => String(s == null ? "" : s).slice(0, n || 4000);

/** a PNG's text chunks -> {key: text} (pure) */
function pngText(buf) {
  const out = {};
  if (!buf || buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) return out;
  let p = 8;
  while (p + 8 <= buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString("latin1", p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (p + 12 + len > buf.length) break;
    try {
      if (type === "tEXt") { const z = d.indexOf(0); if (z > 0) out[d.toString("latin1", 0, z)] = d.toString("latin1", z + 1); }
      else if (type === "zTXt") { const z = d.indexOf(0); if (z > 0) out[d.toString("latin1", 0, z)] = zlib.inflateSync(d.subarray(z + 2)).toString("latin1"); }
      else if (type === "iTXt") {
        const z = d.indexOf(0); if (z > 0) {
          const key = d.toString("latin1", 0, z), comp = d[z + 1];
          let q = z + 3; const z2 = d.indexOf(0, q); q = z2 + 1; const z3 = d.indexOf(0, q); q = z3 + 1;
          const body = d.subarray(q);
          out[key] = (comp ? zlib.inflateSync(body) : body).toString("utf8");
        }
      }
    } catch { /* a broken chunk - the rest still reads */ }
    if (type === "IEND") break;
    p += 12 + len;
  }
  return out;
}

/** A1111 / Forge "parameters": the prompt, "Negative prompt: …", then "Steps: 20, Sampler: …, CFG scale: 7, Seed: 1, Size: 512x768, Model: …" (pure) */
function fromA1111(text) {
  const t = String(text || "").replace(/\r/g, "");
  if (!/(^|\n)Steps:\s*\d+/.test(t)) return null;
  const i = t.search(/(^|\n)Steps:\s*\d+/);
  const head = t.slice(0, i), tail = t.slice(i).trim();
  const n = head.search(/(^|\n)Negative prompt:/);
  const prompt = (n >= 0 ? head.slice(0, n) : head).trim();
  const negative = n >= 0 ? head.slice(n).replace(/^\n?Negative prompt:\s*/, "").trim() : "";
  const kv = {};
  for (const m of tail.matchAll(/([A-Za-z][A-Za-z0-9 _-]*):\s*("(?:[^"\\]|\\.)*"|[^,]*)/g)) kv[m[1].trim().toLowerCase()] = m[2].trim().replace(/^"|"$/g, "");
  const size = /^(\d+)x(\d+)$/.exec(kv.size || "");
  return clean({ prompt, negative, seed: num(kv.seed), cfg: num(kv["cfg scale"]), steps: num(kv.steps), sampler: kv.sampler || "",
                 model: kv.model || "", width: size ? +size[1] : null, height: size ? +size[2] : null, from: "a1111" });
}

const SAMPLER_CLASS = /KSampler|SamplerCustom|BasicScheduler|RandomNoise|BasicGuider|CFGGuider|KSamplerSelect/;
/** a ComfyUI API graph (its "prompt" chunk) -> the numbers + the words (pure, a best reading: the sampler's inputs;
 *  the positive text is the text its positive conditioning was encoded from, else the longest prompt-like text) */
function fromComfy(g) {
  if (!g || typeof g !== "object") return null;
  const nodes = Object.entries(g).filter(([, v]) => v && typeof v === "object" && v.inputs);
  if (!nodes.length) return null;
  const get = (id) => g[String(id)];
  const lit = (x) => (Array.isArray(x) ? null : x);
  // a value through a link: a Primitive* node's value, else the literal
  const val = (x, depth) => {
    if (!Array.isArray(x)) return x;
    const n = get(x[0]); if (!n || (depth || 0) > 4) return null;
    const ins = n.inputs || {};
    for (const k of ["value", "seed", "noise_seed", "int", "float", "string", "text"]) if (k in ins) return val(ins[k], (depth || 0) + 1);
    return null;
  };
  const textOf = (link, depth) => {
    if (!Array.isArray(link) || (depth || 0) > 6) return typeof link === "string" ? link : "";
    const n = get(link[0]); if (!n) return "";
    const ins = n.inputs || {};
    for (const k of ["text", "prompt", "text_g", "string", "value", "positive"]) {
      const v = ins[k];
      if (typeof v === "string" && v.trim()) return v;
      if (Array.isArray(v)) { const t = textOf(v, (depth || 0) + 1); if (t) return t; }
    }
    for (const k of ["conditioning", "conditioning_1", "conditioning_to", "positive"]) if (Array.isArray(ins[k])) { const t = textOf(ins[k], (depth || 0) + 1); if (t) return t; }
    return "";
  };
  const out = { from: "comfy" };
  for (const [, n] of nodes) {
    const c = String(n.class_type || ""), ins = n.inputs;
    if (!SAMPLER_CLASS.test(c) && !/Sampler/.test(c)) continue;
    const seed = val(ins.seed != null ? ins.seed : ins.noise_seed);
    if (out.seed == null && num(seed) != null) out.seed = num(seed);
    if (out.steps == null && num(val(ins.steps)) != null) out.steps = num(val(ins.steps));
    if (out.cfg == null && num(val(ins.cfg)) != null) out.cfg = num(val(ins.cfg));
    if (!out.sampler && typeof lit(ins.sampler_name) === "string") out.sampler = ins.sampler_name;
    if (!out.prompt && Array.isArray(ins.positive)) out.prompt = textOf(ins.positive);
    if (!out.negative && Array.isArray(ins.negative)) out.negative = textOf(ins.negative);
    if (!out.prompt && Array.isArray(ins.conditioning)) out.prompt = textOf(ins.conditioning);
  }
  if (!out.prompt) {
    // H3 and friends: the generator node holds the prompt itself (MiniMaxH3ReferenceToVideo.prompt) - the longest one
    let best = "";
    for (const [, n] of nodes) for (const k of ["prompt", "text", "text_g"]) {
      const v = n.inputs[k], t = typeof v === "string" ? v : Array.isArray(v) ? textOf(v) : "";
      if (t.length > best.length && !/^[\w./\\-]+\.(safetensors|gguf|ckpt|pt|png|jpg|wav|mp4)$/i.test(t)) best = t;
    }
    if (best) out.prompt = best;
  }
  for (const [, n] of nodes) {
    const ins = n.inputs;
    if (!out.model && typeof ins.ckpt_name === "string") out.model = ins.ckpt_name;
    if (!out.model && typeof ins.unet_name === "string") out.model = ins.unet_name;
    if (out.width == null && num(lit(ins.width)) && num(lit(ins.height))) { out.width = +ins.width; out.height = +ins.height; }
  }
  const c = clean(out);
  return c.prompt || c.seed != null || c.steps != null ? c : null;
}

/** a container's tags (ffprobe format.tags + stream tags) -> meta (pure) */
function fromTags(tags) {
  const t = {};
  for (const [k, v] of Object.entries(tags || {})) t[String(k).toLowerCase()] = String(v == null ? "" : v);
  for (const k of ["parameters", "comment", "description", "prompt", "synopsis", "lyrics"]) {
    const v = (t[k] || "").trim(); if (!v) continue;
    if (/^[{[]/.test(v)) {
      try { const j = JSON.parse(v); const m = fromComfy(j.prompt && typeof j.prompt === "object" ? j.prompt : j) || (j.prompt && typeof j.prompt === "string" ? clean({ prompt: j.prompt, seed: num(j.seed), cfg: num(j.cfg), steps: num(j.steps), from: "tags" }) : null); if (m) return Object.assign(m, { from: "tags" }); } catch { /* not JSON */ }
    }
    const a = fromA1111(v); if (a) return Object.assign(a, { from: "tags" });
    if (k === "prompt" || k === "description" || k === "comment") return clean({ prompt: v, seed: num(t.seed), cfg: num(t.cfg), steps: num(t.steps), from: "tags" });
  }
  return null;
}
function clean(m) {
  const o = {};
  for (const [k, v] of Object.entries(m || {})) {
    if (v == null || v === "" || (typeof v === "number" && !Number.isFinite(v))) continue;
    o[k] = typeof v === "string" ? clip(v, k === "prompt" || k === "negative" ? 4000 : 300) : v;
  }
  return o;
}

/** a file -> its meta (png chunks, else container tags) | null */
function read(abs) {
  let fd = null;
  try {
    const st = fs.statSync(abs);
    if (!st.isFile()) return null;
    if (/\.png$/i.test(abs)) {
      const buf = fs.readFileSync(abs);
      const tx = pngText(buf);
      if (tx.prompt) { try { const m = fromComfy(JSON.parse(tx.prompt)); if (m) return m; } catch { /* not a graph */ } }
      if (tx.parameters) { const m = fromA1111(tx.parameters); if (m) return m; }
      for (const k of ["Description", "Comment", "description", "comment"]) if (tx[k]) { const m = fromTags({ [k]: tx[k] }); if (m) return Object.assign(m, { from: "png" }); }
      return null;
    }
    if (/\.(mp4|webm|mov|mkv|m4v|mp3|flac|ogg|opus|m4a|wav|aac)$/i.test(abs)) {
      const r = require("child_process").spawnSync("ffprobe", ["-v", "error", "-show_entries", "format_tags:stream_tags", "-of", "json", abs], { encoding: "utf8", timeout: 15000, windowsHide: true });
      let j = {}; try { j = JSON.parse(r.stdout || "{}"); } catch { j = {}; }
      const tags = Object.assign({}, ...((j.streams || []).map((s) => s.tags || {})), (j.format || {}).tags || {});
      return fromTags(tags);
    }
    return null;
  } catch { return null; } finally { if (fd != null) try { fs.closeSync(fd); } catch { /* fine */ } }
}

const KINDS = { images: "images", image: "images", video: "video", sound: "sound", audio: "sound" };
/** a project file -> its absolute path (only inside the project's folders) */
function resolve(src, name) {
  const core = require("./core");
  const b = path.basename(String(name || ""));
  if (!b) return "";
  if (src === "output" || src === "gallery") {
    for (const d of core.outputDirs()) { const p = path.join(d, b); if (fs.existsSync(p)) return p; }
    return "";
  }
  const k = KINDS[String(src || "")];
  if (!k) return "";
  const p = path.join(core.pDir(k), b);
  return fs.existsSync(p) ? p : "";
}
/** {src, name} -> {meta, from, source?} | null - this app's own job record first, then the file */
function lookup(o) {
  const name = path.basename(String((o && o.name) || ""));
  if (!name) return null;
  try {
    const hit = require("./jobMeta").findByOutput(name);
    if (hit && hit.meta) {
      const m = hit.meta;
      const meta = clean({ prompt: m.prompt, negative: m.negative, seed: num(m.seed), cfg: num(m.cfg), steps: num(m.steps), sampler: m.sampler,
                           model: Array.isArray(m.models) && m.models.length ? (typeof m.models[0] === "string" ? m.models[0] : m.models[0] && m.models[0].name) : m.model,
                           width: num(m.width), height: num(m.height), mode: m.mode || hit.mode });
      // a job record without the prompt (jobs.info keeps 400 chars) - the file may hold all of it
      const p = resolve(o.src || "output", name);
      const f = p ? read(p) : null;
      if (f && f.prompt && (!meta.prompt || f.prompt.length > meta.prompt.length)) meta.prompt = f.prompt;
      return { meta, from: "job", job: hit.id || null };
    }
  } catch { /* no job */ }
  const p = resolve(o.src || "output", name);
  const m = p ? read(p) : null;
  return m ? { meta: m, from: m.from || "file" } : null;
}

module.exports = { pngText, fromA1111, fromComfy, fromTags, read, resolve, lookup, clean };
