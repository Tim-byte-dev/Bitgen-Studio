/* pcpropbar.js — CORELDRAW'S PROPERTY BAR IN THE IMAGE EDITOR (2.439.0), window.PCPropBar.
 *
 * Tim (verbatim): "add width and height in a top toolbar in image editor - add a lock button next to the width x height
 * inputs to lock aspect ratio. when rectangle shape is drawn add border-radius inputs for each side like in coreldraw.
 * ... When user chooses subtract shape or add shape don't change the existing shape, instead add or subtract the new
 * shape to the existing shape." + "add line type/line thickness, ... properties like coreldraw".
 *   THE OBJECT BAR   at the right of the editor's top bar whenever a layer with something on it is picked: X, Y, W, H
 *                    (px, the layer's box) + 🔒 keep the proportions (W changes H and back) - one undo step each.
 *                    A RECTANGLE (a CorelDRAW live rectangle or a Shape-tool rectangle): its four corner radii ⌜ ⌝ ⌟ ⌞ +
 *                    🔗 all four together. A VECTOR SHAPE / LINE: its outline width (presets: none, hairline … 24 px, or
 *                    type any) and its LINE STYLE picked from pictures of each (solid, dashed, dotted …, the Outline
 *                    Pen for a custom one).
 *   DRAW MODE        the CorelDRAW shape tools' bar: ◻ New / ⊕ Add / ⊖ Subtract / ⊗ Intersect / ⊘ Exclude - in a mode
 *                    other than New a closed shape drawn with a vector shape picked is ADDED TO that shape as a part
 *                    of its own (subtracted, intersected, excluded): the shape it was is kept as it was, both stay
 *                    editable (the Shape tool / Pen do the same with their own path operations).
 * Pure (Node: scripts/test-propbar.js): sizeMatrix (a box + the new W / H / lock -> the scale), cornersOf / setCorners,
 * WIDTHS, combinePath (a path joined onto a target path with an operation).
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const WIDTHS = [["0", "none"], ["0.5", "hairline"], ["1", "1 px"], ["1.5", "1.5 px"], ["2", "2 px"], ["3", "3 px"], ["4", "4 px"], ["6", "6 px"], ["8", "8 px"], ["10", "10 px"], ["12", "12 px"], ["16", "16 px"], ["24", "24 px"]];
  const MODES = [["new", "◻", "New: each shape a layer of its own"], ["add", "⊕", "Add: the shape is added to the picked vector shape"], ["subtract", "⊖", "Subtract: the shape is cut out of the picked vector shape"],
    ["intersect", "⊗", "Intersect: only where the shape and the picked one overlap"], ["exclude", "⊘", "Exclude: the picked shape minus where they overlap, plus the rest of the new one"]];
  /** the scale for a box {x, y, w, h} given a new W / H (one may be null), lock = keep the proportions: {sx, sy} */
  function sizeMatrix(b, W, H, lock) {
    let sx = W != null && b.w > 0 ? W / b.w : null, sy = H != null && b.h > 0 ? H / b.h : null;
    if (lock) { const k = sx != null ? sx : sy != null ? sy : 1; sx = k; sy = k; }
    return { sx: sx == null ? 1 : sx, sy: sy == null ? 1 : sy };
  }
  /** a layer's rectangle corners [tl, tr, br, bl] | null when it is no rectangle */
  function cornersOf(L) {
    const s = L && L.shape; if (!s) return null;
    if (s.gen && s.gen.type === "rect") return (s.gen.corners || [0, 0, 0, 0]).map((v) => +v || 0);
    if (s.kind === "rect") return Array.isArray(s.radii) && s.radii.length === 4 ? s.radii.map((v) => +v || 0) : [0, 0, 0, 0].map(() => +s.radius || 0);
    return null;
  }
  /** corner i (0..3) to v; link = all four */
  function setCorners(c, i, v, link) { const n = Math.max(0, +v || 0); return link ? [n, n, n, n] : c.map((x, k) => (k === i ? n : x)); }
  /** path `add` joined onto `base` (both {subs}) with op: the base's own parts untouched */
  function combinePath(base, add, op) {
    const o = op === "subtract" || op === "intersect" || op === "exclude" ? op : "add";
    const subs = ((add && add.subs) || []).filter((s) => s && s.pts && s.pts.length > 1).map((s) => Object.assign(JSON.parse(JSON.stringify(s)), { closed: true, op: o }));
    return { subs: JSON.parse(JSON.stringify((base && base.subs) || [])).concat(subs) };
  }

  /* ================================ the editor ================================ */
  function install(E) {
    const S = E.S, D = E.D, doc = E.doc || root.document, say = E.say, store = E.store;
    const Q = root.PCPath, B = root.PCBez, DK = root.PCDockers;
    const bar = doc.getElementById("kxBar"); if (!bar || !E.dockers || !DK) return;
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const css = doc.createElement("style");
    css.textContent = ".pcobj{display:flex;align-items:center;gap:4px;flex:none}.pcobj label{display:flex;align-items:center;gap:2px;color:var(--pc-dim);font-size:11px}"
      + ".pcobj input[type=number]{width:54px}.pcobj .pcc input{width:40px}.pcobj .on{color:var(--pc-accent,#f59e2c);border-color:var(--pc-accent,#f59e2c)}.pcobj .pclock{min-width:24px}"
      + ".pcls{display:inline-flex;align-items:center;gap:4px;min-width:74px;height:22px;padding:0 6px;cursor:pointer}.pcls svg{width:48px;height:8px}"
      + ".pclspop{position:fixed;z-index:10070;background:var(--pc-panel);border:1px solid var(--pc-line);border-radius:4px;padding:4px 0;box-shadow:0 8px 24px rgba(0,0,0,.5)}"
      + ".pclspop div{display:flex;align-items:center;gap:8px;padding:4px 10px;cursor:pointer;font-size:11px;color:var(--pc-text)}.pclspop div:hover,.pclspop div.on{background:var(--pc-bg)}.pclspop svg{width:90px;height:8px}"
      + ".kxsm.pcmode{min-width:22px}";
    doc.head.appendChild(css);
    // its own row under the tool's options (CorelDRAW's property bar), shown while something is picked
    const row = doc.createElement("div"); row.className = "kxbar pcobjrow"; row.id = "pcObjRow";   // always there (the canvas does not jump when something is picked)
    row.innerHTML = '<span class="tn" title="The picked layer">Object</span><span class="sep"></span>';
    const ob = doc.createElement("span"); ob.className = "pcobj"; ob.id = "pcObjBar"; row.appendChild(ob);
    bar.parentNode.insertBefore(row, bar.nextSibling);
    const st = Object.assign({ lock: true, rlink: true }, store.get("pb", {}));
    const keep = () => store.set("pb", st);
    let boxCache = { key: "", box: null };
    function boxOf(L) {
      const key = L.id + ":" + (L.ver || 0) + ":" + (L.shape ? JSON.stringify(L.shape.path || [L.shape.x, L.shape.y, L.shape.w, L.shape.h]).length : 0) + ":" + (L.text ? L.text.x + "," + L.text.y + "," + L.text.size : "");
      if (boxCache.key !== key) boxCache = { key, box: E.dockers.boxOf(L) };
      return boxCache.box;
    }
    const svgDash = (style) => { const d = (B && B.DASHES && B.DASHES[style]) || []; return `<svg viewBox="0 0 90 8" preserveAspectRatio="none"><line x1="1" y1="4" x2="89" y2="4" stroke="currentColor" stroke-width="2"${d.length ? ` stroke-dasharray="${d.map((v) => v * 2).join(" ")}"` : ""}/></svg>`; };
    const isVec = (L) => !!(L && L.type === "shape" && L.shape);
    /* ---- one undo step: a matrix on the layer */
    function xform(L, m, label) {
      const before = E.snapStruct(), list = [];
      try { E.dockers.xformLayer(L, m, list); } catch (e) { E.putStruct(before); return say(label + ": " + e.message); }
      list.push({ t: "struct", before, after: E.snapStruct() });
      E.push({ t: "multi", list, label }); E.refresh(); E.renderLayersPanel();
    }
    function setSize(which, v) {
      const L = E.layer(); if (!L) return; const b = boxOf(L); if (!b || !(+v > 0)) return render();
      const r = sizeMatrix(b, which === "w" ? +v : null, which === "h" ? +v : null, st.lock);
      xform(L, DK.about(DK.mScale(r.sx, r.sy), b.x, b.y), "size");
    }
    function setPos(which, v) {
      const L = E.layer(); if (!L) return; const b = boxOf(L); if (!b || !isFinite(+v)) return render();
      xform(L, DK.mTranslate(which === "x" ? +v - b.x : 0, which === "y" ? +v - b.y : 0), "position");
    }
    function setRadii(i, v) {
      const L = E.layer(), c = cornersOf(L); if (!c) return;
      const n = setCorners(c, i, v, st.rlink), s = L.shape;
      if (s.gen && s.gen.type === "rect" && E.cdraw && E.vline) {
        E.vline.once("corner radius", () => {
          const g = JSON.parse(JSON.stringify(s.gen)); g.frame = E.cdraw.frameNow(s.gen, s.path); g.corners = n;
          L.shape.gen = g; L.shape.path = E.cdraw.genPath(g); Q.syncShape(L.shape); D.rasterize(L);
        });
      } else E.setLayer(L, "corner radius", (x) => { x.shape.radii = n; x.shape.radius = Math.max(...n); });
      E.refresh(); render();
    }
    function setWidth(v) { const L = E.layer(); if (!isVec(L)) return; const w = Math.max(0, +v || 0); E.setLayer(L, "outline width", (x) => { x.shape.strokeW = w; x.shape.strokeOn = w > 0; }); render(); }
    function setStyle(style) {
      const L = E.layer(); if (!isVec(L)) return;
      if (style === "custom") { if (E.vline && E.vline.dlgOutline) E.vline.dlgOutline(); return; }
      E.setLayer(L, "line style", (x) => { x.shape.line = Object.assign({}, x.shape.line || {}, { style }); if (!x.shape.strokeOn) { x.shape.strokeOn = true; x.shape.strokeW = x.shape.strokeW || 2; } }); render();
    }
    function stylePop(btn) {
      doc.querySelectorAll(".pclspop").forEach((x) => x.remove());
      const L = E.layer(), cur = (L && L.shape && L.shape.line && L.shape.line.style) || "solid";
      const p = doc.createElement("div"); p.className = "pclspop";
      p.innerHTML = ((B && B.STYLES) || [["solid", "Solid"]]).map(([v, n]) => `<div data-v="${v}"${v === cur ? ' class="on"' : ""}>${v === "custom" ? "" : svgDash(v)}<span>${esc(n)}</span></div>`).join("");
      (E.kx || doc.body).appendChild(p);
      const r = btn.getBoundingClientRect(); p.style.left = r.left + "px"; p.style.top = r.bottom + 2 + "px";
      p.onclick = (e) => { const d = e.target.closest("[data-v]"); if (!d) return; p.remove(); setStyle(d.dataset.v); };
      setTimeout(() => doc.addEventListener("pointerdown", function off(e) { if (!p.contains(e.target)) { p.remove(); doc.removeEventListener("pointerdown", off, true); } }, true), 0);
    }
    /* ---- the bar */
    function render() {
      const L = S.w ? E.layer() : null, b = L && L.type !== "adjust" && L.type !== "fill" && L.type !== "group" ? boxOf(L) : null;
      if (!b && L && L.type === "group" && L.dimg) {   // 2.457.0: a dimension group - its size + unit (pcdims.js)
        if (ob.contains(doc.activeElement) && doc.activeElement.tagName === "INPUT" && ob.dataset.lid === String(L.id)) return;
        ob.dataset.lid = String(L.id); ob.innerHTML = `<span style="color:var(--pc-dim);font-size:11px">${esc(L.name)}</span>`;
        for (const f of extras) { try { f(L, ob); } catch (e) { /* a module's part */ } }
        return;
      }
      if (!b) { ob.innerHTML = `<span style="color:var(--pc-dim);font-size:11px">${S.w ? "nothing on this layer" : "open a picture"}</span>`; return; }
      if (ob.contains(doc.activeElement) && doc.activeElement.tagName === "INPUT" && ob.dataset.lid === String(L.id)) return;   // typing in it (another layer picked: drawn again)
      ob.dataset.lid = String(L.id);
      const n = (v) => Math.round(v * 100) / 100;
      let h = `<label title="Left (px)">X <input type="number" id="pbX" value="${n(b.x)}" step="1"></label><label title="Top (px)">Y <input type="number" id="pbY" value="${n(b.y)}" step="1"></label>`
        + `<label title="Width (px)">W <input type="number" id="pbW" value="${n(b.w)}" min="1" step="1"></label>`
        + `<button type="button" class="ghost pclock${st.lock ? " on" : ""}" id="pbLock" title="Keep the proportions: a new width changes the height with it (and back)">${st.lock ? "🔒" : "🔓"}</button>`
        + `<label title="Height (px)">H <input type="number" id="pbH" value="${n(b.h)}" min="1" step="1"></label>`;
      const c = cornersOf(L);
      if (c) h += `<span class="sep"></span><span class="pcc" style="display:flex;gap:2px;align-items:center" title="Corner radius of each corner (px)">${["⌜", "⌝", "⌟", "⌞"].map((g, i) => `<label title="${["Top left", "Top right", "Bottom right", "Bottom left"][i]} corner radius">${g}<input type="number" id="pbC${i}" min="0" step="1" value="${n(c[i])}"></label>`).join("")}`
        + `<button type="button" class="ghost${st.rlink ? " on" : ""}" id="pbRL" title="All four corners together">🔗</button></span>`;
      if (isVec(L)) {
        const s = L.shape, w = s.strokeOn ? s.strokeW : 0, style = (s.line && s.line.style) || "solid";
        h += `<span class="sep"></span><label title="Outline width (px) - pick or type">✒ <input type="number" id="pbOW" list="pbWList" min="0" step="0.5" value="${n(w)}"></label><datalist id="pbWList">${WIDTHS.map(([v, l]) => `<option value="${v}" label="${l}">`).join("")}</datalist>`
          + `<button type="button" class="ghost pcls" id="pbLS" title="Line style">${style === "custom" ? "custom" : svgDash(style)}▾</button>`;
      }
      ob.innerHTML = h;
      const q = (id) => ob.querySelector("#" + id);
      q("pbX").onchange = (e) => setPos("x", e.target.value); q("pbY").onchange = (e) => setPos("y", e.target.value);
      q("pbW").onchange = (e) => setSize("w", e.target.value); q("pbH").onchange = (e) => setSize("h", e.target.value);
      q("pbLock").onclick = () => { st.lock = !st.lock; keep(); render(); };
      if (c) { for (let i = 0; i < 4; i++) q("pbC" + i).onchange = (e) => setRadii(i, e.target.value); q("pbRL").onclick = () => { st.rlink = !st.rlink; keep(); render(); }; }
      if (q("pbOW")) { q("pbOW").onchange = (e) => setWidth(e.target.value); q("pbLS").onclick = (e) => stylePop(e.currentTarget); }
      ob.querySelectorAll("input").forEach((x) => x.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") x.dispatchEvent(new Event("change")); }));
      for (const f of extras) { try { f(L, ob); } catch (e) { /* a module's part */ } }   // 2.441.0: modules add their part (pcdims.js: a dimension's size + unit)
    }
    const extras = [];
    let raf = 0; const soon = () => { if (!raf) raf = root.requestAnimationFrame(() => { raf = 0; render(); }); };
    for (const k of ["refresh", "renderLayersPanel", "setActive"]) { const f = E[k]; if (typeof f === "function") E[k] = function () { const r = f.apply(this, arguments); soon(); return r; }; }
    // the editor's own steps call its functions directly (not E.*): a light look every 400 ms too (the box is cached by
    // the layer's version, so nothing is measured again unless it changed)
    let lastKey = "";
    setInterval(() => { const A = S.w ? E.layer() : null, k = A ? A.id + ":" + (A.ver || 0) + ":" + S.layers.length + ":" + JSON.stringify(A.shape ? [A.shape.radii, A.shape.gen && A.shape.gen.corners, A.shape.strokeW, A.shape.line && A.shape.line.style] : 0) : "none"; if (k !== lastKey) { lastKey = k; soon(); } }, 400);

    /* ---- the CorelDRAW shape tools' draw mode (◻ ⊕ ⊖ ⊗ ⊘) */
    S.drawOp = store.get("pb.op", "new");
    if (E.vline && E.vline.lineBar) {
      const lb = E.vline.lineBar, bl = E.vline.bindLineBar;
      E.vline.lineBar = function () { return `<span class="pcmodes" title="Draw mode">${MODES.map(([m, g, t]) => `<button type="button" class="ghost kxsm pcmode${S.drawOp === m ? " on" : ""}" data-dop="${m}" title="${esc(t)}">${g}</button>`).join("")}</span>` + lb.apply(this, arguments); };
      E.vline.bindLineBar = function (o) { o.querySelectorAll("[data-dop]").forEach((b) => { b.onclick = () => { S.drawOp = b.dataset.dop; store.set("pb.op", S.drawOp); o.querySelectorAll("[data-dop]").forEach((x) => x.classList.toggle("on", x === b)); }; }); return bl.apply(this, arguments); };
    }
    /** pcdraw's newShape asks first: a closed shape in Add / Subtract / … mode with a vector shape picked joins it */
    E.drawCombine = function (path, name) {
      const op = S.drawOp, T = E.layer();
      if (!op || op === "new" || !isVec(T) || !path || !(path.subs || []).some((s) => s.closed)) return null;
      if (T.shape.kind !== "path") T.shape = Q.toPathShape(T.shape);
      T.shape.path = combinePath(T.shape.path, path, op);
      delete T.shape.gen;                                  // a compound shape now (both parts editable as nodes)
      Q.syncShape(T.shape); D.rasterize(T);
      say(`${name}: ${op === "add" ? "added to" : op === "subtract" ? "cut out of" : op === "intersect" ? "intersected with" : "excluded from"} ${T.name}`);
      // what the caller does to "its new layer" next lands on a stand-in, not the shape
      return { id: -1, name, shape: Object.assign({}, D.SHAPE_DEFAULT, { kind: "path", path: { subs: [] }, line: {} }) };
    };
    E.propbar = { render, setSize, setPos, setRadii, setWidth, setStyle, extras };
    soon();
  }

  const PCPropBar = { WIDTHS, MODES, sizeMatrix, cornersOf, setCorners, combinePath, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCPropBar;
  else root.PCPropBar = PCPropBar;
})(typeof window !== "undefined" ? window : globalThis);
