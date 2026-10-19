/* bitGen Studio — ext/timelinedock/tldist.js (2.505.0): 〰 DISTORT a layer - TURBULENT DISPLACE and DISPLACEMENT MAP.
 * window.TlDist.
 *
 * Tim (verbatim): "... and the rest of the After Effects gap list (expressions, Bézier masks, tracking and so on).." -
 * AFTER-EFFECTS-GAP.md: "Generators / distortions: fractal noise, turbulent displace, displacement map, ...".
 *
 *   〰 Distort (a picture, text, shape or video layer's Properties)
 *     Turbulent displace  the layer's pixels pushed around by fractal noise (tlgen.js's noise): amount (px), size (px),
 *                         complexity, evolution speed °/s (it moves by itself), seed
 *     Displacement map    pushed by ANOTHER layer's picture (a fractal noise / gradient ramp / picture layer): its
 *                         brightness (or red = across, green = up and down) - mid grey moves nothing; max across / max
 *                         up-down (px)
 *   Every pixel moves a WHOLE number of pixels, at most 127 either way, the edges smeared - exactly what ffmpeg's
 *   displace filter does with an 8-bit map (128 = still), so the compile matches the canvas:
 *     picture / text / shape layers  baked by the page (TlParent.bakeAll)
 *     video layers                   the page bakes two grey MAP videos (across, up-down; lossless) the size of the video
 *                                    (TlDist.bakeMaps, chained onto TlParent.bakeAll); worker.py lays them on with
 *                                    displace (edge smear) before the clip's masks
 * Pure (Node: scripts/test-dist.js): DEFAULTS, clean, live, fieldTurb(o, w, h, tau) -> {dx, dy} (Int8 px), fieldMap(o,
 *   rgba, w, h) -> {dx, dy}, displace(src rgba, w, h, f) -> rgba, mapBytes(f) -> {x, y} (0..255, 128 = still).
 */
