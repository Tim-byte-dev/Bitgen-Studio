/* bitGen Studio — FLOATING / DOCKABLE PANELS (2.398.0), window.DockFloat.
 *
 * Tim (verbatim): "the prompt docker won't allow me to resize it's height. make the basic settings and llm dialogs into
 * dockers with the ability to dock next to another docker or within another docker"
 *
 *   GRIPS         grips(el, {mode, onMove, onEnd}) - a floating window gets EIGHT resize handles (every edge and corner,
 *                 not only the browser's tiny bottom-right corner); a docked panel gets the one edge that sizes it
 *                 (its bottom = height in a column / a side docker, its inner side = width beside a docker). The
 *                 prompt docker uses them too (ext/promptdock/pfloat.js) - floating, every edge sizes it.
 *   PANELS        panel(spec) - a docker of its own (Basic Settings, LLM tokens: static/secfloat.js) that
 *                   FLOATS      titlebar drags it, magnetic edges (10 px) to the dockers and the window
 *                   DOCKS       dragged to within 36 px of a docker's edge that edge lights up - drop there:
 *                                 top / bottom of a bottom docker = above / below it in the column (its own height)
 *                                 left / right of a bottom docker = beside it (its own width, the row as tall as it)
 *                                 top / bottom of a side docker (Settings, References, Assets, Queue, Gallery)
 *                                   = stacked inside that docker (its own height)
 *                   TABS        its TITLE BAR (or tab strip) = INSIDE that docker as a tab: the docker gets a tab strip
 *                               (its own name + the panels in it); a tab click shows that panel, the docker's own tab
 *                               shows the docker again. Dragging a tab (or a docked panel's titlebar) floats it again.
 *                 anywhere else over a docker it just floats there. Where it is, its sizes and its active tab are
 *                 kept in docker_status.json (floats.<id>).
 *   2.401.4 (Tim: "add dropzones to the left docker so the basic settings and llm info can be docked inside the left
 *                 docker"): INLINE - over the left docker's own list (Settings: System, the launcher row, ...) a line
 *                 lights up between its sections; dropped there the panel sits IN that list at its natural height
 *                 and scrolls with it (its title bar drags it out again). floats.<id>.side "inline" + at = the
 *                 section it sits above ("" = the end). LISTS says which docker has a list (ldock: its .scroll).
 * The geometry (drop zones with the middle, the eight-way resize, the plan for a drop) is pure - tested in Node
 * (scripts/test-dockfloat.js).
 */
