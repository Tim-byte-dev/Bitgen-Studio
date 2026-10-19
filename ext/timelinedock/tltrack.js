/* bitGen Studio — ext/timelinedock/tltrack.js (2.499.0): 🎯 TRACKING + ▢ CORNER PIN on the timeline. window.TlTrack.
 *
 * Tim (verbatim): "... and the rest of the After Effects gap list (expressions, Bézier masks, tracking and so on).." -
 * AFTER-EFFECTS-GAP.md: "Point / corner-pin tracking (stick a picture on a screen), planar tracking".
 *
 *   🎯 Track (a video clip's Properties - V1 or a video layer)
 *     what       ◎ a point (position) · ◎◎ two points (position + scale + rotation) · ▢ corner pin (4 points) ·
 *                ▣ planar (a flat surface - a screen, a sign, a page - its 4 corners carried by everything inside it)
 *     ◎ Place    the points on the picture at the playhead (drag them onto clear details; the size = the patch looked for)
 *     ▶ Track    from the playhead to the clip's end (scripts/track_points.py: to a fraction of a pixel, the clip's own
 *                frame rate) - the paths are drawn; frames not found well are said
 *     Apply to   a layer: ◎ / ◎◎ = its position (and scale + rotation) keys follow (a null works: parent more to it);
 *                ▢ / ▣ = the layer pinned into the tracked corners every frame
 *   ▢ Corner pin (any layer's Properties) the layer drawn into 4 corners (on / off, ✥ Edit corners - drag them; keyed
 *                when it has keys), what a corner-pin track writes
 *   The compile  a pinned picture / text is baked by the page; a pinned VIDEO layer is warped by the compile itself
 *                (worker.py: perspective, the corners as keys)
 * Pure (Node: scripts/test-track.js): squareToQuad, mapH, affine3, quadAt, padCorners, pinKeys, DEF_PTS, MODES.
 */
