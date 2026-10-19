/* bitGen Studio — ext/timelinedock/tlwarp.js (2.507.0): 📌 PUPPET PINS and ⌗ MESH WARP on a layer. window.TlWarp.
 *
 * Tim (verbatim): "lets do steps 1,2,3 , 4,5,6 and 7" - step 1: "particles, light rays, mesh / Bézier warp, puppet-pin
 * animation" (AFTER-EFFECTS-GAP.md, Generators / distortions).
 *
 *   📌 Puppet tool (Shift+W)  with a layer picked: click on it = a pin; drag a pin = the layer bends to follow it, the
 *                             other pins hold their ground; Alt+click a pin = gone. Once the warp has keys (◇ in the
 *                             Properties), every drag is a key at the playhead - pins glide from key to key.
 *   ⌗ Mesh warp (Properties)  a grid of control points (columns x rows) over the layer; drag them with the 📌 tool. The
 *                             picture follows smooth curves through the points (Catmull-Rom), not straight lines.
 *   📌 Warp (Properties)      on / off, falloff (how far a pin's pull reaches: low = wide and soft, high = local),
 *                             detail (the triangle mesh it is drawn with), ◇ key every pin / point here, clear.
 * Pins and points are kept as fractions of the layer's own picture (0..1), so a warp rides with the layer when it is
 * moved, scaled or turned. Offsets are keyed as wp<id>x / wp<id>y (pins) and wm<n>x / wm<n>y (mesh points).
 * How it bends: each vertex of a fine grid over the picture is moved by MOVING LEAST SQUARES (rigid) between the pins'
 * rest places and where they are now - near a pin the picture turns and shifts with it, without stretching - plus the
 * mesh's smooth offset there. The picture is drawn triangle by triangle onto a canvas big enough for where it went
 * (`_ow`, canvas.js draws it that much bigger). The compile: picture layers baked by the page, video layers baked
 * whole (tlvbake.js).
 * Pure (Node: scripts/test-warp.js): DEFAULTS, clean, live, stateAt(c, tau, KF), mls(P, Q, x, y, alpha),
 *   meshOff(o, mesh, u, v), deform(o, st, W, H, n), overscan(def, W, H), affine(s, d), mapPoint(def, u, v).
 */
