/* bitGen Studio — ext/pushpulldock/pptools.js (2.619.0): THE PUSH/PULL TOOLS (window.PPTools) - SketchUp's way of working:
 * click - move - click, the inference marker + its words, exact sizes typed into the Measurements box (VCB) at any time.
 *
 *   Space Select   click a face / line (Shift: add / take out); a face of a group picks the group; double-click a group =
 *                  edit inside it (the rest dims; Esc leaves); Delete erases what is picked
 *   L Line         click, click … - a closed flat loop becomes a face; a line across a face from border to border splits it
 *   R Rectangle    two corners (on a face: in its plane) - VCB "3,2" = 3 m × 2 m
 *   C Circle       centre, radius - VCB "0.5" = radius, "36s" = 36 sides      N Polygon   the same, 6 sides
 *   P Push/Pull    click a face, move, click (or drag) - VCB = the distance; double-click a face = the last distance again;
 *                  a face in a face = a pocket / a boss, pushed to the far side = a hole through
 *   M Move         what is picked (or what you press on): base point, target point - Ctrl = a copy; VCB = the distance
 *                  or "x,y,z"
 *   Q Rotate       what is picked: centre, start, end - round the blue (Z) axis, 15° steps; VCB = degrees
 *   S Scale        what is picked: drag from a point - VCB = the factor (from the middle of the selection)
 *   F Offset       a face: move inside it - a loop that far inside (walls, frames) - VCB = the distance
 *   T Tape         two points: their distance          B Paint   click faces (Alt+click picks a face's colour)
 *   E Eraser       click (or drag over) lines / faces - a line that borders faces takes them with it
 *   O Orbit / H Pan (left drag); middle drag orbits, right drag pans, the wheel zooms - always
 *   → ← ↑ keep the red / green / blue axis, ↓ lets it go; Shift keeps the axis the marker shows
 * create(ctx) -> {use(name), name(), cancel(), key(e), vcb(text), down / move / up / dbl(ev)}  ctx = the docker (ppdock.js)
 */
