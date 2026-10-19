// bitGen Studio — timeline range editing (pure maths, no I/O).
//
// One implementation of "keep this selection" / "cut this selection" shared by
// the UI (over POST /api/timeline/edit) and the unit tests, so the browser and
// the exporter can never disagree about where a trim actually landed.
//
// Clip shapes on a layer:
//   media (video / audio) : { name, dur, in, out, start, ... }
//                           timeline extent = [start, start + (out - in)]
//   image                 : { name, start, len, opacity }
//                           timeline extent = [start, start + len]
//
// Every boundary is snapped to a whole frame (24 fps by default), so a
// selection made in the frame inspector trims on exactly the frame the user
// clicked — no 0.1 s rounding drift.
const FPS = 24;

const EPS = 1e-6;

function snap(t, fps) {
  const f = fps > 0 ? fps : FPS;
  return Math.round(Math.round(t * f) / f * 1e6) / 1e6;
}

function isImage(kind) { return kind === "image" || kind === "images"; }

// 2.406.0: a retimed clip (speed / reverse / ramp) - its timeline length and the source part a slice keeps come from
// static/clipfx.js, the same maths the canvas and the compile use
const ClipFx = require("../static/clipfx.js");

// timeline extent of a clip, [start, end]
function extent(c, kind) {
  const s = Number(c.start) || 0;
  let d;
  if (isImage(kind)) d = Math.max(0, Number(c.len) || 0);
  else if (ClipFx.retimed(c.fx)) d = Math.max(0, ClipFx.clipLen(Object.assign({}, c, { out: c.out != null ? c.out : (c.dur != null ? c.dur : 0) })) || 0);
  else d = Math.max(0, (c.out != null ? c.out : (c.dur != null ? c.dur : 0)) - (c.in || 0));
  return [s, s + d];
}

// sub-clip of `c` covering timeline range [ns, ne] — source in/out are shifted
// by the same amount the timeline start moved, so the picture stays in sync.
function slice(c, kind, ns, ne, fps) {
  const [s] = extent(c, kind);
  const a = snap(ns, fps), b = snap(ne, fps);
  const o = Object.assign({}, c, { start: a });
  if (isImage(kind)) {
    o.len = Math.max(1 / (fps || FPS), Math.round((b - a) * 1e6) / 1e6);
  } else if (ClipFx.retimed(c.fx)) {
    // the source between the two timeline offsets (backwards for a reversed clip), the ramp re-fitted to it
    const r = ClipFx.slice(Object.assign({}, c, { out: c.out != null ? c.out : c.dur }), a - s, b - s);
    o.in = Math.max(0, r.in); o.out = c.dur != null ? Math.min(c.dur, r.out) : r.out;
    if (r.fx !== undefined) o.fx = r.fx;
  } else {
    const i0 = Number(c.in) || 0;
    const lim = c.dur != null ? c.dur : Infinity;
    o.in = Math.max(0, snap(i0 + (a - s), fps));
    o.out = Math.min(lim, snap(i0 + (b - s), fps));
    if (o.out <= o.in) o.out = o.in + 1 / (fps || FPS);
  }
  return o;
}

// anything shorter than a single frame is not a clip, it's a rounding artefact
function tooShort(ns, ne, fps) { return ne - ns < (1 / (fps || FPS)) - EPS; }

function shift(clips, by) {
  return clips.map((c) => Object.assign({}, c, {
    start: Math.max(0, Math.round(((Number(c.start) || 0) - by) * 1e6) / 1e6) }));
}

function byStart(clips) {
  return clips.slice().sort((x, y) => (Number(x.start) || 0) - (Number(y.start) || 0));
}

// ---------------------------------------------------------------- keep
// Everything on the layer outside [a, b] is dropped; clips straddling a
// boundary are trimmed back to it. With ripple, the survivors slide left so
// the kept range starts at 0.
function keepRange(clips, kind, a0, b0, opts) {
  const o = opts || {};
  const fps = o.fps || FPS;
  const a = snap(Math.min(a0, b0), fps), b = snap(Math.max(a0, b0), fps);
  const out = [];
  for (const c of clips || []) {
    const [s, e] = extent(c, kind);
    const ns = Math.max(s, a), ne = Math.min(e, b);
    if (ne <= ns || tooShort(ns, ne, fps)) continue;
    out.push(slice(c, kind, ns, ne, fps));
  }
  return byStart(o.ripple ? shift(out, a) : out);
}

// ----------------------------------------------------------------- cut
// The [a, b] slice is removed from every clip on the layer. A clip that spans
// the whole selection is split in two. With ripple, everything after the
// selection slides left to close the hole.
function cutRange(clips, kind, a0, b0, opts) {
  const o = opts || {};
  const fps = o.fps || FPS;
  const a = snap(Math.min(a0, b0), fps), b = snap(Math.max(a0, b0), fps);
  const out = [];
  for (const c of clips || []) {
    const [s, e] = extent(c, kind);
    if (e <= a + EPS || s >= b - EPS) { out.push(Object.assign({}, c)); continue; }
    if (s >= a - EPS && e <= b + EPS) continue;                 // fully inside -> gone
    if (s < a - EPS && !tooShort(s, a, fps)) out.push(slice(c, kind, s, a, fps));
    if (e > b + EPS && !tooShort(b, e, fps)) out.push(slice(c, kind, b, e, fps));
  }
  if (!o.ripple) return byStart(out);
  const gap = b - a;
  return byStart(out.map((c) => ((Number(c.start) || 0) >= b - EPS
    ? Object.assign({}, c, { start: Math.max(0, Math.round(((Number(c.start) || 0) - gap) * 1e6) / 1e6) })
    : c)));
}

