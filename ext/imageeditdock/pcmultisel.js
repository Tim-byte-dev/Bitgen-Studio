/* pcmultisel.js — NO TOOL, THE SELECTION BOX AND SEVERAL LAYERS PICKED AT ONCE (2.474.0), window.PCMultiSel.
 *
 * Tim (verbatim): "esc deselects all tools. when no tool selected click and drag shows a dashed bounding box that
 * selects everything in the bounding box. shift + select layer in layer docker selects every layer between the 2
 * shift+click layers, ctrl+click adds or removes layers from the selection. del deletes all selected layers."
 *
 *   Esc            no tool (and nothing picked); Esc again = what it did before (leave full screen…). A tool's own
 *                  Esc (a crop, a pen path, a polygon lasso) still comes first.
 *   NO TOOL        hover = the blue outline; click an object = it is picked (Shift / Ctrl = add or take away);
 *                  drag on the picture = a DASHED BOX: left to right picks what is wholly inside, right to left
 *                  what it touches (as CAD programs do); Shift adds to what is picked
 *   LAYERS PANEL   click = one layer; Shift-click = every layer between the last clicked and this one; Ctrl-click
 *                  = add / take away one (the picked ones stay numbered 1, 2, 3 for ✨ Compose / → References)
 *   MOVE TOOL      a drag on any of several picked layers moves them all (one undo step)
 *   DEL            deletes every picked layer (one undo step; with a pixel selection it still clears the pixels)
 * The picked layers are S.picks (layer ids, in the order picked) + the active layer. E.multi.
 * Pure (Node: scripts/test-multisel.js): boxPick(boxes, rect, crossing), rangeIds(order, a, b), norm(rect).
 */
