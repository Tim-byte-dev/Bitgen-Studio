/* bitGen Studio — THE FLOATING PROMPT DOCKER (2.389.0), window.PFloat.
 *
 * Tim (verbatim): "make our prompt docker floating but allow user to snap to another docker - a drag and drop snap
 * "P" will toggle the prompt unless typing in an input" - asked how it snaps: "Both" (magnetic edges AND drop zones).
 *
 *   FLOATING      the prompt docker is a window of its own over the app (its titlebar drags it, 2.398.0: EVERY edge and
 *                 corner sizes it - static/dockfloat.js grips; in a side docker its bottom edge does;
 *                 a header click still collapses it to the titlebar)
 *   MAGNETIC      while it is dragged its edges stick (10 px) to the edges of the other dockers and of the window
 *   DROP ZONES    over another docker the edge the pointer is near lights up - drop there and the prompt DOCKS:
 *                 top / bottom = into the column above / below it; left / right = beside it in a row (a splitter
 *                 between them sizes the prompt's width); a side docker (Settings, Refs, Assets, Queue, Gallery)
 *                 takes it at its top / bottom. Dragging a docked prompt's titlebar more than a few px floats it again.
 *   P             shows / hides the prompt docker anywhere in the app - never while typing in a box, never with a
 *                 dialog open, never with Ctrl / Alt / Shift (Shift+P is the timeline's Path tool now)
 *   REMEMBERED    docker_status.json (lib/dockerStatus.js): promptdock.floating, x, y, float_w, float_h, dock_to,
 *                 dock_side - so it comes back where it was.
 * The geometry (snap, the drop zone, keeping it on screen) is pure (tested in Node).
 */
