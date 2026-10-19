/* bitGen Studio — ext/timelinedock/tltime.js (2.500.0): ⏱ TIME on a timeline layer - MOTION BLUR, POSTERIZE TIME,
 * ECHO. window.TlTime.
 *
 * Tim (verbatim): "... and the rest of the After Effects gap list (expressions, Bézier masks, tracking and so on).." -
 * AFTER-EFFECTS-GAP.md: "Motion blur per layer (shutter angle / phase), frame blending per layer, time remapping on a
 * curve, Posterize Time, Echo".
 *
 *   ⏱ Time (a layer's Properties)
 *     Motion blur     the layer's MOVE blurred: its position / scale / turn sampled several times within the frame
 *                     (samples a frame), the last part of the frame (the shutter angle: 180° = half a frame) averaged
 *     Posterize Time  the layer held at <n> frames a second - its picture and its move (a jerky, stop-motion look)
 *     Echo            copies of the layer where it was a moment ago (how many, how far apart in seconds, the first
 *                     one's strength, how fast they fade) behind it - a motion trail. For a video the compile shows
 *                     those earlier frames too (the canvas draws the frame of now there)
 *   The compile      picture / text layers baked by the page; video layers by worker.py (the move sampled N times a
 *                    frame + tmix, setpts posterize, delayed copies overlaid)
 * Pure (Node: scripts/test-time.js): DEFAULTS, on, postT (a time held to the posterize grid), samples (the motion blur
 *   times), echoes (the echo copies' times + strengths), clean.
 */
