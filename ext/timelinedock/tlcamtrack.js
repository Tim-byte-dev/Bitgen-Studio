/* bitGen Studio — ext/timelinedock/tlcamtrack.js (2.515.0): 📷 THE 3D CAMERA TRACKER. window.TlCamTrack.
 *
 * Tim (verbatim): "do number 8 of the after effects list" - AFTER-EFFECTS-GAP.md: "3D camera tracker (solve the camera,
 * place layers in the scene)".
 *
 *   📷 3D camera track (a video clip's Properties - V1 or a video layer)
 *     ▶ Solve        the camera that filmed the clip (its in .. out) and the scene's points (scripts/camtrack.py):
 *                    Auto / Moving camera / Tripod (it only turns); the lens worked out (or typed: its across angle °);
 *                    ☑ leave out the cut-out (🧍 - a person / a car moving on its own is not used)
 *     the points     drawn on the picture where the solved camera sees them (they stick to the scene when it is good)
 *     📷 Pick        click points (Shift = more, a drag = a box of them)
 *     📌 Place       a layer (a picture, text, a shape - or ＋ New text) put there as a 🧊 3D card: flat on the picked
 *                    surface, standing on it (upright, facing the camera), or facing the camera; its size = a share of
 *                    the frame's width where it stands. The 3D camera is driven by the solve first.
 *     🎥 Drive       the 🧊 3D camera (tl.cam3, every 3D layer's) keyed every frame from the solve - position, aim, zoom
 *                    and roll (tl3d.js) - so every 3D card sits in the filmed scene
 * The world: the first solved frame's camera at (0, 0, -zoom) looking straight ahead (tl3d.js' default view), the scene's
 * middle depth at z 0 - pixels, x right, y down, z away. The clip is taken as filling the frame across, centred (V1).
 * Pure (Node: scripts/test-scene515.js): camOf, toWorld, fitPlane, eulerOf, place, frameAt.
 */
