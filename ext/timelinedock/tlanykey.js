/* bitGen Studio — ext/timelinedock/tlanykey.js (2.516.0): ◇ KEYFRAMES ON ANY PROPERTY - the buttons. window.TlAnyKey.
 *
 * Tim (verbatim): "finish the last row" - AFTER-EFFECTS-GAP.md: "Keyframes on any property ... every effect setting,
 * mask points, text settings left".
 *
 *   ◇ beside a setting   a key of that setting at the playhead (its value now); then a change of it anywhere on the
 *                        clip's length keys it there too (◆ = a key at the playhead - a click takes it away; Alt+click
 *                        = all its keys away). A keyed setting shows its value at the playhead (an orange edge).
 *   Which settings       🎨 Colour (exposure, contrast, saturation, temperature, tint, hue, LUT mix; the colour dialog's
 *                        wheel brightness and HSL ranges), the effects (lens, warp amount / size / speed, the keyer's
 *                        match / edge / spill), ✒ masks (feather, expansion, opacity - the mask PATHS key with their own
 *                        ◇ as before), text (size, outline), ⏱ time (shutter, samples, posterize, echo) - static/anykeys.js
 *                        RULES. Position, scale, rotation, opacity, generators, rays, distortions, shapes, text animators,
 *                        3D and blur / sharpen / glow / vignette / grain / crop were keyable already.
 *   📈 Graph Editor      each keyed setting is in its list (value / speed graph, eases, Bézier handles)
 *   ⚙ Compile            colour: the look re-made at the keys and cross-faded; lens / warp / keyer animated by ffmpeg
 *                        itself (V1 and video layers); masks: the masks' video; picture / text layers and video layers'
 *                        time effects: made by the page (TlVBake "anykeys")
 * Pure: static/anykeys.js (H3AnyKeys); here the page only. PATHS (input -> path): pathOf.
 */
