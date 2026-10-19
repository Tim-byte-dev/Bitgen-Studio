/* pcdimauto.js — AUTO DIMENSION, FLOORPLAN DIMENSIONS and the CHAIN DIMENSION tool (2.458.0), window.PCDimAuto.
 *
 * Tim (verbatim): "add an auto dimension feature and floorplan dimension feature" - asked: floorplan = both (every wall
 * of a closed shape + the overall width / height; a chain along clicked points + the total).
 *
 *   AUTO DIMENSION        (Layer ▸ Auto Dimension, ⊞ on a dimension tool's bar) the picked object's overall width
 *                         (above it) and height (beside it) as two dimension groups, held in one group.
 *   FLOORPLAN DIMENSIONS  (Layer ▸ Floorplan Dimensions…, ⌂ on the bar) a closed shape (a room / a floor plan drawn
 *                         with the shape / line tools): a dimension group on the OUTSIDE of every wall, the overall
 *                         width + height further out - all in one group (a layer that is not a shape: its box).
 *   CHAIN DIMENSION tool  (F8 group) click points along a wall (they snap to nodes / corners like the other dimension
 *                         tools); Enter or a double-click ends; then click where the dimension line goes: a dimension
 *                         between every two points on one line + the TOTAL further out. Horizontal or vertical by how
 *                         the points run (Shift = horizontal, Ctrl = vertical); Backspace takes the last point back.
 * Every dimension made is an ordinary dimension group (pcdimgroup.js): its parts drag, its number uses the scale.
 * Pure (Node: scripts/test-dimauto.js): polysOf, signedArea, outward, wallDefs, overallDefs, floorplanDefs, chainKind,
 * chainDefs.
 */
