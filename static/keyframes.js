/* bitGen Studio — static/keyframes.js (2.379.0): ONE keyframe / tween maths for the page, the canvas, the exporter and
 * the unit tests (worker.py mirrors it for the compile: _kf_value / _kf_expr - a fix here belongs there too).
 *
 * Tim: "say we add a text to the preview canvas add a keyframe to the timeline on that text layer then add another
 * keyframe at a different time and scale or move or change color can we create a tween between the keyframes?"
 *
 * A clip may carry kf: [{at, op?, vol?, x?, y?, scale?, rot?, color?, ease?}]
 *   at     seconds from the CLIP's start (keyframes ride along when the clip moves - After Effects)
 *   op     opacity 0..1          vol  volume 0..1.5
 *   x, y   the clip's centre, pixels from the picture's centre (lib/clipTransform)   scale  1 = its own size
 *   rot    degrees clockwise     color  "#rrggbb" (a TEXT layer's fill)
 *   ease   how the tween LEAVES this keyframe for the next one: linear (default) | in (slow start) | out (slow end)
 *          | inout (slow start and end) | hold (no tween: the value jumps at the next keyframe)
 * Each property tweens between the keyframes that set IT (a keyframe may set only some properties); before its first
 * keyframe a property holds the first value, after the last it holds the last; no keyframe for it = the clip's static
 * value (the caller's fallback). Colours tween channel by channel (sRGB).
 *
 * 2.489.0 (Tim: "go with 1,2,4,5 and 6" - After Effects' graph editor, keyframes on more properties, Bézier motion paths):
 *   ease "bezier" + bz [x1, y1, x2, y2]   a cubic-Bézier speed curve for the tween LEAVING this key (CSS's cubic-bezier:
 *          x = time 0..1, y = progress; y may overshoot) - the graph editor's handles; Easy Ease = [0.333, 0, 0.667, 1].
 *          The old eases are exact Béziers too (bzOf): in = [1/3, 0, 2/3, 1/3], out = [1/3, 2/3, 2/3, 1], inout = [1/3, 0, 2/3, 1]
 *   to [dx, dy] / ti [dx, dy]   a POSITION key's spatial tangents (out of / into the key, pixels): x and y follow a cubic
 *          Bézier path P0 = a, P1 = a + a.to, P2 = b + b.ti, P3 = b at the eased progress - a curved motion path
 *   ax, ay   the anchor point: pixels from the clip's centre (at scale 1) that position places, scales and turns about
 * 2.496.0 (Tim: "roving keyframes"):
 *   rove: true   a POSITION key that ROVES across time: rove(kf) sets its time so the layer travels at an even speed
 *          from the last key that does not rove to the next one (by the path's length - curved paths too); the tweens
 *          in that stretch become linear. The first / last position key never roves. A roving key that also sets
 *          other things (scale, opacity …) leaves those behind at its old time. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.H3Keyframes = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var NUM = ["op", "vol", "x", "y", "scale", "rot", "ax", "ay"];
  var PROPS = NUM.concat(["color"]);
  var EASES = ["linear", "in", "out", "inout", "hold", "bezier"];
  var LIMITS = { op: [0, 1], vol: [0, 1.5], x: [-20000, 20000], y: [-20000, 20000], scale: [0.01, 20], rot: [-3600, 3600], ax: [-20000, 20000], ay: [-20000, 20000] };
  var EASY = [0.333, 0, 0.667, 1];
  var BZ = { linear: [1 / 3, 1 / 3, 2 / 3, 2 / 3], "in": [1 / 3, 0, 2 / 3, 1 / 3], out: [1 / 3, 2 / 3, 2 / 3, 1], inout: [1 / 3, 0, 2 / 3, 1] };
  /* the Bézier a key's ease amounts to (hold = null) */
  function bzOf(k) { if (!k || k.ease === "hold") return null; if (k.ease === "bezier" && okBz(k.bz)) return k.bz.slice(); return (BZ[k.ease] || BZ.linear).slice(); }
  function okBz(b) { return Array.isArray(b) && b.length === 4 && b.every(function (v) { return Number.isFinite(+v); }); }
  /* CSS cubic-bezier(x1, y1, x2, y2) at time f: x(s) = f solved (Newton, then halving), y(s) returned */
  function bezier(b, f) {
    var x1 = Math.max(0, Math.min(1, +b[0])), y1 = +b[1], x2 = Math.max(0, Math.min(1, +b[2])), y2 = +b[3];
    var bx = function (s) { var u = 1 - s; return 3 * u * u * s * x1 + 3 * u * s * s * x2 + s * s * s; };
    var by = function (s) { var u = 1 - s; return 3 * u * u * s * y1 + 3 * u * s * s * y2 + s * s * s; };
    var dx = function (s) { var u = 1 - s; return 3 * u * u * x1 + 6 * u * s * (x2 - x1) + 3 * s * s * (1 - x2); };
    var s = f;
    for (var i = 0; i < 8; i++) { var e = bx(s) - f, d = dx(s); if (Math.abs(e) < 1e-7) return by(s); if (Math.abs(d) < 1e-6) break; s = Math.max(0, Math.min(1, s - e / d)); }
    var lo = 0, hi = 1; s = f;
    for (var j = 0; j < 40; j++) { var v = bx(s); if (Math.abs(v - f) < 1e-7) break; if (v < f) lo = s; else hi = s; s = (lo + hi) / 2; }
    return by(s);
  }
  var FPS = 24;

  function ease(name, f, bz) {
    f = f < 0 ? 0 : f > 1 ? 1 : f;
    switch (name) {
      case "bezier": return okBz(bz) ? bezier(bz, f) : f;
      case "in": return f * f;
      case "out": return 1 - (1 - f) * (1 - f);
      case "inout": return f * f * (3 - 2 * f);
      case "hold": return 0;
      default: return f;
    }
  }
  function hex(c) {
    var s = String(c == null ? "" : c).trim().toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(s)) s = "#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
    return /^#[0-9a-f]{6}$/.test(s) ? s : null;
  }
  function rgb(c) { var h = hex(c) || "#ffffff"; return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function toHex(a) {
    return "#" + a.map(function (v) { var n = Math.max(0, Math.min(255, Math.round(v))); return (n < 16 ? "0" : "") + n.toString(16); }).join("");
  }
  function mixColor(a, b, f) {
    var A = rgb(a), B = rgb(b);
    return toHex([A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f]);
  }
  function keysFor(kf, prop) {
    return (Array.isArray(kf) ? kf : []).filter(function (k) { return k && k[prop] != null && Number.isFinite(+k.at); })
      .slice().sort(function (a, b) { return a.at - b.at; });
  }
  function has(kf, prop) { return keysFor(kf, prop).length > 0; }
  function animates(kf, props) {
    return (props || PROPS).some(function (p) { return keysFor(kf, p).length > 1; });
  }
  /* the value of `prop` at `at` seconds into the clip */
  function value(kf, at, prop, fb) {
    var ks = keysFor(kf, prop);
    if (!ks.length) return fb;
    var isC = prop === "color";
    var v = function (k) { return isC ? (hex(k[prop]) || "#ffffff") : +k[prop]; };
    if (at <= ks[0].at) return v(ks[0]);
    var last = ks[ks.length - 1];
    if (at >= last.at) return v(last);
    for (var i = 0; i < ks.length - 1; i++) {
      var a = ks[i], b = ks[i + 1];
      if (at >= a.at && at < b.at) {
        var f = ease(a.ease, (at - a.at) / Math.max(1e-9, b.at - a.at), a.bz);
        if (isC) return mixColor(v(a), v(b), f);
        var ix = prop === "x" ? 0 : prop === "y" ? 1 : -1;
        if (ix >= 0 && a.ease !== "hold" && (okT(a.to) || okT(b.ti))) {           // 2.489.0: a curved motion path
          var p0 = v(a), p3 = v(b), p1 = p0 + (okT(a.to) ? +a.to[ix] : 0), p2 = p3 + (okT(b.ti) ? +b.ti[ix] : 0), u = 1 - f;
          return u * u * u * p0 + 3 * u * u * f * p1 + 3 * u * f * f * p2 + f * f * f * p3;
        }
        return v(a) + (v(b) - v(a)) * f;
      }
    }
    return v(last);
  }
  function okT(t) { return Array.isArray(t) && t.length === 2 && Number.isFinite(+t[0]) && Number.isFinite(+t[1]) && (+t[0] !== 0 || +t[1] !== 0); }
  /* 2.489.0: the speed of `prop` at `at` (units per second; the graph editor's speed graph) */
  function speed(kf, at, prop, fb) { var h = 1 / 240; return (value(kf, at + h, prop, fb) - value(kf, at - h, prop, fb)) / (2 * h); }
  function snap(t, fps) { var F = fps || FPS; return Math.round(Math.max(0, +t || 0) * F) / F; }
  /* insert or update the keyframe at `at` (frame-snapped; within half a frame = the same keyframe) -> a NEW array */
  function set(kf, at, vals, fps) {
    var t = snap(at, fps), F = fps || FPS;
    var out = (Array.isArray(kf) ? kf : []).map(function (k) { return Object.assign({}, k); });
    var k = out.find(function (x) { return Math.abs(x.at - t) < 0.5 / F; });
    if (!k) { k = { at: t }; out.push(k); }
    Object.keys(vals || {}).forEach(function (p) { if (vals[p] === undefined) delete k[p]; else k[p] = vals[p]; });
    out.sort(function (a, b) { return a.at - b.at; });
    return out;
  }
  function find(kf, at, fps) {
    var t = snap(at, fps), F = fps || FPS;
    return (Array.isArray(kf) ? kf : []).find(function (x) { return Math.abs(x.at - t) < 0.5 / F; }) || null;
  }
  function remove(kf, at, fps) {
    var t = snap(at, fps), F = fps || FPS;
    return (Array.isArray(kf) ? kf : []).filter(function (x) { return Math.abs(x.at - t) >= 0.5 / F; });
  }
  /* the next / previous keyframe time after / before `at` (null = none) */
  function step(kf, at, dir) {
    var ts = (Array.isArray(kf) ? kf : []).map(function (k) { return +k.at; }).sort(function (a, b) { return a - b; });
    var eps = 0.5 / FPS;
    if (dir > 0) { for (var i = 0; i < ts.length; i++) if (ts[i] > at + eps) return ts[i]; }
    else { for (var j = ts.length - 1; j >= 0; j--) if (ts[j] < at - eps) return ts[j]; }
    return null;
  }
  /* a clean copy for the exporter: known properties only, numbers clamped, at most 400 keyframes; [] -> undefined */
  function normalize(kf) {
    if (!Array.isArray(kf)) return undefined;
    var out = [];
    kf.forEach(function (k) {
      if (!k || typeof k !== "object") return;
      var at = Number(k.at);
      if (!Number.isFinite(at) || at < 0 || at > 86400) return;
      var o = { at: Math.round(at * 1000) / 1000 }, n = 0;
      NUM.forEach(function (p) {
        if (k[p] == null || k[p] === "") return;
        var v = Number(k[p]);
        if (!Number.isFinite(v)) return;
        var L = LIMITS[p];
        o[p] = Math.round(Math.max(L[0], Math.min(L[1], v)) * 10000) / 10000; n++;
      });
      if (k.color != null && hex(k.color)) { o.color = hex(k.color); n++; }
      if (EASES.indexOf(k.ease) > 0) o.ease = k.ease;
      if (o.ease === "bezier") { if (okBz(k.bz)) o.bz = [0, 1, 2, 3].map(function (i) { var b = +k.bz[i]; return Math.round((i % 2 === 0 ? Math.max(0, Math.min(1, b)) : Math.max(-2, Math.min(3, b))) * 10000) / 10000; }); else delete o.ease; }
      ["to", "ti"].forEach(function (p) { if (okT(k[p]) && o.x != null) o[p] = k[p].map(function (v) { return Math.round(Math.max(-20000, Math.min(20000, +v)) * 100) / 100; }); });
      if (n) out.push(o);
    });
    out.sort(function (a, b) { return a.at - b.at; });
    return out.length ? out.slice(0, 400) : undefined;
  }
  /** 2.496.0: ROVING position keys timed for an even speed between the keys that do not rove -> a new kf array */
  function rove(kf) {
    if (!Array.isArray(kf) || !kf.some(function (k) { return k && k.rove; })) return kf;
    var out = kf.map(function (k) { return Object.assign({}, k); }), extra = [];
    var ks = out.filter(function (k) { return k && k.x != null && k.y != null; }).sort(function (a, b) { return a.at - b.at; });
    if (ks.length) { delete ks[0].rove; delete ks[ks.length - 1].rove; }
    var segLen = function (a, b) {                // the path's length a -> b (its Bézier when it has tangents)
      if (!okT(a.to) && !okT(b.ti)) return Math.hypot(b.x - a.x, b.y - a.y);
      var p0 = [a.x, a.y], p1 = [a.x + (okT(a.to) ? +a.to[0] : 0), a.y + (okT(a.to) ? +a.to[1] : 0)], p2 = [b.x + (okT(b.ti) ? +b.ti[0] : 0), b.y + (okT(b.ti) ? +b.ti[1] : 0)], p3 = [b.x, b.y], L = 0, q = p0;
      for (var i = 1; i <= 32; i++) { var u = i / 32, v = 1 - u, pt = [0, 1].map(function (c) { return v * v * v * p0[c] + 3 * v * v * u * p1[c] + 3 * v * u * u * p2[c] + u * u * u * p3[c]; }); L += Math.hypot(pt[0] - q[0], pt[1] - q[1]); q = pt; }
      return L;
    };
    var i = 0;
    while (i < ks.length - 1) {
      var j = i + 1; while (j < ks.length - 1 && ks[j].rove) j++;
      if (j > i + 1) {
        var cum = [0]; for (var m = i; m < j; m++) cum.push(cum[cum.length - 1] + segLen(ks[m], ks[m + 1]));
        var tot = cum[cum.length - 1], t0 = ks[i].at, t1 = ks[j].at;
        for (m = i + 1; m < j; m++) {
          var K = ks[m], others = {}, any = false;
          Object.keys(K).forEach(function (p) { if (["at", "x", "y", "to", "ti", "rove", "ease", "bz"].indexOf(p) < 0) { others[p] = K[p]; any = true; delete K[p]; } });
          if (any) { others.at = K.at; extra.push(others); }
          K.at = Math.round((tot > 1e-9 ? t0 + (t1 - t0) * cum[m - i] / tot : t0 + (t1 - t0) * (m - i) / (j - i)) * 1000) / 1000;
        }
        for (m = i; m < j; m++) { delete ks[m].ease; delete ks[m].bz; }     // an even speed: straight tweens in the stretch
      }
      i = j;
    }
    return out.concat(extra).sort(function (a, b) { return a.at - b.at; });
  }
  return { rove: rove, NUM: NUM, PROPS: PROPS, EASES: EASES, LIMITS: LIMITS, FPS: FPS, ease: ease, hex: hex, rgb: rgb, mixColor: mixColor,
           keysFor: keysFor, has: has, animates: animates, value: value, snap: snap, set: set, find: find, remove: remove,
           step: step, normalize: normalize, bezier: bezier, bzOf: bzOf, okBz: okBz, okT: okT, EASY: EASY, speed: speed };
});
