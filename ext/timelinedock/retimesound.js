/* bitGen Studio — ext/timelinedock/retimesound.js (2.417.0): the SOUND of a reversed / ramped clip on the canvas
 * (window.TlRetimeSound). Since 2.406.0 such a clip was "seen, not heard" in the preview (browsers cannot play
 * backwards; a ramp changes speed under the clip). Now the server renders its sound once with the compile's own retime
 * (lib/retimeSound.js -> scripts/clipfx_render.py soundprev) and the canvas plays that file in step with the playhead
 * (canvas.js syncMedia: time 0 = the clip's start), through the clip's track in the 🎚 mixer.
 * Tim: "continue with the next part please the gap is getting smaller - soon bitgen should be superior". */
(function () {
  "use strict";
  var M = {};                                   // key -> {state, url, error}
  var A = new Map();                            // clip -> its <audio>
  function cfg(c) {
    if (!c || !c.name || c.text || c.m3d || c.adjust || !c.fx) return null;
    var F = window.H3ClipFx;
    if (!F || !F.retimed(c.fx) || !(c.fx.reverse || c.fx.ramp || c.fx.remap)) return null;   // 2.501.0: + a time remap
    return { name: c.name, in: +c.in || 0, out: c.out != null ? +c.out : null, dur: c.dur != null ? +c.dur : null,
             fx: { speed: c.fx.speed, reverse: c.fx.reverse, ramp: c.fx.ramp, remap: c.fx.remap } };
  }
  function keyOf(k) { return k.name + "|" + k.in.toFixed(3) + "|" + (k.out == null ? "" : k.out.toFixed(3)) + "|" + JSON.stringify(k.fx); }
  function ask(k, key) {
    var r = M[key] = M[key] || { state: "working", url: "", error: "" };
    fetch("/api/clipfx/retimesound", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(k) })
      .then(function (x) { return x.json(); }).then(function (j) {
        if (!j.ok) { r.state = "failed"; r.error = j.error || "failed"; return; }
        r.state = j.state; r.url = j.url; r.error = j.error || "";
        if (r.state === "working") setTimeout(function () { ask(k, key); }, 1000);
      }).catch(function (e) { r.state = "failed"; r.error = e.message || String(e); });
  }
  /** the rendered sound's URL for this clip when it is made (else null - asked for once) */
  function url(c) {
    var k = cfg(c); if (!k) return null;
    var key = keyOf(k), r = M[key];
    if (!r) { ask(k, key); return null; }
    return r.state === "ready" ? r.url : null;
  }
  function state(c) { var k = cfg(c); if (!k) return null; var r = M[keyOf(k)]; return r ? { state: r.state, error: r.error } : null; }
  function stop(c) { var a = A.get(c); if (a && !a.paused) a.pause(); }
  /** keep the clip's sound in step: t = the playhead, on = it should be heard, Ly = its layer, R = the shuttle rate */
  function sync(c, t, on, Ly, R) {
    var u = url(c);                             // asked for even while paused - ready by the time it plays
    var a = A.get(c);
    if (!on || !u) { if (a && !a.paused) a.pause(); return; }
    if (!a || a._url !== u) { if (a) a.pause(); a = new Audio(); a.preload = "auto"; a._url = u; a.src = u; A.set(c, a); }
    var want = Math.max(0, t - (c.start || 0)), rate = Math.max(0.0625, Math.min(16, R || 1));
    a.volume = Math.max(0, Math.min(1, Ly && Ly.L && Ly.L.volume != null ? +Ly.L.volume : 1));
    if (window.TlMixer) TlMixer.apply(a, Ly.lk, Ly.L, 1);
    if (Math.abs((a.playbackRate || 1) - rate) > 1e-3) { try { a.playbackRate = rate; } catch (e) { /* out of range */ } }
    if (Math.abs(a.currentTime - want) > 0.2 * Math.max(1, rate)) { try { a.currentTime = want; } catch (e) { /* not ready */ } }
    if (a.paused) a.play().catch(function () { /* autoplay */ });
  }
  function stopAll() { A.forEach(function (a) { if (!a.paused) a.pause(); }); }
  /* asked for as soon as the playhead stands on such a clip (every canvas paint) - ready before ▶ */
  function prefetch() {
    try {
      var S = TlCanvas.state;
      TlCanvas.stack().forEach(function (Ly) {
        if (Ly.kind === "img") return;
        Ly.clips.forEach(function (c) { if (c.fx && (c.fx.reverse || c.fx.ramp || c.fx.remap) && TlCanvas.at(c, Ly.kind, S.t)) url(c); });
      });
    } catch (e) { /* the timeline is loading */ }
  }
  function boot() {
    if (!(window.TlCanvas && TlCanvas.onDraw && TlCanvas.stack)) { setTimeout(boot, 300); return; }
    TlCanvas.onDraw(prefetch);
  }
  window.TlRetimeSound = { url: url, state: state, sync: sync, stop: stop, stopAll: stopAll, _M: M, _A: A };
  boot();
})();
