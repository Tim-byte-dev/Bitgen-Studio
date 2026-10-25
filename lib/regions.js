// bitGen Studio — lib/regions.js (2.569.0): 🔲 ZONES - the boxes a regional-prompt picture is made from, checked.
//
// Tim: "can we add zones to the image editor - like put 3 boxes on the canvas, and tell the image model to put kite in
// this box, dog in this box, bench in this box?"
//   clean(list) -> [{x, y, w, h, text, strength, lora?, lora_strength?}]  x / y / w / h = fractions of the picture (0..1, kept inside it), text
//                  up to 400 characters, strength 0.1..2 (1 = as strong as the scene's prompt); at most MAX boxes, a box
//                  with no words or under 1 % of a side is dropped
// /api/genimage {regions} -> the job's params.regions -> scripts/comfy_image.py patch -> scripts/comfy_regions.py apply
// (one CLIPTextEncode -> ConditioningSetArea -> ConditioningCombine per box). A ComfyUI image style only.
// 2.592.0: a box can carry a 🎭 character LoRA (lora = the file as ComfyUI's loras list names it, lora_strength -4..4,
// default 1) - those boxes go to the Nougan Regional Character LoRA node (two different LoRAs at most per picture -
// LORAS_MAX; Settings ▸ Add-ons ▸ Nougan Nodes).
const LORAS_MAX = 2;
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
    const o = { x: k(x), y: k(y), w: k(w), h: k(h), text, strength };
    const lora = String(r.lora == null ? "" : r.lora).replace(/[\u0000-\u001f\u007f]+/g, "").trim().slice(0, 300);
    if (lora && !/(^|[\\/])\.\.([\\/]|$)/.test(lora)) {
      o.lora = lora;
      const ls = f(r.lora_strength);
      o.lora_strength = Number.isNaN(ls) ? 1 : Math.max(-4, Math.min(4, Math.round(ls * 100) / 100));
    }
    out.push(o);
  }
  return out;
}
/** the different character LoRAs of the boxes (in order) */
const loras = (list) => [...new Set((list || []).map((r) => (r && r.lora) || "").filter(Boolean).map((s) => s.replace(/\\/g, "/")))];
module.exports = { MAX, LORAS_MAX, clean, loras };