(function (root) {
  "use strict";

  /* ================================ pure ================================ */
  const SIDES = ["top", "bottom", "left", "right"];
  const HANDLES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
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
  /** keep a floating window reachable: its titlebar inside the viewport */
  function onScreen(x, y, w, vw, vh) {
    return { x: Math.round(Math.max(-(w - 80), Math.min(vw - 80, x))), y: Math.round(Math.max(0, Math.min(vh - 32, y))) };
  }
  /** the drop zone under the pointer (px, py) on target r {l, t, r, b}: an edge band = that side; "inside" = the
   *  middle when `inside` is true, or only over the rect `inside` {l, t, r, b} (a docker's title bar / tab strip);
   *  band = the edge band in px (default 28 % of the side, at most 80 px); sides = the edges this target takes;
   *  anywhere else = null (a panel over a docker away from these just floats there) */
  function zoneAt(px, py, r, sides, inside, band) {
    if (px < r.l || px > r.r || py < r.t || py > r.b) return null;
    const w = r.r - r.l, h = r.b - r.t;
    const bw = band ? Math.min(band, w * 0.3) : Math.min(80, w * 0.28), bh = band ? Math.min(band, h * 0.3) : Math.min(80, h * 0.28);
    const head = inside && typeof inside === "object";
    // with a title bar to drop on, "above" is its top 10 px only - the rest of the title bar is "inside"
    if (head && py - r.t > 10 && px >= inside.l && px <= inside.r && py >= inside.t && py <= inside.b) return "inside";
    const allow = sides || SIDES;
    const c = [["top", py - r.t, head ? 10 : bh], ["bottom", r.b - py, bh], ["left", px - r.l, bw], ["right", r.r - px, bw]]
      .filter(([s, d, band]) => allow.includes(s) && d <= band).sort((a, b) => a[1] / a[2] - b[1] / b[2]);
    if (c.length) return c[0][0];
    return inside === true ? "inside" : null;
  }
  /** the rectangle a drop zone lights up */
  function zoneRect(r, side) {
    const w = r.r - r.l, h = r.b - r.t;
    if (side === "top") return { l: r.l, t: r.t, r: r.r, b: r.t + h / 2 };
    if (side === "bottom") return { l: r.l, t: r.t + h / 2, r: r.r, b: r.b };
    if (side === "left") return { l: r.l, t: r.t, r: r.l + w / 2, b: r.b };
    if (side === "right") return { l: r.l + w / 2, t: r.t, r: r.r, b: r.b };
    const i = Math.min(14, w / 6, h / 6);
    return { l: r.l + i, t: r.t + i, r: r.r - i, b: r.b - i };       // inside
  }
  /** a resize from handle h by (dx, dy): rect {x, y, w, h} -> the new rect, the opposite edge held, min / max kept */
  function resizeRect(s, handle, dx, dy, min, max) {
    const mn = Object.assign({ w: 200, h: 80 }, min || {}), mx = Object.assign({ w: 4000, h: 4000 }, max || {});
    let { x, y, w, h } = s;
    const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    if (handle.includes("e")) w = cl(s.w + dx, mn.w, mx.w);
    if (handle.includes("s")) h = cl(s.h + dy, mn.h, mx.h);
    if (handle.includes("w")) { w = cl(s.w - dx, mn.w, mx.w); x = s.x + s.w - w; }
    if (handle.includes("n")) { h = cl(s.h - dy, mn.h, mx.h); y = s.y + s.h - h; }
    return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
  }
  /** the handle at (x, y) inside a w x h box when it is within band px of an edge (corners first), else null */
  function edgeAt(x, y, w, h, band) {
    const b = band == null ? 8 : band, n = y <= b, so = y >= h - b, we = x <= b, e = x >= w - b;
    return (n ? "n" : so ? "s" : "") + (e ? "e" : we ? "w" : "") || null;
  }
  /** what a drop does: kind = "column" (a bottom docker) | "side" (a side docker); inRow = the target is already beside
   *  another panel -> "tab" | "stack" (above / below in the column) | "row" (beside) | "side" (stacked in the side
   *  docker) | null (nothing) */
  function planOf(kind, side, inRow) {
    if (side === "inside") return "tab";
    if (kind === "side") return side === "top" || side === "bottom" ? "side" : null;
    if (!SIDES.includes(side)) return null;
    if (side === "left" || side === "right") return inRow ? "stack" : "row";
    return "stack";
  }
  /** the words on the drop zone */
  function zoneLabel(title, side, name) {
    if (side === "inside") return `${title} inside ${name} (a tab)`;
    return `Dock ${title} ` + { top: "above", bottom: "below", left: "left of", right: "right of" }[side] + " " + name;
  }
  /** 2.401.4: the gap nearest py among gaps [{key, y}] (key = the section below it, "" = the end) -> that gap, or null */
  function gapAt(py, gaps) {
    let best = null;
    for (const g of gaps || []) if (g && Number.isFinite(g.y) && (best === null || Math.abs(py - g.y) < Math.abs(py - best.y))) best = g;
    return best;
  }
  /** the words on an inline drop zone */
  function inlineLabel(title, name, below, above) {
    return `Dock ${title} in ${name}` + (below ? ` - above ${below}` : above ? ` - below ${above}` : "");
  }
  /** the panel state kept in docker_status.json floats.<id> - cleaned */
  function cleanState(s) {
    const o = s && typeof s === "object" ? s : {};
    const int = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
    const mode = ["float", "dock", "tab"].includes(o.mode) ? o.mode : "float";
    const side = [...SIDES, "inside", "inline"].includes(o.side) ? o.side : "";
    const to = typeof o.to === "string" && /^[A-Za-z][\w-]{0,40}$/.test(o.to) ? o.to : "";
    const at = side === "inline" && typeof o.at === "string" && /^[A-Za-z][\w-]{0,40}$/.test(o.at) ? o.at : "";
    return { shown: o.shown === true, x: int(o.x, -4000, 20000, -1), y: int(o.y, -1, 20000, -1), w: int(o.w, 0, 4000, 0), h: int(o.h, 0, 4000, 0),
             mode: mode !== "float" && !to ? "float" : mode, to, side, dw: int(o.dw, 0, 2000, 0), dh: int(o.dh, 0, 2000, 0), active: o.active === true, at, min: o.min === true };   // 2.575.0: + min
  }
  const pure = { SIDES, HANDLES, snap, onScreen, zoneAt, zoneRect, resizeRect, edgeAt, planOf, zoneLabel, cleanState, gapAt, inlineLabel };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ================================ the page ================================ */
  const $ = (id) => document.getElementById(id);
  const SIDE_IDS = ["ldock", "refsdock", "assetsdock", "qdock", "rdock"];
  const EDGE = 36;                     // the edge band (px) that docks a dragged panel beside / above / below a docker
  /* 2.401.4: a side docker with a LIST a panel can sit in (between its sections): docker id -> the list's selector */
  const LISTS = { ldock: "#ldock > .scroll" };
  function listOf(t) { return t && LISTS[t.id] ? document.querySelector(LISTS[t.id]) : null; }
  /** a list's sections: its visible h2 headings, the launcher row and the panels already inline in it - each a gap
   *  above it {key, y, name}; + the end */
  function gapsOf(list, el) {
    const kids = Array.from(list.children).filter((c) => c !== el && c.offsetParent !== null && c.getBoundingClientRect().height > 0
      && (c.matches("h2.sec, .sflaunch, .secfloat.df-inline") || (c.id && c.tagName === "H2")));
    const lr = list.getBoundingClientRect();
    const gaps = kids.map((c) => ({ key: keyOf(c), y: c.getBoundingClientRect().top - 3, name: nameOf(c), node: c })).filter((g) => g.key);
    const last = Array.from(list.children).filter((c) => c !== el && c.offsetParent !== null).pop();
    gaps.push({ key: "", y: Math.min(lr.bottom - 6, last ? last.getBoundingClientRect().bottom + 2 : lr.top + 6), name: "", node: null, last: last ? nameOf(last.closest ? (prevHead(list, last) || last) : last) : "" });
    return gaps;
  }
  function keyOf(c) {
    if (c.classList.contains("sflaunch")) return c.id || "sfLaunch";
    if (c.classList.contains("secfloat")) return c.id;
    if (c.dataset && c.dataset.sec) return "sec-" + c.dataset.sec;
    if (c.id) return c.id;
    // a heading with no id (the left docker's "System"): its words
    const w = c.matches && c.matches("h2.sec") ? String(c.textContent || "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 30) : "";
    return w ? "sec-" + w : "";
  }
  function nameOf(c) {
    if (!c) return "";
    if (c.classList.contains("sflaunch")) return "the panel buttons";
    if (c.classList.contains("secfloat")) return (c._dfPanel && c._dfPanel.title) || c.id;
    return String(c.textContent || "").replace(/^[▾▸\s]+/u, "").trim().slice(0, 24);
  }
  function prevHead(list, node) {
    let n = node;
    while (n && n.parentElement === list) { if (n.matches && n.matches("h2.sec:not(.sf-away), .secfloat.df-inline")) return n; n = n.previousElementSibling; }
    return null;
  }
  /** the node a stored `at` key names in the list (null = the end) */
  function nodeAt(list, at) {
    if (!at) return null;
    for (const c of list.children) if (keyOf(c) === at) return c;
    return null;
  }
  const CSS = ""
    // the eight handles: invisible bands on the edges (a corner is a 14 px square), lit tiger while hovered / dragged
    + ".dfg{position:absolute;z-index:6;display:none;touch-action:none}"
    + ".dfg:hover,.dfg.on{background:rgba(245,158,44,.35)}"
    + ".dfg-n,.dfg-s{left:12px;right:12px;height:7px;cursor:ns-resize}.dfg-n{top:0}.dfg-s{bottom:0}"
    + ".dfg-e,.dfg-w{top:12px;bottom:12px;width:7px;cursor:ew-resize}.dfg-e{right:0}.dfg-w{left:0}"
    + ".dfg-ne,.dfg-nw,.dfg-se,.dfg-sw{width:14px;height:14px}.dfg-ne{top:0;right:0;cursor:nesw-resize}.dfg-sw{bottom:0;left:0;cursor:nesw-resize}"
    + ".dfg-nw{top:0;left:0;cursor:nwse-resize}.dfg-se{bottom:0;right:0;cursor:nwse-resize}"
    + ".dfg-se::after{content:'';position:absolute;right:4px;bottom:4px;width:7px;height:7px;border-right:2px solid var(--dim,#9a917f);border-bottom:2px solid var(--dim,#9a917f);opacity:.7}"
    + ".dfm-float > .dfg{display:block}"
    + ".h3fp-t button,.tsd>.tsd-title button,.dfm-float .bhead button,.dfm-float .dockhead button{position:relative;z-index:7}"   // 2.514.0: a docker's ✕ / buttons above its resize grips (the corner grip covered ✕)
    + ".dfm-h > .dfg-s{display:block;left:0;right:0}"
    + ".dfm-we > .dfg-e{display:block;top:0;bottom:0}.dfm-ww > .dfg-w{display:block;top:0;bottom:0}"
    + "#dfZone{position:fixed;z-index:9998;background:rgba(38,128,235,.22);border:2px solid #2680eb;border-radius:6px;pointer-events:none;display:none}"
    + "#dfZone.inside{background:rgba(245,158,44,.2);border-color:var(--tiger,#f59e2c)}"
    + "#dfZone b{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:600 12px system-ui;color:#fff;background:#2680eb;padding:3px 8px;border-radius:4px;white-space:nowrap}"
    + "#dfZone.inside b{background:var(--tiger-deep,#c4761a)}"
    + "#dfZone.inline{background:var(--tiger,#f59e2c);border-color:var(--tiger,#f59e2c);border-radius:3px}"
    + "#dfZone.inline b{top:auto;bottom:10px;left:0;transform:none;max-width:100%;white-space:normal;background:var(--tiger-deep,#c4761a)}"
    // the tab strip of a docker holding panels
    + ".dftabs{display:flex;gap:2px;padding:4px 6px 0;border-bottom:1px solid var(--line,#3a342a);flex:none;overflow-x:auto;background:var(--panel,#1d1a15)}"
    + ".dftabs button{display:flex;align-items:center;gap:6px;padding:4px 10px;border:1px solid var(--line,#3a342a);border-bottom:none;border-radius:6px 6px 0 0;"
    + "background:var(--panel-2,#26221b);color:var(--dim,#9a917f);font-family:var(--disp);font-size:.66rem;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;white-space:nowrap}"
    + ".dftabs button.on{color:var(--tiger,#f59e2c);border-color:var(--tiger,#f59e2c);background:var(--panel,#1d1a15)}"
    + ".dftabs button .dftx{font-size:.7rem;opacity:.6;padding:0 2px}.dftabs button .dftx:hover{opacity:1;color:var(--tiger,#f59e2c)}"
    + ".dftabs button.dfguest{cursor:grab}"
    + ".df-host.df-guest-on > :not(.bhead):not(.dockhead):not(.dftabs):not(.df-tabbed.on):not(.dfg){display:none!important}"
    + ".df-host > .df-tabbed:not(.on){display:none!important}"
    + ".bdock.collapsed > .dftabs,.bdock.collapsed > .df-tabbed{display:none!important}";

  function css() { if (!$("dfCss")) { const st = document.createElement("style"); st.id = "dfCss"; st.textContent = CSS; document.head.appendChild(st); } }
  function relayout() { try { if (typeof reflowSoon === "function") reflowSoon(); window.dispatchEvent(new Event("resize")); } catch (e) { /* jsdom */ } }
  function scrollRefresh(el) { try { if (window.DockScroll) { if (DockScroll.scan) DockScroll.scan(); if (DockScroll.refresh) DockScroll.refresh(el); } } catch (e) { /* fine */ } }

  /* ---------------------------------------------------------------- grips */
  /** eight handles on el. o = {mode(): "float" | "h" | "we" | "ww" | "none", onMove(rect, mode, handle), onEnd(rect, mode),
   *  min: {w, h}, max: {w, h}} - float: left / top / width / height follow; h: the height; we / ww: the width */
  function grips(el, o) {
    css();
    const opt = o || {};
    if (el._dfGrips) { el._dfGrips.refresh(); return el._dfGrips; }
    for (const h of HANDLES) { const g = document.createElement("div"); g.className = "dfg dfg-" + h; g.dataset.dfg = h; el.appendChild(g); }
    const modeOf = () => { try { return (opt.mode && opt.mode()) || "none"; } catch (e) { return "none"; } };
    const refresh = () => { const m = modeOf(); for (const k of ["float", "h", "we", "ww"]) el.classList.toggle("dfm-" + k, m === k); return m; };
    el.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      let g = ev.target && ev.target.closest && ev.target.closest(".dfg");
      if (g && g.parentElement !== el) return;
      const r = el.getBoundingClientRect();
      if (!g && ev.target === el) {                        // the 1 px border itself: the edge under the pointer
        const h = edgeAt(ev.clientX - r.left, ev.clientY - r.top, r.width, r.height, 8);
        g = h ? el.querySelector(":scope > .dfg-" + h) : null;
      }
      if (!g) return;
      const mode = refresh(); if (mode === "none") return;
      const handle = g.dataset.dfg;
      if (mode === "h" && handle !== "s") return;
      if ((mode === "we" && handle !== "e") || (mode === "ww" && handle !== "w")) return;
      ev.preventDefault(); ev.stopPropagation();
      const s = { x: r.left, y: r.top, w: r.width, h: r.height }, x0 = ev.clientX, y0 = ev.clientY;
      const max = Object.assign({ w: Math.round(window.innerWidth * 0.96), h: Math.round(window.innerHeight * 0.94) }, opt.max || {});
      g.classList.add("on"); document.body.style.userSelect = "none";
      let last = s;
      const mv = (m) => {
        const dx = m.clientX - x0, dy = m.clientY - y0;
        if (mode === "float") last = resizeRect(s, handle, dx, dy, opt.min, max);
        else if (mode === "h") last = resizeRect(s, "s", 0, dy, opt.min, max);
        else if (mode === "we") last = resizeRect(s, "e", dx, 0, opt.min, max);
        else last = resizeRect(s, "w", dx, 0, opt.min, max);
        if (opt.onMove) opt.onMove(last, mode, handle);
        else if (mode === "float") Object.assign(el.style, { left: last.x + "px", top: last.y + "px", width: last.w + "px", height: last.h + "px" });
        else if (mode === "h") el.style.height = last.h + "px";
        else el.style.width = last.w + "px";
      };
      const up = () => {
        window.removeEventListener("pointermove", mv, true); window.removeEventListener("pointerup", up, true);
        g.classList.remove("on"); document.body.style.userSelect = "";
        if (opt.onEnd) opt.onEnd(last, mode);
        relayout();
      };
      window.addEventListener("pointermove", mv, true); window.addEventListener("pointerup", up, true);
    }, true);
    el.addEventListener("pointerenter", refresh);
    el._dfGrips = { refresh };
    refresh();
    return el._dfGrips;
  }

  /* ---------------------------------------------------------------- tabs */
  function headerOf(host) { return host.querySelector(":scope > .bhead, :scope > .dockhead"); }
  function dockName(t) {
    if (!t) return "";
    const h = t.querySelector(":scope > .dockhead h1, :scope > .bhead, :scope > .dockhead");
    const txt = h ? Array.from(h.childNodes).filter((n) => n.nodeType === 3 || (n.nodeType === 1 && !/^(BUTTON|SELECT|INPUT)$/.test(n.tagName) && !n.classList.contains("pf-badge")))
      .map((n) => n.textContent).join(" ") : "";
    return txt.replace(/^[▾▸📌\s]+/u, "").replace(/[⛶🗗]/gu, "").replace(/\s+/g, " ").trim().slice(0, 24) || t.id;
  }
  function tabsPaint(host) {
    if (!host) return;
    const guests = Array.from(host.querySelectorAll(":scope > .df-tabbed")).filter((g) => !g.classList.contains("sf-hidden"));
    let strip = host.querySelector(":scope > .dftabs");
    if (!guests.length) {
      if (strip) strip.remove();
      host.classList.remove("df-host", "df-guest-on");
      host.querySelectorAll(":scope > .df-tabbed").forEach((g) => g.classList.remove("on"));
      relayout();
      return;
    }
    host.classList.add("df-host");
    if (!strip) {
      strip = document.createElement("div"); strip.className = "dftabs"; strip.setAttribute("role", "tablist");
      const hd = headerOf(host); if (hd) hd.after(strip); else host.prepend(strip);
    }
    const on = guests.find((g) => g.classList.contains("on"));
    host.classList.toggle("df-guest-on", !!on);
    strip.innerHTML = "";
    const own = document.createElement("button"); own.type = "button"; own.dataset.dft = "__host"; own.setAttribute("role", "tab");
    own.textContent = dockName(host); own.className = on ? "" : "on"; own.title = "Show " + dockName(host);
    own.onclick = () => activate(host, null);
    strip.appendChild(own);
    for (const g of guests) {
      const p = g._dfPanel; if (!p) continue;
      const b = document.createElement("button"); b.type = "button"; b.dataset.dft = p.id; b.setAttribute("role", "tab");
      b.className = "dfguest" + (g === on ? " on" : "");
      b.title = p.title + " - click to show it; drag it out to float it or dock it elsewhere";
      b.innerHTML = `<span class="dftn"></span><span class="dftx" title="Hide ${p.title}${p.key ? " (" + p.key.toUpperCase() + ")" : ""}">✕</span>`;
      b.querySelector(".dftn").textContent = p.title;
      b.querySelector(".dftx").addEventListener("click", (e) => { e.stopPropagation(); p.hide(); });
      b.addEventListener("click", () => activate(host, g));
      p.wireDrag(b, true);
      strip.appendChild(b);
    }
    relayout();
  }
  function activate(host, guest) {
    host.querySelectorAll(":scope > .df-tabbed").forEach((g) => g.classList.toggle("on", g === guest));
    for (const g of host.querySelectorAll(":scope > .df-tabbed")) if (g._dfPanel) { const st = g._dfPanel.state(); st.active = g === guest; g._dfPanel.save(); }
    tabsPaint(host);
    if (guest) scrollRefresh(guest);
  }

  /* ---------------------------------------------------------------- panels */
  let zoneEl = null;
  function zone() { if (!zoneEl) { zoneEl = document.createElement("div"); zoneEl.id = "dfZone"; zoneEl.innerHTML = "<b></b>"; document.body.appendChild(zoneEl); } return zoneEl; }
  function sideDock(t) { return !!t && SIDE_IDS.includes(t.id); }
  function targetsFor(el) {
    const out = [];
    const add = (t, kind) => {
      if (!t || t === el || el.contains(t) || t.classList.contains("dockgone")) return;
      const r = t.getBoundingClientRect(); if (r.width < 60 || r.height < 24) return;
      // its title bar (+ its tab strip): a panel dropped there goes INSIDE it, as a tab
      // 2.560.0: a docked ▣ docker (.dgperm) takes the panels INTO itself (static/dgdock.js), not as a tab over it
      const hd = t.classList.contains("dgperm") ? null : headerOf(t), strip = t.querySelector(":scope > .dftabs");
      const hr = hd ? hd.getBoundingClientRect() : null, sr = strip ? strip.getBoundingClientRect() : null;
      const head = hr ? { l: r.left, t: hr.top, r: r.right, b: Math.max(hr.bottom, sr ? sr.bottom : 0) } : null;
      out.push({ el: t, kind, l: r.left, t: r.top, r: r.right, b: r.bottom, head });
    };
    document.querySelectorAll("#maincol .bdock").forEach((t) => add(t, "column"));
    const app = $("app");
    SIDE_IDS.forEach((id) => { const t = $(id); if (t && t.offsetParent !== null && !(app && t.offsetWidth === 0)) add(t, "side"); });
    return out;
  }

  /** spec = {id, title, key, el, head, state() -> the floats.<id> record, save(), hide(), min: {w, h}, defW, defH, onPlace()} */
  function panel(spec) {
    css();
    const el = spec.el, P = Object.assign({}, spec);
    el._dfPanel = P;
    const st = () => spec.state();
    const minW = (spec.min && spec.min.w) || 240, minH = (spec.min && spec.min.h) || 90;

    function unplace() {
      const parent = el.parentElement;
      const host = parent && parent.classList.contains("df-host") && el.classList.contains("df-tabbed") ? parent : null;
      if (parent && parent.classList.contains("df-row")) {
        const other = parent.querySelector(":scope > .bdock");
        if (other) parent.parentElement.insertBefore(other, parent);
        parent.remove();
      }
      el.classList.remove("df-float", "df-stack", "df-side", "df-inrow", "df-onleft", "df-onright", "df-tabbed", "df-inline", "on");
      el.style.left = el.style.top = el.style.width = el.style.height = el.style.flex = el.style.zIndex = "";   // (a float's z-order too)
      if (host) { el.remove(); tabsPaint(host); }
    }
    function mode() {
      if (el.classList.contains("df-float")) return "float";
      if (el.classList.contains("df-stack") || el.classList.contains("df-side")) return "h";
      if (el.classList.contains("df-inrow")) return el.classList.contains("df-onleft") ? "we" : "ww";
      return "none";
    }
    const g = grips(el, {
      mode, min: { w: minW, h: minH },
      onEnd: (r, m) => {
        const s = st();
        if (m === "float") { s.x = r.x; s.y = r.y; s.w = r.w; s.h = r.h; }
        else if (m === "h") s.dh = r.h;
        else { s.dw = r.w; el.style.flex = `0 0 ${r.w}px`; el.style.width = ""; }
        spec.save();
      },
      onMove: (r, m) => {
        if (m === "float") Object.assign(el.style, { left: r.x + "px", top: r.y + "px", width: r.w + "px", height: r.h + "px" });
        else if (m === "h") el.style.height = r.h + "px";
        else el.style.flex = `0 0 ${r.w}px`;
      },
    });

    function float(x, y, w, h, quiet) {
      unplace();
      document.body.appendChild(el);
      el.classList.add("df-float");
      const s = st(), vw = window.innerWidth || 1280, vh = window.innerHeight || 800;
      const W = Math.round(w || s.w || spec.defW || 320), H = Math.round(Math.min(h || s.h || spec.defH || 400, vh - 40));
      const p = onScreen(x != null ? x : (s.x != null && s.x !== -1 ? s.x : (spec.firstX ? spec.firstX(W) : 300)),
        y != null ? y : (s.y != null && s.y >= 0 ? s.y : 90), W, vw, vh);
      Object.assign(el.style, { left: p.x + "px", top: p.y + "px", width: W + "px", height: H + "px" });
      Object.assign(s, { mode: "float", to: "", side: "", at: "", x: p.x, y: p.y, w: W, h: H });
      g.refresh();
      if (!quiet) { spec.save(); relayout(); }
      if (spec.onPlace) spec.onPlace("float");
    }
    function dockTo(target, side, quiet, active, at) {
      if (!target || target === el || el.contains(target)) return false;   // (already inside the target = moved within it)
      const kind = sideDock(target) ? "side" : "column";
      const inRow = !!(target.parentElement && target.parentElement.classList.contains("pf-row"));
      const list = side === "inline" ? listOf(target) : null;
      const plan = side === "inline" ? (list ? "inline" : null) : planOf(kind, side, inRow);
      if (!plan) return false;
      unplace();
      const s = st();
      if (plan === "inline") {                               // 2.401.4: in the docker's own list, above `at`
        const ref = nodeAt(list, at || "");
        if (ref && ref !== el) list.insertBefore(el, ref); else list.appendChild(el);
        el.classList.add("df-inline");
        // (a restore whose `at` is a panel not placed yet keeps it - SecFloat places it again once that one is in)
        Object.assign(s, { mode: "dock", to: target.id, side: "inline", at: ref ? keyOf(ref) : (quiet ? (at || "") : "") });
      } else if (plan === "tab") {
        target.appendChild(el);
        el.classList.add("df-tabbed");
        Object.assign(s, { mode: "tab", to: target.id, side: "inside" });
        if (active !== false) { target.querySelectorAll(":scope > .df-tabbed").forEach((x) => x.classList.toggle("on", x === el)); s.active = true; }
        tabsPaint(target);
      } else if (plan === "side") {
        if (side === "top") { const strip = target.querySelector(":scope > .dftabs") || headerOf(target); if (strip) strip.after(el); else target.prepend(el); }
        else target.appendChild(el);
        el.classList.add("df-side");
        el.style.height = (s.dh || spec.defH || 300) + "px";
        Object.assign(s, { mode: "dock", to: target.id, side });
      } else if (plan === "stack") {
        const ref = inRow ? target.parentElement : target, col = ref.parentElement;   // beside a docker already in a row = above the row
        if (side !== "bottom") col.insertBefore(el, ref);
        else { const after = ref.nextElementSibling && ref.nextElementSibling.classList.contains("hsplit") ? ref.nextElementSibling : ref; after.after(el); }
        el.classList.add("df-stack");
        el.style.height = (s.dh || 240) + "px";
        Object.assign(s, { mode: "dock", to: target.id, side: side === "bottom" ? "bottom" : "top" });
      } else {                                               // row
        const col = target.parentElement;
        const row = document.createElement("div"); row.className = "pf-row df-row";
        col.insertBefore(row, target);
        if (side === "left") row.append(el, target); else row.append(target, el);
        el.classList.add("df-inrow", side === "left" ? "df-onleft" : "df-onright");
        el.style.flex = `0 0 ${s.dw || spec.defW || 320}px`;
        Object.assign(s, { mode: "dock", to: target.id, side });
      }
      g.refresh();
      if (!quiet) { spec.save(); relayout(); }
      scrollRefresh(el);
      if (spec.onPlace) spec.onPlace(s.mode);
      return true;
    }
    /** where docker_status.json says it was */
    function restore() {
      const s = st();
      if (s.mode !== "float" && s.to) {
        const t = $(s.to);
        if (t && dockTo(t, s.side || (s.mode === "tab" ? "inside" : "bottom"), true, s.mode === "tab" ? s.active : undefined, s.at)) { relayout(); return; }
      }
      float(null, null, null, null, true);
    }

    /* the drag: the titlebar (floating / docked) or the tab (tabbed) */
    function wireDrag(handle, isTab) {
      if (handle._dfDrag) return;
      handle._dfDrag = true;
      handle.addEventListener("pointerdown", (ev) => {
        if (ev.button !== 0) return;
        if (ev.target.closest && ev.target.closest(isTab ? ".dftx" : "button, select, input, label, .dfg")) return;
        if (!isTab) ev.preventDefault();
        const d = { x0: ev.clientX, y0: ev.clientY, started: false };
        const z = zone();
        const mv = (m) => {
          if (!d.started) {
            if (Math.hypot(m.clientX - d.x0, m.clientY - d.y0) < 6) return;
            d.started = true;
            if (!el.classList.contains("df-float")) {          // tear it out, under the pointer
              const s = st(), W = s.w || spec.defW || 320, H = s.h || spec.defH || 400;
              float(m.clientX - Math.min(W / 2, 120), m.clientY - 14, W, H, true);
            }
            const r = el.getBoundingClientRect();
            d.ox = m.clientX - r.left; d.oy = m.clientY - r.top;
            el.classList.add("sf-drag");
            d.targets = targetsFor(el);
            if (spec.front) spec.front();
          }
          const w = el.offsetWidth, h = el.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
          const others = d.targets.concat(Array.from(document.querySelectorAll(".secfloat.df-float, #promptdock.pf-float"))
            .filter((x) => x !== el && x.offsetParent !== null).map((x) => { const r = x.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }));
          let p = snap({ x: m.clientX - d.ox, y: m.clientY - d.oy, w, h }, others.concat([{ l: 0, t: 0, r: vw, b: vh }]), 10);
          p = onScreen(p.x, p.y, w, vw, vh);
          el.style.left = p.x + "px"; el.style.top = p.y + "px";
          d.zone = null;
          // 2.401.4: over a docker's own list (the left docker's sections) - a line between two sections
          for (const t of d.targets) {
            const list = listOf(t.el); if (!list) continue;
            const lr = list.getBoundingClientRect();
            if (m.clientX < lr.left || m.clientX > lr.right || m.clientY < lr.top || m.clientY > lr.bottom) continue;
            const gaps = gapsOf(list, el), gp = gapAt(m.clientY, gaps);
            if (!gp) continue;
            const y = Math.max(lr.top + 2, Math.min(lr.bottom - 2, gp.y));
            d.zone = { el: t.el, side: "inline", at: gp.key, r: { l: lr.left + 4, t: y - 5, r: lr.right - 4, b: y + 5 },
                       label: inlineLabel(spec.title, dockName(t.el), gp.name, gp.key ? "" : gp.last) };
            break;
          }
          if (!d.zone) for (const t of d.targets) {
            const sides = t.kind === "side" ? ["top", "bottom"] : SIDES;
            const sd = zoneAt(m.clientX, m.clientY, t, sides, t.head || false, EDGE);
            if (sd) { d.zone = { el: t.el, side: sd, r: zoneRect(t, sd) }; break; }
          }
          if (d.zone) {
            const zr = d.zone.r;                             // (inside: the whole docker lights up)
            Object.assign(z.style, { display: "block", left: zr.l + "px", top: zr.t + "px", width: (zr.r - zr.l) + "px", height: (zr.b - zr.t) + "px" });
            z.classList.toggle("inside", d.zone.side === "inside");
            z.classList.toggle("inline", d.zone.side === "inline");
            z.querySelector("b").textContent = d.zone.label || zoneLabel(spec.title, d.zone.side, dockName(d.zone.el));
          } else z.style.display = "none";
        };
        const up = () => {
          window.removeEventListener("pointermove", mv, true); window.removeEventListener("pointerup", up, true);
          z.style.display = "none"; el.classList.remove("sf-drag");
          if (!d.started) return;
          const eat = (c) => { c.stopPropagation(); c.preventDefault(); window.removeEventListener("click", eat, true); };
          window.addEventListener("click", eat, true); setTimeout(() => window.removeEventListener("click", eat, true), 300);
          if (d.zone && dockTo(d.zone.el, d.zone.side, false, undefined, d.zone.at)) return;
          const s = st(); s.x = parseInt(el.style.left, 10) || 0; s.y = parseInt(el.style.top, 10) || 0;
          Object.assign(s, { mode: "float", to: "", side: "" });
          spec.save(); relayout();
        };
        window.addEventListener("pointermove", mv, true); window.addEventListener("pointerup", up, true);
      });
    }
    wireDrag(spec.head, false);
    function onShow() {                                      // shown again: a tab becomes the shown tab
      const host = el.parentElement;
      if (el.classList.contains("df-tabbed") && host) activate(host, el);
      else relayout();
      scrollRefresh(el);
    }
    function onHide() {
      const host = el.parentElement;
      if (el.classList.contains("df-tabbed") && host) { el.classList.remove("on"); tabsPaint(host); }
      else relayout();
    }
    Object.assign(P, { float, dockTo, restore, unplace, mode: () => st().mode, wireDrag, onShow, onHide, grips: g, state: st, save: spec.save, hide: spec.hide });
    return P;
  }

  root.DockFloat = { grips, panel, tabsPaint, activate, dockName, targetsFor, pure, LISTS, gapsOf: (list, el) => gapsOf(list, el) };
})(typeof window !== "undefined" ? window : globalThis);
