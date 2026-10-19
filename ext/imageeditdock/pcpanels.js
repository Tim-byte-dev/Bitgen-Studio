/* pcpanels.js — THE IMAGE EDITOR'S PANEL GROUPS AS FLOATING DOCKERS (2.438.0), window.PCPanels.
 *
 * Tim (verbatim): "in image docker make layers tab group and color tab group into floating dockers that can resize.
 * create an empty floating docker that can be named. other floating dockers will be able to dock in the new docker.
 * allow it to be like a main docker or a sub docker confined to another docker."
 *   ⇱ at the end of the Layers group's tabs (Layers / Paths / Channels / History / Actions / Comps) and of the Colour
 *   group's (Color / Swatches / Character / Paragraph) floats that group: a window of its own INSIDE the editor (its
 *   colours, its full screen), every edge sizes it, its title drags it, ⇲ (or ✕) puts it back in the right column.
 *   Window ▸ New Docker… = an empty named docker inside the editor (static/floatpanels.js) - drag a floating group by its
 *   title onto it: docked there as a tab. ⚙ on a named docker: main docker / confined to a docker / rename / delete.
 *   Where everything is: panel_layout.cfg.
 *   2.454.0 (Tim: "make the panel in the image editor a resizable docker with dropzones for the other dockers. make all
 *   the tab groups into floating dockers that can dock in another docker like the panel docker"):
 *   EVERY group floats (⇱): Colour, Corel dockers (Transform / Shaping / Align / Object), Properties (Properties /
 *   Adjustments / ✨ AI / ◈ Control) and Layers. THE PANEL COLUMN IS A DOCKER: drag a floating group by its title over
 *   it - an orange line shows where it goes (above / below each group, or at the end) - drop = docked there; the
 *   column's left edge drags its width (200 - 640 px). The order and the width are kept (store pc.order / pc.sideW).
 *   2.514.0 (Tim: "when the dockers are docked make them into dropdowns so user can hide the content of the docker but
 *   keep the titlebar. when user closes a docker close it. show dockers visibility in view->dockers->all dockers<tick
 *   mark if visible>" - "only add the image editor dockers to the view menu"): DOCKED in the column each group's tab
 *   strip starts with ▾ - click = its content folded away, the tabs kept (▸ / a tab opens it again; store
 *   pc.col.<g>); ✕ at the end of the strip (and the ✕ of its floating window) CLOSES it (store pc.closed). View ▸
 *   Dockers: All Dockers (✓ when every one is shown - click = show them all), then each docker of the editor - its
 *   panel groups and the named dockers made in it - ✓ while it is on screen, click = show / hide it.
 * Pure: GROUPS (which groups float, their titles), orderOf (the groups in a kept order).
 */
