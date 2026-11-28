// bitGen Studio — lib/mingLayers.js (3.9.0): 🧩 MING LAYERED DESIGN - the words both Ming-Image models read, from the image
// editor's layer list (pure; scripts/test-31200.js).
// Tim: "can u add this to image editor please. https://huggingface.co/inclusionAI/Ming-Image-0.2-Design . with a dialog with
// add layer, this will have layer name and description of what goes in that layer for ming image. it is supposed to be able to
// generate separate layers. please check it"
//
// What was checked (inclusionAI's model cards + github.com/inclusionAI/Ming-Image, commit d5615110, 2026-11-28):
//   Ming-Image-0.2-Design (MIT, 6B DiT + a BailingMoeV2 language model) makes ONE flat picture. Its best prompt is a Figma-like
//   JSON: {canvas_settings: {aspect_ratio, ambient_lighting, image_style}, layers: [{description, coordinates "cx: 0.500, cy:
//   0.500, w: 1.000, h: 1.000", hierarchy_and_relation, color_specs [hex]}]} - layers from the BACKGROUND up, any text quoted
//   verbatim exactly once.
//   The separate transparent layers come from its sister Ming-Image-0.1-Design-Layer (MIT): a flat picture + a plan
//   "Decompose this image into N layers ... Number of layers: N / Layer 1: <front-most> ... Layer N: <background>" -> N RGBA
//   PNGs (layer_01 = the front) that stack back into the picture.
//   So bitGen runs the two in a row: the list -> 0.2-Design's JSON -> the picture -> the list again as 0.1-Design-Layer's plan ->
//   one editor layer per row, named as you named it.
//
//   clean(rows)                 the dialog's rows made safe: [{name, desc, where}] (front first, 1..MAX)
//   t2iPrompt(rows, o)          0.2-Design's JSON (string) - o = {w, h, style, lighting}
//   layerPlan(rows)             0.1-Design-Layer's plan (string)
//   sizeFor(w, h, level)        the generation size: the canvas's shape at ~level² pixels, 16-px steps, 1:4 .. 4:1
//   coordsOf(where)             a "where" word -> Ming's normalized box string
//   stem(name)                  a file-name stem
"use strict";

const MAX = 12;
const WHERE = {
  all: [0.5, 0.5, 1, 1], top: [0.5, 0.2, 1, 0.4], middle: [0.5, 0.5, 1, 0.4], bottom: [0.5, 0.8, 1, 0.4],
  left: [0.25, 0.5, 0.5, 1], right: [0.75, 0.5, 0.5, 1], centre: [0.5, 0.5, 0.6, 0.6],
  "top-left": [0.25, 0.25, 0.5, 0.5], "top-right": [0.75, 0.25, 0.5, 0.5], "bottom-left": [0.25, 0.75, 0.5, 0.5], "bottom-right": [0.75, 0.75, 0.5, 0.5],
};
const WHERE_LABEL = { all: "Whole canvas", top: "Top", middle: "Middle band", bottom: "Bottom", left: "Left half", right: "Right half", centre: "Centre",
  "top-left": "Top left", "top-right": "Top right", "bottom-left": "Bottom left", "bottom-right": "Bottom right" };
const one = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

/** the dialog's rows made safe - front first; a row with neither a name nor a description is dropped */
function clean(rows) {
  return (Array.isArray(rows) ? rows : []).map((r, i) => {
    const name = one(r && r.name, 60), desc = one(r && (r.desc != null ? r.desc : r.description), 600);
    if (!name && !desc) return null;
    return { name: name || "Layer " + (i + 1), desc: desc || name, where: WHERE[r && r.where] ? r.where : "all" };
  }).filter(Boolean).slice(0, MAX);
}
const f3 = (v) => (Math.round(v * 1000) / 1000).toFixed(3);
function coordsOf(where) { const c = WHERE[where] || WHERE.all; return `cx: ${f3(c[0])}, cy: ${f3(c[1])}, w: ${f3(c[2])}, h: ${f3(c[3])}`; }
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
/** the hex colours written in a description (#abc / #aabbcc) */
const hexes = (s) => [...new Set((String(s || "").match(/#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi) || []).map((h) => h.toUpperCase()))].slice(0, 8);

/** 0.2-Design's structured prompt: the background first, each layer its words, place, order and colours */
function t2iPrompt(rows0, o) {
  const rows = clean(rows0), x = o || {}, w = Math.max(1, Math.round(+x.w || 1024)), h = Math.max(1, Math.round(+x.h || 1024)), g = gcd(w, h);
  const back = rows.slice().reverse(), n = back.length;
  const layers = back.map((r, i) => {
    const below = i > 0 ? back[i - 1].name : "", above = i < n - 1 ? back[i + 1].name : "";
    const rel = i === 0 ? (n > 1 ? `The background - behind everything; "${above}" sits on it.` : "The whole design.")
      : `Layer ${i + 1} of ${n} from the back: above "${below}"` + (above ? `, below "${above}".` : " - the front-most layer.");
    return { description: `${r.name}: ${r.desc}`, coordinates: coordsOf(i === 0 && r.where === "all" ? "all" : r.where), hierarchy_and_relation: rel, color_specs: hexes(r.desc) };
  });
  return JSON.stringify({
    canvas_settings: {
      aspect_ratio: `${w / g}:${h / g}, ${w} × ${h} px`,
      ambient_lighting: one(x.lighting, 400) || "Even, natural lighting consistent across the whole design.",
      image_style: one(x.style, 600) || "Clean, professional graphic design with crisp edges and legible text.",
    },
    layers,
  }, null, 2);
}
/** 0.1-Design-Layer's plan: Layer 1 the front-most, the last the background */
function layerPlan(rows0) {
  const rows = clean(rows0), n = rows.length;
  return `Decompose this image into ${n} layers with the following specifications:\n\nNumber of layers: ${n}\n`
    + rows.map((r, i) => `Layer ${i + 1}: ${r.name} - ${r.desc}${i === n - 1 && n > 1 ? " (the background)" : ""}`).join("\n");
}
/** the generation size: the canvas's shape at about level x level pixels (16-px steps; Ming's own buckets take it from there) */
function sizeFor(w0, h0, level) {
  const L = +level === 2048 ? 2048 : 1024;
  let r = (+w0 > 0 && +h0 > 0) ? +w0 / +h0 : 1; r = Math.min(4, Math.max(0.25, r));
  const r16 = (v) => Math.max(256, Math.round(v / 16) * 16);
  return { w: r16(L * Math.sqrt(r)), h: r16(L / Math.sqrt(r)) };
}
const stem = (s) => (String(s || "").replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40)) || "design";

module.exports = { MAX, WHERE, WHERE_LABEL, clean, coordsOf, hexes, t2iPrompt, layerPlan, sizeFor, stem };
