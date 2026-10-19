/* bitGen Studio — THE CLIP START DIALOG (2.300.0).
 *
 * Tim (verbatim): "if user clicks on a clip in timeline layer, allow user
 * to set start position, double click will show a start time input dialog,
 * move start of the clip on that layer to the start time".
 *
 * A click SELECTS a timeline clip; a double-click (or Enter on the
 * selected clip) opens this small dialog beside it: the clip's start time
 * in seconds, prefilled, ready to type. Move (or Enter) puts the clip's
 * start there on ITS OWN layer; Escape / Cancel / a click away closes it.
 * The ◆ keyframe that double-click used to drop is one button away in the
 * same dialog, at the spot that was double-clicked.
 *
 * Accepted times: 12.5 · 12.5s · 1:02.5 (m:ss) · 1:02:03 (h:mm:ss) · 300f
 * (frames at the timeline's fps). Anything else - or a negative time - is
 * refused in words under the input and nothing moves.
 *
 * window.ClipStart = {
 *   parse(text, fps)  -> seconds (>= 0, rounded to 1/1000) or null
 *   open(opts)        -> the dialog element. opts = { anchor: {left, top},
 *                        name, layer, start, dur, at, fps, sequential,
 *                        onMove(sec) -> the start the clip really got,
 *                        onKeyframe() }  (onKeyframe optional)
 *   close()
 * }
 * The engine (renderTimeline, tlSave, resolveOverlaps) stays in the page;
 * this file only asks and answers. It wears the timeline's .tlpop class,
 * so the page's closePops() and its click-away rule close it too. */
(function () {
  "use strict";
  var MAX = 36000;            // ten hours - more timeline than any project
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function round3(x) { return Math.round(x * 1000) / 1000; }

  function parse(text, fps) {
    var t = String(text == null ? "" : text).trim().toLowerCase().replace(/,/g, ".");
    if (!t) return null;
    var m, sec = null;
    if ((m = /^(\d+(?:\.\d+)?)\s*s?$/.exec(t))) sec = parseFloat(m[1]);
    else if ((m = /^(\d+)\s*f$/.exec(t))) sec = parseInt(m[1], 10) / (fps > 0 ? fps : 24);
    else if ((m = /^(\d+):([0-5]?\d(?:\.\d+)?)$/.exec(t))) sec = parseInt(m[1], 10) * 60 + parseFloat(m[2]);
    else if ((m = /^(\d+):([0-5]?\d):([0-5]?\d(?:\.\d+)?)$/.exec(t)))
      sec = parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]);
    if (sec == null || !isFinite(sec) || sec < 0 || sec > MAX) return null;
    return round3(sec);
  }

  function close() {
    var list = document.querySelectorAll(".tlpop.clipstart");
    for (var i = 0; i < list.length; i++) list[i].remove();
  }

  function open(o) {
    close();
    var fps = o.fps > 0 ? o.fps : 24;
    var start = round3(+o.start || 0);
    var pop = document.createElement("div");
    pop.className = "tlpop clipstart";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "Start time for " + (o.name || "the clip"));
    pop.style.flexDirection = "column";
    pop.style.alignItems = "stretch";
    pop.style.gap = "6px";
    pop.innerHTML =
      '<span style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
        + "⏱ Start time · " + esc(o.layer || "") + " · " + esc(o.name || "") + "</span>"
      + '<label style="display:flex;gap:6px;align-items:center">start'
        + '<input type="text" data-cs="start" inputmode="decimal" autocomplete="off" '
        + 'value="' + start + '" style="width:96px" '
        + 'title="Seconds (12.5), m:ss (1:02.5), h:mm:ss or frames (300f)" '
        + 'aria-label="Start time in seconds">'
        + '<span class="val" data-cs="now">s (now ' + start.toFixed(2) + "s"
        + (o.dur > 0 ? ", " + (+o.dur).toFixed(2) + "s long" : "") + ")</span></label>"
      + (o.sequential ? '<span style="opacity:.75;max-width:280px;white-space:normal">'
          + "V1 plays its clips one after another - a start inside another clip "
          + "lands right after it.</span>" : "")
      + '<span data-cs="err" role="alert" style="color:var(--bad,#e66);display:none"></span>'
      + '<span style="display:flex;gap:6px;flex-wrap:wrap">'
        + '<button class="ghost" type="button" data-cs="move">Move</button>'
        + (typeof o.onKeyframe === "function"
            ? '<button class="ghost" type="button" data-cs="kf" '
              + 'title="Drop a ◆ keyframe where you double-clicked (what double-click used to do)">'
              + "◆ keyframe @ +" + (+o.at || 0).toFixed(2) + "s</button>" : "")
        + '<button class="ghost" type="button" data-cs="cancel">Cancel</button></span>';
    document.body.appendChild(pop);
    var a = o.anchor || { left: 20, top: 20 };
    var vw = window.innerWidth || 1024;
    pop.style.left = Math.max(4, Math.min(vw - (pop.offsetWidth || 300) - 8, a.left)) + "px";
    pop.style.top = Math.max(4, a.top - (pop.offsetHeight || 110) - 6) + "px";

    var inp = pop.querySelector('[data-cs="start"]');
    var err = pop.querySelector('[data-cs="err"]');
    function say(t) { err.textContent = t || ""; err.style.display = t ? "" : "none"; }
    function move() {
      var sec = parse(inp.value, fps);
      if (sec == null) {
        say("“" + inp.value + "” is not a start time - type seconds (12.5), "
          + "m:ss (1:02.5) or frames (300f), 0 or more");
        inp.focus(); inp.select && inp.select();
        return false;
      }
      close();
      o.onMove(sec);
      return true;
    }
    pop.querySelector('[data-cs="move"]').onclick = move;
    pop.querySelector('[data-cs="cancel"]').onclick = close;
    var kf = pop.querySelector('[data-cs="kf"]');
    if (kf) kf.onclick = function () { close(); o.onKeyframe(); };
    pop.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); move(); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    });
    // pointer and double-clicks inside never reach the timeline under it
    pop.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    pop.addEventListener("dblclick", function (e) { e.stopPropagation(); });
    inp.focus();
    if (inp.select) inp.select();
    return pop;
  }

  window.ClipStart = { parse: parse, open: open, close: close };
})();
