/* bitGen Studio — 2.560.0: the ▣ docker DOCKS like the other dockers, and the other dockers go IN it (H3DGDock).
 * Tim: "the new docker is now at the right z level but won't dock and won't allow other dockers to doc in it".
 * Found: the app has three docking systems - the ▣ dockers (static/floatpanels.js + static/dockgroup.js: main dockers by
 * their title bar, floated ⇱ windows), static/dockfloat.js (Basic Settings, LLM tokens, the Camera panel - drop zones
 * above / below / beside a docker, in a side docker) and ext/promptdock/pfloat.js (the prompt docker, its own zones).
 * A ▣ docker had no drop zones of its own (only 📌 Make permanent - the bottom of the main column), and Basic Settings,
 * LLM tokens and the prompt docker could not go into one. This file joins them:
 *   THE ▣ DOCKER DOCKS   drag a floating ▣ docker by its title bar near a docker's edge - the same blue drop zone
 *                        Basic Settings shows ("Dock Docker above Preview") - let go = it docks there: above / below a
 *                        docker in the column, left / right of it (side by side), at the top / bottom of a side docker
 *                        (Settings, References, Assets, Queue, Gallery). Its own edge sizes it (static/dockfloat.js
 *                        grips); its title bar dragged away floats it again (and can dock it somewhere else at once);
 *                        ▾ folds it, ⇱ floats it, 🗑 deletes it, right-click = its menu. Where it is docked is kept in
 *                        panel_layout.cfg (its perm.dock {mode, to, side, dw, dh}) and comes back at the next start.
 *   DOCKERS GO IN IT     drag Basic Settings / LLM tokens / the Camera panel by their title bar, or the prompt docker by
 *                        its title bar, over a ▣ docker (floating or docked): it is outlined, an orange line shows where
 *                        it goes - let go = in it (side by side / stacked / a tab, as the ▣ docker is laid out). Out
 *                        again: drag its small title bar (or its tab) out, or ⇲ - it floats where you let go. Kept in
 *                        panel_layout.cfg (panels sf.<id> / pf.promptdock), back in its ▣ docker at the next start.
 *   A NEW COLUMN (2.561.0 - Tim: "new docker docks, but allow it to also dock between vertical dockers so it becomes a new
 *                        vertical docker"): dragged onto the seam BETWEEN two columns (Settings | References | Assets |
 *                        the main column | Queue | Gallery - or the window's left / right edge) a tall blue strip shows
 *                        ("New column between References and Assets") - let go = the ▣ docker is a column of its own,
 *                        the full height, with its own splitter (drag it to size its width). #app's grid gets a track
 *                        for it (gridTemplate). ▾ folds it to a narrow strip, its statusbar button hides it, its title
 *                        bar dragged away floats it again. Kept as perm.dock {mode: "col", before: <the column after it>,
 *                        dw}.
 * Pure (Node: scripts/test-dgdock560.js, test-dgdock561.js): memberIdOf, wants, pickZone, nearEdge, EDGE, template,
 *   seamsOf, seamAt, COLV, SPLV. */
