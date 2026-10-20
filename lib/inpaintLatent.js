// bitGen Studio — lib/inpaintLatent.js (2.550.0): ANY image style fills a selection SEAMLESSLY - its own text-to-image
// graph with the picture encoded and a noise mask on the latent (what the Krita AI plugin does), not a new picture.
// Tim: "when a selection is made, it generates a new image not a seamless fill/blend like the krita ai does".
//
//   latentMaskGraph(graph) -> a copy where the empty latent (Empty*Latent*) is replaced by
//        LoadImage (the crop) -> VAEEncode (the graph's own VAE) -> SetLatentNoiseMask (LoadImage #2 = the mask PNG,
//        transparent = the selection -> its MASK output, grown a little so the edge blends)
//     and every model input of a sampler / guider goes through DifferentialDiffusion (a soft mask becomes a soft
//     change), or null when the graph has no empty latent, no VAEDecode with a VAE, or LoadImage nodes of its own (their
//     slots would mix with the crop and the mask). Pure - tested (scripts/test-inpaint550.js).
//   2.551.0: the mask is grown and BLURRED (MaskToImage -> ImageBlur -> ImageToMask) - a soft edge for DifferentialDiffusion;
//   the editor pre-fills the selection with the colours around it and Generate runs at aiEdit.FILL_DENOISE (0.9).
//   The two LoadImage nodes get the two lowest ids, crop first: comfy_image.py fills LoadImage slots in id order with the
//   job's images [crop, mask]. Denoise stays the graph's (1.0 = Generate); Refine writes its strength (apply_denoise).
//
//   2.552.0 (Tim sent the Krita AI plugin's source - ai_diffusion/backend/workflow.py inpaint() / refine_region(),
//   model/model.py calc_selection_pre_process()): the mask is grown and feathered by the SELECTION'S SIZE, as there:
//   feather = 10 % of the selection's diagonal (at least 32 px), grow = 4 + feather / 2 - opts {grow, feather} in the
//   render's pixels (the editor computes them, imageedit.js P.maskParams); without opts the old 8 / 12 px.
//   editLatentGraph(graph, opts)  an EDIT model in a selection the way Krita runs one (refine_region with an edit arch):
//        the picture stays the model's reference AND is the starting latent, with the same noise mask + differential
//        diffusion - only the selection changes, everything around it is kept exactly (no regenerated crop that drifts).
//        The picture's own VAEEncode is reused (Qwen Image Edit / Kontext start from it; FLUX.2 / FLUX 3 Klein start
//        from an empty latent of the same size -> the encode of the scaled picture). The graph is renumbered so the
//        picture is "1" and the mask "2": the job's images are [crop, mask, (reference)]. null when it cannot be done.
"use strict";

const isLink = (v) => Array.isArray(v) && v.length === 2 && (typeof v[0] === "string" || typeof v[0] === "number");
const cls = (n) => String((n && n.class_type) || "");

/** the blur for a feather (ImageBlur caps: radius 31, sigma 10) */
function blurFor(opts) {
  const o = opts || {};
  const grow = Number.isFinite(+o.grow) && +o.grow >= 0 ? Math.min(256, Math.round(+o.grow)) : 8;
  const f = Number.isFinite(+o.feather) && +o.feather > 0 ? +o.feather : 24;
  return { grow, radius: Math.max(1, Math.min(31, Math.round(f / 2))), sigma: Math.max(0.5, Math.min(10, Math.round(f / 4 * 10) / 10)) };
}

