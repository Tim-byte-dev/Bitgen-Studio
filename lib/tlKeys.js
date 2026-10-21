// bitGen Studio — lib/tlKeys.js (2.379.0): the exporter's side of the timeline ◆ keyframes for an image / TEXT clip.
// POST /api/export copies keys through a manual allow-list (routes/index.js); this keeps that list one line.
//   imageKeys(clip, imagesDir) -> { kf, lopacity, tint }
//     kf        lib/keyframes.normalize(clip.kf) (undefined when there are none)
//     lopacity  the layer's own opacity (0..1) - a KEYFRAMED opacity is multiplied by it in the compile (the static
//               `opacity` the page sends already has it folded in)
//     baked     2.490.0: video/tlb_<id>.webm - the page's own frames of a layer it placed (a parented layer); the
//               compile overlays it full-frame instead of placing the picture itself
//     tint      a text layer whose colour is keyframed: its white-fill twin images/text_<id>_w.png (static/keyframes +
//               ext/timelinedock/canvas.js upload it) - the worker tints it frame by frame. Missing twin = no tint (the
//               layer compiles in its static colour) and the worker says so.
const fs = require("fs");
const path = require("path");
const keyframes = require("./keyframes");

function imageKeys(c, imagesDir) {
  const out = {};
  const kf = keyframes.normalize(c && c.kf);
  if (kf) out.kf = kf;
  const lo = Number(c && c.lopacity);
  if (Number.isFinite(lo)) out.lopacity = Math.min(1, Math.max(0, lo));
  if (kf && keyframes.has(kf, "color")) {
    const fromName = /^text_([A-Za-z0-9_-]+)\.png$/.exec(path.basename(String((c && c.name) || "")));
    const tid = String(((c && c.text) || {}).tid || (fromName && fromName[1]) || "").replace(/[^A-Za-z0-9_-]+/g, "");
    if (tid) {
      const w = path.join(imagesDir, `text_${tid}_w.png`);
      out.tint = w;
      if (!fs.existsSync(w)) out.tint_missing = true;
    }
  }
  // 2.490.0: a layer the page BAKED (a parented layer - ext/timelinedock/tlparent.js): video/tlb_<id>.webm, overlaid as it is
  if (c && c.bake) {
    const f = require("./layerBake").fileOf(c.bake);
    if (f) out.baked = f;
  }
  return out;
}

/** 2.491.0: a canvas clip's layer BLEND MODE and TRACK MATTE (ext/timelinedock/timelinedock.js tlLayerKeys) - clean */
const BLENDS = ["multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "add",
  "hue", "saturation", "color", "luminosity"];       // 2.495.0: the colour modes (worker.py _hsl_blend)
const MATTES = ["alpha", "alphainv", "luma", "lumainv"];
const LK = /^(vl|i):\d{1,3}$/;
function layerKeys(c) {
  const out = {};
  if (!c || typeof c !== "object") return out;
  if (LK.test(String(c.lk || ""))) out.lk = String(c.lk);
  if (BLENDS.includes(c.blend)) out.blend = c.blend;
  if (c.matte && MATTES.includes(c.matte.mode) && LK.test(String(c.matte.by || ""))) out.matte = { mode: c.matte.mode, by: String(c.matte.by) };
  if (c.matteonly === true) out.matteonly = true;
  return out;
}

/** 2.498.0: a VIDEO-layer clip's ✒ masks as the grey mask video the page made (ext/timelinedock/tlmask.js) */
function maskKeys(c) {
  if (!c || typeof c !== "object" || !c.mbake) return {};
  const f = require("./layerBake").fileOf(c.mbake);
  return f ? { maskv: f } : {};
}

/** 2.515.0: a VIDEO-layer clip's 🧍 CUT-OUT (ext/timelinedock/tlcutout.js): the file the subject was cut out into
 *  (video/cut_*.webm - VP9 with alpha, the clip's size, frame 0 = source second cut.from) read in place of the clip, the
 *  clip's in / out moved onto it - only when the clip is inside what was cut out and "use" is on */