(function (root) {
  "use strict";
  var DEFAULTS = { on: true, cols: 3, rows: 3, mesh: null, pins: [], detail: 24, falloff: 1.5 };
  var nm = function (v, d, lo, hi) { var x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
  var r5 = function (v) { return Math.round(v * 100000) / 100000; };
  function clean(w) {
    if (!w || typeof w !== "object") return null;
    var cols = Math.round(nm(w.cols, 3, 1, 8)), rows = Math.round(nm(w.rows, 3, 1, 8)), n = (cols + 1) * (rows + 1);
    var mesh = Array.isArray(w.mesh) && w.mesh.length === n ? w.mesh.map(function (p) { return [nm(p && p[0], 0, -3, 3), nm(p && p[1], 0, -3, 3)]; }) : null;
    var seen = {}, pins = [];
    (Array.isArray(w.pins) ? w.pins : []).forEach(function (p) {
      if (!p || pins.length >= 64) return;
      var id = Math.round(nm(p.id, 0, 0, 1e6)); while (seen[id]) id++; seen[id] = 1;
      pins.push({ id: id, x: nm(p.x, 0.5, -1, 2), y: nm(p.y, 0.5, -1, 2), dx: nm(p.dx, 0, -3, 3), dy: nm(p.dy, 0, -3, 3) });
    });
    return { on: w.on !== false, cols: cols, rows: rows, mesh: mesh, pins: pins, detail: Math.round(nm(w.detail, 24, 4, 48)), falloff: nm(w.falloff, 1.5, 0.5, 4) };
  }
  var live = function (c) { var o = clean(c && c.warp); return !!(o && o.on && (o.pins.length || o.mesh)); };
  var nextId = function (o) { return o.pins.reduce(function (m, p) { return Math.max(m, p.id + 1); }, 1); };
  /** the pins / mesh offsets at tau (s into the clip) - their keys (wp<id>x ..., wm<n>x ...) or their own values */
  function stateAt(c, tau, KF) {
    var o = clean(c && c.warp); if (!o) return null;
    var kv = function (name, fb) { return KF && c.kf && KF.has(c.kf, name) ? KF.value(c.kf, tau, name, fb) : fb; };
    return { pins: o.pins.map(function (p) { return { id: p.id, x: p.x, y: p.y, dx: kv("wp" + p.id + "x", p.dx), dy: kv("wp" + p.id + "y", p.dy) }; }),
      mesh: o.mesh ? o.mesh.map(function (q, j) { return [kv("wm" + j + "x", q[0]), kv("wm" + j + "y", q[1])]; }) : null };
  }
  /** rigid moving least squares: where (x, y) goes when the points P move to Q (weights 1 / d^(2 alpha)) */
  function mls(P, Q, x, y, alpha) {
    var n = P.length; if (!n) return [x, y];
    if (n === 1) return [x + Q[0][0] - P[0][0], y + Q[0][1] - P[0][1]];
    var sw = 0, px = 0, py = 0, qx = 0, qy = 0, W = [], i;
    for (i = 0; i < n; i++) {
      var d2 = (P[i][0] - x) * (P[i][0] - x) + (P[i][1] - y) * (P[i][1] - y);
      if (d2 < 1e-10) return [Q[i][0], Q[i][1]];
      var w = 1 / Math.pow(d2, alpha); W.push(w); sw += w; px += w * P[i][0]; py += w * P[i][1]; qx += w * Q[i][0]; qy += w * Q[i][1];
    }
    px /= sw; py /= sw; qx /= sw; qy /= sw;
    var mr = 0, mi = 0;                                  // sum w conj(p^) q^ (complex): the best turn
    for (i = 0; i < n; i++) { var ax = P[i][0] - px, ay = P[i][1] - py, bx = Q[i][0] - qx, by = Q[i][1] - qy; mr += W[i] * (ax * bx + ay * by); mi += W[i] * (ax * by - ay * bx); }
    var m = Math.hypot(mr, mi), vx = x - px, vy = y - py;
    if (m < 1e-12) return [vx + qx, vy + qy];
    mr /= m; mi /= m;
    return [vx * mr - vy * mi + qx, vx * mi + vy * mr + qy];
  }
  var cr = function (a, b, c, d, t) { return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t); };
  /** the mesh's smooth offset (fractions) at (u, v) of the picture: Catmull-Rom through the grid's points */
  function meshOff(o, mesh, u, v) {
    if (!mesh) return [0, 0];
    var C = o.cols, R = o.rows, gu = Math.max(0, Math.min(C, u * C)), gv = Math.max(0, Math.min(R, v * R));
    var i = Math.min(C - 1, Math.floor(gu)), j = Math.min(R - 1, Math.floor(gv)), fu = gu - i, fv = gv - j;
    var at = function (a, b, k) { a = Math.max(0, Math.min(C, a)); b = Math.max(0, Math.min(R, b)); return mesh[b * (C + 1) + a][k]; };
    var out = [0, 0];
    for (var k = 0; k < 2; k++) {
      var rowv = [];
      for (var b = j - 1; b <= j + 2; b++) rowv.push(cr(at(i - 1, b, k), at(i, b, k), at(i + 1, b, k), at(i + 2, b, k), fu));
      out[k] = cr(rowv[0], rowv[1], rowv[2], rowv[3], fv);
    }
    return out;
  }
  /** a (n + 1) x (n + 1) grid over a W x H picture, each vertex where the warp sends it (px) */
  function deform(o, st, W, H, n) {
    var P = [], Q = [], pts = new Float64Array((n + 1) * (n + 1) * 2), maxd = 0;
    (st.pins || []).forEach(function (p) { P.push([p.x * W, p.y * H]); Q.push([(p.x + p.dx) * W, (p.y + p.dy) * H]); });
    var still = Q.every(function (q, i) { return Math.abs(q[0] - P[i][0]) < 1e-9 && Math.abs(q[1] - P[i][1]) < 1e-9; });
    for (var j = 0; j <= n; j++) for (var i = 0; i <= n; i++) {
      var u = i / n, v = j / n, x = u * W, y = v * H, m = still ? [x, y] : mls(P, Q, x, y, o.falloff), off = meshOff(o, st.mesh, u, v);
      var X = m[0] + off[0] * W, Y = m[1] + off[1] * H, k = (j * (n + 1) + i) * 2;
      pts[k] = X; pts[k + 1] = Y; maxd = Math.max(maxd, Math.abs(X - x), Math.abs(Y - y));
    }
    return { n: n, W: W, H: H, pts: pts, maxd: maxd };
  }
  /** how many times the picture's size the warped picture needs (centred), 1 .. 3 */
  function overscan(def) {
    var f = 1, W = def.W, H = def.H;
    for (var k = 0; k < def.pts.length; k += 2) f = Math.max(f, 2 * Math.abs(def.pts[k] - W / 2) / W, 2 * Math.abs(def.pts[k + 1] - H / 2) / H);
    return f > 1 ? Math.min(3, f * 1.01 + 2 / Math.min(W, H)) : 1;
  }
  /** the affine [a, b, c, d, e, f] (canvas setTransform order) taking triangle s onto triangle d */
  function affine(s, d) {
    var den = (s[2] - s[0]) * (s[5] - s[1]) - (s[4] - s[0]) * (s[3] - s[1]); if (Math.abs(den) < 1e-12) return null;
    var a = ((d[2] - d[0]) * (s[5] - s[1]) - (d[4] - d[0]) * (s[3] - s[1])) / den, c = ((d[4] - d[0]) * (s[2] - s[0]) - (d[2] - d[0]) * (s[4] - s[0])) / den;
    var b = ((d[3] - d[1]) * (s[5] - s[1]) - (d[5] - d[1]) * (s[3] - s[1])) / den, dd = ((d[5] - d[1]) * (s[2] - s[0]) - (d[3] - d[1]) * (s[4] - s[0])) / den;
    return [a, b, c, dd, d[0] - a * s[0] - c * s[1], d[1] - b * s[0] - dd * s[1]];
  }
  /** where a picture point (u, v fractions) lands (px), the way the triangles draw it */
  function mapPoint(def, u, v) {
    var n = def.n, gu = Math.max(0, Math.min(n, u * n)), gv = Math.max(0, Math.min(n, v * n)), i = Math.min(n - 1, Math.floor(gu)), j = Math.min(n - 1, Math.floor(gv)), fu = gu - i, fv = gv - j;
    var P = function (a, b) { var k = (b * (n + 1) + a) * 2; return [def.pts[k], def.pts[k + 1]]; };
    var A = P(i, j), B = P(i + 1, j), C = P(i, j + 1), D = P(i + 1, j + 1), T;
    if (fu + fv <= 1) T = [A, B, C, fu, fv]; else T = [D, C, B, 1 - fu, 1 - fv];
    return [T[0][0] + (T[1][0] - T[0][0]) * T[3] + (T[2][0] - T[0][0]) * T[4], T[0][1] + (T[1][1] - T[0][1]) * T[3] + (T[2][1] - T[0][1]) * T[4]];
  }
  var pure = { DEFAULTS: DEFAULTS, clean: clean, live: live, nextId: nextId, stateAt: stateAt, mls: mls, meshOff: meshOff, deform: deform, overscan: overscan, affine: affine, mapPoint: mapPoint, r5: r5 };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ---------------- the page ---------------- */
  root.TlWarp = Object.assign({ ready: false }, pure);
  function ready() { try { return !!(window.TlCanvas && TlCanvas.addTool && TlCanvas.onProps && TlCanvas.onDraw && window.H3Keyframes && typeof tl === "object" && tl); } catch (e) { return false; } }
  function boot() { if (ready()) install(); else setTimeout(boot, 300); }
  boot();
  function install() {
    if (root.TlWarp.ready) return;
    var C = window.TlCanvas, KF = window.H3Keyframes, FPS = KF.FPS || 24;
    function say(t) { try { C.say(t); } catch (e) { /* fine */ } }
    var outs = new WeakMap();
    function tri(g, img, IW, IH, s, d) {
      var M = affine(s, d); if (!M) return;
      var cx = (d[0] + d[2] + d[4]) / 3, cy = (d[1] + d[3] + d[5]) / 3, gr = function (k) { var dx = d[k] - cx, dy = d[k + 1] - cy, L = Math.hypot(dx, dy) || 1; return [d[k] + dx / L * 0.7, d[k + 1] + dy / L * 0.7]; };
      var a = gr(0), b = gr(2), c = gr(4);
      g.save(); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.closePath(); g.clip();
      g.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]);
      var x0 = Math.max(0, Math.floor(Math.min(s[0], s[2], s[4])) - 2), y0 = Math.max(0, Math.floor(Math.min(s[1], s[3], s[5])) - 2);
      var x1 = Math.min(IW, Math.ceil(Math.max(s[0], s[2], s[4])) + 2), y1 = Math.min(IH, Math.ceil(Math.max(s[1], s[3], s[5])) + 2);
      if (x1 > x0 && y1 > y0) { try { g.drawImage(img, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0); } catch (e) { /* not ready */ } }
      g.restore();
    }
    /** the layer's picture, warped (bigger by its overscan: _ow) */
    function apply(pic, c, tau, draft) {
      var o = clean(c.warp); if (!o || !o.on) return pic;
      var W = pic.naturalWidth || pic.videoWidth || pic.width, H = pic.naturalHeight || pic.videoHeight || pic.height;
      if (!W || !H) return pic;
      var st = stateAt(c, tau, KF), def = deform(o, st, W, H, draft ? Math.min(10, o.detail) : o.detail);
      if (def.maxd < 0.01) return pic;
      var ow = overscan(def), OW = Math.round(W * ow), OH = Math.round(H * ow);
      var out = outs.get(c); if (!out) { out = document.createElement("canvas"); outs.set(c, out); }
      if (out.width !== OW) out.width = OW; if (out.height !== OH) out.height = OH;
      var g = out.getContext("2d"); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; g.clearRect(0, 0, OW, OH);
      var ox = (OW - W) / 2, oy = (OH - H) / 2, n = def.n, sx = W / n, sy = H / n, P = def.pts;
      var q = function (i, j) { var k = (j * (n + 1) + i) * 2; return [P[k] + ox, P[k + 1] + oy]; };
      for (var j = 0; j < n; j++) for (var i = 0; i < n; i++) {
        var A = q(i, j), B = q(i + 1, j), Cc = q(i, j + 1), D = q(i + 1, j + 1);
        tri(g, pic, W, H, [i * sx, j * sy, (i + 1) * sx, j * sy, i * sx, (j + 1) * sy], [A[0], A[1], B[0], B[1], Cc[0], Cc[1]]);
        tri(g, pic, W, H, [(i + 1) * sx, (j + 1) * sy, i * sx, (j + 1) * sy, (i + 1) * sx, j * sy], [D[0], D[1], Cc[0], Cc[1], B[0], B[1]]);
      }
      out._ow = (pic._ow || 1) * OW / W;
      return out;
    }

    /* ---- 📌 the Puppet tool */
    var sel = function () { var s = C.selClip(); return s && s.c && s.Ly && s.Ly.kind !== "v1" && s.Ly.kind !== "aud" && !s.c.adjust && !s.c.nul ? s : null; };
    var tauNow = function (c) { return (C.state.t || 0) - (c.start || 0); };
    var zoom = function () { return (C.state.view && C.state.view.z) || 1; };
    var boxOf = function (s) { return C.box(s.c, s.Ly.kind, C.state.t); };
    function toLocal(b, x, y) { var a = -(b.rot || 0) * Math.PI / 180, dx = x - b.cx, dy = y - b.cy; return [(dx * Math.cos(a) - dy * Math.sin(a)) / b.w + 0.5, (dx * Math.sin(a) + dy * Math.cos(a)) / b.h + 0.5]; }
    function toPic(b, u, v) { var a = (b.rot || 0) * Math.PI / 180, dx = (u - 0.5) * b.w, dy = (v - 0.5) * b.h; return [b.cx + dx * Math.cos(a) - dy * Math.sin(a), b.cy + dx * Math.sin(a) + dy * Math.cos(a)]; }
    var keyed = function (c) { return (c.kf || []).some(function (k) { return Object.keys(k).some(function (p) { return /^w[pm]\d+[xy]$/.test(p); }); }); };
    function changed(c, repaint) { delete c.bakeSig; delete c.vbakeSig; if (typeof tlSave === "function") tlSave(); C.mark(); if (repaint) C.paintProps(); }
    function setOff(c, what, id, dx, dy) {        // a pin's / point's offset: a key at the playhead once the warp has keys
      var o = c.warp, nx = what === "pin" ? "wp" + id : "wm" + id;
      if (keyed(c)) { var kv = {}; kv[nx + "x"] = r5(dx); kv[nx + "y"] = r5(dy); c.kf = KF.set(c.kf, tauNow(c), kv, FPS); return; }
      if (what === "pin") { var p = o.pins.filter(function (q) { return q.id === id; })[0]; if (p) { p.dx = r5(dx); p.dy = r5(dy); } }
      else if (o.mesh) o.mesh[id] = [r5(dx), r5(dy)];
    }
    function dropKeys(c, re) {
      if (!Array.isArray(c.kf)) return;
      c.kf = c.kf.map(function (k) { var o = {}; Object.keys(k).forEach(function (p) { if (!re.test(p)) o[p] = k[p]; }); return o; })
        .filter(function (k) { return Object.keys(k).some(function (p) { return !/^(at|ease|bz|to|ti)$/.test(p); }); });
      if (!c.kf.length) delete c.kf;
    }
    function handles(s) {                           // [{what, id, u, v, du, dv}] in the layer's 0..1, where they are now
      var o = clean(s.c.warp), st = stateAt(s.c, tauNow(s.c), KF), out = []; if (!o || !st) return out;
      if (o.mesh) for (var j = 0; j <= o.rows; j++) for (var i = 0; i <= o.cols; i++) { var k = j * (o.cols + 1) + i, m = st.mesh[k]; out.push({ what: "mesh", id: k, u: i / o.cols + m[0], v: j / o.rows + m[1], du: m[0], dv: m[1] }); }
      st.pins.forEach(function (p) { out.push({ what: "pin", id: p.id, u: p.x + p.dx, v: p.y + p.dy, du: p.dx, dv: p.dy }); });
      return out;
    }
    function hit(s, x, y) {
      var b = boxOf(s); if (!b) return null; var R = 9 / zoom(), best = null;
      handles(s).forEach(function (h) { var p = toPic(b, h.u, h.v), d = Math.hypot(p[0] - x, p[1] - y); if (d <= R && (!best || d < best.d - (h.what === "pin" ? 0.5 : 0))) best = Object.assign({ d: d }, h); });
      return best;
    }
    var DR = null;
    C.addTool({ id: "puppet", icon: "📌", title: "Puppet pins - on the picked layer: click = a pin, drag a pin = bend the layer, Alt+click a pin = remove it; with ⌗ Mesh warp on, drag its points too", key: "shift+w", cursor: "crosshair",
      down: function (p, ev) {
        var s = sel(); if (!s) { say("📌 Puppet: pick a layer first (Move tool), then click on it for pins"); return; }
        var b = boxOf(s); if (!b) return;
        var u = toLocal(b, p.x, p.y), h = hit(s, p.x, p.y);
        if (h && h.what === "pin" && ev && ev.altKey) {
          s.c.warp.pins = s.c.warp.pins.filter(function (q) { return q.id !== h.id; }); dropKeys(s.c, new RegExp("^wp" + h.id + "[xy]$"));
          say("📌 pin removed"); changed(s.c, true); return;
        }
        if (h) { DR = { c: s.c, what: h.what, id: h.id, d0: [h.du, h.dv], u0: u }; return; }
        if (u[0] < 0 || u[0] > 1 || u[1] < 0 || u[1] > 1) { say("📌 click ON the picked layer to pin it"); return; }
        var o = clean(s.c.warp) || clean(DEFAULTS), st = stateAt({ warp: o, kf: s.c.kf }, tauNow(s.c), KF);
        // a new pin goes where the picture under the pointer came from (so it sits on the bent picture): undo the bend there
        var rest = u, W = 1000, H = 1000 * b.h / Math.max(1e-6, b.w);
        if (st.pins.length || st.mesh) {
          var P = st.pins.map(function (q) { return [(q.x + q.dx) * W, (q.y + q.dy) * H]; }), Q = st.pins.map(function (q) { return [q.x * W, q.y * H]; });
          var r = mls(P, Q, u[0] * W, u[1] * H, o.falloff), off = meshOff(o, st.mesh, u[0], u[1]);
          rest = [r[0] / W - off[0], r[1] / H - off[1]];
        }
        o.pins.push({ id: nextId(o), x: r5(rest[0]), y: r5(rest[1]), dx: r5(u[0] - rest[0]), dy: r5(u[1] - rest[1]) });
        s.c.warp = o;
        var np = o.pins[o.pins.length - 1];
        if (keyed(s.c)) setOff(s.c, "pin", np.id, np.dx, np.dy);
        DR = { c: s.c, what: "pin", id: np.id, d0: [np.dx, np.dy], u0: u };
        say("📌 pin " + o.pins.length + " - drag it to bend the layer; pins hold the picture where they are");
        changed(s.c, true);
      },
      move: function (p) {
        if (!DR) return; var s = sel(); if (!s || s.c !== DR.c) return; var b = boxOf(s); if (!b) return;
        var u = toLocal(b, p.x, p.y);
        setOff(DR.c, DR.what, DR.id, DR.d0[0] + u[0] - DR.u0[0], DR.d0[1] + u[1] - DR.u0[1]);
        delete DR.c.bakeSig; delete DR.c.vbakeSig; C.mark();
      },
      up: function () { var d = DR; DR = null; if (d) changed(d.c, false); } });
    C.onDraw(function (ctx, o) {
      if (C.state.tool !== "puppet") return;
      var s = sel(); if (!s || !s.c.warp) return; var b = boxOf(s); if (!b) return;
      var w = clean(s.c.warp), H = handles(s), scr = function (u, v) { var q = toPic(b, u, v); return o.toScreen(q[0], q[1]); };
      ctx.save();
      if (w.mesh) {
        ctx.strokeStyle = "rgba(120,200,255,.8)"; ctx.lineWidth = 1;
        var M = H.filter(function (h) { return h.what === "mesh"; }), node = function (i, j) { return M[j * (w.cols + 1) + i]; };
        for (var j = 0; j <= w.rows; j++) { ctx.beginPath(); for (var i = 0; i <= w.cols; i++) { var a = scr(node(i, j).u, node(i, j).v); if (i) ctx.lineTo(a.x, a.y); else ctx.moveTo(a.x, a.y); } ctx.stroke(); }
        for (var i2 = 0; i2 <= w.cols; i2++) { ctx.beginPath(); for (var j2 = 0; j2 <= w.rows; j2++) { var a2 = scr(node(i2, j2).u, node(i2, j2).v); if (j2) ctx.lineTo(a2.x, a2.y); else ctx.moveTo(a2.x, a2.y); } ctx.stroke(); }
        M.forEach(function (h) { var a = scr(h.u, h.v); ctx.fillStyle = "#7cf"; ctx.fillRect(a.x - 3, a.y - 3, 6, 6); });
      }
      H.filter(function (h) { return h.what === "pin"; }).forEach(function (h, k) {
        var a = scr(h.u, h.v); ctx.fillStyle = "#ffd400"; ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(a.x, a.y, 5, 0, 7); ctx.fill(); ctx.stroke();
        ctx.font = "10px sans-serif"; ctx.fillText(String(k + 1), a.x + 7, a.y - 6);
      });
      ctx.restore();
    });

    /* ---- 📌 Warp in the Properties */
    C.onProps(function (Pn, c, s) {
      if (!c || !Pn || !s || !s.Ly || s.Ly.kind === "v1" || s.Ly.kind === "aud" || c.adjust || c.nul) return;
      var o = clean(c.warp), d = document.createElement("div"); d.className = "tlp-warp";
      var h = '<div class="tlp-t">📌 Warp</div>';
      if (!o) h += '<div class="tlp-row"><span class="tlp-none">none - pin it with 📌 Puppet (Shift+W), or</span><label><input type="checkbox" id="tlpWpMesh"> ⌗ Mesh warp</label><button class="ghost" id="tlpWpTool">📌 Puppet</button></div>';
      else {
        h += '<div class="tlp-row" style="flex-wrap:wrap"><label><input type="checkbox" id="tlpWpOn"' + (o.on ? " checked" : "") + "> on</label><span>" + o.pins.length + " pin" + (o.pins.length === 1 ? "" : "s") + "</span>"
          + '<label title="How far a pin\'s pull reaches: low = wide and soft, high = close to the pin">falloff <input type="number" data-wp="falloff" value="' + o.falloff + '" step="0.1" min="0.5" max="4" style="width:48px"></label>'
          + '<label title="The triangle mesh it is drawn with">detail <input type="number" data-wp="detail" value="' + o.detail + '" step="1" min="4" max="48" style="width:44px"></label>'
          + '<button class="ghost" id="tlpWpKey" title="Key every pin and mesh point at the playhead - from then on each drag is a key">' + (keyed(c) ? "◆" : "◇") + " key here</button>"
          + '<button class="ghost" id="tlpWpTool">📌 Puppet</button><button class="ghost" id="tlpWpClear" title="Remove the pins, the mesh and their keys">✕</button></div>'
          + '<div class="tlp-row"><label><input type="checkbox" id="tlpWpMesh"' + (o.mesh ? " checked" : "") + "> ⌗ Mesh warp</label>"
          + (o.mesh ? '<label>columns <input type="number" data-wp="cols" value="' + o.cols + '" min="1" max="8" style="width:40px"></label><label>rows <input type="number" data-wp="rows" value="' + o.rows + '" min="1" max="8" style="width:40px"></label><button class="ghost" id="tlpWpReset" title="Put every mesh point back">reset</button>' : "") + "</div>";
      }
      d.innerHTML = h; Pn.appendChild(d);
      var q = function (id) { return d.querySelector("#" + id); };
      if (q("tlpWpTool")) q("tlpWpTool").addEventListener("click", function () { C.setTool("puppet"); say("📌 Puppet: click on the layer for pins, drag a pin to bend it"); });
      if (q("tlpWpOn")) q("tlpWpOn").addEventListener("change", function () { c.warp.on = q("tlpWpOn").checked; changed(c, false); });
      var flat = function (w) { var n = (w.cols + 1) * (w.rows + 1), m = []; for (var k = 0; k < n; k++) m.push([0, 0]); return m; };
      q("tlpWpMesh").addEventListener("change", function () {
        var w = clean(c.warp) || clean(DEFAULTS);
        if (q("tlpWpMesh").checked) w.mesh = flat(w); else { w.mesh = null; dropKeys(c, /^wm\d+[xy]$/); }
        c.warp = w; if (q("tlpWpMesh").checked) C.setTool("puppet"); changed(c, true);
      });
      if (q("tlpWpReset")) q("tlpWpReset").addEventListener("click", function () { c.warp.mesh = flat(clean(c.warp)); dropKeys(c, /^wm\d+[xy]$/); changed(c, true); });
      if (q("tlpWpClear")) q("tlpWpClear").addEventListener("click", function () { delete c.warp; dropKeys(c, /^w[pm]\d+[xy]$/); changed(c, true); });
      if (q("tlpWpKey")) q("tlpWpKey").addEventListener("click", function () {
        var st = stateAt(c, tauNow(c), KF), kv = {};
        st.pins.forEach(function (p) { kv["wp" + p.id + "x"] = r5(p.dx); kv["wp" + p.id + "y"] = r5(p.dy); });
        (st.mesh || []).forEach(function (m, j) { kv["wm" + j + "x"] = r5(m[0]); kv["wm" + j + "y"] = r5(m[1]); });
        if (Object.keys(kv).length) { c.kf = KF.set(c.kf, tauNow(c), kv, FPS); say("📌 warp keyed at the playhead - move the playhead and drag pins for the next key"); }
        changed(c, true);
      });
      d.querySelectorAll("[data-wp]").forEach(function (el) {
        el.addEventListener("keydown", function (e) { e.stopPropagation(); });
        el.addEventListener("change", function () {
          var k = el.getAttribute("data-wp"), v = +el.value; if (!Number.isFinite(v)) return;
          var w = clean(c.warp); w[k] = v;
          if ((k === "cols" || k === "rows") && w.mesh) { w = clean(w); w.mesh = flat(w); dropKeys(c, /^wm\d+[xy]$/); }
          c.warp = clean(w); changed(c, k === "cols" || k === "rows");
        });
      });
    });
    if (window.TlVBake) TlVBake.register("warp", live);         // a video layer with a warp is baked whole by the page
    Object.assign(root.TlWarp, { ready: true, apply: apply, handles: handles });
  }
})(typeof window !== "undefined" ? window : globalThis);