(function (root) {
  "use strict";
  const GROUPS = [["layers", "Layers"], ["color", "Colour"], ["props", "Properties"], ["dock", "Dockers"]];   // 2.454.0: + Properties, the Corel dockers
  /** the column's groups (data-g keys, as they are now) in the kept order (unknown ones keep their place at the end) */
  function orderOf(now, kept) {
    const k = (kept || []).filter((g) => now.includes(g));
    return k.concat(now.filter((g) => !k.includes(g)));
  }

  function install(E) {
    const doc = E.doc || root.document, kx = E.kx, P = root.H3Panels, say = E.say;
    if (!kx || !E.ui || !E.ui.addCmd) return;
    if (!kx.id) kx.id = "ieKx";
    kx.dataset.fpHost = "Image editor";                // a docker can be confined to the editor itself
    const col = doc.getElementById("pcPanels");
    const css = doc.createElement("style");
    css.textContent = ".pctabs .pccaret{flex:none;padding:2px 2px 2px 6px;cursor:pointer;color:var(--pc-dim);font-size:11px;line-height:20px;user-select:none}.pctabs .pccaret:hover,.pctabs .pcx:hover{color:var(--pc-text)}"
      + ".pctabs .pcx{flex:none;padding:2px 7px 2px 3px;cursor:pointer;color:var(--pc-dim);font-size:12px;line-height:20px;user-select:none}.h3fp .pcgrp .pctabs .pccaret,.h3fp .pcgrp .pctabs .pcx{display:none}"
      + "#pcPanels>.pcgrp.pccol>:not(.pctabs){display:none !important}#pcPanels>.pcgrp.pccol{flex:none !important;min-height:0 !important;height:auto !important}"
      + ".pctabs .pcfloat{margin-left:auto;flex:none;padding:2px 7px;cursor:pointer;color:var(--pc-dim);font-size:12px;line-height:20px;user-select:none}.pctabs .pcfloat:hover{color:var(--pc-text)}"
      + ".h3fp .pcgrp{flex:1 1 auto;min-height:0;border:0}.h3fp .pcgrp .pctabs .pcfloat{display:none}";
    doc.head.appendChild(css);
    const ids = [];
    // 2.454.0: the kept order of the groups in the column (before they are adopted - their homes are where they are)
    if (col) {
      const now = [...col.querySelectorAll(":scope > .pcgrp[data-g]")].map((x) => x.dataset.g), want = orderOf(now, E.store.get("pc.order", null));
      for (const g of want) { const x = col.querySelector(`:scope > .pcgrp[data-g="${g}"]`); if (x) col.appendChild(x); }
      const w = +E.store.get("pc.sideW", 0); if (w >= 200) col.style.width = Math.min(640, w) + "px";
    }
    const keepOrder = () => { if (col) E.store.set("pc.order", [...col.querySelectorAll(":scope > .pcgrp[data-g]")].map((x) => x.dataset.g)); };
    for (const [g, title] of GROUPS) {
      const grp = col && col.querySelector(`.pcgrp[data-g="${g}"]`); if (!grp || !P) continue;
      const tabs = grp.querySelector(".pctabs");
      const fl = doc.createElement("span"); fl.className = "pcfloat"; fl.setAttribute("role", "button"); fl.dataset.float = g;
      fl.title = `Float the ${title} panels (a window of their own - drag its title onto a named docker to dock it there)`; fl.textContent = "⇱";
      tabs.appendChild(fl);
      const id = "ie." + g;
      fl.onclick = () => float(g);
      // 2.514.0: ▾ folds the docked group to its tab strip, ✕ closes it
      const ca = doc.createElement("span"); ca.className = "pccaret"; ca.setAttribute("role", "button"); ca.dataset.caret = g;
      tabs.insertBefore(ca, tabs.firstChild);
      const cx = doc.createElement("span"); cx.className = "pcx"; cx.setAttribute("role", "button"); cx.dataset.close = g; cx.textContent = "✕"; cx.title = `Close the ${title} panels (View ▸ Dockers brings them back)`;
      tabs.appendChild(cx);
      const paintCaret = () => { const c = grp.classList.contains("pccol"); ca.textContent = c ? "▸" : "▾"; ca.title = c ? `Open the ${title} panels` : `Fold the ${title} panels to their tabs`; };
      if (E.store.get("pc.col." + g, false) === true) grp.classList.add("pccol");
      paintCaret();
      ca.onclick = (e) => { e.stopPropagation(); fold(g, !grp.classList.contains("pccol")); paintCaret(); };
      tabs.addEventListener("click", (e) => { const b = e.target.closest("button[data-tab]"); if (b && grp.classList.contains("pccol")) { fold(g, false); paintCaret(); } });
      cx.onclick = (e) => { e.stopPropagation(); close(g); };
      P.adopt({ id, title, el: grp, home: { parent: col, before: grp.nextElementSibling }, scope: () => kx, confine: () => kx, onClose: () => close(g),
        onState: (s) => { if (s === "home") { if (grp._fpWas && grp._fpWas !== "home") grp.classList.remove("off"); keepOrder(); } grp._fpWas = s; if (E.ui.props) { try { E.ui.props(); } catch (e) { /* fine */ } } } });
      ids.push(id);
    }
    /* ---- 2.454.0: THE COLUMN AS A DOCKER - drop zones above / below each group (H3Panels.zoneHost), its width by its left edge */
    if (col && P && P.zoneHost) {
      P.zoneHost({ id: "ie.column", el: () => (kx.classList.contains("side-off") ? null : col),
        zones: () => P.columnZones([...col.querySelectorAll(":scope > .pcgrp[data-g]")].filter((x) => !x.classList.contains("off")).map((x) => ({ key: x.dataset.g, rect: x.getBoundingClientRect() })), col.getBoundingClientRect()),
        drop: (id, key) => {
          const m = /^(before|after):(.+)$/.exec(key || ""), ref = m ? col.querySelector(`:scope > .pcgrp[data-g="${m[2]}"]`) : null;
          const before = m && ref ? (m[1] === "before" ? ref : ref.nextElementSibling) : null;
          P.placeAt(id, col, before); keepOrder();
          say(`${(P.get(id) || {}).title || "the panels"} docked in the panel column`);
        } });
      const grip = doc.createElement("div"); grip.className = "pcsidegrip"; grip.id = "pcSideGrip"; grip.title = "Drag to make the panel column wider / narrower";
      const gcss = doc.createElement("style"); gcss.textContent = ".kx .pcsidegrip{flex:none;width:5px;cursor:col-resize;background:transparent;border-left:1px solid var(--pc-line);margin-left:-1px;z-index:5}.kx .pcsidegrip:hover,.kx .pcsidegrip.on{background:var(--pc-accent)}.kx.side-off .pcsidegrip{display:none}.kx.narrow .pcsidegrip{display:none}";
      doc.head.appendChild(gcss);
      col.parentNode.insertBefore(grip, col);
      grip.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return; e.preventDefault(); grip.setPointerCapture(e.pointerId); grip.classList.add("on");
        const x0 = e.clientX, w0 = col.getBoundingClientRect().width;
        const mv = (m) => { const w = Math.max(200, Math.min(640, Math.round(w0 - (m.clientX - x0)))); col.style.width = w + "px"; };
        const up = () => { grip.classList.remove("on"); grip.removeEventListener("pointermove", mv); grip.removeEventListener("pointerup", up); E.store.set("pc.sideW", Math.round(col.getBoundingClientRect().width)); root.dispatchEvent(new root.Event("resize")); };
        grip.addEventListener("pointermove", mv); grip.addEventListener("pointerup", up);
      });
    }
    /* ---- 2.514.0: fold / close / open, and View ▸ Dockers */
    const grpOf = (g) => col && col.querySelector(`.pcgrp[data-g="${g}"]`);
    const closedSet = () => new Set(E.store.get("pc.closed", []) || []);
    const keepClosed = (g, on) => { const s = closedSet(); if (on) s.add(g); else s.delete(g); E.store.set("pc.closed", [...s]); };
    function fold(g, on) { const x = grpOf(g); if (!x) return; x.classList.toggle("pccol", !!on); E.store.set("pc.col." + g, !!on); root.dispatchEvent(new root.Event("resize")); }
    function close(g, quiet) {
      const x = grpOf(g) || (P && P.get("ie." + g) || {}).el, r = P && P.get("ie." + g); if (!x) return;
      if (r && r.state !== "home") P.home("ie." + g);
      x.classList.add("off"); keepClosed(g, true);
      if (!quiet) say(`${(GROUPS.find((k) => k[0] === g) || [, g])[1]} panels closed - View ▸ Dockers brings them back`);
    }
    function visible(g) {
      const r = P && P.get("ie." + g), x = r ? r.el : grpOf(g); if (!x) return false;
      if (!r || r.state === "home") return !x.classList.contains("off") && !kx.classList.contains("side-off");
      if (r.state === "float") return !!(r.win && !r.win.classList.contains("off"));
      const d = r.docker && P.get(r.docker); return !!(d && d.win && !d.win.classList.contains("off"));
    }
    function open(g) {
      const r = P && P.get("ie." + g), x = r ? r.el : grpOf(g); if (!x) return;
      x.classList.remove("off"); keepClosed(g, false);
      if (!r || r.state === "home") kx.classList.remove("side-off");
      else if (r.state === "float" && r.win) { r.win.classList.remove("off"); }
      else if (r.docker) P.show(r.docker, true);
    }
    const namedHere = () => (P && P.list ? P.list().filter((d) => d.kind === "docker" && (d.confine === kx.id || (d.confine && d.confine.startsWith("fd-")))) : []);
    const dockShown = (id) => { const d = P.get(id); return !!(d && d.win && !d.win.classList.contains("off")); };
    function float(g) { if (!P) return say("floating dockers are not loaded (reload the page)"); const b = col.getBoundingClientRect(); P.float("ie." + g, P.get("ie." + g).w ? null : { x: b.left - 330, y: b.top + 30, w: 300, h: 420 }); }
    function newDocker() {
      if (!P) return say("floating dockers are not loaded (reload the page)");
      return P.ask("New docker", "Name of the new docker:", "Docker").then((n) => { if (n && String(n).trim()) { const r = P.newDocker({ name: String(n).trim(), confine: kx.id }); say(`"${r.title}" - drag a floating panel group (⇱) by its title onto it`); return r; } return null; });
    }
    const C = E.ui.addCmd, sep = E.ui.sep;
    C("win.floatlayers", "Float Layers Panels", "", () => float("layers"), { enabled: () => !!P });
    C("win.floatcolor", "Float Colour Panels", "", () => float("color"), { enabled: () => !!P });
    C("win.floatprops", "Float Properties Panels", "", () => float("props"), { enabled: () => !!P });   // 2.454.0
    C("win.floatdock", "Float Dockers", "", () => { const x = col && col.querySelector('.pcgrp[data-g="dock"]'); if (x) x.classList.remove("off"); float("dock"); }, { enabled: () => !!P });
    C("win.newdocker", "New Docker…", "", () => newDocker(), { enabled: () => !!P });
    C("win.panelshome", "Panels Back in the Column", "", () => ids.forEach((id) => P.home(id)), { enabled: () => !!P });
    const W = E.ui.MENUS.find(([n]) => n === "Window");
    if (W) W[1].push(sep, "win.floatlayers", "win.floatcolor", "win.floatprops", "win.floatdock", "win.panelshome", sep, "win.newdocker");
    // 2.514.0: View ▸ Dockers - All Dockers, then each of the editor's dockers with ✓ while it is on screen
    for (const [g, title] of GROUPS) C("view.dock." + g, title, "", () => (visible(g) ? close(g) : open(g)), { checked: () => visible(g) });
    C("view.dock.all", "All Dockers", "", () => { GROUPS.forEach(([g]) => open(g)); namedHere().forEach((d) => P.show(d.id, true)); say("every docker of the editor shown"); },
      { checked: () => GROUPS.every(([g]) => !grpOf(g) || visible(g)) && namedHere().every((d) => dockShown(d.id)) });
    const V = E.ui.MENUS.find(([n]) => n === "View");
    if (V) V[1].push(sep, { label: "Dockers", get items() {
      const named = namedHere().map((d) => { const id = "view.dock.fd." + d.id; if (!E.ui.CMD.has(id)) C(id, d.title, "", () => P.show(d.id, !dockShown(d.id)), { checked: () => dockShown(d.id) }); return id; });
      return ["view.dock.all", sep].concat(GROUPS.filter(([g]) => grpOf(g) || (P && P.get("ie." + g))).map(([g]) => "view.dock." + g)).concat(named.length ? [sep].concat(named) : []);
    } });
    // what was closed stays closed (once the panels are where they were left)
    const closedNow = closedSet();
    for (const [g] of GROUPS) if (closedNow.has(g)) { const r = P && P.get("ie." + g); Promise.resolve(r && r.ready).then(() => { if (closedSet().has(g)) close(g, true); }); }
    E.panels = { float, newDocker, fold, close, open, visible, ids: () => ids.slice(), order: () => (col ? [...col.querySelectorAll(":scope > .pcgrp[data-g]")].map((x) => x.dataset.g) : []), column: col };
  }

  const PCPanels = { GROUPS, orderOf, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCPanels;
  else root.PCPanels = PCPanels;
})(typeof window !== "undefined" ? window : globalThis);
