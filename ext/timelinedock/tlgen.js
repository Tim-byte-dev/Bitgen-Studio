/* bitGen Studio — ext/timelinedock/tlgen.js (2.505.0): 🌫 GENERATOR LAYERS - FRACTAL NOISE and GRADIENT RAMP.
 * window.TlGen.
 *
 * Tim (verbatim): "... and the rest of the After Effects gap list (expressions, Bézier masks, tracking and so on).." -
 * AFTER-EFFECTS-GAP.md: "Generators / distortions: fractal noise, turbulent displace, displacement map, ... gradient
 * ramps".
 *
 *   🌫 the Generator tool (canvas toolbox): click = a FRACTAL NOISE layer over the whole frame; drag = a GRADIENT RAMP
 *      from where you press to where you let go
 *   🌫 Generator (the layer's Properties): the kind and its settings, every number keyable (◇) and open to ƒx
 *      Fractal noise  basic / turbulent smooth / turbulent sharp; contrast, brightness, invert; scale (px), complexity
 *                     (octaves), sub influence %, sub scaling; evolution ° + evolution speed °/s (it moves by itself),
 *                     offset x / y + drift px/s; seed; two colours (dark -> light); detail (the picture is worked at
 *                     1/4 or 1/2 of the frame and drawn smooth - noise has no fine detail to lose)
 *      Gradient ramp  linear / radial, start and end point (frame px from the centre), start and end colour
 *   The compile      the layer is baked by the page frame by frame (TlParent.bakeAll) - what you see is what compiles.
 *   The noise        improved Perlin noise in 3D (x, y, evolution), its permutation from the seed; fbm() sums the
 *                    octaves. tldist.js's turbulent displace uses the same noise.
 * Pure (Node: scripts/test-gen.js): DEFAULTS, clean, perm(seed), noise3(P, x, y, z), fbm(P, x, y, z, o), value(o, x, y,
 * tau) (one pixel of fractal noise, 0..1), params(c, tau, KF, X), rampAt(o, x, y) (0..1 along the ramp).
 */
