/* bitGen Studio — static/tlai.js (2.420.0): AI INSIDE THE TIMELINE - the maths shared by the page (ext/timelinedock/
 * tlai.js 🤖) and the unit tests (window.H3TlAi / require).
 *
 * Tim: "yes, please add your 2 suggestions" (AI inside the timeline: regenerate a shot in place, extend it, AI B-roll
 * for a gap, AI-aware cuts) - with the ONE prompt docker and the ⊖ negative docker (2.419.0).
 *
 *   len(c)                        a clip's length on the timeline (retimed clips by their own maths)
 *   gapAt(clips, t, end)          the empty stretch of a sequential track (V1) under t -> {a, b} | null (after the last
 *                                 clip: up to `end` when end > t)
 *   size(W, H, long)              the picture size a model renders for a W x H timeline: the long side <= long (1280),
 *                                 both multiples of 32, at least 256
 *   frames(secs, fps)             frames for /api/generate (secs x 24, at least 25)
 *   take(c)                       a clip's file as a TAKE {name, src, in, out, dur}
 *   withTake(c, t)                the clip playing take t in the same slot: same start, place, opacity, keyframes,
 *                                 effects; its length = the slot (c.slot: the length when the first take was made),
 *                                 or the take's own when shorter
 *   addTake(c, t)                 c.takes = every take so far (the first: the clip's own file), t made current -> the new clip
 *   rippleAfter(clips, from, by)  every clip starting at / after `from` moved by `by` seconds (a ⇥ extension makes room)
 *   beatCuts(beats, c, every, srcOff)  the timeline seconds to cut clip c at - every Nth beat inside it (beats in the
 *                                 beat source's own seconds, srcOff = where that source starts on the timeline)
 *   beatMarks(beats, srcOff, every, from, to)  timeline seconds of every Nth beat between from and to
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./clipfx.js"));
  else root.H3TlAi = factory(root.H3ClipFx);
})(typeof self !== "undefined" ? self : this, function (FX) {
  "use strict";
  var EPS = 1e-4;
  function n(v, d) { var x = Number(v); return isFinite(x) ? x : d; }
  function r4(v) { return Math.round(v * 10000) / 10000; }
  function outOf(c) { return c.out != null ? n(c.out, 0) : n(c.dur, n(c.in, 0) + 5); }
  function len(c) {
    if (!c) return 0;
    if (c.len != null && c.name && !c.src && c.dur == null) return n(c.len, 3);    // a picture clip
    if (FX && c.fx && FX.retimed && FX.retimed(c.fx)) { try { return FX.clipLen(Object.assign({}, c, { out: outOf(c) })); } catch (e) { /* plain */ } }
    return Math.max(0, outOf(c) - n(c.in, 0));
  }
  function gapAt(clips, t, end) {
    var L = (clips || []).map(function (c) { return { a: n(c.start, 0), b: n(c.start, 0) + len(c) }; }).sort(function (x, y) { return x.a - y.a; });
    var prev = 0;
    for (var i = 0; i < L.length; i++) {
      if (t >= L[i].a - EPS && t < L[i].b - EPS) return null;          // on a clip
      if (t < L[i].a - EPS) return L[i].a - prev > EPS ? { a: r4(prev), b: r4(L[i].a) } : null;
      prev = Math.max(prev, L[i].b);
    }
    var e = n(end, 0);
    return e > t + EPS && e - prev > EPS ? { a: r4(prev), b: r4(e) } : null;
  }
  function size(W, H, long) {
    var w = Math.max(1, n(W, 1280)), h = Math.max(1, n(H, 720)), L = n(long, 1280);
    var k = Math.min(1, L / Math.max(w, h));
    var r = function (v) { return Math.max(256, Math.round(v * k / 32) * 32); };
    return { w: r(w), h: r(h) };
  }
  function frames(secs, fps) { return Math.max(25, Math.min(5760, Math.round(n(secs, 5) * n(fps, 24)))); }
  function take(c) { return { name: c.name, src: c.src || "output", in: n(c.in, 0), out: outOf(c), dur: c.dur != null ? n(c.dur, 0) : null }; }
  function withTake(c, t) {
    // the SLOT is the clip's length when its first take was made (a shorter take must not shrink it for the others)
    var slot = c.slot != null ? n(c.slot, 0) : len(c), tl = Math.max(0, n(t.out, n(t.dur, 0)) - n(t.in, 0));
    var o = {};
    Object.keys(c).forEach(function (k) { o[k] = c[k]; });
    o.name = t.name; o.src = t.src || "output"; o.in = n(t.in, 0); o.dur = t.dur != null ? n(t.dur, 0) : o.dur;
    o.out = r4(o.in + Math.min(slot > 0 ? slot : tl, tl > 0 ? tl : slot));
    if (o.fx && FX && FX.retimed && FX.retimed(o.fx)) { o.fx = Object.assign({}, o.fx); delete o.fx.speed; delete o.fx.reverse; delete o.fx.ramp; delete o.fx.remap; }   // a new take plays straight
    delete o.thumb;
    return o;
  }
  function addTake(c, t) {
    var takes = (c.takes && c.takes.length ? c.takes.slice() : [take(c)]), slot = c.slot != null ? n(c.slot, 0) : len(c);
    takes.push({ name: t.name, src: t.src || "output", in: n(t.in, 0), out: n(t.out, n(t.dur, 0)), dur: t.dur != null ? n(t.dur, 0) : null });
    var o = withTake(Object.assign({}, c, { slot: slot }), takes[takes.length - 1]);
    o.takes = takes; o.take = takes.length - 1; o.slot = r4(slot);
    return o;
  }
  function useTake(c, i) {
    var takes = c.takes || [];
    if (!takes[i]) return c;
    var o = withTake(c, takes[i]); o.takes = takes; o.take = i;
    return o;
  }
  function rippleAfter(clips, from, by) {
    return (clips || []).map(function (x) { return n(x.start, 0) >= from - EPS ? Object.assign({}, x, { start: r4(n(x.start, 0) + by) }) : x; });
  }
  function beatCuts(beats, c, every, srcOff) {
    var k = Math.max(1, Math.round(n(every, 1))), off = n(srcOff, 0), a = n(c.start, 0), b = a + len(c), out = [];
    (beats || []).forEach(function (bt, i) {
      if (i % k) return;
      var t = r4(off + n(bt, 0));
      if (t > a + 0.05 && t < b - 0.05) out.push(t);
    });
    return out;
  }
  function beatMarks(beats, srcOff, every, from, to) {
    var k = Math.max(1, Math.round(n(every, 1))), off = n(srcOff, 0), out = [];
    (beats || []).forEach(function (bt, i) { var t = r4(off + n(bt, 0)); if (!(i % k) && t >= n(from, -1e9) - EPS && t <= n(to, 1e9) + EPS) out.push(t); });
    return out;
  }
  return { len: len, gapAt: gapAt, size: size, frames: frames, take: take, withTake: withTake, addTake: addTake, useTake: useTake,
           rippleAfter: rippleAfter, beatCuts: beatCuts, beatMarks: beatMarks };
});
