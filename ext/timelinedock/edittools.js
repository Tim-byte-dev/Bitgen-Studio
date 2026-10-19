/* bitGen Studio — ext/timelinedock/edittools.js (2.407.0): the timeline's EDIT TOOL modes - ▸ Select (as before),
 * ⇤ Ripple (drag an edge: trim it and move everything after it), ⇹ Roll (drag the edge between two touching clips:
 * the cut moves, the total stays), ⇆ Slip (drag a clip: other frames of its source, same place and length), ↔ Slide
 * (drag a clip: it moves, its neighbours give and take). The maths is static/edittools.js (shared with the tests).
 * Plus the TIMECODE readout beside the position (static/timecode.js, tl.tc).
 * Tim: "can we do the pipelines, editing tools, colour and export now, keep track of what is left to do". */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function ready() { try { return !!(window.H3EditTools && window.TlCanvas && TlCanvas.layerOf && $("tlinner") && $("tlClear")); } catch (e) { return false; } }
  var E = function () { return window.H3EditTools; };
  var MODES = [["select", "▸", "Select: drag to move, edges to trim (as before)"], ["ripple", "⇤", "Ripple: drag an edge - trim it and move everything after it"],
               ["roll", "⇹", "Roll: drag the edge between two touching clips - the cut moves, the total stays"],
               ["slip", "⇆", "Slip: drag a clip - other frames of its source, same place and length"],
               ["slide", "↔", "Slide: drag a clip between its neighbours - they give and take"]];
  var mode = "select", tip = null;
  function log(t) { if (typeof logLine === "function") logLine("[edit] " + t); }

  function paintModes() { MODES.forEach(function (m) { var b = $("tlEdit_" + m[0]); if (b) b.classList.toggle("on", m[0] === mode); }); var inn = $("tlinner"); if (inn) inn.dataset.edit = mode; }
  function setMode(m) { mode = m; paintModes(); }
  function bar() {
    if ($("tlEditModes")) return;
    var g = document.createElement("span");
    g.id = "tlEditModes"; g.setAttribute("role", "group"); g.setAttribute("aria-label", "Edit tools");
    g.style.cssText = "display:inline-flex;gap:2px;border-left:1px solid var(--line);padding-left:6px;margin-left:4px";
    MODES.forEach(function (m) {
      var b = document.createElement("button");
      b.className = "ghost"; b.type = "button"; b.id = "tlEdit_" + m[0]; b.textContent = m[1]; b.title = m[2]; b.setAttribute("aria-label", m[2]);
      b.style.padding = "0 6px";
      b.onclick = function () { setMode(m[0]); };
      g.appendChild(b);
    });
    var ref = $("tlClear"), sp = ref && ref.previousElementSibling;
    (sp && sp.parentNode ? sp.parentNode : ref.parentNode).insertBefore(g, sp || ref);
    var st = document.createElement("style");
    st.textContent = "#tlEditModes button.on{outline:1px solid var(--tiger,#f59e2c);color:var(--tiger,#f59e2c)}"
      + "#tlinner[data-edit=slip] .clip,#tlinner[data-edit=slide] .clip{cursor:ew-resize}"
      + "#tlinner[data-edit=roll] .clip .h,#tlinner[data-edit=ripple] .clip .h{background:var(--tiger,#f59e2c);opacity:.6}"
      + ".tl-edit-tip{position:fixed;z-index:10060;background:#000c;color:#fff;font:11px var(--mono,monospace);padding:3px 6px;border-radius:4px;pointer-events:none;white-space:nowrap}";
    document.head.appendChild(st);
    paintModes();
  }

  function layerClips(c) {
    var Ly = TlCanvas.layerOf(c);
    if (!Ly) return null;
    return { kind: Ly.kind, L: Ly.L, clips: Ly.kind === "v1" ? tl.video : (Ly.L.clips || []) };
  }
  function showTip(e, text) {
    if (!tip) { tip = document.createElement("div"); tip.className = "tl-edit-tip"; document.body.appendChild(tip); }
    tip.style.display = "block"; tip.style.left = (e.clientX + 14) + "px"; tip.style.top = (e.clientY + 12) + "px"; tip.textContent = text;
  }
  function hideTip() { if (tip) tip.style.display = "none"; }
  var f2 = function (v) { return (+v).toFixed(2); };

  /** what a drag of d timeline seconds would do: {apply(), text} or throws in words */
  function plan(op, c, side, d) {
    var LC = layerClips(c), T = E();
    if (!LC) throw new Error("that clip is not on a layer");
    if (op === "slip") {
      var r = T.slip(c, -d);              // drag right = earlier frames (as Premiere)
      return { text: "slip  in " + f2(r.in) + "  out " + f2(r.out), apply: function () { c.in = r.in; c.out = r.out; } };
    }
    if (op === "slide") {
      var nb = T.neighbours(LC.clips, c), s = T.slide(nb.prev, c, nb.next, d);
      return { text: "slide " + (s.moved >= 0 ? "+" : "") + f2(s.moved) + "s  start " + f2(s.c.start), apply: function () {
        c.start = s.c.start; if (nb.prev) nb.prev.out = s.prev.out; if (nb.next) { nb.next.in = s.next.in; nb.next.start = s.next.start; nb.next.out = s.next.out; }
      } };
    }
    if (op === "roll") {
      var nb2 = T.neighbours(LC.clips, c), a = side === "r" ? c : nb2.prev, b = side === "r" ? nb2.next : c;
      if (!a || !b) throw new Error("roll needs two touching clips - this edge has no neighbour");
      var rr = T.roll(a, b, d);
      return { text: "roll " + (rr.moved >= 0 ? "+" : "") + f2(rr.moved) + "s  cut at " + f2(rr.b.start), apply: function () { a.out = rr.a.out; b.in = rr.b.in; b.start = rr.b.start; b.out = rr.b.out; } };
    }
    var rp = T.ripple(LC.clips, c, side, d);
    return { text: "ripple " + (rp.moved >= 0 ? "+" : "") + f2(rp.moved) + "s", apply: function () {
      rp.clips.forEach(function (x, i) { var o = LC.clips[i]; if (x !== o) Object.assign(o, x); });
    } };
  }

  function onDown(e) {
    if (mode === "select" || e.button !== 0) return;
    var el = e.target.closest && e.target.closest(".clip");
    if (!el || !el._clip || e.target.closest(".cx")) return;
    var edge = e.target.classList && e.target.classList.contains("h") ? (e.target.classList.contains("l") ? "l" : "r") : null;
    var c = el._clip;
    if ((mode === "ripple" || mode === "roll") && !edge) return;     // their handle is an edge; the body still selects / moves
    if ((mode === "slip" || mode === "slide") && edge) return;       // the edges still trim
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    var x0 = e.clientX, last = null, err = null, done = el._done;
    var mv = function (ev) {
      var d = (ev.clientX - x0) / (typeof PXS === "number" ? PXS : 40);
      try { last = plan(mode, c, edge, d); err = null; showTip(ev, last.text); }
      catch (x) { last = null; err = x.message; showTip(ev, "✕ " + err); }
    };
    var up = function (ev) {
      window.removeEventListener("pointermove", mv, true); window.removeEventListener("pointerup", up, true);
      hideTip();
      mv(ev);
      if (Math.abs(ev.clientX - x0) < 3) return;
      if (err) { alert(err); return; }
      if (!last) return;
      last.apply();
      log(last.text + " · " + c.name);
      if (typeof tlSave === "function") tlSave();
      if (typeof renderTimeline === "function") renderTimeline();
      TlCanvas.mark(); if (TlCanvas.paintProps) TlCanvas.paintProps();
      void done;
    };
    window.addEventListener("pointermove", mv, true); window.addEventListener("pointerup", up, true);
  }

  /* ---------------- timecode beside the position readout */
  function tcText() {
    var T = window.H3Timecode, ph = (typeof playhead === "number" && isFinite(playhead)) ? playhead : 0;
    var tc = (typeof tl !== "undefined" && tl && tl.tc) || { start: "00:00:00:00", fps: 25 };   // 2.412.0: tl is a page `let` (not window.tl) - the start / rate / drop-frame were never read
    return T ? T.at(ph, tc) : "";
  }
  function tcLoop() {
    var el = $("tlTc");
    if (!el) {
      var ph = $("tlPh"); if (!ph) return;
      el = document.createElement("span"); el.id = "tlTc"; el.title = "Timecode (📤 Export / ⇄ Exchange set the start and the frame rate)";
      el.style.cssText = "font-family:var(--mono);font-size:.68rem;color:var(--dim);margin-left:6px";
      ph.parentNode.insertBefore(el, ph.nextSibling);
    }
    var t = tcText(); if (el.textContent !== t) el.textContent = t;
  }

  function boot() {
    if (!ready()) { setTimeout(boot, 300); return; }
    bar();
    $("tlinner").addEventListener("pointerdown", onDown, true);
    setInterval(tcLoop, 200);
  }
  window.TlEdit = { setMode: setMode, mode: function () { return mode; }, plan: plan };
  boot();
})();
