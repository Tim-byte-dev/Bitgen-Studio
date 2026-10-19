/* bitGen Studio — ext/timelinedock/tltextanim.js (2.493.0): TEXT ANIMATORS - per-letter, per-word or per-line animation of
 * a timeline text layer. window.TlTextAnim.
 *
 * Tim (verbatim): "go with 1,2,4,5 and 6 as you suggested" - AFTER-EFFECTS-GAP.md item 5: "Text animators: per-letter
 * range selectors (position, rotation, opacity, blur, tracking), typewriter".
 *
 *   ✨ Text Animators   (a text layer's Properties) + Animator: Custom, Typewriter, Fade up, Pop in, Slide in, Wave,
 *                       Blur in. Each animator has
 *     what it changes   position x / y (px), scale %, rotation °, opacity %, tracking (px), blur (px), and optionally a
 *                       colour - on the letters it selects, by how much they are selected
 *     the range         start / end / offset (%), amount (%), by letters / words / lines, and its shape: square (with
 *                       the edge letter partly in), ramp up, ramp down, triangle, round, smooth
 *     every number      a ◇ to key it at the playhead (keys "ta<n>_<name>" - the 📈 Graph Editor lists them)
 *   The compile         a text layer with animators is baked by the page (TlParent's bake, video/tlb_<uid>.webm)
 *   〰 On a path         2.496.0 (Tim: "text on a path"): the letters run along a circle, an arc, a wave or a shape
 *                       layer's outline (its form, at the text's place): radius / span / height / wavelength, where the
 *                       text starts (offset %, keyable ◇ - slide it along), the other way round (inside a circle);
 *                       each letter turned to the path; the animators still move / turn / scale the letters (x along
 *                       the path, y across it). Baked for the compile like the animators.
 * Pure (Node: scripts/test-textanim.js): DEFAULTS, NUMS, units (which letter belongs to which word / line), coverage,
 * weight (one letter's selection), combine (several animators on one letter), PRESETS; 2.496.0 PATH_DEFAULTS,
 * pathPoly (the path as points round its middle), placeAt (a point + its turn at a distance along it).
 */
