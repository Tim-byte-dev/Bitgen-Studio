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
 * Pure (Node: scripts/test-dgdock560.js): memberIdOf, wants, pickZone, nearEdge, EDGE. */
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
  /** a kept dock place a ▣ docker can be put back in */
  const wants = (d) => !!d && typeof d === "object" && d.mode === "dock" && typeof d.to === "string" && /^[A-Za-z][\w-]{0,40}$/.test(d.to) && SIDES.includes(d.side);
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
  const API = { EDGE, memberIdOf, wants, pickZone, nearEdge };
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
  function saveOf(id) { const r = P().get(id); if (r && r.perm) P().setPerm(id, { dock: DF().pure.cleanState(stateOf(id)) }); }
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
    const t = $(dock.to);
    if (!t || t === d || d.contains(t) || t.classList.contains("dockgone") || (quiet && !layoutReady())) {
      if (quiet && (retries[id] = (retries[id] || 0) + 1) < 30) root.setTimeout(() => { const r = P().get(id); if (r && r.perm && $(dock.to) && !$(dock.to).classList.contains("dockgone")) G().makePerm(id, false, dock); }, 700);
      return false;
    }
    const pn = panelOf(id, d), s = stateOf(id);
    Object.assign(s, { dh: dock.dh || s.dh || 320, dw: dock.dw || s.dw || 460 });
    const g = d.nextElementSibling; if (g && g.classList.contains("dgp-grip")) g.remove();
    d.style.flex = ""; d.style.height = "";
    if (!pn.dockTo(t, dock.side, true)) return false;
    d.classList.add("dg-docked");
    saveOf(id); resize();
    tev("docker_group_docked", id + ">" + dock.to + ":" + dock.side);
    return true;
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
      if (carry) { const g = G().groupAt(m.clientX, m.clientY, id); if (g && P().canDock(id, g.id, (k) => ((P().get(k) || {}).docker || null))) { into = g.id; slot = P().slotOf(g.id, m.clientX, m.clientY); } }
      else if (doc.querySelector(".h3fp.drop")) into = "-";                // floatpanels has it: into another ▣ docker
      if (!into) z = pickZone(m.clientX, m.clientY, targetsOf(r.win), DF().pure, EDGE);
      if (z) zone(z.r, DF().pure.zoneLabel(r.title, z.side, DF().dockName($(z.key))));
      else if (into && into !== "-") { const b = P().get(into).win.querySelector(".h3fd").getBoundingClientRect(); zone(slot ? slot.line : { l: b.left, t: b.top, r: b.right, b: b.bottom }, r.title + " → " + P().get(into).title, true); }
      else zone(null);
    };
    const up = () => {
      root.removeEventListener("pointermove", mv, true); root.removeEventListener("pointerup", up, true);
      zone(null);
      if (!on) return;
      eatClick();
      const r = P().get(id); if (!r) return;
      if (z) G().makePerm(id, false, { mode: "dock", to: z.key, side: z.side });
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
    if (s === "in") {
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
    if (c.g) root.setTimeout(() => takeIn(c.id, c.g, c.slot), 0);   // after its own system's drop (it may have docked it under)
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
      for (const id of Object.keys(lay)) if (/^(sf|pf)\./.test(id) && lay[id] && lay[id].state === "in" && lay[id].docker && P().get(lay[id].docker) && memberEl(id)) adoptMember(id);
    }).catch(() => {}), 600);
  }
  function look() {
    if (!P() || !G()) return;
    // a member taken out by its own system (a ⊞ layout, a workspace): the ▣ docker lets it go where it is
    for (const r of P().list()) {
      if (!/^(sf|pf)\./.test(r.id) || r.state !== "in") continue;
      const rec = P().get(r.id), el = memberEl(r.id);
      if (rec && el && rec.win && !rec.win.contains(el)) { rec.home = { parent: el.parentNode || doc.body, before: el.nextSibling }; QUIET[r.id] = true; P().home(r.id); rec.home = { parent: doc.body, before: null }; }
    }
  }
  function start() { css(); membersBack(0); root.setInterval(look, 1000); look(); }
  root.H3DGDock = Object.assign(API, { place, headOut, track, takeIn, wantsDock: wants, members: () => P().list().filter((r) => /^(sf|pf)\./.test(r.id)).map((r) => ({ id: r.id, state: r.state, docker: r.docker })) });
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