(function () {
  "use strict";
  var IDS = { tfxLutMix: "fx.lut_mix", tfxLens: "fx.vfx.lens", tfxWarpA: "fx.vfx.warp.amount", tfxWarpS: "fx.vfx.warp.size", tfxWarpV: "fx.vfx.warp.speed",
    tfxKeyS: "fx.vfx.key.similarity", tfxKeyB: "fx.vfx.key.blend", tfxKeyP: "fx.vfx.key.spill", tlpSize: "text.size", tlpStrokeW: "text.strokeW",
    tlpTmSh: "tm.shutter", tlpTmSa: "tm.samples", tlpTmPo: "tm.post", tlpTmEn: "tm.echo.n", tlpTmEd: "tm.echo.dt", tlpTmEi: "tm.echo.i0", tlpTmEf: "tm.echo.decay",
    tcpL_lift: "fx.grade.wheels.lift.l", tcpL_gamma: "fx.grade.wheels.gamma.l", tcpL_gain: "fx.grade.wheels.gain.l" };
  /** the clip setting an input edits (or null) */
  function pathOf(el) {
    if (!el || el.tagName !== "INPUT") return null;
    if (el.id && IDS[el.id]) return IDS[el.id];
    if (el.hasAttribute("data-g") && /^(exposure|contrast|saturation|temperature|tint|hue)$/.test(el.getAttribute("data-g"))) return "fx.grade." + el.getAttribute("data-g");
    var mk = el.getAttribute("data-mkn"); if (mk && /^\d{1,2}:(feather|expand|op)$/.test(mk)) { var a = mk.split(":"); return "masks." + a[0] + "." + a[1]; }
    if (el.hasAttribute("data-i") && el.hasAttribute("data-k") && el.closest && el.closest("#tcpHsl")) return "fx.grade.hsl." + el.getAttribute("data-i") + "." + el.getAttribute("data-k");
    return null;
  }
  window.TlAnyKey = { ready: false, pathOf: pathOf, IDS: IDS };
  function ready() { try { return !!(window.TlCanvas && TlCanvas.onProps && TlCanvas.onDraw && TlCanvas.selClip && window.H3AnyKeys && window.H3Keyframes && window.TlParent && typeof tl === "object" && tl); } catch (e) { return false; } }
  function boot() { if (ready()) install(); else setTimeout(boot, 300); }
  boot();
  function install() {
    if (window.TlAnyKey.ready) return;
    var C = window.TlCanvas, KF = window.H3Keyframes, A = window.H3AnyKeys, FPS = KF.FPS || 24;
    function say(t) { try { C.say(t); } catch (e) { /* fine */ } }
    var sel = function () { var s = C.selClip(); return s && s.c && s.Ly && s.Ly.kind !== "aud" && !s.c.adjust ? s : null; };   // an adjustment layer: not yet
    var tauOf = function (c) { return Math.max(0, (C.state.t || 0) - (c.start || 0)); };
    var r4 = function (v) { return Math.round(v * 10000) / 10000; };
    var keysOf = function (c, p) { return (c.kf || []).filter(function (k) { return k["@" + p] != null; }); };
    var hereKey = function (c, p) { var t = tauOf(c); return keysOf(c, p).filter(function (k) { return Math.abs(k.at - t) < 0.5 / FPS; })[0] || null; };
    var css = document.createElement("style");
    css.textContent = ".akb{padding:0 3px !important;margin-left:2px;min-width:0;line-height:1.1;font-size:.72rem;background:transparent;border:1px solid transparent;color:var(--dim,#9a917f);cursor:pointer}"
      + ".akb:hover{border-color:var(--line,#3a342a)}.akb.on{color:var(--tiger,#f59e2c)}input.akon{outline:1px solid var(--tiger,#f59e2c);outline-offset:1px}";
    document.head.appendChild(css);
    function kindOf(c) { var x = (TlParent.all() || []).filter(function (y) { return y.c === c; })[0]; return x ? x.kind : (tl.video || []).indexOf(c) >= 0 ? "v1" : ""; }
    function changed(c) {
      delete c.bakeSig; delete c.vbakeSig; delete c.mbakeSig;
      if (typeof tlSave === "function") tlSave();
      try { C.keysChanged(c); } catch (e) { /* older */ }
      C.mark();
      if (window.TlGraph && TlGraph.addProp) A.keyed(c).forEach(function (p) { TlGraph.addProp("@" + p, A.label(p), A.uiK(p), ""); });
      if (window.TlGraph && TlGraph.paint) { try { TlGraph.paint(); } catch (e) { /* closed */ } }
    }
    /** a key of path at the playhead with value v (the stored number) */
    function keyAt(c, p, v) { var o = {}; o["@" + p] = r4(v); c.kf = KF.set(c.kf, tauOf(c), o, FPS); }
    function unkeyAt(c, p) {
      var t = tauOf(c), o = {}; o["@" + p] = undefined;
      c.kf = KF.set(c.kf, t, o, FPS).filter(function (k) { return Object.keys(k).some(function (q) { return q !== "at" && q !== "ease" && q !== "bz" && q !== "to" && q !== "ti"; }); });
    }
    function unkeyAll(c, p) {
      c.kf = (c.kf || []).map(function (k) { var o = Object.assign({}, k); delete o["@" + p]; return o; })
        .filter(function (k) { return Object.keys(k).some(function (q) { return q !== "at" && q !== "ease" && q !== "bz" && q !== "to" && q !== "ti"; }); });
    }
    var valueNow = function (c, p) { var st = A.get(c, p); return keysOf(c, p).length ? KF.value(c.kf, tauOf(c), "@" + p, st == null ? 0 : +st) : st; };
    function paintOne(el, s) {
      var p = el._akPath, c = s.c, keyed = keysOf(c, p).length > 0, here = !!hereKey(c, p), b = el._akBtn;
      if (b) { b.textContent = here ? "◆" : "◇"; b.classList.toggle("on", keyed); b.title = (here ? "A key of " + A.label(p) + " here - click: take it away" : "Key " + A.label(p) + " at the playhead") + (keyed ? " (Alt+click: all its keys away)" : ""); }
      el.classList.toggle("akon", keyed);
      if (keyed && document.activeElement !== el) { var v = valueNow(c, p); if (v != null && Number.isFinite(+v)) el.value = String(Math.round(+v * A.uiK(p) * 1000) / 1000); }
    }
    var LAST = { t: -1, c: null };
    function enhance(root) {
      var s = sel(); if (!s) return;
      var kind = s.Ly.kind, list = (root || document).querySelectorAll("#tlProps input, .tlp-fx input, [class^='tlp-'] input, #tcpHsl input, input[id^='tcpL_'], input[data-mkn], input[data-g]");
      Array.prototype.forEach.call(list, function (el) {
        var p = el._akPath || pathOf(el); if (!p || !A.allowed(p, kind)) return;
        if (!el._akPath) {
          el._akPath = p;
          var b = document.createElement("button"); b.type = "button"; b.className = "ghost akb"; b.setAttribute("data-akey", p);
          b.addEventListener("click", function (e) {
            e.preventDefault(); e.stopPropagation();
            var S2 = sel(); if (!S2) return; var c = S2.c;
            if (e.altKey) { unkeyAll(c, p); say("◇ " + A.label(p) + ": its keys taken away"); }
            else if (hereKey(c, p)) { unkeyAt(c, p); say("◇ " + A.label(p) + ": the key here taken away"); }
            else { var v = +el.value / A.uiK(p); if (!Number.isFinite(v)) v = +(valueNow(c, p) || 0); keyAt(c, p, v); say("◆ " + A.label(p) + " keyed at " + tauOf(c).toFixed(2) + " s - move the playhead and change it for the next key"); }
            changed(c); paintOne(el, S2);
          });
          el._akBtn = b;
          (el.nextSibling && el.nextSibling.nodeType === 1 && /fxv|fx-dim/.test(el.nextSibling.className || "") ? el.nextSibling : el).insertAdjacentElement("afterend", b);
        }
        paintOne(el, s);
      });
      LAST.t = C.state.t; LAST.c = s.c;
    }
    // a change of a keyed setting = a key at the playhead (before the setting's own handler writes its plain value)
    var onEdit = function (e) {
      var el = e.target, p = el && el._akPath; if (!p) return;
      var s = sel(); if (!s || !keysOf(s.c, p).length) return;
      var v = +el.value / A.uiK(p); if (!Number.isFinite(v)) return;
      keyAt(s.c, p, v); changed(s.c); paintOne(el, s);
    };
    document.addEventListener("input", onEdit, true);
    document.addEventListener("change", onEdit, true);
    C.onProps(function (Pn) { setTimeout(function () { enhance(document); }, 0); void Pn; });
    var pend = 0;
    try { new MutationObserver(function () { if (pend) return; pend = requestAnimationFrame(function () { pend = 0; enhance(document); }); }).observe(document.body, { childList: true, subtree: true }); } catch (e) { /* old */ }
    // the playhead moved: the keyed settings show their value there
    C.onDraw(function () {
      var s = sel(); if (!s || (LAST.t === C.state.t && LAST.c === s.c)) return;
      LAST.t = C.state.t; LAST.c = s.c;
      Array.prototype.forEach.call(document.querySelectorAll("input.akon, button.akb"), function (x) { var el = x.tagName === "BUTTON" ? x.previousElementSibling : x; while (el && !el._akPath) el = el.previousElementSibling; if (el && el._akPath) paintOne(el, s); });
    });
    // ⚙ Compile: what only the page can draw is baked by it (a picture layer with any keyed setting; a video layer's time)
    if (window.TlVBake) TlVBake.register("anykeys", function (c) { return A.has(c) && A.needsBake(c, kindOf(c)); });
    // the graph editor lists every keyed setting of the clips there are
    setTimeout(function () { if (window.TlGraph && TlGraph.addProp) TlParent.all().concat((tl.video || []).map(function (c) { return { c: c }; })).forEach(function (x) { A.keyed(x.c).forEach(function (p) { TlGraph.addProp("@" + p, A.label(p), A.uiK(p), ""); }); }); }, 1500);
    Object.assign(window.TlAnyKey, { ready: true, enhance: enhance, keyAt: keyAt, unkeyAt: unkeyAt, unkeyAll: unkeyAll, valueNow: valueNow });
  }
})();