(function (root) {
  "use strict";
  var d2r = Math.PI / 180;
  var sub = function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; };
  var add = function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; };
  var mul = function (a, k) { return [a[0] * k, a[1] * k, a[2] * k]; };
  var dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };
  var cross = function (a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; };
  var norm = function (a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  var r2 = function (v) { return Math.round(v * 100) / 100; };
  /** a solve's frame (R: world -> camera, row-major; C: its centre) -> the 🧊 camera {x, y, z, tx, ty, tz, zoom, roll};
   *  D = the zoom (frame px) - the world is the solve's times D, shifted back by D */
  function camOf(fr, D) {
    var R = fr.R, r = [R[0], R[1], R[2]], d = [R[3], R[4], R[5]], f = [R[6], R[7], R[8]];
    var E = [D * fr.C[0], D * fr.C[1], D * fr.C[2] - D], T = add(E, mul(f, D));
    var r0 = cross([0, 1, 0], f); if (Math.hypot(r0[0], r0[1], r0[2]) < 1e-9) r0 = [1, 0, 0]; r0 = norm(r0);
    var d0 = cross(f, r0), roll = Math.atan2(dot(r, d0), dot(r, r0)) / d2r;
    return { x: E[0], y: E[1], z: E[2], tx: T[0], ty: T[1], tz: T[2], zoom: D, roll: roll };
  }
  function toWorld(P, D) { return [D * P[0], D * P[1], D * P[2] - D]; }
  /** the solve's frame for source second s (the nearest) */
  function frameAt(sol, s) {
    var n = (sol.frames || []).length; if (!n) return null;
    var k = Math.round((s - (+sol.from || 0)) * (+sol.fps || 24)); k = Math.max(0, Math.min(n - 1, k));
    return sol.frames[k];
  }
  /** 3x3 symmetric eigen (Jacobi) -> {vals, vecs (columns)} */
  function eig3(A) {
    var a = A.map(function (r) { return r.slice(); }), V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (var it = 0; it < 50; it++) {
      var p = 0, q = 1, mx = Math.abs(a[0][1]);
      if (Math.abs(a[0][2]) > mx) { p = 0; q = 2; mx = Math.abs(a[0][2]); }
      if (Math.abs(a[1][2]) > mx) { p = 1; q = 2; mx = Math.abs(a[1][2]); }
      if (mx < 1e-12) break;
      var th = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]), c = Math.cos(th), s = Math.sin(th);
      for (var k = 0; k < 3; k++) { var akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
      for (k = 0; k < 3; k++) { var apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
      for (k = 0; k < 3; k++) { var vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
    }
    return { vals: [a[0][0], a[1][1], a[2][2]], vecs: V };
  }
  /** the plane through points (least squares): {c (their middle), n (its normal, turned toward `eye`)} */
  function fitPlane(P, eye) {
    var n = P.length, c = [0, 0, 0];
    P.forEach(function (p) { c = add(c, p); }); c = mul(c, 1 / Math.max(1, n));
    if (n < 3) return { c: c, n: null };
    var A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    P.forEach(function (p) { var v = sub(p, c); for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) A[i][j] += v[i] * v[j]; });
    var e = eig3(A), k = e.vals.indexOf(Math.min.apply(null, e.vals)), N = norm([e.vecs[0][k], e.vecs[1][k], e.vecs[2][k]]);
    if (eye && dot(N, sub(eye, c)) < 0) N = mul(N, -1);
    return { c: c, n: N };
  }
  /** a rotation (its columns = the card's x, y, z in the world) -> tl3d.js' turns (R = Rx . Ry . Rz) */
  function eulerOf(X, Y, Z) {
    var R00 = X[0], R01 = Y[0], R02 = Z[0], R12 = Z[1], R22 = Z[2];
    var ry = Math.asin(Math.max(-1, Math.min(1, R02))), rx = Math.atan2(-R12, R22), rz = Math.atan2(-R01, R00);
    return { rx: rx / d2r, ry: ry / d2r, rz: rz / d2r };
  }
  /** where a card goes: how = flat | stand | face; P = the picked world points; eye = the first frame's camera;
   *  wpx = its width in the world (px), h = its height -> {x, y, z, rx, ry, rz} (the card's centre) */
  function place(how, P, eye, wpx, hpx) {
    var pl = fitPlane(P, eye), c = pl.c;
    if (how === "face" || !pl.n) return { x: c[0], y: c[1], z: c[2], rx: 0, ry: 0, rz: 0 };
    var up = pl.n;                                                   // out of the surface, toward the camera
    if (how === "flat") {
      var Z = mul(up, -1), ex = [1, 0, 0], X = norm(sub(ex, mul(Z, dot(ex, Z)))); if (Math.hypot(X[0], X[1], X[2]) < 1e-6) X = [0, 0, 1];
      var Y = cross(Z, X), e = eulerOf(X, Y, Z);
      return { x: c[0], y: c[1], z: c[2], rx: e.rx, ry: e.ry, rz: e.rz };
    }
    var Y2 = mul(up, -1), v = sub(c, eye), Z2 = norm(sub(v, mul(Y2, dot(v, Y2))));   // upright, its face to the camera
    var X2 = cross(Y2, Z2), e2 = eulerOf(X2, Y2, Z2), m = add(c, mul(up, (hpx || 0) / 2));
    void wpx;
    return { x: m[0], y: m[1], z: m[2], rx: e2.rx, ry: e2.ry, rz: e2.rz };
  }
  var pure = { camOf: camOf, toWorld: toWorld, frameAt: frameAt, eig3: eig3, fitPlane: fitPlane, eulerOf: eulerOf, place: place };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ---------------- the page ---------------- */
  root.TlCamTrack = Object.assign({ ready: false }, pure);
  function ready() { try { return !!(window.TlCanvas && TlCanvas.addTool && TlCanvas.onProps && TlCanvas.onDraw && TlCanvas.srcAt && window.Tl3D && Tl3D.ready && window.TlScene && window.H3Keyframes && typeof tl === "object" && tl); } catch (e) { return false; } }
  function boot() { if (ready()) install(); else setTimeout(boot, 300); }
  boot();
  function install() {
    if (root.TlCamTrack.ready) return;
    var C = window.TlCanvas, KF = window.H3Keyframes, FPS = KF.FPS || 24, S = window.TlScene, T3 = window.Tl3D;
    function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (x) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[x]; }); }
    function say(t) { try { C.say(t); } catch (e) { /* fine */ } }
    var isVid = function (s) { return !!(s && s.c && !s.c.adjust && (s.Ly.kind === "v1" || (s.Ly.kind === "vl" && !s.c.m3d && !s.c.gen && !s.c.shape && !s.c.nul))); };
    var selV = function () { var s = C.selClip(); return isVid(s) && s.c.cam3d && s.c.cam3d.file ? s : null; };
    function save(c, repaint) { if (typeof tlSave === "function") tlSave(); C.mark(); if (repaint) C.paintProps(); }
    var SOL = {};                                   // file -> the solve (fetched once)
    function solveOf(c) {
      var k = c.cam3d; if (!k || !k.file) return null;
      if (SOL[k.file] === undefined) { SOL[k.file] = null; fetch("/api/scene/cam/" + encodeURIComponent(k.file)).then(function (r) { return r.json(); }).then(function (j) { if (j && j.frames) { SOL[k.file] = j; C.mark(); C.paintProps(); } else SOL[k.file] = false; }).catch(function () { SOL[k.file] = false; }); }
      return SOL[k.file] || null;
    }
    /** the zoom: the solve's lens at the size the clip is drawn */
    function zoomOf(c, kind, sol) { var b = C.box(c, kind, c.start || 0); return sol.f * ((b && b.w) || C.state.W) / Math.max(1, sol.W); }
    function camAtT(s, sol, t) { var fr = frameAt(sol, C.srcAt(s.c, t)); return fr ? camOf(fr, zoomOf(s.c, s.Ly.kind, sol)) : null; }
    var PICK = null;                               // a box being dragged {a, b} (screen-free canvas coords)
    function projected(s, sol, t) {
      var cam = camAtT(s, sol, t); if (!cam) return [];
      var D = cam.zoom, cm = T3.camClean(cam), B = T3.basis(cm), W = C.state.W, H = C.state.H;
      return (sol.points || []).map(function (p, i) { var q = T3.project(cm, W, H, toWorld(p, D), B); return { i: i, x: q[0], y: q[1], z: q[2] }; }).filter(function (q) { return q.z > 1; });
    }
    C.addTool({ id: "campick", icon: "📷", title: "Pick the 3D camera track's points (Shift = more, drag = a box) - then 📌 Place a layer there", key: "", cursor: "crosshair",
      down: function (p, e) { var s = selV(); if (!s) return; PICK = { s: s, a: [p.x, p.y], b: [p.x, p.y], add: !!(e && e.shiftKey) || !!(window.event && window.event.shiftKey) }; },
      move: function (p) { if (!PICK) return; PICK.b = [p.x, p.y]; C.mark(); },
      up: function () {
        if (!PICK) return; var x = PICK; PICK = null;
        var sol = solveOf(x.s.c); if (!sol) return;
        var k = x.s.c.cam3d, pts = projected(x.s, sol, C.state.t), sel = x.add ? (k.sel || []).slice() : [];
        var bw = Math.abs(x.b[0] - x.a[0]), bh = Math.abs(x.b[1] - x.a[1]), zm = (C.state.view && C.state.view.z) || 1;
        if (bw > 6 / zm || bh > 6 / zm) {
          var x0 = Math.min(x.a[0], x.b[0]), x1 = Math.max(x.a[0], x.b[0]), y0 = Math.min(x.a[1], x.b[1]), y1 = Math.max(x.a[1], x.b[1]);
          pts.forEach(function (q) { if (q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1 && sel.indexOf(q.i) < 0) sel.push(q.i); });
        } else {
          var best = null, bd = 10 / zm; pts.forEach(function (q) { var d = Math.hypot(q.x - x.a[0], q.y - x.a[1]); if (d < bd) { bd = d; best = q; } });
          if (best) { var at = sel.indexOf(best.i); if (at >= 0 && x.add) sel.splice(at, 1); else if (at < 0) sel.push(best.i); }
        }
        k.sel = sel.slice(0, 400); save(x.s.c, true);
      } });
    C.onDraw(function (ctx, o) {
      var s = selV(); if (!s || s.c.cam3d.show === false) return;
      var sol = solveOf(s.c); if (!sol) return;
      var sel = s.c.cam3d.sel || [], pts = projected(s, sol, C.state.t);
      ctx.save();
      pts.forEach(function (q) {
        var w = o.toScreen(q.x, q.y), on = sel.indexOf(q.i) >= 0;
        ctx.fillStyle = on ? "#ff7a1a" : "rgba(255,210,63,.9)";
        var r = on ? 4 : 2; ctx.fillRect(w.x - r, w.y - r, 2 * r, 2 * r);
      });
      if (PICK && PICK.s.c === s.c) {
        var a = o.toScreen(PICK.a[0], PICK.a[1]), b = o.toScreen(PICK.b[0], PICK.b[1]);
        ctx.strokeStyle = "#ff7a1a"; ctx.setLineDash([5, 3]); ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)); ctx.setLineDash([]);
      }
      ctx.restore();
    });

    /** 🎥 the 3D camera keyed every frame of the clip from the solve */
    function drive(s, sol) {
      var c = s.c, kind = s.Ly.kind, t0 = c.start || 0, len = C.clipLen ? C.clipLen(c, kind === "v1" ? "v1" : kind) : (+c.len || 5), t1 = t0 + len;
      var props = ["cx", "cy", "cz", "tx", "ty", "tz", "zoom", "roll"], keys = [], prevRoll = null;
      var step = len * FPS > 4000 ? Math.ceil(len * FPS / 4000) / FPS : 1 / FPS;
      for (var t = t0; t <= t1 + 1e-6; t += step) {
        var cam = camAtT(s, sol, Math.min(t, t1 - 1e-4)); if (!cam) continue;
        if (prevRoll != null) { while (cam.roll - prevRoll > 180) cam.roll -= 360; while (cam.roll - prevRoll < -180) cam.roll += 360; }
        prevRoll = cam.roll;
        keys.push({ at: Math.round(t * 1000) / 1000, cx: r2(cam.x), cy: r2(cam.y), cz: r2(cam.z), tx: r2(cam.tx), ty: r2(cam.ty), tz: r2(cam.tz), zoom: r2(cam.zoom), roll: Math.round(cam.roll * 1000) / 1000 });
      }
      if (!keys.length) return false;
      tl.cam3 = tl.cam3 || {};
      var others = (tl.cam3.kf || []).filter(function (k) { return k.at < t0 - 1e-6 || k.at > t1 + 1e-6; }).concat((tl.cam3.kf || []).filter(function (k) { return k.at >= t0 - 1e-6 && k.at <= t1 + 1e-6; }).map(function (k) { var o = {}; Object.keys(k).forEach(function (p) { if (props.indexOf(p) < 0) o[p] = k[p]; }); return o; }).filter(function (o) { return Object.keys(o).some(function (p) { return p !== "at" && p !== "ease"; }); }));
      tl.cam3.kf = others.concat(keys).sort(function (a, b) { return a.at - b.at; });
      var k0 = keys[0]; Object.assign(tl.cam3, { x: k0.cx, y: k0.cy, z: k0.cz, tx: k0.tx, ty: k0.ty, tz: k0.tz, zoom: k0.zoom, roll: k0.roll });
      c.cam3d.driven = true;
      (window.TlParent ? TlParent.all() : []).forEach(function (x) { if (x.c.d3) { delete x.c.bakeSig; delete x.c.vbakeSig; } });
      save(c, true);
      say("🎥 the 3D camera follows the solve: " + keys.length + " keys (" + t0.toFixed(2) + " – " + t1.toFixed(2) + " s)");
      return true;
    }
    /** 📌 a layer put at the picked points as a 3D card */
    function placeLayer(s, sol, target, how, pct) {
      var k = s.c.cam3d, sel = (k.sel || []).filter(function (i) { return sol.points[i]; });
      if (!sel.length) { say("📷 pick points first (📷 Pick - click the dots on the picture)"); return false; }
      if (!k.driven) drive(s, sol);
      var D = zoomOf(s.c, s.Ly.kind, sol), P = sel.map(function (i) { return toWorld(sol.points[i], D); });
      var eye = [0, 0, -D], cen = fitPlane(P, eye).c, dist = Math.max(1, cen[2] + D);
      var tgt = target;
      if (!tgt) {                                   // ＋ New text: over the tracked clip's length
        C.addText({ x: C.state.W / 2, y: C.state.H / 2 });
        var L = tl.images[tl.images.length - 1]; tgt = { c: L.clips[0], L: L, kind: "img" };
        tgt.c.start = s.c.start || 0; tgt.c.len = Math.max(0.1, C.clipLen ? C.clipLen(s.c, s.Ly.kind) : (+s.c.len || 5));
      }
      var c = tgt.c;
      c.tf = Object.assign({ x: 0, y: 0, scale: 1, rot: 0 }, c.tf || {}, { ax: 0, ay: 0 });
      c.kf = (c.kf || []).map(function (q) { var o = {}; Object.keys(q).forEach(function (p) { if (["x", "y", "scale", "rot", "ax", "ay", "to", "ti", "d3_z", "d3_rx", "d3_ry"].indexOf(p) < 0) o[p] = q[p]; }); return o; })
        .filter(function (o) { return Object.keys(o).some(function (p) { return p !== "at" && p !== "ease" && p !== "bz"; }); });
      c.tf.scale = 1; c.tf.rot = 0;
      var b = C.box(c, tgt.kind, c.start || 0), bw = b ? b.w : 400, bh = b ? b.h : 200;
      var wantW = Math.max(1, (pct || 30) / 100 * C.state.W * dist / D), sc = wantW / Math.max(1, bw);
      var at = place(how, P, eye, wantW, bh * sc);
      c.tf.x = r2(at.x); c.tf.y = r2(at.y); c.tf.rot = r2(at.rz); c.tf.scale = Math.round(sc * 10000) / 10000;
      c.d3 = T3.clean(Object.assign({}, T3.D3, c.d3 || {}, { on: true, z: r2(at.z), rx: r2(at.rx), ry: r2(at.ry) }));
      delete c.bakeSig; delete c.vbakeSig;
      if (C.keysChanged) C.keysChanged(c);
      if (typeof renderTimeline === "function") renderTimeline();
      save(c, true);
      say("📌 " + (tgt.L.name || "the layer") + " placed " + ({ flat: "flat on the surface", stand: "standing on it", face: "facing the camera" }[how] || "") + " at " + sel.length + " point(s) - a 🧊 3D card the solved camera sees");
      return true;
    }
    function solve(s) {
      var c = s.c, k = c.cam3d || (c.cam3d = { mode: "auto", fov: 0 }), rng = S.range(c);
      var ig = k.ignoreCut !== false && c.cut && c.cut.file ? { name: c.cut.file, t0: c.cut.from } : null;
      say("📷 solving the camera of " + (s.Ly.L.name || c.name) + "…");
      return S.run(c, "cam", "/api/scene/camtrack", { name: c.name, src: c.src, from: rng[0], to: rng[1], mode: k.mode || "auto", fov: +k.fov || 0, ignore: ig }, function () { C.paintProps(); })
        .then(function (res) {
          k.file = res.file; k.info = { mode: res.mode, fov: res.fov, err: res.err, solved: res.solved, lost: res.lost, points: res.points, frames: res.frames };
          k.sel = []; k.driven = false; delete SOL[res.file];
          save(c, true);
          say("📷 solved: " + res.solved + "/" + res.frames + " frames (" + (res.mode === "tripod" ? "tripod - it only turns" : "a moving camera") + "), lens " + res.fov + "°, error " + res.err + " px, " + res.points + " points - 📷 Pick some, then 📌 Place");
          return res;
        }).catch(function (e) { C.paintProps(); say("📷 " + e.message); return null; });
    }

    C.onProps(function (Pn, c, s) {
      if (!Pn || !isVid(s)) return;
      var k = c.cam3d || {}, run = S.busy(c, "cam"), d = document.createElement("div"); d.className = "tlp-camtrack";
      var h = '<div class="tlp-t">📷 3D camera track</div><div class="tlp-row" style="flex-wrap:wrap">'
        + (run ? '<span class="tlp-none">⏳ ' + esc(run.stage || "") + " " + S.pct(run.p) + '</span><button class="ghost" id="tlpCamStop">■ Stop</button>'
          : '<button class="ghost" id="tlpCamGo" title="Solve the camera over the clip\'s whole length">▶ Solve</button>')
        + '<select id="tlpCamMode" title="How the camera moved"><option value="auto">Auto</option><option value="free">Moving camera</option><option value="tripod">Tripod (it only turns)</option></select>'
        + '<label title="The lens\'s across angle - 0 = worked out">lens <input type="number" id="tlpCamFov" min="0" max="170" step="1" value="' + (+k.fov || 0) + '" style="width:44px">°</label>'
        + (c.cut && c.cut.file ? '<label title="What the 🧍 cut-out holds moves on its own - not used for the camera"><input type="checkbox" id="tlpCamIg"' + (k.ignoreCut !== false ? " checked" : "") + "> leave out the cut-out</label>" : "") + "</div>";
      if (k.file && k.info) {
        var I = k.info;
        h += '<div class="tlp-row" style="flex-wrap:wrap"><span class="tlp-none">✓ ' + I.solved + "/" + I.frames + " frames · " + (I.mode === "tripod" ? "tripod" : "moving") + " · lens " + I.fov + "° · error " + I.err + " px · " + I.points + " points" + (I.lost ? " · " + I.lost + " guessed" : "") + "</span>"
          + '<label><input type="checkbox" id="tlpCamShow"' + (k.show !== false ? " checked" : "") + "> points</label>"
          + '<button class="ghost" id="tlpCamDrive" title="Key the 🧊 3D camera every frame from the solve (every 3D layer sits in the scene)">🎥 Drive the 3D camera' + (k.driven ? " ✓" : "") + "</button>"
          + '<button class="ghost" id="tlpCamX" title="Forget the solve">✕</button></div>';
        var targets = (window.TlParent ? TlParent.all() : []).filter(function (x) { return x.c !== c && (x.kind === "img" || (x.kind === "vl" && !x.c.m3d)) && !x.c.adjust && !x.c.nul; });
        h += '<div class="tlp-row" style="flex-wrap:wrap"><button class="ghost" id="tlpCamPick" title="Click the points on the picture (Shift = more, drag = a box)"' + (C.state.tool === "campick" ? ' style="border-color:#ff7a1a"' : "") + ">📷 Pick</button>"
          + '<span class="tlp-none">' + (k.sel || []).length + " picked</span>"
          + '<select id="tlpCamTgt"><option value="">＋ New text</option>' + targets.map(function (x) { return '<option value="' + esc(S.uid(x.c)) + '">' + esc((x.L.name || x.lk) + (x.c.text ? " (text)" : "")) + "</option>"; }).join("") + "</select>"
          + '<select id="tlpCamHow"><option value="flat">flat on them</option><option value="stand">standing on them</option><option value="face">facing the camera</option></select>'
          + '<label title="Its width - a share of the frame\'s width where it stands">size <input type="number" id="tlpCamPct" min="1" max="400" step="1" value="' + (+k.pct || 30) + '" style="width:44px"> %</label>'
          + '<button class="ghost" id="tlpCamPlace"' + ((k.sel || []).length ? "" : " disabled") + ">📌 Place</button></div>";
      }
      d.innerHTML = h; Pn.appendChild(d);
      var q = function (id) { return d.querySelector("#" + id); };
      d.querySelectorAll("input[type=number]").forEach(function (el) { el.addEventListener("keydown", function (e) { e.stopPropagation(); }); });
      q("tlpCamMode").value = k.mode || "auto";
      var kk = function () { return c.cam3d || (c.cam3d = { mode: "auto", fov: 0 }); };
      q("tlpCamMode").addEventListener("change", function () { kk().mode = q("tlpCamMode").value; save(c, false); });
      q("tlpCamFov").addEventListener("change", function () { kk().fov = Math.max(0, Math.min(170, +q("tlpCamFov").value || 0)); save(c, false); });
      if (q("tlpCamIg")) q("tlpCamIg").addEventListener("change", function () { kk().ignoreCut = q("tlpCamIg").checked; save(c, false); });
      if (q("tlpCamGo")) q("tlpCamGo").addEventListener("click", function () { solve(s); });
      if (q("tlpCamStop")) q("tlpCamStop").addEventListener("click", function () { S.stop(c, "cam"); });
      if (q("tlpCamShow")) q("tlpCamShow").addEventListener("change", function () { c.cam3d.show = q("tlpCamShow").checked; save(c, false); });
      if (q("tlpCamDrive")) q("tlpCamDrive").addEventListener("click", function () { var sol = solveOf(c); if (!sol) { say("📷 the solve is loading - a moment"); return; } drive(s, sol); });
      if (q("tlpCamX")) q("tlpCamX").addEventListener("click", function () { delete c.cam3d.file; delete c.cam3d.info; delete c.cam3d.sel; delete c.cam3d.driven; save(c, true); say("📷 the solve is forgotten (the 3D camera keeps its keys)"); });
      if (q("tlpCamPick")) q("tlpCamPick").addEventListener("click", function () { C.setTool("campick"); C.paintProps(); say("📷 click the points (Shift = more, drag = a box of them)"); });
      if (q("tlpCamPct")) q("tlpCamPct").addEventListener("change", function () { c.cam3d.pct = Math.max(1, Math.min(400, +q("tlpCamPct").value || 30)); save(c, false); });
      if (q("tlpCamPlace")) q("tlpCamPlace").addEventListener("click", function () {
        var sol = solveOf(c); if (!sol) { say("📷 the solve is loading - a moment"); return; }
        var u = q("tlpCamTgt").value, x = u ? (window.TlParent ? TlParent.all() : []).filter(function (y) { return y.c.uid === u; })[0] : null;
        placeLayer(s, sol, x || null, q("tlpCamHow").value, +q("tlpCamPct").value || 30);
      });
    });
    Object.assign(root.TlCamTrack, { ready: true, solve: solve, drive: drive, placeLayer: placeLayer, solveOf: solveOf, projected: projected });
  }
})(typeof window !== "undefined" ? window : globalThis);
