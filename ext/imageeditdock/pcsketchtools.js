/* pcsketchtools.js — SKETCH LAYERS in the editor: the sketch tools, the 📐 Sketch tab, the edit marks (2.462.0),
 * window.PCSketchTools. The model + the solver are pcsketch.js.
 *
 * Tim (verbatim): "continue with the photoshop gap closure. add cad tools, create sketch layers for cad in image editor"
 * - a sketch layer "something like fusion 360 sketch".
 *
 *   Layer ▸ New Sketch (or any sketch tool on a picture) makes a SKETCH LAYER: a fixed origin point + two construction
 *   axes at the picture's middle, then the N tools (N again = the next one; with a sketch tool picked the letters below):
 *     Sketch Select (S)   click = pick (Shift = add); drag a point / a line / a circle's edge - everything follows the
 *                         constraints live; drag a dimension's number to move it, double-click it to type a value;
 *                         Delete = the picked entities / constraints / dimensions
 *     Line (L)            click - click - … (a chain; Esc / double-click / the first point = done); nearly level /
 *                         upright = Horizontal / Vertical by itself; on a point = joined (coincident), on a line or a
 *                         circle = kept on it
 *     2-Point Rectangle (R) · Center Rectangle · Circle (C, centre + edge) · 3-Point Arc (A: start, end, a point on it)
 *     Point (P) · Sketch Dimension (D): a line = its length, two points = their distance (placed above / below =
 *                         horizontal, beside = vertical), a point + a line, two lines = their angle (parallel ones =
 *                         their distance), a circle = its diameter, an arc = its radius - then click where it goes and
 *                         type the value (Enter)
 *     X                   picked entities <-> construction (dashed, not drawn in the picture)
 *   The 📐 Sketch tab (Properties group): how many degrees of freedom are left (✓ fully constrained), the constraints
 *   for what is picked (Coincident, Collinear, Concentric, Midpoint, Fix, Parallel, Perpendicular, Horizontal,
 *   Vertical, Tangent, Equal, Symmetric), Construction, Delete, the picture's line colour / width / fill of the closed
 *   profiles / dimensions shown, Profiles → Shapes (each closed region a shape layer), Finish Sketch.
 *   Blue = still free, black = fully constrained, orange dashed = construction, red point = the origin. Each change is
 *   one undo step; the sketch keeps its constraints in the .bgi.
 */
