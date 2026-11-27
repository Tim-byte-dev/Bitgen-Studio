/* bitGen Studio — lib/platoKeys.js (3.4.0): BASIC SETTINGS ▸ TEXT ENCODER - A LIGHTER ENCODER FOR A STYLE (PlatoKeys).
 * Tim (verbatim): "we can add it, and add a text encoder dropdown in basic settings to overide the models own. when we overide
 * the text encoder for our local llm it will automatically use the plato workflows. top option will be styles own. if it works
 * for some videos/images and makes it faster it will be good to have"
 *   PlatoKeys (github.com/Nynxz/ComfyUI-PlatoKeys, Apache-2.0; keys at huggingface.co/nynxz/PlatoKeys) are small linear maps
 *   from one text encoder's hidden states into another's: a Qwen3.5-2B can stand in for MOSS-Image's Qwen3.5-9B or Krea 2's
 *   Qwen3-VL-4B, and a key Tim made maps it onto MiniMax H3's Qwen3-VL-32B (his PlatosKeyPatchCLIP workflows).
 *   The list (GET /api/platokeys - routes/platoKeys.js): the text encoders the ComfyUI renders go to has (its CLIPLoader's
 *   clip_name list) that a key in its models/plato_keys maps onto a style family (lib/platoKeys.json), with those families.
 *   The pick travels with a render in the X-Bitgen-Sampler header (static/samplerset.js -> lib/samplers.js -> the job's
 *   BITGEN_TEXT_ENCODER) and scripts/plato_keys_apply.py swaps the family's CLIPLoader for it + a Patch CLIP (Plato Key)
 *   node in the graph the worker sends. A style with no key for the pick keeps its own encoder (said in the job's log).
 * Pure (scripts/test-3400.js; scripts/test-platokeys3400.py checks the Python side gives the same answers):
 *   norm(name), parseKey(name) -> {name, family, source, comfy, official} | null, familyOfLoader(clipName, type),
 *   fits(encoder, key), pickKey(keys, encoder, familyId), nodeFor(key, lists), optionsOf(info)
 */
"use strict";
const RULES = require("./platoKeys.json");
const SKIP = new RegExp(RULES.skip, "i");

/** a file name -> letters and digits only (folder, extension, "_4layer" dropped) (pure) */
function norm(name) {
  let b = String(name || "").split(/[\\/]/).pop().toLowerCase();
  b = b.replace(/\.(safetensors|gguf|sft|pt|bin)$/, "").replace(/_\d+layers?/g, "");
  return b.replace(/[^a-z0-9]/g, "");
}
/** a key file -> what it maps (pure); null = not a key bitGen picks (ablations, metrics, another family) */
function parseKey(name) {
  const full = String(name || "");
  if (!/\.safetensors$/i.test(full) || SKIP.test(full.toLowerCase())) return null;
  const b = full.split(/[\\/]/).pop().toLowerCase().replace(/\.safetensors$/, "");
  let src = "", tgt = b;
  const official = b.includes("_to_");
  if (official) { src = b.slice(0, b.indexOf("_to_")); tgt = b.slice(b.indexOf("_to_") + 4); }
  else { const m = /^.*(?:ridge|_pk)_(.+)$/.exec(b); src = m ? m[1] : ""; }
  const comfy = /_comfy$/.test(src);
  if (comfy) src = src.replace(/_comfy$/, "");
  const fam = RULES.families.find((f) => f.target.some((t) => norm(tgt).includes(norm(t))));
  if (!fam || !norm(src)) return null;
  return { name: full, family: fam.id, source: norm(src), comfy, official };
}
/** which family a style's text encoder loader belongs to (pure) -> family | null */
function familyOfLoader(clipName, type) {
  const n = String(clipName || "").toLowerCase(), t = String(type || "").toLowerCase();
  return RULES.families.find((f) => f.types.includes(t) && new RegExp(f.native, "i").test(n)) || null;
}
/** an encoder file is a key's source (pure): "qwen3.5_2b_bf16" fits "qwen35_2b_…" (not "qwen3.5_20b") */
function fits(encoder, key) {
  const k = typeof key === "string" ? parseKey(key) : key;
  if (!k) return false;
  const e = norm(encoder);
  return new RegExp("(?<![0-9])" + k.source + "(?![0-9])").test(e);
}
/** the key for an encoder on a family (pure): a stock-ComfyUI-calibrated one first, then the shortest name */
function pickKey(keys, encoder, familyId) {
  const c = (keys || []).map(parseKey).filter((k) => k && k.family === familyId && fits(encoder, k));
  c.sort((a, b) => (b.comfy - a.comfy) || (a.name.length - b.name.length) || a.name.localeCompare(b.name));
  return c.length ? c[0].name : "";
}
/** which node applies a key (pure): "official" (plato_keys.Load + plato_keys.PatchCLIP) | "fearn" (PlatosKeyPatchCLIP) | "" */
function nodeFor(key, lists) {
  const L = lists || {}, k = parseKey(key) || {};
  const off = (L.keys || []).includes(key) && L.official, fe = (L.fearnKeys || []).includes(key) && L.fearn;
  if (!k.official && fe) return "fearn";
  if (off) return "official";
  return fe ? "fearn" : "";
}
/** the Basic Settings list from what ComfyUI has (pure): [{file, families: [id], labels: [label]}] */
function optionsOf(info) {
  const I = info || {}, keys = [...new Set([...(I.official ? I.keys || [] : []), ...(I.fearn ? I.fearnKeys || [] : [])])];
  const out = [];
  for (const file of I.encoders || []) {
    const fams = RULES.families.filter((f) => !new RegExp(f.native, "i").test(String(file)) && pickKey(keys, file, f.id) && nodeFor(pickKey(keys, file, f.id), I));
    if (fams.length) out.push({ file, families: fams.map((f) => f.id), labels: fams.map((f) => f.label) });
  }
  return out;
}

