/* pcdimgroup.js — DIMENSION GROUPS: every part of a dimension its own editable layer (2.457.0), window.PCDimGroup.
 *
 * Tim (verbatim): "fix dimension lines. keep all of the dimesions elements (dimension line, dimension group, arrowhead
 * and extension line. add option to click on an edge and drag the dimension line from the edge of the object as a
 * dimension group, add option to click on 1 edge or node then another edge or node to place a dimension group. allow
 * user to drag the extension line to change the length of the dimension line update the length live. shift+drag will
 * constrain the dimension line horizontally, ctrl+drag will constrain the dimension line vertically. allow extension
 * lines to be resized individually using it's nodes." - asked: each dimension = a group of parts.
 *
 *   A DIMENSION GROUP   a layer group (G.dimg = its definition) holding three vector-line layers: Extension Line 1,
 *                       Extension Line 2 and the Dimension Line (its arrowheads at both ends, its number on it). They
 *                       are always rebuilt from the definition, so nothing is ever lost (the old one-layer dimension
 *                       kept its extension lines as parts of one path, and a path clean-up dropped what told them
 *                       apart - their arrowheads and their gaps went wrong).
 *   DRAWING IT          (the Parallel and Horizontal / Vertical Dimension tools)
 *     · press on an object's EDGE and drag away: the edge is measured, the dimension line follows the pointer
 *     · or click a NODE / an EDGE, then another node / edge (an edge = the point on it square to the first pick),
 *       then click where the dimension line goes
 *     · Shift = the dimension line horizontal, Ctrl = vertical (while drawing and while dragging it)
 *   EDITING IT          (the Move tool, the Shape tool, the path tools, the dimension tools) on a picked group:
 *     · drag the DIMENSION LINE: it moves nearer / further (Shift / Ctrl as above)
 *     · drag an EXTENSION LINE: its measured point slides along the dimension - the length and its number change live
 *     · drag an extension line's NODES (its two ends): that one extension line gets longer / shorter on its own
 *   The group moves / scales / turns as one (the Move tool and its handles): the definition follows its parts. The
 *   number uses the picture's dimension scale (pcdims.js).
 * Pure (Node: scripts/test-dimgroup.js): geom, autoKind, constrain, moveLine, moveExt, extNode, segmentsOf, nearestSeg,
 * foot, fit3, mapDef, makeDef.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const EXT0 = { gap: 4, over: 6 };
  const dot = (p, q) => p[0] * q[0] + p[1] * q[1];
  const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];
  const add = (p, q, k) => [p[0] + q[0] * (k == null ? 1 : k), p[1] + q[1] * (k == null ? 1 : k)];
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const KINDS = ["parallel", "horizontal", "vertical"];
  /** a new definition: kind parallel | horizontal | vertical, the measured points a / b, m = a point the dimension line passes through */
  function makeDef(kind, a, b, m, o) {
    const x = o || {};
    return { v: 2, kind: KINDS.includes(kind) ? kind : "parallel", a: [+a[0], +a[1]], b: [+b[0], +b[1]], m: [+m[0], +m[1]],
      ext: [Object.assign({}, EXT0, x.ext && x.ext[0]), Object.assign({}, EXT0, x.ext && x.ext[1])], size: x.size || 14, color: x.color || "#000000", w: x.w || 1.5, asize: x.asize || 5 };
  }
  /** horizontal when the line is placed above / below the points, vertical when beside them (the H / V tool) */
  function autoKind(a, b, m) { return Math.abs(m[1] - (a[1] + b[1]) / 2) > Math.abs(m[0] - (a[0] + b[0]) / 2) ? "horizontal" : "vertical"; }
  /** Shift = horizontal, Ctrl = vertical, else as it is */
  const constrain = (kind, shift, ctrl) => (shift ? "horizontal" : ctrl ? "vertical" : kind);
  /** where everything goes: u (along), n (across), the dimension line d0 - d1, each extension line {s, e, dir, off}, the length, the number's place */
  function geom(def) {
    const a = def.a, b = def.b, m = def.m;
    let u;
    if (def.kind === "horizontal") u = [Math.sign(b[0] - a[0]) || 1, 0];
    else if (def.kind === "vertical") u = [0, Math.sign(b[1] - a[1]) || 1];
    else { const L = Math.hypot(b[0] - a[0], b[1] - a[1]); u = L > 1e-9 ? [(b[0] - a[0]) / L, (b[1] - a[1]) / L] : [1, 0]; }
    const n = [-u[1], u[0]];
    const offA = dot(sub(m, a), n), offB = dot(sub(m, b), n);
    const d0 = add(a, n, offA), d1 = add(b, n, offB);
    const ext = [[a, d0, offA], [b, d1, offB]].map(([p, d, off], i) => {
      const dir = Math.sign(off) || Math.sign(offA || offB) || 1, dv = [n[0] * dir, n[1] * dir], e0 = def.ext && def.ext[i] ? def.ext[i] : EXT0;
      const gap = Math.max(0, Math.min(+e0.gap || 0, Math.abs(off))), over = +e0.over || 0;
      return { s: add(p, dv, gap), e: add(d, dv, over), dir: dv, off, p, d };
    });
    const len = Math.abs(dot(sub(b, a), u));
    let ang = Math.atan2(d1[1] - d0[1], d1[0] - d0[0]); if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
    if (Math.abs(d1[0] - d0[0]) < 1e-9 && Math.abs(d1[1] - d0[1]) < 1e-9) ang = Math.atan2(u[1], u[0]);
    const side = offA >= 0 ? 1 : -1, mx = (d0[0] + d1[0]) / 2, my = (d0[1] + d1[1]) / 2;
    const base = side > 0 === (Math.cos(ang) * n[1] - Math.sin(ang) * n[0] > 0) ? "top" : "bottom";
    return { u, n, d0, d1, ext, len, label: { x: r3(mx + n[0] * side * 3), y: r3(my + n[1] * side * 3), angle: r3(ang), base } };
  }
  const clone = (d) => JSON.parse(JSON.stringify(d));
  /** the dimension line dragged to p (Shift / Ctrl: horizontal / vertical) */
  function moveLine(def0, p, shift, ctrl) { const d = clone(def0); d.m = [p[0], p[1]]; d.kind = constrain(def0.kind, shift, ctrl); return d; }
  /** extension line i dragged from p0 to p: its measured point slides along the dimension (the length changes) */
  function moveExt(def0, i, p0, p, shift, ctrl) {
    const d = clone(def0); d.kind = constrain(def0.kind, shift, ctrl);
    const g = geom(d), k = dot(sub(p, p0), g.u), key = i ? "b" : "a";
    d[key] = add(def0[key], g.u, k);
    return d;
  }
  /** an extension line's node dragged to p: which = "s" (its start, near the measured point) | "e" (its end, past the line) */
  function extNode(def0, i, which, p) {
    const d = clone(def0), g = geom(d), x = g.ext[i], t = dot(sub(p, x.p), x.dir);
    if (which === "s") d.ext[i].gap = r3(Math.max(0, Math.min(Math.abs(x.off), t)));
    else d.ext[i].over = r3(Math.max(-Math.abs(x.off) + d.ext[i].gap, t - Math.abs(x.off)));
    return d;
  }
  /** the straight pieces of a path (its nodes joined - a curve by its chord): [[a, b] ...] */
  function segmentsOf(path) {
    const out = [];
    for (const s of (path && path.subs) || []) { const a = s.pts || []; const n = s.closed ? a.length : a.length - 1; for (let i = 0; i < n; i++) { const p = a[i], q = a[(i + 1) % a.length]; out.push([[p.x, p.y], [q.x, q.y]]); } }
    return out;
  }
  const boxSegs = (b) => [[[b.x, b.y], [b.x + b.w, b.y]], [[b.x + b.w, b.y], [b.x + b.w, b.y + b.h]], [[b.x + b.w, b.y + b.h], [b.x, b.y + b.h]], [[b.x, b.y + b.h], [b.x, b.y]]];
  /** the segment within tol of (x, y): {a, b, d} | null */
  function nearestSeg(segs, x, y, tol) {
    let best = null;
    for (const [a, b] of segs || []) {
      const v = sub(b, a), L2 = dot(v, v); if (L2 < 1e-9) continue;
      const t = Math.max(0, Math.min(1, dot(sub([x, y], a), v) / L2)), q = add(a, v, t), d = Math.hypot(q[0] - x, q[1] - y);
      if (d <= tol && (!best || d < best.d)) best = { a, b, d };
    }
    return best;
  }
  /** the point on the (endless) line a - b square to p */
  function foot(p, a, b) { const v = sub(b, a), L2 = dot(v, v); if (L2 < 1e-12) return [a[0], a[1]]; const t = dot(sub(p, a), v) / L2; return add(a, v, t); }
  /** the affine map [a, b, c, d, e, f] taking points P[0..2] to Q[0..2] (null when they are in a line) */
  function fit3(P, Q) {
    const [p0, p1, p2] = P, [q0, q1, q2] = Q;
    const x1 = p1[0] - p0[0], y1 = p1[1] - p0[1], x2 = p2[0] - p0[0], y2 = p2[1] - p0[1], det = x1 * y2 - x2 * y1;
    if (Math.abs(det) < 1e-9) return null;
    const u1 = q1[0] - q0[0], v1 = q1[1] - q0[1], u2 = q2[0] - q0[0], v2 = q2[1] - q0[1];
    const a = (u1 * y2 - u2 * y1) / det, c = (u2 * x1 - u1 * x2) / det, b = (v1 * y2 - v2 * y1) / det, d = (v2 * x1 - v1 * x2) / det;
    return [a, b, c, d, q0[0] - a * p0[0] - c * p0[1], q0[1] - b * p0[0] - d * p0[1]];
  }
  const ap = (M, p) => [M[0] * p[0] + M[2] * p[1] + M[4], M[1] * p[0] + M[3] * p[1] + M[5]];
  /** the definition carried through M (a move / scale / turn of the whole group); a quarter turn swaps H / V, others = parallel */
  function mapDef(def0, M) {
    const d = clone(def0), k = Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2])) || 1;
    d.a = ap(M, def0.a); d.b = ap(M, def0.b); d.m = ap(M, def0.m);
    for (const e of d.ext) { e.gap = r3(e.gap * k); e.over = r3(e.over * k); }
    const turn = Math.atan2(M[1], M[0]) * 180 / Math.PI, q = ((Math.round(turn) % 180) + 180) % 180;
    if (d.kind !== "parallel") { if (Math.abs(q - 90) < 0.5) d.kind = d.kind === "horizontal" ? "vertical" : "horizontal"; else if (q > 0.5 && q < 179.5) d.kind = "parallel"; }
    return d;
  }

  /* ================================ the editor ================================ */
  function install(E) {
    const S = E.S, D = E.D, doc = E.doc || root.document, say = E.say, stage = E.stage, Q = root.PCPath, B = root.PCBez;
    if (!E.ui || !E.tools || !Q || !stage || !E.dims) return;
    const ctx = (c) => c.getContext("2d");
    const kidsOf = (G) => S.layers.filter((x) => x.parent === G.id);
    const isGroup = (G) => !!(G && G.type === "group" && G.dimg);
    const groupOf = (L) => (isGroup(L) ? L : L && L.parent != null ? (S.layers.find((x) => x.id === L.parent && isGroup(x)) || null) : null);
    const partOf = (G, role) => kidsOf(G).find((x) => x.dimPart === role) || null;
    const textFor = (len) => (E.dims.textFor ? E.dims.textFor(len) : len.toFixed(1) + " px");
    const pts = (list) => list.map(([x, y]) => Q.anchor(r3(x), r3(y)));
    const pathOf = (list) => ({ subs: [{ closed: false, op: "add", pts: pts(list) }] });
    function styleShape(L, def, line) {
      L.shape = Object.assign({}, D.SHAPE_DEFAULT, L.shape || {}, { kind: "path", fillOn: false, strokeOn: true, stroke: def.color, strokeW: def.w });
      L.shape.line = Object.assign({}, (B && B.LINE_DEFAULT) || {}, (L.shape && L.shape.line) || {}, line);
    }
    /** a group's parts drawn again from its definition */
    function rebuild(G) {
      const def = G.dimg, g = geom(def);
      for (const [role, list, line] of [["ext1", [g.ext[0].s, g.ext[0].e], { start: "none", end: "none", labels: [] }], ["ext2", [g.ext[1].s, g.ext[1].e], { start: "none", end: "none", labels: [] }],
        ["line", [g.d0, g.d1], { start: "arrow", end: "arrow", asize: def.asize, labels: [Object.assign({ text: textFor(g.len), size: def.size }, g.label)] }]]) {
        const L = partOf(G, role); if (!L) continue;
        styleShape(L, def, line); L.shape.path = pathOf(list);
        Q.syncShape(L.shape); D.rasterize(L);
      }
      G.dimg.len = r3(g.len);
      return g;
    }
    const count = () => S.layers.filter(isGroup).length;
    /** the parts + the group made (inside a struct op): above the active layer (above its dimension group when it is a part) */
    function build(def, name) {
      const parts = [["ext1", "Extension Line 1"], ["ext2", "Extension Line 2"], ["line", "Dimension Line"]].map(([role, nm]) => {
        const L = E.makeLayer(nm, S.w, S.h, "shape"); L.dimPart = role; styleShape(L, def, {}); L.shape.path = pathOf([[0, 0], [1, 1]]); return L;
      });
      let A = S.layers[S.active]; const AG = groupOf(A); if (AG) A = AG;
      const at = A ? S.layers.indexOf(A) + 1 : S.layers.length;
      S.layers.splice(Math.min(at, S.layers.length), 0, ...parts);
      const G = E.makeLayer(name || "Dimension " + (count() + 1), S.w, S.h, "group"); G.dimg = clone(def);
      S.layers = D.group(S.layers, parts.map((x) => x.id), G);
      for (const x of parts) x.parent = G.id;
      rebuild(G);
      S.active = S.layers.indexOf(G);
      return G;
    }
    /** a new dimension group (one undo step) */
    function create(def, name) {
      if (!S.w) return null;
      let G = null;
      E.structOp("dimension", () => { G = build(def, name); });
      return G;
    }
    /** 2.458.0: several dimension groups in ONE undo step, optionally held in one plain group `wrap` (auto / floorplan / chain) */
    function createMany(list, wrap, label) {
      if (!S.w || !list || !list.length) return null;
      let out = null;
      E.structOp(label || "dimensions", () => {
        const made = list.map((x) => build(x.def, x.name));
        if (wrap) { const W = E.makeLayer(wrap, S.w, S.h, "group"); W.dimSet = true; S.layers = D.group(S.layers, made.map((G) => G.id), W); S.active = S.layers.indexOf(W); out = { wrap: W, groups: made }; }
        else out = { wrap: null, groups: made };
      });
      return out;
    }
    /* ---- picking edges and nodes */
    function edgeAt(x, y, skipGroup) {
      const tol = 7 / (S.zoom || 1); let best = null;
      for (let i = S.layers.length - 1; i >= 0; i--) {
        const L = S.layers[i];
        if (!D.shown(S.layers, L) || L.type === "group" || L.type === "adjust" || L.type === "fill" || L.control || (skipGroup && L.parent === skipGroup.id) || groupOf(L)) continue;
        let segs = null;
        if (L.type === "shape" && L.shape && L.shape.kind === "path" && L.shape.path) segs = segmentsOf(L.shape.path);
        else { const b = E.dockers ? E.dockers.boxOf(L) : null; if (b && b.w > 0 && b.h > 0 && !(L.type === "pixel" && b.w >= S.w - 1 && b.h >= S.h - 1)) segs = boxSegs(b); }
        const s = nearestSeg(segs, x, y, tol); if (s && (!best || s.d < best.d)) best = s;
      }
      return best;
    }
    function nodeAt(x, y) { const r = E.dims.cadSnap(x, y, null); return r && r.k !== "on outline" ? r : null; }

    /* ---- the Parallel and Horizontal / Vertical tools: a dimension GROUP */
    const st = { ph: 0 };
    const reset = () => { st.ph = 0; st.a = st.b = st.e1 = st.edge = st.hover = null; st.moved = false; E.drawOverlay(); };
    function kindFor(tool, a, b, m, e) { const k = tool === "cdimhv" ? autoKind(a, b, m) : "parallel"; return constrain(k, e && e.shiftKey, e && (e.ctrlKey || e.metaKey)); }
    const defOpts = () => ({ size: (S.cd && S.cd.tsize) || 14, color: S.fg || "#000000", w: Math.max(1, Math.min(4, S.vlW > 4 ? 1.5 : S.vlW || 1.5)) });
    function make(tool, a, b, m, e) { const G = create(makeDef(kindFor(tool, a, b, m, e), a, b, m, defOpts())); if (G) say(`${G.name}: ${textFor(G.dimg.len)} - drag its line, an extension line or its nodes to change it (Shift = horizontal, Ctrl = vertical)`); reset(); return G; }
    for (const id of ["cdimpar", "cdimhv"]) {
      const T = E.tools[id]; if (!T) continue;
      const name = T.name, prevHover = T.hover;   // pcdims.js's hover: the CAD point shown
      Object.assign(T, {
        down(e, fx, fy) {
          if (!S.w) return false;
          const p = [fx, fy];
          if (st.ph === 0) {
            const nd = nodeAt(fx, fy);
            if (nd) { st.a = [nd.x, nd.y]; st.ph = 1; say(`${name}: a ${nd.k} - now click another node / edge`); E.drawOverlay(); return false; }
            const ed = edgeAt(fx, fy);
            if (ed) { st.edge = ed; st.p0 = p; st.hover = p; st.moved = false; return; }   // a press on an edge: drag the line out (or a click = the first pick)
            st.a = p; st.ph = 1; say(`${name}: now click another point / edge`); E.drawOverlay(); return false;
          }
          if (st.ph === 1) {
            const nd = nodeAt(fx, fy), ed = nd ? null : edgeAt(fx, fy);
            if (st.e1) {                                         // the first pick was an edge
              if (nd) { st.b = [nd.x, nd.y]; st.a = foot(st.b, st.e1.a, st.e1.b); }
              else if (ed) { st.a = [(st.e1.a[0] + st.e1.b[0]) / 2, (st.e1.a[1] + st.e1.b[1]) / 2]; st.b = foot(st.a, ed.a, ed.b); }
              else { st.b = p; st.a = foot(st.b, st.e1.a, st.e1.b); }
            } else { st.b = nd ? [nd.x, nd.y] : ed ? foot(st.a, ed.a, ed.b) : p; if (ed && Math.hypot(st.b[0] - st.a[0], st.b[1] - st.a[1]) < 0.5) st.b = p; }   // the first point on that edge: the clicked point
            if (Math.hypot(st.b[0] - st.a[0], st.b[1] - st.a[1]) < 0.5) { say("the two picks are the same point - pick another"); st.b = null; return false; }
            st.ph = 2; st.hover = p; say(`${name}: now click where the dimension line goes (Shift = horizontal, Ctrl = vertical)`); E.drawOverlay(); return false;
          }
          make(id, st.a, st.b, p, e); return false;
        },
        move(e, fx, fy) { if (!st.edge) return; st.hover = [fx, fy]; st.mods = e; if (Math.hypot(fx - st.p0[0], fy - st.p0[1]) > 3 / (S.zoom || 1)) st.moved = true; E.drawOverlay(); },
        up(e) {
          if (!st.edge) return;
          const ed = st.edge; st.edge = null;
          if (st.moved) { make(id, ed.a, ed.b, st.hover, e || st.mods); return; }
          st.e1 = ed; st.ph = 1; say(`${name}: an edge - now click another node / edge (or the same edge's far side)`); E.drawOverlay();
        },
        hover(e, fx, fy) { if (prevHover) { try { prevHover.call(this, e, fx, fy); } catch (er) { /* fine */ } } const mk = E.dims.mark ? E.dims.mark() : null; st.hover = mk ? [mk.x, mk.y] : [fx, fy]; st.mods = e; E.drawOverlay(); },
        key(e) { if (e.key === "Escape" && (st.ph || st.edge)) { reset(); return true; } return false; },
        preview: () => null,
        leave() { reset(); },
        dblclick() { },
      });
    }
    /** the definition being drawn now (for the overlay) */
    function pending() {
      const tool = S.tool, m = st.hover; if (!m || (tool !== "cdimpar" && tool !== "cdimhv")) return null;
      if (st.edge && st.moved) return makeDef(kindFor(tool, st.edge.a, st.edge.b, m, st.mods), st.edge.a, st.edge.b, m, defOpts());
      if (st.ph === 2) return makeDef(kindFor(tool, st.a, st.b, m, st.mods), st.a, st.b, m, defOpts());
      return null;
    }

    /* ---- editing a picked group: the line, the extension lines, their nodes */
    const EDIT_TOOLS = new Set(["move", "shapetool", "directsel", "pathsel", "cdimpar", "cdimhv"]);
    const activeGroup = () => (S.w && EDIT_TOOLS.has(S.tool) ? groupOf(E.layer()) : null);
    function partAt(G, x, y) {
      const g = geom(G.dimg), tol = 6 / (S.zoom || 1);
      for (let i = 0; i < 2; i++) for (const w of ["s", "e"]) { const q = g.ext[i][w]; if (Math.hypot(q[0] - x, q[1] - y) <= tol) return { k: "node", i, w }; }
      for (let i = 0; i < 2; i++) if (nearestSeg([[g.ext[i].s, g.ext[i].e]], x, y, tol)) return { k: "ext", i };
      if (Math.hypot((g.d0[0] + g.d1[0]) / 2 - x, (g.d0[1] + g.d1[1]) / 2 - y) <= tol) return { k: "line", mid: true };
      if (nearestSeg([[g.d0, g.d1]], x, y, tol)) return { k: "line" };
      if (Math.hypot(g.label.x - x, g.label.y - y) <= Math.max(tol, (G.dimg.size || 14) * 0.8)) return { k: "line" };
      return null;
    }
    let drag = null;
    stage.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || S.space) return;
      const G = activeGroup(); if (!G || G.visible === false) return;
      const p = E.pos(e), h = partAt(G, p[0], p[1]); if (!h) return;
      if (S.tool === "move" && h.k === "line" && !h.mid) return;   // the Move tool: the line / number moves the whole group (its middle dot moves the line)
      e.preventDefault(); e.stopImmediatePropagation();
      drag = { G, h, p0: p, def0: clone(G.dimg), before: E.snapStruct() };
      try { stage.setPointerCapture(e.pointerId); } catch (er) { /* fine */ }
    }, true);
    stage.addEventListener("pointermove", (e) => {
      if (!drag) return; e.stopImmediatePropagation();
      let p = E.pos(e);
      const { G, h, def0, p0 } = drag, sh = e.shiftKey, ct = e.ctrlKey || e.metaKey;
      if (h.k === "line") G.dimg = moveLine(def0, p, sh, ct);
      else if (h.k === "ext") {                              // its measured point slides along; on a CAD point (not Alt) it lines up with it
        const r = !e.altKey ? E.dims.cadSnap(p[0], p[1], null) : null;
        G.dimg = r ? moveExt(def0, h.i, def0[h.i ? "b" : "a"], [r.x, r.y], sh, ct) : moveExt(def0, h.i, p0, p, sh, ct);
      }
      else G.dimg = extNode(def0, h.i, h.w, p);
      rebuild(G); E.refresh();
      say(`${G.name}: ${textFor(G.dimg.len)}${G.dimg.kind !== def0.kind ? " · " + G.dimg.kind : ""}`);
    }, true);
    const end = (e) => {
      if (!drag) return; if (e) e.stopImmediatePropagation();
      const d = drag; drag = null;
      if (JSON.stringify(d.def0) === JSON.stringify(d.G.dimg)) return;
      seenAdd = true;
      E.push({ t: "struct", before: d.before, after: E.snapStruct(), label: d.h.k === "line" ? "move dimension line" : d.h.k === "ext" ? "dimension length" : "extension line" });
      E.refresh(); E.renderLayersPanel();
      if (E.propbar) E.propbar.render();
    };
    stage.addEventListener("pointerup", end, true); stage.addEventListener("pointercancel", end, true);
    let seenAdd = false;
    // a part clicked on the canvas picks its GROUP (so the Move tool moves the whole dimension)
    const prevHit = E.hitLayer;
    E.hitLayer = function (L, x, y) {
      const G = groupOf(L);
      if (G && !isGroup(L)) {
        const r = prevHit ? prevHit(L, x, y) : null; if (r === false) return false;
        const a = ctx(L.canvas).getImageData(Math.max(0, Math.min(S.w - 1, Math.round(x))), Math.max(0, Math.min(S.h - 1, Math.round(y))), 1, 1).data[3];
        return a > 8 ? G : false;
      }
      return prevHit ? prevHit(L, x, y) : null;
    };

    /* ---- the overlay: what is being drawn; the picked group's nodes */
    const drawDef = (g, def, px, dashed) => {
      const G2 = geom(def);
      g.save(); g.strokeStyle = "#2680eb"; g.fillStyle = "#2680eb"; g.lineWidth = 1.2 * px; if (dashed) g.setLineDash([4 * px, 3 * px]);
      g.beginPath(); for (const x of G2.ext) { g.moveTo(x.s[0], x.s[1]); g.lineTo(x.e[0], x.e[1]); } g.moveTo(G2.d0[0], G2.d0[1]); g.lineTo(G2.d1[0], G2.d1[1]); g.stroke();
      g.setLineDash([]); g.font = `${12 * px}px sans-serif`; g.fillText(textFor(G2.len), G2.label.x + 4 * px, G2.label.y - 4 * px);
      g.restore();
      return G2;
    };
    E.overlayHooks.push((g, px) => {
      if (!S.w) return;
      const pd = pending(); if (pd) drawDef(g, pd, px, true);
      if ((S.tool === "cdimpar" || S.tool === "cdimhv") && !pd) {
        g.save(); g.fillStyle = "#ff3cac"; const s = 3.5 * px;
        if (st.a && st.ph >= 1) { g.beginPath(); g.arc(st.a[0], st.a[1], s, 0, Math.PI * 2); g.fill(); }
        if (st.e1) { g.strokeStyle = "#ff3cac"; g.lineWidth = 2.5 * px; g.beginPath(); g.moveTo(st.e1.a[0], st.e1.a[1]); g.lineTo(st.e1.b[0], st.e1.b[1]); g.stroke(); }
        if (st.edge) { g.strokeStyle = "#ff3cac"; g.lineWidth = 2.5 * px; g.beginPath(); g.moveTo(st.edge.a[0], st.edge.a[1]); g.lineTo(st.edge.b[0], st.edge.b[1]); g.stroke(); }
        g.restore();
      }
      const G = activeGroup(); if (!G || G.visible === false) return;
      const G2 = geom(G.dimg);
      g.save(); g.lineWidth = px; g.strokeStyle = "#ff8a00"; g.fillStyle = "#fff";
      for (const x of G2.ext) for (const q of [x.s, x.e]) { const s = 3.5 * px; g.fillRect(q[0] - s, q[1] - s, 2 * s, 2 * s); g.strokeRect(q[0] - s, q[1] - s, 2 * s, 2 * s); }
      const mx = (G2.d0[0] + G2.d1[0]) / 2, my = (G2.d0[1] + G2.d1[1]) / 2; g.beginPath(); g.arc(mx, my, 4 * px, 0, Math.PI * 2); g.fill(); g.stroke();
      g.restore();
    });

    /* ---- the group moved / scaled / turned as a whole (or a part edited with the node tools): the definition follows */
    const seen = new WeakSet();
    const endsOf = (L) => { const s = L && L.shape && L.shape.path && L.shape.path.subs && L.shape.path.subs[0]; if (!s || !s.pts || s.pts.length < 2) return null; const a = s.pts[0], b = s.pts[s.pts.length - 1]; return [[a.x, a.y], [b.x, b.y]]; };
    const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.05;
    function follow() {
      if (!S.w || !S.undo || !S.undo.length || (S.redo && S.redo.length)) return;
      const top = S.undo[S.undo.length - 1]; if (seen.has(top)) return; seen.add(top);
      if (seenAdd) { seenAdd = false; return; }
      const before = E.snapStruct(); let changed = 0;
      for (const G of S.layers.filter(isGroup)) {
        const g = geom(G.dimg), Ln = endsOf(partOf(G, "line")), E1 = endsOf(partOf(G, "ext1")), E2 = endsOf(partOf(G, "ext2"));
        if (!Ln || !E1 || !E2) continue;
        const lineSame = near(Ln[0], g.d0) && near(Ln[1], g.d1), e1Same = near(E1[0], g.ext[0].s) && near(E1[1], g.ext[0].e), e2Same = near(E2[0], g.ext[1].s) && near(E2[1], g.ext[1].e);
        if (lineSame && e1Same && e2Same) continue;
        if (lineSame) {                                       // an extension line's nodes edited on their own
          [[E1, 0, e1Same], [E2, 1, e2Same]].forEach(([en, i, same]) => { if (same) return; const x = g.ext[i]; G.dimg.ext[i].gap = r3(Math.max(0, dot(sub(en[0], x.p), x.dir))); G.dimg.ext[i].over = r3(dot(sub(en[1], x.d), x.dir)); });
        } else {
          const M = fit3([g.d0, g.d1, g.ext[0].s], [Ln[0], Ln[1], E1[0]]);
          if (!M) continue;
          G.dimg = mapDef(G.dimg, M);
        }
        rebuild(G); changed++;
      }
      if (!changed) return;
      const merged = { t: "multi", list: [top, { t: "struct", before, after: E.snapStruct() }], label: top.label || "dimension" };
      seen.add(merged); S.undo[S.undo.length - 1] = merged;
      E.renderSoon ? E.renderSoon() : E.refresh();
    }
    const prevHistory = E.ui.history;
    E.ui.history = function () { const r = prevHistory ? prevHistory.apply(this, arguments) : undefined; try { follow(); } catch (er) { /* never stop an edit */ } return r; };

    /** the picture's scale changed: every group measured again */
    function remeasure() { const Gs = S.layers.filter(isGroup); for (const G of Gs) rebuild(G); return Gs.length; }
    E.dimGroups = { create, createMany, defOpts, textFor, rebuild, remeasure, isGroup, groupOf, partOf, geom, edgeAt, nodeAt, state: () => Object.assign({}, st), lengthOf: (L) => { const G = groupOf(L); return G ? geom(G.dimg).len : null; } };
  }

  const PCDimGroup = { EXT0, makeDef, autoKind, constrain, geom, moveLine, moveExt, extNode, segmentsOf, nearestSeg, foot, fit3, mapDef, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCDimGroup;
  else root.PCDimGroup = PCDimGroup;
})(typeof window !== "undefined" ? window : globalThis);
