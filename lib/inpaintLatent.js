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
//   The two LoadImage nodes get the two lowest ids, crop first: comfy_image.py fills LoadImage slots in id order with the
//   job's images [crop, mask]. Denoise stays the graph's (1.0 = Generate); Refine writes its strength (apply_denoise).
"use strict";

const isLink = (v) => Array.isArray(v) && v.length === 2 && (typeof v[0] === "string" || typeof v[0] === "number");
const cls = (n) => String((n && n.class_type) || "");

function latentMaskGraph(graph) {
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
  if (lo >= 3 && !g["1"] && !g["2"]) return wire(g, ids, empty, vae, "1", "2", hi);
  return renumbered(g, ids, empty, vae);
}
/** the graph's ids shifted up by 2 so "1" / "2" are free for the crop and the mask */
function renumbered(g0, ids0, empty0, vae0) {
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
  return wire(g, ids, empty, vae, "1", "2", hi);
}
function wire(g, ids, empty, vae, crop, mask, hi) {
  let next = hi;
  const nid = () => String(next++);
  g[crop] = { class_type: "LoadImage", inputs: { image: "placeholder.png" }, _meta: { title: "the crop (inpaint)" } };
  g[mask] = { class_type: "LoadImage", inputs: { image: "placeholder.png" }, _meta: { title: "the mask (transparent = fill)" } };
  const enc = nid(), grow = nid(), noise = nid();
  g[enc] = { class_type: "VAEEncode", inputs: { pixels: [crop, 0], vae } };
  g[grow] = { class_type: "GrowMask", inputs: { mask: [mask, 1], expand: 6, tapered_corners: true } };
  g[noise] = { class_type: "SetLatentNoiseMask", inputs: { samples: [enc, 0], mask: [grow, 0] } };
  const eset = new Set(empty);
  let rewired = 0;
  for (const k of ids) {
    const ins = (g[k] || {}).inputs || {};
    for (const [i, v] of Object.entries(ins)) if (isLink(v) && eset.has(String(v[0]))) { ins[i] = [noise, 0]; rewired++; }
  }
  if (!rewired) return null;
  // DifferentialDiffusion on the model of every sampler / guider (one per model source)
  const dd = {};
  for (const k of ids) {
    const n = g[k]; if (!n || !/KSampler|Guider|SamplerCustom/i.test(cls(n))) continue;
    const m = (n.inputs || {}).model; if (!isLink(m)) continue;
    const key = String(m[0]) + ":" + m[1];
    if (!dd[key]) { dd[key] = nid(); g[dd[key]] = { class_type: "DifferentialDiffusion", inputs: { model: m } }; }
    n.inputs.model = [dd[key], 0];
  }
  for (const k of empty) delete g[k];                 // nothing reads it now
  return g;
}

module.exports = { latentMaskGraph };
