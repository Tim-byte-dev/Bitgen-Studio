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
 * 2.605.0 (Tim: "when user hovers over text don't show the thick bounding box,do this with all drawing objects show the
 *   same one as the move tool, if user clicks on the element select it and automatically go to the move tool"): hover
 *   and a picked object with no tool show the MOVE TOOL'S FRAME (thin, dashed, pchandles.js) - no thick outline; with a
 *   drawing tool (AUTO_MOVE) and the Type tools (texts only) the object under the pointer shows it too, and a CLICK (no
 *   drag) with a drawing tool on an object picks it and switches to the Move tool.
 * Pure (Node: scripts/test-selhl.js): COLORS, AUTO_MOVE, isBackground(L, layers, box, w, h), pickable(L).
 */
(function (root) {
  "use strict";
  const COLORS = { hover: "#3aa0ff", selected: "#ff8a00" };
  const AUTO_MOVE = ["shape", "customshape", "crect", "cellipse", "cpolygon", "cstar", "ccstar", "cspiral", "cgraph", "ccommon", "line2"];
  // 2.605.0: the tools an object under the pointer shows its frame with; a CLICK (no drag) on one with a drawing tool picks
  // it and goes to the Move tool (a drag still draws a new one); with a Type tool a click on a text edits it (pctools)
  const TYPE_TOOLS = ["type", "vtype"];
  const HOVER_TOOLS = ["move", "none"].concat(AUTO_MOVE, TYPE_TOOLS);
  /** the bottom layer that fills the picture is the canvas, not an object */
  function isBackground(L, layers, box, w, h) {
    if (!L || L.type !== "pixel") return false;
    if (layers.indexOf(L) !== 0) return false;
    return !!box && box.x <= 1 && box.y <= 1 && box.w >= w - 2 && box.h >= h - 2;
  }
  const pickable = (L) => !!L && L.type !== "group" && L.type !== "adjust" && !L.control && !(L.type === "fill" && !L.mask) && !(L.locks && (L.locks.all || L.locks.pos));
  const pure = { COLORS, AUTO_MOVE, HOVER_TOOLS, TYPE_TOOLS, isBackground, pickable };

  function install(E) {
    const { S, store } = E, stage = E.stage, D = E.D || root.PCDoc, say = E.say || (() => {});
    if (!stage || !E.overlayHooks || !E.layerAt || !E.dockers || !E.dockers.boxOf) return;
    if (S.objSel == null) S.objSel = true;
    let hover = null, lastActive = S.active, boxCache = new Map();
    const hoverTool = () => HOVER_TOOLS.includes(S.tool);
    const boxOf = (L) => { const k = L.id + ":" + (L.ver || 0) + ":" + S.w + "x" + S.h + ":" + JSON.stringify([L.text && [L.text.x, L.text.y, L.text.rot, L.text.xm], L.smart && L.smart.t, L.shape && L.shape.x]); const c = boxCache.get(L.id); if (c && c.k === k) return c.b; const b = E.dockers.boxOf(L); boxCache.set(L.id, { k, b }); return b; };
    const objectAt = (x, y) => {
      const i = E.layerAt(Math.floor(x), Math.floor(y));
      // 2.605.0: a TEXT is hit anywhere in its box (between its letters too), when it is above what the pixels hit
      for (let k = S.layers.length - 1; k > i; k--) {
        const T = S.layers[k];
        if (T.type !== "text" || !pickable(T) || (D && D.shown && !D.shown(S.layers, T))) continue;
        const b = boxOf(T); if (b && x >= b.x - 2 && y >= b.y - 2 && x <= b.x + b.w + 2 && y <= b.y + b.h + 2) return T;
      }
      if (i < 0) return null;
      const L = S.layers[i]; if (!pickable(L) || isBackground(L, S.layers, boxOf(L), S.w, S.h)) return null;
      return L;
    };
    const insideActive = (x, y) => { const L = E.layer(); if (!L || !pickable(L)) return false; if (L.type !== "pixel" && L.type !== "shape") { const b = boxOf(L); return !!b && x >= b.x && y >= b.y && x <= b.x + b.w && y <= b.y + b.h; } const g = L.canvas && L.canvas.getContext("2d"); if (!g) return false; const X = Math.floor(x), Y = Math.floor(y); if (X < 0 || Y < 0 || X >= S.w || Y >= S.h) return false; return g.getImageData(X, Y, 1, 1).data[3] > 8; };
    /* 2.605.0 (Tim: "when user hovers over text don't show the thick bounding box,do this with all drawing objects show
       the same one as the move tool"): THE MOVE TOOL'S FRAME - the thin dashed box its handles sit on (pchandles.js: 1 px,
       #2680eb, 4 / 3 dashes; a smart object's quad) - for an object under the pointer and for a picked one with no tool */
    function frame(g, L, px) {
      g.save(); g.strokeStyle = "#2680eb"; g.lineWidth = 1 * px; g.setLineDash([4 * px, 3 * px]);
      if (L.type === "smart" && L.smart && L.smart.t && L.smart.t.quad && !L.smart.t.warp) {
        g.beginPath(); L.smart.t.quad.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke();
      } else { const b = boxOf(L); if (b && b.w > 0 && b.h > 0) g.strokeRect(b.x, b.y, b.w, b.h); }
      g.restore();
    }
    E.overlayHooks.push((g, px) => {
      if (S.active !== lastActive) { lastActive = S.active; S.objSel = true; }        // picked again (Layers panel, a command…)
      if (!hoverTool() || !S.w || S.drag) return;                                     // 2.474.0: + no tool (pcmultisel.js); 2.605.0: + the drawing tools
      const A = E.layer(), sel = (S.tool === "move" || S.tool === "none") && S.objSel !== false && pickable(A) && !isBackground(A, S.layers, boxOf(A), S.w, S.h) ? A : null;
      if (hover && hover !== sel && S.layers.includes(hover)) frame(g, hover, px);
      // 2.604.0: with the Move tool the picked object shows only its handles' frame (pchandles.js); with no tool the same frame
      if (sel && S.tool !== "move") frame(g, sel, px);
    });
    stage.addEventListener("pointermove", (e) => {
      if (!hoverTool() || !S.w || S.drag || e.buttons) { if (hover && !hoverTool()) { hover = null; E.drawOverlay(); } return; }
      const [x, y] = E.pos(e), L0 = objectAt(x, y), L = L0 && TYPE_TOOLS.includes(S.tool) && L0.type !== "text" ? null : L0;   // the Type tools: only a text
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
    // 2.606.0: …and with a drawing / Type tool in hand, the Move tool comes on (a row's buttons - eye, lock… - are not a pick)
    E.doc.addEventListener("pointerdown", (e) => { const row = e.target && e.target.closest && e.target.closest(".kxlayer"); if (row && E.host && E.host.contains(row)) { const sw = (AUTO_MOVE.includes(S.tool) || TYPE_TOOLS.includes(S.tool)) && !(e.target.closest && e.target.closest("button, input, .eye, .tw, .fx")); S.objSel = true; root.setTimeout(() => { if (sw && E.endText) E.endText(); if (sw) E.setTool("move"); lastActive = S.active; E.drawOverlay(); }, 0); } }, true);
    // after a shape is drawn: the Move tool, the new shape picked
    let drawing = null, held = false;                 // held: switched off for now (not saved) - E.selHl.hold(true)
    stage.addEventListener("pointerdown", (e) => {
      if (!(AUTO_MOVE.includes(S.tool) && e.button === 0)) { drawing = null; return; }
      const [x, y] = E.pos(e);
      drawing = { tool: S.tool, ids: new Set(S.layers.map((L) => L.id)), at: [e.clientX, e.clientY], obj: objectAt(x, y) };   // 2.605.0: + what is under the press
    }, true);
    stage.addEventListener("pointerup", (e) => {
      const d = drawing; drawing = null;
      if (!d) return;
      const click = !!(e && Math.hypot(e.clientX - d.at[0], e.clientY - d.at[1]) < 4);
      root.setTimeout(() => {
        const A = E.layer();
        if (A && !d.ids.has(A.id) && S.tool === d.tool) {                             // a new shape was drawn
          if (store.get("draw.automove", true) === false || held) return;
          E.setTool("move"); S.objSel = true; lastActive = S.active; E.drawOverlay(); return;
        }
        // 2.605.0 (Tim: "if user clicks on the element select it and automatically go to the move tool"): a click that drew
        // nothing, on an object = it is picked and the Move tool is on (a drag over an object still draws a new one)
        if (click && d.obj && S.layers.includes(d.obj) && S.tool === d.tool) {
          const i = S.layers.indexOf(d.obj); if (i !== S.active) E.setActive(i);
          E.setTool("move"); S.objSel = true; lastActive = S.active; hover = null; E.drawOverlay();
          if (E.renderOptions) E.renderOptions();
          say(`${d.obj.name || "the object"} picked - the Move tool (drag it, its handles scale / rotate)`);
        }
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
