/* bitGen Studio — the timeline's TOOLS & PROPERTIES in a FLOATING DOCKER (2.385.0), window.TlFloat.
 *
 * Tim (verbatim): "put timeline docker tools properties in a floating docker the number 1 on the keyboard makes it
 * visible, give the docker a titlebar" - and, asked what goes in it: "Tools + Properties".
 *
 *   the canvas's tool buttons (#tlTools: Move, Text, 🧊 3D, Select, Mask, Hand, Zoom, Fit, colour) and the selected
 *   layer's Properties (#tlProps) move - the SAME elements, with their handlers - into #tlFloat: a window of its own
 *   over the app, with a titlebar (🧰 Tools & Properties, ✕), dragged by the titlebar, resized by its corner
 *   1 (not while typing, no dialog open)   shows / hides it; so do 🧰 in the timeline's menu bar and ✕
 *   where it is, its size and whether it shows are remembered (the settings store: tlf.*)
 *   2.410.0 (Tim: "make the kareoke and tools dialog into floating dockers, it will dock next to the preview canvas,
 *   either left or right"): a TlStageDock panel (stagedock.js) - dragged to the canvas's left / right edge (or ◧ / ◨)
 *   it docks beside the canvas; dragged away it floats again (tlf.side)
 * dock.html keeps the markup where it always was (the canvas row); this moves it at start-up, so nothing that finds
 * the tools or the properties by id changes.
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function ready() { try { return !!(window.TlCanvas && window.TlStageDock && $("tlTools") && $("tlProps")); } catch (e) { return false; } }
  function boot() { if (!$("tlCanvas")) return; if (!ready()) { setTimeout(boot, 60); return; } start(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  function sget(k, d) { try { return typeof store === "object" ? store.get(k, d) : d; } catch (e) { return d; } }

  // 2.410.0: the window itself (float, dock left / right of the preview canvas, sizes) is TlStageDock's (stagedock.js)
  var CSS = ""
    + "#tlFloat #tlTools{flex-direction:row;flex-wrap:wrap;width:auto;flex:none;border:0;border-bottom:1px solid var(--line,#3a342a);"
    + "border-radius:0;padding:5px 6px;overflow:visible;justify-content:flex-start}"
    + "#tlFloat #tlTools .tlt-sep{width:1px;height:24px;margin:0 3px}"
    + "#tlFloat #tlProps{flex:1;max-height:none;border-top:0;min-height:0;overflow:auto}"
    + "#tlFloatTog.on{color:var(--tiger);border-color:var(--tiger)}";

  function start() {
    if ($("tlFloat")) return;
    if (!$("tlFloatCss")) { var st = document.createElement("style"); st.id = "tlFloatCss"; st.textContent = CSS; document.head.appendChild(st); }
    var D = TlStageDock.make({ id: "tlFloat", key: "tlf", title: "🧰 Tools &amp; Properties", keyHint: "1", label: "Tools and properties",
      // 2.438.0: it stays inside the timeline docker - over its preview canvas row when that is shown (the tracks and the
      // menu bar stay free), else under the menu bar, else anywhere in it (smaller if it must be); collapsed / put away =
      // hidden with it. It never leaves the timeline docker.
      confine: function () {
        var d = $("timelinedock"); if (!d) return null;
        if (d.classList.contains("collapsed") || d.classList.contains("dockgone") || !d.getClientRects().length) return { hide: true };
        var big = function (q) { return q && q.width >= 220 && q.height >= 140; };
        // what of the docker is SEEN: its body (under its header - a scrolled body never pushes the panel over the
        // header's buttons) and inside the window
        var bb = d.querySelector(".bbody"), vr = (bb || d).getBoundingClientRect();
        var seen = function (q) {
          var l = Math.max(q.left, vr.left, 0), t = Math.max(q.top, vr.top, 0), r = Math.min(q.right, vr.right, window.innerWidth || 1e5), b = Math.min(q.bottom, vr.bottom, window.innerHeight || 1e5);
          return { left: l, top: t, right: Math.max(l, r), bottom: Math.max(t, b), width: Math.max(0, r - l), height: Math.max(0, b - t) };
        };
        var s = $("tlStage");
        if (s && !s.classList.contains("off") && s.getClientRects().length) { var sr = seen(s.getBoundingClientRect()); if (big(sr)) return sr; }
        var r = d.getBoundingClientRect(), b = $("tlbar"), top = r.top;
        if (b) { var br = b.getBoundingClientRect(); if (br.height && br.bottom > top) top = Math.min(r.bottom, br.bottom); }
        var below = seen({ left: r.left, top: top, right: r.right, bottom: r.bottom });
        if (big(below)) return below;
        return seen(r);
      },
      confineEl: function () { return $("timelinedock"); },
                               titleId: "tlFloatTitle", closeId: "tlFloatClose", w: 300, h: 520,
                               onShow: function (on) {
                                 var b = $("tlFloatTog"); if (b) { b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }
                                 try { if (typeof store === "object") store.set("tlf.on", on ? "1" : "0"); } catch (e) { /* fine */ }
                                 if (on && window.TlCanvas && TlCanvas.paintProps) TlCanvas.paintProps();
                               } });
    var F = D.el;
    F.appendChild($("tlTools"));
    F.appendChild($("tlProps"));
    var shown = D.shown, show = D.show;
    function toggle() { show(!shown()); }

    // 🧰 in the timeline's menu bar
    var bar = $("tlbar"), tog = $("tlStageTog");
    if (bar && !$("tlFloatTog")) {
      var b = document.createElement("button");
      b.className = "ghost"; b.id = "tlFloatTog"; b.type = "button"; b.textContent = "🧰";
      b.title = "Tools & Properties - the floating docker (1)"; b.setAttribute("aria-label", "Tools and properties");
      b.addEventListener("click", toggle);
      if (tog && tog.parentNode === bar) bar.insertBefore(b, tog.nextSibling); else bar.insertBefore(b, bar.firstChild);
    }

    // 1 = show / hide (not while typing in a box, not under an open dialog, no modifier)
    function typing() {
      var a = document.activeElement;
      return a && a !== document.body && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
    }
    document.addEventListener("keydown", function (e) {
      if (e.key !== "1" || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (typing() || document.querySelector("dialog[open]")) return;
      if (!$("timelinedock") || $("timelinedock").classList.contains("dockgone")) return;
      e.preventDefault();
      toggle();
    });

    show(sget("tlf.on", "1") !== "0");
    window.TlFloat = { show: show, toggle: toggle, shown: shown, place: D.place, dock: D.dock, side: D.side, el: F };
  }
})();
