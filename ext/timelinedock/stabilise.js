/* bitGen Studio — ext/timelinedock/stabilise.js (2.413.0): the canvas's STEADY PREVIEW (window.TlStab). A clip with
 * ✨ stabilise on asks the server for its stabilised file (lib/stabilise.js - the whole source, the clip's smoothing /
 * lock) and, once it is made, the canvas reads that file instead (canvas.js vidUrl) - the same times, steadied.
 * Tim: "do the smaller jobs and complete the 10 partly done jobs" (Stabilise: "the canvas shows the shot as it is"). */
(function () {
  "use strict";
  var M = {};                                   // key -> {state, url, error, at}
  function cfg(c) {
    var s = c && c.fx && c.fx.vfx && c.fx.vfx.stabilise;
    if (!s || !c.name || c.text || c.m3d || c.adjust) return null;
    var o = s && typeof s === "object" ? s : {};
    return { smooth: o.smooth != null ? +o.smooth : 50, lock: !!o.lock };
  }
  function keyOf(c, k) { return c.name + "|" + Math.round(k.smooth) + "|" + (k.lock ? 1 : 0); }
  function ask(c, k, key) {
    var r = M[key] = M[key] || { state: "working", url: "", error: "", at: 0 };
    r.at = Date.now();
    fetch("/api/clipfx/stabilise", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: c.name, smooth: k.smooth, lock: k.lock }) })
      .then(function (x) { return x.json(); }).then(function (j) {
        if (!j.ok) { r.state = "failed"; r.error = j.error || "failed"; paint(); return; }
        var was = r.state; r.state = j.state; r.url = j.url; r.error = j.error || "";
        if (r.state === "working") setTimeout(function () { ask(c, k, key); }, 1500);
        if (r.state !== was) { paint(); if (r.state === "ready" && window.TlCanvas) TlCanvas.mark(); }
      }).catch(function (e) { r.state = "failed"; r.error = e.message || String(e); paint(); });
  }
  /** the steady file's URL for this clip when it is made (else null - asked for once) */
  function url(c) {
    var k = cfg(c); if (!k) return null;
    var key = keyOf(c, k), r = M[key];
    if (!r) { ask(c, k, key); return null; }
    return r.state === "ready" ? r.url : null;
  }
  function state(c) { var k = cfg(c); if (!k) return null; var r = M[keyOf(c, k)]; return r ? { state: r.state, error: r.error } : { state: "working", error: "" }; }
  function paint() {
    var el = document.getElementById("tfxStabState"); if (!el) return;
    var c = el._clip, s = c ? state(c) : null;
    el.textContent = !s ? "" : s.state === "ready" ? "✓ the canvas shows it steadied" : s.state === "failed" ? "the canvas shows it as shot (" + s.error + ")" : "⏳ steadying the preview…";
  }
  window.TlStab = { url: url, state: state, paint: paint, _M: M };
})();
