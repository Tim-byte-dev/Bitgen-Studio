/* bitGen Studio — static/tlrender.js (2.418.0): REAL-TIME PLAYBACK maths (Premiere's render bar + "Render In to Out"),
 * shared by the page (ext/timelinedock/tlrender.js ⚡), the server (lib/tlRender.js) and the unit tests
 * (window.H3TlRender / require).
 *
 * Tim: "continue with the next part please the gap is getting smaller - soon bitgen should be superior" (the last row:
 * "GPU real-time playback").
 *
 *   cuts(tl, lenOf)            -> the sorted moments where any picture layer's clip starts or ends (0 .. the end)
 *   stretches(tl, o)           -> [{a, b, cost, level: "ok" | "yellow" | "red", why: [..], fp}] - the timeline cut at
 *                                 every clip edge; cost = what the canvas must do per frame there (decodes, grades,
 *                                 effects, masks, keys, retimes it seeks frame by frame, 3D, adjustment layers); fp =
 *                                 a fingerprint of everything that decides that stretch's picture (a change there -
 *                                 and only there - makes it red / yellow again)
 *   status(st, rendered)       -> st with .rendered (its fp is in the render) - Premiere's GREEN
 *   at(list, t)                -> the stretch under t
 *   costOf(c, kind, L)         -> one clip's cost + why
 *   hash(s)                    -> FNV-1a 32-bit, 8 hex digits
 * o = {lenOf(c, kind), fx (static/clipfx.js), yellow: 3, red: 6}
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.H3TlRender = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var YELLOW = 3, RED = 6;
  var HEAVY = ["blur", "sharpen", "glow", "grain", "vignette", "lens", "mirror", "warp", "stabilise"];

  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  function hash(s) {
    var h = 0x811c9dc5;
    s = String(s);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ("0000000" + h.toString(16)).slice(-8);
  }
  function FXof(o) {
    if (o && o.fx) return o.fx;
    if (typeof self !== "undefined" && self.H3ClipFx) return self.H3ClipFx;
    try { return require("./clipfx.js"); } catch (e) { return null; }
  }
  /** a clip's length on the timeline (retimed clips by their own maths) */
  function defaultLen(FX) {
    return function (c, kind) {
      if (kind === "img") return Math.max(0.04, num(c.len, 3));
      var i0 = num(c.in, 0), o0 = c.out != null ? num(c.out, 0) : num(c.dur, 0), L = Math.max(0, o0 - i0);
      if (FX && c.fx && FX.retimed && FX.retimed(c.fx)) { try { return FX.timelineLen(L, FX.normalize(c.fx)); } catch (e) { return L; } }
      return L;
    };
  }
  function layers(tl) {
    var out = [];
    var v1 = tl.v1 || {};
    out.push({ lk: "v1", kind: "v1", L: v1, clips: tl.video || [] });
    (tl.vlayers || []).forEach(function (L, i) { out.push({ lk: "vl:" + i, kind: "vl", L: L, clips: L.clips || [] }); });
    (tl.images || []).forEach(function (L, i) { out.push({ lk: "i:" + i, kind: "img", L: L, clips: L.clips || [] }); });
    return out.filter(function (x) { return x.L.visible !== false; });
  }
  function cuts(tl, lenOf) {
    var s = { "0.0000": 1 };
    layers(tl || {}).forEach(function (Ly) {
      Ly.clips.forEach(function (c) {
        var a = num(c.start, 0), b = a + lenOf(c, Ly.kind);
        s[a.toFixed(4)] = 1; s[b.toFixed(4)] = 1;
      });
    });
    return Object.keys(s).map(Number).sort(function (x, y) { return x - y; });
  }
  function costOf(c, kind, L, FX) {
    var why = [], cost = 0;
    var add = function (n, w) { cost += n; why.push(w); };
    if (c.m3d) add(3, "3D");
    else if (c.adjust) add(2, "adjustment layer");
    else if (kind === "img") add(c.text && c.text.fx ? 0.5 : 0.2, c.text ? "text" : "picture");
    else add(kind === "v1" ? 0.6 : 1, "video");
    var fx = c.fx && FX && FX.normalize ? FX.normalize(c.fx) : (c.fx || null);
    if (fx) {
      if (FX && FX.graded && FX.graded(fx)) add(1, "grade");
      var v = fx.vfx || {};
      HEAVY.forEach(function (k) { if (v[k]) add(k === "stabilise" ? 0.5 : 1, k); });
      if (v.key) add(1, "key");
      if (v.crop) add(0.2, "crop");
      if (fx.mask) add(fx.mask.track ? 2 : 1.5, "mask");
      if (fx.reverse || fx.ramp) add(1.5, fx.reverse ? "reversed" : "ramp");
    }
    if (c.kf && c.kf.length) add(0.2, "keyframes");
    if (L && L.opacity != null && +L.opacity < 1) add(0.2, "layer opacity");
    return { cost: +cost.toFixed(2), why: why };
  }
  var DROP = ["thumb", "_sel", "sel"];
  function fpClip(c) {
    var o = {};
    Object.keys(c).sort().forEach(function (k) { if (DROP.indexOf(k) < 0 && k.charAt(0) !== "_") o[k] = c[k]; });
    return o;
  }
  function stretches(tl, o) {
    o = o || {};
    var FX = FXof(o), lenOf = o.lenOf || defaultLen(FX);
    var Y = num(o.yellow, YELLOW), R = num(o.red, RED);
    var T = tl || {}, Ls = layers(T), ct = cuts(T, lenOf), out = [];
    var glob = JSON.stringify([T.captions && T.captions.visible !== false ? T.captions : null, T.w || null, T.h || null]);
    for (var i = 0; i + 1 < ct.length; i++) {
      var a = ct[i], b = ct[i + 1];
      if (b - a < 1e-4) continue;
      var mid = (a + b) / 2, cost = 0, why = [], parts = [];
      Ls.forEach(function (Ly) {
        Ly.clips.forEach(function (c) {
          var s = num(c.start, 0), e = s + lenOf(c, Ly.kind);
          if (mid < s || mid >= e) return;
          var k = costOf(c, Ly.kind, Ly.L, FX);
          cost += k.cost; k.why.forEach(function (w) { if (why.indexOf(w) < 0) why.push(w); });
          parts.push([Ly.lk, Ly.L.opacity == null ? 1 : +Ly.L.opacity, Ly.L.transitionIn || null, Ly.L.transitionOut || null, fpClip(c)]);
        });
      });
      // two or more layers on top of each other: blending them is work of its own
      if (parts.length > 1) cost += 0.3 * (parts.length - 1);
      cost = +cost.toFixed(2);
      out.push({ a: +a.toFixed(4), b: +b.toFixed(4), cost: cost, level: cost >= R ? "red" : cost >= Y ? "yellow" : "ok", why: why,
                 fp: hash(a.toFixed(4) + "|" + b.toFixed(4) + "|" + glob + "|" + JSON.stringify(parts)) });
    }
    return out;
  }
  function status(list, rendered) {
    var have = {};
    ((rendered && rendered.fps) || []).forEach(function (f) { have[f] = 1; });
    return list.map(function (s) { return Object.assign({}, s, { rendered: !!have[s.fp] }); });
  }
  function at(list, t) {
    for (var i = 0; i < list.length; i++) if (t >= list[i].a - 1e-6 && t < list[i].b - 1e-6) return list[i];
    return null;
  }
  return { cuts: cuts, stretches: stretches, status: status, at: at, costOf: function (c, kind, L) { return costOf(c, kind, L, FXof()); },
           hash: hash, YELLOW: YELLOW, RED: RED };
});
