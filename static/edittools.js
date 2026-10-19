/* bitGen Studio — static/edittools.js (2.407.0): the timeline's EDIT TOOLS as pure maths - RIPPLE (trim an edge and
 * move everything after it), ROLL (move the cut between two touching clips), SLIP (change which part of the source a
 * clip shows, keeping its place and length), SLIDE (move a clip between its neighbours, which give and take).
 * The page (ext/timelinedock/edittools.js) and the unit tests load this one file. Times are TIMELINE seconds; a 🎬
 * retimed clip converts through its own time map (static/clipfx.js) - 2.413.0: reversed and ramped clips too, frame-exact.
 * Tim: "can we do the pipelines, editing tools, colour and export now, keep track of what is left to do". */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./clipfx.js"));
  else root.H3EditTools = factory(root.H3ClipFx);
})(typeof self !== "undefined" ? self : this, function (FX) {
  "use strict";
  var MIN = 0.1, EPS = 0.05;
  function n(v, d) { var x = Number(v); return Number.isFinite(x) ? x : d; }
  function r4(v) { return Math.round(v * 10000) / 10000; }
  function outOf(c) { return c.out != null ? n(c.out, 0) : n(c.dur, n(c.in, 0) + 5); }
  function len(c) { var L = FX ? FX.clipLen(Object.assign({}, c, { out: outOf(c) })) : null; return L != null ? L : outOf(c) - n(c.in, 0); }
  function rate(c) { return FX && c.fx && FX.retimed(c.fx) ? FX.rate(Object.assign({}, c, { out: outOf(c) })) : 1; }
  function reversed(c) { return !!(c && c.fx && c.fx.reverse); }
  function retimed(c) { return !!(FX && c && c.fx && FX.retimed(c.fx)); }
  function maxSrc(c) { return c.dur != null ? n(c.dur, Infinity) : Infinity; }
  function copy(c) { return c ? Object.assign({}, c) : c; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* 2.413.0 (Tim: "do the smaller jobs and complete the 10 partly done jobs"): every tool works on REVERSED and RAMPED
   * clips, FRAME-EXACT - an edge is moved through the clip's own time map (static/clipfx.js srcTime / slice), not an
   * average rate. A reversed clip's LEFT edge is its source OUT. Shortening keeps exactly the frames that were inside;
   * lengthening plays the new source at the speed the clip has at that edge (a ramp gets a key there). */
  /** the speed (source s per timeline s) at the clip's left ("l") / right ("r") edge */
  function edgeSpeed(c, side) {
    if (!retimed(c)) return 1;
    var fx = c.fx;
    if (fx.remap) return 0;                                            // 2.501.0: a remapped clip's edge is held (see trimEdge)
    var s = fx.ramp ? FX.speedAt(fx, side === "l" ? 0 : 1) : (fx.speed || 1);
    return Math.max(FX.SPEED[0], Math.min(FX.SPEED[1], s));
  }
  /** how far (timeline s) an edge can move OUTWARD - the source left beside it, at its speed */
  function room(c, side) {
    var i0 = n(c.in, 0), o0 = outOf(c), rev = reversed(c);
    if (c.fx && c.fx.remap) return 600;                              // 2.501.0: lengthening a remapped clip holds its edge frame
    var src = (side === "l") !== rev ? i0 : maxSrc(c) - o0;          // forward left / reversed right: before in
    return src / edgeSpeed(c, side);
  }
  /** c with its edge moved by d TIMELINE seconds (+ = to the right): {in, out, fx?} - start is the caller's */
  function trimEdge(c, side, d) {
    var L = len(c), i0 = n(c.in, 0), o0 = outOf(c), out = { in: i0, out: o0 };
    if (c.fx) out.fx = c.fx;
    var shrink = side === "l" ? d : -d;
    if (Math.abs(d) < 1e-9) return out;
    if (shrink > 0) {                                                  // keep [a, b] of the clip's own time
      var a = side === "l" ? Math.min(shrink, L - MIN) : 0, b = side === "l" ? L : Math.max(MIN, L - shrink);
      if (!retimed(c)) { if (side === "l") out.in = r4(i0 + a); else out.out = r4(i0 + b); return out; }
      var sl = FX.slice(Object.assign({}, c, { out: o0 }), a, b);
      out.in = sl.in; out.out = sl.out; if (sl.fx) out.fx = sl.fx;
      return out;
    }
    var e = Math.min(-shrink, room(c, side)), s = edgeSpeed(c, side), ext = e * s, rev = reversed(c);
    if (e <= 1e-9) return out;
    if (c.fx && c.fx.remap) {                                          // 2.501.0: TIME REMAP - the edge frame held for the new time
      var rk = c.fx.remap.map(function (k) { return { t: k.t, q: k.q }; });
      if (side === "r") rk.push({ t: r4(rk[rk.length - 1].t + e), q: rk[rk.length - 1].q });
      else { rk.forEach(function (k) { k.t = r4(k.t + e); }); rk.unshift({ t: 0, q: rk[0].q }); }
      out.fx = FX.normalize(Object.assign({}, c.fx, { remap: rk.slice(0, 64) })) || c.fx;
      return out;
    }
    var before = (side === "l") !== rev;                               // the new source lies before `in`
    if (before) out.in = r4(i0 - ext); else out.out = r4(o0 + ext);
    if (retimed(c) && c.fx.ramp) {                                     // the ramp's keys moved into the longer source, a key at the new edge
      var L0 = o0 - i0, L1 = L0 + ext, keys = [];
      c.fx.ramp.forEach(function (k) { keys.push({ p: r4(side === "l" ? (ext + k.p * L0) / L1 : (k.p * L0) / L1), s: k.s }); });
      if (side === "l") keys.unshift({ p: 0, s: r4(s) }); else keys.push({ p: 1, s: r4(s) });
      out.fx = FX.normalize(Object.assign({}, c.fx, { ramp: keys.slice(0, 8) })) || c.fx;
    }
    return out;
  }
  function apply(c, t) { var y = copy(c); y.in = t.in; y.out = t.out; if (t.fx) y.fx = t.fx; return y; }

  /** the clips that touch c on its left / right on the same layer */
  function neighbours(clips, c) {
    var s = n(c.start, 0), e = s + len(c), prev = null, next = null;
    (clips || []).forEach(function (x) {
      if (x === c) return;
      var xs = n(x.start, 0), xe = xs + len(x);
      if (Math.abs(xe - s) < EPS) prev = x;
      if (Math.abs(xs - e) < EPS) next = x;
    });
    return { prev: prev, next: next };
  }

  /** SLIP by d timeline seconds (positive = later frames): {in, out} - same place, same length (a reversed clip: later
   * frames at the same place = the source window moved the other way through it, so the shot runs on from later) */
  function slip(c, d) {
    var r = rate(c), i0 = n(c.in, 0), o0 = outOf(c), ds = clamp(d * r, -i0, maxSrc(c) - o0);
    return { in: r4(i0 + ds), out: r4(o0 + ds), moved: r4(ds / r) };
  }

  /** ROLL the cut between a (left) and b (right) by d: {a, b, moved} */
  function roll(a, b, d) {
    var lo = Math.max(-(len(a) - MIN), -room(b, "l")), hi = Math.min(room(a, "r"), len(b) - MIN);
    var dd = clamp(d, lo, hi), A = apply(a, trimEdge(a, "r", dd)), B = apply(b, trimEdge(b, "l", dd));
    B.start = r4(n(b.start, 0) + dd);
    return { a: A, b: B, moved: r4(dd) };
  }

  /** SLIDE c by d between prev and next (either may be null): {prev, c, next, moved} */
  function slide(prev, c, next, d) {
    var lo = -n(c.start, 0), hi = Infinity;
    if (prev) { lo = Math.max(lo, -(len(prev) - MIN)); hi = Math.min(hi, room(prev, "r")); }
    if (next) { lo = Math.max(lo, -room(next, "l")); hi = Math.min(hi, len(next) - MIN); }
    var dd = clamp(d, lo, hi), C = copy(c);
    C.start = r4(n(c.start, 0) + dd);
    var P = prev ? apply(prev, trimEdge(prev, "r", dd)) : prev;
    var N = next ? apply(next, trimEdge(next, "l", dd)) : next;
    if (N) N.start = r4(n(next.start, 0) + dd);
    return { prev: P, c: C, next: N, moved: r4(dd) };
  }

  /** RIPPLE trim c's head ("l") or tail ("r") by d: the layer's clips (copies) with everything after it moved */
  function ripple(clips, c, side, d) {
    var L0 = len(c), end0 = n(c.start, 0) + L0, dd = side === "l" ? clamp(d, -room(c, "l"), L0 - MIN) : clamp(d, -(L0 - MIN), room(c, "r"));
    var out = (clips || []).map(function (x) { return x === c ? apply(x, trimEdge(x, side, dd)) : x; });
    var C = out[(clips || []).indexOf(c)];
    var delta = len(C) - L0;
    return { clips: out.map(function (x) {
      if (x === C || n(x.start, 0) < end0 - EPS) return x;
      var y = copy(x); y.start = r4(Math.max(0, n(x.start, 0) + delta)); return y;
    }), moved: r4(delta) };
  }

  return { MIN: MIN, len: len, rate: rate, neighbours: neighbours, slip: slip, roll: roll, slide: slide, ripple: ripple,
           trimEdge: trimEdge, room: room, edgeSpeed: edgeSpeed };
});
