/* bitGen Studio — ext/timelinedock/tllottie.js (2.512.0): ⤓ LOTTIE (JSON) EXPORT of the timeline. window.TlLottie.
 *
 * Tim (verbatim): "lets do steps 1,2,3 , 4,5,6 and 7" - step 7: "Lottie (JSON) export".
 *
 *   📤 Export → ⤓ Lottie (JSON)   the picture and text layers as a Lottie animation (<project>_lottie.json beside the
 *                                 movies, listed to download): a layer that only moves / scales / turns / fades (its
 *                                 ◆ keys with their eases) stays a real animated layer (its picture inside); a layer
 *                                 the page draws itself (masks, effects, looks, generators, particles, warps, 3D,
 *                                 parents, expressions, a keyed text colour, entry / exit transitions ...) goes in as
 *                                 its frames (one image a frame, repeats shared). Video layers and the base video have
 *                                 no place in a Lottie: they are left out and named.
 * The file itself is made by the app (routes/lottie.js -> lib/lottie.js).
 * Pure (Node: scripts/test-lottie.js): native(c, L) - can this clip be a real Lottie layer (or why not).
 */
(function (root) {
  "use strict";
  /** null = a real animated layer; else why it goes in as frames */
  function native(c, L, X) {
    X = X || {};
    if (c.parent) return "parented"; if (c.expr && Object.keys(c.expr).length) return "expressions";
    if (Array.isArray(c.masks) && c.masks.length) return "masks"; if (c.gen) return "a generator"; if (c.shape) return "a shape layer";
    var on = function (k) { return c[k] && c[k].on !== false; };
    if (on("dist") || on("rays") || c.warp || on("d3") || c.tm || on("pin")) return "effects";
    if (c.fx && Object.keys(c.fx).length) return "a look / effects";
    if (c.text && Array.isArray(c.kf) && c.kf.some(function (k) { return k && k.color != null; })) return "a keyed text colour";
    if (X.textAnim) return "text animators";
    var tr = function (t) { return !!(t && typeof t === "object" && t.type && t.type !== "none"); };
    if (L && (tr(L.transitionIn) || tr(L.transitionOut))) return "an entry / exit transition";
    if (Array.isArray(c.kf) && c.kf.some(function (k) { return k && (k.to || k.ti); })) return "a curved motion path";
    return null;
  }
  var pure = { native: native };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  root.TlLottie = Object.assign({ ready: false }, pure);
  function ready() { try { return !!(window.TlCanvas && TlCanvas.drawClip && TlCanvas.box && window.H3Keyframes && typeof tl === "object" && tl); } catch (e) { return false; } }
  function boot() { if (ready()) install(); else setTimeout(boot, 300); }
  boot();
  function install() {
    if (root.TlLottie.ready) return;
    var C = window.TlCanvas, KF = window.H3Keyframes, FPS = KF.FPS || 24;
    var clipLen = function (c) { return C.clipLen ? C.clipLen(c, "img") : +c.len || 3; };
    /** the description the app turns into the Lottie (top layer first) */
    function describe(onProgress) {
      var W = C.state.W, H = C.state.H, out = [], skipped = [], dur = 0, jobs = [];
      (tl.vlayers || []).forEach(function (L) { if (L.visible !== false && (L.clips || []).length) skipped.push((L.name || "a video layer") + " (a video layer - Lottie has no video)"); });
      if ((tl.video || []).length) skipped.push("the base video (V1)");
      var imgs = (tl.images || []).map(function (L, i) { return { L: L, i: i }; }).reverse();       // the top layer first
      imgs.forEach(function (x) {
        var L = x.L; if (L.visible === false) return;
        if (typeof tlIsMatte === "function") { try { if (tlIsMatte(tl, L)) return; } catch (e) { /* fine */ } }
        if (L.matte) { skipped.push((L.name || "a layer") + " (a track matte - not in a Lottie yet)"); return; }
        (L.clips || []).forEach(function (c) {
          if (c.adjust || c.nul) return;
          var s0 = c.start || 0, len = clipLen(c); dur = Math.max(dur, s0 + len);
          var why = native(c, L, { textAnim: !!(c.text && window.TlTextAnim && TlTextAnim.live && TlTextAnim.live(c)) }), nm = L.name || (c.text ? "Text" : c.name);
          if (!why) {
            var b = C.box(c, "img", s0 + 1e-4), tf = C.tfAt(c, s0 + 1e-4); if (!b) { skipped.push(nm + " (its picture is not loaded)"); return; }
            var sc = tf.scale || 1, T = c.tf || {};
            out.push({ kind: "native", name: nm, file: c.name, baseW: b.w / sc, baseH: b.h / sc, natW: b.src && (b.src.naturalWidth || b.src.width), natH: b.src && (b.src.naturalHeight || b.src.height),
              start: s0, len: len, lop: L.opacity == null ? 1 : +L.opacity, op: c.opacity == null ? 1 : +c.opacity,
              tf: { x: +T.x || 0, y: +T.y || 0, scale: T.scale == null ? 1 : +T.scale, rot: +T.rot || 0, ax: +T.ax || 0, ay: +T.ay || 0 }, kf: c.kf || [], blend: L.blend || "normal" });
          } else {
            var o = { kind: "frames", name: nm + " (frames: " + why + ")", id: (c.uid || (c.uid = "u" + Math.random().toString(36).slice(2, 10))) + "_lt", start: s0, fps: FPS, frames: [], blend: L.blend || "normal" };
            out.push(o); jobs.push({ o: o, c: c, L: L, lk: "i:" + x.i, len: len });
          }
        });
      });
      var cv = document.createElement("canvas"); cv.width = W; cv.height = H; var g = cv.getContext("2d");
      var run = Promise.resolve(), done = 0, total = jobs.reduce(function (s, j) { return s + Math.max(1, Math.round(j.len * FPS)); }, 0);
      jobs.forEach(function (j) {
        run = run.then(function () {
          var n = Math.max(1, Math.round(j.len * FPS)), prev = null, k = 0, sent = 0;
          var step = function () {
            if (k >= n) return Promise.resolve();
            var t = (j.c.start || 0) + Math.min(j.len - 1e-4, k / FPS);
            g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; g.filter = "none"; g.clearRect(0, 0, W, H);
            try { C.drawClip(g, j.c, { L: j.L, kind: "img", lk: j.lk }, t); } catch (e) { /* an empty frame */ }
            var d = cv.toDataURL("image/png"), up = Promise.resolve();
            if (d === prev) j.o.frames.push(null);
            else {                                                 // a new picture: up to the app (/api/tlbake/frame), its number here
              var q = sent++; j.o.frames.push(q); prev = d;
              up = fetch(d).then(function (r) { return r.blob(); }).then(function (bl) { return fetch("/api/tlbake/frame?id=" + encodeURIComponent(j.o.id) + "&i=" + q, { method: "POST", headers: { "Content-Type": "image/png" }, body: bl }); })
                .then(function (r) { return r.json().then(function (x) { if (!r.ok) throw new Error(x.error || r.status); }); });
            }
            k++; done++;
            if (onProgress && done % 12 === 0) onProgress(done, total);
            return up.then(step);
          };
          return step();
        });
      });
      return run.then(function () { return { name: (typeof currentProject === "string" && currentProject) || "bitGen Studio", W: W, H: H, fps: FPS, dur: Math.max(1 / FPS, dur), layers: out, skipped: skipped }; });
    }
    /** describe -> the app makes <project>_lottie.json */
    function exportLottie(onProgress) {
      var flush = C.flushText ? Promise.resolve(C.flushText()) : Promise.resolve();
      return flush.then(function () { return describe(onProgress); }).then(function (d) {
        return fetch("/api/lottie/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) })
          .then(function (r) { return r.json().then(function (j) { if (!r.ok || j.ok === false) throw new Error(j.error || r.status); j.skipped = (d.skipped || []).concat(j.skipped || []); return j; }); });
      });
    }
    Object.assign(root.TlLottie, { ready: true, describe: describe, export: exportLottie });
  }
})(typeof window !== "undefined" ? window : globalThis);
