/* bitGen Studio — ext/timelinedock/tlmotion.js (2.509.0): ✍ MOTION SKETCH, ≈ THE WIGGLER and ⌇ THE SMOOTHER.
 * window.TlMotion.
 *
 * Tim (verbatim): "lets do steps 1,2,3 , 4,5,6 and 7" - step 3: "Motion sketch, the wiggler, the smoother".
 *
 *   ✍ Motion Sketch (Shift+K)  with a layer picked: press on the canvas and move - the timeline PLAYS from the
 *                              playhead (at the capture speed) and the layer follows the pointer (from where it was:
 *                              no jump); let go = done. The path is kept as x / y keys - thinned to the ones that
 *                              matter (within `smooth` px), the keys it passed over replaced.
 *   ≈ Wiggler (Properties)     random movement added to a property: per second (how often), amount (± units), noise
 *                              smooth (a flowing curve) or jagged (a new value each time), position x + y apart or
 *                              together, a seed. Between its first and last keys (the whole layer when it has fewer
 *                              than two); the keys there are replaced by the wiggled curve.
 *   ⌇ Smoother (Properties)    a property's keys between its first and last made calmer: averaged over ± frames, then
 *                              only the keys that matter within the tolerance kept (fewer keys, the same shape).
 * Every result is plain keys - the graph editor edits them, the compile plays them.
 * Pure (Node: scripts/test-motion.js): noise1(seed, x), rdp2(samples [[t, x, y]], tol), sketchKeys(samples, tol),
 *   wiggleKeys(base(t), t0, t1, o), smoothKeys(base(t), t0, t1, fps, frames, tol).
 */
