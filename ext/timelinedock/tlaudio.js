/* bitGen Studio — ext/timelinedock/tlaudio.js (2.508.0): ♪ AUDIO → KEYS, 🌫 WAVEFORM and SPECTRUM layers, ƒx audio().
 * window.TlAudio.
 *
 * Tim (verbatim): "lets do steps 1,2,3 , 4,5,6 and 7" - step 2: "Audio → keyframes, plus waveform and spectrum layers".
 *
 *   The sound of the timeline is read by the app (routes/audioAnalyze.js -> lib/audioAnalyze.js: loudness 48 a second,
 *   the waveform's peaks 1200 a second, 64 frequency bands 24 a second) - one clip's sound or ALL SOUND (the mix: every
 *   sound clip and every video clip's own sound that plays, at its volume).
 *   ♪ Audio → keys (any layer's Properties): pick the sound, what to follow (loudness, bass, mids, treble), the property
 *     (opacity, scale, x, y, turn, or the layer's own generator / rays numbers), the value at quiet and at loud and a
 *     smoothing - "♪ Make keys" keys that property over the layer's whole length (quiet .. loud of THAT stretch = the two
 *     values), thinned to the keys that matter (at most 400).
 *   🌫 Waveform (a generator kind - Alt+click with the 🌫 tool): the sound's wave around the playhead - styles wave
 *     (filled), line, bars; its box (x, y from the frame's centre, width, height), span (s shown), gain %, thickness,
 *     colours left -> right.
 *   🌫 Spectrum (Alt+Shift+click): the sound's frequencies now - styles bars, line, circle; bands (4..64), gain %, gap %,
 *     floor (quieter = nothing), thickness, colours low -> high.
 *   ƒx audio("amp" | "bass" | "mid" | "treble") - the whole mix at that moment, 0..1.
 * Everything is read from the analysis, so any frame draws the same - the compile bakes these layers and matches.
 * Pure (Node: scripts/test-audio.js): DEFAULTS, NUMS, STYLES, clean, decode, prep, ampAt, specAt, levelOf, bandsOf,
 *   peaksIn, simplify, toKeys.
 */
