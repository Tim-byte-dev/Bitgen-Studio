/* bitGen Studio — THE FLOATING SETTINGS SECTIONS (2.393.0), window.SecFloat.
 *
 * Tim (verbatim): "in left docker / put basic settings dropdown in a floating docker - press s when not typing etc /
 * put llm dropdown in a floating docker - press l when not typing"
 *
 *   S             shows / hides Basic Settings in a floating docker of its own
 *   L             shows / hides LLM tokens in a floating docker of its own
 *                 never while typing in a box, never with a dialog open, never with Ctrl / Alt / Shift - and never
 *                 while the pointer (or the focus) is on the image editor or the timeline canvas: S and L are their
 *                 tools there (Clone Stamp / Lasso, the 3D Scale widget)
 *   FLOATING      the titlebar drags it, its corner sizes it, ✕ hides it; while dragged its edges stick (10 px) to the
 *                 dockers', the other floating windows' and the window's edges
 *   LEFT DOCKER   where the two sections were, a row of two buttons shows them (lit while shown)
 *   REMEMBERED    docker_status.json floats.basic / floats.llmtok = {shown, x, y, w, h} (lib/dockerStatus.js)
 *   2.398.0 (Tim: "make the basic settings and llm dialogs into dockers with the ability to dock next to another
 *                 docker or within another docker"): each is a PANEL of static/dockfloat.js - it floats (every edge
 *                 sizes it), docks above / below / beside a bottom docker, stacks inside a side docker, or goes INSIDE
 *                 any docker as a tab; docker_status.json floats.<id> keeps mode / to / side / dw / dh / active too
 * The section's own elements move into the window (every id stays the same), so the app's code is untouched.
 * The key test and the geometry are pure (tested in Node: scripts/test-secfloat.js).
 */
