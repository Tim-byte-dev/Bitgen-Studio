/* pcselhl.js — PICKING OBJECTS LIKE A DRAWING / CAD PROGRAM (2.470.0), window.PCSelHl.
 *
 * Tim (verbatim): "on mouseover of a shape or object or smart object, highlight the border of the shape to show it can be
 * selected, then use a different highlight color when it is selected. automatically select the move tool once the
 * shape is drawn (on mouseup) when i click away from the shape deselect it - impliment standard drawing/cad".
 *
 *   HOVER      with the Move tool, the object under the pointer (a shape, a smart object, text, a sketch, a 3D layer,
 *              a picture layer's content - not the background) shows its outline in HOVER blue
 *   SELECTED   the picked object's outline in SELECTED orange (+ the Move tool's handles, pchandles.js)
 *   CLICK      on an object = it is picked (and dragging moves it); on empty canvas = nothing picked (the handles go,
 *              a drag there moves nothing); Esc = nothing picked. A pick in the Layers panel picks it again.
 *   AFTER DRAWING   a shape drawn with a drag tool (Shape, Custom Shape, the CorelDRAW rectangle / ellipse / polygon /
 *              star / spiral / graph paper / common shapes, 2-Point Line) -> the Move tool, the new shape picked
 *              (Preferences: store "draw.automove", on by default; the CAD toolbar's ⚙ switches it)
 * 2.474.0: also with NO TOOL (Esc - pcmultisel.js); Shift / Ctrl-click adds / takes away; several picked move together.
 * Pure (Node: scripts/test-selhl.js): COLORS, AUTO_MOVE, isBackground(L, layers, box, w, h), pickable(L).
 */
