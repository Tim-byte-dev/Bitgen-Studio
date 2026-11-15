/* bitGen Studio — static/podroute.js (2.763.2): A RENDER THAT GOES TO A RUNPOD POD skips this computer's ComfyUI (H3PodRoute).
 * Tim (his log): "[comfy] launching via run.bat … [generate] Image · house — that one failed." - in pod mode the page still
 * started his own ComfyUI and checked the style against ITS model lists and dropdowns before sending the render, and the
 * failure said nothing.
 *   isPod(mode, styleId) -> Promise<bool>   GET /api/stylepods/route (lib/stylePods.js willUsePod) - true = the render goes to
 *                                          a pod: index.html then does not start this computer's ComfyUI (ensureComfyReady)
 *                                          nor check the style against its dropdowns (comfyPreflight); the server's "models
 *                                          not found" check skips it too (its files are put on the pod)
 *   why(jobId) -> Promise<[lines]>         a failed render's reason from its log ([pod] / [gpu] / errors, the last few) - the
 *                                          queue's "that one failed" line is followed by them
 * Pure (Node: scripts/test-podroute7632.js): reasonLines.
 */
(function (root) {
  "use strict";
  /** the lines of a job's log that say why it failed (pure): [pod] / [gpu] lines + error-looking ones, the last `n` */
  function reasonLines(log, n) {
    var keep = (log || []).filter(function (l) {
      l = String(l || "");
      return /^\[(pod|gpu)\]/.test(l) || /\b(error|Error|ERROR|refused|not rendered|could not|failed|Traceback|exited with code)\b/.test(l);
    });
    return keep.slice(-(n || 4)).map(function (l) { return String(l).slice(0, 300); });
  }
  var pure = { reasonLines: reasonLines };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }
  /** 2.787.0: Basic Settings' picks as they would be sent - a "<pod>/<file>" model / LoRA or ☐ Remote sends the render to a pod */
  function picks(mode) {
    var nm = function (l) { return typeof l === "string" ? l : (l && (l.path || l.name || l.file)) || ""; };
    try {
      if (mode === "image") { var b = typeof root.imgBasicsBody === "function" ? root.imgBasicsBody({}) : {}; return { model: b.model || "", loras: (b.extra_loras || []).map(nm).filter(Boolean) }; }
      if (mode !== "music" && root.H3Basic && H3Basic.collect) { var v = H3Basic.collect(); return { model: v.override ? v.model || "" : "", loras: (v.loras || []).map(nm).filter(Boolean) }; }
    } catch (e) { /* the style decides */ }
    return { model: "", loras: [] };
  }
  function isPod(mode, styleId) {
    var pk = picks(mode);
    if (!styleId && !pk.model && !pk.loras.length) return Promise.resolve(false);
    return root.fetch("/api/stylepods/route?mode=" + encodeURIComponent(mode || "") + "&style_id=" + encodeURIComponent(styleId || "")
      + (pk.model ? "&model=" + encodeURIComponent(pk.model) : "") + (pk.loras.length ? "&loras=" + encodeURIComponent(pk.loras.join("|")) : ""))
      .then(function (r) { return r.json(); }).then(function (j) { return !!(j && j.pod); }).catch(function () { return false; });
  }
  function why(jobId) {
    if (!jobId) return Promise.resolve([]);
    return root.fetch("/api/jobs/" + encodeURIComponent(jobId) + "?log_from=0").then(function (r) { return r.json(); })
      .then(function (j) { return reasonLines((j && j.log) || [], 4); }).catch(function () { return []; });
  }
  root.H3PodRoute = Object.assign({ isPod: isPod, why: why }, pure);
})(typeof window !== "undefined" ? window : globalThis);