(function (root) {
  "use strict";
  const norm = (r) => ({ x: Math.min(r.x0, r.x1), y: Math.min(r.y0, r.y1), w: Math.abs(r.x1 - r.x0), h: Math.abs(r.y1 - r.y0) });
  /** boxes [{id, b: {x, y, w, h}}] in the rectangle: wholly inside (window) or touching it (crossing) -> ids */
  function boxPick(boxes, rect, crossing) {
    const R = norm(rect);
    return boxes.filter(({ b }) => b && b.w > 0 && b.h > 0 && (crossing
      ? b.x < R.x + R.w && b.x + b.w > R.x && b.y < R.y + R.h && b.y + b.h > R.y
      : b.x >= R.x && b.y >= R.y && b.x + b.w <= R.x + R.w && b.y + b.h <= R.y + R.h)).map((o) => o.id);
  }
  /** the ids from a to b (inclusive) in `order` (the panel's top-to-bottom order) */
  function rangeIds(order, a, b) {
    const i = order.indexOf(a), j = order.indexOf(b); if (i < 0 || j < 0) return j >= 0 ? [b] : [];
    return order.slice(Math.min(i, j), Math.max(i, j) + 1);
  }
  const pure = { norm, boxPick, rangeIds };

  function install(E) {
    const { S, D, say } = E, SH = root.PCSelHl;
    if (!E.stage || !E.overlayHooks || !E.dockers || !E.dockers.boxOf) return;
    S.picks = S.picks || [];
    const byId = (id) => S.layers.find((x) => x.id === id) || null;
    const pickable = (L) => !!L && (SH ? SH.pickable(L) && !SH.isBackground(L, S.layers, E.dockers.boxOf(L), S.w, S.h) : L.type !== "group");
    const tidy = () => { S.picks = (S.picks || []).filter((id) => S.layers.some((x) => x.id === id)); return S.picks; };
    const repaint = () => { E.renderLayersPanel(); E.drawOverlay(); };
    /** the picked layers (the active one too, when something is picked) */
    function list() { tidy(); const A = E.layer(); const ids = S.picks.slice(); if (A && S.objSel !== false && ids.length && !ids.includes(A.id)) ids.push(A.id); return ids.map(byId).filter(Boolean); }
    const count = () => list().length;
    const has = (L) => tidy().includes(L.id);
    function clear() { if (S.picks.length) { S.picks = []; repaint(); } }
    function set(ids, active) {
      S.picks = ids.slice(); const A = active != null ? byId(active) : byId(ids[ids.length - 1]);
      if (A) { const i = S.layers.indexOf(A); if (i !== S.active) E.setActive(i); }
      S.objSel = ids.length > 0 || S.objSel; repaint();
    }
    /** add / take away one layer (the active one joins first, so Ctrl-click makes two) */
    function toggle(L) {
      tidy(); const A = E.layer();
      if (!S.picks.length && A && A !== L && S.objSel !== false) S.picks.push(A.id);
      const at = S.picks.indexOf(L.id);
      if (at >= 0) { S.picks.splice(at, 1); const last = byId(S.picks[S.picks.length - 1]); if (last) E.setActive(S.layers.indexOf(last)); }
      else { S.picks.push(L.id); E.setActive(S.layers.indexOf(L)); }
      S.objSel = true; repaint();
      say(S.picks.length ? `${S.picks.length} layer(s) picked - Del deletes them, the Move tool moves them together` : "nothing picked");
    }
    /** a press at (x, y) on one of several picked layers (its box) */
    function hit(x, y) { return list().some((L) => { const b = E.dockers.boxOf(L); return b && x >= b.x && y >= b.y && x <= b.x + b.w && y <= b.y + b.h; }); }
    /** the core's Move tool asks: several picked and the press on one of them -> move them all */
    E.multiMove = (x, y) => { const L = list(); return L.length > 1 && hit(x, y) ? L.filter((l) => !(l.locks && (l.locks.all || l.locks.pos))) : null; };
    /** Del: every picked layer, one undo step */
    function deleteAll() {
      const L = list(); if (L.length < 2) return false;
      const ids = new Set(L.map((x) => x.id));
      return E.structOp("delete layers", () => {
        let left = S.layers;
        for (const id of ids) left = D.remove(left, id);
        if (!left.length) { say("the last layer stays"); return false; }
        const i = S.active; S.layers = left; S.picks = []; S.active = Math.max(0, Math.min(i - ids.size, S.layers.length - 1)); S.maskEdit = false; S.objSel = false;
      }) && (say(`${ids.size} layers deleted`), true);
    }

    /* ---- NO TOOL: hover, click, the dashed selection box */
    let box = null;
    E.tools.none = {
      id: "none", name: "No tool", cursor: "default",
      options: () => '<span class="tn">No tool</span><span class="sep"></span><span style="color:var(--pc-dim)">click an object to pick it (Shift / Ctrl adds) · drag a box: left to right = what is wholly inside, right to left = what it touches · Del deletes what is picked · a tool letter (V, M, B…) picks a tool</span>',
      down(e, x, y) {
        const add = e.shiftKey || e.ctrlKey || e.metaKey, i = x >= 0 && y >= 0 && x < S.w && y < S.h ? E.layerAt(Math.floor(x), Math.floor(y)) : -1, L = i >= 0 ? S.layers[i] : null;
        if (L && pickable(L)) {
          if (add) toggle(L); else { if (!has(L)) S.picks = []; E.setActive(i); S.objSel = true; repaint(); }
          box = null; return false;                                                         // a click picks - nothing to drag
        }
        box = { x0: x, y0: y, x1: x, y1: y, add, before: add ? list().map((l) => l.id) : [] };
        return true;
      },
      move(e, x, y) { if (!box) return; box.x1 = x; box.y1 = y; E.drawOverlay(); },
      up(e, x, y) {
        if (!box) return; const b = box; box = null; b.x1 = x; b.y1 = y;
        const R = norm(b);
        if (R.w < 3 && R.h < 3) { if (!b.add) { S.picks = []; S.objSel = false; } repaint(); return; }   // a click on nothing: nothing picked
        const crossing = b.x1 < b.x0;
        const boxes = S.layers.filter((L) => pickable(L) && L.visible !== false && D.shown(S.layers, L)).map((L) => ({ id: L.id, b: E.dockers.boxOf(L) }));
        const got = boxPick(boxes, b, crossing), ids = b.add ? Array.from(new Set(b.before.concat(got))) : got;
        if (!ids.length) { S.picks = []; S.objSel = false; repaint(); say("nothing in the box"); return; }
        set(ids); S.objSel = true; E.drawOverlay();
        say(`${ids.length} layer(s) picked (${crossing ? "touching" : "wholly inside"} the box) - Del deletes them, V moves them together`);
      },
    };
    E.overlayHooks.push((g, px) => {
      // the dashed box
      if (box) {
        const R = norm(box), crossing = box.x1 < box.x0;
        g.save(); g.lineWidth = px; g.setLineDash([6 * px, 4 * px]); g.strokeStyle = crossing ? "#3fb950" : "#3aa0ff"; g.fillStyle = crossing ? "rgba(63,185,80,.08)" : "rgba(58,160,255,.08)";
        g.fillRect(R.x, R.y, R.w, R.h); g.strokeRect(R.x, R.y, R.w, R.h); g.restore();
      }
      // every picked layer outlined (the active one has its own outline + handles)
      const L = list(); if (L.length < 2 || !S.w) return;
      g.save(); g.lineWidth = 1.4 * px; g.setLineDash([5 * px, 3 * px]); g.strokeStyle = "#ff8a00";
      for (const x of L) { const b = E.dockers.boxOf(x); if (b && b.w > 0) g.strokeRect(b.x, b.y, b.w, b.h); }
      g.restore();
    });
    /* ---- Esc = no tool (after the tool's own Esc and the pending things the core cancels); Del = every picked layer */
    const keyBase = E.ui.key;
    E.ui.key = (e) => {
      const k = (e.key || "").toLowerCase();
      if (k === "escape" && !e.ctrlKey && !e.metaKey && !e.altKey && S.w) {
        const pending = (S.pts && S.pts.length) || (S.results && S.results.length) || S.viewMask || S.drag;
        if (!pending && S.tool !== "none") {
          S.picks = []; S.objSel = false; E.setTool("none"); repaint();
          say("no tool - drag a box to pick layers, or press a tool's letter (V = Move)");
          return true;
        }
        if (!pending && (S.picks.length || S.objSel !== false)) { S.picks = []; S.objSel = false; repaint(); return true; }
      }
      if ((k === "delete" || k === "del") && !e.ctrlKey && !e.metaKey && !E.hasSel() && list().length > 1) { deleteAll(); return true; }
      return keyBase ? keyBase(e) : false;
    };
    E.multi = { list, count, has, clear, set, toggle, hit, deleteAll, box: () => box && norm(box) };
  }
  const PCMultiSel = Object.assign({ install }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = PCMultiSel;
  else root.PCMultiSel = PCMultiSel;
})(typeof window !== "undefined" ? window : globalThis);