/* ---------------- what the ComfyUI renders go to has */
const { comboOf } = require("./samplers");
let CACHE = null;
async function info(o) {
  const opt = o || {};
  if (CACHE && Date.now() - CACHE.at < 60000 && !opt.refresh) return CACHE.v;
  const f = opt.fetch || fetch;
  const ask = async (u, cls) => {
    try {
      const r = await f(u + "/object_info/" + encodeURIComponent(cls), { signal: AbortSignal.timeout(opt.timeout || 4000), headers: { "User-Agent": "bitGen-Studio" } });
      if (!r.ok) return null;
      const j = await r.json(); return (j && j[cls]) || null;
    } catch { return null; }
  };
  const firstCombo = (n) => { const I = (n && n.input) || {}; for (const sec of [I.required || {}, I.optional || {}]) for (const k of Object.keys(sec)) { const c = comboOf(sec[k]); if (c.length && c.some((x) => /\.safetensors$/i.test(x))) return c; } return []; };
  for (const u0 of (opt.urls || require("./samplers").urls())) {
    const u = String(u0).replace(/\/$/, "");
    const clip = await ask(u, "CLIPLoader");
    if (!clip) continue;
    const req = ((clip.input || {}).required) || {};
    const load = await ask(u, "plato_keys.Load"), patch = await ask(u, "plato_keys.PatchCLIP"), fearn = await ask(u, "PlatosKeyPatchCLIP");
    const v = { online: true, url: u, encoders: comboOf(req.clip_name), types: comboOf(req.type),
      official: !!(load && patch), keys: load ? firstCombo(load) : [], fearn: !!fearn, fearnKeys: fearn ? firstCombo(fearn) : [] };
    CACHE = { at: Date.now(), v }; return v;
  }
  const v = { online: false, encoders: [], types: [], official: false, keys: [], fearn: false, fearnKeys: [] };
  CACHE = { at: Date.now(), v }; return v;
}
/** GET /api/platokeys */
async function options(o) {
  const I = await info(o);
  const list = optionsOf(I);
  const note = !I.online ? "ComfyUI is not answering - start it to see the encoders"
    : !I.official && !I.fearn ? "the PlatoKeys nodes are not in ComfyUI - Settings ▸ Add-ons ▸ 🔑 PlatoKeys (then restart ComfyUI)"
    : !list.length ? "no text encoder here has a key yet - Settings ▸ Add-ons ▸ 🔑 PlatoKeys downloads the keys + Qwen3.5-2B"
    : "";
  return { encoders: list, online: I.online, nodes: I.official || I.fearn, url: I.url || "", note };
}
module.exports = { RULES, norm, parseKey, familyOfLoader, fits, pickKey, nodeFor, optionsOf, info, options };