(function (root) {
  "use strict";
  var DEFAULTS = { on: true, based: "chars", shape: "square", start: 0, end: 100, offset: 0, amount: 100,
                   x: 0, y: 0, scale: 100, rot: 0, op: 100, track: 0, blur: 0, colorOn: false, color: "#ff3b30" };
  var NUMS = ["start", "end", "offset", "amount", "x", "y", "scale", "rot", "op", "track", "blur"];
  var SHAPES = ["square", "rampup", "rampdown", "triangle", "round", "smooth"];

  /** each letter's unit index and the number of units: letters (spaces count), words (spaces belong to none) or lines */
  function units(text, based) {
    var s = String(text == null ? "" : text), idx = [], n = 0, i;
    if (based === "lines") { var ln = 0; for (i = 0; i < s.length; i++) { if (s[i] === "\n") { idx.push(-1); ln++; continue; } idx.push(ln); } return { idx: idx, n: ln + 1 }; }
    if (based === "words") {
      var w = -1, inWord = false;
      for (i = 0; i < s.length; i++) { var sp = /\s/.test(s[i]); if (!sp && !inWord) { w++; inWord = true; } if (sp) inWord = false; idx.push(sp ? -1 : w); }
      return { idx: idx, n: Math.max(1, w + 1) };
    }
    for (i = 0; i < s.length; i++) { if (s[i] === "\n") { idx.push(-1); continue; } idx.push(n++); }
    return { idx: idx, n: Math.max(1, n) };
  }
  /** how much of the span [u0, u1] (0..1) lies inside [a, b] */
  function coverage(u0, u1, a, b) { var lo = Math.max(u0, a), hi = Math.min(u1, b); return Math.max(0, Math.min(1, (hi - lo) / Math.max(1e-9, u1 - u0))); }
  /** unit k of n under one animator's range (start / end / offset in %, amount %, shape) -> 0..1 */
  function weight(k, n, A) {
    if (k < 0) return 0;
    var a = (Math.min(+A.start, +A.end) + +A.offset) / 100, b = (Math.max(+A.start, +A.end) + +A.offset) / 100, amt = Math.max(-1, Math.min(1, (+A.amount) / 100));
    if (b - a <= 1e-9) return 0;
    var u0 = k / n, u1 = (k + 1) / n, um = (u0 + u1) / 2, v;
    if (A.shape === "square" || !A.shape) v = coverage(u0, u1, a, b);
    else {
      if (um < a || um > b) v = 0;
      else {
        var f = (um - a) / (b - a);
        v = A.shape === "rampup" ? f : A.shape === "rampdown" ? 1 - f : A.shape === "triangle" ? 1 - Math.abs(2 * f - 1)
          : A.shape === "round" ? Math.sqrt(Math.max(0, 1 - Math.pow(2 * f - 1, 2))) : (function () { var q = 1 - Math.abs(2 * f - 1); return q * q * (3 - 2 * q); })();
      }
    }
    return v * amt;
  }
  /** several animators on one letter (each [values, weight]): offsets / turns / tracking / blur add, scale and opacity
   *  multiply, the last coloured one with any weight sets the colour */
  function combine(list) {
    var o = { x: 0, y: 0, scale: 1, rot: 0, op: 1, track: 0, blur: 0, color: null, cw: 0 };
    list.forEach(function (it) {
      var A = it[0], w = it[1]; if (!w) return;
      o.x += (+A.x || 0) * w; o.y += (+A.y || 0) * w; o.rot += (+A.rot || 0) * w; o.track += (+A.track || 0) * w; o.blur += Math.max(0, (+A.blur || 0) * w);
      o.scale *= 1 + ((+A.scale) / 100 - 1) * w; o.op *= Math.max(0, 1 + ((+A.op) / 100 - 1) * w);
      if (A.colorOn) { o.color = A.color; o.cw = Math.max(0, Math.min(1, Math.abs(w))); }
    });
    o.op = Math.max(0, Math.min(1, o.op)); o.scale = Math.max(0, o.scale);
    return o;
  }
  /** presets: the animator + the keys it starts with ([prop, [[at (s into the clip), value], ...]]) */
  function PRESETS(len) {
    var L = Math.max(0.2, Math.min(+len || 2, 2));
    return {
      typewriter: { name: "Typewriter", a: { op: 0, shape: "square" }, keys: [["start", [[0, 0], [L, 100]]]] },
      fadeup: { name: "Fade up (letters)", a: { op: 0, y: 40, shape: "rampup", start: 0, end: 25 }, keys: [["offset", [[0, -25], [L, 100]]]] },
      popin: { name: "Pop in", a: { scale: 0, op: 0, shape: "smooth", start: 0, end: 30 }, keys: [["offset", [[0, -30], [L, 100]]]] },
      slidein: { name: "Slide in (words)", a: { x: -120, op: 0, based: "words", shape: "rampup", start: 0, end: 40 }, keys: [["offset", [[0, -40], [L, 100]]]] },
      wave: { name: "Wave", a: { y: -24, shape: "triangle", start: 0, end: 30 }, keys: [["offset", [[0, -30], [L, 100]]]] },
      blurin: { name: "Blur in", a: { blur: 12, op: 0, shape: "rampup", start: 0, end: 30 }, keys: [["offset", [[0, -30], [L, 100]]]] }
    };
  }
  /* ---------------- 2.496.0: TEXT ON A PATH ---------------- */
  var PATH_DEFAULTS = { on: true, path: "arc", r: 220, span: 160, amp: 40, wl: 320, off: 50, flip: false, uid: "" };   // 2.498.0: off 50 = centred on an arc
  var PATHS = [["arc", "an arc"], ["circle", "a circle"], ["wave", "a wave"], ["shape", "a shape layer"]];
  /** the path as points round its middle -> {pts, closed}; outline = a shape's closed outline (for "shape"), width =
   *  how long a wave must be at least */
  function pathPoly(o, width, outline) {
    var P = [], closed = false, i, r = Math.max(5, +o.r || 220);
    if (o.path === "circle") { for (i = 0; i < 240; i++) { var a = -Math.PI / 2 + i / 240 * Math.PI * 2; P.push([r * Math.cos(a), r * Math.sin(a)]); } closed = true; }
    else if (o.path === "wave") { var wl = Math.max(10, +o.wl || 320), amp = +o.amp || 0, W = Math.max(wl, (+width || 0) * 1.15), n = Math.max(40, Math.ceil(W / 4)); for (i = 0; i <= n; i++) { var x = -W / 2 + W * i / n; P.push([x, amp * Math.sin(2 * Math.PI * x / wl)]); } }
    else if (o.path === "shape" && outline && outline.length > 2) { P = outline.map(function (q) { return [q[0], q[1]]; }); if (Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) < 1e-6) P.pop(); closed = true; }
    else { var sp = Math.max(5, Math.min(359, +o.span || 160)) * Math.PI / 180, m = Math.max(24, Math.ceil(sp * r / 4)); for (i = 0; i <= m; i++) { var b = -Math.PI / 2 - sp / 2 + sp * i / m; P.push([r * Math.cos(b), r * Math.sin(b)]); } }
    if (o.flip) P.reverse();
    // round its middle (the text layer's place)
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; P.forEach(function (q) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); });
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return { pts: P.map(function (q) { return [q[0] - cx, q[1] - cy]; }), closed: closed };
  }
  /** the point d px along the path (a closed path wraps; an open one runs on straight past its ends) -> {x, y, ang} */
  function placeAt(poly, d) {
    var P = poly.pts, n = P.length, ring = poly.closed ? P.concat([P[0]]) : P, cum = [0], i;
    for (i = 1; i < ring.length; i++) cum.push(cum[i - 1] + Math.hypot(ring[i][0] - ring[i - 1][0], ring[i][1] - ring[i - 1][1]));
    var L = cum[cum.length - 1] || 1e-9;
    if (poly.closed) d = ((d % L) + L) % L;
    var seg = function (k) { var a = ring[k], b = ring[k + 1]; return [a, b, Math.atan2(b[1] - a[1], b[0] - a[0])]; };
    if (!poly.closed && d < 0) { var s0 = seg(0); return { x: s0[0][0] + Math.cos(s0[2]) * d, y: s0[0][1] + Math.sin(s0[2]) * d, ang: s0[2] }; }
    if (!poly.closed && d > L) { var sl = seg(ring.length - 2); return { x: sl[1][0] + Math.cos(sl[2]) * (d - L), y: sl[1][1] + Math.sin(sl[2]) * (d - L), ang: sl[2] }; }
    var k = 1; while (k < cum.length - 1 && cum[k] < d) k++;
    var s1 = seg(k - 1), f = (d - cum[k - 1]) / Math.max(1e-9, cum[k] - cum[k - 1]);
    void n;
    return { x: s1[0][0] + (s1[1][0] - s1[0][0]) * f, y: s1[0][1] + (s1[1][1] - s1[0][1]) * f, ang: s1[2], len: L };
  }
  var pure = { DEFAULTS: DEFAULTS, NUMS: NUMS, SHAPES: SHAPES, units: units, coverage: coverage, weight: weight, combine: combine, PRESETS: PRESETS, PATH_DEFAULTS: PATH_DEFAULTS, PATHS: PATHS, pathPoly: pathPoly, placeAt: placeAt };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ---------------- the page ---------------- */
  function ready() { try { return !!(window.TlCanvas && TlCanvas.onProps && TlCanvas.renderText && window.TlParent && TlParent.bake && window.H3Keyframes && typeof tl === "object" && tl); } catch (e) { return false; } }
  function boot() { if (ready()) install(); else setTimeout(boot, 300); }
  boot();
  function install() {
    if (window.TlTextAnim) return;
    var C = window.TlCanvas, KF = window.H3Keyframes, FPS = KF.FPS || 24;
    function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function say(t) { try { C.say(t); } catch (e) { /* fine */ } }
    var onPath = function (c) { return !!(c && c.text && c.text.onpath && c.text.onpath.on !== false); };
    var live = function (c) { return !!(c && c.text && ((Array.isArray(c.text.anim) && c.text.anim.some(function (a) { return a && a.on !== false; })) || onPath(c))); };   // 2.496.0: + on a path
    /** 2.496.0: the path settings at tau (offset / radius keyed: "tp_off", "tp_r") */
    function pathAt(c, tau) {
      var o = Object.assign({}, PATH_DEFAULTS, c.text.onpath || {});
      ["off", "r"].forEach(function (k) { if (KF.has(c.kf, "tp_" + k)) o[k] = KF.value(c.kf, tau, "tp_" + k, o[k]); if (c.expr && c.expr["tp_" + k] && window.TlExpr && TlExpr.num) o[k] = TlExpr.num(c, "tp_" + k, tau, o[k]); });   // 2.497.0: ƒx
      return o;
    }
    function shapeOutline(o, tau) {
      if (o.path !== "shape" || !o.uid || !window.TlShape || !window.TlParent) return null;
      var hit = TlParent.all().filter(function (x) { return x.c.uid === o.uid && x.c.shape; })[0]; if (!hit) return null;
      var sc = (hit.c.tf && hit.c.tf.scale) || 1, O = TlShape.outlines(TlShape.at(hit.c, tau), tau), L = O.lines[0];
      return L ? L.map(function (q) { return [q[0] * sc, q[1] * sc]; }) : null;
    }
    /** animator n at tau (its keyed numbers tweened) */
    function animAt(c, n, tau) {
      var A = Object.assign({}, DEFAULTS, c.text.anim[n]);
      if (c.kf && c.kf.length) NUMS.forEach(function (k) { var p = "ta" + n + "_" + k; if (KF.has(c.kf, p)) A[k] = KF.value(c.kf, tau, p, A[k]); });
      if (c.expr && window.TlExpr && TlExpr.num) NUMS.forEach(function (k) { var p = "ta" + n + "_" + k; if (c.expr[p]) A[k] = TlExpr.num(c, p, tau, A[k]); });   // 2.497.0: ƒx
      return A;
    }
    function mix(a, b, f) { var A = H(a), B = H(b); return "rgb(" + [0, 1, 2].map(function (i) { return Math.round(A[i] + (B[i] - A[i]) * f); }).join(",") + ")"; }
    function H(h) { var m = /^#?([0-9a-f]{6})$/i.exec(String(h || "")), v = m ? parseInt(m[1], 16) : 0xffffff; return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
    var cache = new WeakMap();
    /** the text's picture at tau with its animators - each letter placed, turned, scaled, faded, blurred on its own */
    function picture(c, tau) {
      var t = (C.textAt ? C.textAt(c, (c.start || 0) + tau) : c.text) || c.text, As = (c.text.anim || []).map(function (_, n) { return animAt(c, n, tau); }).filter(function (A) { return A.on !== false; });
      var OP = onPath(c) ? pathAt(c, tau) : null, OL = OP ? shapeOutline(OP, tau) : null;
      var sig = JSON.stringify([t, As, OP, OL ? OL.length + ":" + OL[0] : 0]), was = cache.get(c);
      if (was && was.sig === sig) return was.cv;
      var size = Math.max(4, Math.min(1000, +t.size || 48)), font = (t.italic ? "italic " : "") + (t.bold ? "bold " : "") + size + "px \"" + (t.font || "Arial") + "\", sans-serif";
      var cv = (was && was.cv) || document.createElement("canvas"), g = cv.getContext("2d");
      g.font = font;
      var s = String(t.content == null ? "" : t.content), lines = s.split("\n"), sw = Math.max(0, +t.strokeW || 0), sh = t.shadow ? Math.max(2, Math.round(size * 0.06)) : 0;
      var lh = Math.round(size * 1.22), pad = Math.ceil(sw + sh + size * 0.15);
      // each letter's selection, by its unit, for every animator
      var U = {}, per = [];
      As.forEach(function (A) { var b = A.based || "chars"; if (!U[b]) U[b] = units(s, b); });
      for (var i = 0; i < s.length; i++) per.push(combine(As.map(function (A) { var u = U[A.based || "chars"]; return [A, weight(u.idx[i], u.n, A)]; })));
      // the lines laid out as the plain text would be (+ the tracking the animators add)
      var gi = 0, layout = [], wmax = 1;
      lines.forEach(function (l, li) {
        var xs = [], extra = 0;
        for (var j = 0; j < l.length; j++) { xs.push(g.measureText(l.slice(0, j)).width + extra); extra += per[gi + j].track; }
        var lw = g.measureText(l || " ").width + extra; wmax = Math.max(wmax, lw);
        layout.push({ l: l, xs: xs, w: lw, start: gi, li: li });
        gi += l.length + 1;
      });
      var M = 0; per.forEach(function (o) { M = Math.max(M, Math.abs(o.x) + Math.abs(o.y) + size * Math.max(0, o.scale - 1) + o.blur * 2); });
      M = Math.ceil(M);
      if (OP) { onPathPicture(cv, g, font, t, s, layout, per, size, lh, pad, M, sw, sh, OP, OL, c, wmax); cache.set(c, { sig: sig, cv: cv }); return cv; }
      cv.width = Math.max(2, Math.ceil(wmax + 2 * (pad + M))); cv.height = Math.max(2, Math.ceil(lh * lines.length + 2 * (pad + M)));
      g.clearRect(0, 0, cv.width, cv.height); g.font = font; g.textBaseline = "middle"; g.textAlign = "center"; g.lineJoin = "round";
      var align = t.align === "left" || t.align === "right" ? t.align : "center";
      layout.forEach(function (L) {
        var x0 = align === "left" ? pad + M : align === "right" ? cv.width - pad - M - L.w : (cv.width - L.w) / 2, y = pad + M + lh * L.li + lh / 2;
        for (var j = 0; j < L.l.length; j++) {
          var ch = L.l[j], o = per[L.start + j]; if (/\s/.test(ch) || o.op <= 0 || o.scale <= 0) continue;
          var cw = g.measureText(ch).width, cx = x0 + L.xs[j] + cw / 2 + o.x, cy = y + o.y;
          g.save(); g.translate(cx, cy); g.rotate(o.rot * Math.PI / 180); g.scale(o.scale, o.scale); g.globalAlpha = o.op;
          if (o.blur > 0.05) g.filter = "blur(" + o.blur.toFixed(2) + "px)";
          var fill = o.color ? mix(t.color || "#ffffff", o.color, o.cw) : (t.color || "#fff");
          if (t.shadow) { g.save(); g.shadowColor = "rgba(0,0,0,.65)"; g.shadowBlur = sh * 1.5; g.shadowOffsetX = sh * 0.5; g.shadowOffsetY = sh * 0.5; g.fillStyle = fill; g.fillText(ch, 0, 0); g.restore(); }
          if (sw > 0) { g.strokeStyle = t.stroke || "#000"; g.lineWidth = sw * 2; g.strokeText(ch, 0, 0); }
          g.fillStyle = fill; g.fillText(ch, 0, 0);
          g.restore();
        }
      });
      cache.set(c, { sig: sig, cv: cv });
      return cv;
    }
    /** 2.496.0: the letters along the path: each at its distance along it, turned to it, standing on it (the next lines
     *  below it); the animators' x runs along the path, y across it */
    function onPathPicture(cv, g, font, t, s, layout, per, size, lh, pad, M, sw, sh, OP, OL, c, wmax) {
      var poly = pathPoly(OP, wmax, OL), L0 = placeAt(poly, 0).len || 1, align = t.align === "left" || t.align === "right" ? t.align : "center", spots = [];
      layout.forEach(function (Ln) {
        var start = (+OP.off || 0) / 100 * L0 - (align === "center" ? Ln.w / 2 : align === "right" ? Ln.w : 0);
        for (var j = 0; j < Ln.l.length; j++) {
          var ch = Ln.l[j], o = per[Ln.start + j]; if (/\s/.test(ch) || o.op <= 0 || o.scale <= 0) continue;
          var cw = g.measureText(ch).width, q = placeAt(poly, start + Ln.xs[j] + cw / 2 + o.x), up = [Math.sin(q.ang), -Math.cos(q.ang)], lift = size * 0.35 - Ln.li * lh - o.y;
          spots.push({ ch: ch, o: o, x: q.x + up[0] * lift, y: q.y + up[1] * lift, ang: q.ang });
        }
      });
      var E = size + pad + M; var R = 4; spots.forEach(function (p) { R = Math.max(R, Math.abs(p.x) + E, Math.abs(p.y) + E); });
      cv.width = cv.height = Math.max(2, Math.ceil(2 * R));
      g.clearRect(0, 0, cv.width, cv.height); g.font = font; g.textBaseline = "middle"; g.textAlign = "center"; g.lineJoin = "round";
      spots.forEach(function (p) {
        var o = p.o; g.save(); g.translate(R + p.x, R + p.y); g.rotate(p.ang + o.rot * Math.PI / 180); g.scale(o.scale, o.scale); g.globalAlpha = o.op;
        if (o.blur > 0.05) g.filter = "blur(" + o.blur.toFixed(2) + "px)";
        var fill = o.color ? mix(t.color || "#ffffff", o.color, o.cw) : (t.color || "#fff");
        if (t.shadow) { g.save(); g.shadowColor = "rgba(0,0,0,.65)"; g.shadowBlur = sh * 1.5; g.shadowOffsetX = sh * 0.5; g.shadowOffsetY = sh * 0.5; g.fillStyle = fill; g.fillText(p.ch, 0, 0); g.restore(); }
        if (sw > 0) { g.strokeStyle = t.stroke || "#000"; g.lineWidth = sw * 2; g.strokeText(p.ch, 0, 0); }
        g.fillStyle = fill; g.fillText(p.ch, 0, 0); g.restore();
      });
      void s; void c;
      return cv;
    }
    function numRow(c, n, tau, k, label, A) {
      var keyed = KF.has(c.kf, "ta" + n + "_" + k), v = Math.round(A[k] * 100) / 100;
      return '<label style="white-space:nowrap">' + esc(label) + ' <input type="number" data-ta="' + n + ":" + k + '" value="' + v + '" step="any" style="width:52px"></label><button class="ghost" data-tak="' + n + ":" + k + '" title="Key ' + esc(label) + ' at the playhead" style="padding:0 3px">' + (keyed ? "◆" : "◇") + "</button>";
    }
    function addAnimator(c, preset, sel) {
      var P = PRESETS(C.clipLen ? C.clipLen(c, sel ? sel.Ly.kind : "img") : 3), pr = P[preset], n = (c.text.anim = c.text.anim || []).length;
      c.text.anim.push(Object.assign({}, DEFAULTS, pr ? pr.a : {}));
      if (pr) pr.keys.forEach(function (kk) { kk[1].forEach(function (p) { var o = {}; o["ta" + n + "_" + kk[0]] = p[1]; c.kf = KF.set(c.kf, p[0], o, FPS); }); });
      if (window.TlGraph && TlGraph.addProp) NUMS.forEach(function (k) { if (KF.has(c.kf, "ta" + n + "_" + k)) TlGraph.addProp("ta" + n + "_" + k, "Text " + (n + 1) + " " + k, 1, ""); });
      return n;
    }
    C.onProps(function (Pn, c, sel) {
      if (!c || !c.text || !Pn || c.text.fx) return;
      var tau = C.tauOf(c, sel.Ly.kind), anims = c.text.anim || [], d = document.createElement("div"); d.className = "tlp-tanim";
      var h = '<div class="tlp-t">✨ Text Animators</div><div class="tlp-row"><select id="tlpTaPreset"><option value="">Custom</option>'
        + Object.keys(PRESETS(2)).map(function (k) { return '<option value="' + k + '">' + esc(PRESETS(2)[k].name) + "</option>"; }).join("") + '</select><button class="ghost" id="tlpTaAdd" title="A new animator (a preset comes with its keys)">＋ Animator</button></div>';
      // 2.496.0: 〰 text on a path
      var OPn = c.text.onpath ? pathAt(c, tau) : null, onP = !!(OPn && OPn.on !== false);
      var tpNum = function (k, label, keyable) { var kd = KF.has(c.kf, "tp_" + k); return '<label style="white-space:nowrap">' + esc(label) + ' <input type="number" data-tp="' + k + '" value="' + (Math.round((+OPn[k] || 0) * 100) / 100) + '" step="any" style="width:56px"></label>' + (keyable ? '<button class="ghost" data-tpk="' + k + '" title="Key it at the playhead" style="padding:0 3px">' + (kd ? "◆" : "◇") + "</button>" : ""); };
      h += '<div class="tlp-row" style="flex-wrap:wrap"><label title="The letters run along a path (an arc, a circle, a wave or a shape layer)"><input type="checkbox" id="tlpTpOn"' + (onP ? " checked" : "") + "> 〰 On a path</label>";
      if (onP) {
        h += '<select id="tlpTpPath">' + PATHS.map(function (q) { return '<option value="' + q[0] + '"' + (OPn.path === q[0] ? " selected" : "") + ">" + q[1] + "</option>"; }).join("") + "</select>";
        if (OPn.path === "arc" || OPn.path === "circle") h += tpNum("r", "radius", true);
        if (OPn.path === "arc") h += tpNum("span", "span °", false);
        if (OPn.path === "wave") h += tpNum("amp", "height", false) + tpNum("wl", "wavelength", false);
        if (OPn.path === "shape") { var shs = window.TlParent ? TlParent.all().filter(function (x) { return x.c.shape && x.c !== c; }) : []; h += '<select id="tlpTpShape"><option value="">(pick a shape layer)</option>' + shs.map(function (x) { return '<option value="' + esc(x.c.uid) + '"' + (OPn.uid === x.c.uid ? " selected" : "") + ">" + esc(x.L.name || x.lk) + "</option>"; }).join("") + "</select>"; }
        h += tpNum("off", "start %", true) + '<label title="Run the other way (inside a circle)"><input type="checkbox" id="tlpTpFlip"' + (OPn.flip ? " checked" : "") + "> other way</label>";
      }
      h += "</div>";
      anims.forEach(function (raw, n) {
        var A = animAt(c, n, tau);
        h += '<div class="tlp-tanim1" style="border-top:1px solid var(--line,#333);padding-top:3px"><div class="tlp-row"><label><input type="checkbox" data-tab="' + n + ':on"' + (raw.on !== false ? " checked" : "") + "> Animator " + (n + 1) + "</label>"
          + '<select data-tas="' + n + ':based">' + [["chars", "letters"], ["words", "words"], ["lines", "lines"]].map(function (b) { return '<option value="' + b[0] + '"' + (A.based === b[0] ? " selected" : "") + ">" + b[1] + "</option>"; }).join("") + "</select>"
          + '<select data-tas="' + n + ':shape">' + SHAPES.map(function (sp) { return '<option' + (A.shape === sp ? " selected" : "") + ">" + sp + "</option>"; }).join("") + "</select>"
          + '<button class="ghost" data-tadel="' + n + '" title="Take this animator out">✕</button></div>'
          + '<div class="tlp-row" style="flex-wrap:wrap">' + [["start", "start %"], ["end", "end %"], ["offset", "offset %"], ["amount", "amount %"]].map(function (f) { return numRow(c, n, tau, f[0], f[1], A); }).join("") + "</div>"
          + '<div class="tlp-row" style="flex-wrap:wrap">' + [["x", "x"], ["y", "y"], ["scale", "scale %"], ["rot", "rot °"], ["op", "opacity %"], ["track", "tracking"], ["blur", "blur"]].map(function (f) { return numRow(c, n, tau, f[0], f[1], A); }).join("")
          + '<label><input type="checkbox" data-tab="' + n + ':colorOn"' + (A.colorOn ? " checked" : "") + '> colour</label><input type="color" data-tac="' + n + '" value="' + esc(A.color) + '"></div></div>';
      });
      d.innerHTML = h; Pn.appendChild(d);
      var save = function (repaint) { delete c.bakeSig; if (typeof tlSave === "function") tlSave(); C.mark(); if (repaint) C.paintProps(); };
      d.querySelector("#tlpTaAdd").addEventListener("click", function () { var pr = d.querySelector("#tlpTaPreset").value, n = addAnimator(c, pr, sel); C.keysChanged(c); if (typeof renderTimeline === "function") renderTimeline(); save(true); say("✨ animator " + (n + 1) + (pr ? " (" + PRESETS(2)[pr].name + ")" : "") + " on the text"); });
      d.querySelectorAll("[data-ta]").forEach(function (el) {
        var nk = el.dataset.ta.split(":"), n = +nk[0], k = nk[1], p = "ta" + n + "_" + k;
        el.addEventListener("input", function () { var v = +el.value; if (!Number.isFinite(v)) return; if (KF.has(c.kf, p)) { var o = {}; o[p] = v; c.kf = KF.set(c.kf, C.tauOf(c, sel.Ly.kind), o, FPS); } else c.text.anim[n][k] = v; save(false); });
        el.addEventListener("change", function () { save(false); if (typeof renderTimeline === "function") renderTimeline(); });
      });
      d.querySelectorAll("[data-tak]").forEach(function (el) {
        el.addEventListener("click", function () { var nk = el.dataset.tak.split(":"), n = +nk[0], k = nk[1], o = {}, tn = C.tauOf(c, sel.Ly.kind); o["ta" + n + "_" + k] = animAt(c, n, tn)[k]; c.kf = KF.set(c.kf, tn, o, FPS);
          if (window.TlGraph && TlGraph.addProp) TlGraph.addProp("ta" + n + "_" + k, "Text " + (n + 1) + " " + k, 1, "");
          C.keysChanged(c); if (typeof renderTimeline === "function") renderTimeline(); save(true); });
      });
      d.querySelectorAll("[data-tas]").forEach(function (el) { el.addEventListener("change", function () { var nk = el.dataset.tas.split(":"); c.text.anim[+nk[0]][nk[1]] = el.value; save(false); }); });
      d.querySelectorAll("[data-tab]").forEach(function (el) { el.addEventListener("change", function () { var nk = el.dataset.tab.split(":"); c.text.anim[+nk[0]][nk[1]] = el.checked; save(false); }); });
      d.querySelectorAll("[data-tac]").forEach(function (el) { el.addEventListener("input", function () { c.text.anim[+el.dataset.tac].color = el.value; save(false); }); });
      d.querySelectorAll("[data-tadel]").forEach(function (el) {
        el.addEventListener("click", function () {
          var n = +el.dataset.tadel; c.text.anim.splice(n, 1);
          // its keys go; the later animators' keys move down one
          (c.kf || []).forEach(function (k) { Object.keys(k).forEach(function (p) { var m = /^ta(\d+)_(\w+)$/.exec(p); if (!m) return; var i = +m[1]; if (i === n) delete k[p]; else if (i > n) { k["ta" + (i - 1) + "_" + m[2]] = k[p]; delete k[p]; } }); });
          c.kf = (c.kf || []).filter(function (k) { return Object.keys(k).some(function (p) { return p !== "at" && p !== "ease" && p !== "bz"; }); });
          if (!c.text.anim.length) delete c.text.anim;
          C.keysChanged(c); save(true);
        });
      });
      if (window.TlGraph && TlGraph.addProp) anims.forEach(function (_, n) { NUMS.forEach(function (k) { if (KF.has(c.kf, "ta" + n + "_" + k)) TlGraph.addProp("ta" + n + "_" + k, "Text " + (n + 1) + " " + k, 1, ""); }); });
      // 2.496.0: 〰 on a path
      var tpOn = d.querySelector("#tlpTpOn");
      if (tpOn) tpOn.addEventListener("change", function () { if (tpOn.checked) c.text.onpath = Object.assign({}, PATH_DEFAULTS, c.text.onpath || {}, { on: true }); else if (c.text.onpath) c.text.onpath.on = false; save(true); say(tpOn.checked ? "〰 the text runs along the path - its kind, size and start % are here (◇ keys the start: slide it along)" : "〰 off the path"); });
      var tpP = d.querySelector("#tlpTpPath"); if (tpP) tpP.addEventListener("change", function () { c.text.onpath.path = tpP.value; if (!KF.has(c.kf, "tp_off")) c.text.onpath.off = tpP.value === "arc" || tpP.value === "wave" ? 50 : 0; save(true); });   // 2.498.0: centred on an arc / a wave, from the top of a circle
      var tpS = d.querySelector("#tlpTpShape"); if (tpS) tpS.addEventListener("change", function () { c.text.onpath.uid = tpS.value; save(false); });
      var tpF = d.querySelector("#tlpTpFlip"); if (tpF) tpF.addEventListener("change", function () { c.text.onpath.flip = tpF.checked; save(false); });
      d.querySelectorAll("[data-tp]").forEach(function (el) { el.addEventListener("input", function () { var k = el.dataset.tp, v = +el.value; if (!Number.isFinite(v)) return; if (KF.has(c.kf, "tp_" + k)) { var o = {}; o["tp_" + k] = v; c.kf = KF.set(c.kf, C.tauOf(c, sel.Ly.kind), o, FPS); } else c.text.onpath[k] = v; save(false); }); });
      d.querySelectorAll("[data-tpk]").forEach(function (el) { el.addEventListener("click", function () { var k = el.dataset.tpk, tn = C.tauOf(c, sel.Ly.kind), o = {}; o["tp_" + k] = pathAt(c, tn)[k]; c.kf = KF.set(c.kf, tn, o, FPS);
        if (window.TlGraph && TlGraph.addProp) TlGraph.addProp("tp_" + k, "Text path " + (k === "off" ? "start %" : "radius"), 1, "");
        C.keysChanged(c); if (typeof renderTimeline === "function") renderTimeline(); save(true); }); });
      if (window.TlGraph && TlGraph.addProp) ["off", "r"].forEach(function (k) { if (KF.has(c.kf, "tp_" + k)) TlGraph.addProp("tp_" + k, "Text path " + (k === "off" ? "start %" : "radius"), 1, ""); });
    });
    window.TlTextAnim = { live: live, onPath: onPath, pathAt: pathAt, picture: picture, animAt: animAt, addAnimator: addAnimator, PRESETS: PRESETS, DEFAULTS: DEFAULTS };
  }
})(typeof window !== "undefined" ? window : globalThis);
