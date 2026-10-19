/* pcpen.js — THE IMAGE EDITOR'S PEN TOOLS, PATHS PANEL AND VECTOR MASKS (2.421.0), window.PCPen.
 *
 * Tim (verbatim): "can we close the gap with 1,2,3,4 and 5 first" - gap 1: pen tool / paths / vector masks / custom
 * shapes / path operations. The maths is pcpath.js (window.PCPath); this file is the page: the tools (P: Pen, Freeform
 * Pen, Add / Delete Anchor, Convert Point; A: Path Selection, Direct Selection; U: Custom Shape + the ops on the Shape
 * tool), the PATHS panel, the Vector Mask / path commands, the overlay (anchors, handles, the rubber band).
 *
 * Every change is ONE undo step (a struct entry - snapStruct carries the document's paths, pcdoc's DEEP keys the
 * layers' shape and vmask). A path is edited where it lives: S.work, S.paths[i].path, L.shape.path, L.vmask.path.
 */
(function (root) {
  "use strict";
  const PEN_TOOLS = ["pen", "freepen", "addanchor", "delanchor", "convanchor", "pathsel", "directsel", "customshape"];

  function install(E) {
    const Q = root.PCPath; if (!Q || !E.tools) return;
    const { S, D, doc, $, say, ctx, store, newCanvas } = E;
    const T = E.tools;
    if (!doc.getElementById("pcpenCss")) {
      const st = doc.createElement("style"); st.id = "pcpenCss";
      st.textContent = ".kx .pnhint{color:var(--pc-dim);cursor:help;padding:0 4px}.kx .pnop{min-width:24px;padding:2px 5px}.kx .pnop.on{border-color:var(--pc-accent);color:var(--pc-accent)}"
        + ".kx canvas.vmk{border-radius:5px}.kx .pnrow canvas{flex:none;border:1px solid var(--pc-line)}";
      doc.head.appendChild(st);
    }
    S.paths = S.paths || []; S.work = S.work || null; S.ptarget = S.ptarget || null;
    S.penMode = store.get("pen.mode", "shape"); S.penOp = store.get("pen.op", "new"); S.penFit = +store.get("pen.fit", 2) || 2;
    S.penAuto = store.get("pen.auto", true) !== false; S.penRubber = store.get("pen.rubber", true) !== false;   // 2.425.0: Photoshop's Rubber Band option S.cshape = store.get("pen.cshape", "heart"); S.shapeOp = store.get("pen.shapeop", "new");
    let uid = 0;
    const nid = () => { uid = Math.max(uid, ...S.paths.map((p) => p.id || 0)) + 1; return uid; };
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const R = () => 6 / (S.zoom || 1);
    const docOpen = () => !!S.w;

    /* ---------------- where the path lives ---------------- */
    function targetInfo() {
      const t = S.ptarget; if (!t || !S.w) return null;
      if (t.k === "work") return S.work ? { k: "work", name: "Work Path", path: S.work } : null;
      if (t.k === "saved") { const e = S.paths.find((x) => x.id === t.id); return e ? { k: "saved", e, name: e.name, path: e.path } : null; }
      const L = S.layers.find((x) => x.id === t.id); if (!L) return null;
      if (t.k === "shape") return L.type === "shape" && L.shape ? { k: "shape", L, name: L.name + " Shape Path", path: L.shape.kind === "path" ? L.shape.path : Q.fromShape(L.shape) } : null;
      if (t.k === "vmask") return L.vmask ? { k: "vmask", L, name: L.name + " Vector Mask", path: L.vmask.path } : null;
      return null;
    }
    function writePath(info, path) {
      if (info.k === "work") S.work = path;
      else if (info.k === "saved") info.e.path = path;
      else if (info.k === "shape") { const L = info.L; if (L.shape.kind !== "path") L.shape = Q.toPathShape(L.shape); L.shape.path = path; Q.syncShape(L.shape); D.rasterize(L); }
      else if (info.k === "vmask") info.L.vmask.path = path;
      info.path = path;
    }
    function setTarget(t) { S.ptarget = t; asel.clear(); csel.clear(); cur = null; paintPaths(); E.drawOverlay(); }
    /** the active layer's own path (shape / vector mask) when nothing is picked */
    function autoTarget() {
      const info = targetInfo(); if (info) return info;
      const L = E.layer();
      if (L && L.type === "shape" && L.shape) { S.ptarget = { k: "shape", id: L.id }; return targetInfo(); }
      if (L && L.vmask) { S.ptarget = { k: "vmask", id: L.id }; return targetInfo(); }
      if (S.work) { S.ptarget = { k: "work" }; return targetInfo(); }
      return null;
    }

    /* ---------------- undo ---------------- */
    let live = null;
    const begin = () => { if (!live) live = E.snapStruct(); };
    function commit(label) {
      if (!live) return; const before = live; live = null;
      E.push({ t: "struct", before, after: E.snapStruct(), label }); E.refresh(); E.renderLayersPanel();
    }
    function cancel() { if (!live) return; E.putStruct(live); live = null; E.refresh(); E.renderLayersPanel(); }
    function once(label, f) { if (!S.w) return false; begin(); let r; try { r = f(); } catch (e) { cancel(); say(label + ": " + e.message); return false; } if (r === false) { cancel(); return false; } commit(label); return true; }
    const redraw = (info) => { if (info && info.k === "shape") E.renderSoon(); else if (info && info.k === "vmask") E.renderSoon(); else E.drawOverlay(); };

    /* ---------------- picking ---------------- */
    const asel = new Set(), csel = new Set();        // picked anchors "s:i" / components s
    const key = (s, i) => s + ":" + i;
    const picked = () => [...asel].map((k) => k.split(":").map(Number));
    const hitG = ctx(newCanvas(2, 2));
    function inside(sub, x, y) { if (!hitG || sub.pts.length < 3) return false; hitG.beginPath(); Q.trace(hitG, sub); return hitG.isPointInPath(x, y, "nonzero"); }
    /** the component under (x, y): inside its area or on its line */
    function compAt(path, x, y) {
      const ns = Q.nearestSeg(path, x, y);
      if (ns && ns.d <= R()) return ns.s;
      for (let s = path.subs.length - 1; s >= 0; s--) if (path.subs[s].closed && inside(path.subs[s], x, y)) return s;
      return -1;
    }
    /** a shape layer / vector mask under the pointer (the selection tools pick it up, Photoshop's way) */
    function layerPathAt(x, y) {
      for (let i = S.layers.length - 1; i >= 0; i--) {
        const L = S.layers[i]; if (!D.shown(S.layers, L)) continue;
        if (L.type === "shape" && L.shape) { const p = L.shape.kind === "path" ? L.shape.path : Q.fromShape(L.shape); if (compAt(p, x, y) >= 0) return { L, k: "shape" }; }
      }
      return null;
    }

    /* ---------------- making a target for new drawing ---------------- */
    const opNow = (first, op) => (first ? (op === "subtract" || op === "intersect" ? op : "add") : (op === "new" ? "add" : op));
    /** where the Pen / a shape puts a NEW component: {info} - a new shape layer, the picked path, or the work path */
    function drawTarget(mode, op) {
      let info = targetInfo();
      if (mode === "shape") {
        const A = E.layer();
        if (op !== "new" && A && A.type === "shape") { S.ptarget = { k: "shape", id: A.id }; return targetInfo(); }
        const L = E.makeLayer("Shape " + (S.layers.filter((x) => x.type === "shape").length + 1), S.w, S.h, "shape");
        const af = E.autoFill ? E.autoFill(true) : { fill: S.fg, fillOn: true };        // 2.430.0: the colour picked last (⊠ = not filled)
        L.shape = Object.assign({}, D.SHAPE_DEFAULT, { kind: "path", path: Q.empty(), fill: af.fill, fillOn: af.fillOn, stroke: S.bg, strokeW: S.penStrokeW || 0, strokeOn: (S.penStrokeW || 0) > 0 });
        Q.syncShape(L.shape);
        insertLayer(L);
        S.ptarget = { k: "shape", id: L.id };
        return targetInfo();
      }
      if (info && (info.k === "work" || info.k === "saved" || info.k === "vmask" || info.k === "shape")) return info;
      S.work = Q.empty(); S.ptarget = { k: "work" };       // Photoshop: drawing with no path picked starts a NEW work path
      return targetInfo();
    }
    /** a layer above the active one, no undo of its own (the caller's step covers it) */
    function insertLayer(L) {
      const A = E.layer(), at = A ? S.layers.indexOf(A) + 1 : S.layers.length;
      if (A && A.parent != null && A.type !== "group") L.parent = A.parent;
      S.layers.splice(at, 0, L); S.layers = D.normalize(S.layers); S.active = S.layers.indexOf(L);
    }

    /* ---------------- options bar pieces ---------------- */
    const opButtons = (cur, withNew, attr) => (withNew ? [["new", "New Layer", "▣"]] : []).concat(Q.OPS.map((o) => [o, Q.OP_NAMES[o], Q.OP_ICON[o]]))
      .map(([o, n, ic]) => `<button class="ghost pnop${cur === o ? " on" : ""}" ${attr}="${o}" title="${n}">${ic}</button>`).join("");
    const modeSel = () => `<label title="Draw a SHAPE layer, or a PATH (the Paths panel)">Mode <select id="pnMode"><option value="shape"${S.penMode === "shape" ? " selected" : ""}>Shape</option><option value="path"${S.penMode === "path" ? " selected" : ""}>Path</option></select></label>`;
    const fillStroke = () => (S.penMode === "shape" ? `<label title="Fill">Fill <input type="color" id="pnFill" value="${E.autoFill ? E.autoFill(true).fill : S.fg}"></label><label title="Stroke colour">Stroke <input type="color" id="pnStroke" value="${S.bg}"></label><label title="Stroke width (px)">W <input type="number" id="pnSW" min="0" max="200" value="${S.penStrokeW || 0}"></label>` : "");
    const makeBtns = () => `<span class="sep"></span><span style="color:var(--pc-dim)">Make:</span><button class="ghost" id="pnMkSel" title="The path as a selection (Ctrl-click its thumbnail in Paths)">Selection…</button><button class="ghost" id="pnMkMask" title="The path as the active layer's vector mask">Mask</button><button class="ghost" id="pnMkShape" title="A shape layer from the path">Shape</button>`;
    function bindCommon(o, opAttr, opKey) {
      const m = o.querySelector("#pnMode"); if (m) m.onchange = () => { S.penMode = m.value; store.set("pen.mode", S.penMode); if (S.penMode === "path" && S[opKey] === "new") { S[opKey] = "add"; } E.renderOptions(); };
      o.querySelectorAll(`[${opAttr}]`).forEach((b) => { b.onclick = () => { S[opKey] = b.getAttribute(opAttr); store.set(opKey === "penOp" ? "pen.op" : "pen.shapeop", S[opKey]); E.renderOptions(); }; });
      const f = o.querySelector("#pnFill"); if (f) f.onchange = () => { E.setFg(f.value); const i = targetInfo(); if (i && i.k === "shape") once("shape fill", () => { i.L.shape.fill = f.value; i.L.shape.fillOn = true; D.rasterize(i.L); }); };
      const st = o.querySelector("#pnStroke"); if (st) st.onchange = () => { E.setBg(st.value); const i = targetInfo(); if (i && i.k === "shape") once("shape stroke", () => { i.L.shape.stroke = st.value; D.rasterize(i.L); }); };
      const sw = o.querySelector("#pnSW"); if (sw) sw.onchange = () => { S.penStrokeW = Math.max(0, +sw.value || 0); const i = targetInfo(); if (i && i.k === "shape") once("stroke width", () => { i.L.shape.strokeW = S.penStrokeW; i.L.shape.strokeOn = S.penStrokeW > 0; D.rasterize(i.L); }); };
      const ms = o.querySelector("#pnMkSel"); if (ms) ms.onclick = () => dlgMakeSel();
      const mm = o.querySelector("#pnMkMask"); if (mm) mm.onclick = () => vmaskFromPath();
      const mh = o.querySelector("#pnMkShape"); if (mh) mh.onclick = () => shapeFromPath();
    }

    /* ================================ the PEN ================================ */
    let cur = null;          // the open sub-path being drawn: {s}
    let pd = null;           // the pen's drag: {s, i, x0, y0, moved, close, cusp}
    let hoverAt = null;
    function curSub(info) { if (!cur || !info) return null; const sub = info.path.subs[cur.s]; if (!sub || sub.closed) { cur = null; return null; } return sub; }
    T.pen = {
      id: "pen", name: "Pen", cursor: "crosshair",
      options() {
        return modeSel() + `<span class="sep"></span>` + opButtons(S.penOp, S.penMode === "shape", "data-pnop") + `<span class="sep"></span>` + fillStroke()
          + `<label title="Over the path the Pen adds an anchor on a segment and deletes one on an anchor"><input type="checkbox" id="pnAuto" ${S.penAuto ? "checked" : ""}> Auto Add/Delete</label>`
          + `<label title="Rubber Band: the next segment follows the pointer before you click"><input type="checkbox" id="pnRubber" ${S.penRubber ? "checked" : ""}> Rubber Band</label>` + makeBtns()
          + `<span class="pnhint" title="click = corner · drag = curve · click the first anchor = close · Alt = cusp · Ctrl = Direct Selection · Enter / Esc ends">ⓘ</span>`;
      },
      bindOptions(o) {
        bindCommon(o, "data-pnop", "penOp");
        const a = o.querySelector("#pnAuto"); if (a) a.onchange = () => { S.penAuto = a.checked; store.set("pen.auto", S.penAuto); };
        const rb = o.querySelector("#pnRubber"); if (rb) rb.onchange = () => { S.penRubber = rb.checked; store.set("pen.rubber", S.penRubber); E.drawOverlay(); };
      },
      down(e, fx, fy) {
        pd = null;
        if (e.ctrlKey || e.metaKey) { pd = { delegate: true }; const r = T.directsel.down(e, fx, fy); if (r === false) pd = null; return r; }
        let info = targetInfo();
        let sub = curSub(info);
        begin();
        if (sub) {
          const s = cur.s, n = sub.pts.length, f = sub.pts[0], l = sub.pts[n - 1];
          if (n >= 2 && Math.hypot(f.x - fx, f.y - fy) <= R()) { sub.closed = true; writePath(info, info.path); pd = { s, i: 0, x0: fx, y0: fy, close: true }; redraw(info); return; }
          if (e.altKey && Math.hypot(l.x - fx, l.y - fy) <= R()) { pd = { s, i: n - 1, x0: fx, y0: fy, cusp: true }; return; }
          let x = fx, y = fy;
          if (e.shiftKey) { const a = Math.round(Math.atan2(fy - l.y, fx - l.x) / (Math.PI / 4)) * Math.PI / 4, r = Math.hypot(fx - l.x, fy - l.y); x = l.x + Math.cos(a) * r; y = l.y + Math.sin(a) * r; }
          sub.pts.push(Q.anchor(x, y));
          writePath(info, info.path); pd = { s, i: n, x0: x, y0: y }; redraw(info); return;
        }
        if (info && S.penAuto) {
          const h = Q.hitAnchor(info.path, fx, fy, R());
          if (h && h.part === "anchor") {
            const sb = info.path.subs[h.s];
            if (!sb.closed && (h.i === sb.pts.length - 1 || h.i === 0)) {             // an open end: carry on drawing it
              if (h.i === 0 && sb.pts.length > 1) { info.path.subs[h.s] = Q.reverseSub(sb); writePath(info, info.path); }
              cur = { s: h.s }; live = null; E.drawOverlay(); return false;
            }
            writePath(info, Q.removeAnchor(info.path, h.s, h.i)); asel.clear(); commit("delete anchor point"); return false;
          }
          const ns = Q.nearestSeg(info.path, fx, fy);
          if (ns && ns.d <= R()) { writePath(info, Q.insertAt(info.path, ns.s, ns.i, ns.t)); pd = { s: ns.s, i: ns.i + 1, x0: fx, y0: fy, moveAnchor: true, orig: Q.clone(info.path) }; redraw(info); return; }
        }
        info = drawTarget(S.penMode, S.penOp);
        const first = !info.path.subs.length;
        info.path.subs.push({ closed: false, op: opNow(first, S.penOp), pts: [Q.anchor(fx, fy)] });
        writePath(info, info.path);
        cur = { s: info.path.subs.length - 1 }; asel.clear();
        pd = { s: cur.s, i: 0, x0: fx, y0: fy };
        E.renderOptions(); redraw(info);
      },
      move(e, fx, fy) {
        if (pd && pd.delegate) return T.directsel.move(e, fx, fy);
        const info = targetInfo(); if (!pd || !info || !info.path.subs[pd.s]) return;
        if (!pd.moved && Math.hypot(fx - pd.x0, fy - pd.y0) < 2 / (S.zoom || 1)) return;
        pd.moved = true;
        if (pd.moveAnchor) { const a = pd.orig.subs[pd.s].pts[pd.i]; writePath(info, Q.moveAnchors(pd.orig, [[pd.s, pd.i]], fx - a.x, fy - a.y)); redraw(info); return; }
        const cusp = pd.cusp || e.altKey;
        writePath(info, pd.close ? closingPull(info.path, pd.s, fx, fy, cusp) : Q.pullHandles(info.path, pd.s, pd.i, fx, fy, cusp));
        redraw(info);
      },
      up(e) {
        if (pd && pd.delegate) { pd = null; return T.directsel.up(e); }
        const p = pd; pd = null;
        if (p && p.close) cur = null;
        if (live) commit(p && p.close ? "close path" : p && p.moveAnchor ? "add anchor point" : "pen");
        paintPaths();
      },
      hover(e, fx, fy) { hoverAt = [fx, fy, e.shiftKey]; },
      key(e) {
        if ((e.key === "Enter" || e.key === "Escape") && cur) { cur = null; E.drawOverlay(); say("path left open - click to start another component"); return true; }
        return pathKeys(e);
      },
      leave() { cur = null; pd = null; hoverAt = null; if (live) commit("pen"); },
    };
    /** closing with a drag shapes the closing curve: the first anchor's handles, the IN one towards the pointer's opposite */
    function closingPull(path, s, x, y, cusp) {
      const q = Q.clone(path), a = q.subs[s].pts[0];
      a.ix = 2 * a.x - x; a.iy = 2 * a.y - y;
      if (!cusp) { a.ox = x; a.oy = y; a.smooth = true; } else a.smooth = false;
      return q;
    }

    /* ---------------- Freeform Pen ---------------- */
    let ff = null;
    T.freepen = {
      id: "freepen", name: "Freeform Pen", cursor: "crosshair",
      options() {
        return modeSel() + `<span class="sep"></span>` + opButtons(S.penOp, S.penMode === "shape", "data-pnop") + `<span class="sep"></span>` + fillStroke()
          + `<label title="How closely the path follows your hand (px): small = more anchors">Curve Fit <input type="number" id="pnFit" min="0.5" max="10" step="0.5" value="${S.penFit}"></label>` + makeBtns()
          + `<span class="pnhint" title="draw - ending near the start closes it">ⓘ</span>`;
      },
      bindOptions(o) { bindCommon(o, "data-pnop", "penOp"); const f = o.querySelector("#pnFit"); if (f) f.onchange = () => { S.penFit = Math.max(0.5, Math.min(10, +f.value || 2)); store.set("pen.fit", S.penFit); }; },
      down(e, fx, fy) { ff = { pts: [[fx, fy]] }; E.drawOverlay(); },
      move(e, fx, fy) { if (!ff) return; const l = ff.pts[ff.pts.length - 1]; if (Math.hypot(fx - l[0], fy - l[1]) >= 1.5 / (S.zoom || 1)) { ff.pts.push([fx, fy]); E.drawOverlay(); } },
      up() {
        const f = ff; ff = null; E.drawOverlay();
        if (!f || f.pts.length < 3) return;
        const a = f.pts[0], b = f.pts[f.pts.length - 1], closed = Math.hypot(a[0] - b[0], a[1] - b[1]) <= 3 * R();
        const sub = Q.fromPolygon(f.pts, closed, S.penFit, 60);
        if (sub.pts.length < 2) return;
        once("freeform pen", () => {
          const info = drawTarget(S.penMode, S.penOp);
          sub.op = opNow(!info.path.subs.length, S.penOp);
          info.path.subs.push(sub); writePath(info, info.path);
          E.renderOptions();
        });
        paintPaths();
      },
      key: (e) => pathKeys(e),
      leave() { ff = null; },
    };

    /* ---------------- Add / Delete Anchor, Convert Point ---------------- */
    const needPath = () => { const i = autoTarget(); if (!i) say("no path picked - draw one with the Pen (P), or pick one in the Paths panel"); return i; };
    T.addanchor = {
      id: "addanchor", name: "Add Anchor Point", cursor: "crosshair",
      options: () => `<span class="pnhint" title="click a segment of the picked path to add an anchor (drag to move it)">ⓘ</span>`,
      down(e, fx, fy) {
        const info = needPath(); if (!info) return false;
        const ns = Q.nearestSeg(info.path, fx, fy); if (!ns || ns.d > R() * 1.5) { say("click ON the path's line"); return false; }
        begin(); writePath(info, Q.insertAt(info.path, ns.s, ns.i, ns.t));
        pd = { s: ns.s, i: ns.i + 1, orig: Q.clone(info.path) }; asel.clear(); asel.add(key(ns.s, ns.i + 1)); redraw(info);
      },
      move(e, fx, fy) { const info = targetInfo(); if (!pd || !info) return; const a = pd.orig.subs[pd.s].pts[pd.i]; writePath(info, Q.moveAnchors(pd.orig, [[pd.s, pd.i]], fx - a.x, fy - a.y)); redraw(info); },
      up() { pd = null; commit("add anchor point"); },
      key: (e) => pathKeys(e),
    };
    T.delanchor = {
      id: "delanchor", name: "Delete Anchor Point", cursor: "crosshair",
      options: () => `<span class="pnhint" title="click an anchor of the picked path to delete it">ⓘ</span>`,
      down(e, fx, fy) {
        const info = needPath(); if (!info) return false;
        const h = Q.hitAnchor(info.path, fx, fy, R()); if (!h || h.part !== "anchor") { say("click an anchor"); return false; }
        once("delete anchor point", () => writePath(info, Q.removeAnchor(info.path, h.s, h.i))); asel.clear();
        return false;
      },
      key: (e) => pathKeys(e),
    };
    T.convanchor = {
      id: "convanchor", name: "Convert Point", cursor: "crosshair",
      options: () => `<span class="pnhint" title="click an anchor: curve ⇄ corner · drag an anchor: pull new curve handles · drag a handle: move it alone (a cusp)">ⓘ</span>`,
      down(e, fx, fy) {
        const info = needPath(); if (!info) return false;
        const h = Q.hitAnchor(info.path, fx, fy, R(), () => true); if (!h) { say("click an anchor or a handle"); return false; }
        begin(); pd = { s: h.s, i: h.i, part: h.part, x0: fx, y0: fy, moved: false };
        asel.clear(); asel.add(key(h.s, h.i)); E.drawOverlay();
      },
      move(e, fx, fy) {
        const info = targetInfo(); if (!pd || !info) return;
        if (!pd.moved && Math.hypot(fx - pd.x0, fy - pd.y0) < 2 / (S.zoom || 1)) return;
        pd.moved = true;
        writePath(info, pd.part === "anchor" ? Q.pullHandles(info.path, pd.s, pd.i, fx, fy) : Q.dragHandle(info.path, pd.s, pd.i, pd.part, fx, fy, true));
        redraw(info);
      },
      up() {
        const p = pd; pd = null; const info = targetInfo();
        if (p && !p.moved && p.part === "anchor" && info) writePath(info, Q.convert(info.path, p.s, p.i));
        commit("convert point");
      },
      key: (e) => pathKeys(e),
    };

    /* ================================ Direct / Path Selection ================================ */
    let sd = null;           // {mode: anchors | handle | marquee | comps, ...}
    function pickPathAt(fx, fy) {
      let info = autoTarget();
      if (info && (Q.hitAnchor(info.path, fx, fy, R(), (s, i) => asel.has(key(s, i))) || compAt(info.path, fx, fy) >= 0)) return info;
      const hit = layerPathAt(fx, fy);
      if (hit) { E.setActive(S.layers.indexOf(hit.L)); S.ptarget = { k: "shape", id: hit.L.id }; asel.clear(); csel.clear(); return targetInfo(); }
      return info;
    }
    T.directsel = {
      id: "directsel", name: "Direct Selection", cursor: "default",
      options() {
        return `<span class="pnhint" title="click / drag anchors and handles (Shift adds, a box picks several) · Alt on a handle = a cusp · arrows nudge (Shift ×10) · Delete removes">ⓘ</span>`
          + `<span class="sep"></span><button class="ghost" id="pnDSCorner" title="The picked anchors become corners">Corner</button><button class="ghost" id="pnDSSmooth" title="The picked anchors become smooth">Smooth</button>`
          // 2.466.0: round corners on ANY path (a joined / merged shape too)
          + `<span class="sep"></span><label title="Round the picked corner anchors (none picked = every corner of the path) - any path, a joined or merged shape too">⌜ Radius <input type="number" id="pnDSRad" min="0" step="1" value="${+store.get("pn.round", 10) || 10}" style="width:52px"> px</label><button class="ghost" id="pnDSRound" title="Round the corners">Round Corners</button>`;
      },
      bindOptions(o) {
        o.querySelector("#pnDSCorner").onclick = () => convertPicked(false);
        o.querySelector("#pnDSSmooth").onclick = () => convertPicked(true);
        const rad = o.querySelector("#pnDSRad"); rad.addEventListener("keydown", (ev) => { ev.stopPropagation(); if (ev.key === "Enter") roundPicked(+rad.value); });
        rad.onchange = () => store.set("pn.round", Math.max(0, +rad.value || 0));
        o.querySelector("#pnDSRound").onclick = () => roundPicked(+rad.value);
      },
      down(e, fx, fy) {
        const info = pickPathAt(fx, fy);
        if (!info) { say("Direct Selection: no path here - draw one with the Pen (P), pick one in the Paths panel, or click a shape layer's outline"); sd = { mode: "marquee", x0: fx, y0: fy, x1: fx, y1: fy, add: e.shiftKey, info: null }; return; }
        const h = Q.hitAnchor(info.path, fx, fy, R(), (s, i) => asel.has(key(s, i)));
        if (h && h.part !== "anchor") { begin(); sd = { mode: "handle", s: h.s, i: h.i, part: h.part, cusp: e.altKey }; return; }
        if (h) {
          const k = key(h.s, h.i);
          if (e.shiftKey) { if (asel.has(k)) asel.delete(k); else asel.add(k); } else if (!asel.has(k)) { asel.clear(); asel.add(k); }
          begin(); sd = { mode: "anchors", x0: fx, y0: fy, orig: Q.clone(info.path), list: picked() }; E.drawOverlay(); return;
        }
        const ns = Q.nearestSeg(info.path, fx, fy);
        if (ns && ns.d <= R()) {
          const n = info.path.subs[ns.s].pts.length, j = (ns.i + 1) % n;
          if (!e.shiftKey) asel.clear(); asel.add(key(ns.s, ns.i)); asel.add(key(ns.s, j));
          begin(); sd = { mode: "anchors", x0: fx, y0: fy, orig: Q.clone(info.path), list: picked() }; E.drawOverlay(); return;
        }
        sd = { mode: "marquee", x0: fx, y0: fy, x1: fx, y1: fy, add: e.shiftKey, info };
      },
      move(e, fx, fy) {
        if (!sd) return;
        const info = targetInfo();
        if (sd.mode === "marquee") { sd.x1 = fx; sd.y1 = fy; E.drawOverlay(); return; }
        if (!info) return;
        if (sd.mode === "handle") { writePath(info, Q.dragHandle(info.path, sd.s, sd.i, sd.part, fx, fy, sd.cusp || e.altKey)); redraw(info); return; }
        let dx = fx - sd.x0, dy = fy - sd.y0;
        if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        sd.moved = sd.moved || Math.hypot(dx, dy) > 0.5;
        writePath(info, Q.moveAnchors(sd.orig, sd.list, dx, dy)); redraw(info);
      },
      up() {
        const d = sd; sd = null; if (!d) return;
        if (d.mode === "marquee") {
          const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
          if (!d.add) asel.clear();
          const info = d.info || targetInfo();
          if (info && (x1 - x0 > 1 || y1 - y0 > 1)) info.path.subs.forEach((sub, s) => sub.pts.forEach((a, i) => { if (a.x >= x0 && a.x <= x1 && a.y >= y0 && a.y <= y1) asel.add(key(s, i)); }));
          else if (!d.add && !info) setTarget(null);
          say(asel.size ? `${asel.size} anchor point(s) picked - drag them, arrows nudge, Delete removes` : info ? "no anchor points in the box - drag a box round some, or click one" : "Direct Selection: nothing picked");
          E.drawOverlay(); return;
        }
        if (d.mode === "anchors" && !d.moved) { live = null; E.drawOverlay(); return; }
        commit(d.mode === "handle" ? "move handle" : "move anchor points");
      },
      key: (e) => pathKeys(e),
      leave() { sd = null; if (live) commit("direct selection"); },
    };
    /** 2.466.0: round the picked corner anchors - none picked = every corner of the targeted path */
    function roundPicked(r) {
      const info = targetInfo(); if (!info) return say("Round Corners: pick a path or a shape's outline first (Direct Selection, A)");
      if (!(r > 0)) return say("Round Corners: a radius above 0");
      store.set("pn.round", r);
      let n = 0;
      once("round corners", () => { const res = Q.roundCorners(info.path, asel.size ? picked() : null, r); n = res.count; if (!n) return false; writePath(info, res.path); });
      if (n) { asel.clear(); E.drawOverlay(); }
      say(n ? `${n} corner(s) rounded (r ${r} px)` : asel.size ? "Round Corners: the picked anchors are no corners (or have no two sides)" : "Round Corners: that path has no corners");
      return n;
    }
    function convertPicked(smooth) {
      const info = targetInfo(); if (!info || !asel.size) return say("pick anchors first (Direct Selection, A)");
      once(smooth ? "smooth anchor points" : "corner anchor points", () => { let p = info.path; for (const [s, i] of picked()) p = smooth ? Q.setSmooth(p, s, i) : Q.setCorner(p, s, i); writePath(info, p); });
    }
    T.pathsel = {
      id: "pathsel", name: "Path Selection", cursor: "default",
      options() {
        const info = targetInfo(), ops = info && csel.size ? [...csel].map((s) => (info.path.subs[s] || {}).op) : [];
        const one = ops.length && ops.every((o) => o === ops[0]) ? ops[0] : null;
        return `<span title="The op of the picked components">Path operations</span>` + opButtons(one, false, "data-pnsop")
          + `<button class="ghost" id="pnMerge" title="Merge Shape Components: the result of the ops as plain outlines">⧉ Merge Components</button>`
          + `<button class="ghost" id="pnXform" title="Scale / rotate / flip the picked components (or the whole path)">⟳ Transform…</button>`
          + `<span class="sep"></span><span class="pnhint" title="click a component (Shift adds) · drag moves · Alt-drag copies · Delete removes">ⓘ</span>`;
      },
      bindOptions(o) {
        o.querySelectorAll("[data-pnsop]").forEach((b) => { b.onclick = () => {
          const info = targetInfo(); if (!info || !csel.size) return say("pick components first (click them with Path Selection)");
          const op = b.getAttribute("data-pnsop");
          once("path operation", () => { const p = Q.clone(info.path); for (const s of csel) if (p.subs[s]) p.subs[s].op = op; writePath(info, p); });
          E.renderOptions();
        }; });
        o.querySelector("#pnMerge").onclick = () => mergeComponents();
        o.querySelector("#pnXform").onclick = () => dlgTransform();
      },
      down(e, fx, fy) {
        const info = pickPathAt(fx, fy); if (!info) { csel.clear(); E.drawOverlay(); say("Path Selection: no path here - draw one with the Pen (P), pick one in the Paths panel, or click a shape layer"); return false; }
        const s = compAt(info.path, fx, fy);
        if (s < 0) { if (!e.shiftKey) csel.clear(); E.renderOptions(); E.drawOverlay(); return false; }
        if (e.shiftKey) { if (csel.has(s)) csel.delete(s); else csel.add(s); } else if (!csel.has(s)) { csel.clear(); csel.add(s); }
        begin();
        if (e.altKey) {                                     // Alt-drag: copies of the picked components
          const p = Q.clone(info.path), idx = [...csel], add = idx.map((k) => Q.clone(p.subs[k]));
          p.subs.push(...add); writePath(info, p); csel.clear(); add.forEach((_, k) => csel.add(p.subs.length - add.length + k));
        }
        sd = { mode: "comps", x0: fx, y0: fy, orig: Q.clone(info.path), list: [...csel], copy: e.altKey };
        E.renderOptions(); E.drawOverlay();
      },
      move(e, fx, fy) {
        const info = targetInfo(); if (!sd || !info) return;
        let dx = fx - sd.x0, dy = fy - sd.y0; if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        sd.moved = sd.moved || Math.hypot(dx, dy) > 0.5;
        writePath(info, Q.moveSubs(sd.orig, sd.list, dx, dy)); redraw(info);
      },
      up() { const d = sd; sd = null; if (!d) return; if (!d.moved && !d.copy) { live = null; return; } commit(d.copy ? "duplicate components" : "move components"); },
      key: (e) => pathKeys(e),
      leave() { sd = null; if (live) commit("path selection"); },
    };
    function mergeComponents() {
      const info = targetInfo(); if (!info || !info.path.subs.length) return say("pick a path first");
      const closed = { subs: info.path.subs.filter((s) => s.closed) }, open = info.path.subs.filter((s) => !s.closed);
      const o = Q.fromMask(Q.areaMask(closed, S.w, S.h, E.cv), S.w, S.h, 0.75, 2);
      once("merge shape components", () => writePath(info, { subs: o.subs.concat(open) })); csel.clear();
    }
    /** the keys every path tool shares: Delete, arrows, Esc */
    function pathKeys(e) {
      const info = targetInfo(); if (!info) return false;
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      const k = e.key;
      if (k === "Delete" || k === "Backspace") {
        if (S.tool === "pathsel" && csel.size) { once("delete components", () => { const p = Q.clone(info.path); [...csel].sort((a, b) => b - a).forEach((s) => p.subs.splice(s, 1)); writePath(info, p); }); csel.clear(); return true; }
        if (asel.size) { once("delete anchor points", () => { let p = info.path; picked().sort((a, b) => b[0] - a[0] || b[1] - a[1]).forEach(([s, i]) => { p = Q.removeAnchor(p, s, i); }); writePath(info, p); }); asel.clear(); return true; }
        if (S.tool === "pathsel" || S.tool === "directsel") { once("delete path", () => writePath(info, Q.empty())); return true; }
        return false;
      }
      if (/^Arrow/.test(k) && (asel.size || csel.size)) {
        const n = e.shiftKey ? 10 : 1, dx = k === "ArrowLeft" ? -n : k === "ArrowRight" ? n : 0, dy = k === "ArrowUp" ? -n : k === "ArrowDown" ? n : 0;
        once("nudge path", () => writePath(info, S.tool === "pathsel" && csel.size ? Q.moveSubs(info.path, [...csel], dx, dy) : Q.moveAnchors(info.path, picked(), dx, dy)));
        return true;
      }
      if (k === "Escape" && (asel.size || csel.size)) { asel.clear(); csel.clear(); E.drawOverlay(); return true; }
      return false;
    }

    /* ================================ Custom Shape (U) + ops on the Shape tool ================================ */
    const userShapes = () => store.get("customShapes", []);
    const allShapes = () => Q.CUSTOM.concat(userShapes());
    const shapeIcon = (def) => { const p = Q.custom(def, 1, 1, 18, 18); return `<svg viewBox="0 0 20 20" width="18" height="18"><path d="${Q.toSvg(p)}" fill="currentColor" fill-rule="nonzero"/></svg>`; };
    let cs = null;
    T.customshape = {
      id: "customshape", name: "Custom Shape", cursor: "crosshair",
      options() {
        const def = allShapes().find((c) => c.id === S.cshape) || Q.CUSTOM[0];
        return `<button class="ghost" id="pnCsPick" title="Pick a shape">${shapeIcon(def)} ${esc(def.name)} ▾</button>` + modeSel() + `<span class="sep"></span>`
          + opButtons(S.penOp, S.penMode === "shape", "data-pnop") + `<span class="sep"></span>` + fillStroke() + `<span class="pnhint" title="drag to draw · Shift keeps its proportions">ⓘ</span>`;
      },
      bindOptions(o) {
        bindCommon(o, "data-pnop", "penOp");
        o.querySelector("#pnCsPick").onclick = (e) => {
          e.stopPropagation();
          const old = doc.querySelector(".kx .pncspop"); if (old) { old.remove(); return; }
          const pop = doc.createElement("div"); pop.className = "kxmenu pncspop"; pop.style.cssText += ";display:grid;grid-template-columns:repeat(6,34px);gap:3px;padding:6px";
          for (const c of allShapes()) {
            const b = doc.createElement("button"); b.className = "ghost"; b.title = c.name + (c.user ? " (yours - right-click removes)" : ""); b.dataset.cs = c.id; b.style.cssText = "width:34px;height:34px;padding:0"; b.innerHTML = shapeIcon(c);
            b.onclick = () => { S.cshape = c.id; store.set("pen.cshape", c.id); pop.remove(); E.renderOptions(); };
            b.oncontextmenu = (ev) => { ev.preventDefault(); if (!c.user) return; store.set("customShapes", userShapes().filter((x) => x.id !== c.id)); pop.remove(); say(`custom shape "${c.name}" removed`); };
            pop.appendChild(b);
          }
          const r = e.target.getBoundingClientRect(), kr = E.kx.getBoundingClientRect();
          pop.style.left = (r.left - kr.left) + "px"; pop.style.top = (r.bottom - kr.top + 2) + "px"; E.kx.appendChild(pop);
          setTimeout(() => doc.addEventListener("pointerdown", function off(ev) { if (!pop.contains(ev.target)) { pop.remove(); doc.removeEventListener("pointerdown", off); } }), 0);
        };
      },
      down(e, fx, fy) { cs = { x0: fx, y0: fy, x1: fx, y1: fy }; },
      move(e, fx, fy) {
        if (!cs) return;
        let w = fx - cs.x0, h = fy - cs.y0;
        if (e.shiftKey) { const def = allShapes().find((c) => c.id === S.cshape) || Q.CUSTOM[0], b = Q.bbox(Q.custom(def, 0, 0, 100, 100)) || { w: 1, h: 1 }, ar = b.w / (b.h || 1), m = Math.max(Math.abs(w), Math.abs(h) * ar); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m / ar; }
        cs.x1 = cs.x0 + w; cs.y1 = cs.y0 + h; E.drawOverlay();
      },
      up() {
        const c = cs; cs = null; E.drawOverlay();
        if (!c || Math.abs(c.x1 - c.x0) < 3 || Math.abs(c.y1 - c.y0) < 3) return;
        const def = allShapes().find((x) => x.id === S.cshape) || Q.CUSTOM[0];
        once("custom shape", () => {
          const info = drawTarget(S.penMode, S.penOp), first = !info.path.subs.length;
          const add = Q.custom(def, Math.min(c.x0, c.x1), Math.min(c.y0, c.y1), Math.abs(c.x1 - c.x0), Math.abs(c.y1 - c.y0), opNow(first, S.penOp));
          if (info.k === "shape" && first) info.L.name = def.name + " " + S.layers.filter((x) => x.type === "shape").length;
          info.path.subs.push(...add.subs); writePath(info, info.path);
        });
        E.renderOptions(); paintPaths();
      },
      key: (e) => pathKeys(e),
      leave() { cs = null; },
    };
    E.overlayHooks.push((g, px) => {
      if (!cs) return;
      const def = allShapes().find((x) => x.id === S.cshape) || Q.CUSTOM[0];
      const p = Q.custom(def, Math.min(cs.x0, cs.x1), Math.min(cs.y0, cs.y1), Math.abs(cs.x1 - cs.x0), Math.abs(cs.y1 - cs.y0));
      g.globalAlpha = 0.6; Q.fillArea(g, p, S.penMode === "shape" ? (E.autoFill ? E.autoFill(true).fill : S.fg) : "rgba(38,128,235,.25)"); g.globalAlpha = 1;
      g.strokeStyle = "#2680eb"; g.lineWidth = px; Q.traceAll(g, p); g.stroke();
    });
    // the Shape tool (rectangle, ellipse ...) gains the ops: anything but New Layer adds to the active shape layer
    if (T.shape) {
      const bo = T.shape.options, bb = T.shape.bindOptions, bu = T.shape.up;
      T.shape.options = function () { return `<span title="New layer, or a component of the active shape layer">Ops</span>` + opButtons(S.shapeOp, true, "data-pnshop") + `<span class="sep"></span>` + bo.call(this); };
      T.shape.bindOptions = function (o) { bb.call(this, o); bindCommon(o, "data-pnshop", "shapeOp"); };
      T.shape.up = function (e, fx, fy) {
        const A = E.layer(), into = S.shapeOp !== "new" && A && A.type === "shape" ? A : null;
        if (!into) return bu.call(this, e, fx, fy);
        const before = E.snapStruct(), n0 = S.undo.length;
        bu.call(this, e, fx, fy);
        const L = E.layer(); if (S.undo.length === n0 || !L || L === into || L.type !== "shape") return;
        S.undo.pop();
        const add = Q.fromShape(L.shape, S.shapeOp);
        if (L.shape.kind === "line") add.subs.forEach((s) => { s.op = "add"; });
        S.layers.splice(S.layers.indexOf(L), 1); S.active = S.layers.indexOf(into);
        if (into.shape.kind !== "path") into.shape = Q.toPathShape(into.shape);
        into.shape.path.subs.push(...add.subs); Q.syncShape(into.shape); D.rasterize(into);
        E.push({ t: "struct", before, after: E.snapStruct(), label: Q.OP_NAMES[S.shapeOp].toLowerCase() });
        E.refresh(); E.renderLayersPanel(); E.renderOptions();
      };
    }

    /* ================================ the overlay ================================ */
    const isPenTool = () => PEN_TOOLS.includes(S.tool) || S.tool === "shape";
    E.overlayHooks.push((g, px) => {
      if (!S.w) return;
      const info = targetInfo();
      const pathTool = PEN_TOOLS.includes(S.tool);
      if (info && info.path.subs.length && (pathTool || S.ptarget)) {
        const p = info.path;
        g.lineWidth = 1.25 * px; g.strokeStyle = "#2680eb"; g.setLineDash([]);
        Q.traceAll(g, p); g.stroke();
        if (S.tool === "pathsel" && csel.size) { g.lineWidth = 2 * px; g.beginPath(); for (const s of csel) if (p.subs[s]) Q.trace(g, p.subs[s]); g.stroke(); }
        if (pathTool) {
          const sz = 3.5 * px, show = (s, i) => asel.has(key(s, i)) || (cur && cur.s === s && i === p.subs[s].pts.length - 1) || (pd && pd.s === s && pd.i === i);
          p.subs.forEach((sub, s) => sub.pts.forEach((a, i) => {
            if (show(s, i) && S.tool !== "pathsel") {
              g.strokeStyle = "#2680eb"; g.lineWidth = px;
              for (const [hx, hy] of [[a.ix, a.iy], [a.ox, a.oy]]) if (hx !== a.x || hy !== a.y) { g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(hx, hy); g.stroke(); g.beginPath(); g.arc(hx, hy, 2.5 * px, 0, Math.PI * 2); g.fillStyle = "#2680eb"; g.fill(); }
            }
            const solid = S.tool === "pathsel" ? csel.has(s) : asel.has(key(s, i)) || (cur && cur.s === s && i === sub.pts.length - 1);
            g.fillStyle = solid ? "#2680eb" : "#fff"; g.strokeStyle = "#2680eb"; g.lineWidth = px;
            g.fillRect(a.x - sz, a.y - sz, 2 * sz, 2 * sz); g.strokeRect(a.x - sz, a.y - sz, 2 * sz, 2 * sz);
          }));
        }
        // the Pen's rubber band: from the open end to the pointer
        const sub = S.tool === "pen" ? curSub(info) : null;
        if (sub && hoverAt && !pd && S.penRubber) {
          const l = sub.pts[sub.pts.length - 1];
          let [hx, hy] = hoverAt;
          if (hoverAt[2]) { const a = Math.round(Math.atan2(hy - l.y, hx - l.x) / (Math.PI / 4)) * Math.PI / 4, r = Math.hypot(hx - l.x, hy - l.y); hx = l.x + Math.cos(a) * r; hy = l.y + Math.sin(a) * r; }
          g.strokeStyle = "rgba(38,128,235,.8)"; g.setLineDash([4 * px, 3 * px]); g.beginPath(); g.moveTo(l.x, l.y);
          if (l.ox !== l.x || l.oy !== l.y) g.bezierCurveTo(l.ox, l.oy, hx, hy, hx, hy); else g.lineTo(hx, hy);
          g.stroke(); g.setLineDash([]);
          const f = sub.pts[0];
          if (sub.pts.length >= 2 && Math.hypot(f.x - hoverAt[0], f.y - hoverAt[1]) <= R()) { g.beginPath(); g.arc(f.x, f.y, 6 * px, 0, Math.PI * 2); g.stroke(); }
        }
      }
      if (ff && ff.pts.length > 1) { g.strokeStyle = "#2680eb"; g.lineWidth = 1.5 * px; g.beginPath(); ff.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
      if (sd && sd.mode === "marquee") { g.strokeStyle = "#2680eb"; g.lineWidth = px; g.setLineDash([3 * px, 3 * px]); g.strokeRect(Math.min(sd.x0, sd.x1), Math.min(sd.y0, sd.y1), Math.abs(sd.x1 - sd.x0), Math.abs(sd.y1 - sd.y0)); g.setLineDash([]); }
      void isPenTool;
    });

    /* ================================ path commands ================================ */
    const curPath = () => { const i = targetInfo(); if (!i || !i.path.subs.length) { say("pick a path in the Paths panel first (or draw one with the Pen, P)"); return null; } return i; };
    function maskOf(path, feather) {
      let m = Q.areaMask(path, S.w, S.h, E.cv);
      if (feather > 0 && E.P.feather) m = E.P.feather(m, S.w, S.h, feather);
      return m;
    }
    function toSelection(mode, feather) { const i = curPath(); if (!i) return false; E.applyShape(maskOf(i.path, feather || 0), mode || "replace", "load path as selection"); return true; }
    function dlgMakeSel() {
      const i = curPath(); if (!i) return;
      E.ui.dialog("Make Selection", `<div class="rw"><span>Feather radius (px)</span><input type="number" id="pnSF" min="0" max="250" value="0"></div>
        <div class="rw"><span>Operation</span><select id="pnSO" style="grid-column:2/4"><option value="replace">New Selection</option><option value="add">Add to Selection</option><option value="subtract">Subtract from Selection</option><option value="intersect">Intersect with Selection</option></select></div>`,
      (d) => { toSelection(d.querySelector("#pnSO").value, +d.querySelector("#pnSF").value || 0); });
    }
    function fromSelection(tol) {
      if (!E.hasSel()) { say("select something first - its outline becomes the work path"); return false; }
      const p = Q.fromMask(S.sel, S.w, S.h, tol == null ? 2 : tol, 4);
      if (!p.subs.length) { say("the selection is too small to outline"); return false; }
      return once("make work path", () => { S.work = p; S.ptarget = { k: "work" }; asel.clear(); csel.clear(); });
    }
    function dlgFromSel() {
      E.ui.dialog("Make Work Path", `<div class="rw"><span>Tolerance (px)</span><input type="number" id="pnTol" min="0.5" max="10" step="0.5" value="2"></div><div style="color:var(--pc-dim)">Small = follows the selection closely (more anchors); large = smoother.</div>`,
        (d) => { fromSelection(+d.querySelector("#pnTol").value || 2); });
    }
    function fillPath(color, opacity, feather) {
      const i = curPath(); if (!i) return false;
      return E.pxOp("fill path", (c, g) => {
        const t = newCanvas(S.w, S.h), tg = ctx(t); Q.fillArea(tg, i.path, color);
        g.save(); g.globalAlpha = opacity == null ? 1 : opacity;
        if (feather > 0) g.filter = `blur(${feather}px)`;
        g.drawImage(t, 0, 0); g.restore();
      });
    }
    function strokePath(tool, pressure) {
      const i = curPath(); if (!i) return false;
      return E.pxOp("stroke path", (c, g) => {
        const lines = i.path.subs.map((s) => Q.flatten(s, 0.3)).filter((l) => l.length > 1);
        if (tool === "brush" && E.B) {
          for (const pl of lines) {
            const st = new E.B.Stroke({ doc, layer: c, preset: E.B.byId(S.preset), size: S.size, opacity: S.opacity, flow: S.flow, color: S.fg });
            let total = 0; for (let k = 1; k < pl.length; k++) total += Math.hypot(pl[k][0] - pl[k - 1][0], pl[k][1] - pl[k - 1][1]);
            let run = 0;
            for (let k = 0; k < pl.length; k++) {
              if (k) run += Math.hypot(pl[k][0] - pl[k - 1][0], pl[k][1] - pl[k - 1][1]);
              st.add(pl[k][0], pl[k][1], pressure ? Math.max(0.05, Math.sin(Math.PI * (total ? run / total : 0.5))) : 1);
            }
            st.end();
          }
          return;
        }
        g.save(); g.lineWidth = Math.max(1, S.size); g.lineJoin = "round"; g.lineCap = "round"; g.strokeStyle = S.fg;
        if (tool === "eraser") g.globalCompositeOperation = "destination-out";
        g.beginPath(); for (const s of i.path.subs) Q.trace(g, s); g.stroke(); g.restore();
      });
    }
    function dlgFill() {
      if (!curPath()) return;
      E.ui.dialog("Fill Path", `<div class="rw"><span>Contents</span><select id="pnFC" style="grid-column:2/4"><option value="fg">Foreground colour</option><option value="bg">Background colour</option><option value="#000000">Black</option><option value="#808080">50% Gray</option><option value="#ffffff">White</option></select></div>
        <div class="rw"><span>Opacity (%)</span><input type="number" id="pnFO" min="1" max="100" value="100"></div><div class="rw"><span>Feather (px)</span><input type="number" id="pnFF" min="0" max="250" value="0"></div>`,
      (d) => { const c = d.querySelector("#pnFC").value; fillPath(c === "fg" ? S.fg : c === "bg" ? S.bg : c, (+d.querySelector("#pnFO").value || 100) / 100, +d.querySelector("#pnFF").value || 0); });
    }
    function dlgStroke() {
      if (!curPath()) return;
      E.ui.dialog("Stroke Path", `<div class="rw"><span>Tool</span><select id="pnST" style="grid-column:2/4"><option value="brush">Brush (the current preset, size, colour)</option><option value="pencil">Pencil (a hard line)</option><option value="eraser">Eraser</option></select></div>
        <div class="rw"><label><input type="checkbox" id="pnSP"> Simulate Pressure (thin - thick - thin)</label></div><div style="color:var(--pc-dim)">Size ${Math.round(S.size)} px - set it with the Brush tool ([ and ]).</div>`,
      (d) => { strokePath(d.querySelector("#pnST").value, d.querySelector("#pnSP").checked); });
    }
    function newPath(fromPath, name) {
      return once("new path", () => { const id = nid(); S.paths.push({ id, name: name || "Path " + (S.paths.length + 1), path: fromPath ? Q.clone(fromPath) : Q.empty() }); S.ptarget = { k: "saved", id }; });
    }
    function saveWork() {
      if (!S.work) return say("there is no work path");
      return once("save path", () => { const id = nid(); S.paths.push({ id, name: "Path " + (S.paths.length + 1), path: S.work }); S.work = null; S.ptarget = { k: "saved", id }; });
    }
    function deletePath() {
      const i = targetInfo(); if (!i) return say("pick a path first");
      return once("delete path", () => {
        if (i.k === "work") S.work = null;
        else if (i.k === "saved") S.paths = S.paths.filter((x) => x !== i.e);
        else if (i.k === "vmask") i.L.vmask = null;
        else if (i.k === "shape") { S.layers.splice(S.layers.indexOf(i.L), 1); S.active = Math.max(0, Math.min(S.active, S.layers.length - 1)); }
        S.ptarget = null; asel.clear(); csel.clear();
      });
    }
    function duplicatePath() { const i = curPath(); if (!i) return; newPath(i.path, (i.k === "saved" ? i.e.name : i.name) + " copy"); }
    function vmaskFromPath() {
      const i = curPath(); if (!i) return;
      const L = E.layer(); if (!L) return;
      if (i.k === "shape" && i.L === L) return say("a shape layer's path already masks its fill - pick another layer for a vector mask");
      once("add vector mask", () => { L.vmask = { path: Q.clone(i.path), on: true, density: 1, feather: 0, linked: true, invert: false }; S.ptarget = { k: "vmask", id: L.id }; });
    }
    function addVmask(kind) {
      const L = E.layer(); if (!L) return say("open a picture first");
      if (kind === "path") return vmaskFromPath();
      once(kind === "hide" ? "vector mask: hide all" : "vector mask: reveal all", () => { L.vmask = { path: Q.empty(), on: true, density: 1, feather: 0, linked: true, invert: kind !== "hide" }; S.ptarget = { k: "vmask", id: L.id }; });
      say(kind === "hide" ? "vector mask hides everything - draw shapes (Path mode) to show areas" : "vector mask shows everything - draw shapes (Path mode) to hide areas");
    }
    function shapeFromPath() {
      const i = curPath(); if (!i) return;
      once("shape layer from path", () => {
        const L = E.makeLayer("Shape " + (S.layers.filter((x) => x.type === "shape").length + 1), S.w, S.h, "shape");
        L.shape = Object.assign({}, D.SHAPE_DEFAULT, { kind: "path", path: Q.clone(i.path), fill: S.fg, fillOn: true, stroke: S.bg, strokeW: 0, strokeOn: false });
        Q.syncShape(L.shape); D.rasterize(L); insertLayer(L); S.ptarget = { k: "shape", id: L.id };
      });
    }
    function rasterizeVmask() {
      const L = E.layer(); if (!L || !L.vmask) return say("the active layer has no vector mask");
      const a = Q.vmaskAlpha(L, S.w, S.h, newCanvas); const before = E.snapStruct(), list = [];
      if (L.mask) {
        const copy = E.beginPx(L, "mask"), g = ctx(L.mask.canvas), t = newCanvas(S.w, S.h), tg = ctx(t);
        tg.fillStyle = "#000"; tg.fillRect(0, 0, S.w, S.h); tg.globalCompositeOperation = "destination-out"; if (a) tg.drawImage(a, 0, 0);
        g.drawImage(t, 0, 0);            // black where the vector mask hides
        const px = E.endPx(L, copy, null, "rasterize vector mask", "mask"); if (px) list.push(px);
      } else {
        L.mask = E.newMask("#000"); const g = ctx(L.mask.canvas);
        if (a) { const t = newCanvas(S.w, S.h), tg = ctx(t); tg.drawImage(a, 0, 0); tg.globalCompositeOperation = "source-in"; tg.fillStyle = "#fff"; tg.fillRect(0, 0, S.w, S.h); g.drawImage(t, 0, 0); }
        L.mask.ver = (L.mask.ver || 0) + 1;
      }
      L.vmask = null; if (S.ptarget && S.ptarget.k === "vmask") S.ptarget = null;
      list.push({ t: "struct", before, after: E.snapStruct() });
      E.push({ t: "multi", list, label: "rasterize vector mask" }); E.refresh(); E.renderLayersPanel();
    }
    const download = (name, text, type) => { const a = doc.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; doc.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
    function exportSvg() {
      const i = curPath(); if (!i) return;
      const s = i.k === "shape" ? i.L.shape : null;
      download(String(i.k === "saved" ? i.e.name : i.name).replace(/[^\w.-]+/g, "_") + ".svg", Q.svgDoc(i.path, S.w, S.h, s ? (s.fillOn !== false ? s.fill : "none") : "#000000", s && s.strokeOn ? s.stroke : null, s ? s.strokeW : 0), "image/svg+xml");
      say("exported the path as SVG");
    }
    let svgIn = null;
    function importSvg(asShape) {
      if (!svgIn) { svgIn = doc.createElement("input"); svgIn.type = "file"; svgIn.accept = ".svg,image/svg+xml"; svgIn.style.display = "none"; E.kx.appendChild(svgIn); }
      svgIn.onchange = async () => { const f = svgIn.files && svgIn.files[0]; svgIn.value = ""; if (f) importSvgText(await f.text(), f.name, asShape); };
      svgIn.click();
    }
    /** an SVG's outlines -> a shape layer (or a saved path), fitted into the canvas when larger */
    function importSvgText(text, name, asShape) {
      if (!S.w) return say("open a picture first");
      if (asShape && E.vlineSvg && E.vlineSvg(text, name)) return true;      // 2.425.0: vector lines we wrote come back as vector lines (pcvline.js)
      let p = Q.fromSvgFile(text); if (!p.subs.length) return say(`${name || "the SVG"}: no shapes found in it`);
      const vb = /viewBox\s*=\s*["']\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)/i.exec(text);
      const b = vb ? { x: +vb[1], y: +vb[2], w: +vb[3], h: +vb[4] } : Q.bbox(p);
      const k = Math.min(1, S.w * 0.9 / (b.w || 1), S.h * 0.9 / (b.h || 1));
      p = Q.transform(p, [k, 0, 0, k, (S.w - b.w * k) / 2 - b.x * k, (S.h - b.h * k) / 2 - b.y * k]);
      const nm = String(name || "SVG").replace(/\.svg$/i, "");
      if (asShape) return once("place SVG", () => { const L = E.makeLayer(nm, S.w, S.h, "shape"); L.shape = Object.assign({}, D.SHAPE_DEFAULT, { kind: "path", path: p, fill: S.fg, fillOn: true, strokeOn: false, strokeW: 0 }); Q.syncShape(L.shape); D.rasterize(L); insertLayer(L); S.ptarget = { k: "shape", id: L.id }; });
      return newPath(p, nm);
    }
    function defineCustom() {
      const i = curPath(); if (!i) return;
      E.ui.dialog("Define Custom Shape", `<div class="rw"><span>Name</span><input type="text" id="pnCN" value="Shape ${userShapes().length + 1}" style="grid-column:2/4"></div><div style="color:var(--pc-dim)">The picked path joins the Custom Shape tool's list (U).</div>`, (d) => {
        const b = Q.bbox(i.path); if (!b) return;
        const p = Q.fitBox(i.path, b, { x: 0, y: 0, w: 100 * b.w / Math.max(b.w, b.h), h: 100 * b.h / Math.max(b.w, b.h) });
        const id = "u" + Date.now().toString(36), name = (d.querySelector("#pnCN").value || "Shape").trim().slice(0, 40);
        store.set("customShapes", userShapes().concat([{ id, name, path: p, user: true }]).slice(-60)); S.cshape = id; store.set("pen.cshape", id);
        say(`custom shape "${name}" defined - the Custom Shape tool (U) draws it`);
      });
    }
    function dlgTransform() {
      const i = curPath(); if (!i) return;
      const idx = S.tool === "pathsel" && csel.size ? [...csel] : i.path.subs.map((_, k) => k);
      E.ui.dialog("Transform Path", `<div class="rw"><span>Scale W / H (%)</span><input type="number" id="pnTW" value="100"><input type="number" id="pnTH" value="100"></div>
        <div class="rw"><span>Rotate (°)</span><input type="number" id="pnTR" value="0"></div><div class="rw"><label><input type="checkbox" id="pnTFH"> Flip horizontal</label><label><input type="checkbox" id="pnTFV"> Flip vertical</label></div>
        <div style="color:var(--pc-dim)">${idx.length === i.path.subs.length ? "The whole path" : idx.length + " picked component(s)"}, about its centre.</div>`, (d) => {
        const sx = (+d.querySelector("#pnTW").value || 100) / 100 * (d.querySelector("#pnTFH").checked ? -1 : 1), sy = (+d.querySelector("#pnTH").value || 100) / 100 * (d.querySelector("#pnTFV").checked ? -1 : 1);
        const a = (+d.querySelector("#pnTR").value || 0) * Math.PI / 180, part = { subs: idx.map((k) => i.path.subs[k]) }, b = Q.bbox(part); if (!b) return;
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2, c = Math.cos(a), s = Math.sin(a);
        const m = [c * sx, s * sx, -s * sy, c * sy, 0, 0]; m[4] = cx - m[0] * cx - m[2] * cy; m[5] = cy - m[1] * cx - m[3] * cy;
        once("transform path", () => { const t = Q.transform(part, m), p = Q.clone(i.path); idx.forEach((k, j) => { p.subs[k] = t.subs[j]; }); writePath(i, p); });
      });
    }

    /* ---------------- keep paths with the picture: crop / canvas / image size / rotate move them too ---------------- */
    /** every document path, every vector mask (and path shapes when `shapes`) through the matrix m */
    E.mapPaths = (m, shapes) => {
      if (S.work) S.work = Q.transform(S.work, m);
      S.paths.forEach((e) => { e.path = Q.transform(e.path, m); });
      for (const L of S.layers) {
        if (L.vmask && L.vmask.path) L.vmask.path = Q.transform(L.vmask.path, m);
        if (shapes && L.type === "shape" && L.shape && L.shape.kind === "path") { L.shape.path = Q.transform(L.shape.path, m); Q.syncShape(L.shape); D.rasterize(L); }
      }
    };
    E.shiftVmask = (L, dx, dy) => { if (L && L.vmask && L.vmask.path && L.vmask.linked !== false && (dx || dy)) L.vmask.path = Q.translate(L.vmask.path, dx, dy); };

    /* ================================ the PATHS panel ================================ */
    const thumb = (path, invert) => {
      const c = newCanvas(36, 26), g = ctx(c); if (!g || !S.w) return c;
      g.fillStyle = invert ? "#fff" : "#888"; g.fillRect(0, 0, 36, 26);
      const k = Math.min(36 / S.w, 26 / S.h); g.setTransform(k, 0, 0, k, (36 - S.w * k) / 2, (26 - S.h * k) / 2);
      if (path && path.subs.length) Q.fillArea(g, path, invert ? "#888" : "#fff");
      return c;
    };
    function paintPaths() {
      const box = $("pcPaths"); if (!box || !box.classList.contains("on")) return;
      const rows = [];
      const A = E.layer();
      if (S.w) {
        for (const e of S.paths) rows.push({ t: { k: "saved", id: e.id }, name: e.name, path: e.path, saved: e });
        if (S.work) rows.push({ t: { k: "work" }, name: "Work Path", path: S.work, italic: true });
        if (A && A.type === "shape" && A.shape) rows.push({ t: { k: "shape", id: A.id }, name: A.name + " Shape Path", path: A.shape.kind === "path" ? A.shape.path : Q.fromShape(A.shape), italic: true });
        if (A && A.vmask) rows.push({ t: { k: "vmask", id: A.id }, name: A.name + " Vector Mask", path: A.vmask.path, italic: true, invert: A.vmask.invert });
      }
      const same = (a, b) => !!a && !!b && a.k === b.k && (a.id || 0) === (b.id || 0);
      box.innerHTML = `<div class="kxlayers" id="pnList" style="min-height:90px"></div>
        <div class="kxlbtns" id="pnBtns">
          <button class="ghost" id="pnFillB" title="Fill path with the foreground colour (Alt-click: options)">●</button>
          <button class="ghost" id="pnStrokeB" title="Stroke path with the brush (Alt-click: options)">○</button>
          <button class="ghost" id="pnSelB" title="Load path as a selection (Alt-click: options)">⬚</button>
          <button class="ghost" id="pnWorkB" title="Make work path from the selection (Alt-click: tolerance)">⟲</button>
          <button class="ghost" id="pnMaskB" title="Add a vector mask from the path to the active layer">◇</button>
          <button class="ghost" id="pnNewB" title="New path (Alt-click: name it)">＋</button>
          <button class="ghost" id="pnDupB" title="Duplicate path">⧉</button>
          <button class="ghost" id="pnVLineB" title="Make a vector line from the path (a path made from a line comes back with its outline pen) - pcvline.js">〰</button>
          <button class="ghost" id="pnMenuB" title="More: save, export / import SVG, define custom shape, shape layer">☰</button>
          <button class="ghost" id="pnDelB" title="Delete path">🗑</button>
        </div>`;
      const list = box.querySelector("#pnList");
      if (!rows.length) list.innerHTML = `<div style="color:var(--pc-dim);padding:6px">No paths. Draw with the Pen (P) in Path mode, or ⟲ make one from a selection.</div>`;
      for (const r of rows) {
        const row = doc.createElement("div"); row.className = "kxlayer pnrow" + (same(S.ptarget, r.t) ? " on" : ""); row.dataset.pk = r.t.k; if (r.t.id) row.dataset.pid = r.t.id;
        const th = thumb(r.path, r.invert); th.title = "Ctrl-click: load as a selection";
        const nm = doc.createElement("span"); nm.className = "nm"; nm.textContent = r.name; if (r.italic) nm.style.fontStyle = "italic";
        nm.title = r.saved ? "double-click to rename" : r.t.k === "work" ? "a temporary path - double-click to save it" : "";
        row.append(th, nm);
        row.onclick = (e) => {
          if (e.ctrlKey || e.metaKey) { setTarget(r.t); toSelection(e.shiftKey ? "add" : e.altKey ? "subtract" : "replace"); return; }
          setTarget(r.t);
          if (!PEN_TOOLS.includes(S.tool)) E.drawOverlay();
        };
        nm.ondblclick = (e) => {
          e.stopPropagation();
          if (r.t.k === "work") return saveWork();
          if (!r.saved) return;
          const inp = doc.createElement("input"); inp.type = "text"; inp.value = r.saved.name; inp.style.width = "100%";
          nm.replaceWith(inp); inp.focus(); inp.select();
          const done = (ok) => { if (ok && inp.value.trim() && inp.value !== r.saved.name) once("rename path", () => { r.saved.name = inp.value.trim().slice(0, 60); }); else paintPaths(); };
          inp.onkeydown = (ev) => { ev.stopPropagation(); if (ev.key === "Enter") done(true); if (ev.key === "Escape") done(false); };
          inp.onblur = () => done(true);
        };
        list.appendChild(row);
      }
      list.onclick = (e) => { if (e.target === list) setTarget(null); };
      const q = (id) => box.querySelector("#" + id);
      q("pnFillB").onclick = (e) => (e.altKey ? dlgFill() : fillPath(S.fg, 1, 0));
      q("pnStrokeB").onclick = (e) => (e.altKey ? dlgStroke() : strokePath("brush", false));
      q("pnSelB").onclick = (e) => (e.altKey ? dlgMakeSel() : toSelection("replace"));
      q("pnWorkB").onclick = (e) => (e.altKey ? dlgFromSel() : fromSelection(2));
      q("pnMaskB").onclick = () => vmaskFromPath();
      q("pnNewB").onclick = () => newPath(null);
      q("pnDupB").onclick = () => duplicatePath();
      q("pnDelB").onclick = () => deletePath();
      q("pnVLineB").onclick = () => (E.vline ? E.vline.dlgFromPath() : say("vector lines are not loaded"));   // 2.425.0
      q("pnMenuB").onclick = (e) => { e.stopPropagation(); const r = e.target.getBoundingClientRect(), kr = E.kx.getBoundingClientRect();
        E.ui.menuAt(["path.save", "path.dup", "path.del", E.ui.sep, "path.fill", "path.stroke", "path.tosel", "path.fromsel", E.ui.sep, "vmask.path", "path.shape", "vl.frompath", "path.custom", E.ui.sep, "path.svgout", "path.svgin", "path.svgshape"], r.left - kr.left - 180, r.top - kr.top - 330, 0); };
    }
    E.ui.paths = paintPaths;
    if (E.ui.layers) { const base = E.ui.layers; E.ui.layers = function () { const r = base.apply(this, arguments); paintPaths(); return r; }; }

    /* ---------------- the vector mask in Layers + Properties ---------------- */
    E.ui.vmaskThumb = (Ly, i) => {
      const c = thumb(Ly.vmask.path, Ly.vmask.invert); c.classList.add("mk", "vmk"); if (Ly.vmask.on === false) c.classList.add("off");
      if (S.ptarget && S.ptarget.k === "vmask" && S.ptarget.id === Ly.id) c.classList.add("sel");
      c.title = "Vector mask - click to edit its path (Pen / Direct Selection); Shift-click disables it; Ctrl-click loads it as the selection";
      c.onclick = (e) => {
        e.stopPropagation(); E.setActive(i, false);
        if (e.shiftKey) return once("vector mask on / off", () => { Ly.vmask.on = Ly.vmask.on === false; });
        setTarget({ k: "vmask", id: Ly.id });
        if (e.ctrlKey || e.metaKey) toSelection("replace");
        else if (!PEN_TOOLS.includes(S.tool)) E.setTool("directsel");
        E.renderLayersPanel();
      };
      return c;
    };
    E.ui.vmaskProps = (A) => {
      if (!A.vmask) return "";
      const v = A.vmask;
      return `<div style="margin-top:8px;border-top:1px solid var(--pc-sep);padding-top:6px"><b>◇ Vector mask</b>
        <div class="kxrow"><span style="width:60px">Density</span><input type="range" id="ppVDens" min="0" max="100" value="${Math.round((v.density == null ? 1 : v.density) * 100)}" style="flex:1"><span id="ppVDensV">${Math.round((v.density == null ? 1 : v.density) * 100)}%</span></div>
        <div class="kxrow"><span style="width:60px">Feather</span><input type="range" id="ppVFeath" min="0" max="250" value="${v.feather || 0}" style="flex:1"><span id="ppVFeathV">${v.feather || 0}px</span></div>
        <div class="kxrow"><button class="ghost" id="ppVInv">Invert</button><button class="ghost" id="ppVEdit" title="Edit the path (Direct Selection)">Edit path</button><button class="ghost" id="ppVOn">${v.on === false ? "Enable" : "Disable"}</button>
          <button class="ghost" id="ppVLink">${v.linked === false ? "🔗 Link" : "⛓ Unlink"}</button><button class="ghost" id="ppVRast" title="Into the layer mask (pixels)">Rasterize</button><button class="ghost" id="ppVDel">Delete</button></div></div>`;
    };
    E.ui.bindVmask = (A) => {
      if (!A.vmask) return;
      const v = A.vmask, q = (id) => $(id);
      const slide = (id, unit, f) => { const r = q(id); if (!r) return; r.oninput = () => { begin(); f(+r.value); q(id + "V").textContent = r.value + unit; E.renderSoon(); }; r.onchange = () => commit("vector mask settings"); };
      slide("ppVDens", "%", (x) => { v.density = x / 100; }); slide("ppVFeath", "px", (x) => { v.feather = x; });
      q("ppVInv").onclick = () => once("invert vector mask", () => { v.invert = !v.invert; });
      q("ppVEdit").onclick = () => { setTarget({ k: "vmask", id: A.id }); E.setTool("directsel"); };
      q("ppVOn").onclick = () => once("vector mask on / off", () => { v.on = v.on === false; });
      q("ppVLink").onclick = () => once("link vector mask", () => { v.linked = v.linked === false; });
      q("ppVRast").onclick = () => rasterizeVmask();
      q("ppVDel").onclick = () => once("delete vector mask", () => { A.vmask = null; if (S.ptarget && S.ptarget.k === "vmask") S.ptarget = null; });
    };

    /* ---------------- menus / commands ---------------- */
    if (E.ui.addCmd) {
      const C = E.ui.addCmd, hasP = () => !!targetInfo(), hasL = () => !!(S.w && E.layer()), vm = () => hasL() && !!E.layer().vmask;
      C("path.save", "Save Path", "", saveWork, { enabled: () => !!S.work });
      C("path.new", "New Path", "", () => newPath(null), { enabled: docOpen });
      C("path.dup", "Duplicate Path", "", duplicatePath, { enabled: hasP });
      C("path.del", "Delete Path", "", deletePath, { enabled: hasP });
      C("path.fill", "Fill Path…", "", dlgFill, { enabled: hasP }, ["Edit", "edit.stroke"]);
      C("path.stroke", "Stroke Path…", "", dlgStroke, { enabled: hasP }, ["Edit", "path.fill"]);
      C("path.xform", "Transform Path…", "", dlgTransform, { enabled: hasP }, ["Edit", "edit.transform"]);
      C("path.custom", "Define Custom Shape…", "", defineCustom, { enabled: hasP }, ["Edit", "edit.histsrc"]);
      C("path.tosel", "Load Path as Selection", "", () => toSelection("replace"), { enabled: hasP }, ["Select", "sel.loadmask"]);
      C("path.fromsel", "Make Work Path from Selection…", "", dlgFromSel, { enabled: () => E.hasSel() }, ["Select", "path.tosel"]);
      C("path.shape", "Shape Layer from Path", "", shapeFromPath, { enabled: hasP });
      C("vmask.reveal", "Vector Mask: Reveal All", "", () => addVmask("reveal"), { enabled: () => hasL() && !E.layer().vmask }, ["Layer", "mask.link", true]);
      C("vmask.hide", "Vector Mask: Hide All", "", () => addVmask("hide"), { enabled: () => hasL() && !E.layer().vmask }, ["Layer", "vmask.reveal"]);
      C("vmask.path", "Vector Mask: Current Path", "", () => addVmask("path"), { enabled: () => hasL() && hasP() }, ["Layer", "vmask.hide"]);
      C("vmask.toggle", "Vector Mask: Disable / Enable", "", () => once("vector mask on / off", () => { E.layer().vmask.on = E.layer().vmask.on === false; }), { enabled: vm }, ["Layer", "vmask.path"]);
      C("vmask.raster", "Vector Mask: Rasterize", "", rasterizeVmask, { enabled: vm }, ["Layer", "vmask.toggle"]);
      C("vmask.del", "Vector Mask: Delete", "", () => once("delete vector mask", () => { E.layer().vmask = null; S.ptarget = null; }), { enabled: vm }, ["Layer", "vmask.raster"]);
      C("path.svgout", "Export Path as SVG…", "", exportSvg, { enabled: hasP }, ["File", "file.download"]);
      C("path.svgin", "Import SVG as Path…", "", () => importSvg(false), { enabled: docOpen });
      C("path.svgshape", "Place SVG as Shape Layer…", "", () => importSvg(true), { enabled: docOpen }, ["File", "file.place"]);
      C("win.pcPaths", "Paths", "", () => E.ui.showTab && E.ui.showTab("pcPaths"), {}, ["Window", "win.pcHistory"]);
      for (const [id, n] of [["pen", "Pen Tool"], ["freepen", "Freeform Pen Tool"], ["pathsel", "Path Selection Tool"], ["directsel", "Direct Selection Tool"], ["customshape", "Custom Shape Tool"]])
        C("tool." + id, n, "", () => E.setTool(id), {});
    }

    // a different picture: no paths from the last one (imageedit.js openDoc calls it)
    E.pathsReset = () => { S.paths = []; S.work = null; S.ptarget = null; asel.clear(); csel.clear(); cur = null; };
    E.pathsIdle = () => { asel.clear(); csel.clear(); cur = null; pd = null; };     // 2.430.0: another document came to the front

    E.pen = { roundPicked, targetInfo, setTarget, writePath, toSelection, fromSelection, fillPath, strokePath, newPath, saveWork, deletePath, vmaskFromPath, addVmask,
      shapeFromPath, rasterizeVmask, mergeComponents, importSvgText, exportSvg, defineCustom, paint: paintPaths, picked: () => ({ anchors: [...asel], comps: [...csel] }), once,
      drawTarget, insertLayer, compAt, layerPathAt, clearPicks: () => { asel.clear(); csel.clear(); } };   // 2.425.0: for pcvline.js
  }

  const api = { install, PEN_TOOLS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document) root.PCPen = api;
})(typeof window !== "undefined" ? window : globalThis);
