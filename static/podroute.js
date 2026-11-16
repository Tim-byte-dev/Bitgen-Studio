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
  /** 2.807.0 (Tim's log from a Blender-scene render: "cannot reach ComfyUI at http://127.0.0.1:8188 ... actively refused it"):
   *  the image editor's ✨ AI and the preview's 🎨 Change style queued their jobs without starting ComfyUI (the prompt docker's
   *  Generate does - index.html ensureComfyReady). ready(mode, styleId) -> Promise<true>: a render that goes to a pod = at
   *  once; else this computer's ComfyUI is started (POST /api/comfy/ensure) and waited for (5 min at most, the status bar
   *  says "starting"). No box: one that cannot start is said in the console and the job still goes in (its worker says why;
   *  a ComfyUI that comes up meanwhile renders it). */
  function say(t) { try { if (typeof root.logLine === "function") root.logLine("[comfy] " + t); } catch (e) { /* no console */ } }
  function status() { return root.fetch("/api/comfy/status").then(function (r) { return r.json(); }); }
  function waitUp() {
    var until = Date.now() + 300000, dead = 0;
    return new Promise(function (done) {
      (function tick() {
        if (Date.now() > until) { say("ComfyUI did not come up within 5 minutes - the render goes in anyway (see the console)"); done(true); return; }
        setTimeout(function () {
          status().then(function (st) {
            try { if (typeof root.comfyPaint === "function") root.comfyPaint(st); } catch (e) { /* the status bar */ }
            if (st.reachable) { done(true); return; }
            if (!st.starting && !st.managed && ++dead >= 8) { say("ComfyUI exited while starting - see its output above"); done(true); return; }
            if (st.starting || st.managed) dead = 0;
            tick();
          }, function () { tick(); });
        }, 1500);
      })();
    });
  }
  function ready(mode, styleId) {
    return isPod(mode, styleId).then(function (pod) {
      if (pod) return true;
      return status().then(function (st) {
        if (!st || st.reachable || st.backend === "sdcpp") return true;
        say("starting ComfyUI for this render…");
        return root.fetch("/api/comfy/ensure", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force: true }) })
          .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "could not start ComfyUI"); return j; }); })
          .then(function (j) { if (j && (j.already_running || j.url && j.reachable)) return true; try { if (typeof root.followComfy === "function") root.followComfy(); } catch (e) { /* the console */ } return waitUp(); },
                function (e) { say("ComfyUI is not running and could not be started (" + e.message + ") - Settings ▸ ComfyUI"); return true; });
      }, function () { return true; });
    }, function () { return true; });
  }
  root.H3PodRoute = Object.assign({ isPod: isPod, why: why, ready: ready }, pure);
})(typeof window !== "undefined" ? window : globalThis);