(function (root) {
  "use strict";

  /* ================================ pure ================================ */
  const SPECS = [
    { id: "llmtok", key: "l", title: "LLM tokens", w: 300, h: 200 },
    { id: "basic", key: "s", title: "Basic Settings", w: 330, h: 640 },
  ];
  const OWNERS = "#imageeditdock, #tlCanvasWrap";
  const TL_OWNS = "#timelinedock, .tsd";
  /** does this keydown toggle the window whose key is `key`? */
  function wants(e, key, active, dialogOpen, ownerHit) {
    if (!e || String(e.key || "").toLowerCase() !== key || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.repeat) return false;
    if (dialogOpen || ownerHit) return false;
    const a = active;
    if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName || ""))) {
      const ty = String(a.type || "").toLowerCase();
      if (!(a.tagName === "INPUT" && /^(range|checkbox|radio|button|color|file)$/.test(ty))) return false;
    }
    return true;
  }
  /** keep a floating window reachable: its titlebar inside the viewport */
  function onScreen(x, y, w, vw, vh) {
    return { x: Math.round(Math.max(-(w - 80), Math.min(vw - 80, x))), y: Math.round(Math.max(0, Math.min(vh - 32, y))) };
  }
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
    return { x: rect.x + (bx || 0), y: rect.y + (by || 0) };
  }
  /** where a window goes the first time: beside the left docker at the top, LLM tokens first, Basic Settings beside it */
  function firstPlace(spec, vw, vh, leftEdge) {
    const w = Math.min(spec.w, Math.max(240, vw - 40)), h = Math.min(spec.h, Math.max(150, vh - 140));
    const x0 = Math.round(Math.max(8, leftEdge + 12));
    const x = spec.id === "llmtok" ? x0 : Math.min(x0 + SPECS[0].w + 12, Math.max(8, vw - w - 8));
    return { x, y: 90, w, h };
  }
  /** 2.538.0 (Tim: "when maximizing a docker don't cover vertical dockers (gallery, queue,references,assets etc if they are
      open"): the room left between the open side columns -> {x, w} (pure). cols = [{l, r}] of the visible columns; one whose
      middle is left of the window's middle bounds the left, else the right; under 320 px left = the whole width */
  function maxSpan(vw, cols) {
    let L = 0, R = vw;
    for (const c of cols || []) {
      if (!c || !(c.r > c.l)) continue;
      if ((c.l + c.r) / 2 < vw / 2) L = Math.max(L, Math.round(c.r)); else R = Math.min(R, Math.round(c.l));
    }
    return R - L >= 320 ? { x: L, w: R - L } : { x: 0, w: vw };
  }
  const pure = { SPECS, OWNERS, TL_OWNS, wants, onScreen, snap, firstPlace, maxSpan };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ================================ the page ================================ */
  const $ = (id) => document.getElementById(id);
  const CSS = ""
    + ".secfloat{display:flex;flex-direction:column;background:var(--panel,#1d1a15);position:relative;min-width:0;min-height:0;overflow:hidden}"
    + ".secfloat.df-float{position:fixed;z-index:47;border:1px solid var(--line,#3a342a);border-radius:10px;box-shadow:0 14px 40px rgba(0,0,0,.55);min-width:240px;min-height:90px;max-width:96vw;max-height:92vh}"
    + ".secfloat.df-stack,.secfloat.df-side{flex:0 0 auto;border-top:1px solid var(--line,#3a342a);border-bottom:1px solid var(--line,#3a342a)}"
    + ".secfloat.df-inrow{height:auto!important;align-self:stretch;max-width:calc(100% - 160px);min-width:200px!important;border-left:1px solid var(--line,#3a342a);border-right:1px solid var(--line,#3a342a)}"
    + ".df-row:not(:has(> .bdock:not(.dockgone):not(.collapsed))) > .secfloat{flex:1 1 auto!important;height:260px!important}"
    + ".secfloat.df-tabbed{flex:1 1 auto;min-height:0;height:auto!important}"
    // 2.401.4: inline in the left docker's list - its natural height, scrolling with the list, a framed section
    + ".secfloat.df-inline{flex:none;height:auto!important;width:auto!important;margin:10px 0;border:1px solid var(--line,#3a342a);border-radius:8px;overflow:visible;background:var(--panel-2,#26221b)}"
    + ".secfloat.df-inline > .sfbody{overflow:visible;flex:none;padding:9px 10px}"
    + ".secfloat.df-tabbed > .sfhead{display:none}"
    + ".secfloat.sf-hidden{display:none!important}"
    + ".secfloat .sfhead{display:flex;align-items:center;gap:8px;padding:6px 8px 6px 11px;border-bottom:1px solid var(--line,#3a342a);cursor:grab;user-select:none;flex:none;"
    + "font-family:var(--disp);font-size:.74rem;letter-spacing:.16em;text-transform:uppercase;color:var(--dim,#9a917f)}"
    + ".secfloat:not(.df-float) .sfhead{padding:4px 8px 4px 11px;font-size:.7rem}"
    + ".secfloat.sf-drag .sfhead{cursor:grabbing}"
    + ".secfloat .sfhead .sft{color:var(--text,#e8e2d6)}"
    + ".secfloat .sfhead .sfk{margin-left:auto;font-family:var(--mono,monospace);font-size:.62rem;letter-spacing:0;border:1px solid var(--line,#3a342a);border-radius:4px;padding:0 5px;color:var(--tiger,#f59e2c)}"
    + ".secfloat .sfhead .sfk0{visibility:hidden}"
    + ".secfloat .sfhead .sfx{background:none;border:0;color:var(--dim,#9a917f);cursor:pointer;font-size:.85rem;padding:0 4px}"
    + ".secfloat .sfhead .sfx:hover{color:var(--tiger,#f59e2c)}"
    // 2.532.0 (Tim: "add a maximize button to the titlebar and a minimize button, minimize will make it a standard docker
    // titlebar, x will close the docker"): ▁ minimize = only the title bar (like a collapsed docker), ⛶ maximize = the
    // whole window between the menu bar and the statusbar (🗗 puts it back); a double-click on the title minimizes too
    + ".secfloat .sfhead .sfmin,.secfloat .sfhead .sfmax{background:none;border:0;color:var(--dim,#9a917f);cursor:pointer;font-size:.8rem;padding:0 3px;line-height:1}"
    + ".secfloat .sfhead .sfmin:hover,.secfloat .sfhead .sfmax:hover{color:var(--tiger,#f59e2c)}"
    + ".secfloat.sf-min{height:auto!important;min-height:0!important}.secfloat.sf-min > .sfbody{display:none!important}"
    + ".secfloat.sf-min .df-rs,.secfloat.sf-min [class*=resiz]{display:none!important}"
    + ".secfloat.sf-max{max-width:none!important;max-height:none!important;border-radius:0}"
    + ".secfloat .sfbody{flex:1 1 auto;min-height:0;overflow-y:auto;padding:11px}"
    + ".secfloat .sfbody > .secbody{display:block!important}"
    + "h2.sec.sf-away{display:none!important}"
    + ".sflaunch{display:flex;gap:6px;margin:12px 0 4px}"
    + ".sflaunch button{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:5px 6px;border-radius:6px;border:1px solid var(--line,#3a342a);"
    + "background:var(--panel-2,#26221b);color:var(--dim,#9a917f);font-family:var(--disp);font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;cursor:pointer}"
    + ".sflaunch button:hover,.sflaunch button.on{color:var(--tiger,#f59e2c);border-color:var(--tiger,#f59e2c)}"
    + ".sflaunch kbd{font-family:var(--mono,monospace);font-size:.6rem;border:1px solid currentColor;border-radius:3px;padding:0 4px;letter-spacing:0}";

  const rec = () => {
    const s = window.H3_DOCK_STATUS = window.H3_DOCK_STATUS || {};
    s.floats = s.floats || {};
    return s.floats;
  };
  const W = {};                       // id -> {spec, el, head, body, btn, panel}
  let lastOver = null;

  function boot() {
    if (!$("sec-basic") || !$("sec-llmtok") || !$("ldock") || !window.DockFloat) { setTimeout(boot, 80); return; }
    start();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  function save(id) {
    const f = rec()[id]; if (!f) return;
    const c = window.DockFloat.pure.cleanState(f);
    try {
      fetch("/api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ floats: { [id]: c } }) }).catch(() => {});
    } catch (e) { /* offline */ }
  }
  function leftEdge() { const l = $("ldock"); const r = l && l.offsetWidth ? l.getBoundingClientRect() : null; return r ? r.right : 0; }
  function paint() {
    for (const id of Object.keys(W)) {
      const on = !!rec()[id].shown;
      W[id].el.classList.toggle("sf-hidden", !on);
      if (W[id].btn) W[id].btn.classList.toggle("on", on);
    }
  }
  function front(id) { for (const k of Object.keys(W)) if (W[k].el.classList.contains("df-float")) W[k].el.style.zIndex = k === id ? 49 : 47; }
  function show(id, on) {
    if (!W[id]) return false;
    const f = rec()[id], w = W[id];
    f.shown = on == null ? !f.shown : !!on;
    paint();
    if (f.shown) {
      if (!w.placed) { w.panel.restore(); w.placed = true; }
      else if (w.el.classList.contains("df-float")) {          // back on screen where it was
        const p = onScreen(parseInt(w.el.style.left, 10) || 0, parseInt(w.el.style.top, 10) || 0, w.el.offsetWidth, window.innerWidth, window.innerHeight);
        w.el.style.left = p.x + "px"; w.el.style.top = p.y + "px";
      }
      front(id); w.panel.onShow();
      if (w.spec.onShow) try { w.spec.onShow(); } catch (e) { /* fine */ }
    } else w.panel.onHide();
    save(id);
    return f.shown;
  }
  /** layout ready: the column's dockers in place (and the prompt docker where it belongs) */
  function layoutReady() {
    try { return typeof dsReady !== "undefined" && dsReady && (!$("promptdock") || (window.PFloat && window.PFloat.started)); } catch (e) { return true; }
  }

  /** one dockable window around `body0` (moved in, its ids unchanged); `btn` (optional) lights while it shows */
  function makeWindow(spec, body0, btn) {
    const key = spec.key || "";
    const el = document.createElement("div"); el.className = "secfloat sf-hidden"; el.id = "sf-" + spec.id;
    el.setAttribute("role", "region"); el.setAttribute("aria-label", spec.title);
    el.innerHTML = `<div class="sfhead" title="Drag to float it, or onto a docker to dock it (its middle = inside it, as a tab)"><span class="sft">${spec.title}</span>`
      + (key ? `<span class="sfk" title="${key.toUpperCase()} shows / hides it (not while typing)">${key.toUpperCase()}</span>` : `<span class="sfk sfk0"></span>`)
      + `<button class="sfmin" title="Minimize - just the title bar (again: open it)" aria-label="Minimize">▁</button>`
      + `<button class="sfmax" title="Maximize - the whole window (again: back to its size)" aria-label="Maximize">⛶</button>`
      + `<button class="sfx" title="Close${key ? " (" + key.toUpperCase() + ")" : ""}" aria-label="Close">✕</button></div><div class="sfbody" data-dockscroll></div>`;
    document.body.appendChild(el);
    const body = el.querySelector(".sfbody");
    body.appendChild(body0);
    if (!rec()[spec.id]) rec()[spec.id] = { shown: false, x: -1, y: -1, w: 0, h: 0 };
    Object.assign(rec()[spec.id], window.DockFloat.pure.cleanState(rec()[spec.id]));
    const w = W[spec.id] = { spec, el, head: el.querySelector(".sfhead"), body, btn: btn || null, placed: false };
    w.panel = window.DockFloat.panel({
      id: spec.id, title: spec.title, key, el, head: w.head,
      state: () => rec()[spec.id], save: () => save(spec.id), hide: () => show(spec.id, false), front: () => front(spec.id),
      min: { w: spec.minW || 240, h: spec.minH || 90 }, defW: spec.w, defH: spec.h,
      firstX: () => (spec.firstX ? spec.firstX(window.innerWidth || 1280, window.innerHeight || 800)
        : firstPlace(spec, window.innerWidth || 1280, window.innerHeight || 800, leftEdge()).x),
      onPlace: (m) => { try { if (window.DockScroll && DockScroll.refresh) DockScroll.refresh(body); } catch (e) { /* fine */ }
                        if (spec.onPlace) spec.onPlace(m); },
    });
    el.querySelector(".sfx").onclick = () => show(spec.id, false);
    el.querySelector(".sfmin").onclick = (e) => { e.stopPropagation(); minimize(spec.id); };
    el.querySelector(".sfmax").onclick = (e) => { e.stopPropagation(); maximize(spec.id); };
    ["pointerdown", "mousedown"].forEach((t) => [".sfmin", ".sfmax", ".sfx"].forEach((c) => el.querySelector(c).addEventListener(t, (e) => e.stopPropagation())));   // a button press is not a title drag
    w.head.addEventListener("dblclick", (e) => { if (!e.target.closest("button")) minimize(spec.id); });
    el.addEventListener("pointerdown", () => front(spec.id), true);
    return w;
  }
  /** 2.532.0: ▁ only the title bar / back (on = force) */
  function minimize(id, on) {
    const w = W[id]; if (!w) return false;
    const m = on == null ? !w.el.classList.contains("sf-min") : !!on;
    if (m && w.max) maximize(id, false);
    w.el.classList.toggle("sf-min", m);
    if (m && window.H3TestEvent) window.H3TestEvent("docker_min", id);
    // 2.575.0 (Tim: "maintain the last position and status(open, minimized, closed) of all dockers"): minimized is kept
    const f = rec()[id]; if (f && !!f.min !== m) { f.min = m; if (!w.restoringMin) save(id); }
    const b = w.el.querySelector(".sfmin"); b.textContent = m ? "▭" : "▁"; b.title = m ? "Open it again" : "Minimize - just the title bar (again: open it)";
    try { window.dispatchEvent(new Event("resize")); } catch (e) { /* jsdom */ }
    return m;
  }
  /** 2.538.0: the side columns that are open (the left docker, References, Assets, the Queue, the Gallery) - shown,
      not floated / docked into another, tall (half the room at least), not the maximized window's own */
  function sideCols(own, H) {
    const out = [];
    for (const id of ["ldock", "refsdock", "assetsdock", "qdock", "rdock"]) {
      const el = $(id); if (!el || el === own || el.contains(own) || own.contains(el)) continue;
      if (el.classList.contains("df-float") || el.classList.contains("df-inline") || el.classList.contains("df-tabbed")) continue;
      const cs = window.getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden" || cs.position === "fixed") continue;
      const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < H * 0.5) continue;
      out.push({ l: r.left, r: r.right, id });
    }
    return out;
  }
  /** 2.532.0: ⛶ the whole window between the menu bar and the statusbar (2.538.0: and between the open side columns) / 🗗 back to where and how big it was */
  function maximize(id, on) {
    const w = W[id]; if (!w) return false;
    const m = on == null ? !w.max : !!on;
    if (m) {
      if (w.el.classList.contains("sf-min")) minimize(id, false);
      const s = rec()[id];
      w.max = { x: s.x, y: s.y, w: s.w, h: s.h, mode: s.mode || "float", to: s.to, side: s.side, at: s.at };
      const mb = $("menubar"), sb = $("statusbar");
      const top = mb ? Math.round(mb.getBoundingClientRect().bottom) : 0, bot = sb ? Math.round(sb.getBoundingClientRect().height) : 0;
      const H = Math.max(200, window.innerHeight - top - bot);
      if (!w.el.classList.contains("df-float")) { const r0 = w.el.getBoundingClientRect(); w.panel.float(Math.round(r0.left), Math.round(r0.top), Math.round(r0.width) || 420, Math.round(r0.height) || 320); }   // out of its dock first - the column it sat in may close
      const sp = maxSpan(window.innerWidth, sideCols(w.el, H));
      w.panel.float(sp.x, top, sp.w, H);
      w.el.classList.add("sf-max");
      Object.assign(w.el.style, { left: sp.x + "px", top: top + "px", width: sp.w + "px", height: H + "px" });   // (float() keeps a window partly on screen / under 92 % of it)
    } else if (w.max) {
      const p = w.max; w.max = null;
      if (p.mode === "float" || !p.to) w.panel.float(p.x, p.y, p.w, p.h); else { const t = $(p.to); if (t) w.panel.dockTo(t, p.side, false, true, p.at); else w.panel.float(p.x, p.y, p.w, p.h); }
    }
    w.el.classList.toggle("sf-max", !!w.max);
    if (w.max && window.H3TestEvent) window.H3TestEvent("docker_max", id);
    const b = w.el.querySelector(".sfmax"); b.textContent = w.max ? "🗗" : "⛶"; b.title = w.max ? "Back to its size" : "Maximize - the whole window (again: back to its size)";
    front(id);
    try { window.dispatchEvent(new Event("resize")); } catch (e) { /* jsdom */ }
    return !!w.max;
  }
  /* 2.399.0: another dockable window (the timeline's 🎥 Camera panel): spec {id, title, key?, w, h, body, button?,
     onShow?, onPlace?, firstX?(vw, vh), free? (2.419.0: its key works over the editor / canvas too), skip?() (not now)} - kept in docker_status.json floats.<id> like Basic Settings */
  function add(spec) {
    if (!spec || !spec.id || !spec.body || W[spec.id]) return W[spec && spec.id] || null;
    const w = makeWindow(spec, spec.body, spec.button || null);
    if (spec.button) spec.button.addEventListener("click", () => show(spec.id));
    paint();
    let tries = 0;
    const place = () => {
      if (!layoutReady() && tries++ < 150) { setTimeout(place, 80); return; }
      if (!w.placed) { w.panel.restore(); w.placed = true; }
      paint();
    };
    place();
    return w;
  }

  function start() {
    if (window.SecFloat && window.SecFloat.started) return;
    if (!$("sfCss")) { const st = document.createElement("style"); st.id = "sfCss"; st.textContent = CSS; document.head.appendChild(st); }
    // the launcher row, where the first of the two sections was in the left docker
    const firstHead = document.querySelector('#ldock h2.sec.drop[data-sec="llmtok"]');
    const row = document.createElement("div"); row.className = "sflaunch"; row.id = "sfLaunch";
    if (firstHead) firstHead.before(row);
    for (const spec of SPECS) {
      const head0 = document.querySelector(`h2.sec.drop[data-sec="${spec.id}"]`), body0 = $("sec-" + spec.id);
      if (!body0) continue;
      if (head0) head0.classList.add("sf-away");
      body0.classList.remove("closed");
      const btn = document.createElement("button"); btn.type = "button"; btn.dataset.sf = spec.id;
      btn.title = `Show / hide ${spec.title} - a docker of its own: float it, dock it beside / inside another (${spec.key.toUpperCase()})`;
      btn.innerHTML = `${spec.title} <kbd>${spec.key.toUpperCase()}</kbd>`;
      btn.onclick = () => show(spec.id);
      row.appendChild(btn);
      makeWindow(spec, body0, btn);
    }
    paint();
    try { if (window.DockScroll && DockScroll.scan) DockScroll.scan(); } catch (e) { /* fine */ }
    // put each where it was once the column is laid out (a docked panel needs its docker in place)
    let tries = 0;
    const place = () => {
      if (!layoutReady() && tries++ < 150) { setTimeout(place, 80); return; }
      for (const id of Object.keys(W)) { W[id].panel.restore(); W[id].placed = true; }
      // 2.575.0: minimized as it was left
      for (const id of Object.keys(W)) if (rec()[id] && rec()[id].min) { W[id].restoringMin = true; try { minimize(id, true); } finally { W[id].restoringMin = false; } }
      // 2.401.4: a panel inline in the left docker ABOVE another panel - placed again once that one is in its list
      for (const id of Object.keys(W)) {
        const f = rec()[id];
        const nx = W[id].el.nextElementSibling;
        if (f.side === "inline" && /^sf-/.test(f.at || "") && (!nx || nx.id !== f.at)) W[id].panel.restore();
      }
      paint();
    };
    place();
    // where the pointer is: S / L belong to the image editor and the timeline canvas while it is over them
    window.addEventListener("pointermove", (e) => { lastOver = e.target; }, true);
    window.addEventListener("keydown", (ev) => {
      const a = document.activeElement;
      const owner = !!((lastOver && lastOver.closest && lastOver.closest(OWNERS)) || (a && a.closest && a.closest(OWNERS)));
      // 2.411.0: over the timeline docker (or a docker beside its canvas) L is the J / K / L shuttle's (ext/timelinedock/tlkeys.js)
      const tlOwn = !!((lastOver && lastOver.closest && lastOver.closest(TL_OWNS)) || (a && a.closest && a.closest(TL_OWNS)));
      const dlg = !!document.querySelector("dialog[open]");
      // 2.619.0: over the 📏 PushPull docker every key is its own (the tools' letters, numbers for the Measurements box)
      if ((lastOver && lastOver.closest && lastOver.closest("#pushpulldock")) || (a && a.closest && a.closest("#pushpulldock"))) return;
      for (const id of Object.keys(W)) {
        const sp = W[id].spec;
        // 2.419.0: a key no tool there owns (2 = the negative prompt) works over the image editor / timeline canvas too;
        // spec.skip() = not now (the 🎥 multi-camera dialog takes 1 - 9 while it is open)
        if (!wants(ev, sp.key, a, dlg, sp.free ? false : owner || (tlOwn && sp.key === "l"))) continue;
        if (sp.skip) { let no = false; try { no = !!sp.skip(); } catch (e) { no = false; } if (no) continue; }
        ev.preventDefault(); ev.stopImmediatePropagation();
        show(id);
        return;
      }
    }, true);
    window.addEventListener("resize", () => {
      for (const id of Object.keys(W)) {
        const el = W[id].el; if (el.classList.contains("sf-hidden") || !el.classList.contains("df-float")) continue;
        const p = onScreen(parseInt(el.style.left, 10) || 0, parseInt(el.style.top, 10) || 0, el.offsetWidth, window.innerWidth, window.innerHeight);
        el.style.left = p.x + "px"; el.style.top = p.y + "px";
      }
    });
    /* 2.432.0: ⊞ Docker layout keeps every floating panel (where, how big, shown) and puts them back */
    const states = () => { const o = {}; for (const id of Object.keys(W)) o[id] = Object.assign({}, rec()[id]); return o; };
    function applyStates(m) {
      if (!m || typeof m !== "object") return 0;
      let n = 0;
      for (const id of Object.keys(m)) {
        if (!W[id] || !m[id] || typeof m[id] !== "object") continue;
        const was = !!rec()[id].shown;
        Object.assign(rec()[id], window.DockFloat.pure.cleanState(Object.assign({}, rec()[id], m[id])));
        W[id].panel.restore(); save(id); n++;
        // 2.527.0: shown by a layout (⊞ Docker layout, a workspace) = shown: it fills itself as a click would (onShow) -
        // 🏠 House came back from a workspace with an empty house list
        if (!was && rec()[id].shown && W[id].spec.onShow) try { W[id].spec.onShow(); } catch (e) { /* fine */ }
      }
      paint();
      return n;
    }
    window.SecFloat = { started: true, show, add, minimize, maximize, sideCols, state: (id) => Object.assign({}, rec()[id]), windows: W, pure, states, applyStates,
      float: (id, x, y, w, h) => W[id].panel.float(x, y, w, h), dockTo: (id, target, side) => W[id].panel.dockTo(typeof target === "string" ? $(target) : target, side) };
  }
  if (typeof window !== "undefined") window.SecFloat = window.SecFloat || { pure };
})(typeof window !== "undefined" ? window : globalThis);
