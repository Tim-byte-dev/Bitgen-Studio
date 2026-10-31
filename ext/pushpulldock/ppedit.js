/* bitGen Studio — ext/pushpulldock/ppedit.js (2.625.0): SELECT ON THE MODEL - FACES EXTRUDED / TWISTED, EDGES MOVED /
 * EXTRUDED / FILLETED, EDGE LOOPS, CORNERS MOVED; THEIR PROPERTIES PANEL (window.PPEdit, made by pptools.js).
 * Tim: "if user clicks a face show extrude in the properties panel, positive extrude will extrude positive, negative will cut
 * object, if user moves the face extrude to the face as blender does it, allow user to rotate face twist the extrusion to match
 * the rotated face. if user clicks an edge and moved it resize/move the edge .show edge properties, include extrude edge to
 * create a new face.add fillet to edge properties. allow user to select multiple edges, if user ctrl selects a edge then select
 * the edges that loop the face  if user selects a vertex move vertex."
 *
 *   Select tool (pptools.js asks this first, after the building's own picks):
 *     a corner (a vertex, within 8 px)  picked; dragged = moved (in the view's plane; Shift = along one axis; it snaps onto
 *                                       another corner / a midpoint)
 *     an edge                           picked (Shift+click: more edges); dragged = moved; Ctrl+click = every edge of the
 *                                       face's loop it is in (Ctrl+Shift adds the loop)
 *     a face                            picked; dragged = EXTRUDED along its normal (out: +, in: - = a cut); Ctrl+drag =
 *                                       TURNED round its normal - the face just extruded twists its extrusion
 *   The Measurements box with a face picked: that extrusion (the last one: changed).
 *   panel(kit) - pparchtools' #ppProps with nothing of the building picked: a face's Extrude + Twist, an edge's Length,
 *   Extrude edge (distance + way), Fillet (radius + pieces), a corner's X / Y / Z.
 * The geometry: ppmesh.js (pure). */