// V1 is sequential: after an edit, close the gaps so it stays a chain.
function compact(clips, kind) {
  let cursor = 0;
  return byStart(clips).map((c) => {
    const [s, e] = extent(c, kind);
    const d = e - s;
    const o = Object.assign({}, c, { start: Math.round(cursor * 1e6) / 1e6 });
    cursor += d;
    return o;
  });
}

// ---------------------------------------------------------- trim at a moment
// (Task B, 2.95.0.) Head: the clip under `t` begins AT t — the media in
// advances by the same amount, so the picture under the playhead does not
// move. Tail: the clip under `t` ends AT t. Exactly ONE clip changes; a
// result shorter than a frame removes the clip instead of leaving a sliver.
function clipIndexAt(clips, kind, t) {
  const list = clips || [];
  for (let i = 0; i < list.length; i++) {
    const [s, e] = extent(list[i], kind);
    if (t >= s - EPS && t < e - EPS) return i;
  }
  return -1;
}

function trimAt(clips, kind, side, t0, opts) {
  const o = opts || {};
  const fps = o.fps || FPS;
  const t = snap(t0, fps);
  const i = clipIndexAt(clips, kind, t);
  if (i < 0) throw new Error("no clip under " + Number(t0).toFixed(3) + "s on that layer");
  const out = (clips || []).map((c) => Object.assign({}, c));
  const [s, e] = extent(out[i], kind);
  const ns = side === "head" ? t : s;
  const ne = side === "tail" ? t : e;
  if (tooShort(ns, ne, fps)) out.splice(i, 1);      // a sliver is not a clip
  else out[i] = slice(out[i], kind, ns, ne, fps);
  return byStart(out);
}

// ------------------------------------------------- one-clip scoped keep/cut
// (Task B, 2.95.0.) The same keep/cut, applied to ONLY the clip under `at` —
// every other clip on the layer is untouched. keep: that clip is trimmed to
// selection∩clip and STAYS WHERE IT IS (ripple would drag a lone clip to 0,
// which nobody means by "trim this clip"). cut: selection∩clip is removed
// from that clip; with ripple its tail half slides left onto the head half
// (a jump cut), without it the hole stays.
function applyClip(op, clips, kind, a, b, at, opts) {
  const o = opts || {};
  const fps = o.fps || FPS;
  const i = clipIndexAt(clips, kind, snap(at, fps));
  if (i < 0) throw new Error("no clip under " + Number(at).toFixed(3) + "s on that layer");
  let one = op === "keep" ? keepRange([clips[i]], kind, a, b, { fps })
          : op === "cut"  ? cutRange([clips[i]], kind, a, b, { fps })
          : null;
  if (one === null) throw new Error("unknown op " + op);
  if (op === "keep" && !one.length) throw new Error("the selection does not touch that clip");
  if (op === "cut" && o.ripple && one.length === 2) {
    one = byStart(one);
    const [, headEnd] = extent(one[0], kind);
    one[1] = Object.assign({}, one[1], { start: headEnd });
  }
  const out = (clips || []).map((c) => Object.assign({}, c));
  out.splice(i, 1, ...byStart(one));
  return byStart(out);
}

function apply(op, clips, kind, a, b, opts) {
  const res = op === "keep" ? keepRange(clips, kind, a, b, opts)
            : op === "cut"  ? cutRange(clips, kind, a, b, opts)
            : null;
  if (res === null) throw new Error("unknown op " + op);
  return (opts && opts.compact) ? compact(res, kind) : res;
}

// -------------------------------------------------- keyframes (2.96.0)
// 2.379.0: kfValue now DELEGATES to static/keyframes.js (the page uses the same file). History: the page interpolates every
// preview tick with its own copy; this one is for the unit tests and for the
// exporter when it learns to render ramps. A fix in one belongs in the other.
// Shape on a clip: kf: [{at, op?, vol?}], `at` in seconds from the clip's
// timeline start. Linear between keyframes, HELD before the first and after
// the last (After Effects semantics). No keyframes for a property -> the
// caller's fallback (the clip's static value).
function kfValue(clip, at, prop, fallback) {
  // 2.379.0: ONE implementation for the page and the server - static/keyframes.js (easing, transforms, colour)
  return require("./keyframes").value(clip && clip.kf, at, prop, fallback);
}

// insert-or-replace the keyframe at `at` (frame-snapped, half-frame merge)
function kfSet(clip, at, vals, fps) {
  const t = snap(at, fps);
  const kf = (clip.kf || []).map((k) => Object.assign({}, k));
  let k = kf.find((x) => Math.abs(x.at - t) < 0.5 / (fps || FPS));
  if (!k) { k = { at: t }; kf.push(k); }
  Object.assign(k, vals || {});
  kf.sort((x, y) => x.at - y.at);
  return kf;
}

function kfRemove(clip, at, fps) {
  const t = snap(at, fps);
  return (clip.kf || []).filter((k) => Math.abs(k.at - t) >= 0.5 / (fps || FPS));
}

module.exports = { FPS, snap, extent, slice, keepRange, cutRange, compact, apply,
  clipIndexAt, trimAt, applyClip, kfValue, kfSet, kfRemove };