(function (root) {
  "use strict";

  /* ================================ pure ================================ */
  const SIDES = ["top", "bottom", "left", "right"];
  /** magnetic edges: rect {x, y, w, h} -> {x, y} with its edges stuck to any target edge {l, t, r, b} within thr */
  function snap(rect, targets, thr) {
    const t = thr == null ? 10 : thr;
    let bx = null, by = null;
    const tryX = (d) => { if (Math.abs(d) <= t && (bx === null || Math.abs(d) < Math.abs(bx))) bx = d; };
    const tryY = (d) => { if (Math.abs(d) <= t && (by === null || Math.abs(d) < Math.abs(by))) by = d; };
    const L = rect.x, R = rect.x + rect.w, T = rect.y, B = rect.y + rect.h;
    for (const g of targets || []) {
      const overlapY = B > g.t - t && T < g.b + t, overlapX = R > g.l - t && L < g.r + t;
      if (overlapY) { tryX(g.r - L); tryX(g.l - R); tryX(g.l - L); tryX(g.r - R); }
      if (overlapX) { tryY(g.b - T); tryY(g.t - B); tryY(g.t - T); tryY(g.b - B); }
    }
    return { x: rect.x + (bx || 0), y: rect.y + (by || 0), snappedX: bx !== null, snappedY: by !== null };
  }
  /** which edge of target r {l, t, r, b} the pointer (px, py) is near: a band of 30 % (at most 90 px); else null.
   *  sides = the edges this target takes (a side docker: top / bottom only) */
  function zoneAt(px, py, r, sides) {
    if (px < r.l || px > r.r || py < r.t || py > r.b) return null;
    const w = r.r - r.l, h = r.b - r.t, bw = Math.min(90, w * 0.3), bh = Math.min(90, h * 0.3);
    const allow = sides || SIDES;
    const c = [["top", py - r.t, bh], ["bottom", r.b - py, bh], ["left", px - r.l, bw], ["right", r.r - px, bw]]
      .filter(([s, d, band]) => allow.includes(s) && d <= band).sort((a, b) => a[1] / a[2] - b[1] / b[2]);
    return c.length ? c[0][0] : null;
  }
  /** the rectangle a drop zone lights up */
  function zoneRect(r, side) {
    const w = r.r - r.l, h = r.b - r.t;
    if (side === "top") return { l: r.l, t: r.t, r: r.r, b: r.t + h / 2 };
    if (side === "bottom") return { l: r.l, t: r.t + h / 2, r: r.r, b: r.b };
    if (side === "left") return { l: r.l, t: r.t, r: r.l + w / 2, b: r.b };
    return { l: r.l + w / 2, t: r.t, r: r.r, b: r.b };
  }
  /** keep a floating window reachable: its titlebar inside the viewport */
  function onScreen(x, y, w, vw, vh) {
    return { x: Math.round(Math.max(-(w - 80), Math.min(vw - 80, x))), y: Math.round(Math.max(0, Math.min(vh - 32, y))) };
  }
  /** P toggles the prompt? not while typing, not with a modifier, not over a dialog - and (2.421.0) not while the
   *  pointer / focus is in the image editor, where P is Photoshop's Pen (ownerHit) */
  function wantsToggle(e, active, dialogOpen, ownerHit) {
    if (!e || (e.key !== "p" && e.key !== "P") || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.repeat) return false;
    if (dialogOpen || ownerHit) return false;
    const a = active;
    if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName || ""))) {
      const ty = String(a.type || "").toLowerCase();
      if (!(a.tagName === "INPUT" && /^(range|checkbox|radio|button|color|file)$/.test(ty))) return false;
    }
    return true;
  }
  const pure = { snap, zoneAt, zoneRect, onScreen, wantsToggle, SIDES };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ================================ the page ================================ */
  const $ = (id) => document.getElementById(id);
  const SIDE_IDS = ["ldock", "refsdock", "assetsdock", "qdock", "rdock"];
  const CSS = ""
    // 2.398.0 (Tim: "the prompt docker won't allow me to resize it's height"): no more resize:both (only its tiny
    // bottom-right corner sized it) - static/dockfloat.js grips: every edge and corner of the floating window, the
    // bottom edge while it sits in a side docker
    + "#promptdock.pf-float{position:fixed;z-index:44;border:1px solid var(--line,#3a342a);border-radius:10px;box-shadow:0 14px 40px rgba(0,0,0,.55);"
    + "overflow:hidden;min-width:320px;min-height:110px;max-width:96vw;max-height:92vh}"
    + "#promptdock.pf-float.collapsed{height:30px!important;min-height:30px}"
    + "#promptdock.pf-side{position:relative}"
    + "#promptdock.pf-free > .bhead > .maxbtn,#promptdock.pf-free > .bhead > .pinbtn{display:none}"
    + "#promptdock.pf-free + .hsplit,.pf-row > .hsplit{display:none}"
    + "#promptdock > .bhead{cursor:grab}"
    + "#promptdock.pf-dragging > .bhead{cursor:grabbing}"
    + "#promptdock .pf-badge{margin-left:auto;font-family:var(--mono,monospace);font-size:.62rem;letter-spacing:0;border:1px solid var(--line,#3a342a);border-radius:4px;padding:0 5px;color:var(--dim,#9a917f)}"
    + ".pf-row{display:flex;flex-direction:row;min-height:0;flex-shrink:0}"
    + ".pf-row:has(> .bdock.maxed),.pf-row:has(> #videodock:not(.collapsed):not(.dockgone)){flex:1 1 auto}"
    + ".pf-row > .bdock{min-width:0;align-self:stretch}"
    + ".pf-row > .bdock:not(#promptdock){flex:1 1 auto}"
    + ".pf-row > #promptdock{flex:0 0 var(--pfw,420px);height:auto!important;border-left:1px solid var(--line,#3a342a);border-right:1px solid var(--line,#3a342a)}"
    + ".pf-row:not(:has(> .bdock:not(#promptdock):not(.dockgone))) > #promptdock{flex:1 1 auto;height:var(--ph)!important}"
    + ".pf-row > .pf-vs{flex:0 0 6px;cursor:col-resize;margin:0 -3px;z-index:5}"
    + ".pf-row > .pf-vs:hover{background:var(--tiger-deep,#a35a1a)}"
    + ".dock > #promptdock.pf-side{height:var(--ph);flex:0 0 auto;border-top:1px solid var(--line,#3a342a);border-bottom:1px solid var(--line,#3a342a)}"
    + "#pfZone{position:fixed;z-index:9998;background:rgba(38,128,235,.22);border:2px solid #2680eb;border-radius:6px;pointer-events:none;display:none}"
    + "#pfZone b{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:600 12px system-ui;color:#fff;background:#2680eb;padding:3px 8px;border-radius:4px;white-space:nowrap}";

  function ready() { try { return !!($("promptdock") && typeof DS !== "undefined" && dsReady && $("maincol")); } catch (e) { return false; } }
  function boot() { if (!$("promptdock")) return; if (!ready()) { setTimeout(boot, 80); return; } start(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  function start() {
    if (window.PFloat && window.PFloat.started) return;
    if (!$("pfCss")) { const st = document.createElement("style"); st.id = "pfCss"; st.textContent = CSS; document.head.appendChild(st); }
    const el = $("promptdock"), head = el.querySelector(".bhead");
    const split = el.nextElementSibling && el.nextElementSibling.classList.contains("hsplit") ? el.nextElementSibling : null;
    const zone = document.createElement("div"); zone.id = "pfZone"; zone.innerHTML = "<b></b>"; document.body.appendChild(zone);
    const badge = document.createElement("span"); badge.className = "pf-badge"; badge.textContent = "P"; badge.title = "P shows / hides the prompt docker (not while typing)";
    head.appendChild(badge);
    const entry = () => (typeof dsEntry === "function" ? dsEntry("promptdock") : {});
    const save = () => {
      const e = entry();
      try {
        fetch("/api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ docks: { promptdock: { floating: !!e.floating, x: e.x, y: e.y, float_w: e.float_w, float_h: e.float_h, dock_to: e.dock_to || "", dock_side: e.dock_side || "", dock_w: e.dock_w || 0 } } }) }).catch(() => {});
      } catch (err) { /* offline */ }
    };
    const relayout = () => { try { if (typeof reflowSoon === "function") reflowSoon(); window.dispatchEvent(new Event("resize")); } catch (e) { /* jsdom */ } };

    /* ---- leaving wherever it is ---- */
    function unplace() {
      const row = el.parentElement && el.parentElement.classList.contains("pf-row") ? el.parentElement : null;
      el.classList.remove("pf-float", "pf-free", "pf-side");
      el.style.left = el.style.top = el.style.width = el.style.height = "";
      if (row) {
        const other = row.querySelector(":scope > .bdock:not(#promptdock)");
        if (other) row.parentElement.insertBefore(other, row);
        row.remove();
      }
    }
    function putSplit() { if (split) el.after(split); }
    /* ---- floating ---- */
    function float(x, y, w, h, quiet) {
      unplace();
      document.body.appendChild(el); putSplit();
      el.classList.add("pf-float", "pf-free");
      const e = entry(), vw = window.innerWidth || 1280, vh = window.innerHeight || 800, col = $("maincol").getBoundingClientRect();
      const W = Math.round(w || e.float_w || Math.min(760, Math.max(360, col.width - 40))), H = Math.round(h || e.float_h || 260);
      let X = x != null ? x : (e.x != null && e.x !== -1 ? e.x : col.left + (col.width - W) / 2), Y = y != null ? y : (e.y != null && e.y >= 0 ? e.y : vh - H - 70);
      const p = onScreen(X, Y, W, vw, vh);
      el.style.left = p.x + "px"; el.style.top = p.y + "px"; el.style.width = W + "px"; el.style.height = H + "px";
      Object.assign(e, { floating: true, x: p.x, y: p.y, float_w: W, float_h: H });
      if (!quiet) { save(); relayout(); }
    }
    /* ---- docked ---- */
    function dockTo(target, side, quiet) {
      if (!target || target === el || !SIDES.includes(side)) return false;
      const sideDock = SIDE_IDS.includes(target.id);
      unplace();
      if (sideDock) {
        if (side === "top") { const h = target.querySelector(":scope > .dockhead"); target.insertBefore(el, h ? h.nextSibling : target.firstChild); }
        else target.appendChild(el);
        putSplit();
        el.classList.add("pf-side", "pf-free");
      } else {
        const ref = target.parentElement && target.parentElement.classList.contains("pf-row") ? target.parentElement : target;
        const col = ref.parentElement;
        if (side === "top") { col.insertBefore(el, ref); putSplit(); }
        else if (side === "bottom") { const after = ref.nextElementSibling && ref.nextElementSibling.classList.contains("hsplit") ? ref.nextElementSibling : ref; after.after(el); putSplit(); }
        else {
          if (ref !== target) { col.insertBefore(el, ref); putSplit(); return dockTo(target, "top", quiet); }   // one row at a time
          const row = document.createElement("div"); row.className = "pf-row";
          col.insertBefore(row, target);
          const vs = document.createElement("div"); vs.className = "pf-vs"; vs.title = "Drag to size the prompt docker's width";
          if (side === "left") row.append(el, vs, target); else row.append(target, vs, el);
          if (split) row.appendChild(split);                // hidden in a row (the row's own dock keeps its splitter)
          el.classList.add("pf-free");
          vsDrag(vs, side);
        }
      }
      const e = entry(); Object.assign(e, { floating: false, dock_to: target.id, dock_side: side });
      if (e.dock_w) document.documentElement.style.setProperty("--pfw", e.dock_w + "px");
      if (!quiet) { save(); relayout(); }
      return true;
    }
    function vsDrag(vs, side) {
      vs.addEventListener("pointerdown", (ev) => {
        ev.preventDefault(); vs.setPointerCapture(ev.pointerId);
        const x0 = ev.clientX, w0 = el.getBoundingClientRect().width;
        const mv = (m) => { const w = Math.max(240, Math.min(1400, w0 + (side === "left" ? m.clientX - x0 : x0 - m.clientX))); document.documentElement.style.setProperty("--pfw", w + "px"); entry().dock_w = Math.round(w); };
        const up = () => { vs.removeEventListener("pointermove", mv); vs.removeEventListener("pointerup", up); save(); relayout(); };
        vs.addEventListener("pointermove", mv); vs.addEventListener("pointerup", up);
      });
    }
    /** where it should be, from docker_status.json */
    function restore() {
      const e = entry();
      if (e.floating === false && e.dock_to) { const t = $(e.dock_to); if (t && t !== el && dockTo(t, e.dock_side || "bottom", true)) { relayout(); return; } }
      if (e.floating === false) { relayout(); return; }                   // docked in its own place in the column
      float(null, null, null, null, true); relayout();
    }

    /* ---- the drag (the titlebar) ---- */
    function targets() {
      const out = [];
      const add = (t, sides) => { if (!t || t === el || el.contains(t) || t.classList.contains("dockgone")) return; const r = t.getBoundingClientRect(); if (r.width < 40 || r.height < 20) return; out.push({ el: t, sides, l: r.left, t: r.top, r: r.right, b: r.bottom }); };
      document.querySelectorAll("#maincol .bdock").forEach((t) => add(t, SIDES));
      const app = $("app");
      SIDE_IDS.forEach((id) => { const t = $(id); if (t && t.offsetParent !== null && !(app && t.offsetWidth === 0)) add(t, ["top", "bottom"]); });
      return out;
    }
    let drag = null;
    head.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0 || (ev.target.closest && ev.target.closest("button, select, input, label"))) return;
      drag = { x0: ev.clientX, y0: ev.clientY, started: false };
      const mv = (m) => {
        if (!drag) return;
        if (!drag.started) {
          if (Math.hypot(m.clientX - drag.x0, m.clientY - drag.y0) < 6) return;
          drag.started = true;
          const r = el.getBoundingClientRect();
          if (!el.classList.contains("pf-float")) {             // tear it out of the layout, under the pointer
            const w = Math.max(360, Math.min(900, r.width)), h = el.classList.contains("collapsed") ? (entry().float_h || 260) : Math.max(140, Math.min(600, r.height));
            float(m.clientX - Math.min(w / 2, m.clientX - r.left), m.clientY - 14, w, h, true);
          }
          const r2 = el.getBoundingClientRect();
          drag.ox = m.clientX - r2.left; drag.oy = m.clientY - r2.top;
          el.classList.add("pf-dragging");
          drag.targets = targets();
        }
        const w = el.offsetWidth, h = el.offsetHeight;
        const vw = window.innerWidth, vh = window.innerHeight;
        const win = { l: 0, t: 0, r: vw, b: vh };
        let p = snap({ x: m.clientX - drag.ox, y: m.clientY - drag.oy, w, h }, drag.targets.concat([win]), 10);
        p = onScreen(p.x, p.y, w, vw, vh);
        el.style.left = p.x + "px"; el.style.top = p.y + "px";
        // a drop zone?
        drag.zone = null;
        for (const t of drag.targets) { const s = zoneAt(m.clientX, m.clientY, t, t.sides); if (s) { drag.zone = { el: t.el, side: s, r: zoneRect(t, s) }; break; } }
        if (drag.zone) {
          const z = drag.zone.r;
          Object.assign(zone.style, { display: "block", left: z.l + "px", top: z.t + "px", width: (z.r - z.l) + "px", height: (z.b - z.t) + "px" });
          zone.querySelector("b").textContent = "Dock prompt " + { top: "above", bottom: "below", left: "left of", right: "right of" }[drag.zone.side] + " " + dockName(drag.zone.el);
        } else zone.style.display = "none";
      };
      const up = () => {
        window.removeEventListener("pointermove", mv, true); window.removeEventListener("pointerup", up, true);
        const d = drag; drag = null; zone.style.display = "none"; el.classList.remove("pf-dragging");
        if (!d || !d.started) return;
        // the click that ends a drag is not a header click (collapse)
        const eat = (c) => { c.stopPropagation(); c.preventDefault(); window.removeEventListener("click", eat, true); };
        window.addEventListener("click", eat, true); setTimeout(() => window.removeEventListener("click", eat, true), 300);
        if (d.zone) { dockTo(d.zone.el, d.zone.side); return; }
        const e = entry(); e.x = parseInt(el.style.left, 10); e.y = parseInt(el.style.top, 10); e.floating = true; e.dock_to = ""; e.dock_side = "";
        save(); relayout();
      };
      window.addEventListener("pointermove", mv, true); window.addEventListener("pointerup", up, true);
    });
    function dockName(t) {
      const h = t.querySelector(".bhead, .dockhead h1, .dockhead");
      return h ? h.textContent.replace(/^[▾▸📌\s]+/u, "").replace(/[⛶🗗P].*$/u, "").trim().slice(0, 24) || t.id : t.id;
    }
    // its size, while floating
    if (typeof ResizeObserver === "function") {
      let t = null;
      new ResizeObserver(() => {
        if (!el.classList.contains("pf-float") || el.classList.contains("collapsed") || drag) return;
        clearTimeout(t); t = setTimeout(() => { const e = entry(); const w = el.offsetWidth, h = el.offsetHeight; if (w && h && (w !== e.float_w || h !== e.float_h)) { e.float_w = w; e.float_h = h; save(); } }, 300);
      }).observe(el);
    }
    window.addEventListener("resize", () => {
      if (!el.classList.contains("pf-float")) return;
      const p = onScreen(parseInt(el.style.left, 10) || 0, parseInt(el.style.top, 10) || 0, el.offsetWidth, window.innerWidth, window.innerHeight);
      el.style.left = p.x + "px"; el.style.top = p.y + "px";
    });
    // P anywhere (2.421.0: but the image editor's own - its Pen - while the pointer / focus is in it)
    let lastOver = null;
    window.addEventListener("pointermove", (e) => { lastOver = e.target; }, true);
    window.addEventListener("keydown", (ev) => {
      const a = document.activeElement, OWN = "#imageeditdock, #pushpulldock";   // 2.619.0: + the PushPull docker (P = its Push/Pull)
      const owner = !!((lastOver && lastOver.closest && lastOver.closest(OWN)) || (a && a.closest && a.closest(OWN)));
      if (!wantsToggle(ev, a, !!document.querySelector("dialog[open]"), owner)) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      if (typeof toggleDockGone === "function") toggleDockGone("promptdock", "tP");
      if (!el.classList.contains("dockgone") && el.classList.contains("pf-float")) {
        const p = onScreen(parseInt(el.style.left, 10) || 0, parseInt(el.style.top, 10) || 0, el.offsetWidth, window.innerWidth, window.innerHeight);
        el.style.left = p.x + "px"; el.style.top = p.y + "px";
      }
    }, true);
    /* 2.398.0: the edges that size it (static/dockfloat.js): floating = all eight; in a side docker = its bottom (--ph);
       in the column its own splitter already does it, beside a docker the row's splitters do */
    let grip = null;
    const gripMode = () => (el.classList.contains("collapsed") || el.classList.contains("maxed") ? "none"
      : el.classList.contains("pf-float") ? "float" : el.classList.contains("pf-side") ? "h" : "none");
    if (window.DockFloat && window.DockFloat.grips) {
      grip = window.DockFloat.grips(el, {
        mode: gripMode, min: { w: 320, h: 110 },
        onMove: (r, m) => {
          if (m === "float") Object.assign(el.style, { left: r.x + "px", top: r.y + "px", width: r.w + "px", height: r.h + "px" });
          else if (m === "h") document.documentElement.style.setProperty("--ph", r.h + "px");
        },
        onEnd: (r, m) => {
          const e = entry();
          if (m === "float") { Object.assign(e, { x: r.x, y: r.y, float_w: r.w, float_h: r.h }); save(); }
          else if (m === "h") { if (typeof setVar === "function") setVar("ph", r.h); else document.documentElement.style.setProperty("--ph", r.h + "px"); }
        },
      });
      new MutationObserver(() => grip.refresh()).observe(el, { attributes: true, attributeFilter: ["class"] });
    }
    window.PFloat = { started: true, float, dockTo, restore, unplace, targets, pure, grip: () => grip };
    restore();
  }
  if (typeof window !== "undefined") window.PFloat = window.PFloat || { pure };
})(typeof window !== "undefined" ? window : globalThis);
