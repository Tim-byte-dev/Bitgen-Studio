/* bitGen Studio 2.970.0 — the Timeline docker's extra SCREENS beside the master preview (tlscreens.css).
 *
 * Tim: "in Timeline docker can you put the preview back please, but this time let user add additional screens so different
 * layers can play at the same time, this should make it easier to visualize. keep a master preview for the final . each
 * screen will have the ability to switch positions with the master screen (right click context menu)"
 *
 *   the preview      #tlStage never shrinks under 190 px any more (tlscreens.css) - it had been squeezed to nothing when
 *                    the docker ran short of room
 *   ＋ (SCREENS)     adds a screen: it plays ONE layer (V1, V2…, a picture layer - its own dropdown) in step with the
 *                    master; up to 8; the column's left edge drags it wider - the screens then sit side by side
 *   right-click      ⇄ Swap with the master (again = put the master back), pick its layer, ＋ another, ✕ remove it;
 *                    a double-click on a screen swaps too
 *   swapped          the big preview shows that screen's layer alone (TlCanvas.state.only - canvas.js applies it to the
 *                    master VIEW only: the compile and snapshots always get the whole picture) and the screen shows the
 *                    MASTER - the final picture; a badge on the big preview says so (a click puts it back)
 * Drawn from the master's own draw (TlCanvas.onDraw): the same moment, the same video elements, so they play together.
 * Kept in this browser: h3.tl.screens (each screen's layer - found again by its colour if the layers are reordered),
 * h3.tl.scrw (the column's width). window.TlScreens = { add(lk), remove(i), set(i, lk), swap(i), list(), info() } (tests)
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  var col = $("tlScreens"), list = $("tlScrList");
  if (!col || !list) return;
  var LSK = "h3.tl.screens", LSW = "h3.tl.scrw", MAX = 8;
  var G = { screens: [], swap: -1, menu: null, sig: "" };
  var C = function () { return window.TlCanvas && TlCanvas.state && TlCanvas.stack ? TlCanvas : null; };
  var ls = { get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
             set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* fine */ } } };

  /* ---------------- the layers a screen can show (the picture's, not sound) ---------------- */
  function layers() { var c = C(); try { return c ? c.stack() : []; } catch (e) { return []; } }
  function label(Ly) {
    var lab = typeof lkLabel === "function" ? String(lkLabel(Ly.lk)) : Ly.lk, n = Ly.L && Ly.L.name;
    return lab + (n && String(n).toLowerCase() !== lab.toLowerCase() && n !== Ly.lk ? " · " + n : "");
  }
  /** a screen's layer now - by its colour first (it survives a reorder), else by its key */
  function find(sc) {
    var st = layers();
    if (sc.hue != null) { var h = st.filter(function (Ly) { return Ly.L && Ly.L.hue === sc.hue; }); if (h.length === 1) { sc.lk = h[0].lk; return h[0]; } }
    for (var i = 0; i < st.length; i++) if (st[i].lk === sc.lk) return st[i];
    return null;
  }
  function save() { ls.set(LSK, JSON.stringify(G.screens.map(function (s) { return { lk: s.lk, hue: s.hue }; }))); }
  function say(m) { try { var c = C(); if (c && c.say) c.say(m); } catch (e) { /* fine */ } }

  /* ---------------- building the column ---------------- */
  function options(sel, cur) {
    var st = layers(), h = '<option value="">— pick a layer —</option>';
    st.forEach(function (Ly) { h += '<option value="' + Ly.lk + '"' + (Ly.lk === cur ? " selected" : "") + ">" + label(Ly).replace(/[<>&]/g, "") + "</option>"; });
    sel.innerHTML = h;
    if (cur && !st.some(function (Ly) { return Ly.lk === cur; })) sel.value = "";
  }
  function build() {
    list.innerHTML = "";
    if (G.screens.length) col.removeAttribute("data-empty"); else col.setAttribute("data-empty", "1");
    G.screens.forEach(function (sc, i) {
      var Ly = find(sc), el = document.createElement("div");
      el.className = "tsc" + (G.swap === i ? " master" : ""); el.dataset.i = String(i); el.tabIndex = 0; el.setAttribute("role", "listitem");
      el.title = "Screen " + (i + 2) + " - right-click: swap with the master, its layer, remove · double-click: swap";
      el.innerHTML = '<div class="tsc-bar"><span class="tsc-n">' + (i + 2) + '</span><select class="tsc-sel" aria-label="The layer screen ' + (i + 2) + ' plays"></select>'
        + '<button type="button" class="tsc-x" title="Remove this screen" aria-label="Remove screen ' + (i + 2) + '">✕</button></div>'
        + '<canvas class="tsc-cv"></canvas><div class="tsc-tag"></div>';
      var sel = el.querySelector(".tsc-sel");
      options(sel, Ly ? Ly.lk : "");
      sel.addEventListener("mousedown", function () { options(sel, sel.value); });
      sel.addEventListener("change", function () { set(i, sel.value); });
      el.querySelector(".tsc-x").addEventListener("click", function () { remove(i); });
      el.querySelector(".tsc-cv").addEventListener("dblclick", function () { swap(i); });
      el.addEventListener("contextmenu", function (e) { e.preventDefault(); e.stopPropagation(); menu(i, e.clientX, e.clientY); });
      el.addEventListener("keydown", function (e) { if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) { e.preventDefault(); var r = el.getBoundingClientRect(); menu(i, r.left + 20, r.top + 20); } });
      list.appendChild(el);
    });
    var c = C(); if (c) col.style.setProperty("--tsc-ar", (c.state.W || 16) + " / " + (c.state.H || 9));
    G.sig = sig();
    badge(); paint(); if (c && c.mark) c.mark();
  }
  function sig() { return layers().map(function (Ly) { return Ly.lk + ":" + label(Ly) + ":" + (Ly.L && Ly.L.hue); }).join("|"); }

  /* ---------------- what each screen shows ---------------- */
  function paint() {
    var c = C(); if (!c || !G.screens.length || !col.offsetParent) return;
    if (sig() !== G.sig) {                                                    // layers added / renamed / reordered: the lists follow
      G.sig = sig();
      Array.prototype.forEach.call(list.querySelectorAll(".tsc"), function (el) { var sc = G.screens[+el.dataset.i]; var Ly = sc && find(sc); options(el.querySelector(".tsc-sel"), Ly ? Ly.lk : ""); });
    }
    var S = c.state, t = S.t || 0, W = S.W || 1920, H = S.H || 1080, dpr = window.devicePixelRatio || 1;
    if (G.swap >= 0) { var sw = G.screens[G.swap], sL = sw && find(sw); S.only = sL ? sL.lk : null; if (!sL) { G.swap = -1; S.only = null; badge(); } }
    Array.prototype.forEach.call(list.querySelectorAll(".tsc"), function (el) {
      var i = +el.dataset.i, sc = G.screens[i], cv = el.querySelector(".tsc-cv"), tag = el.querySelector(".tsc-tag");
      var cw = cv.clientWidth; if (!cw) return;
      var ch = Math.round(cw * H / W), pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
      if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
      var g = cv.getContext("2d"), k = pw / W;
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
      g.fillStyle = "#000"; g.fillRect(0, 0, pw, ph);
      var master = G.swap === i, Ly = find(sc);
      g.save(); g.setTransform(k, 0, 0, k, 0, 0); g.beginPath(); g.rect(0, 0, W, H); g.clip();
      try {
        if (master) c.paintComp(g, t);                                        // the final picture, everything in it
        else if (Ly) c.drawLayer(g, Ly, t);                                   // this one layer, as it plays
      } catch (e) { /* a screen never breaks the master */ }
      g.restore();
      el.classList.toggle("master", master);
      tag.textContent = master ? "MASTER · the final picture" : Ly ? label(Ly) : "pick a layer ▴";
    });
  }

  /* ---------------- add / remove / change / swap ---------------- */
  function add(lk) {
    if (G.screens.length >= MAX) { say("Screens: " + MAX + " at most"); return -1; }
    var st = layers(), used = G.screens.map(function (s) { return s.lk; });
    if (!lk) {                                                                // the picked layer if it is a picture one, else one no screen shows yet
      var pick = typeof tl === "object" && tl && tl.selLayer;
      lk = st.some(function (Ly) { return Ly.lk === pick; }) && used.indexOf(pick) < 0 ? pick : null;
      if (!lk) { var free = st.filter(function (Ly) { return used.indexOf(Ly.lk) < 0 && Ly.lk !== "v1"; })[0] || st.filter(function (Ly) { return used.indexOf(Ly.lk) < 0; })[0]; lk = free ? free.lk : ""; }
    }
    var Ly = st.filter(function (x) { return x.lk === lk; })[0];
    G.screens.push({ lk: lk || "", hue: Ly && Ly.L && Number.isFinite(Ly.L.hue) ? Ly.L.hue : null });
    save(); build();
    return G.screens.length - 1;
  }
  function remove(i) {
    if (!G.screens[i]) return;
    if (G.swap === i) unswap(); else if (G.swap > i) G.swap--;
    G.screens.splice(i, 1); save(); build();
  }
  function set(i, lk) {
    var sc = G.screens[i]; if (!sc) return;
    var Ly = layers().filter(function (x) { return x.lk === lk; })[0];
    sc.lk = lk || ""; sc.hue = Ly && Ly.L && Number.isFinite(Ly.L.hue) ? Ly.L.hue : null;
    save(); build();
  }
  function unswap() { var c = C(); G.swap = -1; if (c) { c.state.only = null; if (c.mark) c.mark(); } badge(); }
  /** this screen and the master change places (again = back) */
  function swap(i) {
    var c = C(), sc = G.screens[i]; if (!c || !sc) return false;
    if (G.swap === i) { unswap(); build(); say("The master is back on the big preview"); return false; }
    var Ly = find(sc); if (!Ly) { say("Pick a layer for screen " + (i + 2) + " first"); return false; }
    G.swap = i; c.state.only = Ly.lk;
    build(); say("Screen " + (i + 2) + " (" + label(Ly) + ") is on the big preview - the master plays on screen " + (i + 2));
    return true;
  }
  function badge() {
    var wrap = $("tlCanvasWrap"); if (!wrap) return;
    var b = $("tlScrBadge");
    if (!b) { b = document.createElement("div"); b.id = "tlScrBadge"; b.setAttribute("role", "button"); b.tabIndex = 0;
      b.addEventListener("click", function () { if (G.swap >= 0) swap(G.swap); });
      b.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (G.swap >= 0) swap(G.swap); } });
      wrap.appendChild(b); }
    var sc = G.swap >= 0 ? G.screens[G.swap] : null, Ly = sc && find(sc);
    b.hidden = !Ly;
    if (Ly) { b.textContent = "◉ SCREEN " + (G.swap + 2) + " · " + label(Ly) + " - the master is on screen " + (G.swap + 2) + " (click: put it back)"; b.title = "Click (or right-click screen " + (G.swap + 2) + " ▸ Put the master back) to show the final picture here again"; }
  }

  /* ---------------- the right-click menu ---------------- */
  function closeMenu() { if (G.menu) { G.menu.remove(); G.menu = null; } }
  function menu(i, x, y) {
    closeMenu();
    var m = document.createElement("div"), sw = G.swap === i;
    m.className = "tsc-menu"; m.setAttribute("role", "menu");
    var item = function (txt, fn, dis) { var b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "menuitem"); b.textContent = txt; if (dis) b.disabled = true;
      b.addEventListener("click", function () { closeMenu(); fn(); }); m.appendChild(b); return b; };
    item(sw ? "⇄ Put the master back" : "⇄ Swap with the master", function () { swap(i); }, !sw && !find(G.screens[i]));
    item("▣ Show another layer…", function () { var s = list.querySelector('.tsc[data-i="' + i + '"] .tsc-sel'); if (s) { s.focus(); try { s.showPicker(); } catch (e) { /* older */ } } });
    m.appendChild(document.createElement("hr"));
    item("＋ Add a screen", function () { add(); }, G.screens.length >= MAX);
    item("✕ Remove screen " + (i + 2), function () { remove(i); });
    document.body.appendChild(m);
    var r = m.getBoundingClientRect();
    m.style.left = Math.max(4, Math.min(x, window.innerWidth - r.width - 4)) + "px";
    m.style.top = Math.max(4, Math.min(y, window.innerHeight - r.height - 4)) + "px";
    G.menu = m;
    var first = m.querySelector("button:not([disabled])"); if (first) first.focus();
    m.addEventListener("keydown", function (e) {
      var bs = Array.prototype.slice.call(m.querySelectorAll("button:not([disabled])")), k = bs.indexOf(document.activeElement);
      if (e.key === "Escape") { e.preventDefault(); closeMenu(); }
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); bs[(k + (e.key === "ArrowDown" ? 1 : -1) + bs.length) % bs.length].focus(); }
    });
  }
  document.addEventListener("pointerdown", function (e) { if (G.menu && !G.menu.contains(e.target)) closeMenu(); }, true);
  window.addEventListener("blur", closeMenu);

  /* ---------------- the column's width ---------------- */
  function width(px) {
    var stage = $("tlStage"), max = stage ? Math.max(220, stage.clientWidth * 0.7) : 1200;
    px = Math.round(Math.max(180, Math.min(max, +px || 300)));
    col.style.setProperty("--tlscrw", px + "px"); ls.set(LSW, String(px));
    paint(); var c = C(); if (c && c.mark) c.mark();
    return px;
  }
  (function grip() {
    var g = $("tlScrGrip"); if (!g) return;
    var x0 = null, w0 = 0;
    g.addEventListener("pointerdown", function (e) { if (e.button !== 0) return; e.preventDefault(); g.setPointerCapture(e.pointerId); g.classList.add("on"); x0 = e.clientX; w0 = col.offsetWidth; });
    g.addEventListener("pointermove", function (e) { if (x0 == null) return; width(w0 + (x0 - e.clientX)); });
    var up = function () { x0 = null; g.classList.remove("on"); };
    g.addEventListener("pointerup", up); g.addEventListener("pointercancel", up);
  })();

  /* ---------------- start ---------------- */
  $("tlScrAdd").addEventListener("click", function () { add(); });
  col.addEventListener("contextmenu", function (e) { if (e.target.closest(".tsc")) return; e.preventDefault(); }, false);
  try { G.screens = (JSON.parse(ls.get(LSK, "[]")) || []).filter(function (s) { return s && typeof s.lk === "string"; }).slice(0, MAX); } catch (e) { G.screens = []; }
  var w = +ls.get(LSW, "0"); if (w) col.style.setProperty("--tlscrw", w + "px");
  (function boot() {
    var c = C();
    if (!c || !c.onDraw) { setTimeout(boot, 120); return; }
    c.onDraw(function () { paint(); });
    build();
    if (window.ResizeObserver) new ResizeObserver(function () { paint(); }).observe(col);
  })();

  window.TlScreens = {
    add: add, remove: remove, set: set, swap: swap, width: width,
    list: function () { return G.screens.map(function (s) { return { lk: s.lk, hue: s.hue }; }); },
    info: function () { var c = C(); return { n: G.screens.length, swap: G.swap, only: c ? c.state.only || null : null, width: col.offsetWidth, empty: col.hasAttribute("data-empty"),
      tags: Array.prototype.map.call(list.querySelectorAll(".tsc-tag"), function (t) { return t.textContent; }), badge: ($("tlScrBadge") || {}).hidden === false ? $("tlScrBadge").textContent : "" }; }
  };
})();
