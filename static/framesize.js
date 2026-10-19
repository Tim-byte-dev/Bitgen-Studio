/* bitGen Studio — static/framesize.js (2.513.0): THE TIMELINE'S FRAME SIZE - presets, aspect ratios, the checks.
 * window.H3FrameSize (+ require() in Node: routes/index.js normalizes the compile's `frame` with it).
 *
 * Tim (verbatim): "add a menubar to the top of the timeline docker - width x height input and a size preset dropdown and
 * an aspect ratio dropdown".
 *   PRESETS [{id, label, w, h}]   ASPECTS [{id, label, r}] (r = w / h; "free" = none)
 *   normalize(f) -> {w, h} even, 64 .. 8192 - or null (the V1 video's own size)
 *   heightFor(w, r) / widthFor(h, r) - even numbers;  aspectOf(w, h) -> the aspect id within 1 % or "free"
 *   presetOf(w, h) -> the preset id or ""
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.H3FrameSize = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var PRESETS = [
    { id: "uhd", label: "4K UHD 3840 × 2160", w: 3840, h: 2160 }, { id: "qhd", label: "QHD 2560 × 1440", w: 2560, h: 1440 },
    { id: "fhd", label: "Full HD 1920 × 1080", w: 1920, h: 1080 }, { id: "hd", label: "HD 1280 × 720", w: 1280, h: 720 },
    { id: "sd", label: "SD 854 × 480", w: 854, h: 480 }, { id: "360", label: "640 × 360", w: 640, h: 360 },
    { id: "v4k", label: "Vertical 4K 2160 × 3840", w: 2160, h: 3840 }, { id: "vfhd", label: "Vertical HD 1080 × 1920 (Reels, Shorts, TikTok)", w: 1080, h: 1920 },
    { id: "vhd", label: "Vertical 720 × 1280", w: 720, h: 1280 }, { id: "sq", label: "Square 1080 × 1080", w: 1080, h: 1080 },
    { id: "p45", label: "Portrait 4:5 1080 × 1350", w: 1080, h: 1350 }, { id: "uw", label: "Ultra-wide 21:9 2560 × 1080", w: 2560, h: 1080 },
    { id: "cine", label: "Cinema 2.39:1 2048 × 858", w: 2048, h: 858 }, { id: "dci", label: "DCI 2K 2048 × 1080", w: 2048, h: 1080 },
    { id: "43", label: "4:3 1440 × 1080", w: 1440, h: 1080 }, { id: "x768", label: "4:3 1024 × 768", w: 1024, h: 768 },
  ];
  var ASPECTS = [{ id: "free", label: "Free", r: 0 }, { id: "16:9", label: "16:9", r: 16 / 9 }, { id: "9:16", label: "9:16", r: 9 / 16 }, { id: "1:1", label: "1:1", r: 1 },
    { id: "4:5", label: "4:5", r: 4 / 5 }, { id: "4:3", label: "4:3", r: 4 / 3 }, { id: "3:2", label: "3:2", r: 3 / 2 }, { id: "2:3", label: "2:3", r: 2 / 3 },
    { id: "21:9", label: "21:9", r: 21 / 9 }, { id: "2.39:1", label: "2.39:1", r: 2.39 }, { id: "1.85:1", label: "1.85:1", r: 1.85 }];
  var even = function (v) { return Math.max(64, Math.min(8192, Math.round(v / 2) * 2)); };
  function normalize(f) {
    if (!f || typeof f !== "object") return null;
    var w = Number(f.w), h = Number(f.h);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 16 || h < 16) return null;
    return { w: even(w), h: even(h) };
  }
  var heightFor = function (w, r) { return r > 0 ? even(w / r) : null; };
  var widthFor = function (h, r) { return r > 0 ? even(h * r) : null; };
  function aspectOf(w, h) {
    var r = w / h; if (!(r > 0)) return "free";
    for (var i = 1; i < ASPECTS.length; i++) if (Math.abs(ASPECTS[i].r - r) / ASPECTS[i].r < 0.01) return ASPECTS[i].id;
    return "free";
  }
  function presetOf(w, h) { for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].w === w && PRESETS[i].h === h) return PRESETS[i].id; return ""; }
  return { PRESETS: PRESETS, ASPECTS: ASPECTS, normalize: normalize, heightFor: heightFor, widthFor: widthFor, aspectOf: aspectOf, presetOf: presetOf, even: even };
});