(function (root) {
  "use strict";
  var DEFAULTS = {
    fractal: { kind: "fractal", ftype: "basic", contrast: 100, bright: 0, invert: false, scale: 120, complexity: 6, subinf: 70,
      subscale: 2, evo: 0, evospeed: 90, ox: 0, oy: 0, dx: 0, dy: 0, seed: 1, c0: "#000000", c1: "#ffffff", detail: 0.25 },
    ramp: { kind: "ramp", shape: "linear", x0: -320, y0: 0, x1: 320, y1: 0, c0: "#000000", c1: "#ffffff" }
  };
  var NUMS = { fractal: ["contrast", "bright", "scale", "complexity", "subinf", "subscale", "evo", "evospeed", "ox", "oy", "dx", "dy"], ramp: ["x0", "y0", "x1", "y1"] };
  var nm = function (v, d, lo, hi) { var x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
  var hex = function (v, d) { return /^#[0-9a-f]{6}$/i.test(String(v)) ? String(v).toLowerCase() : d; };
  /** a generator's settings made sane (null = not a generator) */
  // 2.506.0: ✨ particles live in tlparticles.js (loaded before this file; required in Node)
  function PT() { return typeof module !== "undefined" && module.exports ? require("./tlparticles.js") : root.TlParticles; }
  // 2.508.0: 🌫 waveform / spectrum live in tlaudio.js (loaded before this file; required in Node)
  function AU() { return typeof module !== "undefined" && module.exports ? require("./tlaudio.js") : root.TlAudio; }
  var isAud = function (k) { return k === "wave" || k === "spectrum"; };
  function clean(g) {
    if (g && g.kind === "particles") return PT() ? PT().clean(g) : null;
    if (g && isAud(g.kind)) return AU() ? AU().clean(g) : null;
    if (!g || typeof g !== "object" || !DEFAULTS[g.kind]) return null;
    var D = DEFAULTS[g.kind], o = { kind: g.kind };
    if (g.kind === "fractal") {
      o.ftype = ["basic", "turbulent smooth", "turbulent sharp"].indexOf(g.ftype) >= 0 ? g.ftype : "basic";
      o.contrast = nm(g.contrast, D.contrast, 0, 1000); o.bright = nm(g.bright, 0, -200, 200); o.invert = !!g.invert;
      o.scale = nm(g.scale, D.scale, 4, 10000); o.complexity = Math.round(nm(g.complexity, D.complexity, 1, 10));
      o.subinf = nm(g.subinf, D.subinf, 0, 100); o.subscale = nm(g.subscale, D.subscale, 1.1, 10);
      o.evo = nm(g.evo, 0, -1e6, 1e6); o.evospeed = nm(g.evospeed, D.evospeed, -36000, 36000);
      o.ox = nm(g.ox, 0, -1e6, 1e6); o.oy = nm(g.oy, 0, -1e6, 1e6); o.dx = nm(g.dx, 0, -1e5, 1e5); o.dy = nm(g.dy, 0, -1e5, 1e5);
      o.seed = Math.round(nm(g.seed, 1, 0, 1e9)); o.c0 = hex(g.c0, D.c0); o.c1 = hex(g.c1, D.c1);
      o.detail = g.detail === 0.5 || g.detail === "0.5" ? 0.5 : 0.25;
    } else {
      o.shape = g.shape === "radial" ? "radial" : "linear";
      ["x0", "y0", "x1", "y1"].forEach(function (k) { o[k] = nm(g[k], D[k], -1e5, 1e5); });
      o.c0 = hex(g.c0, D.c0); o.c1 = hex(g.c1, D.c1);
    }
    return o;
  }
  /* ---- improved Perlin noise (Ken Perlin 2002), the permutation shuffled from the seed */
  var PCACHE = {};
  function perm(seed) {
    var s = (Math.abs(Math.round(seed)) % 2147483646) + 1, key = s;
    if (PCACHE[key]) return PCACHE[key];
    var p = [], i;
    for (i = 0; i < 256; i++) p[i] = i;
    for (i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; var j = s % (i + 1), t = p[i]; p[i] = p[j]; p[j] = t; }
    var P = new Uint8Array(512); for (i = 0; i < 512; i++) P[i] = p[i & 255];
    var keys = Object.keys(PCACHE); if (keys.length > 16) delete PCACHE[keys[0]];
    return (PCACHE[key] = P);
  }
  var fade = function (t) { return t * t * t * (t * (t * 6 - 15) + 10); };
  var lerp = function (a, b, t) { return a + t * (b - a); };
  function grad(h, x, y, z) { h &= 15; var u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z); return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); }
  /** 3D noise, about -1..1 */
  function noise3(P, x, y, z) {
    var X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    var u = fade(x), v = fade(y), w = fade(z);
    var A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z, B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
    return lerp(lerp(lerp(grad(P[AA], x, y, z), grad(P[BA], x - 1, y, z), u), lerp(grad(P[AB], x, y - 1, z), grad(P[BB], x - 1, y - 1, z), u), v),
      lerp(lerp(grad(P[AA + 1], x, y, z - 1), grad(P[BA + 1], x - 1, y, z - 1), u), lerp(grad(P[AB + 1], x, y - 1, z - 1), grad(P[BB + 1], x - 1, y - 1, z - 1), u), v), w);
  }
  /** fractal sum: o = {octaves, gain (0..1), lac (>1), turb ("smooth" | "sharp" | "")} -> basic -1..1, turbulent 0..1 */
  function fbm(P, x, y, z, o) {
    var sum = 0, amp = 1, norm = 0, f = 1, n = o.octaves || 1;
    for (var i = 0; i < n; i++) {
      var v = noise3(P, x * f + i * 17.13, y * f + i * 31.7, z + i * 7.31);
      if (o.turb === "sharp") v = Math.abs(v);
      else if (o.turb === "smooth") v = v * v;
      sum += v * amp; norm += amp; amp *= o.gain; f *= o.lac;
    }
    return sum / (norm || 1);
  }
  /** one pixel of fractal noise (frame px from the top left) at tau: 0..1 */
  function value(o, x, y, tau, P) {
    P = P || perm(o.seed);
    var t = tau || 0, sc = o.scale;
    var px = (x + o.ox + o.dx * t) / sc, py = (y + o.oy + o.dy * t) / sc, z = (o.evo + o.evospeed * t) / 360;
    var turb = o.ftype === "turbulent sharp" ? "sharp" : o.ftype === "turbulent smooth" ? "smooth" : "";
    var v = fbm(P, px, py, z, { octaves: o.complexity, gain: o.subinf / 100, lac: o.subscale, turb: turb });
    v = turb === "smooth" ? v * 4 : turb ? v * 1.6 : v * 0.75 + 0.5;     // into about 0..1 (mean about 0.5 / 0.35 / 0.45)
    v = (v - 0.5) * (o.contrast / 100) + 0.5 + o.bright / 100;
    v = v < 0 ? 0 : v > 1 ? 1 : v;
    return o.invert ? 1 - v : v;
  }
  /** a ramp's position (0..1) at frame px (x, y from the centre) */
  function rampAt(o, x, y) {
    var dx = o.x1 - o.x0, dy = o.y1 - o.y0, L2 = dx * dx + dy * dy;
    if (o.shape === "radial") { var r = Math.sqrt(L2) || 1; return Math.max(0, Math.min(1, Math.hypot(x - o.x0, y - o.y0) / r)); }
    if (!L2) return 0;
    return Math.max(0, Math.min(1, ((x - o.x0) * dx + (y - o.y0) * dy) / L2));
  }
  /** the generator's settings at tau: its keys (gn_<name>) and expressions applied (KF = H3Keyframes, X = TlExpr) */
  function params(c, tau, KF, X) {
    var o = clean(c && c.gen); if (!o) return null;
    (o.kind === "particles" ? PT().NUMS : isAud(o.kind) ? AU().NUMS[o.kind] : NUMS[o.kind] || []).forEach(function (k) {
      var v = o[k];
      if (KF && c.kf && KF.has(c.kf, "gn_" + k)) v = KF.value(c.kf, tau, "gn_" + k, v);
      if (X && X.num && c.expr && c.expr["gn_" + k]) v = X.num(c, "gn_" + k, tau, v);
      o[k] = v;
    });
    return clean(o);
  }
  var live = function (c) { return !!(c && c.gen && clean(c.gen)); };
  var pure = { DEFAULTS: DEFAULTS, NUMS: NUMS, clean: clean, perm: perm, noise3: noise3, fbm: fbm, value: value, rampAt: rampAt, params: params, live: live };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ---------------- the page ---------------- */
  root.TlGen = Object.assign({ ready: false }, pure);
  function ready() { try { return !!(window.TlCanvas && TlCanvas.addTool && TlCanvas.onProps && window.TlParent && TlParent.bakeAll && window.H3Keyframes && typeof tl === "object" && tl); } catch (e) { return false; } }
  function boot() { if (ready()) install(); else setTimeout(boot, 300); }
  boot();
  function install() {
    if (root.TlGen.ready) return;
    var C = window.TlCanvas, KF = window.H3Keyframes, FPS = KF.FPS || 24;
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]; }); };
    function say(t) { try { C.say(t); } catch (e) { /* fine */ } }
    var cache = new WeakMap();
    /** the generator's picture at tau (the frame's size for a ramp; 1/4 or 1/2 of it for noise, drawn smooth) */
    function picture(c, tau) {
      var o = params(c, tau, KF, window.TlExpr), W = C.state.W, H = C.state.H;
      if (o.kind === "particles") {                            // 2.506.0: ✨ worked out for this moment (tlparticles.js)
        var pe = cache.get(c), pcv = (pe && pe.cv) || document.createElement("canvas"), psig = JSON.stringify([o, W, H, Math.round(tau * FPS * 1000)]);
        if (pe && pe.sig === psig) return pe.cv;
        pcv.width = W; pcv.height = H; var pg = pcv.getContext("2d"); pg.clearRect(0, 0, W, H);
        TlParticles.draw(pg, o, tau, W, H);
        cache.set(c, { sig: psig, cv: pcv });
        return pcv;
      }
      if (isAud(o.kind)) {                                     // 2.508.0: 🌫 the sound's waveform / spectrum at this moment (tlaudio.js)
        var ae = cache.get(c), acv = (ae && ae.cv) || document.createElement("canvas"), asig = JSON.stringify([o, W, H, Math.round(((c.start || 0) + tau) * FPS * 1000), TlAudio.version()]);
        if (ae && ae.sig === asig) return ae.cv;
        acv.width = W; acv.height = H; var ag = acv.getContext("2d"); ag.clearRect(0, 0, W, H);
        TlAudio.draw(ag, o, (c.start || 0) + tau, W, H);
        cache.set(c, { sig: asig, cv: acv });
        return acv;
      }
      var q = o.kind === "fractal" ? o.detail : 1, w = Math.max(16, Math.round(W * q)), h = Math.max(9, Math.round(H * q));
      var sig = JSON.stringify([o, w, h, o.kind === "fractal" ? Math.round(tau * FPS) : 0]);
      var e = cache.get(c);
      if (e && e.sig === sig) return e.cv;
      var cv = (e && e.cv) || document.createElement("canvas"); cv.width = w; cv.height = h;
      var g = cv.getContext("2d");
      if (o.kind === "ramp") {
        var cx = w / 2, cy = h / 2, gr = o.shape === "radial" ? g.createRadialGradient(cx + o.x0 * q, cy + o.y0 * q, 0, cx + o.x0 * q, cy + o.y0 * q, Math.hypot(o.x1 - o.x0, o.y1 - o.y0) * q || 1)
          : g.createLinearGradient(cx + o.x0 * q, cy + o.y0 * q, cx + o.x1 * q, cy + o.y1 * q);
        gr.addColorStop(0, o.c0); gr.addColorStop(1, o.c1); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      } else {
        var P = perm(o.seed), im = g.createImageData(w, h), d = im.data, a = KF.rgb(o.c0), b = KF.rgb(o.c1), k = 1 / q;
        for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
          var v = value(o, (x + 0.5) * k, (y + 0.5) * k, tau, P), i = (y * w + x) * 4;
          d[i] = a[0] + (b[0] - a[0]) * v; d[i + 1] = a[1] + (b[1] - a[1]) * v; d[i + 2] = a[2] + (b[2] - a[2]) * v; d[i + 3] = 255;
        }
        g.putImageData(im, 0, 0);
      }
      cache.set(c, { sig: sig, cv: cv });
      return cv;
    }
    function add(gen, name) {
      var len = 5; try { (tl.video || []).forEach(function (v) { len = Math.max(len, (v.start || 0) + (typeof effDur === "function" ? effDur(v) : 5) - (C.state.t || 0)); }); } catch (e) { /* fine */ }
      var c = { name: "", gen: clean(gen), start: Math.max(0, Math.round((C.state.t || 0) * FPS) / FPS), len: Math.round(Math.min(len, 600) * 100) / 100, opacity: 1, tf: { x: 0, y: 0, scale: 1, rot: 0 } };
      c.uid = "u" + Math.random().toString(36).slice(2, 10);
      var n = (tl.images || []).filter(function (L) { return (L.clips || []).some(function (x) { return x.gen; }); }).length + 1;
      C.newLayer("image", c, name + " " + n);
      say("🌫 " + name + " " + n + ": its settings are in the Properties (🌫 Generator); it moves by itself (evolution speed)");
      return c;
    }
    /* the 🌫 tool: click = fractal noise, drag = a gradient ramp */
    var D = null;
    C.addTool({ id: "gen", icon: "🌫", title: "Generator - click = a fractal noise layer over the frame, drag = a gradient ramp from where you press to where you let go, Shift+click = a particle emitter there, Alt+click = an audio waveform, Alt+Shift+click = an audio spectrum", key: "", cursor: "crosshair",
      down: function (p, ev) { D = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, shift: !!(ev && ev.shiftKey), alt: !!(ev && ev.altKey) }; },
      move: function (p) { if (!D) return; D.x1 = p.x; D.y1 = p.y; C.mark(); },
      up: function () {
        var d = D; D = null; if (!d) return;
        var W2 = C.state.W / 2, H2 = C.state.H / 2;
        // 2.506.0: Shift+click = a ✨ particle emitter where you click (tlparticles.js)
        // 2.508.0: Alt+click = a 🌫 Waveform there, Alt+Shift+click = a Spectrum (tlaudio.js)
        if (d.alt && Math.hypot(d.x1 - d.x0, d.y1 - d.y0) < 6) add(Object.assign({}, TlAudio.DEFAULTS[d.shift ? "spectrum" : "wave"], { x: Math.round(d.x0 - W2), y: Math.round(d.y0 - H2) }), d.shift ? "Audio Spectrum" : "Audio Waveform");
        else if (d.shift && Math.hypot(d.x1 - d.x0, d.y1 - d.y0) < 6) add(Object.assign({}, TlParticles.DEFAULTS, { ex: Math.round(d.x0 - W2), ey: Math.round(d.y0 - H2) }), "Particles");
        else if (Math.hypot(d.x1 - d.x0, d.y1 - d.y0) < 6) add(DEFAULTS.fractal, "Fractal Noise");
        else add({ kind: "ramp", shape: "linear", x0: Math.round(d.x0 - W2), y0: Math.round(d.y0 - H2), x1: Math.round(d.x1 - W2), y1: Math.round(d.y1 - H2), c0: "#000000", c1: "#ffffff" }, "Gradient Ramp");
        C.setTool("move");
      } });
    C.onDraw(function (ctx, o) { if (!D) return; var a = o.toScreen(D.x0, D.y0), b = o.toScreen(D.x1, D.y1); ctx.save(); ctx.strokeStyle = "#f59e2c"; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore(); });
    /* 🌫 Generator in the Properties */
    var LABEL = { contrast: "contrast %", bright: "brightness", scale: "scale px", complexity: "complexity", subinf: "sub influence %", subscale: "sub scaling",
      evo: "evolution °", evospeed: "evolution °/s", ox: "offset x", oy: "offset y", dx: "drift x px/s", dy: "drift y px/s", x0: "start x", y0: "start y", x1: "end x", y1: "end y",
      ex: "emitter x", ey: "emitter y", ew: "width", eh: "height", rate: "per s", life: "life s", speed: "speed px/s", speedRand: "± %", dir: "direction °", spread: "spread °",
      gravity: "gravity", wind: "wind", size0: "size start", size1: "size end", sizeRand: "size ± %", op0: "opacity start %", op1: "opacity end %",
      x: "x", y: "y", w: "width", h: "height", span: "span s", gain: "gain %", thick: "thickness", bands: "bands", gap: "gap %", floor: "floor %" };
    C.onProps(function (Pn, c, sel) {
      if (!c || !c.gen || !Pn || !sel || !sel.Ly || sel.Ly.kind !== "img") return;
      var o = clean(c.gen); if (!o) return;
      var tau = C.tauOf(c, "img"), d = document.createElement("div"); d.className = "tlp-gen";
      var nrow = function (k) { var keyed = KF.has(c.kf, "gn_" + k), v = Math.round((keyed ? KF.value(c.kf, tau, "gn_" + k, o[k]) : o[k]) * 1000) / 1000;
        return '<label style="white-space:nowrap">' + esc(LABEL[k] || k) + ' <input type="number" data-gn="' + k + '" value="' + v + '" step="any" style="width:58px"></label><button class="ghost" data-gnk="' + k + '" title="Key it at the playhead" style="padding:0 3px">' + (keyed ? "◆" : "◇") + "</button>"; };
      var h = '<div class="tlp-t">🌫 Generator</div><div class="tlp-row" style="flex-wrap:wrap"><label>kind <select id="tlpGnKind"><option value="fractal"' + (o.kind === "fractal" ? " selected" : "") + '>Fractal noise</option><option value="ramp"' + (o.kind === "ramp" ? " selected" : "") + ">Gradient ramp</option><option value=\"particles\"" + (o.kind === "particles" ? " selected" : "") + ">Particles</option><option value=\"wave\"" + (o.kind === "wave" ? " selected" : "") + ">Waveform</option><option value=\"spectrum\"" + (o.kind === "spectrum" ? " selected" : "") + ">Spectrum</option></select></label>";
      if (o.kind === "fractal") {
        h += '<label>type <select id="tlpGnType">' + ["basic", "turbulent smooth", "turbulent sharp"].map(function (x) { return '<option' + (o.ftype === x ? " selected" : "") + ">" + x + "</option>"; }).join("") + "</select></label>"
          + '<label><input type="checkbox" id="tlpGnInv"' + (o.invert ? " checked" : "") + "> invert</label>"
          + '<label>seed <input type="number" id="tlpGnSeed" value="' + o.seed + '" style="width:58px"></label>'
          + '<label>detail <select id="tlpGnDetail"><option value="0.25"' + (o.detail === 0.25 ? " selected" : "") + '>¼ (fast)</option><option value="0.5"' + (o.detail === 0.5 ? " selected" : "") + ">½</option></select></label></div>"
          + '<div class="tlp-row" style="flex-wrap:wrap">' + NUMS.fractal.map(nrow).join("") + "</div>";
      } else if (o.kind === "particles") {               // 2.506.0
        h += '<label>emitter <select id="tlpGnEmit">' + TlParticles.EMITS.map(function (x) { return "<option" + (o.emit === x ? " selected" : "") + ">" + x + "</option>"; }).join("") + "</select></label>"
          + '<label>particle <select id="tlpGnPShape">' + TlParticles.SHAPES.map(function (x) { return "<option" + (o.shape === x ? " selected" : "") + ">" + x + "</option>"; }).join("") + "</select></label>"
          + '<label><input type="checkbox" id="tlpGnPre"' + (o.preroll ? " checked" : "") + '> pre-roll</label><label>seed <input type="number" id="tlpGnSeed" value="' + o.seed + '" style="width:58px"></label></div>'
          + '<div class="tlp-row" style="flex-wrap:wrap">' + TlParticles.NUMS.map(nrow).join("") + "</div>";
      } else if (isAud(o.kind)) {                       // 2.508.0: 🌫 the sound
        h += '<label>sound <select id="tlpGnAud">' + TlAudio.sources().map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === o.aud ? " selected" : "") + ">" + esc(s.label) + "</option>"; }).join("") + "</select></label>"
          + '<label>style <select id="tlpGnAStyle">' + TlAudio.STYLES[o.kind].map(function (x) { return "<option" + (o.style === x ? " selected" : "") + ">" + x + "</option>"; }).join("") + "</select></label></div>"
          + '<div class="tlp-row" style="flex-wrap:wrap">' + TlAudio.NUMS[o.kind].map(nrow).join("") + "</div>";
      } else {
        h += '<label>shape <select id="tlpGnShape"><option value="linear"' + (o.shape === "linear" ? " selected" : "") + '>linear</option><option value="radial"' + (o.shape === "radial" ? " selected" : "") + ">radial</option></select></label></div>"
          + '<div class="tlp-row" style="flex-wrap:wrap">' + NUMS.ramp.map(nrow).join("") + "</div>";
      }
      h += '<div class="tlp-row"><label>colours <input type="color" id="tlpGnC0" value="' + o.c0 + '"> → <input type="color" id="tlpGnC1" value="' + o.c1 + '"></label></div>';
      d.innerHTML = h; Pn.appendChild(d);
      var save = function (repaint) { c.gen = clean(c.gen); delete c.bakeSig; if (typeof tlSave === "function") tlSave(); C.mark(); if (repaint) C.paintProps(); };
      var q = function (id) { return d.querySelector("#" + id); };
      var stop = function (el) { if (el) el.addEventListener("keydown", function (ev) { ev.stopPropagation(); }); };
      q("tlpGnKind").addEventListener("change", function () { var k = q("tlpGnKind").value; if (k !== c.gen.kind) { c.gen = clean(Object.assign({}, k === "particles" ? TlParticles.DEFAULTS : isAud(k) ? TlAudio.DEFAULTS[k] : DEFAULTS[k])); save(true); } });
      if (q("tlpGnPre")) q("tlpGnPre").addEventListener("change", function () { c.gen.preroll = q("tlpGnPre").checked; save(false); });
      [["tlpGnType", "ftype"], ["tlpGnShape", "shape"], ["tlpGnDetail", "detail"], ["tlpGnEmit", "emit"], ["tlpGnPShape", "shape"], ["tlpGnAud", "aud"], ["tlpGnAStyle", "style"]].forEach(function (p) { var el = q(p[0]); if (el) el.addEventListener("change", function () { c.gen[p[1]] = p[1] === "detail" ? +el.value : el.value; save(false); }); });
      if (q("tlpGnInv")) q("tlpGnInv").addEventListener("change", function () { c.gen.invert = q("tlpGnInv").checked; save(false); });
      if (q("tlpGnSeed")) { stop(q("tlpGnSeed")); q("tlpGnSeed").addEventListener("input", function () { c.gen.seed = +q("tlpGnSeed").value; save(false); }); }
      ["tlpGnC0", "tlpGnC1"].forEach(function (id, i) { q(id).addEventListener("input", function () { c.gen["c" + i] = q(id).value; save(false); }); });
      d.querySelectorAll("[data-gn]").forEach(function (el) {
        stop(el);
        el.addEventListener("input", function () {
          var k = el.getAttribute("data-gn"), v = +el.value; if (!Number.isFinite(v)) return;
          if (KF.has(c.kf, "gn_" + k)) { var kv = {}; kv["gn_" + k] = v; c.kf = KF.set(c.kf, C.tauOf(c, "img"), kv, FPS); } else c.gen[k] = v;
          save(false);
        });
      });
      d.querySelectorAll("[data-gnk]").forEach(function (el) {
        el.addEventListener("click", function () {
          var k = el.getAttribute("data-gnk"), kv = {}; kv["gn_" + k] = +(d.querySelector('[data-gn="' + k + '"]') || {}).value;
          c.kf = KF.set(c.kf, C.tauOf(c, "img"), kv, FPS); save(true);
        });
      });
    });
    Object.assign(root.TlGen, { ready: true, picture: picture, add: add });
  }
})(typeof window !== "undefined" ? window : globalThis);
