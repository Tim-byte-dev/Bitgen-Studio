"use strict";
/**
 * tempLoras.js — TEMPORARY LoRAs PER PROJECT (2.111.0, by instruction).
 *
 * Tim: "add a lora adder with weight slider to the left docker's basic
 * (image/video) settings with ability to remove — temporary loras, not part
 * of the style, included on generate and saved in
 * projects\<name>\image-loras-temp.json; do the same for videos."
 *
 *     projects/<p>/image-loras-temp.json   [ {path, weight}, ... ]
 *     projects/<p>/video-loras-temp.json   [ {path, weight}, ... ]
 *
 * `path` is the name inside ComfyUI's loras folder (subfolder + extension
 * kept), exactly what a style's LoRA row holds. Weight -4..4, 0 legitimate.
 * On generate they are APPENDED after the style's own LoRAs (image: into the
 * style copy the image worker renders; video: into the video style's chain,
 * or a synthetic style holding only the LoRAs when no video style is
 * selected). They never change a style file.
 */
const fs = require("fs");
const path = require("path");

// 2.316.0: "cnet" = Basic Settings -> ControlNet's LoRAs (the FINAL render only)
const KINDS = ["image", "video", "cnet", "swap"];   // 2.342.0: + the swap dialog's ⚙ LoRAs
const MAX = 12;

function file(projDir, kind) {
  if (!KINDS.includes(kind)) throw new Error("temp LoRA kind must be image, video, cnet or swap");
  return path.join(projDir, `${kind}-loras-temp.json`);
}

/* 2.931.0 (Tim: "add a toggle switch to the added loras in basic settings so we can toggle loras on and off without
   removing them"): an entry may carry on:false - kept in the list and the file, never rendered. normalize() and read() drop
   the switched-off ones (what every render uses); {all: true} keeps them (Basic Settings' list, saving, renaming). */
function normalize(list, o) {
  const all = !!(o && o.all);
  return (Array.isArray(list) ? list : []).map((l) => {
    const p = String((l || {}).path || (l || {}).name || "").trim();
    const w = Number((l || {}).weight);
    const e = { path: p.slice(0, 300), weight: Math.max(-4, Math.min(4, Number.isFinite(w) ? w : 1)) };
    if ((l || {}).on === false) e.on = false;
    return e;
  }).filter((l) => l.path && !l.path.includes("..") && (all || l.on !== false)).slice(0, MAX);
}

function read(projDir, kind, o) {
  try { return normalize(JSON.parse(fs.readFileSync(file(projDir, kind), "utf8")), o); }
  catch { return []; }
}

function write(projDir, kind, list) {
  const n = normalize(list, { all: true });
  fs.writeFileSync(file(projDir, kind), JSON.stringify(n, null, 2));
  return n;
}

/** Style's LoRAs + the temporary ones (by path; a temp entry re-weights a
 *  style LoRA of the same path instead of doubling it). */
function merge(styleLoras, extra) {
  const out = (Array.isArray(styleLoras) ? styleLoras : []).map((l) => ({ path: String(l.path || ""), weight: Number(l.weight) }));
  for (const t of normalize(extra)) {
    const i = out.findIndex((l) => l.path === t.path);
    if (i >= 0) out[i] = { path: t.path, weight: t.weight }; else out.push(t);
  }
  return out;
}

module.exports = { KINDS, MAX, file, normalize, read, write, merge };