(function (root) {
  "use strict";
  const K = () => root.PCSketch;
  const TOOLS = [["sk_select", "Sketch Select Tool"], ["sk_line", "Line Tool (sketch)"], ["sk_rect", "2-Point Rectangle Tool (sketch)"], ["sk_rectc", "Center Rectangle Tool (sketch)"],
    ["sk_circle", "Circle Tool (sketch)"], ["sk_arc", "3-Point Arc Tool (sketch)"], ["sk_point", "Point Tool (sketch)"], ["sk_dim", "Sketch Dimension Tool"],
    // 2.463.0: modify + more shapes
    ["sk_trim", "Trim Tool (sketch)"], ["sk_extend", "Extend Tool (sketch)"], ["sk_fillet", "Fillet Tool (sketch)"], ["sk_chamfer", "Chamfer Tool (sketch)"], ["sk_poly", "Polygon Tool (sketch)"],
    ["sk_slot", "Slot Tool (sketch)"], ["sk_circle2", "2-Point Circle Tool (sketch)"], ["sk_circle3", "3-Point Circle Tool (sketch)"], ["sk_spline", "Spline Tool (sketch)"],
    // 2.464.0: measure (pcsketchcadui.js)
    ["sk_measure", "Measure Tool (sketch)"],
    // 2.494.0: Offset as a tool (pick a chain, the pointer's side + distance, click - or type the distance)
    ["sk_offset", "Offset Tool (sketch)"]];
  const LETTERS = { s: "sk_select", l: "sk_line", r: "sk_rect", c: "sk_circle", a: "sk_arc", p: "sk_point", d: "sk_dim", t: "sk_trim", e: "sk_extend", f: "sk_fillet", m: "sk_measure", o: "sk_offset" };
  /** the constraint a button makes from the picked items: [{k: "pt" | "ent", id, t}] -> {t, a, b, c} | {err} */
  function conFor(type, sel, s) {
    const P = sel.filter((x) => x.k === "pt").map((x) => x.id), E = sel.filter((x) => x.k === "ent").map((x) => K().ent(s, x.id)).filter(Boolean);
    const lines = E.filter((e) => e.t === "line"), rounds = E.filter((e) => e.t === "circle" || e.t === "arc"), pointEnts = E.filter((e) => e.t === "point").map((e) => e.p1);
    const pts = P.concat(pointEnts);
    const need = (m) => ({ err: m });
    switch (type) {
      case "coincident":
        if (pts.length === 2) return { t: "coincident", a: pts[0], b: pts[1] };
        if (pts.length === 1 && lines.length === 1) return { t: "onLine", a: pts[0], b: lines[0].id };
        if (pts.length === 1 && rounds.length === 1) return { t: "onCircle", a: pts[0], b: rounds[0].id };
        return need("pick two points - or a point and a line / circle");
      case "horizontal": case "vertical":
        if (lines.length === 1 && !pts.length) return { t: type, a: lines[0].id };
        if (pts.length === 2) return { t: type, a: pts[0], b: pts[1] };
        return need("pick a line - or two points");
      case "parallel": case "perpendicular": case "collinear":
        if (lines.length === 2) return { t: type, a: lines[0].id, b: lines[1].id };
        return need("pick two lines");
      case "equal":
        if (lines.length === 2) return { t: "equal", a: lines[0].id, b: lines[1].id };
        if (rounds.length === 2) return { t: "equal", a: rounds[0].id, b: rounds[1].id };
        return need("pick two lines - or two circles / arcs");
      case "tangent":
        if (lines.length === 1 && rounds.length === 1) return { t: "tangent", a: lines[0].id, b: rounds[0].id };
        if (rounds.length === 2) return { t: "tangent", a: rounds[0].id, b: rounds[1].id };
        return need("pick a line and a circle / arc - or two circles / arcs");
      case "midpoint":
        if (pts.length === 1 && lines.length === 1) return { t: "midpoint", a: pts[0], b: lines[0].id };
        return need("pick a point and a line");
      case "concentric":
        if (rounds.length === 2) return { t: "concentric", a: rounds[0].id, b: rounds[1].id };
        return need("pick two circles / arcs");
      case "fix":
        if (pts.length >= 1) return { t: "fix", a: pts[0], multi: pts };
        if (E.length) return { t: "fix", a: null, multi: [].concat(...E.map((e) => K().ptsOf(e))) };
        return need("pick points or entities to fix");
      case "symmetric":
        if (pts.length === 2 && lines.length === 1) return { t: "symmetric", a: pts[0], b: pts[1], c: lines[0].id };
        if (lines.length === 3) return { t: "symmetric", a: lines[0].p1, b: lines[1].p1, c: lines[2].id, also: { a: lines[0].p2, b: lines[1].p2 } };
        return need("pick two points and the line they mirror about (the line last)");
    }
    return need("not a constraint");
  }
  /** the dimension the picked items make (the Dimension tool), placed at (x, y): {t, refs} | null */
  function dimFor(sel, s, x, y) {
    const S = K(), P = (id) => S.pt(s, id);
    const pts = sel.filter((q) => q.k === "pt").map((q) => q.id).concat(sel.filter((q) => q.k === "ent" && S.ent(s, q.id) && S.ent(s, q.id).t === "point").map((q) => S.ent(s, q.id).p1));
    const E = sel.filter((q) => q.k === "ent").map((q) => S.ent(s, q.id)).filter((e) => e && e.t !== "point");
    if (pts.length === 2 && !E.length) {
      const a = P(pts[0]), b = P(pts[1]), inX = x > Math.min(a.x, b.x) && x < Math.max(a.x, b.x), inY = y > Math.min(a.y, b.y) && y < Math.max(a.y, b.y);
      if (inX && !inY) return { t: "hdist", refs: pts };
      if (inY && !inX) return { t: "vdist", refs: pts };
      return { t: "dist", refs: pts };
    }
    if (pts.length === 1 && E.length === 1 && E[0].t === "line") return { t: "ptline", refs: [pts[0], E[0].id] };
    if (!pts.length && E.length === 1) {
      const e = E[0];
      if (e.t === "line") {
        const a = P(e.p1), b = P(e.p2), inX = x > Math.min(a.x, b.x) && x < Math.max(a.x, b.x), inY = y > Math.min(a.y, b.y) && y < Math.max(a.y, b.y);
        if (Math.abs(a.y - b.y) > 1 && Math.abs(a.x - b.x) > 1) { if (inX && !inY) return { t: "hdist", refs: [e.p1, e.p2] }; if (inY && !inX) return { t: "vdist", refs: [e.p1, e.p2] }; }
        return { t: "len", refs: [e.id] };
      }
      if (e.t === "circle") return { t: "diameter", refs: [e.id] };
      if (e.t === "arc") return { t: "radius", refs: [e.id] };
    }
    if (!pts.length && E.length === 2 && E[0].t === "line" && E[1].t === "line") {
      const a = E[0], b = E[1], u = [P(a.p2).x - P(a.p1).x, P(a.p2).y - P(a.p1).y], w = [P(b.p2).x - P(b.p1).x, P(b.p2).y - P(b.p1).y];
      const cr = (u[0] * w[1] - u[1] * w[0]) / ((Math.hypot(...u) * Math.hypot(...w)) || 1);
      if (Math.abs(cr) < 1e-3) return { t: "ptline", refs: [b.p1, a.id] };
      return { t: "angle", refs: [a.id, b.id] };
    }
    return null;
  }
  /** a point snapped while drawing: an existing point, else on an entity, else level / upright with `from` */
  function snapFor(s, x, y, tol, from, skip) {
    const S = K(), hit = S.pick(s, x, y, tol, { skip });
    if (hit && hit.k === "pt") { const p = S.pt(s, hit.id); return { x: p.x, y: p.y, pt: hit.id, what: "point" }; }
    let r = { x, y };
    if (hit && hit.k === "ent") {
      const e = S.ent(s, hit.id);
      if (e.t === "line") { const a = S.pt(s, e.p1), b = S.pt(s, e.p2), u = [b.x - a.x, b.y - a.y], L2 = u[0] * u[0] + u[1] * u[1] || 1, t = ((x - a.x) * u[0] + (y - a.y) * u[1]) / L2; r = { x: a.x + t * u[0], y: a.y + t * u[1], on: e.id, what: "on line" }; }
      else if (e.t === "circle" || e.t === "arc") { const c = S.pt(s, e.c), rr = e.t === "circle" ? e.r : Math.hypot(S.pt(s, e.p1).x - c.x, S.pt(s, e.p1).y - c.y), a = Math.atan2(y - c.y, x - c.x); r = { x: c.x + rr * Math.cos(a), y: c.y + rr * Math.sin(a), on: e.id, what: "on circle" }; }
    }
    if (from) {
      const dx = x - from.x, dy = y - from.y, ang = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
      const hv = Math.min(ang, 180 - ang) < 3 ? "horizontal" : Math.abs(ang - 90) < 3 ? "vertical" : null;
      if (hv && !r.on) { if (hv === "horizontal") r.y = from.y; else r.x = from.x; r.hv = hv; r.what = hv; }
      else if (hv && r.on) {
        // on a line AND level / upright with the last point: where the two meet (when that is near the pointer)
        const e = S.ent(s, r.on);
        if (e && e.t === "line") {
          const a = S.pt(s, e.p1), b = S.pt(s, e.p2), j = hv === "horizontal" ? 1 : 0, k = 1 - j, v = hv === "horizontal" ? from.y : from.x;
          if (Math.abs(b[["x", "y"][j]] - a[["x", "y"][j]]) > 1e-9) {
            const t = (v - a[["x", "y"][j]]) / (b[["x", "y"][j]] - a[["x", "y"][j]]), q = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
            if (Math.hypot(q.x - x, q.y - y) <= tol) { r.x = q.x; r.y = q.y; r.hv = hv; r.what = r.what + " + " + hv; }
            void k;
          } else if (Math.abs((hv === "horizontal" ? a.y : a.x) - v) < 1e-6) { r.hv = hv; }   // the line itself is level / upright through the last point
        }
      }
    }
    return r;
  }

  /* ================================ the editor ================================ */
  function install(E) {
    const S = E.S, D = E.D, doc = E.doc || root.document, say = E.say, kx = E.kx, stage = E.stage, store = E.store;
    if (!E.ui || !E.tools || !kx || !K()) return;
    const $ = (id) => doc.getElementById(id);
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const isSk = (L) => !!(L && L.type === "sketch" && L.sketch);
    const cur = () => { const L = S.w ? E.layer() : null; return isSk(L) ? L : null; };
    const tol = () => 8 / (S.zoom || 1);
    let sel = [];                 // [{k: "pt" | "ent" | "con" | "dim", id}]
    let dofCache = { key: "", v: null };
    const keyOf = (s) => JSON.stringify([s.pts, s.ents.map((e) => [e.id, e.r, e.cons]), s.cons, s.dims.map((d) => [d.id, d.v, d.driven])]);
    function dofOf(s) { const k = keyOf(s); if (dofCache.key !== k) { try { dofCache = { key: k, v: K().dof(s) }; } catch (e) { dofCache = { key: k, v: null }; } } return dofCache.v; }
    /** one undo step around f(sketch) */
    function edit(L, label, f) {
      const before = E.snapStruct(), keep = JSON.parse(JSON.stringify(L.sketch));
      const r = f(L.sketch);
      if (r === false) { for (const k of Object.keys(L.sketch)) delete L.sketch[k]; Object.assign(L.sketch, keep); D.rasterize(L); E.drawOverlay(); return r; }   // 2.494.0: refused = the sketch as it was
      K().measure(L.sketch); D.rasterize(L);
      E.push({ t: "struct", before, after: E.snapStruct(), label: label || "sketch" });
      E.refresh(); E.renderLayersPanel(); paint(); E.drawOverlay();
      return r;
    }
    /* ---- a new sketch layer */
    function newSketch(name) {
      if (!S.w) E.openDoc(1600, 1000, "sketch.png", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, g.canvas.width, g.canvas.height); });
      let L = null;
      E.structOp("new sketch", () => {
        L = E.makeLayer(name || "Sketch " + (S.layers.filter(isSk).length + 1), S.w, S.h, "sketch");
        L.sketch = K().create(Math.round(S.w / 2), Math.round(S.h / 2));
        const A = E.layer(); S.layers = D.insert(S.layers, L, A ? A.id : null, false); S.active = S.layers.indexOf(L);
        D.rasterize(L);
      });
      sel = []; if (!TOOLS.some(([t]) => t === S.tool)) E.setTool("sk_line");
      if (E.ui.showTab) E.ui.showTab("ksk");
      say(`${L.name}: draw with the sketch tools (N) - L line, R rectangle, C circle, A arc, D dimension; the 📐 Sketch tab has the constraints`);
      return L;
    }
    const ensure = () => cur() || newSketch();

    /* ---- drawing state */
    const st = { pts: [], hover: null, snap: null, chainStart: null, lastSn: null, dimPick: [] };
    const reset = () => { st.pts = []; st.chainStart = null; st.lastSn = null; st.snap = null; st.dimPick = []; st.off = null; st.offHover = null; st.offAt = null; hideHud(); E.drawOverlay(); };
    /** a new point (or the snapped one) + what joins it: -> point id */
    function placePoint(s, sn, extra) {
      if (sn.pt) return sn.pt;
      const id = K().addPoint(s, sn.x, sn.y);
      if (sn.on) { const e = K().ent(s, sn.on); (extra || []).push({ t: e.t === "line" ? "onLine" : "onCircle", a: id, b: sn.on }); }
      return id;
    }
    function applyCons(s, list) { for (const c of list) K().tryAdd(s, c, "con"); }
    const snapNow = (s, x, y, from, skip) => snapFor(s, x, y, tol(), from, skip);
    /* ---- the tools */
    const base = (id, name, extra) => Object.assign({
      id, name, cursor: "crosshair",
      options: () => `<span class="hint">${esc(HINTS[id] || "")}</span><span class="sep"></span><label title="Show the constraint marks while sketching"><input type="checkbox" id="skShowCons"${store.get("sk.cons", true) ? " checked" : ""}> constraints</label>`,
      bindOptions(o) { const c = o.querySelector("#skShowCons"); if (c) c.onchange = () => { store.set("sk.cons", c.checked); E.drawOverlay(); }; },
      key(e) { return keyFor(e); },
      leave() { reset(); hideInput(); hideHud(); },
    }, extra);
    const HINTS = {
      sk_select: "click = pick (Shift = add) · drag points / lines / circles - the constraints hold · drag a dimension's number; double-click it = a new value · Delete",
      sk_line: "click points (a chain) · type a length (Tab = the angle) + Enter · Esc / double-click / the first point = done · level / upright snaps",
      sk_rect: "two corners - after the first, type the width (Tab = the height)", sk_rectc: "the centre, then a corner - or type the width / height", sk_circle: "the centre, then the edge - or type the diameter", sk_arc: "the start, the end, then a point on the arc",
      sk_point: "click", sk_measure: "click a point / line / circle (a second one = between them) - or inside a closed region = its area + perimeter", sk_trim: "click the piece to cut away (between the places it is crossed)", sk_extend: "click a line near the end to run on to the next line / circle",
      sk_fillet: "two lines (or their corner point) - a tangent arc, then type its radius", sk_chamfer: "two lines (or their corner point) - a straight cut", sk_poly: "the centre, then a corner",
      sk_slot: "one centre, the other, then the width", sk_circle2: "the two ends of a diameter", sk_circle3: "three points on it", sk_spline: "click the points it passes through · Enter / double-click = done",
      sk_offset: "click a line / arc / circle (its joined chain comes too; Shift = add more) · move to the side · click = there (or type the distance + Enter; F = the other side) · Esc",
      sk_dim: "a line / two points / a point + a line / two lines / a circle / an arc - then click where the number goes and type the value",
    };
    function keyFor(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      const k = (e.key || "").toLowerCase();
      if (S.tool === "sk_offset" && st.off) {
        if (k === "escape") { st.off = null; st.offAt = null; E.drawOverlay(); say("Offset: pick a line / arc / circle (its whole chain comes too)"); return true; }
        if (k === "enter") { offsetApply(+store.get("sk.off", 10) || 10); return true; }
        if (/^[0-9.]$/.test(e.key || "")) { const inp = doc.getElementById("skOffT"); if (inp) { if (e.preventDefault) e.preventDefault(); inp.value = e.key; inp.focus(); return true; } }
        if (k === "f") { st.offFlip = !st.offFlip; E.drawOverlay(); return true; }
      }
      if (k === "escape") { if (st.pts.length || st.lastSn || (st.dimPick && st.dimPick.length)) { reset(); st.from = null; return true; } if (sel.length) { sel = []; paint(); E.drawOverlay(); return true; } if (S.tool !== "sk_select") { E.setTool("sk_select"); return true; } return false; }
      if (!hud && drawingNow() && (/^[0-9.]$/.test(e.key || "") || e.key === "Tab")) { if (e.preventDefault) e.preventDefault(); return openHud(e.key === "Tab" ? "" : e.key); }
      if ((k === "delete" || k === "backspace") && sel.length && cur()) { delSel(); return true; }
      if (k === "x" && sel.length && cur()) { toggleCons(); return true; }
      if (LETTERS[k] && cur() && !e.shiftKey) { E.setTool(LETTERS[k]); return true; }
      return false;
    }
    function finishChain() { st.chainStart = null; st.lastSn = null; st.pts = []; E.drawOverlay(); }
    /** the chain's next line to sn (post(sk, lineId) adds what typed values ask for) */
    function addLineTo(L, sn, post) {
      let closed = false;
      edit(L, "sketch line", (sk) => {
        const extra = [], p1 = st.lastSn.pt || placePoint(sk, st.lastSn, extra), p2 = placePoint(sk, sn, extra);
        if (!st.chainStart) st.chainStart = p1;
        const id = K().line(sk, p1, p2);
        if (sn.hv) extra.push({ t: sn.hv, a: id });
        applyCons(sk, extra);
        if (post) post(sk, id);
        closed = p2 === st.chainStart;
        st.lastSn = { x: K().pt(sk, p2).x, y: K().pt(sk, p2).y, pt: p2 };
      });
      if (closed) finishChain();
    }
    E.tools.sk_line = base("sk_line", "Line", {
      down(e, fx, fy) {
        if (hud) { commitTyped(); return false; }
        const L = ensure(), s = L.sketch;
        const from = st.lastSn ? (st.lastSn.pt ? K().pt(s, st.lastSn.pt) : st.lastSn) : null;
        const sn = snapNow(s, fx, fy, from, []);
        if (!st.lastSn) { st.lastSn = sn; E.drawOverlay(); return false; }                 // the chain's first point
        if (Math.hypot(sn.x - from.x, sn.y - from.y) < 1 / (S.zoom || 1)) { finishChain(); return false; }   // the same point again = done
        addLineTo(L, sn);
        return false;
      },
      hover(e, fx, fy) { const L = cur(); st.hover = [fx, fy]; st.snap = L ? snapNow(L.sketch, fx, fy, st.lastSn ? (st.lastSn.pt ? K().pt(L.sketch, st.lastSn.pt) : st.lastSn) : null, []) : null; E.drawOverlay(); },
      dblclick() { finishChain(); },
    });
    const NEXT = { sk_rect: "now the opposite corner", sk_rectc: "now a corner", sk_circle: "now a point on the edge", sk_poly: "now a corner", sk_circle2: "now the other end of the diameter" };
    const twoClick = (id, name, label, make) => base(id, name, {
      down(e, fx, fy) {
        if (hud) { commitTyped(); return false; }
        const L = ensure(), s = L.sketch, sn = snapNow(s, fx, fy, null, []);
        if (!st.pts.length) { st.pts.push(sn); st.from = [fx, fy]; say(`${name}: ${NEXT[id]} (click, or drag there)`); E.drawOverlay(); return undefined; }   // a drag works too
        finish2(L, sn); return false;
      },
      move(e, fx, fy) { const L = cur(); st.hover = [fx, fy]; st.snap = L ? snapNow(L.sketch, fx, fy, null, []) : null; E.drawOverlay(); },
      up(e, fx, fy) {
        const L = cur(); if (!L || !st.pts.length || !st.from) return;
        const moved = Math.hypot(fx - st.from[0], fy - st.from[1]) > 3 / (S.zoom || 1); st.from = null;
        if (moved) finish2(L, snapNow(L.sketch, fx, fy, null, []));
      },
      hover(e, fx, fy) { const L = cur(); st.hover = [fx, fy]; st.snap = L ? snapNow(L.sketch, fx, fy, null, []) : null; E.drawOverlay(); },
    });
    function finish2(L, sn) {
      const id = S.tool, a = st.pts[0]; st.pts = []; st.from = null;
      if (!a || Math.hypot(sn.x - a.x, sn.y - a.y) < 2) { E.drawOverlay(); return; }
      edit(L, LABEL2[id], (sk) => MAKE2[id](sk, a, sn));
    }
    const joinCorner = (sk, pid, sn) => { if (sn.pt) K().tryAdd(sk, { t: "coincident", a: pid, b: sn.pt }, "con"); else if (sn.on) K().tryAdd(sk, { t: K().ent(sk, sn.on).t === "line" ? "onLine" : "onCircle", a: pid, b: sn.on }, "con"); };
    const LABEL2 = { sk_rect: "sketch rectangle", sk_rectc: "sketch rectangle", sk_circle: "sketch circle", sk_poly: "sketch polygon", sk_circle2: "sketch circle" };
    const MAKE2 = {
      sk_poly: (sk, a, b) => { const r = K().polygon(sk, a.pt || [a.x, a.y], [b.x, b.y], +store.get("sk.sides", 6) || 6); if (!r.ok) return false; return r; },
      sk_circle2: (sk, a, b) => K().circle2(sk, [a.x, a.y], [b.x, b.y]),
      sk_rect: (sk, a, b) => { const r = K().rect2(sk, [a.x, a.y], [b.x, b.y]); joinCorner(sk, r.pts[0], a); joinCorner(sk, r.pts[2], b); return r; },
      sk_rectc: (sk, a, b) => { const r = K().rectC(sk, [a.x, a.y], [b.x, b.y]); joinCorner(sk, r.centre, a); joinCorner(sk, r.pts[2], b); return r; },
      sk_circle: (sk, a, b) => {
        const extra = [], c = placePoint(sk, a, extra), id = K().circle(sk, c, Math.hypot(b.x - a.x, b.y - a.y));
        if (b.pt) extra.push({ t: "onCircle", a: b.pt, b: id });
        applyCons(sk, extra);
        return id;
      },
    };
    E.tools.sk_rect = twoClick("sk_rect", "2-Point Rectangle", "sketch rectangle");
    E.tools.sk_rectc = twoClick("sk_rectc", "Center Rectangle", "sketch rectangle");
    E.tools.sk_circle = twoClick("sk_circle", "Circle", "sketch circle");
    E.tools.sk_poly = twoClick("sk_poly", "Polygon", "sketch polygon");
    E.tools.sk_circle2 = twoClick("sk_circle2", "2-Point Circle", "sketch circle");
    const prevPolyOpts = E.tools.sk_poly.options, prevPolyBind = E.tools.sk_poly.bindOptions;
    E.tools.sk_poly.options = () => prevPolyOpts() + `<label title="How many sides">Sides <input type="number" id="skSides" min="3" max="64" value="${+store.get("sk.sides", 6) || 6}" style="width:48px"></label>`;
    E.tools.sk_poly.bindOptions = (o) => { prevPolyBind(o); const i = o.querySelector("#skSides"); if (i) { i.onchange = () => store.set("sk.sides", Math.max(3, Math.min(64, +i.value || 6))); i.addEventListener("keydown", (ev) => ev.stopPropagation()); } };
    /* ---- 2.463.0: three clicks (3-point circle, slot), a spline, trim, extend, fillet, chamfer */
    const threeClick = (id, name, steps, make) => base(id, name, {
      down(e, fx, fy) {
        const L = ensure(), sn = snapNow(L.sketch, fx, fy, null, []);
        st.pts.push(sn);
        if (st.pts.length < 3) { say(`${name}: ${steps[st.pts.length - 1]}`); E.drawOverlay(); return false; }
        const P = st.pts.slice(); st.pts = [];
        edit(L, "sketch " + name.toLowerCase(), (sk) => make(sk, P));
        return false;
      },
      hover(e, fx, fy) { const L = cur(); st.hover = [fx, fy]; st.snap = L ? snapNow(L.sketch, fx, fy, null, []) : null; E.drawOverlay(); },
    });
    E.tools.sk_circle3 = threeClick("sk_circle3", "3-Point Circle", ["now the second point", "now the third point"], (sk, P) => { if (!K().circle3p(sk, [P[0].x, P[0].y], [P[1].x, P[1].y], [P[2].x, P[2].y])) { say("the three points are in a line - no circle"); return false; } });
    E.tools.sk_slot = threeClick("sk_slot", "Slot", ["now the other centre", "now the width (how far from the centre line)"], (sk, P) => {
      const a = P[0], b = P[1], c = P[2], u = [b.x - a.x, b.y - a.y], L2 = Math.hypot(...u) || 1, w = 2 * Math.abs((u[0] * (c.y - a.y) - u[1] * (c.x - a.x)) / L2);
      if (!K().slot(sk, [a.x, a.y], [b.x, b.y], Math.max(2, w)).ok) return false;
    });
    E.tools.sk_spline = base("sk_spline", "Spline", {
      down(e, fx, fy) {
        const L = ensure(), sn = snapNow(L.sketch, fx, fy, null, []);
        const last = st.pts[st.pts.length - 1];
        if (last && Math.hypot(sn.x - last.x, sn.y - last.y) < 1 / (S.zoom || 1)) { endSpline(); return false; }   // the same point again (a double-click) = done
        st.pts.push(sn); say(`Spline: ${st.pts.length} point(s) - Enter / double-click = done`); E.drawOverlay(); return false;
      },
      hover(e, fx, fy) { const L = cur(); st.hover = [fx, fy]; st.snap = L ? snapNow(L.sketch, fx, fy, null, []) : null; E.drawOverlay(); },
      dblclick() { endSpline(); },
      key(e) { if ((e.key || "") === "Enter") { endSpline(); return true; } return keyFor(e); },
    });
    function endSpline() {
      const L = cur(), P = st.pts.slice(); st.pts = [];
      if (!L || P.length < 2) { E.drawOverlay(); return; }
      edit(L, "sketch spline", (sk) => { const extra = [], ids = P.map((q) => placePoint(sk, q, extra)); K().spline(sk, ids); applyCons(sk, extra); });
    }
    const pickEnt = (L, fx, fy, types) => { const h = K().pick(L.sketch, fx, fy, tol(), { axes: false, entsOnly: true }); const e = h && K().ent(L.sketch, h.id); return e && (!types || types.includes(e.t)) ? e : null; };
    E.tools.sk_trim = base("sk_trim", "Trim", {
      down(e, fx, fy) {
        const L = cur(); if (!L) { say("Trim: pick a sketch layer first"); return false; }
        const en = pickEnt(L, fx, fy); if (!en) { say("Trim: click the piece of a line / circle / arc to cut away"); return false; }
        let r = null; edit(L, "sketch trim", (sk) => { r = K().trim(sk, en.id, fx, fy); if (!r.ok) return false; });
        if (r && !r.ok) say("Trim: " + r.why);
        return false;
      },
      hover(e, fx, fy) { st.hover = [fx, fy]; const L = cur(); st.trimHover = null; if (L) { const en = pickEnt(L, fx, fy, ["line", "arc", "circle"]); if (en) st.trimHover = { id: en.id, x: fx, y: fy }; } E.drawOverlay(); },
    });
    E.tools.sk_extend = base("sk_extend", "Extend", {
      down(e, fx, fy) {
        const L = cur(); if (!L) { say("Extend: pick a sketch layer first"); return false; }
        const en = pickEnt(L, fx, fy, ["line"]); if (!en) { say("Extend: click a line near the end to run on"); return false; }
        let r = null; edit(L, "sketch extend", (sk) => { r = K().extend(sk, en.id, fx, fy); if (!r.ok) return false; });
        if (r && !r.ok) say("Extend: " + r.why);
        return false;
      },
      hover(e, fx, fy) { st.hover = [fx, fy]; E.drawOverlay(); },
    });
    const corner = (id, name, label, opt, run) => base(id, name, {
      options: () => `<span class="hint">two lines (or the point where they meet), then type the ${opt.what}</span><span class="sep"></span><label>${opt.label} <input type="number" id="${opt.inp}" min="0" step="1" value="${+store.get(opt.key, 0) || ""}" placeholder="auto" style="width:60px"></label>`,
      bindOptions(o) { const i = o.querySelector("#" + opt.inp); if (i) { i.onchange = () => store.set(opt.key, Math.max(0, +i.value || 0)); i.addEventListener("keydown", (ev) => ev.stopPropagation()); } },
      down(e, fx, fy) {
        const L = cur(); if (!L) { say(`${name}: pick a sketch layer first`); return false; }
        const s0 = L.sketch, hit = K().pick(s0, fx, fy, tol(), { axes: false });
        let pair = null;
        if (hit && hit.k === "pt") { const ls = s0.ents.filter((x) => x.t === "line" && !x.axis && K().ptsOf(x).includes(hit.id)); if (ls.length === 2) pair = [ls[0].id, ls[1].id]; else { say(`${name}: that point is not a corner of two lines`); return false; } }
        else if (hit && (K().ent(s0, hit.id) || {}).t === "line") {
          if (!st.firstLine || st.firstLine === hit.id) { st.firstLine = hit.id; say(`${name}: now the second line`); E.drawOverlay(); return false; }
          pair = [st.firstLine, hit.id];
        } else { say(`${name}: click two lines - or the point where they meet`); return false; }
        st.firstLine = null;
        const L1 = Math.min(...pair.map((id) => { const x = K().ent(s0, id); return Math.hypot(K().pt(s0, x.p2).x - K().pt(s0, x.p1).x, K().pt(s0, x.p2).y - K().pt(s0, x.p1).y); }));
        const v = +store.get(opt.key, 0) || Math.max(1, Math.round(L1 / 4));
        let r = null; edit(L, label, (sk) => { r = run(sk, pair[0], pair[1], v); if (!r.ok) return false; });
        if (r && !r.ok) say(`${name}: ${r.why}`);
        else if (r && r.dim) root.setTimeout(() => openInput(L, r.dim), 80);
        return false;
      },
      hover(e, fx, fy) { st.hover = [fx, fy]; E.drawOverlay(); },
      leave() { st.firstLine = null; reset(); hideInput(); },
    });
    E.tools.sk_fillet = corner("sk_fillet", "Fillet", "sketch fillet", { what: "radius", label: "Radius", inp: "skFR", key: "sk.fr" }, (sk, a, b, v) => K().fillet(sk, a, b, v));
    E.tools.sk_chamfer = corner("sk_chamfer", "Chamfer", "sketch chamfer", { what: "distance", label: "Distance", inp: "skCD", key: "sk.cd" }, (sk, a, b, v) => K().chamfer(sk, a, b, v));
    E.tools.sk_arc = base("sk_arc", "3-Point Arc", {
      down(e, fx, fy) {
        const L = ensure(), s = L.sketch, sn = snapNow(s, fx, fy, null, []);
        st.pts.push(sn);
        if (st.pts.length < 3) { say(st.pts.length === 1 ? "3-Point Arc: now click the end" : "3-Point Arc: now a point on the arc (its bend)"); E.drawOverlay(); return false; }
        const [a, b, m] = st.pts; st.pts = [];
        edit(L, "sketch arc", (sk) => {
          const extra = [], pa = placePoint(sk, a, extra), pb = placePoint(sk, b, extra);
          const C = K().circle3([a.x, a.y], [m.x, m.y], [b.x, b.y]); if (!C) { say("the three points are in a line - no arc"); return false; }
          const id = K().arc3(sk, [a.x, a.y], [m.x, m.y], [b.x, b.y]);
          // the arc made its own end points: join them to the picked ones
          const ae = K().ent(sk, id), byPos = (pid) => { const P = K().pt(sk, pid); return [ae.p1, ae.p2].find((q) => Math.hypot(K().pt(sk, q).x - P.x, K().pt(sk, q).y - P.y) < 1e-6); };
          for (const pid of [pa, pb]) { const q = byPos(pid); if (q) extra.unshift({ t: "coincident", a: q, b: pid }); }
          applyCons(sk, extra);
        });
        return false;
      },
      hover(e, fx, fy) { const L = cur(); st.hover = [fx, fy]; st.snap = L ? snapNow(L.sketch, fx, fy, null, []) : null; E.drawOverlay(); },
    });
    E.tools.sk_point = base("sk_point", "Point", {
      down(e, fx, fy) { const L = ensure(), sn = snapNow(L.sketch, fx, fy, null, []); if (sn.pt) { say("Point: there is a point there already"); return false; } edit(L, "sketch point", (sk) => { const extra = [], p = placePoint(sk, sn, extra); K().point(sk, p); applyCons(sk, extra); }); say(`Point at ${Math.round(sn.x)}, ${Math.round(sn.y)}${sn.on ? " (" + sn.what + ")" : ""}`); return false; },
      hover(e, fx, fy) { const L = cur(); st.hover = [fx, fy]; st.snap = L ? snapNow(L.sketch, fx, fy, null, []) : null; E.drawOverlay(); },
    });
    /* ---- the Dimension tool: pick, then place, then type */
    E.tools.sk_dim = base("sk_dim", "Sketch Dimension", {
      down(e, fx, fy) {
        const L = cur(); if (!L) { say("pick a sketch layer (Layer ▸ New Sketch)"); return false; }
        const s = L.sketch;
        if (st.dimPick && st.dimPick.length) {
          const hit = K().pick(s, fx, fy, tol(), { axes: false });
          const m = dimFor(st.dimPick, s, fx, fy);
          // a second item still to pick (two points / a point + a line / two lines)?
          if (hit && st.dimPick.length < 2 && !st.dimPick.some((q) => q.id === hit.id) && (hit.k === "pt" || (K().ent(s, hit.id) || {}).t === "line" || (K().ent(s, hit.id) || {}).t === "point")) { st.dimPick.push(hit); E.drawOverlay(); return false; }
          if (!m) { say("that pick makes no dimension - start again"); st.dimPick = []; E.drawOverlay(); return false; }
          placeDim(L, m, fx, fy); st.dimPick = []; return false;
        }
        const hit = K().pick(s, fx, fy, tol(), { axes: false });
        if (!hit || (hit.k === "pt" && K().isOrigin(s, hit.id) && hit.id !== s.origin.pt)) { say("Sketch Dimension: " + HINTS.sk_dim); return false; }
        st.dimPick = [hit]; say("Sketch Dimension: now click where the number goes - or pick a second point / line"); E.drawOverlay(); return false;
      },
      hover(e, fx, fy) { st.hover = [fx, fy]; E.drawOverlay(); },
      leave() { st.dimPick = []; reset(); hideInput(); },
    });
    function placeDim(L, m, x, y) {
      const s = L.sketch, d0 = K().dimFrom(s, m.t, m.refs);
      // its label where the click was (an offset from the measured thing)
      const G0 = K().dimGeom(s, Object.assign({}, d0, { id: "tmp", at: [0, 0] }));
      let at = [0, -20];
      if (G0 && (m.t === "radius" || m.t === "diameter")) { const e = K().ent(s, m.refs[0]), c = K().pt(s, e.c); at = [x - c.x, y - c.y]; }
      else if (G0) at = [x - G0.x, y - G0.y];
      if (m.t === "angle") { const e1 = K().ent(s, m.refs[0]), e2 = K().ent(s, m.refs[1]), a = K().pt(s, e1.p1), b = K().pt(s, e2.p1); at = [x - (a.x + b.x) / 2, y - (a.y + b.y) / 2]; }
      d0.at = at;
      let res = null;
      edit(L, "sketch dimension", (sk) => { res = K().tryAdd(sk, d0, "dim"); });
      if (res && res.why) say(res.why === "redundant" ? "the sketch is already set there - a driven (reference) dimension was added" : "that would over-constrain the sketch - a driven (reference) dimension was added");
      const id = res && res.id; if (id && !res.driven) root.setTimeout(() => openInput(L, id), 80);   // after the click (its mousedown takes the focus)
    }
    /* ---- the value box over a dimension */
    let inp = null;
    function hideInput() { if (inp) { inp.remove(); inp = null; } }
    function openInput(L, id) {
      hideInput();
      const m = L.sketch.dims.find((d) => d.id === id); if (!m || m.driven) return;
      const G = K().dimGeom(L.sketch, m); if (!G) return;
      const r = $("kxPaper").getBoundingClientRect(), kr = kx.getBoundingClientRect(), z = S.zoom || 1;
      inp = doc.createElement("input"); inp.type = "text"; inp.id = "skDimIn"; inp.value = String(Math.round(m.v * 1000) / 1000);
      inp.style.cssText = `position:absolute;z-index:50;width:80px;left:${r.left - kr.left + G.x * z - 40}px;top:${r.top - kr.top + G.y * z - 12}px;font:12px sans-serif;padding:2px 4px;border:1px solid var(--pc-accent);background:var(--pc-bg);color:var(--pc-text)`;
      kx.appendChild(inp); inp.focus(); inp.select();
      inp.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Escape") { hideInput(); return; }
        if (e.key !== "Enter") return;
        const v = evalNum(inp.value); hideInput();
        if (!(v > 0) && m.t !== "angle") return say("type a number above 0");
        let r2 = null; edit(L, "sketch dimension value", (sk) => { r2 = K().setDim(sk, id, v); if (!r2.ok) return false; });
        if (r2 && !r2.ok) say("the sketch cannot take that value - it is kept as it was");
      });
      const born = Date.now();
      inp.addEventListener("blur", () => { if (Date.now() - born < 400) { root.setTimeout(() => { if (inp) inp.focus(); }, 0); return; } root.setTimeout(hideInput, 150); });
    }
    /** "12.5", "100/4", "2*30+5" -> a number (only digits and + - * / . ( ) - no names) */
    function evalNum(t) { const x = String(t || "").replace(/,/g, ".").trim(); if (!/^[\d.+\-*/() ]+$/.test(x)) return NaN; try { return +Function("return (" + x + ")")(); } catch (e) { return NaN; } }

    /* ---- 2.464.0: TYPED VALUES while drawing - a line's length / angle, a rectangle's width / height, a circle's
     *      diameter, a polygon's radius: type a number (Tab = the next box), Enter = drawn there + kept as dimensions */
    const TYPED = { sk_line: [["len", "Length"], ["ang", "Angle °"]], sk_rect: [["w", "Width"], ["h", "Height"]], sk_rectc: [["w", "Width"], ["h", "Height"]],
      sk_circle: [["d", "Diameter"]], sk_circle2: [["d", "Diameter"]], sk_poly: [["r", "Radius"]] };
    const drawingNow = () => !!cur() && (S.tool === "sk_line" ? !!st.lastSn : !!TYPED[S.tool] && st.pts.length === 1);
    let hud = null;
    function hideHud() { if (hud) { hud.remove(); hud = null; } st.typed = null; }
    function openHud(first) {
      if (!drawingNow()) return false;
      hideHud();
      const f = TYPED[S.tool], h = st.hover || [0, 0], r = $("kxPaper").getBoundingClientRect(), kr = kx.getBoundingClientRect(), z = S.zoom || 1;
      hud = doc.createElement("div"); hud.id = "skTyped";
      hud.style.cssText = `position:absolute;z-index:50;left:${r.left - kr.left + h[0] * z + 16}px;top:${r.top - kr.top + h[1] * z + 16}px;display:flex;gap:4px;align-items:center;padding:3px 5px;font:11px sans-serif;background:var(--pc-bg);color:var(--pc-text);border:1px solid var(--pc-accent);border-radius:3px`;
      hud.innerHTML = f.map(([k, l]) => `<label>${esc(l)} <input type="text" id="skT_${k}" data-k="${k}" style="width:56px;font:11px sans-serif;padding:1px 3px"></label>`).join("") + `<span style="color:var(--pc-dim)">Tab · Enter</span>`;
      kx.appendChild(hud);
      st.typed = {};
      const ins = [...hud.querySelectorAll("input")];
      const read = (i) => { const v = evalNum(i.value); if (i.value.trim() === "" || !Number.isFinite(v)) delete st.typed[i.dataset.k]; else st.typed[i.dataset.k] = v; E.drawOverlay(); };
      ins.forEach((i, n) => {
        i.addEventListener("input", () => read(i));
        i.addEventListener("keydown", (e) => {
          e.stopPropagation();
          if (e.key === "Tab") { e.preventDefault(); const j = ins[(n + (e.shiftKey ? ins.length - 1 : 1)) % ins.length]; j.focus(); j.select(); return; }
          if (e.key === "Escape") { hideHud(); E.drawOverlay(); return; }
          if (e.key === "Enter") { e.preventDefault(); ins.forEach(read); commitTyped(); }
        });
      });
      ins[0].value = first || ""; read(ins[0]); ins[0].focus();
      return true;
    }
    /** where the typed values (and the pointer's direction for the rest) put the shape's second point */
    function typedTarget(s) {
      const t = st.typed || {}, h = st.hover || [0, 0], tool = S.tool;
      if (tool === "sk_line") {
        const a = st.lastSn.pt ? K().pt(s, st.lastSn.pt) : st.lastSn;
        let dx = h[0] - a.x, dy = h[1] - a.y, len = Math.hypot(dx, dy), hv = null, ang = t.ang;
        if (ang == null && len > 0) { const d = (Math.atan2(-dy, dx) * 180 / Math.PI + 360) % 360; for (const q of [0, 90, 180, 270, 360]) if (Math.abs(d - q) < 3) ang = q % 360; if (ang != null) hv = "auto"; }
        if (ang != null) { const rr = ang * Math.PI / 180; dx = Math.cos(rr); dy = -Math.sin(rr); } else if (len > 0) { dx /= len; dy /= len; } else { dx = 1; dy = 0; }
        if (t.len != null) len = t.len;
        const a360 = ang == null ? null : ((ang % 360) + 360) % 360, lvl = a360 == null ? null : [0, 180].some((q) => Math.abs(a360 - q) < 1e-9) ? "horizontal" : [90, 270].some((q) => Math.abs(a360 - q) < 1e-9) ? "vertical" : null;
        return { x: a.x + dx * len, y: a.y + dy * len, hv: lvl, angDim: t.ang != null && !lvl && hv !== "auto" };
      }
      const a = st.pts[0], sx = Math.sign(h[0] - a.x) || 1, sy = Math.sign(h[1] - a.y) || 1;
      if (tool === "sk_rect") return { x: t.w != null ? a.x + sx * t.w : h[0], y: t.h != null ? a.y + sy * t.h : h[1] };
      if (tool === "sk_rectc") return { x: t.w != null ? a.x + sx * t.w / 2 : h[0], y: t.h != null ? a.y + sy * t.h / 2 : h[1] };
      const dx = h[0] - a.x, dy = h[1] - a.y, L0 = Math.hypot(dx, dy), u = L0 > 0 ? [dx / L0, dy / L0] : [1, 0];
      const len = tool === "sk_circle" ? (t.d != null ? t.d / 2 : L0) : tool === "sk_circle2" ? (t.d != null ? t.d : L0) : (t.r != null ? t.r : L0);
      return { x: a.x + u[0] * len, y: a.y + u[1] * len };
    }
    const addDimNow = (sk, t, refs) => { const m = K().dimFrom(sk, t, refs); return K().tryAdd(sk, m, "dim"); };
    function commitTyped() {
      const L = cur(); if (!L || !drawingNow()) { hideHud(); return; }
      const t = Object.assign({}, st.typed || {}), q = typedTarget(L.sketch), tool = S.tool;
      hideHud();
      if (!Object.keys(t).length) { E.drawOverlay(); return; }
      if ((t.len != null && !(t.len > 0)) || (t.w != null && !(t.w > 0)) || (t.h != null && !(t.h > 0)) || (t.d != null && !(t.d > 0)) || (t.r != null && !(t.r > 0))) { say("type a size above 0"); E.drawOverlay(); return; }
      if (tool === "sk_line") {
        addLineTo(L, { x: q.x, y: q.y, hv: q.hv }, (sk, id) => {
          if (t.len != null) addDimNow(sk, "len", [id]);
          if (q.angDim) {
            const r = addDimNow(sk, "angle", [sk.origin.h, id]), m = r && sk.dims.find((d) => d.id === r.id);
            if (m) {   // its number by the line's start, half way round the angle (not half way to the far end of the axis)
              const e = K().ent(sk, id), a = K().pt(sk, e.p1), h1 = K().pt(sk, K().ent(sk, sk.origin.h).p1), half = (t.ang / 2) * Math.PI / 180;
              m.at = [a.x + 55 * Math.cos(half) - (a.x + h1.x) / 2, a.y - 55 * Math.sin(half) - (a.y + h1.y) / 2];
            }
          }
        });
        say(`Line: ${t.len != null ? "length " + t.len : ""}${t.len != null && t.ang != null ? " · " : ""}${t.ang != null ? "angle " + t.ang + "°" : ""} - go on typing for the next one`);
        return;
      }
      const a = st.pts[0]; st.pts = []; st.from = null;
      edit(L, LABEL2[tool], (sk) => {
        const res = MAKE2[tool](sk, a, { x: q.x, y: q.y }); if (res === false) return false;
        if ((tool === "sk_rect" || tool === "sk_rectc") && res && res.lines) { if (t.w != null) addDimNow(sk, "len", [res.lines[0]]); if (t.h != null) addDimNow(sk, "len", [res.lines[1]]); }
        if ((tool === "sk_circle" || tool === "sk_circle2") && typeof res === "string" && t.d != null) addDimNow(sk, "diameter", [res]);
        if (tool === "sk_poly" && res && res.circle && t.r != null) addDimNow(sk, "diameter", [res.circle]);
      });
    }

    /* ---- Sketch Select: pick + drag */
    let drag = null;
    E.tools.sk_select = base("sk_select", "Sketch Select", {
      cursor: "default",
      down(e, fx, fy) {
        const L = cur(); if (!L) { say("Sketch Select: pick a sketch layer first (Layer ▸ New Sketch, or draw with a sketch tool)"); return false; }
        const s = L.sketch, t = tol();
        const ph = plusHandles(s).find((h) => Math.hypot(h.x - fx, h.y - fy) <= 8 / (S.zoom || 1));
        if (ph) {                                              // 2.494.0: ＋ at a picked line's end = go on drawing lines from there
          E.setTool("sk_line"); const P0 = K().pt(s, ph.pt); st.lastSn = { x: P0.x, y: P0.y, pt: ph.pt }; st.chainStart = null;
          say("Line: on from the picked line's end - click the next points (Esc / double-click = done)"); E.drawOverlay(); return false;
        }
        const dm = dimAt(s, fx, fy);
        const hit = dm ? { k: "dim", id: dm } : (conAt(s, fx, fy) || K().pick(s, fx, fy, t, { axes: false }));
        if (!hit) { if (!e.shiftKey) sel = []; paint(); E.drawOverlay(); return false; }
        const was = sel.some((q) => q.id === hit.id);
        if (e.shiftKey) sel = was ? sel.filter((q) => q.id !== hit.id) : sel.concat([hit]);
        else if (!was) sel = [hit];
        paint();
        if (hit.k === "con") { E.drawOverlay(); return false; }
        drag = { L, hit, x0: fx, y0: fy, before: E.snapStruct(), moved: false, last: [fx, fy] };
        if (hit.k === "ent") { const en = K().ent(s, hit.id); if (en.t === "circle") { const c = K().pt(s, en.c); drag.circle = Math.hypot(fx - c.x, fy - c.y) > en.r * 0.5; } }
        E.drawOverlay();
        return undefined;                                      // keep the drag
      },
      move(e, fx, fy) {
        if (!drag) return;
        const L = drag.L, s = L.sketch, h = drag.hit, dx = fx - drag.last[0], dy = fy - drag.last[1];
        if (!drag.moved && Math.hypot(fx - drag.x0, fy - drag.y0) < 2 / (S.zoom || 1)) return;
        drag.moved = true;
        if (h.k === "dim") { const m = s.dims.find((d) => d.id === h.id); if (m) { m.at = [m.at[0] + dx, m.at[1] + dy]; } }
        else if (h.k === "pt") { if (K().isOrigin(s, h.id)) return; K().drag(s, [h.id], dx, dy); }
        else { const en = K().ent(s, h.id); if (!en) return;
          if (en.t === "circle" && drag.circle) { const c = K().pt(s, en.c); K().dragRadius(s, en.id, Math.hypot(fx - c.x, fy - c.y)); }
          else if (!en.axis) K().drag(s, K().ptsOf(en), dx, dy); }
        drag.last = [fx, fy];
        D.rasterize(L); E.refresh(); E.drawOverlay();
      },
      up() {
        if (!drag) return;
        const d = drag; drag = null;
        if (d.moved) { E.push({ t: "struct", before: d.before, after: E.snapStruct(), label: "sketch drag" }); E.renderLayersPanel(); paint(); }
      },
      hover(e, fx, fy) { st.hover = [fx, fy]; },
      dblclick(e, fx, fy) { const L = cur(); if (!L) return; const dm = dimAt(L.sketch, fx, fy); if (dm) root.setTimeout(() => openInput(L, dm), 80); },
    });
    function dimAt(s, x, y) {
      const t = 12 / (S.zoom || 1);
      for (const m of s.dims) { const G = K().dimGeom(s, m); if (G && Math.abs(G.x - x) < Math.max(t * 2, (G.text.length * 3.5) / (S.zoom || 1)) && Math.abs(G.y - y) < t) return m.id; }
      return null;
    }
    /* ---- the constraint marks (where each is drawn) */
    const GLYPH = { horizontal: "—", vertical: "|", parallel: "∥", perpendicular: "⊥", collinear: "⋯", equal: "=", tangent: "◠", midpoint: "△", concentric: "◎", fix: "🔒", symmetric: "⇹", onLine: "⋅", onCircle: "⋅", coincident: "•" };
    function conMarks(s) {
      const out = [], P = (id) => K().pt(s, id), byEnt = new Map(), z = S.zoom || 1;
      const anchor = (k) => {
        const e = K().ent(s, k.a);
        if (e && e.t === "line") { const a = P(e.p1), b = P(e.p2); return [(a.x + b.x) / 2, (a.y + b.y) / 2, e.id]; }
        if (e && (e.t === "circle" || e.t === "arc")) { const c = P(e.c); const r = e.t === "circle" ? e.r : Math.hypot(P(e.p1).x - c.x, P(e.p1).y - c.y); return [c.x + r * 0.7, c.y - r * 0.7, e.id]; }
        const p = P(k.a); return p ? [p.x, p.y, k.a] : null;
      };
      for (const k of s.cons) {
        if (k.t === "coincident" || (k.t === "fix" && K().isOrigin(s, k.a))) continue;
        const an = anchor(k); if (!an) continue;
        const n = byEnt.get(an[2]) || 0; byEnt.set(an[2], n + 1);
        out.push({ id: k.id, t: k.t, x: an[0] + (10 + n * 14) / z, y: an[1] - 10 / z });
        if (k.b && (k.t === "parallel" || k.t === "perpendicular" || k.t === "equal" || k.t === "tangent" || k.t === "collinear" || k.t === "concentric")) {
          const an2 = anchor({ a: k.b }); if (an2) { const n2 = byEnt.get(an2[2]) || 0; byEnt.set(an2[2], n2 + 1); out.push({ id: k.id, t: k.t, x: an2[0] + (10 + n2 * 14) / z, y: an2[1] - 10 / z }); }
        }
      }
      return out;
    }
    function conAt(s, x, y) { if (store.get("sk.cons", true) === false) return null; const t = 7 / (S.zoom || 1); for (const m of conMarks(s)) if (Math.abs(m.x - x) < t && Math.abs(m.y - y) < t) return { k: "con", id: m.id }; return null; }

    /** 2.494.0: the ＋ handles at the ends of the one picked line / arc (Sketch Select) -> [{pt, x, y}] */
    function plusHandles(s) {
      if (S.tool !== "sk_select" || sel.length !== 1 || sel[0].k !== "ent" || drag) return [];
      const e = K().ent(s, sel[0].id); if (!e || e.axis || (e.t !== "line" && e.t !== "arc")) return [];
      const g = 18 / (S.zoom || 1), out = [];
      for (const [pid, other, first] of [[e.p1, e.p2, true], [e.p2, e.p1, false]]) {
        const p = K().pt(s, pid); let u;
        if (e.t === "line") { const q = K().pt(s, other); u = [p.x - q.x, p.y - q.y]; }
        else { const c = K().pt(s, e.c), a = Math.atan2(p.y - c.y, p.x - c.x); u = first ? [Math.sin(a), -Math.cos(a)] : [-Math.sin(a), Math.cos(a)]; }
        const n = Math.hypot(u[0], u[1]) || 1; out.push({ pt: pid, x: p.x + u[0] / n * g, y: p.y + u[1] / n * g, from: [p.x, p.y] });
      }
      return out;
    }
    /* ---- the edit marks */
    const SKTOOLS = new Set(TOOLS.map(([t]) => t));
    E.overlayHooks.push((g, px) => {
      const L = cur(); if (!L) return;
      const tabOn = $("kskBody") && $("kskBody").classList.contains("on");
      if (!SKTOOLS.has(S.tool) && !tabOn) return;
      const s = L.sketch, df = dofOf(s), isSel = (id) => sel.some((q) => q.id === id);
      g.save(); g.lineCap = "round";
      for (const e of s.ents) {
        if (e.t === "point") continue;
        const full = df ? df.fully(e) : false;
        g.strokeStyle = isSel(e.id) ? "#ff8a00" : e.cons ? (e.axis ? "rgba(255,80,80,0.55)" : "#e8a33a") : full ? "#111111" : "#2680eb";
        g.lineWidth = (isSel(e.id) ? 2.5 : 1.6) * px;
        g.setLineDash(e.cons ? [6 * px, 4 * px] : []);
        K().strokeEnt(g, s, e);
      }
      g.setLineDash([]);
      for (const p of s.pts) {
        if (K().isOrigin(s, p.id) && p.id !== s.origin.pt) continue;
        const free = df && (df.free.has(p.id + ".x") || df.free.has(p.id + ".y"));
        const sz = (p.id === s.origin.pt ? 4 : 3) * px;
        g.fillStyle = isSel(p.id) ? "#ff8a00" : p.id === s.origin.pt ? "#e0302a" : free ? "#2680eb" : "#111111";
        g.fillRect(p.x - sz, p.y - sz, sz * 2, sz * 2);
      }
      for (const m of s.dims) K().drawDim(g, s, m, isSel(m.id) ? "#ff8a00" : m.driven ? "#888888" : "#111111", px);
      if (store.get("sk.cons", true) !== false) {
        g.font = `${10 * px}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
        for (const m of conMarks(s)) { const sz = 6.5 * px; g.fillStyle = isSel(m.id) ? "#ff8a00" : "rgba(40,40,40,0.85)"; g.fillRect(m.x - sz, m.y - sz, sz * 2, sz * 2); g.fillStyle = "#fff"; g.fillText(GLYPH[m.t] || "?", m.x, m.y + 0.5 * px); }
      }
      // what is being drawn
      const h = st.hover, sn = st.snap;
      g.strokeStyle = "#2680eb"; g.lineWidth = 1.2 * px; g.setLineDash([5 * px, 3 * px]);
      let end = sn ? [sn.x, sn.y] : h;
      if (st.typed && drawingNow()) { const q = typedTarget(s); end = [q.x, q.y]; }
      if (end) {
        if (S.tool === "sk_line" && st.lastSn) { const a = st.lastSn.pt ? K().pt(s, st.lastSn.pt) : st.lastSn; if (a) { g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(end[0], end[1]); g.stroke(); g.setLineDash([]); g.fillStyle = "#2680eb"; g.font = `${11 * px}px sans-serif`; g.fillText(`${Math.round(Math.hypot(end[0] - a.x, end[1] - a.y) * 10) / 10}`, (a.x + end[0]) / 2 + 10 * px, (a.y + end[1]) / 2 - 10 * px); } }
        if (st.pts.length && (S.tool === "sk_rect" || S.tool === "sk_rectc")) { const a = st.pts[0], b = S.tool === "sk_rect" ? a : { x: 2 * a.x - end[0], y: 2 * a.y - end[1] }; g.strokeRect(Math.min(b.x, end[0]), Math.min(b.y, end[1]), Math.abs(end[0] - b.x), Math.abs(end[1] - b.y)); }
        if (st.pts.length && S.tool === "sk_circle") { const a = st.pts[0]; g.beginPath(); g.arc(a.x, a.y, Math.hypot(end[0] - a.x, end[1] - a.y), 0, Math.PI * 2); g.stroke(); }
        if (S.tool === "sk_arc" && st.pts.length) { const a = st.pts[0]; if (st.pts.length === 1) { g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(end[0], end[1]); g.stroke(); } else { const b = st.pts[1], C = K().circle3([a.x, a.y], end, [b.x, b.y]); if (C) { g.beginPath(); g.arc(C.x, C.y, C.r, 0, Math.PI * 2); g.stroke(); } } }
      }
      if (end && st.pts.length && S.tool === "sk_poly") { const a = st.pts[0], n = +store.get("sk.sides", 6) || 6, r = Math.hypot(end[0] - a.x, end[1] - a.y), a0 = Math.atan2(end[1] - a.y, end[0] - a.x); g.beginPath(); for (let i = 0; i <= n; i++) { const t = a0 + Math.PI * 2 * i / n; (i ? g.lineTo : g.moveTo).call(g, a.x + r * Math.cos(t), a.y + r * Math.sin(t)); } g.stroke(); }
      if (end && st.pts.length && S.tool === "sk_circle2") { const a = st.pts[0], c = [(a.x + end[0]) / 2, (a.y + end[1]) / 2]; g.beginPath(); g.arc(c[0], c[1], Math.hypot(end[0] - a.x, end[1] - a.y) / 2, 0, Math.PI * 2); g.stroke(); }
      if (end && st.pts.length === 2 && S.tool === "sk_circle3") { const C = K().circle3([st.pts[0].x, st.pts[0].y], [st.pts[1].x, st.pts[1].y], end); if (C) { g.beginPath(); g.arc(C.x, C.y, C.r, 0, Math.PI * 2); g.stroke(); } }
      if (end && st.pts.length && S.tool === "sk_slot") { const a = st.pts[0], b = st.pts.length > 1 ? st.pts[1] : { x: end[0], y: end[1] }; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); if (st.pts.length > 1) { const u = [b.x - a.x, b.y - a.y], L2 = Math.hypot(...u) || 1, w = Math.abs((u[0] * (end[1] - a.y) - u[1] * (end[0] - a.x)) / L2); for (const c of [a, b]) { g.beginPath(); g.arc(c.x, c.y, w, 0, Math.PI * 2); g.stroke(); } } }
      if (end && st.pts.length && S.tool === "sk_spline") { g.beginPath(); st.pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.lineTo(end[0], end[1]); g.stroke(); }
      if (S.tool === "sk_trim" && st.trimHover) {                    // the piece Trim would cut away, in red
        const tmp = K().clone(s), r = K().trim(tmp, st.trimHover.id, st.trimHover.x, st.trimHover.y);
        if (r.ok) { g.setLineDash([]); g.strokeStyle = "#e0302a"; g.lineWidth = 3 * px; const e0 = K().ent(s, st.trimHover.id), keep = tmp.ents.filter((x) => !s.ents.some((y) => y.id === x.id && JSON.stringify(y) === JSON.stringify(x)));
          // what is gone = the old entity drawn, then what stays drawn over it in the sketch's colours
          K().strokeEnt(g, s, e0); g.strokeStyle = "#2680eb"; g.lineWidth = 1.8 * px; for (const x of keep) if (x.t !== "point") K().strokeEnt(g, tmp, x); }
      }
      if ((S.tool === "sk_fillet" || S.tool === "sk_chamfer") && st.firstLine) { const e0 = K().ent(s, st.firstLine); if (e0) { g.setLineDash([]); g.strokeStyle = "#ff8a00"; g.lineWidth = 2.5 * px; K().strokeEnt(g, s, e0); } }
      if (S.tool === "sk_offset") {                                  // 2.494.0: the chain under the pointer / picked + where it would go
        const ids = st.off ? st.off.ids : st.offHover;
        if (ids && ids.length) { g.setLineDash([]); g.strokeStyle = "#ff8a00"; g.lineWidth = (st.off ? 3 : 2.2) * px; for (const id of ids) { const e0 = K().ent(s, id); if (e0) K().strokeEnt(g, s, e0); } }
        if (st.off && st.offAt) {
          const tmp = K().clone(s), toward = st.offFlip ? mirrorPt(s, st.off.ids, st.offAt.at) : st.offAt.at, r = K().offset(tmp, st.off.ids, st.offAt.dist, { toward, preview: true });
          g.setLineDash([5 * px, 3 * px]); g.strokeStyle = r.ok ? "#2680eb" : "#e0302a"; g.lineWidth = 1.8 * px;
          if (r.ok) for (const id of r.ents) { const e0 = K().ent(tmp, id); if (e0) K().strokeEnt(g, tmp, e0); }
          g.setLineDash([]); g.fillStyle = "#2680eb"; g.font = `${11 * px}px sans-serif`; g.fillText(r.ok ? String(st.offAt.dist) : (r.why || "no"), st.offAt.at[0] + 16 * px, st.offAt.at[1] + 16 * px);
        }
      }
      for (const h of plusHandles(s)) {                             // 2.494.0: ＋ = draw on from this end
        g.setLineDash([2 * px, 2 * px]); g.strokeStyle = "#2680eb"; g.lineWidth = 1 * px; g.beginPath(); g.moveTo(h.from[0], h.from[1]); g.lineTo(h.x, h.y); g.stroke(); g.setLineDash([]);
        g.fillStyle = "#ffffff"; g.strokeStyle = "#2680eb"; g.lineWidth = 1.5 * px; g.beginPath(); g.arc(h.x, h.y, 7 * px, 0, Math.PI * 2); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(h.x - 4 * px, h.y); g.lineTo(h.x + 4 * px, h.y); g.moveTo(h.x, h.y - 4 * px); g.lineTo(h.x, h.y + 4 * px); g.stroke();
      }
      g.setLineDash([]);
      if (sn && (sn.pt || sn.on || sn.hv)) { g.fillStyle = "#ff3cac"; g.font = `${10 * px}px sans-serif`; g.fillText(sn.what || "", sn.x + 14 * px, sn.y - 10 * px); g.beginPath(); g.arc(sn.x, sn.y, 4 * px, 0, Math.PI * 2); g.strokeStyle = "#ff3cac"; g.stroke(); }
      if (S.tool === "sk_dim" && st.dimPick) for (const q of st.dimPick) { g.strokeStyle = "#ff8a00"; g.lineWidth = 2.5 * px; if (q.k === "pt") { const p = K().pt(s, q.id); g.strokeRect(p.x - 5 * px, p.y - 5 * px, 10 * px, 10 * px); } else K().strokeEnt(g, s, K().ent(s, q.id)); }
      g.restore();
    });

    /* ---- actions on the picked items */
    function delSel() {
      const L = cur(); if (!L) return;
      const s = L.sketch, ents = sel.filter((q) => q.k === "ent").map((q) => q.id), ptsOnly = sel.filter((q) => q.k === "pt").map((q) => q.id);
      // a picked point = the entities on it
      for (const p of ptsOnly) for (const e of s.ents) if (K().ptsOf(e).includes(p) && !ents.includes(e.id)) ents.push(e.id);
      const cons = sel.filter((q) => q.k === "con").map((q) => q.id), dims = sel.filter((q) => q.k === "dim").map((q) => q.id);
      edit(L, "sketch delete", (sk) => {
        sk.cons = sk.cons.filter((k) => !cons.includes(k.id)); sk.dims = sk.dims.filter((m) => !dims.includes(m.id));
        K().remove(sk, ents);
      });
      sel = []; paint();
    }
    function toggleCons() {
      const L = cur(); if (!L) return;
      const ids = sel.filter((q) => q.k === "ent").map((q) => q.id);
      if (!ids.length) return say("pick lines / circles / arcs to switch to or from construction");
      edit(L, "sketch construction", (sk) => { for (const id of ids) { const e = K().ent(sk, id); if (e && !e.axis) e.cons = !e.cons; } });
    }
    function constrain(type) {
      const L = cur(); if (!L) return say("pick a sketch layer first");
      const c = conFor(type, sel, L.sketch);
      if (c.err) return say(`${K().CON_NAMES[type] || type}: ${c.err}`);
      let msg = null;
      edit(L, "sketch " + type, (sk) => {
        const list = c.multi ? c.multi.map((p) => ({ t: "fix", a: p })) : [c];
        if (c.also) list.push({ t: "symmetric", a: c.also.a, b: c.also.b, c: c.c });
        let any = false;
        for (const it of list) { const { multi, also, ...clean } = it; void multi; void also; const r = K().tryAdd(sk, clean, "con"); if (r.ok) any = true; else msg = r.why === "redundant" ? "it is already set by the other constraints" : "it would over-constrain the sketch"; }
        if (!any) return false;
      });
      if (msg) say(`${K().CON_NAMES[type] || type}: ${msg}`);
      else say(`${K().CON_NAMES[type] || type} ✓`);
    }
    /* ---- 2.463.0: offset / mirror / patterns on what is picked */
    const pickedEnts = (s) => sel.filter((q) => q.k === "ent").map((q) => q.id).filter((id) => { const e = K().ent(s, id); return e && !e.axis; });
    function offsetDialog() {
      const L = cur(); if (!L) return say("pick a sketch layer first");
      const ids = pickedEnts(L.sketch).filter((id) => ["line", "arc", "circle"].includes(K().ent(L.sketch, id).t)); if (!ids.length) return offsetTool();
      E.ui.dialog("Offset", `<div class="rw"><span>Distance (px)</span><input type="number" id="skOffD" step="1" value="${+store.get("sk.off", 10) || 10}"></div>
        <div class="rw"><span>Side</span><select id="skOffS" style="grid-column:2/4"><option value="1">Out (away from what a closed chain encloses; circles bigger)</option><option value="-1">In (into it; circles smaller)</option></select></div>`,
      (dl) => {
        const d = Math.abs(+dl.querySelector("#skOffD").value || 0) * (+dl.querySelector("#skOffS").value || 1); if (!d) return say("Offset: a distance above 0");
        store.set("sk.off", Math.abs(d)); let r = null;
        edit(L, "sketch offset", (sk) => { r = K().offset(sk, ids, d); if (!r.ok) return false; });
        say(r && r.ok ? `Offset: ${r.ents.length} new entit${r.ents.length === 1 ? "y" : "ies"}` : "Offset: " + ((r && r.why) || "the sketch could not take it"));
      }, { okLabel: "Offset" });
    }
    /* ---- 2.494.0: the OFFSET TOOL - pick a chain, the pointer says the side + the distance, click (or type it) */
    const OFFT = ["line", "arc", "circle"];
    /** the whole chain an entity is in (the lines / arcs joined to it end to end), or the circle */
    function chainAt(s, id) {
      const e = K().ent(s, id); if (!e || e.axis || !OFFT.includes(e.t)) return [];
      if (e.t === "circle") return [id];
      const all = s.ents.filter((x) => !x.axis && (x.t === "line" || x.t === "arc") && !!x.cons === !!e.cons).map((x) => x.id);
      const c = K().chainsOf(s, all).find((ch) => ch.loop.some((q) => q.e.id === id));
      return c ? c.loop.map((q) => q.e.id) : [id];
    }
    function offsetTool() {
      const L = cur(); E.setTool("sk_offset");
      if (L) { const ids = pickedEnts(L.sketch).filter((id) => OFFT.includes(K().ent(L.sketch, id).t)); if (ids.length) { st.off = { ids }; say(`Offset: ${ids.length} picked - move to the side and click (or type the distance + Enter)`); E.drawOverlay(); } }
      return true;
    }
    /** what the pointer says: {side, dist} (rounded: 1 px, 0.1 when zoomed in) */
    function offsetHere(s, x, y) {
      const w = K().offsetSide(s, st.off.ids, x, y); if (!w) return null;
      const q = (S.zoom || 1) >= 4 ? 10 : 1;
      return { side: w.side, dist: Math.max(q === 10 ? 0.1 : 1, Math.round(w.dist * q) / q), at: [x, y] };
    }
    /** offset what is picked by `dist` on the pointer's side (F flips it) */
    function offsetApply(dist) {
      const L = cur(); if (!L || !st.off || !(dist > 0)) return false;
      const ids = st.off.ids;
      let toward = st.offAt ? st.offAt.at : null;
      if (toward && st.offFlip) toward = mirrorPt(L.sketch, ids, toward);
      let r = null;
      edit(L, "sketch offset", (sk) => { r = toward ? K().offset(sk, ids, dist, { toward }) : K().offset(sk, ids, (st.offFlip ? -1 : 1) * dist); if (!r.ok) return false; });
      store.set("sk.off", dist);
      say(r && r.ok ? `Offset ${dist}: ${r.ents.length} new entit${r.ents.length === 1 ? "y" : "ies"} - pick the next one (Esc = done)` : "Offset: " + ((r && r.why) || "the sketch could not take it"));
      if (r && r.ok) { st.off = null; st.offAt = null; st.offFlip = false; sel = r.ents.map((id) => ({ k: "ent", id })); paint(); }
      E.drawOverlay();
      return !!(r && r.ok);
    }
    /** the pointer's spot mirrored to the picked geometry's other side (F = the other side) */
    function mirrorPt(s, ids, p) {
      let best = null;
      for (const id of ids) { const e = K().ent(s, id); if (!e) continue; const d = K().distTo ? K().distTo(s, e, p[0], p[1]) : 0; if (!best || d < best.d) best = { e, d }; }
      if (!best) return p;
      const e = best.e;
      if (e.t === "line") { const a = K().pt(s, e.p1), b = K().pt(s, e.p2), u = [b.x - a.x, b.y - a.y], L2 = u[0] * u[0] + u[1] * u[1] || 1, t = ((p[0] - a.x) * u[0] + (p[1] - a.y) * u[1]) / L2, f = [a.x + t * u[0], a.y + t * u[1]]; return [2 * f[0] - p[0], 2 * f[1] - p[1]]; }
      const c = K().pt(s, e.c), r0 = Math.hypot(p[0] - c.x, p[1] - c.y) || 1, R0 = e.t === "circle" ? e.r : Math.hypot(K().pt(s, e.p1).x - c.x, K().pt(s, e.p1).y - c.y), r2 = Math.max(0.01, 2 * R0 - r0);
      return [c.x + (p[0] - c.x) * r2 / r0, c.y + (p[1] - c.y) * r2 / r0];
    }
    E.tools.sk_offset = base("sk_offset", "Offset", {
      cursor: "crosshair",
      options: () => `<span class="hint">${esc(HINTS.sk_offset)}</span><span class="sep"></span><label title="The distance (Enter = offset by it)">Distance <input type="number" id="skOffT" min="0.1" step="1" value="${+store.get("sk.off", 10) || 10}" style="width:64px"></label>`
        + `<button type="button" class="ghost" id="skOffFlip" title="The other side (F)">⇄ Flip</button><button type="button" class="ghost" id="skOffGo" title="Offset by the distance (Enter)">✓ Offset</button>`,
      bindOptions(o) {
        const inp = o.querySelector("#skOffT"), go = () => { const v = Math.abs(+inp.value || 0); if (!v) return say("Offset: a distance above 0"); if (!st.off) return say("Offset: pick a line / arc / circle first"); offsetApply(v); };
        if (inp) { inp.addEventListener("keydown", (ev) => { ev.stopPropagation(); if (ev.key === "Enter") { go(); inp.blur(); } if (ev.key === "Escape") inp.blur(); }); inp.onchange = () => store.set("sk.off", Math.abs(+inp.value || 10)); }
        const f = o.querySelector("#skOffFlip"); if (f) f.onclick = () => { st.offFlip = !st.offFlip; E.drawOverlay(); };
        const g = o.querySelector("#skOffGo"); if (g) g.onclick = go;
      },
      down(e, fx, fy) {
        const L = cur(); if (!L) { say("Offset: pick a sketch layer first"); return false; }
        const s = L.sketch, hit = K().pick(s, fx, fy, tol(), { entsOnly: true, axes: false });
        const hitOk = hit && hit.k === "ent" && OFFT.includes(K().ent(s, hit.id).t);
        if (!st.off || (e.shiftKey && hitOk)) {
          if (!hitOk) { say("Offset: click a line / arc / circle"); return false; }
          const ch = chainAt(s, hit.id), ids = st.off ? [...new Set(st.off.ids.concat(ch))] : ch;
          st.off = { ids }; st.offAt = null; st.offHover = null;
          say(`Offset: ${ids.length} picked (the joined chain) - move to the side and click, or type the distance + Enter (Shift-click = add more)`);
          E.drawOverlay(); return false;
        }
        const w = offsetHere(s, fx, fy); if (!w) return false;
        st.offAt = w; const inp = doc.getElementById("skOffT"); if (inp) inp.value = w.dist;
        offsetApply(w.dist); return false;
      },
      hover(e, fx, fy) {
        const L = cur(); if (!L) return;
        const s = L.sketch;
        if (!st.off) { const hit = K().pick(s, fx, fy, tol(), { entsOnly: true, axes: false }); st.offHover = hit && hit.k === "ent" ? chainAt(s, hit.id) : null; }
        else { st.offAt = offsetHere(s, fx, fy); const inp = doc.getElementById("skOffT"); if (inp && st.offAt && doc.activeElement !== inp) inp.value = st.offAt.dist; }
        E.drawOverlay();
      },
    });
    function mirrorSel() {
      const L = cur(); if (!L) return say("pick a sketch layer first");
      const ids = pickedEnts(L.sketch), lines = ids.filter((id) => K().ent(L.sketch, id).t === "line");
      if (ids.length < 2 || !lines.length) return say("Mirror: pick what to mirror, then the mirror line LAST (Shift-click)");
      const axis = [...ids].reverse().find((id) => K().ent(L.sketch, id).t === "line");
      let r = null; edit(L, "sketch mirror", (sk) => { r = K().mirror(sk, ids.filter((x) => x !== axis), axis); if (!r.ok) return false; });
      say(r && r.ok ? `Mirror: ${r.ents.length} entit${r.ents.length === 1 ? "y" : "ies"} (kept symmetric)` : "Mirror: the sketch could not take it");
    }
    function patternDialog(kind) {
      const L = cur(); if (!L) return say("pick a sketch layer first");
      const s0 = L.sketch, ids = pickedEnts(s0).filter((id) => K().ent(s0, id).t !== "point" || kind === "rect");
      if (!ids.length) return say("Pattern: pick the entities to copy first");
      const centre = kind === "circ" ? (sel.filter((q) => q.k === "pt").map((q) => q.id)[0] || s0.origin.pt) : null;
      E.ui.dialog(kind === "rect" ? "Rectangular Pattern" : "Circular Pattern", kind === "rect"
        ? `<div class="rw"><span>Columns · gap (px)</span><input type="number" id="skPnx" min="1" max="50" value="3"><input type="number" id="skPdx" step="1" value="100"></div><div class="rw"><span>Rows · gap (px)</span><input type="number" id="skPny" min="1" max="50" value="1"><input type="number" id="skPdy" step="1" value="100"></div>`
        : `<div class="rw"><span>How many (with the first)</span><input type="number" id="skPn" min="2" max="72" value="6"></div><div class="rw"><span>Over (degrees)</span><input type="number" id="skPa" min="1" max="360" value="360"></div><div style="padding:4px 10px;color:var(--pc-dim)">Round ${centre === s0.origin.pt ? "the origin (pick a point too to turn round it)" : "the picked point"}.</div>`,
      (dl) => {
        const q = (id) => +dl.querySelector("#" + id).value; let r = null;
        edit(L, kind === "rect" ? "sketch rectangular pattern" : "sketch circular pattern", (sk) => { r = kind === "rect" ? K().patternRect(sk, ids, Math.max(1, Math.min(50, q("skPnx") || 1)), Math.max(1, Math.min(50, q("skPny") || 1)), q("skPdx") || 0, q("skPdy") || 0) : K().patternCirc(sk, ids, centre, Math.max(2, Math.min(72, q("skPn") || 2)), Math.max(1, Math.min(360, q("skPa") || 360))); if (!r.ok) return false; });
        say(r && r.ok ? `Pattern: ${r.ents.length} copies` : "Pattern: " + ((r && r.why) || "the sketch could not take it"));
      }, { okLabel: "Copy" });
    }
    function profilesToShapes() {
      const L = cur(); if (!L) return say("pick a sketch layer first");
      const pr = K().profiles(L.sketch); if (!pr.length) return say("no closed profile in the sketch (lines / arcs that meet at their points, or circles)");
      const Q = root.PCPath, B = root.PCBez;
      E.structOp("profiles to shapes", () => {
        let i = 0;
        for (const p of pr.filter((x) => !pr.some((y) => y !== x && (y.holes || []).includes(x)))) {
          const N = E.makeLayer(`${L.name} profile ${++i}`, S.w, S.h, "shape");
          N.shape = Object.assign({}, D.SHAPE_DEFAULT, { kind: "path", path: p.path, fill: L.sketch.style.fill || "#c8d6e5", fillOn: true, stroke: L.sketch.style.color || "#000000", strokeW: L.sketch.style.w || 2, strokeOn: true });
          if (B && B.LINE_DEFAULT) N.shape.line = Object.assign({}, B.LINE_DEFAULT);
          if (Q) Q.syncShape(N.shape); D.rasterize(N);
          S.layers = D.insert(S.layers, N, L.id, false);
        }
        S.active = S.layers.indexOf(L);
      });
      say(`${pr.length} closed profile(s) → shape layers above the sketch`);
    }
    function finish() {
      sel = []; reset(); E.setTool("move");
      const ui = E.cadBar && E.cadBar.ui;                      // 2.494.0: on to the SOLID tab (Extrude / Revolve the profiles)
      if (ui && ui.spec && ui.spec().tabs.some((x) => x.id === "solid")) ui.setTab("solid");
      say("sketch finished - SOLID ▸ Extrude / Revolve its profiles (or pick it and a sketch tool (N) to go on)");
    }

    /* ---- the 📐 Sketch tab */
    const ctl = kx.querySelector('.pcgrp .pctabs [data-tab="kxCtl"]');
    if (ctl) {
      const tabs = ctl.parentElement, holder = tabs.parentElement;
      const b = doc.createElement("button"); b.type = "button"; b.dataset.tab = "ksk"; b.dataset.grp = "props"; b.textContent = "📐 Sketch";
      b.onclick = () => E.ui.showTab("ksk");
      const after = tabs.querySelector('[data-tab="k3d"]') || ctl; after.after(b);
      const body = doc.createElement("div"); body.className = "pcbody kxsec"; body.dataset.body = "ksk"; body.id = "kskBody"; holder.appendChild(body);
      const css = doc.createElement("style");
      css.textContent = ".pcgrp[data-g=\"props\"] .pctabs{flex-wrap:wrap}#kskBody{padding:6px 8px;font-size:11px}#kskBody .r{display:flex;gap:3px;align-items:center;margin:3px 0;flex-wrap:wrap}#kskBody h5{margin:8px 0 2px;font-size:11px}"
        + "#kskBody .cb{min-width:0;padding:2px 6px}#kskBody .dof{font-weight:600}#kskBody .dof.ok{color:#3fb950}#kskBody input[type=number]{width:52px}";
      doc.head.appendChild(css);
      const prev = E.ui.showTab;
      E.ui.showTab = function (id) { const r = prev.apply(this, arguments); if (id === "ksk") paint(); return r; };
    }
    const CBTN = [["coincident", "⊙ Coincident"], ["collinear", "⋯ Collinear"], ["concentric", "◎ Concentric"], ["midpoint", "△ Midpoint"], ["fix", "🔒 Fix"], ["parallel", "∥ Parallel"], ["perpendicular", "⊥ Perpendicular"],
      ["horizontal", "— Horizontal"], ["vertical", "| Vertical"], ["tangent", "◠ Tangent"], ["equal", "= Equal"], ["symmetric", "⇹ Symmetric"]];
    function paint() {
      const body = $("kskBody"); if (!body || !body.classList.contains("on")) return;
      if (body.contains(doc.activeElement) && /INPUT|SELECT/.test(doc.activeElement.tagName)) return;
      const L = cur();
      if (!L) { body.innerHTML = `<div style="color:var(--pc-dim)">Pick a sketch layer - or <button type="button" class="ghost" id="skNew">＋ New Sketch</button></div>`; $("skNew").onclick = () => newSketch(); return; }
      const s = L.sketch, df = dofOf(s), stl = s.style || {};
      const n = { pts: s.pts.length, ents: s.ents.filter((e) => !e.axis).length, cons: s.cons.filter((k) => !(k.t === "fix" && K().isOrigin(s, k.a))).length, dims: s.dims.length };
      body.innerHTML = `<div class="r"><b>${esc(L.name)}</b><span class="dof${df && df.dof === 0 ? " ok" : ""}">${df ? (df.dof === 0 ? "✓ fully constrained" : df.dof + " degree(s) of freedom") : ""}</span></div>
        <div class="r" style="color:var(--pc-dim)">${n.ents} entities · ${n.cons} constraints · ${n.dims} dimensions · ${sel.length} picked</div>
        <h5>Constraints (for what is picked)</h5>
        <div class="r">${CBTN.map(([t, l]) => `<button type="button" class="ghost cb" data-con="${t}" title="${esc(K().CON_NAMES[t])}">${esc(l)}</button>`).join("")}</div>
        <h5>Modify (what is picked)</h5>
        <div class="r"><button type="button" class="ghost cb" id="skOffset" title="Offset the picked lines / arcs / circles (a joined chain stays joined)">⇉ Offset…</button><button type="button" class="ghost cb" id="skMirror" title="Mirror the picked entities about the LAST picked line">⇋ Mirror</button>
          <button type="button" class="ghost cb" id="skRectPat" title="Copies in rows and columns">▦ Rectangular Pattern…</button><button type="button" class="ghost cb" id="skCircPat" title="Copies round a picked point (or the origin)">✺ Circular Pattern…</button></div>
        <div class="r"><button type="button" class="ghost" id="skCons" title="Construction (X): dashed, never drawn in the picture">⋯ Construction</button><button type="button" class="ghost" id="skDel" title="Delete what is picked">🗑 Delete</button></div>
        <h5>Draw</h5>
        <div class="r">${TOOLS.map(([t, nm]) => `<button type="button" class="ghost cb${S.tool === t ? " on" : ""}" data-tool="${t}" title="${esc(nm)}">${esc(nm.replace(/ Tool.*$/, "").replace("Sketch ", ""))}</button>`).join("")}</div>
        <h5>In the picture</h5>
        <div class="r"><label>Lines <input type="color" id="skColor" value="${esc(stl.color || "#000000")}"></label><label>Width <input type="number" id="skW" min="0.5" max="40" step="0.5" value="${esc(stl.w || 2)}"></label></div>
        <div class="r"><label title="Fill the closed profiles"><input type="checkbox" id="skFillOn"${stl.fill ? " checked" : ""}> Fill profiles</label><input type="color" id="skFill" value="${esc(stl.fill || "#c8d6e5")}"><label><input type="checkbox" id="skDims"${stl.showDims ? " checked" : ""}> Dimensions</label></div>
        <div class="r"><button type="button" class="ghost" id="skProf" title="Each closed profile as a shape layer (fill, outline, ✨ generate into it…)">⬚ Profiles → Shapes</button><button type="button" id="skFinish">✓ Finish Sketch</button></div>`;
      body.querySelectorAll("[data-con]").forEach((x) => { x.onclick = () => constrain(x.dataset.con); });
      body.querySelectorAll("[data-tool]").forEach((x) => { x.onclick = () => E.setTool(x.dataset.tool); });
      $("skCons").onclick = toggleCons; $("skDel").onclick = () => (sel.length ? delSel() : say("pick something to delete"));
      const setStyle = (f, label) => { const Lc = cur(); if (Lc) edit(Lc, label, (sk) => { sk.style = Object.assign({}, sk.style); f(sk.style); }); };
      $("skColor").onchange = (e) => setStyle((x) => { x.color = e.target.value; }, "sketch line colour");
      $("skW").onchange = (e) => setStyle((x) => { x.w = Math.max(0.5, +e.target.value || 2); }, "sketch line width");
      $("skFillOn").onchange = (e) => setStyle((x) => { x.fill = e.target.checked ? $("skFill").value : ""; }, "sketch fill");
      $("skFill").onchange = (e) => setStyle((x) => { if (x.fill) x.fill = e.target.value; }, "sketch fill");
      $("skDims").onchange = (e) => setStyle((x) => { x.showDims = e.target.checked; }, "sketch dimensions shown");
      $("skProf").onclick = profilesToShapes; $("skFinish").onclick = finish;
      $("skOffset").onclick = offsetDialog; $("skMirror").onclick = mirrorSel; $("skRectPat").onclick = () => patternDialog("rect"); $("skCircPat").onclick = () => patternDialog("circ");
      for (const f of tabHooks) { try { f(body, L); } catch (er) { /* a hook's own trouble */ } }
      body.querySelectorAll("input").forEach((x) => x.addEventListener("keydown", (ev) => ev.stopPropagation()));
    }
    const tabHooks = [];
    // the tab follows the picked layer / every change
    const prevHist = E.ui.history;
    E.ui.history = function () { const r = prevHist ? prevHist.apply(this, arguments) : undefined; try { const L = cur(); if (!L) sel = []; paint(); } catch (er) { /* fine */ } return r; };
    // a sketch tool picked: the tab shows (once per session)
    const prevSet = E.setTool;
    let shown = false;
    E.setTool = function (t) { const r = prevSet.apply(this, arguments); if (SKTOOLS.has(t) && !shown && E.ui.showTab) { shown = true; E.ui.showTab("ksk"); } reset(); paint(); return r; };

    /* ---- commands */
    const C = E.ui.addCmd;
    C("layer.newsketch", "New Sketch", "", () => newSketch(), {}, ["Layer", null, true]);
    C("sketch.finish", "Finish Sketch", "", finish, { enabled: () => !!cur() }, ["Layer", "layer.newsketch"]);
    C("sketch.profiles", "Sketch Profiles → Shapes", "", profilesToShapes, { enabled: () => !!cur() }, ["Layer", "sketch.finish"]);
    for (const [id, nm] of TOOLS) C("tool." + id, nm, "", () => E.setTool(id), {});
    E.sketch = { newSketch, edit, constrain, delSel, toggleCons, profilesToShapes, finish, offsetDialog, offsetTool, offsetApply, chainAt, offPicked: () => (st.off ? st.off.ids.slice() : null), plusHandles: () => { const L = cur(); return L ? plusHandles(L.sketch) : []; }, mirrorSel, patternDialog, endSpline, sel: () => sel.slice(), setSel: (x) => { sel = x.slice(); paint(); E.drawOverlay(); }, dof: () => { const L = cur(); return L ? dofOf(L.sketch) : null; }, openInput, paint, keyFor, reset, tabHooks, tol, cur, openHud, commitTyped, hideHud, typed: () => (st.typed ? Object.assign({}, st.typed) : null), state: () => ({ pts: st.pts.length, last: st.lastSn && st.lastSn.pt, chain: st.chainStart, dimPick: (st.dimPick || []).slice() }) };
  }

  const PCSketchTools = { TOOLS, LETTERS, conFor, dimFor, snapFor, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCSketchTools;
  else root.PCSketchTools = PCSketchTools;
})(typeof window !== "undefined" ? window : globalThis);
