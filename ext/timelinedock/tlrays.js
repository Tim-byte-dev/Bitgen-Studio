/* bitGen Studio — ext/timelinedock/tlrays.js (2.506.0): ☀ LIGHT RAYS on a layer. window.TlRays.
 *
 * Tim (verbatim): "lets do steps 1,2,3 , 4,5,6 and 7" - step 1 includes "light rays" (AFTER-EFFECTS-GAP.md).
 *
 *   ☀ Light rays (a picture, text, shape, generator or video layer's Properties): the layer's BRIGHT parts streak away
 *     from a source point - its bright-pass zoomed out from that point in `samples` steps up to `length`, each fainter,
 *     added on top ("lighter"). The rays may reach past the layer's own edges: the picture it returns is larger
 *     (`_ow` = how many times the layer's box it covers - canvas.js draws it that much bigger, centred).
 *     source x / y      px from the layer's centre (its own pixels)       length %     how far the rays reach
 *     intensity %       how strong                                        threshold    0..255 - only brighter light
 *     tint, rays only (the layer itself hidden)
 *   Keyable (ry_<name>) and open to ƒx. The compile: picture layers baked by the page, video layers too (tlvbake.js).
 * Pure (Node: scripts/test-rays.js): DEFAULTS, clean, live, overscan(o), bright(rgba, threshold, tint) -> rgba,
 *   scales(o) -> [{s, a}] (the zoom of each sample and its strength).
 */
