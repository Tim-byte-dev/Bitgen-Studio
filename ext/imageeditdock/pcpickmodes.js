/* pcpickmodes.js — CLEAR EVERY SELECTION, THE LINE WHILE DRAWING A SELECTION, THE SHAPE MODES, DOUBLE-CLICK TO
 * TRANSFORM (2.819.0), window.PCPickModes.
 *
 * Tim (verbatim): "in image-edit docker ... when user presses button to combine,add,subtract,intersect shape go into
 * that mode, when using freehand select mask , show the line the user is drawing as they are drawing so they have a
 * visual reference, same with the pen tools. double click on a shape or layer will put it in move transform mode,
 * don't show the bounding box, only show the handles. when user clicks on the same shape again , change the tranform
 * resize/skew handles to rotate handles. ... ctrl+shift+A clears all selections"
 *
 *   CTRL+SHIFT+A    Select ▸ Clear All Selections: the selected area (marching ants), the picked object(s) (one or several -
 *                   Ctrl / Shift-click), the numbered picks in Layers, the picked nodes of the pen / curve tools - all
 *                   at once. The active layer stays active (painting goes on it). Align and Distribute keeps its menu
 *                   item (Window ▸ Dockers) without a key.
 *   THE LINE        the Lasso's and the Polygonal Lasso's line is drawn black under white dashes (it was white only -
 *                   nothing showed on a white picture), with the line back to the start (Lasso: where it will close)
 *                   or on to the pointer (Polygonal Lasso: the next side). The Bézier tool shows its next segment
 *                   following the pointer, like the Pen (pcvline.js).
 *   THE MODES       ◻ New ⊕ Add ⊖ Subtract ⊗ Intersect ⊘ Exclude are ONE mode for every shape tool now (the Shape tool's
 *                   Ops, the curve / rectangle tools' draw mode, the Pen in Shape mode used to keep their own). A vector
 *                   shape picked (any tool) shows the five on the property bar; a press there GOES INTO that mode: the
 *                   last tool used that draws a closed shape comes on (the Shape tool the first time), the status line says what the next
 *                   shape does, and while a mode other than New is on its sign rides beside the pointer (⊕ ⊖ ⊗ ⊘ ⇄).
 *   DOUBLE-CLICK    on an object on the canvas (no tool, Object Selection, or after a click picked it) or on a layer's
 *                   row in Layers: the Move tool, that layer picked, its scale handles - no box round it, the handles
 *                   alone (pchandles.js); a click on it again = the rotate / skew handles, again = scale.
 *
 * Pure (Node: scripts/test-pickmodes819.js): MODES, GLYPH, DRAW_TOOLS, opFor, syncedOps, rubberOf.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const MODES = ["new", "add", "subtract", "intersect", "exclude"];
  const GLYPH = { new: "◻", add: "⊕", subtract: "⊖", intersect: "⊗", exclude: "⊘", replace: "⇄" };
  const NAMES = { new: "New shape", add: "Add to the picked shape", subtract: "Subtract from the picked shape", intersect: "Intersect with the picked shape", exclude: "Exclude where they overlap", replace: "Replace the picked shape" };
  const SHAPE_TOOLS = ["shape"];
  const PEN_TOOLS = ["pen", "freepen"];
  const CURVE_TOOLS = ["crect", "cellipse", "cpolygon", "cstar", "ccstar", "cspiral", "cgraph", "ccommon", "freehand", "line2", "polyline", "curve3", "bspline", "bezier", "cpen", "curvpen", "customshape"];
  const DRAW_TOOLS = SHAPE_TOOLS.concat(PEN_TOOLS, CURVE_TOOLS);
  /** the tools that draw a CLOSED shape - a mode button brings back the last one used (the Shape tool the first time) */
  const CLOSED_TOOLS = ["shape", "customshape", "crect", "cellipse", "cpolygon", "cstar", "ccstar", "ccommon", "pen", "freepen"];
  /** the mode the tool in hand draws in (S = the editor's state) */
  function opFor(tool, S) {
    if (SHAPE_TOOLS.includes(tool)) return S.shapeOp || "new";
    if (PEN_TOOLS.includes(tool)) return S.penMode === "shape" || !S.penMode ? S.penOp || "new" : "new";
    if (CURVE_TOOLS.includes(tool)) return S.drawOp || "new";
    return "new";
  }
  /** the three tool families' settings for one mode m: {shapeOp, drawOp, penOp} (Replace is the Shape tool's own) */
  function syncedOps(m) {
    const k = MODES.includes(m) || m === "replace" ? m : "new";
    return { shapeOp: k, drawOp: k === "replace" ? "new" : k, penOp: k === "replace" ? "new" : k };
  }
  /** the extra line while a selection is drawn: [x0, y0, x1, y1] | null - Lasso (dragging): its end back to its start;
   *  Polygonal Lasso: its last point on to the pointer */
  function rubberOf(tool, pts, cursor, dragging, o) {
    if (!pts || !pts.length) return null;
    const a = pts[pts.length - 1];
    if (tool === "poly") return cursor ? [a[0], a[1], cursor[0], cursor[1]] : null;
    // 2.830.0: a lasso closes only when it ends within 5 px of its start (o.closeR) - the line back to the start is shown only
    // then; an OPEN lasso (let go elsewhere, o.open) shows a straight side from its end to the pointer
    if (tool === "lasso" && dragging && pts.length > 2) return !o || o.closeR == null || Math.hypot(a[0] - pts[0][0], a[1] - pts[0][1]) <= o.closeR ? [a[0], a[1], pts[0][0], pts[0][1]] : null;
    if (tool === "lasso" && !dragging && o && o.open && cursor) return [a[0], a[1], cursor[0], cursor[1]];
    return null;
  }
  const pure = { MODES, GLYPH, NAMES, DRAW_TOOLS, CLOSED_TOOLS, SHAPE_TOOLS, PEN_TOOLS, CURVE_TOOLS, opFor, syncedOps, rubberOf };

  /* ================================ the editor ================================ */
  function install(E) {
    const { S, doc, say, store } = E;
    if (!E.stage || !E.overlayHooks || !E.ui || !E.ui.addCmd) return;
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const isShapeL = (L) => !!(L && L.type === "shape" && L.shape);
    let cursor = null, lastDraw = store.get("pm.lastdraw", "shape");

    /* ---- Ctrl+Shift+A: every selection cleared */
    function clearAll() {
      if (!S.w) return say("open a picture first");
      const n = [];
      if (E.hasSel && E.hasSel()) { E.deselect(); n.push("the selected area"); }
      if (E.multi && E.multi.count && E.multi.count() > 1) { E.multi.clear(); n.push("the picked objects"); }
      else if (S.objSel !== false && E.layer()) n.push("the picked object");
      if (E.selHl && E.selHl.deselect) E.selHl.deselect(); S.objSel = false;
      if (S.picks && S.picks.length) { S.picks = []; n.push("the picks in Layers"); }
      for (const f of E.clearSelHooks || []) { try { f(); } catch (e) { /* a module's own */ } }
      if (E.renderLayersPanel) E.renderLayersPanel();
      E.drawOverlay();
      say(n.length ? "cleared: " + n.join(", ") : "nothing was selected");
    }
    E.ui.addCmd("sel.clearall", "Clear All Selections", "Shift+Ctrl+A", clearAll, { enabled: () => !!S.w }, ["Select", "sel.none"]);

    /* ---- the modes: one for every shape tool */
    function goMode(m, keepTool) {
      const o = syncedOps(m);
      S.shapeOp = o.shapeOp; store.set("pen.shapeop", o.shapeOp);
      S.drawOp = o.drawOp; store.set("pb.op", o.drawOp);
      if (S.penMode !== "path") { S.penOp = o.penOp; store.set("pen.op", o.penOp); }
      if (!keepTool && !DRAW_TOOLS.includes(S.tool)) E.setTool(CLOSED_TOOLS.includes(lastDraw) && E.tools[lastDraw] ? lastDraw : "shape");
      if (E.renderOptions) E.renderOptions();
      const A = E.layer();
      say(m === "new" ? "◻ New: each shape drawn is a layer of its own"
        : `${GLYPH[m]} ${NAMES[m]}: draw the next shape - ` + (isShapeL(A) ? `it works on ${A.name}` : "pick a shape layer first, or it is a new layer") + " (◻ = New again)");
      E.drawOverlay();
    }
    E.shapeModes = { go: goMode, opNow: () => opFor(S.tool, S) };
    // the tools' own mode buttons (the Shape tool's Ops, the curve tools' ◻ ⊕ ⊖ ⊗ ⊘, the Pen's Ops in Shape mode) set
    // their own setting first - the others follow it
    doc.addEventListener("click", (e) => {
      const b = e.target && e.target.closest ? e.target.closest("[data-pnshop],[data-dop],[data-pnop],[data-pmmode]") : null;
      if (!b || !E.host || !E.host.contains(b)) return;
      if (b.dataset.pmmode) { e.stopPropagation(); return goMode(b.dataset.pmmode); }
      if (b.dataset.pnop && S.penMode === "path") return;            // a path's components: the Pen's own
      const m = b.dataset.pnshop || b.dataset.dop || b.dataset.pnop;
      root.setTimeout(() => goMode(m, true), 0);
    });
    { const sm = E.shapeMode; if (sm && sm.set) { const f = sm.set; sm.set = function (m, quiet) { const r = f.apply(this, arguments); const o = syncedOps(m); S.drawOp = o.drawOp; store.set("pb.op", o.drawOp); if (S.penMode !== "path") { S.penOp = o.penOp; store.set("pen.op", o.penOp); } return r; }; } }
    // the property bar: with a vector shape picked (any tool), the five - a press goes into the mode
    if (E.propbar && E.propbar.extras) E.propbar.extras.push((L, ob) => {
      if (!isShapeL(L) || L.shape.dim || ob.querySelector(".pmmodes")) return;
      const cur = opFor(DRAW_TOOLS.includes(S.tool) ? S.tool : "shape", S);
      const box = doc.createElement("span"); box.className = "pmmodes"; box.style.cssText = "display:flex;gap:2px;align-items:center";
      box.innerHTML = `<span class="sep"></span>` + MODES.map((m) => `<button type="button" class="ghost kxsm${cur === m ? " on" : ""}" data-pmmode="${m}" title="${esc(NAMES[m])} - the shape tool comes on in this mode">${GLYPH[m]}</button>`).join("");
      ob.appendChild(box);
    });
    E.overlayHooks.push((g, px) => {
      // the selection's extra line (Lasso: back to the start, Polygonal Lasso: on to the pointer)
      const r = rubberOf(S.tool, S.pts, cursor, !!S.drag, { closeR: E.closeR ? E.closeR() : null, open: !!S.lassoOpen });
      if (r) {
        g.beginPath(); g.moveTo(r[0], r[1]); g.lineTo(r[2], r[3]);
        g.strokeStyle = "rgba(0,0,0,.75)"; g.lineWidth = 1.5 * px; g.setLineDash([]); g.stroke();
        g.strokeStyle = "#fff"; g.lineWidth = px; g.setLineDash([2 * px, 4 * px]); g.stroke(); g.setLineDash([]);
      }
      // the mode's sign beside the pointer
      if (cursor && DRAW_TOOLS.includes(S.tool)) {
        const m = opFor(S.tool, S); if (m === "new") return;
        const x = cursor[0] + 12 * px, y = cursor[1] + 14 * px;
        g.font = `${15 * px}px sans-serif`; g.textBaseline = "middle";
        g.lineWidth = 3 * px; g.strokeStyle = "rgba(0,0,0,.8)"; g.strokeText(GLYPH[m], x, y);
        g.fillStyle = m === "subtract" ? "#ff6b6b" : m === "intersect" || m === "exclude" ? "#ffd166" : "#7ee787"; g.fillText(GLYPH[m], x, y);
      }
    });
    let raf = 0;
    const soon = () => { if (!raf) raf = root.requestAnimationFrame(() => { raf = 0; E.drawOverlay(); }); };
    E.stage.addEventListener("pointermove", (e) => {
      if (!S.w) return;
      cursor = E.pos(e);
      if ((S.tool === "poly" && S.pts.length) || (S.tool === "lasso" && (S.drag || S.lassoOpen)) || (DRAW_TOOLS.includes(S.tool) && opFor(S.tool, S) !== "new")) soon();
    });
    E.stage.addEventListener("pointerleave", () => { cursor = null; soon(); });
    { const st0 = E.setTool; if (typeof st0 === "function") E.setTool = function (t) { if (CLOSED_TOOLS.includes(t)) { lastDraw = t; store.set("pm.lastdraw", t); } return st0.apply(this, arguments); }; }

    /* ---- double-click: the Move tool's transform */
    const DBL_TOOLS = ["none", "objsel"];
    function transformMode(L, how) {
      const i = S.layers.indexOf(L); if (i < 0) return;
      if (i !== S.active) E.setActive(i);
      if (S.tool !== "move") E.setTool("move");
      S.objSel = true;
      if (E.handles) E.handles.setMode("scale", true);
      if (E.renderOptions) E.renderOptions();
      E.drawOverlay();
      say(`${L.name || "the layer"}: transform (${how}) - drag a handle to scale (Shift keeps the proportions), click it again for the rotate / skew handles, drag it to move`);
    }
    E.stage.addEventListener("dblclick", (e) => {
      if (!S.w || !DBL_TOOLS.includes(S.tool) || !E.selHl || !E.selHl.objectAt) return;
      const [fx, fy] = E.pos(e), L = E.selHl.objectAt(fx, fy); if (!L) return;
      e.stopImmediatePropagation(); transformMode(L, "double-click");
    }, true);
    { const le = E.ui.layerExtra; E.ui.layerExtra = function (Ly, i, row) {
      const r = le ? le.apply(this, arguments) : undefined;
      if (row && !row.dataset.pmdbl) { row.dataset.pmdbl = "1"; row.addEventListener("dblclick", (e) => { if (e.target.closest && e.target.closest("input,button,.eye,.fx,.nm,.th")) return; if (Ly.control || Ly.type === "adjust" || (Ly.type === "fill" && !Ly.mask)) return; transformMode(Ly, "double-click in Layers"); }); }
      return r;
    }; }
    E.pickModes = { clearAll, goMode, transformMode };
  }

  const PCPickModes = Object.assign({ install }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = PCPickModes;
  else root.PCPickModes = PCPickModes;
})(typeof window !== "undefined" ? window : globalThis);
