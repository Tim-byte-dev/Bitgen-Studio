/* pcdockers.js — CORELDRAW'S DOCKERS IN THE IMAGE EDITOR: TRANSFORM, SHAPING, ALIGN AND DISTRIBUTE, OBJECT PROPERTIES
 * (2.429.0), window.PCDockers.
 *
 * Tim (verbatim, with the 2.425.0 plan): "i would like all the drawing tools from coreldraw and the tool dockers" - the
 * agreed order: the drawing tools (2.428.0), then the dockers. A panel group of their own under Properties (Window ▸
 * Dockers ▸ …; hidden until opened). They work on the PICKED layers (Ctrl-click in Layers) or the active one:
 *
 *   TRANSFORM        Position (x / y, relative), Rotate (angle), Scale and Mirror (%, proportional, ⇆ ⇅), Size (w / h,
 *   (Alt+F7)         proportional), Skew (x° / y°) - about one of 9 anchor points of the box, Copies (each copy one more
 *                    step: 0 = the object itself); vector lines / shapes / paths exactly, pixel layers re-drawn, type
 *                    moved / scaled
 *   SHAPING          Weld, Trim, Intersect, Simplify, Front Minus Back, Back Minus Front, Boundary - on vector shapes
 *                    (anything with a path; plain shape layers become paths); Leave Original source / target
 *   ALIGN AND        left / centre / right, top / middle / bottom to the active layer, the selection's box, the page
 *   DISTRIBUTE       edge or the page centre; distribute left / centres / right / spacing, top / centres / bottom /
 *   (Ctrl+Shift+A)   spacing - over the selection or the page
 *   OBJECT           the active vector shape's fill (none, uniform, linear / radial gradient: two colours + angle),
 *   PROPERTIES       outline (width, colour, style), transparency (opacity, blend mode)
 *
 * Pure (Node: scripts/test-psdockers.js): ANCHORS + anchorPt, matrices (mTranslate, mRotate, mScale, mSkew, mMul,
 * about, isRigidScale), transformFor (the docker's settings -> a matrix for a box), alignMoves, distributeMoves,
 * shapingPlan (which masks are combined how, who survives).
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const ANCHORS = ["tl", "t", "tr", "l", "c", "r", "bl", "b", "br"];
  function anchorPt(b, a) {
    const fx = /l$/.test(a) && a !== "c" ? 0 : /r$/.test(a) ? 1 : 0.5, fy = /^t/.test(a) ? 0 : /^b/.test(a) ? 1 : 0.5;
    return [b.x + b.w * (a === "l" ? 0 : fx), b.y + b.h * fy];
  }
  // a matrix [a, b, c, d, e, f] (a canvas transform: x' = a x + c y + e, y' = b x + d y + f)
  const I = [1, 0, 0, 1, 0, 0];
  const mTranslate = (dx, dy) => [1, 0, 0, 1, dx, dy];
  const mRotate = (deg) => { const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return [c, s, -s, c, 0, 0]; };
  const mScale = (sx, sy) => [sx, 0, 0, sy, 0, 0];
  const mSkew = (ax, ay) => [1, Math.tan(ay * Math.PI / 180), Math.tan(ax * Math.PI / 180), 1, 0, 0];
  /** p then q (q applied after p) */
  const mMul = (q, p) => [q[0] * p[0] + q[2] * p[1], q[1] * p[0] + q[3] * p[1], q[0] * p[2] + q[2] * p[3], q[1] * p[2] + q[3] * p[3], q[0] * p[4] + q[2] * p[5] + q[4], q[1] * p[4] + q[3] * p[5] + q[5]];
  /** m about the point (x, y) */
  const about = (m, x, y) => mMul(mTranslate(x, y), mMul(m, mTranslate(-x, -y)));
  const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const isRigidScale = (m) => Math.abs(m[1]) < 1e-9 && Math.abs(m[2]) < 1e-9;
  /** the docker's settings for a box -> a matrix. o = {tab: position | rotate | scale | size | skew, x, y, rel, angle,
   *  sx, sy, w, h, mirrorH, mirrorV, anchor} */
  function transformFor(o, b) {
    const [ax, ay] = anchorPt(b, o.anchor || "c");
    switch (o.tab) {
      case "position": return o.rel ? mTranslate(+o.x || 0, +o.y || 0) : mTranslate((+o.x || 0) - ax, (+o.y || 0) - ay);
      case "rotate": return about(mRotate(-(+o.angle || 0)), ax, ay);              // CorelDRAW: + = counter-clockwise
      case "scale": return about(mScale((+o.sx || 100) / 100 * (o.mirrorH ? -1 : 1), (+o.sy || 100) / 100 * (o.mirrorV ? -1 : 1)), ax, ay);
      case "size": return about(mScale(b.w > 1e-9 ? Math.max(0.01, +o.w || b.w) / b.w : 1, b.h > 1e-9 ? Math.max(0.01, +o.h || b.h) / b.h : 1), ax, ay);
      case "skew": return about(mSkew(+o.x || 0, +o.y || 0), ax, ay);
      default: return I.slice();
    }
  }
  /** a box through a matrix (its four corners' box) */
  function boxThrough(m, b) {
    const pts = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].map(([x, y]) => apply(m, x, y));
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }
  const union = (bs) => { const x0 = Math.min(...bs.map((b) => b.x)), y0 = Math.min(...bs.map((b) => b.y)), x1 = Math.max(...bs.map((b) => b.x + b.w)), y1 = Math.max(...bs.map((b) => b.y + b.h)); return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; };
  /** Align: items [{id, box}], how = left | hcenter | right | top | vcenter | bottom, to = active | first | selection |
   *  page-edge | page-center; page {w, h}; activeId -> [{id, dx, dy}] */
  function alignMoves(items, how, to, page, activeId) {
    if (!items.length) return [];
    let ref;
    if (to === "page-edge" || to === "page-center") ref = { x: 0, y: 0, w: page.w, h: page.h };
    else if (to === "selection") ref = union(items.map((i) => i.box));
    else ref = (items.find((i) => i.id === activeId) || items[to === "first" ? 0 : items.length - 1]).box;
    const centre = to === "page-center";
    return items.map((i) => {
      const b = i.box; let dx = 0, dy = 0;
      if (how === "left") dx = (centre ? ref.x + ref.w / 2 : ref.x) - b.x;
      else if (how === "right") dx = (centre ? ref.x + ref.w / 2 : ref.x + ref.w) - (b.x + b.w);
      else if (how === "hcenter") dx = ref.x + ref.w / 2 - (b.x + b.w / 2);
      else if (how === "top") dy = (centre ? ref.y + ref.h / 2 : ref.y) - b.y;
      else if (how === "bottom") dy = (centre ? ref.y + ref.h / 2 : ref.y + ref.h) - (b.y + b.h);
      else if (how === "vcenter") dy = ref.y + ref.h / 2 - (b.y + b.h / 2);
      return { id: i.id, dx, dy };
    });
  }
  /** Distribute: how = left | hcenter | right | hspace | top | vcenter | bottom | vspace, over = selection | page */
  function distributeMoves(items, how, over, page) {
    if (items.length < (over === "page" ? 2 : 3)) return items.map((i) => ({ id: i.id, dx: 0, dy: 0 }));
    const hor = /^(left|hcenter|right|hspace)$/.test(how);
    const key = (b) => (hor ? (how === "left" ? b.x : how === "right" ? b.x + b.w : b.x + b.w / 2) : (how === "top" ? b.y : how === "bottom" ? b.y + b.h : b.y + b.h / 2));
    const sorted = items.slice().sort((a, b) => key(a.box) - key(b.box));
    const out = new Map(items.map((i) => [i.id, { id: i.id, dx: 0, dy: 0 }]));
    const ext = over === "page" ? { lo: 0, hi: hor ? page.w : page.h } : null;
    if (how === "hspace" || how === "vspace") {
      const lo = ext ? ext.lo : (hor ? sorted[0].box.x : sorted[0].box.y), hi = ext ? ext.hi : (hor ? sorted[sorted.length - 1].box.x + sorted[sorted.length - 1].box.w : sorted[sorted.length - 1].box.y + sorted[sorted.length - 1].box.h);
      const total = sorted.reduce((a, i) => a + (hor ? i.box.w : i.box.h), 0), gap = (hi - lo - total) / (sorted.length - 1);
      let at = lo;
      for (const i of sorted) { const cur = hor ? i.box.x : i.box.y; const d = at - cur; out.get(i.id)[hor ? "dx" : "dy"] = d; at += (hor ? i.box.w : i.box.h) + gap; }
    } else {
      let lo = key(sorted[0].box), hi = key(sorted[sorted.length - 1].box);
      if (ext) { const half = (b) => (how === "left" || how === "top" ? 0 : how === "right" || how === "bottom" ? (hor ? b.w : b.h) : (hor ? b.w : b.h) / 2); lo = ext.lo + half(sorted[0].box); hi = ext.hi - ((hor ? sorted[sorted.length - 1].box.w : sorted[sorted.length - 1].box.h) - half(sorted[sorted.length - 1].box)); }
      const step = (hi - lo) / (sorted.length - 1);
      sorted.forEach((i, k) => { out.get(i.id)[hor ? "dx" : "dy"] = lo + step * k - key(i.box); });
    }
    return items.map((i) => out.get(i.id));
  }
  /** Shaping: the items bottom -> top (ids), the target (the active one) -> what to combine:
   *  {result: [{op: add | subtract | intersect, ids}], keep: ids that stay, style: the id whose look the result takes,
   *  newLayer: bool, at: the id above which it goes} */
  function shapingPlan(op, ids, target, leaveSource, leaveTarget) {
    const src = ids.filter((i) => i !== target);
    const keepSrc = leaveSource ? src : [], keepT = leaveTarget ? [target] : [];
    switch (op) {
      case "weld": return { steps: [{ op: "add", ids: ids.slice() }], style: target, keep: keepSrc.concat(keepT), at: target };
      case "trim": return { steps: [{ op: "add", ids: [target] }, { op: "subtract", ids: src }], style: target, keep: keepSrc.concat(keepT), at: target };
      case "intersect": return { steps: [{ op: "add", ids: [target] }, { op: "intersect", ids: src }], style: target, keep: keepSrc.concat(keepT), at: target };
      case "frontminusback": { const top = ids[ids.length - 1]; return { steps: [{ op: "add", ids: [top] }, { op: "subtract", ids: ids.slice(0, -1) }], style: top, keep: [], at: top }; }
      case "backminusfront": { const bot = ids[0]; return { steps: [{ op: "add", ids: [bot] }, { op: "subtract", ids: ids.slice(1) }], style: bot, keep: [], at: bot }; }
      case "boundary": return { steps: [{ op: "add", ids: ids.slice() }], style: target, keep: ids.slice(), at: ids[ids.length - 1], outline: true };
      case "simplify": return { simplify: true, ids: ids.slice() };
      default: return null;
    }
  }
  const pure = { ANCHORS, anchorPt, I, mTranslate, mRotate, mScale, mSkew, mMul, about, apply, isRigidScale, transformFor, boxThrough, union, alignMoves, distributeMoves, shapingPlan };
  if (typeof module !== "undefined" && module.exports) { module.exports = Object.assign({ install: null }, pure); return; }

  /* ================================ the editor ================================ */
  function install(E) {
    const Q = root.PCPath, B = root.PCBez;
    if (!Q || !E.ui || !E.ui.addCmd) return;
    const { S, D, doc, $, say, store, ctx, newCanvas } = E;
    const esc = (v) => String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    if (!doc.getElementById("pcdockCss")) {
      const st = doc.createElement("style"); st.id = "pcdockCss";
      st.textContent = ".kx .dk{display:flex;flex-direction:column;gap:6px;font-size:12px}.kx .dk .r{display:flex;gap:5px;align-items:center;flex-wrap:wrap}.kx .dk input[type=number]{width:62px}"
        + ".kx .dk .tabs button{padding:2px 6px}.kx .dk .tabs button.on,.kx .dk .tg.on{border-color:var(--pc-accent);color:var(--pc-accent)}.kx .dk .anc{display:grid;grid-template-columns:repeat(3,14px);gap:2px}"
        + ".kx .dk .anc i{width:14px;height:14px;border:1px solid var(--pc-line);border-radius:3px;cursor:pointer;display:block}.kx .dk .anc i.on{background:var(--pc-accent)}.kx .dk .big button{min-width:34px;padding:3px 6px}.kx .dk .dim{color:var(--pc-dim)}";
      doc.head.appendChild(st);
    }
    const st0 = store.get("dk.s", {}) || {};
    const DS = Object.assign({ tab: "position", anchor: "c", rel: true, x: 0, y: 0, angle: 30, sx: 100, sy: 100, prop: true, w: 100, h: 100, kx: 0, ky: 0, copies: 0, mirrorH: false, mirrorV: false,
      alignTo: "active", distOver: "selection", leaveSrc: false, leaveTgt: false }, st0);
    const save = () => store.set("dk.s", DS);

    /* ---------------- which layers, their boxes ---------------- */
    const picked = () => {
      const ids = new Set((S.picks || []).concat(E.layer() ? [E.layer().id] : []));
      return S.layers.filter((L) => ids.has(L.id) && L.type !== "adjust" && L.type !== "fill" && !L.control);
    };
    // 2.442.0: what is inside a frame follows its frame (pcframes.js), not the group around it
    const leaves = (L) => (L.type === "group" ? D.descendants(S.layers, L.id).filter((x) => x.type !== "group" && !(root.PCFrames && root.PCFrames.underFrame(S.layers, x, L.id))) : [L]);
    function boxOf(L) {
      if (L.type === "group") { const bs = leaves(L).map(boxOf).filter(Boolean); return bs.length ? union(bs) : null; }
      if (L.type === "shape" && L.shape) { if (L.shape.kind === "path") return Q.bbox(L.shape.path); const s = L.shape; return { x: Math.min(s.x, s.x + s.w), y: Math.min(s.y, s.y + s.h), w: Math.abs(s.w), h: Math.abs(s.h) }; }
      if (L.type === "text" && L.text) return D.textBox(L.text, ctx(L.canvas));
      if (L.type === "pixel" || L.type === "smart" || L.type === "sketch") { const b = E.alphaBox(L.canvas); return b && b.w > 0 && b.h > 0 ? b : null; }
      return null;
    }

    /* ---------------- applying a matrix to a layer (one undo step for all) ---------------- */
    function xformLayer(L, m, list) {
      for (const x of leaves(L)) xformLeaf(x, m, list);
    }
    function xformLeaf(L, m, list) {
      const rigid = isRigidScale(m) && Math.abs(m[0] - 1) < 1e-9 && Math.abs(m[3] - 1) < 1e-9;      // a move only
      if (rigid) { E.shiftLayer(L, m[4], m[5], list); return; }
      if (L.type === "shape" && L.shape) {
        if (L.shape.kind !== "path") L.shape = Q.toPathShape(L.shape);
        const keepGen = isRigidScale(m) && m[0] > 0 && m[3] > 0;
        L.shape.path = Q.transform(L.shape.path, m);
        if (!keepGen) { delete L.shape.gen; delete L.shape.media; }
        if (L.shape.line && L.shape.line.spline) L.shape.line = Object.assign({}, L.shape.line, { spline: { closed: L.shape.line.spline.closed, pts: L.shape.line.spline.pts.map(([x, y]) => apply(m, x, y)) } });
        if (L.shape.line && L.shape.line.scaleWith) L.shape.strokeW = Math.round(L.shape.strokeW * Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) * 100) / 100;
        if (L.shape.line && L.shape.line.labels) L.shape.line = Object.assign({}, L.shape.line, { labels: L.shape.line.labels.map((lb) => { const [x, y] = apply(m, lb.x, lb.y); return Object.assign({}, lb, { x, y }); }) });
        Q.syncShape(L.shape); D.rasterize(L);
      } else if (L.type === "sketch" && L.sketch && root.PCSketch) {   // 2.462.0: a sketch's points / radii follow the matrix
        root.PCSketch.transform(L.sketch, m); D.rasterize(L);
      } else if (L.type === "text" && L.text) {
        // 2.452.0: type TURNS too (t.rot) - its centre goes where the matrix takes it, its size by the matrix's scale
        const t = L.text, b0 = (D.textBox0 || D.textBox)(t, ctx(L.canvas)), cx = b0.x + b0.w / 2, cy = b0.y + b0.h / 2, k = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
        if (Math.abs(k - 1) > 1e-6) { t.size = Math.max(1, t.size * k); if (root.PCRuns) root.PCRuns.scale(t, k); if (root.PCType && root.PCType.scale && t.box) root.PCType.scale(t, k, k); }   // 2.449.0: + the per-letter sizes
        // 2.604.0 (Tim: "fix the skew tool"): what is left after the even size - the turn and a SKEW / stretch / flip - stays
        // TYPE: T' = (A / k) · R(rot) · X  ->  rot' = its angle, t.xm = R(-rot') · T' (gone when it is plain)
        const R = (deg) => { const r = deg * Math.PI / 180; return [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r)]; };
        const mul2 = (P, Q2) => [P[0] * Q2[0] + P[2] * Q2[1], P[1] * Q2[0] + P[3] * Q2[1], P[0] * Q2[2] + P[2] * Q2[3], P[1] * Q2[2] + P[3] * Q2[3]];
        const X0 = Array.isArray(t.xm) && t.xm.length === 4 ? t.xm.map(Number) : [1, 0, 0, 1];
        const Tn = mul2([m[0] / k, m[1] / k, m[2] / k, m[3] / k], mul2(R(+t.rot || 0), X0));
        let a = Math.atan2(Tn[1], Tn[0]) * 180 / Math.PI; a = Math.round(a * 1000) / 1000;
        if (Math.abs(a) < 1e-6) delete t.rot; else t.rot = a;
        const X1 = mul2(R(-a), Tn).map((v) => Math.round(v * 1e6) / 1e6);
        if (Math.abs(X1[0] - 1) < 1e-4 && Math.abs(X1[1]) < 1e-4 && Math.abs(X1[2]) < 1e-4 && Math.abs(X1[3] - 1) < 1e-4) delete t.xm; else t.xm = X1;
        const b1 = (D.textBox0 || D.textBox)(t, ctx(L.canvas)), [nx, ny] = apply(m, cx, cy);
        t.x += nx - (b1.x + b1.w / 2); t.y += ny - (b1.y + b1.h / 2);
        D.rasterize(L);
      } else if (L.type === "pixel") {
        const draw = (which) => {
          const c = which === "mask" ? L.mask.canvas : L.canvas, copy = E.beginPx(L, which), g = ctx(c);
          g.save(); g.clearRect(0, 0, c.width, c.height); if (which === "mask") { g.fillStyle = "#000"; }
          g.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); g.imageSmoothingQuality = "high"; g.drawImage(copy, 0, 0); g.restore();
          const px = E.endPx(L, copy, null, "transform", which); if (px) list.push(px);
        };
        draw();
        if (L.mask && L.mask.linked !== false) draw("mask");
      } else if (L.type === "smart" && L.smart && root.PCSmart && root.PCSmart.mapT) {   // 2.452.0: a smart object keeps its contents - its quad is moved
        L.smart.t = root.PCSmart.mapT(L.smart.t, m); L._skey = null; root.PCSmart.render(L);
      }
      if (L.vmask && L.vmask.path && L.vmask.linked !== false && L.type !== "pixel") L.vmask.path = Q.transform(L.vmask.path, m);
    }
    function runOn(label, layers, f) {
      if (!S.w || !layers.length) { say("pick the layer(s) first (Ctrl-click in Layers picks several)"); return false; }
      const before = E.snapStruct(), list = [];
      try { f(list); } catch (e) { E.putStruct(before); say(label + ": " + e.message); return false; }
      list.push({ t: "struct", before, after: E.snapStruct() });
      E.push({ t: "multi", list, label }); E.refresh(); E.renderLayersPanel();
      return true;
    }

    /* ---------------- TRANSFORM ---------------- */
    function doTransform() {
      const Ls = picked(); if (!Ls.length) return say("pick the layer(s) to transform");
      const boxes = Ls.map(boxOf).filter(Boolean); if (!boxes.length) return say("nothing to transform there (empty layer?)");
      const b = union(boxes), o = Object.assign({}, DS, { x: DS.tab === "skew" ? DS.kx : DS.x, y: DS.tab === "skew" ? DS.ky : DS.y });
      const m = transformFor(o, b), n = Math.max(0, Math.min(100, Math.round(+DS.copies || 0)));
      if (!n) runOn("transform", Ls, (list) => { for (const L of Ls) xformLayer(L, m, list); });
      else {
        // copies: each a duplicate of the last, one more step on (Duplicate Layer + the transform: two undo steps a copy)
        let src = Ls.slice();
        for (let k = 0; k < n; k++) {
          const copies = [];
          for (const L of src) { E.setActive(S.layers.indexOf(L)); E.duplicateLayer(); copies.push(E.layer()); }
          runOn("transform copy", copies, (list) => { for (const C of copies) xformLayer(C, m, list); });
          src = copies;
        }
      }
      say(n ? `${n} transformed copies` : "transformed");
    }
    function paintTransform(box) {
      const tabs = [["position", "Position"], ["rotate", "Rotate"], ["scale", "Scale & Mirror"], ["size", "Size"], ["skew", "Skew"]];
      const Ls = picked(), b = Ls.length ? (Ls.map(boxOf).filter(Boolean).length ? union(Ls.map(boxOf).filter(Boolean)) : null) : null;
      if (DS.tab === "size" && b && !DS._sizeTouched) { DS.w = Math.round(b.w); DS.h = Math.round(b.h); }
      const n = (id, v, t, step) => `<input type="number" id="${id}" value="${v}" step="${step || 1}" title="${esc(t)}">`;
      let f = "";
      if (DS.tab === "position") f = `<div class="r">X ${n("dkX", DS.x, "x (px)")} Y ${n("dkY", DS.y, "y (px)")}</div><div class="r"><label><input type="checkbox" id="dkRel" ${DS.rel ? "checked" : ""}> Relative position</label></div>`;
      if (DS.tab === "rotate") f = `<div class="r">Angle ${n("dkA", DS.angle, "degrees (+ = counter-clockwise)", 0.5)}°</div>`;
      if (DS.tab === "scale") f = `<div class="r">X ${n("dkSX", DS.sx, "horizontal %")}% Y ${n("dkSY", DS.sy, "vertical %")}%</div><div class="r"><label><input type="checkbox" id="dkProp" ${DS.prop ? "checked" : ""}> Proportional</label>
        <button class="ghost tg${DS.mirrorH ? " on" : ""}" id="dkMH" title="Mirror horizontally">⇆</button><button class="ghost tg${DS.mirrorV ? " on" : ""}" id="dkMV" title="Mirror vertically">⇅</button></div>`;
      if (DS.tab === "size") f = `<div class="r">W ${n("dkW", DS.w, "width (px)")} H ${n("dkH", DS.h, "height (px)")}</div><div class="r"><label><input type="checkbox" id="dkProp" ${DS.prop ? "checked" : ""}> Proportional</label></div>`;
      if (DS.tab === "skew") f = `<div class="r">X ${n("dkKX", DS.kx, "horizontal skew °", 0.5)}° Y ${n("dkKY", DS.ky, "vertical skew °", 0.5)}°</div>`;
      box.innerHTML = `<div class="dk"><div class="r tabs">${tabs.map(([k, l]) => `<button class="ghost${DS.tab === k ? " on" : ""}" data-dkt="${k}">${l}</button>`).join("")}</div>
        ${f}<div class="r"><span class="anc" title="The point it is done about (Relative center)">${ANCHORS.map((a) => `<i data-anc="${a}" class="${DS.anchor === a ? "on" : ""}" title="${a}"></i>`).join("")}</span>
        <label title="Copies: apply to duplicates (each one more step)">Copies ${n("dkCp", DS.copies, "copies")}</label></div>
        <div class="r"><button class="ghost" id="dkApply">Apply</button><span class="dim">${Ls.length ? `${Ls.length} layer(s)${b ? ` · ${Math.round(b.x)}, ${Math.round(b.y)} · ${Math.round(b.w)} × ${Math.round(b.h)}` : ""}` : "pick a layer"}</span></div></div>`;
      const q = (id) => box.querySelector("#" + id);
      box.querySelectorAll("[data-dkt]").forEach((x) => { x.onclick = () => { DS.tab = x.dataset.dkt; DS._sizeTouched = false; save(); paintTransform(box); }; });
      box.querySelectorAll("[data-anc]").forEach((x) => { x.onclick = () => { DS.anchor = x.dataset.anc; save(); paintTransform(box); }; });
      const bindNum = (id, k, after) => { const el = q(id); if (el) el.onchange = () => { DS[k] = +el.value || 0; if (after) after(); save(); }; };
      bindNum("dkX", "x"); bindNum("dkY", "y"); bindNum("dkA", "angle"); bindNum("dkKX", "kx"); bindNum("dkKY", "ky"); bindNum("dkCp", "copies");
      bindNum("dkSX", "sx", () => { if (DS.prop) { DS.sy = DS.sx; q("dkSY").value = DS.sy; } }); bindNum("dkSY", "sy", () => { if (DS.prop) { DS.sx = DS.sy; q("dkSX").value = DS.sx; } });
      bindNum("dkW", "w", () => { DS._sizeTouched = true; if (DS.prop && b && b.w) { DS.h = Math.round(DS.w * b.h / b.w); q("dkH").value = DS.h; } }); bindNum("dkH", "h", () => { DS._sizeTouched = true; if (DS.prop && b && b.h) { DS.w = Math.round(DS.h * b.w / b.h); q("dkW").value = DS.w; } });
      const rel = q("dkRel"); if (rel) rel.onchange = () => { DS.rel = rel.checked; if (!DS.rel && b) { const [ax, ay] = anchorPt(b, DS.anchor); DS.x = Math.round(ax); DS.y = Math.round(ay); } else { DS.x = 0; DS.y = 0; } save(); paintTransform(box); };
      const pr = q("dkProp"); if (pr) pr.onchange = () => { DS.prop = pr.checked; save(); };
      const mh = q("dkMH"); if (mh) mh.onclick = () => { DS.mirrorH = !DS.mirrorH; save(); paintTransform(box); };
      const mv = q("dkMV"); if (mv) mv.onclick = () => { DS.mirrorV = !DS.mirrorV; save(); paintTransform(box); };
      q("dkApply").onclick = () => { doTransform(); paintTransform(box); };
    }

    /* ---------------- SHAPING ---------------- */
    const pathOf = (L) => (L.type === "shape" && L.shape ? (L.shape.kind === "path" ? L.shape.path : Q.fromShape(L.shape)) : null);
    function maskOf(paths, op, W, H, k) {
      // the area of each path at k x, combined
      const c = newCanvas(W * k, H * k), g = ctx(c);
      paths.forEach(({ path, step }, i) => {
        const m = Q.transform(path, [k, 0, 0, k, 0, 0]), t = newCanvas(W * k, H * k), tg = ctx(t); Q.fillArea(tg, m, "#000");
        g.globalCompositeOperation = i === 0 ? "source-over" : step === "subtract" ? "destination-out" : step === "intersect" ? "destination-in" : "source-over";
        g.drawImage(t, 0, 0);
      });
      g.globalCompositeOperation = "source-over";
      const d = g.getImageData(0, 0, W * k, H * k).data, out = new Uint8Array(W * k * H * k);
      for (let i = 0; i < out.length; i++) out[i] = d[i * 4 + 3] >= 128 ? 255 : 0;
      return out;
    }
    function areaPath(paths) {
      const k = Math.min(3, Math.max(1, Math.floor(4000 / Math.max(S.w, S.h)))), W = S.w, H = S.h;
      const mask = maskOf(paths, null, W, H, k), p = Q.fromMask(mask, W * k, H * k, 0.8, 6 * k);
      return Q.transform(p, [1 / k, 0, 0, 1 / k, 0, 0]);
    }
    function doShaping(op) {
      const Ls = picked().filter((L) => L.type === "shape" && L.shape);
      const T0 = E.layer();
      if (Ls.length < (op === "boundary" ? 1 : 2) || !T0 || !Ls.includes(T0)) return say("Shaping: pick 2+ vector shapes (Ctrl-click in Layers) - the active one is the target");
      const ids = S.layers.filter((L) => Ls.includes(L)).map((L) => L.id);            // bottom -> top
      const plan = shapingPlan(op, ids, T0.id, DS.leaveSrc, DS.leaveTgt); if (!plan) return;
      const byId = (id) => S.layers.find((L) => L.id === id);
      runOn(op === "frontminusback" ? "front minus back" : op === "backminusfront" ? "back minus front" : op, Ls, () => {
        if (plan.simplify) {
          // each shape loses what the shapes above it cover
          plan.ids.forEach((id, k) => {
            const L = byId(id), above = plan.ids.slice(k + 1).map(byId); if (!above.length) return;
            const p = areaPath([{ path: pathOf(L), step: "add" }].concat(above.map((A) => ({ path: pathOf(A), step: "subtract" }))));
            if (L.shape.kind !== "path") L.shape = Q.toPathShape(L.shape);
            L.shape.path = p; delete L.shape.gen; delete L.shape.media; Q.syncShape(L.shape); D.rasterize(L);
          });
          return;
        }
        const parts = []; for (const s of plan.steps) for (const id of s.ids) parts.push({ path: pathOf(byId(id)), step: parts.length ? s.op : "add" });
        const p = areaPath(parts);
        if (!p.subs.length) throw new Error("nothing is left (they do not overlap?)");
        const styleL = byId(plan.style), at = S.layers.indexOf(byId(plan.at));
        const R = E.makeLayer(op === "boundary" ? "Boundary" : (styleL.name.replace(/ \(.*\)$/, "") + " (" + ({ weld: "weld", trim: "trimmed", intersect: "intersection", frontminusback: "front minus back", backminusfront: "back minus front" }[op] || op) + ")"), S.w, S.h, "shape");
        const base = styleL.shape.kind === "path" ? styleL.shape : Q.toPathShape(styleL.shape);
        R.shape = Object.assign(JSON.parse(JSON.stringify(Object.assign({}, base, { path: null }))), { path: p });
        delete R.shape.gen; delete R.shape.media;
        if (op === "boundary") Object.assign(R.shape, { fillOn: false, strokeOn: true, strokeW: Math.max(1, R.shape.strokeW || 2), line: Object.assign({}, (B && B.LINE_DEFAULT) || {}, R.shape.line || {}) });
        Q.syncShape(R.shape); D.rasterize(R);
        R.opacity = styleL.opacity; R.blend = styleL.blend; R.parent = styleL.parent;
        S.layers.splice(at + 1, 0, R);
        const keep = new Set(plan.keep);
        S.layers = S.layers.filter((L) => !Ls.includes(L) || keep.has(L.id));
        S.layers = D.normalize(S.layers); S.active = S.layers.indexOf(R); S.picks = [];
      });
    }
    function paintShaping(box) {
      const ops = [["weld", "Weld", "Join the picked shapes into one (the target's look)"], ["trim", "Trim", "Cut the other shapes out of the target"], ["intersect", "Intersect", "A new shape where the target and the others overlap"],
        ["simplify", "Simplify", "Each shape loses what the shapes above it cover"], ["frontminusback", "Front Minus Back", "The top shape minus the ones under it (they go)"], ["backminusfront", "Back Minus Front", "The bottom shape minus the ones over it (they go)"],
        ["boundary", "Boundary", "An outline round all the picked shapes"]];
      const n = picked().filter((L) => L.type === "shape").length;
      box.innerHTML = `<div class="dk"><div class="r big">${ops.map(([k, l, t]) => `<button class="ghost" data-shp="${k}" title="${esc(t)}">${l}</button>`).join("")}</div>
        <div class="r"><label title="Keep the source shapes (Weld / Trim / Intersect)"><input type="checkbox" id="dkLS" ${DS.leaveSrc ? "checked" : ""}> Leave original source</label><label title="Keep the target"><input type="checkbox" id="dkLT" ${DS.leaveTgt ? "checked" : ""}> target</label></div>
        <div class="dim">${n} vector shape(s) picked - the active layer is the target (Ctrl-click in Layers picks more)</div></div>`;
      box.querySelectorAll("[data-shp]").forEach((x) => { x.onclick = () => { doShaping(x.dataset.shp); paintShaping(box); }; });
      box.querySelector("#dkLS").onchange = (e) => { DS.leaveSrc = e.target.checked; save(); };
      box.querySelector("#dkLT").onchange = (e) => { DS.leaveTgt = e.target.checked; save(); };
    }

    /* ---------------- ALIGN AND DISTRIBUTE ---------------- */
    function moveAll(label, moves) {
      const Ls = picked(), byId = new Map(Ls.map((L) => [L.id, L]));
      if (moves.every((m) => Math.abs(m.dx) < 0.01 && Math.abs(m.dy) < 0.01)) return say("already aligned");
      runOn(label, Ls, (list) => { for (const m of moves) { const L = byId.get(m.id); if (L && (Math.abs(m.dx) > 0.001 || Math.abs(m.dy) > 0.001)) xformLayer(L, mTranslate(Math.round(m.dx * 100) / 100, Math.round(m.dy * 100) / 100), list); } });
    }
    const items = () => picked().map((L) => ({ id: L.id, box: boxOf(L) })).filter((i) => i.box);
    function doAlign(how) {
      const it = items(); if (it.length < (DS.alignTo === "page-edge" || DS.alignTo === "page-center" ? 1 : 2)) return say("Align: pick 2+ layers (or align to the page)");
      moveAll("align " + how, alignMoves(it, how, DS.alignTo, { w: S.w, h: S.h }, E.layer() && E.layer().id));
    }
    function doDistribute(how) {
      const it = items(); if (it.length < (DS.distOver === "page" ? 2 : 3)) return say(`Distribute: pick ${DS.distOver === "page" ? 2 : 3}+ layers`);
      moveAll("distribute " + how, distributeMoves(it, how, DS.distOver, { w: S.w, h: S.h }));
    }
    function paintAlign(box) {
      const A = [["left", "⇤", "Align left"], ["hcenter", "⇹", "Align centres horizontally"], ["right", "⇥", "Align right"], ["top", "⤒", "Align top"], ["vcenter", "⇳", "Align centres vertically"], ["bottom", "⤓", "Align bottom"]];
      const Dd = [["left", "⫷", "Distribute left edges"], ["hcenter", "⫼", "Distribute centres horizontally"], ["right", "⫸", "Distribute right edges"], ["hspace", "↔", "Distribute spacing horizontally"],
        ["top", "⊤", "Distribute top edges"], ["vcenter", "⫴", "Distribute centres vertically"], ["bottom", "⊥", "Distribute bottom edges"], ["vspace", "↕", "Distribute spacing vertically"]];
      box.innerHTML = `<div class="dk"><div class="r"><b>Align</b> <select id="dkAT" title="Align objects to">${[["active", "Active object"], ["first", "First picked"], ["selection", "Selection's box"], ["page-edge", "Page edge"], ["page-center", "Page centre"]].map(([v, l]) => `<option value="${v}"${DS.alignTo === v ? " selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="r big">${A.map(([k, ic, t]) => `<button class="ghost" data-al="${k}" title="${t}">${ic}</button>`).join("")}</div>
        <div class="r"><b>Distribute</b> <select id="dkDO" title="Distribute to">${[["selection", "Selection's extent"], ["page", "Page extent"]].map(([v, l]) => `<option value="${v}"${DS.distOver === v ? " selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="r big">${Dd.map(([k, ic, t]) => `<button class="ghost" data-di="${k}" title="${t}">${ic}</button>`).join("")}</div>
        <div class="dim">${picked().length} layer(s) picked (Ctrl-click in Layers)</div></div>`;
      box.querySelector("#dkAT").onchange = (e) => { DS.alignTo = e.target.value; save(); };
      box.querySelector("#dkDO").onchange = (e) => { DS.distOver = e.target.value; save(); };
      box.querySelectorAll("[data-al]").forEach((x) => { x.onclick = () => { doAlign(x.dataset.al); paintAlign(box); }; });
      box.querySelectorAll("[data-di]").forEach((x) => { x.onclick = () => { doDistribute(x.dataset.di); paintAlign(box); }; });
    }

    /* ---------------- OBJECT PROPERTIES ---------------- */
    function paintProps(box) {
      const L = E.layer(), sh = L && L.type === "shape" && L.shape ? L.shape : null;
      if (!sh) { box.innerHTML = `<div class="dk"><div class="dim">Pick a vector shape / line (F5, F6, U, P draw them) - its fill, outline and transparency show here.</div>${L ? `<div class="r">Opacity <input type="range" id="dkOp" min="0" max="100" value="${Math.round((L.opacity == null ? 1 : L.opacity) * 100)}"></div>` : ""}</div>`; const op = box.querySelector("#dkOp"); if (op) op.onchange = () => E.structOp("opacity", () => { L.opacity = +op.value / 100; }); return; }
      const gr = sh.fillGrad || null, kind = sh.fillOn === false ? "none" : gr ? gr.type : "uniform";
      const ln = Object.assign({}, B ? B.LINE_DEFAULT : {}, sh.line || {});
      box.innerHTML = `<div class="dk">
        <div class="r"><b>Fill</b> ${[["none", "⊘ None"], ["uniform", "■ Uniform"], ["linear", "▤ Linear"], ["radial", "◎ Radial"]].map(([k, l]) => `<button class="ghost tg${kind === k ? " on" : ""}" data-fk="${k}">${l}</button>`).join("")}</div>
        <div class="r"><input type="color" id="dkF1" value="${(gr ? gr.c1 : sh.fill) || "#000000"}" title="${gr ? "From colour" : "Fill colour"}">${gr ? `→ <input type="color" id="dkF2" value="${gr.c2 || "#ffffff"}" title="To colour">${gr.type === "linear" ? ` ∠ <input type="number" id="dkFA" value="${gr.angle || 0}" title="Angle (°)" style="width:56px">` : ""}${root.PCGrad ? ` <button type="button" class="ptgbtn" id="dkFE" title="The Gradient Editor: many stops, each with its opacity" style="background:${root.PCGrad.toCss(Array.isArray(gr.stops) && gr.stops.length > 1 ? { stops: gr.stops } : root.PCGrad.fromTwo(gr.c1, gr.c2))}"></button>` : ""}` : ""}</div>
        <div class="r"><b>Outline</b> <input type="number" id="dkOW" min="0" step="0.5" value="${sh.strokeOn === false ? 0 : sh.strokeW || 0}" title="Width (px)"><input type="color" id="dkOC" value="${sh.stroke || "#000000"}" title="Colour">
          <select id="dkOS" title="Style">${(B ? B.STYLES : []).filter(([k]) => k !== "custom").map(([k, l]) => `<option value="${k}"${ln.style === k ? " selected" : ""}>${l}</option>`).join("")}</select><button class="ghost" id="dkOP" title="Outline Pen (F12)">F12…</button></div>
        <div class="r"><b>Transparency</b> <input type="range" id="dkOp" min="0" max="100" value="${Math.round((L.opacity == null ? 1 : L.opacity) * 100)}" title="Opacity"><select id="dkBl" title="Blend mode">${["normal", "multiply", "screen", "overlay", "darken", "lighten", "difference", "color-dodge", "color-burn", "soft-light", "hard-light"].map((b) => `<option${L.blend === b ? " selected" : ""}>${b}</option>`).join("")}</select></div></div>`;
      const set = (label, f) => { if (E.vline) E.vline.once(label, () => { f(); Q.syncShape(L.shape); D.rasterize(L); }); else E.structOp(label, () => { f(); D.rasterize(L); }); paintProps(box); };
      box.querySelectorAll("[data-fk]").forEach((x) => { x.onclick = () => set("fill", () => {
        const k = x.dataset.fk; if (L.shape.kind !== "path") L.shape = Q.toPathShape(L.shape);
        if (k === "none") L.shape.fillOn = false; else { L.shape.fillOn = true; if (k === "uniform") delete L.shape.fillGrad; else L.shape.fillGrad = { type: k, c1: (L.shape.fillGrad && L.shape.fillGrad.c1) || L.shape.fill || "#000000", c2: (L.shape.fillGrad && L.shape.fillGrad.c2) || "#ffffff", angle: (L.shape.fillGrad && L.shape.fillGrad.angle) || 0 }; }
      }); });
      const q = (id) => box.querySelector("#" + id);
      q("dkF1").onchange = () => set("fill colour", () => { if (L.shape.fillGrad) { L.shape.fillGrad = Object.assign({}, L.shape.fillGrad, { c1: q("dkF1").value }); delete L.shape.fillGrad.stops; } else L.shape.fill = q("dkF1").value; L.shape.fillOn = true; });
      if (q("dkF2")) q("dkF2").onchange = () => set("fill colour", () => { L.shape.fillGrad = Object.assign({}, L.shape.fillGrad, { c2: q("dkF2").value }); delete L.shape.fillGrad.stops; });
      // 2.434.0: Edit… = the Gradient Editor (stops resolved to colours; c1 / c2 the ends)
      if (q("dkFE")) q("dkFE").onclick = () => { const G = root.PCGrad, gr0 = L.shape.fillGrad || {}; E.gradEdit(Array.isArray(gr0.stops) && gr0.stops.length > 1 ? { name: "Fill", stops: gr0.stops } : G.fromTwo(gr0.c1, gr0.c2), (g) => { const r = G.resolve(g, S.fg, S.bg); set("gradient fill", () => { L.shape.fillGrad = Object.assign({}, L.shape.fillGrad, { stops: r.stops, c1: r.stops[0].c, c2: r.stops[r.stops.length - 1].c }); }); }, { title: "Gradient Editor - " + L.name }); };
      if (q("dkFA")) q("dkFA").onchange = () => set("fill angle", () => { L.shape.fillGrad = Object.assign({}, L.shape.fillGrad, { angle: +q("dkFA").value || 0 }); });
      q("dkOW").onchange = () => set("outline width", () => { const w = Math.max(0, +q("dkOW").value || 0); L.shape.strokeW = w; L.shape.strokeOn = w > 0; if (!L.shape.line && B) L.shape.line = Object.assign({}, B.LINE_DEFAULT); });
      q("dkOC").onchange = () => set("outline colour", () => { L.shape.stroke = q("dkOC").value; });
      q("dkOS").onchange = () => set("outline style", () => { L.shape.line = Object.assign({}, B ? B.LINE_DEFAULT : {}, L.shape.line || {}, { style: q("dkOS").value }); });
      q("dkOP").onclick = () => E.ui.run("vl.outline");
      q("dkOp").onchange = () => { E.structOp("opacity", () => { L.opacity = +q("dkOp").value / 100; }); };
      q("dkBl").onchange = () => { E.structOp("blend mode", () => { L.blend = q("dkBl").value; }); };
    }

    /* ---------------- the docker group ---------------- */
    const painters = { dkXf: paintTransform, dkShape: paintShaping, dkAlign: paintAlign, dkProps: paintProps };
    function paint() { for (const [id, f] of Object.entries(painters)) { const b = $(id); if (b && b.classList.contains("on")) { try { f(b); } catch (e) { /* a panel mid-change */ } } } }
    E.ui.dockers = paint;
    // the dockers' own ✕ (they open from Window ▸ Dockers)
    const grp = E.kx.querySelector('.pcgrp[data-g="dock"] .pctabs');
    if (grp && !grp.querySelector(".dkx")) { const x = doc.createElement("button"); x.className = "ghost dkx"; x.textContent = "✕"; x.title = "Close the dockers (Window ▸ Dockers opens them)"; x.style.cssText = "margin-left:auto;padding:0 6px"; x.onclick = () => grp.closest(".pcgrp").classList.add("off"); grp.appendChild(x); }
    const C = E.ui.addCmd;
    C("dk.transform", "Dockers: Transform", "Alt+F7", () => E.ui.showTab && E.ui.showTab("dkXf"), {}, ["Window", "win.pcActions", true]);
    C("dk.shaping", "Dockers: Shaping", "", () => E.ui.showTab && E.ui.showTab("dkShape"), {}, ["Window", "dk.transform"]);
    C("dk.align", "Dockers: Align and Distribute", "Shift+Ctrl+A", () => E.ui.showTab && E.ui.showTab("dkAlign"), {}, ["Window", "dk.shaping"]);
    C("dk.props", "Dockers: Object Properties", "Alt+Enter", () => E.ui.showTab && E.ui.showTab("dkProps"), {}, ["Window", "dk.align"]);
    E.dockers = { picked, boxOf, xformLayer, doTransform, doShaping, doAlign, doDistribute, settings: DS, paint };
  }
  root.PCDockers = Object.assign({ install }, pure);
})(typeof window !== "undefined" ? window : globalThis);