function latentMaskGraph(graph, opts) {
  if (!graph || typeof graph !== "object") return null;
  const g = JSON.parse(JSON.stringify(graph));
  const ids = Object.keys(g).filter((k) => !k.startsWith("_") && g[k] && typeof g[k] === "object" && g[k].class_type);
  if (ids.some((k) => /loadimage/i.test(cls(g[k])))) return null;
  const empty = ids.filter((k) => /^Empty.*Latent/i.test(cls(g[k])));
  if (!empty.length) return null;
  const dec = ids.find((k) => /^VAEDecode/i.test(cls(g[k])) && isLink((g[k].inputs || {}).vae));
  if (!dec) return null;
  const vae = g[dec].inputs.vae;
  // fresh ids: the two LoadImage nodes must sort FIRST (numeric ids below every other)
  const nums = ids.map((k) => parseInt(k, 10)).filter(Number.isFinite);
  const hi = Math.max(0, ...nums) + 1;
  const lo = Math.min(...nums.concat([hi]));
  if (lo >= 3 && !g["1"] && !g["2"]) return wire(g, ids, empty, vae, "1", "2", hi, opts);
  return renumbered(g, ids, empty, vae, opts);
}
/** the graph's ids shifted up by 2 so "1" / "2" are free for the crop and the mask */
function renumbered(g0, ids0, empty0, vae0, opts) {
  const map = {};
  for (const k of ids0) { const n = parseInt(k, 10); map[k] = Number.isFinite(n) && String(n) === k ? String(n + 2) : k; }
  const re = (v) => (isLink(v) && map[String(v[0])] ? [map[String(v[0])], v[1]] : v);
  const g = {};
  for (const k of Object.keys(g0)) {
    const n = g0[k];
    if (!map[k]) { g[k] = n; continue; }
    const c = JSON.parse(JSON.stringify(n));
    for (const [i, v] of Object.entries(c.inputs || {})) c.inputs[i] = re(v);
    g[map[k]] = c;
  }
  const ids = ids0.map((k) => map[k]), empty = empty0.map((k) => map[k]), vae = re(vae0);
  const hi = Math.max(0, ...ids.map((k) => parseInt(k, 10)).filter(Number.isFinite)) + 1;
  return wire(g, ids, empty, vae, "1", "2", hi, opts);
}
/** the mask chain: LoadImage MASK -> grown -> blurred (soft) -> SetLatentNoiseMask on `samples`; returns the noise id */
function maskChain(g, maskId, samples, nid, opts) {
  const b = blurFor(opts);
  const grow = nid(), toImg = nid(), blur = nid(), toMask = nid(), noise = nid();
  g[grow] = { class_type: "GrowMask", inputs: { mask: [maskId, 1], expand: b.grow, tapered_corners: true } };
  // 2.551.0: a SOFT mask (grown, then blurred) - with DifferentialDiffusion it is a per-pixel strength, so the change fades
  // out at the edge instead of stopping at a line (Krita AI: grow + feather)
  g[toImg] = { class_type: "MaskToImage", inputs: { mask: [grow, 0] } };
  g[blur] = { class_type: "ImageBlur", inputs: { image: [toImg, 0], blur_radius: b.radius, sigma: b.sigma } };
  g[toMask] = { class_type: "ImageToMask", inputs: { image: [blur, 0], channel: "red" } };
  g[noise] = { class_type: "SetLatentNoiseMask", inputs: { samples, mask: [toMask, 0] } };
  return noise;
}
/** DifferentialDiffusion on the model of every sampler / guider (one per model source) */
function addDD(g, ids, nid) {
  const dd = {};
  for (const k of ids) {
    const n = g[k]; if (!n || !/KSampler|Guider|SamplerCustom/i.test(cls(n))) continue;
    const m = (n.inputs || {}).model; if (!isLink(m)) continue;
    if (g[String(m[0])] && cls(g[String(m[0])]) === "DifferentialDiffusion") continue;
    const key = String(m[0]) + ":" + m[1];
    if (!dd[key]) { dd[key] = nid(); g[dd[key]] = { class_type: "DifferentialDiffusion", inputs: { model: m } }; }
    n.inputs.model = [dd[key], 0];
  }
}
function wire(g, ids, empty, vae, crop, mask, hi, opts) {
  let next = hi;
  const nid = () => String(next++);
  g[crop] = { class_type: "LoadImage", inputs: { image: "placeholder.png" }, _meta: { title: "the crop (inpaint)" } };
  g[mask] = { class_type: "LoadImage", inputs: { image: "placeholder.png" }, _meta: { title: "the mask (transparent = fill)" } };
  const enc = nid();
  g[enc] = { class_type: "VAEEncode", inputs: { pixels: [crop, 0], vae } };
  const noise = maskChain(g, mask, [enc, 0], nid, opts);
  const eset = new Set(empty);
  let rewired = 0;
  for (const k of ids) {
    const ins = (g[k] || {}).inputs || {};
    for (const [i, v] of Object.entries(ins)) if (isLink(v) && eset.has(String(v[0]))) { ins[i] = [noise, 0]; rewired++; }
  }
  if (!rewired) return null;
  addDD(g, ids, nid);
  for (const k of empty) delete g[k];                 // nothing reads it now
  return g;
}

