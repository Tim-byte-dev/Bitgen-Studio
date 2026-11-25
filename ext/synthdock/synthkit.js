/* bitGen Studio — ext/synthdock/synthkit.js (2.953.0): 🎹 THE SYNTH STATION's BUILT-IN DRUM KIT (window.H3SynthKit) - every
 * sound made here from sine waves, square waves and noise (no sample files shipped, nobody's recordings), pure maths, so Node
 * can test it (scripts/test-953.js) and the page turns each into an AudioBuffer once.
 *   make(id, sampleRate) -> Float32Array (mono, peak 0.9) | null     ids = H3SynthCore.KIT
 *   biquad(x, type, f, q, sr)  a filter (the RBJ cookbook) - lowpass | highpass | bandpass
 */
(function (root) {
  "use strict";
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function noise(n, seed) { var r = rng(seed || 7), x = new Float32Array(n); for (var i = 0; i < n; i++) x[i] = r() * 2 - 1; return x; }
  function biquad(x, type, f, q, sr) {
    var w = 2 * Math.PI * Math.min(f, sr * 0.45) / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * (q || 0.707)), b0, b1, b2, a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
    if (type === "highpass") { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; }
    else if (type === "bandpass") { b0 = al; b1 = 0; b2 = -al; }
    else { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; }
    var y = new Float32Array(x.length), x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (var i = 0; i < x.length; i++) {
      var o = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = o; y[i] = o;
    }
    return y;
  }
  function norm(x, peak) {
    var m = 0; for (var i = 0; i < x.length; i++) { var a = Math.abs(x[i]); if (a > m) m = a; }
    if (m > 0) { var k = (peak || 0.9) / m; for (var j = 0; j < x.length; j++) x[j] *= k; }
    // 2 ms fade out - no click at the end
    var f = Math.min(x.length, 96); for (var e = 0; e < f; e++) x[x.length - 1 - e] *= e / f;
    return x;
  }
  /** a sine whose pitch glides: f(t) */
  function sweep(n, sr, f, amp) {
    var x = new Float32Array(n), ph = 0;
    for (var i = 0; i < n; i++) { var t = i / sr; ph += 2 * Math.PI * f(t) / sr; x[i] = Math.sin(ph) * amp(t); }
    return x;
  }
  /** six square waves at clangy ratios - the metal of a hat, a cymbal, a cowbell */
  function metal(n, sr, freqs) {
    var x = new Float32Array(n);
    for (var i = 0; i < n; i++) { var t = i / sr, s = 0; for (var k = 0; k < freqs.length; k++) s += (Math.sin(2 * Math.PI * freqs[k] * t) >= 0 ? 1 : -1); x[i] = s / freqs.length; }
    return x;
  }
  var HAT = [205.3, 304.4, 369.6, 522.7, 540, 800].map(function (f) { return f * 1.7; });
  function env(x, sr, a) { for (var i = 0; i < x.length; i++) x[i] *= a(i / sr); return x; }
  function mix(a, b, kb) { var n = Math.max(a.length, b.length), y = new Float32Array(n); for (var i = 0; i < n; i++) y[i] = (a[i] || 0) + (b[i] || 0) * (kb == null ? 1 : kb); return y; }

  var MAKE = {
    kick: function (sr) {
      var n = Math.round(sr * 0.5), body = sweep(n, sr, function (t) { return 48 + 120 * Math.exp(-t * 30); }, function (t) { return Math.exp(-t * 7); });
      var click = env(biquad(noise(n, 11), "highpass", 2500, 0.7, sr), sr, function (t) { return Math.exp(-t * 400) * 0.6; });
      return mix(body, click);
    },
    boom: function (sr) {
      var n = Math.round(sr * 1.3), x = sweep(n, sr, function (t) { return 44 + 70 * Math.exp(-t * 40); }, function (t) { return Math.exp(-t * 2.4); });
      for (var i = 0; i < n; i++) x[i] = Math.tanh(x[i] * 1.6);
      return x;
    },
    snare: function (sr) {
      var n = Math.round(sr * 0.32), tone = mix(sweep(n, sr, function () { return 185; }, function (t) { return Math.exp(-t * 22) * 0.55; }),
                                               sweep(n, sr, function () { return 330; }, function (t) { return Math.exp(-t * 26) * 0.3; }));
      var nz = env(biquad(noise(n, 23), "highpass", 1200, 0.7, sr), sr, function (t) { return Math.exp(-t * 13); });
      return mix(tone, nz, 0.9);
    },
    clap: function (sr) {
      var n = Math.round(sr * 0.38), nz = biquad(noise(n, 31), "bandpass", 1150, 1.2, sr);
      return env(nz, sr, function (t) {
        var b = 0; for (var k = 0; k < 3; k++) { var d = t - k * 0.011; if (d >= 0 && d < 0.011) b = Math.max(b, Math.exp(-d * 180)); }
        return Math.max(b, t >= 0.03 ? Math.exp(-(t - 0.03) * 15) * 0.8 : 0);
      });
    },
    chat: function (sr) {
      var n = Math.round(sr * 0.09), x = biquad(mix(metal(n, sr, HAT), noise(n, 41), 0.5), "highpass", 7000, 0.8, sr);
      return env(x, sr, function (t) { return Math.exp(-t * 55); });
    },
    ohat: function (sr) {
      var n = Math.round(sr * 0.55), x = biquad(mix(metal(n, sr, HAT), noise(n, 43), 0.5), "highpass", 6500, 0.8, sr);
      return env(x, sr, function (t) { return Math.exp(-t * 6.5); });
    },
    tom: function (sr) {
      var n = Math.round(sr * 0.5);
      return mix(sweep(n, sr, function (t) { return 105 + 70 * Math.exp(-t * 18); }, function (t) { return Math.exp(-t * 8); }),
                 env(biquad(noise(n, 53), "lowpass", 900, 0.7, sr), sr, function (t) { return Math.exp(-t * 50) * 0.3; }));
    },
    rim: function (sr) {
      var n = Math.round(sr * 0.07);
      return mix(sweep(n, sr, function () { return 1700; }, function (t) { return Math.exp(-t * 90); }),
                 env(biquad(noise(n, 61), "bandpass", 3200, 2, sr), sr, function (t) { return Math.exp(-t * 160); }), 0.8);
    },
    cowbell: function (sr) {
      var n = Math.round(sr * 0.4), x = biquad(metal(n, sr, [562, 845]), "bandpass", 1400, 1.5, sr);
      return env(x, sr, function (t) { return 0.6 * Math.exp(-t * 40) + 0.4 * Math.exp(-t * 7); });
    },
    shaker: function (sr) {
      var n = Math.round(sr * 0.14), x = biquad(noise(n, 71), "highpass", 5000, 0.7, sr);
      return env(x, sr, function (t) { return Math.min(1, t / 0.018) * Math.exp(-Math.max(0, t - 0.018) * 38); });
    },
    zap: function (sr) {
      var n = Math.round(sr * 0.26);
      return sweep(n, sr, function (t) { return 60 + 1900 * Math.exp(-t * 32); }, function (t) { return Math.exp(-t * 11); });
    },
    crash: function (sr) {
      var n = Math.round(sr * 1.9), x = biquad(mix(noise(n, 83), metal(n, sr, HAT.map(function (f) { return f * 0.83; })), 0.6), "highpass", 4200, 0.6, sr);
      return env(x, sr, function (t) { return Math.min(1, t / 0.004) * Math.exp(-t * 2.1); });
    },
  };
  function make(id, sr) {
    var f = MAKE[id]; if (!f) return null;
    sr = sr || 48000;
    return norm(f(sr), 0.9);
  }
  var api = { make: make, ids: Object.keys(MAKE), biquad: biquad, rng: rng };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.H3SynthKit = api;
})(typeof window !== "undefined" ? window : globalThis);
