/* pcguides.js — RULERS, GUIDELINES AND SNAPPING like CorelDRAW (2.440.0), window.PCGuides.
 *
 * Tim (verbatim): "add rulers, guidelines, snap options like coreldraw to image editor."
 *   RULERS       View ▸ Rulers (Ctrl+R) - in the unit of View ▸ Ruler Units (px, mm, cm, in, pt at the document's dpi);
 *                drag out of a ruler = a new GUIDELINE (the top ruler a horizontal one, the left a vertical one);
 *                double-click a ruler = the Guidelines dialog.
 *   GUIDELINES   kept with the document (and in its .bgi). Move one with the Move tool (or Ctrl + any tool) - drag
 *                it back onto a ruler (or off the picture) = gone. View ▸ Guidelines (show, Ctrl+;), Lock Guidelines
 *                (Alt+Ctrl+;), New Guideline…, Guidelines… (every one listed: its place, delete; add one; clear all).
 *   SNAPPING     View ▸ Snap To ▸ Snap (Shift+Ctrl+;) on / off + what to: Grid, Guidelines, Objects (edges and
 *                centres of the other layers), Nodes (a shape's points), Midpoints (of its segments), Intersections
 *                (guideline × guideline, with the page edges), Page (its edges and centre). Snap distance and grid
 *                spacing in View ▸ Grid and Snapping…. The drawing / selection / path tools snap the pointer; the
 *                Move tool snaps the layer's box (its edges and centre) - what it snapped to is shown at the point.
 * Pure (Node: scripts/test-guides.js): UNITS, toUnit / fromUnit, targetsOf (guides + page + boxes + nodes -> what can
 * be snapped to), snapPoint (a point -> the nearest target within reach), snapBox (a moved box -> the shift that puts
 * an edge / centre on a line), gridStep.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const UNITS = { px: { n: "pixels", per: (dpi) => 1 }, mm: { n: "millimetres", per: (dpi) => dpi / 25.4 }, cm: { n: "centimetres", per: (dpi) => dpi / 2.54 }, in: { n: "inches", per: (dpi) => dpi }, pt: { n: "points", per: (dpi) => dpi / 72 } };
  const toUnit = (px, unit, dpi) => px / (UNITS[unit] || UNITS.px).per(dpi || 96);
  const fromUnit = (v, unit, dpi) => v * (UNITS[unit] || UNITS.px).per(dpi || 96);
  /** the grid's spacing: a fixed one, else the one drawn (from 8 px, doubling until it is >= 24 screen px) */
  function gridStep(fixed, zoom) { if (fixed > 0) return fixed; return [8, 16, 32, 64, 128, 256, 512].find((s) => s * (zoom || 1) >= 24) || 1024; }
  /** what can be snapped to: {xs: [{v, k}], ys: [{v, k}], pts: [{x, y, k}]} - o = {on: {grid, guides, objects, nodes, midpoints,
   *  intersections, page}, guides: [{o, p}], w, h, boxes: [{x, y, w, h}], paths: [{subs}], grid} */
  function targetsOf(o) {
    const on = o.on || {}, xs = [], ys = [], pts = [];
    const g = o.guides || [];
    if (on.guides) for (const q of g) (q.o === "v" ? xs : ys).push({ v: q.p, k: "guideline" });
    if (on.page) { for (const v of [0, o.w / 2, o.w]) xs.push({ v, k: v ? (v === o.w ? "page edge" : "page centre") : "page edge" }); for (const v of [0, o.h / 2, o.h]) ys.push({ v, k: v ? (v === o.h ? "page edge" : "page centre") : "page edge" }); pts.push({ x: o.w / 2, y: o.h / 2, k: "page centre" }); }
    if (on.objects) for (const b of o.boxes || []) {
      xs.push({ v: b.x, k: "edge" }, { v: b.x + b.w / 2, k: "centre" }, { v: b.x + b.w, k: "edge" });
      ys.push({ v: b.y, k: "edge" }, { v: b.y + b.h / 2, k: "centre" }, { v: b.y + b.h, k: "edge" });
      pts.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, k: "centre" });
    }
    for (const p of o.paths || []) for (const s of p.subs || []) {
      const a = s.pts || [];
      for (let i = 0; i < a.length; i++) {
        if (on.nodes) pts.push({ x: a[i].x, y: a[i].y, k: "node" });
        if (on.midpoints && (i + 1 < a.length || s.closed)) { const b = a[(i + 1) % a.length]; pts.push({ x: (a[i].x + b.x) / 2, y: (a[i].y + b.y) / 2, k: "midpoint" }); }
      }
    }
    if (on.intersections) {
      const vx = g.filter((q) => q.o === "v").map((q) => q.p).concat(on.page ? [0, o.w] : []), hy = g.filter((q) => q.o === "h").map((q) => q.p).concat(on.page ? [0, o.h] : []);
      for (const x of vx) for (const y of hy) pts.push({ x, y, k: "intersection" });
    }
    return { xs, ys, pts };
  }
  /** (x, y) -> {x, y, hit: {k, x?, y?}} snapped: a POINT target within `tol` first (the nearest), else each axis to its
   *  nearest line within tol; the grid when on (the nearest grid line, per axis, if nothing else won that axis) */
  function snapPoint(x, y, T, tol, grid) {
    let best = null;
    for (const p of T.pts) { const d = Math.hypot(p.x - x, p.y - y); if (d <= tol && (!best || d < best.d)) best = { d, p }; }
    if (best) return { x: best.p.x, y: best.p.y, hit: { k: best.p.k, x: best.p.x, y: best.p.y } };
    const near = (list, v) => { let b = null; for (const t of list) { const d = Math.abs(t.v - v); if (d <= tol && (!b || d < b.d)) b = { d, t }; } return b; };
    const bx = near(T.xs, x), by = near(T.ys, y);
    let nx = bx ? bx.t.v : x, ny = by ? by.t.v : y, k = bx ? bx.t.k : by ? by.t.k : null;
    if (grid > 0) {
      if (!bx) { const gx = Math.round(x / grid) * grid; if (Math.abs(gx - x) <= tol) { nx = gx; k = k || "grid"; } }
      if (!by) { const gy = Math.round(y / grid) * grid; if (Math.abs(gy - y) <= tol) { ny = gy; k = k || "grid"; } }
    }
    return { x: nx, y: ny, hit: k ? { k, x: nx !== x ? nx : null, y: ny !== y ? ny : null } : null };
  }
  /** a box moved by (dx, dy): the extra shift that puts its left / centre / right on a vertical target (and top /
   *  middle / bottom on a horizontal one) within tol -> {dx, dy, hit} */
  function snapBox(b, dx, dy, T, tol, grid) {
    const best = (cands, list) => { let r = null; for (const c of cands) for (const t of list) { const d = t.v - c; if (Math.abs(d) <= tol && (!r || Math.abs(d) < Math.abs(r.d))) r = { d, t }; } return r; };
    const xs = T.xs.slice(), ys = T.ys.slice();
    const cx = [b.x + dx, b.x + b.w / 2 + dx, b.x + b.w + dx], cy = [b.y + dy, b.y + b.h / 2 + dy, b.y + b.h + dy];
    if (grid > 0) { for (const c of cx) xs.push({ v: Math.round(c / grid) * grid, k: "grid" }); for (const c of cy) ys.push({ v: Math.round(c / grid) * grid, k: "grid" }); }
    const sx = best(cx, xs), sy = best(cy, ys);
    return { dx: dx + (sx ? sx.d : 0), dy: dy + (sy ? sy.d : 0), hit: sx || sy ? { k: (sx || sy).t.k, x: sx ? sx.t.v : null, y: sy ? sy.t.v : null } : null };
  }
  const SNAP_TOOLS = new Set(["move", "rect", "ellipse", "poly", "crop", "gradient", "pen", "curvpen", "addanchor", "convanchor", "type", "vtype", "typepath", "pathsel", "directsel", "shape", "customshape",
    "bezier", "line2", "polyline", "curve3", "bspline", "cpen", "shapetool", "crect", "crect3", "cellipse", "cellipse3", "cpolygon", "cstar", "ccstar", "cspiral", "cgraph", "ccommon", "cdimpar", "cdimhv", "cdimchain", "cdimang", "ccallout", "cconnect"]);

  /* ================================ the editor ================================ */
  function install(E) {
    const S = E.S, D = E.D, doc = E.doc || root.document, win = E.win || root, store = E.store, say = E.say, kx = E.kx, stage = E.stage;
    if (!E.ui || !E.ui.addCmd || !stage) return;
    const $ = (id) => doc.getElementById(id);
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    // on at first: snapping to guidelines, their crossings and shapes' nodes (the rest under View ▸ Snap To)
    const SN = Object.assign({ snap: true, grid: false, guides: true, objects: false, nodes: true, midpoints: false, intersections: true, page: false, dist: 8, gridPx: 0, show: true, lock: false, unit: "px", dpi: 96, color: "#00b7ff",
      gridMajor: 5, gridStyle: "lines", gridColor: "#2680eb", gridOpacity: 0.35 }, store.get("snap", {}));   // 2.445.0: + the grid's major lines, lines / dots, colour
    /** 2.445.0: the grid as static/gridspec.js's spec (the drawing and the settings tab both use it) */
    const gridSpec = () => ({ on: !!S.grid, spacing: SN.gridPx, major: SN.gridMajor, style: SN.gridStyle, color: SN.gridColor, opacity: SN.gridOpacity, guideColor: SN.color, snap: SN.dist });
    E.gridSpec = gridSpec;
    const keep = () => store.set("snap", SN);
    if (!Array.isArray(S.guides)) S.guides = [];
    const css = doc.createElement("style");
    css.textContent = ".kx.rulers .pcruler{pointer-events:auto}.pcruler.h{cursor:row-resize}.pcruler.v{cursor:col-resize}";
    doc.head.appendChild(css);
    let gid = 0; const newId = () => "g" + Date.now().toString(36) + (++gid);
    const guides = () => (Array.isArray(S.guides) ? S.guides : (S.guides = []));
    const tolDoc = () => SN.dist / (S.zoom || 1);
    const scr = (fx, fy) => { const r = $("kxPaper").getBoundingClientRect(), z = S.zoom || 1; return [r.left + fx * z, r.top + fy * z]; };
    const docAt = (cx, cy) => { const r = $("kxPaper").getBoundingClientRect(), z = S.zoom || 1; return [(cx - r.left) / z, (cy - r.top) / z]; };

    /* ---- what to snap to (the active layer left out while it is being moved) */
    function targets(skip) {
      const on = SN.snap ? { guides: SN.guides && SN.show, objects: SN.objects, nodes: SN.nodes, midpoints: SN.midpoints, intersections: SN.intersections, page: SN.page } : {};
      const boxes = [], paths = [];
      if (SN.snap && (SN.objects || SN.nodes || SN.midpoints)) for (const L of S.layers) {
        if (L === skip || !D.shown(S.layers, L) || L.type === "group" || L.type === "adjust" || L.type === "fill") continue;
        if (SN.objects && E.dockers) { const b = E.dockers.boxOf(L); if (b && b.w > 0 && !(L.type === "pixel" && b.w >= S.w - 1 && b.h >= S.h - 1)) boxes.push(b); }
        if ((SN.nodes || SN.midpoints) && L.shape && L.shape.kind === "path" && L.shape.path) paths.push(L.shape.path);
      }
      return targetsOf({ on, guides: guides(), w: S.w, h: S.h, boxes, paths });
    }
    let last = null;                       // what the pointer last snapped to (drawn at the point)
    let moveStart = null;
    /** the editor's pointer position (pointerdown / move / up), snapped for the tools that snap */
    E.snapPos = function (e, p) {
      last = null;
      if (!SN.snap || !S.w || !SNAP_TOOLS.has(S.tool) || (e && e.altKey && e.type !== "pointerdown" && false)) return p;
      const grid = SN.grid ? gridStep(SN.gridPx, S.zoom) : 0;
      if (S.tool === "move") {
        if (e.type === "pointerdown") { const L = E.layer(); moveStart = L && E.dockers ? { x: p[0], y: p[1], box: E.dockers.boxOf(L), L } : null; return p; }
        if (!moveStart || !moveStart.box || !S.drag) return p;
        const r = snapBox(moveStart.box, p[0] - moveStart.x, p[1] - moveStart.y, targets(moveStart.L), tolDoc(), grid);
        last = r.hit ? Object.assign({ box: true }, r.hit) : null;
        if (e.type === "pointerup") moveStart = null;
        return [moveStart ? moveStart.x + r.dx : p[0] + r.dx, moveStart ? moveStart.y + r.dy : p[1] + r.dy];
      }
      const r = snapPoint(p[0], p[1], targets(null), tolDoc(), grid);
      last = r.hit ? Object.assign({}, r.hit, { px: r.x, py: r.y }) : null;
      return [r.x, r.y];
    };

    /* ---- the overlay: the guidelines + what was snapped to */
    E.overlayHooks.push((g, px) => {
      if (!S.w) return;
      if (SN.show) {
        g.save(); g.strokeStyle = SN.color; g.lineWidth = px; g.setLineDash(SN.lock ? [4 * px, 3 * px] : []);
        g.beginPath();
        for (const q of guides()) { if (q.o === "h") { g.moveTo(-1e4, q.p); g.lineTo(S.w + 1e4, q.p); } else { g.moveTo(q.p, -1e4); g.lineTo(q.p, S.h + 1e4); } }
        g.stroke(); g.restore();
      }
      if (last && S.drag) {
        g.save(); g.strokeStyle = "#ff3cac"; g.fillStyle = "#ff3cac"; g.lineWidth = px;
        if (last.x != null) { g.beginPath(); g.moveTo(last.x, -1e4); g.lineTo(last.x, S.h + 1e4); g.setLineDash([2 * px, 2 * px]); g.stroke(); }
        if (last.y != null) { g.beginPath(); g.moveTo(-1e4, last.y); g.lineTo(S.w + 1e4, last.y); g.setLineDash([2 * px, 2 * px]); g.stroke(); }
        const mx = last.px != null ? last.px : last.x != null ? last.x : null, my = last.py != null ? last.py : last.y != null ? last.y : null;
        if (mx != null && my != null) { g.setLineDash([]); g.strokeRect(mx - 4 * px, my - 4 * px, 8 * px, 8 * px); }
        if (mx != null || my != null) { g.font = `${11 * px}px sans-serif`; g.fillText(last.k, (mx != null ? mx : 0) + 6 * px, (my != null ? my : 0) - 6 * px); }
        g.restore();
      }
    });

    /* ---- guides: add / move / delete */
    function addGuide(o, p) { const q = { id: newId(), o: o === "v" ? "v" : "h", p: Math.round(p * 100) / 100 }; guides().push(q); E.drawOverlay(); return q; }
    function removeGuide(id) { S.guides = guides().filter((q) => q.id !== id); E.drawOverlay(); }
    function guideAt(fx, fy) {
      const tol = 4 / (S.zoom || 1); let best = null;
      for (const q of guides()) { const d = Math.abs((q.o === "h" ? fy : fx) - q.p); if (d <= tol && (!best || d < best.d)) best = { d, q }; }
      return best ? best.q : null;
    }
    const offPaper = (fx, fy, q) => (q.o === "h" ? fy < -2 || fy > S.h + 2 : fx < -2 || fx > S.w + 2);
    function dragGuide(q, ev) {
      const mv = (m) => { const [fx, fy] = docAt(m.clientX, m.clientY); let v = q.o === "h" ? fy : fx;
        if (SN.snap && !m.altKey) { const T = targets(null), tol = tolDoc(), list = q.o === "h" ? T.ys.filter((t) => t.k !== "guideline") : T.xs.filter((t) => t.k !== "guideline"); for (const t of list) if (Math.abs(t.v - v) <= tol) { v = t.v; break; } if (SN.grid) { const gs = gridStep(SN.gridPx, S.zoom), gv = Math.round(v / gs) * gs; if (Math.abs(gv - v) <= tol) v = gv; } }
        q.p = Math.round(v * 100) / 100; E.drawOverlay(); if (E.ui.rulers) E.ui.rulers([fx, fy]); };
      const up = (m) => { win.removeEventListener("pointermove", mv, true); win.removeEventListener("pointerup", up, true);
        const [fx, fy] = docAt(m.clientX, m.clientY), overRuler = m.target && m.target.closest && m.target.closest(".pcruler");
        if (overRuler || offPaper(fx, fy, q)) { removeGuide(q.id); say("guideline removed"); } else say(`${q.o === "h" ? "horizontal" : "vertical"} guideline at ${fmt(q.p)}`); };
      win.addEventListener("pointermove", mv, true); win.addEventListener("pointerup", up, true);
      if (ev) mv(ev);
    }
    const fmt = (px) => `${Math.round(toUnit(px, SN.unit, SN.dpi) * 100) / 100} ${SN.unit}`;
    // out of the rulers
    for (const [id, o] of [["pcRulerH", "h"], ["pcRulerV", "v"]]) {
      const c = $(id); if (!c) continue;
      // (the rulers sit inside the stage: the press must not reach it - the Move tool would move the layer)
      c.addEventListener("pointerdown", (e) => { e.stopPropagation(); if (e.button !== 0 || !S.w) return; e.preventDefault(); if (SN.lock) return say("the guidelines are locked (View ▸ Lock Guidelines)"); const [fx, fy] = docAt(e.clientX, e.clientY); const q = addGuide(o, o === "h" ? fy : fx); SN.show = true; keep(); dragGuide(q, null); });
      c.addEventListener("dblclick", () => guidesDialog());
    }
    // on the picture: the Move tool (or Ctrl with any tool) grabs one
    stage.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || !S.w || !SN.show || SN.lock || !(S.tool === "move" || e.ctrlKey || e.metaKey) || (e.target.closest && e.target.closest(".pcruler"))) return;
      const [fx, fy] = docAt(e.clientX, e.clientY), q = guideAt(fx, fy); if (!q) return;
      e.preventDefault(); e.stopImmediatePropagation(); dragGuide(q, null);
    }, true);
    stage.addEventListener("pointermove", (e) => {
      if (S.drag || !S.w || !SN.show || SN.lock || !(S.tool === "move" || e.ctrlKey)) { if (stage.dataset.gcur) { stage.style.cursor = ""; delete stage.dataset.gcur; } return; }
      const [fx, fy] = docAt(e.clientX, e.clientY), q = guideAt(fx, fy);
      if (q) { stage.style.cursor = q.o === "h" ? "row-resize" : "col-resize"; stage.dataset.gcur = "1"; } else if (stage.dataset.gcur) { stage.style.cursor = ""; delete stage.dataset.gcur; }
    }, true);
    // the rulers in the chosen unit (pcui's rulers() draws pixels - its numbers redrawn here)
    const prevRulers = E.ui.rulers;
    E.ui.rulers = function (cursor) {
      if (prevRulers) prevRulers(cursor);
      if (SN.unit === "px" || !kx.classList.contains("rulers")) return;
      const hc = $("pcRulerH"), vc = $("pcRulerV"), per = UNITS[SN.unit].per(SN.dpi);
      const z = S.zoom || 1, nice = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000], stepU = nice.find((s) => s * per * z >= 50) || 2000;
      const fg = getComputedStyle(kx).getPropertyValue("--pc-dim") || "#999", bg = getComputedStyle(kx).getPropertyValue("--pc-panel") || "#222";
      for (const [c, horiz] of [[hc, true], [vc, false]]) {
        const g = c.getContext("2d"); if (!g) continue;
        g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); g.fillStyle = fg; g.strokeStyle = fg; g.font = "9px sans-serif"; g.lineWidth = 1;
        const len = horiz ? c.width : c.height, off = horiz ? S.panX : S.panY, first = Math.floor(-off / z / per / stepU) * stepU;
        g.beginPath();
        for (let u = first; u * per * z + off < len; u += stepU / 5) {
          const p = Math.round(u * per * z + off) + 0.5, major = Math.abs(u / stepU - Math.round(u / stepU)) < 1e-6, t = major ? 16 : 5, lab = String(Math.round(u * 100) / 100);
          if (horiz) { g.moveTo(p, 16); g.lineTo(p, 16 - t); if (major) g.fillText(lab, p + 2, 9); }
          else { g.moveTo(16, p); g.lineTo(16 - t, p); if (major) { g.save(); g.translate(9, p + 2); g.rotate(-Math.PI / 2); g.fillText(lab, 0, 0); g.restore(); } }
        }
        g.stroke();
        if (horiz) g.fillText(SN.unit, 2, 9);
        if (cursor) { g.fillStyle = "#2680eb"; const p = (horiz ? cursor[0] : cursor[1]) * z + off; if (horiz) g.fillRect(p, 0, 1, 16); else g.fillRect(0, p, 16, 1); }
      }
    };

    /* ---- dialogs */
    function newGuideDialog() {
      if (!S.w) return say("open a picture first");
      E.ui.dialog("New Guideline", `<div class="rw"><span>Orientation</span><select id="ngO" style="grid-column:2/4"><option value="h">Horizontal</option><option value="v">Vertical</option></select></div>
        <div class="rw"><span>Position (${SN.unit})</span><input type="number" id="ngP" value="0" step="any"></div>`,
      (d) => { const o = d.querySelector("#ngO").value, v = fromUnit(+d.querySelector("#ngP").value || 0, SN.unit, SN.dpi); addGuide(o, v); SN.show = true; keep(); say(`${o === "h" ? "horizontal" : "vertical"} guideline at ${fmt(v)}`); });
    }
    function guidesDialog() {
      if (!S.w) return say("open a picture first");
      const rows = () => guides().map((q) => `<div class="rw" data-gid="${q.id}"><span>${q.o === "h" ? "— horizontal" : "| vertical"}</span><input type="number" class="gdP" value="${Math.round(toUnit(q.p, SN.unit, SN.dpi) * 100) / 100}" step="any"><button class="ghost gdX" title="Delete it">✕</button></div>`).join("")
        || `<div style="color:var(--pc-dim);padding:4px 10px">No guidelines - drag one out of a ruler, or add one here.</div>`;
      E.ui.dialog("Guidelines", `<div id="gdList" style="max-height:44vh;overflow:auto">${rows()}</div>
        <div class="rw"><span>Add</span><select id="gdO"><option value="h">Horizontal</option><option value="v">Vertical</option></select><input type="number" id="gdN" value="0" step="any" title="Position (${SN.unit})"></div>
        <div class="kxrow" style="padding:0 10px"><button class="ghost" id="gdAdd">＋ Add</button><button class="ghost" id="gdClear">Clear all</button><span style="color:var(--pc-dim)">positions in ${UNITS[SN.unit].n}</span></div>`,
      () => {}, {
        okLabel: "Done", init(d) {
          const bind = () => {
            d.querySelectorAll("[data-gid]").forEach((r) => {
              const q = guides().find((x) => x.id === r.dataset.gid); if (!q) return;
              r.querySelector(".gdP").onchange = (e) => { q.p = fromUnit(+e.target.value || 0, SN.unit, SN.dpi); E.drawOverlay(); };
              r.querySelector(".gdX").onclick = () => { removeGuide(q.id); d.querySelector("#gdList").innerHTML = rows(); bind(); };
            });
          };
          bind();
          d.querySelector("#gdAdd").onclick = () => { addGuide(d.querySelector("#gdO").value, fromUnit(+d.querySelector("#gdN").value || 0, SN.unit, SN.dpi)); SN.show = true; keep(); d.querySelector("#gdList").innerHTML = rows(); bind(); };
          d.querySelector("#gdClear").onclick = () => { S.guides = []; E.drawOverlay(); d.querySelector("#gdList").innerHTML = rows(); bind(); };
        },
      });
    }
    function settingsDialog() {
      if (E.prefs && E.prefs.open) return E.prefs.open("grid");                 // 2.445.0: the ⚙ settings' Grids & Guides tab
      E.ui.dialog("Grid and Snapping", `<div class="rw"><span>Snap distance (screen px)</span><input type="number" id="snD" min="1" max="50" value="${SN.dist}"></div>
        <div class="rw"><span>Grid spacing (px, 0 = as drawn)</span><input type="number" id="snG" min="0" max="4096" value="${SN.gridPx}"></div>
        <div class="rw"><span>Document dpi (for mm / cm / in / pt)</span><input type="number" id="snDpi" min="1" max="4800" value="${SN.dpi}"></div>
        <div class="rw"><span>Guideline colour</span><input type="color" id="snC" value="${SN.color}"></div>`,
      (d) => { SN.dist = Math.max(1, Math.min(50, +d.querySelector("#snD").value || 8)); SN.gridPx = Math.max(0, +d.querySelector("#snG").value || 0); SN.dpi = Math.max(1, +d.querySelector("#snDpi").value || 96); SN.color = d.querySelector("#snC").value; keep(); if (SN.gridPx) S.gridFixed = SN.gridPx; E.drawOverlay(); if (E.ui.rulers) E.ui.rulers(); });
    }

    /* ---- the menus */
    const C = E.ui.addCmd, sep = E.ui.sep;
    const tog = (k, label) => () => { SN[k] = !SN[k]; keep(); E.drawOverlay(); say(`${label} ${SN[k] ? "on" : "off"}`); };
    C("snap.on", "Snap", "Shift+Ctrl+;", tog("snap", "snapping"), { checked: () => SN.snap });
    for (const [k, n] of [["grid", "Grid"], ["guides", "Guidelines"], ["objects", "Objects"], ["nodes", "Nodes"], ["midpoints", "Midpoints"], ["intersections", "Intersections"], ["page", "Page"]]) C("snap." + k, n, "", tog(k, "snap to " + n.toLowerCase()), { checked: () => SN[k] });
    C("guide.show", "Guidelines", "Ctrl+;", tog("show", "guidelines"), { checked: () => SN.show });
    C("guide.lock", "Lock Guidelines", "Alt+Ctrl+;", tog("lock", "guidelines locked"), { checked: () => SN.lock });
    C("guide.new", "New Guideline…", "", newGuideDialog, { enabled: () => !!S.w });
    C("guide.edit", "Guidelines…", "", guidesDialog, { enabled: () => !!S.w });
    C("guide.clear", "Clear Guidelines", "", () => { S.guides = []; E.drawOverlay(); say("guidelines cleared"); }, { enabled: () => guides().length > 0 });
    C("snap.settings", "Grid and Snapping…", "", settingsDialog);
    for (const u of Object.keys(UNITS)) C("ruler." + u, UNITS[u].n[0].toUpperCase() + UNITS[u].n.slice(1), "", () => { SN.unit = u; keep(); if (E.ui.rulers) E.ui.rulers(); }, { checked: () => SN.unit === u });
    const V = E.ui.MENUS.find(([n]) => n === "View");
    if (V) {
      const items = V[1], at = items.indexOf("view.grid");
      items.splice(at + 1, 0, { label: "Ruler Units", items: Object.keys(UNITS).map((u) => "ruler." + u) }, "guide.show", "guide.lock", "guide.new", "guide.edit", "guide.clear", sep,
        { label: "Snap To", items: ["snap.on", sep, "snap.grid", "snap.guides", "snap.objects", "snap.nodes", "snap.midpoints", "snap.intersections", "snap.page"] }, "snap.settings");
    }
    // the grid drawn at the spacing set (pcui draws its own when none is set)
    if (SN.gridPx) S.gridFixed = SN.gridPx;
    /* ---- 2.445.0: the ⚙ settings' Grids & Guides tab (pcprefs.js takes E.prefTabs) + the ⊞ grid button on the top bar */
    const GR = root.H3Grid;
    if (GR) {
      E.prefTabs = (E.prefTabs || []).concat([{ id: "grid", label: "Grids & Guides", order: 20,
        html: () => GR.tabHtml(gridSpec(), "igr") + `<div class="kxrow" style="margin-top:6px"><label><input type="checkbox" id="igrShow"${S.grid ? " checked" : ""}> Show the grid</label>
          <label><input type="checkbox" id="igrSnap"${SN.grid ? " checked" : ""}> Snap to the grid</label><span>Document dpi</span><input type="number" id="igrDpi" min="1" max="4800" value="${SN.dpi}" style="width:70px"></div>`,
        apply: (d) => {
          const g = GR.readTab(d, "igr", gridSpec());
          Object.assign(SN, { gridPx: g.spacing, gridMajor: g.major, gridStyle: g.style, gridColor: g.color, gridOpacity: g.opacity, color: g.guideColor, dist: g.snap, grid: d.querySelector("#igrSnap").checked, dpi: Math.max(1, +d.querySelector("#igrDpi").value || SN.dpi) });
          S.gridFixed = SN.gridPx; keep();
          const show = d.querySelector("#igrShow").checked; if (show !== !!S.grid) { S.grid = show; store.set("grid", S.grid); }
          paintGridBtn(); if (E.ui.rulers) E.ui.rulers();
        } }]);
    }
    const mr = stage.closest(".kx") && stage.closest(".kx").querySelector(".pcmenu .mr");
    let gbtn = null;
    function paintGridBtn() { if (gbtn) { gbtn.classList.toggle("on", !!S.grid); gbtn.setAttribute("aria-pressed", S.grid ? "true" : "false"); } }
    if (mr && !$("kxGridBtn")) {
      gbtn = doc.createElement("button"); gbtn.className = "ghost"; gbtn.id = "kxGridBtn"; gbtn.type = "button"; gbtn.textContent = "⊞";
      gbtn.title = "Grid on / off (Ctrl+') - its spacing, major lines, lines or dots, colours: ⚙ ▸ Grids & Guides"; gbtn.setAttribute("aria-label", "Grid");
      gbtn.onclick = () => { if (E.ui.run) E.ui.run("view.grid"); else { S.grid = !S.grid; store.set("grid", S.grid); E.drawOverlay(); } paintGridBtn(); };
      const full = $("kxFull"); if (full && full.parentNode === mr) mr.insertBefore(gbtn, full); else mr.appendChild(gbtn);
      paintGridBtn();
    }
    E.overlayHooks.push(() => paintGridBtn());
    E.guides = { list: () => guides().slice(), add: addGuide, remove: removeGuide, settings: SN, gridSpec, targets, newGuideDialog, guidesDialog, settingsDialog, last: () => last };
  }

  const PCGuides = { UNITS, toUnit, fromUnit, gridStep, targetsOf, snapPoint, snapBox, SNAP_TOOLS, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCGuides;
  else root.PCGuides = PCGuides;
})(typeof window !== "undefined" ? window : globalThis);
