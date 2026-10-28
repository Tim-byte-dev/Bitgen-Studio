/* bitGen Studio — ext/timelinedock/tlkeys.js (2.410.0): the timeline's KEYBOARD (Premiere's keys), window.TlKeys.
 *
 * Tim: "continue with the next stages of the premier gap closure" - PREMIERE-GAP.md: "Keyboard shortcuts for the edit
 * tools (V / B / N / Y / U) - the canvas already uses single keys - needs a shortcut map first". The map is KEYS below
 * (docs/shortcuts.json lists the same rows). They work while the pointer is over the timeline's LAYERS (the tracks,
 * the ruler, the menu bar) - over the preview canvas its own keys rule (V Move, T Text, ...) - never while typing:
 *
 *   V  ▸ Select   B  ⇤ Ripple   N  ⇹ Roll   Y  ⇆ Slip   U  ↔ Slide        (edittools.js)
 *   I / O         the ruler selection's In / Out at the position marker (= ⟦ In / Out ⟧)
 *   Ctrl+K        split at the position marker: the selected clip, else every clip under it on the highlighted layer
 *   ↑ / ↓         the previous / next edit point (any clip's start or end on any layer)
 *   Home / End    the start / the end of the timeline
 *   M             a marker at the position marker   Shift+M / Alt+M  the next / previous marker   (markers.js)
 *   Ctrl+Shift+E  export the frame at the position marker as a PNG (anywhere in the timeline docker - deliver.js)
 *   J / K / L     2.411.0 (Tim: "... any premier leftovers that you can do comfortably"): the SHUTTLE - L forwards (again:
 *                 2x, 4x, 8x), J backwards (the same), K stops; holding K, L / J = one frame on / back. Anywhere in the
 *                 timeline docker or its dockers (the canvas has no J / K / L of its own); L there is not LLM tokens'
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function ready() { try { return !!(window.H3Marks && window.TlCanvas && window.TlMarks && $("tlinner")); } catch (e) { return false; } }
  var KEYS = [
    ["V", "▸ Select tool (drag clips, trim edges)"], ["B", "⇤ Ripple edit tool"], ["N", "⇹ Roll edit tool"],
    ["Y", "⇆ Slip tool"], ["U", "↔ Slide tool"], ["F", "▯ Frame tool: click a frame on a layer to select it (drag = several, Shift+click = up to here)"],
    ["Del / ⌫", "With frames selected (▯ Frame tool): remove them from their layer, the gap closes - ← / → move the selection a frame"],
    ["I", "In: the ruler selection starts at the position marker"], ["O", "Out: the ruler selection ends at the position marker"],
    ["Ctrl+K", "Split at the position marker (the selected clip, else the highlighted layer's clip under it)"],
    ["↑ / ↓", "Previous / next edit point (a clip's start or end on any layer)"], ["Home / End", "The start / end of the timeline"],
    ["M", "Add a marker at the position marker (on a marker: name, colour, comment)"], ["Shift+M", "Next marker"], ["Alt+M", "Previous marker"],
    ["Ctrl+Shift+E", "Export the frame at the position marker as a PNG"],
    ["Ctrl+Shift+M", "A clip marker on the selected clip at the position marker"],
    ["J / K / L", "Shuttle: backwards / stop / forwards - J or L again: 2x, 4x, 8x"], ["K + J / K + L", "One frame back / on (hold K)"],
    ["Space", "Play / pause the preview (anywhere, unless typing in a box)"]
  ];
  var MODES = { v: "select", b: "ripple", n: "roll", y: "slip", u: "slide", f: "frame" };   // 2.611.0: F = ▯ Frame (tlframe.js)
  function log(t) { if (typeof logLine === "function") logLine("[keys] " + t); }
  function say(t) { try { if (TlCanvas.say) TlCanvas.say(t); } catch (e) { /* fine */ } if ($("sblog")) $("sblog").textContent = t; }
  function ph() { try { return typeof playhead === "number" && isFinite(playhead) ? playhead : (TlCanvas.state.t || 0); } catch (e) { return 0; } }
  function lenOf(c, kind) {
    if (kind === "img") return Math.max(0.1, +c.len || 3);
    try { if (typeof effDur === "function") return effDur(c); } catch (e) { /* fine */ }
    return Math.max(0.1, (c.out != null ? +c.out : +c.dur || 5) - (+c.in || 0));
  }
  function typing() {
    var a = document.activeElement;
    if (window.H3Space && H3Space.typing) return H3Space.typing(a);
    return a && a !== document.body && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
  }
  var over = null;
  window.addEventListener("pointerover", function (e) { over = e.target; }, true);
  /** the pointer (or the focus) is on the timeline's layers - not its canvas, not a docker beside it */
  function onLayers() {
    var a = document.activeElement, el = over;
    var inDock = function (x) { return !!(x && x.closest && x.closest("#timelinedock")); };
    var stage = function (x) { return !!(x && x.closest && (x.closest("#tlStage") || x.closest(".tsd"))); };
    if (a && a !== document.body && inDock(a) && !stage(a) && a.closest("#tlscroll, #tlinner")) return true;
    return inDock(el) && !stage(el);
  }
  function inTimeline() {
    var a = document.activeElement, el = over;
    var t = function (x) { return !!(x && x.closest && (x.closest("#timelinedock") || x.closest(".tsd"))); };
    return t(el) || (a && a !== document.body && t(a));
  }
  function blocked() {
    if (document.querySelector(".tlpop, .kfpop, .tlmk-pop")) return true;
    try { return !!document.querySelector("dialog:modal"); } catch (e) { return false; }
  }

  /* ✂ split at the position marker */
  function layerList(lk) {
    if (lk === "v1") return { kind: "v1", get: function () { return tl.video; }, set: function (l) { tl.video = l; } };
    var m = /^(vl|a|i):(\d+)$/.exec(lk || "");
    if (!m) return null;
    var arr = m[1] === "vl" ? tl.vlayers : m[1] === "a" ? tl.audio : tl.images, L = arr && arr[+m[2]];
    if (!L) return null;
    return { kind: m[1] === "vl" ? "vl" : m[1] === "a" ? "aud" : "img", get: function () { return L.clips || []; }, set: function (l) { L.clips = l; } };
  }
  function lkOf(sel) {
    if (!sel || !sel.Ly) return null;
    if (sel.Ly.kind === "v1") return "v1";
    if (sel.Ly.lk) return sel.Ly.lk;
    var L = sel.Ly.L;
    var i = (tl.vlayers || []).indexOf(L); if (i >= 0) return "vl:" + i;
    i = (tl.audio || []).indexOf(L); if (i >= 0) return "a:" + i;
    i = (tl.images || []).indexOf(L); if (i >= 0) return "i:" + i;
    return null;
  }
  function split() {
    var t = ph(), sel = null;
    try { sel = TlCanvas.selClip && TlCanvas.selClip(); } catch (e) { sel = null; }
    var jobs = [];
    var lk = sel && sel.c ? lkOf(sel) : null;
    if (lk) jobs.push({ ly: layerList(lk), c: sel.c });
    else {
      // 2.412.0: no clip selected - every ◎ targeted layer (none targeted = the highlighted layer)
      var lks = window.TlTargets ? TlTargets.targeted() : [tl.selLayer || "v1"];
      lks.forEach(function (k) {
        var ly = layerList(k) || (lks.length === 1 ? layerList("v1") : null);
        if (ly) ly.get().forEach(function (c) { var s0 = +c.start || 0; if (t > s0 && t < s0 + lenOf(c, ly.kind)) jobs.push({ ly: ly, c: c }); });
      });
    }
    if (!jobs.length) { say("✂ Nothing to split at " + t.toFixed(2) + " s - select a clip under the position marker (or highlight its layer)."); return false; }
    var done = 0, why = "";
    jobs.forEach(function (j) {
      if (!j.ly) return;
      try {
        if (j.c.text || j.c.m3d || j.c.adjust || j.c.path) throw new Error("a text / 3D / adjustment / path clip is split with its own tools");
        var parts = H3Marks.splitClip(j.c, t, j.ly.kind, 1 / ((tl.tc && +tl.tc.fps) || 25));
        var list = j.ly.get(), i = list.indexOf(j.c);
        if (i < 0) return;
        j.ly.set(list.slice(0, i).concat(parts, list.slice(i + 1)));
        done++;
      } catch (e) { why = e.message || String(e); }
    });
    if (!done) { say("✂ " + (why || "nothing split")); return false; }
    if (typeof tlSave === "function") tlSave();
    if (typeof renderTimeline === "function") renderTimeline();
    TlCanvas.mark();
    say("✂ Split " + done + " clip(s) at " + t.toFixed(2) + " s.");
    log("split " + done + " clip(s) at " + t.toFixed(2) + " s");
    return true;
  }
  function editJump(dir) {
    var pts = H3Marks.editPoints(tl, lenOf), t = ph();
    var to = dir > 0 ? H3Marks.nextEdit(pts, t) : H3Marks.prevEdit(pts, t);
    if (to == null) return false;
    TlCanvas.go(to); return true;
  }
  function endT() { var p = H3Marks.editPoints(tl, lenOf); return p.length ? p[p.length - 1] : 0; }

  /** what a keydown does here -> an action name, or "" (pure: the tests read it) */
  function action(k, mods, layers, timeline) {
    var key = String(k || ""), lo = key.toLowerCase();
    if (mods.ctrl && mods.shift && lo === "e" && timeline) return "still";
    if (mods.ctrl && mods.shift && lo === "m" && timeline) return "clipMarker";                                  // 2.412.0
    if (timeline && !mods.ctrl && !mods.alt && !mods.meta && !mods.shift && (lo === "j" || lo === "k" || lo === "l")) {    // 2.411.0
      if (lo === "k") return "shuttleStop";
      return mods.kHeld ? (lo === "l" ? "stepFwd" : "stepBack") : (lo === "l" ? "shuttleFwd" : "shuttleBack");
    }
    if (!layers) return "";
    if (mods.ctrl && !mods.shift && !mods.alt && lo === "k") return "split";
    if (mods.ctrl || mods.meta) return "";
    if (lo === "m") return mods.alt ? "prevMarker" : mods.shift ? "nextMarker" : "marker";
    if (mods.alt) return "";
    if (key === "ArrowUp") return "prevEdit";
    if (key === "ArrowDown") return "nextEdit";
    if (key === "Home") return "home";
    if (key === "End") return "end";
    if (mods.shift) return "";
    if (MODES[lo]) return "mode:" + MODES[lo];
    if (lo === "i") return "in";
    if (lo === "o") return "out";
    return "";
  }
  function run(a) {
    if (a.indexOf("mode:") === 0) { if (window.TlEdit) { TlEdit.setMode(a.slice(5)); say("Edit tool: " + a.slice(5)); return true; } return false; }
    switch (a) {
      case "in": if ($("tlSelIn")) { $("tlSelIn").click(); return true; } return false;
      case "out": if ($("tlSelOut")) { $("tlSelOut").click(); return true; } return false;
      case "split": split(); return true;
      case "marker": TlMarks.mark(); return true;                // on a marker already: its editor (M M)
      case "nextMarker": TlMarks.next(); return true;
      case "prevMarker": TlMarks.prev(); return true;
      case "prevEdit": editJump(-1); return true;
      case "nextEdit": editJump(1); return true;
      case "home": TlCanvas.go(0); return true;
      case "end": TlCanvas.go(endT()); return true;
      case "still": if (window.TlDeliver && TlDeliver.still) { TlDeliver.still(); return true; } return false;
      case "clipMarker": if (window.TlMarks && TlMarks.clipMark) { TlMarks.clipMark(); return true; } return false;
      case "shuttleFwd": say("▶ " + TlCanvas.shuttle(1) + "×"); return true;
      case "shuttleBack": say("◀ " + Math.abs(TlCanvas.shuttle(-1)) + "×"); return true;
      case "shuttleStop": TlCanvas.shuttle(0); return true;
      case "stepFwd": TlCanvas.step(1); return true;
      case "stepBack": TlCanvas.step(-1); return true;
    }
    return false;
  }
  var kHeld = false;
  function start() {
    document.addEventListener("keyup", function (e) { if (String(e.key).toLowerCase() === "k") kHeld = false; }, true);
    window.addEventListener("blur", function () { kHeld = false; });
    document.addEventListener("keydown", function (e) {
      if (e.repeat && !/^Arrow/.test(e.key)) { if (/^[jkl]$/i.test(e.key) && inTimeline() && !typing()) e.preventDefault(); return; }
      if (typing() || blocked()) return;
      var a = action(e.key, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey, alt: e.altKey, meta: false, kHeld: kHeld }, onLayers(), inTimeline());
      if (String(e.key).toLowerCase() === "k" && a) kHeld = true;
      if (!a) return;
      if (run(a)) { e.preventDefault(); e.stopPropagation(); }
    }, true);
  }
  function boot() { if (!ready()) { setTimeout(boot, 80); return; } start(); }
  window.TlKeys = { KEYS: KEYS, action: action, split: split, editJump: editJump, onLayers: onLayers };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