(function (root) {
  "use strict";
  const COLORS = { hover: "#3aa0ff", selected: "#ff8a00" };
  const AUTO_MOVE = ["shape", "customshape", "crect", "cellipse", "cpolygon", "cstar", "ccstar", "cspiral", "cgraph", "ccommon", "line2"];
  /** the bottom layer that fills the picture is the canvas, not an object */
  function isBackground(L, layers, box, w, h) {
    if (!L || L.type !== "pixel") return false;
    if (layers.indexOf(L) !== 0) return false;
    return !!box && box.x <= 1 && box.y <= 1 && box.w >= w - 2 && box.h >= h - 2;
  }
  const pickable = (L) => !!L && L.type !== "group" && L.type !== "adjust" && !L.control && !(L.type === "fill" && !L.mask) && !(L.locks && (L.locks.all || L.locks.pos));
  const pure = { COLORS, AUTO_MOVE, isBackground, pickable };

  function install(E) {
    const { S, store } = E, stage = E.stage, D = E.D || root.PCDoc;
    if (!stage || !E.overlayHooks || !E.layerAt || !E.dockers || !E.dockers.boxOf) return;
    if (S.objSel == null) S.objSel = true;
    let hover = null, lastActive = S.active, boxCache = new Map();
    const boxOf = (L) => { const k = L.id + ":" + (L.ver || 0) + ":" + S.w + "x" + S.h + ":" + JSON.stringify([L.text && [L.text.x, L.text.y, L.text.rot], L.smart && L.smart.t, L.shape && L.shape.x]); const c = boxCache.get(L.id); if (c && c.k === k) return c.b; const b = E.dockers.boxOf(L); boxCache.set(L.id, { k, b }); return b; };
    const objectAt = (x, y) => {
      const i = E.layerAt(Math.floor(x), Math.floor(y)); if (i < 0) return null;
      const L = S.layers[i]; if (!pickable(L) || isBackground(L, S.layers, boxOf(L), S.w, S.h)) return null;
      return L;
    };
    const insideActive = (x, y) => { const L = E.layer(); if (!L || !pickable(L)) return false; if (L.type !== "pixel" && L.type !== "shape") { const b = boxOf(L); return !!b && x >= b.x && y >= b.y && x <= b.x + b.w && y <= b.y + b.h; } const g = L.canvas && L.canvas.getContext("2d"); if (!g) return false; const X = Math.floor(x), Y = Math.floor(y); if (X < 0 || Y < 0 || X >= S.w || Y >= S.h) return false; return g.getImageData(X, Y, 1, 1).data[3] > 8; };
    /** the outline of a layer: its path (shapes), its quad (smart objects), else its box */
    function outline(g, L, px, color, w) {
      g.save(); g.strokeStyle = color; g.lineWidth = w * px; g.setLineDash([]);
      const Q = root.PCPath;
      g.beginPath();
      if (L.type === "shape" && L.shape && Q) {
        const p = L.shape.kind === "path" && L.shape.path ? L.shape.path : (Q.fromShape ? Q.fromShape(L.shape) : null);
        if (p && Q.traceAll) Q.traceAll(g, p); else if (D && D.shapePath) D.shapePath(g, L.shape);
      } else if (L.type === "smart" && L.smart && L.smart.t && L.smart.t.quad && !L.smart.t.warp) {
        L.smart.t.quad.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
      } else { const b = boxOf(L); if (b && b.w > 0 && b.h > 0) g.rect(b.x, b.y, b.w, b.h); }
      // a white halo under the colour: it shows on any picture
      g.save(); g.strokeStyle = "rgba(255,255,255,.65)"; g.lineWidth = (w + 2) * px; g.stroke(); g.restore();
      g.stroke(); g.restore();
    }
    E.overlayHooks.push((g, px) => {
      if (S.active !== lastActive) { lastActive = S.active; S.objSel = true; }        // picked again (Layers panel, a command…)
      if ((S.tool !== "move" && S.tool !== "none") || !S.w || S.drag) return;   // 2.474.0: + no tool (pcmultisel.js)
      const A = E.layer(), sel = S.objSel !== false && pickable(A) && !isBackground(A, S.layers, boxOf(A), S.w, S.h) ? A : null;
      if (hover && hover !== sel && S.layers.includes(hover)) outline(g, hover, px, COLORS.hover, 1.6);
      if (sel) outline(g, sel, px, COLORS.selected, 2);
    });
    stage.addEventListener("pointermove", (e) => {
      if ((S.tool !== "move" && S.tool !== "none") || !S.w || S.drag || e.buttons) { if (hover && S.tool !== "move" && S.tool !== "none") { hover = null; } return; }
      const [x, y] = E.pos(e), L = objectAt(x, y);
      if (L !== hover) { hover = L; E.drawOverlay(); }
    });
    stage.addEventListener("pointerleave", () => { if (hover) { hover = null; E.drawOverlay(); } });
    // a click: on an object = pick it (the Move tool then moves it); on nothing = nothing picked (and nothing moves)
    const onPicture = (t) => t === stage || (E.paper && E.paper.contains(t)) || (t && t.tagName === "CANVAS" && stage.contains(t) && !(t.closest && t.closest("[id^=pcRuler],.pcruler")));
    stage.addEventListener("pointerdown", (e) => {
      if (S.tool !== "move" || !S.w || e.button !== 0 || S.space || S.autoSelect || E.hasSel()) return;   // a selection: the Move tool moves its pixels (as before); Auto-select keeps its own picking
      if (!onPicture(e.target)) return;                                                  // the rulers, a handle, a frame's button… keep the press
      const [x, y] = E.pos(e);
      const M = E.multi, add = e.shiftKey || e.ctrlKey || e.metaKey;
      if (!add && M && M.count() > 1 && M.hit(x, y)) return;                             // 2.474.0: one of several picked: the core moves them all
      if (!add && S.objSel !== false && insideActive(x, y)) return;                       // the picked one: drag it
      const inside = x >= 0 && y >= 0 && x < S.w && y < S.h, i0 = inside ? E.layerAt(Math.floor(x), Math.floor(y)) : -1;
      const L = i0 >= 0 ? objectAt(x, y) : null;
      if (L && add && M) { e.stopImmediatePropagation(); e.preventDefault(); M.toggle(L); lastActive = S.active; S.objSel = true; E.drawOverlay(); return; }   // 2.474.0: Shift / Ctrl adds or takes away
      if (L) { if (M && !M.has(L)) M.clear(); const i = S.layers.indexOf(L); if (i !== S.active) E.setActive(i); lastActive = S.active; S.objSel = true; E.drawOverlay(); return; }
      if (i0 >= 0 && !isBackground(S.layers[i0], S.layers, boxOf(S.layers[i0]), S.w, S.h)) { S.objSel = true; lastActive = -1; return; }   // a group's part, a dimension… the core picks it
      if (e.shiftKey || e.ctrlKey || e.metaKey) return;
      e.stopImmediatePropagation(); e.preventDefault();
      if (M && M.count()) M.clear();
      if (S.objSel !== false) { S.objSel = false; E.drawOverlay(); if (E.renderOptions) E.renderOptions(); }
    }, true);
    // Esc with the Move tool: nothing picked
    const keyBase = E.ui.key;
    E.ui.key = (e) => { if (S.tool === "move" && !S.drag && e.key === "Escape" && !e.ctrlKey && !e.metaKey && S.objSel !== false) { S.objSel = false; E.drawOverlay(); return true; } return keyBase ? keyBase(e) : false; };
    // a click on a layer in the Layers panel picks it (also the one already active)
    E.doc.addEventListener("pointerdown", (e) => { const row = e.target && e.target.closest && e.target.closest(".kxlayer"); if (row && E.host && E.host.contains(row)) { S.objSel = true; root.setTimeout(() => { lastActive = S.active; E.drawOverlay(); }, 0); } }, true);
    // after a shape is drawn: the Move tool, the new shape picked
    let drawing = null, held = false;                 // held: switched off for now (not saved) - E.selHl.hold(true)
    stage.addEventListener("pointerdown", (e) => { drawing = AUTO_MOVE.includes(S.tool) && e.button === 0 ? { tool: S.tool, ids: new Set(S.layers.map((L) => L.id)) } : null; }, true);
    stage.addEventListener("pointerup", () => {
      const d = drawing; drawing = null;
      if (!d || store.get("draw.automove", true) === false || held) return;
      root.setTimeout(() => {
        const A = E.layer();
        if (!A || d.ids.has(A.id) || S.tool !== d.tool) return;                      // nothing new (a click that drew nothing)
        E.setTool("move"); S.objSel = true; lastActive = S.active; E.drawOverlay();
      }, 0);
    });
    E.selHl = { hover: () => hover, objectAt, pick: (L) => { const i = S.layers.indexOf(L); if (i >= 0) E.setActive(i); S.objSel = true; lastActive = S.active; E.drawOverlay(); }, deselect: () => { S.objSel = false; E.drawOverlay(); },
      hold: (v) => { held = !!v; return held; },
      autoMove: (v) => { if (v != null) store.set("draw.automove", !!v); return store.get("draw.automove", true) !== false; } };
  }
  const PCSelHl = Object.assign({ install }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = PCSelHl;
  else root.PCSelHl = PCSelHl;
})(typeof window !== "undefined" ? window : globalThis);
