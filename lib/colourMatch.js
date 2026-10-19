// bitGen Studio — lib/colourMatch.js (2.415.0): 🎯 COLOUR MATCH - make one clip look like another (Premiere's Lumetri
// Color Match).
//
// Tim: "lets do the medium jobs now" (Premiere's "Colour match between clips").
//
//   match(src, ref, o) -> {curves: {r, g, b}, before, after, target}
//     src / ref = {file, at (seconds into the file), fx (the clip's fx)}; o.strength 0..100 (%)
//   One frame of each is read small (ffmpeg, 128 wide). The REFERENCE is taken as the movie shows it (its LUT + its whole
//   grade - static/clipfx.js gradeRgb / sampleCube, the compile's own maths). The SOURCE is taken as it reaches its grade's
//   CURVES stage (exposure, temperature, wheels, contrast - the stages before the curves). Each channel's tones are then
//   matched quantile by quantile (1 %, 5 %, 25 %, 50 %, 75 %, 95 %, 99 %): those pairs become the clip's R / G / B
//   curves (monotone, the ends extrapolated) - the curves the 🎨 panel shows, so the match can be tweaked by hand.
//   before / after / target = the mean colour (0..255) of the source frame as it was, as matched, and of the reference.
// routes/clipfx.js serves POST /api/clipfx/colourmatch; the 🎨 Colour panel has 🎯 Match.
"use strict";
const { spawnSync } = require("child_process");
const FX = require("../static/clipfx.js");

const Q = [0.01, 0.05, 0.25, 0.5, 0.75, 0.95, 0.99];
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const r4 = (v) => Math.round(v * 10000) / 10000;

/** one frame, W x H RGB bytes */
function frame(file, at, W) {
  const w = W || 128;
  const r = spawnSync("ffmpeg", ["-loglevel", "error", "-ss", String(Math.max(0, +at || 0)), "-i", file, "-frames:v", "1",
    "-vf", `format=rgb24,scale=${w}:-2:flags=area,format=rgb24`, "-f", "rawvideo", "-"], { maxBuffer: 16 << 20 });
  if (r.status !== 0 || !r.stdout || r.stdout.length < 3) throw bad("could not read a frame of " + require("path").basename(file) + " at " + (+at || 0).toFixed(2) + " s", 422);
  return r.stdout;
}
/** the user LUT of a clip (parsed) or null - lut(name) reads the .cube text */
function userLut(fx, lut) {
  if (!fx || !fx.lut || !lut) return null;
  try { return FX.parseCube(lut(fx.lut)); } catch { return null; }
}
/** pixels (0..1 floats, [r, g, b] per pixel) through a function */
function pixels(buf, fn) {
  const out = [];
  for (let i = 0; i + 2 < buf.length; i += 3) out.push(fn(buf[i] / 255, buf[i + 1] / 255, buf[i + 2] / 255));
  return out;
}
/** the reference as the movie shows it: its LUT (mixed) then its whole grade */
function look(fx, user) {
  const f = FX.normalize(fx) || {};
  const mix = f.lut ? (f.lut_mix != null ? +f.lut_mix : 1) : 0;
  return (r, g, b) => {
    if (user && mix > 0) { const s = FX.sampleCube(user, r, g, b); r = r + (s[0] - r) * mix; g = g + (s[1] - g) * mix; b = b + (s[2] - b) * mix; }
    return f.grade ? FX.gradeRgb(clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1), f.grade).map((v) => clamp(v, 0, 1)) : [r, g, b];
  };
}
/** the source where its curves see it: the LUT, then the grade up to the curves (no curves, saturation 100, no HSL) */
function preCurves(fx, user) {
  const f = FX.normalize(fx) || {};
  const g = f.grade ? Object.assign({}, f.grade) : null;
  if (g) { delete g.curves; delete g.hsl; delete g.hcurves; g.saturation = 100; }
  return look(Object.assign({}, f, { grade: g || undefined }), user);
}
function quantiles(vals) {
  const s = Float64Array.from(vals).sort();
  return Q.map((q) => s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]);
}
/** quantile pairs -> a monotone curve [[x, y] ...] from 0 to 1 (strength k blends it toward a straight line) */
function curve(xs, ys, k) {
  const P = [];
  for (let i = 0; i < xs.length; i++) {
    const x = clamp(xs[i], 0, 1), y = clamp(ys[i], 0, 1);
    if (P.length && x - P[P.length - 1][0] < 0.02) continue;            // a flat stretch of the source: one point
    P.push([x, Math.max(y, P.length ? P[P.length - 1][1] : 0)]);
  }
  if (!P.length) return null;
  const ext = (a, b, x) => (Math.abs(b[0] - a[0]) < 1e-6 ? a[1] : a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]));
  const y0 = P.length > 1 ? clamp(ext(P[0], P[1], 0), 0, P[0][1]) : clamp(P[0][1] - P[0][0], 0, 1);
  const n = P.length, y1 = n > 1 ? clamp(ext(P[n - 2], P[n - 1], 1), P[n - 1][1], 1) : clamp(P[0][1] + (1 - P[0][0]), 0, 1);
  const pts = (P[0][0] > 0.02 ? [[0, y0]] : []).concat(P, P[n - 1][0] < 0.98 ? [[1, y1]] : []);
  return pts.map((p) => [r4(p[0]), r4(p[0] + (p[1] - p[0]) * k)]).slice(0, 16);
}
const mean = (px) => [0, 1, 2].map((c) => Math.round(px.reduce((s, p) => s + p[c], 0) / px.length * 255 * 10) / 10);

function match(src, ref, o) {
  if (!src || !src.file || !ref || !ref.file) throw bad("pick the clip to change and the clip to match");
  const k = clamp(o && o.strength != null ? +o.strength : 100, 0, 100) / 100;
  const lut = o && o.lut;
  const sFx = FX.normalize(src.fx) || {}, rFx = FX.normalize(ref.fx) || {};
  const sPx = pixels(frame(src.file, src.at), preCurves(sFx, userLut(sFx, lut)));
  const rPx = pixels(frame(ref.file, ref.at), look(rFx, userLut(rFx, lut)));
  const curves = {};
  ["r", "g", "b"].forEach((ch, c) => {
    const cv = curve(quantiles(sPx.map((p) => p[c])), quantiles(rPx.map((p) => p[c])), k);
    if (cv) curves[ch] = cv;
  });
  const grade = Object.assign({}, sFx.grade || {}, { curves: Object.assign({}, (sFx.grade || {}).curves || {}, curves) });
  delete grade.curves.m;                                   // the match is per channel; a master curve would sit before it
  const fullBefore = pixels(frame(src.file, src.at), look(sFx, userLut(sFx, lut)));
  const after = pixels(frame(src.file, src.at), look(Object.assign({}, sFx, { grade }), userLut(sFx, lut)));
  return { curves, before: mean(fullBefore), after: mean(after), target: mean(rPx), strength: Math.round(k * 100) };
}

module.exports = { match, quantiles, curve, Q };