(function (root) {
  "use strict";
  const EDGE = 36;                                         // the edge band that docks (static/dockfloat.js EDGE)
  const SIDES = ["top", "bottom", "left", "right"];
  /** the floating dockers that can go into a ▣ docker: the prompt docker, any SecFloat window (sf-<id>) */
  function memberIdOf(el) {
    if (!el || !el.id) return null;
    if (el.id === "promptdock") return "pf.promptdock";
    const cls = el.classList ? (el.classList.contains ? el.classList.contains("secfloat") : false) : false;
    return cls && /^sf-[\w-]+$/.test(el.id) ? "sf." + el.id.slice(3) : null;
  }
  const ID = /^[A-Za-z][\w-]{0,40}$/;
  /** a kept dock place a ▣ docker can be put back in: beside a docker {mode dock, to, side} or a column {mode col, before} */
  const wants = (d) => !!d && typeof d === "object" && ((d.mode === "dock" && typeof d.to === "string" && ID.test(d.to) && SIDES.includes(d.side))
    || (d.mode === "col" && (d.before === "" || d.before == null || (typeof d.before === "string" && ID.test(d.before)))));
  /* 2.561.0: #app's columns - the track each child takes (the stylesheet's own vars, so its no-left / no-refs … still work) */
  const COLV = { ldock: "var(--c1)", refsdock: "var(--c2)", assetsdock: "var(--c3)", maincol: "minmax(200px, 1fr)", qdock: "var(--c4)", rdock: "var(--c5)" };
  const SPLV = { ldock: "var(--s1)", refs: "var(--s2)", assets: "var(--s3)", qdock: "var(--s5)", rdock: "var(--s4)" };
  /** kids [{kind: col | split | dgcol | dgsplit | other, id, key, w, hidden}] -> grid-template-columns (hidden ones take none) */
  function template(kids) {
    return (kids || []).filter((k) => k && !k.hidden).map((k) => (k.kind === "col" ? COLV[k.id] || "auto" : k.kind === "split" ? SPLV[k.key] || "5px"
      : k.kind === "dgcol" ? Math.max(34, Math.round(+k.w || 340)) + "px" : k.kind === "dgsplit" ? "5px" : "auto")).join(" ");
  }
  /** the seams a ▣ docker can become a column at: cols [{id, l, r, name}] left to right -> [{x, before, a, b}] (the window's
   *  left edge, between each two, the right edge; before = the column after the seam, "" = the end) */
  function seamsOf(cols) {
    const c = (cols || []).filter((x) => x && x.r - x.l > 8).sort((a, b) => a.l - b.l), out = [];
    if (!c.length) return out;
    out.push({ x: c[0].l, before: c[0].id, a: "", b: c[0].name });
    for (let i = 1; i < c.length; i++) out.push({ x: Math.round((c[i - 1].r + c[i].l) / 2), before: c[i].id, a: c[i - 1].name, b: c[i].name });
    out.push({ x: c[c.length - 1].r, before: "", a: c[c.length - 1].name, b: "" });
    return out;
  }
  /** the seam within band px of px (the nearest) */
  function seamAt(px, seams, band) {
    let best = null;
    for (const s of seams || []) { const d = Math.abs(px - s.x); if (d <= (band == null ? 14 : band) && (!best || d < Math.abs(px - best.x))) best = s; }
    return best;
  }
  const seamLabel = (title, s) => s.a && s.b ? `New column: ${title} between ${s.a} and ${s.b}` : s.b ? `New column: ${title} at the left, before ${s.b}` : `New column: ${title} at the right, after ${s.a}`;
  /** the drop zone for a ▣ docker at (px, py): targets [{key, kind: column | side, l, t, r, b}] - a side docker takes
   *  top / bottom, a column docker every edge; nothing "inside" (a ▣ docker is a docker itself) -> {key, side, r} | null */
  function pickZone(px, py, targets, DF, band) {
    for (const t of targets || []) {
      if (!t || !t.key) continue;
      const sd = DF.zoneAt(px, py, t, t.kind === "side" ? ["top", "bottom"] : SIDES, false, band == null ? EDGE : band);
      if (sd) return { key: t.key, side: sd, r: DF.zoneRect(t, sd) };
    }
    return null;
  }
  /** (px, py) within the edge bands of rect r (a docked ▣ docker's edges are the other dockers' drop zones): band = px,
   *  or "pf" = the prompt docker's bands (30 % of the side, at most 90 px - ext/promptdock/pfloat.js zoneAt) */
  function nearEdge(px, py, r, band) {
    if (!r) return false;
    const w = r.right - r.left, h = r.bottom - r.top;
    const bw = band === "pf" ? Math.min(90, w * 0.3) : Math.min(band, w * 0.3), bh = band === "pf" ? Math.min(90, h * 0.3) : Math.min(band, h * 0.3);
    return px - r.left < bw || r.right - px < bw || py - r.top < bh || r.bottom - py < bh;
  }
  const API = { EDGE, memberIdOf, wants, pickZone, nearEdge, template, seamsOf, seamAt, seamLabel, COLV, SPLV };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; return; }

  const doc = root.document, $ = (id) => doc.getElementById(id);
  const P = () => root.H3Panels, G = () => root.H3DockGroup, DF = () => root.DockFloat;
  const tev = (k, v) => { if (root.H3TestEvent) { try { root.H3TestEvent(k, v); } catch (e) { /* the 🧪 list */ } } };
  const resize = () => { try { root.dispatchEvent(new root.Event("resize")); } catch (e) { /* fine */ } };
  function css() {
    if ($("dgdCss")) return;
    const s = doc.createElement("style"); s.id = "dgdCss";
    s.textContent = ""
      + "#dgZone{position:fixed;z-index:9998;background:rgba(38,128,235,.22);border:2px solid #2680eb;border-radius:6px;pointer-events:none;display:none}"
      + "#dgZone b{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:600 12px system-ui;color:#fff;background:#2680eb;padding:3px 8px;border-radius:4px;white-space:nowrap}"
      + "#dgZone.into{background:var(--tiger,#f59e2c);border-color:var(--tiger,#f59e2c);border-radius:2px}"
      + "#dgZone.into b{background:var(--tiger-deep,#c4761a);top:auto;bottom:-26px}"
      // a docked ▣ docker: its own height in a column / a side docker, its own width beside a docker
      + ".bdock.dgperm{position:relative}.bdock.dgperm>.bhead{cursor:grab}"
      + ".bdock.dgperm.df-stack,.bdock.dgperm.df-side{flex:0 0 auto!important;border-top:1px solid var(--line,#3a342a)}"
      + ".bdock.dgperm.df-inrow{height:auto!important;align-self:stretch;min-width:220px!important;max-width:calc(100% - 160px);border-left:1px solid var(--line,#3a342a);border-right:1px solid var(--line,#3a342a)}"
      + ".bdock.dgperm.dg-docked.collapsed{height:30px!important;min-height:0!important;flex:0 0 30px!important}"
      // 2.561.0: a ▣ docker as a column of #app - the full height, its splitter beside it
      + "#app>.bdock.dgperm.dg-col{height:auto!important;min-height:0!important;flex:none!important;display:flex;flex-direction:column;overflow:hidden;min-width:0;background:var(--panel);border-left:1px solid var(--line,#3a342a);border-right:1px solid var(--line,#3a342a)}"
      + "#app>.bdock.dgperm.dg-col>.bbody{flex:1 1 auto;min-height:0;display:flex;flex-direction:column}#app>.bdock.dgperm.dg-col>.bhead>.maxbtn{display:none}"
      + "#app>.bdock.dgperm.dg-col.collapsed>.bbody{display:none}#app>.bdock.dgperm.dg-col.collapsed>.bhead{writing-mode:vertical-rl;height:100%;padding:8px 4px;white-space:nowrap}"
      + "#app>.bdock.dgperm.dg-col.collapsed>.bhead>button{display:none}"
      // Basic Settings / LLM tokens / the prompt docker in a ▣ docker: they fill their place, its small title bar drags them
      + ".h3fp .secfloat.dg-in{position:relative!important;left:auto!important;top:auto!important;flex:1 1 auto;width:auto!important;height:auto!important;min-height:0;max-width:none;max-height:none;border:0;border-radius:0;box-shadow:none}"
      + ".h3fp .secfloat.dg-in>.sfhead{display:none}.h3fp .secfloat.dg-in>.sfbody{flex:1 1 auto;min-height:0;overflow:auto}"
      + ".h3fp #promptdock.dg-in{position:relative!important;left:auto!important;top:auto!important;display:flex;flex-direction:column;flex:1 1 auto;width:auto!important;height:auto!important;min-height:0!important;max-width:none!important;max-height:none!important;border:0;border-radius:0;box-shadow:none}"
      + ".h3fp #promptdock.dg-in>.bhead{display:none}.h3fp #promptdock.dg-in>.bbody{flex:1 1 auto;min-height:0;overflow:auto}";
    doc.head.appendChild(s);
  }
  let zEl = null;
  function zone(r, label, into) {
    if (!r) { if (zEl) zEl.style.display = "none"; return; }
    if (!zEl) { css(); zEl = doc.createElement("div"); zEl.id = "dgZone"; zEl.innerHTML = "<b></b>"; doc.body.appendChild(zEl); }
    const L = r.l != null ? r : { l: r.x, t: r.y, r: r.x + r.w, b: r.y + r.h };
    Object.assign(zEl.style, { display: "block", left: L.l + "px", top: L.t + "px", width: Math.max(4, L.r - L.l) + "px", height: Math.max(4, L.b - L.t) + "px" });
    zEl.classList.toggle("into", !!into);
    zEl.querySelector("b").textContent = label || "";
  }
  const eatClick = () => { const eat = (c) => { c.stopPropagation(); c.preventDefault(); root.removeEventListener("click", eat, true); }; root.addEventListener("click", eat, true); root.setTimeout(() => root.removeEventListener("click", eat, true), 300); };
  const outline = (on) => { for (const id of (G() ? G().groups() : [])) { const r = P().get(id); if (r && r.win && G().shown(id)) r.win.classList.toggle("dg-target", !!on); } if (!on) doc.querySelectorAll(".h3fp.dg-target").forEach((x) => x.classList.remove("dg-target")); };

  /* ================= 1 the ▣ docker docks (a DockFloat panel around its docker) ================= */
  const STATE = {};
  function stateOf(id) {
    if (!STATE[id]) { const r = P().get(id); STATE[id] = Object.assign({}, (r && r.perm && r.perm.dock) || {}); }
    return STATE[id];
  }
  function saveOf(id) {
    const r = P().get(id); if (!r || !r.perm) return;
    const s = stateOf(id);
    P().setPerm(id, { dock: s.mode === "col" ? { mode: "col", before: s.before || "", dw: Math.round(s.dw || 340) } : DF().pure.cleanState(s) });
  }
  function panelOf(id, d) {
    if (d._dfPanel) return d._dfPanel;
    const r = P().get(id);
    return DF().panel({ id: "dg-" + id, title: (r && r.title) || "Docker", el: d, head: doc.createElement("div"),   // (its own title-bar drag: headOut)
      state: () => stateOf(id), save: () => saveOf(id), hide: () => G().toggle(false, id), min: { w: 260, h: 140 }, defW: 460, defH: 340, onPlace: resize });
  }
  const retries = {};
  /** the column laid out (docker_status.json applied, the prompt docker in its place) - as static/secfloat.js waits */
  function layoutReady() { try { return typeof root.dsReady !== "undefined" ? !!root.dsReady && (!$("promptdock") || !!(root.PFloat && root.PFloat.started)) : (0, eval)("dsReady") && (!$("promptdock") || !!(root.PFloat && root.PFloat.started)); } catch (e) { return true; } }   // eslint-disable-line no-eval
  /** put ▣ docker id's docker element d where `dock` says ({to, side}); quiet = at the start (its docker may come later) */
  function place(id, d, dock, quiet) {
    if (!DF() || !DF().panel || !wants(dock)) return false;
    if (dock.mode === "col") return placeCol(id, d, dock, quiet);
    const t = $(dock.to);
    if (!t || t === d || d.contains(t) || t.classList.contains("dockgone") || (quiet && !layoutReady())) {
      if (quiet && (retries[id] = (retries[id] || 0) + 1) < 30) root.setTimeout(() => { const r = P().get(id); if (r && r.perm && $(dock.to) && !$(dock.to).classList.contains("dockgone")) G().makePerm(id, false, dock); }, 700);
      return false;
    }
    leaveCol(id, d);
    const pn = panelOf(id, d), s = stateOf(id);
    if (s.mode === "col") { delete s.before; s.dw = 0; }
    Object.assign(s, { dh: dock.dh || s.dh || 320, dw: dock.dw || s.dw || 460 });
    const g = d.nextElementSibling; if (g && g.classList.contains("dgp-grip")) g.remove();
    d.style.flex = ""; d.style.height = "";
    if (!pn.dockTo(t, dock.side, true)) return false;
    d.classList.add("dg-docked");
    saveOf(id); resize();
    tev("docker_group_docked", id + ">" + dock.to + ":" + dock.side);
    return true;
  }
  /* ---- 2.561.0: a column of its own between two columns of #app */
  const isColKid = (k) => !!k && !k.classList.contains("vsplit") && !k.classList.contains("dgc-split");
  function describe(k) {
    const cs = root.getComputedStyle(k), off = cs.display === "none" || cs.position === "absolute" || cs.position === "fixed";
    if (k.classList.contains("dgc-split")) { const d = $(G().permId(k.dataset.dgc)); return { kind: "dgsplit", hidden: !d || d.classList.contains("dockgone") || root.getComputedStyle(d).display === "none" }; }
    if (k.classList.contains("dg-col")) return { kind: "dgcol", hidden: off, w: k.classList.contains("collapsed") ? 34 : +k.dataset.w || 340 };
    if (k.classList.contains("vsplit")) return { kind: "split", key: k.dataset.resize, hidden: off };
    if (/^dgph_/.test(k.id)) return { kind: "col", id: k.id.slice(5), hidden: off };
    if (COLV[k.id]) return { kind: "col", id: k.id, hidden: off };
    return { kind: "other", hidden: off };
  }
  /** #app's grid: a track for every child in order (the stylesheet's template when there is no ▣ column) */
  function regrid() {
    const app = $("app"); if (!app || !G()) return;
    const kids = [...app.children];
    if (!kids.some((k) => k.classList.contains("dg-col"))) { if (app.style.gridTemplateColumns) { app.style.gridTemplateColumns = ""; resize(); } return; }
    const list = kids.map((k) => { const x = describe(k); if (k.classList.contains("dgc-split")) k.style.display = x.hidden ? "none" : ""; return x; });
    const t = template(list);
    if (app.style.gridTemplateColumns !== t) { app.style.gridTemplateColumns = t; resize(); }
  }
  const colName = (el) => (el.id === "maincol" ? "the main column" : el.classList.contains("dg-col") ? ((P().get(el.dataset.dg) || {}).title || "Docker") : /^dgph_/.test(el.id) ? "" : DF().dockName(el) || el.id);
  function seamsNow(skip) {
    const app = $("app"); if (!app) return [];
    const cols = [...app.children].filter((k) => isColKid(k) && k !== skip && root.getComputedStyle(k).display !== "none" && root.getComputedStyle(k).position !== "fixed")
      .map((k) => { const r = k.getBoundingClientRect(); return { id: k.id, l: r.left, r: r.right, name: colName(k) }; }).filter((c) => c.id);
    return seamsOf(cols);
  }
  /** where the new column goes: left of the main column = the column then its splitter; right of it = the splitter first */
  function colInsert(d, sp, before) {
    const app = $("app"), main = $("maincol");
    let B = before ? $(before) : null; if (B && B.parentElement !== app) B = null;
    const kids = [...app.children], right = B ? kids.indexOf(B) > kids.indexOf(main) : true;
    if (right) { let ref = B; if (B && B.previousElementSibling && B.previousElementSibling.matches(".vsplit, .dgc-split")) ref = B.previousElementSibling; app.insertBefore(sp, ref); app.insertBefore(d, ref); }
    else { app.insertBefore(d, B); app.insertBefore(sp, B); }
    d.dataset.dgSide = right ? "right" : "left";
  }
  function splitDrag(sp, id) {
    sp.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const d = $(G().permId(id)); if (!d) return;
      const right = d.dataset.dgSide === "right", x0 = e.clientX, w0 = d.getBoundingClientRect().width;
      sp.classList.add("drag");
      const mv = (m) => { const w = Math.max(160, Math.min(900, Math.round(w0 + (right ? x0 - m.clientX : m.clientX - x0)))); d.dataset.w = w; stateOf(id).dw = w; regrid(); };
      const up = () => { root.removeEventListener("pointermove", mv, true); root.removeEventListener("pointerup", up, true); sp.classList.remove("drag"); saveOf(id); resize(); };
      root.addEventListener("pointermove", mv, true); root.addEventListener("pointerup", up, true);
    });
  }
  const watchedCols = new WeakSet();
  function placeCol(id, d, dock, quiet) {
    const app = $("app"); if (!app || !$("maincol")) return false;
    if (quiet && (!layoutReady() || (dock.before && !$(dock.before)))) {
      if ((retries[id] = (retries[id] || 0) + 1) < 30) root.setTimeout(() => { const r = P().get(id); if (r && r.perm && layoutReady()) G().makePerm(id, false, dock); }, 700);
      return false;
    }
    if (d._dfPanel) d._dfPanel.unplace();
    d.classList.remove("dg-docked");
    const g = d.nextElementSibling; if (g && g.classList.contains("dgp-grip")) g.remove();
    let sp = $("dgcs_" + id);
    if (!sp) { sp = doc.createElement("div"); sp.className = "vsplit dgc-split"; sp.id = "dgcs_" + id; sp.dataset.dgc = id; sp.title = "Drag to size this column"; splitDrag(sp, id); }
    const s = stateOf(id), w = Math.round(dock.dw || (s.mode === "col" ? s.dw : 0) || 340);
    colInsert(d, sp, dock.before && $(dock.before) ? dock.before : "");
    d.classList.add("dg-col"); d.style.flex = ""; d.style.height = ""; d.dataset.w = w;
    STATE[id] = { mode: "col", before: dock.before && $(dock.before) ? dock.before : "", dw: w };
    if (!watchedCols.has(d)) { watchedCols.add(d); try { new root.MutationObserver(regrid).observe(d, { attributes: true, attributeFilter: ["class"] }); } catch (e) { /* the 1 s look */ } }
    saveOf(id); regrid(); resize();
    tev("docker_group_column", id + ">" + (STATE[id].before || "end"));
    return true;
  }
  /** out of being a column (it docks elsewhere / floats / goes): its splitter goes, the grid back */
  function leaveCol(id, d) {
    if (d) { d.classList.remove("dg-col"); delete d.dataset.w; delete d.dataset.dgSide; }
    const sp = $("dgcs_" + id); if (sp) sp.remove();
    regrid();
  }
  /** the docker targets a ▣ docker can dock by (the main column's dockers, the open side dockers) - not itself */
  function targetsOf(win) {
    return (DF().targetsFor(win) || []).filter((t) => t.el && t.el.id && !t.el.contains(win)).map((t) => ({ key: t.el.id, kind: t.kind, l: t.l, t: t.t, r: t.r, b: t.b }));
  }
  /** a ▣ docker being dragged: carry = null (static/floatpanels.js moves its window) or {ox, oy} (this moves it - it was
   *  just torn out of its dock) */
  function track(id, x0, y0, carry) {
    let on = !!carry, z = null, into = null, slot = null;
    const r0 = P().get(id); if (!r0) return;
    const mv = (m) => {
      const r = P().get(id); if (!r || !r.win) return;
      if (!on) { if (Math.hypot(m.clientX - x0, m.clientY - y0) < 6) return; on = true; }
      if (carry) {
        const p = DF().pure.onScreen(m.clientX - carry.ox, m.clientY - carry.oy, r.w || 400, root.innerWidth, root.innerHeight);
        r.x = p.x; r.y = p.y; r.win.style.left = p.x + "px"; r.win.style.top = p.y + "px";
      }
      z = null; into = null; slot = null;
      // 2.609.0: over a zone host (the image editor's panel column) - floatpanels.js docks it there; nothing here
      if (P().zoneAt && P().zoneAt(r, m.clientX, m.clientY)) { zone(null); if (carry) { const zh = P().zoneAt(r, m.clientX, m.clientY); P().zoneMark(zh.zone.line); r.__zh = zh; } return; }
      if (carry) { r.__zh = null; P().zoneMark(null); }
      if (carry) { const g = G().groupAt(m.clientX, m.clientY, id); if (g && P().canDock(id, g.id, (k) => ((P().get(k) || {}).docker || null))) { into = g.id; slot = P().slotOf(g.id, m.clientX, m.clientY); } }
      else if (doc.querySelector(".h3fp.drop")) into = "-";                // floatpanels has it: into another ▣ docker
      if (!into) {                                                  // 2.561.0: on a seam between two columns = a column of its own
        const app = $("app"), ab = app ? app.getBoundingClientRect() : null, sm = ab && m.clientY >= ab.top && m.clientY <= ab.bottom ? seamAt(m.clientX, seamsNow(r.win), 8) : null;
        if (sm) z = { col: true, before: sm.before, r: { l: sm.x - 40, t: ab.top, r: sm.x + 40, b: ab.bottom }, label: seamLabel(r.title, sm) };
      }
      if (!into && !z) z = pickZone(m.clientX, m.clientY, targetsOf(r.win), DF().pure, EDGE);
      if (z) zone(z.r, z.label || DF().pure.zoneLabel(r.title, z.side, DF().dockName($(z.key))));
      else if (into && into !== "-") { const b = P().get(into).win.querySelector(".h3fd").getBoundingClientRect(); zone(slot ? slot.line : { l: b.left, t: b.top, r: b.right, b: b.bottom }, r.title + " → " + P().get(into).title, true); }
      else zone(null);
    };
    const up = () => {
      root.removeEventListener("pointermove", mv, true); root.removeEventListener("pointerup", up, true);
      zone(null);
      if (!on) return;
      eatClick();
      const r = P().get(id); if (!r) return;
      if (carry && r.__zh) { const zh = r.__zh; r.__zh = null; P().zoneMark(null); P().zoneInto(id, zh.host.id, zh.zone.key); G().paint(); return; }   // 2.609.0
      if (r.state === "zone") { G().paint(); return; }                                                   // 2.609.0: floatpanels docked it in a zone
      if (z && z.col) G().makePerm(id, false, { mode: "col", before: z.before });
      else if (z) G().makePerm(id, false, { mode: "dock", to: z.key, side: z.side });
      else if (carry && into) P().dockInto(id, into, slot ? slot.index : undefined);
      else if (carry) P().float(id, { x: r.x, y: r.y, w: r.w, h: r.h });
      G().paint();
    };
    root.addEventListener("pointermove", mv, true); root.addEventListener("pointerup", up, true);
  }
  /** the drop zones while a floating ▣ docker is dragged by its title bar - one listener for every ▣ docker (bubbling:
   *  after static/floatpanels.js's own on the title bar, so it moves the window first); a new one works at once */
  doc.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !P() || !G() || !e.target.closest) return;
    const bar = e.target.closest(".h3fp-t"), win = bar && bar.parentElement;
    if (!win || !win.classList.contains("h3fp") || e.target.closest("button, input")) return;
    const id = win.dataset.fp, rr = P().get(id);
    if (!G().isGroup(id) || !rr || rr.win !== win || rr.state !== "float" || rr.perm) return;
    track(id, e.clientX, e.clientY, null);
  });
  /** a docked ▣ docker's title bar dragged = it floats again under the pointer, still being dragged (a drop zone docks it
   *  elsewhere, another ▣ docker takes it) */
  function headOut(head, id) {
    if (head.dataset.dgOut) return;
    head.dataset.dgOut = "1";
    head.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest("button, select, input")) return;
      const x0 = e.clientX, y0 = e.clientY;
      const stop = () => { root.removeEventListener("pointermove", mv, true); root.removeEventListener("pointerup", stop, true); };
      const mv = (m) => {
        if (Math.hypot(m.clientX - x0, m.clientY - y0) < 8) return;
        stop();
        const d = $(G().permId(id)), b = d ? d.getBoundingClientRect() : { width: 600, height: 400 };
        const w = Math.max(320, Math.min(b.width, 900)), h = Math.max(240, Math.min(b.height, 640));
        const at = { x: Math.round(m.clientX - Math.min(120, w / 2)), y: Math.max(0, Math.round(m.clientY - 12)), w: Math.round(w), h: Math.round(h) };
        G().unPerm(id, at);
        delete STATE[id];
        tev("docker_group_out", id);
        track(id, x0, y0, { ox: m.clientX - at.x, oy: m.clientY - at.y });
      };
      root.addEventListener("pointermove", mv, true); root.addEventListener("pointerup", stop, true);
    });
  }

  /* ================= 2 Basic Settings / LLM tokens / the prompt docker go IN a ▣ docker ================= */
  const STASH = {}, LASTIN = {}, QUIET = {};
  const SF = () => root.SecFloat;
  function memberEl(id) {
    if (id === "pf.promptdock") return $("promptdock");
    const w = SF() && SF().windows && SF().windows[id.slice(3)];
    return w ? w.el : null;
  }
  function memberTitle(id) { if (id === "pf.promptdock") return "Prompt"; const w = SF() && SF().windows && SF().windows[id.slice(3)]; return (w && w.spec.title) || id; }
  /** out of wherever its own system put it (floating / docked) - its classes and sizes off */
  function unplaceMember(id, el) {
    if (id === "pf.promptdock") { if (root.PFloat && root.PFloat.unplace) root.PFloat.unplace(); el.classList.remove("collapsed", "pf-dragging"); }
    else { const w = SF() && SF().windows[id.slice(3)]; if (w && w.panel) w.panel.unplace(); el.classList.remove("sf-drag", "sf-max", "sf-min"); }
  }
  function memberState(id, s) {
    const el = memberEl(id), r = P().get(id); if (!el || !r) return;
    if (s === "in" || s === "zone") {                       // 2.609.0: + in a zone host (the image editor's panel column)
      unplaceMember(id, el);
      el.classList.add("dg-in"); LASTIN[id] = r.docker;
      resize(); return;
    }
    if (s === "float") {                                     // dragged out of the ▣ docker: floats on its own again, there
      const b = r.win.getBoundingClientRect();
      STASH[id] = { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) };
      root.setTimeout(() => P().home(id), 0);
      return;
    }
    if (s === "home") {
      el.classList.remove("dg-in");
      if (QUIET[id]) { delete QUIET[id]; return; }            // (taken out by its own system - it is where that put it)
      let at = STASH[id]; delete STASH[id];
      if (!at) { const g = P().get(LASTIN[id]), b = g && g.win ? g.win.getBoundingClientRect() : null; at = b && b.width ? { x: Math.round(b.left + 30), y: Math.round(b.top + 30) } : { x: 160, y: 120 }; }
      if (id === "pf.promptdock") { if (root.PFloat && root.PFloat.float) root.PFloat.float(at.x, at.y, at.w > 200 ? at.w : null, at.h > 100 ? at.h : null); }
      else { const w = SF() && SF().windows[id.slice(3)]; if (w && w.panel) w.panel.float(at.x, at.y, at.w > 200 ? at.w : null, at.h > 80 ? at.h : null); }
      tev("docker_member_out", id); resize();
    }
  }
  function adoptMember(id) {
    const el = memberEl(id); if (!el) return null;
    return P().adopt({ id, title: memberTitle(id), el, home: { parent: doc.body, before: null }, onState: (s) => memberState(id, s) });
  }
  function takeIn(id, gid, slot) {
    const el = memberEl(id), g = P().get(gid); if (!el || !g) return;
    unplaceMember(id, el);
    const r = adoptMember(id);
    Promise.resolve(r && r.ready).then(() => {
      P().dockInto(id, gid, slot ? slot.index : undefined);
      if (P().get(id).state !== "in") return;
      G().paint();
      tev("docker_member_in", id + ">" + gid);
    });
  }
  /** the ▣ docker under (x, y) a floating docker goes into - a docked one's edges stay the other dockers' drop zones */
  /** 2.609.0: into a zone host (the image editor's panel column): out of its own system, adopted, there */
  function takeInZone(id, zh) {
    const el = memberEl(id); if (!el) return;
    unplaceMember(id, el);
    const r = adoptMember(id);
    Promise.resolve(r && r.ready).then(() => { P().zoneInto(id, zh.host.id, zh.zone.key); G().paint(); tev("docker_member_zone", id + ">" + zh.host.id); });
  }
  function groupUnder(x, y, id) {
    const g = G().groupAt(x, y); if (!g) return null;
    if (g.perm) { const d = $(G().permId(g.id)); if (d && nearEdge(x, y, d.getBoundingClientRect(), id === "pf.promptdock" ? "pf" : EDGE)) return null; }
    return g;
  }
  let cur = null;
  function hover(m) {
    const el = doc.querySelector(".secfloat.sf-drag, #promptdock.pf-dragging");
    if (!el) { if (cur) { cur = null; zone(null); outline(false); } return; }
    const id = memberIdOf(el); if (!id || !G()) return;
    if (!cur) outline(true);
    const zh = P().zoneAt ? P().zoneAt({}, m.clientX, m.clientY) : null;      // 2.609.0: the image editor's panel column
    if (zh) {
      ["dfZone", "pfZone"].forEach((z) => { const e = $(z); if (e) e.style.display = "none"; });
      cur = { id, g: null, zh };
      const L = zh.zone.line; zone({ l: L.x, t: L.y - 3, r: L.x + L.w, b: L.y + Math.max(6, L.h) + 3 }, memberTitle(id) + " → the editor's panels", true);
      return;
    }
    const g = groupUnder(m.clientX, m.clientY, id);
    cur = { id, g: g ? g.id : null, slot: g ? P().slotOf(g.id, m.clientX, m.clientY) : null };
    if (g) {
      ["dfZone", "pfZone"].forEach((z) => { const e = $(z); if (e) e.style.display = "none"; });   // (their zone under the ▣ docker)
      const b = g.win.querySelector(".h3fd").getBoundingClientRect();
      zone(cur.slot ? cur.slot.line : { l: b.left, t: b.top, r: b.right, b: b.bottom }, memberTitle(id) + " → " + g.title, true);
    } else zone(null);
  }
  function drop() {
    if (!cur) return;
    const c = cur; cur = null; zone(null); outline(false);
    if (c.zh) root.setTimeout(() => takeInZone(c.id, c.zh), 0);    // 2.609.0
    else if (c.g) root.setTimeout(() => takeIn(c.id, c.g, c.slot), 0);   // after its own system's drop (it may have docked it under)
  }
  // bubbling: after the dragged docker's own handlers (window capture) - they move it / show their zone first
  root.addEventListener("pointermove", hover, false);
  root.addEventListener("pointerup", drop, false);

  /* ================= the start: the members back in their ▣ docker; a 1 s look ================= */
  function membersBack(tries) {
    const sf = SF(), ready = P() && G() && sf && sf.started && sf.windows && Object.values(sf.windows).every((w) => w.placed)
      && (!$("promptdock") || (root.PFloat && root.PFloat.started));
    if (!ready) { if ((tries || 0) < 150) root.setTimeout(() => membersBack((tries || 0) + 1), 200); return; }
    root.setTimeout(() => P().load().then(() => {
      const lay = P().snapshot().panels || {};
      for (const id of Object.keys(lay)) if (/^(sf|pf)\./.test(id) && lay[id] && ((lay[id].state === "in" && lay[id].docker && P().get(lay[id].docker)) || (lay[id].state === "zone" && lay[id].zone)) && memberEl(id)) adoptMember(id);   // 2.609.0: + in a zone host
    }).catch(() => {}), 600);
  }
  function look() {
    if (!P() || !G()) return;
    // a member taken out by its own system (a ⊞ layout, a workspace): the ▣ docker lets it go where it is
    regrid();
    for (const r of P().list()) {
      if (!/^(sf|pf)\./.test(r.id) || (r.state !== "in" && r.state !== "zone")) continue;
      const rec = P().get(r.id), el = memberEl(r.id);
      if (rec && el && rec.state === "zone") { if (!el.closest(".pcfd")) { rec.home = { parent: el.parentNode || doc.body, before: el.nextSibling }; QUIET[r.id] = true; P().home(r.id); rec.home = { parent: doc.body, before: null }; } continue; }   // 2.609.0
      if (rec && el && rec.win && !rec.win.contains(el)) { rec.home = { parent: el.parentNode || doc.body, before: el.nextSibling }; QUIET[r.id] = true; P().home(r.id); rec.home = { parent: doc.body, before: null }; }
    }
  }
  function start() { css(); membersBack(0); root.setInterval(look, 1000); look(); }
  root.H3DGDock = Object.assign(API, { place, leaveCol, gone: (id) => leaveCol(id, null), regrid, seams: () => seamsNow(null), headOut, track, takeIn, wantsDock: wants, members: () => P().list().filter((r) => /^(sf|pf)\./.test(r.id)).map((r) => ({ id: r.id, state: r.state, docker: r.docker })) });
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