(function (root) {
  "use strict";
  var DEFAULTS = { on: true, x: 0, y: 0, length: 60, intensity: 120, threshold: 150, samples: 24, tint: "#ffffff", only: false };
  var NUMS = ["x", "y", "length", "intensity", "threshold"];
  var nm = function (v, d, lo, hi) { var x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
  function clean(o) {
    if (!o || typeof o !== "object") return null;
    return { on: o.on !== false, x: nm(o.x, 0, -1e5, 1e5), y: nm(o.y, 0, -1e5, 1e5), length: nm(o.length, 60, 0, 300),
      intensity: nm(o.intensity, 120, 0, 1000), threshold: Math.round(nm(o.threshold, 150, 0, 254)), samples: Math.round(nm(o.samples, 24, 4, 64)),
      tint: /^#[0-9a-f]{6}$/i.test(String(o.tint)) ? String(o.tint).toLowerCase() : "#ffffff", only: !!o.only };
  }
  var live = function (c) { var o = clean(c && c.rays); return !!(o && o.on && (o.intensity > 0 || o.only)); };
  /** how many times the layer's box the output covers (room for the rays) */
  var overscan = function (o) { return Math.min(2, 1 + (o.length / 100) * 0.6); };
  /** the bright-pass: only light above the threshold, rescaled to 0..255, tinted; alpha kept */
  function bright(src, th, tint) {
    var out = new Uint8ClampedArray(src.length), t = [parseInt(tint.slice(1, 3), 16) / 255, parseInt(tint.slice(3, 5), 16) / 255, parseInt(tint.slice(5, 7), 16) / 255], k = 255 / (255 - th);
    for (var i = 0; i < src.length; i += 4) {
      var a = src[i + 3] / 255, l = Math.max(src[i], src[i + 1], src[i + 2]) * a;
      if (l <= th) continue;
      var f = (l - th) * k / 255;
      out[i] = src[i] * f * t[0]; out[i + 1] = src[i + 1] * f * t[1]; out[i + 2] = src[i + 2] * f * t[2]; out[i + 3] = 255;
    }
    return out;
  }
  /** the samples: zoom s (1 .. 1 + length) and each one's strength (fading outwards, summing to intensity) */
  function scales(o) {
    var n = o.samples, out = [], tot = 0, i;
    for (i = 0; i < n; i++) tot += 1 - i / n;
    for (i = 0; i < n; i++) out.push({ s: 1 + (o.length / 100) * i / (n - 1), a: (o.intensity / 100) * (1 - i / n) / tot });
    return out;
  }
  var pure = { DEFAULTS: DEFAULTS, NUMS: NUMS, clean: clean, live: live, overscan: overscan, bright: bright, scales: scales };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ---------------- the page ---------------- */
  root.TlRays = Object.assign({ ready: false }, pure);
  function ready() { try { return !!(window.TlCanvas && TlCanvas.onProps && window.H3Keyframes && typeof tl === "object" && tl); } catch (e) { return false; } }
  function boot() { if (ready()) install(); else setTimeout(boot, 300); }
  boot();
  function install() {
    if (root.TlRays.ready) return;
    var C = window.TlCanvas, KF = window.H3Keyframes, FPS = KF.FPS || 24;
    function at(c, tau) {
      var o = clean(c.rays); if (!o) return null;
      NUMS.forEach(function (k) {
        if (c.kf && KF.has(c.kf, "ry_" + k)) o[k] = KF.value(c.kf, tau, "ry_" + k, o[k]);
        if (window.TlExpr && TlExpr.num && c.expr && c.expr["ry_" + k]) o[k] = TlExpr.num(c, "ry_" + k, tau, o[k]);
      });
      return clean(o);
    }
    /** the layer's picture with its rays (bigger by o's overscan: _ow) */
    function apply(pic, c, tau, draft) {
      var o = at(c, tau); if (!o || !o.on) return pic;
      var W = pic.naturalWidth || pic.videoWidth || pic.width, H = pic.naturalHeight || pic.videoHeight || pic.height;
      if (!W || !H) return pic;
      var ow = overscan(o), q = Math.min(1, (draft ? 320 : 640) / (W * ow));       // rays are soft: worked smaller
      var w = Math.max(2, Math.round(W * ow * q)), h = Math.max(2, Math.round(H * ow * q));
      var bp = document.createElement("canvas"); bp.width = w; bp.height = h; var bg = bp.getContext("2d");
      bg.drawImage(pic, (w - W * q) / 2, (h - H * q) / 2, W * q, H * q);
      var im = bg.getImageData(0, 0, w, h); im.data.set(bright(im.data, o.threshold, o.tint)); bg.putImageData(im, 0, 0);
      var ry = document.createElement("canvas"); ry.width = w; ry.height = h; var rg = ry.getContext("2d");
      var sx = w / 2 + o.x * q, sy = h / 2 + o.y * q;
      rg.globalCompositeOperation = "lighter";
      scales(o).forEach(function (S) { rg.globalAlpha = Math.min(1, S.a); rg.setTransform(S.s, 0, 0, S.s, sx - sx * S.s, sy - sy * S.s); rg.drawImage(bp, 0, 0); });
      var out = document.createElement("canvas"); out.width = Math.round(W * ow); out.height = Math.round(H * ow); var og = out.getContext("2d");
      if (!o.only) og.drawImage(pic, (out.width - W) / 2, (out.height - H) / 2, W, H);
      og.globalCompositeOperation = "lighter"; og.imageSmoothingQuality = "high"; og.drawImage(ry, 0, 0, out.width, out.height);
      out._ow = (pic._ow || 1) * out.width / W;          // 2.507.0: on top of a warp's own overscan
      return out;
    }
    C.onProps(function (Pn, c, sel) {
      if (!c || !Pn || !sel || !sel.Ly || sel.Ly.kind === "v1" || sel.Ly.kind === "aud" || c.adjust || c.nul) return;
      var o = clean(c.rays), tau = C.tauOf(c, sel.Ly.kind), d = document.createElement("div"); d.className = "tlp-rays";
      var LBL = { x: "source x", y: "source y", length: "length %", intensity: "intensity %", threshold: "threshold" };
      var nrow = function (k) { var keyed = KF.has(c.kf, "ry_" + k), v = Math.round((keyed ? KF.value(c.kf, tau, "ry_" + k, o[k]) : o[k]) * 100) / 100;
        return '<label style="white-space:nowrap">' + LBL[k] + ' <input type="number" data-ry="' + k + '" value="' + v + '" step="any" style="width:54px"></label><button class="ghost" data-ryk="' + k + '" title="Key it at the playhead" style="padding:0 3px">' + (keyed ? "◆" : "◇") + "</button>"; };
      d.innerHTML = '<div class="tlp-row"><label title="The layer\'s bright parts streak away from a point"><input type="checkbox" id="tlpRyOn"' + (o && o.on ? " checked" : "") + "> ☀ Light rays</label>"
        + (o && o.on ? '<label>tint <input type="color" id="tlpRyTint" value="' + o.tint + '"></label><label><input type="checkbox" id="tlpRyOnly"' + (o.only ? " checked" : "") + "> rays only</label></div>"
          + '<div class="tlp-row" style="flex-wrap:wrap">' + NUMS.map(nrow).join("") + "</div>" : "</div>");
      Pn.appendChild(d);
      var save = function (repaint) { delete c.bakeSig; delete c.vbakeSig; if (typeof tlSave === "function") tlSave(); C.mark(); if (repaint) C.paintProps(); };
      var q = function (id) { return d.querySelector("#" + id); };
      q("tlpRyOn").addEventListener("change", function () { if (q("tlpRyOn").checked) c.rays = clean(Object.assign({}, DEFAULTS, c.rays || {}, { on: true })); else if (c.rays) c.rays.on = false; save(true); });
      if (q("tlpRyTint")) q("tlpRyTint").addEventListener("input", function () { c.rays.tint = q("tlpRyTint").value; save(false); });
      if (q("tlpRyOnly")) q("tlpRyOnly").addEventListener("change", function () { c.rays.only = q("tlpRyOnly").checked; save(false); });
      d.querySelectorAll("[data-ry]").forEach(function (el) {
        el.addEventListener("keydown", function (ev) { ev.stopPropagation(); });
        el.addEventListener("input", function () { var k = el.getAttribute("data-ry"), v = +el.value; if (!Number.isFinite(v)) return;
          if (KF.has(c.kf, "ry_" + k)) { var kv = {}; kv["ry_" + k] = v; c.kf = KF.set(c.kf, C.tauOf(c, sel.Ly.kind), kv, FPS); } else c.rays[k] = v; save(false); });
      });
      d.querySelectorAll("[data-ryk]").forEach(function (el) {
        el.addEventListener("click", function () { var k = el.getAttribute("data-ryk"), kv = {}; kv["ry_" + k] = +(d.querySelector('[data-ry="' + k + '"]') || {}).value; c.kf = KF.set(c.kf, C.tauOf(c, sel.Ly.kind), kv, FPS); save(true); });
      });
    });
    if (window.TlVBake) TlVBake.register("rays", live);         // a video layer with rays is baked by the page
    Object.assign(root.TlRays, { ready: true, apply: apply, at: at });
  }
})(typeof window !== "undefined" ? window : globalThis);