(function (root) {
  "use strict";
  const G = () => root.PPGeo, X = () => root.PPMesh;
  function create(ctx) {
    const V = ctx.V, M = () => ctx.model();
    let D = null, last = null;          // the drag; the last extrusion {base, fid, d, twist, top: [points of its top face]}
    const v3 = () => G().v3;
    const fmt = (x) => G().fmtLen(x);
    const sel = () => Object.assign({ f: [], e: [], k: [], p: [] }, JSON.parse(JSON.stringify(ctx.sel() || {})));
    const mine = (grp) => (grp || null) === (ctx.group() || null);
    const mouse = (ev) => { const r = V.canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };

    /* ---- what is under the pointer */
    function vertexAt(ev) {
      const m = M(), used = new Set(), [mx, my] = mouse(ev);
      m.f.forEach((F) => { if (mine(F.grp)) F.loops.forEach((l) => l.forEach((i) => used.add(i))); });
      m.e.forEach((E) => { if (mine(E.grp)) { used.add(E.a); used.add(E.b); } });
      let best = null;
      used.forEach((i) => { const q = V.screen(m.v[i]); if (q[2] > 1) return; const d = Math.hypot(q[0] - mx, q[1] - my); if (d < 8 && (!best || d < best.d)) best = { d, i }; });
      if (!best) return null;
      const r = V.ray(ev), hit = V.pick(ev, { group: ctx.group() }), dv = v3().len(v3().sub(m.v[best.i], r.o));
      if (hit && hit.point && v3().len(v3().sub(hit.point, r.o)) < dv - 0.02) return null;          // behind a face
      return best.i;
    }
    function hover(ev) {
      const vi = vertexAt(ev); if (vi != null) return { vertex: vi };
      return null;
    }
    const pts = (ids) => ids.map((i) => M().v[i].slice());
    function reselect(s, P) {           // after a commit the corners are numbered again: found by where they are now
      const m = M(), f = X().findV, out = { f: (s.f || []).filter((id) => G().face(m, id)), e: [], k: [], p: [] };
      (P.k || []).forEach(([a, b]) => { const i = f(m, a, 1e-6), j = f(m, b, 1e-6); if (i >= 0 && j >= 0) out.k.push(G().edgeKey(i, j)); });
      (P.p || []).forEach((a) => { const i = f(m, a, 1e-6); if (i >= 0) out.p.push(i); });
      (s.e || []).forEach((id) => { if (m.e.some((E) => E.id === id)) out.e.push(id); });
      ctx.setSel(out);
    }
    const where = (s, map) => ({ k: (s.k || []).map((k) => X().edgeEnds(M(), k).map((i) => (map ? map(i) : M().v[i].slice()))), p: (s.p || []).map((i) => (map ? map(i) : M().v[i].slice())) });

    /* ---- the pointer (Select) */
    function down(ev) {
      const vi = vertexAt(ev), add = ev.shiftKey;
      if (vi != null) {
        const s = add ? sel() : { f: [], e: [], k: [], p: [] };
        const was = s.p.includes(vi); if (!was) s.p.push(vi);
        ctx.setSel(s); begin(ev, "verts", { p0: M().v[vi].slice(), untoggle: was && add ? ["p", vi] : null });   // Shift+click a picked one: out (on a click, not a drag)
        ctx.status("• a corner - drag it to move it (Shift: along one axis) · X / Y / Z in the panel"); return true;
      }
      const p = V.pick(ev, { group: ctx.group() });
      if (!p || (p.grp && p.grp !== ctx.group())) return false;                       // nothing / a group: as before
      if (p.edge && !p.line) {
        const s = add ? sel() : { f: [], e: [], k: [], p: [] };
        if (ev.ctrlKey || ev.metaKey) {                                             // the loop round the face
          const hf = V.pick(ev, { group: ctx.group() }), loop = X().edgeLoop(M(), p.edge, p.faceOfEdge || (hf && hf.face));
          loop.forEach((k) => { if (!s.k.includes(k)) s.k.push(k); }); ctx.setSel(s);
          ctx.status("╱ " + loop.length + " edges - the loop round the face · Fillet / Extrude in the panel"); return true;
        }
        const was = s.k.includes(p.edge); if (!was) s.k.push(p.edge);
        ctx.setSel(s); begin(ev, "verts", { p0: p.point, untoggle: was && add ? ["k", p.edge] : null });
        ctx.status("╱ " + s.k.length + " edge" + (s.k.length > 1 ? "s" : "") + " - drag to move · Shift+click: more · Ctrl+click: the face's loop · the panel: Length, Extrude edge, Fillet");
        return true;
      }
      if (p.face) {
        const s = add ? sel() : { f: [], e: [], k: [], p: [] };
        const i = s.f.indexOf(p.face); if (i >= 0 && add) s.f.splice(i, 1); else if (!s.f.includes(p.face)) s.f.push(p.face);
        ctx.setSel(s);
        if (!add) begin(ev, ev.ctrlKey || ev.metaKey ? "turn" : "extrude", { p0: p.point, fid: p.face, n: G().faceNormal(M(), G().face(M(), p.face)) });
        ctx.status("▭ a face - drag it to extrude (in = a cut) · Ctrl+drag turns it (twists its extrusion) · Extrude in the panel");
        return true;
      }
      return false;
    }
    function begin(ev, mode, o) {
      const r = V.ray(ev);
      D = Object.assign({ mode, x0: ev.clientX, y0: ev.clientY, moved: false, before: ctx.snapshot(), sel: sel(), n0: v3().mul(r.d, -1) }, o);
      if (mode === "verts") { D.ids = vertsOf(D.sel); D.orig = pts(D.ids); }
      if (mode === "turn" && last && sameFace(last, D.fid)) { D.ex = last; D.tw0 = last.twist; }
    }
    function vertsOf(s) {
      const vs = new Set(s.p || []);
      (s.k || []).forEach((k) => X().edgeEnds(M(), k).forEach((i) => vs.add(i)));
      (s.e || []).forEach((id) => { const E = M().e.find((x) => x.id === id); if (E) { vs.add(E.a); vs.add(E.b); } });
      return [...vs];
    }
    const sameFace = (L, fid) => L && L.fid2 === fid;
    function viewPlane(ev) {
      const r = V.ray(ev), n = D.n0, den = v3().dot(n, r.d); if (Math.abs(den) < 1e-9) return null;
      const t = v3().dot(v3().sub(D.p0, r.o), n) / den; return t > 0 ? v3().add(r.o, v3().mul(r.d, t)) : null;
    }
    function move(ev) {
      if (!D) { const h = hover(ev); if (h) { V.setHover({ vertex: h.vertex }); return true; } return false; }
      if (!(ev.buttons & 1)) { D = null; return false; }
      if (!D.moved && Math.hypot(ev.clientX - D.x0, ev.clientY - D.y0) < 4) return true;
      D.moved = true;
      if (D.mode === "verts") {
        const q = viewPlane(ev); if (!q) return true;
        let t = v3().sub(q, D.p0);
        if (D.sel.p.length === 1 && !D.sel.k.length && !ev.shiftKey) {              // a corner snaps onto another corner
          const s = V.snap(ev, { group: ctx.group() });
          if (s && s.kind === "Endpoint" && X().findV(M(), s.p, 1e-6) !== D.ids[0]) { t = v3().sub(s.p, D.p0); D.snapped = true; } else D.snapped = false;
        }
        if (ev.shiftKey) { const k = [0, 1, 2].reduce((a, b) => (Math.abs(t[b]) > Math.abs(t[a]) ? b : a), 0); t = t.map((x, i) => (i === k ? x : 0)); }
        D.t = t; const m = M();
        D.ids.forEach((i, j) => { m.v[i] = v3().add(D.orig[j], t); });
        ctx.redraw(); ctx.vcbValue(fmt(v3().len(t)));
        ctx.status("✥ moved " + fmt(v3().len(t)) + (ev.shiftKey ? " (one axis)" : ""));
        return true;
      }
      if (D.mode === "extrude") {
        const r = V.ray(ev), c = G().linesClosest(D.p0, D.n, r.o, r.d);
        D.d = Math.round(c.t * 1000) / 1000;
        apply(D.before, D.fid, D.d, 0);
        ctx.vcbValue(fmt(D.d)); ctx.status("⇧ extrude " + fmt(D.d) + (D.d < 0 ? " - a cut" : ""));
        return true;
      }
      if (D.mode === "turn") {
        let a = (ev.clientX - D.x0) * 0.5; if (!ev.shiftKey) a = Math.round(a / 5) * 5;
        D.a = a;
        if (D.ex) apply(D.ex.base, D.ex.fid, D.ex.d, D.tw0 + a);
        else { ctx.restore(D.before); X().rotateFace(M(), D.fid, a); ctx.redraw(); }
        ctx.vcbValue(a + "°"); ctx.status("⟳ " + (D.ex ? "the extrusion twisted " + (D.tw0 + a) : "the face turned " + a) + "° (5° steps - Shift: free)");
        return true;
      }
      return true;
    }
    function apply(base, fid, d, tw) {
      ctx.restore(base);
      let r = null;
      try { if (Math.abs(d) > 1e-6 || Math.abs(tw) > 1e-9) r = X().extrude(M(), fid, d, { twist: tw }); } catch (e) { r = null; }
      ctx.redraw(); return r;
    }
    function up() {
      const d = D; D = null; if (!d) return false;
      if (!d.moved) { if (d.untoggle) { const s = sel(), L = s[d.untoggle[0]], i = L.indexOf(d.untoggle[1]); if (i >= 0) { L.splice(i, 1); ctx.setSel(s); } } return true; }
      if (d.mode === "verts") {
        const t = d.t || [0, 0, 0], P = where(d.sel, (i) => { const j = d.ids.indexOf(i); return j >= 0 ? v3().add(d.orig[j], t) : M().v[i].slice(); });
        ctx.restore(d.before); X().moveVerts(M(), d.ids, t);
        ctx.commit("move", d.before); reselect(d.sel, P); return true;
      }
      if (d.mode === "extrude") return finishExtrude(d.before, d.fid, d.d || 0, 0);
      if (d.mode === "turn") {
        if (d.ex) return finishExtrude(d.ex.base, d.ex.fid, d.ex.d, d.tw0 + (d.a || 0));
        ctx.restore(d.before); X().rotateFace(M(), d.fid, d.a || 0); ctx.commit("turn", d.before); ctx.setSel({ f: [d.fid], e: [], k: [], p: [] }); ctx.status("⟳ the face turned " + (d.a || 0) + "°"); return true;
      }
      return true;
    }
    /** the extrusion from base: kept as `last` (typed / dragged again = changed); the top face picked */
    function finishExtrude(base, fid, d, tw) {
      if (Math.abs(d) < 1e-6 && Math.abs(tw) < 1e-9) { ctx.restore(base); return true; }
      const r = apply(base, fid, d, tw);
      if (!r) { ctx.restore(base); ctx.status("that face could not be extruded"); return true; }
      const top = G().face(M(), r.face);
      ctx.commit("extrude", base);
      const fid2 = top ? r.face : null;
      last = { base, fid, d, twist: tw, fid2 };
      ctx.setSel({ f: fid2 && G().face(M(), fid2) ? [fid2] : [], e: [], k: [], p: [] });
      ctx.status("⇧ extruded " + fmt(d) + (tw ? " · twisted " + tw + "°" : "") + (r.mode === "through" ? " - a hole through" : d < 0 ? " - a cut" : "") + " · type a distance to change it");
      return true;
    }
    function vcb(P) {
      const s = ctx.sel(); if (!s || !(s.f || []).length || s.f.length !== 1) return false;
      const L = P.vals[0]; if (!Number.isFinite(L)) return false;
      if (last && last.fid2 === s.f[0]) return finishExtrude(last.base, last.fid, L, last.twist);
      return finishExtrude(ctx.snapshot(), s.f[0], L, 0);
    }

    /* ---- the panel */
    function wants() { const s = ctx.sel() || {}; return (s.f || []).length === 1 || (s.k || []).length > 0 || (s.p || []).length > 0; }
    function panel(K) {
      const s = sel(), m = M();
      if (s.p.length) {
        const i = s.p[0], q = m.v[i]; if (!q) return;
        K.head("• Corner" + (s.p.length > 1 ? "s (" + s.p.length + ")" : ""));
        if (s.p.length === 1) ["X", "Y", "Z"].forEach((ax, k) => K.numIn(ax, q[k], (v) => { const b = ctx.snapshot(), t = [0, 0, 0]; t[k] = v - M().v[i][k]; const P = where(s); P.p = [v3().add(M().v[i], t)]; X().moveVerts(M(), [i], t); ctx.commit("move", b); reselect(s, P); K.refresh(); }, 0.01, -1e4, 1e4, "m"));
        hint(K, "Drag a corner to move it (Shift: along one axis); it snaps onto another corner or a midpoint.");
        return;
      }
      if (s.k.length) {
        const ends = s.k.map((k) => X().edgeEnds(m, k)), L0 = ends.length === 1 ? v3().len(v3().sub(m.v[ends[0][1]], m.v[ends[0][0]])) : 0;
        K.head(s.k.length === 1 ? "╱ Edge · " + fmt(L0) : "╱ " + s.k.length + " edges");
        if (s.k.length === 1) K.numIn("Length", L0, (v) => { const b = ctx.snapshot(), [a, c] = ends[0], A = m.v[a], C = m.v[c], mid = v3().mul(v3().add(A, C), 0.5), u = v3().norm(v3().sub(C, A)); X().setEdgeLength(M(), s.k[0], v); ctx.commit("edge length", b); reselect(s, { k: [[v3().sub(mid, v3().mul(u, v / 2)), v3().add(mid, v3().mul(u, v / 2))]] }); K.refresh(); }, 0.01, 0.001, 1e4, "m");
        // extrude edge
        K.box.appendChild(K.el("div", "pph", "Extrude edge - a new face"));
        const ex = state.ex;
        K.numIn("Distance", ex.d, (v) => { ex.d = v; }, 0.05, -1e3, 1e3, "m");
        K.selIn("Which way", ex.way, [["up", "Up (blue)"], ["out", "Out from its face"], ["x", "Along red"], ["y", "Along green"]], (v) => { ex.way = v; });
        K.btns([["⇧ Extrude edge" + (s.k.length > 1 ? "s" : ""), () => extrudeEdges(s, ex.d, ex.way, K)]]);
        // fillet
        K.box.appendChild(K.el("div", "pph", "Fillet - round the edge"));
        const fl = state.fl;
        K.numIn("Radius", fl.r, (v) => { fl.r = v; }, 0.01, 0.001, 100, "m");
        K.numIn("Pieces", fl.seg, (v) => { fl.seg = Math.round(v); }, 1, 1, 32);
        K.btns([["◠ Fillet", () => filletEdges(s, fl.r, fl.seg, K)]]);
        hint(K, "Drag an edge to move it (Shift: along one axis). Shift+click picks more edges; Ctrl+click picks the loop round the face.");
        return;
      }
      if (s.f.length === 1) {
        const F = G().face(m, s.f[0]); if (!F) return;
        K.head("▭ Face · " + (+G().faceArea(m, F).toFixed(3)) + " m²");
        const isLast = last && last.fid2 === F.id, d0 = isLast ? last.d : state.fx.d, t0 = isLast ? last.twist : state.fx.twist;
        K.numIn("Extrude", d0, (v) => { if (isLast) finishExtrude(last.base, last.fid, v, last.twist); else state.fx.d = v; K.refresh(); }, 0.05, -1e3, 1e3, "m");
        K.numIn("Twist", t0, (v) => { if (isLast) finishExtrude(last.base, last.fid, last.d, v); else state.fx.twist = v; K.refresh(); }, 5, -720, 720, "°");
        if (!isLast) K.btns([["⇧ Extrude", () => { finishExtrude(ctx.snapshot(), F.id, state.fx.d, state.fx.twist); K.refresh(); }, "+ out, − in (a cut)"], ["⟳ Turn 15°", () => { const b = ctx.snapshot(); X().rotateFace(M(), F.id, 15); ctx.commit("turn", b); ctx.setSel({ f: [F.id], e: [], k: [], p: [] }); K.refresh(); }, "turn the face round its normal"]]);
        hint(K, isLast ? "This is the face just extruded: change its Extrude (+ out, − a cut) or Twist and it is redone. Ctrl+drag it twists it." : "Extrude: + out, − in (a cut through the object). Or drag the face (Blender-style); Ctrl+drag turns it.");
      }
    }
    const state = { ex: { d: 1, way: "up" }, fl: { r: 0.1, seg: 6 }, fx: { d: 0.5, twist: 0 } };
    function hint(K, t) { K.box.appendChild(K.el("div", "pphint", t)); }
    function wayVec(k, way, d) {
      const m = M(), [a, b] = X().edgeEnds(m, k), u = v3().norm(v3().sub(m.v[b], m.v[a]));
      if (way === "x") return [d, 0, 0]; if (way === "y") return [0, d, 0];
      if (way === "out") {
        const fs = X().edgeFaces(m, a, b);
        if (fs.length) { const F = fs[0].F, n = G().faceNormal(m, F), c = X().faceCenter(m, F); let w = v3().norm(v3().cross(n, u)); if (v3().dot(v3().sub(c, m.v[a]), w) > 0) w = v3().mul(w, -1); return v3().mul(w, d); }
      }
      if (Math.abs(u[2]) > 0.99) { return [d, 0, 0]; }                                 // an upright edge: up is along it
      return [0, 0, d];
    }
    function extrudeEdges(s, d, way, K) {
      if (Math.abs(d) < 1e-6) { ctx.status("type a distance first"); return; }
      const b = ctx.snapshot(), made = [];
      s.k.forEach((k) => { const F = X().extrudeEdge(M(), k, wayVec(k, way, d)); if (F) made.push(F.id); });
      if (!made.length) { ctx.status("no face made"); return; }
      ctx.commit("extrude edge", b); ctx.setSel({ f: made.length === 1 ? made : [], e: [], k: [], p: [] });
      ctx.status("⇧ " + made.length + " new face" + (made.length > 1 ? "s" : "") + " from the edge" + (made.length > 1 ? "s" : "")); K.refresh();
    }
    function filletEdges(s, r, seg, K) {
      const b = ctx.snapshot(); let ok = 0, why = "";
      s.k.forEach((k) => { const res = X().fillet(M(), k, r, seg); if (res.ok) ok++; else why = res.why; });
      if (!ok) { ctx.restore(b); ctx.status("◠ no fillet: " + why); return; }
      ctx.commit("fillet", b); ctx.setSel({ f: [], e: [], k: [], p: [] });
      ctx.status("◠ " + ok + " edge" + (ok > 1 ? "s" : "") + " rounded (" + fmt(r) + ")" + (why ? " · some could not be: " + why : "")); K.refresh();
    }
    return { down, move, up, vcb, wants, panel, hover, vertexAt, last: () => last, cancel: () => { D = null; } };
  }
  root.PPEdit = { create };
})(typeof window !== "undefined" ? window : globalThis);
