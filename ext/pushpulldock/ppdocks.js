/* bitGen Studio — ext/pushpulldock/ppdocks.js (2.984.0): THE SKETCHER'S PROPERTIES DOCKER (window.H3PPDocks) - a collapsible
 * docker column next to the left toolbox that holds the Sketcher's own panels, as tabs or stacked one below the other.
 * Tim (verbatim): "make the properties panel next to the left toolbox a collapsible docker. allow other dockers that are
 * confined to sketcher to dock inside the properties docker either as a docker below or as a tab inside the properties
 * docker."
 *
 *   #ppDockCol (in #ppMain, right after #ppTools)
 *     head      ⚙ Docker · ▾ (every Sketcher panel: Tab / Below / Own place, Reset) · « folds it to a strip
 *     groups    one or more stacked dockers; each = a tab bar (+ ⋯ for the tab shown) and its body; a bar between two
 *               dockers shares the height; the right edge sizes the column
 *     strip     folded: one upright button a panel - a click opens the column on that panel
 *   the panels  🗂 Outline (#ppOutline) and ⚙ Properties (#ppProps) start in it, stacked; 🧱 Wall types (#ppWT), 📚 DAZ
 *               Library (#dzLib), 🧭 DAZ Explorer (#dzExp), 🎚 DAZ Parameters (#dzPar) start in their own places - each can
 *               be a tab in any docker of the column, its own docker below one, or go back to its own place
 *   drag        a tab dragged onto a tab bar = a tab there; onto the lower part of a docker = its own docker below it;
 *               out of the column = back to its own place. The 📚 library's title dragged onto the column docks it too.
 *   kept        localStorage h3.ppdocks (the layout, width, folded - the narrow docker folds on its own)
 *
 * A panel keeps its id and its own code - pparchtools.js still fills #ppProps, ppoutline.js #ppOutline, ppdaztools.js
 * the DAZ dockers; a panel whose own switch is off (🗂 Outline, 🧱 Wall types, 📚 DAZ Tools) has no tab.
 * Pure (tested): normalize, move, visibleOf, dropAt, sig. */