function cutKeys(c) {
  if (!c || typeof c !== "object" || !c.cut || c.cut.use === false || !c.cut.file) return {};
  const f = require("./sceneTools").cutFile(c.cut.file); if (!f) return {};
  const a = Number(c.cut.from) || 0, b = Number(c.cut.to) || 0, i = Math.max(0, +c.in || 0), o = +c.out || 0;
  if (!(b > a) || i < a - 0.02 || (o && o > b + 0.06)) return {};
  return { path: f, in: Math.max(0, i - a), out: o ? Math.max(0.05, o - a) : Math.max(0.05, b - a), cutout: true };
}

/** 2.499.0: a VIDEO-layer clip's ▢ corner pin (ext/timelinedock/tltrack.js workerPin): its corners as keys
 *  [{at, p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y}] (top left, top right, bottom left, bottom right of the frame) - clean */
const PIN = ["p0x", "p0y", "p1x", "p1y", "p2x", "p2y", "p3x", "p3y"];
function pinKeys(c) {
  if (!c || !Array.isArray(c.pin) || !c.pin.length) return {};
  const out = [];
  for (const k of c.pin.slice(0, 20000)) {
    if (!k || typeof k !== "object") continue;
    const at = Number(k.at); if (!Number.isFinite(at) || at < 0 || at > 86400) continue;
    const o = { at: Math.round(at * 1000) / 1000 };
    let ok = true;
    for (const p of PIN) { const v = Number(k[p]); if (!Number.isFinite(v)) { ok = false; break; } o[p] = Math.round(Math.max(-100000, Math.min(100000, v)) * 100) / 100; }
    if (ok) out.push(o);
  }
  out.sort((a, b) => a.at - b.at);
  return out.length ? { pin: out } : {};
}

/** 2.500.0: a VIDEO-layer clip's ⏱ time effects (ext/timelinedock/tltime.js): motion blur, posterize time, echo - clean */
function timeKeys(c) {
  const tm = c && c.tm;
  if (!tm || typeof tm !== "object") return {};
  const n = (v, d, lo, hi) => { const x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
  const o = { blur: !!tm.blur, shutter: n(tm.shutter, 180, 1, 720), samples: Math.round(n(tm.samples, 8, 2, 16)), post: n(tm.post, 0, 0, 60) };
  if (tm.echo && typeof tm.echo === "object") o.echo = { n: Math.round(n(tm.echo.n, 3, 1, 8)), dt: n(tm.echo.dt, 0.1, 1 / 24, 5), i0: n(tm.echo.i0, 0.6, 0, 1), decay: n(tm.echo.decay, 0.6, 0, 1) };
  return o.blur || o.post > 0 || o.echo ? { tm: o } : {};
}

/** 2.505.0: a VIDEO-layer clip's 〰 distortion as the two grey map videos the page made (ext/timelinedock/tldist.js) */
function distKeys(c) {
  const d = c && typeof c === "object" ? c.dbake : null;
  if (!d || typeof d !== "object") return {};
  const LB = require("./layerBake"), x = LB.fileOf(d.x), y = LB.fileOf(d.y);
  return x && y ? { dmapx: x, dmapy: y } : {};
}
/** 2.506.0: a VIDEO-layer clip the page baked whole (ext/timelinedock/tlvbake.js: ☀ rays, warps, 3D ...) */
function vbakeKeys(c) {
  if (!c || typeof c !== "object" || !c.vbake) return {};
  const f = require("./layerBake").fileOf(c.vbake);
  return f ? { vbaked: f } : {};
}
/** 2.572.0: ✨ Auto transition - how long the clip stays under the next one (seconds, 0..4; scripts/cliptail.py) */
function tailKeys(c) {
  const t = Number(c && c.tail);
  return Number.isFinite(t) && t > 0 ? { tail: Math.round(Math.min(4, t) * 10000) / 10000 } : {};
}

module.exports = { tailKeys, cutKeys, imageKeys, layerKeys, maskKeys, pinKeys, timeKeys, distKeys, vbakeKeys, BLENDS, MATTES };
