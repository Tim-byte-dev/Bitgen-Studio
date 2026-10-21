// bitGen Studio — lib/regions.js (2.569.0): 🔲 ZONES - the boxes a regional-prompt picture is made from, checked.
//
// Tim: "can we add zones to the image editor - like put 3 boxes on the canvas, and tell the image model to put kite in
// this box, dog in this box, bench in this box?"
//   clean(list) -> [{x, y, w, h, text, strength}]  x / y / w / h = fractions of the picture (0..1, kept inside it), text
//                  up to 400 characters, strength 0.1..2 (1 = as strong as the scene's prompt); at most MAX boxes, a box
//                  with no words or under 1 % of a side is dropped
// /api/genimage {regions} -> the job's params.regions -> scripts/comfy_image.py patch -> scripts/comfy_regions.py apply
// (one CLIPTextEncode -> ConditioningSetArea -> ConditioningCombine per box). A ComfyUI image style only.
"use strict";
const MAX = 8;
const f = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };
function clean(list) {
  const out = [];
  for (const r of Array.isArray(list) ? list : []) {
    if (out.length >= MAX) break;
    if (!r || typeof r !== "object") continue;
    const text = String(r.text == null ? "" : r.text).replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 400);
    let x = f(r.x), y = f(r.y), w = f(r.w), h = f(r.h);
    if (!text || [x, y, w, h].some(Number.isNaN)) continue;
    x = Math.max(0, Math.min(1, x)); y = Math.max(0, Math.min(1, y));
    w = Math.max(0, Math.min(1 - x, w)); h = Math.max(0, Math.min(1 - y, h));
    if (w < 0.01 || h < 0.01) continue;
    const s = f(r.strength), strength = Number.isNaN(s) ? 1 : Math.max(0.1, Math.min(2, s));
    const k = (v) => Math.round(v * 10000) / 10000;
    out.push({ x: k(x), y: k(y), w: k(w), h: k(h), text, strength });
  }
  return out;
}
module.exports = { MAX, clean };