(function (root) {
  "use strict";
  const doc = root.document;
  const $ = (id) => doc && doc.getElementById(id);
  const KEY = "h3.ppdocks";
  const dzOn = () => { const d = $("pushpulldock"); return !!(d && d.classList.contains("dz-on")); };
  const offCls = (el) => !el.classList.contains("off");
  // id, element id, tab title, shown(el), where it starts (a docker index, or "home"), a title bar to drag it in by
  const PANELS = [
    { id: "outline", el: "ppOutline", title: "🗂 Outline", shown: offCls, def: 0 },
    { id: "props", el: "ppProps", title: "⚙ Properties", shown: () => true, def: 1 },
    { id: "walltypes", el: "ppWT", title: "🧱 Wall types", shown: offCls, def: "home" },
    { id: "dzlib", el: "dzLib", title: "📚 DAZ Library", shown: dzOn, def: "home", grip: "dzLibHead" },
    { id: "dzexp", el: "dzExp", title: "🧭 DAZ Explorer", shown: dzOn, def: "home" },
    { id: "dzpar", el: "dzPar", title: "🎚 DAZ Parameters", shown: dzOn, def: "home" },
  ];
  const DEF = () => PANELS.reduce((o, p) => { o[p.id] = p.def; return o; }, {});
  const ids = () => PANELS.map((p) => p.id);

  /* ---------------- pure: the layout */
  // L = { groups: [{ tabs: [id], on: id, h: share }], home: [id], w: px, folded, foldedN }
  function normalize(L, known, def) {
    L = L && typeof L === "object" ? L : {}; def = def || {};
    const seen = new Set(), ok = (id) => known.includes(id) && !seen.has(id) && (seen.add(id), true);
    let groups = (Array.isArray(L.groups) ? L.groups : []).map((g) => ({ tabs: (g && Array.isArray(g.tabs) ? g.tabs : []).filter(ok), on: g && g.on, h: g && +g.h > 0 ? Math.min(20, +g.h) : 1 }));
    const home = (Array.isArray(L.home) ? L.home : []).filter(ok);
    groups = groups.filter((g) => g.tabs.length);
    known.forEach((id) => {
      if (seen.has(id)) return; seen.add(id);
      const d = def[id];
      if (d == null || d === "home") { home.push(id); return; }
      const gi = Math.max(0, Math.min(+d || 0, groups.length));
      if (!groups[gi]) groups[gi] = { tabs: [], h: 1 };
      groups[gi].tabs.push(id);
    });
    groups = groups.filter((g) => g && g.tabs.length);
    groups.forEach((g) => { if (!g.tabs.includes(g.on)) g.on = g.tabs[0]; });
    const w = +L.w > 0 ? Math.max(150, Math.min(640, Math.round(+L.w))) : 240;
    return { groups, home, w, folded: !!L.folded, foldedN: L.foldedN == null ? true : !!L.foldedN };
  }
  // where: "tab" (into docker gi; past the last = a new one), "below" (its own docker after gi), "home"
  function move(L, id, where, gi) {
    const N = JSON.parse(JSON.stringify(L));
    N.groups.forEach((g) => { g.tabs = g.tabs.filter((t) => t !== id); });
    N.home = N.home.filter((t) => t !== id);
    gi = Math.max(0, Math.min(gi | 0, N.groups.length));
    if (where === "home") N.home.push(id);
    else if (where === "below") N.groups.splice(Math.min(gi + 1, N.groups.length), 0, { tabs: [id], on: id, h: 1 });
    else if (N.groups[gi]) { N.groups[gi].tabs.push(id); N.groups[gi].on = id; }
    else N.groups.push({ tabs: [id], on: id, h: 1 });
    N.groups = N.groups.filter((g) => g.tabs.length);
    N.groups.forEach((g) => { if (!g.tabs.includes(g.on)) g.on = g.tabs[0]; });
    return N;
  }
  // the dockers as they show: only tabs whose panel exists and is switched on; a docker with none is left out
  function visibleOf(L, shown) {
    const out = [];
    L.groups.forEach((g, gi) => {
      const tabs = g.tabs.filter((t) => shown(t)); if (!tabs.length) return;
      out.push({ gi, tabs, on: tabs.includes(g.on) ? g.on : tabs[0], h: g.h });
    });
    return out;
  }
  // a drop at (x, y): rects = { col: {l,t,r,b} | null, groups: [{ gi, bar: rect, box: rect }] } -> { where, gi }
  function dropAt(rects, x, y) {
    const inR = (r) => r && x >= r.l && x <= r.r && y >= r.t && y <= r.b;
    if (!inR(rects.col)) return { where: "home" };
    const gs = rects.groups || [];
    for (const g of gs) {
      if (inR(g.bar)) return { where: "tab", gi: g.gi };
      if (inR(g.box)) return y > g.box.b - (g.box.b - g.box.t) * 0.35 ? { where: "below", gi: g.gi } : { where: "tab", gi: g.gi };
    }
    if (!gs.length) return { where: "tab", gi: 0 };
    const last = gs[gs.length - 1];
    return y > last.box.b ? { where: "below", gi: last.gi } : { where: "tab", gi: gs[0].gi };
  }
  const sig = (vis, folded) => JSON.stringify([folded, vis.map((g) => [g.gi, g.tabs, g.on])]);

  /* ---------------- the docker */
  const LS = {
    get() { try { return JSON.parse(root.localStorage.getItem(KEY) || "null"); } catch (e) { return null; } },
    set(v) { try { root.localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* full / private */ } },
  };
  const st = { L: null, homes: {}, last: "", mo: null, busy: false };
  const panel = (id) => PANELS.find((p) => p.id === id);
  const elOf = (id) => { const p = panel(id); return p ? $(p.el) : null; };
  const narrow = () => { const d = $("pushpulldock"); return !!(d && d.classList.contains("ppnarrow")); };
  const folded = () => (narrow() ? st.L.foldedN : st.L.folded);
  const shownId = (id) => { const p = panel(id), el = elOf(id); return !!(p && el && p.shown(el)); };
  function layout() { if (!st.L) st.L = normalize(LS.get(), ids(), DEF()); return st.L; }
  function save(L) { st.L = normalize(L, ids(), DEF()); LS.set(st.L); st.last = ""; render(); resized(); }
  function resized() { try { const P = root.H3PushPull; if (P && P.state && P.state.V) setTimeout(() => { try { P.state.V.size(); } catch (e) { /* fine */ } }, 30); } catch (e) { /* fine */ } }

  function css() {
    if ($("ppDocksCss")) return;
    const s = doc.createElement("style"); s.id = "ppDocksCss";
    s.textContent = "#ppDockCol{width:var(--ppdkw,240px);flex:none;display:flex;flex-direction:column;min-height:0;position:relative;border-right:1px solid var(--line,#444);background:var(--panel,#1f1c17);font-size:11px}"
      + "#ppDockCol.folded{width:24px}#ppDockCol.folded #ppDkGroups,#ppDockCol.folded #ppDkSize,#ppDockCol.folded .ppdkhtxt{display:none}#ppDockCol:not(.folded) #ppDkStrip{display:none}"
      + "#ppDkHead{display:flex;align-items:center;gap:3px;padding:2px 3px;border-bottom:1px solid var(--line,#444);font-weight:600;color:var(--dim,#9a917f)}#ppDkHead .ppdkhtxt{flex:1;white-space:nowrap;overflow:hidden}"
      + "#ppDockCol.folded #ppDkHead{flex-direction:column;padding:2px 0}#ppDkHead button,.ppdkbar button{font-size:11px;padding:0 4px;line-height:18px}"
      + "#ppDkStrip{display:flex;flex-direction:column;gap:4px;align-items:center;padding:4px 0;overflow:hidden}#ppDkStrip button{writing-mode:vertical-rl;padding:6px 1px;font-size:11px;white-space:nowrap}"
      + "#ppDkGroups{flex:1 1 auto;display:flex;flex-direction:column;min-height:0}.ppdkg{display:flex;flex-direction:column;min-height:60px;overflow:hidden}"
      + ".ppdkbar{display:flex;align-items:flex-end;gap:1px;padding:2px 2px 0;border-bottom:1px solid var(--line,#444);background:#0003;flex:none;flex-wrap:wrap}"
      + ".ppdktab{border:1px solid transparent;border-bottom:0;border-radius:5px 5px 0 0;padding:2px 6px;cursor:pointer;white-space:nowrap;user-select:none;touch-action:none;color:var(--dim,#9a917f)}"
      + ".ppdktab.on{background:var(--panel,#1f1c17);border-color:var(--line,#444);color:var(--tiger,#f59e2c);margin-bottom:-1px}.ppdkbar .ppdkmore{margin-left:auto;align-self:center}"
      + ".ppdkbody{flex:1 1 auto;display:flex;flex-direction:column;min-height:0;overflow:hidden}"
      + "#ppDockCol .ppdkbody>.ppdkp{flex:1 1 auto!important;width:auto!important;height:auto!important;max-width:none!important;max-height:none!important;min-width:0!important;min-height:0!important;position:static!important;inset:auto!important;resize:none!important;box-shadow:none!important;border:0!important;border-radius:0!important;overflow:auto}"
      + "#ppDockCol .ppdkp.ppdk-hide,#ppDockCol .ppdkg.ppdk-hide,#ppDockCol .ppdkhs.ppdk-hide{display:none!important}"
      + "#ppDockCol #ppProps.ppdkp:not(.ppdk-hide){display:block!important}#ppDockCol #ppProps .pptog{display:none!important}#ppDockCol #ppProps.ppdk-none>*{display:none!important}"
      + "#ppDockCol #ppProps.ppdk-none::before{content:'Nothing picked - pick a wall, a face or an object, or choose a tool: its settings show here.';display:block;color:var(--dim,#9a917f);padding:8px 4px;line-height:1.4}"
      + ".ppdkhs{flex:none;height:5px;cursor:row-resize;background:var(--line,#444)}.ppdkhs:hover,.ppdkhs.drag{background:var(--tiger-deep,#a8601a)}"
      + "#ppDkSize{position:absolute;right:-3px;top:0;bottom:0;width:6px;cursor:col-resize;z-index:4}#ppDkSize:hover,#ppDkSize.drag{background:var(--tiger-deep,#a8601a)}"
      + "#pushpulldock.ppnarrow #ppDockCol:not(.folded){position:absolute;left:70px;top:0;bottom:0;z-index:8;box-shadow:6px 0 18px #0006;max-width:70%}"
      + ".ppdkdrop{outline:2px dashed #38e1ff;outline-offset:-2px}.ppdkdrop-below{box-shadow:inset 0 -26px 0 #38e1ff33}#ppDockCol.ppdkdrop-col{outline:2px dashed #38e1ff}"
      + "#ppDkGhost{position:fixed;z-index:99999;pointer-events:none;padding:2px 8px;border-radius:4px;background:#38e1ff;color:#000;font-size:11px;font-weight:600;box-shadow:0 4px 14px #0008}"
      + ".ppdkmenu{position:fixed;z-index:99999;background:var(--panel,#1f1c17);border:1px solid var(--line,#444);border-radius:6px;box-shadow:0 8px 26px #000b;padding:4px;font-size:11px;min-width:240px}"
      + ".ppdkmenu .r{display:flex;align-items:center;gap:4px;padding:2px 4px}.ppdkmenu .r span{flex:1;white-space:nowrap}.ppdkmenu .r.dim span{opacity:.5}.ppdkmenu button{font-size:11px;padding:0 5px}"
      + ".ppdkmenu button.on{background:var(--tiger-deep,#a8601a);color:#fff}.ppdkmenu .h{color:var(--dim,#9a917f);padding:2px 4px 4px;border-bottom:1px solid var(--line,#444);margin-bottom:3px}.ppdkmenu .act{display:block;width:100%;text-align:left;margin:2px 0}"
      + "#dzSide.ppdk-gone{display:none!important}#dzSide.ppdk-one #dzHSplit{display:none}#dzSide.ppdk-one>#dzExp,#dzSide.ppdk-one>#dzPar{flex:1 1 0!important}";
    doc.head.appendChild(s);
  }

  function build() {
    const main = $("ppMain"), tools = $("ppTools"); if (!main || !tools) return null;
    let col = $("ppDockCol"); if (col) return col;
    css();
    col = doc.createElement("div"); col.id = "ppDockCol"; col.setAttribute("aria-label", "Properties docker");
    col.innerHTML = '<div id="ppDkHead"><button type="button" class="ghost" id="ppDkFold" title="Fold the docker to a strip (« ») - the view gets the room">«</button><span class="ppdkhtxt">⚙ Docker</span>'
      + '<button type="button" class="ghost" id="ppDkMenuBtn" title="The Sketcher\'s panels: each a tab here, its own docker below, or in its own place">▾</button></div>'
      + '<div id="ppDkStrip"></div><div id="ppDkGroups"></div><div id="ppDkSize" role="separator" aria-orientation="vertical" title="Drag to size the docker"></div>';
    main.insertBefore(col, tools.nextSibling);
    $("ppDkFold").onclick = () => fold(!folded());
    $("ppDkMenuBtn").onclick = (e) => menu(e.currentTarget, null);
    const sz = $("ppDkSize");
    sz.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return; e.preventDefault(); const w0 = col.getBoundingClientRect().width, x0 = e.clientX; sz.classList.add("drag");
      const mv = (m) => { const w = Math.max(150, Math.min(640, Math.round(w0 + m.clientX - x0))); st.L.w = w; col.style.setProperty("--ppdkw", w + "px"); };
      const up = () => { root.removeEventListener("pointermove", mv, true); root.removeEventListener("pointerup", up, true); sz.classList.remove("drag"); LS.set(st.L); resized(); };
      root.addEventListener("pointermove", mv, true); root.addEventListener("pointerup", up, true);
    });
    hookGrips();
    return col;
  }

  function fold(on) { const L = layout(); if (narrow()) L.foldedN = !!on; else L.folded = !!on; LS.set(L); st.last = ""; render(); resized(); }

  // the panels found in the page: their own place remembered the first time (to go back to)
  function adopt() {
    PANELS.forEach((p) => {
      const el = $(p.el); if (!el || st.homes[p.id] || el.closest("#ppDockCol")) return;
      st.homes[p.id] = { parent: el.parentNode, next: el.nextSibling };
    });
  }
  function sendHome(id, el) {
    el.classList.remove("ppdkp", "ppdk-hide", "ppdk-none"); if (id === "props") el.classList.remove("open");
    const h = st.homes[id]; if (!h || !h.parent || !h.parent.isConnected) { const m = $("ppMain"); if (m) m.appendChild(el); return; }
    if (h.next && h.next.parentNode === h.parent) h.parent.insertBefore(el, h.next); else h.parent.appendChild(el);
  }
  function propsEmpty() { const el = $("ppProps"); if (!el) return; el.classList.toggle("ppdk-none", el.style.display === "none" || !el.children.length); }

  function render() {
    const col = build(); if (!col) return;
    adopt();
    st.busy = true;
    try {
      const L = layout(), F = folded();
      col.classList.toggle("folded", F); col.style.setProperty("--ppdkw", L.w + "px");
      $("ppDkFold").textContent = F ? "»" : "«"; $("ppDkFold").title = F ? "Open the docker" : "Fold the docker to a strip (« ») - the view gets the room";
      const vis = visibleOf(L, shownId), s = sig(vis, F);
      // the panels that are not in the column go (or stay) in their own places
      L.home.forEach((id) => { const el = elOf(id); if (el && el.closest("#ppDockCol")) sendHome(id, el); });
      if (s !== st.last) {
        st.last = s;
        const box = $("ppDkGroups"), keep = [];
        L.groups.forEach((g) => g.tabs.forEach((id) => { const el = elOf(id); if (el) keep.push([id, el]); }));
        const stash = doc.createDocumentFragment();
        // a docker that shows nothing keeps its panels (hidden) so their own code still finds them
        const parked = doc.createElement("div"); parked.className = "ppdkg ppdk-hide"; parked.dataset.parked = "1";
        const bodyOf = {};
        box.querySelectorAll(".ppdkg,.ppdkhs").forEach((n) => { n.querySelectorAll(".ppdkp").forEach((p) => stash.appendChild(p)); n.remove(); });
        vis.forEach((g, i) => {
          if (i) { const hs = doc.createElement("div"); hs.className = "ppdkhs"; hs.setAttribute("role", "separator"); hs.title = "Drag to share the height"; hs.dataset.a = vis[i - 1].gi; hs.dataset.b = g.gi; hs.addEventListener("pointerdown", hsplit); box.appendChild(hs); }
          const G = doc.createElement("div"); G.className = "ppdkg"; G.dataset.gi = g.gi; G.style.flex = g.h + " 1 0";
          const bar = doc.createElement("div"); bar.className = "ppdkbar"; bar.setAttribute("role", "tablist");
          g.tabs.forEach((id) => {
            const t = doc.createElement("span"); t.className = "ppdktab" + (id === g.on ? " on" : ""); t.dataset.id = id; t.setAttribute("role", "tab"); t.textContent = panel(id).title;
            t.title = "Click: show it · drag: onto another tab bar = a tab there, onto the lower part of a docker = its own docker below, out of the column = back to its own place · right-click: where it goes";
            t.addEventListener("pointerdown", (e) => tabDown(e, id, g.gi));
            t.addEventListener("contextmenu", (e) => { e.preventDefault(); menu(t, id); });
            bar.appendChild(t);
          });
          const more = doc.createElement("button"); more.type = "button"; more.className = "ghost ppdkmore"; more.textContent = "⋯"; more.title = "Where " + panel(g.on).title + " goes";
          more.onclick = () => menu(more, g.on); bar.appendChild(more);
          const body = doc.createElement("div"); body.className = "ppdkbody"; bodyOf[g.gi] = body;
          G.appendChild(bar); G.appendChild(body); box.appendChild(G);
        });
        box.appendChild(parked);
        keep.forEach(([id, el]) => {
          const gi = L.groups.findIndex((g) => g.tabs.includes(id)), body = bodyOf[gi] || parked;
          el.classList.add("ppdkp"); if (id === "props") el.classList.add("open");
          body.appendChild(el);
        });
        // the strip (folded): every panel shown in the column
        const strip = $("ppDkStrip"); strip.innerHTML = "";
        vis.forEach((g) => g.tabs.forEach((id) => {
          const b = doc.createElement("button"); b.type = "button"; b.className = "ghost"; b.textContent = panel(id).title; b.title = "Open the docker on " + panel(id).title;
          b.onclick = () => { const L2 = layout(); const G = L2.groups[g.gi]; if (G) G.on = id; fold(false); }; strip.appendChild(b);
        }));
      }
      // the tab shown in each docker; the rest hidden
      vis.forEach((g) => g.tabs.forEach((id) => { const el = elOf(id); if (el) el.classList.toggle("ppdk-hide", id !== g.on); }));
      L.groups.forEach((g) => g.tabs.forEach((id) => { if (!shownId(id)) { const el = elOf(id); if (el) el.classList.add("ppdk-hide"); } }));
      propsEmpty();
      const side = $("dzSide");
      if (side) { const n = side.querySelectorAll(":scope > #dzExp, :scope > #dzPar").length; side.classList.toggle("ppdk-gone", n === 0); side.classList.toggle("ppdk-one", n === 1); }
    } finally {
      if (st.mo) st.mo.takeRecords();
      st.busy = false;
    }
  }

  function pick(id, gi) { const L = layout(), G = L.groups[gi]; if (!G || G.on === id) return; G.on = id; LS.set(L); render(); }
  function place(id, where, gi) { save(move(layout(), id, where, gi)); }

  /* ---------------- dragging a tab (or the library's title) */
  function rects() {
    const col = $("ppDockCol"); if (!col) return { col: null, groups: [] };
    const R = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
    const F = folded();
    return { col: R(col), groups: F ? [] : [...col.querySelectorAll(".ppdkg:not(.ppdk-hide)")].map((G) => ({ gi: +G.dataset.gi, bar: R(G.querySelector(".ppdkbar")), box: R(G) })) };
  }
  function marks(t) {
    const col = $("ppDockCol"); if (!col) return;
    col.classList.toggle("ppdkdrop-col", !!t && t.where !== "home" && folded());
    col.querySelectorAll(".ppdkg").forEach((G) => { const on = !!t && t.where !== "home" && +G.dataset.gi === t.gi; G.classList.toggle("ppdkdrop", on); G.classList.toggle("ppdkdrop-below", on && t.where === "below"); });
  }
  function ghost(txt, x, y) {
    let g = $("ppDkGhost"); if (!txt) { if (g) g.remove(); return; }
    if (!g) { g = doc.createElement("div"); g.id = "ppDkGhost"; doc.body.appendChild(g); }
    g.textContent = txt; g.style.left = x + 12 + "px"; g.style.top = y + 10 + "px";
  }
  const say = (t) => (t.where === "home" ? " → its own place" : t.where === "below" ? " → its own docker below" : " → a tab here");
  function dragging(e, id, label, onClick, from) {
    const x0 = e.clientX, y0 = e.clientY; let moved = false, t = null;
    const mv = (m) => {
      if (!moved && Math.hypot(m.clientX - x0, m.clientY - y0) < 6) return;
      moved = true; t = dropAt(rects(), m.clientX, m.clientY);
      if (from === "home" && t.where === "home") { marks(null); ghost(null); return; }   // the library's own move
      marks(t); ghost(label + say(t), m.clientX, m.clientY);
    };
    const up = () => {
      root.removeEventListener("pointermove", mv, true); root.removeEventListener("pointerup", up, true);
      marks(null); ghost(null);
      if (!moved) { if (onClick) onClick(); return; }
      if (!t || (from === "home" && t.where === "home")) return;
      if (t.where === "tab" && folded()) fold(false);
      if (from != null && from !== "home" && t.where === "tab" && t.gi === from) return;   // dropped where it was
      place(id, t.where, t.gi);
    };
    root.addEventListener("pointermove", mv, true); root.addEventListener("pointerup", up, true);
  }
  function tabDown(e, id, gi) { if (e.button !== 0) return; e.preventDefault(); dragging(e, id, panel(id).title, () => pick(id, gi), gi); }
  function hookGrips() {
    // a panel in its own place with a title bar (the 📚 library): dragged onto the column = docked
    if (st.grips) return; st.grips = true;
    doc.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || !e.target || !e.target.closest) return;
      const p = PANELS.find((q) => q.grip && e.target.closest("#" + q.grip)); if (!p || e.target.closest("button")) return;
      const el = $(p.el); if (!el || el.closest("#ppDockCol")) return;
      dragging(e, p.id, p.title, null, "home");
    }, true);
  }
  function hsplit(e) {
    if (e.button !== 0) return; e.preventDefault();
    const hs = e.currentTarget, a = +hs.dataset.a, b = +hs.dataset.b, L = layout(), A = L.groups[a], B = L.groups[b];
    const GA = hs.previousElementSibling, GB = hs.nextElementSibling; if (!A || !B || !GA || !GB) return;
    const ha = GA.getBoundingClientRect().height, hb = GB.getBoundingClientRect().height, sum = A.h + B.h, y0 = e.clientY; hs.classList.add("drag");
    const mv = (m) => { const d = m.clientY - y0, na = Math.max(60, ha + d), nb = Math.max(60, hb - d), k = sum / (na + nb); A.h = +(na * k).toFixed(3); B.h = +(nb * k).toFixed(3); GA.style.flex = A.h + " 1 0"; GB.style.flex = B.h + " 1 0"; };
    const up = () => { root.removeEventListener("pointermove", mv, true); root.removeEventListener("pointerup", up, true); hs.classList.remove("drag"); LS.set(L); };
    root.addEventListener("pointermove", mv, true); root.addEventListener("pointerup", up, true);
  }

  /* ---------------- ▾ / ⋯ : where a panel goes */
  function menu(anchor, only) {
    const old = doc.querySelector(".ppdkmenu"); if (old) { old.remove(); if (old.dataset.for === String(only)) return; }
    const L = layout(), m = doc.createElement("div"); m.className = "ppdkmenu"; m.setAttribute("role", "menu"); m.dataset.for = String(only);
    const where = (id) => { const gi = L.groups.findIndex((g) => g.tabs.includes(id)); return gi < 0 ? { gi: -1 } : { gi }; };
    const btn = (txt, title, on, fn) => { const b = doc.createElement("button"); b.type = "button"; b.className = "ghost" + (on ? " on" : ""); b.textContent = txt; b.title = title; b.onclick = () => { m.remove(); fn(); }; return b; };
    if (only) {
      const p = panel(only), w = where(only), n = L.groups.length;
      m.innerHTML = '<div class="h">' + p.title + "</div>";
      const act = (txt, fn) => { const b = btn(txt, txt, false, fn); b.className = "ghost act"; m.appendChild(b); };
      if (w.gi >= 0 && L.groups[w.gi].tabs.length > 1) act("⬓ Its own docker below", () => place(only, "below", w.gi));
      if (w.gi > 0) act("⤒ A tab in the docker above", () => place(only, "tab", w.gi - 1));
      if (w.gi >= 0 && w.gi < n - 1) act("⤓ A tab in the docker below", () => place(only, "tab", w.gi + 1));
      if (w.gi < 0) { act("⇤ A tab in the first docker", () => place(only, "tab", 0)); act("⬓ Its own docker at the bottom", () => place(only, "below", n - 1)); }
      act("↩ Back to its own place", () => place(only, "home"));
    } else {
      m.innerHTML = '<div class="h">The Sketcher\'s panels - a tab in the docker, its own docker below, or its own place</div>';
      PANELS.forEach((p) => {
        const w = where(p.id), r = doc.createElement("div"); r.className = "r" + (shownId(p.id) ? "" : " dim");
        r.title = shownId(p.id) ? "" : "Switched off just now (its own button) - its place is kept";
        const s = doc.createElement("span"); s.textContent = p.title; r.appendChild(s);
        r.appendChild(btn("Tab", "A tab in the first docker", w.gi === 0 && L.groups[0].tabs.length > 1 || (w.gi >= 0 && L.groups[w.gi].tabs.length > 1), () => place(p.id, "tab", w.gi >= 0 ? w.gi : 0)));
        r.appendChild(btn("Below", "Its own docker at the bottom of the column", w.gi >= 0 && L.groups[w.gi].tabs.length === 1, () => place(p.id, "below", L.groups.length - 1)));
        r.appendChild(btn("Own place", "Back where it was before (the 📚 library floats, the DAZ dockers right of the view)", w.gi < 0, () => place(p.id, "home")));
        m.appendChild(r);
      });
      const reset = btn("↺ Reset the docker", "Outline + Properties in the docker, the rest in their own places", false, () => { const keep = layout(); save({ w: keep.w, folded: false, foldedN: true }); });
      reset.className = "ghost act"; m.appendChild(reset);
    }
    doc.body.appendChild(m);
    const r = anchor.getBoundingClientRect(), W = m.offsetWidth, H = m.offsetHeight;
    m.style.left = Math.max(4, Math.min(root.innerWidth - W - 4, r.left)) + "px"; m.style.top = Math.max(4, Math.min(root.innerHeight - H - 4, r.bottom + 2)) + "px";
    const off = (e) => { if (!m.contains(e.target) && e.target !== anchor) { m.remove(); doc.removeEventListener("pointerdown", off, true); } };
    setTimeout(() => doc.addEventListener("pointerdown", off, true), 0);
  }

  /* ---------------- start: when the Sketcher's main row is there */
  function watch() {
    if (!root.MutationObserver) return;
    if (!st.mo) {
      let t = 0; st.seen = new WeakSet();
      st.mo = new root.MutationObserver(() => { if (st.busy) return; clearTimeout(t); t = setTimeout(() => { render(); watch(); }, 30); });
      const main = $("ppMain"), dock = $("pushpulldock");
      if (main) st.mo.observe(main, { childList: true });                                   // a panel made (the DAZ dockers, 🧱, 🗂)
      if (dock) st.mo.observe(dock, { attributes: true, attributeFilter: ["class"] });     // 📚 on / off, narrow
    }
    // each panel: its own switch (class "off") and - ⚙ Properties - what it shows
    PANELS.forEach((p) => { const el = $(p.el); if (!el || st.seen.has(el)) return; st.seen.add(el); st.mo.observe(el, p.id === "props" ? { attributes: true, attributeFilter: ["class", "style"], childList: true } : { attributes: true, attributeFilter: ["class"] }); });
  }
  function boot() {
    if (!doc || !$("ppMain") || !$("ppTools")) return false;
    layout(); render(); watch(); resized();
    return true;
  }
  if (doc) { const iv = setInterval(() => { if (boot()) clearInterval(iv); }, 400); }

  root.H3PPDocks = {
    PANELS, normalize, move, visibleOf, dropAt, sig,
    layout: () => layout(), place, fold, folded: () => folded(), render, menu, boot,
    reset: () => save({}),
    register(p) { if (p && p.id && p.el && !panel(p.id)) { PANELS.push(Object.assign({ title: p.id, shown: () => true, def: "home" }, p)); st.L = normalize(st.L || LS.get(), ids(), DEF()); render(); } },
  };
})(typeof window !== "undefined" ? window : globalThis);
