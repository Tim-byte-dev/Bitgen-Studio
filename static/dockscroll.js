/* ============================================================================
 * dockscroll.js — overlay vertical slider for dock scroll regions
 * ----------------------------------------------------------------------------
 * Why this exists
 *   Docks must not show a native scrollbar (they eat width, they repaint over
 *   the tiger theme, and on Windows they flip between overlay/classic styles
 *   depending on the OS setting). Instead every scrollable dock region hides
 *   its native bar and gets a thin slider rail drawn on its right edge, which
 *   only appears while the content actually overflows.
 *
 * How to use
 *   Mark the SCROLLING element (the one with overflow-y:auto) with
 *   `data-dockscroll` and make sure it has a positioned ancestor:
 *
 *     <aside class="dock">                <!-- position: relative -->
 *       <div class="scroll" data-dockscroll> ... </div>
 *     </aside>
 *
 *   The module scans for `[data-dockscroll]` on DOMContentLoaded and again on
 *   `DockScroll.scan()`. Call `DockScroll.refresh(el)` after you replace the
 *   contents of a region imperatively — a MutationObserver catches it anyway,
 *   but an explicit call updates the rail in the same frame instead of the
 *   next one.
 *
 * Geometry note
 *   The rail is an absolutely positioned sibling parked in the scroller's
 *   offsetParent, laid out from `el.offsetTop/offsetLeft/clientWidth/
 *   clientHeight`. That means NO wrapper div is required, so the existing
 *   flex chains inside the docks keep working untouched. When a dock is
 *   collapsed (`display:none`) every offset reads 0 and the rail hides itself.
 *
 * The pure geometry helpers (geom/scrollFor/jumpTo) are exported for
 * `scripts/test-dockscroll.js`, which runs them headless with no DOM.
 * ==========================================================================*/
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.DockScroll = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var RAIL_W = 10;      // rail footprint in px (thumb is inset inside it)
  var MIN_THUMB = 24;   // never let the handle shrink below a grabbable size
  var EPS = 1;          // px of slop before we call something "overflowing"

  /* ---------------------------------------------------------------- maths --
   * Kept pure (numbers in, numbers out) so they can be unit-tested without a
   * browser. Everything below the fold is the DOM plumbing that calls them. */

  /**
   * Work out whether a slider is needed and where its handle sits.
   * @param {object} m viewport/content/scrollTop/track (+ optional minThumb)
   * @returns {{overflow:boolean,size:number,top:number,maxTop:number,range:number}}
   */
  function geom(m) {
    var viewport = Math.max(0, m.viewport || 0);
    var content = Math.max(0, m.content || 0);
    var track = Math.max(0, m.track == null ? viewport : m.track);
    var minThumb = m.minThumb == null ? MIN_THUMB : m.minThumb;
    var range = content - viewport;                 // scrollable distance
    if (viewport <= 0 || track <= 0 || range <= EPS) {
      return { overflow: false, size: 0, top: 0, maxTop: 0, range: 0 };
    }
    // Handle length is proportional to how much of the content is on screen,
    // floored so it stays draggable on very long queues, and capped so it can
    // never be taller than the rail it lives in.
    var size = Math.min(track, Math.max(minThumb, Math.round(track * (viewport / content))));
    var maxTop = track - size;
    var scrollTop = Math.min(range, Math.max(0, m.scrollTop || 0));
    var top = maxTop <= 0 ? 0 : Math.round(maxTop * (scrollTop / range));
    return { overflow: true, size: size, top: top, maxTop: maxTop, range: range };
  }

  /**
   * Inverse of geom(): a handle offset becomes a scrollTop.
   * @returns {number} clamped scrollTop
   */
  function scrollFor(m) {
    var range = Math.max(0, (m.content || 0) - (m.viewport || 0));
    var maxTop = m.maxTop || 0;
    if (range <= 0) return 0;
    if (maxTop <= 0) return range;                  // handle fills the rail
    var t = Math.min(maxTop, Math.max(0, m.thumbTop || 0));
    return Math.round(range * (t / maxTop));
  }

  /**
   * Clicking the bare rail centres the handle on the pointer.
   * @returns {number} clamped scrollTop
   */
  function jumpTo(m) {
    var g = geom(m);
    if (!g.overflow) return 0;
    var wanted = (m.clickY || 0) - g.size / 2;
    return scrollFor({
      thumbTop: wanted, maxTop: g.maxTop,
      viewport: m.viewport, content: m.content
    });
  }

  /* ------------------------------------------------------------------ DOM --*/

  var hasDOM = typeof document !== "undefined" && !!document.createElement;
  var reg = typeof Map !== "undefined" ? new Map() : null;
  var styled = false;
  var frame = 0;

  var CSS = [
    /* the scroller itself: kill every flavour of native bar */
    ".dsc-on { scrollbar-width: none; -ms-overflow-style: none; }",
    ".dsc-on::-webkit-scrollbar { width: 0; height: 0; display: none; }",
    /* rail */
    ".dsc-rail { position: absolute; width: " + RAIL_W + "px; z-index: 6;",
    "  border-radius: " + (RAIL_W / 2) + "px; background: rgba(0,0,0,.30);",
    "  opacity: 0; pointer-events: none; transition: opacity .14s linear; }",
    ".dsc-rail.on { opacity: .55; pointer-events: auto; }",
    ".dsc-rail.on:hover, .dsc-rail.on.drag { opacity: 1; }",
    /* handle */
    ".dsc-thumb { position: absolute; left: 2px; right: 2px; border-radius: " + (RAIL_W / 2) + "px;",
    "  background: var(--tiger, #e07b2c); cursor: grab; }",
    ".dsc-rail.drag .dsc-thumb { cursor: grabbing; }",
    ".dsc-thumb:hover { background: var(--tiger, #e07b2c); filter: brightness(1.15); }",
    /* while dragging, stop the pointer selecting dock text */
    "body.dsc-dragging { user-select: none; -webkit-user-select: none; cursor: grabbing; }"
  ].join("\n");

  function injectStyle() {
    if (styled || !hasDOM) return;
    styled = true;
    var s = document.createElement("style");
    s.id = "dsc-style";
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  /* The rail must live in the scroller's offsetParent so offsetTop/offsetLeft
     line it up. Resolve that ourselves rather than reading el.offsetParent,
     because offsetParent is null while an ancestor is display:none — which is
     exactly the case for a collapsed dock. */
  function hostOf(el) {
    var p = el.parentElement;
    while (p && p !== document.body) {
      var pos = getComputedStyle(p).position;
      if (pos && pos !== "static") return p;
      p = p.parentElement;
    }
    return el.parentElement || document.body;
  }

  function attach(el) {
    if (!hasDOM || !el || !el.nodeType) return null;
    if (reg.has(el)) return reg.get(el);
    injectStyle();

    var host = hostOf(el);
    var rail = document.createElement("div");
    rail.className = "dsc-rail";
    var thumb = document.createElement("div");
    thumb.className = "dsc-thumb";
    rail.appendChild(thumb);
    host.appendChild(rail);
    el.classList.add("dsc-on");

    var st = {
      el: el, host: host, rail: rail, thumb: thumb,
      drag: null, ro: null, mo: null
    };
    reg.set(el, st);

    /* --- keep the rail in sync with the scroller ------------------------- */
    el.addEventListener("scroll", function () { schedule(); }, { passive: true });

    if (typeof ResizeObserver !== "undefined") {
      st.ro = new ResizeObserver(function () { schedule(); });
      st.ro.observe(el);
      if (el.firstElementChild) st.ro.observe(el.firstElementChild);
    }
    if (typeof MutationObserver !== "undefined") {
      st.mo = new MutationObserver(function () { schedule(); });
      // attributes matter as much as childList here: collapsing a `.secbody`
      // or toggling `.hidden` changes scrollHeight without changing the
      // scroller's own box, so a ResizeObserver alone would miss it.
      st.mo.observe(el, {
        childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: ["class", "style", "hidden"]
      });
    }

    /* --- drag the handle -------------------------------------------------- */
    thumb.addEventListener("pointerdown", function (e) {
      var g = measure(st);
      if (!g.overflow) return;
      e.preventDefault();
      e.stopPropagation();
      st.drag = { y: e.clientY, top: g.top, maxTop: g.maxTop };
      rail.classList.add("drag");
      document.body.classList.add("dsc-dragging");
      try { thumb.setPointerCapture(e.pointerId); } catch (_) {}
    });
    thumb.addEventListener("pointermove", function (e) {
      if (!st.drag) return;
      e.preventDefault();
      var m = metrics(st);
      st.el.scrollTop = scrollFor({
        thumbTop: st.drag.top + (e.clientY - st.drag.y),
        maxTop: st.drag.maxTop, viewport: m.viewport, content: m.content
      });
      render(st);
    });
    function endDrag(e) {
      if (!st.drag) return;
      st.drag = null;
      rail.classList.remove("drag");
      document.body.classList.remove("dsc-dragging");
      if (e && e.pointerId != null) { try { thumb.releasePointerCapture(e.pointerId); } catch (_) {} }
    }
    thumb.addEventListener("pointerup", endDrag);
    thumb.addEventListener("pointercancel", endDrag);

    /* --- click the bare rail: centre the handle there ---------------------- */
    rail.addEventListener("pointerdown", function (e) {
      if (e.target === thumb || st.drag) return;
      e.preventDefault();
      var m = metrics(st);
      st.el.scrollTop = jumpTo({
        clickY: e.clientY - rail.getBoundingClientRect().top,
        viewport: m.viewport, content: m.content,
        scrollTop: st.el.scrollTop, track: m.track
      });
      render(st);
    });

    render(st);
    return st;
  }

  function detach(el) {
    var st = reg.get(el);
    if (!st) return;
    if (st.ro) st.ro.disconnect();
    if (st.mo) st.mo.disconnect();
    if (st.rail.parentNode) st.rail.parentNode.removeChild(st.rail);
    el.classList.remove("dsc-on");
    reg.delete(el);
  }

  /** Live pixel metrics for one attached region. */
  function metrics(st) {
    var el = st.el;
    return {
      viewport: el.clientHeight,
      content: el.scrollHeight,
      scrollTop: el.scrollTop,
      track: Math.max(0, el.clientHeight - 4)   // rail is inset 2px top+bottom
    };
  }

  function measure(st) {
    var m = metrics(st);
    return geom({
      viewport: m.viewport, content: m.content,
      scrollTop: m.scrollTop, track: m.track
    });
  }

  /** Reposition the rail over its scroller and redraw the handle. */
  function render(st) {
    var el = st.el;
    // A collapsed / hidden dock measures 0 — park the rail rather than
    // drawing a stray sliver in the corner.
    if (!el.clientHeight || !el.clientWidth) { st.rail.classList.remove("on"); return; }

    // Re-resolve the host: docks get shown/hidden and re-parented by the
    // layout toggles, and offsetTop is only meaningful against the right one.
    var host = hostOf(el);
    if (host !== st.host) { st.host = host; host.appendChild(st.rail); }

    st.rail.style.top = (el.offsetTop + 2) + "px";
    st.rail.style.height = Math.max(0, el.clientHeight - 4) + "px";
    st.rail.style.left = (el.offsetLeft + el.clientWidth - RAIL_W - 2) + "px";

    var g = measure(st);
    st.rail.classList.toggle("on", g.overflow);
    if (!g.overflow) return;
    st.thumb.style.height = g.size + "px";
    st.thumb.style.top = g.top + "px";
  }

  /** Coalesce bursts of scroll/mutation/resize into one paint. */
  function schedule() {
    if (!hasDOM || frame) return;
    frame = requestAnimationFrame(function () {
      frame = 0;
      reg.forEach(function (st) { render(st); });
    });
  }

  function refresh(el) {
    if (!el) return refreshAll();
    var st = reg.get(el);
    if (st) render(st);
    else if (typeof el === "string" && document.getElementById(el)) {
      var got = reg.get(document.getElementById(el));
      if (got) render(got);
    }
  }

  function refreshAll() { if (reg) reg.forEach(function (st) { render(st); }); }

  /** Attach to every `[data-dockscroll]` under `rootEl` that isn't wired yet. */
  function scan(rootEl) {
    if (!hasDOM) return 0;
    var scope = rootEl || document;
    var found = scope.querySelectorAll("[data-dockscroll]");
    for (var i = 0; i < found.length; i++) attach(found[i]);
    return found.length;
  }

  if (hasDOM) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () { scan(); });
    } else {
      scan();
    }
    window.addEventListener("resize", schedule, { passive: true });
  }

  return {
    attach: attach, detach: detach, scan: scan,
    refresh: refresh, refreshAll: refreshAll, schedule: schedule,
    // pure helpers (headless-testable)
    geom: geom, scrollFor: scrollFor, jumpTo: jumpTo,
    RAIL_W: RAIL_W, MIN_THUMB: MIN_THUMB
  };
});
