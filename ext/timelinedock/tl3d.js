/* bitGen Studio — ext/timelinedock/tl3d.js (2.510.0): 🧊 2D LAYERS IN 3D - cards, a moving camera, depth of field and
 * shadows from a light. window.Tl3D.
 *
 * Tim (verbatim): "lets do steps 1,2,3 , 4,5,6 and 7" - step 4: "2D layers in 3D: cards, a moving camera, depth of
 * field, shadows from lights" (AFTER-EFFECTS-GAP.md: "the 3D layers are separate scenes today").
 *
 *   🧊 3D layer (a layer's Properties)  the layer becomes a CARD in a 3D space: its x / y (the usual move), its depth z
 *                                       (px; + = further away), its turn about x and y (its usual turn is about z);
 *                                       casts shadows, accepts shadows. Keyable (◇: d3_z, d3_rx, d3_ry).
 *   🎥 3D camera (the same Properties, shared by every 3D layer - tl.cam3)
 *                                       position x / y / z, aimed at x / y / z, zoom (px: a card at z 0 seen from
 *                                       z = -zoom is its 2D size), ◇ keys at the playhead (cx cy cz tx ty tz zoom ...).
 *                                       Depth of field: focus distance, aperture (the blur of a card one focus distance
 *                                       out of focus). A light: x / y / z, darkness %, softness px - cards that cast
 *                                       throw their shape's shadow on the cards behind them that accept.
 *   🧊 Orbit tool (Shift+O)             drag = orbit the camera around where it aims; Shift+drag = dolly (closer /
 *                                       further); Alt+drag = track (camera and aim together). Keys once the camera has keys.
 * Cards stack in their layer order (as the timeline's 2D layers do - put the far ones lower); the picture is drawn in
 * perspective (a mesh of small triangles). The compile: 3D picture layers are baked by the page, 3D video layers baked
 * whole (tlvbake.js) - a camera / light change re-bakes them (sceneSig).
 * 2.515.0: the camera's ROLL (°, about where it looks - keyed as roll): what the 📷 camera tracker (tlcamtrack.js) needs.
 * Pure (Node: scripts/test-3d.js): clean, camClean, camAt(cam, t, KF), rot(rx, ry, rz), basis(cam), project(cam, W, H,
 *   P), plane(o, b, W, H) (centre, R, w, h), grid(pl, n), onPlane(L, Q, pl), toLocal(pl, X), blurOf(cam, dist).
 */
