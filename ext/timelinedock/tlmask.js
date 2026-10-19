/* bitGen Studio — ext/timelinedock/tlmask.js (2.498.0): BÉZIER MASKS on the timeline's layers. window.TlMask.
 *
 * Tim (verbatim): "... and the rest of the After Effects gap list (expressions, Bézier masks, tracking and so on).." -
 * AFTER-EFFECTS-GAP.md: "Bézier masks: any shape, several per layer, add / subtract / intersect / difference,
 * expansion, variable feather, animated mask paths".
 *
 *   ✒ Mask Pen (Shift+M)  with a layer picked: click = a corner point, drag = a smooth point (its handles), click the
 *                         first point (or Enter) = the mask closed; Esc = done. On a closed mask: drag a point / a
 *                         handle (Alt = that handle alone) - a mask with keys gets a key at the playhead.
 *   ✒ Masks (Properties)  each mask: on / off, its mode (add, subtract, intersect, difference - how it meets the ones
 *                         above it in the list), feather (px, soft edge), expansion (px, + grows / − shrinks), opacity,
 *                         invert, ◇ = key its path at the playhead (between keys the points glide), ✕
 *   The points are kept as fractions of the layer's own picture (0..1), so the mask rides with the layer when it is
 *   moved, scaled or turned, and fits any resolution.
 *   The compile          a picture / text / shape layer with masks is baked by the page (TlParent's bake); a VIDEO
 *                        layer's masks become a grey MASK VIDEO the page makes (video/tlb_<uid>m.webm - one frame
 *                        when nothing moves) that the compile lays on as the clip's alpha (worker.py alphamerge)
 * Pure (Node: scripts/test-mask.js): MODES, DEFAULTS, lerpPts (two key's points at f), pathAt (the points at tau),
 *   segs (a mask's cubic pieces in pixels), flatten (a polygon), toLocal (a picture point -> the layer's 0..1),
 *   animated, sig.
 * 2.511.0: VARIABLE FEATHER (Tim: "lets do steps 1,2,3 , 4,5,6 and 7" - step 5) - each point may have its own feather
 *   (pt.fe, picture px; Shift+drag a point with the ✒ Mask Pen = its feather, a ring shows it). The edge softens by
 *   the feather of the nearest place on it (each piece glides from its two points' feathers): the mask blurred at a few
 *   levels, each pixel blended between the two levels around its nearest edge's feather. Pure: fes, isVar,
 *   edgeSamples, featherGrid, levelsOf, blendAt.
 */