(function (root) {
  "use strict";
  var G = typeof module !== "undefined" && module.exports ? require("./tlgen.js") : root.TlGen;
  var DEFAULTS = {
    turb: { kind: "turb", amount: 24, size: 80, complexity: 2, evo: 0, evospeed: 60, seed: 3 },
    map: { kind: "map", src: "", mx: 30, my: 30, use: "lum" }
  };
  var nm = function (v, d, lo, hi) { var x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
  function clean(o) {
    if (!o || typeof o !== "object" || !DEFAULTS[o.kind]) return null;
    var D = DEFAULTS[o.kind];
    if (o.kind === "turb") return { kind: "turb", amount: nm(o.amount, D.amount, -127, 127), size: nm(o.size, D.size, 2, 5000), complexity: Math.round(nm(o.complexity, D.complexity, 1, 6)),
      evo: nm(o.evo, 0, -1e6, 1e6), evospeed: nm(o.evospeed, D.evospeed, -36000, 36000), seed: Math.round(nm(o.seed, D.seed, 0, 1e9)) };
    return { kind: "map", src: String(o.src || "").slice(0, 40), mx: nm(o.mx, D.mx, -127, 127), my: nm(o.my, D.my, -127, 127), use: o.use === "rg" ? "rg" : "lum" };
  }
  var live = function (c) { var o = clean(c && c.dist); return !!(o && (o.kind === "turb" ? o.amount !== 0 : o.src && (o.mx !== 0 || o.my !== 0))); };
  var STEP = 8;                                   // the noise is worked every 8 px and blended between
  var cl = function (v) { v = Math.round(v); return v > 127 ? 127 : v < -127 ? -127 : v; };
  /** turbulent displace: whole-pixel offsets for a w x h picture at tau */
  function fieldTurb(o, w, h, tau) {
    var P = G.perm(o.seed), z = (o.evo + o.evospeed * (tau || 0)) / 360, opt = { octaves: o.complexity, gain: 0.5, lac: 2, turb: "" };
    var gw = Math.ceil(w / STEP) + 1, gh = Math.ceil(h / STEP) + 1, gx = new Float32Array(gw * gh), gy = new Float32Array(gw * gh);
    for (var j = 0; j < gh; j++) for (var i = 0; i < gw; i++) {
      var x = i * STEP / o.size, y = j * STEP / o.size;
      gx[j * gw + i] = G.fbm(P, x, y, z, opt) * 1.4; gy[j * gw + i] = G.fbm(P, x + 31.7, y + 17.3, z + 3.1, opt) * 1.4;
    }
    var dx = new Int8Array(w * h), dy = new Int8Array(w * h);
    for (var yy = 0; yy < h; yy++) {
      var fy = yy / STEP, j0 = Math.floor(fy), ty = fy - j0;
      for (var xx = 0; xx < w; xx++) {
        var fx = xx / STEP, i0 = Math.floor(fx), tx = fx - i0, a = j0 * gw + i0;
        var bx = (gx[a] * (1 - tx) + gx[a + 1] * tx) * (1 - ty) + (gx[a + gw] * (1 - tx) + gx[a + gw + 1] * tx) * ty;
        var by = (gy[a] * (1 - tx) + gy[a + 1] * tx) * (1 - ty) + (gy[a + gw] * (1 - tx) + gy[a + gw + 1] * tx) * ty;
        dx[yy * w + xx] = cl(bx * o.amount); dy[yy * w + xx] = cl(by * o.amount);
      }
    }
    return { dx: dx, dy: dy, w: w, h: h };
  }
  /** displacement map: rgba (the map layer's picture at w x h) -> offsets; mid grey = still */
  function fieldMap(o, rgba, w, h) {
    var dx = new Int8Array(w * h), dy = new Int8Array(w * h);
    for (var i = 0, n = w * h; i < n; i++) {
      var r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
      var u = o.use === "rg" ? r : 0.299 * r + 0.587 * g + 0.114 * b, v = o.use === "rg" ? g : u;
      dx[i] = cl((u / 255 - 0.5) * 2 * o.mx); dy[i] = cl((v / 255 - 0.5) * 2 * o.my);
    }
    return { dx: dx, dy: dy, w: w, h: h };
  }
  /** each pixel taken from (x + dx, y + dy), the edges smeared (ffmpeg displace=edge=smear) */
  function displace(src, w, h, f) {
    var out = new Uint8ClampedArray(w * h * 4);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var k = y * w + x, sx = x + f.dx[k], sy = y + f.dy[k];
      sx = sx < 0 ? 0 : sx >= w ? w - 1 : sx; sy = sy < 0 ? 0 : sy >= h ? h - 1 : sy;
      var s = (sy * w + sx) * 4, d = k * 4;
      out[d] = src[s]; out[d + 1] = src[s + 1]; out[d + 2] = src[s + 2]; out[d + 3] = src[s + 3];
    }
    return out;
  }
  /** the 8-bit maps the compile reads: 128 + offset */
  function mapBytes(f) {
    var n = f.w * f.h, x = new Uint8ClampedArray(n), y = new Uint8ClampedArray(n);
    for (var i = 0; i < n; i++) { x[i] = 128 + f.dx[i]; y[i] = 128 + f.dy[i]; }
    return { x: x, y: y };
  }
  var pure = { DEFAULTS: DEFAULTS, STEP: STEP, clean: clean, live: live, fieldTurb: fieldTurb, fieldMap: fieldMap, displace: displace, mapBytes: mapBytes };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ---------------- the page ---------------- */
  root.TlDist = Object.assign({ ready: false }, pure);
  function ready() { try { return !!(window.TlCanvas && TlCanvas.onProps && window.TlGen && TlGen.ready && window.TlParent && TlParent.bakeAll && window.H3Keyframes && typeof tl === "object" && tl); } catch (e) { return false; } }
  function boot() { if (ready()) install(); else setTimeout(boot, 300); }
  boot();
  function install() {
    if (root.TlDist.ready) return;
    var C = window.TlCanvas, KF = window.H3Keyframes, FPS = KF.FPS || 24;
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]; }); };
    function say(t) { try { C.say(t); } catch (e) { /* fine */ } }
    var NUMS = { turb: ["amount", "size", "complexity", "evospeed"], map: ["mx", "my"] };
    /** the settings at tau: keys ds_<name> + expressions */
    function at(c, tau) {
      var o = clean(c.dist); if (!o) return null;
      (NUMS[o.kind] || []).forEach(function (k) {
        if (c.kf && KF.has(c.kf, "ds_" + k)) o[k] = KF.value(c.kf, tau, "ds_" + k, o[k]);
        if (window.TlExpr && TlExpr.num && c.expr && c.expr["ds_" + k]) o[k] = TlExpr.num(c, "ds_" + k, tau, o[k]);
      });
      return clean(o);
    }
    function byUid(u) { var r = null; (TlParent.all ? TlParent.all() : []).forEach(function (x) { if (x.c.uid === u) r = x; }); return r; }
    /** the map layer's picture at absolute time t, drawn at w x h -> rgba (null when it has none to give) */
    function mapPixels(o, t, w, h) {
      var x = byUid(o.src); if (!x || x.kind !== "img") return null;
      var tau = Math.max(0, t - (x.c.start || 0)), src = null;
      if (x.c.gen && window.TlGen) src = TlGen.picture(x.c, tau);
      else { var b = C.box(x.c, "img", t); src = b && b.src; }
      if (!src) return null;
      var cv = document.createElement("canvas"); cv.width = w; cv.height = h; var g = cv.getContext("2d");
      g.fillStyle = "#808080"; g.fillRect(0, 0, w, h);
      try { g.drawImage(src, 0, 0, w, h); } catch (e) { return null; }
      return g.getImageData(0, 0, w, h).data;
    }
    function field(c, o, tau, w, h) {
      if (o.kind === "turb") {
        if (draftScale !== 1) { var oo = Object.assign({}, o, { amount: o.amount * draftScale, size: o.size * draftScale }); return fieldTurb(oo, w, h, tau); }
        return fieldTurb(o, w, h, tau);
      }
      var px = mapPixels(o, (c.start || 0) + tau, w, h); if (!px) return null;
      return fieldMap(draftScale !== 1 ? Object.assign({}, o, { mx: o.mx * draftScale, my: o.my * draftScale }) : o, px, w, h);
    }
    var draftScale = 1, work = document.createElement("canvas");
    /** the layer's picture distorted at tau (draft: worked on at most 640 px wide while playing) */
    function apply(pic, c, tau, draft) {
      var o = at(c, tau); if (!o || !live(c)) return pic;
      var W = pic.naturalWidth || pic.videoWidth || pic.width, H = pic.naturalHeight || pic.videoHeight || pic.height;
      if (!W || !H) return pic;
      draftScale = draft && W > 640 ? 640 / W : 1;
      var w = Math.max(1, Math.round(W * draftScale)), h = Math.max(1, Math.round(H * draftScale));
      var f = field(c, o, tau, w, h); draftScale = 1; if (!f) return pic;
      var cv = document.createElement("canvas"); cv.width = w; cv.height = h; var g = cv.getContext("2d");
      try { g.drawImage(pic, 0, 0, w, h); } catch (e) { return pic; }
      var im = g.getImageData(0, 0, w, h); im.data.set(displace(im.data, w, h, f)); g.putImageData(im, 0, 0);
      return cv;
    }
    /* ---- the compile: a video layer's two map videos (lossless, the video's own size) */
    function sigOf(c) { return JSON.stringify([c.dist, (c.kf || []).filter(function (k) { return Object.keys(k).some(function (p) { return /^ds_/.test(p); }); }), c.len, c.in, c.out,
      c.dist && c.dist.kind === "map" ? ((byUid(c.dist.src) || {}).c || {}).gen || null : null]); }
    function bakeMaps(x) {
      var c = x.c, v = C.box(c, "vl", c.start || 0), vid = v && v.src, W = vid && vid.videoWidth, H = vid && vid.videoHeight;
      if (!W || !H) return Promise.reject(new Error("the video's size is not known yet - play it once"));
      var len = Math.max(0.05, C.clipLen(c, "vl")), n = Math.max(1, Math.round(len * FPS)), id = (c.uid || "x") + "_dm";
      var cv = document.createElement("canvas"); cv.width = W; cv.height = H; var g = cv.getContext("2d"), im = g.createImageData(W, H);
      var put = function (bytes) { var d = im.data; for (var i = 0, k = 0; i < bytes.length; i++, k += 4) { d[k] = d[k + 1] = d[k + 2] = bytes[i]; d[k + 3] = 255; } g.putImageData(im, 0, 0); return new Promise(function (ok) { cv.toBlob(ok, "image/png"); }); };
      var post = function (axis, i, blob) { return fetch("/api/tlbake/frame?id=" + encodeURIComponent(id + axis) + "&i=" + i, { method: "POST", headers: { "Content-Type": "image/png" }, body: blob }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); }); }); };
      var i = 0;
      var step = function () {
        if (i >= n) return Promise.resolve(); var k = i++, tau = Math.min(len - 1e-4, k / FPS), o = at(c, tau);
        var f = o && field(c, o, tau, W, H); if (!f) return Promise.reject(new Error("the displacement map's layer has no picture (pick a picture / generator layer)"));
        var m = mapBytes(f);
        return put(m.x).then(function (b) { return post("x", k, b); }).then(function () { return put(m.y); }).then(function (b) { return post("y", k, b); })
          .then(function () { if (k % 12 === 0) say("〰 distortion maps " + k + " / " + n); return step(); });
      };
      var enc = function (axis) { return fetch("/api/tlbake/encode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id + axis, fps: FPS, frames: n, lossless: true }) }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j.name; }); }); };
      return step().then(function () { return enc("x"); }).then(function (nx) { return enc("y").then(function (ny) { c.dbake = { x: nx, y: ny }; c.dbakeSig = sigOf(c); if (typeof tlSave === "function") tlSave(); }); });
    }
    function bakeAllMaps() {
      // 2.506.0: a video layer the page bakes whole (tlvbake.js) needs no maps
      var run = Promise.resolve(), todo = (TlParent.all ? TlParent.all() : []).filter(function (x) { return x.kind === "vl" && live(x.c) && x.L.visible !== false && !(window.TlVBake && TlVBake.needs(x.c)); });
      (TlParent.all ? TlParent.all() : []).forEach(function (x) { if (x.kind === "vl" && !live(x.c) && x.c.dbake) { delete x.c.dbake; delete x.c.dbakeSig; } });
      todo.forEach(function (x) { if (x.c.dbake && x.c.dbakeSig === sigOf(x.c)) return; run = run.then(function () { say("〰 baking " + (x.L.name || "a video layer") + "'s distortion maps…"); return bakeMaps(x); }); });
      return run;
    }
    var prevBake = TlParent.bakeAll;
    TlParent.bakeAll = function () { return Promise.resolve(prevBake.apply(this, arguments)).then(bakeAllMaps); };
    /* ---- 〰 Distort in the Properties */
    var LABEL = { amount: "amount px", size: "size px", complexity: "complexity", evospeed: "evolution °/s", mx: "max across px", my: "max up-down px" };
    C.onProps(function (Pn, c, sel) {
      if (!c || !Pn || !sel || !sel.Ly || sel.Ly.kind === "v1" || sel.Ly.kind === "aud" || c.adjust || c.nul) return;
      var o = clean(c.dist), kind = o ? o.kind : "off", tau = C.tauOf(c, sel.Ly.kind), d = document.createElement("div"); d.className = "tlp-dist";
      var nrow = function (k) { var keyed = KF.has(c.kf, "ds_" + k), v = Math.round((keyed ? KF.value(c.kf, tau, "ds_" + k, o[k]) : o[k]) * 1000) / 1000;
        return '<label style="white-space:nowrap">' + esc(LABEL[k]) + ' <input type="number" data-ds="' + k + '" value="' + v + '" step="any" style="width:54px"></label><button class="ghost" data-dsk="' + k + '" title="Key it at the playhead" style="padding:0 3px">' + (keyed ? "◆" : "◇") + "</button>"; };
      var maps = (TlParent.all ? TlParent.all() : []).filter(function (x) { return x.kind === "img" && x.c !== c && !x.c.nul && !x.c.adjust; });
      var h = '<div class="tlp-t">〰 Distort</div><div class="tlp-row" style="flex-wrap:wrap"><select id="tlpDsKind"><option value="off">off</option><option value="turb"' + (kind === "turb" ? " selected" : "") + '>Turbulent displace</option><option value="map"' + (kind === "map" ? " selected" : "") + ">Displacement map</option></select>";
      if (kind === "turb") h += '<label>seed <input type="number" id="tlpDsSeed" value="' + o.seed + '" style="width:54px"></label></div><div class="tlp-row" style="flex-wrap:wrap">' + NUMS.turb.map(nrow).join("") + "</div>";
      else if (kind === "map") h += '<label>map <select id="tlpDsSrc"><option value="">— a layer —</option>' + maps.map(function (x) { var u = x.c.uid || (x.c.uid = "u" + Math.random().toString(36).slice(2, 10)); return '<option value="' + esc(u) + '"' + (o.src === u ? " selected" : "") + ">" + esc(x.L.name || x.c.name || "layer") + "</option>"; }).join("") + "</select></label>"
        + '<label>use <select id="tlpDsUse"><option value="lum"' + (o.use === "lum" ? " selected" : "") + '>brightness</option><option value="rg"' + (o.use === "rg" ? " selected" : "") + ">red ↔ / green ↕</option></select></label></div>"
        + '<div class="tlp-row" style="flex-wrap:wrap">' + NUMS.map.map(nrow).join("") + "</div>";
      else h += "</div>";
      d.innerHTML = h; Pn.appendChild(d);
      var save = function (repaint) { if (c.dist) c.dist = clean(c.dist); if (!c.dist) delete c.dist; delete c.bakeSig; delete c.dbakeSig; if (typeof tlSave === "function") tlSave(); C.mark(); if (repaint) C.paintProps(); };
      var q = function (id) { return d.querySelector("#" + id); };
      q("tlpDsKind").addEventListener("change", function () { var k = q("tlpDsKind").value; if (k === "off") delete c.dist; else if (!c.dist || c.dist.kind !== k) c.dist = clean(Object.assign({}, DEFAULTS[k])); save(true); if (k === "map" && !maps.length) say("〰 Displacement map: add a picture, fractal noise (🌫) or gradient ramp layer to take the map from"); });
      if (q("tlpDsSeed")) { q("tlpDsSeed").addEventListener("keydown", function (ev) { ev.stopPropagation(); }); q("tlpDsSeed").addEventListener("input", function () { c.dist.seed = +q("tlpDsSeed").value; save(false); }); }
      if (q("tlpDsSrc")) q("tlpDsSrc").addEventListener("change", function () { c.dist.src = q("tlpDsSrc").value; save(false); });
      if (q("tlpDsUse")) q("tlpDsUse").addEventListener("change", function () { c.dist.use = q("tlpDsUse").value; save(false); });
      d.querySelectorAll("[data-ds]").forEach(function (el) {
        el.addEventListener("keydown", function (ev) { ev.stopPropagation(); });
        el.addEventListener("input", function () {
          var k = el.getAttribute("data-ds"), v = +el.value; if (!Number.isFinite(v)) return;
          if (KF.has(c.kf, "ds_" + k)) { var kv = {}; kv["ds_" + k] = v; c.kf = KF.set(c.kf, C.tauOf(c, sel.Ly.kind), kv, FPS); } else c.dist[k] = v;
          save(false);
        });
      });
      d.querySelectorAll("[data-dsk]").forEach(function (el) {
        el.addEventListener("click", function () { var k = el.getAttribute("data-dsk"), kv = {}; kv["ds_" + k] = +(d.querySelector('[data-ds="' + k + '"]') || {}).value; c.kf = KF.set(c.kf, C.tauOf(c, sel.Ly.kind), kv, FPS); save(true); });
      });
    });
    Object.assign(root.TlDist, { ready: true, apply: apply, at: at, bakeMaps: bakeMaps, bakeAllMaps: bakeAllMaps, sigOf: sigOf });
  }
})(typeof window !== "undefined" ? window : globalThis);