(function (root) {
  "use strict";
  var hash = function (seed, k) { var h = ((seed | 0) * 374761393 + (k | 0) * 668265263) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; h = (h ^ (h >>> 16)) >>> 0; return h / 4294967296 * 2 - 1; };
  /** smooth 1-D noise -1..1 (values at the whole numbers, eased between) */
  function noise1(seed, x) { var i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(seed, i) + (hash(seed, i + 1) - hash(seed, i)) * u; }
  /** Ramer-Douglas-Peucker on a path in time: [[t, x, y]] kept within tol px of the straight-in-time line */
  function rdp2(P, tol) {
    if (P.length < 3) return P.slice();
    var keep = new Uint8Array(P.length); keep[0] = keep[P.length - 1] = 1; var st = [[0, P.length - 1]];
    while (st.length) {
      var r = st.pop(), a = r[0], b = r[1], md = -1, mi = -1;
      for (var i = a + 1; i < b; i++) {
        var f = (P[i][0] - P[a][0]) / Math.max(1e-12, P[b][0] - P[a][0]), dx = P[i][1] - (P[a][1] + (P[b][1] - P[a][1]) * f), dy = P[i][2] - (P[a][2] + (P[b][2] - P[a][2]) * f), d = Math.hypot(dx, dy);
        if (d > md) { md = d; mi = i; }
      }
      if (md > tol && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
    }
    return P.filter(function (_, i) { return keep[i]; });
  }
  /** a sketch's samples -> its keys (thinned within tol px, at most 400) */
  function sketchKeys(S, tol) { var t = Math.max(0.01, tol), out = rdp2(S, t); while (out.length > 400) { t *= 1.5; out = rdp2(S, t); } return out; }
  var r4 = function (v) { return Math.round(v * 10000) / 10000; };
  /** wiggled keys from t0 to t1: [[tau, v]] (o: {freq, amount, noise: smooth | jagged, seed}) - base(tau) the curve now */
  function wiggleKeys(base, t0, t1, o) {
    var f = Math.max(0.05, Math.min(60, +o.freq || 1)), A = +o.amount || 0, seed = Math.round(+o.seed || 1), smooth = o.noise !== "jagged";
    var step = 1 / (smooth ? f * 2 : f), out = [], n = Math.max(1, Math.round((t1 - t0) / step));
    for (var i = 0; i <= n; i++) {
      var t = t0 + (t1 - t0) * i / n, w = smooth ? noise1(seed, (t - t0) * f) : (i === 0 || i === n ? 0 : hash(seed, i));
      if (smooth && (i === 0 || i === n)) w = 0;
      out.push([t, r4(base(t) + A * w)]);
    }
    return out;
  }
  /** the curve from t0 to t1 averaged over ± frames, then thinned within tol: [[tau, v]] (the ends kept where they were) */
  function smoothKeys(base, t0, t1, fps, frames, tol) {
    var n = Math.max(2, Math.round((t1 - t0) * fps)), v = [], i, j;
    for (i = 0; i <= n; i++) v.push(base(t0 + (t1 - t0) * i / n));
    var k = Math.max(0, Math.round(frames)), s = v.map(function (_, ii) { if (ii === 0 || ii === n) return v[ii]; var a = 0, c = 0; for (j = Math.max(0, ii - k); j <= Math.min(n, ii + k); j++) { a += v[j]; c++; } return a / c; });
    var P = s.map(function (y, ii) { return [t0 + (t1 - t0) * ii / n, y, 0]; });
    return rdp2(P, Math.max(1e-6, +tol || 0)).map(function (p) { return [p[0], r4(p[1])]; });
  }
  var pure = { noise1: noise1, hash: hash, rdp2: rdp2, sketchKeys: sketchKeys, wiggleKeys: wiggleKeys, smoothKeys: smoothKeys };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ---------------- the page ---------------- */
  root.TlMotion = Object.assign({ ready: false }, pure);
  function ready() { try { return !!(window.TlCanvas && TlCanvas.addTool && TlCanvas.onProps && TlCanvas.keysChanged && window.H3Keyframes && typeof tl === "object" && tl); } catch (e) { return false; } }
  function boot() { if (ready()) install(); else setTimeout(boot, 300); }
  boot();
  function install() {
    if (root.TlMotion.ready) return;
    var C = window.TlCanvas, KF = window.H3Keyframes, FPS = KF.FPS || 24;
    function say(t) { try { C.say(t); } catch (e) { /* fine */ } }
    function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    var OPT = { speed: 100, smooth: 2, wprop: "pos", freq: 4, amount: 20, noise: "smooth", apart: true, seed: 1, sprop: "pos", tol: 1, frames: 3 };
    var sel = function () { var s = C.selClip(); return s && s.c && s.Ly && s.Ly.kind !== "aud" && !s.c.adjust ? s : null; };
    function statOf(c, p) {
      var tf = c.tf || {};
      if (p === "x" || p === "y" || p === "rot" || p === "ax" || p === "ay") return +tf[p] || 0;
      if (p === "scale") return tf.scale == null ? 1 : +tf.scale;
      if (p === "op") return c.opacity == null ? 1 : +c.opacity;
      var m = /^(gn|ry)_(.+)$/.exec(p); if (m) { var o = m[1] === "gn" ? c.gen : c.rays; return o && Number.isFinite(+o[m[2]]) ? +o[m[2]] : 0; }
      return 0;
    }
    var curve = function (c, p) { var st = statOf(c, p); return function (tau) { return KF.value(c.kf, tau, p, st); }; };
    /** drop p's keys from a to b (inclusive), keep the rest */
    function cut(kf, p, a, b) {
      return (kf || []).map(function (k) { if (k[p] == null || k.at < a - 0.5 / FPS || k.at > b + 0.5 / FPS) return k; var q = Object.assign({}, k); delete q[p]; return q; })
        .filter(function (k) { return Object.keys(k).some(function (q) { return !/^(at|ease|bz|to|ti)$/.test(q); }); });
    }
    function range(c, p, kind) {
      var ks = (c.kf || []).filter(function (k) { return k[p] != null; }).map(function (k) { return k.at; }).sort(function (a, b) { return a - b; });
      return ks.length >= 2 ? [ks[0], ks[ks.length - 1]] : [0, C.clipLen(c, kind)];
    }
    function done(c) { delete c.bakeSig; delete c.vbakeSig; C.keysChanged(c); }

    /* ---- ✍ the sketch */
    var SK = null;
    function frame() {
      if (!SK) return;
      var c = SK.c, now = performance.now(), t = SK.t0 + (now - SK.w0) / 1000 * SK.speed / 100, end = (c.start || 0) + C.clipLen(c, SK.kind);
      if (t >= end - 1e-6) t = end - 1e-6;
      var tau = t - (c.start || 0), x = Math.round((SK.p.x + SK.off[0]) * 100) / 100, y = Math.round((SK.p.y + SK.off[1]) * 100) / 100;
      var f = Math.round(tau * FPS);
      if (f > SK.lastF) {
        c.kf = cut(cut(c.kf, "x", (SK.lastF + 1) / FPS, f / FPS), "y", (SK.lastF + 1) / FPS, f / FPS);
        c.kf = KF.set(c.kf, f / FPS, { x: x, y: y }, FPS); SK.S.push([f / FPS, x, y]); SK.lastF = f;
      }
      try { if (typeof setPlayhead === "function") setPlayhead(t); C.state.t = t; } catch (e) { /* fine */ }
      C.mark();
      if (t >= end - 1e-6) { finish(); return; }
      SK.raf = requestAnimationFrame(frame);
    }
    function finish() {
      var s = SK; SK = null; if (!s) return;
      if (s.raf) cancelAnimationFrame(s.raf);
      if (s.S.length < 2) { done(s.c); return; }
      var a = s.S[0][0], b = s.S[s.S.length - 1][0], K = sketchKeys(s.S, s.smooth);
      var kf = cut(cut(s.c.kf, "x", a, b), "y", a, b);
      K.forEach(function (k) { kf = KF.set(kf, k[0], { x: k[1], y: k[2] }, FPS); });
      s.c.kf = kf;
      say("✍ sketched " + (b - a).toFixed(2) + " s - " + K.length + " position keys");
      done(s.c);
    }
    C.addTool({ id: "sketch", icon: "✍", title: "Motion Sketch - on the picked layer: press and move, the timeline plays and the layer follows the pointer; let go = done (position keys)", key: "shift+k", cursor: "crosshair",
      down: function (p) {
        var s = sel(); if (!s) { say("✍ Motion Sketch: pick a layer first (Move tool)"); return; }
        var c = s.c, tau0 = C.tauOf(c, s.Ly.kind);
        if (tau0 >= C.clipLen(c, s.Ly.kind) - 1 / FPS) { say("✍ the playhead is at the layer's end - move it back first"); return; }
        var x0 = KF.value(c.kf, tau0, "x", statOf(c, "x")), y0 = KF.value(c.kf, tau0, "y", statOf(c, "y"));
        SK = { c: c, kind: s.Ly.kind, t0: (c.start || 0) + tau0, w0: performance.now(), p: { x: p.x, y: p.y }, off: [x0 - p.x, y0 - p.y], speed: Math.max(10, Math.min(400, +OPT.speed || 100)),
          smooth: Math.max(0.01, +OPT.smooth || 0), S: [], lastF: Math.round(tau0 * FPS) - 1 };
        say("✍ sketching - move the pointer, let go to stop");
        frame();                                              // the first key now, where the layer is
      },
      move: function (p) { if (SK) { SK.p = { x: p.x, y: p.y }; } },
      up: function () { finish(); } });

    /* ---- ≈ wiggle / ⌇ smooth */
    var NAME = { pos: "position (x, y)", x: "x", y: "y", scale: "scale", rot: "turn °", op: "opacity" };
    function propsOf(c) {
      var out = ["pos", "x", "y", "scale", "rot", "op"], seen = {};
      (c.kf || []).forEach(function (k) { Object.keys(k).forEach(function (p) { if (/^(gn|ry)_/.test(p) && typeof k[p] === "number" && !seen[p]) { seen[p] = 1; out.push(p); } }); });
      return out;
    }
    function wiggle(c, kind, o) {
      var ps = o.prop === "pos" ? ["x", "y"] : [o.prop], R = range(c, ps[0], kind);
      if (o.prop === "pos") { var R2 = range(c, "y", kind); R = [Math.min(R[0], R2[0]), Math.max(R[1], R2[1])]; }
      var n = 0;
      ps.forEach(function (p, i) {
        var K = wiggleKeys(curve(c, p), R[0], R[1], { freq: o.freq, amount: o.amount, noise: o.noise, seed: (+o.seed || 1) + (o.prop === "pos" && o.apart ? i * 7919 : 0) });
        var kf = cut(c.kf, p, R[0], R[1]); K.forEach(function (k) { var kv = {}; kv[p] = k[1]; kf = KF.set(kf, k[0], kv, FPS); }); c.kf = kf; n += K.length;
      });
      done(c); return n;
    }
    function smooth(c, kind, o) {
      var ps = o.prop === "pos" ? ["x", "y"] : [o.prop], n = 0;
      ps.forEach(function (p) {
        var ks = (c.kf || []).filter(function (k) { return k[p] != null; }); if (ks.length < 3) return;
        var R = range(c, p, kind), K = smoothKeys(curve(c, p), R[0], R[1], FPS, o.frames, o.tol);
        var kf = cut(c.kf, p, R[0], R[1]); K.forEach(function (k) { var kv = {}; kv[p] = k[1]; kf = KF.set(kf, k[0], kv, FPS); }); c.kf = kf; n += K.length;
      });
      done(c); return n;
    }
    C.onProps(function (Pn, c, s) {
      if (!c || !Pn || !s || !s.Ly || s.Ly.kind === "aud" || c.adjust) return;
      var P = propsOf(c), d = document.createElement("div"); d.className = "tlp-motion";
      var opts = function (cur) { return P.map(function (p) { return '<option value="' + p + '"' + (p === cur ? " selected" : "") + ">" + esc(NAME[p] || p) + "</option>"; }).join(""); };
      var num = function (id, v, w, extra) { return '<input type="number" id="' + id + '" value="' + v + '" step="any" style="width:' + (w || 48) + 'px"' + (extra || "") + ">"; };
      d.innerHTML = '<div class="tlp-t">〰 Motion</div>'
        + '<div class="tlp-row" style="flex-wrap:wrap"><span>✍ Motion sketch</span><label title="100 = real time; lower = slower playback while you sketch">speed % ' + num("tlpMoSpd", OPT.speed) + '</label><label title="Keep only keys that change the path by more than this">smooth px ' + num("tlpMoSm", OPT.smooth, 40) + '</label><button class="ghost" id="tlpMoSketch" title="The ✍ tool (Shift+K): press on the canvas and move">✍ Sketch</button></div>'
        + '<div class="tlp-row" style="flex-wrap:wrap"><span>≈ Wiggler</span><select id="tlpMoWp">' + opts(OPT.wprop) + '</select><label>per s ' + num("tlpMoFq", OPT.freq, 40) + '</label><label>amount ' + num("tlpMoAm", OPT.amount, 48) + '</label>'
        + '<select id="tlpMoNz"><option value="smooth"' + (OPT.noise === "smooth" ? " selected" : "") + '>smooth</option><option value="jagged"' + (OPT.noise === "jagged" ? " selected" : "") + ">jagged</option></select>"
        + '<label title="Position: x and y wiggle on their own (off = together)"><input type="checkbox" id="tlpMoAp"' + (OPT.apart ? " checked" : "") + "> x, y apart</label><label>seed " + num("tlpMoSd", OPT.seed, 40) + '</label><button class="ghost" id="tlpMoWig">≈ Wiggle</button></div>'
        + '<div class="tlp-row" style="flex-wrap:wrap"><span>⌇ Smoother</span><select id="tlpMoSp">' + opts(OPT.sprop) + '</select><label title="Average over this many frames either side">frames ' + num("tlpMoFr", OPT.frames, 40) + '</label><label title="Keep only keys that change it by more than this">tolerance ' + num("tlpMoTl", OPT.tol, 44) + '</label><button class="ghost" id="tlpMoSmo">⌇ Smooth</button></div>';
      Pn.appendChild(d);
      var q = function (id) { return d.querySelector("#" + id); };
      d.querySelectorAll("input").forEach(function (el) { el.addEventListener("keydown", function (e) { e.stopPropagation(); }); });
      var grab = function () { OPT = { speed: +q("tlpMoSpd").value || 100, smooth: +q("tlpMoSm").value || 0, wprop: q("tlpMoWp").value, freq: +q("tlpMoFq").value || 1, amount: +q("tlpMoAm").value || 0,
        noise: q("tlpMoNz").value, apart: q("tlpMoAp").checked, seed: +q("tlpMoSd").value || 1, sprop: q("tlpMoSp").value, tol: +q("tlpMoTl").value || 0, frames: +q("tlpMoFr").value || 0 }; };
      d.querySelectorAll("input,select").forEach(function (el) { el.addEventListener("change", grab); });
      q("tlpMoSketch").addEventListener("click", function () { grab(); C.setTool("sketch"); say("✍ Motion Sketch: press on the canvas and move - the layer follows, the timeline plays"); });
      q("tlpMoWig").addEventListener("click", function () { grab(); var n = wiggle(c, s.Ly.kind, { prop: OPT.wprop, freq: OPT.freq, amount: OPT.amount, noise: OPT.noise, apart: OPT.apart, seed: OPT.seed }); say("≈ wiggled " + (NAME[OPT.wprop] || OPT.wprop) + " - " + n + " keys"); });
      q("tlpMoSmo").addEventListener("click", function () { grab(); var n = smooth(c, s.Ly.kind, { prop: OPT.sprop, frames: OPT.frames, tol: OPT.tol }); say(n ? "⌇ smoothed " + (NAME[OPT.sprop] || OPT.sprop) + " - " + n + " keys" : "⌇ the smoother needs 3 keys or more on it"); });
    });
    Object.assign(root.TlMotion, { ready: true, wiggle: wiggle, smooth: smooth, sketching: function () { return !!SK; } });
  }
})(typeof window !== "undefined" ? window : globalThis);
