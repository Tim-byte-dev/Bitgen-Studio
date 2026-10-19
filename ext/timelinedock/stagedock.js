/* bitGen Studio — ext/timelinedock/stagedock.js (2.410.0): FLOATING DOCKERS that DOCK BESIDE THE PREVIEW CANVAS,
 * window.TlStageDock.
 *
 * Tim (verbatim): "make the kareoke and tools dialog into floating dockers, it will dock next to the preview canvas,
 * either left or right. this will make it easier to edit the words and timing while previewing."
 *
 *   make(spec) -> a panel (the 🎤 Karaoke docker - karaokegen.js, 🧰 Tools & Properties - tlfloat.js):
 *     FLOATS   over the app: its titlebar drags it, every edge sizes it (DockFloat.grips - the app's other floating
 *              dockers do the same), where it is and how big are remembered (the settings store: <key>.x/y/w/h)
 *     DOCKS    dragged near the preview canvas's LEFT or RIGHT edge that side lights up - let go and it sits in a
 *              column beside the canvas (#tlDockL / #tlDockR inside #tlStage), as tall as the canvas; its inner edge
 *              sizes the column (<side>.w); two dockers on one side share it, one above the other.
 *              ◧ / ◨ in its titlebar dock it there in one click; pressed again (or the titlebar dragged away) it
 *              floats again. Where it docked is remembered (<key>.side = "L" | "R" | "").
 *     shows / hides with ✕, its own button / key, show(on); the preview canvas narrows / widens to make room.
 * The page keeps no state of its own here: every panel is the caller's element with its own ids.
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function sget(k, d) { try { return typeof store === "object" ? store.get(k, d) : d; } catch (e) { return d; } }
  function sset(k, v) { try { if (typeof store === "object") store.set(k, v); } catch (e) { /* fine */ } }
  var CSS = ""
    + ".tsd{position:fixed;z-index:45;display:flex;flex-direction:column;min-width:220px;min-height:140px;"
    + "background:var(--panel,#1d1a15);border:1px solid var(--line,#3a342a);border-radius:10px;box-shadow:0 12px 34px rgba(0,0,0,.55);overflow:hidden}"
    + ".tsd.nogrips{resize:both}.tsd.tsd-confined{min-width:0;min-height:0}"
    + ".tsd.off{display:none!important}"
    + ".tsd.docked{position:relative;left:auto!important;top:auto!important;width:auto!important;height:auto!important;flex:1 1 0;"
    + "min-height:80px;box-shadow:none;border-radius:6px;z-index:auto;resize:none}"
    + ".tsd>.tsd-title{display:flex;align-items:center;gap:4px;height:30px;flex:none;padding:0 0 0 10px;cursor:move;user-select:none;"
    + "background:var(--panel-2,#26221b);border-bottom:1px solid var(--line,#3a342a)}"
    + ".tsd>.tsd-title h2{margin:0;flex:1;min-width:0;font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
    + ".tsd .tsd-key{font-family:var(--mono,monospace);font-size:.66rem;color:var(--dim,#9a917f);border:1px solid var(--line,#3a342a);border-radius:4px;padding:0 5px}"
    + ".tsd .tsd-side{width:24px;height:30px;border:0;background:none;color:var(--dim,#9a917f);cursor:pointer;padding:0;font-size:14px;border-radius:0}"
    + ".tsd .tsd-side:hover,.tsd .tsd-side.on{color:var(--tiger,#f59e2c)}"
    + ".tsd .tsd-x{width:38px;height:30px;border:0;border-radius:0 10px 0 0;background:none;color:var(--text,#e8e2d6);font-size:14px;cursor:pointer}"
    + ".tsd.docked .tsd-x{border-radius:0 6px 0 0}"
    + ".tsd .tsd-x:hover{background:#c42b1c}"
    + ".tsd-col{display:flex;flex-direction:column;gap:6px;flex:0 1 auto;width:300px;min-width:160px;max-width:55%;min-height:0;position:relative}"
    + ".tsd-col.none{display:none}"
    + ".tsd-split{position:absolute;top:0;bottom:0;width:8px;cursor:col-resize;z-index:4}"
    + ".tsd-col.L>.tsd-split{right:-7px}.tsd-col.R>.tsd-split{left:-7px}"
    + ".tsd-split:hover,.tsd-split.on{background:linear-gradient(90deg,transparent 3px,var(--tiger,#f59e2c) 3px,var(--tiger,#f59e2c) 5px,transparent 5px)}"
    + ".tsd-drop{position:fixed;z-index:10050;pointer-events:none;border:2px dashed var(--tiger,#f59e2c);background:rgba(245,158,44,.13);"
    + "border-radius:6px;display:none;color:var(--tiger,#f59e2c);font:600 12px var(--body,sans-serif);align-items:center;justify-content:center}";
  function css() { if (!$("tsdCss")) { var st = document.createElement("style"); st.id = "tsdCss"; st.textContent = CSS; document.head.appendChild(st); } }

  var panels = {};
  function stageShown() {
    var s = $("tlStage"), d = $("timelinedock");
    return !!(s && !s.classList.contains("off") && (!d || !d.classList.contains("dockgone")) && s.getClientRects().length);
  }
  function relayout() {
    ["L", "R"].forEach(function (k) {
      var c = $("tlDock" + k); if (!c) return;
      c.classList.toggle("none", !c.querySelector(":scope > .tsd:not(.off)"));
    });
    try { if (window.TlCanvas && TlCanvas.mark) TlCanvas.mark(); } catch (e) { /* fine */ }
  }
  /** the column on that side of the canvas (made the first time) */
  function col(side) {
    var id = "tlDock" + side, c = $(id);
    if (c) return c;
    var stage = $("tlStage"), cv = $("tlCanvasCol");
    if (!stage || !cv) return null;
    css();
    c = document.createElement("div");
    c.id = id; c.className = "tsd-col none " + side; c.setAttribute("aria-label", side === "L" ? "Dockers left of the preview canvas" : "Dockers right of the preview canvas");
    var w = parseInt(sget("tsd." + side + ".w", "320"), 10) || 320;
    c.style.width = Math.max(180, w) + "px";
    var sp = document.createElement("div");
    sp.className = "tsd-split"; sp.title = "Drag to size the docked panels";
    c.appendChild(sp);
    sp.addEventListener("pointerdown", function (ev) {
      if (ev.button !== 0) return;
      ev.preventDefault(); ev.stopPropagation();
      var x0 = ev.clientX, w0 = c.getBoundingClientRect().width, sw = stage.getBoundingClientRect().width;
      sp.classList.add("on"); document.body.style.userSelect = "none";
      var mv = function (e) {
        var dx = e.clientX - x0, nw = side === "L" ? w0 + dx : w0 - dx;
        c.style.width = Math.round(Math.max(180, Math.min(sw * 0.7, nw))) + "px";
        try { if (window.TlCanvas) TlCanvas.mark(); } catch (er) { /* fine */ }
      };
      var up = function () {
        window.removeEventListener("pointermove", mv, true); window.removeEventListener("pointerup", up, true);
        sp.classList.remove("on"); document.body.style.userSelect = "";
        sset("tsd." + side + ".w", String(Math.round(c.getBoundingClientRect().width)));
      };
      window.addEventListener("pointermove", mv, true); window.addEventListener("pointerup", up, true);
    });
    if (side === "L") stage.insertBefore(c, cv); else stage.insertBefore(c, cv.nextSibling);
    return c;
  }
  /** which side a drag at (x, y) would dock on: near the canvas column's left / right edge (or over that column) */
  function zoneAt(x, y) {
    if (!stageShown()) return "";
    var cv = $("tlCanvasCol"); if (!cv) return "";
    var r = cv.getBoundingClientRect();
    if (y < r.top - 24 || y > r.bottom + 24) return "";
    var band = Math.min(150, r.width * 0.28);
    for (var k = 0; k < 2; k++) {
      var s = k ? "R" : "L", c = $("tlDock" + s);
      if (c && !c.classList.contains("none")) { var cr = c.getBoundingClientRect(); if (x >= cr.left && x <= cr.right && y >= cr.top && y <= cr.bottom) return s; }
    }
    if (x >= r.left - 60 && x <= r.left + band) return "L";
    if (x >= r.right - band && x <= r.right + 60) return "R";
    return "";
  }
  var dropEl = null;
  function drop(side) {
    if (!dropEl) { css(); dropEl = document.createElement("div"); dropEl.className = "tsd-drop"; dropEl.id = "tsdDrop"; document.body.appendChild(dropEl); }
    if (!side) { dropEl.style.display = "none"; dropEl.dataset.side = ""; return; }
    var cv = $("tlCanvasCol").getBoundingClientRect(), w = Math.min(320, cv.width * 0.4);
    var c = $("tlDock" + side), cr = c && !c.classList.contains("none") ? c.getBoundingClientRect() : null;
    var L = cr ? cr.left : side === "L" ? cv.left : cv.right - w, W = cr ? cr.width : w;
    Object.assign(dropEl.style, { display: "flex", left: L + "px", top: cv.top + "px", width: W + "px", height: cv.height + "px" });
    dropEl.textContent = side === "L" ? "◧ dock left of the canvas" : "dock right of the canvas ◨";
    dropEl.dataset.side = side;
  }

  /** spec = {id, title (html), key (the store prefix), keyHint, titleId, closeId, w, h, x, y, side (the first time),
   *  label, onShow(on), onDock(side)} -> {el, show, shown, toggle, dock, side, place} */
  function make(spec) {
    css();
    var o = spec || {}, K = o.key || o.id;
    if (panels[o.id]) return panels[o.id];
    var F = document.createElement("div");
    F.id = o.id; F.className = "tsd off" + (o.confine ? " tsd-confined" : ""); F.setAttribute("role", "dialog"); F.setAttribute("aria-label", o.label || o.id);
    var hint = o.keyHint ? '<span class="tsd-key" title="Press ' + o.keyHint + ' to show / hide this docker">' + o.keyHint + "</span>" : "";
    F.innerHTML = '<div class="tsd-title" id="' + (o.titleId || o.id + "Title") + '"><h2>' + (o.title || "") + "</h2>" + hint
      + '<button type="button" class="tsd-side" data-side="L" title="Dock left of the preview canvas (again: float it)" aria-label="Dock left">◧</button>'
      + '<button type="button" class="tsd-side" data-side="R" title="Dock right of the preview canvas (again: float it)" aria-label="Dock right">◨</button>'
      + '<button type="button" class="tsd-x" id="' + (o.closeId || o.id + "Close") + '" aria-label="Hide" title="Hide' + (o.keyHint ? " (" + o.keyHint + " shows it again)" : "") + '">✕</button></div>';
    document.body.appendChild(F);
    var title = F.firstChild;

    var vw = window.innerWidth || 1280;
    var w = parseInt(sget(K + ".w", String(o.w || 320)), 10) || o.w || 320, h = parseInt(sget(K + ".h", String(o.h || 480)), 10) || o.h || 480;
    var x = parseInt(sget(K + ".x", String(o.x != null ? o.x : vw - w - 40)), 10), y = parseInt(sget(K + ".y", String(o.y != null ? o.y : 110)), 10);
    var saved = sget(K + ".side", null), first = saved == null;      // never placed: o.side when there is room for it
    var side = String(saved || "");
    if (side !== "L" && side !== "R") side = "";
    /** 2.438.0: spec.confine() -> an element the floating panel stays inside (Tim: "confine the video toolbox docker to
     *  the video docker" - "tools and properties should be confined to the timeline docker"); null = the window */
    // 2.438.0: {hide: true} = its docker is collapsed / put away (it goes with it); otherwise it always stays INSIDE
    // the docker (Tim: "tools and properties should be confined to the timeline docker") - smaller than its usual
    // smallest size when the docker is small (its contents scroll), never hidden just for want of room
    function bounds() {
      var c = null; try { c = o.confine ? o.confine() : null; } catch (e) { c = null; }
      if (c && c.hide) return "hide";
      var r = c && c.getBoundingClientRect ? c.getBoundingClientRect() : (c && c.right != null ? c : null);   // an element, or a rect {left, top, right, bottom}
      return r && r.width >= 40 && r.height >= 40 ? r : (o.confine ? "hide" : null);
    }
    function place(nx, ny) {
      var W = window.innerWidth || 1280, H = window.innerHeight || 800, fw = F.offsetWidth || w, fh = F.offsetHeight || h, B = side ? null : bounds();
      if (o.confine) F.style.visibility = !side && B === "hide" ? "hidden" : "";   // its docker collapsed / put away: it goes with it (docked: in the docker's own column)
      if (B === "hide") B = null;
      if (B) {                                                         // inside the docker: whole, smaller if it has to be
        if (fw > B.width) { fw = Math.floor(B.width); F.style.width = fw + "px"; }
        if (fh > B.height) { fh = Math.floor(B.height); F.style.height = fh + "px"; }
        x = Math.round(Math.max(B.left, Math.min(B.right - fw, nx)));
        y = Math.round(Math.max(B.top, Math.min(B.bottom - fh, ny)));
      } else {
        x = Math.max(-(fw - 80), Math.min(W - 80, Math.round(nx)));
        y = Math.max(0, Math.min(H - 32, Math.round(ny)));
      }
      F.style.left = x + "px"; F.style.top = y + "px";
    }
    F.style.width = Math.max(220, w) + "px"; F.style.height = Math.max(140, h) + "px";
    place(isFinite(x) ? x : vw - w - 40, isFinite(y) ? y : 110);

    function paintSide() {
      Array.prototype.forEach.call(title.querySelectorAll(".tsd-side"), function (b) {
        var on = b.dataset.side === side;
        b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
        b.title = on ? "Float it again" : (b.dataset.side === "L" ? "Dock left of the preview canvas" : "Dock right of the preview canvas");
      });
      F.dataset.side = side;
    }
    /** dock on "L" / "R", or float ("") */
    function dock(s, keep) {
      s = s === "L" || s === "R" ? s : "";
      var c = s ? col(s) : null;
      if (s && !c) s = "";
      side = s;
      if (s) { F.classList.add("docked"); c.appendChild(F); F.style.visibility = ""; }
      else { F.classList.remove("docked"); if (F.parentNode !== document.body) document.body.appendChild(F); F.style.width = Math.max(220, w) + "px"; F.style.height = Math.max(140, h) + "px"; place(x, y); }
      if (!keep) { sset(K + ".side", s); first = false; }
      paintSide(); relayout();
      if (F._dfGrips && F._dfGrips.refresh) F._dfGrips.refresh();
      if (o.onDock) { try { o.onDock(s); } catch (e) { /* the caller's */ } }
    }
    function shown() { return !F.classList.contains("off"); }
    function show(on) {
      if (on && first) {                                               // the first time: beside the canvas when it is wide enough
        first = false;
        var cv = $("tlCanvasCol"), cw = cv ? cv.getBoundingClientRect().width : 0;
        if (o.side && stageShown() && cw >= 560) dock(o.side);
      }
      if (on && side && !stageShown()) dock("", true);                 // the canvas is hidden: float it for now
      else if (on && side && F.parentNode === document.body) dock(side, true);
      F.classList.toggle("off", !on);
      if (o.onShow) { try { o.onShow(on); } catch (e) { /* the caller's */ } }
      if (on && !side) place(x, y);
      relayout();
    }
    function toggle() { show(!shown()); }

    // every edge sizes it while it floats (the app's other dockers do the same); docked, the column's edge does
    if (window.DockFloat && DockFloat.grips) {
      DockFloat.grips(F, {
        mode: function () { return side ? "none" : "float"; }, min: { w: 220, h: 140 },
        onEnd: function () { if (!side) { var r0 = F.getBoundingClientRect(); place(r0.left, r0.top); w = F.offsetWidth; h = F.offsetHeight; var r = F.getBoundingClientRect(); x = Math.round(r.left); y = Math.round(r.top);
          sset(K + ".w", String(w)); sset(K + ".h", String(h)); sset(K + ".x", String(x)); sset(K + ".y", String(y)); } }
      });
    } else {
      F.classList.add("nogrips");
      if (typeof ResizeObserver === "function") {
        var rt = null;
        new ResizeObserver(function () {
          if (!shown() || side) return;
          clearTimeout(rt);
          rt = setTimeout(function () { w = F.offsetWidth; h = F.offsetHeight; sset(K + ".w", String(w)); sset(K + ".h", String(h)); }, 300);
        }).observe(F);
      }
    }

    // the titlebar drags it; near the canvas's edge it docks; a docked one dragged away floats
    title.addEventListener("pointerdown", function (ev) {
      if (ev.button !== 0 || ev.target.closest("button")) return;
      var sx = ev.clientX, sy = ev.clientY, x0 = x, y0 = y, moved = false, zone = "";
      // the window listens (not the titlebar): pulled out of its column the panel moves in the page, which ends a capture
      var mv = function (e) {
        if (!moved && Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) < 6) return;
        if (!moved) {
          moved = true;
          if (side) {                                   // pulled out of its column: float under the pointer
            var tw = Math.max(220, w);
            x0 = sx - Math.min(80, tw / 3); y0 = sy - 15;
            dock("", false);
          }
        }
        place(x0 + e.clientX - sx, y0 + e.clientY - sy);
        zone = zoneAt(e.clientX, e.clientY);
        drop(zone);
      };
      var up = function () {
        window.removeEventListener("pointermove", mv, true); window.removeEventListener("pointerup", up, true); window.removeEventListener("pointercancel", up, true);
        document.body.style.userSelect = "";
        drop("");
        if (!moved) return;
        sset(K + ".x", String(x)); sset(K + ".y", String(y));
        if (zone) dock(zone);
      };
      window.addEventListener("pointermove", mv, true); window.addEventListener("pointerup", up, true); window.addEventListener("pointercancel", up, true);
      document.body.style.userSelect = "none";
      ev.preventDefault();
    });
    Array.prototype.forEach.call(title.querySelectorAll(".tsd-side"), function (b) {
      b.addEventListener("click", function () { dock(side === b.dataset.side ? "" : b.dataset.side); if (!shown()) show(true); });
    });
    F.querySelector(".tsd-x").addEventListener("click", function () { show(false); });
    window.addEventListener("resize", function () { if (shown() && !side) place(x, y); });
    if (o.confine && typeof ResizeObserver === "function") {          // the docker moved / resized: still inside it
      var cEl = null; try { cEl = o.confineEl ? o.confineEl() : o.confine(); } catch (e) { cEl = null; }
      if (cEl && !cEl.nodeType) cEl = null;
      if (cEl) new ResizeObserver(function () { if (shown() && !side) place(x, y); }).observe(cEl);
    }
    if (o.confine) setInterval(function () { if (shown() && !side) place(x, y); }, 1000);   // + after a docker's animation settles

    /* 2.432.0: ⊞ Docker layout keeps it (shown, docked side, where / how big floating) and puts it back */
    function state() { return { shown: shown(), side: side, x: x, y: y, w: w, h: h }; }
    function apply(st) {
      if (!st || typeof st !== "object") return;
      if (st.w > 0) w = Math.max(220, Math.round(st.w)); if (st.h > 0) h = Math.max(140, Math.round(st.h));
      if (isFinite(st.x)) x = Math.round(st.x); if (isFinite(st.y)) y = Math.round(st.y);
      sset(K + ".w", String(w)); sset(K + ".h", String(h)); sset(K + ".x", String(x)); sset(K + ".y", String(y));
      first = false;
      dock(st.side === "L" || st.side === "R" ? st.side : "");
      show(!!st.shown);
    }
    var P = { el: F, title: title, show: show, shown: shown, toggle: toggle, dock: dock, state: state, apply: apply,
              side: function () { return side; },
              place: function (nx, ny) { if (side) dock("", false); place(nx, ny); sset(K + ".x", String(x)); sset(K + ".y", String(y)); } };
    panels[o.id] = P;
    if (side) dock(side, true); else paintSide();
    return P;
  }
  // the canvas's ⧉ hides the stage: a docked panel goes with it; shown again, the columns come back as they were
  /** 2.432.0: the columns' widths beside the canvas (⊞ Docker layout) */
  function colW(s, v) {
    if (s !== "L" && s !== "R") return 0;
    if (v > 0) { v = Math.round(v); sset("tsd." + s + ".w", String(v)); var c = $("tlDock" + s); if (c) c.style.width = v + "px"; relayout(); return v; }
    var c2 = $("tlDock" + s);
    return c2 && c2.getBoundingClientRect().width > 0 ? Math.round(c2.getBoundingClientRect().width) : parseInt(sget("tsd." + s + ".w", "320"), 10) || 320;
  }
  window.TlStageDock = { make: make, zoneAt: zoneAt, panels: panels, relayout: relayout, stageShown: stageShown, colW: colW };
})();
