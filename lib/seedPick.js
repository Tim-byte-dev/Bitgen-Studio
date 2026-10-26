// bitGen Studio — lib/seedPick.js (2.598.0): WHICH SEED a render uses - Basic Settings' seed, the style's FIXED seed, or a
// random one.
//
// Tim: "add seed input in basic settings docker and in the styles - have a toggle button for random/fixed".
//   A style now stores seed_mode "random" (the default - every render a new seed, the 2.83.0 rule that ended "every
//   picture the same") or "fixed" + seed (the toggle in the style editor: this style always renders with that seed).
//   A seed stored on a style WITHOUT seed_mode "fixed" (an old style) is ignored, as before.
//   The order: Basic Settings' seed when it is FIXED (a number >= 0) -> with Override style ON, Basic Settings' Random
//   stays random (Basic Settings rule) -> otherwise the style's fixed seed -> otherwise random (-1, rolled later).
//   norm(mode, seed)              -> {seed_mode, seed} for a style (seed null when random or invalid)
//   styleSeed(style, max)         -> the style's fixed seed or null
//   pick(reqSeed, style, opts)    -> the seed (>= 0) or -1; opts {override (Basic Settings rule), max}
"use strict";
const MAX = 2 ** 32 - 1;
const int = (v) => { if (v === null || v === undefined || v === "") return null; const n = Number(v); return Number.isInteger(n) ? n : null; };
function norm(mode, seed) {
  const n = int(seed);
  const ok = n !== null && n >= 0 && n <= MAX;
  return mode === "fixed" && ok ? { seed_mode: "fixed", seed: n } : { seed_mode: "random", seed: ok ? n : null };
}
function styleSeed(style, max) {
  if (!style || style.seed_mode !== "fixed") return null;
  const n = int(style.seed);
  return n !== null && n >= 0 ? Math.min(n, max || MAX) : null;
}
function pick(reqSeed, style, opts) {
  const o = opts || {};
  const r = int(reqSeed);
  if (r !== null && r >= 0) return Math.min(r, o.max || MAX);
  if (o.override) return -1;
  const s = styleSeed(style, o.max);
  return s === null ? -1 : s;
}
module.exports = { MAX, norm, styleSeed, pick };