(function (root) {
  "use strict";
  var MODES = ["add", "subtract", "intersect", "difference"];
  var DEFAULTS = { on: true, mode: "add", feather: 0, expand: 0, op: 100, inv: false, closed: true };
  var r5 = function (v) { return Math.round(v * 100000) / 100000; };
  /** a point {x, y, ix, iy, ox, oy} (0..1 of the picture; ix / iy the handle in, ox / oy out) */
  function pt(x, y) { return { x: r5(x), y: r5(y), ix: r5(x), iy: r5(y), ox: r5(x), oy: r5(y) }; }
  function lerpPts(A, B, f) {
    if (!B || A.length !== B.length) return A;
    return A.map(function (a, i) { var b = B[i], o = {}; ["x", "y", "ix", "iy", "ox", "oy"].forEach(function (k) { o[k] = a[k] + (b[k] - a[k]) * f; });
      if (a.fe != null || b.fe != null) { var fa = a.fe != null ? +a.fe : +b.fe, fb = b.fe != null ? +b.fe : fa; o.fe = fa + (fb - fa) * f; }   // 2.511.0
      return o; });
  }
  /** the mask's points at tau (s into the clip): its keys glide (smooth in / out), else its own points */
  function pathAt(m, tau) {
    var K = Array.isArray(m.keys) ? m.keys.filter(function (k) { return k && Array.isArray(k.pts); }).slice().sort(function (a, b) { return a.at - b.at; }) : [];
    if (!K.length) return m.pts || [];
    if (tau <= K[0].at) return K[0].pts;
    if (tau >= K[K.length - 1].at) return K[K.length - 1].pts;
    for (var i = 0; i + 1 < K.length; i++) if (tau >= K[i].at && tau < K[i + 1].at) {
      var f = (tau - K[i].at) / Math.max(1e-9, K[i + 1].at - K[i].at);
      if (K[i].ease !== "linear") f = f * f * (3 - 2 * f);
      return lerpPts(K[i].pts, K[i + 1].pts, f);
    }
    return K[K.length - 1].pts;
  }
  var animated = function (m) { return Array.isArray(m.keys) && m.keys.length > 1; };
  /** the cubic pieces in pixels of a W x H picture: [[x0, y0, c1x, c1y, c2x, c2y, x1, y1]] */
  function segs(P, W, H, closed) {
    var out = [], n = P.length;
    for (var i = 0; i < (closed === false ? n - 1 : n); i++) {
      var a = P[i], b = P[(i + 1) % n];
      out.push([a.x * W, a.y * H, a.ox * W, a.oy * H, b.ix * W, b.iy * H, b.x * W, b.y * H]);
    }
    return out;
  }
  /** a polygon of the mask (each piece in `steps` straight bits) */
  function flatten(P, W, H, steps) {
    var out = [], n = steps || 16;
    segs(P, W, H, true).forEach(function (s) {
      for (var i = 0; i < n; i++) { var u = i / n, v = 1 - u; out.push([v * v * v * s[0] + 3 * v * v * u * s[2] + 3 * v * u * u * s[4] + u * u * u * s[6], v * v * v * s[1] + 3 * v * v * u * s[3] + 3 * v * u * u * s[5] + u * u * u * s[7]]); }
    });
    return out;
  }
  /** a point on the picture (px) -> the layer's own 0..1 (its box: centre cx / cy, size w / h, turned rot °) */
  function toLocal(b, x, y) {
    var a = -(b.rot || 0) * Math.PI / 180, dx = x - b.cx, dy = y - b.cy;
    return [(dx * Math.cos(a) - dy * Math.sin(a)) / b.w + 0.5, (dx * Math.sin(a) + dy * Math.cos(a)) / b.h + 0.5];
  }
  function toPic(b, u, v) {
    var a = (b.rot || 0) * Math.PI / 180, dx = (u - 0.5) * b.w, dy = (v - 0.5) * b.h;
    return [b.cx + dx * Math.cos(a) - dy * Math.sin(a), b.cy + dx * Math.sin(a) + dy * Math.cos(a)];
  }
  /* ---- 2.511.0 variable feather */
  /** each point's feather (its own, else the mask's) */
  var fes = function (m, P) { var d = Math.max(0, +m.feather || 0); return P.map(function (q) { return q && q.fe != null && isFinite(+q.fe) ? Math.max(0, +q.fe) : d; }); };
  var isVar = function (m, P) { return (P || []).some(function (q) { return q && q.fe != null; }); };
  /** points along the edge [[x, y, feather]] (each piece `steps` long, its feather gliding between its two points') */
  function edgeSamples(P, W, H, F, steps) {
    var out = [], n = steps || 16, S = segs(P, W, H, true);
    S.forEach(function (s, i) {
      var f0 = F[i], f1 = F[(i + 1) % P.length];
      for (var k = 0; k < n; k++) { var u = k / n, v = 1 - u; out.push([v * v * v * s[0] + 3 * v * v * u * s[2] + 3 * v * u * u * s[4] + u * u * u * s[6], v * v * v * s[1] + 3 * v * v * u * s[3] + 3 * v * u * u * s[5] + u * u * u * s[7], f0 + (f1 - f0) * u]); }
    });
    return out;
  }
  /** a coarse map (every `step` px) of the feather of the nearest edge sample -> {gw, gh, step, f: Float32Array} */
  function featherGrid(E, W, H, step) {
    var gw = Math.ceil(W / step) + 1, gh = Math.ceil(H / step) + 1, f = new Float32Array(gw * gh);
    for (var j = 0; j < gh; j++) for (var i = 0; i < gw; i++) {
      var x = i * step, y = j * step, bd = Infinity, bf = 0;
      for (var k = 0; k < E.length; k++) { var dx = E[k][0] - x, dy = E[k][1] - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; bf = E[k][2]; } }
      f[j * gw + i] = bf;
    }
    return { gw: gw, gh: gh, step: step, f: f };
  }
  /** the blur levels from fmin to fmax (k of them) */
  var levelsOf = function (a, b, k) { var o = []; for (var i = 0; i < k; i++) o.push(a + (b - a) * i / Math.max(1, k - 1)); return o; };
  /** a feather f between the levels -> [the level below, the share of the one above] */
  function blendAt(f, L) {
    if (f <= L[0]) return [0, 0]; if (f >= L[L.length - 1]) return [L.length - 1, 0];
    for (var i = 0; i + 1 < L.length; i++) if (f >= L[i] && f <= L[i + 1]) return [i, (f - L[i]) / Math.max(1e-9, L[i + 1] - L[i])];
    return [L.length - 1, 0];
  }
  var live = function (c) { return !!(c && Array.isArray(c.masks) && c.masks.some(function (m) { return m && m.on !== false && m.closed !== false && (m.pts || []).length >= 3; })); };
  var sig = function (c, tau) { return JSON.stringify((c.masks || []).map(function (m) { return [m.on, m.mode, m.feather, m.expand, m.op, m.inv, m.closed, animated(m) ? pathAt(m, tau) : m.pts, animated(m) ? 1 : 0]; })); };
  var pure = { MODES: MODES, DEFAULTS: DEFAULTS, pt: pt, lerpPts: lerpPts, pathAt: pathAt, animated: animated, segs: segs, flatten: flatten, toLocal: toLocal, toPic: toPic, live: live, sig: sig,
    fes: fes, isVar: isVar, edgeSamples: edgeSamples, featherGrid: featherGrid, levelsOf: levelsOf, blendAt: blendAt };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ---------------- the page ---------------- */
  root.TlMask = Object.assign({ ready: false }, pure);
  function ready() { try { return !!(window.TlCanvas && TlCanvas.addTool && TlCanvas.onProps && window.TlParent && TlParent.bakeAll && window.H3Keyframes && typeof tl === "object" && tl); } catch (e) { return false; } }
  function boot() { if (ready()) install(); else setTimeout(boot, 300); }
  boot();
  function install() {
    if (root.TlMask.ready) return;
    var C = window.TlCanvas, KF = window.H3Keyframes, FPS = KF.FPS || 24;
    function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function say(t) { try { C.say(t); } catch (e) { /* fine */ } }
    var sizeOf = function (p) { return [p.videoWidth || p.naturalWidth || p.width || 1, p.videoHeight || p.naturalHeight || p.height || 1]; };
    function trace(g, P, W, H, closed) {
      g.beginPath(); var S = segs(P, W, H, closed); if (!S.length) return;
      g.moveTo(S[0][0], S[0][1]); S.forEach(function (s) { g.bezierCurveTo(s[2], s[3], s[4], s[5], s[6], s[7]); }); if (closed !== false) g.closePath();
    }
    var tmpC = null;
    /** the masks of c at tau as one alpha picture MW x MH (white = shown) - or null (no mask on) */
    // 2.516.0: a mask's feather / expansion / opacity may be keyed (static/anykeys.js "@masks.N.*") - here for the mask video too
    function maskCanvas(c, tau, W, H, into) {
      var u = window.H3AnyKeys && c.kf && c.kf.length ? H3AnyKeys.apply(c, tau, KF) : null;
      try { return maskCanvas0(c, tau, W, H, into); } finally { if (u) u(); }
    }
    function maskCanvas0(c, tau, W, H, into) {
      var ms = (c.masks || []).filter(function (m) { return m && m.on !== false && m.closed !== false && (m.pts || []).length >= 3; });
      if (!ms.length) return null;
      var M = into || document.createElement("canvas"); if (M.width !== W) M.width = W; if (M.height !== H) M.height = H;
      var g = M.getContext("2d"), k = W / Math.max(1, (c.__mw || W));
      void k;
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; g.filter = "none"; g.clearRect(0, 0, W, H);
      if (ms[0].mode === "subtract") { g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); }
      tmpC = tmpC || document.createElement("canvas"); if (tmpC.width !== W) tmpC.width = W; if (tmpC.height !== H) tmpC.height = H;
      var t = tmpC.getContext("2d"), px = W / Math.max(1, c.__iw || W);                        // picture px -> mask px
      ms.forEach(function (m, i) {
        var P = pathAt(m, tau);
        t.setTransform(1, 0, 0, 1, 0, 0); t.globalCompositeOperation = "source-over"; t.globalAlpha = 1; t.filter = "none"; t.clearRect(0, 0, W, H);
        t.fillStyle = "#fff"; t.strokeStyle = "#fff"; t.lineJoin = "round"; trace(t, P, W, H, true); t.fill();
        var e = (+m.expand || 0) * px;
        if (e > 0) { t.lineWidth = 2 * e; t.stroke(); }
        else if (e < 0) { t.globalCompositeOperation = "destination-out"; t.lineWidth = -2 * e; t.stroke(); t.globalCompositeOperation = "source-over"; }
        if (m.inv) { t.globalCompositeOperation = "xor"; t.fillRect(0, 0, W, H); t.globalCompositeOperation = "source-over"; }
        var f = Math.max(0, +m.feather || 0) * px, VF = isVar(m, P) ? varFeather(tmpC, m, P, W, H, px) : null;   // 2.511.0: each point its own feather
        g.filter = !VF && f > 0.3 ? "blur(" + (f / 2).toFixed(2) + "px)" : "none";
        g.globalAlpha = Math.max(0, Math.min(1, (m.op == null ? 100 : +m.op) / 100));
        g.globalCompositeOperation = i === 0 && m.mode !== "subtract" ? "source-over" : { add: "source-over", subtract: "destination-out", intersect: "destination-in", difference: "xor" }[m.mode] || "source-over";
        g.drawImage(VF || tmpC, 0, 0);
        g.filter = "none"; g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
      });
      return M;
    }
    /** 2.511.0: the hard mask src (W x H, white) softened by each point's feather (picture px x px) */
    var vfL = [], vfO = null;
    function varFeather(src, m, P, W, H, px) {
      var F = fes(m, P).map(function (v) { return v * px; }), lo = Math.min.apply(null, F), hi = Math.max.apply(null, F);
      var L = levelsOf(lo, hi, hi - lo < 0.5 ? 1 : 6), A = L.map(function (f, i) {
        var cv = vfL[i] || (vfL[i] = document.createElement("canvas")); if (cv.width !== W) cv.width = W; if (cv.height !== H) cv.height = H;
        var x = cv.getContext("2d"); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = "source-over"; x.globalAlpha = 1; x.clearRect(0, 0, W, H);
        x.filter = f > 0.3 ? "blur(" + (f / 2).toFixed(2) + "px)" : "none"; x.drawImage(src, 0, 0); x.filter = "none";
        return x.getImageData(0, 0, W, H).data;
      });
      var step = Math.max(4, Math.round(Math.max(W, H) / 160)), G = featherGrid(edgeSamples(P, W, H, F, 12), W, H, step);
      vfO = vfO || document.createElement("canvas"); if (vfO.width !== W) vfO.width = W; if (vfO.height !== H) vfO.height = H;
      var og = vfO.getContext("2d"), im = og.createImageData(W, H), d = im.data;
      for (var y = 0; y < H; y++) {
        var gy = y / step, j = Math.min(G.gh - 2, Math.floor(gy)), fy = gy - j;
        for (var x2 = 0; x2 < W; x2++) {
          var gx = x2 / step, i = Math.min(G.gw - 2, Math.floor(gx)), fx = gx - i;
          var f00 = G.f[j * G.gw + i], f10 = G.f[j * G.gw + i + 1], f01 = G.f[(j + 1) * G.gw + i], f11 = G.f[(j + 1) * G.gw + i + 1];
          var ff = (f00 * (1 - fx) + f10 * fx) * (1 - fy) + (f01 * (1 - fx) + f11 * fx) * fy, bw = blendAt(ff, L), p4 = (y * W + x2) * 4 + 3;
          var a = bw[1] > 0 ? A[bw[0]][p4] * (1 - bw[1]) + A[bw[0] + 1][p4] * bw[1] : A[bw[0]][p4];
          d[p4 - 3] = 255; d[p4 - 2] = 255; d[p4 - 1] = 255; d[p4] = a;
        }
      }
      og.putImageData(im, 0, 0);
      return vfO;
    }
    var cacheM = new WeakMap(), outs = new WeakMap();
    /** the picture with c's masks (the canvas draws this in place of the picture) */
    function apply(pic, c, tau) {
      if (!live(c)) return pic;
      var sz = sizeOf(pic), W = sz[0], H = sz[1], k = Math.min(1, 1600 / Math.max(W, H)), MW = Math.max(1, Math.round(W * k)), MH = Math.max(1, Math.round(H * k));
      c.__iw = W;
      var s = sig(c, tau) + "|" + MW + "x" + MH, was = cacheM.get(c), M;
      if (was && was.s === s) M = was.M; else { M = maskCanvas(c, tau, MW, MH, was && was.M); cacheM.set(c, { s: s, M: M }); }
      if (!M) return pic;
      var O = outs.get(c); if (!O) { O = document.createElement("canvas"); outs.set(c, O); }
      if (O.width !== W) O.width = W; if (O.height !== H) O.height = H;
      var g = O.getContext("2d"); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; g.clearRect(0, 0, W, H);
      try { g.drawImage(pic, 0, 0, W, H); } catch (e) { return pic; }
      g.globalCompositeOperation = "destination-in"; g.drawImage(M, 0, 0, W, H); g.globalCompositeOperation = "source-over";
      return O;
    }

    /* ---- ✒ the Mask Pen */
    var ED = null, DR = null;            // ED: {c, i (the mask being drawn)}; DR: a drag {c, i, j, what: "new" | "pt" | "in" | "out", alt}
    var sel = function () { var s = C.selClip(); return s && s.c && s.Ly && s.Ly.kind !== "v1" && s.Ly.kind !== "aud" ? s : null; };
    var tauNow = function (c) { return (C.state.t || 0) - (c.start || 0); };
    var boxOf = function (s) { return C.box(s.c, s.Ly.kind, C.state.t); };
    var zoom = function () { return (C.state.view && C.state.view.z) || 1; };
    function pointsNow(m, c) { return animated(m) || (m.keys && m.keys.length) ? pathAt(m, tauNow(c)) : m.pts; }
    function keyHere(m, c, P) {                 // a mask with keys: the edit becomes a key at the playhead
      if (!Array.isArray(m.keys) || !m.keys.length) { m.pts = P; return; }
      var at = Math.round(tauNow(c) * FPS) / FPS, k = m.keys.filter(function (q) { return Math.abs(q.at - at) < 0.5 / FPS; })[0];
      if (k) k.pts = P; else m.keys.push({ at: at, pts: P });
      m.keys.sort(function (a, b) { return a.at - b.at; }); m.pts = m.keys[0].pts;
    }
    function changed(c, repaint) { delete c.bakeSig; delete c.mbakeSig; if (typeof tlSave === "function") tlSave(); C.mark(); if (repaint) C.paintProps(); }
    function hit(s, x, y) {                     // a point / handle of the picked layer's masks near (x, y)
      var b = boxOf(s); if (!b) return null; var R = 8 / zoom(), best = null;
      (s.c.masks || []).forEach(function (m, i) {
        var P = pointsNow(m, s.c) || [];
        P.forEach(function (q, j) {
          [["pt", q.x, q.y], ["in", q.ix, q.iy], ["out", q.ox, q.oy]].forEach(function (h) {
            if (h[0] !== "pt" && Math.abs(h[1] - q.x) < 1e-9 && Math.abs(h[2] - q.y) < 1e-9) return;
            var p = toPic(b, h[1], h[2]), d = Math.hypot(p[0] - x, p[1] - y);
            if (d <= R && (!best || d < best.d - (h[0] === "pt" ? 0.5 : 0))) best = { i: i, j: j, what: h[0], d: d };
          });
        });
      });
      return best;
    }
    function finishOpen(close) {
      if (!ED) return; var m = ED.c.masks[ED.i];
      if (m && close && (m.pts || []).length >= 3) { m.closed = true; say("✒ mask " + (ED.i + 1) + " closed - its mode, feather, expansion are in the Properties (✒ Masks)"); }
      else if (m && (m.pts || []).length < 3) { ED.c.masks.splice(ED.i, 1); if (!ED.c.masks.length) delete ED.c.masks; say("✒ a mask needs 3 points at least"); }
      else if (m) { m.closed = true; }
      var c = ED.c; ED = null; changed(c, true);
    }
    C.addTool({ id: "maskpen", icon: "✒", title: "Mask Pen - on the picked layer: click = a corner, drag = a curve, click the first point (or Enter) = closed; drag points / handles to change a mask", key: "shift+m", cursor: "crosshair",
      down: function (p, ev) {
        var s = sel(); if (!s) { say("✒ Mask Pen: pick a layer first (Move tool), then draw on it"); return; }
        var b = boxOf(s); if (!b) return;
        var u = toLocal(b, p.x, p.y);
        if (ED && ED.c === s.c) {
          var m = s.c.masks[ED.i], f = toPic(b, m.pts[0].x, m.pts[0].y);
          if (m.pts.length >= 3 && Math.hypot(f[0] - p.x, f[1] - p.y) <= 9 / zoom()) { finishOpen(true); return; }
          m.pts.push(pt(u[0], u[1])); DR = { c: s.c, i: ED.i, j: m.pts.length - 1, what: "new" }; changed(s.c, false); return;
        }
        if (ED) finishOpen(true);
        var h = hit(s, p.x, p.y);
        if (h) { DR = { c: s.c, i: h.i, j: h.j, what: h.what === "pt" && ev && ev.shiftKey ? "fe" : h.what, alt: !!(ev && ev.altKey), P: JSON.parse(JSON.stringify(pointsNow(s.c.masks[h.i], s.c))), u0: u }; return; }   // 2.511.0: Shift = the point's feather
        s.c.masks = s.c.masks || [];
        s.c.masks.push(Object.assign({}, DEFAULTS, { closed: false, pts: [pt(u[0], u[1])] }));
        ED = { c: s.c, i: s.c.masks.length - 1 }; DR = { c: s.c, i: ED.i, j: 0, what: "new" };
        say("✒ mask " + s.c.masks.length + ": click the next points (drag = a curve); click the first point or Enter to close");
        changed(s.c, false);
      },
      move: function (p) {
        if (!DR) return; var s = sel(); if (!s || s.c !== DR.c) return; var b = boxOf(s); if (!b) return;
        var u = toLocal(b, p.x, p.y), m = DR.c.masks[DR.i];
        if (DR.what === "new") { var q = m.pts[DR.j]; q.ox = r5(u[0]); q.oy = r5(u[1]); q.ix = r5(2 * q.x - u[0]); q.iy = r5(2 * q.y - u[1]); }
        else {
          var P = JSON.parse(JSON.stringify(DR.P)), q2 = P[DR.j];
          if (DR.what === "fe") { var qp = toPic(b, q2.x, q2.y), kk = (s.c.__iw || b.w) / Math.max(1e-6, b.w); q2.fe = Math.round(Math.hypot(p.x - qp[0], p.y - qp[1]) * kk); }   // 2.511.0: picture px
          else if (DR.what === "pt") { var dx = u[0] - DR.u0[0], dy = u[1] - DR.u0[1]; ["x", "ix", "ox"].forEach(function (k) { q2[k] = r5(q2[k] + dx); }); ["y", "iy", "oy"].forEach(function (k) { q2[k] = r5(q2[k] + dy); }); }
          else {
            var a = DR.what === "in" ? ["ix", "iy", "ox", "oy"] : ["ox", "oy", "ix", "iy"];
            q2[a[0]] = r5(u[0]); q2[a[1]] = r5(u[1]);
            if (!DR.alt) { q2[a[2]] = r5(2 * q2.x - u[0]); q2[a[3]] = r5(2 * q2.y - u[1]); }
          }
          keyHere(m, DR.c, P);
        }
        C.mark();
      },
      up: function () { var d = DR; DR = null; if (d) changed(d.c, false); } });
    // Enter / Esc while drawing
    document.addEventListener("keydown", function (e) {
      if (!ED || C.state.tool !== "maskpen") return;
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === "Enter") { e.preventDefault(); finishOpen(true); }
      else if (e.key === "Escape") { e.preventDefault(); finishOpen(false); }
    }, true);
    // the masks of the picked layer on the canvas (the points / handles while the Mask Pen is on)
    C.onDraw(function (ctx, o) {
      var s = sel(); if (!s || !s.c.masks || !s.c.masks.length) return;
      var b = boxOf(s); if (!b) return;
      var penOn = C.state.tool === "maskpen";
      s.c.masks.forEach(function (m, i) {
        var P = pointsNow(m, s.c) || []; if (!P.length) return;
        var scr = function (u, v) { var q = toPic(b, u, v); return o.toScreen(q[0], q[1]); };
        ctx.save(); ctx.strokeStyle = m.on === false ? "rgba(255,212,0,.35)" : "#ffd400"; ctx.lineWidth = 1.5; if (m.closed === false) ctx.setLineDash([5, 3]);
        ctx.beginPath(); var S = segs(P, 1, 1, m.closed !== false);
        if (S.length) { var a0 = scr(S[0][0], S[0][1]); ctx.moveTo(a0.x, a0.y); S.forEach(function (sg) { var c1 = scr(sg[2], sg[3]), c2 = scr(sg[4], sg[5]), e = scr(sg[6], sg[7]); ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, e.x, e.y); }); if (m.closed !== false) ctx.closePath(); }
        else { var q0 = scr(P[0].x, P[0].y); ctx.moveTo(q0.x, q0.y); }
        ctx.stroke(); ctx.setLineDash([]);
        if (penOn) P.forEach(function (q) {
          var a = scr(q.x, q.y);
          [[q.ix, q.iy], [q.ox, q.oy]].forEach(function (hh) { if (Math.abs(hh[0] - q.x) < 1e-9 && Math.abs(hh[1] - q.y) < 1e-9) return; var h2 = scr(hh[0], hh[1]); ctx.strokeStyle = "#9ad"; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(h2.x, h2.y); ctx.stroke(); ctx.fillStyle = "#9ad"; ctx.beginPath(); ctx.arc(h2.x, h2.y, 3, 0, 7); ctx.fill(); });
          ctx.fillStyle = "#ffd400"; ctx.fillRect(a.x - 3.5, a.y - 3.5, 7, 7);
          if (q.fe != null) { var rr = (+q.fe) * b.w / Math.max(1, s.c.__iw || b.w) * zoom(); ctx.save(); ctx.strokeStyle = "rgba(255,212,0,.6)"; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(a.x, a.y, Math.max(2, rr), 0, 7); ctx.stroke(); ctx.restore(); }   // 2.511.0: its feather
        });
        ctx.fillStyle = "#ffd400"; ctx.font = "11px sans-serif"; var lb = scr(P[0].x, P[0].y); ctx.fillText("M" + (i + 1), lb.x + 6, lb.y - 6);
        ctx.restore();
      });
    });
    /* ---- ✒ Masks in the Properties */
    C.onProps(function (Pn, c, s) {
      if (!c || !Pn || !s || !s.Ly || s.Ly.kind === "v1" || s.Ly.kind === "aud" || c.adjust || c.nul) return;
      var ms = c.masks || [], d = document.createElement("div"); d.className = "tlp-masks";
      var h = '<div class="tlp-t">✒ Masks</div>';
      if (!ms.length) h += '<div class="tlp-row"><span class="tlp-none">none - draw one with ✒ Mask Pen (Shift+M) on this layer</span><button class="ghost" id="tlpMkPen">✒ Mask Pen</button></div>';
      ms.forEach(function (m, i) {
        var keyed = Array.isArray(m.keys) && m.keys.length;
        h += '<div class="tlp-row" style="flex-wrap:wrap"><label><input type="checkbox" data-mkon="' + i + '"' + (m.on !== false ? " checked" : "") + "> Mask " + (i + 1) + (m.closed === false ? " (open)" : "") + "</label>"
          + '<select data-mkmode="' + i + '">' + MODES.map(function (md) { return "<option" + (m.mode === md ? " selected" : "") + ">" + md + "</option>"; }).join("") + "</select>"
          + [["feather", "feather px"], ["expand", "expansion px"], ["op", "opacity %"]].map(function (f) { return '<label style="white-space:nowrap">' + f[1] + ' <input type="number" data-mkn="' + i + ":" + f[0] + '" value="' + (m[f[0]] == null ? DEFAULTS[f[0]] : m[f[0]]) + '" step="any" style="width:52px"></label>'; }).join("")
          + '<label><input type="checkbox" data-mkinv="' + i + '"' + (m.inv ? " checked" : "") + "> invert</label>"
          + '<button class="ghost" data-mkkey="' + i + '" title="Key this mask\'s path at the playhead (keys glide from one to the next)">' + (keyed ? "◆ " + m.keys.length : "◇") + "</button>"
          + (isVar(m, pointsNow(m, c) || []) ? '<button class="ghost" data-mkfe="' + i + '" title="Each point has its own feather (Shift+drag a point with the ✒ Mask Pen) - this puts them all back to the feather">variable feather ✕</button>' : '<span class="fx-dim" title="Shift+drag a point with the ✒ Mask Pen for its own feather">⇧ point feather</span>')
          + '<button class="ghost" data-mkx="' + i + '" title="Delete this mask">✕</button></div>';
      });
      d.innerHTML = h; Pn.appendChild(d);
      var pen = d.querySelector("#tlpMkPen"); if (pen) pen.addEventListener("click", function () { C.setTool("maskpen"); say("✒ Mask Pen: click points on the layer (drag = a curve), click the first point to close"); });
      d.querySelectorAll("[data-mkon]").forEach(function (el) { el.addEventListener("change", function () { c.masks[+el.dataset.mkon].on = el.checked; changed(c, false); }); });
      d.querySelectorAll("[data-mkinv]").forEach(function (el) { el.addEventListener("change", function () { c.masks[+el.dataset.mkinv].inv = el.checked; changed(c, false); }); });
      d.querySelectorAll("[data-mkmode]").forEach(function (el) { el.addEventListener("change", function () { c.masks[+el.dataset.mkmode].mode = el.value; changed(c, false); }); });
      d.querySelectorAll("[data-mkn]").forEach(function (el) { el.addEventListener("keydown", function (e) { e.stopPropagation(); }); el.addEventListener("input", function () { var nk = el.dataset.mkn.split(":"), v = +el.value; if (Number.isFinite(v)) { c.masks[+nk[0]][nk[1]] = v; changed(c, false); } }); });
      d.querySelectorAll("[data-mkfe]").forEach(function (el) { el.addEventListener("click", function () { var m = c.masks[+el.dataset.mkfe]; (m.pts || []).forEach(function (q) { delete q.fe; }); (m.keys || []).forEach(function (k) { (k.pts || []).forEach(function (q) { delete q.fe; }); }); changed(c, true); }); });   // 2.511.0
      d.querySelectorAll("[data-mkx]").forEach(function (el) { el.addEventListener("click", function () { c.masks.splice(+el.dataset.mkx, 1); if (!c.masks.length) delete c.masks; ED = null; changed(c, true); }); });
      d.querySelectorAll("[data-mkkey]").forEach(function (el) { el.addEventListener("click", function () {
        var m = c.masks[+el.dataset.mkkey], P = JSON.parse(JSON.stringify(pointsNow(m, c)));
        if (!Array.isArray(m.keys) || !m.keys.length) m.keys = [];
        var at = Math.round(tauNow(c) * FPS) / FPS, k = m.keys.filter(function (q) { return Math.abs(q.at - at) < 0.5 / FPS; })[0];
        if (k) k.pts = P; else m.keys.push({ at: at, pts: P });
        m.keys.sort(function (a, b) { return a.at - b.at; });
        say("◆ mask " + (+el.dataset.mkkey + 1) + " path keyed at " + at.toFixed(2) + " s - move the playhead, change the points (✒ Mask Pen), key again");
        changed(c, true);
      }); });
    });

    /* ---- the compile: a VIDEO layer's masks -> a grey mask video (pictures go through TlParent's bake) */
    function bakeMask(x) {
      var c = x.c, len = Math.max(0.05, C.clipLen(c, "vl")), anim = (c.masks || []).some(animated) || (window.H3AnyKeys && H3AnyKeys.keyed(c).some(function (p) { return /^masks\./.test(p); })), n = anim ? Math.max(1, Math.round(len * FPS)) + 1 : 1, fps = anim ? FPS : 1;
      var b = C.box(c, "vl", c.start || 0), vw = b && b.src ? b.src.videoWidth || b.w : 1280, vh = b && b.src ? b.src.videoHeight || b.h : 720;
      var k = Math.min(1, 960 / Math.max(vw, vh)), W = Math.max(2, Math.round(vw * k / 2) * 2), H = Math.max(2, Math.round(vh * k / 2) * 2);
      c.__iw = vw;
      var cv = document.createElement("canvas"); cv.width = W; cv.height = H; var g = cv.getContext("2d"), id = (c.uid || (c.uid = "u" + Math.random().toString(36).slice(2, 10))) + "m";
      var frame = function (i) {
        var M = maskCanvas(c, Math.min(len, i / fps), W, H);
        g.globalCompositeOperation = "source-over"; g.fillStyle = "#000"; g.fillRect(0, 0, W, H); if (M) g.drawImage(M, 0, 0);
        return new Promise(function (ok) { cv.toBlob(ok, "image/png"); });
      };
      var i = 0, step = function () {
        if (i >= n) return Promise.resolve(); var q = i++;
        return frame(q).then(function (blob) { return fetch("/api/tlbake/frame?id=" + encodeURIComponent(id) + "&i=" + q, { method: "POST", headers: { "Content-Type": "image/png" }, body: blob }); })
          .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); }); }).then(step);
      };
      return step().then(function () { return fetch("/api/tlbake/encode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id, fps: fps, frames: n }) }); })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); })
        .then(function (j) { c.mbake = j.name; c.mbakeSig = sigAll(c); if (typeof tlSave === "function") tlSave(); return j; });
    }
    var sigAll = function (c) { return JSON.stringify([c.masks, C.clipLen(c, "vl"), c.start, (c.kf || []).filter(function (k) { return Object.keys(k).some(function (p) { return /^@masks\./.test(p); }); })]); };   // 2.516.0: + its keyed mask settings
    function bakeMasks() {
      var todo = (window.TlParent ? TlParent.all() : []).filter(function (x) { return x.kind === "vl" && live(x.c) && x.L.visible !== false; });
      (window.TlParent ? TlParent.all() : []).forEach(function (x) { if (x.kind === "vl" && !live(x.c) && x.c.mbake) { delete x.c.mbake; delete x.c.mbakeSig; } });
      var run = Promise.resolve();
      todo.forEach(function (x) { if (x.c.mbake && x.c.mbakeSig === sigAll(x.c)) return; run = run.then(function () { say("✒ the masks of " + (x.L.name || "a video layer") + "…"); return bakeMask(x); }); });
      return run.then(function () { if (todo.length) say("✒ " + todo.length + " masked video layer(s) ready for the compile"); });
    }
    var prevBake = TlParent.bakeAll;
    TlParent.bakeAll = function () { return Promise.resolve(prevBake.apply(this, arguments)).then(bakeMasks); };
    Object.assign(root.TlMask, { ready: true, apply: apply, maskCanvas: maskCanvas, bakeMasks: bakeMasks, finishOpen: finishOpen, editing: function () { return ED ? { i: ED.i } : null; } });
  }
})(typeof window !== "undefined" ? window : globalThis);