(function (root) {
  "use strict";
  var FPS0 = 24;
  var DEFAULTS = { blur: false, shutter: 180, samples: 8, post: 0, echo: null };
  var ECHO = { n: 3, dt: 0.1, i0: 0.6, decay: 0.6 };
  var num = function (v, d, lo, hi) { var x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
  /** a layer's time settings made sane (or null when nothing is on) */
  function clean(tm) {
    if (!tm || typeof tm !== "object") return null;
    var o = { blur: !!tm.blur, shutter: num(tm.shutter, 180, 1, 720), samples: Math.round(num(tm.samples, 8, 2, 16)), post: num(tm.post, 0, 0, 60) };
    if (tm.echo && typeof tm.echo === "object") o.echo = { n: Math.round(num(tm.echo.n, 3, 1, 8)), dt: num(tm.echo.dt, 0.1, 1 / FPS0, 5), i0: num(tm.echo.i0, 0.6, 0, 1), decay: num(tm.echo.decay, 0.6, 0, 1) };
    return o.blur || o.post > 0 || o.echo ? o : null;
  }
  var on = function (c) { return !!(c && c.tm && clean(c.tm)); };
  /** t held to the posterize grid (from the clip's start) */
  function postT(c, t) {
    var tm = clean(c && c.tm); if (!tm || !(tm.post > 0)) return t;
    var s = (c.start || 0); return s + Math.floor((t - s) * tm.post + 1e-6) / tm.post;
  }
  /** the motion blur's sample times for the frame at t (the frame and the ones before it within the shutter) */
  function samples(c, t, fps) {
    var tm = clean(c && c.tm), f = fps || FPS0; if (!tm || !tm.blur) return [t];
    var N = tm.samples, R = f * N, K = Math.max(2, Math.min(N, Math.round(N * tm.shutter / 360))), out = [];
    for (var j = 0; j < K; j++) out.push(t - j / R);
    return out;
  }
  /** the echo copies: [{t, w}] farthest first, never before the clip's start */
  function echoes(c, t) {
    var tm = clean(c && c.tm); if (!tm || !tm.echo) return [];
    var e = tm.echo, out = [];
    for (var k = e.n; k >= 1; k--) { var te = t - k * e.dt; if (te < (c.start || 0) - 1e-9) continue; out.push({ t: te, w: e.i0 * Math.pow(e.decay, k - 1) }); }
    return out;
  }
  var pure = { DEFAULTS: DEFAULTS, ECHO: ECHO, clean: clean, on: on, postT: postT, samples: samples, echoes: echoes };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ---------------- the page ---------------- */
  root.TlTime = Object.assign({ ready: false }, pure);
  function ready() { try { return !!(window.TlCanvas && TlCanvas.onProps && TlCanvas.box && window.H3Keyframes && typeof tl === "object" && tl); } catch (e) { return false; } }
  function boot() { if (ready()) install(); else setTimeout(boot, 300); }
  boot();
  function install() {
    if (root.TlTime.ready) return;
    var C = window.TlCanvas, KF = window.H3Keyframes, FPS = KF.FPS || 24;
    function say(t) { try { C.say(t); } catch (e) { /* fine */ } }
    var OFF = {};
    function off(k) { var c = OFF[k] || (OFF[k] = document.createElement("canvas")); if (c.width !== C.state.W) c.width = C.state.W; if (c.height !== C.state.H) c.height = C.state.H; var g = c.getContext("2d"); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; g.clearRect(0, 0, c.width, c.height); return c; }
    function one(g, c, kind, tt, pic, alpha, op) {
      if (c.pin && c.pin.on !== false && window.TlTrack && TlTrack.drawPin) { g.save(); g.globalAlpha = alpha; g.globalCompositeOperation = op; TlTrack.drawPin(g, pic, c, tt); g.restore(); return; }
      var b = C.box(c, kind, tt); if (!b) return;
      g.save(); g.globalAlpha = alpha; g.globalCompositeOperation = op; g.translate(b.cx, b.cy); g.rotate(b.rot * Math.PI / 180);
      var ow = pic._ow || 1; try { g.drawImage(pic, -b.w * ow / 2, -b.h * ow / 2, b.w * ow, b.h * ow); } catch (e) { /* not decodable yet */ }   // 2.506.0: ☀ rays reach past the box
      g.restore();
    }
    /** the layer at t with its time effects, into tg (picture coordinates) at opacity a */
    function draw(tg, c, kind, t, pic, a) {
      var t0 = postT(c, t), L = off("L"), lg = L.getContext("2d");
      echoes(c, t0).forEach(function (e) { one(lg, c, kind, postT(c, e.t), pic, e.w, "source-over"); });
      var ts = samples(c, t0, FPS);
      if (ts.length > 1) {                                  // the premultiplied average of the samples ("lighter" adds them)
        var M = off("M"), mg = M.getContext("2d");
        ts.forEach(function (tt) { one(mg, c, kind, tt, pic, 1 / ts.length, "lighter"); });
        lg.drawImage(M, 0, 0);
      } else one(lg, c, kind, t0, pic, 1, "source-over");
      tg.save(); tg.globalAlpha = a; try { tg.drawImage(L, 0, 0); } catch (e) { /* fine */ } tg.restore();
      return true;
    }
    /* ---- ⏱ Time in the Properties */
    C.onProps(function (Pn, c, s) {
      if (!c || !Pn || !s || !s.Ly || s.Ly.kind === "v1" || s.Ly.kind === "aud" || c.adjust || c.nul) return;
      var tm = Object.assign({}, DEFAULTS, c.tm || {}), e = tm.echo, d = document.createElement("div"); d.className = "tlp-time";
      var n = function (id, v, step, w, title) { return '<input type="number" id="' + id + '" value="' + v + '" step="' + step + '" style="width:' + w + 'px"' + (title ? ' title="' + title + '"' : "") + ">"; };
      d.innerHTML = '<div class="tlp-t">⏱ Time</div>'
        + '<div class="tlp-row" style="flex-wrap:wrap"><label title="Blur the layer\'s move (its position / scale / turn within each frame)"><input type="checkbox" id="tlpTmBlur"' + (tm.blur ? " checked" : "") + "> Motion blur</label>"
        + (tm.blur ? "<label>shutter " + n("tlpTmSh", tm.shutter, 15, 50, "degrees: 180 = half a frame, 360 = the whole frame") + "°</label><label>samples " + n("tlpTmSa", tm.samples, 1, 40, "how many times a frame the move is drawn") + "</label>" : "") + "</div>"
        + '<div class="tlp-row" style="flex-wrap:wrap"><label title="Hold the layer at this many frames a second (0 = off)">Posterize time ' + n("tlpTmPo", tm.post || 0, 1, 44) + " fps</label></div>"
        + '<div class="tlp-row" style="flex-wrap:wrap"><label title="Copies of the layer where it was a moment ago, behind it"><input type="checkbox" id="tlpTmEc"' + (e ? " checked" : "") + "> Echo</label>"
        + (e ? "<label>copies " + n("tlpTmEn", e.n, 1, 36) + "</label><label>apart " + n("tlpTmEd", e.dt, 0.02, 48, "seconds between them") + " s</label><label>first " + n("tlpTmEi", Math.round(e.i0 * 100), 5, 44) + " %</label><label>fade " + n("tlpTmEf", Math.round(e.decay * 100), 5, 44, "each next copy keeps this much") + " %</label>" : "") + "</div>";
      Pn.appendChild(d);
      var save = function (repaint) { c.tm = clean(c.tm); if (!c.tm) delete c.tm; delete c.bakeSig; if (typeof tlSave === "function") tlSave(); C.mark(); if (repaint) C.paintProps(); };
      var q = function (id) { return d.querySelector("#" + id); };
      var setv = function (id, f) { var el = q(id); if (!el) return; el.addEventListener("keydown", function (ev) { ev.stopPropagation(); }); el.addEventListener("input", function () { var v = +el.value; if (!Number.isFinite(v)) return; c.tm = Object.assign({}, DEFAULTS, c.tm || {}); f(v); save(false); }); };
      q("tlpTmBlur").addEventListener("change", function () { c.tm = Object.assign({}, DEFAULTS, c.tm || {}, { blur: q("tlpTmBlur").checked }); save(true); if (q("tlpTmBlur").checked) say("⏱ motion blur: the layer's move is blurred (it needs to move - keys, a parent, an expression)"); });
      q("tlpTmEc").addEventListener("change", function () { c.tm = Object.assign({}, DEFAULTS, c.tm || {}); if (q("tlpTmEc").checked) c.tm.echo = Object.assign({}, ECHO); else delete c.tm.echo; save(true); });
      setv("tlpTmSh", function (v) { c.tm.shutter = v; }); setv("tlpTmSa", function (v) { c.tm.samples = v; }); setv("tlpTmPo", function (v) { c.tm.post = v; });
      setv("tlpTmEn", function (v) { c.tm.echo = Object.assign({}, ECHO, c.tm.echo, { n: v }); }); setv("tlpTmEd", function (v) { c.tm.echo = Object.assign({}, ECHO, c.tm.echo, { dt: v }); });
      setv("tlpTmEi", function (v) { c.tm.echo = Object.assign({}, ECHO, c.tm.echo, { i0: v / 100 }); }); setv("tlpTmEf", function (v) { c.tm.echo = Object.assign({}, ECHO, c.tm.echo, { decay: v / 100 }); });
    });
    Object.assign(root.TlTime, { ready: true, draw: draw });
  }
})(typeof window !== "undefined" ? window : globalThis);
