/* bitGen Studio — static/multicam.js (2.416.0): 🎥 MULTI-CAMERA editing as plain maths (window.H3Multicam) - the page
 * (ext/timelinedock/multicam.js) and the unit tests load this one file.
 *
 * Tim: "continue with the next part please the gap is getting smaller - soon bitgen should be superior".
 *
 * tl.multicam = {angles: [{name, src, off (where the angle's first frame sits on the timeline), dur, label}],
 *                sound (the angle whose sound the program plays), cuts: [{t, a}] (from t on: angle a)}
 *   range(mc)              -> {a, b} the stretch any angle covers
 *   switchAt(mc, t, a)     -> the cuts with angle a from t (to the next cut); a cut on the same frame replaced; two cuts
 *                             in a row to the same angle become one
 *   program(mc, fps)       -> V1's clips: one per cut, each the angle's file from (t - off), its own sound OUT (the
 *                             program's sound is the sound angle's - soundClip); a stretch the angle does not cover is
 *                             left out (a gap: black)
 *   soundClip(mc)          -> the sound angle's file as one sound clip under the whole program
 *   angleAt(mc, t)         -> the angle playing at t
 *   fromSync(clips, res)   -> angles from clips + audiosync's lags (the first clip = the reference, kept where it is)
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.H3Multicam = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  function n(v, d) { var x = Number(v); return Number.isFinite(x) ? x : d; }
  function r4(v) { return Math.round(v * 10000) / 10000; }
  function range(mc) {
    var A = (mc && mc.angles) || [];
    if (!A.length) return { a: 0, b: 0 };
    return { a: Math.min.apply(null, A.map(function (x) { return n(x.off, 0); })), b: Math.max.apply(null, A.map(function (x) { return n(x.off, 0) + n(x.dur, 0); })) };
  }
  function tidy(cuts) {
    var c = (cuts || []).slice().sort(function (p, q) { return p.t - q.t; }), out = [];
    c.forEach(function (x) { if (!out.length || out[out.length - 1].a !== x.a) out.push({ t: r4(x.t), a: x.a }); });
    return out;
  }
  function switchAt(mc, t, a, fps) {
    var half = 0.5 / (fps || 25), R = range(mc);
    t = Math.max(R.a, n(t, 0));
    var cuts = (mc.cuts || []).filter(function (c) { return Math.abs(c.t - t) > half; });
    cuts.push({ t: t, a: a });
    if (!cuts.some(function (c) { return c.t <= R.a + half; })) cuts.push({ t: R.a, a: (mc.cuts && mc.cuts[0] && mc.cuts[0].a) || 0 });
    return tidy(cuts);
  }
  function angleAt(mc, t) {
    var cuts = tidy(mc.cuts), a = cuts.length ? cuts[0].a : 0;
    cuts.forEach(function (c) { if (c.t <= t + 1e-6) a = c.a; });
    return a;
  }
  function program(mc, fps) {
    var cuts = tidy(mc.cuts), R = range(mc), out = [], F = fps || 25, snap = function (v) { return Math.round(v * F) / F; };
    if (!cuts.length) cuts = [{ t: R.a, a: 0 }];
    cuts.forEach(function (c, i) {
      var A = mc.angles[c.a]; if (!A) return;
      var t0 = Math.max(c.t, R.a), t1 = i + 1 < cuts.length ? cuts[i + 1].t : R.b;
      var a0 = Math.max(t0, n(A.off, 0)), a1 = Math.min(t1, n(A.off, 0) + n(A.dur, 0));   // what the angle covers
      if (a1 - a0 < 0.5 / F) return;
      out.push({ name: A.name, src: A.src || "video", in: r4(snap(a0 - n(A.off, 0))), out: r4(snap(a1 - n(A.off, 0))), dur: n(A.dur, 0),
                 start: r4(snap(a0)), opacity: 1, soundOut: true, mc: c.a });
    });
    return out;
  }
  function soundClip(mc) {
    var A = mc.angles[n(mc.sound, 0)] || mc.angles[0];
    if (!A) return null;
    return { name: A.name, src: A.src || "video", in: 0, out: n(A.dur, 0), dur: n(A.dur, 0), start: r4(n(A.off, 0)), mcSound: true };
  }
  function fromSync(clips, res) {
    var ref = clips[0], base = n(ref.start, 0) - n(ref.in, 0);       // where the reference FILE's first second sits
    var A = [{ name: ref.name, src: ref.src || "video", off: r4(base), dur: n(ref.dur, n(ref.out, 0)), label: "1" }], bad = [];
    clips.slice(1).forEach(function (c, i) {
      var r = res[i] || {};
      if (!r.ok) bad.push({ name: c.name, why: r.why || "no match" });
      A.push({ name: c.name, src: c.src || "video", off: r4(r.ok ? base + n(r.lag, 0) : n(c.start, 0) - n(c.in, 0)), dur: n(c.dur, n(c.out, 0)), label: String(i + 2), unsynced: !r.ok || undefined });
    });
    return { angles: A, bad: bad };
  }
  return { range: range, switchAt: switchAt, angleAt: angleAt, program: program, soundClip: soundClip, fromSync: fromSync, tidy: tidy };
});