(function (root) {
  "use strict";
  const G = () => root.PPGeo;
  const TOOLS = [
    ["select", "⬚", "Select", " "], ["line", "╱", "Line", "l"], ["rect", "▭", "Rectangle", "r"], ["circle", "◯", "Circle", "c"], ["polygon", "⬠", "Polygon", "n"],
    ["pushpull", "⇧", "Push/Pull", "p"], ["move", "✥", "Move", "m"], ["rotate", "⟳", "Rotate", "q"], ["scale", "⤡", "Scale", "s"], ["offset", "⧈", "Offset", "f"],
    ["tape", "📏", "Tape measure", "t"], ["paint", "🪣", "Paint", "b"], ["eraser", "⌫", "Eraser", "e"], ["orbit", "🔄", "Orbit", "o"], ["pan", "✋", "Pan", "h"],
  ];
  const HINT = {
    select: "Click a face or a line (Shift: add / take out) · double-click a group to edit inside it · Delete erases",
    line: "Click where the line starts, click where it ends … close the loop for a face · Esc ends · type a length",
    rect: "Click a corner, click the opposite corner · type  width,depth  (e.g. 3,2)",
    circle: "Click the centre, click the radius · type the radius, or  36s  for 36 sides",
    polygon: "Click the centre, click the radius · type the radius, or  8s  for 8 sides",
    pushpull: "Click a face, move, click · type the distance · double-click a face = the last distance again",
    move: "Click a base point, click where it goes (Ctrl = a copy) · type the distance, or  x,y,z",
    rotate: "Click the centre, click the start, click the end (round the blue axis) · type the angle",
    scale: "Click a point and move away from / toward the middle, click · type the factor",
    offset: "Click a face, move inside it, click · type the distance",
    tape: "Click a point, click another - their distance",
    paint: "Click faces to paint them (Alt+click: take a face's colour) - the colour is in the bar",
    eraser: "Click (or drag over) lines and faces to erase them",
    orbit: "Drag to orbit (the middle button orbits in any tool)", pan: "Drag to pan (the right button pans in any tool)",
  };
  const VCB = { line: "Length", rect: "Dimensions", circle: "Radius", polygon: "Radius", pushpull: "Distance", move: "Distance", rotate: "Angle", scale: "Scale", offset: "Distance", tape: "Length" };

  function create(ctx) {
    const V = ctx.V, g = G(), v3 = g.v3;
    // 2.620.0: the architecture tools (pparchtools.js) - Room, Wall, Door, Window, Floor, Ceiling, Roof, Light, Stairs
    const AT = root.PPArchTools && ctx.archView ? root.PPArchTools.create(ctx) : null;
    const ALL = AT ? TOOLS.concat(AT.TOOLS) : TOOLS;
    let tool = "select", st = {}, lock = null, lastPP = null, lastSnap = null, sides = { circle: 24, polygon: 6 };
    const M = () => ctx.model();
    const grpOpt = () => (ctx.group() ? { grp: ctx.group() } : {});
    function reset() { st = {}; lock = null; V.preview({}); V.setHover(null); ctx.vcbValue(""); }
    function use(name) {
      if (AT && AT.owns(name)) {
        reset(); tool = name; V.leftDrag(""); V.canvas.style.cursor = "crosshair";
        ctx.status(AT.HINT[name]); ctx.vcbLabel(AT.VCB[name] || ""); ctx.toolChanged(name); AT.use(name); return;
      }
      if (!HINT[name]) return;
      reset(); tool = name; if (AT) AT.use(null);
      V.leftDrag(name === "orbit" ? "orbit" : name === "pan" ? "pan" : "");
      V.canvas.style.cursor = name === "orbit" || name === "pan" ? "grab" : name === "select" ? "default" : "crosshair";
      ctx.status(HINT[name]); ctx.vcbLabel(VCB[name] || "");
      ctx.toolChanged(name);
      if ((name === "move" || name === "rotate" || name === "scale") && !hasSel()) ctx.status(HINT[name] + " - nothing is picked: press on what to " + name);
    }
    const hasSel = () => { const s = ctx.sel(); return !!((s.f && s.f.length) || (s.e && s.e.length) || (s.k && s.k.length)); };
    function snapAt(ev, o) { const s = V.snap(ev, Object.assign({ group: ctx.group(), lock }, o || {})); lastSnap = s; return s; }
    function show(s, o) {
      const p = o || {};
      const dashed = [];
      if (p.from && s.axis != null) dashed.push({ seg: [p.from, s.p], color: s.color });
      V.preview({ lines: p.lines || [], dashed: dashed.concat(p.dashed || []), faces: p.faces, marker: { p: s.p, color: s.color }, tip: (p.tip ? p.tip + "  ·  " : "") + s.label, tipAt: s.p, color: p.color });
    }
    const loopLines = (P) => P.map((p, i) => [p, P[(i + 1) % P.length]]);
    const fan = (P) => { const t = []; for (let i = 1; i < P.length - 1; i++) t.push([P[0], P[i], P[i + 1]]); return t; };
    function commit(label, before) { ctx.commit(label, before); }

    /* ---- the selection */
    function pickSel(ev, add) {
      const p = V.pick(ev, { group: ctx.group() });
      const s = add ? Object.assign({ f: [], e: [], k: [] }, JSON.parse(JSON.stringify(ctx.sel()))) : { f: [], e: [], k: [] };
      if (!p) { if (!add) ctx.setSel(s); return null; }
      const grp = p.grp && p.grp !== ctx.group() ? p.grp : null;
      const tog = (arr, x) => { const i = arr.indexOf(x); if (i >= 0) arr.splice(i, 1); else arr.push(x); };
      if (grp) { M().f.forEach((F) => { if (F.grp === grp) tog(s.f, F.id); }); M().e.forEach((E) => { if (E.grp === grp) tog(s.e, E.id); }); }
      else if (p.face) tog(s.f, p.face);
      else if (p.line) tog(s.e, p.line);
      else if (p.edge) tog(s.k, p.edge);
      ctx.setSel(s); return p;
    }
    function selVerts() {
      const s = ctx.sel(), vs = new Set(g.selVerts(M(), s));
      (s.k || []).forEach((k) => k.split("_").forEach((i) => vs.add(+i)));
      return [...vs];
    }

    /* ---- the pointer */
    function down(ev) {
      if (ev.button !== 0) return;
      const m = M();
      if (AT && AT.owns(tool)) { AT.down(ev); return; }
      if (tool === "select") { if (AT && AT.selectDown(ev)) return; pickSel(ev, ev.shiftKey); return; }
      if (tool === "orbit" || tool === "pan") return;
      if (tool === "line") {
        const s = snapAt(ev, { from: st.pts && st.pts[st.pts.length - 1] }); const p = s.p;
        if (!st.pts) { st.pts = [p]; return; }
        const last = st.pts[st.pts.length - 1]; if (v3.len(v3.sub(p, last)) < 1e-6) return;
        lineTo(p);
        return;
      }
      if (tool === "rect" || tool === "circle" || tool === "polygon") {
        const s = snapAt(ev, st.a ? { from: st.a, plane: st.plane } : {});
        if (!st.a) { st.a = s.p; st.plane = { n: s.n && s.kind === "On Face" ? s.n : [0, 0, 1], p: s.p }; st.face = s.face || null; return; }
        finishShape(s.p); return;
      }
      if (tool === "pushpull") {
        if (st.F) { finishPP(); return; }
        const p = V.pick(ev, { group: ctx.group() }); if (!p || !p.face) { ctx.status("Push/Pull: press on a face"); return; }
        const F = g.face(m, p.face); if (p.grp && p.grp !== ctx.group()) { ctx.status("that face is in a group - double-click the group (Select) to edit inside it"); return; }
        st = { F, n: g.faceNormal(m, F), p0: p.point, d: 0, x0: ev.clientX, y0: ev.clientY, pressed: true };
        return;
      }
      if (tool === "move" || tool === "rotate" || tool === "scale") {
        if (!hasSel()) { const p = pickSel(ev, false); if (!p) return; }
        const s = snapAt(ev, st.base ? { from: st.base } : {});
        if (tool === "move") { if (!st.base) { st.base = s.p; st.copy = !!(ev.ctrlKey || ev.metaKey); return; } finishMove(v3.sub(s.p, st.base)); return; }
        if (tool === "rotate") {
          if (!st.c) { st.c = s.p; return; }
          if (!st.a0) { st.a0 = Math.atan2(s.p[1] - st.c[1], s.p[0] - st.c[0]); st.r = Math.hypot(s.p[0] - st.c[0], s.p[1] - st.c[1]); return; }
          finishRotate(angleTo(s.p)); return;
        }
        if (!st.h) { const b = g.bbox(m, selVerts()); st.c = b.center; st.h = s.p; st.r0 = v3.len(v3.sub(s.p, b.center)) || 1; return; }
        finishScale(v3.len(v3.sub(s.p, st.c)) / st.r0); return;
      }
      if (tool === "offset") {
        if (st.F) { finishOffset(st.d); return; }
        const p = V.pick(ev, { group: ctx.group() }); if (!p || !p.face) { ctx.status("Offset: press on a face"); return; }
        st = { F: g.face(m, p.face), d: 0 }; return;
      }
      if (tool === "tape") {
        const s = snapAt(ev, st.a ? { from: st.a } : {});
        if (!st.a) { st.a = s.p; return; }
        const d = v3.len(v3.sub(s.p, st.a)); ctx.status("📏 " + g.fmtLen(d) + "  (Δx " + g.fmtLen(s.p[0] - st.a[0]) + ", Δy " + g.fmtLen(s.p[1] - st.a[1]) + ", Δz " + g.fmtLen(s.p[2] - st.a[2]) + ")"); ctx.vcbValue(g.fmtLen(d));
        st = {}; V.preview({}); return;
      }
      if (tool === "paint") {
        if (AT) { const c = AT.paintAt(ev, ctx.color(), ev.altKey); if (c) { if (ev.altKey) ctx.setColor(c); return; } }
        const p = V.pick(ev, { group: ctx.group() }); if (!p || !p.face) return;
        const F = g.face(m, p.face);
        if (ev.altKey) { if (F.mat) ctx.setColor(F.mat); return; }
        const before = ctx.snapshot(), col = ctx.color();
        const grp = p.grp && p.grp !== ctx.group() ? p.grp : null;
        m.f.forEach((x) => { if (grp ? x.grp === grp : x.id === F.id) x.mat = col; });
        commit("paint", before); return;
      }
      if (tool === "eraser") { if (AT && AT.eraseAt(ev)) return; st = { before: ctx.snapshot(), n: 0, erasing: true }; eraseAt(ev); return; }
    }
    function eraseAt(ev) {
      const p = V.pick(ev, { group: ctx.group() }); if (!p) return;
      const sel = p.line ? { e: [p.line] } : p.edge ? { edgeKeys: [p.edge] } : p.face ? { f: [p.face] } : null; if (!sel) return;
      if (p.grp && p.grp !== ctx.group()) { const s = { f: M().f.filter((F) => F.grp === p.grp).map((F) => F.id), e: M().e.filter((E) => E.grp === p.grp).map((E) => E.id) }; st.n += g.remove(M(), s); }
      else st.n += g.remove(M(), sel);
      ctx.redraw();
    }
    function move(ev) {
      const m = M();
      if (AT && AT.owns(tool)) { AT.move(ev); return; }
      if (tool === "select") { if (AT && AT.selectMove(ev)) return; const p = V.pick(ev, { group: ctx.group() }); V.setHover(p ? { face: p.face && !(p.grp && p.grp !== ctx.group()) ? p.face : null, edge: p.edge || null } : null); return; }
      if (tool === "orbit" || tool === "pan") return;
      if (tool === "eraser") { if (st.erasing && ev.buttons & 1) eraseAt(ev); else { const p = V.pick(ev, { group: ctx.group() }); V.setHover(p ? { face: p.face || null, edge: p.edge || null } : null); } return; }
      if (tool === "paint") { const p = V.pick(ev, { group: ctx.group() }); V.setHover(p && p.face ? { face: p.face } : null); return; }
      if (tool === "line") {
        const from = st.pts && st.pts[st.pts.length - 1];
        const s = snapAt(ev, from ? { from } : {});
        if (!from) { show(s); return; }
        const close = st.pts.length >= 3 && v3.len(v3.sub(s.p, st.pts[0])) < 1e-6;
        show(s, { from, lines: st.pts.slice(1).map((p, i) => [st.pts[i], p]).concat([[from, s.p]]), tip: g.fmtLen(v3.len(v3.sub(s.p, from))) + (close ? " · closes the loop" : "") });
        ctx.vcbValue(g.fmtLen(v3.len(v3.sub(s.p, from)))); st.cur = s.p; return;
      }
      if (tool === "rect" || tool === "circle" || tool === "polygon") {
        const s = snapAt(ev, st.a ? { from: st.a, plane: st.plane } : {});
        if (!st.a) { show(s); return; }
        const P = shapePts(st.a, s.p); st.cur = s.p;
        if (!P) { show(s); return; }
        const dims = tool === "rect" ? rectDims(st.a, s.p) : null;
        show(s, { lines: loopLines(P), faces: fan(P), tip: tool === "rect" ? g.fmtLen(Math.abs(dims[0])) + " × " + g.fmtLen(Math.abs(dims[1])) : "r " + g.fmtLen(v3.len(v3.sub(s.p, st.a))) });
        ctx.vcbValue(tool === "rect" ? (+Math.abs(dims[0]).toFixed(3)) + "," + (+Math.abs(dims[1]).toFixed(3)) : g.fmtLen(v3.len(v3.sub(s.p, st.a))));
        return;
      }
      if (tool === "pushpull") {
        if (!st.F) { const p = V.pick(ev, { group: ctx.group() }); V.setHover(p && p.face ? { face: p.face } : null); return; }
        const r = V.ray(ev), c = g.linesClosest(st.p0, st.n, r.o, r.d);
        let d = c.t, label = "";
        const s = V.snap(ev, { group: ctx.group() });
        if ((s.kind === "Endpoint" || s.kind === "Midpoint" || s.kind === "On Edge" || (s.kind === "On Face" && s.face !== st.F.id))) {
          const sd = v3.dot(v3.sub(s.p, st.p0), st.n), sp = v3.add(st.p0, v3.mul(st.n, sd));
          if (Math.abs(sd - d) < Math.max(0.25, Math.abs(d) * 0.4) || V.screen && Math.hypot(V.screen(sp)[0] - V.screen(v3.add(st.p0, v3.mul(st.n, d)))[0], V.screen(sp)[1] - V.screen(v3.add(st.p0, v3.mul(st.n, d)))[1]) < 14) { d = sd; label = " · to the " + s.kind.toLowerCase(); }
        }
        st.d = d; previewPP(d, label); return;
      }
      if (tool === "move" || tool === "rotate" || tool === "scale") {
        if (tool === "move") {
          const s = snapAt(ev, st.base ? { from: st.base } : {});
          if (!st.base) { show(s); return; }
          const t = v3.sub(s.p, st.base); st.cur = s.p;
          show(s, { from: st.base, lines: ghost(t), dashed: [{ seg: [st.base, s.p], color: "#555" }], tip: (st.copy || ev.ctrlKey ? "copy · " : "") + g.fmtLen(v3.len(t)) });
          ctx.vcbValue(g.fmtLen(v3.len(t))); return;
        }
        if (tool === "rotate") {
          const s = snapAt(ev, st.c ? { plane: { n: [0, 0, 1], p: st.c } } : {});
          if (!st.c) { show(s); return; }
          if (st.a0 == null) { show(s, { dashed: [{ seg: [st.c, s.p], color: "#555" }], tip: "the start" }); return; }
          const a = angleTo(s.p); st.ang = a;
          const vs = selVerts(), copy = JSON.parse(JSON.stringify(m.v)), tmp = { v: copy }; g.rotateZ(tmp, vs, st.c, a);
          show(s, { lines: ghostWith(tmp.v), dashed: [{ seg: [st.c, s.p], color: "#555" }], tip: (+a.toFixed(1)) + "°" }); ctx.vcbValue((+a.toFixed(1)) + "°"); return;
        }
        const s = snapAt(ev, {});
        if (!st.h) { show(s); return; }
        const k = v3.len(v3.sub(s.p, st.c)) / st.r0; st.k = k;
        const vs = selVerts(), tmp = { v: JSON.parse(JSON.stringify(m.v)) }; g.scale(tmp, vs, st.c, k);
        show(s, { lines: ghostWith(tmp.v), dashed: [{ seg: [st.c, s.p], color: "#555" }], tip: "× " + (+k.toFixed(3)) }); ctx.vcbValue(String(+k.toFixed(3))); return;
      }
      if (tool === "offset") {
        if (!st.F) { const p = V.pick(ev, { group: ctx.group() }); V.setHover(p && p.face ? { face: p.face } : null); return; }
        const P = g.facePlane(m, st.F), B = g.basis(P.n), r = V.ray(ev);
        const den = v3.dot(P.n, r.d); if (Math.abs(den) < 1e-9) return;
        const hit = v3.add(r.o, v3.mul(r.d, v3.dot(v3.sub(P.p, r.o), P.n) / den)), h2 = g.to2(hit, P.p, B);
        const outer = g.loopPts(m, st.F.loops[0]).map((q) => g.to2(q, P.p, B));
        let dmin = Infinity; outer.forEach((a, i) => { const b = outer[(i + 1) % outer.length], ab = [b[0] - a[0], b[1] - a[1]], L = ab[0] * ab[0] + ab[1] * ab[1]; let t = L ? ((h2[0] - a[0]) * ab[0] + (h2[1] - a[1]) * ab[1]) / L : 0; t = Math.max(0, Math.min(1, t)); dmin = Math.min(dmin, Math.hypot(h2[0] - a[0] - ab[0] * t, h2[1] - a[1] - ab[1] * t)); });
        const inside = g.inPoly2(h2, outer); if (!inside) { V.preview({ tip: "move inside the face", tipAt: hit }); return; }
        st.d = dmin; previewOffset(dmin); return;
      }
      if (tool === "tape") {
        const s = snapAt(ev, st.a ? { from: st.a } : {});
        if (!st.a) { show(s); return; }
        show(s, { from: st.a, dashed: [{ seg: [st.a, s.p], color: "#222" }], tip: g.fmtLen(v3.len(v3.sub(s.p, st.a))) }); return;
      }
    }
    function up(ev) {
      if (AT && AT.owns(tool)) { AT.up(ev); return; }
      if (tool === "select" && AT && AT.selectUp(ev)) return;
      if (tool === "eraser" && st.erasing) { const n = st.n; if (n) commit("erase", st.before); st = {}; if (n) ctx.status("⌫ erased " + n); return; }
      if (tool === "pushpull" && st.F && st.pressed) { st.pressed = false; if (Math.hypot(ev.clientX - st.x0, ev.clientY - st.y0) > 4) finishPP(); }
    }
    function dbl(ev) {
      // 2.624.0 (Tim: "when user double clicks empty space deselect everything ang go into orbit mode")
      const busy = Object.keys(st).length || (AT && AT.owns(tool) && Object.keys(AT.state()).filter((k) => k !== "roof" && k !== "last").length);
      if (!busy && !V.pick(ev, {}) && !(AT && ctx.archView && ctx.archView() && ctx.archView().pick(ev))) {
        ctx.setSel({ f: [], e: [], k: [] }); if (AT) AT.setSel(null); if (ctx.group()) ctx.enterGroup(null, true);
        use("orbit"); ctx.status("🔄 Orbit - nothing picked · drag to turn the view · Space = Select"); return;
      }
      if (AT && AT.owns(tool)) { AT.dbl(ev); return; }
      if (tool === "select" && AT && AT.selectDbl(ev)) return;            // 2.624.0: the top of a wall = a cut
      if (tool === "select") {
        const p = V.pick(ev, { group: ctx.group() });
        if (p && p.grp && p.grp !== ctx.group()) { ctx.enterGroup(p.grp); return; }
        if (p && p.face) { const F = g.face(M(), p.face); ctx.setSel({ f: [F.id], e: [], k: [...g.faceEdgeKeys(F)] }); }
        return;
      }
      if (tool === "pushpull" && lastPP) {
        const p = V.pick(ev, { group: ctx.group() }); if (!p || !p.face) return;
        st = {}; V.preview({});
        const before = ctx.snapshot(); const r = g.pushPull(M(), p.face, lastPP.d); lastPP = { face0: p.face, face: r.face, d: lastPP.d, before };
        commit("push/pull " + g.fmtLen(lastPP.d), before); ctx.status("⇧ the same distance again: " + g.fmtLen(lastPP.d) + " (" + r.mode + ")");
      }
    }

    /* ---- the tools' work */
    function lineTo(p) {
      const m = M(), before = ctx.snapshot(), from = st.pts[st.pts.length - 1];
      if (st.pts.length >= 3 && v3.len(v3.sub(p, st.pts[0])) < 1e-6) {
        const F = g.addFace(m, st.pts, grpOpt());
        if (F) { commit("face", before); ctx.status("a face (" + g.fmtLen(Math.sqrt(g.faceArea(m, F))) + "²-ish) - Push/Pull (P) it"); st = {}; V.preview({}); return; }
        g.addEdge(m, from, p, grpOpt()); commit("line", before); st = {}; V.preview({}); ctx.status("the loop is not flat - lines only"); return;
      }
      const r = g.addEdge(m, from, p, grpOpt());
      commit(r && r.split ? "split" : "line", before);
      if (r && r.split) { ctx.status("the face is split in two"); st = {}; V.preview({}); return; }
      st.pts.push(p);
    }
    function rectDims(a, b) {
      const P = g.rectPts(a, b, st.plane ? st.plane.n : [0, 0, 1]);
      return [v3.len(v3.sub(P[1], P[0])), v3.len(v3.sub(P[3], P[0]))];
    }
    function shapePts(a, b) {
      const n = st.plane ? st.plane.n : [0, 0, 1];
      if (tool === "rect") { const P = g.rectPts(a, b, n); return v3.len(v3.sub(P[1], P[0])) < 1e-6 || v3.len(v3.sub(P[3], P[0])) < 1e-6 ? null : P; }
      const r = v3.len(v3.sub(b, a)); if (r < 1e-6) return null;
      const B = g.basis(g.v3.norm(n)), d = v3.sub(b, a), start = Math.atan2(v3.dot(d, B.w), v3.dot(d, B.u));
      return g.circlePts(a, r, n, sides[tool], start);
    }
    function finishShape(b) {
      const P = shapePts(st.a, b); if (!P) return;
      const before = ctx.snapshot(), F = g.addFace(M(), P, grpOpt());
      if (!F) { ctx.status("that shape is too small"); return; }
      commit(tool, before); ctx.status((tool === "rect" ? "▭" : tool === "circle" ? "◯" : "⬠") + " a face - Push/Pull (P) it"); st = {}; V.preview({});
      lastShape = { tool, a: st.a };
    }
    let lastShape = null;
    function previewPP(d, label) {
      const m = M(), F = st.F, off = v3.mul(st.n, d), lines = [], faces = [];
      F.loops.forEach((l) => { const P = g.loopPts(m, l), Q = P.map((p) => v3.add(p, off)); loopLines(Q).forEach((x) => lines.push(x)); P.forEach((p, i) => lines.push([p, Q[i]])); });
      V.preview({ lines, faces: V.tri(F).map((t) => t.map((p) => v3.add(p, off))), tip: g.fmtLen(d) + label, tipAt: v3.add(st.p0, off), color: 0x2563eb });
      ctx.vcbValue(g.fmtLen(d));
    }
    function finishPP(d) {
      const dist = d != null ? d : st.d, F = st.F; if (!F || Math.abs(dist) < 1e-6) { st = {}; V.preview({}); return; }
      const before = ctx.snapshot(); const r = g.pushPull(M(), F.id, dist);
      lastPP = { face0: F.id, face: r.face, d: dist, before };
      commit("push/pull " + g.fmtLen(dist), before);
      ctx.status("⇧ " + g.fmtLen(dist) + (r.mode === "through" ? " - a hole through" : r.mode === "move" ? " - the sides stretched" : r.mode === "solid" ? " - a solid" : "") + " · type a distance to change it");
      st = {}; V.preview({});
    }
    function ghostWith(vs) {
      const s = ctx.sel(), m = M(), out = [];
      (s.f || []).forEach((id) => { const F = g.face(m, id); if (F) F.loops.forEach((l) => g.loopEdges(l).forEach(([a, b]) => out.push([vs[a], vs[b]]))); });
      (s.e || []).forEach((id) => { const E = m.e.find((x) => x.id === id); if (E) out.push([vs[E.a], vs[E.b]]); });
      (s.k || []).forEach((k) => { const [a, b] = k.split("_").map(Number); out.push([vs[a], vs[b]]); });
      return out;
    }
    function ghost(t) { const m = M(), vs = m.v.map((p) => p); selVerts().forEach((i) => { vs[i] = v3.add(m.v[i], t); }); return ghostWith(vs); }
    function finishMove(t) {
      const before = ctx.snapshot(), m = M();
      let sel = ctx.sel();
      if (st.copy) { sel = g.copyOf(m, sel); ctx.setSel(Object.assign({ k: [] }, sel)); }
      const vs = st.copy ? g.selVerts(m, sel) : selVerts();
      g.move(m, vs, t); commit(st.copy ? "copy" : "move", before);
      ctx.status("✥ " + (st.copy ? "copied " : "moved ") + g.fmtLen(v3.len(t)));
      st = {}; V.preview({});
    }
    function angleTo(p) {
      let a = (Math.atan2(p[1] - st.c[1], p[0] - st.c[0]) - st.a0) * 180 / Math.PI;
      while (a > 180) a -= 360; while (a < -180) a += 360;
      const s = Math.round(a / 15) * 15; if (Math.abs(a - s) < 2.5) a = s;
      return a;
    }
    function finishRotate(a) {
      const before = ctx.snapshot(); g.rotateZ(M(), selVerts(), st.c, a); commit("rotate", before);
      ctx.status("⟳ " + (+a.toFixed(2)) + "°"); st = {}; V.preview({});
    }
    function finishScale(k) {
      if (!(k > 1e-4)) return;
      const before = ctx.snapshot(), vs = selVerts(), c = st.c || g.bbox(M(), vs).center; g.scale(M(), vs, c, k); commit("scale", before);
      ctx.status("⤡ × " + (+k.toFixed(3))); st = {}; V.preview({});
    }
    function previewOffset(d) {
      const m = M(), F = st.F, P = g.facePlane(m, F), B = g.basis(P.n), outer = g.loopPts(m, F.loops[0]).map((q) => g.to2(q, P.p, B));
      const inn = g.offsetLoop2(outer, d).map((q) => v3.add(P.p, v3.add(v3.mul(B.u, q[0]), v3.mul(B.w, q[1]))));
      V.preview({ lines: loopLines(inn), tip: g.fmtLen(d), tipAt: inn[0], color: 0x2563eb }); ctx.vcbValue(g.fmtLen(d));
    }
    function finishOffset(d) {
      const before = ctx.snapshot();
      try { g.offset(M(), st.F.id, d); commit("offset", before); ctx.status("⧈ offset " + g.fmtLen(d) + " - Push/Pull (P) the ring for walls"); }
      catch (e) { ctx.status("⧈ " + e.message); }
      st = {}; V.preview({});
    }

    /* ---- the Measurements box */
    function vcb(text) {
      if (AT && AT.owns(tool)) { const ok = AT.vcb(text); if (!ok) ctx.status("the Measurements box takes " + (AT.VCB[tool] || "a length").toLowerCase() + " here"); return ok; }
      const P = g.parseVcb(text);
      if (!P) { ctx.status("the Measurements box takes a length (1.5, 150cm, 1500mm, 5'), two (3,2), a count of sides (24s)" + (tool === "rotate" ? " or degrees" : "")); return false; }
      const m = M();
      if (P.sides) { if (tool === "circle" || tool === "polygon") { sides[tool] = P.sides; ctx.status((tool === "circle" ? "◯" : "⬠") + " " + P.sides + " sides"); return true; } return false; }
      const L = P.vals[0];
      if (tool === "line" && st.pts) {
        const from = st.pts[st.pts.length - 1], dir = v3.norm(v3.sub(st.cur || v3.add(from, [1, 0, 0]), from));
        lineTo(v3.add(from, v3.mul(dir, L))); return true;
      }
      if ((tool === "rect") && st.a) {
        const n = st.plane.n, P2 = g.rectPts(st.a, st.cur || v3.add(st.a, [1, 1, 0]), n);
        const u = v3.norm(v3.sub(P2[1], P2[0])), w = v3.norm(v3.sub(P2[3], P2[0]));
        const uu = Number.isFinite(u[0]) && v3.len(v3.sub(P2[1], P2[0])) > 1e-9 ? u : (Math.abs(n[2]) > 0.999 ? [1, 0, 0] : v3.norm(v3.cross([0, 0, 1], n)));
        const ww = v3.len(v3.sub(P2[3], P2[0])) > 1e-9 ? w : v3.cross(n, uu);
        const b = v3.add(v3.add(st.a, v3.mul(uu, L)), v3.mul(ww, P.vals[1] != null ? P.vals[1] : L));
        finishShape(b); return true;
      }
      if ((tool === "circle" || tool === "polygon") && st.a) {
        const dir = v3.norm(v3.sub(st.cur || v3.add(st.a, [1, 0, 0]), st.a)); finishShape(v3.add(st.a, v3.mul(v3.len(dir) > 0 ? dir : [1, 0, 0], L))); return true;
      }
      if (tool === "pushpull") {
        if (st.F) { finishPP(L * (st.d < 0 ? -1 : 1)); return true; }
        if (lastPP && lastPP.before) {                     // the push just made, with this distance instead
          const sign = lastPP.d < 0 ? -1 : 1; ctx.restore(lastPP.before);
          const r = g.pushPull(M(), lastPP.face0, L * sign); lastPP = Object.assign({}, lastPP, { face: r.face, d: L * sign });
          commit("push/pull " + g.fmtLen(L * sign), lastPP.before); ctx.status("⇧ changed to " + g.fmtLen(L * sign)); return true;
        }
      }
      if (tool === "move" && st.base) {
        const t = P.vals.length >= 3 ? [P.vals[0], P.vals[1], P.vals[2]] : v3.mul(v3.norm(v3.sub(st.cur || v3.add(st.base, [1, 0, 0]), st.base)), L);
        finishMove(t); return true;
      }
      if (tool === "rotate" && st.c && st.a0 != null) {
        const deg = parseFloat(String(text).replace(/[^\d.+-]/g, "")); if (Number.isFinite(deg)) { finishRotate(deg); return true; }
      }
      if (tool === "scale" && st.h) { const k = parseFloat(text); if (k > 0) { finishScale(k); return true; } }
      if (tool === "offset" && st.F) { finishOffset(L); return true; }
      ctx.status("start the tool first, then type"); return false;
    }

    function key(e) {
      const k = e.key;
      if (AT && AT.key(e, tool)) return true;
      // Esc: stop the tool's step / leave the group / let go / back to Select - in Select with nothing picked it is not ours
      // (a maximized docker is restored by it)
      if (k === "Escape") { if (Object.keys(st).length) { reset(); ctx.status(HINT[tool] || ""); } else if (ctx.group()) ctx.enterGroup(null); else if (hasSel()) ctx.setSel({ f: [], e: [], k: [] }); else if (tool !== "select") { use("select"); ctx.status("⬚ Select"); } else return false; return true; }
      if (k === "ArrowRight" || k === "ArrowLeft" || k === "ArrowUp") { lock = k === "ArrowRight" ? 0 : k === "ArrowLeft" ? 1 : 2; ctx.status("keeping the " + ["red", "green", "blue"][lock] + " axis (↓ lets it go)"); return true; }
      if (k === "ArrowDown") { lock = null; ctx.status(HINT[tool]); return true; }
      if (k === "Shift" && lastSnap && lastSnap.axis != null && !e.repeat) { lock = lastSnap.axis; return true; }
      if (k === "Delete" || k === "Backspace") { if (hasSel() && tool === "select") { ctx.erase(); return true; } return false; }
      if (k === "Control" && tool === "move") { st.copy = !st.copy; ctx.status(st.copy ? "✥ Move - a COPY (Ctrl again: move)" : HINT.move); return true; }
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const t = ALL.find((x) => x[3] === k.toLowerCase());
        if (t && !(k === " " && tool === "select")) { use(t[0]); return true; }
      }
      return false;
    }
    function keyUp(e) { if (e.key === "Shift" && lock != null && lastSnap && lastSnap.axis === lock) { lock = null; } }
    use("select");
    return { state: () => st, use, name: () => tool, cancel: reset, key, keyUp, vcb, down, move, up, dbl, TOOLS: ALL, HINT, sides: () => sides, arch: AT };
  }
  root.PPTools = { create, TOOLS, HINT, VCB };
})(typeof window !== "undefined" ? window : globalThis);
