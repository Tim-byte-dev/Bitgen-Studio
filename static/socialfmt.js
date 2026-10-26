/* bitGen Studio — static/socialfmt.js (2.600.0): Basic Settings ▸ Format ▸ 📱 SOCIAL MEDIA (window.H3SocialFmt).
 *
 * Tim (verbatim): "please ad the social media video presets to the basic settings dropdown as well for quick access".
 *   Picking Reels / Stories 9:16, Facebook feed 4:5, Square 1:1 or Landscape 16:9 also sets Aspect, so the model renders
 *   that shape (the feed's 4:5 renders 3:4 and is cut to 4:5); "the render's own shape" leaves Aspect alone. The line
 *   under Format says what happens: the finished MP4 is made ready for Facebook / Instagram / TikTok (lib/socialFormat.js
 *   -> scripts/social.py: H.264 High 8-bit, AAC 48 kHz stereo, steady fps, faststart, 1080 on the short side at most).
 * Pure (Node): ASPECT, words(value). */
(function (root) {
  "use strict";
  var ASPECT = { social_9x16: "9:16", social_4x5: "3:4", social_1x1: "1:1", social_16x9: "16:9" };
  var NAME = { social_9x16: "9:16 (Reels / Stories)", social_4x5: "4:5 (the Facebook feed - rendered 3:4, cut to 4:5)", social_1x1: "1:1 (square)",
               social_16x9: "16:9 (landscape)", social: "its own shape" };
  function words(v) {
    if (!NAME[v]) return "";
    return "📱 When it is rendered the MP4 is made ready for Facebook / Instagram / TikTok: " + NAME[v]
      + ", H.264 + AAC, a steady frame rate, 1080 on the short side at most - the log says \"ready for …\"";
  }
  if (typeof module !== "undefined" && module.exports && typeof document === "undefined") { module.exports = { ASPECT: ASPECT, words: words }; return; }
  var $ = function (id) { return document.getElementById(id); };
  function paint() {
    var f = $("format"), line = $("formatSocial"); if (!f || !line) return;
    var w = words(f.value);
    line.hidden = !w; line.textContent = w;
  }
  function onPick() {
    var f = $("format"), ar = $("arSel"); if (!f) return;
    var want = ASPECT[f.value];
    if (want && ar && ar.value !== want && Array.prototype.some.call(ar.options, function (o) { return o.value === want; })) {
      ar.value = want; ar.dispatchEvent(new Event("change", { bubbles: true }));
    }
    paint();
  }
  function boot() {
    var f = $("format"); if (!f || f.dataset.h3soc) return;
    f.dataset.h3soc = "1";
    f.addEventListener("change", onPick);
    paint();
    setInterval(paint, 2000);            // a project / preset that sets Format from elsewhere
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3SocialFmt = { ASPECT: ASPECT, words: words, paint: paint };
})(typeof window !== "undefined" ? window : globalThis);
