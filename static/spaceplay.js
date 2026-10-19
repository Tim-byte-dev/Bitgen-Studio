/* bitGen Studio — static/spaceplay.js (2.410.0): SPACE PAUSES THE PREVIEW anywhere in the app, unless you are typing.
 * window.H3Space.
 *
 * Tim (verbatim): "make spacebar pause the preview playback unless typing".
 *
 *   playing:  Space pauses whatever plays - the timeline's preview canvas, the timeline's live preview in the Preview
 *             docker (▶ preview: pv), or a video in the Preview docker (#player) - wherever the pointer is
 *   paused:   Space plays again what Space paused last, or what the pointer is over (the timeline docker / its dockers
 *             = the canvas, the Preview docker = its video). Over the canvas itself the canvas keeps its own Space
 *             (hold = the hand, a tap = play) - ext/timelinedock/canvas.js.
 *   TYPING:   a text / number box, a text area, a list box, an editable text - Space types a space there. A focused
 *             button, checkbox or slider is not typing: Space pauses / plays instead of pressing it.
 *   left alone: an open modal dialog, the image editor (its Space is the hand), a video's own focused controls.
 * The rule is pure (typing / decide) - tested in Node (scripts/test-tlkeys.js).
 */
(function (root) {
  "use strict";
  var TEXTLESS = /^(checkbox|radio|range|button|submit|reset|color|file|image)$/i;
  /** is the focused element one Space types into? */
  function typing(a) {
    if (!a || a === (root.document && root.document.body)) return false;
    if (a.isContentEditable) return true;
    var t = String(a.tagName || "").toUpperCase();
    if (t === "TEXTAREA" || t === "SELECT") return true;
    if (t === "INPUT") return !TEXTLESS.test(String(a.type || "text"));
    return false;
  }
  /** what Space does: st = {key, mods, typing, modal, own, playing ("canvas" | "pv" | "player" | ""), overStage,
   *  pvPaused, where ("canvas" | "player" | ""), last} -> "" (leave it) | "pause:<what>" | "play:<what>" */
  function decide(st) {
    if (st.key !== " " || st.mods || st.typing || st.modal || st.own) return "";
    if (st.playing) return "pause:" + st.playing;
    if (st.overStage) return "";                                      // the canvas's own: hold = hand, tap = play
    if (st.pvPaused) return "play:pv";
    var w = st.where || st.last || "";
    return w ? "play:" + w : "";
  }
  root.H3Space = { typing: typing, decide: decide };
  if (typeof module === "object" && module.exports) module.exports = root.H3Space;
  if (!root.document || !root.addEventListener) return;

  var doc = root.document, over = null, last = "", swallow = false;
  function $(id) { return doc.getElementById(id); }
  function inside(el, sel) { return !!(el && el.closest && el.closest(sel)); }
  root.addEventListener("pointerover", function (e) { over = e.target; }, true);
  function modal() { try { return !!doc.querySelector("dialog:modal"); } catch (e) { return !!doc.querySelector("dialog[open]"); } }
  function tlc() { return root.TlCanvas && root.TlCanvas.state ? root.TlCanvas : null; }
  function tlShown() {
    var d = $("timelinedock"), s = $("tlStage");
    return !!(d && !d.classList.contains("dockgone") && s && !s.classList.contains("off") && s.getClientRects().length);
  }
  function player() { var p = $("player"); return p && (p.currentSrc || p.src) && !p.classList.contains("hidden") ? p : null; }
  function pvState() { try { return typeof pv === "object" && pv ? pv : null; } catch (e) { return null; } }
  function playing() {
    var c = tlc(); if (c && c.state.playing) return "canvas";
    var P = pvState(); if (P && P.on && !P.paused) return "pv";
    var p = player(); if (p && !p.paused && !p.ended) return "player";
    return "";
  }
  function overStage() {
    var c = tlc(), a = doc.activeElement;
    return !!(c && ((c.state.over && !c.state.overDock) || (a && a === $("tlCanvasWrap"))));
  }
  function where() {
    var a = doc.activeElement;
    if (inside(over, "#previewdock") || inside(a, "#previewdock")) return player() ? "player" : "";
    if (inside(over, "#timelinedock") || inside(over, ".tsd") || inside(a, "#timelinedock") || inside(a, ".tsd")) return tlShown() ? "canvas" : "";
    return "";
  }
  function own() {
    var a = doc.activeElement;
    if (inside(over, "#imageeditdock") || inside(a, "#imageeditdock") || inside(over, "[data-own-space]") || inside(a, "[data-own-space]")) return true;
    var t = a && String(a.tagName || "").toUpperCase();
    return t === "VIDEO" || t === "AUDIO";                            // its own controls take Space
  }
  function run(act) {
    var k = act.split(":"), what = k[1];
    try {
      if (k[0] === "pause") {
        if (what === "canvas") tlc().pause();
        else if (what === "pv" && typeof pvPause === "function") pvPause();
        else if (what === "player") player().pause();
        last = what;
      } else if (what === "pv" && typeof pvPause === "function") pvPause();
      else if (what === "canvas" && tlc() && tlShown()) tlc().play();
      else if (what === "player" && player()) { var pr = player().play(); if (pr && pr.catch) pr.catch(function () { /* autoplay */ }); }
      else return false;
    } catch (e) { return false; }
    return true;
  }
  root.addEventListener("keydown", function (e) {
    if (e.key !== " ") return;
    var P = pvState();
    var act = decide({ key: e.key, mods: e.ctrlKey || e.metaKey || e.altKey, typing: typing(doc.activeElement), modal: modal(), own: own(),
                       playing: playing(), overStage: overStage(), pvPaused: !!(P && P.on && P.paused), where: where(), last: last });
    if (!act) return;
    e.preventDefault(); e.stopPropagation();                         // a focused button is not pressed; the canvas's hand waits
    swallow = true;
    if (e.repeat) return;
    run(act);
  }, true);
  root.addEventListener("keyup", function (e) {
    if (e.key !== " " || !swallow) return;
    swallow = false; e.preventDefault(); e.stopPropagation();
  }, true);
  root.H3Space.playing = playing;
})(typeof window !== "undefined" ? window : globalThis);
