/* pcvline.js — CORELDRAW'S CURVE TOOLS, SHAPE TOOL AND OUTLINE PEN IN THE IMAGE EDITOR; VECTOR LINE <-> PATH;
 * PHOTOSHOP'S CURVATURE PEN AND PATH ALIGNMENT (2.425.0), window.PCVLine.
 *
 * Tim (verbatim): "continue with the photoshop gap closure, add a bezier line tool that can be a vector and converted to
 * a path and back to a vector. make the bezier line tool the same as coreldraw" (keys: "Corel keys: F5 + F10"). The
 * maths is pcbezier.js (window.PCBez) on pcpath.js's model; the paths / Paths panel are pcpen.js's (E.pen).
 *
 *   F5   THE CURVE TOOLS (F5 again cycles): Bézier (click = cusp node, drag = smooth node, C / S while dragging = cusp /
 *        smooth, Ctrl = 15°, click the first node = close, double-click / Space / Enter = done, Esc = drop the line;
 *        starting on an open end of the active line carries it on), Freehand (drag = freehand, Freehand smoothing;
 *        click - click = a straight line), 2-Point Line (drag), Polyline (clicks = straight segments, a drag = a
 *        freehand stretch, double-click ends), 3-Point Curve (drag start -> end, then click where it bends through),
 *        B-Spline (click control points - the curve follows them; it stays a B-spline for the Shape tool), Pen
 *        (CorelDRAW's: the Bézier with the next segment shown and nodes added / deleted on the active line).
 *        Each draws a VECTOR LINE layer (a shape layer + L.shape.line - the outline pen) or carries one on.
 *   F10  THE SHAPE TOOL: nodes - click / Shift-click / marquee, drag them, their handles (cusp / smooth / symmetrical
 *        behave as in Corel), drag a segment to bend it, double-click = add / delete a node; the property bar: Add,
 *        Delete, Join two nodes, Break curve, To line, To curve, Cusp / Smooth / Symmetrical (C / S / Y), Reverse
 *        direction, Extend curve to close, Extract subpath, Auto-close, Reduce nodes (+ smoothness), select all; on any
 *        shape layer or path; a B-spline line: its control points.
 *   F12  THE OUTLINE PEN (Layer ▸ Outline Pen…): colour, width, style (+ custom dashes), corners, caps, position
 *        (outside / centre / inside), arrowheads start / end + size + swap, behind fill, scale with object; the fill.
 *   Ctrl+Q  CONVERT TO CURVES: a rectangle / ellipse / polygon / line / custom shape layer becomes an editable vector line.
 *   VECTOR <-> PATH  Layer ▸ Vector Line: Convert to Path… (a saved path that remembers the outline pen; keep the layer
 *        or not) and Vector Line: Make from Path… (the Paths panel's 〰 too) - a path made from a line comes back as that
 *        line exactly; any other path takes the curve tools' outline. SVG out / in keeps them as lines (data-bitgen-vline).
 *   Photoshop (gap 1's rest): the CURVATURE PEN (P: clicks = points the curve passes through; double-click a point =
 *        corner / smooth; drag one to move it; Enter / Esc ends), the Pen's RUBBER BAND option (pcpen.js), and Path
 *        Selection's ALIGN / DISTRIBUTE (to the picked components or the canvas).
 */
