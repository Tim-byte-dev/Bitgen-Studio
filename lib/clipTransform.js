"use strict";
/**
 * clipTransform.js — WHERE A LAYER CLIP SITS IN THE PICTURE (2.377.0).
 *
 * Tim: "Add a preview canvas to the timeline docker ... add a photoshop style toolbar to the left of the preview
 * canvas". The canvas's Move tool positions, scales and rotates a clip on a VIDEO LAYER (V2+) or an IMAGE / TEXT
 * layer; the clip carries it as `tf`:
 *   x, y    pixels the clip's CENTRE sits right / down of the picture's centre
 *   scale   times the clip's default size (a video layer: its own pixel size; an image: its width capped at the
 *           picture's width - exactly what the compile drew before 2.377.0)
 *   rot     degrees clockwise about the clip's centre
 * The compile (worker.py) draws the same: scale, rotate (transparent corners), overlay at the centre + (x, y).
 * V1 is the base picture - it has no transform.
 */
function num(v, def, lo, hi) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
}

/** A clip's tf from the page -> a clean one, or undefined when it changes nothing. */
function normalize(tf) {
  if (!tf || typeof tf !== "object") return undefined;
  const out = {
    x: Math.round(num(tf.x, 0, -20000, 20000) * 100) / 100,
    y: Math.round(num(tf.y, 0, -20000, 20000) * 100) / 100,
    scale: Math.round(num(tf.scale, 1, 0.01, 20) * 10000) / 10000,
    rot: Math.round(num(tf.rot, 0, -3600, 3600) * 100) / 100,
  };
  // 2.489.0: the anchor point (pixels from the clip's centre at scale 1) - only when set
  const ax = Math.round(num(tf.ax, 0, -20000, 20000) * 100) / 100, ay = Math.round(num(tf.ay, 0, -20000, 20000) * 100) / 100;
  if (Math.abs(ax) >= 0.01 || Math.abs(ay) >= 0.01) { out.ax = ax; out.ay = ay; }
  return isIdentity(out) ? undefined : out;
}

function isIdentity(tf) {
  return !tf || (Math.abs(tf.x || 0) < 0.01 && Math.abs(tf.y || 0) < 0.01
    && Math.abs((tf.scale == null ? 1 : tf.scale) - 1) < 1e-4 && Math.abs(tf.rot || 0) < 0.01
    && Math.abs(tf.ax || 0) < 0.01 && Math.abs(tf.ay || 0) < 0.01);
}

module.exports = { normalize, isIdentity };