(function (root) {
  "use strict";
  var MODES = [["point", "◎ a point (position)"], ["scalerot", "◎◎ two points (+ scale, rotation)"], ["pin", "▢ corner pin (4 points)"], ["planar", "▣ planar (a flat surface)"]];
  var DEF_PTS = { point: [[0.5, 0.5]], scalerot: [[0.4, 0.5], [0.6, 0.5]], pin: [[0.35, 0.3], [0.65, 0.3], [0.65, 0.7], [0.35, 0.7]], planar: [[0.35, 0.3], [0.65, 0.3], [0.65, 0.7], [0.35, 0.7]] };
  /** the homography taking the unit square ((0,0) (1,0) (1,1) (0,1)) to a quad (TL, TR, BR, BL) -> [a, b, c, d, e, f, g, h] */
  function squareToQuad(q) {
    var x0 = q[0][0], y0 = q[0][1], x1 = q[1][0], y1 = q[1][1], x2 = q[2][0], y2 = q[2][1], x3 = q[3][0], y3 = q[3][1];
    var dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) return [x1 - x0, x3 - x0, x0, y1 - y0, y3 - y0, y0, 0, 0];
    var den = dx1 * dy2 - dx2 * dy1; if (Math.abs(den) < 1e-12) den = 1e-12;
    var g = (dx3 * dy2 - dx2 * dy3) / den, h = (dx1 * dy3 - dx3 * dy1) / den;
    return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h];
  }
  function mapH(H, u, v) { var w = H[6] * u + H[7] * v + 1; return [(H[0] * u + H[1] * v + H[2]) / w, (H[3] * u + H[4] * v + H[5]) / w]; }
  /** the affine [a, b, c, d, e, f] (canvas setTransform order) taking three source points to three others */
  function affine3(s, d) {
    var x0 = s[0][0], y0 = s[0][1], x1 = s[1][0], y1 = s[1][1], x2 = s[2][0], y2 = s[2][1];
    var den = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0); if (Math.abs(den) < 1e-12) return null;
    var solve = function (v0, v1, v2) { var p = ((v1 - v0) * (y2 - y0) - (v2 - v0) * (y1 - y0)) / den, q = ((v2 - v0) * (x1 - x0) - (v1 - v0) * (x2 - x0)) / den; return [p, q, v0 - p * x0 - q * y0]; };
    var X = solve(d[0][0], d[1][0], d[2][0]), Y = solve(d[0][1], d[1][1], d[2][1]);
    return [X[0], Y[0], X[1], Y[1], X[2], Y[2]];
  }
  /** a pin's quad at tau (s into the clip): its keys straight between (one key = it holds) */
  function quadAt(pin, tau) {
    var K = (pin && Array.isArray(pin.keys) ? pin.keys : []).filter(function (k) { return k && Array.isArray(k.q) && k.q.length === 4; });
    if (!K.length) return null;
    if (K.length === 1 || tau <= K[0].at) return K[0].q;
    if (tau >= K[K.length - 1].at) return K[K.length - 1].q;
    var lo = 0, hi = K.length - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (K[mid].at <= tau) lo = mid; else hi = mid; }
    var a = K[lo], b = K[hi], f = (tau - a.at) / Math.max(1e-9, b.at - a.at);
    return a.q.map(function (p, i) { return [p[0] + (b.q[i][0] - p[0]) * f, p[1] + (b.q[i][1] - p[1]) * f]; });
  }
  /** the corners of a W x H frame whose inside (pad px in from each side) is pinned to q - ffmpeg perspective's order
   *  (top left, top right, bottom left, bottom right) */
  function padCorners(q, W, H, pad) {
    var Hm = squareToQuad(q), p = pad || 2, u = p / Math.max(1, W - 2 * p), v = p / Math.max(1, H - 2 * p);
    return [mapH(Hm, -u, -v), mapH(Hm, 1 + u, -v), mapH(Hm, -u, 1 + v), mapH(Hm, 1 + u, 1 + v)];
  }
  /** the compile's keys for a pinned clip: [{at, p0x, p0y … p3x, p3y}] (every frame, thinned: straight runs dropped) */
  function pinKeys(pin, W, H, len, fps, pad) {
    var n = Math.max(1, Math.round(len * fps)), S = [];
    for (var i = 0; i <= n; i++) { var at = Math.min(len, i / fps), q = quadAt(pin, at); if (!q) return []; var c = padCorners(q, W, H, pad); S.push({ at: at, v: [c[0][0], c[0][1], c[1][0], c[1][1], c[2][0], c[2][1], c[3][0], c[3][1]] }); }
    var keep = S.map(function (_, i) { return i === 0 || i === S.length - 1; }), st = [[0, S.length - 1]];
    while (st.length) {                                 // keep a sample where any coordinate leaves the straight line by 0.3 px
      var s = st.pop(), a = s[0], b = s[1]; if (b - a < 2) continue; var best = -1, bi = -1;
      for (var k = a + 1; k < b; k++) { var f = (S[k].at - S[a].at) / Math.max(1e-9, S[b].at - S[a].at), d = 0; for (var j = 0; j < 8; j++) d = Math.max(d, Math.abs(S[k].v[j] - (S[a].v[j] + (S[b].v[j] - S[a].v[j]) * f))); if (d > best) { best = d; bi = k; } }
      if (best > 0.3) { keep[bi] = true; st.push([a, bi], [bi, b]); }
    }
    var r2 = function (x) { return Math.round(x * 100) / 100; };
    return S.filter(function (_, i) { return keep[i]; }).map(function (q) { return { at: Math.round(q.at * 1000) / 1000, p0x: r2(q.v[0]), p0y: r2(q.v[1]), p1x: r2(q.v[2]), p1y: r2(q.v[3]), p2x: r2(q.v[4]), p2y: r2(q.v[5]), p3x: r2(q.v[6]), p3y: r2(q.v[7]) }; });
  }
  var pure = { MODES: MODES, DEF_PTS: DEF_PTS, squareToQuad: squareToQuad, mapH: mapH, affine3: affine3, quadAt: quadAt, padCorners: padCorners, pinKeys: pinKeys };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ---------------- the page ---------------- */
  root.TlTrack = Object.assign({ ready: false }, pure);
  function ready() { try { return !!(window.TlCanvas && TlCanvas.addTool && TlCanvas.onProps && TlCanvas.srcAt && window.TlParent && TlParent.keysOf && window.H3Keyframes && typeof tl === "object" && tl); } catch (e) { return false; } }
  function boot() { if (ready()) install(); else setTimeout(boot, 300); }
  boot();
  function install() {
    if (root.TlTrack.ready) return;
    var C = window.TlCanvas, KF = window.H3Keyframes, FPS = KF.FPS || 24;
    function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function say(t) { try { C.say(t); } catch (e) { /* fine */ } }
    var toPic = function (b, u, v) { var a = (b.rot || 0) * Math.PI / 180, dx = (u - 0.5) * b.w, dy = (v - 0.5) * b.h; return [b.cx + dx * Math.cos(a) - dy * Math.sin(a), b.cy + dx * Math.sin(a) + dy * Math.cos(a)]; };
    var toLocal = function (b, x, y) { var a = -(b.rot || 0) * Math.PI / 180, dx = x - b.cx, dy = y - b.cy; return [(dx * Math.cos(a) - dy * Math.sin(a)) / b.w + 0.5, (dx * Math.sin(a) + dy * Math.cos(a)) / b.h + 0.5]; };
    var zoom = function () { return (C.state.view && C.state.view.z) || 1; };
    var all = function () { return TlParent.all(); };
    var isVid = function (s) { return !!(s && s.c && (s.Ly.kind === "v1" || (s.Ly.kind === "vl" && !s.c.m3d))); };
    function save(c, repaint) { delete c.bakeSig; if (typeof tlSave === "function") tlSave(); C.mark(); if (repaint) C.paintProps(); }

    /* ---- ▢ corner pin drawing: the picture through the homography, in small triangles */
    function drawPin(g, pic, c, t) {
      var q = quadAt(c.pin, t - (c.start || 0)); if (!q) return false;
      var sw = pic.videoWidth || pic.naturalWidth || pic.width, sh = pic.videoHeight || pic.naturalHeight || pic.height; if (!sw || !sh) return false;
      var Hm = squareToQuad(q), N = 12;
      for (var j = 0; j < N; j++) for (var i = 0; i < N; i++) {
        var u0 = i / N, u1 = (i + 1) / N, v0 = j / N, v1 = (j + 1) / N;
        var P = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], D = P.map(function (p) { return mapH(Hm, p[0], p[1]); }), Sx = P.map(function (p) { return [p[0] * sw, p[1] * sh]; });
        [[0, 1, 2], [0, 2, 3]].forEach(function (tri) {
          var s = tri.map(function (k) { return Sx[k]; }), d = tri.map(function (k) { return D[k]; }), A = affine3(s, d); if (!A) return;
          var cx = (d[0][0] + d[1][0] + d[2][0]) / 3, cy = (d[0][1] + d[1][1] + d[2][1]) / 3, grow = function (p) { var dx = p[0] - cx, dy = p[1] - cy, L = Math.hypot(dx, dy) || 1; return [p[0] + dx / L * 0.6, p[1] + dy / L * 0.6]; };
          var e = d.map(grow);
          g.save(); g.beginPath(); g.moveTo(e[0][0], e[0][1]); g.lineTo(e[1][0], e[1][1]); g.lineTo(e[2][0], e[2][1]); g.closePath(); g.clip();
          g.transform(A[0], A[1], A[2], A[3], A[4], A[5]);
          try { g.drawImage(pic, 0, 0, sw, sh); } catch (er) { /* not decodable yet */ }
          g.restore();
        });
      }
      return true;
    }

    /* ---- 🎯 the points on the picture (placing them, the paths after a track) */
    var PL = null, DR = null;          // PL: {c, kind} the clip whose points are placed; DR: a drag {i}
    var selV = function () { var s = C.selClip(); return isVid(s) ? s : null; };
    C.addTool({ id: "trackpts", icon: "🎯", title: "Track points - drag them onto clear details of the picked video clip (the 🎯 Track section)", key: "", cursor: "crosshair",
      down: function (p) {
        var s = selV(); if (!s || !s.c.trk) return; var b = C.box(s.c, s.Ly.kind, C.state.t); if (!b) return;
        var R = 12 / zoom(), best = -1, bd = 1e9;
        s.c.trk.pts.forEach(function (q, i) { var w = toPic(b, q[0], q[1]), d = Math.hypot(w[0] - p.x, w[1] - p.y); if (d < bd) { bd = d; best = i; } });
        DR = bd <= Math.max(R, 40 / zoom()) ? { i: best, s: s } : null;
      },
      move: function (p) { if (!DR) return; var b = C.box(DR.s.c, DR.s.Ly.kind, C.state.t); if (!b) return; var u = toLocal(b, p.x, p.y); DR.s.c.trk.pts[DR.i] = [Math.max(0, Math.min(1, u[0])), Math.max(0, Math.min(1, u[1]))]; DR.s.c.trk.data = null; C.mark(); },
      up: function () { if (DR) save(DR.s.c, true); DR = null; } });
    C.onDraw(function (ctx, o) {
      var s = C.selClip(); if (!isVid(s) || !s.c.trk) return;
      var c = s.c, T = c.trk, t = C.state.t, b = C.box(c, s.Ly.kind, t); if (!b) return;
      ctx.save();
      if (T.data && T.data.length) {                                    // the paths
        var n = T.data[0].pts.length;
        for (var k = 0; k < n; k++) {
          ctx.strokeStyle = "rgba(80,220,255,.85)"; ctx.lineWidth = 1.2; ctx.beginPath();
          T.data.forEach(function (d, i) { if (i % 2 && i !== T.data.length - 1) return; var bb = C.box(c, s.Ly.kind, (c.start || 0) + d.at) || b, w = toPic(bb, d.pts[k][0], d.pts[k][1]), q = o.toScreen(w[0], w[1]); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
          ctx.stroke();
        }
      }
      var now = ptsAt(c, t - (c.start || 0)) || T.pts, R = Math.max(6, (T.box || 0.05) * b.w * zoom() / 2);
      var scr = now.map(function (q) { var w = toPic(b, q[0], q[1]); return o.toScreen(w[0], w[1]); });
      if (scr.length === 4) { ctx.strokeStyle = "rgba(80,220,255,.9)"; ctx.setLineDash([5, 3]); ctx.beginPath(); scr.forEach(function (q, i) { if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]); }
      scr.forEach(function (q, i) {
        ctx.strokeStyle = "#50dcff"; ctx.lineWidth = 1.5; ctx.strokeRect(q.x - R, q.y - R, 2 * R, 2 * R);
        ctx.beginPath(); ctx.moveTo(q.x - 5, q.y); ctx.lineTo(q.x + 5, q.y); ctx.moveTo(q.x, q.y - 5); ctx.lineTo(q.x, q.y + 5); ctx.stroke();
        ctx.fillStyle = "#50dcff"; ctx.font = "11px sans-serif"; ctx.fillText(String(i + 1), q.x + R + 3, q.y - R);
      });
      ctx.restore();
    });
    /** the tracked points at tau (s into the clip) - the nearest frame of the track, or null */
    function ptsAt(c, tau) {
      var D = c.trk && c.trk.data; if (!D || !D.length) return null;
      if (tau <= D[0].at) return D[0].pts; if (tau >= D[D.length - 1].at) return D[D.length - 1].pts;
      var lo = 0, hi = D.length - 1; while (hi - lo > 1) { var m = (lo + hi) >> 1; if (D[m].at <= tau) lo = m; else hi = m; }
      var a = D[lo], bq = D[hi], f = (tau - a.at) / Math.max(1e-9, bq.at - a.at);
      return a.pts.map(function (p, i) { return [p[0] + (bq.pts[i][0] - p[0]) * f, p[1] + (bq.pts[i][1] - p[1]) * f]; });
    }
    /** ▶ Track: from the playhead to the clip's end */
    function run(s) {
      var c = s.c, T = c.trk, kind = s.Ly.kind, t0 = Math.max(c.start || 0, C.state.t), end = (c.start || 0) + C.clipLen(c, kind) - 1 / FPS;
      if (end <= t0 + 0.05) { say("🎯 the playhead is at the clip's end - move it to where the tracking starts"); return Promise.resolve(null); }
      var from = C.srcAt(c, t0), to = C.srcAt(c, end);
      // source seconds -> the clip's own seconds (a clip may be retimed: sampled, the nearest)
      var map = []; for (var tt = t0; tt <= end + 1e-6; tt += 1 / FPS) map.push([C.srcAt(c, tt), tt - (c.start || 0)]);
      var tauOf = function (src) { var best = map[0], bd = 1e9; for (var i = 0; i < map.length; i++) { var d = Math.abs(map[i][0] - src); if (d < bd) { bd = d; best = map[i]; } } return best[1]; };
      T.busy = true; C.paintProps(); say("🎯 tracking " + (T.mode === "planar" ? "the surface" : T.pts.length + " point(s)") + "…");
      return fetch("/api/track/points", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: c.name, from: Math.min(from, to), to: Math.max(from, to), mode: T.mode === "planar" ? "planar" : "points", pts: T.pts, box: T.box || 0.05 }) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); })
        .then(function (j) {
          T.data = j.track.map(function (d) { return { at: Math.round(tauOf(d.t) * 1000) / 1000, pts: d.pts }; }).sort(function (a, b) { return a.at - b.at; });
          T.method = j.method; T.lost = (j.lost || []).length; T.busy = false; save(c, true);
          say("🎯 tracked " + T.data.length + " frames (" + j.method + ")" + (T.lost ? " - " + T.lost + " not found well (held / guessed)" : "") + " - now Apply to a layer");
          return T.data;
        })
        .catch(function (e) { T.busy = false; C.paintProps(); say("🎯 " + e.message); return null; });
    }
    /** Apply the track to a layer: its keys (◎ / ◎◎) or its corner pin (▢ / ▣) */
    function apply(src, target) {
      var c = src.c, T = c.trk; if (!T || !T.data || !T.data.length) { say("🎯 track first (▶ Track)"); return false; }
      var tgt = all().filter(function (x) { return x.c === target; })[0]; if (!tgt) return false;
      var kind = src.Ly.kind, D = T.data, T0 = (c.start || 0) + D[0].at;
      var pic = function (d) { var tt = (c.start || 0) + d.at, b = C.box(c, kind, tt); return d.pts.map(function (q) { return toPic(b, q[0], q[1]); }); };
      var inT = function (tt) { return tt >= (target.start || 0) - 1e-6 && tt <= (target.start || 0) + C.clipLen(target, tgt.kind) + 1e-6; };
      if (T.mode === "pin" || T.mode === "planar") {
        var keys = []; D.forEach(function (d) { var tt = (c.start || 0) + d.at; if (!inT(tt)) return; keys.push({ at: Math.round((tt - (target.start || 0)) * 1000) / 1000, q: pic(d).map(function (p) { return [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]; }) }); });
        if (!keys.length) { say("🎯 the layer is not on the timeline while the track runs"); return false; }
        target.pin = { on: true, keys: keys }; save(target, true);
        say("▢ " + (tgt.L.name || "the layer") + " pinned into the tracked corners (" + keys.length + " frames)");
        return true;
      }
      var P0 = pic(D[0]), par = window.TlParent.parentOf(target), base = TlParent.world(target, T0), sm = [];
      var mid = function (P) { return P.length > 1 ? [(P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2] : P[0]; };
      var ang = function (P) { return Math.atan2(P[1][1] - P[0][1], P[1][0] - P[0][0]) * 180 / Math.PI; }, dist = function (P) { return Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]); };
      var m0 = mid(P0), a0 = T.mode === "scalerot" ? ang(P0) : 0, d0 = T.mode === "scalerot" ? Math.max(1e-6, dist(P0)) : 1, prevA = a0, turn = 0;
      D.forEach(function (d) {
        var tt = (c.start || 0) + d.at; if (!inT(tt)) return;
        var P = pic(d), m = mid(P), W = { x: base.x + m[0] - m0[0], y: base.y + m[1] - m0[1], scale: base.scale, rot: base.rot, ax: base.ax, ay: base.ay };
        if (T.mode === "scalerot") { var a = ang(P), da = a - prevA; while (da > 180) da -= 360; while (da < -180) da += 360; turn += da; prevA = a; W.scale = base.scale * dist(P) / d0; W.rot = base.rot + turn; }
        var L = par ? TlParent.localOf(TlParent.world(par, tt), W) : W;
        sm.push({ at: tt - (target.start || 0), x: L.x, y: L.y, scale: L.scale, rot: L.rot });
      });
      if (!sm.length) { say("🎯 the layer is not on the timeline while the track runs"); return false; }
      var props = T.mode === "scalerot" ? ["x", "y", "scale", "rot"] : ["x", "y"];
      var others = (target.kf || []).map(function (k) { var o = {}; Object.keys(k).forEach(function (p) { if (props.indexOf(p) < 0 && ["to", "ti", "rove"].indexOf(p) < 0) o[p] = k[p]; }); return o; }).filter(function (o) { return Object.keys(o).some(function (p) { return p !== "at" && p !== "ease" && p !== "bz"; }); });
      var nk = TlParent.keysOf(sm, { xy: 0.2, scale: 0.0005, rot: 0.05 }, Math.max(20, 390 - others.length)).map(function (k) { var o = { at: k.at }; props.forEach(function (p) { if (k[p] != null) o[p] = k[p]; }); return o; }).filter(function (o) { return Object.keys(o).length > 1; });
      // x and y always together (a position key)
      nk.forEach(function (k) { if (k.x != null || k.y != null) { var s2 = sm.reduce(function (b2, q) { return Math.abs(q.at - k.at) < Math.abs(b2.at - k.at) ? q : b2; }, sm[0]); k.x = Math.round(s2.x * 100) / 100; k.y = Math.round(s2.y * 100) / 100; } });
      target.kf = others.concat(nk).sort(function (a, b) { return a.at - b.at; });
      if (typeof tlSave === "function") tlSave(); C.keysChanged(target); if (typeof renderTimeline === "function") renderTimeline(); save(target, true);
      say("🎯 " + (tgt.L.name || "the layer") + " follows the track: " + nk.length + " key(s)" + (T.mode === "scalerot" ? " (position, scale, rotation)" : " (position)"));
      return true;
    }
    /* ---- ▢ corner-pin editing: drag the corners of the picked layer's pin */
    var PD = null;
    C.addTool({ id: "pinedit", icon: "▢", title: "Corner pin - drag the 4 corners of the picked layer (keyed when its pin has keys)", key: "", cursor: "crosshair",
      down: function (p) {
        var s = C.selClip(); if (!s || !s.c.pin) return; var q = quadAt(s.c.pin, C.state.t - (s.c.start || 0)); if (!q) return;
        var bi = -1, bd = 1e9; q.forEach(function (w, i) { var d = Math.hypot(w[0] - p.x, w[1] - p.y); if (d < bd) { bd = d; bi = i; } });
        PD = bd <= 30 / zoom() ? { c: s.c, i: bi, q: q.map(function (w) { return w.slice(); }) } : null;
      },
      move: function (p) {
        if (!PD) return; PD.q[PD.i] = [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100];
        var pin = PD.c.pin, at = Math.round((C.state.t - (PD.c.start || 0)) * FPS) / FPS;
        if (pin.keys.length <= 1) pin.keys = [{ at: 0, q: PD.q.map(function (w) { return w.slice(); }) }];
        else { var k = pin.keys.filter(function (x) { return Math.abs(x.at - at) < 0.5 / FPS; })[0]; if (k) k.q = PD.q.map(function (w) { return w.slice(); }); else { pin.keys.push({ at: at, q: PD.q.map(function (w) { return w.slice(); }) }); pin.keys.sort(function (a, b) { return a.at - b.at; }); } }
        C.mark();
      },
      up: function () { if (PD) save(PD.c, false); PD = null; } });
    C.onDraw(function (ctx, o) {
      var s = C.selClip(); if (!s || !s.c.pin || C.state.tool !== "pinedit") return;
      var q = quadAt(s.c.pin, C.state.t - (s.c.start || 0)); if (!q) return;
      var sq = q.map(function (w) { return o.toScreen(w[0], w[1]); });
      ctx.save(); ctx.strokeStyle = "#ff9f1a"; ctx.lineWidth = 1.5; ctx.beginPath(); sq.forEach(function (w, i) { if (i) ctx.lineTo(w.x, w.y); else ctx.moveTo(w.x, w.y); }); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = "#ff9f1a"; sq.forEach(function (w) { ctx.fillRect(w.x - 5, w.y - 5, 10, 10); }); ctx.restore();
    });

    /* ---- the Properties: 🎯 Track (video clips) + ▢ Corner pin (any layer) */
    C.onProps(function (Pn, c, s) {
      if (!c || !Pn || !s || !s.Ly || s.Ly.kind === "aud" || c.adjust) return;
      var d = document.createElement("div"), h = ""; d.className = "tlp-track";
      if (isVid(s)) {
        var T = c.trk, mode = T ? T.mode : "point";
        h += '<div class="tlp-t">🎯 Track</div><div class="tlp-row" style="flex-wrap:wrap"><select id="tlpTkMode">' + MODES.map(function (m) { return '<option value="' + m[0] + '"' + (mode === m[0] ? " selected" : "") + ">" + m[1] + "</option>"; }).join("") + "</select>"
          + '<button class="ghost" id="tlpTkPlace" title="The points on the picture at the playhead - drag them onto clear details">◎ Place</button>'
          + (T ? '<label style="white-space:nowrap" title="The patch looked for (of the picture\'s width)">size <input type="number" id="tlpTkBox" min="1" max="30" step="0.5" value="' + Math.round((T.box || 0.05) * 1000) / 10 + '" style="width:44px"> %</label>' : "")
          + (T ? '<button class="ghost" id="tlpTkRun"' + (T.busy ? " disabled" : "") + ' title="From the playhead to the clip\'s end">' + (T.busy ? "tracking…" : "▶ Track") + "</button>" : "") + "</div>";
        if (T && T.data && T.data.length) {
          var targets = all().filter(function (x) { return x.c !== c && !x.c.adjust && x.kind !== "v1"; });
          h += '<div class="tlp-row" style="flex-wrap:wrap"><span class="tlp-none">' + T.data.length + " frames tracked (" + esc(T.method || "") + ")" + (T.lost ? " · " + T.lost + " not found well" : "") + "</span>"
            + '<select id="tlpTkTgt"><option value="">Apply to…</option>' + targets.map(function (x) { return '<option value="' + esc(x.c.uid || (x.c.uid = "u" + Math.random().toString(36).slice(2, 10))) + '">' + esc((x.L.name || x.lk) + (x.c.nul ? " (null)" : "")) + "</option>"; }).join("") + '</select><button class="ghost" id="tlpTkApply">Apply</button></div>';
        }
      }
      if (s.Ly.kind !== "v1") {
        h += '<div class="tlp-row" style="flex-wrap:wrap"><label title="Draw the layer into 4 corners (a tracked screen, a sign…)"><input type="checkbox" id="tlpPinOn"' + (c.pin && c.pin.on !== false ? " checked" : "") + "> ▢ Corner pin</label>"
          + (c.pin ? '<button class="ghost" id="tlpPinEdit" title="Drag the corners on the canvas">✥ Edit corners</button><span class="tlp-none">' + (c.pin.keys || []).length + " key(s)</span>" : "") + "</div>";
      }
      if (!h) return;
      d.innerHTML = h; Pn.appendChild(d);
      var q = function (id) { return d.querySelector("#" + id); };
      if (q("tlpTkMode")) q("tlpTkMode").addEventListener("change", function () { var m = q("tlpTkMode").value; c.trk = { mode: m, pts: DEF_PTS[m].map(function (p) { return p.slice(); }), box: (c.trk && c.trk.box) || 0.05, data: null }; save(c, true); C.setTool("trackpts"); say("🎯 drag the point(s) onto clear details, then ▶ Track"); });
      if (q("tlpTkPlace")) q("tlpTkPlace").addEventListener("click", function () { if (!c.trk) { var m = q("tlpTkMode").value; c.trk = { mode: m, pts: DEF_PTS[m].map(function (p) { return p.slice(); }), box: 0.05, data: null }; } save(c, true); C.setTool("trackpts"); say("🎯 drag the point(s) onto clear details of the picture (the square = what is looked for), then ▶ Track"); });
      if (q("tlpTkBox")) q("tlpTkBox").addEventListener("input", function () { var v = +q("tlpTkBox").value; if (v > 0) { c.trk.box = Math.max(0.01, Math.min(0.3, v / 100)); C.mark(); } });
      if (q("tlpTkRun")) q("tlpTkRun").addEventListener("click", function () { run(s); });
      if (q("tlpTkApply")) q("tlpTkApply").addEventListener("click", function () { var u = q("tlpTkTgt").value, x = all().filter(function (y) { return y.c.uid === u; })[0]; if (!x) return say("🎯 pick the layer to apply it to"); apply(s, x.c); });
      if (q("tlpPinOn")) q("tlpPinOn").addEventListener("change", function () {
        if (q("tlpPinOn").checked) {
          if (c.pin) c.pin.on = true;
          else { var b = C.box(c, s.Ly.kind, C.state.t); if (!b) return; c.pin = { on: true, keys: [{ at: 0, q: [toPic(b, 0, 0), toPic(b, 1, 0), toPic(b, 1, 1), toPic(b, 0, 1)].map(function (p) { return [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]; }) }] }; }
          C.setTool("pinedit");
        } else if (c.pin) delete c.pin;
        save(c, true);
      });
      if (q("tlpPinEdit")) q("tlpPinEdit").addEventListener("click", function () { C.setTool("pinedit"); say("▢ drag the corners on the canvas"); });
    });
    /** the compile's corner keys for a pinned VIDEO layer clip (the frame W x H, a 2 px clear border) */
    function workerPin(c) { if (!c || !c.pin || c.pin.on === false) return undefined; var k = pinKeys(c.pin, C.state.W, C.state.H, Math.max(0.05, C.clipLen(c, "vl")), FPS, 2); return k.length ? k : undefined; }
    Object.assign(root.TlTrack, { ready: true, drawPin: drawPin, run: run, apply: apply, ptsAt: ptsAt, workerPin: workerPin });
  }
})(typeof window !== "undefined" ? window : globalThis);
