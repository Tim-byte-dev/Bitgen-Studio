/* bitGen Studio — static/gpuspeed.js (2.784.0): HOW FAST EACH RUNPOD GPU IS FOR DIFFUSION, AND THE CREATE-POD LIST'S SORT
 * (window.H3GpuSpeed; lib/pods.js gpuView adds `speed` to every GPU with it - the same table on both sides).
 *
 * Tim (verbatim): "add a sort order to the top of the gpu selection list in create new pod, by fastest, by cheapest"
 *   (after: "runpod seems very slow A6000 is slower than my 5090 ... over 2x faster, same model same settings")
 *
 *   SPEED   bitGen's own rough order for diffusion / video renders (MiniMax H3, Wan, LTX, FLUX ...): an RTX 5090 = 100. Written
 *           from each card's generation, tensor-core throughput (FP8 where the card has it) and memory bandwidth - a guide for
 *           picking, not a benchmark. Checked against Tim's own numbers: an RTX A6000 took ~2.2x his 5090's time (45 vs 100).
 *           A card not in the table = 0 ("speed not known") - sorted after the known ones when sorting by speed.
 *   speedOf(name)        -> 0..300
 *   sortGpus(list, by)   by "fast" | "cheap": GPUs offered first, then fastest (cheaper first on a tie) or cheapest (faster
 *                        first on a tie); a new array
 *   speedText(n)         "~0.45× RTX 5090" | "speed not known"
 *   pick(list, by)       the GPU picked when the order changes: the first offered with 20 GB or more (else the first offered)
 * Pure (Node: scripts/test-gpusort784.js).
 */
(function (root) {
  "use strict";
  // [pattern on RunPod's GPU name / id, relative speed] - the first match wins (the more specific first)
  var SPEED = [
    [/\bB200\b/i, 260], [/\bH200\b/i, 190], [/\bH100\b.*(SXM|HBM3)/i, 180], [/\bH100\b.*\bNVL\b/i, 160], [/\bH100\b/i, 140],
    [/RTX PRO 6000/i, 115], [/RTX 5090/i, 100], [/\bL40S\b/i, 85], [/RTX 6000 Ada/i, 80], [/RTX 5080/i, 60],
    [/RTX 4090/i, 75], [/\bA100\b.*SXM/i, 75], [/\bA100\b/i, 65], [/\bL40\b/i, 65], [/RTX 4080/i, 50], [/RTX 5000 Ada/i, 50],
    [/RTX 4070 Ti/i, 40], [/RTX (A6000|6000)\b|\bA6000\b/i, 45], [/\bA40\b/i, 40], [/RTX 3090 Ti/i, 42], [/RTX 3090/i, 40],
    [/RTX 4000 Ada/i, 25], [/RTX A5000|\bA5000\b/i, 30], [/RTX A4500|\bA4500\b/i, 25], [/\bL4\b/i, 25], [/\bV100\b/i, 25],
    [/RTX A4000|\bA4000\b/i, 20], [/RTX 3080/i, 30], [/RTX 2000 Ada/i, 12], [/\bT4\b/i, 8],
  ];
  function speedOf(name) {
    var s = String(name || "");
    for (var i = 0; i < SPEED.length; i++) if (SPEED[i][0].test(s)) return SPEED[i][1];
    return 0;
  }
  function num(x, d) { return x == null || isNaN(+x) ? d : +x; }
  function sortGpus(list, by) {
    var cheap = by === "cheap";
    return (list || []).slice().sort(function (a, b) {
      var o = (b.offered ? 1 : 0) - (a.offered ? 1 : 0); if (o) return o;
      var sa = num(a.speed, speedOf(a.name || a.id)), sb = num(b.speed, speedOf(b.name || b.id)), pa = num(a.price, 1e9), pb = num(b.price, 1e9);
      if (cheap) return (pa - pb) || (sb - sa);
      return (sb - sa) || (pa - pb);
    });
  }
  function speedText(n) { return n > 0 ? "~" + parseFloat((n / 100).toFixed(2)) + "× RTX 5090" : "speed not known"; }
  function pick(list, by) {
    var l = sortGpus(list, by);
    return l.find(function (g) { return g.offered && g.memory >= 20; }) || l.find(function (g) { return g.offered; }) || null;
  }
  var api = { SPEED: SPEED, speedOf: speedOf, sortGpus: sortGpus, speedText: speedText, pick: pick };
  if (typeof module === "object" && module.exports) { module.exports = api; return; }
  root.H3GpuSpeed = api;
})(typeof window !== "undefined" ? window : globalThis);