(function (root) {
  "use strict";
  const CURVE_TOOLS = ["bezier", "freehand", "line2", "polyline", "curve3", "bspline", "cpen"];

  function install(E) {
    const Q = root.PCPath, B = root.PCBez;
    if (!Q || !B || !E.tools || !E.pen) return;
    const { S, D, doc, say, store, ctx, newCanvas } = E;
    const T = E.tools;
    if (!doc.getElementById("pcvlineCss")) {
      const st = doc.createElement("style"); st.id = "pcvlineCss";
      st.textContent = ".kx .vlb{min-width:24px;padding:2px 5px}.kx .vlb.on{border-color:var(--pc-accent);color:var(--pc-accent)}.kx .vlsel{max-width:96px}"
        + ".kx .opdlg .rw{display:grid;grid-template-columns:110px 1fr 1fr;gap:6px;align-items:center;margin:4px 0}.kx .opdlg canvas{border:1px solid var(--pc-line);background:#fff;border-radius:4px}";
      doc.head.appendChild(st);
    }
    // the curve tools' outline for new lines (the property bar sets it; it follows the active line too)
    S.vlW = +store.get("vl.w", 3) || 3;
    S.vlLine = Object.assign({}, B.LINE_DEFAULT, store.get("vl.line", {}));
    S.vlFillOn = !!store.get("vl.autofill", true);     // 2.430.0: auto-fill closed curves (with the colour picked last), on by default
    S.vlSmooth = +store.get("vl.smooth", 50);
    S.vlReduce = +store.get("vl.reduce", 30);
    const saveDefaults = () => { store.set("vl.w", S.vlW); store.set("vl.line", S.vlLine); store.set("vl.autofill", S.vlFillOn); };
    const auto = () => (E.autoFill ? E.autoFill() : { fill: S.bg, fillOn: S.vlFillOn });
    const R = () => 6 / (S.zoom || 1), JOIN = () => 8 / (S.zoom || 1);
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const isVL = (L) => !!(L && L.type === "shape" && L.shape && L.shape.kind === "path" && L.shape.line);
    const near = (a, x, y, r) => Math.hypot(a.x - x, a.y - y) <= (r || R());

    /* ---------------- undo ---------------- */
    let live = null;
    const begin = () => { if (!live) live = E.snapStruct(); };
    function commit(label) {
      if (!live) return false; const before = live; live = null;
      E.push({ t: "struct", before, after: E.snapStruct(), label }); E.refresh(); E.renderLayersPanel(); return true;
    }
    function cancel() { if (!live) return; E.putStruct(live); live = null; E.refresh(); E.renderLayersPanel(); }
    function once(label, f) {
      if (!S.w) return false; begin(); let r;
      try { r = f(); } catch (e) { cancel(); say(label + ": " + e.message); return false; }
      if (r === false) { cancel(); return false; }
      commit(label); E.renderOptions(); return true;
    }
    /** a line's path changed: its box, its pixels */
    function setPath(L, p) { L.shape.path = p; Q.syncShape(L.shape); D.rasterize(L); E.renderSoon(); }
    const lineCount = () => S.layers.filter(isVL).length;
    /** a new vector line layer above the active one (no undo of its own) */
    function newLine(sub, name, extra) {
      const L = E.makeLayer(name || "Curve " + (lineCount() + 1), S.w, S.h, "shape");
      const af = auto();
      L.shape = Object.assign({}, D.SHAPE_DEFAULT, { kind: "path", path: { subs: [sub] }, fill: af.fill, fillOn: af.fillOn, stroke: S.fg, strokeW: S.vlW, strokeOn: S.vlW > 0,
        line: Object.assign({}, B.LINE_DEFAULT, S.vlLine) }, extra || {});
      Q.syncShape(L.shape); E.pen.insertLayer(L); D.rasterize(L); E.pen.setTarget({ k: "shape", id: L.id });
      return L;
    }
    /** an open end of the active vector line within reach of (x, y): {L, s, atStart} */
    function openEndAt(x, y) {
      const L = E.layer(); if (!isVL(L)) return null;
      const subs = L.shape.path.subs;
      for (let s = subs.length - 1; s >= 0; s--) {
        const sb = subs[s]; if (sb.closed || sb.pts.length < 1) continue;
        if (near(sb.pts[sb.pts.length - 1], x, y, JOIN())) return { L, s, atStart: false };
        if (sb.pts.length > 1 && near(sb.pts[0], x, y, JOIN())) return { L, s, atStart: true };
      }
      return null;
    }
    /** the open end hit becomes the END of its sub-path (a start is reversed first) */
    function endFirst(hit) {
      if (!hit.atStart) return hit;
      const p = Q.clone(hit.L.shape.path); p.subs[hit.s] = Q.reverseSub(p.subs[hit.s]); setPath(hit.L, p);
      return Object.assign({}, hit, { atStart: false });
    }
    /** a finished piece (freehand, 2-point, 3-point) onto the active line when it starts / ends at an open end of it,
     *  else a new vector line */
    function placeSub(sub, label) {
      return once(label, () => {
        const f = sub.pts[0], l = sub.pts[sub.pts.length - 1];
        let hit = openEndAt(f.x, f.y), piece = sub;
        if (!hit) { const h2 = openEndAt(l.x, l.y); if (h2) { hit = h2; piece = Q.reverseSub(sub); } }
        if (hit && !sub.closed) {
          hit = endFirst(hit);
          const p = Q.clone(hit.L.shape.path), tgt = p.subs[hit.s], end = tgt.pts[tgt.pts.length - 1], first = piece.pts[0];
          end.ox = end.x + (first.ox - first.x); end.oy = end.y + (first.oy - first.y); end.smooth = false;
          tgt.pts.push(...piece.pts.slice(1).map((a) => Q.clone(a)));
          // the far end on the line's own start: it closes
          const a0 = tgt.pts[0], z = tgt.pts[tgt.pts.length - 1];
          if (tgt.pts.length > 2 && near(a0, z.x, z.y, JOIN())) { a0.ix = z.ix; a0.iy = z.iy; tgt.pts.pop(); tgt.closed = true; }
          setPath(hit.L, p);
          say(`${label}: carried on "${hit.L.name}" - ${Q.count(p)} nodes`);
          return;
        }
        const L = newLine(Q.clone(sub));
        say(`${label}: ${L.name} - ${sub.pts.length} nodes, ${Math.round(B.subLength(sub))} px long (F10 = the Shape tool edits it)`);
      });
    }

    /* ================================ the property bar ================================ */
    const activeVL = () => { const L = E.layer(); return isVL(L) ? L : null; };
    const opts = (list, cur) => list.map(([v, n]) => `<option value="${v}"${v === cur ? " selected" : ""}>${esc(n)}</option>`).join("");
    function lineBar() {
      const L = activeVL(), sh = L ? L.shape : null, ln = sh ? Object.assign({}, B.LINE_DEFAULT, sh.line) : S.vlLine;
      const w = sh ? (sh.strokeOn ? sh.strokeW : 0) : S.vlW, col = sh ? sh.stroke : S.fg, fillOn = sh ? sh.fillOn !== false : S.vlFillOn, fill = sh ? sh.fill : auto().fill;
      return `<span class="sep"></span><label title="Outline width (px) - 0 = none">✒ <input type="number" id="vlW" min="0" max="500" step="0.5" value="${w}" style="width:52px"></label>`
        + `<input type="color" id="vlC" value="${col}" title="Outline colour">`
        + `<select id="vlStyle" class="vlsel" title="Line style">${opts(B.STYLES, ln.style)}</select>`
        + `<select id="vlStart" class="vlsel" title="Start arrowhead">${opts(B.ARROWS.map(([v, n]) => [v, "◂ " + n]), ln.start)}</select>`
        + `<select id="vlEnd" class="vlsel" title="End arrowhead">${opts(B.ARROWS.map(([v, n]) => [v, n + " ▸"]), ln.end)}</select>`
        + `<label title="${sh ? "Fill this curve where it is closed" : "Auto-fill: a curve is filled when it is closed - with the colour picked last (the palette on the right, a swatch, the pickers)"}"><input type="checkbox" id="vlFillOn" ${fillOn ? "checked" : ""}>▨</label><input type="color" id="vlFill" value="${fill}" title="Fill colour">`
        + `<button class="ghost vlb" id="vlPen" title="Outline Pen (F12): corners, caps, dashes, position, arrow size, behind fill, scale with object">F12…</button>`
        + `<button class="ghost vlb" id="vlToPath" title="Vector Line: Convert to Path - a saved path that remembers this outline">⇢</button>`;
    }
    /** a change from the bar: the active line (one undo step) and the next lines */
    function setLine(label, f) {
      const L = activeVL();
      f(null);                                                       // the defaults
      saveDefaults();
      if (L) once(label, () => { f(L.shape); D.rasterize(L); });
    }
    function bindLineBar(o) {
      const q = (id) => o.querySelector("#" + id);
      if (!q("vlW")) return;
      q("vlW").onchange = () => { const w = Math.max(0, +q("vlW").value || 0); setLine("outline width", (sh) => { if (sh) { sh.strokeW = w; sh.strokeOn = w > 0; } else S.vlW = w; }); };
      q("vlC").onchange = () => { const c = q("vlC").value; E.setFg(c); setLine("outline colour", (sh) => { if (sh) sh.stroke = c; }); };
      q("vlStyle").onchange = () => { const v = q("vlStyle").value; if (v === "custom") { dlgOutline(); return; } setLine("line style", (sh) => { (sh ? (sh.line = Object.assign({}, B.LINE_DEFAULT, sh.line)) : S.vlLine).style = v; }); };
      q("vlStart").onchange = () => { const v = q("vlStart").value; setLine("start arrowhead", (sh) => { (sh ? (sh.line = Object.assign({}, B.LINE_DEFAULT, sh.line)) : S.vlLine).start = v; }); };
      q("vlEnd").onchange = () => { const v = q("vlEnd").value; setLine("end arrowhead", (sh) => { (sh ? (sh.line = Object.assign({}, B.LINE_DEFAULT, sh.line)) : S.vlLine).end = v; }); };
      q("vlFillOn").onchange = () => { const v = q("vlFillOn").checked; setLine("fill", (sh) => { if (sh) sh.fillOn = v; else S.vlFillOn = v; }); };
      q("vlFill").onchange = () => { const c = q("vlFill").value; E.setBg(c); setLine("fill colour", (sh) => { if (sh) { sh.fill = c; sh.fillOn = true; } }); };
      q("vlPen").onclick = () => dlgOutline();
      q("vlToPath").onclick = () => dlgToPath();
    }
    const hint = (t) => `<span class="pnhint" title="${esc(t)}">ⓘ</span>`;

    /* ================================ F5: Bézier (and CorelDRAW's Pen) ================================ */
    let bz = null;            // the line being drawn: {L, s, n0, snap0, created, drag, hover, tool}
    function bzSub() { if (!bz || !S.layers.includes(bz.L) || !isVL(bz.L)) { bz = null; return null; } const sb = bz.L.shape.path.subs[bz.s]; if (!sb || sb.closed) { bz = null; return null; } return sb; }
    /** done drawing: a line of one node is dropped (and its undo steps); keep = the line stays */
    function bzFinish(drop) {
      if (!bz) return;
      const b = bz; bz = null;
      if (live) commit(b.tool === "cpen" ? "pen" : "Bézier");
      const sub = S.layers.includes(b.L) && isVL(b.L) ? b.L.shape.path.subs[b.s] : null;
      if (drop || !sub || sub.pts.length < 2) {
        if (b.created || drop) { E.putStruct(b.snap0); S.undo.length = Math.min(S.undo.length, b.n0); E.refresh(); E.renderLayersPanel(); if (E.ui.history) E.ui.history(); }
        say(drop ? "line dropped" : "a line needs two nodes - click where it goes next");
      } else say(`${b.L.name}: ${sub.pts.length} nodes, ${Math.round(B.subLength(sub))} px - F10 (Shape tool) edits its nodes`);
      E.drawOverlay(); E.renderOptions();
    }
    function makeBezierTool(id, name, pen) {
      return {
        id, name, cursor: "crosshair",
        options() {
          return (pen ? `<label title="Over the active line: click a segment = add a node, a node = delete it"><input type="checkbox" id="vlAuto" ${S.vlAuto !== false ? "checked" : ""}> Auto add-delete</label>` : "")
            + lineBar() + hint(pen ? "click = straight segment · drag = curve · the next segment follows the pointer · click the first node = close · double-click / Enter / Space = done · Esc = drop the line · Ctrl = 15°"
              : "click = cusp node (straight segments) · drag = smooth node (curves) · C / S while dragging = cusp / smooth · Ctrl = 15° · click the first node = close · double-click / Enter / Space = done · Esc = drop the line · start on an open end of the active line to carry it on");
        },
        bindOptions(o) { bindLineBar(o); const a = o.querySelector("#vlAuto"); if (a) a.onchange = () => { S.vlAuto = a.checked; }; },
        down(e, fx, fy) {
          if (!S.w) return false;
          let sub = bzSub();
          if (sub && bz.tool !== id) { bzFinish(false); sub = null; }
          if (!sub) {
            // CorelDRAW's Pen: auto add / delete on the active line
            const A = activeVL();
            if (pen && S.vlAuto !== false && A) {
              const p = A.shape.path, h = Q.hitAnchor(p, fx, fy, R());
              if (h && h.part === "anchor" && !B.isEnd(p.subs[h.s], h.i)) { once("delete node", () => setPath(A, Q.removeAnchor(p, h.s, h.i))); return false; }
              const ns = Q.nearestSeg(p, fx, fy);
              if (ns && ns.d <= R() && !(h && h.part === "anchor")) { once("add node", () => setPath(A, Q.insertAt(p, ns.s, ns.i, ns.t))); return false; }
            }
            const snap0 = E.snapStruct(), n0 = S.undo.length;
            begin();
            const hit = openEndAt(fx, fy);
            if (hit) {
              const h = endFirst(hit);
              bz = { L: h.L, s: h.s, n0, snap0, created: false, tool: id, drag: { i: h.L.shape.path.subs[h.s].pts.length - 1, x0: fx, y0: fy, cusp: true, existing: true } };
              say(`carrying on "${h.L.name}" - click / drag the next nodes`);
              return;
            }
            const L = newLine({ closed: false, op: "add", pts: [Q.anchor(fx, fy)] });
            bz = { L, s: 0, n0, snap0, created: true, tool: id, drag: { i: 0, x0: fx, y0: fy } };
            say(`${name}: first node - click for straight segments, drag for curves; double-click / Enter ends`);
            E.renderOptions();
            return;
          }
          const L = bz.L, p = Q.clone(L.shape.path), sb = p.subs[bz.s], n = sb.pts.length, f = sb.pts[0], l = sb.pts[n - 1];
          begin();
          if (n >= 2 && near(f, fx, fy)) { sb.closed = true; setPath(L, p); bz.drag = { close: true, x0: fx, y0: fy }; return; }
          const [x, y] = e.ctrlKey || e.metaKey ? B.constrain(l.x, l.y, fx, fy) : [fx, fy];
          sb.pts.push(Q.anchor(x, y)); setPath(L, p);
          bz.drag = { i: n, x0: x, y0: y };
        },
        move(e, fx, fy) {
          if (!bz || !bz.drag) return;
          const d = bz.drag, L = bz.L;
          if (!d.moved && Math.hypot(fx - d.x0, fy - d.y0) < 2 / (S.zoom || 1)) return;
          d.moved = true;
          const p = L.shape.path;
          if (d.close) { const q = Q.clone(p), a = q.subs[bz.s].pts[0]; a.ix = 2 * a.x - fx; a.iy = 2 * a.y - fy; if (!d.cusp) { a.ox = fx; a.oy = fy; a.smooth = true; } setPath(L, q); return; }
          setPath(L, Q.pullHandles(p, bz.s, d.i, fx, fy, !!d.cusp));
        },
        up() {
          if (!bz) return;
          const d = bz.drag; bz.drag = null;
          if (d && d.close) { const b = bz; bz = null; commit("close curve"); say(`${b.L.name}: closed - ${Q.count(b.L.shape.path)} nodes`); E.renderOptions(); E.drawOverlay(); return; }
          if (live) commit(d && d.moved ? "Bézier curve node" : "Bézier node");
          E.drawOverlay();
        },
        hover(e, fx, fy) { if (bz) { bz.hover = [fx, fy, e.ctrlKey || e.metaKey]; } },
        dblclick() {
          const sub = bzSub(); if (!sub) return;
          const n = sub.pts.length;
          if (n >= 2 && near(sub.pts[n - 1], sub.pts[n - 2].x, sub.pts[n - 2].y, 3 / (S.zoom || 1))) {
            const last = S.undo[S.undo.length - 1];
            if (last && last.t === "struct" && S.undo.length > bz.n0) { S.undo.pop(); E.putStruct(last.before); E.refresh(); }
          }
          bzFinish(false);
        },
        key(e) {
          const k = (e.key || "").toLowerCase();
          if (bz && bz.drag && (k === "c" || k === "s")) { bz.drag.cusp = k === "c"; say(k === "c" ? "cusp node - the next segment can turn" : "smooth node"); return true; }
          if (!bz) return false;
          if (k === "enter" || k === " ") { bzFinish(false); return true; }
          if (k === "escape") { bzFinish(true); return true; }
          return false;
        },
        leave() { if (bz) bzFinish(false); },
      };
    }
    T.bezier = makeBezierTool("bezier", "Bézier", false);
    T.cpen = makeBezierTool("cpen", "Pen", true);

    /* ---------------- Freehand ---------------- */
    let fh = null, fhPend = null;
    T.freehand = {
      id: "freehand", name: "Freehand", cursor: "crosshair",
      options: () => `<label title="Freehand smoothing: 0 = every wobble, 100 = very smooth">Smoothing <input type="range" id="vlSm" min="0" max="100" value="${S.vlSmooth}" style="width:80px"></label>` + lineBar()
        + hint("drag = a freehand line · click, click = a straight line · start or end on an open end of the active line to join it · ending on its start closes it"),
      bindOptions(o) { bindLineBar(o); const s = o.querySelector("#vlSm"); s.onchange = () => { S.vlSmooth = +s.value; store.set("vl.smooth", S.vlSmooth); }; },
      down(e, fx, fy) { if (!S.w) return false; fh = { pts: [[fx, fy]], x0: fx, y0: fy, moved: false }; },
      move(e, fx, fy) { if (!fh) return; const l = fh.pts[fh.pts.length - 1]; if (Math.hypot(fx - fh.x0, fy - fh.y0) > 3 / (S.zoom || 1)) fh.moved = true; if (Math.hypot(fx - l[0], fy - l[1]) >= 1.5 / (S.zoom || 1)) { fh.pts.push([fx, fy]); E.drawOverlay(); } },
      up(e, fx, fy) {
        const f = fh; fh = null; E.drawOverlay(); if (!f) return;
        if (!f.moved) {
          if (!fhPend) { fhPend = [f.x0, f.y0]; say("Freehand: click where the straight line ends (Esc = no line)"); E.drawOverlay(); return; }
          const [x, y] = e && (e.ctrlKey || e.metaKey) ? B.constrain(fhPend[0], fhPend[1], f.x0, f.y0) : [f.x0, f.y0];
          const a = fhPend; fhPend = null;
          if (Math.hypot(x - a[0], y - a[1]) > 1) placeSub(B.polyFromClicks([a, [x, y]]), "Freehand line");
          return;
        }
        fhPend = null;
        const a = f.pts[0], b = f.pts[f.pts.length - 1], closed = f.pts.length > 4 && Math.hypot(a[0] - b[0], a[1] - b[1]) <= JOIN();
        const sub = Q.fromPolygon(f.pts, closed, 0.5 + S.vlSmooth / 100 * 7.5, 60);
        if (sub.pts.length >= 2) placeSub(sub, "Freehand");
      },
      hover(e, fx, fy) { if (fhPend) { fhHover = [fx, fy]; E.drawOverlay(); } },
      key(e) { if (e.key === "Escape" && fhPend) { fhPend = null; E.drawOverlay(); return true; } return false; },
      leave() { fh = null; fhPend = null; },
    };
    let fhHover = null;

    /* ---------------- 2-Point Line ---------------- */
    let tl = null;
    T.line2 = {
      id: "line2", name: "2-Point Line", cursor: "crosshair",
      options: () => lineBar() + hint("drag from the start to the end · Ctrl = 15° · start on an open end of the active line to carry it on"),
      bindOptions: bindLineBar,
      down(e, fx, fy) { if (!S.w) return false; tl = { x0: fx, y0: fy, x1: fx, y1: fy }; },
      move(e, fx, fy) { if (!tl) return; [tl.x1, tl.y1] = e.ctrlKey || e.metaKey ? B.constrain(tl.x0, tl.y0, fx, fy) : [fx, fy]; E.drawOverlay(); },
      up() { const t = tl; tl = null; E.drawOverlay(); if (t && Math.hypot(t.x1 - t.x0, t.y1 - t.y0) > 2) placeSub(B.polyFromClicks([[t.x0, t.y0], [t.x1, t.y1]]), "2-Point Line"); else say("2-Point Line: drag from where it starts to where it ends"); },
      leave() { tl = null; },
    };

    /* ---------------- Polyline ---------------- */
    let pl = null;            // {L, s, n0, snap0, created, free: [[x, y]...] while dragging, hover}
    function plSub() { if (!pl || !S.layers.includes(pl.L)) { pl = null; return null; } const sb = pl.L.shape.path.subs[pl.s]; if (!sb || sb.closed) { pl = null; return null; } return sb; }
    function plFinish(drop) {
      if (!pl) return; const b = pl; pl = null;
      if (live) commit("polyline");
      const sub = S.layers.includes(b.L) ? b.L.shape.path.subs[b.s] : null;
      if (drop || !sub || sub.pts.length < 2) { if (b.created || drop) { E.putStruct(b.snap0); S.undo.length = Math.min(S.undo.length, b.n0); E.refresh(); E.renderLayersPanel(); if (E.ui.history) E.ui.history(); } }
      else say(`${b.L.name}: ${sub.pts.length} nodes`);
      E.drawOverlay(); E.renderOptions();
    }
    T.polyline = {
      id: "polyline", name: "Polyline", cursor: "crosshair",
      options: () => lineBar() + hint("click = straight segments · drag = a freehand stretch · Ctrl = 15° · click the first node = close · double-click / Enter / Space = done · Esc = drop it"),
      bindOptions: bindLineBar,
      down(e, fx, fy) {
        if (!S.w) return false;
        if (!plSub()) {
          const snap0 = E.snapStruct(), n0 = S.undo.length; begin();
          const hit = openEndAt(fx, fy);
          if (hit) { const h = endFirst(hit); pl = { L: h.L, s: h.s, n0, snap0, created: false, free: [[fx, fy]] }; return; }
          pl = { L: newLine({ closed: false, op: "add", pts: [Q.anchor(fx, fy)] }), s: 0, n0, snap0, created: true, free: [[fx, fy]] };
          say("Polyline: click the next points (drag for a freehand stretch); double-click ends"); E.renderOptions(); return;
        }
        const p = Q.clone(pl.L.shape.path), sb = p.subs[pl.s], n = sb.pts.length, f = sb.pts[0], l = sb.pts[n - 1];
        begin();
        if (n >= 2 && near(f, fx, fy)) { const b = pl; pl = null; sb.closed = true; setPath(b.L, p); commit("close polyline"); say(`${b.L.name}: closed`); return false; }
        const [x, y] = e.ctrlKey || e.metaKey ? B.constrain(l.x, l.y, fx, fy) : [fx, fy];
        sb.pts.push(Q.anchor(x, y)); setPath(pl.L, p); pl.free = [[x, y]];
      },
      move(e, fx, fy) { if (!pl || !pl.free) return; const l = pl.free[pl.free.length - 1]; if (Math.hypot(fx - l[0], fy - l[1]) >= 1.5 / (S.zoom || 1)) { pl.free.push([fx, fy]); E.drawOverlay(); } },
      up() {
        if (!pl) return;
        const fr = pl.free; pl.free = null;
        if (fr && fr.length > 3 && Math.hypot(fr[fr.length - 1][0] - fr[0][0], fr[fr.length - 1][1] - fr[0][1]) > 4 / (S.zoom || 1)) {
          // a drag: the freehand stretch from the node just placed
          const p = Q.clone(pl.L.shape.path), sb = p.subs[pl.s], fit = Q.fromPolygon(fr, false, 0.5 + S.vlSmooth / 100 * 7.5, 60);
          sb.pts.push(...fit.pts.slice(1)); setPath(pl.L, p);
        }
        if (live) commit("polyline");
        E.drawOverlay();
      },
      hover(e, fx, fy) { if (pl) pl.hover = [fx, fy, e.ctrlKey || e.metaKey]; },
      dblclick() {
        const sub = plSub(); if (!sub) return;
        const n = sub.pts.length;
        if (n >= 2 && near(sub.pts[n - 1], sub.pts[n - 2].x, sub.pts[n - 2].y, 3 / (S.zoom || 1))) { const last = S.undo[S.undo.length - 1]; if (last && last.t === "struct" && S.undo.length > pl.n0) { S.undo.pop(); E.putStruct(last.before); E.refresh(); } }
        plFinish(false);
      },
      key(e) { if (!pl) return false; if (e.key === "Enter" || e.key === " ") { plFinish(false); return true; } if (e.key === "Escape") { plFinish(true); return true; } return false; },
      leave() { if (pl) plFinish(false); },
    };

    /* ---------------- 3-Point Curve ---------------- */
    let tp = null;            // {a, b, m, stage: 1 (dragging the chord) | 2 (bending)}
    T.curve3 = {
      id: "curve3", name: "3-Point Curve", cursor: "crosshair",
      options: () => lineBar() + hint("drag from the start to the end, let go, then move and click where the curve passes through · Ctrl = 15° · Esc cancels"),
      bindOptions: bindLineBar,
      down(e, fx, fy) {
        if (!S.w) return false;
        if (tp && tp.stage === 2) { const t = tp; tp = null; placeSub(B.threePoint(t.a, t.b, [fx, fy]), "3-Point Curve"); E.drawOverlay(); return false; }
        tp = { a: [fx, fy], b: [fx, fy], m: null, stage: 1 };
      },
      move(e, fx, fy) { if (!tp || tp.stage !== 1) return; tp.b = e.ctrlKey || e.metaKey ? B.constrain(tp.a[0], tp.a[1], fx, fy) : [fx, fy]; E.drawOverlay(); },
      up() { if (!tp) return; if (Math.hypot(tp.b[0] - tp.a[0], tp.b[1] - tp.a[1]) > 3) { tp.stage = 2; say("3-Point Curve: move to bend it, click to set"); } else { tp = null; say("3-Point Curve: drag the chord first (start -> end)"); } E.drawOverlay(); },
      hover(e, fx, fy) { if (tp && tp.stage === 2) { tp.m = [fx, fy]; E.drawOverlay(); } },
      key(e) { if (tp && e.key === "Escape") { tp = null; E.drawOverlay(); return true; } return false; },
      leave() { tp = null; },
    };

    /* ---------------- B-Spline ---------------- */
    let bs = null;            // {L, n0, snap0, hover}
    const splineOf = (L) => (isVL(L) && L.shape.line.spline ? L.shape.line.spline : null);
    /** a B-spline line's control points, moved with the line when something else moved / scaled it */
    function splineNow(L) {
      const sp = splineOf(L); if (!sp) return null;
      const own = Q.bbox({ subs: [B.bspline(sp.pts, sp.closed)] }), cur = Q.bbox(L.shape.path);
      if (!own || !cur || (Math.abs(own.x - cur.x) < 0.01 && Math.abs(own.y - cur.y) < 0.01 && Math.abs(own.w - cur.w) < 0.01 && Math.abs(own.h - cur.h) < 0.01)) return sp;
      const sx = own.w > 1e-9 ? cur.w / own.w : 1, sy = own.h > 1e-9 ? cur.h / own.h : 1;
      return { closed: sp.closed, pts: sp.pts.map(([x, y]) => [cur.x + (x - own.x) * sx, cur.y + (y - own.y) * sy]) };
    }
    function setSpline(L, sp) { L.shape.line = Object.assign({}, L.shape.line, { spline: { closed: !!sp.closed, pts: sp.pts.map((v) => [v[0], v[1]]) } }); setPath(L, { subs: [B.bspline(sp.pts, sp.closed)] }); }
    function bsFinish(drop) {
      if (!bs) return; const b = bs; bs = null;
      if (live) commit("B-spline");
      const sp = S.layers.includes(b.L) ? splineOf(b.L) : null;
      if (drop || !sp || sp.pts.length < 2) { E.putStruct(b.snap0); S.undo.length = Math.min(S.undo.length, b.n0); E.refresh(); E.renderLayersPanel(); if (E.ui.history) E.ui.history(); if (!drop) say("a B-spline needs two control points"); }
      else say(`${b.L.name}: B-spline, ${sp.pts.length} control points - F10 moves them`);
      E.drawOverlay(); E.renderOptions();
    }
    T.bspline = {
      id: "bspline", name: "B-Spline", cursor: "crosshair",
      options: () => lineBar() + hint("click the control points - the curve follows them smoothly · click the first one = close · double-click / Enter / Space = done · Esc = drop it · F10 moves the control points later"),
      bindOptions: bindLineBar,
      down(e, fx, fy) {
        if (!S.w) return false;
        if (!bs || !S.layers.includes(bs.L)) {
          const snap0 = E.snapStruct(), n0 = S.undo.length; begin();
          const L = newLine({ closed: false, op: "add", pts: [Q.anchor(fx, fy)] }, "B-Spline " + (lineCount() + 1));
          L.shape.line.spline = { closed: false, pts: [[fx, fy]] };
          bs = { L, n0, snap0 }; commit("B-spline point"); E.renderOptions();
          say("B-Spline: click the next control points; double-click ends"); return false;
        }
        const sp = splineOf(bs.L), f = sp.pts[0];
        begin();
        if (sp.pts.length >= 3 && Math.hypot(f[0] - fx, f[1] - fy) <= R()) { const b = bs; bs = null; setSpline(b.L, { closed: true, pts: sp.pts }); commit("close B-spline"); say(`${b.L.name}: closed`); E.renderOptions(); return false; }
        setSpline(bs.L, { closed: false, pts: sp.pts.concat([[fx, fy]]) }); commit("B-spline point");
        return false;
      },
      hover(e, fx, fy) { if (bs) bs.hover = [fx, fy]; },
      dblclick() {
        if (!bs) return; const sp = splineOf(bs.L);
        if (sp && sp.pts.length >= 3) { const a = sp.pts[sp.pts.length - 1], b = sp.pts[sp.pts.length - 2]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 3 / (S.zoom || 1)) { const last = S.undo[S.undo.length - 1]; if (last && last.t === "struct" && S.undo.length > bs.n0) { S.undo.pop(); E.putStruct(last.before); E.refresh(); } } }
        bsFinish(false);
      },
      key(e) { if (!bs) return false; if (e.key === "Enter" || e.key === " ") { bsFinish(false); return true; } if (e.key === "Escape") { bsFinish(true); return true; } return false; },
      leave() { if (bs) bsFinish(false); },
    };

    /* ================================ F10: the Shape tool ================================ */
    const nsel = new Set();   // "s:i"
    const nk = (s, i) => s + ":" + i;
    const nodes = () => [...nsel].map((k) => k.split(":").map(Number));
    let sh = null;            // the drag: {mode: nodes | handle | bend | marquee | ctrl, ...}
    /** what the Shape tool edits: the active shape layer (vector line or not), else the picked path */
    function stInfo() {
      const L = E.layer();
      if (L && L.type === "shape" && L.shape) { const t = S.ptarget; if (!t || t.k !== "shape" || t.id !== L.id) E.pen.setTarget({ k: "shape", id: L.id }); }
      return E.pen.targetInfo();
    }
    /** stInfo without changing the pick (the overlay draws from it) */
    function stPeek() { const L = E.layer(); if (L && L.type === "shape" && L.shape) return { k: "shape", L, path: L.shape.kind === "path" ? L.shape.path : Q.fromShape(L.shape) }; return E.pen.targetInfo(); }
    function stWrite(info, p) {
      E.pen.writePath(info, p);
      if (info.k === "shape") {
        if (info.L.shape.line && info.L.shape.line.spline && !sh) delete info.L.shape.line.spline;
        // 2.428.0: editing nodes turns a live shape (rectangle, star, spiral ... pcdraw.js) / an artistic-media stroke into curves
        if (info.L.shape.gen) delete info.L.shape.gen; if (info.L.shape.media) delete info.L.shape.media;
        E.renderSoon();
      } else E.drawOverlay();
    }
    const stSpline = () => { const L = E.layer(); return L && splineOf(L) ? L : null; };
    function stPick(fx, fy) {
      const hit = E.pen.layerPathAt(fx, fy);
      if (hit && hit.L !== E.layer()) { E.setActive(S.layers.indexOf(hit.L)); nsel.clear(); E.pen.setTarget({ k: "shape", id: hit.L.id }); E.renderOptions(); return E.pen.targetInfo(); }
      return null;
    }
    T.shapetool = {
      id: "shapetool", name: "Shape", cursor: "default",
      options() {
        const btn = (id, label, t) => `<button class="ghost vlb" id="${id}" title="${esc(t)}">${label}</button>`;
        const info = E.pen.targetInfo(), spl = stSpline();
        let typ = null;
        if (info && nsel.size) { const ts = nodes().map(([s, i]) => { const a = info.path.subs[s] && info.path.subs[s].pts[i]; return a ? B.nodeTypeOf(a) : null; }); if (ts.every((t) => t === ts[0])) typ = ts[0]; }
        const tb = (t, label, title) => `<button class="ghost vlb${typ === t ? " on" : ""}" data-vlnt="${t}" title="${esc(title)}">${label}</button>`;
        return (spl ? `<span style="color:var(--pc-dim)">B-spline: drag its control points</span>` + btn("vlSpl2Bez", "→ Bézier", "Turn the B-spline into ordinary Bézier nodes") :
          btn("vlAdd", "＋", "Add node(s) - in the middle of each picked segment (+, or double-click the line)") + btn("vlDel", "－", "Delete the picked node(s) (Delete / -, or double-click a node)")
          + btn("vlJoin", "⊶", "Join two nodes: the two picked open ends meet (one line closes, two lines become one)") + btn("vlBreak", "⊸", "Break curve at the picked node(s)")
          + `<span class="sep"></span>` + btn("vlToLine", "⟋", "The segment(s) after the picked node(s) become straight") + btn("vlToCurve", "⌒", "The segment(s) after the picked node(s) become curves (with handles)")
          + `<span class="sep"></span>` + tb("cusp", "∠", "Cusp: the handles move freely (C)") + tb("smooth", "∿", "Smooth: the handles stay in line (S)") + tb("symmetrical", "⇔", "Symmetrical: in line and the same length (Y)")
          + `<span class="sep"></span>` + btn("vlRev", "⇄", "Reverse direction (the start / end arrowheads swap ends)") + btn("vlExt", "⊐", "Extend curve to close (the picked sub-path, or every open one)")
          + btn("vlExtract", "⇱", "Extract subpath: the picked one becomes its own line") + btn("vlAuto", "◯", "Auto-close every open sub-path")
          + `<span class="sep"></span><input type="range" id="vlRed" min="0" max="100" value="${S.vlReduce}" style="width:54px" title="Curve smoothness for Reduce Nodes (⋯): 0 = keep the shape exactly">` + btn("vlReduce", "⋯", "Reduce nodes (the picked sub-paths, or all)")
          + btn("vlAll", "▦", "Select all nodes")) + (activeVL() ? lineBar() : "")
          + hint("click / Shift-click / drag a box round nodes · drag nodes, handles, or a segment (bends it) · double-click the line = add a node, a node = delete it · + / - / Delete · C S Y = cusp / smooth / symmetrical · arrows nudge (Shift ×10) · click another shape to edit it");
      },
      bindOptions(o) {
        const on = (id, f) => { const b = o.querySelector("#" + id); if (b) b.onclick = f; };
        on("vlAdd", () => stAddNodes()); on("vlDel", () => stDelNodes()); on("vlJoin", () => stJoin()); on("vlBreak", () => stBreak());
        on("vlToLine", () => stSegs("to line", B.toLine)); on("vlToCurve", () => stSegs("to curve", B.toCurve));
        o.querySelectorAll("[data-vlnt]").forEach((b) => { b.onclick = () => stType(b.dataset.vlnt); });
        on("vlRev", () => stReverse()); on("vlExt", () => stClose(false)); on("vlExtract", () => stExtract()); on("vlAuto", () => stClose(true));
        on("vlReduce", () => stReduce()); on("vlAll", () => { const i = stInfo(); if (!i) return; nsel.clear(); i.path.subs.forEach((sb, s) => sb.pts.forEach((_, k) => nsel.add(nk(s, k)))); E.drawOverlay(); E.renderOptions(); });
        on("vlSpl2Bez", () => { const L = stSpline(); if (L) once("B-spline to Bézier", () => { const ln = Object.assign({}, L.shape.line); delete ln.spline; L.shape.line = ln; D.rasterize(L); }); });
        const red = o.querySelector("#vlRed"); if (red) red.onchange = () => { S.vlReduce = +red.value; store.set("vl.reduce", S.vlReduce); };
        bindLineBar(o);
      },
      down(e, fx, fy) {
        if (!S.w) return false;
        const spl = stSpline();
        if (spl) {
          const sp = splineNow(spl), k = sp.pts.findIndex(([x, y]) => Math.hypot(x - fx, y - fy) <= R() * 1.3);
          if (k >= 0) { begin(); sh = { mode: "ctrl", L: spl, k, sp }; return; }
          const other = stPick(fx, fy); if (other) return false;
          return false;
        }
        let info = stInfo();
        if (!info || (Q.nearestSeg(info.path, fx, fy) || { d: 1e9 }).d > R() && !Q.hitAnchor(info.path, fx, fy, R(), (s, i) => nsel.has(nk(s, i)))) {
          const picked = stPick(fx, fy); if (picked) { info = picked; if (stSpline()) return false; }
        }
        if (!info) { sh = { mode: "marquee", x0: fx, y0: fy, x1: fx, y1: fy, add: e.shiftKey }; say("Shape tool: click a line or shape to edit its nodes (draw one with F5)"); return; }
        const h = Q.hitAnchor(info.path, fx, fy, R(), (s, i) => nsel.has(nk(s, i)) || nsel.has(nk(s, i - 1)) || nsel.has(nk(s, i + 1)));
        if (h && h.part !== "anchor") { begin(); sh = { mode: "handle", s: h.s, i: h.i, part: h.part }; return; }
        if (h) {
          const k = nk(h.s, h.i);
          if (e.shiftKey) { if (nsel.has(k)) nsel.delete(k); else nsel.add(k); } else if (!nsel.has(k)) { nsel.clear(); nsel.add(k); }
          begin(); sh = { mode: "nodes", x0: fx, y0: fy, orig: Q.clone(info.path), list: nodes() }; E.drawOverlay(); E.renderOptions(); return;
        }
        const ns = Q.nearestSeg(info.path, fx, fy);
        if (ns && ns.d <= R()) { begin(); if (!e.shiftKey) nsel.clear(); nsel.add(nk(ns.s, ns.i)); sh = { mode: "bend", s: ns.s, i: ns.i, t: ns.t, x0: fx, y0: fy, orig: Q.clone(info.path) }; E.renderOptions(); return; }
        sh = { mode: "marquee", x0: fx, y0: fy, x1: fx, y1: fy, add: e.shiftKey, info };
      },
      move(e, fx, fy) {
        if (!sh) return;
        if (sh.mode === "marquee") { sh.x1 = fx; sh.y1 = fy; E.drawOverlay(); return; }
        if (sh.mode === "ctrl") { const sp = { closed: sh.sp.closed, pts: sh.sp.pts.map((v, j) => (j === sh.k ? [fx, fy] : v)) }; setSpline(sh.L, sp); sh.moved = true; return; }
        const info = E.pen.targetInfo(); if (!info) return;
        if (sh.mode === "handle") { stWrite(info, B.moveHandle(info.path, sh.s, sh.i, sh.part, fx, fy)); sh.moved = true; return; }
        let dx = fx - sh.x0, dy = fy - sh.y0;
        if (e.ctrlKey || e.metaKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        sh.moved = sh.moved || Math.hypot(dx, dy) > 0.5;
        if (sh.mode === "bend") stWrite(info, B.bendSegment(sh.orig, sh.s, sh.i, sh.t, dx, dy));
        else stWrite(info, Q.moveAnchors(sh.orig, sh.list, dx, dy));
      },
      up() {
        const d = sh; sh = null; if (!d) return;
        if (d.mode === "marquee") {
          const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1), info = d.info || E.pen.targetInfo();
          if (!d.add) nsel.clear();
          if (info && (x1 - x0 > 1 || y1 - y0 > 1)) info.path.subs.forEach((sb, s) => sb.pts.forEach((a, i) => { if (a.x >= x0 && a.x <= x1 && a.y >= y0 && a.y <= y1) nsel.add(nk(s, i)); }));
          if (info) say(nsel.size ? `${nsel.size} node(s) picked` : "no nodes picked");
          E.drawOverlay(); E.renderOptions(); return;
        }
        if (!d.moved) { live = null; E.drawOverlay(); return; }
        commit(d.mode === "ctrl" ? "move control point" : d.mode === "handle" ? "move control handle" : d.mode === "bend" ? "shape segment" : "move nodes");
        E.renderOptions();
      },
      dblclick(e, fx, fy) {
        const spl = stSpline();
        if (spl) {
          const sp = splineNow(spl), k = sp.pts.findIndex(([x, y]) => Math.hypot(x - fx, y - fy) <= R() * 1.3);
          if (k >= 0 && sp.pts.length > 2) return once("delete control point", () => setSpline(spl, { closed: sp.closed, pts: sp.pts.filter((_, j) => j !== k) }));
          // on the control polygon: a new control point there
          let best = -1, bd = R() * 2;
          for (let j = 0; j < sp.pts.length - (sp.closed ? 0 : 1); j++) { const a = sp.pts[j], b = sp.pts[(j + 1) % sp.pts.length], d = segDist(fx, fy, a, b); if (d < bd) { bd = d; best = j; } }
          if (best >= 0) once("add control point", () => { const pts = sp.pts.slice(); pts.splice(best + 1, 0, [fx, fy]); setSpline(spl, { closed: sp.closed, pts }); });
          return;
        }
        const info = E.pen.targetInfo(); if (!info) return;
        const h = Q.hitAnchor(info.path, fx, fy, R());
        if (h && h.part === "anchor") { once("delete node", () => stWrite(info, Q.removeAnchor(info.path, h.s, h.i))); nsel.clear(); return; }
        const ns = Q.nearestSeg(info.path, fx, fy);
        if (ns && ns.d <= R() * 1.5) { once("add node", () => stWrite(info, Q.insertAt(info.path, ns.s, ns.i, ns.t))); nsel.clear(); nsel.add(nk(ns.s, ns.i + 1)); E.drawOverlay(); }
      },
      key(e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return false;
        const info = E.pen.targetInfo(), k = e.key;
        if (!info) return false;
        if ((k === "Delete" || k === "Backspace" || k === "-") && nsel.size) { stDelNodes(); return true; }
        if ((k === "+" || k === "Insert") && nsel.size) { stAddNodes(); return true; }
        if (/^[csy]$/i.test(k) && nsel.size) { stType({ c: "cusp", s: "smooth", y: "symmetrical" }[k.toLowerCase()]); return true; }
        if (/^Arrow/.test(k) && nsel.size) { const n = e.shiftKey ? 10 : 1; once("nudge nodes", () => stWrite(info, Q.moveAnchors(info.path, nodes(), k === "ArrowLeft" ? -n : k === "ArrowRight" ? n : 0, k === "ArrowUp" ? -n : k === "ArrowDown" ? n : 0))); return true; }
        if (k === "Escape" && nsel.size) { nsel.clear(); E.drawOverlay(); E.renderOptions(); return true; }
        return false;
      },
      leave() { sh = null; if (live) commit("shape tool"); },
    };
    function segDist(x, y, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l)); return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy); }
    const needNodes = () => { const i = stInfo(); if (!i) { say("Shape tool: click a line first"); return null; } if (!nsel.size) { say("pick node(s) first - click them, or drag a box round them"); return null; } return i; };
    function stAddNodes() {
      const info = needNodes(); if (!info) return;
      // the picked node's NEXT segment, in the middle - from the end of each sub-path backwards so the indexes hold
      const list = nodes().sort((a, b) => b[0] - a[0] || b[1] - a[1]);
      once("add node", () => { let p = info.path; for (const [s, i] of list) { const sb = p.subs[s]; if (!sb || (i >= sb.pts.length - 1 && !sb.closed)) continue; p = Q.insertAt(p, s, i, 0.5); } stWrite(info, p); });
      nsel.clear(); E.renderOptions();
    }
    function stDelNodes() {
      const info = needNodes(); if (!info) return;
      once("delete node", () => { let p = info.path; nodes().sort((a, b) => b[0] - a[0] || b[1] - a[1]).forEach(([s, i]) => { p = Q.removeAnchor(p, s, i); }); stWrite(info, p); });
      nsel.clear(); E.renderOptions();
    }
    function stJoin() {
      const info = needNodes(); if (!info) return;
      const ends = nodes().filter(([s, i]) => info.path.subs[s] && B.isEnd(info.path.subs[s], i));
      if (ends.length !== 2) return say("Join: pick exactly two open ends (the first / last nodes of open lines)");
      const p = B.joinEnds(info.path, ends[0], ends[1]); if (!p) return say("those two nodes cannot be joined");
      once("join nodes", () => stWrite(info, p)); nsel.clear(); E.renderOptions();
    }
    function stBreak() {
      const info = needNodes(); if (!info) return;
      once("break curve", () => { let p = info.path; nodes().sort((a, b) => b[0] - a[0] || b[1] - a[1]).forEach(([s, i]) => { p = B.breakAt(p, s, i); }); stWrite(info, p); });
      nsel.clear(); E.renderOptions();
    }
    function stSegs(label, f) { const info = needNodes(); if (!info) return; once(label, () => { let p = info.path; for (const [s, i] of nodes()) p = f(p, s, i); stWrite(info, p); }); }
    function stType(type) { const info = needNodes(); if (!info) return; once(type + " node", () => { let p = info.path; for (const [s, i] of nodes()) p = B.nodeType(p, s, i, type); stWrite(info, p); }); E.renderOptions(); }
    const pickedSubs = (info) => { const s = [...new Set(nodes().map(([a]) => a))]; return s.length ? s : info.path.subs.map((_, k) => k); };
    function stReverse() {
      const info = stInfo(); if (!info) return say("Shape tool: click a line first");
      once("reverse direction", () => { let p = info.path; for (const s of pickedSubs(info)) p = B.reverse(p, s); stWrite(info, p); });
      nsel.clear();
    }
    function stClose(all) {
      const info = stInfo(); if (!info) return say("Shape tool: click a line first");
      once(all ? "auto-close curve" : "extend curve to close", () => { let p = info.path; if (all) p = B.autoClose(p); else for (const s of pickedSubs(info)) p = B.extendToClose(p, s); stWrite(info, p); });
      nsel.clear(); E.renderOptions();
    }
    function stExtract() {
      const info = needNodes(); if (!info) return;
      const s = nodes()[0][0]; if (info.path.subs.length < 2) return say("Extract subpath: the line has only one sub-path");
      once("extract subpath", () => {
        const [rest, one] = B.extract(info.path, s); stWrite(info, rest);
        const src = info.k === "shape" ? info.L.shape : null;
        const L = newLine(one.subs[0], (info.k === "shape" ? info.L.name : "Curve") + " (extracted)", src ? { stroke: src.stroke, strokeW: src.strokeW, strokeOn: src.strokeOn, fill: src.fill, fillOn: src.fillOn, line: Object.assign({}, B.LINE_DEFAULT, src.line || {}) } : {});
        L.shape.path = one; Q.syncShape(L.shape); D.rasterize(L);
      });
      nsel.clear(); E.renderOptions();
    }
    function stReduce() {
      const info = stInfo(); if (!info) return say("Shape tool: click a line first");
      const before = Q.count(info.path);
      once("reduce nodes", () => { const p = Q.clone(info.path); for (const s of pickedSubs(info)) p.subs[s] = B.reduce(p.subs[s], S.vlReduce); stWrite(info, p); });
      say(`Reduce Nodes: ${before} -> ${Q.count(E.pen.targetInfo().path)} nodes`); nsel.clear(); E.renderOptions();
    }

    /* ================================ Photoshop's Curvature Pen (P) ================================ */
    let cv = null;            // {info, s, pts: [{x, y, corner}], closed, drag: {k, moved}, n0, hover}
    function cvWrite() {
      const info = E.pen.targetInfo(); if (!cv || !info) return;
      const p = Q.clone(info.path), sub = B.curvature(cv.pts, cv.closed); sub.op = (p.subs[cv.s] && p.subs[cv.s].op) || "add";
      p.subs[cv.s] = sub; E.pen.writePath(info, p);
      if (info.k === "shape") E.renderSoon(); else E.drawOverlay();
    }
    function cvFinish() { if (!cv) return; const c = cv; cv = null; if (live) commit("curvature pen"); if (c.pts.length < 2) { const info = E.pen.targetInfo(); if (info && info.path.subs[c.s] && info.path.subs[c.s].pts.length < 2) once("curvature pen", () => { const p = Q.clone(info.path); p.subs.splice(c.s, 1); E.pen.writePath(info, p); }); } E.drawOverlay(); E.pen.paint(); }
    T.curvpen = {
      id: "curvpen", name: "Curvature Pen", cursor: "crosshair",
      options() {
        const pen = T.pen && T.pen.options ? T.pen.options() : "";
        const m = /^[\s\S]*?<span class="sep"><\/span>[\s\S]*?<span class="sep"><\/span>[\s\S]*?(?=<label title="Over the path)/.exec(pen);
        return (m ? m[0] : "") + hint("click = a point the curve passes through (the curve bends smoothly through them) · double-click a point = corner ⇄ smooth · drag a point to move it · click the first point = close · Enter / Esc ends");
      },
      bindOptions(o) { if (T.pen && T.pen.bindOptions) T.pen.bindOptions(o); },
      down(e, fx, fy) {
        if (!S.w) return false;
        if (cv) {
          const k = cv.pts.findIndex((p) => Math.hypot(p.x - fx, p.y - fy) <= R());
          if (k === 0 && cv.pts.length >= 3 && !cv.closed) { begin(); cv.closed = true; cvWrite(); commit("close path"); cvFinish(); return false; }
          begin();
          if (k >= 0) { cv.drag = { k, moved: false }; return; }
          // between two points when the click is on the curve, else after the last
          const info = E.pen.targetInfo(), ns = info && Q.nearestSeg({ subs: [info.path.subs[cv.s]] }, fx, fy);
          if (ns && ns.d <= R() && ns.i < cv.pts.length - 1 + (cv.closed ? 1 : 0)) cv.pts.splice(ns.i + 1, 0, { x: fx, y: fy, corner: false }); else cv.pts.push({ x: fx, y: fy, corner: false });
          cvWrite(); cv.drag = { k: -1 }; return;
        }
        begin();
        const info = E.pen.drawTarget(S.penMode, S.penOp), first = !info.path.subs.length;
        const p = Q.clone(info.path); p.subs.push({ closed: false, op: first ? "add" : (S.penOp === "new" ? "add" : S.penOp), pts: [Q.anchor(fx, fy)] }); E.pen.writePath(info, p);
        cv = { s: p.subs.length - 1, pts: [{ x: fx, y: fy, corner: false }], closed: false, drag: { k: -1 } };
        say("Curvature Pen: click the next points - the curve bends through them; double-click a point for a corner; Enter ends");
        E.renderOptions(); E.drawOverlay();
      },
      move(e, fx, fy) { if (!cv || !cv.drag || cv.drag.k < 0) return; cv.drag.moved = true; cv.pts[cv.drag.k] = Object.assign({}, cv.pts[cv.drag.k], { x: fx, y: fy }); cvWrite(); },
      up() { if (!cv) return; const d = cv.drag; cv.drag = null; if (d && d.k >= 0 && !d.moved) { live = null; return; } commit(d && d.k >= 0 ? "move point" : "curvature pen"); E.pen.paint(); },
      hover(e, fx, fy) { if (cv) { cv.hover = [fx, fy]; E.drawOverlay(); } },
      dblclick(e, fx, fy) {
        if (!cv) return;
        // the double-click's second click added a point at the same place: take it back, then toggle the point under it
        const last = cv.pts[cv.pts.length - 1];
        const k = cv.pts.findIndex((p, j) => j < cv.pts.length - 1 && Math.hypot(p.x - fx, p.y - fy) <= R());
        if (k >= 0) {
          if (last && Math.hypot(last.x - fx, last.y - fy) <= R() && cv.pts.length > 1 && k !== cv.pts.length - 1) { const u = S.undo[S.undo.length - 1]; if (u && u.t === "struct") { S.undo.pop(); E.putStruct(u.before); } cv.pts.pop(); }
          once("corner / smooth point", () => { cv.pts[k] = Object.assign({}, cv.pts[k], { corner: !cv.pts[k].corner }); cvWrite(); });
        }
      },
      key(e) { if (cv && (e.key === "Enter" || e.key === "Escape")) { cvFinish(); say("path done - click to start another"); return true; } return false; },
      leave() { cvFinish(); },
    };

    /* ================================ Path Selection: align / distribute ================================ */
    if (T.pathsel) {
      const bo = T.pathsel.options, bb = T.pathsel.bindOptions;
      S.pathAlignTo = store.get("path.alignTo", "sel");
      T.pathsel.options = function () {
        const b = (h, ic, t) => `<button class="ghost vlb" data-palign="${h}" title="${t}">${ic}</button>`;
        return bo.call(this) + `<span class="sep"></span><span title="Align / distribute the picked components">Align</span>`
          + b("left", "⇤", "Align left edges") + b("hcenter", "⇹", "Align horizontal centres") + b("right", "⇥", "Align right edges")
          + b("top", "⤒", "Align top edges") + b("vcenter", "⇳", "Align vertical centres") + b("bottom", "⤓", "Align bottom edges")
          + b("dh", "⋯", "Distribute horizontal centres (3 or more)") + b("dv", "⋮", "Distribute vertical centres (3 or more)")
          + `<select id="pnAlignTo" title="Align to"><option value="sel"${S.pathAlignTo === "sel" ? " selected" : ""}>to Selection</option><option value="canvas"${S.pathAlignTo === "canvas" ? " selected" : ""}>to Canvas</option></select>`;
      };
      T.pathsel.bindOptions = function (o) {
        bb.call(this, o);
        const to = o.querySelector("#pnAlignTo"); if (to) to.onchange = () => { S.pathAlignTo = to.value; store.set("path.alignTo", S.pathAlignTo); };
        o.querySelectorAll("[data-palign]").forEach((btn) => { btn.onclick = () => alignPicked(btn.dataset.palign); });
      };
    }
    function alignPicked(how) {
      const info = E.pen.targetInfo(); if (!info) return say("pick a path first");
      let idx = E.pen.picked().comps; if (!idx.length) idx = info.path.subs.map((_, k) => k);
      if (how === "dh" || how === "dv") { if (idx.length < 3) return say("Distribute: pick 3 or more components"); return once("distribute components", () => E.pen.writePath(info, B.distributeSubs(info.path, idx, how === "dh" ? "h" : "v"))); }
      const canvas = S.pathAlignTo === "canvas" || idx.length < 2;
      return once("align components", () => E.pen.writePath(info, B.alignSubs(info.path, idx, how, canvas ? { x: 0, y: 0, w: S.w, h: S.h } : null)));
    }

    /* ================================ the overlay ================================ */
    E.overlayHooks.push((g, px) => {
      if (!S.w) return;
      const tool = S.tool, blue = "#2680eb";
      const sq = (x, y, solid, r) => { const z = (r || 3.5) * px; g.fillStyle = solid ? blue : "#fff"; g.strokeStyle = blue; g.lineWidth = px; g.fillRect(x - z, y - z, 2 * z, 2 * z); g.strokeRect(x - z, y - z, 2 * z, 2 * z); };
      const handle = (a, hx, hy) => { if (hx === a.x && hy === a.y) return; g.strokeStyle = blue; g.lineWidth = px; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(hx, hy); g.stroke(); g.beginPath(); g.arc(hx, hy, 2.5 * px, 0, Math.PI * 2); g.fillStyle = blue; g.fill(); };
      g.setLineDash([]);
      // the curve tools: the active line's nodes; the one being drawn shows its last node's handles + Corel Pen's preview
      if (CURVE_TOOLS.includes(tool)) {
        const L = (bz && bz.L) || (pl && pl.L) || (bs && bs.L) || activeVL();
        if (L && isVL(L) && S.layers.includes(L)) {
          const p = L.shape.path;
          g.strokeStyle = "rgba(38,128,235,.55)"; g.lineWidth = px; Q.traceAll(g, p); g.stroke();
          p.subs.forEach((sb) => sb.pts.forEach((a, i) => { if (!sb.closed && (i === 0 || i === sb.pts.length - 1)) sq(a.x, a.y, false, 3); }));
          const sb = bz ? bzSub() : null;
          if (sb) {
            const a = sb.pts[sb.pts.length - 1]; handle(a, a.ix, a.iy); handle(a, a.ox, a.oy); sq(a.x, a.y, true);
            if (bz.tool === "cpen" && bz.hover && !bz.drag) {
              let [hx, hy] = bz.hover; if (bz.hover[2]) [hx, hy] = B.constrain(a.x, a.y, hx, hy);
              g.strokeStyle = "rgba(38,128,235,.85)"; g.setLineDash([4 * px, 3 * px]); g.beginPath(); g.moveTo(a.x, a.y);
              if (a.ox !== a.x || a.oy !== a.y) g.bezierCurveTo(a.ox, a.oy, hx, hy, hx, hy); else g.lineTo(hx, hy); g.stroke(); g.setLineDash([]);
            }
            const f = sb.pts[0], hv = bz.hover; if (hv && sb.pts.length >= 2 && near(f, hv[0], hv[1])) { g.beginPath(); g.arc(f.x, f.y, 6 * px, 0, Math.PI * 2); g.strokeStyle = blue; g.stroke(); }
          }
          const ps = pl ? plSub() : null;
          if (ps && pl.hover && !pl.free) { const a = ps.pts[ps.pts.length - 1]; let [hx, hy] = pl.hover; if (pl.hover[2]) [hx, hy] = B.constrain(a.x, a.y, hx, hy); g.strokeStyle = "rgba(38,128,235,.85)"; g.setLineDash([4 * px, 3 * px]); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(hx, hy); g.stroke(); g.setLineDash([]); }
          if (ps && pl.free && pl.free.length > 1) { g.strokeStyle = blue; g.lineWidth = 1.5 * px; g.beginPath(); pl.free.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
        }
        if (bs && S.layers.includes(bs.L)) {
          const sp = splineOf(bs.L);
          if (sp) { g.strokeStyle = "rgba(38,128,235,.7)"; g.setLineDash([3 * px, 3 * px]); g.beginPath(); sp.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (bs.hover) g.lineTo(bs.hover[0], bs.hover[1]); g.stroke(); g.setLineDash([]); sp.pts.forEach(([x, y]) => sq(x, y, false, 3)); }
        }
        if (fh && fh.pts.length > 1) { g.strokeStyle = blue; g.lineWidth = 1.5 * px; g.beginPath(); fh.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
        if (fhPend) { sq(fhPend[0], fhPend[1], true, 3); if (fhHover) { g.strokeStyle = "rgba(38,128,235,.85)"; g.setLineDash([4 * px, 3 * px]); g.beginPath(); g.moveTo(fhPend[0], fhPend[1]); g.lineTo(fhHover[0], fhHover[1]); g.stroke(); g.setLineDash([]); } }
        if (tl) { g.strokeStyle = blue; g.lineWidth = Math.max(px, S.vlW); g.beginPath(); g.moveTo(tl.x0, tl.y0); g.lineTo(tl.x1, tl.y1); g.stroke(); }
        if (tp) {
          g.strokeStyle = blue; g.lineWidth = 1.5 * px; g.beginPath();
          if (tp.stage === 2 && tp.m) { const c = Q.segs(B.threePoint(tp.a, tp.b, tp.m))[0]; g.moveTo(c[0], c[1]); g.bezierCurveTo(c[2], c[3], c[4], c[5], c[6], c[7]); } else { g.moveTo(tp.a[0], tp.a[1]); g.lineTo(tp.b[0], tp.b[1]); }
          g.stroke(); sq(tp.a[0], tp.a[1], true, 3); sq(tp.b[0], tp.b[1], true, 3);
        }
      }
      // the Shape tool: every node; the picked ones' handles (and their neighbours'); a B-spline's control polygon
      if (tool === "shapetool") {
        const spl = stSpline();
        if (spl) {
          const sp = splineNow(spl); g.strokeStyle = "rgba(38,128,235,.6)"; Q.traceAll(g, spl.shape.path); g.lineWidth = px; g.stroke();
          g.setLineDash([3 * px, 3 * px]); g.beginPath(); sp.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (sp.closed) g.closePath(); g.stroke(); g.setLineDash([]);
          sp.pts.forEach(([x, y]) => sq(x, y, false));
        } else {
          const info = stPeek();
          if (info && info.path.subs.length) {
            const p = info.path; g.strokeStyle = blue; g.lineWidth = 1.25 * px; Q.traceAll(g, p); g.stroke();
            p.subs.forEach((sb, s) => sb.pts.forEach((a, i) => {
              const showH = nsel.has(nk(s, i)) || nsel.has(nk(s, i - 1)) || nsel.has(nk(s, i + 1)) || (sb.closed && (nsel.has(nk(s, (i + 1) % sb.pts.length)) || nsel.has(nk(s, (i - 1 + sb.pts.length) % sb.pts.length))));
              if (showH) { handle(a, a.ix, a.iy); handle(a, a.ox, a.oy); }
            }));
            p.subs.forEach((sb, s) => sb.pts.forEach((a, i) => {
              const t = B.nodeTypeOf(a), on = nsel.has(nk(s, i)), z = (i === 0 ? 4.5 : 3.5) * px;
              g.fillStyle = on ? blue : "#fff"; g.strokeStyle = blue; g.lineWidth = px;
              if (t === "cusp") { g.fillRect(a.x - z, a.y - z, 2 * z, 2 * z); g.strokeRect(a.x - z, a.y - z, 2 * z, 2 * z); }      // Corel: cusp = square, smooth = circle, symmetrical = diamond
              else if (t === "smooth") { g.beginPath(); g.arc(a.x, a.y, z, 0, Math.PI * 2); g.fill(); g.stroke(); }
              else { g.beginPath(); g.moveTo(a.x, a.y - z * 1.3); g.lineTo(a.x + z * 1.3, a.y); g.lineTo(a.x, a.y + z * 1.3); g.lineTo(a.x - z * 1.3, a.y); g.closePath(); g.fill(); g.stroke(); }
            }));
          }
        }
        if (sh && sh.mode === "marquee") { g.strokeStyle = blue; g.lineWidth = px; g.setLineDash([3 * px, 3 * px]); g.strokeRect(Math.min(sh.x0, sh.x1), Math.min(sh.y0, sh.y1), Math.abs(sh.x1 - sh.x0), Math.abs(sh.y1 - sh.y0)); g.setLineDash([]); }
      }
      // the Curvature Pen: its points (corners square, smooth round)
      if (tool === "curvpen" && cv) {
        cv.pts.forEach((p) => { if (p.corner) sq(p.x, p.y, false); else { g.beginPath(); g.arc(p.x, p.y, 3.5 * px, 0, Math.PI * 2); g.fillStyle = "#fff"; g.fill(); g.strokeStyle = blue; g.lineWidth = px; g.stroke(); } });
        if (cv.hover && !cv.closed && S.penRubber) {
          const pts = cv.pts.concat([{ x: cv.hover[0], y: cv.hover[1] }]), sub = B.curvature(pts, false), c = Q.segs(sub).pop();
          if (c) { g.strokeStyle = "rgba(38,128,235,.8)"; g.setLineDash([4 * px, 3 * px]); g.beginPath(); g.moveTo(c[0], c[1]); g.bezierCurveTo(c[2], c[3], c[4], c[5], c[6], c[7]); g.stroke(); g.setLineDash([]); }
        }
      }
    });

    /* ================================ F12: the Outline Pen ================================ */
    function preview(c, sh0) {
      const g = ctx(c); if (!g) return; g.clearRect(0, 0, c.width, c.height);
      const w = c.width, h = c.height, s = Object.assign({}, sh0, { path: { subs: [
        { closed: false, op: "add", pts: [Q.anchor(24, h * 0.7), Q.anchor(w * 0.45, h * 0.25, w * 0.3, h * 0.25, w * 0.6, h * 0.25, true), Q.anchor(w * 0.62, h * 0.72)] },
        { closed: true, op: "add", pts: [Q.anchor(w * 0.72, h * 0.25), Q.anchor(w - 18, h * 0.25), Q.anchor(w - 18, h * 0.78), Q.anchor(w * 0.72, h * 0.78)] }] } });
      B.drawLine(g, s);
    }
    function dlgOutline() {
      if (!S.w) return say("open a picture first");
      const L = E.layer();
      let target = null;
      if (L && L.type === "shape" && L.shape) target = L;
      const base = target ? target.shape : { stroke: S.fg, strokeW: S.vlW, strokeOn: S.vlW > 0, fill: auto().fill, fillOn: S.vlFillOn, line: S.vlLine };
      const ln = Object.assign({}, B.LINE_DEFAULT, base.line || {});
      const caps = [["butt", "Butt"], ["round", "Round"], ["square", "Square"]], joins = [["miter", "Mitered"], ["round", "Round"], ["bevel", "Bevelled"]], pos = [["outside", "Outside"], ["center", "Centred"], ["inside", "Inside"]];
      const d = E.ui.dialog("Outline Pen", `<div class="opdlg">
        <div class="rw"><span>Colour</span><input type="color" id="opC" value="${base.stroke || "#000000"}"><span></span></div>
        <div class="rw"><span>Width (px)</span><input type="number" id="opW" min="0" max="500" step="0.5" value="${base.strokeOn === false ? 0 : base.strokeW || 0}"><span style="color:var(--pc-dim)">0 = no outline</span></div>
        <div class="rw"><span>Style</span><select id="opS">${opts(B.STYLES, ln.style)}</select><input type="text" id="opD" value="${esc(ln.dash)}" placeholder="dash gap … (× width)" title="Custom: dash and gap lengths as multiples of the width, e.g. 4 2 1 2"></div>
        <div class="rw"><span>Corners</span><select id="opJ">${opts(joins, ln.join)}</select><label title="Miter limit">limit <input type="number" id="opM" min="1" max="100" value="${ln.miter}" style="width:50px"></label></div>
        <div class="rw"><span>Line caps</span><select id="opK">${opts(caps, ln.cap)}</select><span></span></div>
        <div class="rw"><span>Position</span><select id="opP">${opts(pos, ln.pos)}</select><span style="color:var(--pc-dim)">closed curves</span></div>
        <div class="rw"><span>Arrows</span><select id="opA0">${opts(B.ARROWS.map(([v, n]) => [v, "◂ " + n]), ln.start)}</select><select id="opA1">${opts(B.ARROWS.map(([v, n]) => [v, n + " ▸"]), ln.end)}</select></div>
        <div class="rw"><span>Arrow size</span><input type="number" id="opAS" min="1" max="20" step="0.5" value="${ln.asize}" title="× the width"><button class="ghost" id="opSwap" title="Swap the start and end arrowheads">⇄ Swap</button></div>
        <div class="rw"><span>Fill</span><label><input type="checkbox" id="opFO" ${base.fillOn !== false ? "checked" : ""}> closed curves</label><input type="color" id="opF" value="${base.fill || "#ffffff"}"></div>
        <div class="rw"><span></span><label><input type="checkbox" id="opB" ${ln.behind ? "checked" : ""}> Behind fill</label><label><input type="checkbox" id="opSc" ${ln.scaleWith ? "checked" : ""}> Scale with object</label></div>
        <canvas id="opPrev" width="300" height="110"></canvas>
        <div style="color:var(--pc-dim)">${target ? `For "${esc(target.name)}"` : "For the next lines the curve tools (F5) draw"}${target && !isVL(target) ? " - it becomes a vector line" : ""}.</div></div>`,
      (dd) => {
        const v = read(dd);
        S.vlLine = Object.assign({}, v.line); delete S.vlLine.spline; S.vlW = v.strokeW; S.vlFillOn = v.fillOn; saveDefaults();
        if (!target) { say("outline pen set for the next lines"); return; }
        once("outline pen", () => {
          if (target.shape.kind !== "path") target.shape = Q.toPathShape(target.shape);
          const sp = target.shape.line && target.shape.line.spline;
          Object.assign(target.shape, { stroke: v.stroke, strokeW: v.strokeW, strokeOn: v.strokeW > 0, fill: v.fill, fillOn: v.fillOn, line: Object.assign(v.line, sp ? { spline: sp } : {}) });
          Q.syncShape(target.shape); D.rasterize(target);
        });
      }, { okLabel: "OK", wide: true });
      const read = (dd) => {
        const q = (id) => dd.querySelector("#" + id);
        return { stroke: q("opC").value, strokeW: Math.max(0, +q("opW").value || 0), fill: q("opF").value, fillOn: q("opFO").checked,
          line: Object.assign({}, B.LINE_DEFAULT, { style: q("opS").value, dash: q("opD").value.trim(), join: q("opJ").value, miter: Math.max(1, +q("opM").value || 10), cap: q("opK").value, pos: q("opP").value,
            start: q("opA0").value, end: q("opA1").value, asize: Math.max(1, +q("opAS").value || 4), behind: q("opB").checked, scaleWith: q("opSc").checked }) };
      };
      const pv = () => { const v = read(d); preview(d.querySelector("#opPrev"), Object.assign({ kind: "path" }, v, { strokeOn: v.strokeW > 0 })); };
      d.querySelectorAll("input,select").forEach((el) => { el.addEventListener("input", pv); el.addEventListener("change", pv); });
      d.querySelector("#opSwap").onclick = () => { const a = d.querySelector("#opA0"), b = d.querySelector("#opA1"), t = a.value; a.value = b.value; b.value = t; pv(); };
      pv();
    }

    /* ================================ Convert to Curves (Ctrl+Q), vector <-> path ================================ */
    function toCurves() {
      const L = E.layer(); if (!L) return say("open a picture first");
      if (L.type === "text") return say("Convert to Curves: type is not turned into curves yet - Rasterize keeps its look");
      if (L.type !== "shape" || !L.shape) return say("Convert to Curves works on shape layers (rectangle, ellipse, polygon, line, custom shapes) - F5 draws lines");
      if (isVL(L) && !splineOf(L) && !L.shape.gen && !L.shape.media) return say(`"${L.name}" is already curves - F10 edits its nodes`);
      once("convert to curves", () => {
        if (L.shape.gen || L.shape.media) { delete L.shape.gen; delete L.shape.media; }       // 2.428.0: a live shape / artistic media -> plain curves
        if (splineOf(L)) { const ln = Object.assign({}, L.shape.line); delete ln.spline; L.shape.line = ln; }
        else {
          const was = L.shape, s2 = Q.toPathShape(was);
          s2.line = Object.assign({}, B.LINE_DEFAULT, { cap: was.kind === "line" ? "round" : "butt", join: "miter", style: was.dash ? "dash" : "solid" });
          if (was.kind !== "line") { s2.strokeW = was.strokeOn ? was.strokeW || 0 : 0; s2.strokeOn = !!was.strokeOn && s2.strokeW > 0; }
          L.shape = s2;
        }
        Q.syncShape(L.shape); D.rasterize(L);
        E.pen.setTarget({ k: "shape", id: L.id });
      });
      say(`"${L.name}" converted to curves - ${Q.count(L.shape.path)} nodes; F10 (Shape tool) edits them`);
    }
    const nextPathId = () => S.paths.reduce((m, e) => Math.max(m, e.id || 0), 0) + 1;
    /** a vector line -> a saved path (it remembers the outline pen, so it can come back) */
    function lineToPath(L, keep, name) {
      if (!L || L.type !== "shape" || !L.shape) return false;
      const path = L.shape.kind === "path" ? Q.clone(L.shape.path) : Q.fromShape(L.shape);
      const sh0 = L.shape, vec = { name: L.name, stroke: sh0.stroke, strokeW: sh0.strokeW, strokeOn: sh0.strokeOn, fill: sh0.fill, fillOn: sh0.fillOn, line: Object.assign({}, B.LINE_DEFAULT, sh0.line || {}), opacity: L.opacity, blend: L.blend };
      const id = nextPathId();
      S.paths.push({ id, name: name || L.name, path, vec });
      if (!keep) { S.layers.splice(S.layers.indexOf(L), 1); S.layers = D.normalize(S.layers); S.active = Math.max(0, Math.min(S.active, S.layers.length - 1)); }
      E.pen.setTarget({ k: "saved", id });
      return id;
    }
    function dlgToPath() {
      const L = E.layer(); if (!L || L.type !== "shape") return say("pick a vector line (or a shape layer) in Layers first");
      E.ui.dialog("Convert to Path", `<div class="rw"><span>Path name</span><input type="text" id="vpN" value="${esc(L.name)}" style="grid-column:2/4"></div>
        <div class="rw"><label style="grid-column:1/4"><input type="checkbox" id="vpK"> Keep the vector layer too</label></div>
        <div style="color:var(--pc-dim)">The path goes in the Paths panel and remembers this line's outline pen - Vector Line: Make from Path brings it back exactly.</div>`,
      (d) => { const keep = d.querySelector("#vpK").checked, nm = d.querySelector("#vpN").value.trim().slice(0, 60) || L.name; once("convert to path", () => { lineToPath(L, keep, nm); }); if (E.ui.showTab) E.ui.showTab("pcPaths"); E.pen.paint(); say(`"${nm}" is a path now${keep ? " (the layer kept)" : ""} - Vector Line: Make from Path turns it back`); });
    }
    /** a path -> a vector line layer: the outline it remembers, or the curve tools' outline */
    function pathToLine(info, keepPath) {
      if (!info || !info.path.subs.length) return null;
      const vec = info.k === "saved" && info.e.vec ? info.e.vec : null;
      const name = vec ? vec.name : (info.k === "saved" ? info.e.name : "Curve " + (lineCount() + 1));
      const extra = vec ? { stroke: vec.stroke, strokeW: vec.strokeW, strokeOn: vec.strokeOn, fill: vec.fill, fillOn: vec.fillOn, line: Object.assign({}, B.LINE_DEFAULT, vec.line) } : {};
      const L = newLine({ closed: false, op: "add", pts: [] }, name, extra);
      L.shape.path = Q.clone(info.path); Q.syncShape(L.shape); D.rasterize(L);
      if (vec) { if (vec.opacity != null) L.opacity = vec.opacity; if (vec.blend) L.blend = vec.blend; }
      if (!keepPath) {
        if (info.k === "saved") S.paths = S.paths.filter((x) => x !== info.e);
        else if (info.k === "work") S.work = null;
      }
      E.pen.setTarget({ k: "shape", id: L.id });
      return L;
    }
    function dlgFromPath() {
      const info = E.pen.targetInfo();
      if (!info || !info.path.subs.length || info.k === "shape" || info.k === "vmask") return say("pick a path in the Paths panel first (a saved path or the work path)");
      const remembered = info.k === "saved" && !!info.e.vec;
      E.ui.dialog("Make Vector Line", `<div class="rw"><label style="grid-column:1/4"><input type="checkbox" id="vfK" ${remembered ? "" : "checked"}> Keep the path too</label></div>
        <div style="color:var(--pc-dim)">${remembered ? `This path came from the line "${esc(info.e.vec.name)}" - it comes back with its outline pen.` : "It takes the curve tools' outline (the F5 property bar / Outline Pen)."}</div>`,
      (d) => { const keep = d.querySelector("#vfK").checked; let L = null; once("make vector line", () => { L = pathToLine(info, keep); if (!L) return false; }); if (L) say(`"${L.name}": a vector line again - F10 edits its nodes, F12 its outline`); });
    }
    // SVG: vector lines out as lines (arrowheads, dashes - data-bitgen-vline), and back in as vector lines
    E.vlineSvg = (text, name) => {
      const list = B.fromSvg(text); if (!list.length || !S.w) return false;
      once("place SVG", () => { list.forEach((sh0, k) => { const L = newLine({ closed: false, op: "add", pts: [] }, String(name || "SVG").replace(/\.svg$/i, "") + (list.length > 1 ? " " + (k + 1) : ""), sh0); L.shape.path = sh0.path; Q.syncShape(L.shape); D.rasterize(L); }); });
      say(`placed ${list.length} vector line(s) from ${name || "the SVG"}`);
      return true;
    };
    function exportSvg() {
      const info = E.pen.targetInfo();
      if (info && info.k === "shape" && isVL(info.L)) {
        const L = info.L, text = B.svgDoc([L.shape], S.w, S.h);
        const a = doc.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" })); a.download = String(L.name).replace(/[^\w.-]+/g, "_") + ".svg"; doc.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
        say(`exported "${L.name}" as SVG (its outline pen, dashes and arrowheads with it)`);
        return text;
      }
      return E.pen.exportSvg();
    }

    /* ---------------- keep lines with the picture: B-spline points, Scale with object ---------------- */
    const baseMap = E.mapPaths;
    if (baseMap) E.mapPaths = (m, shapes) => {
      baseMap(m, shapes);
      if (!shapes) return;
      const k = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
      for (const L of S.layers) {
        if (!isVL(L)) continue;
        const ln = L.shape.line;
        if (ln.spline) ln.spline = { closed: ln.spline.closed, pts: ln.spline.pts.map(([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]) };
        if (ln.scaleWith && Math.abs(k - 1) > 1e-6) L.shape.strokeW = Math.round(L.shape.strokeW * k * 100) / 100;
        D.rasterize(L);
      }
    };

    /* ---------------- commands ---------------- */
    if (E.ui.addCmd) {
      const C = E.ui.addCmd, shapeL = () => !!(S.w && E.layer() && E.layer().type === "shape");
      C("vl.outline", "Outline Pen…", "F12", dlgOutline, { enabled: () => !!S.w }, ["Layer", "layer.flatten", true]);
      C("vl.curves", "Convert to Curves", "Ctrl+Q", toCurves, { enabled: shapeL }, ["Layer", "vl.outline"]);
      C("vl.topath", "Vector Line: Convert to Path…", "", dlgToPath, { enabled: shapeL }, ["Layer", "vl.curves"]);
      C("vl.frompath", "Vector Line: Make from Path…", "", dlgFromPath, { enabled: () => { const i = E.pen.targetInfo(); return !!(i && (i.k === "saved" || i.k === "work") && i.path.subs.length); } }, ["Layer", "vl.topath"]);
      C("path.svgout", "Export Path as SVG…", "", exportSvg, { enabled: () => !!E.pen.targetInfo() });
      for (const [id, n] of [["bezier", "Bézier Tool"], ["freehand", "Freehand Tool"], ["line2", "2-Point Line Tool"], ["polyline", "Polyline Tool"], ["curve3", "3-Point Curve Tool"], ["bspline", "B-Spline Tool"], ["cpen", "Node Pen Tool"], ["shapetool", "Shape Tool"], ["curvpen", "Curvature Pen Tool"]])
        C("tool." + id, n, "", () => E.setTool(id), {});
    }

    E.vline = { lineBar, bindLineBar, setPath, once, isVL, newLine, placeSub, lineToPath, pathToLine, toCurves, dlgOutline, dlgToPath, dlgFromPath, exportSvg, alignPicked, nodes: () => [...nsel],
      pick: (list) => { nsel.clear(); for (const [s, i] of list) nsel.add(nk(s, i)); E.drawOverlay(); E.renderOptions(); },
      state: () => ({ bz: !!bz, pl: !!pl, bs: !!bs, tp: tp ? tp.stage : 0, cv: cv ? cv.pts.length : 0, fhPend: !!fhPend }), splineNow, CURVE_TOOLS };
  }

  const api = { install, CURVE_TOOLS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document) root.PCVLine = api;
})(typeof window !== "undefined" ? window : globalThis);
