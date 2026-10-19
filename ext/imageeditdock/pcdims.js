/* pcdims.js — CAD DIMENSIONS: exact points, live ends, a SCALE from one dimension (2.441.0), window.PCDims.
 *
 * Tim (verbatim): "with the dimension tools let the user select the size and units of the dimension line selected, then
 * use those measurements to create a scale for all the other existing dimensions and future dimensions. ctrl+drag will
 * lock dragging dimension line horizontal shift+ drag will lock dragging vertical. allow user to grab either end of a
 * dimension line and drag to change it's size, change it's value live so the user can see the number. allow user to
 * pick points on a shape or image to dimension accurately like in a cad program" (+ agreed: the scale is per document).
 *   LIVE DIMENSIONS  a Parallel / Horizontal-Vertical / Angular dimension keeps what it measures (shape.dim: kind, the
 *                    points, where its line sits) - older ones are read back from their lines. Pick one with the Move
 *                    tool, the Shape tool (F10) or the path selection tools: its ends show as handles - drag one: the line and
 *                    its NUMBER follow live; Ctrl = the end stays level with the other (horizontal), Shift = straight
 *                    above / below it (vertical); the end snaps (below). The middle handle moves the dimension line.
 *   EXACT POINTS     with a dimension tool (and while dragging an end) the pointer snaps like CAD: nodes, midpoints,
 *                    intersections, every layer's corners and side middles (a picture's too), and the nearest point ON a
 *                    shape's outline - shown at the point (View ▸ Snap To's other choices count as well).
 *   THE SCALE        the property bar of a picked dimension: its size in the document's units - type the real size and
 *                    pick the unit (mm, cm, m, km, in, ft, yd, mi, px) = the document's SCALE: every dimension in it is
 *                    measured again with it, and the ones drawn next too (kept with the document and its .bgi);
 *                    Layer ▸ Dimension Scale… does the same, "Clear" goes back to pixels / the dpi.
 * Pure (Node: scripts/test-dims.js): SCALE_UNITS, fmtScaled, scaleFrom, defOf (a dimension's definition, from its
 * lines if it has none), lockEnd (Shift = horizontal / Ctrl = vertical), nearestOnPath, handlesOf.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const SCALE_UNITS = ["mm", "cm", "m", "km", "in", "ft", "yd", "mi", "px"];
  /** a length in px -> "12.50 m" with the scale {k (units a px), unit, dec} */
  function fmtScaled(px, sc) { const d = Math.max(0, Math.min(6, Math.round(+(sc && sc.dec != null ? sc.dec : 2)))); return (px * sc.k).toFixed(d) + " " + sc.unit; }
  /** the scale that makes a line of `px` measure `value` `unit` */
  function scaleFrom(px, value, unit, dec) { if (!(px > 0) || !(+value > 0)) return null; return { k: +value / px, unit: SCALE_UNITS.includes(unit) ? unit : "mm", dec: dec == null ? 2 : dec }; }
  /** a dimension layer's definition: shape.dim, else read from its three lines (two extension lines + the line) */
  function defOf(L) {
    const s = L && L.shape; if (!s || !s.line || !s.line.labels) return null;
    if (s.dim && Array.isArray(s.dim.pts)) return s.dim;
    const subs = (s.path && s.path.subs) || [];
    if (subs.length === 3 && subs[0].plain && subs[1].plain && subs[2].pts && subs[2].pts.length >= 2) {
      const a = subs[0].pts[0], b = subs[1].pts[0], l0 = subs[2].pts[0], l1 = subs[2].pts[subs[2].pts.length - 1];
      const horiz = Math.abs(l0.y - l1.y) < 1e-6 && Math.abs(a.y - b.y) > 1e-6, vert = Math.abs(l0.x - l1.x) < 1e-6 && Math.abs(a.x - b.x) > 1e-6;
      return { kind: horiz ? "horizontal" : vert ? "vertical" : "parallel", pts: [[a.x, a.y], [b.x, b.y], [(l0.x + l1.x) / 2, (l0.y + l1.y) / 2]] };
    }
    return null;
  }
  /** the end being dragged to (x, y), the other end `o`: shift = level with it (horizontal), ctrl = straight above / below (vertical) - 2.457.0 */
  function lockEnd(x, y, o, ctrl, shift) { if (shift) return [x, o[1]]; if (ctrl) return [o[0], y]; return [x, y]; }
  /** the nearest point to (x, y) on a path's outline (beziers sampled): {x, y, d} | null */
  function nearestOnPath(p, x, y, steps) {
    let best = null; const n = steps || 24;
    const cub = (a, b, c, d, t) => { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; };
    const seg = (p0, p1, q0, q1) => { const vx = q0 - p0, vy = q1 - p1, L2 = vx * vx + vy * vy; let t = L2 ? ((x - p0) * vx + (y - p1) * vy) / L2 : 0; t = Math.max(0, Math.min(1, t)); const px = p0 + vx * t, py = p1 + vy * t, d = Math.hypot(px - x, py - y); if (!best || d < best.d) best = { x: px, y: py, d }; };
    for (const s of (p && p.subs) || []) {
      const a = s.pts || [], m = s.closed ? a.length : a.length - 1;
      for (let i = 0; i < m; i++) {
        const A = a[i], B = a[(i + 1) % a.length];
        let px = A.x, py = A.y;
        for (let k = 1; k <= n; k++) { const t = k / n, qx = cub(A.x, A.ox, B.ix, B.x, t), qy = cub(A.y, A.oy, B.iy, B.y, t); seg(px, py, qx, qy); px = qx; py = qy; }
      }
    }
    return best;
  }
  /** the handles of a dimension: [{i: 0 | 1 | 2, x, y}] - its two measured points and where its line sits */
  function handlesOf(def) { if (!def || !def.pts) return []; return def.pts.slice(0, def.kind === "angular" ? 4 : 3).map((p, i) => ({ i, x: p[0], y: p[1] })); }
  const DIM_TOOLS = new Set(["cdimpar", "cdimhv", "cdimang", "cdimchain"]);   // 2.458.0: + the Chain Dimension tool (pcdimauto.js)

  /* ================================ the editor ================================ */
  function install(E) {
    const S = E.S, D = E.D, doc = E.doc || root.document, win = E.win || root, say = E.say, stage = E.stage, DR = root.PCDraw, Q = root.PCPath, G = root.PCGuides;
    if (!E.ui || !E.ui.addCmd || !DR || !stage) return;
    const $ = (id) => doc.getElementById(id);
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const isDim = (L) => !!(L && L.shape && L.shape.line && L.shape.line.labels && defOf(L));
    const opt = () => { const c = S.cd || {}; return { unit: c.unit, dpi: c.dpi, dec: c.dec, size: c.tsize }; };
    /** the number on a dimension: the document's scale, else the tools' units (px / mm / cm / in at the dpi) */
    const textFor = (len, size) => (S.dimScale && S.dimScale.k > 0 ? fmtScaled(len, S.dimScale) : DR.fmtLen(len, (S.cd || {}).unit, (S.cd || {}).dpi, (S.cd || {}).dec));
    /** a dimension drawn again from its definition (its number in the scale) */
    function rebuild(L, def) {
      const d = def || defOf(L); if (!d) return false;
      const lab0 = (L.shape.line.labels || [])[0] || {}, o = Object.assign(opt(), { size: lab0.size || opt().size });
      let r;
      if (d.kind === "angular") r = DR.dimAngular(d.pts[0], d.pts[1], d.pts[2], d.pts[3], o);
      else { const how = d.kind === "horizontal" || d.kind === "vertical" ? d.kind : d.kind === "auto" ? "auto" : "parallel"; const r0 = DR.dimParallel(d.pts[0], d.pts[1], d.pts[2], how, o); r = DR.dimParallel(d.pts[0], d.pts[1], d.pts[2], how, Object.assign(o, { text: textFor(r0.length) })); d.len = r0.length; }
      L.shape.dim = d; L.shape.path = r.path;
      L.shape.line = Object.assign({}, L.shape.line, { labels: [Object.assign({}, lab0, r.label)] });
      Q.syncShape(L.shape); D.rasterize(L);
      return r;
    }
    // new dimensions keep their definition (pcdraw's makeDimTool hands it over) and use the scale
    E.dimNew = function (L, kind, pts) {
      const k = kind === "cdimang" ? "angular" : kind === "cdimhv" ? "auto" : "parallel";
      const d = { kind: k, pts: pts.map((p) => [p[0], p[1]]) };
      if (k === "auto") { const r = DR.dimParallel(d.pts[0], d.pts[1], d.pts[2], "auto", opt()); d.kind = r.mode; }
      rebuild(L, d);
    };
    const DG = () => E.dimGroups || null;
    /** a picked dimension's length: a one-layer dimension or a dimension group (2.457.0, pcdimgroup.js) - null for an angle / not a dimension */
    function lengthOf(L) {
      if (DG() && DG().groupOf(L)) return DG().lengthOf(L);
      if (!isDim(L)) return null;
      const d = defOf(L); if (d.kind === "angular") return null;
      return DR.dimParallel(d.pts[0], d.pts[1], d.pts[2], d.kind, opt()).length;
    }
    const anyDim = (L) => isDim(L) || !!(DG() && DG().groupOf(L));
    function remeasureAll(label) {
      const dims = S.layers.filter(isDim), groups = DG() ? S.layers.filter(DG().isGroup) : [];
      if (!dims.length && !groups.length) return 0;
      const before = E.snapStruct();
      for (const L of dims) if (defOf(L).kind !== "angular") rebuild(L);
      for (const G of groups) DG().rebuild(G);
      E.push({ t: "struct", before, after: E.snapStruct(), label }); E.refresh(); E.renderLayersPanel();
      return dims.length + groups.length;
    }
    function setScale(value, unit, dec) {
      const L = E.layer(); if (!anyDim(L)) return say("pick a dimension first");
      const len = lengthOf(L); if (len == null) return say("an angle has no length - pick a length dimension");
      const sc = scaleFrom(len, value, unit, dec); if (!sc) return say("type the real size (more than 0)");
      S.dimScale = sc;
      const n = remeasureAll("dimension scale");
      say(`scale: ${len.toFixed(1)} px = ${value} ${sc.unit} - ${n} dimension(s) measured again; new ones use it`);
    }
    function clearScale() { S.dimScale = null; const n = remeasureAll("clear dimension scale"); say(`no scale - ${n} dimension(s) in ${(S.cd || {}).unit || "px"} again`); }
    function scaleDialog() {
      const L = E.layer(), len = lengthOf(L) || 0;
      const sc = S.dimScale;
      E.ui.dialog("Dimension Scale", (len ? `<div class="rw"><span>The picked dimension (${len.toFixed(2)} px) measures</span><input type="number" id="dsV" min="0" step="any" value="${sc ? (len * sc.k).toFixed(sc.dec) : len.toFixed(2)}"></div>
        <div class="rw"><span>Unit</span><select id="dsU" style="grid-column:2/4">${SCALE_UNITS.map((u) => `<option${(sc ? sc.unit : "mm") === u ? " selected" : ""}>${u}</option>`).join("")}</select></div>
        <div class="rw"><span>Decimals</span><input type="number" id="dsD" min="0" max="6" value="${sc ? sc.dec : 2}"></div>` : `<div style="padding:4px 10px;color:var(--pc-dim)">Pick a length dimension to set the scale from it.</div>`)
        + `<div style="padding:4px 10px;color:var(--pc-dim)">${sc ? `Now: 1 px = ${sc.k.toPrecision(4)} ${sc.unit}` : "No scale yet: the dimensions count pixels (or mm / cm / in at the dpi)."} Every dimension in this picture is measured with the scale, the ones drawn next too.</div>`,
      (dl) => { if (len) setScale(+dl.querySelector("#dsV").value, dl.querySelector("#dsU").value, +dl.querySelector("#dsD").value); },
      { okLabel: "Set scale", extra: sc ? '<button class="ghost" id="dsClear">Clear scale</button>' : "", init(dl) { const c = dl.querySelector("#dsClear"); if (c) c.onclick = () => { clearScale(); dl.remove(); }; } });
    }

    /* ---- CAD snapping for the dimension tools (and an end being dragged) */
    function cadSnap(x, y, skip) {
      const tol = 8 / (S.zoom || 1), cands = [];
      const T = E.guides ? E.guides.targets(skip) : { xs: [], ys: [], pts: [] };
      for (const p of T.pts) cands.push(p);
      for (const L of S.layers) {
        if (L === skip || !D.shown(S.layers, L) || L.type === "group" || L.type === "adjust" || L.type === "fill") continue;
        const b = E.dockers ? E.dockers.boxOf(L) : null;
        if (b && b.w > 0) for (const [px, py] of [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]]) cands.push({ x: px, y: py, k: "corner" });
        if (b && b.w > 0) for (const [px, py] of [[b.x + b.w / 2, b.y], [b.x + b.w, b.y + b.h / 2], [b.x + b.w / 2, b.y + b.h], [b.x, b.y + b.h / 2]]) cands.push({ x: px, y: py, k: "side middle" });
        if (L.shape && L.shape.kind === "path" && L.shape.path && !isDim(L)) {
          for (const s of L.shape.path.subs || []) { const a = s.pts || []; for (let i = 0; i < a.length; i++) { cands.push({ x: a[i].x, y: a[i].y, k: "node" }); if (i + 1 < a.length || s.closed) { const nb = a[(i + 1) % a.length]; cands.push({ x: (a[i].x + nb.x) / 2, y: (a[i].y + nb.y) / 2, k: "midpoint" }); } } }
          const on = nearestOnPath(L.shape.path, x, y); if (on && on.d <= tol) cands.push({ x: on.x, y: on.y, k: "on outline", soft: true });
        }
      }
      let best = null;
      for (const c of cands) { const d = Math.hypot(c.x - x, c.y - y) + (c.soft ? tol * 0.5 : 0); if (d <= tol * (c.soft ? 1.5 : 1) && (!best || d < best.d)) best = { d, c }; }
      if (best) return { x: best.c.x, y: best.c.y, k: best.c.k };
      if (G) { const r = G.snapPoint(x, y, T, tol, 0); if (r.hit) return { x: r.x, y: r.y, k: r.hit.k }; }
      return null;
    }
    let mark = null;                      // the CAD point shown
    const prevSnap = E.snapPos;
    E.snapPos = function (e, p) {
      if (DIM_TOOLS.has(S.tool) && S.w && !(e && e.altKey)) { const r = cadSnap(p[0], p[1], null); mark = r; if (r) return [r.x, r.y]; return p; }
      mark = null;
      return prevSnap ? prevSnap(e, p) : p;
    };
    // the hover of a dimension tool snaps too (its preview follows the snapped point)
    for (const id of DIM_TOOLS) { const T = E.tools[id]; if (!T || !T.hover) continue; const h = T.hover; T.hover = function (e, fx, fy) { const r = !(e && e.altKey) ? cadSnap(fx, fy, null) : null; mark = r; return h.call(this, e, r ? r.x : fx, r ? r.y : fy); }; }

    /* ---- the handles of the picked dimension: drag an end (live number), Ctrl = horizontal, Shift = vertical */
    const HANDLE_TOOLS = new Set(["move", "shapetool", "directsel", "pathsel"]);   // (a dimension tool starts a new one there - CAD)
    const docAt = (cx, cy) => { const r = $("kxPaper").getBoundingClientRect(), z = S.zoom || 1; return [(cx - r.left) / z, (cy - r.top) / z]; };
    function handleAt(fx, fy) {
      const L = E.layer(); if (!isDim(L) || !HANDLE_TOOLS.has(S.tool)) return null;
      const tol = 7 / (S.zoom || 1); let best = null;
      for (const h of handlesOf(defOf(L))) { const d = Math.hypot(h.x - fx, h.y - fy); if (d <= tol && (!best || d < best.d)) best = { d, h }; }
      return best ? { L, i: best.h.i } : null;
    }
    let drag = null;
    stage.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || !S.w || (e.target.closest && e.target.closest(".pcruler"))) return;
      const [fx, fy] = docAt(e.clientX, e.clientY), h = handleAt(fx, fy); if (!h) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const def = JSON.parse(JSON.stringify(defOf(h.L)));
      drag = { L: h.L, i: h.i, def, before: E.snapStruct(), start: def.pts.map((p) => p.slice()) };
      stage.setPointerCapture(e.pointerId);
    }, true);
    stage.addEventListener("pointermove", (e) => {
      if (!drag) { const [fx, fy] = docAt(e.clientX, e.clientY), h = S.drag ? null : handleAt(fx, fy); if (h) { stage.style.cursor = "crosshair"; stage.dataset.dimcur = "1"; } else if (stage.dataset.dimcur) { stage.style.cursor = ""; delete stage.dataset.dimcur; } return; }
      e.stopImmediatePropagation();
      let [fx, fy] = docAt(e.clientX, e.clientY);
      const d = drag.def, i = drag.i;
      if (i <= 1 || (d.kind === "angular" && i !== 3)) {
        const r = !e.altKey ? cadSnap(fx, fy, drag.L) : null; mark = r; if (r) { fx = r.x; fy = r.y; }
        const other = d.kind === "angular" ? d.pts[0] : d.pts[1 - i];
        if (d.kind !== "angular" || i > 0) [fx, fy] = lockEnd(fx, fy, other, e.ctrlKey || e.metaKey, e.shiftKey);
        d.pts[i] = [fx, fy];
      } else d.pts[i] = [fx, fy];                                    // the line's place (or the arc)
      const r = rebuild(drag.L, d);
      if (r && r.label) say(`${d.kind === "angular" ? "angle" : "length"}: ${r.label.text}${e.shiftKey ? " · horizontal" : e.ctrlKey || e.metaKey ? " · vertical" : ""}`);
      E.refresh();
    }, true);
    const end = (e) => {
      if (!drag) return; e.stopImmediatePropagation();
      const dr = drag; drag = null; mark = null;
      E.push({ t: "struct", before: dr.before, after: E.snapStruct(), label: "dimension end" }); E.refresh(); E.renderLayersPanel();
      if (E.propbar) E.propbar.render();
    };
    stage.addEventListener("pointerup", end, true); stage.addEventListener("pointercancel", end, true);
    // drawn: the handles of the picked dimension + the CAD point
    E.overlayHooks.push((g, px) => {
      const L = S.w ? E.layer() : null;
      if (isDim(L) && HANDLE_TOOLS.has(S.tool)) {
        g.save(); g.lineWidth = px; g.strokeStyle = "#ff8a00"; g.fillStyle = "#fff";
        for (const h of handlesOf(defOf(L))) { const s = 4 * px; g.fillRect(h.x - s, h.y - s, 2 * s, 2 * s); g.strokeRect(h.x - s, h.y - s, 2 * s, 2 * s); }
        g.restore();
      }
      if (mark) { g.save(); g.strokeStyle = "#ff3cac"; g.fillStyle = "#ff3cac"; g.lineWidth = 1.5 * px; const s = 5 * px;
        g.beginPath(); g.moveTo(mark.x - s, mark.y - s); g.lineTo(mark.x + s, mark.y + s); g.moveTo(mark.x + s, mark.y - s); g.lineTo(mark.x - s, mark.y + s); g.stroke();
        g.font = `${11 * px}px sans-serif`; g.fillText(mark.k, mark.x + 7 * px, mark.y - 7 * px); g.restore(); }
    });

    /* ---- the property bar: a picked dimension's size + unit = the scale */
    if (E.propbar) {
      E.propbar.extras.push((L, ob) => {
        if (!ob || !anyDim(L) || ob.querySelector("#pbDimV")) return;
        const len = lengthOf(L), sc = S.dimScale; if (len == null) return;
        const span = doc.createElement("span"); span.className = "pcdimrow"; span.style.cssText = "display:flex;gap:4px;align-items:center";
        span.innerHTML = `<span class="sep"></span><label title="This dimension's size - type the real size and pick its unit: that is the scale for every dimension in this picture (and the next ones)">📏 <input type="number" id="pbDimV" min="0" step="any" value="${sc ? (len * sc.k).toFixed(sc.dec) : len.toFixed(2)}" style="width:70px"></label>`
          + `<select id="pbDimU" title="Unit">${SCALE_UNITS.map((u) => `<option${(sc ? sc.unit : "px") === u ? " selected" : ""}>${u}</option>`).join("")}</select>`
          + `<button type="button" class="ghost" id="pbDimS" title="Dimension Scale… (decimals, clear the scale)">⚖</button>`;
        ob.appendChild(span);
        const apply = () => { const v = +$("pbDimV").value, u = $("pbDimU").value; if (u === "px" && !sc && Math.abs(v - len) < 1e-9) return; setScale(v, u, sc ? sc.dec : 2); };
        $("pbDimV").onchange = apply; $("pbDimU").onchange = apply; $("pbDimS").onclick = scaleDialog;
        span.querySelectorAll("input").forEach((x) => x.addEventListener("keydown", (ev) => { ev.stopPropagation(); if (ev.key === "Enter") apply(); }));
      });
    }
    E.ui.addCmd("layer.dimscale", "Dimension Scale…", "", scaleDialog, { enabled: () => !!S.w }, ["Layer", "layer.genmask"]);
    E.dims = { rebuild, setScale, clearScale, scaleDialog, remeasureAll, cadSnap, defOf, isDim, textFor, lengthOf, mark: () => mark,
      /** 2.458.0: the CAD point at (x, y) shown + returned (Alt = none) - for tools added later (pcdimauto.js) */
      snap: (x, y, e) => { const r = !(e && e.altKey) ? cadSnap(x, y, null) : null; mark = r; return r; } };
  }

  const PCDims = { SCALE_UNITS, fmtScaled, scaleFrom, defOf, lockEnd, nearestOnPath, handlesOf, DIM_TOOLS, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCDims;
  else root.PCDims = PCDims;
})(typeof window !== "undefined" ? window : globalThis);
