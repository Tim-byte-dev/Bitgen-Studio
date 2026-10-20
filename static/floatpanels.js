/* bitGen Studio — static/floatpanels.js (2.438.0): FLOATING DOCKERS and NAMED DOCKERS to dock them in, window.H3Panels
 * (+ require() in Node for the pure part).
 *
 * Tim (verbatim): "in image docker make layers tab group and color tab group into floating dockers that can resize.
 * create an empty floating docker that can be named. other floating dockers will be able to dock in the new docker.
 * allow it to be like a main docker or a sub docker confined to another docker."
 *
 *   A PANEL        adopt({id, title, el, home: {parent, before}, scope, confine, onClose}) - a part of a docker that can float
 *                  (2.514.0: onClose = what its ✕ does - the image editor's panels CLOSE; without it ✕ puts it home):
 *                  ⇱ (the caller's button) = float(id): a window of its own - its title bar drags it, every edge sizes
 *                  it (DockFloat.grips), ⇲ puts it back where it came from (home). scope() = the element it must stay
 *                  in (the image editor's panels stay in the editor: its colours, its full screen); confine() = what it
 *                  floats inside by default.
 *   A NAMED DOCKER newDocker({name, confine}) - an empty floating docker: double-click its name to rename it; ⚙ =
 *                  Rename…, MAIN DOCKER (floats over the whole app) or CONFINED TO a docker (it stays inside that
 *                  docker - the timeline, the image editor, another named docker …), Delete. Drag any floating docker by
 *                  its title over it: it lights up - drop = docked in it as a TAB (its tab's ⇱, or dragging the tab
 *                  out, floats it again). Named dockers dock in named dockers too.
 *   KEPT           where each one is, its size, which docker it is in, the dockers' names / tabs - panel_layout.cfg
 *                  (lib/layoutCfg.js, GET / POST /api/layout/panel), back at the next start.
 *   DROP ZONES     (2.454.0) zoneHost({id, el, zones(r), drop(id, key)}) - a place that is not a named docker can take a
 *                  floating one too (the image editor's panel column): while a floating docker is dragged over it, an
 *                  orange line shows where it would go; drop = host.drop(id, zone key). placeAt(id, parent, before) = a
 *                  panel's new home (it goes there now and ⇲ brings it back there later).
 *   LAYOUT         (2.545.0 - Tim: "an empty docker with dropzones for other dockers. should be able to be horizontal or
 *                  vertical with a editable titlebar") a named docker lays its dockers out as TABS (as before), side by
 *                  side (HORIZONTAL) or stacked (VERTICAL): ⇆ / ⇅ in its title bar switches, ⚙ has all three. In a
 *                  row / column every docker in it shows, with its own small title bar (drag it out = it floats, ⇱),
 *                  a splitter between two sizes them (kept); a floating docker dragged over it shows an orange line
 *                  where it goes - drop = there. Double-click the title = edit it in place (Enter keeps, Esc drops).
 * Pure (Node: scripts/test-panels.js, test-dockgroup545.js): fit (a rect inside bounds), hitDocker (the docker under a
 * point), canDock (no docker inside itself), slug, columnZones (2.454.0: the zones above / below each part of a
 * column), slotIn (2.545.0: where in a row / column a drop goes), LAYOUTS.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  /** r {x, y, w, h} moved (and shrunk if it must be) to lie inside B {left, top, right, bottom}; min {w, h} */
  function fit(r, B, min) {
    const m = Object.assign({ w: 160, h: 100 }, min || {});
    const bw = B.right - B.left, bh = B.bottom - B.top;
    const w = Math.max(Math.min(m.w, bw), Math.min(r.w, bw)), h = Math.max(Math.min(m.h, bh), Math.min(r.h, bh));
    return { x: Math.round(Math.max(B.left, Math.min(B.right - w, r.x))), y: Math.round(Math.max(B.top, Math.min(B.bottom - h, r.y))), w: Math.round(w), h: Math.round(h) };
  }
  /** the docker whose drop area holds (x, y): dockers = [{id, rect, z}] - the one on top (highest z, then the last) */
  function hitDocker(x, y, dockers) {
    let best = null;
    for (const d of dockers || []) {
      const r = d.rect; if (!r || x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
      if (!best || (d.z || 0) >= (best.z || 0)) best = d;
    }
    return best ? best.id : null;
  }
  /** may `id` dock in docker `into`? not itself, not a docker that is (somewhere) inside it; parentOf(id) -> its docker */
  function canDock(id, into, parentOf) {
    if (!into || id === into) return false;
    for (let p = into, n = 0; p && n < 50; p = parentOf(p), n++) if (p === id) return false;
    return true;
  }
  /** 2.454.0: a column's drop zones - parts [{key, rect {left, top, right, bottom}}] top to bottom, col = the column's rect:
   *  the top half of a part = before it, the bottom half = after it, the empty space below them = the end; each zone's
   *  line = where the orange marker shows */
  function columnZones(parts, col) {
    const out = [], L = col.left, W = col.right - col.left;
    const ps = (parts || []).filter((p) => p && p.rect && p.rect.bottom - p.rect.top > 2);
    for (const p of ps) {
      const r = p.rect, mid = (r.top + r.bottom) / 2;
      out.push({ key: "before:" + p.key, rect: { left: L, right: col.right, top: r.top, bottom: mid }, line: { x: L, y: r.top - 2, w: W, h: 4 } });
      out.push({ key: "after:" + p.key, rect: { left: L, right: col.right, top: mid, bottom: r.bottom }, line: { x: L, y: r.bottom - 2, w: W, h: 4 } });
    }
    const last = ps.length ? ps[ps.length - 1].rect.bottom : col.top;
    if (col.bottom - last > 4) out.push({ key: "end", rect: { left: L, right: col.right, top: last, bottom: col.bottom }, line: { x: L, y: last, w: W, h: 4 } });
    return out;
  }
  /** 2.545.0: where in a row (axis "x") / column ("y") of parts [{rect}] a drop at (x, y) goes -> {index, line {x, y, w, h}};
   *  box = the docker's pane rect (the line spans it); before a part's middle = before it, after the last = the end */
  function slotIn(parts, axis, x, y, box) {
    const ps = (parts || []).filter((p) => p && p.rect);
    const v = axis === "x" ? x : y;
    let index = ps.length;
    for (let i = 0; i < ps.length; i++) { const r = ps[i].rect, mid = axis === "x" ? (r.left + r.right) / 2 : (r.top + r.bottom) / 2; if (v < mid) { index = i; break; } }
    const B = box || (ps.length ? { left: Math.min(...ps.map((p) => p.rect.left)), top: Math.min(...ps.map((p) => p.rect.top)), right: Math.max(...ps.map((p) => p.rect.right)), bottom: Math.max(...ps.map((p) => p.rect.bottom)) } : { left: x, top: y, right: x, bottom: y });
    let at;
    if (!ps.length) at = axis === "x" ? (B.left + B.right) / 2 : (B.top + B.bottom) / 2;
    else if (index < ps.length) at = axis === "x" ? ps[index].rect.left : ps[index].rect.top;
    else at = axis === "x" ? ps[ps.length - 1].rect.right : ps[ps.length - 1].rect.bottom;
    const line = axis === "x" ? { x: at - 2, y: B.top, w: 4, h: B.bottom - B.top } : { x: B.left, y: at - 2, w: B.right - B.left, h: 4 };
    return { index, line };
  }
  const LAYOUTS = ["tabs", "row", "col"];
  const inRect = (r, x, y) => !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "docker";

  /* ================================ the page ================================ */
  const R = {};                       // id -> {id, kind: panel | docker, title, el, win, home, scope, confine, state, ...}
  let LAY = { panels: {}, dockers: {} }, loaded = false, saveT = null;
  const $ = (id) => root.document.getElementById(id);
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const CSS = ".h3fp{position:fixed;z-index:9300;display:flex;flex-direction:column;min-width:160px;min-height:100px;background:var(--panel,var(--pc-panel,#1c1915));color:var(--text,var(--pc-text,#e8e2d6));border:1px solid var(--line,var(--pc-line,#3a342a));border-radius:6px;box-shadow:0 10px 30px rgba(0,0,0,.5);overflow:hidden}"
    + ".h3fp.off{display:none}.h3fp-t{display:flex;align-items:center;gap:4px;height:26px;flex:none;padding:0 4px 0 8px;cursor:move;user-select:none;background:var(--panel-2,var(--pc-bg,#26221b));border-bottom:1px solid var(--line,var(--pc-line,#3a342a));font-size:12px}"
    + ".h3fp-n{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}.h3fp-t button{border:0;background:none;color:inherit;cursor:pointer;padding:0 4px;font-size:13px;line-height:24px}.h3fp-t button:hover{color:var(--tiger,#f59e2c)}"
    + ".h3fp-b{flex:1;min-height:0;display:flex;flex-direction:column;overflow:auto}.h3fp-b>*{flex:1 1 auto;min-height:0}"
    + ".h3fp.in{position:static!important;width:auto!important;height:auto!important;flex:1;min-height:0;border:0;border-radius:0;box-shadow:none}.h3fp.in>.h3fp-t{display:none}.h3fp.in.hid{display:none}"
    + ".h3fd{flex:1;display:flex;flex-direction:column;min-height:0}.h3fd-tabs{display:flex;flex:none;overflow-x:auto;border-bottom:1px solid var(--line,var(--pc-line,#3a342a));background:var(--ink,var(--pc-bg,#14120f))}"
    + ".h3fd-tab{display:flex;align-items:center;gap:2px;padding:3px 8px;font-size:11px;cursor:pointer;white-space:nowrap;border-right:1px solid var(--line,var(--pc-line,#3a342a));user-select:none}.h3fd-tab.on{background:var(--panel,var(--pc-panel,#1c1915));color:var(--tiger,#f59e2c)}"
    + ".h3fd-tab button{border:0;background:none;color:inherit;cursor:pointer;font-size:11px;padding:0 2px}.h3fd-pane{flex:1;display:flex;flex-direction:column;min-height:0;overflow:auto}"
    + ".h3fd.lay-row>.h3fd-tabs,.h3fd.lay-col>.h3fd-tabs{display:none}.h3fd.lay-row>.h3fd-pane{flex-direction:row}.h3fd.lay-col>.h3fd-pane{flex-direction:column}"
    + ".h3fd.lay-row>.h3fd-pane>.h3fp.in,.h3fd.lay-col>.h3fd-pane>.h3fp.in{flex:var(--g,1) 1 0;min-width:80px;min-height:60px;overflow:hidden}.h3fd.lay-row>.h3fd-pane>.h3fp.in.hid,.h3fd.lay-col>.h3fd-pane>.h3fp.in.hid{display:flex}"
    + ".h3fd.lay-row>.h3fd-pane>.h3fp.in>.h3fp-t,.h3fd.lay-col>.h3fd-pane>.h3fp.in>.h3fp-t{display:flex;height:20px;font-size:11px;cursor:grab}"
    + ".h3fd-split{flex:0 0 5px;background:var(--line,#3a342a);cursor:col-resize}.h3fd.lay-col .h3fd-split{cursor:row-resize}.h3fd-split:hover{background:var(--tiger,#f59e2c)}"
    + ".h3fp-n input{width:100%;font:inherit;font-weight:600;background:var(--ink,#14120f);color:inherit;border:1px solid var(--tiger,#f59e2c);border-radius:3px;padding:0 4px}"
    + ".h3fd-empty{margin:auto;padding:12px;color:var(--dim,var(--pc-dim,#9a917f));font-size:12px;text-align:center}.h3fp.drop{outline:2px solid var(--tiger,#f59e2c);outline-offset:-2px}.h3fp.drop .h3fd-pane{background:rgba(245,158,44,.08)}"
    + ".h3fp-menu{position:fixed;z-index:9400;background:var(--panel,#1c1915);border:1px solid var(--line,#3a342a);border-radius:6px;padding:4px 0;font-size:12px;box-shadow:0 8px 24px rgba(0,0,0,.5);min-width:180px}"
    + ".h3fp-menu div{padding:4px 12px;cursor:pointer;white-space:nowrap}.h3fp-menu div:hover{background:var(--ui-hover,#2f2a21)}.h3fp-menu div.on::before{content:'✓ '}.h3fp-menu hr{border:0;border-top:1px solid var(--line,#3a342a);margin:4px 0}.h3fp-menu .h{color:var(--dim,#9a917f);cursor:default}";
  function css() { if (!$("h3fpCss")) { const s = root.document.createElement("style"); s.id = "h3fpCss"; s.textContent = CSS; root.document.head.appendChild(s); } }

  /* ---- the app's dockers + named dockers that one can be confined to */
  function hosts() {
    const out = [...root.document.querySelectorAll(".dock[id], .bdock[id]")].map((el) => ({ id: el.id, name: dockName(el) }))
      .concat([...root.document.querySelectorAll("[data-fp-host][id]")].map((el) => ({ id: el.id, name: el.dataset.fpHost })));   // e.g. the image editor itself
    for (const r of Object.values(R)) if (r.kind === "docker") out.push({ id: r.id, name: "▣ " + r.title });
    return out;
  }
  // a dock's name: its header's heading, else the header's own words (not its buttons) - never a heading of a panel
  // docked inside it (2.443.0: 🧰 docked in the timeline's preview row has an h2 of its own)
  function dockName(el) {
    const h = [...el.querySelectorAll(".bhead h1, .bhead h2, .bhead .bt, .dockhead h1, h1, h2")].find((x) => !x.closest(".tsd, .h3fp"));
    if (h) return h.textContent.trim().slice(0, 30) || el.id;
    const bh = el.querySelector(":scope > .bhead, :scope > .dockhead");
    const t = bh ? [...bh.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" ").replace(/[▾▸]/g, "").trim() : "";
    return t.slice(0, 30) || el.id;
  }
  const hostEl = (id) => (id ? (R[id] ? R[id].win : $(id)) : null);
  /** where a record floats: inside its confining docker (if it shows), else the window */
  function bounds(r) {
    const c = r.confineId ? hostEl(r.confineId) : (r.confine ? r.confine() : null);
    const b = c && c.getBoundingClientRect ? c.getBoundingClientRect() : null;
    if (b && b.width > 60 && b.height > 60) return b;
    return { left: 0, top: 0, right: root.innerWidth, bottom: root.innerHeight };
  }
  const visibleHost = (r) => { const c = r.confineId ? hostEl(r.confineId) : (r.confine ? r.confine() : null); if (!c) return true; const b = c.getBoundingClientRect(); return b.width > 60 && b.height > 60; };
  /** the DOM parent of a floating window: its scope / confining docker (so it shows in a full-screen editor and hides with it) */
  function parentFor(r) {
    const c = r.confineId ? hostEl(r.confineId) : (r.scope ? r.scope() : (r.confine ? r.confine() : null));
    return c || root.document.body;
  }

  /* ---- the windows */
  function makeWin(r) {
    css();
    const w = root.document.createElement("div");
    w.className = "h3fp off"; w.dataset.fp = r.id; w.setAttribute("role", "dialog"); w.setAttribute("aria-label", r.title); w.dataset.noLayout = "";
    w.innerHTML = `<div class="h3fp-t"><span class="h3fp-n"></span>${r.kind === "docker" ? '<button type="button" class="h3fp-lay"></button><button type="button" class="h3fp-cfg" title="Rename, layout (tabs / horizontal / vertical), main docker or confined to a docker, delete">⚙</button>' : ""}`
      + `${r.kind === "panel" ? '<button type="button" class="h3fp-out" title="Float it (out of the docker it is in)">⇱</button>' : ""}`
      + `${r.home ? '<button type="button" class="h3fp-home" title="Put it back where it was">⇲</button>' : ""}<button type="button" class="h3fp-x" title="Hide">✕</button></div><div class="h3fp-b"></div>`;
    w.querySelector(".h3fp-n").textContent = r.title;
    const body = w.querySelector(".h3fp-b");
    if (r.kind === "docker") body.innerHTML = `<div class="h3fd"><div class="h3fd-tabs"></div><div class="h3fd-pane"><div class="h3fd-empty">Drag a floating docker here by its title bar - ⇱ on a docker's title floats it</div></div></div>`;
    if (r.kind === "panel") { const o = w.querySelector(".h3fp-out"); o.style.display = "none"; o.onclick = () => { const b = w.getBoundingClientRect(); float(r.id, { x: b.left + 20, y: b.top + 20, w: Math.max(260, b.width), h: Math.max(200, b.height) }); }; }
    w.querySelector(".h3fp-x").onclick = () => (r.kind === "docker" ? show(r.id, false) : r.onClose ? r.onClose() : home(r.id));   // 2.514.0: a panel may close (onClose)
    if (r.home) w.querySelector(".h3fp-home").onclick = () => home(r.id);
    if (r.kind === "docker") {
      w.querySelector(".h3fp-cfg").onclick = (e) => cfgMenu(r.id, e.clientX, e.clientY);
      w.querySelector(".h3fp-n").ondblclick = () => editTitle(r.id);                 // 2.545.0: in place
      w.querySelector(".h3fp-lay").onclick = () => setLayout(r.id, r.layout === "row" ? "col" : "row");
    }
    titleDrag(r, w.querySelector(".h3fp-t"));
    if (root.DockFloat && root.DockFloat.grips) root.DockFloat.grips(w, { mode: () => (r.state === "float" ? "float" : "none"), min: { w: 160, h: 100 }, onEnd: () => { keepRect(r); save(); } });
    r.win = w;
    paintLay(r);                                       // 2.545.0: ▤ / ⇆ / ⇅
    return w;
  }
  function keepRect(r) { const b = r.win.getBoundingClientRect(); const f = fit({ x: b.left, y: b.top, w: b.width, h: b.height }, bounds(r)); Object.assign(r, f); setRect(r); }
  function setRect(r) { Object.assign(r.win.style, { left: r.x + "px", top: r.y + "px", width: r.w + "px", height: r.h + "px" }); }
  function titleDrag(r, bar) {
    // 2.545.0: a docker shown in a row / column of a named docker - drag its little title bar = it floats again
    bar.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest("button,input") || r.state !== "in") return;
      const x0 = e.clientX, y0 = e.clientY;
      const mv = (m) => { if (Math.hypot(m.clientX - x0, m.clientY - y0) > 24) { stop(); float(r.id, { x: m.clientX - 40, y: m.clientY - 12, w: r.w || 320, h: r.h || 360 }); } };
      const stop = () => { root.removeEventListener("pointermove", mv, true); root.removeEventListener("pointerup", stop, true); };
      root.addEventListener("pointermove", mv, true); root.addEventListener("pointerup", stop, true);
    });
    bar.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest("button,input") || r.state !== "float") return;
      e.preventDefault();
      const b = r.win.getBoundingClientRect(), ox = e.clientX - b.left, oy = e.clientY - b.top;
      let over = null, zone = null, slot = null;
      const mv = (m) => {
        const f = fit({ x: m.clientX - ox, y: m.clientY - oy, w: b.width, h: b.height }, bounds(r));
        r.x = f.x; r.y = f.y; r.win.style.left = f.x + "px"; r.win.style.top = f.y + "px";
        const id = targetAt(r, m.clientX, m.clientY);
        if (id !== over) { if (over && R[over]) R[over].win.classList.remove("drop"); over = id; if (over) R[over].win.classList.add("drop"); }
        zone = over ? null : zoneAt(r, m.clientX, m.clientY);            // 2.454.0: a drop zone (the editor's panel column)
        slot = over ? slotOf(R[over], m.clientX, m.clientY) : null;      // 2.545.0: where in a row / column
        marker(zone ? zone.zone.line : slot ? slot.line : null);
      };
      const up = () => {
        root.removeEventListener("pointermove", mv, true); root.removeEventListener("pointerup", up, true);
        marker(null);
        if (over && R[over]) { R[over].win.classList.remove("drop"); dockInto(r.id, over, slot ? slot.index : undefined); }
        else if (zone) { try { zone.host.drop(r.id, zone.zone.key); } catch (e) { /* the host's */ } save(); }
        else save();
      };
      root.addEventListener("pointermove", mv, true); root.addEventListener("pointerup", up, true);
    });
  }
  /* ---- 2.454.0: drop zones (hosts that are not named dockers) */
  const ZONES = [];
  function zoneHost(o) { if (o && o.id && o.el && o.zones && o.drop) { const i = ZONES.findIndex((z) => z.id === o.id); if (i >= 0) ZONES.splice(i, 1); ZONES.push(o); } return o; }
  function zoneAt(r, x, y) {
    for (const h of ZONES) {
      const el = h.el(); if (!el || !el.isConnected || (r.scope && r.scope() && !r.scope().contains(el))) continue;
      const cr = el.getBoundingClientRect(); if (cr.width < 20 || cr.height < 20 || !inRect(cr, x, y)) continue;
      const z = (h.zones(r) || []).find((q) => inRect(q.rect, x, y));
      if (z) return { host: h, zone: z };
    }
    return null;
  }
  let mk = null;
  function marker(line) {
    if (!line) { if (mk) mk.style.display = "none"; return; }
    if (!mk) { mk = root.document.createElement("div"); mk.id = "h3fpZone"; mk.style.cssText = "position:fixed;z-index:9500;pointer-events:none;background:var(--tiger,#f59e2c);border-radius:2px;box-shadow:0 0 8px var(--tiger,#f59e2c)"; root.document.body.appendChild(mk); }
    Object.assign(mk.style, { display: "", left: line.x + "px", top: line.y + "px", width: line.w + "px", height: line.h + "px" });
  }
  /** a panel's new home - it goes there now (from floating / a docker) and ⇲ brings it back there later */
  function placeAt(id, parent, before) {
    const r = R[id]; if (!r || r.kind !== "panel" || !parent) return;
    r.home = { parent, before: before && before.parentNode === parent ? before : null };
    home(id);
  }
  /** the named docker under the pointer that `r` may dock in */
  function targetAt(r, x, y) {
    const list = Object.values(R).filter((d) => d.kind === "docker" && d.id !== r.id && d.win && isShown(d) && canDock(r.id, d.id, (k) => (R[k] ? R[k].docker : null))
      && (!r.scope || !r.scope() || r.scope().contains(d.win)))
      .map((d) => ({ id: d.id, rect: d.win.querySelector(".h3fd").getBoundingClientRect(), z: depthZ(d) }));
    return hitDocker(x, y, list);
  }
  const depthZ = (d) => { let n = 0; for (let p = d; p && p.docker; p = R[p.docker]) n++; return 100 - n + (+(d.win.style.zIndex || 0) / 1e4); };
  const isShown = (d) => !!d.win && d.win.isConnected && !d.win.classList.contains("off") && d.win.getBoundingClientRect().width > 0;

  /* ---- states: home / float / in a docker */
  function float(id, at) {
    const r = R[id]; if (!r) return;
    if (!r.win) makeWin(r);
    if (r.docker) undock(r);
    if (r.kind === "panel" && r.el.parentNode !== r.win.querySelector(".h3fp-b")) r.win.querySelector(".h3fp-b").appendChild(r.el);
    r.state = "float";
    r.win.classList.remove("in", "hid", "off");
    { const ob = r.win.querySelector(".h3fp-out"); if (ob) ob.style.display = "none"; }
    const p = parentFor(r); if (r.win.parentNode !== p) p.appendChild(r.win);
    const B = bounds(r);
    if (at) Object.assign(r, at);
    if (!(r.w > 0)) { r.w = Math.min(320, B.right - B.left); r.h = Math.min(460, B.bottom - B.top); r.x = B.right - r.w - 24; r.y = B.top + 40; }
    Object.assign(r, fit(r, B)); setRect(r);
    if (r.win._dfGrips) r.win._dfGrips.refresh();       // the resize grips on now (not only after a first hover)
    if (r.onState) r.onState("float");
    save();
  }
  function home(id) {
    const r = R[id]; if (!r || r.kind !== "panel" || !r.home) return;
    if (r.docker) undock(r);
    const h = r.home; h.parent.insertBefore(r.el, h.before && h.before.parentNode === h.parent ? h.before : null);
    r.state = "home"; if (r.win) r.win.classList.add("off");
    if (r.onState) r.onState("home");
    save();
  }
  /** 2.545.0: the slot a drop at (x, y) takes in docker d laid out as a row / column (null for tabs) */
  function slotOf(d, x, y) {
    if (!d || !d.layout || d.layout === "tabs") return null;
    const pane = d.win.querySelector(".h3fd-pane");
    const parts = (d.tabs || []).map((t) => (R[t] && R[t].win ? { rect: R[t].win.getBoundingClientRect() } : null)).filter((p) => p && p.rect.width > 0);
    return slotIn(parts, d.layout === "row" ? "x" : "y", x, y, pane.getBoundingClientRect());
  }
  function dockInto(id, into, at) {
    const r = R[id], d = R[into]; if (!r || !d || !canDock(id, into, (k) => (R[k] ? R[k].docker : null))) return;
    if (!r.win) makeWin(r);
    if (r.docker) undock(r);
    if (r.kind === "panel" && r.el.parentNode !== r.win.querySelector(".h3fp-b")) r.win.querySelector(".h3fp-b").appendChild(r.el);
    r.docker = into; r.state = "in";
    const rest = (d.tabs || []).filter((x) => x !== id), k = at == null || !(at >= 0) ? rest.length : Math.min(rest.length, Math.round(at));   // 2.545.0: at = its place
    d.tabs = rest.slice(0, k).concat([id], rest.slice(k)); d.active = id;
    r.win.classList.remove("off"); r.win.classList.add("in");
    d.win.querySelector(".h3fd-pane").appendChild(r.win);
    paintTabs(d);
    if (r.win._dfGrips) r.win._dfGrips.refresh();
    if (r.onState) r.onState("in");
    save();
  }
  function undock(r) {
    const d = R[r.docker]; r.docker = null;
    if (d) { d.tabs = (d.tabs || []).filter((x) => x !== r.id); if (d.active === r.id) d.active = d.tabs[d.tabs.length - 1] || null; paintTabs(d); }
    r.win.classList.remove("in", "hid");
  }
  function paintTabs(d) {
    const strip = d.win.querySelector(".h3fd-tabs"), pane = d.win.querySelector(".h3fd-pane");
    paintLay(d);
    if (d.layout === "row" || d.layout === "col") {                // 2.545.0: every docker in it shows, in order, splitters between
      strip.innerHTML = "";
      pane.querySelectorAll(":scope > .h3fd-split").forEach((s) => s.remove());
      const empty0 = pane.querySelector(".h3fd-empty"); if (empty0) empty0.style.display = (d.tabs || []).length ? "none" : "";
      const ms = (d.tabs || []).map((t) => R[t]).filter((m) => m && m.win);
      ms.forEach((m, i) => {
        m.win.classList.remove("hid"); m.win.style.setProperty("--g", String(m.grow > 0 ? m.grow : 1));
        const ob = m.win.querySelector(".h3fp-out"); if (ob) ob.style.display = "";
        pane.appendChild(m.win);
        if (i < ms.length - 1) { const s = root.document.createElement("div"); s.className = "h3fd-split"; s.title = "Drag to size them"; pane.appendChild(s); splitter(d, s, m, ms[i + 1]); }
      });
      return;
    }
    for (const t of d.tabs || []) { const m = R[t]; if (m && m.win) { const ob = m.win.querySelector(".h3fp-out"); if (ob) ob.style.display = "none"; } }
    pane.querySelectorAll(":scope > .h3fd-split").forEach((s) => s.remove());
    strip.innerHTML = (d.tabs || []).map((t) => `<div class="h3fd-tab${t === d.active ? " on" : ""}" data-t="${esc(t)}"><span>${esc(R[t] ? R[t].title : t)}</span><button type="button" title="Float it">⇱</button></div>`).join("");
    const empty = pane.querySelector(".h3fd-empty"); if (empty) empty.style.display = (d.tabs || []).length ? "none" : "";
    for (const t of d.tabs || []) if (R[t] && R[t].win) R[t].win.classList.toggle("hid", t !== d.active);
    strip.querySelectorAll(".h3fd-tab").forEach((el) => {
      const t = el.dataset.t;
      el.querySelector("button").onclick = (e) => { e.stopPropagation(); const b = el.getBoundingClientRect(); float(t, { x: b.left, y: b.bottom + 4 }); };
      el.onpointerdown = (e) => {
        if (e.target.closest("button")) return;
        d.active = t; paintTabs(d); save();
        const x0 = e.clientX, y0 = e.clientY;
        const mv = (m) => { if (Math.hypot(m.clientX - x0, m.clientY - y0) > 24) { stop(); const rr = R[t]; float(t, { x: m.clientX - 40, y: m.clientY - 12, w: rr.w || 300, h: rr.h || 360 }); } };
        const stop = () => { root.removeEventListener("pointermove", mv, true); root.removeEventListener("pointerup", stop, true); };
        root.addEventListener("pointermove", mv, true); root.addEventListener("pointerup", stop, true);
      };
    });
  }

  /* ---- 2.545.0: the layout of a named docker, its splitters, its title edited in place */
  function paintLay(d) {
    if (!d || d.kind !== "docker" || !d.win) return;
    const L = LAYOUTS.includes(d.layout) ? d.layout : "tabs";
    const fd = d.win.querySelector(".h3fd"); if (fd) { fd.classList.toggle("lay-row", L === "row"); fd.classList.toggle("lay-col", L === "col"); }
    const b = d.win.querySelector(".h3fp-lay");
    if (b) { b.textContent = L === "row" ? "⇆" : L === "col" ? "⇅" : "▤"; b.title = (L === "row" ? "Side by side" : L === "col" ? "Stacked" : "Tabs") + " - click: " + (L === "row" ? "stacked (vertical)" : "side by side (horizontal)"); }
  }
  function setLayout(id, L) {
    const d = R[id]; if (!d || d.kind !== "docker" || !LAYOUTS.includes(L)) return;
    d.layout = L; paintTabs(d); save();
    if (root.H3TestEvent) { try { root.H3TestEvent("docker_layout", L); } catch (e) { /* the 🧪 list */ } }
  }
  function splitter(d, s, a, b) {
    s.onpointerdown = (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const ax = d.layout === "row", ra = a.win.getBoundingClientRect(), rb = b.win.getBoundingClientRect();
      const sa = ax ? ra.width : ra.height, sb = ax ? rb.width : rb.height, ga = a.grow > 0 ? a.grow : 1, gb = b.grow > 0 ? b.grow : 1, v0 = ax ? e.clientX : e.clientY;
      const mv = (m) => {
        const dv = (ax ? m.clientX : m.clientY) - v0, na = Math.max(60, sa + dv), nb = Math.max(60, sb - dv), tot = ga + gb;
        a.grow = Math.round((tot * na) / (na + nb) * 1000) / 1000; b.grow = Math.round((tot - a.grow) * 1000) / 1000;
        a.win.style.setProperty("--g", String(a.grow)); b.win.style.setProperty("--g", String(b.grow));
      };
      const up = () => { root.removeEventListener("pointermove", mv, true); root.removeEventListener("pointerup", up, true); save(); };
      root.addEventListener("pointermove", mv, true); root.addEventListener("pointerup", up, true);
    };
  }
  function editTitle(id) {
    const r = R[id]; if (!r || !r.win) return;
    const n = r.win.querySelector(".h3fp-n"); if (n.querySelector("input")) return;
    const inp = root.document.createElement("input"); inp.type = "text"; inp.value = r.title; inp.maxLength = 40; inp.setAttribute("aria-label", "The docker's name");
    n.textContent = ""; n.appendChild(inp); inp.focus(); inp.select();
    let done = false;
    const end = (keep) => { if (done) return; done = true; const v = inp.value.trim(); n.textContent = r.title; if (keep && v && v !== r.title) rename(id, v); };
    inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); end(true); } else if (e.key === "Escape") { e.preventDefault(); end(false); } };
    inp.onblur = () => end(true);
    inp.onpointerdown = (e) => e.stopPropagation();
  }

  /* ---- named dockers */
  function newDocker(o) {
    o = o || {};
    let id = o.id || "fd-" + slug(o.name) ; let k = 2; while (!o.id && R[id]) id = "fd-" + slug(o.name) + "-" + k++;
    const lay = (LAY.dockers || {})[id];
    const r = R[id] = { id, kind: "docker", title: String(o.name || "Docker").slice(0, 40), confineId: o.confine || "", tabs: [], active: null, state: "float",
                        layout: LAYOUTS.includes(o.layout) ? o.layout : lay && LAYOUTS.includes(lay.layout) ? lay.layout : "tabs" };   // 2.545.0
    makeWin(r);
    float(id, lay ? { x: lay.x, y: lay.y, w: lay.w, h: lay.h } : null);
    if (lay && lay.shown === false) r.win.classList.add("off");
    if (lay && lay.docker && R[lay.docker]) dockInto(id, lay.docker);
    if (lay && Array.isArray(lay.tabs)) for (const t of lay.tabs) if (R[t] && !(R[t].docker === id)) dockInto(t, id);   // members registered before it
    if (lay && lay.active && R[lay.active]) { r.active = lay.active; paintTabs(r); }
    save();
    return r;
  }
  function show(id, on) { const r = R[id]; if (!r || !r.win) return; if (on && r.state !== "in") { r.win.classList.remove("off"); keepRect(r); } else if (!on) r.win.classList.add("off"); save(); }
  /** the app's own text box (askText, index.html) - centred like every dialog; the browser's prompt without it */
  function ask(title, label, value) {
    if (typeof root.askText === "function") return Promise.resolve(root.askText(title, label, value));
    return Promise.resolve(root.prompt(label, value));
  }
  function rename(id, name) {
    const r = R[id]; if (!r) return Promise.resolve();
    if (name == null) return ask("Rename the docker", "Name:", r.title).then((n) => (n == null || !String(n).trim() ? null : rename(id, n)));
    const n = name;
    if (!String(n).trim()) return Promise.resolve();
    r.title = String(n).trim().slice(0, 40); r.win.querySelector(".h3fp-n").textContent = r.title; r.win.setAttribute("aria-label", r.title);
    if (r.docker && R[r.docker]) paintTabs(R[r.docker]);
    save();
    return Promise.resolve(r.title);
  }
  function confineTo(id, hostId) {
    const r = R[id]; if (!r) return;
    if (hostId && (hostId === id || (R[hostId] && !canDock(id, hostId, (k) => (R[k] ? R[k].docker || R[k].confineId || null : null))))) return;
    r.confineId = hostId || "";
    if (r.state === "float") float(id, { x: r.x, y: r.y, w: r.w, h: r.h });
    save();
  }
  function remove(id) {
    const r = R[id]; if (!r || r.kind !== "docker") return;
    for (const t of (r.tabs || []).slice()) { const m = R[t]; if (m && m.home) home(t); else float(t, { x: (r.x || 80) + 20, y: (r.y || 80) + 20 }); }
    if (r.docker) undock(r);
    r.win.remove(); delete R[id];
    for (const o of Object.values(R)) if (o.confineId === id) confineTo(o.id, "");
    save();
  }
  function cfgMenu(id, x, y) {
    root.document.querySelectorAll(".h3fp-menu").forEach((m) => m.remove());
    const r = R[id], m = root.document.createElement("div"); m.className = "h3fp-menu";
    const L = r.layout || "tabs";
    const items = [["Rename…", () => rename(id)], ["-"], ["h", "Layout:"], ["Tabs", () => setLayout(id, "tabs"), L === "tabs"], ["Horizontal (side by side)", () => setLayout(id, "row"), L === "row"], ["Vertical (stacked)", () => setLayout(id, "col"), L === "col"],   // 2.545.0
      ["-"], ["h", "Where it floats:"], [(r.confineId ? "" : "✓") + "Main docker (anywhere in the app)", () => confineTo(id, ""), !r.confineId]]
      .concat(hosts().filter((h) => h.id !== id).map((h) => ["Confined to " + h.name, () => confineTo(id, h.id), r.confineId === h.id]))
      .concat([["-"], ["Delete this docker", () => remove(id)]]);
    m.innerHTML = items.map((it, i) => (it[0] === "-" ? "<hr>" : it[0] === "h" ? `<div class="h">${esc(it[1])}</div>` : `<div data-i="${i}"${it[2] ? ' class="on"' : ""}>${esc(String(it[0]).replace(/^✓/, ""))}</div>`)).join("");
    (r.win.parentNode || root.document.body).appendChild(m);
    m.style.left = Math.min(x, root.innerWidth - 220) + "px"; m.style.top = Math.min(y, root.innerHeight - 30 * items.length) + "px";
    m.onclick = (e) => { const d = e.target.closest("[data-i]"); if (!d) return; m.remove(); items[+d.dataset.i][1](); };
    setTimeout(() => root.addEventListener("pointerdown", function off(e) { if (!m.contains(e.target)) { m.remove(); root.removeEventListener("pointerdown", off, true); } }, true), 0);
    return m;
  }

  /* ---- panels */
  function adopt(o) {
    if (!o || !o.id || !o.el) return null;
    if (R[o.id]) { R[o.id].el = o.el; return R[o.id]; }
    const r = R[o.id] = { id: o.id, kind: "panel", title: o.title || o.id, el: o.el, home: o.home || null, scope: o.scope || null, confine: o.confine || null, onState: o.onState || null, onClose: o.onClose || null, state: "home" };
    r.ready = load().then(() => {                       // where it was left (the file may still be loading)
      const lay = (LAY.panels || {})[o.id];
      if (lay && lay.grow > 0) r.grow = lay.grow;                       // 2.545.0
      if (lay && lay.state === "float") float(o.id, { x: lay.x, y: lay.y, w: lay.w, h: lay.h });
      else if (lay && lay.state === "in" && R[lay.docker]) {
        // 2.545.0: back in its place among the ones already there (they register in any order)
        const want0 = (LAY.dockers[lay.docker] || {}).tabs || [], i0 = want0.indexOf(o.id), there = R[lay.docker].tabs || [];
        const at = i0 < 0 ? undefined : there.filter((t) => { const j = want0.indexOf(t); return j >= 0 && j < i0; }).length;
        Object.assign(r, { x: lay.x, y: lay.y, w: lay.w, h: lay.h }); dockInto(o.id, lay.docker, at);
        const want = (LAY.dockers[lay.docker] || {}).active; if (want && R[want] && R[want].docker === lay.docker) { R[lay.docker].active = want; paintTabs(R[lay.docker]); }
      }
      return r;
    });
    return r;
  }

  /* ---- kept in panel_layout.cfg */
  function snapshot() {
    const o = { panels: {}, dockers: {} };
    for (const r of Object.values(R)) {
      const s = { state: r.state, docker: r.docker || null, x: r.x, y: r.y, w: r.w, h: r.h };
      if (r.grow > 0 && r.grow !== 1) s.grow = r.grow;                 // 2.545.0: its share of a row / column
      if (r.kind === "panel") o.panels[r.id] = s;
      else o.dockers[r.id] = Object.assign(s, { name: r.title, layout: r.layout || "tabs", confine: r.confineId || "", tabs: r.tabs || [], active: r.active || null, shown: !!r.win && !r.win.classList.contains("off") });
    }
    // panels / dockers not on this page (another docker not loaded): keep what the file has
    for (const k of Object.keys(LAY.panels || {})) if (!o.panels[k]) o.panels[k] = LAY.panels[k];
    return o;
  }
  function save() {
    if (!loaded) return;
    clearTimeout(saveT);
    // 2.545.0: one after another - two in flight could land out of order (the older layout last in the file)
    saveT = setTimeout(() => { LAY = snapshot(); const body = JSON.stringify({ all: LAY }); saving = saving.then(() => root.fetch("/api/layout/panel", { method: "POST", headers: { "Content-Type": "application/json" }, body }).catch(() => {})); }, 300);
  }
  let saving = Promise.resolve();
  let readyP = null;
  function load() {
    if (readyP) return readyP;
    readyP = root.fetch("/api/layout/panel").then((r) => r.json()).catch(() => ({})).then((o) => {
      LAY = { panels: (o && o.panels) || {}, dockers: (o && o.dockers) || {} };
      // the named dockers: the ones confined to another named docker after it
      const ids = Object.keys(LAY.dockers).sort((a, b) => (LAY.dockers[a].confine && LAY.dockers[a].confine.startsWith("fd-") ? 1 : 0) - (LAY.dockers[b].confine && LAY.dockers[b].confine.startsWith("fd-") ? 1 : 0));
      for (const id of ids) { const d = LAY.dockers[id]; if (!R[id]) newDocker({ id, name: d.name, confine: d.confine, layout: d.layout }); }
      loaded = true;
      return LAY;
    });
    return readyP;
  }
  // a docker or the window resized: everything floating stays inside where it floats; hidden with its docker
  let down = false;
  function relayout() {
    if (down) return;                                   // not in the middle of a drag / a resize
    for (const r of Object.values(R)) {
      if (r.state !== "float" || !r.win || r.win.classList.contains("off")) continue;
      r.win.style.visibility = visibleHost(r) ? "" : "hidden";
      const b = r.win.getBoundingClientRect(); if (!b.width) continue;
      const f = fit({ x: b.left, y: b.top, w: b.width, h: b.height }, bounds(r));
      if (Math.abs(f.x - b.left) > 1 || Math.abs(f.y - b.top) > 1 || Math.abs(f.w - b.width) > 1 || Math.abs(f.h - b.height) > 1) { Object.assign(r, f); setRect(r); }
    }
  }
  function start() {
    load(); root.addEventListener("resize", relayout); setInterval(relayout, 1500);
    root.addEventListener("pointerdown", () => { down = true; }, true); root.addEventListener("pointerup", () => { down = false; }, true);
  }

  const H3Panels = { slotIn, LAYOUTS, setLayout, editTitle, slotOf: (id, x, y) => slotOf(R[id], x, y), ask, fit, hitDocker, canDock, slug, columnZones, zoneHost, zoneAt, placeAt, adopt, float, home, dockInto, newDocker, show, rename, confineTo, remove, hosts, load, relayout, cfgMenu,
    get: (id) => R[id], list: () => Object.values(R).map((r) => ({ id: r.id, kind: r.kind, title: r.title, state: r.state, docker: r.docker || null, confine: r.confineId || "", tabs: (r.tabs || []).slice() })), snapshot };
  if (typeof module !== "undefined" && module.exports) module.exports = H3Panels;
  else { root.H3Panels = H3Panels; if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", start); else start(); }
})(typeof window !== "undefined" ? window : globalThis);