(function (root) {
  "use strict";
  var DEFAULTS = {
    wave: { kind: "wave", aud: "mix", style: "wave", x: 0, y: 0, w: 560, h: 140, span: 0.08, gain: 100, thick: 3, c0: "#7cf0ff", c1: "#ffffff" },
    spectrum: { kind: "spectrum", aud: "mix", style: "bars", x: 0, y: 80, w: 560, h: 180, bands: 32, gain: 100, gap: 30, floor: 10, thick: 3, c0: "#38bdf8", c1: "#f472b6" }
  };
  var NUMS = { wave: ["x", "y", "w", "h", "span", "gain", "thick"], spectrum: ["x", "y", "w", "h", "bands", "gain", "gap", "floor", "thick"] };
  var STYLES = { wave: ["wave", "line", "bars"], spectrum: ["bars", "line", "circle"] };
  var WHAT = ["amp", "bass", "mid", "treble"], RANGES = { bass: [30, 250], mid: [250, 2000], treble: [2000, 12000] };
  var nm = function (v, d, lo, hi) { var x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
  var hex = function (v, d) { return /^#[0-9a-f]{6}$/i.test(String(v)) ? String(v).toLowerCase() : d; };
  function clean(g) {
    if (!g || typeof g !== "object" || !DEFAULTS[g.kind]) return null;
    var D = DEFAULTS[g.kind], o = { kind: g.kind };
    o.aud = typeof g.aud === "string" && g.aud ? g.aud.slice(0, 60) : "mix";
    o.style = STYLES[g.kind].indexOf(g.style) >= 0 ? g.style : D.style;
    o.x = nm(g.x, D.x, -1e5, 1e5); o.y = nm(g.y, D.y, -1e5, 1e5); o.w = nm(g.w, D.w, 4, 1e5); o.h = nm(g.h, D.h, 2, 1e5);
    o.gain = nm(g.gain, 100, 0, 2000); o.thick = nm(g.thick, D.thick, 0.5, 200);
    if (g.kind === "wave") o.span = nm(g.span, D.span, 0.005, 10);
    else { o.bands = Math.round(nm(g.bands, D.bands, 4, 64)); o.gap = nm(g.gap, D.gap, 0, 90); o.floor = nm(g.floor, D.floor, 0, 99); }
    o.c0 = hex(g.c0, D.c0); o.c1 = hex(g.c1, D.c1);
    return o;
  }
  /* ---- the analysis */
  function bytes(s) {
    if (typeof Buffer !== "undefined" && Buffer.from) return new Uint8Array(Buffer.from(s, "base64"));
    var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u;
  }
  function decode(s, type) {
    var u = bytes(s || ""), o, i;
    if (type === "u16") { o = new Float32Array(u.length >> 1); for (i = 0; i < o.length; i++) o[i] = (u[2 * i] | (u[2 * i + 1] << 8)) / 65535; }
    else if (type === "i8") { o = new Float32Array(u.length); for (i = 0; i < o.length; i++) o[i] = (u[i] > 127 ? u[i] - 256 : u[i]) / 127; }
    else { o = new Float32Array(u.length); for (i = 0; i < o.length; i++) o[i] = u[i] / 255; }
    return o;
  }
  /** the route's JSON -> arrays */
  function prep(j) {
    return { dur: +j.dur || 0, rate: j.rate, amp: decode(j.amp, "u16"), prate: j.prate, pk: decode(j.peaks, "i8"), srate: j.srate, bands: j.bands,
      spec: decode(j.spec, "u8"), edges: j.edges || [], peak: +j.peak || 0 };
  }
  /** the RMS loudness at s seconds into the file (0..1 of full scale), straight between the steps */
  function ampAt(D, s) {
    var n = D.amp.length; if (!n || s < 0 || s > D.dur) return 0;
    var x = s * D.rate - 0.5, i = Math.floor(x), f = x - i, a = D.amp[Math.max(0, Math.min(n - 1, i))], b = D.amp[Math.max(0, Math.min(n - 1, i + 1))];
    return a + (b - a) * f;
  }
  /** the band levels (0..1, -72 .. 0 dB) at s */
  function specAt(D, s) {
    var B = D.bands, n = Math.floor(D.spec.length / B), out = new Float32Array(B); if (!n || s < 0 || s > D.dur) return out;
    var x = s * D.srate - 0.5, i = Math.floor(x), f = x - i, i0 = Math.max(0, Math.min(n - 1, i)), i1 = Math.max(0, Math.min(n - 1, i + 1));
    for (var b = 0; b < B; b++) out[b] = D.spec[i0 * B + b] + (D.spec[i1 * B + b] - D.spec[i0 * B + b]) * f;
    return out;
  }
  /** loudness (to the file's loudest moment) or a band range's average level */
  function levelOf(D, s, what) {
    if (!what || what === "amp") return D.peak > 0 ? Math.min(1, ampAt(D, s) / D.peak) : 0;
    var R = RANGES[what]; if (!R) return 0;
    var L = specAt(D, s), sum = 0, n = 0;                    // the bands' POWER averaged (a lone tone still reads), back to 0..1
    for (var b = 0; b < D.bands; b++) { var mid = Math.sqrt(D.edges[b] * D.edges[b + 1]); if (mid >= R[0] && mid < R[1]) { sum += L[b] > 0 ? Math.pow(10, (L[b] - 1) * 7.2) : 0; n++; } }
    return n && sum > 0 ? Math.max(0, Math.min(1, 1 + Math.log10(sum / n) / 7.2)) : 0;
  }
  /** 64 levels -> n (each the loudest of its share) */
  function bandsOf(L, n) {
    var out = new Float32Array(n), B = L.length;
    for (var i = 0; i < n; i++) { var a = Math.floor(i * B / n), b = Math.max(a + 1, Math.floor((i + 1) * B / n)), m = 0; for (var k = a; k < b; k++) m = Math.max(m, L[k]); out[i] = m; }
    return out;
  }
  /** the lowest / highest sample from s0 to s1 */
  function peaksIn(D, s0, s1) {
    var n = D.pk.length >> 1, a = Math.max(0, Math.floor(s0 * D.prate)), b = Math.min(n, Math.max(a + 1, Math.ceil(s1 * D.prate))), lo = 0, hi = 0;
    for (var i = a; i < b; i++) { if (D.pk[2 * i] < lo) lo = D.pk[2 * i]; if (D.pk[2 * i + 1] > hi) hi = D.pk[2 * i + 1]; }
    return [lo, hi];
  }
  /** Ramer-Douglas-Peucker: the points [[t, v]] that matter within tol */
  function simplify(P, tol) {
    if (P.length < 3) return P.slice();
    var keep = new Uint8Array(P.length); keep[0] = keep[P.length - 1] = 1;
    var st = [[0, P.length - 1]];
    while (st.length) {
      var r = st.pop(), a = r[0], b = r[1], md = -1, mi = -1;
      for (var i = a + 1; i < b; i++) {
        var f = (P[i][0] - P[a][0]) / Math.max(1e-12, P[b][0] - P[a][0]), d = Math.abs(P[i][1] - (P[a][1] + (P[b][1] - P[a][1]) * f));
        if (d > md) { md = d; mi = i; }
      }
      if (md > tol && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
    }
    return P.filter(function (_, i) { return keep[i]; });
  }
  /** levels (one a frame) -> keys [[tau, value]]: smoothed (± k frames), quiet .. loud of this stretch = lo .. hi, thinned (<= max) */
  function toKeys(levels, fps, lo, hi, k, max) {
    var n = levels.length, sm = new Float64Array(n), i, j;
    for (i = 0; i < n; i++) { var s = 0, c = 0; for (j = Math.max(0, i - k); j <= Math.min(n - 1, i + k); j++) { s += levels[j]; c++; } sm[i] = s / c; }
    var mn = Infinity, mx = -Infinity; for (i = 0; i < n; i++) { mn = Math.min(mn, sm[i]); mx = Math.max(mx, sm[i]); }
    var P = []; for (i = 0; i < n; i++) P.push([i / fps, lo + (hi - lo) * (mx - mn > 1e-9 ? (sm[i] - mn) / (mx - mn) : 0)]);
    var tol = Math.max(1e-6, Math.abs(hi - lo) * 0.005), out = simplify(P, tol);
    while (out.length > (max || 400)) { tol *= 1.6; out = simplify(P, tol); }
    return out;
  }
  var pure = { DEFAULTS: DEFAULTS, NUMS: NUMS, STYLES: STYLES, WHAT: WHAT, RANGES: RANGES, clean: clean, decode: decode, prep: prep, ampAt: ampAt, specAt: specAt,
    levelOf: levelOf, bandsOf: bandsOf, peaksIn: peaksIn, simplify: simplify, toKeys: toKeys };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ---------------- the page ---------------- */
  var DATA = {}, VER = 0;
  var C = function () { return window.TlCanvas; };
  var keyOf = function (c, kind) { return (kind === "aud" ? (c.src || "sound") : (c.src || (kind === "v1" ? "output" : "video"))) + "|" + c.name; };
  /** the analysis of a clip's file (null while it loads - the canvas is repainted when it comes) */
  function load(c, kind) {
    var k = keyOf(c, kind), e = DATA[k];
    if (e) return e.p;
    var q = k.split("|");
    e = DATA[k] = { D: null, err: null };
    e.p = fetch("/api/audio/analyze?src=" + encodeURIComponent(q[0]) + "&name=" + encodeURIComponent(q.slice(1).join("|")))
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); })
      .then(function (j) { e.D = prep(j); VER++; try { C().mark(); } catch (x) { /* fine */ } return e.D; })
      .catch(function (x) { e.err = String(x.message || x); VER++; return null; });
    return e.p;
  }
  function dataOf(c, kind) { var e = DATA[keyOf(c, kind)]; if (!e) { load(c, kind); return null; } return e.D; }
  /** every clip that sounds: [{c, L, kind, vol, label}] */
  function sounding() {
    var out = [];
    (tl.audio || []).forEach(function (L) { if (L.muted || L.visible === false) return; (L.clips || []).forEach(function (c) { out.push({ c: c, L: L, kind: "aud", vol: (L.volume == null ? 1 : +L.volume) * (c.volume == null ? 1 : +c.volume), label: (L.name || "Audio") + " · " + c.name }); }); });
    var v1m = tl.v1 && tl.v1.muted;
    (tl.video || []).forEach(function (c) { if (!v1m && !c.soundOut && c.name) out.push({ c: c, L: tl.v1 || {}, kind: "v1", vol: (tl.v1 && tl.v1.volume != null ? +tl.v1.volume : 1) * (c.volume == null ? 1 : +c.volume), label: "V1 · " + c.name }); });
    (tl.vlayers || []).forEach(function (L) { if (L.muted || L.visible === false) return; (L.clips || []).forEach(function (c) { if (!c.soundOut && c.name) out.push({ c: c, L: L, kind: "vl", vol: (L.volume == null ? 1 : +L.volume) * (c.volume == null ? 1 : +c.volume), label: (L.name || "Video") + " · " + c.name }); }); });
    return out;
  }
  function uidOf(c) { if (!c.uid) c.uid = "u" + Math.random().toString(36).slice(2, 10); return c.uid; }
  /** the choices for a sound: all sound + each clip */
  function sources() { return [{ id: "mix", label: "All sound (the mix)" }].concat(sounding().map(function (x) { return { id: uidOf(x.c), label: x.label }; })); }
  function picked(id) { var S = sounding(); return id && id !== "mix" ? S.filter(function (x) { return x.c.uid === id; }) : S; }
  var srcT = function (x, t) { return x.kind === "aud" ? (x.c.in || 0) + (t - (x.c.start || 0)) : C().srcAt(x.c, t); };
  var on = function (x, t) { try { return !!C().at(x.c, x.kind, t); } catch (e) { return false; } };
  /** what (amp | bass | mid | treble) of a sound at timeline time t, 0..1 */
  function level(id, what, t) {
    var S = picked(id), sq = 0, peak = 0, best = 0;
    S.forEach(function (x) {
      var D = dataOf(x.c, x.kind); if (!D) return;
      peak = Math.max(peak, D.peak * Math.max(0, x.vol));
      if (!on(x, t)) return;
      var s = srcT(x, t);
      if (!what || what === "amp") { var a = ampAt(D, s) * Math.max(0, x.vol); sq += a * a; }
      else { var v = levelOf(D, s, what) + (x.vol > 0 ? 20 * Math.log10(x.vol) / 72 : -1); best = Math.max(best, v); }
    });
    if (!what || what === "amp") return peak > 0 ? Math.min(1, Math.sqrt(sq) / peak) : 0;
    return Math.max(0, Math.min(1, best));
  }
  /** the 64 band levels of a sound at t (the loudest clip in each band) */
  function spectrumAt(id, t) {
    var out = new Float32Array(64);
    picked(id).forEach(function (x) {
      var D = dataOf(x.c, x.kind); if (!D || !on(x, t)) return;
      var L = specAt(D, srcT(x, t)), off = x.vol > 0 ? 20 * Math.log10(x.vol) / 72 : -1;
      for (var b = 0; b < Math.min(64, L.length); b++) out[b] = Math.max(out[b], L[b] + off);
    });
    return out;
  }
  /** n columns of [lo, hi] samples from t0 to t1 (the clips added at their volume) */
  function waveIn(id, t0, t1, n) {
    var lo = new Float32Array(n), hi = new Float32Array(n), dt = (t1 - t0) / n;
    picked(id).forEach(function (x) {
      var D = dataOf(x.c, x.kind); if (!D) return;
      for (var i = 0; i < n; i++) {
        var a = t0 + i * dt; if (!on(x, a + dt / 2)) continue;
        var s = srcT(x, a), p = peaksIn(D, s, s + dt); lo[i] += p[0] * x.vol; hi[i] += p[1] * x.vol;
      }
    });
    return { lo: lo, hi: hi };
  }
  function ready(id) { return picked(id).every(function (x) { var e = DATA[keyOf(x.c, x.kind)]; return e && (e.D || e.err); }); }
  /** load everything a bake needs (every waveform / spectrum layer's sound, everything for ƒx audio()) */
  function preload() { return Promise.all(sounding().map(function (x) { return load(x.c, x.kind); })); }
  var mixC = function (a, b, f) { return "rgb(" + [0, 1, 2].map(function (k) { return Math.round(a[k] + (b[k] - a[k]) * f); }).join(",") + ")"; };
  var rgb = function (h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; };
  /** a waveform / spectrum generator at timeline time t into g (the W x H frame) */
  function draw(g, o, t, W, H) {
    var A = rgb(o.c0), B = rgb(o.c1), x0 = W / 2 + o.x - o.w / 2, cy = H / 2 + o.y, gain = o.gain / 100;
    var grad = g.createLinearGradient(x0, 0, x0 + o.w, 0); grad.addColorStop(0, o.c0); grad.addColorStop(1, o.c1);
    g.save(); g.lineJoin = "round"; g.lineCap = "round";
    if (o.kind === "wave") {
      var n = o.style === "bars" ? Math.max(4, Math.round(o.w / Math.max(2, o.thick * 2))) : Math.max(8, Math.min(1200, Math.round(o.w / 2))), w = waveIn(o.aud, t - o.span / 2, t + o.span / 2, n), hh = o.h / 2;
      var Y = function (v) { return cy - Math.max(-1, Math.min(1, v * gain)) * hh; };
      if (o.style === "wave") {
        g.fillStyle = grad; g.beginPath(); g.moveTo(x0, Y(w.hi[0]));
        for (var i = 0; i < n; i++) g.lineTo(x0 + (i + 0.5) * o.w / n, Y(w.hi[i]));
        for (var i2 = n - 1; i2 >= 0; i2--) g.lineTo(x0 + (i2 + 0.5) * o.w / n, Y(Math.min(w.lo[i2], w.hi[i2] - 1 / Math.max(1, hh))));
        g.closePath(); g.fill();
      } else if (o.style === "line") {
        g.strokeStyle = grad; g.lineWidth = o.thick; g.beginPath();
        for (var j = 0; j < n; j++) { var X = x0 + (j + 0.5) * o.w / n, v = j % 2 ? w.lo[j] : w.hi[j]; if (j) g.lineTo(X, Y(v)); else g.moveTo(X, Y(v)); }
        g.stroke();
      } else {
        var bw = o.w / n;
        for (var k = 0; k < n; k++) { var m = Math.min(1, Math.max(Math.abs(w.lo[k]), Math.abs(w.hi[k])) * gain) * hh; g.fillStyle = mixC(A, B, k / Math.max(1, n - 1)); g.fillRect(x0 + k * bw + bw * 0.15, cy - Math.max(0.5, m), bw * 0.7, Math.max(1, 2 * m)); }
      }
    } else {
      var L = bandsOf(spectrumAt(o.aud, t), o.bands), f = o.floor / 100, nb = o.bands;
      var lv = function (v) { return Math.max(0, Math.min(1, (v - f) / Math.max(1e-6, 1 - f) * gain)); };
      var base = cy + o.h / 2;
      if (o.style === "bars") {
        var bw2 = o.w / nb, gp = bw2 * o.gap / 100;
        for (var b = 0; b < nb; b++) { var hb = lv(L[b]) * o.h; g.fillStyle = mixC(A, B, b / Math.max(1, nb - 1)); if (hb > 0) g.fillRect(x0 + b * bw2 + gp / 2, base - hb, bw2 - gp, hb); }
      } else if (o.style === "line") {
        g.strokeStyle = grad; g.lineWidth = o.thick; g.beginPath();
        for (var b2 = 0; b2 < nb; b2++) { var X2 = x0 + (b2 + 0.5) * o.w / nb, Y2 = base - lv(L[b2]) * o.h; if (b2) g.lineTo(X2, Y2); else g.moveTo(X2, Y2); }
        g.stroke();
      } else {
        var R0 = Math.min(o.w, o.h) / 4, ccx = W / 2 + o.x;
        g.lineWidth = Math.max(1, Math.min(o.thick, 2 * Math.PI * R0 / nb * (1 - o.gap / 100)));
        for (var b3 = 0; b3 < nb; b3++) {
          var an = -Math.PI / 2 + b3 * 2 * Math.PI / nb, len = lv(L[b3]) * (Math.min(o.w, o.h) / 2 - R0);
          g.strokeStyle = mixC(A, B, b3 / Math.max(1, nb - 1)); g.beginPath();
          g.moveTo(ccx + Math.cos(an) * R0, cy + Math.sin(an) * R0); g.lineTo(ccx + Math.cos(an) * (R0 + Math.max(0.5, len)), cy + Math.sin(an) * (R0 + Math.max(0.5, len))); g.stroke();
        }
      }
    }
    g.restore();
  }
  root.TlAudio = Object.assign({ ready: false, draw: draw, level: level, spectrumAt: spectrumAt, waveIn: waveIn, sources: sources, preload: preload, isReady: ready, version: function () { return VER; }, load: load }, pure);

  function pageReady() { try { return !!(window.TlCanvas && TlCanvas.onProps && TlCanvas.srcAt && TlCanvas.at && window.TlParent && TlParent.bakeAll && window.H3Keyframes && typeof tl === "object" && tl); } catch (e) { return false; } }
  function boot() { if (pageReady()) install(); else setTimeout(boot, 300); }
  boot();
  function install() {
    if (root.TlAudio.ready) return;
    var Cv = window.TlCanvas, KF = window.H3Keyframes, FPS = KF.FPS || 24;
    function say(t) { try { Cv.say(t); } catch (e) { /* fine */ } }
    function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    // the bake waits for the sound (waveform / spectrum layers, ƒx audio())
    var prevBake = TlParent.bakeAll;
    TlParent.bakeAll = function () { var self = this, args = arguments; return preload().then(function () { return prevBake.apply(self, args); }); };
    var LAST = { aud: "mix", what: "amp", prop: "scale" };
    var PRESET = { op: [0.2, 1], scale: [1, 1.3], x: [0, 60], y: [0, -60], rot: [-8, 8] };
    var PNAME = { op: "opacity (0..1)", scale: "scale (1 = 100 %)", x: "x px", y: "y px", rot: "turn °" };
    function propsOf(c) {
      var out = ["op", "scale", "x", "y", "rot"];
      if (c.gen && window.TlGen) { var g = TlGen.clean(c.gen); if (g) { var L = g.kind === "particles" ? (window.TlParticles || {}).NUMS : (NUMS[g.kind] || TlGen.NUMS[g.kind]); (L || []).forEach(function (k) { out.push("gn_" + k); }); } }
      if (c.rays && window.TlRays) TlRays.NUMS.forEach(function (k) { out.push("ry_" + k); });
      return out;
    }
    /** ♪ Make keys: the property follows the sound over the clip */
    function makeKeys(c, kind, o) {
      var len = Cv.clipLen(c, kind), n = Math.max(2, Math.round(len * FPS) + 1), lv = [];
      return preload().then(function () {
        for (var i = 0; i < n; i++) lv.push(level(o.aud, o.what, (c.start || 0) + Math.min(len, i / FPS)));
        var K = toKeys(lv, FPS, o.lo, o.hi, o.smooth, 400);
        var kf = (c.kf || []).map(function (k) { var q = Object.assign({}, k); delete q[o.prop]; return q; })
          .filter(function (k) { return Object.keys(k).some(function (p) { return !/^(at|ease|bz|to|ti)$/.test(p); }); });
        K.forEach(function (p) { var kv = {}; kv[o.prop] = Math.round(p[1] * 10000) / 10000; kf = KF.set(kf, p[0], kv, FPS); });
        c.kf = kf;
        delete c.bakeSig; delete c.vbakeSig;
        if (typeof tlSave === "function") tlSave();
        if (Cv.keysChanged) try { Cv.keysChanged(); } catch (e) { /* fine */ }
        Cv.mark(); Cv.paintProps();
        return K.length;
      });
    }
    Cv.onProps(function (Pn, c, sel) {
      if (!c || !Pn || !sel || !sel.Ly || sel.Ly.kind === "aud" || c.adjust) return;
      var d = document.createElement("div"); d.className = "tlp-audio";
      var P = propsOf(c), cur = P.indexOf(LAST.prop) >= 0 ? LAST.prop : "scale", pr = PRESET[cur] || [0, 1];
      d.innerHTML = '<div class="tlp-row" style="flex-wrap:wrap"><span title="Key a property to the sound">♪ Audio → keys</span>'
        + '<select id="tlpAuSrc" title="Which sound">' + sources().map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === LAST.aud ? " selected" : "") + ">" + esc(s.label) + "</option>"; }).join("") + "</select>"
        + '<select id="tlpAuWhat" title="What of it to follow">' + [["amp", "loudness"], ["bass", "bass"], ["mid", "mids"], ["treble", "treble"]].map(function (w) { return '<option value="' + w[0] + '"' + (w[0] === LAST.what ? " selected" : "") + ">" + w[1] + "</option>"; }).join("") + "</select>"
        + '<select id="tlpAuProp" title="The property it keys">' + P.map(function (p) { return '<option value="' + p + '"' + (p === cur ? " selected" : "") + ">" + esc(PNAME[p] || p) + "</option>"; }).join("") + "</select>"
        + '<label>quiet <input type="number" id="tlpAuLo" value="' + pr[0] + '" step="any" style="width:52px"></label><label>loud <input type="number" id="tlpAuHi" value="' + pr[1] + '" step="any" style="width:52px"></label>'
        + '<label title="Average over this many frames either side">smooth <input type="number" id="tlpAuSm" value="1" min="0" max="12" style="width:40px"></label>'
        + '<button class="ghost" id="tlpAuGo" title="Key the property over the whole layer from the sound">♪ Make keys</button></div>';
      Pn.appendChild(d);
      var q = function (id) { return d.querySelector("#" + id); };
      ["tlpAuLo", "tlpAuHi", "tlpAuSm"].forEach(function (id) { q(id).addEventListener("keydown", function (e) { e.stopPropagation(); }); });
      q("tlpAuProp").addEventListener("change", function () { var p = PRESET[q("tlpAuProp").value]; if (p) { q("tlpAuLo").value = p[0]; q("tlpAuHi").value = p[1]; } });
      q("tlpAuGo").addEventListener("click", function () {
        var o = { aud: q("tlpAuSrc").value, what: q("tlpAuWhat").value, prop: q("tlpAuProp").value, lo: +q("tlpAuLo").value || 0, hi: +q("tlpAuHi").value || 0, smooth: Math.max(0, Math.min(12, Math.round(+q("tlpAuSm").value || 0))) };
        LAST = { aud: o.aud, what: o.what, prop: o.prop };
        say("♪ reading the sound…");
        makeKeys(c, sel.Ly.kind, o).then(function (n) { say("♪ " + n + " keys on " + (PNAME[o.prop] || o.prop) + " from the " + ({ amp: "loudness", bass: "bass", mid: "mids", treble: "treble" })[o.what]); })
          .catch(function (e) { say("♪ " + (e.message || e)); });
      });
    });
    Object.assign(root.TlAudio, { ready: true, makeKeys: makeKeys, propsOf: propsOf });
  }
})(typeof window !== "undefined" ? window : globalThis);