(function (root) {
  "use strict";
  var nm = function (v, d, lo, hi) { var x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
  var D3 = { on: true, z: 0, rx: 0, ry: 0, cast: true, accept: true };
  var CAM = { x: 0, y: 0, z: -1000, tx: 0, ty: 0, tz: 0, zoom: 1000, roll: 0, dof: false, focus: 1000, ap: 12, light: false, lx: -300, ly: -400, lz: -700, dark: 60, soft: 8 };
  var CKEYS = ["x", "y", "z", "tx", "ty", "tz", "zoom", "roll", "focus", "ap", "lx", "ly", "lz"];   // 2.515.0: + roll (the 📷 camera tracker)          // keyed as c<name> for x y z, else the name
  var kname = function (k) { return k === "x" || k === "y" || k === "z" ? "c" + k : k; };
  function clean(d) {
    if (!d || typeof d !== "object") return null;
    return { on: d.on !== false, z: nm(d.z, 0, -1e5, 1e5), rx: nm(d.rx, 0, -36000, 36000), ry: nm(d.ry, 0, -36000, 36000), cast: d.cast !== false, accept: d.accept !== false };
  }
  var live = function (c) { var o = clean(c && c.d3); return !!(o && o.on); };
  function camClean(c) {
    c = c || {}; var o = {};
    ["x", "y", "z", "tx", "ty", "tz", "lx", "ly", "lz"].forEach(function (k) { o[k] = nm(c[k], CAM[k], -1e6, 1e6); });
    o.zoom = nm(c.zoom, 1000, 10, 1e5); o.roll = nm(c.roll, 0, -36000, 36000); o.focus = nm(c.focus, 1000, 1, 1e6); o.ap = nm(c.ap, 12, 0, 200);
    o.dof = !!c.dof; o.light = !!c.light; o.dark = nm(c.dark, 60, 0, 100); o.soft = nm(c.soft, 8, 0, 200);
    return o;
  }
  /** the camera at timeline time t (its keys or its values) */
  function camAt(cam, t, KF) {
    var o = camClean(cam);
    if (KF && cam && Array.isArray(cam.kf)) CKEYS.forEach(function (k) { if (KF.has(cam.kf, kname(k))) o[k] = KF.value(cam.kf, t, kname(k), o[k]); });
    return camClean(Object.assign({}, cam, o));
  }
  var d2r = Math.PI / 180;
  /** R = Rx . Ry . Rz (degrees), a 3x3 row-major */
  function rot(rx, ry, rz) {
    var a = rx * d2r, b = ry * d2r, c = rz * d2r, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
    var Rz = [cc, -sc, 0, sc, cc, 0, 0, 0, 1], Ry = [cb, 0, sb, 0, 1, 0, -sb, 0, cb], Rx = [1, 0, 0, 0, ca, -sa, 0, sa, ca];
    return mul(Rx, mul(Ry, Rz));
  }
  function mul(A, B) { var o = []; for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) o.push(A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]); return o; }
  var ap = function (R, v) { return [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]]; };
  var apT = function (R, v) { return [R[0] * v[0] + R[3] * v[1] + R[6] * v[2], R[1] * v[0] + R[4] * v[1] + R[7] * v[2], R[2] * v[0] + R[5] * v[1] + R[8] * v[2]]; };
  var sub = function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; };
  var dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };
  var cross = function (a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; };
  var norm = function (a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  /** the camera's right / down / forward (world: x right, y down, z away); 2.515.0: turned about forward by its roll (°) */
  function basis(cam) {
    var E = [cam.x, cam.y, cam.z], f = norm(sub([cam.tx, cam.ty, cam.tz], E)), down = [0, 1, 0];
    var r = cross(down, f); if (Math.hypot(r[0], r[1], r[2]) < 1e-6) r = [1, 0, 0]; r = norm(r);
    var d = cross(f, r), a = (+cam.roll || 0) * d2r;
    if (a) { var ca = Math.cos(a), sa = Math.sin(a), r2 = [ca * r[0] + sa * d[0], ca * r[1] + sa * d[1], ca * r[2] + sa * d[2]]; d = [-sa * r[0] + ca * d[0], -sa * r[1] + ca * d[1], -sa * r[2] + ca * d[2]]; r = r2; }
    return { E: E, r: r, d: d, f: f };
  }
  /** a world point -> [screen x, screen y, depth] (depth <= 1 = behind the camera) */
  function project(cam, W, H, P, B) {
    B = B || basis(cam); var v = sub(P, B.E), z = dot(v, B.f);
    return [W / 2 + cam.zoom * dot(v, B.r) / Math.max(1e-6, z), H / 2 + cam.zoom * dot(v, B.d) / Math.max(1e-6, z), z];
  }
  /** a card's plane: its box (canvas.js box: cx, cy, w, h, rot) + its 3D (z, rx, ry) */
  function plane(o, b, W, H) { return { C: [b.cx - W / 2, b.cy - H / 2, o.z], R: rot(o.rx, o.ry, b.rot || 0), w: b.w, h: b.h }; }
  /** (n + 1)^2 world points over the card (u, v 0..1) */
  function grid(pl, n) {
    var out = [];
    for (var j = 0; j <= n; j++) for (var i = 0; i <= n; i++) { var l = ap(pl.R, [(i / n - 0.5) * pl.w, (j / n - 0.5) * pl.h, 0]); out.push([pl.C[0] + l[0], pl.C[1] + l[1], pl.C[2] + l[2]]); }
    return out;
  }
  /** where the light L's ray through Q meets the plane pl (null = not beyond Q) */
  function onPlane(L, Q, pl) {
    var N = ap(pl.R, [0, 0, 1]), dQ = sub(Q, L), den = dot(dQ, N); if (Math.abs(den) < 1e-9) return null;
    var s = dot(sub(pl.C, L), N) / den; if (s <= 1 + 1e-6) return null;
    return [L[0] + dQ[0] * s, L[1] + dQ[1] * s, L[2] + dQ[2] * s];
  }
  /** a world point on the plane -> the card's 0..1 */
  function toLocal(pl, X) { var l = apT(pl.R, sub(X, pl.C)); return [l[0] / pl.w + 0.5, l[1] / pl.h + 0.5]; }
  /** the depth-of-field blur (px) of a card at that distance */
  function blurOf(cam, dist) { return cam.dof ? Math.min(60, cam.ap * Math.abs(dist - cam.focus) / Math.max(1, cam.focus)) : 0; }
  var pure = { D3: D3, CAM: CAM, CKEYS: CKEYS, kname: kname, clean: clean, live: live, camClean: camClean, camAt: camAt, rot: rot, basis: basis, project: project, plane: plane, grid: grid, onPlane: onPlane, toLocal: toLocal, blurOf: blurOf };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ---------------- the page ---------------- */
  root.Tl3D = Object.assign({ ready: false }, pure);
  function ready() { try { return !!(window.TlCanvas && TlCanvas.addTool && TlCanvas.onProps && TlCanvas.box && window.TlParent && window.H3Keyframes && typeof tl === "object" && tl); } catch (e) { return false; } }
  function boot() { if (ready()) install(); else setTimeout(boot, 300); }
  boot();
  function install() {
    if (root.Tl3D.ready) return;
    var C = window.TlCanvas, KF = window.H3Keyframes, FPS = KF.FPS || 24;
    function say(t) { try { C.say(t); } catch (e) { /* fine */ } }
    function at(c, tau) {
      var o = clean(c.d3); if (!o) return null;
      [["z", "d3_z"], ["rx", "d3_rx"], ["ry", "d3_ry"]].forEach(function (p) {
        if (c.kf && KF.has(c.kf, p[1])) o[p[0]] = KF.value(c.kf, tau, p[1], o[p[0]]);
        if (window.TlExpr && TlExpr.num && c.expr && c.expr[p[1]]) o[p[0]] = TlExpr.num(c, p[1], tau, o[p[0]]);
      });
      return o;
    }
    var cam = function (t) { return camAt(tl.cam3 || {}, t, KF); };
    function cards() {                                    // every 3D clip: {c, L, kind}
      var out = [];
      (tl.vlayers || []).forEach(function (L) { (L.clips || []).forEach(function (c) { if (live(c)) out.push({ c: c, L: L, kind: "vl" }); }); });
      (tl.images || []).forEach(function (L) { (L.clips || []).forEach(function (c) { if (live(c)) out.push({ c: c, L: L, kind: "img" }); }); });
      return out;
    }
    /** what a 3D layer's bake depends on beyond itself: the camera, the light, the other cards (null = not 3D) */
    function sceneSig(c) {
      if (!live(c)) return null;
      return JSON.stringify([tl.cam3 || null, cards().filter(function (x) { return x.c !== c; }).map(function (x) { return [x.c.d3, x.c.tf || null, x.c.kf || null, x.c.start, x.c.len, x.c.name, x.L.visible]; })]);
    }
    /* triangle mesh drawing (s: source px triangle, d: dest triangle) */
    function affine(s, d) {
      var den = (s[2] - s[0]) * (s[5] - s[1]) - (s[4] - s[0]) * (s[3] - s[1]); if (Math.abs(den) < 1e-12) return null;
      var a = ((d[2] - d[0]) * (s[5] - s[1]) - (d[4] - d[0]) * (s[3] - s[1])) / den, cc = ((d[4] - d[0]) * (s[2] - s[0]) - (d[2] - d[0]) * (s[4] - s[0])) / den;
      var b = ((d[3] - d[1]) * (s[5] - s[1]) - (d[5] - d[1]) * (s[3] - s[1])) / den, dd = ((d[5] - d[1]) * (s[2] - s[0]) - (d[3] - d[1]) * (s[4] - s[0])) / den;
      return [a, b, cc, dd, d[0] - a * s[0] - cc * s[1], d[1] - b * s[0] - dd * s[1]];
    }
    function tri(g, img, IW, IH, s, d) {
      var M = affine(s, d); if (!M) return;
      var cx = (d[0] + d[2] + d[4]) / 3, cy = (d[1] + d[3] + d[5]) / 3, gr = function (k) { var dx = d[k] - cx, dy = d[k + 1] - cy, L = Math.hypot(dx, dy) || 1; return [d[k] + dx / L * 0.7, d[k + 1] + dy / L * 0.7]; };
      var A = gr(0), B = gr(2), Cc = gr(4);
      g.save(); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.lineTo(Cc[0], Cc[1]); g.closePath(); g.clip();
      g.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]);
      var x0 = Math.max(0, Math.floor(Math.min(s[0], s[2], s[4])) - 2), y0 = Math.max(0, Math.floor(Math.min(s[1], s[3], s[5])) - 2);
      var x1 = Math.min(IW, Math.ceil(Math.max(s[0], s[2], s[4])) + 2), y1 = Math.min(IH, Math.ceil(Math.max(s[1], s[3], s[5])) + 2);
      if (x1 > x0 && y1 > y0) { try { g.drawImage(img, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0); } catch (e) { /* not ready */ } }
      g.restore();
    }
    /** img (IW x IH) drawn over the (n+1)^2 dest points Q ([x, y, depth]) */
    function mesh(g, img, IW, IH, Q, n) {
      var sx = IW / n, sy = IH / n;
      for (var j = 0; j < n; j++) for (var i = 0; i < n; i++) {
        var A = Q[j * (n + 1) + i], B = Q[j * (n + 1) + i + 1], Cc = Q[(j + 1) * (n + 1) + i], D = Q[(j + 1) * (n + 1) + i + 1];
        if (A[2] <= 1 || B[2] <= 1 || Cc[2] <= 1 || D[2] <= 1) continue;               // behind the camera
        tri(g, img, IW, IH, [i * sx, j * sy, (i + 1) * sx, j * sy, i * sx, (j + 1) * sy], [A[0], A[1], B[0], B[1], Cc[0], Cc[1]]);
        tri(g, img, IW, IH, [(i + 1) * sx, (j + 1) * sy, i * sx, (j + 1) * sy, (i + 1) * sx, j * sy], [D[0], D[1], Cc[0], Cc[1], B[0], B[1]]);
      }
    }
    var WHITE = null;
    function white() { if (!WHITE) { WHITE = document.createElement("canvas"); WHITE.width = WHITE.height = 8; var g = WHITE.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 8, 8); } return WHITE; }
    var bufs = new WeakMap();
    function buf(c, k, w, h) { var m = bufs.get(c); if (!m) { m = {}; bufs.set(c, m); } var cv = m[k] || (m[k] = document.createElement("canvas")); if (cv.width !== w) cv.width = w; if (cv.height !== h) cv.height = h; var g = cv.getContext("2d"); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; g.filter = "none"; g.clearRect(0, 0, w, h); return cv; }
    /** the shadows the other cards throw on this one, onto a copy of its picture */
    function shadowed(pic, c, kind, t, pl, cm, PW, PH) {
      var L = [cm.lx, cm.ly, cm.lz], S = null, W = C.state.W, H = C.state.H;
      cards().forEach(function (x) {
        if (x.c === c || x.L.visible === false || !C.at(x.c, x.kind, t)) return;
        var o2 = at(x.c, t - (x.c.start || 0)); if (!o2 || !o2.cast) return;
        var b2 = C.box(x.c, x.kind, t); if (!b2) return;
        var p2 = plane(o2, b2, W, H), G = grid(p2, 6), Q = [], ok = 0;
        G.forEach(function (P) { var X = onPlane(L, P, pl); if (X) { var u = toLocal(pl, X); Q.push([u[0] * PW, u[1] * PH, 2]); ok++; } else Q.push([0, 0, 0]); });
        if (!ok) return;
        if (!S) S = { M: buf(c, "m", PW, PH) };
        var src = b2.src && b2.src.tagName !== "VIDEO" && !x.c.d3vid ? b2.src : white();       // a video casts its box (the same at every bake)
        var sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
        mesh(S.M.getContext("2d"), src, sw, sh, Q, 6);
      });
      if (!S) return pic;
      var mg = S.M.getContext("2d"); mg.globalCompositeOperation = "source-in"; mg.fillStyle = "#000"; mg.fillRect(0, 0, PW, PH); mg.globalCompositeOperation = "source-over";
      var O = buf(c, "o", PW, PH), og = O.getContext("2d");
      og.drawImage(pic, 0, 0, PW, PH);
      og.globalCompositeOperation = "source-atop"; og.globalAlpha = cm.dark / 100; if (cm.soft > 0.3) og.filter = "blur(" + (cm.soft * PW / Math.max(1, pl.w)).toFixed(2) + "px)";
      og.drawImage(S.M, 0, 0); og.filter = "none"; og.globalAlpha = 1; og.globalCompositeOperation = "source-over";
      return O;
    }
    /** a 3D card drawn into g (frame px): perspective, shadows, depth of field */
    function draw(g, pic, c, kind, t, alpha, draft) {
      var o = at(c, t - (c.start || 0)), b = C.box(c, kind, t); if (!o || !b) return false;
      var W = C.state.W, H = C.state.H, cm = cam(t), ow = pic._ow || 1;
      var pl = plane(o, { cx: b.cx, cy: b.cy, w: b.w * ow, h: b.h * ow, rot: b.rot }, W, H);
      var PW = pic.naturalWidth || pic.videoWidth || pic.width, PH = pic.naturalHeight || pic.videoHeight || pic.height; if (!PW || !PH) return false;
      if (cm.light && o.accept) pic = shadowed(pic, c, kind, t, pl, cm, PW, PH);
      var B = basis(cm), n = draft ? 6 : 12, Q = grid(pl, n).map(function (P) { return project(cm, W, H, P, B); });
      var F = buf(c, "f", W, H); mesh(F.getContext("2d"), pic, PW, PH, Q, n);
      var bl = blurOf(cm, project(cm, W, H, pl.C, B)[2]);
      g.save(); g.globalAlpha = alpha; if (bl > 0.3) g.filter = "blur(" + bl.toFixed(2) + "px)";
      g.drawImage(F, 0, 0); g.restore();
      return true;
    }

    /* ---- 🧊 the Orbit tool */
    var camKeyed = function () { var k = (tl.cam3 || {}).kf; return Array.isArray(k) && k.length > 0; };
    function camSet(vals) {                       // write camera values (keys at the playhead once the camera has keys)
      tl.cam3 = tl.cam3 || {};
      if (camKeyed()) { var kv = {}; Object.keys(vals).forEach(function (k) { kv[kname(k)] = Math.round(vals[k] * 100) / 100; }); tl.cam3.kf = KF.set(tl.cam3.kf, C.state.t || 0, kv, FPS); }
      else Object.keys(vals).forEach(function (k) { tl.cam3[k] = Math.round(vals[k] * 100) / 100; });
    }
    function changed(repaint) { cards().forEach(function (x) { delete x.c.bakeSig; delete x.c.vbakeSig; }); if (typeof tlSave === "function") tlSave(); C.mark(); if (repaint) C.paintProps(); }
    var OR = null;
    C.addTool({ id: "orbit", icon: "🧊", title: "3D camera - drag = orbit around where it aims, Shift+drag = dolly, Alt+drag = track", key: "shift+o", cursor: "move",
      down: function (p, ev) { OR = { p0: { x: p.x, y: p.y }, cam: cam(C.state.t || 0), mode: ev && ev.altKey ? "track" : ev && ev.shiftKey ? "dolly" : "orbit" }; },
      move: function (p) {
        if (!OR) return; var c0 = OR.cam, dx = p.x - OR.p0.x, dy = p.y - OR.p0.y, T = [c0.tx, c0.ty, c0.tz], E = [c0.x, c0.y, c0.z], v = sub(E, T);
        if (OR.mode === "orbit") {
          var r = Math.hypot(v[0], v[1], v[2]) || 1, yaw = Math.atan2(v[0], -v[2]) - dx * 0.4 * d2r, pit = Math.asin(Math.max(-1, Math.min(1, v[1] / r))) + dy * 0.4 * d2r;
          pit = Math.max(-1.45, Math.min(1.45, pit));
          camSet({ x: T[0] + r * Math.cos(pit) * Math.sin(yaw), y: T[1] + r * Math.sin(pit), z: T[2] - r * Math.cos(pit) * Math.cos(yaw) });
        } else if (OR.mode === "dolly") {
          var f = norm(sub(T, E)), k = -dy * 2, dist = Math.hypot(v[0], v[1], v[2]); if (dist - k < 20) k = dist - 20;
          camSet({ x: E[0] + f[0] * k, y: E[1] + f[1] * k, z: E[2] + f[2] * k });
        } else {
          var B = basis(c0), mx = -dx * B.r[0] - dy * B.d[0], my = -dx * B.r[1] - dy * B.d[1], mz = -dx * B.r[2] - dy * B.d[2];
          camSet({ x: E[0] + mx, y: E[1] + my, z: E[2] + mz, tx: T[0] + mx, ty: T[1] + my, tz: T[2] + mz });
        }
        changed(false);
      },
      up: function () { if (OR) { OR = null; changed(true); } } });

    /* ---- 🧊 3D in the Properties */
    C.onProps(function (Pn, c, s) {
      if (!c || !Pn || !s || !s.Ly || s.Ly.kind === "v1" || s.Ly.kind === "aud" || c.adjust || c.nul) return;
      var o = clean(c.d3), tau = C.tauOf(c, s.Ly.kind), d = document.createElement("div"); d.className = "tlp-3d";
      var kv = function (k, v) { return Math.round((KF.has(c.kf, k) ? KF.value(c.kf, tau, k, v) : v) * 100) / 100; };
      var row = function (lbl, attr, k, v, keyName, keyed) { return '<label style="white-space:nowrap">' + lbl + ' <input type="number" ' + attr + '="' + k + '" value="' + v + '" step="any" style="width:58px"></label><button class="ghost" data-' + (attr === "data-d3" ? "d3k" : "cmk") + '="' + k + '" title="Key it at the playhead" style="padding:0 3px">' + (keyed ? "◆" : "◇") + "</button>"; };
      var h = '<div class="tlp-t">🧊 3D</div><div class="tlp-row" style="flex-wrap:wrap"><label title="The layer becomes a card in 3D space, seen by the 3D camera"><input type="checkbox" id="tlp3On"' + (o && o.on ? " checked" : "") + "> 3D layer</label>";
      if (o && o.on) {
        h += row("depth z", "data-d3", "z", kv("d3_z", o.z), "d3_z", KF.has(c.kf, "d3_z")) + row("x turn °", "data-d3", "rx", kv("d3_rx", o.rx), "d3_rx", KF.has(c.kf, "d3_rx")) + row("y turn °", "data-d3", "ry", kv("d3_ry", o.ry), "d3_ry", KF.has(c.kf, "d3_ry"))
          + '<label><input type="checkbox" id="tlp3Cast"' + (o.cast ? " checked" : "") + '> casts shadows</label><label><input type="checkbox" id="tlp3Acc"' + (o.accept ? " checked" : "") + "> accepts shadows</label></div>";
        var cm = cam(C.state.t || 0), cmk = function (k) { return camKeyed() && KF.has(tl.cam3.kf, kname(k)); };
        var crow = function (lbl, k) { return row(lbl, "data-cm", k, Math.round(cm[k] * 100) / 100, kname(k), cmk(k)); };
        h += '<div class="tlp-row" style="flex-wrap:wrap"><span>🎥 3D camera</span>' + crow("x", "x") + crow("y", "y") + crow("z", "z") + '<span>aim at</span>' + crow("x", "tx") + crow("y", "ty") + crow("z", "tz") + crow("zoom", "zoom") + crow("roll °", "roll")
          + '<button class="ghost" id="tlp3Orbit" title="The 🧊 tool (Shift+O): drag = orbit, Shift+drag = dolly, Alt+drag = track">🧊 Orbit</button><button class="ghost" id="tlp3Reset" title="The camera back to straight ahead (its keys too)">reset</button></div>'
          + '<div class="tlp-row" style="flex-wrap:wrap"><label><input type="checkbox" id="tlp3Dof"' + (cm.dof ? " checked" : "") + "> depth of field</label>" + (cm.dof ? crow("focus", "focus") + crow("aperture", "ap") : "")
          + '<label><input type="checkbox" id="tlp3Light"' + (cm.light ? " checked" : "") + "> light (shadows)</label>" + (cm.light ? crow("x", "lx") + crow("y", "ly") + crow("z", "lz")
            + '<label>darkness % <input type="number" data-cmv="dark" value="' + cm.dark + '" style="width:44px"></label><label>softness px <input type="number" data-cmv="soft" value="' + cm.soft + '" style="width:44px"></label>' : "") + "</div>";
      } else h += "</div>";
      d.innerHTML = h; Pn.appendChild(d);
      var q = function (id) { return d.querySelector("#" + id); };
      var save = function (repaint) { delete c.bakeSig; delete c.vbakeSig; changed(repaint); };
      d.querySelectorAll("input[type=number]").forEach(function (el) { el.addEventListener("keydown", function (e) { e.stopPropagation(); }); });
      q("tlp3On").addEventListener("change", function () { if (q("tlp3On").checked) c.d3 = clean(Object.assign({}, D3, c.d3 || {}, { on: true })); else if (c.d3) c.d3.on = false; save(true); });
      if (q("tlp3Cast")) q("tlp3Cast").addEventListener("change", function () { c.d3.cast = q("tlp3Cast").checked; save(false); });
      if (q("tlp3Acc")) q("tlp3Acc").addEventListener("change", function () { c.d3.accept = q("tlp3Acc").checked; save(false); });
      d.querySelectorAll("[data-d3]").forEach(function (el) {
        el.addEventListener("input", function () { var k = el.getAttribute("data-d3"), v = +el.value; if (!Number.isFinite(v)) return;
          if (KF.has(c.kf, "d3_" + k)) { var kk = {}; kk["d3_" + k] = v; c.kf = KF.set(c.kf, C.tauOf(c, s.Ly.kind), kk, FPS); } else c.d3[k] = v; save(false); });
      });
      d.querySelectorAll("[data-d3k]").forEach(function (el) { el.addEventListener("click", function () { var k = el.getAttribute("data-d3k"), kk = {}; kk["d3_" + k] = +(d.querySelector('[data-d3="' + k + '"]') || {}).value; c.kf = KF.set(c.kf, C.tauOf(c, s.Ly.kind), kk, FPS); save(true); }); });
      d.querySelectorAll("[data-cm]").forEach(function (el) {
        el.addEventListener("input", function () { var k = el.getAttribute("data-cm"), v = +el.value; if (!Number.isFinite(v)) return; tl.cam3 = tl.cam3 || {};
          if (camKeyed() && KF.has(tl.cam3.kf, kname(k))) { var kk = {}; kk[kname(k)] = v; tl.cam3.kf = KF.set(tl.cam3.kf, C.state.t || 0, kk, FPS); } else tl.cam3[k] = v; changed(false); });
      });
      d.querySelectorAll("[data-cmk]").forEach(function (el) { el.addEventListener("click", function () { var k = el.getAttribute("data-cmk"), kk = {}; tl.cam3 = tl.cam3 || {}; kk[kname(k)] = +(d.querySelector('[data-cm="' + k + '"]') || {}).value; tl.cam3.kf = KF.set(tl.cam3.kf, C.state.t || 0, kk, FPS); changed(true); }); });
      d.querySelectorAll("[data-cmv]").forEach(function (el) { el.addEventListener("input", function () { tl.cam3 = tl.cam3 || {}; tl.cam3[el.getAttribute("data-cmv")] = +el.value; changed(false); }); });
      if (q("tlp3Dof")) q("tlp3Dof").addEventListener("change", function () { tl.cam3 = tl.cam3 || {}; tl.cam3.dof = q("tlp3Dof").checked; changed(true); });
      if (q("tlp3Light")) q("tlp3Light").addEventListener("change", function () { tl.cam3 = tl.cam3 || {}; tl.cam3.light = q("tlp3Light").checked; changed(true); });
      if (q("tlp3Orbit")) q("tlp3Orbit").addEventListener("click", function () { C.setTool("orbit"); say("🧊 drag = orbit the 3D camera, Shift+drag = dolly, Alt+drag = track"); });
      if (q("tlp3Reset")) q("tlp3Reset").addEventListener("click", function () { var k = tl.cam3 || {}; tl.cam3 = { dof: k.dof, focus: k.focus, ap: k.ap, light: k.light, lx: k.lx, ly: k.ly, lz: k.lz, dark: k.dark, soft: k.soft }; changed(true); });
    });
    if (window.TlVBake) TlVBake.register("d3", live);           // a 3D video layer is baked whole by the page
    Object.assign(root.Tl3D, { ready: true, draw: draw, at: at, cam: cam, sceneSig: sceneSig, cards: cards });
  }
})(typeof window !== "undefined" ? window : globalThis);