/* ---------------- 2.552.0: an EDIT model inside a selection (Krita: refine_region with an edit arch) ---------------- */
const SLOT_ORDER = (a, b) => (/^\d+$/.test(a) ? +a : 1 << 30) - (/^\d+$/.test(b) ? +b : 1 << 30);
const SCALERS = /^(ImageScale|ImageScaleBy|ImageScaleToTotalPixels|FluxKontextImageScale|ImageScaleToMaxDimension|ImageResize)/i;
/** does `link` reach LoadImage `slot` through image scalers only? */
function fromSlot(g, link, slot, depth) {
  if (!isLink(link) || (depth || 0) > 6) return false;
  const k = String(link[0]), n = g[k];
  if (!n) return false;
  if (k === slot) return true;
  if (!SCALERS.test(cls(n))) return false;
  return fromSlot(g, (n.inputs || {}).image || (n.inputs || {}).pixels, slot, (depth || 0) + 1);
}
function editLatentGraph(graph, opts) {
  if (!graph || typeof graph !== "object") return null;
  const g0 = JSON.parse(JSON.stringify(graph));
  const ids0 = Object.keys(g0).filter((k) => !k.startsWith("_") && g0[k] && typeof g0[k] === "object" && g0[k].class_type);
  const slots = ids0.filter((k) => /loadimage/i.test(cls(g0[k]))).sort(SLOT_ORDER);
  if (!slots.length) return null;
  if (ids0.some((k) => /VAEEncodeForInpaint|InpaintModelConditioning|SetLatentNoiseMask/.test(cls(g0[k])))) return null;
  const crop0 = slots[0];
  const encs = ids0.filter((k) => /^VAEEncode$/.test(cls(g0[k])) && fromSlot(g0, (g0[k].inputs || {}).pixels, crop0));
  if (!encs.length) return null;
  const samplers = ids0.filter((k) => /KSampler|SamplerCustom/i.test(cls(g0[k])) && isLink((g0[k].inputs || {}).latent_image));
  if (!samplers.length) return null;
  // renumber: the picture -> "1", the mask -> "2", every other numeric id + 3 (the other picture slots sort after the mask)
  const map = {};
  for (const k of ids0) map[k] = k === crop0 ? "1" : /^\d+$/.test(k) ? String(+k + 3) : k;
  const re = (v) => (isLink(v) && map[String(v[0])] ? [map[String(v[0])], v[1]] : v);
  const g = {};
  for (const k of ids0) {
    const c = JSON.parse(JSON.stringify(g0[k]));
    for (const [i, v] of Object.entries(c.inputs || {})) c.inputs[i] = re(v);
    g[map[k]] = c;
  }
  const ids = ids0.map((k) => map[k]);
  let next = Math.max(3, ...ids.map((k) => parseInt(k, 10)).filter(Number.isFinite)) + 1;
  const nid = () => String(next++);
  g["2"] = { class_type: "LoadImage", inputs: { image: "placeholder.png" }, _meta: { title: "the mask (transparent = the selection)" } };
  const enc = map[encs[0]];
  const noise = maskChain(g, "2", [enc, 0], nid, opts);
  const dropped = [];
  let wired = 0;
  for (const s0 of samplers) {
    const s = g[map[s0]], L = s.inputs.latent_image, src = g[String(L[0])];
    if (!src) continue;
    if (/^VAEEncode$/.test(cls(src)) && encs.map((k) => map[k]).includes(String(L[0]))) { s.inputs.latent_image = [noise, 0]; wired++; continue; }
    if (/^Empty.*Latent/i.test(cls(src))) { s.inputs.latent_image = [noise, 0]; dropped.push(String(L[0])); wired++; }
  }
  if (!wired) return null;
  addDD(g, ids, nid);
  for (const k of dropped) {
    const used = Object.values(g).some((n) => Object.values((n && n.inputs) || {}).some((v) => isLink(v) && String(v[0]) === k));
    if (!used) delete g[k];
  }
  return g;
}

module.exports = { latentMaskGraph, editLatentGraph, blurFor };
