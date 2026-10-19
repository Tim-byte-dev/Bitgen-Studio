/* bitGen Studio — static/clipfx.js (2.406.0): ONE maths for a timeline clip's SPEED / REVERSE / RAMP and its COLOUR
 * GRADE / LUT - the page (timeline, canvas preview), the server (route, span, keep / cut) and the unit tests load this
 * same file (lib/clipFx.js re-exports it), so the preview and the compile cannot disagree.
 *
 * Tim: "what tools does adobe premier that bitgen doesn't?" -> "lets start closing the gap and go with your
 * suggestions as you see fit" (speed ramps / reverse, a colour grade with LUTs, caption tracks, audio clean-up + ducking).
 *
 * A video clip may carry fx: {
 *   speed    0.1 .. 10 (1 = as shot)                         reverse  play it backwards
 *   ramp     [{p, s}] the speed along the clip: p = 0..1 of the source range in PLAYED order, s = the speed there
 *            (2-8 keys; it overrides `speed`); between keys the speed changes linearly
 *   remap    2.500.1 / 2.501.0 TIME REMAPPING (Tim: "... the rest of the After Effects gap list"): [{t, q}] - at t seconds
 *            into the clip on the timeline the SOURCE second q (from the clip's in point) shows; straight between keys
 *            (2-64 keys, t from 0 rising); q may fall (played backwards) or stay (a freeze). It overrides speed / ramp /
 *            reverse; the clip lasts until the last key's t.
 *   blend    how slowed frames are made: "dup" (repeat - crisp, steppy) | "blend" (mix neighbours) | "flow" (optical
 *            flow, slow to compile)
 *   grade    {exposure (stops -3..3), contrast (-100..100), saturation (0..200 %), temperature (-100..100),
 *             tint (-100..100), hue (-180..180°)}
 *   lut      a .cube in the LUT library (lib/clipFx: <project>/luts or the app's luts/)    lut_mix  0..1
 *   look     the preset the sliders came from (only a label)
 *   afx      {denoise 0..1, voice bool (high-pass + presence + gentle compression), gain (dB -24..24)} - the clip's sound
 *            2.412.0: + eq {low, mid, high (dB -12..12), midHz}, comp (multiband compressor 0..1), reverb {mix 0..1, room}
 * }
 * TIME. A retimed clip is played in K segments of the source (K = 1 for a constant speed, 4..48 for a ramp), each at
 * one speed - exactly what the compile renders (scripts/clipfx_render.py follows segments()), so where a frame shows
 * up in the preview is where it shows up in the movie. The timeline length of a clip = the sum of the segments.
 * COLOUR. The grade (and the LUT under it) is baked into ONE 33-point 3D LUT by buildLut(): the compile applies it
 * with ffmpeg's lut3d, the preview samples the very same table in WebGL (static/gradegl.js). Order: the LUT first (the
 * input / creative transform), then exposure + white balance in linear light, then contrast, saturation, hue. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.H3ClipFx = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var SPEED = [0.1, 10];
  var BLENDS = ["dup", "blend", "flow"];
  var GRADE = { exposure: [-3, 3, 0], contrast: [-100, 100, 0], saturation: [0, 200, 100], temperature: [-100, 100, 0],
                tint: [-100, 100, 0], hue: [-180, 180, 0] };
  var LUT_SIZE = 33;
  var ROOMS = ["small", "room", "hall"];                 // 2.412.0: the reverb's spaces
  // looks: grade presets (no file needed)
  var LOOKS = {
    neutral: {},
    "teal & orange": { contrast: 18, saturation: 115, temperature: 12, tint: -6, hue: -4 },
    "warm film": { exposure: 0.1, contrast: 10, saturation: 90, temperature: 28, tint: 4 },
    "cool night": { exposure: -0.35, contrast: 15, saturation: 80, temperature: -40, tint: 6 },
    "bleach bypass": { contrast: 35, saturation: 45 },
    "vivid": { contrast: 12, saturation: 140 },
    "faded": { contrast: -30, saturation: 75, exposure: 0.15 },
    "mono": { contrast: 15, saturation: 0 },
  };
  var RAMPS = {
    "slow → fast": [{ p: 0, s: 0.4 }, { p: 1, s: 2.5 }],
    "fast → slow": [{ p: 0, s: 2.5 }, { p: 1, s: 0.4 }],
    "slow middle": [{ p: 0, s: 1.6 }, { p: 0.4, s: 0.25 }, { p: 0.6, s: 0.25 }, { p: 1, s: 1.6 }],
    "fast middle": [{ p: 0, s: 0.6 }, { p: 0.5, s: 3 }, { p: 1, s: 0.6 }],
  };

  function n(v, d) { var x = Number(v); return Number.isFinite(x) ? x : d; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function r4(v) { return Math.round(v * 10000) / 10000; }

  /* ---------- normalize: the one shape every side trusts; null = no fx at all */
  function normalize(fx) {
    if (!fx || typeof fx !== "object") return null;
    var o = {};
    var sp = clamp(n(fx.speed, 1), SPEED[0], SPEED[1]);
    if (Math.abs(sp - 1) > 1e-4) o.speed = r4(sp);
    if (fx.reverse) o.reverse = true;
    if (Array.isArray(fx.ramp)) {
      var keys = fx.ramp.filter(function (k) { return k && typeof k === "object"; })
        .map(function (k) { return { p: r4(clamp(n(k.p, 0), 0, 1)), s: r4(clamp(n(k.s, 1), SPEED[0], SPEED[1])) }; })
        .sort(function (a, b) { return a.p - b.p; }).slice(0, 8);
      if (keys.length >= 2) { o.ramp = keys; delete o.speed; }
    }
    var rm = normRemap(fx.remap);                                // 2.501.0: time remapping
    if (rm) { o.remap = rm; delete o.speed; delete o.ramp; delete o.reverse; }
    if (BLENDS.indexOf(fx.blend) > 0) o.blend = fx.blend;
    if (fx.grade && typeof fx.grade === "object") {
      var g = {};
      Object.keys(GRADE).forEach(function (k) {
        var L = GRADE[k], v = clamp(n(fx.grade[k], L[2]), L[0], L[1]);
        if (Math.abs(v - L[2]) > 1e-6) g[k] = r4(v);
      });
      var w = normWheels(fx.grade.wheels); if (w) g.wheels = w;          // 2.407.0
      var cu = normCurves(fx.grade.curves); if (cu) g.curves = cu;
      var hs = normHsl(fx.grade.hsl); if (hs) g.hsl = hs;
      var hc = normHueCurves(fx.grade.hcurves); if (hc) g.hcurves = hc;  // 2.412.0
      if (Object.keys(g).length) o.grade = g;
    }
    if (fx.lut && typeof fx.lut === "string" && /^[^\\/]{1,120}\.cube$/i.test(fx.lut)) {
      o.lut = fx.lut;
      o.lut_mix = r4(clamp(n(fx.lut_mix, 1), 0, 1));
    }
    if (typeof fx.look === "string" && fx.look) o.look = String(fx.look).slice(0, 40);
    if (fx.afx && typeof fx.afx === "object") {
      var a = {};
      var dn = clamp(n(fx.afx.denoise, 0), 0, 1); if (dn > 0) a.denoise = r4(dn);
      if (fx.afx.voice) a.voice = true;
      var gn = clamp(n(fx.afx.gain, 0), -24, 24); if (Math.abs(gn) > 1e-3) a.gain = r4(gn);
      // 2.412.0: EQ (3 bands, dB), multiband compressor (amount), reverb (mix + room)
      var eq = fx.afx.eq;
      if (eq && typeof eq === "object") {
        var e = {};
        ["low", "mid", "high"].forEach(function (k) { var v = clamp(n(eq[k], 0), -12, 12); if (Math.abs(v) > 1e-3) e[k] = r4(v); });
        var mh = clamp(n(eq.midHz, 1000), 200, 5000); if (e.mid != null && Math.abs(mh - 1000) > 0.5) e.midHz = Math.round(mh);
        if (Object.keys(e).length) a.eq = e;
      }
      var cm = clamp(n(fx.afx.comp, 0), 0, 1); if (cm > 0) a.comp = r4(cm);
      var rv = fx.afx.reverb;
      if (rv && typeof rv === "object") {
        var mx = clamp(n(rv.mix, 0), 0, 1);
        if (mx > 0) a.reverb = { mix: r4(mx), room: ROOMS.indexOf(rv.room) >= 0 ? rv.room : "room" };
      }
      if (Object.keys(a).length) o.afx = a;
    }
    var vx = normVfx(fx.vfx); if (vx) o.vfx = vx;                // 2.409.0: ✨ effects
    var mk = normMask(fx.mask); if (mk) o.mask = mk;             // 2.416.0: a mask / power window on the look
    var keysLeft = Object.keys(o).filter(function (k) { return k !== "look"; });
    return keysLeft.length ? o : null;
  }
  /* 2.416.0 - MASKS / POWER WINDOWS (Tim: "continue with the next part please the gap is getting smaller"): the clip's
     LOOK (the grade + LUT and the ✨ effects after it - blur, sharpen, glow, vignette, grain, distort) only inside the
     shape (or only outside: invert); outside it the picture as it was (after its key / crop).
     mask = {shape ellipse | rect, x, y (its centre, 0..1 of the frame), w, h (its size, 0.02..2 of the frame), rot
     (degrees clockwise), feather (0..0.5 of the frame's height: the soft edge's width), invert, track [{at (seconds into
     the clip), x, y}] (🎯 tracked: the centre follows what it was on - a straight line between samples)}
     maskAlpha(m, px, py, W, H, tau) -> 0..1 how much of the look a pixel gets: the compile's geq (scripts/vfx_filters.py
     mask_expr) and the canvas use this very formula (smoothstep across the feather, centred on the edge). */
  function normMask(m) {
    if (!m || typeof m !== "object" || (m.shape !== "ellipse" && m.shape !== "rect")) return null;
    var o = { shape: m.shape, x: r4(clamp(n(m.x, 0.5), -0.5, 1.5)), y: r4(clamp(n(m.y, 0.5), -0.5, 1.5)),
              w: r4(clamp(n(m.w, 0.4), 0.02, 2)), h: r4(clamp(n(m.h, 0.4), 0.02, 2)), rot: r4(clamp(n(m.rot, 0), -180, 180)),
              feather: r4(clamp(n(m.feather, 0.05), 0, 0.5)) };
    if (m.invert) o.invert = true;
    if (Array.isArray(m.track)) {
      var t = m.track.filter(function (k) { return k && Number.isFinite(Number(k.at)); })
        .map(function (k) { return { at: r4(clamp(n(k.at, 0), 0, 86400)), x: r4(clamp(n(k.x, 0.5), -0.5, 1.5)), y: r4(clamp(n(k.y, 0.5), -0.5, 1.5)) }; })
        .sort(function (a, b) { return a.at - b.at; });
      var u = []; t.forEach(function (k) { if (!u.length || k.at - u[u.length - 1].at > 1e-3) u.push(k); });
      if (u.length) o.track = u.slice(0, 2000);
    }
    return o;
  }
  /** the mask's centre at tau (seconds into the clip): its track (held before / after) or its own x, y */
  function maskAt(m, tau) {
    if (!m || !m.track || !m.track.length) return { x: m ? m.x : 0.5, y: m ? m.y : 0.5 };
    var T = m.track, t = n(tau, 0);
    if (t <= T[0].at) return { x: T[0].x, y: T[0].y };
    if (t >= T[T.length - 1].at) return { x: T[T.length - 1].x, y: T[T.length - 1].y };
    var lo = 0, hi = T.length - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (T[mid].at <= t) lo = mid; else hi = mid; }
    var a = T[lo], b = T[hi], f = (t - a.at) / Math.max(1e-9, b.at - a.at);
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }
  function maskAlpha(m, px, py, W, H, tau) {
    if (!m) return 1;
    var c = maskAt(m, tau), dx = px - c.x * W, dy = py - c.y * H, r = m.rot * Math.PI / 180;
    var lx = dx * Math.cos(r) + dy * Math.sin(r), ly = -dx * Math.sin(r) + dy * Math.cos(r);
    var RX = Math.max(1e-6, m.w * W / 2), RY = Math.max(1e-6, m.h * H / 2), sd;
    if (m.shape === "rect") sd = Math.min(RX - Math.abs(lx), RY - Math.abs(ly));
    else sd = (1 - Math.hypot(lx / RX, ly / RY)) * Math.min(RX, RY);
    var F = m.feather * H, a;
    if (F <= 1e-6) a = sd >= 0 ? 1 : 0;
    else { var q = clamp((sd + F / 2) / F, 0, 1); a = q * q * (3 - 2 * q); }
    return m.invert ? 1 - a : a;
  }
  /* 2.409.0 - ✨ EFFECTS: {blur 0..50, sharpen 0..2, glow / vignette / grain 0..1, crop {l, t, r, b} 0..45 %,
     key {color, similarity 0.01..0.5, blend 0..0.5, spill 0..1}, stabilise} - scripts/vfx_filters.py renders them,
     static/vfxgl.js previews them; an adjustment layer uses the colour + blur / sharpen / glow / vignette / grain */
  var VFX = { blur: [0, 50], sharpen: [0, 2], glow: [0, 1], vignette: [0, 1], grain: [0, 1] };
  function normVfx(v) {
    if (!v || typeof v !== "object") return null;
    var o = {};
    Object.keys(VFX).forEach(function (k) { var x = clamp(n(v[k], 0), VFX[k][0], VFX[k][1]); if (x > 1e-4) o[k] = r4(x); });
    if (v.crop && typeof v.crop === "object") {
      var c = {}, any = false;
      ["l", "t", "r", "b"].forEach(function (k) { c[k] = r4(clamp(n(v.crop[k], 0), 0, 45)); if (c[k] > 0) any = true; });
      if (any) o.crop = c;
    }
    if (v.key && typeof v.key === "object" && v.key.on !== false) {
      var col = /^#?[0-9a-f]{6}$/i.test(String(v.key.color || "")) ? "#" + String(v.key.color).replace("#", "").toLowerCase() : "#00ff00";
      o.key = { color: col, similarity: r4(clamp(n(v.key.similarity, 0.12), 0.01, 0.5)), blend: r4(clamp(n(v.key.blend, 0.08), 0, 0.5)),
                spill: r4(clamp(n(v.key.spill, 0.5), 0, 1)) };
    }
    if (v.stabilise) {                  // 2.413.0: {smooth 0..100 (%), lock (no camera motion at all)} - true = the defaults
      var st = v.stabilise && typeof v.stabilise === "object" ? v.stabilise : {};
      var sm = clamp(n(st.smooth, 50), 0, 100), lk = !!st.lock;
      o.stabilise = Math.abs(sm - 50) < 1e-6 && !lk ? true : { smooth: r4(sm), lock: lk };
    }
    var kf = normVfxKf(v.kf); if (kf) o.kf = kf;                       // 2.412.0: effect keyframes
    // 2.415.0 - DISTORT (Tim: "lets do the medium jobs now"): lens -100 (pincushion) .. 100 (barrel / fisheye);
    // mirror "h" (the left half mirrored right) | "v" (the top half down) | "quad" (the top-left quarter four ways);
    // warp {type wave (a sideways ripple) | twirl (a swirl at the middle), amount 0..100, size 5..100 (wave: its length
    // as % of the height; twirl: its radius as % of the half-height), speed 0..5 (wave: cycles a second)}
    var ln = clamp(n(v.lens, 0), -100, 100); if (Math.abs(ln) > 1e-4) o.lens = r4(ln);
    if (v.mirror === "h" || v.mirror === "v" || v.mirror === "quad") o.mirror = v.mirror;
    if (v.warp && typeof v.warp === "object" && (v.warp.type === "wave" || v.warp.type === "twirl")) {
      var wa = clamp(n(v.warp.amount, 30), 0, 100);
      if (wa > 1e-4) o.warp = { type: v.warp.type, amount: r4(wa), size: r4(clamp(n(v.warp.size, v.warp.type === "wave" ? 20 : 60), 5, 100)),
                                speed: r4(clamp(n(v.warp.speed, 0), 0, 5)) };
    }
    return Object.keys(o).length ? o : null;
  }
  /** 2.415.0: a distorted picture's sample point - output pixel (x, y) of a w x h frame at clip time tau -> the source
   *  pixel it shows (scripts/vfx_filters.py's geq / lenscorrection and static/vfxgl.js's shader use these formulas) */
  function distortAt(v, x, y, w, h, tau) {
    var sx = x, sy = y;
    if (v && v.warp && v.warp.type === "wave") {
      var A = v.warp.amount / 100 * 0.05 * w, L = Math.max(1, v.warp.size / 100 * h);
      sx = sx + A * Math.sin(2 * Math.PI * sy / L + 2 * Math.PI * (v.warp.speed || 0) * (tau || 0));
    } else if (v && v.warp && v.warp.type === "twirl") {
      var dx = sx - w / 2, dy = sy - h / 2, R = Math.max(1, v.warp.size / 100 * Math.min(w, h) / 2), r = Math.hypot(dx, dy) / R;
      var a = r < 1 ? v.warp.amount / 100 * 3 * (1 - r) * (1 - r) : 0;
      sx = w / 2 + dx * Math.cos(a) - dy * Math.sin(a); sy = h / 2 + dx * Math.sin(a) + dy * Math.cos(a);
    }
    if (v && v.lens) {
      var k1 = v.lens / 100 * 0.5, k2 = k1 * 0.5, r0 = Math.hypot(w, h) / 2, ex = sx - w / 2, ey = sy - h / 2, q = (ex * ex + ey * ey) / (r0 * r0);
      var f = 1 + k1 * q + k2 * q * q; sx = w / 2 + ex * f; sy = h / 2 + ey * f;
    }
    if (v && v.mirror) {
      if ((v.mirror === "h" || v.mirror === "quad") && sx > w / 2) sx = w - sx;
      if ((v.mirror === "v" || v.mirror === "quad") && sy > h / 2) sy = h - sy;
    }
    return [sx, sy];
  }
  function distorts(v) { return !!(v && (v.lens || v.mirror || v.warp)); }
  /* 2.412.0 - EFFECT KEYFRAMES: vfx.kf = [{at (seconds into the clip on the timeline), blur, sharpen, glow, vignette,
     grain, crop {l, t, r, b}}] (2..32, any of the values); between two keys that set a value it moves in a straight line,
     before the first / after the last it holds; a value no key sets stays the clip's own. vfxAt(vfx, t) -> the plain
     effects at that moment (what the canvas draws; scripts/vfx_filters.py animates the same numbers in the compile) */
  var KF_KEYS = ["blur", "sharpen", "glow", "vignette", "grain"];
  function normVfxKf(list) {
    if (!Array.isArray(list)) return null;
    var out = list.filter(function (k) { return k && typeof k === "object" && Number.isFinite(Number(k.at)); }).map(function (k) {
      var o = { at: r4(clamp(n(k.at, 0), 0, 86400)) };
      KF_KEYS.forEach(function (q) { if (k[q] != null && Number.isFinite(Number(k[q]))) o[q] = r4(clamp(n(k[q], 0), VFX[q][0], VFX[q][1])); });
      if (k.crop && typeof k.crop === "object") { var c = {}; ["l", "t", "r", "b"].forEach(function (q) { c[q] = r4(clamp(n(k.crop[q], 0), 0, 45)); }); o.crop = c; }
      return o;
    }).filter(function (k) { return Object.keys(k).length > 1; }).sort(function (a, b) { return a.at - b.at; });
    var u = []; out.forEach(function (k) { if (u.length && Math.abs(u[u.length - 1].at - k.at) < 1e-3) Object.assign(u[u.length - 1], k); else u.push(k); });
    return u.length >= 1 ? u.slice(0, 32) : null;
  }
  /** one keyframed value at t: [keys that carry it] -> number (or the fallback when none does) */
  function kfVal(kf, t, get, fallback) {
    var ks = kf.filter(function (k) { return get(k) != null; });
    if (!ks.length) return fallback;
    if (t <= ks[0].at) return get(ks[0]);
    if (t >= ks[ks.length - 1].at) return get(ks[ks.length - 1]);
    for (var i = 1; i < ks.length; i++) if (t <= ks[i].at) {
      var a = ks[i - 1], b = ks[i], f = b.at > a.at ? (t - a.at) / (b.at - a.at) : 1;
      return get(a) + (get(b) - get(a)) * f;
    }
    return fallback;
  }
  function vfxAt(v, t) {
    if (!v || !v.kf || !v.kf.length) return v;
    var o = {};
    Object.keys(v).forEach(function (k) { if (k !== "kf") o[k] = v[k]; });
    KF_KEYS.forEach(function (q) {
      var x = kfVal(v.kf, t, function (k) { return k[q]; }, v[q] || 0);
      if (x > 1e-4) o[q] = r4(x); else delete o[q];
    });
    if (v.kf.some(function (k) { return k.crop; })) {
      var c = {}, any = false;
      ["l", "t", "r", "b"].forEach(function (q) { c[q] = r4(kfVal(v.kf, t, function (k) { return k.crop ? k.crop[q] : null; }, (v.crop || {})[q] || 0)); if (c[q] > 0) any = true; });
      if (any) o.crop = c; else delete o.crop;
    }
    return o;
  }
  /* 2.407.0 - the colour panel: lift / gamma / gain WHEELS {x, y (the puck, in the unit disc), l (-1..1)}, CURVES
     {m, r, g, b: [[x, y] ...] 2..16 points in 0..1} and HSL SECONDARIES [{hue 0..360, width 10..180, shift -180..180,
     sat -100..100, lum -100..100}] (6 at most) - all baked into the same LUT, so the canvas and the compile agree */
  function normWheels(w) {
    if (!w || typeof w !== "object") return null;
    var o = {};
    ["lift", "gamma", "gain"].forEach(function (k) {
      var v = w[k]; if (!v || typeof v !== "object") return;
      var x = clamp(n(v.x, 0), -1, 1), y = clamp(n(v.y, 0), -1, 1), l = clamp(n(v.l, 0), -1, 1), h = Math.hypot(x, y);
      if (h > 1) { x /= h; y /= h; }
      if (Math.abs(x) > 1e-4 || Math.abs(y) > 1e-4 || Math.abs(l) > 1e-4) o[k] = { x: r4(x), y: r4(y), l: r4(l) };
    });
    return Object.keys(o).length ? o : null;
  }
  function normCurve(pts) {
    if (!Array.isArray(pts)) return null;
    var p = pts.filter(function (q) { return Array.isArray(q) && q.length >= 2; })
      .map(function (q) { return [r4(clamp(n(q[0], 0), 0, 1)), r4(clamp(n(q[1], 0), 0, 1))]; })
      .sort(function (a, b) { return a[0] - b[0]; });
    var u = []; p.forEach(function (q) { if (!u.length || q[0] - u[u.length - 1][0] > 1e-3) u.push(q); });
    u = u.slice(0, 16);
    if (u.length < 2) return null;
    var ident = u.every(function (q) { return Math.abs(q[0] - q[1]) < 1e-4; }) && u[0][0] < 1e-4 && u[u.length - 1][0] > 1 - 1e-4;
    return ident ? null : u;
  }
  function normCurves(c) {
    if (!c || typeof c !== "object") return null;
    var o = {};
    ["m", "r", "g", "b"].forEach(function (k) { var v = normCurve(c[k]); if (v) o[k] = v; });
    return Object.keys(o).length ? o : null;
  }
  /** 2.412.0: hue-vs-hue / hue-vs-sat - points [hue 0..1 (of 360°), value 0..1 (0.5 = unchanged)]; the curve wraps (its
   * two ends share their value) */
  function normHueCurve(pts) {
    if (!Array.isArray(pts)) return null;
    var p = pts.filter(function (q) { return Array.isArray(q) && q.length >= 2; })
      .map(function (q) { return [r4(clamp(n(q[0], 0), 0, 1)), r4(clamp(n(q[1], 0.5), 0, 1))]; })
      .sort(function (a, b) { return a[0] - b[0]; });
    var u = []; p.forEach(function (q) { if (!u.length || q[0] - u[u.length - 1][0] > 1e-3) u.push(q); });
    u = u.slice(0, 16);
    if (u.length < 2) return null;
    return u.every(function (q) { return Math.abs(q[1] - 0.5) < 1e-4; }) ? null : u;
  }
  function normHueCurves(c) {
    if (!c || typeof c !== "object") return null;
    var o = {};
    ["hh", "hs"].forEach(function (k) { var v = normHueCurve(c[k]); if (v) o[k] = v; });
    return Object.keys(o).length ? o : null;
  }
  function normHsl(list) {
    if (!Array.isArray(list)) return null;
    var o = list.filter(function (q) { return q && typeof q === "object"; }).slice(0, 6).map(function (q) {
      return { hue: r4(((n(q.hue, 0) % 360) + 360) % 360), width: r4(clamp(n(q.width, 40), 10, 180)), shift: r4(clamp(n(q.shift, 0), -180, 180)),
               sat: r4(clamp(n(q.sat, 0), -100, 100)), lum: r4(clamp(n(q.lum, 0), -100, 100)) };
    }).filter(function (q) { return Math.abs(q.shift) > 1e-4 || Math.abs(q.sat) > 1e-4 || Math.abs(q.lum) > 1e-4; });
    return o.length ? o : null;
  }
  /** a monotone cubic through the points (Fritsch-Carlson), flat beyond the ends */
  function curveFn(pts) {
    var N = pts.length, xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    var d = [], m = [];
    for (var i = 0; i < N - 1; i++) d.push((ys[i + 1] - ys[i]) / Math.max(1e-6, xs[i + 1] - xs[i]));
    m[0] = d[0]; m[N - 1] = d[N - 2];
    for (i = 1; i < N - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (i = 0; i < N - 1; i++) {
      if (Math.abs(d[i]) < 1e-9) { m[i] = 0; m[i + 1] = 0; continue; }
      var a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
      if (h > 9) { var t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    return function (x) {
      if (x <= xs[0]) return ys[0];
      if (x >= xs[N - 1]) return ys[N - 1];
      var k = 0; while (k < N - 2 && x > xs[k + 1]) k++;
      var hh = xs[k + 1] - xs[k], t = (x - xs[k]) / hh, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[k] + (t3 - 2 * t2 + t) * hh * m[k] + (-2 * t3 + 3 * t2) * ys[k + 1] + (t3 - t2) * hh * m[k + 1];
    };
  }
  /** a wheel's puck -> an RGB push that sums to zero (the hue it points at, as much as it is out) */
  function wheelRgb(w) {
    var a = Math.min(1, Math.hypot(w.x || 0, w.y || 0));
    if (a < 1e-6) return [0, 0, 0];
    var hue = Math.atan2(w.y, w.x) * 180 / Math.PI;
    var c = hslToRgb(((hue % 360) + 360) % 360, 1, 0.5), mean = (c[0] + c[1] + c[2]) / 3;
    return [(c[0] - mean) * a, (c[1] - mean) * a, (c[2] - mean) * a];
  }
  function rgbToHsl(r, g, b) {
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0, d = mx - mn;
    if (d > 1e-9) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function hslToRgb(h, s, l) {
    function f(nn) { var k = (nn + h / 30) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }
    return [f(0), f(8), f(4)];
  }
  function sstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  var curveCache = { key: "", fns: null }, hueCache = { key: "", fns: null };      // 2.412.0: one cache each (no thrash)
  function curveFns(cu, hue) {
    var key = JSON.stringify(cu), C = hue ? hueCache : curveCache;
    if (C.key !== key) {
      var o = {}; Object.keys(cu).forEach(function (k) { o[k] = curveFn(cu[k]); });
      C.key = key; C.fns = o;
    }
    return C.fns;
  }

  function retimed(fx) { return !!(fx && (fx.remap || fx.ramp || fx.reverse || (fx.speed && Math.abs(fx.speed - 1) > 1e-4))); }
  /** 2.501.0: time-remap keys made sane: t from 0 rising (at least 1 / 100 s apart), q >= 0, 2..64 of them; null otherwise */
  function normRemap(rm) {
    if (!Array.isArray(rm)) return null;
    var k = rm.filter(function (x) { return x && typeof x === "object" && Number.isFinite(+x.t) && Number.isFinite(+x.q); })
      .map(function (x) { return { t: r4(clamp(+x.t, 0, 86400)), q: r4(clamp(+x.q, 0, 86400)) }; }).sort(function (a, b) { return a.t - b.t; });
    var out = []; k.forEach(function (x) { if (!out.length || x.t - out[out.length - 1].t >= 0.01) out.push(x); });
    if (out.length < 2) return null;
    var t0 = out[0].t; out.forEach(function (x) { x.t = r4(x.t - t0); });
    return out.slice(0, 64);
  }
  /** 2.501.0: the source offset (from in) at t seconds into a remapped clip (straight between keys, held past them) */
  function remapAt(rm, t) {
    if (t <= rm[0].t) return rm[0].q;
    for (var i = 1; i < rm.length; i++) if (t <= rm[i].t) { var a = rm[i - 1], b = rm[i]; return a.q + (b.q - a.q) * (t - a.t) / Math.max(1e-9, b.t - a.t); }
    return rm[rm.length - 1].q;
  }
  function graded(fx) { return !!(fx && (fx.grade || fx.lut)); }
  function hasAfx(fx) { return !!(fx && fx.afx); }
  /** does the compile have to render this clip again first (scripts/clipfx_render.py) */
  function needsRender(fx) { return retimed(fx) || graded(fx) || hasAfx(fx) || !!(fx && fx.vfx); }

  /* ---------- time */
  function speedAt(fx, p) {
    if (!fx || !fx.ramp) return fx && fx.speed ? fx.speed : 1;
    var k = fx.ramp;
    if (p <= k[0].p) return k[0].s;
    if (p >= k[k.length - 1].p) return k[k.length - 1].s;
    for (var i = 1; i < k.length; i++) if (p <= k[i].p) {
      var a = k[i - 1], b = k[i], f = b.p > a.p ? (p - a.p) / (b.p - a.p) : 0;
      return a.s + (b.s - a.s) * f;
    }
    return 1;
  }
  /** the played segments: [{p0, p1, q0, q1 (source seconds from the start of play), s, t0, t1 (timeline seconds)}] */
  function segments(srcLen, fx) {
    var L = Math.max(0, n(srcLen, 0));
    if (fx && fx.remap) {                                      // 2.501.0: one segment per remap key pair (s < 0 = backwards, 0 = a freeze)
      return fx.remap.slice(1).map(function (b, i) {
        var a = fx.remap[i], q0 = clamp(a.q, 0, L), q1 = clamp(b.q, 0, L);
        return { p0: L ? q0 / L : 0, p1: L ? q1 / L : 0, q0: q0, q1: q1, s: (q1 - q0) / Math.max(1e-9, b.t - a.t), t0: a.t, t1: b.t };
      });
    }
    var K = fx && fx.ramp ? clamp(Math.ceil(L * 4), 4, 48) : 1;
    var out = [], t = 0;
    for (var i = 0; i < K; i++) {
      var p0 = i / K, p1 = (i + 1) / K;
      var s = fx && fx.ramp ? speedAt(fx, (p0 + p1) / 2) : (fx && fx.speed) || 1;
      s = clamp(s, SPEED[0], SPEED[1]);
      var d = (p1 - p0) * L / s;
      out.push({ p0: p0, p1: p1, q0: p0 * L, q1: p1 * L, s: s, t0: t, t1: t + d });
      t += d;
    }
    return out;
  }
  /** a clip's length on the timeline, from its source length (out - in) */
  function timelineLen(srcLen, fx) {
    if (!retimed(fx)) return Math.max(0, n(srcLen, 0));
    if (fx.remap) return fx.remap[fx.remap.length - 1].t;       // 2.501.0
    var sg = segments(srcLen, fx);
    return sg.length ? sg[sg.length - 1].t1 : 0;
  }
  /** seconds into the clip on the timeline -> the SOURCE second to show (absolute, in the file) */
  function srcTime(c, local) {
    var fx = c && c.fx, i0 = n(c && c.in, 0), o0 = c && c.out != null ? n(c.out, i0) : n(c && c.dur, i0 + 5);
    var L = Math.max(0, o0 - i0);
    var t = Math.max(0, n(local, 0)), q;
    if (fx && fx.remap) return i0 + clamp(remapAt(fx.remap, t), 0, L);   // 2.501.0: time remapping
    if (!retimed(fx)) q = Math.min(L, t);
    else {
      var sg = segments(L, fx), last = sg[sg.length - 1];
      if (t >= last.t1) q = L;
      else {
        q = 0;
        for (var i = 0; i < sg.length; i++) if (t < sg[i].t1) { q = sg[i].q0 + (t - sg[i].t0) * sg[i].s; break; }
      }
    }
    return fx && fx.reverse ? o0 - q : i0 + q;
  }
  /** 2.412.0: the inverse of srcTime - a SOURCE second (absolute, in the file) -> seconds into the clip on the timeline,
   * or null when the trim leaves that second out (a clip marker pinned to its frame, a reversed / ramped clip too) */
  function localTime(c, src) {
    var fx = c && c.fx, i0 = n(c && c.in, 0), o0 = c && c.out != null ? n(c.out, i0) : n(c && c.dur, i0 + 5);
    var L = Math.max(0, o0 - i0), x = n(src, NaN);
    if (!Number.isFinite(x) || x < i0 - 1e-6 || x > o0 + 1e-6) return null;
    var q = fx && fx.reverse && !fx.remap ? o0 - x : x - i0;
    if (!retimed(fx)) return clamp(q, 0, L);
    if (fx.remap) {                                          // 2.501.0: the first moment that source second shows
      for (var j = 1; j < fx.remap.length; j++) { var a = fx.remap[j - 1], b = fx.remap[j], lo = Math.min(a.q, b.q), hi = Math.max(a.q, b.q);
        if (q >= lo - 1e-9 && q <= hi + 1e-9) return Math.abs(b.q - a.q) < 1e-9 ? a.t : a.t + (q - a.q) / (b.q - a.q) * (b.t - a.t); }
      return null;
    }
    var sg = segments(L, fx);
    for (var i = 0; i < sg.length; i++) if (q <= sg[i].q1 + 1e-9) return sg[i].t0 + (Math.max(q, sg[i].q0) - sg[i].q0) / sg[i].s;
    return sg.length ? sg[sg.length - 1].t1 : 0;
  }
  /** the clip's length on the timeline (the page's effDur for media clips) */
  function clipLen(c) {
    var i0 = n(c && c.in, 0), o0 = c && c.out != null ? n(c.out, null) : n(c && c.dur, null);
    if (o0 == null) return null;
    return timelineLen(Math.max(0, o0 - i0), c.fx);
  }
  /** source seconds per timeline second, on average (for dragging a trim edge of a retimed clip) */
  function rate(c) {
    var L = clipLen(c), i0 = n(c && c.in, 0), o0 = c && c.out != null ? n(c.out, 0) : n(c && c.dur, 0);
    return L > 1e-6 ? (o0 - i0) / L : 1;
  }
  /** the part of a clip between timeline offsets a..b (seconds from its start): {in, out, fx} with a ramp re-fitted */
  function slice(c, a, b) {
    var fx = c.fx || null;
    var i0 = n(c.in, 0), o0 = c.out != null ? n(c.out, i0) : n(c.dur, i0);
    var L = Math.max(0, o0 - i0);
    var sa = srcTime(c, a), sb = srcTime(c, b);
    var lo = Math.min(sa, sb), hi = Math.max(sa, sb);
    var out = { in: r4(lo), out: r4(Math.max(hi, lo + 1e-3)) };
    if (fx && fx.remap) {                                    // 2.501.0: the keys inside the slice, re-based on its own in point
      var ks = [{ t: a, q: remapAt(fx.remap, a) }];
      fx.remap.forEach(function (k) { if (k.t > a + 1e-6 && k.t < b - 1e-6) ks.push({ t: k.t, q: k.q }); });
      ks.push({ t: b, q: remapAt(fx.remap, b) });
      var lo2 = Math.min.apply(null, ks.map(function (k) { return k.q; })), hi2 = Math.max.apply(null, ks.map(function (k) { return k.q; }));
      out.in = r4(i0 + lo2); out.out = r4(Math.max(i0 + hi2, i0 + lo2 + 1e-3));
      out.fx = normalize(Object.assign({}, fx, { remap: ks.map(function (k) { return { t: k.t - a, q: k.q - lo2 }; }) }));
      return out;
    }
    if (fx && fx.ramp && L > 0) {
      // the played fractions the slice covers -> the ramp's keys inside it, plus its two ends, re-scaled to 0..1
      var pa = fx.reverse ? (o0 - sa) / L : (sa - i0) / L, pb = fx.reverse ? (o0 - sb) / L : (sb - i0) / L;
      var keys = [{ p: 0, s: r4(speedAt(fx, pa)) }];
      fx.ramp.forEach(function (k) { if (k.p > pa + 1e-6 && k.p < pb - 1e-6) keys.push({ p: r4((k.p - pa) / (pb - pa)), s: k.s }); });
      keys.push({ p: 1, s: r4(speedAt(fx, pb)) });
      var nf = Object.assign({}, fx, { ramp: keys.slice(0, 8) });
      out.fx = normalize(nf);
    } else if (fx) out.fx = Object.assign({}, fx);
    return out;
  }

  /* ---------- colour: one pixel through the grade, and the LUT that bakes it */
  function toLin(v) { return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function toSrgb(v) { v = v < 0 ? 0 : v; return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; }
  function gradeRgb(r, g, b, gr) {
    var G = gr || {};
    var ex = Math.pow(2, n(G.exposure, 0)), t = n(G.temperature, 0) / 100, ti = n(G.tint, 0) / 100;
    var lr = toLin(r) * ex * (1 + 0.22 * t) * (1 + 0.06 * ti);
    var lg = toLin(g) * ex * (1 - 0.18 * ti);
    var lb = toLin(b) * ex * (1 - 0.22 * t) * (1 + 0.06 * ti);
    r = toSrgb(lr); g = toSrgb(lg); b = toSrgb(lb);
    var c3 = [r, g, b];
    if (G.wheels) {                     // 2.407.0: lift (shadows), gamma (mids), gain (highlights) - display space
      var W = G.wheels, L0 = W.lift ? wheelRgb(W.lift) : null, G0 = W.gamma ? wheelRgb(W.gamma) : null, H0 = W.gain ? wheelRgb(W.gain) : null;
      for (var ci = 0; ci < 3; ci++) {
        var v = clamp(c3[ci], 0, 1);
        if (W.lift) v = v + (W.lift.l * 0.25 + L0[ci] * 0.3) * (1 - v);
        if (W.gamma) v = Math.pow(clamp(v, 0, 1), Math.pow(2, -(W.gamma.l + G0[ci] * 0.8) * 0.8));
        if (W.gain) v = v * (1 + W.gain.l * 0.5 + H0[ci] * 0.5);
        c3[ci] = v;
      }
      r = c3[0]; g = c3[1]; b = c3[2];
    }
    var k = 1 + n(G.contrast, 0) / 100;
    r = (r - 0.5) * k + 0.5; g = (g - 0.5) * k + 0.5; b = (b - 0.5) * k + 0.5;
    if (G.curves) {                     // 2.407.0: the master curve, then each channel's
      var cf = curveFns(G.curves);
      r = clamp(r, 0, 1); g = clamp(g, 0, 1); b = clamp(b, 0, 1);
      if (cf.m) { r = cf.m(r); g = cf.m(g); b = cf.m(b); }
      if (cf.r) r = cf.r(r); if (cf.g) g = cf.g(g); if (cf.b) b = cf.b(b);
    }
    var s = n(G.saturation, 100) / 100, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = Y + (r - Y) * s; g = Y + (g - Y) * s; b = Y + (b - Y) * s;
    if (G.hsl) {                        // 2.407.0: HSL secondaries - one hue range shifted / (de)saturated / lit
      var hs = rgbToHsl(clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1)), H = hs[0], Sa = hs[1], Li = hs[2];
      var dh = 0, ds = 0, dl = 0;
      G.hsl.forEach(function (q) {
        var dist = Math.abs(((H - q.hue + 540) % 360) - 180), half = q.width / 2;
        var wgt = (1 - sstep(half * 0.5, half, dist)) * sstep(0.04, 0.2, Sa);
        dh += q.shift * wgt; ds += (q.sat / 100) * wgt; dl += (q.lum / 100) * wgt;
      });
      if (dh || ds || dl) {
        var o2 = hslToRgb((((H + dh) % 360) + 360) % 360, clamp(Sa * (1 + ds), 0, 1), clamp(Li + dl * 0.35 * (1 - Math.abs(2 * Li - 1) * 0.5), 0, 1));
        r = o2[0]; g = o2[1]; b = o2[2];
      }
    }
    if (G.hcurves) {                    // 2.412.0: hue vs hue (a shift of up to ±180°) / hue vs saturation (0 .. 200 %)
      var hf = curveFns(G.hcurves, true), q3 = rgbToHsl(clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1));
      var wq = sstep(0.04, 0.2, q3[1]), x = q3[0] / 360;
      var dH = hf.hh ? (hf.hh(x) - 0.5) * 360 * wq : 0, mS = hf.hs ? 1 + (hf.hs(x) - 0.5) * 2 * wq : 1;
      if (Math.abs(dH) > 1e-6 || Math.abs(mS - 1) > 1e-6) {
        var o3 = hslToRgb((((q3[0] + dH) % 360) + 360) % 360, clamp(q3[1] * mS, 0, 1), q3[2]);
        r = o3[0]; g = o3[1]; b = o3[2];
      }
    }
    var h = n(G.hue, 0);
    if (Math.abs(h) > 1e-6) {          // a rotation about the grey axis
      var a = h * Math.PI / 180, cA = Math.cos(a), sA = Math.sin(a), w = 1 / 3, sq = Math.sqrt(w);
      var m00 = cA + (1 - cA) * w, m01 = w * (1 - cA) - sq * sA, m02 = w * (1 - cA) + sq * sA;
      var m10 = w * (1 - cA) + sq * sA, m11 = cA + w * (1 - cA), m12 = w * (1 - cA) - sq * sA;
      var m20 = w * (1 - cA) - sq * sA, m21 = w * (1 - cA) + sq * sA, m22 = cA + w * (1 - cA);
      var R = m00 * r + m01 * g + m02 * b, Gg = m10 * r + m11 * g + m12 * b, B = m20 * r + m21 * g + m22 * b;
      r = R; g = Gg; b = B;
    }
    return [clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1)];
  }
  /** a .cube file -> {size, min, max, data: Float32Array (R fastest)} or throws in words */
  function parseCube(text) {
    var size = 0, min = [0, 0, 0], max = [1, 1, 1], vals = [];
    String(text || "").split(/\r?\n/).forEach(function (ln) {
      var s = ln.trim();
      if (!s || s[0] === "#") return;
      var m;
      if ((m = /^LUT_3D_SIZE\s+(\d+)/i.exec(s))) { size = +m[1]; return; }
      if ((m = /^DOMAIN_MIN\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/i.exec(s))) { min = [+m[1], +m[2], +m[3]]; return; }
      if ((m = /^DOMAIN_MAX\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/i.exec(s))) { max = [+m[1], +m[2], +m[3]]; return; }
      if (/^(TITLE|LUT_1D_SIZE|LUT_1D_INPUT_RANGE|LUT_3D_INPUT_RANGE)/i.test(s)) {
        if (/^LUT_1D_SIZE/i.test(s)) throw new Error("a 1D LUT - bitGen takes 3D .cube LUTs");
        return;
      }
      var p = s.split(/\s+/);
      if (p.length >= 3 && p.slice(0, 3).every(function (x) { return Number.isFinite(+x); })) vals.push(+p[0], +p[1], +p[2]);
    });
    if (size < 2 || size > 129) throw new Error("not a 3D .cube LUT (no LUT_3D_SIZE)");
    if (vals.length !== size * size * size * 3) throw new Error("the .cube has " + vals.length / 3 + " entries, LUT_3D_SIZE " + size + " needs " + size * size * size);
    return { size: size, min: min, max: max, data: new Float32Array(vals) };
  }
  /** trilinear lookup in a parsed LUT */
  function sampleCube(L, r, g, b) {
    var N = L.size, d = L.data;
    var x = clamp((r - L.min[0]) / (L.max[0] - L.min[0]), 0, 1) * (N - 1);
    var y = clamp((g - L.min[1]) / (L.max[1] - L.min[1]), 0, 1) * (N - 1);
    var z = clamp((b - L.min[2]) / (L.max[2] - L.min[2]), 0, 1) * (N - 1);
    var x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
    var x1 = Math.min(N - 1, x0 + 1), y1 = Math.min(N - 1, y0 + 1), z1 = Math.min(N - 1, z0 + 1);
    var fx = x - x0, fy = y - y0, fz = z - z0, out = [0, 0, 0];
    function at(i, j, k, c) { return d[((k * N + j) * N + i) * 3 + c]; }
    for (var c = 0; c < 3; c++) {
      var c00 = at(x0, y0, z0, c) * (1 - fx) + at(x1, y0, z0, c) * fx;
      var c10 = at(x0, y1, z0, c) * (1 - fx) + at(x1, y1, z0, c) * fx;
      var c01 = at(x0, y0, z1, c) * (1 - fx) + at(x1, y0, z1, c) * fx;
      var c11 = at(x0, y1, z1, c) * (1 - fx) + at(x1, y1, z1, c) * fx;
      out[c] = (c00 * (1 - fy) + c10 * fy) * (1 - fz) + (c01 * (1 - fy) + c11 * fy) * fz;
    }
    return out;
  }
  /** the whole look as ONE table (size³ RGB, R fastest): the user LUT (mixed), then the grade */
  function buildLut(fx, userLut, size) {
    var N = size || LUT_SIZE, out = new Float32Array(N * N * N * 3), mix = fx && fx.lut ? n(fx.lut_mix, 1) : 0;
    var gr = fx && fx.grade, i = 0;
    for (var z = 0; z < N; z++) for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var r = x / (N - 1), g = y / (N - 1), b = z / (N - 1);
      if (userLut && mix > 0) {
        var u = sampleCube(userLut, r, g, b);
        r = r + (u[0] - r) * mix; g = g + (u[1] - g) * mix; b = b + (u[2] - b) * mix;
      }
      var o = gr ? gradeRgb(clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1), gr) : [clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1)];
      out[i++] = o[0]; out[i++] = o[1]; out[i++] = o[2];
    }
    return out;
  }
  function toCube(table, size, title) {
    var N = size || LUT_SIZE, lines = ['TITLE "' + String(title || "bitGen grade").replace(/"/g, "") + '"', "LUT_3D_SIZE " + N, ""];
    for (var i = 0; i < table.length; i += 3) lines.push(table[i].toFixed(6) + " " + table[i + 1].toFixed(6) + " " + table[i + 2].toFixed(6));
    return lines.join("\n") + "\n";
  }
  /** a stable key for a look (to cache the baked LUT) */
  function lookKey(fx) { return JSON.stringify([fx && fx.grade || null, fx && fx.lut || null, fx && fx.lut ? fx.lut_mix : null]); }

  return { normMask: normMask, maskAt: maskAt, maskAlpha: maskAlpha, distortAt: distortAt, distorts: distorts, SPEED: SPEED, BLENDS: BLENDS, GRADE: GRADE, LUT_SIZE: LUT_SIZE, ROOMS: ROOMS, LOOKS: LOOKS, RAMPS: RAMPS,
           normalize: normalize, normRemap: normRemap, remapAt: remapAt, retimed: retimed, graded: graded, hasAfx: hasAfx, needsRender: needsRender,
           speedAt: speedAt, segments: segments, timelineLen: timelineLen, srcTime: srcTime, localTime: localTime, clipLen: clipLen, rate: rate,
           slice: slice, gradeRgb: gradeRgb, parseCube: parseCube, sampleCube: sampleCube, buildLut: buildLut, toCube: toCube,
           lookKey: lookKey, normVfx: normVfx, normHueCurves: normHueCurves, vfxAt: vfxAt, KF_KEYS: KF_KEYS, VFX: VFX, curveFn: curveFn, rgbToHsl: rgbToHsl, hslToRgb: hslToRgb, wheelRgb: wheelRgb };
});
