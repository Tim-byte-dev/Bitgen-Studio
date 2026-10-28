/* pccoldock.js — THE IMAGE EDITOR'S PANEL COLUMN TAKES ANY FLOATING DOCKER (2.609.0), window.PCColDock.
 *
 * Tim (verbatim): "add docker dropzones to the image-editor panel where layers are in so user can add floating dockers to
 * that panel. pending docker should be able to dock in that panel" + "also keep the dockers status and parent dockers
 * saved . when the parent docker is visible keep all child dockers within the parent".
 *
 *   DRAG A FLOATING DOCKER over the panel column (where Layers is): an orange line shows where it goes - above / below
 *   each docker there, or at the end; let go = it is docked IN the column:
 *     - a main docker floated with ⇱ (Assets, Gallery, References, Queue, Preview, Timeline …) - by its window's title
 *     - a ▣ named docker                                                                          - by its title
 *     - Basic Settings, LLM tokens, the Camera panel, the prompt docker                           - by their title bar
 *     - ⏳ Pending                                                                                 - by its title
 *   (the editor's own tabs - Layers, Color, ✨ AI … - dock here as before, pctabdock.js)
 *   DOCKED: a slim bar on top - ⠿ drag it to another place in the column, or out of it = it floats again where you let
 *   go; ▾ folds it to its bar; ⇱ floats it; ⚙ (a ▣ docker) its menu. The bottom edge sizes its height.
 *   KEPT: which docker is in the column, in what order, its height and fold - panel_layout.cfg (static/floatpanels.js
 *   state "zone", {host: "ie.column", key}) + the editor's store (pc.fd.*) - back in the column at the next start (a
 *   docker that mounts later waits for it). Inside the column it lives in the editor: it shows and hides WITH it.
 * Pure (Node: scripts/test-coldock609.js): keyOfPart(el-like), placeIndex(order, present, key), parseKey(key).
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  /** a column part's key: an editor group by its data-g, a docked docker "fd:<id>" */
  function keyOfPart(el) {
    if (!el || !el.dataset) return null;
    if (el.dataset.fd) return "fd:" + el.dataset.fd;
    if (el.dataset.g) return el.dataset.g;
    return null;
  }
  /** "before:<k>" / "after:<k>" / "first" / "end" -> {how, ref} */
  function parseKey(key) {
    const m = /^(before|after):(.+)$/.exec(String(key || ""));
    if (m) return { how: m[1], ref: m[2] };
    return { how: key === "first" ? "first" : "end", ref: null };
  }
  /** where key goes among the parts there now (present, in order) by the kept order of every part -> the index to insert
   *  before (present.length = the end): the first part AFTER it in the kept order that is here */
  function placeIndex(order, present, key) {
    const o = order || [], i = o.indexOf(key); if (i < 0) return present.length;
    for (let k = i + 1; k < o.length; k++) { const j = present.indexOf(o[k]); if (j >= 0) return j; }
    // nothing after it is here: right after the last part BEFORE it that is
    for (let k = i - 1; k >= 0; k--) { const j = present.indexOf(o[k]); if (j >= 0) return j + 1; }
    return present.length;
  }
  const pure = { keyOfPart, parseKey, placeIndex };
  if (typeof module !== "undefined" && module.exports && typeof document === "undefined") { module.exports = pure; return; }

  /* ================================ the editor ================================ */
  function install(E) {
    const { kx, doc, win, store } = E, P = root.H3Panels, say = E.say || (() => {});
    const col = doc.getElementById("pcPanels");
    if (!kx || !col || !P || !P.zoneInto || !P.zoneHost) return;
    const HOST = "ie.column";
    const tev = (k, v) => { if (root.H3TestEvent) { try { root.H3TestEvent(k, v); } catch (e) { /* the 🧪 list */ } } };
    if (!doc.getElementById("pcFdCss")) {
      const st = doc.createElement("style"); st.id = "pcFdCss";
      st.textContent = `#pcPanels>.pcfd{flex:none;display:flex;flex-direction:column;min-height:0;border:1px solid var(--pc-line,#1d1d1d);border-radius:4px;margin:2px 0;background:var(--pc-panel,#323232);overflow:hidden}
#pcPanels>.pcfd>.pcfdh{display:flex;align-items:center;gap:4px;height:22px;flex:none;padding:0 4px;background:var(--pc-panel2,#3c3c3c);font-size:11px;user-select:none;cursor:grab;color:var(--pc-text,#ddd)}
#pcPanels>.pcfd>.pcfdh b{flex:1;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#pcPanels>.pcfd>.pcfdh button{border:0;background:none;color:var(--pc-dim,#aaa);cursor:pointer;padding:0 4px;font-size:12px;line-height:20px}#pcPanels>.pcfd>.pcfdh button:hover{color:var(--pc-accent,#f59e2c)}
#pcPanels>.pcfd>.pcfdb{flex:none;display:flex;flex-direction:column;min-height:40px;overflow:auto}
#pcPanels>.pcfd>.pcfdg{flex:none;height:5px;cursor:row-resize;background:transparent;border-top:1px solid var(--pc-line,#1d1d1d)}#pcPanels>.pcfd>.pcfdg:hover,#pcPanels>.pcfd>.pcfdg.on{background:var(--pc-accent,#f59e2c)}
#pcPanels>.pcfd.fold>.pcfdb,#pcPanels>.pcfd.fold>.pcfdg{display:none}
#pcPanels>.pcfd:has(>.pcfdb>.off),#pcPanels>.pcfd:has(>.pcfdb>.dockgone),#pcPanels>.pcfd:has(>.pcfdb:empty){display:none}
#pcPanels>.pcfd>.pcfdb>*{flex:1 1 auto;min-height:0}
#pcPanels>.pcfd>.pcfdb>.dock,#pcPanels>.pcfd>.pcfdb>.bdock{position:relative!important;left:auto!important;top:auto!important;width:auto!important;height:auto!important;min-width:0!important;max-width:none!important;max-height:none!important;display:flex;flex-direction:column;border:0!important;grid-area:auto!important}
#pcPanels>.pcfd>.pcfdb>.dock>.bbody,#pcPanels>.pcfd>.pcfdb>.bdock>.bbody{flex:1 1 auto;min-height:0;overflow:auto}
#pcPanels>.pcfd>.pcfdb>.secfloat.dg-in,#pcPanels>.pcfd>.pcfdb>#promptdock.dg-in{position:relative!important;left:auto!important;top:auto!important;display:flex;flex-direction:column;width:auto!important;height:auto!important;min-height:0!important;max-width:none!important;max-height:none!important;border:0;border-radius:0;box-shadow:none}
#pcPanels>.pcfd>.pcfdb>.secfloat.dg-in>.sfhead,#pcPanels>.pcfd>.pcfdb>#promptdock.dg-in>.bhead{display:none}#pcPanels>.pcfd>.pcfdb>.secfloat.dg-in>.sfbody,#pcPanels>.pcfd>.pcfdb>#promptdock.dg-in>.bbody{flex:1 1 auto;min-height:0;overflow:auto}
#pcPanels>.pcfd>.pcfdb>.pcpend{position:relative!important;left:auto!important;top:auto!important;width:auto!important;max-height:none!important;z-index:auto;border:0;border-radius:0;box-shadow:none}
#pcPanels>.pcfd>.pcfdb>.pcpend>.pph{cursor:default;border-radius:0}#pcPanels>.pcfd>.pcfdb>.pcpend>.pph #ppHide{display:none}#pcPanels>.pcfd>.pcfdb>.pcpend>.ppl{flex:1 1 auto;min-height:0}
.pcfdghost{position:fixed;z-index:2147483100;pointer-events:none;padding:3px 9px;border-radius:5px;background:var(--pc-accent,#2680eb);color:#fff;font:600 11px system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.5)}`;
      doc.head.appendChild(st);
    }
    const slots = new Map();                               // id -> its .pcfd in the column
    const HKEY = (id) => "pc.fd.h." + id, FKEY = (id) => "pc.fd.f." + id;
    const order = () => store.get("pc.fd.order", []) || [];
    const partsNow = (skip) => [...col.children].filter((x) => x !== skip && keyOfPart(x) && !x.classList.contains("off") && x.offsetParent !== null);
    function saveOrder() { store.set("pc.fd.order", [...col.children].map(keyOfPart).filter(Boolean)); }
    const titleOf = (id, r) => { const t = (r && r.title) || (P.get(id) || {}).title || id; return id === "ie.pending" ? "⏳ Pending" : t; };
    const defH = (id) => (/^bd\./.test(id) ? 380 : /^fd-/.test(id) ? 320 : id === "ie.pending" ? 280 : 260);
    const refEl = (k) => (k ? ([...col.children].find((x) => keyOfPart(x) === k) || null) : null);
    /** put slot w in the column by key (or the kept order) */
    function position(w, key) {
      const k = parseKey(key), me = keyOfPart(w);
      if (k.ref) { const ref = refEl(k.ref); if (ref && ref !== w) { if (k.how === "before") col.insertBefore(w, ref); else col.insertBefore(w, ref.nextSibling); return; } }
      if (k.how === "first") { col.insertBefore(w, col.firstChild); return; }
      const present = [...col.children].filter((x) => x !== w && keyOfPart(x)), i = placeIndex(order(), present.map(keyOfPart), me);
      if (i < present.length) col.insertBefore(w, present[i]); else col.appendChild(w);
    }
    function slot(id, key, r) {
      let w = slots.get(id);
      if (!w) {
        w = doc.createElement("div"); w.className = "pcfd"; w.dataset.fd = id;
        w.innerHTML = `<div class="pcfdh" title="Drag: to another place in the column, or out of it (it floats again)"><span>⠿</span><b></b>${(P.get(id) || r || {}).kind === "docker" ? '<button type="button" data-fdact="cfg" title="This docker\'s menu (rename, layout, delete)">⚙</button>' : ""}<button type="button" data-fdact="fold" title="Fold it to its bar / open it">▾</button><button type="button" data-fdact="out" title="Float it (out of the panel column)">⇱</button></div><div class="pcfdb"></div><div class="pcfdg" title="Drag to make it taller / shorter"></div>`;
        wire(w, id);
        slots.set(id, w);
      }
      w.querySelector(".pcfdh b").textContent = titleOf(id, r);
      position(w, key);
      const h = +store.get(HKEY(id), 0) || defH(id);
      w.querySelector(".pcfdb").style.height = Math.max(60, Math.min(1400, h)) + "px";
      w.classList.toggle("fold", !!store.get(FKEY(id), false));
      w.querySelector('[data-fdact="fold"]').textContent = w.classList.contains("fold") ? "▸" : "▾";
      if (!(P.restoring && P.restoring())) kx.classList.remove("side-off");   // a drop shows the column; a restore leaves it as it was
      saveOrder();
      tev("ie_coldock_in", id);
      root.setTimeout(() => { try { root.dispatchEvent(new root.Event("resize")); } catch (e) { /* fine */ } }, 0);
      return w.querySelector(".pcfdb");
    }
    function free(id) { const w = slots.get(id); if (!w) return; slots.delete(id); w.remove(); saveOrder(); tev("ie_coldock_out", id); }
    function keyOf(id) {
      const w = slots.get(id); if (!w) return null;
      let p = w.previousElementSibling; while (p && !keyOfPart(p)) p = p.previousElementSibling;
      return p ? "after:" + keyOfPart(p) : "first";
    }
    function zones(r) {
      const own = r && r.id ? slots.get(r.id) : null;
      return P.columnZones(partsNow(own).map((x) => ({ key: keyOfPart(x), rect: x.getBoundingClientRect() })), col.getBoundingClientRect());
    }
    function drop(id, key) {
      const r = P.get(id); if (!r) return;
      // the editor's own panel groups (pcpanels.js): home in the column, as before
      if (r.kind === "panel" && /^ie\./.test(id) && id !== "ie.pending") {
        const k = parseKey(key), ref = refEl(k.ref);
        P.placeAt(id, col, ref ? (k.how === "before" ? ref : ref.nextElementSibling) : null);
        saveOrder(); say(`${r.title || "the panels"} docked in the panel column`); return;
      }
      if (r.state === "zone" && r.zone && r.zone.host === HOST && slots.get(id)) { position(slots.get(id), key); saveOrder(); P.zoneInto(id, HOST, key); return; }
      P.zoneInto(id, HOST, key);
      say(`${titleOf(id, r)} docked in the panel column - drag its bar out (or ⇱) to float it again`);
    }
    P.zoneHost({ id: HOST, el: () => (kx.classList.contains("side-off") || !kx.isConnected ? null : col), zones, drop, slot, free, keyOf });

    /* ---- a docked docker's bar: drag (move / out), fold, float, its menu; its bottom edge sizes it */
    function wire(w, id) {
      const head = w.querySelector(".pcfdh");
      head.addEventListener("click", (e) => {
        const a = e.target.closest("[data-fdact]"); if (!a) return;
        e.stopPropagation();
        if (a.dataset.fdact === "fold") { const on = !w.classList.contains("fold"); w.classList.toggle("fold", on); store.set(FKEY(id), on); a.textContent = on ? "▸" : "▾"; root.dispatchEvent(new root.Event("resize")); }
        else if (a.dataset.fdact === "out") { const b = w.getBoundingClientRect(); P.zoneOut(id, { x: Math.max(0, b.left - 340), y: b.top, w: 320, h: Math.max(240, Math.min(560, b.height)) }); }
        else if (a.dataset.fdact === "cfg" && P.cfgMenu) P.cfgMenu(id, e.clientX, e.clientY);
      });
      head.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 || e.target.closest("button")) return;
        e.preventDefault();
        const x0 = e.clientX, y0 = e.clientY; let on = false, ghost = null, hit = null;
        const mv = (m) => {
          if (!on) { if (Math.hypot(m.clientX - x0, m.clientY - y0) < 7) return; on = true; ghost = doc.createElement("div"); ghost.className = "pcfdghost"; ghost.textContent = "⠿ " + titleOf(id); doc.body.appendChild(ghost); w.style.opacity = ".5"; }
          ghost.style.left = (m.clientX + 12) + "px"; ghost.style.top = (m.clientY + 8) + "px";
          hit = P.zoneAt(P.get(id) || {}, m.clientX, m.clientY);
          P.zoneMark(hit ? hit.zone.line : null);
        };
        const up = (m) => {
          win.removeEventListener("pointermove", mv, true); win.removeEventListener("pointerup", up, true);
          if (ghost) ghost.remove(); w.style.opacity = ""; P.zoneMark(null);
          if (!on) return;
          if (hit) { hit.host.drop(id, hit.zone.key); return; }
          const b = w.getBoundingClientRect();
          P.zoneOut(id, { x: Math.round(m.clientX - 60), y: Math.round(m.clientY - 12), w: Math.max(280, Math.round(b.width)), h: Math.max(220, Math.min(600, Math.round(b.height))) });
        };
        win.addEventListener("pointermove", mv, true); win.addEventListener("pointerup", up, true);
      });
      const g = w.querySelector(".pcfdg"), body = w.querySelector(".pcfdb");
      g.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return; e.preventDefault(); g.setPointerCapture(e.pointerId); g.classList.add("on");
        const y0 = e.clientY, h0 = body.getBoundingClientRect().height;
        const mv = (m) => { body.style.height = Math.max(60, Math.min(1400, Math.round(h0 + m.clientY - y0))) + "px"; };
        const up = () => { g.classList.remove("on"); g.removeEventListener("pointermove", mv); g.removeEventListener("pointerup", up); store.set(HKEY(id), Math.round(body.getBoundingClientRect().height)); root.dispatchEvent(new root.Event("resize")); };
        g.addEventListener("pointermove", mv); g.addEventListener("pointerup", up);
      });
    }

    /* ---- ⏳ Pending: a docker of the editor that docks here too (and floats on its own inside the editor) */
    const pend = E.pending && E.pending.panel;
    if (pend) {
      const r = P.adopt({ id: "ie.pending", title: "⏳ Pending", el: pend, home: { parent: kx, before: null }, scope: () => kx, confine: () => kx,
        onState: (s) => { pend.classList.toggle("pcpend-in", s === "zone"); if (s === "zone") pend.classList.remove("off"); } });
      if (r) r.floatOut = (at) => { P.home("ie.pending"); if (E.pending.moveTo) E.pending.moveTo(at); E.pending.show(); };
    }
    /** pcpending.js's title drag: over the column = its drop line; let go there = docked */
    function hover(x, y, id) { const h = P.zoneAt(P.get(id || "ie.pending") || {}, x, y); P.zoneMark(h ? h.zone.line : null); return h; }
    function dropAt(x, y, id) { const h = P.zoneAt(P.get(id || "ie.pending") || {}, x, y); P.zoneMark(null); if (!h) return false; h.host.drop(id || "ie.pending", h.zone.key); return true; }
    E.coldock = { hover, drop: dropAt, slots: () => [...slots.keys()], keyOf, HOST };
    // the editor's own groups settle (pctabdock.js puts its kept layout back): the docked dockers to their kept places
    const resort = () => { for (const [id, w] of slots) position(w, null); };
    win.setTimeout(resort, 1200); win.setTimeout(resort, 3500);
  }
  const api = Object.assign({ install }, pure);
  root.PCColDock = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
