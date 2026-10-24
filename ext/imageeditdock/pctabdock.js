/* pctabdock.js — EVERY TAB OF THE IMAGE EDITOR IS A DOCKER (2.590.0), window.PCTabDock.
 *
 * Tim (verbatim): "make all the tabs in image-editor into floating dockers but allow dockers to be placed on another
 * docker inside the main docker panel in image-editor when a docker is dropped on another docker make it a tabbed docker"
 *
 *   DRAG A TAB (Layers, Color, ✨ AI, 🎮 Unreal, 🖌 Brush … any tab of any panel group) by its name:
 *     - onto another docker (its tabs or its content - in the panel column or floating)  -> it becomes a TAB of that
 *       docker (the docker lights up orange)
 *     - onto the panel column, at the top / bottom edge of a docker or below the last  -> a docker of its own in the column
 *       there (an orange line shows where)
 *     - anywhere else in the editor  -> a FLOATING docker of its own: drag it by the empty part of its tab strip (or ⠿),
 *       size it by its corner, ⇲ puts it in the panel column, ✕ hides it (Window ▸ Show All Dockers)
 *   DRAG A WHOLE DOCKER by its ⠿ (the start of its tab strip): onto another docker = all its tabs join it; onto the
 *     column = moved there; elsewhere = floats.
 *   A click on a tab still just opens it. A docker whose last tab was dragged away goes (the panel groups the editor
 *   starts with are only hidden, so Window ▸ Reset Docker Tabs can put every tab back where it started).
 *   KEPT: where every tab is, the floating dockers' places and sizes (the editor's store: pc.td).
 * Pure (Node: scripts/test-tabdock590.js): dropTarget, colZone, layoutOf, restorePlan, clampRect.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const inside = (r, x, y) => !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  /** a column zone for (x, y): parts [{g, rect}] top to bottom in the column rect col; edge = the share of a part's height
   *  at its top / bottom that means "a docker of its own above / below" -> {index, line} | null */
  function colZone(parts, col, x, y, edge) {
    if (!inside(col, x, y)) return null;
    const e = edge == null ? 0.22 : edge;
    for (let i = 0; i < parts.length; i++) {
      const r = parts[i].rect, h = r.bottom - r.top;
      if (y < r.top) return { index: i, line: { x: col.left, y: r.top - 2, w: col.right - col.left } };
      if (y <= r.bottom) {
        if (y < r.top + h * e) return { index: i, line: { x: col.left, y: r.top - 2, w: col.right - col.left } };
        if (y > r.bottom - h * e) return { index: i + 1, line: { x: col.left, y: r.bottom - 2, w: col.right - col.left } };
        return null;                                       // the middle of a docker = into it
      }
    }
    const last = parts.length ? parts[parts.length - 1].rect.bottom : col.top;
    return { index: parts.length, line: { x: col.left, y: last, w: col.right - col.left } };
  }
  /** where a drag at (x, y) drops: groups [{g, rect, col (in the column)}], col = the column's rect (or null when it is
   *  hidden), kx = the editor's rect, src = the group dragged from (a tab's own group cannot take it again)
   *  -> {kind: "into", g} | {kind: "col", index, line} | {kind: "float"} | null (outside the editor) */
  function dropTarget(x, y, groups, col, kx, src, wholeGroup) {
    if (!inside(kx, x, y)) return null;
    const colParts = (groups || []).filter((p) => p.col);
    if (col && inside(col, x, y)) {
      const z = colZone(colParts, col, x, y);
      if (z) return { kind: "col", index: z.index, line: z.line };
    }
    // floating ones first (they are on top), then the column's
    const order = (groups || []).filter((p) => !p.col).concat(colParts);
    for (const p of order) {
      if (!inside(p.rect, x, y)) continue;
      if (p.g === src) return wholeGroup ? null : { kind: "same", g: p.g };
      return { kind: "into", g: p.g };
    }
    return { kind: "float" };
  }
  /** the layout to keep: groups [{g, where, tabs, active, rect, shown}] -> a plain object */
  function layoutOf(groups, colOrder) { return { v: 1, groups: (groups || []).map((x) => ({ g: x.g, where: x.where, tabs: x.tabs.slice(), active: x.active || x.tabs[0] || "", rect: x.rect || null, shown: x.shown !== false })), col: (colOrder || []).slice() }; }
  /** what restoring a kept layout does with the tabs there are now (have: {tabId: group now}), known groups (orig) ->
   *  {make: [g] (new dockers to make), moves: [[tab, g]], col: [g]} - a tab that is not there any more is left out */
  function restorePlan(kept, have, orig) {
    const out = { make: [], moves: [], col: [] };
    if (!kept || kept.v !== 1 || !Array.isArray(kept.groups)) return out;
    const seen = new Set();
    for (const x of kept.groups) {
      const tabs = (x.tabs || []).filter((t) => have[t] && !seen.has(t));
      if (!tabs.length) continue;
      if (!(orig || []).includes(x.g)) out.make.push(x.g);
      for (const t of tabs) { seen.add(t); if (have[t] !== x.g) out.moves.push([t, x.g]); }
    }
    const made = new Set(out.make.concat(orig || []));
    out.col = (kept.col || []).filter((g) => made.has(g));
    return out;
  }
  /** a floating docker's rect inside the editor (W x H), at least min */
  function clampRect(r, W, H) {
    const w = Math.max(200, Math.min(W, Math.round(r.w || 300))), h = Math.max(120, Math.min(H, Math.round(r.h || 320)));
    return { x: Math.max(0, Math.min(W - w, Math.round(r.x || 0))), y: Math.max(0, Math.min(H - h, Math.round(r.y || 0))), w, h };
  }

  /* ================================ the editor ================================ */
  function install(E) {
    const { kx, doc, win, store } = E;
    const say = E.say || (() => {});
    if (!kx || !doc || !E.ui || !E.ui.showTab) return;
    const col = doc.getElementById("pcPanels");
    const ORIG = [...kx.querySelectorAll(".pcgrp[data-g]")].map((x) => x.dataset.g);
    const tev = (k, v) => { if (root.H3TestEvent) { try { root.H3TestEvent(k, v); } catch (e) { /* the 🧪 list */ } } };
    if (!doc.getElementById("pcTdCss")) {
      const st = doc.createElement("style"); st.id = "pcTdCss";
      st.textContent = `.pctabs .pctdgrip{flex:none;cursor:grab;padding:2px 4px 2px 6px;color:var(--pc-dim);font-size:11px;line-height:20px;user-select:none}.pctabs .pctdgrip:hover{color:var(--pc-text)}
.pctabs button[data-tab]{cursor:pointer}.pctabs button[data-tab].pctdsrc{opacity:.45}
.pctdw{position:absolute;z-index:62;display:flex;flex-direction:column;background:var(--pc-panel,#323232);border:1px solid var(--pc-sep,#555);border-radius:6px;box-shadow:0 8px 26px rgba(0,0,0,.5);resize:both;overflow:hidden;min-width:200px;min-height:120px}
.pctdw.off{display:none}.pctdw>.pcgrp{flex:1 1 auto;min-height:0;border:0;border-radius:6px}.pctdw>.pcgrp>.pctabs{cursor:move;border-radius:6px 6px 0 0}
.pctdw>.pcgrp>.pcbody.on{flex:1 1 auto;overflow:auto}.pctabs .pctdbtn{flex:none;padding:2px 6px;cursor:pointer;color:var(--pc-dim);font-size:12px;line-height:20px;user-select:none}.pctabs .pctdbtn:hover{color:var(--pc-text)}
.pctabs .pctdend{margin-left:auto}.pcgrp.pctdhot{outline:2px solid var(--pc-accent,#f59e2c);outline-offset:-2px}
.pctdghost{position:fixed;z-index:2147483100;pointer-events:none;padding:3px 9px;border-radius:5px;background:var(--pc-accent,#2680eb);color:#fff;font:600 11px system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.5)}
.pctdline{position:fixed;z-index:2147483099;pointer-events:none;height:4px;border-radius:2px;background:var(--pc-accent,#f59e2c)}
#pcPanels>.pcgrp.pctdnew{flex:1 1 auto}`;
      doc.head.appendChild(st);
    }
    if (win.getComputedStyle && win.getComputedStyle(kx).position === "static") kx.style.position = "relative";
    let uid = +store.get("pc.td.uid", 0) || 0;
    const W = new Map();                                   // g -> its floating window (my floating dockers)
    const moved = [];                                      // onMoved(fn): a floating docker was dragged by hand

    const groupOf = (g) => kx.querySelector(`.pcgrp[data-g="${g}"]`);
    const tabBtn = (id) => kx.querySelector(`.pctabs button[data-tab="${id}"]`);
    const bodyOf = (id) => kx.querySelector(`.pcbody[data-body="${id}"]`);
    const tabsOf = (grp) => [...grp.querySelectorAll(":scope > .pctabs > button[data-tab]")];
    const labelOf = (id) => { const b = tabBtn(id); return b ? b.textContent.trim() : id; };
    const shown = (grp) => !!grp && !grp.classList.contains("off") && !(grp.parentElement && grp.parentElement.classList.contains("pctdw") && grp.parentElement.classList.contains("off"));

    /* ---- every strip gets a ⠿ grip (drag the whole docker) */
    function decorate(grp) {
      const tabs = grp.querySelector(":scope > .pctabs"); if (!tabs || tabs.querySelector(":scope > .pctdgrip")) return;
      const gr = doc.createElement("span"); gr.className = "pctdgrip"; gr.textContent = "⠿"; gr.dataset.tdgrip = grp.dataset.g;
      gr.title = "Drag this docker: onto another docker = its tabs join it · onto the panel column = docked there · elsewhere = it floats. Drag a tab by its name to move just that tab.";
      tabs.insertBefore(gr, tabs.firstChild);
    }
    function endButtons(grp) {
      const tabs = grp.querySelector(":scope > .pctabs"); if (!tabs) return;
      tabs.querySelectorAll(":scope > .pctdbtn").forEach((x) => x.remove());
      if (ORIG.includes(grp.dataset.g) && !W.has(grp.dataset.g)) return;   // pcpanels' ⇱ / ✕ serve the editor's own groups in the column
      const fl = W.has(grp.dataset.g);
      const a = doc.createElement("span"); a.className = "pctdbtn pctdend"; a.dataset.tdact = fl ? "dock" : "float"; a.textContent = fl ? "⇲" : "⇱";
      a.title = fl ? "Put this docker in the panel column" : "Float this docker";
      const x = doc.createElement("span"); x.className = "pctdbtn"; x.dataset.tdact = "hide"; x.textContent = "✕"; x.title = "Hide this docker (Window ▸ Show All Dockers brings it back)";
      tabs.querySelectorAll(":scope > .pcfloat,:scope > .pcx").forEach((s) => { s.style.display = fl ? "none" : ""; });
      tabs.appendChild(a); tabs.appendChild(x);
    }
    function newGroup(g) {
      const grp = doc.createElement("div"); grp.className = "pcgrp pctdnew"; grp.dataset.g = g;
      grp.innerHTML = '<div class="pctabs"></div>';
      decorate(grp);
      return grp;
    }
    const nextG = () => { uid++; store.set("pc.td.uid", uid); return "td" + uid; };

    /* ---- floating windows */
    function floatGroup(grp, rect) {
      const g = grp.dataset.g;
      let w = W.get(g);
      if (!w) { w = doc.createElement("div"); w.className = "pctdw"; w.dataset.tdwin = g; kx.appendChild(w); W.set(g, w); wireWin(w, g); }
      w.appendChild(grp); grp.classList.remove("off", "pccol");
      const r = clampRect(rect || { x: (kx.clientWidth || 900) - 340, y: 70, w: 300, h: 360 }, kx.clientWidth || 900, kx.clientHeight || 600);
      Object.assign(w.style, { left: r.x + "px", top: r.y + "px", width: r.w + "px", height: r.h + "px" });
      w.classList.remove("off");
      endButtons(grp);
      return w;
    }
    function wireWin(w, g) {
      w.addEventListener("pointerdown", (e) => {
        const strip = e.target.closest(".pctabs"); if (!strip || strip.parentElement.parentElement !== w) return;
        if (e.target.closest("button,[data-tdact],.pctdgrip,.pccaret,.pcfloat,.pcx")) return;
        e.preventDefault();
        const sx = e.clientX, sy = e.clientY, x0 = w.offsetLeft, y0 = w.offsetTop;
        const mv = (m) => { const r = clampRect({ x: x0 + m.clientX - sx, y: y0 + m.clientY - sy, w: w.offsetWidth, h: w.offsetHeight }, kx.clientWidth, kx.clientHeight); w.style.left = r.x + "px"; w.style.top = r.y + "px"; };
        const up = () => { win.removeEventListener("pointermove", mv); win.removeEventListener("pointerup", up); save(); moved.forEach((f) => { try { f(g); } catch (er) { /* theirs */ } }); };
        win.addEventListener("pointermove", mv); win.addEventListener("pointerup", up);
      });
      if (typeof win.ResizeObserver === "function") { let t = 0; new win.ResizeObserver(() => { clearTimeout(t); t = win.setTimeout(save, 400); }).observe(w); }
    }
    function unfloat(g) { const w = W.get(g); if (!w) return; W.delete(g); w.remove(); }

    /* ---- moving tabs and dockers */
    function cleanup(grp) {
      if (!grp || tabsOf(grp).length) return;
      const g = grp.dataset.g;
      if (ORIG.includes(g)) { if (W.has(g) && col) { col.appendChild(grp); unfloat(g); } grp.classList.add("off"); grp.dataset.tdempty = "1"; }
      else { unfloat(g); grp.remove(); }
    }
    let quiet = false;                                     // restoring: tabs are set active without showTab's side effects
    function activate(grp, id) {
      grp.querySelectorAll(":scope > .pctabs > button[data-tab]").forEach((x) => x.classList.toggle("on", x.dataset.tab === id));
      grp.querySelectorAll(":scope > .pcbody").forEach((x) => x.classList.toggle("on", x.dataset.body === id));
    }
    function moveTab(id, grp) {
      const b = tabBtn(id), body = bodyOf(id); if (!b || !grp) return false;
      const from = b.closest(".pcgrp"); if (from === grp) return false;
      const strip = grp.querySelector(":scope > .pctabs");
      const last = tabsOf(grp).pop();
      if (last) last.after(b); else { const gr = strip.querySelector(":scope > .pctdgrip"); if (gr) gr.after(b); else strip.insertBefore(b, strip.firstChild); }
      if (body) grp.appendChild(body);
      grp.classList.remove("off"); delete grp.dataset.tdempty;
      if (from) { const rest = tabsOf(from); if (rest.length && !rest.some((x) => x.classList.contains("on"))) activate(from, rest[0].dataset.tab); cleanup(from); }
      if (quiet) activate(grp, id); else E.ui.showTab(id);
      return true;
    }
    function moveGroupInto(src, dst) { for (const b of tabsOf(src)) moveTab(b.dataset.tab, dst); }
    function placeInCol(grp, index) {
      if (!col) return;
      const parts = [...col.querySelectorAll(":scope > .pcgrp")].filter((x) => shown(x) && x !== grp);
      const ref = parts[index] || null;
      if (ref) col.insertBefore(grp, ref); else col.appendChild(grp);
      unfloat(grp.dataset.g); grp.classList.remove("off"); delete grp.dataset.tdempty;
      kx.classList.remove("side-off");
      endButtons(grp);
    }

    /* ---- the drag */
    let drag = null, ghost = null, line = null, hot = null, suppressClick = false;
    function groupsNow() {
      return [...kx.querySelectorAll(".pcgrp[data-g]")].filter((x) => shown(x) && x.offsetParent !== null)
        .map((x) => ({ g: x.dataset.g, rect: x.getBoundingClientRect(), col: !!col && x.parentElement === col }));
    }
    function paintDrop(t) {
      if (hot) { hot.classList.remove("pctdhot"); hot = null; }
      if (line) line.style.display = "none";
      if (!t) return;
      if (t.kind === "into") { hot = groupOf(t.g); if (hot) hot.classList.add("pctdhot"); }
      if (t.kind === "col") { if (!line) { line = doc.createElement("div"); line.className = "pctdline"; doc.body.appendChild(line); } Object.assign(line.style, { display: "block", left: t.line.x + "px", top: t.line.y + "px", width: t.line.w + "px" }); }
    }
    function onDown(e) {
      if (e.button !== 0) return;
      const grip = e.target.closest(".pctdgrip"), b = !grip && e.target.closest(".pctabs > button[data-tab]");
      if (!grip && !b) return;
      if (!kx.contains(e.target)) return;
      const grp = (grip || b).closest(".pcgrp"); if (!grp) return;
      drag = { tab: b ? b.dataset.tab : null, g: grp.dataset.g, sx: e.clientX, sy: e.clientY, on: false };
      win.addEventListener("pointermove", onMove, true); win.addEventListener("pointerup", onUp, true);
      if (grip) e.preventDefault();
    }
    function onMove(e) {
      if (!drag) return;
      if (!drag.on) {
        if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 7) return;
        drag.on = true;
        ghost = doc.createElement("div"); ghost.className = "pctdghost";
        ghost.textContent = drag.tab ? labelOf(drag.tab) : "⠿ " + tabsOf(groupOf(drag.g)).map((x) => x.textContent.trim()).join(" · ");
        doc.body.appendChild(ghost);
        if (drag.tab) { const b = tabBtn(drag.tab); if (b) b.classList.add("pctdsrc"); }
      }
      e.preventDefault();
      ghost.style.left = (e.clientX + 12) + "px"; ghost.style.top = (e.clientY + 8) + "px";
      const c = col && !kx.classList.contains("side-off") && col.offsetParent !== null ? col.getBoundingClientRect() : null;
      drag.t = dropTarget(e.clientX, e.clientY, groupsNow(), c, kx.getBoundingClientRect(), drag.g, !drag.tab);
      paintDrop(drag.t);
    }
    function onUp(e) {
      win.removeEventListener("pointermove", onMove, true); win.removeEventListener("pointerup", onUp, true);
      const d = drag; drag = null;
      if (ghost) { ghost.remove(); ghost = null; }
      paintDrop(null);
      kx.querySelectorAll(".pctdsrc").forEach((x) => x.classList.remove("pctdsrc"));
      if (!d || !d.on) return;
      suppressClick = true; win.setTimeout(() => { suppressClick = false; }, 0);
      drop(d, d.t, e.clientX, e.clientY);
    }
    function drop(d, t, x, y) {
      if (!t || t.kind === "same") return;
      const src = groupOf(d.g); if (!src) return;
      const kr = kx.getBoundingClientRect();
      const at = { x: x - kr.left - 40, y: y - kr.top - 12, w: Math.max(260, src.offsetWidth || 300), h: Math.max(220, Math.min(480, src.offsetHeight || 360)) };
      if (d.tab) {
        if (t.kind === "into") { moveTab(d.tab, groupOf(t.g)); say(`${labelOf(d.tab)} is a tab of that docker now`); }
        else {
          if (tabsOf(src).length === 1 && t.kind === "float" && W.has(d.g)) { const w = W.get(d.g); w.style.left = Math.max(0, at.x) + "px"; w.style.top = Math.max(0, at.y) + "px"; save(); return; }
          const ng = newGroup(nextG());
          if (t.kind === "col") { (col || kx).appendChild(ng); moveTab(d.tab, ng); placeInCol(ng, t.index); say(`${labelOf(d.tab)} is a docker of its own in the panel column`); }
          else { kx.appendChild(ng); moveTab(d.tab, ng); floatGroup(ng, at); say(`${labelOf(d.tab)} floats - drag it onto another docker to make it a tab there`); }
        }
      } else {
        if (t.kind === "into") { moveGroupInto(src, groupOf(t.g)); say("its tabs joined that docker"); }
        else if (t.kind === "col") placeInCol(src, t.index);
        else floatGroup(src, at);
      }
      endButtons(src.isConnected ? src : groupOf(t.g) || src);
      save(); tev("ie_tabdock", (d.tab || "⠿" + d.g) + "->" + t.kind + (t.g ? ":" + t.g : ""));
    }
    kx.addEventListener("pointerdown", onDown, true);
    kx.addEventListener("click", (e) => { if (suppressClick && e.target.closest(".pctabs")) { e.preventDefault(); e.stopPropagation(); } }, true);
    kx.addEventListener("click", (e) => {
      const a = e.target.closest("[data-tdact]"); if (!a) return;
      const grp = a.closest(".pcgrp"); if (!grp) return; e.stopPropagation();
      if (a.dataset.tdact === "dock") placeInCol(grp, Infinity);
      else if (a.dataset.tdact === "float") { const r = grp.getBoundingClientRect(), kr = kx.getBoundingClientRect(); floatGroup(grp, { x: r.left - kr.left - 320, y: r.top - kr.top, w: 300, h: Math.max(220, r.height) }); }
      else if (a.dataset.tdact === "hide") { const w = W.get(grp.dataset.g); if (w) w.classList.add("off"); else grp.classList.add("off"); }
      endButtons(grp); save();
    });

    /* ---- kept */
    function snapshot() {
      const gs = [...kx.querySelectorAll(".pcgrp[data-g]")].filter((x) => tabsOf(x).length).map((x) => {
        const g = x.dataset.g, w = W.get(g), on = tabsOf(x).find((b) => b.classList.contains("on"));
        return { g, where: w ? "float" : col && x.parentElement === col ? "col" : "other", tabs: tabsOf(x).map((b) => b.dataset.tab), active: on ? on.dataset.tab : "",
          rect: w ? { x: w.offsetLeft, y: w.offsetTop, w: w.offsetWidth, h: w.offsetHeight } : null, shown: w ? !w.classList.contains("off") : !x.classList.contains("off") };
      });
      return layoutOf(gs, col ? [...col.querySelectorAll(":scope > .pcgrp[data-g]")].map((x) => x.dataset.g) : []);
    }
    let saving = 0;
    function save() { clearTimeout(saving); saving = win.setTimeout(() => store.set("pc.td", snapshot()), 50); }
    function restore(kept) {
      const have = {};
      kx.querySelectorAll(".pctabs > button[data-tab]").forEach((b) => { const g = b.closest(".pcgrp"); if (g) have[b.dataset.tab] = g.dataset.g; });
      const plan = restorePlan(kept, have, ORIG);
      quiet = true;
      try {
        for (const g of plan.make) { if (!groupOf(g)) (col || kx).appendChild(newGroup(g)); }
        for (const [t, g] of plan.moves) moveTab(t, groupOf(g));
        for (const x of (kept && kept.groups) || []) {
          const grp = groupOf(x.g); if (!grp || !tabsOf(grp).length) continue;
          if (x.where === "float") { const w = floatGroup(grp, x.rect); if (x.shown === false) w.classList.add("off"); }
          if (x.active && tabsOf(grp).some((b) => b.dataset.tab === x.active)) activate(grp, x.active);
        }
        // the column: only the dockers made here are placed (after the one they followed) - the editor's own groups keep
        // the order the panel column keeps (pcpanels.js)
        if (col) plan.col.forEach((g, i) => {
          if (ORIG.includes(g)) return;
          const grp = groupOf(g); if (!grp || W.has(g)) return;
          let ref = null; for (let k = i - 1; k >= 0 && !ref; k--) { const r = groupOf(plan.col[k]); if (r && r.parentElement === col && r !== grp) ref = r; }
          if (ref) ref.after(grp); else col.insertBefore(grp, col.firstChild);
          endButtons(grp);
        });
      } finally { quiet = false; }
    }
    function reset() {
      for (const b of [...kx.querySelectorAll(".pctabs > button[data-tab]")]) { const home = b.dataset.grp && ORIG.includes(b.dataset.grp) ? groupOf(b.dataset.grp) : null; if (home) moveTab(b.dataset.tab, home); }
      for (const g of [...W.keys()]) { const grp = groupOf(g); if (grp && ORIG.includes(g) && col) { col.appendChild(grp); unfloat(g); endButtons(grp); } }
      ORIG.forEach((g) => { const grp = groupOf(g); if (grp && tabsOf(grp).length) { grp.classList.remove("off"); delete grp.dataset.tdempty; } });
      // a tab that starts FLOATING (data-tdhome="float" - the 📺 Unreal View) floats again, hidden until it is wanted
      for (const b of [...kx.querySelectorAll('.pctabs > button[data-tab][data-tdhome="float"]')]) { const g = floatTab(b.dataset.tab, null); if (g) hideOf(b.dataset.tab); }
      store.set("pc.td", null); say("every tab is back in the docker it started in");
    }
    function showAll() {
      for (const [, w] of W) w.classList.remove("off");
      kx.querySelectorAll(".pcgrp[data-g]").forEach((x) => { if (tabsOf(x).length) x.classList.remove("off"); });
      kx.classList.remove("side-off"); save();
    }
    /** a tab on screen: its docker shown (a hidden floating one too), the tab opened */
    function reveal(id) { const b = tabBtn(id); if (!b) return false; const grp = b.closest(".pcgrp"); const w = W.get(grp.dataset.g); if (w) w.classList.remove("off"); grp.classList.remove("off"); E.ui.showTab(id); return true; }
    function hideOf(id) { const b = tabBtn(id); if (!b) return; const grp = b.closest(".pcgrp"), w = W.get(grp.dataset.g); if (w) w.classList.add("off"); }
    function floatTab(id, rect) { const b = tabBtn(id); if (!b) return null; const src = b.closest(".pcgrp"); if (src && tabsOf(src).length === 1 && W.has(src.dataset.g)) return src.dataset.g; const ng = newGroup(nextG()); kx.appendChild(ng); moveTab(id, ng); floatGroup(ng, rect); save(); return ng.dataset.g; }

    kx.querySelectorAll(".pcgrp[data-g]").forEach((g) => decorate(g));
    restore(store.get("pc.td", null));
    // a group made later (another module's docker) gets its grip too
    if (typeof win.MutationObserver === "function") new win.MutationObserver(() => kx.querySelectorAll(".pcgrp[data-g]").forEach((g) => decorate(g))).observe(kx, { childList: true, subtree: true });
    if (E.ui.addCmd) {
      E.ui.addCmd("win.tdshowall", "Show All Dockers", "", showAll, {}, ["Window", null]);
      E.ui.addCmd("win.tdreset", "Reset Docker Tabs", "", reset, {}, ["Window", "win.tdshowall"]);
    }
    E.tabdock = { moveTab: (id, g) => moveTab(id, groupOf(g)), floatTab, reveal, hideOf, reset, showAll, snapshot, restore, groupOfTab: (id) => { const b = tabBtn(id); const g = b && b.closest(".pcgrp"); return g ? g.dataset.g : null; },
      floating: (g) => W.has(g), onMoved: (fn) => moved.push(fn),
      setRect: (g, r) => { const w = W.get(g); if (!w) return null; const c = clampRect(r, kx.clientWidth || 900, kx.clientHeight || 600); Object.assign(w.style, { left: c.x + "px", top: c.y + "px", width: c.w + "px", height: c.h + "px" }); save(); return c; }, tabsIn: (g) => { const x = groupOf(g); return x ? tabsOf(x).map((b) => b.dataset.tab) : []; }, drop: (d, t) => drop(d, t, 0, 0) };
  }

  const PCTabDock = { dropTarget, colZone, layoutOf, restorePlan, clampRect, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCTabDock;
  else root.PCTabDock = PCTabDock;
})(typeof window !== "undefined" ? window : globalThis);
