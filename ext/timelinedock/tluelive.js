/* bitGen Studio — ext/timelinedock/tluelive.js (2.590.0): 📺 THE UNREAL VIEW in the timeline, window.TlUELive.
 *
 * Tim (verbatim): "show the unreal window in timeline and image-editor when selected" - picked: a live camera view.
 *   A floating window over the timeline's preview row (static/uelive.js floatBox + view): what the SELECTED Unreal clip
 *   (UNREAL ▸ Unreal Layer / MetaHuman Layer / Unreal Camera) sees in Unreal at the PLAYHEAD, refreshed frame after frame
 *   - an Unreal camera clip between its keys, a MetaHuman in its pose at that time, a Level Sequence at that frame
 *   (bitGen Bridge 1.5.0 opens it in Sequencer there). Picking such a clip shows it (☑ auto in its bar), another clip
 *   hides it again; UNREAL ▸ Bridge ▸ 📺 Unreal View shows / hides it by hand. Its title drags it, its corner sizes it.
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  var tries = 0;
  function boot() {
    if (!$("tlStage")) return;
    if (!(window.TlCanvas && window.UELive && window.UEBridge && window.TlUnreal)) { if (++tries < 400) setTimeout(boot, 100); return; }
    start();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  function start() {
    var C = window.TlCanvas, S = C.state, L = window.UELive;
    var box = L.floatBox($("tlStage"), { id: "tlUELive", title: "📺 Unreal View - the selected clip at the playhead" });
    var bar = document.createElement("label"); bar.style.cssText = "display:flex;gap:5px;align-items:center;font-size:11px;margin:0 0 4px;color:var(--dim,#999)";
    bar.innerHTML = '<input type="checkbox" id="tlUELiveAuto"> show it when an Unreal clip is picked';
    var host = document.createElement("div"); host.style.cssText = "height:calc(100% - 22px)";
    box.body.appendChild(bar); box.body.appendChild(host);
    var auto = $("tlUELiveAuto"); auto.checked = L.store.get("tl.auto", true) !== false;
    auto.onchange = function () { L.store.set("tl.auto", auto.checked); };
    /* 2.618.0: an Unreal clip whose layer is hidden (👁 off) - or that was deleted - is not shown */
    function live(s) {
      if (!s || !s.c) return false;
      var Ly = (C.layerOf && C.layerOf(s.c)) || null; if (!Ly) return false;   // not on any layer = deleted
      var Lr = Ly.L || {}; return Lr.visible !== false && !s.c.hidden;
    }
    function sel() { var s = C.selClip && C.selClip(); return s && s.c && s.c.ue && live(s) ? s.c : null; }
    var shownC = null;
    function request() { var c = sel(); return c ? L.clipRequest(c, S.t || 0, window.UEBridge.framing, window.TlUnreal.keyAt) : null; }
    var V = L.view(host, { request: request });
    var lastC = null, revealed = false;
    setInterval(function () {
      var c = sel();
      // 2.618.0: the clip it showed was deleted or its layer hidden -> the live view closes and the window hides
      if (shownC && shownC !== c && !(C.layerOf && C.layerOf(shownC) && ((C.layerOf(shownC).L || {}).visible !== false))) {
        V.clear(C.layerOf && C.layerOf(shownC) ? "the Unreal layer is hidden - its view is closed" : "the Unreal clip was deleted - its view is closed");
        box.show(false); revealed = false; shownC = null;
        try { if (window.H3TestEvent) window.H3TestEvent("ue_view_closed", "timeline"); } catch (e) { /* the 🧪 list */ }
      }
      if (c) shownC = c;
      if (c !== lastC) {
        if (c && auto.checked && !box.shown()) { box.show(true); revealed = true; }
        if (!c && revealed) { box.show(false); revealed = false; }
        lastC = c;
      }
      var want = !!c && box.shown();
      if (want && !V.running()) V.start(); else if (!want && V.running()) V.stop();
    }, 400);
    window.TlUELive = { box: box, view: V, request: request, toggle: function () { box.show(!box.shown()); revealed = false; return box.shown(); } };
  }
})();