(function (root) {
  "use strict";
  const G0 = () => root.PCDimGroup || (typeof require === "function" ? require("./pcdimgroup.js") : null);
  const mk = (kind, a, b, m, o) => G0().makeDef(kind, a, b, m, o);
  const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.5;
  /** a path's closed outlines as point lists (a curve by its nodes) */
  function polysOf(path) {
    const out = [];
    for (const s of (path && path.subs) || []) {
      if (!s.closed || !s.pts || s.pts.length < 3) continue;
      const p = [];
      for (const a of s.pts) { const q = [a.x, a.y]; if (!p.length || !near(p[p.length - 1], q)) p.push(q); }
      if (p.length > 2 && near(p[0], p[p.length - 1])) p.pop();
      if (p.length >= 3) out.push(p);
    }
    return out;
  }
  const boxPoly = (b) => [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];
  function signedArea(p) { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length]; a += q[0] * r[1] - r[0] * q[1]; } return a / 2; }
  /** the outward normal of edge i (i -> i + 1) */
  function outward(p, i) {
    const a = p[i], b = p[(i + 1) % p.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    return signedArea(p) > 0 ? [u[1], -u[0]] : [-u[1], u[0]];
  }
  /** a dimension on the outside of every wall (edge), `off` px out */
  function wallDefs(p, off, o) {
    const out = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length]; if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1) continue;
      const n = outward(p, i), m = [(a[0] + b[0]) / 2 + n[0] * off, (a[1] + b[1]) / 2 + n[1] * off];
      out.push(mk("parallel", a, b, m, o));
    }
    return out;
  }
  /** the overall width (above, `off` px over the top) and height (beside, `off` px right of the right side) of points */
  function overallDefs(pts, off, o) {
    if (!pts || pts.length < 2) return [];
    let L = pts[0], R = pts[0], T = pts[0], B = pts[0], minY = Infinity, maxX = -Infinity;
    for (const q of pts) {
      if (q[0] < L[0] - 1e-9 || (Math.abs(q[0] - L[0]) < 1e-9 && q[1] < L[1])) L = q;
      if (q[0] > R[0] + 1e-9 || (Math.abs(q[0] - R[0]) < 1e-9 && q[1] < R[1])) R = q;
      if (q[1] < T[1] - 1e-9 || (Math.abs(q[1] - T[1]) < 1e-9 && q[0] > T[0])) T = q;
      if (q[1] > B[1] + 1e-9 || (Math.abs(q[1] - B[1]) < 1e-9 && q[0] > B[0])) B = q;
      minY = Math.min(minY, q[1]); maxX = Math.max(maxX, q[0]);
    }
    const out = [];
    if (R[0] - L[0] >= 1) out.push(mk("horizontal", L, R, [(L[0] + R[0]) / 2, minY - off], o));
    if (B[1] - T[1] >= 1) out.push(mk("vertical", T, B, [maxX + off, (T[1] + B[1]) / 2], o));
    return out;
  }
  /** a floor plan: every wall at `off`, the overall size at `off2` (o.walls / o.overall: false = leave out) */
  function floorplanDefs(polys, off, off2, o) {
    const x = o || {}, out = [];
    if (x.walls !== false) for (const p of polys) out.push(...wallDefs(p, off, x));
    if (x.overall !== false) out.push(...overallDefs([].concat(...polys), off2, x));
    return out;
  }
  /** horizontal when the points run more across than up / down */
  function chainKind(pts) { const a = pts[0], b = pts[pts.length - 1]; return Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? "horizontal" : "vertical"; }
  /** a chain: a dimension between every two points (in order along the line) on the line through m + the total `step` px further out */
  function chainDefs(pts0, kind, m, step, o) {
    const ax = kind === "vertical" ? 1 : 0;
    const pts = pts0.slice().sort((p, q) => p[ax] - q[ax]);
    const out = [];
    for (let i = 0; i + 1 < pts.length; i++) if (Math.abs(pts[i + 1][ax] - pts[i][ax]) >= 0.5) out.push(mk(kind, pts[i], pts[i + 1], m, o));
    if (out.length > 1) {
      const other = 1 - ax, mean = pts.reduce((s, q) => s + q[other], 0) / pts.length, sg = Math.sign(m[other] - mean) || -1;
      const m2 = m.slice(); m2[other] = m[other] + sg * step;
      out.push(mk(kind, pts[0], pts[pts.length - 1], m2, o));
    }
    return out;
  }

  /* ================================ the editor ================================ */
  function install(E) {
    const S = E.S, doc = E.doc || root.document, say = E.say, DGr = () => E.dimGroups;
    if (!E.ui || !E.tools || !E.dimGroups || !E.dims) return;
    const P = G0();
    S.cd = S.cd || {};
    const off = () => Math.max(4, +S.cd.fpOff || 30);
    const opts = () => DGr().defOpts();
    /** the picked object's outlines: a shape's closed paths, else its box */
    function outlinesOf(L) {
      if (!L || L.type === "adjust" || L.type === "fill" || DGr().groupOf(L) || L.dimSet) return [];
      if (L.type === "shape" && L.shape && L.shape.kind === "path" && L.shape.path) { const ps = polysOf(L.shape.path); if (ps.length) return ps; }
      if (L.type === "shape" && L.shape && L.shape.path) { const ps = polysOf(L.shape.path); if (ps.length) return ps; }
      const b = E.dockers ? E.dockers.boxOf(L) : null;
      return b && b.w > 0 && b.h > 0 ? [boxPoly(b)] : [];
    }
    const nameOf = (L) => (L && L.name) || "object";
    function autoDimension() {
      if (!S.w) return say("open a picture first");
      const L = E.layer(), ps = outlinesOf(L); if (!ps.length) return say("pick an object (a shape or a layer with something on it) to dimension");
      const defs = overallDefs([].concat(...ps), off(), opts());
      if (!defs.length) return say("nothing to measure there");
      const r = DGr().createMany(defs.map((def) => ({ def })), "Size of " + nameOf(L), "auto dimension");
      say(`auto dimension: ${r.groups.map((G) => DGr().textFor(G.dimg.len)).join(" × ")} - each dimension is a group you can drag (Layers: "${r.wrap.name}")`);
      return r;
    }
    function floorplan(o) {
      if (!S.w) return say("open a picture first");
      const x = Object.assign({ walls: true, overall: true }, o || {});
      const L = E.layer(), ps = outlinesOf(L); if (!ps.length) return say("pick a closed shape (a room drawn with the shape / line tools) for floorplan dimensions");
      const k = off(), defs = floorplanDefs(ps, k, x.walls ? k * 2 + ((S.cd.tsize || 14) * 0.6) : k, Object.assign({}, opts(), x));
      if (!defs.length) return say("nothing to measure there");
      const r = DGr().createMany(defs.map((def) => ({ def })), "Floorplan " + nameOf(L), "floorplan dimensions");
      say(`floorplan: ${r.groups.length} dimension(s) on ${nameOf(L)}${x.walls ? " - every wall" : ""}${x.overall ? " + the overall size" : ""}`);
      return r;
    }
    function floorplanDialog() {
      E.ui.dialog("Floorplan Dimensions", `<div class="rw"><span>Distance from the walls (px)</span><input type="number" id="fpOff" min="4" step="1" value="${off()}"></div>
        <div class="rw"><span>Every wall</span><input type="checkbox" id="fpWalls" checked></div>
        <div class="rw"><span>Overall width + height</span><input type="checkbox" id="fpAll" checked></div>
        <div style="padding:4px 10px;color:var(--pc-dim)">Pick a closed shape first (a room or the outline of a plan). Each dimension is a group you can drag; all of them are held in one group.</div>`,
      (dl) => { S.cd.fpOff = Math.max(4, +dl.querySelector("#fpOff").value || 30); floorplan({ walls: dl.querySelector("#fpWalls").checked, overall: dl.querySelector("#fpAll").checked }); },
      { okLabel: "Dimension" });
    }

    /* ---- the Chain Dimension tool */
    const ch = { pts: [], ph: 0, hover: null, mods: null };
    const reset = () => { ch.pts = []; ch.ph = 0; E.drawOverlay(); };
    const step = () => Math.max(16, (S.cd.tsize || 14) * 1.6 + 8);
    function chainNow(e) {
      const kind = e && e.shiftKey ? "horizontal" : e && (e.ctrlKey || e.metaKey) ? "vertical" : chainKind(ch.pts);
      return chainDefs(ch.pts, kind, ch.hover || ch.pts[0], step(), opts());
    }
    function finishPts() {
      if (ch.pts.length < 2) { say("Chain Dimension: click at least two points"); return; }
      ch.ph = 1; say(`Chain Dimension: ${ch.pts.length} points - now click where the dimension line goes (Shift = horizontal, Ctrl = vertical)`); E.drawOverlay();
    }
    const bar = () => `<span class="sep"></span><label title="How far auto / floorplan dimensions sit from the object (px)">↔ <input type="number" id="cdOff" min="4" step="1" value="${off()}" style="width:52px"></label>`
      + `<button type="button" class="ghost" id="cdAuto" title="Auto Dimension: the picked object's overall width + height">⊞ Auto</button>`
      + `<button type="button" class="ghost" id="cdPlan" title="Floorplan Dimensions: every wall of the picked closed shape + the overall size">⌂ Floorplan</button>`;
    const bindBar = (o) => {
      const q = (id) => o.querySelector("#" + id);
      if (q("cdOff")) { q("cdOff").onchange = (ev) => { S.cd.fpOff = Math.max(4, +ev.target.value || 30); }; q("cdOff").addEventListener("keydown", (ev) => ev.stopPropagation()); }
      if (q("cdAuto")) q("cdAuto").onclick = () => autoDimension();
      if (q("cdPlan")) q("cdPlan").onclick = () => floorplan();
    };
    E.tools.cdimchain = {
      id: "cdimchain", name: "Chain Dimension", cursor: "crosshair",
      options: () => `<span class="hint">click points along a wall (they snap) · Enter / double-click ends · then click where the line goes · Shift = horizontal, Ctrl = vertical · Backspace = the last point back</span>` + bar(),
      bindOptions: bindBar,
      down(e, fx, fy) {
        if (!S.w) return false;
        if (ch.ph === 1) {
          ch.hover = [fx, fy];
          const defs = chainNow(e);
          if (!defs.length) { say("those points do not run along a line - try again"); reset(); return false; }
          const r = DGr().createMany(defs.map((def) => ({ def })), "Chain Dimension " + (S.layers.filter((x) => x.dimSet && /^Chain/.test(x.name)).length + 1), "chain dimension");
          const tot = r.groups.length > 1 ? r.groups[r.groups.length - 1] : r.groups[0];
          say(`chain: ${r.groups.length > 1 ? r.groups.length - 1 : 1} dimension(s), total ${DGr().textFor(tot.dimg.len)}`);
          reset(); return false;
        }
        const p = [fx, fy];
        if (ch.pts.length && near(ch.pts[ch.pts.length - 1], p)) return false;   // a double-click's second press
        ch.pts.push(p); ch.hover = p;
        say(`Chain Dimension: ${ch.pts.length} point(s)${ch.pts.length > 1 ? " - Enter / double-click ends" : ""}`); E.drawOverlay();
        return false;
      },
      dblclick() { if (ch.ph === 0 && ch.pts.length >= 2) finishPts(); },
      hover(e, fx, fy) { const r = ch.ph === 0 ? E.dims.snap(fx, fy, e) : null; ch.hover = r ? [r.x, r.y] : [fx, fy]; ch.mods = e; E.drawOverlay(); },
      key(e) {
        if (e.key === "Escape" && (ch.pts.length || ch.ph)) { reset(); return true; }
        if (e.key === "Enter" && ch.ph === 0 && ch.pts.length) { finishPts(); return true; }
        if (e.key === "Backspace" && ch.ph === 0 && ch.pts.length) { ch.pts.pop(); E.drawOverlay(); return true; }
        return false;
      },
      leave() { reset(); },
    };
    // ⊞ / ⌂ on the other dimension tools' bars too
    for (const id of ["cdimpar", "cdimhv"]) {
      const T = E.tools[id]; if (!T || !T.options) continue;
      const o0 = T.options, b0 = T.bindOptions;
      T.options = function () { return o0.apply(this, arguments) + bar(); };
      T.bindOptions = function (o) { if (b0) b0.call(this, o); bindBar(o); };
    }
    E.overlayHooks.push((g, px) => {
      if (S.tool !== "cdimchain" || !ch.pts.length) return;
      g.save(); g.strokeStyle = "#ff3cac"; g.fillStyle = "#ff3cac"; g.lineWidth = 1.2 * px; g.setLineDash([4 * px, 3 * px]);
      g.beginPath(); ch.pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); if (ch.ph === 0 && ch.hover) g.lineTo(ch.hover[0], ch.hover[1]); g.stroke();
      g.setLineDash([]); for (const q of ch.pts) { g.beginPath(); g.arc(q[0], q[1], 3.5 * px, 0, Math.PI * 2); g.fill(); }
      if (ch.ph === 1 && ch.hover) {
        g.strokeStyle = "#2680eb"; g.fillStyle = "#2680eb"; g.font = `${12 * px}px sans-serif`;
        for (const def of chainNow(ch.mods)) { const G2 = P.geom(def); g.beginPath(); for (const x of G2.ext) { g.moveTo(x.s[0], x.s[1]); g.lineTo(x.e[0], x.e[1]); } g.moveTo(G2.d0[0], G2.d0[1]); g.lineTo(G2.d1[0], G2.d1[1]); g.stroke(); g.fillText(DGr().textFor(G2.len), G2.label.x + 3 * px, G2.label.y - 3 * px); }
      }
      g.restore();
    });
    const C = E.ui.addCmd;
    C("tool.cdimchain", "Chain Dimension Tool", "", () => E.setTool("cdimchain"), {});
    C("layer.autodim", "Auto Dimension", "", autoDimension, { enabled: () => !!S.w }, ["Layer", "layer.dimscale"]);
    C("layer.floorplan", "Floorplan Dimensions…", "", floorplanDialog, { enabled: () => !!S.w }, ["Layer", "layer.autodim"]);
    E.dimAuto = { autoDimension, floorplan, floorplanDialog, outlinesOf, chain: () => ({ pts: ch.pts.slice(), ph: ch.ph }) };
  }

  const PCDimAuto = { polysOf, boxPoly, signedArea, outward, wallDefs, overallDefs, floorplanDefs, chainKind, chainDefs, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCDimAuto;
  else root.PCDimAuto = PCDimAuto;
})(typeof window !== "undefined" ? window : globalThis);
