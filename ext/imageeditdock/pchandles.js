/* pchandles.js — THE MOVE TOOL'S SCALE / ROTATE HANDLES AND TRANSFORM OPTIONS (2.452.0), window.PCHandles.
 *
 * Tim (verbatim): "add transform options, rotate and scale. add handles to the selected object to rotate and scale
 * when move tool is selected.single click on the layer scales(shift scales uniform), double click rotates."
 *
 * Like CorelDRAW's Pick tool, on the Move tool:
 *   SCALE      (a single click on the canvas) eight square handles round the active layer: a corner scales both ways
 *              from the opposite corner (Shift = keeps its proportions, Alt = from the centre), a side handle one way.
 *   ROTATE     (a double click) curved corner handles turn it round its centre (Shift = 15° steps); the side handles
 *              skew it (↔ / ↕) - 2.604.0: the opposite side stays put (Alt = round the centre); type skews too (t.xm).
 *   While dragging, the layer is shown where it will go; letting go applies it - ONE undo step. Pixel layers are redrawn
 *   once (smooth), shapes / lines stay vector, type stays editable (turned - pcdoc t.rot), smart objects keep their
 *   contents (their quad), a group = all of its layers. A drag anywhere else still MOVES the layer, as before.
 *   TRANSFORM OPTIONS in the Move tool's options bar: Angle ° + ↻ (turn by it), ⟲ 90 / ⟳ 90, ⇋ / ⇵ flips, W % x H %
 *   (🔗 together) + ⤡ scale - all round the layer's centre.
 *
 * Pure (Node: scripts/test-handles.js): HANDLES, handlePoints, hitHandle, matrixFor, mul, about, turnAbout, scaleAbout.
 */
(function (root) {
  "use strict";
  const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
  const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  /** m applied about (cx, cy) */
  const about = (m, cx, cy) => mul([1, 0, 0, 1, cx, cy], mul(m, [1, 0, 0, 1, -cx, -cy]));
  const turnAbout = (deg, cx, cy) => { const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return about([c, s, -s, c, 0, 0], cx, cy); };
  const scaleAbout = (sx, sy, cx, cy) => about([sx, 0, 0, sy, 0, 0], cx, cy);
  /** where each handle sits on box b */
  function handlePoints(b) {
    const x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    return { nw: [x0, y0], n: [cx, y0], ne: [x1, y0], e: [x1, cy], se: [x1, y1], s: [cx, y1], sw: [x0, y1], w: [x0, cy] };
  }
  /** the handle within r of (x, y), else null (corners first) */
  function hitHandle(b, x, y, r) {
    const P = handlePoints(b);
    for (const h of ["nw", "ne", "se", "sw", "n", "e", "s", "w"]) if (Math.hypot(P[h][0] - x, P[h][1] - y) <= r) return h;
    return null;
  }
  /** the matrix a drag of handle h on box b from p0 to p gives. mode "scale" | "rotate"; o = {shift, alt} */
  function matrixFor(mode, h, b, p0, p, o) {
    const opt = o || {}, cx = b.x + b.w / 2, cy = b.y + b.h / 2, P = handlePoints(b);
    if (mode === "rotate") {
      if (h.length === 2) {                                                   // a corner: turn round the centre
        let a = (Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(p0[1] - cy, p0[0] - cx)) * 180 / Math.PI;
        if (opt.shift) a = Math.round(a / 15) * 15;
        return turnAbout(a, cx, cy);
      }
      // a side: SKEW. 2.604.0 (Tim: "fix the skew tool"): the dragged side slides and the OPPOSITE side stays put (as in
      // Photoshop / CorelDRAW) - it used to turn round the centre, so the far side ran the other way. Alt = round the centre
      if (h === "n" || h === "s") {
        const ay = opt.alt ? cy : (h === "n" ? b.y + b.h : b.y), k = (p[0] - p0[0]) / ((P[h][1] - ay) || 1);
        return about([1, 0, k, 1, 0, 0], cx, ay);
      }
      const ax = opt.alt ? cx : (h === "w" ? b.x + b.w : b.x), k = (p[1] - p0[1]) / ((P[h][0] - ax) || 1);
      return about([1, k, 0, 1, 0, 0], ax, cy);
    }
    const H = P[h], anchor = opt.alt ? [cx, cy] : P[{ nw: "se", n: "s", ne: "sw", e: "w", se: "nw", s: "n", sw: "ne", w: "e" }[h]];
    const ax = anchor[0], ay = anchor[1], useX = h !== "n" && h !== "s", useY = h !== "e" && h !== "w";
    let sx = useX ? (p[0] - ax) / ((H[0] - ax) || 1) : 1, sy = useY ? (p[1] - ay) / ((H[1] - ay) || 1) : 1;
    // tiny = not flipped through zero
    const clamp = (s) => (Math.abs(s) < 0.01 ? (s < 0 ? -0.01 : 0.01) : s);
    sx = clamp(sx); sy = clamp(sy);
    if (opt.shift) {
      if (useX && useY) { const s = Math.abs(sx) >= Math.abs(sy) ? sx : sy; sx = s; sy = s; }
      else if (useX) sy = Math.abs(sx); else sx = Math.abs(sy);
    }
    return scaleAbout(sx, sy, ax, ay);
  }
  const isIdentity = (m) => Math.abs(m[0] - 1) < 1e-6 && Math.abs(m[1]) < 1e-6 && Math.abs(m[2]) < 1e-6 && Math.abs(m[3] - 1) < 1e-6 && Math.abs(m[4]) < 1e-3 && Math.abs(m[5]) < 1e-3;

  function install(E) {
    const { S, doc, say, store } = E;
    if (!E.stage || !E.overlayHooks || !E.dockers || !E.dockers.xformLayer) return;
    const st = { mode: "scale", drag: null, click: null, cache: null };
    const ctx = (c) => c.getContext("2d");
    const D = E.D || root.PCDoc;
    const leavesOf = (L) => (L.type === "group" && D ? D.descendants(S.layers, L.id).filter((x) => x.type !== "group") : [L]);
    function target() {
      let L = E.layer();
      if (L && E.frames && E.frames.owner) { const o = E.frames.owner(L); if (o) L = o; }   // 2.453.0: contents locked to their frame
      if (!L || !S.w || L.control || L.type === "adjust" || (L.type === "fill" && !L.mask)) return null;
      if (L.locks && (L.locks.pos || L.locks.all)) return null;
      return L;
    }
    function boxNow(L) {
      const key = L.id + ":" + (L.ver || 0) + ":" + S.layers.length + ":" + (L.type === "group" ? leavesOf(L).map((x) => x.id + "." + (x.ver || 0)).join(",") : "") + ":" + S.w + "x" + S.h + ":" + (L.text ? JSON.stringify([L.text.x, L.text.y, L.text.size, L.text.rot, L.text.xm]) : "");
      if (st.cache && st.cache.key === key) return st.cache.b;
      const b = E.dockers.boxOf(L);
      st.cache = { key, b };
      return b;
    }
    const shown = () => S.tool === "move" && !S.drag && S.objSel !== false && !!target();   // 2.470.0: nothing picked (pcselhl.js) = no handles
    const R = () => 7 / (S.zoom || 1);

    /* ---- the overlay: the box, its handles, and the layer where it will go while dragging */
    E.overlayHooks.push((g, px) => {
      if (S.tool !== "move") return;
      const d = st.drag;
      if (d) {
        g.save(); g.transform(d.m[0], d.m[1], d.m[2], d.m[3], d.m[4], d.m[5]);
        for (const x of d.leaves) if (x.canvas) { g.globalAlpha = x.opacity == null ? 1 : x.opacity; g.drawImage(x.canvas, 0, 0); }
        if (d.frame && d.kids.length) {                                    // 2.453.0: the frame's contents, clipped to it
          const s = d.frame.shape; g.beginPath();
          if (s.kind === "path" && root.PCPath) root.PCPath.traceAll(g, s.path); else if (D && D.shapePath) D.shapePath(g, s);
          g.clip("evenodd"); g.globalAlpha = 1;
          for (const x of d.kids) g.drawImage(x.canvas, 0, 0);
        }
        g.restore();
        const q = [[d.b.x, d.b.y], [d.b.x + d.b.w, d.b.y], [d.b.x + d.b.w, d.b.y + d.b.h], [d.b.x, d.b.y + d.b.h]].map(([x, y]) => [d.m[0] * x + d.m[2] * y + d.m[4], d.m[1] * x + d.m[3] * y + d.m[5]]);
        g.save(); g.strokeStyle = "#2680eb"; g.lineWidth = 1.2 * px; g.setLineDash([5 * px, 3 * px]); g.beginPath(); q.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.stroke(); g.restore();
        return;
      }
      if (!shown()) return;
      const L = target(), b = boxNow(L); if (!b || b.w <= 0 || b.h <= 0) return;
      const P = handlePoints(b);
      g.save(); g.strokeStyle = "#2680eb"; g.lineWidth = 1 * px; g.setLineDash([4 * px, 3 * px]); g.strokeRect(b.x, b.y, b.w, b.h); g.setLineDash([]);
      g.fillStyle = "#fff"; g.lineWidth = 1.2 * px;
      if (st.mode === "rotate") {
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        g.beginPath(); g.arc(cx, cy, 4 * px, 0, Math.PI * 2); g.moveTo(cx - 7 * px, cy); g.lineTo(cx + 7 * px, cy); g.moveTo(cx, cy - 7 * px); g.lineTo(cx, cy + 7 * px); g.stroke();
        for (const h of ["nw", "ne", "se", "sw"]) {                       // curved arrows
          const [x, y] = P[h], a0 = Math.atan2(y - cy, x - cx);
          g.beginPath(); g.arc(x, y, 6 * px, a0 - 1.2, a0 + 1.2); g.lineWidth = 2.4 * px; g.strokeStyle = "#fff"; g.stroke(); g.lineWidth = 1.2 * px; g.strokeStyle = "#2680eb"; g.stroke();
          g.beginPath(); g.arc(x, y, 2.5 * px, 0, Math.PI * 2); g.fill(); g.stroke();
        }
        for (const h of ["n", "e", "s", "w"]) {                           // skew: a small double arrow
          const [x, y] = P[h], horiz = h === "n" || h === "s", s = 6 * px;
          g.beginPath(); if (horiz) { g.moveTo(x - s, y); g.lineTo(x + s, y); } else { g.moveTo(x, y - s); g.lineTo(x, y + s); }
          g.lineWidth = 3 * px; g.strokeStyle = "#fff"; g.stroke(); g.lineWidth = 1.4 * px; g.strokeStyle = "#2680eb"; g.stroke();
        }
      } else {
        for (const h of HANDLES) { const [x, y] = P[h], s = (h.length === 2 ? 4 : 3.2) * px; g.fillRect(x - s, y - s, 2 * s, 2 * s); g.strokeRect(x - s, y - s, 2 * s, 2 * s); }
      }
      g.restore();
    });

    /* ---- the pointer: a handle grabbed before the Move tool sees it (capture) */
    const stage = E.stage;
    stage.addEventListener("pointerdown", (e) => {
      st.click = null;
      if (S.tool !== "move" || !S.w || e.button !== 0 || S.space || !shown()) return;
      const L = target(), b = boxNow(L); if (!b) return;
      const [fx, fy] = E.pos(e), h = hitHandle(b, fx, fy, R());
      if (!h) { st.click = { x: e.clientX, y: e.clientY }; return; }
      e.stopImmediatePropagation(); e.preventDefault();
      const leaves = leavesOf(L).filter((x) => x.visible !== false && x.canvas);
      // 2.453.0: a frame locked to its contents - they go with it (drawn clipped to it while dragging)
      const isFr = !!(E.frames && E.frames.isFrame(L) && L.frame.lock !== false && E.frames.editing() !== L.id);
      const kids = isFr ? E.frames.kidsOf(L).filter((x) => x.type !== "group" && x.visible !== false && x.canvas) : [];
      const hide = leaves.concat(kids);
      st.drag = { L, b, h, p0: [fx, fy], m: [1, 0, 0, 1, 0, 0], leaves, kids, frame: isFr ? L : null, hide, was: hide.map((x) => x.visible) };
      for (const x of hide) x.visible = false;                         // shown on the overlay where it goes instead
      E.renderSoon();
      try { stage.setPointerCapture(e.pointerId); } catch (er) { /* fine */ }
    }, true);
    stage.addEventListener("pointermove", (e) => {
      const d = st.drag; if (!d) return;
      e.stopImmediatePropagation();
      d.m = matrixFor(st.mode, d.h, d.b, d.p0, E.pos(e), { shift: e.shiftKey, alt: e.altKey });
      E.drawOverlay();
    }, true);
    const finish = (e) => {
      const d = st.drag;
      if (!d) {
        // a plain click (no drag) = the scale handles (a double click turns them into the rotate handles)
        if (st.click && e && Math.hypot(e.clientX - st.click.x, e.clientY - st.click.y) < 4 && S.tool === "move" && st.mode !== "scale") { st.mode = "scale"; E.drawOverlay(); }
        st.click = null; return;
      }
      if (e) e.stopImmediatePropagation();
      st.drag = null;
      d.hide.forEach((x, i) => { x.visible = d.was[i]; });
      if (isIdentity(d.m)) { E.renderSoon(); E.drawOverlay(); return; }
      apply(d.L, d.m, st.mode === "rotate" ? (d.h.length === 2 ? "rotate" : "skew") : "scale");
    };
    stage.addEventListener("pointerup", finish, true);
    stage.addEventListener("pointercancel", () => finish(null), true);
    stage.addEventListener("dblclick", () => {
      if (S.tool !== "move" || !shown()) return;
      st.mode = st.mode === "rotate" ? "scale" : "rotate"; E.drawOverlay();
      say(st.mode === "rotate" ? "rotate: drag a corner to turn (Shift = 15° steps), a side to skew - click once for the scale handles" : "scale: drag a handle (Shift keeps the proportions, Alt from the centre) - double-click to rotate");
    });

    /** the matrix onto the layer (all of a group's layers) - one undo step */
    function apply(L, m, label) {
      const before = E.snapStruct(), list = [];
      try { E.dockers.xformLayer(L, m, list); }
      catch (er) { E.putStruct(before); say(label + ": " + er.message); E.refresh(); return false; }
      list.push({ t: "struct", before, after: E.snapStruct() });
      E.push({ t: "multi", list, label }); st.cache = null;
      E.refresh(); E.renderLayersPanel(); E.drawOverlay();
      return true;
    }
    /** the options bar's transform options, round the layer's centre */
    function byOptions(kind, a, b2) {
      const L = target(); if (!L) return say("pick a layer to transform (its position is not locked)");
      const b = boxNow(L); if (!b) return say("nothing to transform there (empty layer?)");
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const m = kind === "rotate" ? turnAbout(a, cx, cy) : kind === "flipH" ? scaleAbout(-1, 1, cx, cy) : kind === "flipV" ? scaleAbout(1, -1, cx, cy) : scaleAbout(a / 100, b2 / 100, cx, cy);
      if (isIdentity(m)) return;
      return apply(L, m, kind === "scale" ? "scale" : kind === "rotate" ? "rotate" : "flip");
    }
    const opt = Object.assign({ ang: 15, sw: 100, sh: 100, link: true }, store.get("xh.opt", {}) || {});
    function addOptions() {
      const o = doc.getElementById("kxOpts"); if (!o || S.tool !== "move" || o.querySelector("#xhBox")) return;
      const box = doc.createElement("span"); box.id = "xhBox"; box.style.cssText = "display:contents";
      box.innerHTML = `<span class="sep"></span><span title="Transform options (round the layer's centre)" style="color:var(--pc-dim)">Transform</span>`
        + `<label title="Angle (degrees, + = clockwise)">∠ <input type="number" id="xhAng" step="1" value="${opt.ang}" style="width:52px">°</label><button class="ghost" id="xhRot" title="Rotate by the angle">↻</button>`
        + `<button class="ghost" id="xhL90" title="Rotate 90° anticlockwise">⟲90</button><button class="ghost" id="xhR90" title="Rotate 90° clockwise">⟳90</button>`
        + `<button class="ghost" id="xhFH" title="Flip horizontal">⇋</button><button class="ghost" id="xhFV" title="Flip vertical">⇵</button>`
        + `<label title="Scale width (%)">W <input type="number" id="xhSW" min="1" max="1000" value="${opt.sw}" style="width:52px">%</label>`
        + `<button class="ghost${opt.link ? " on" : ""}" id="xhLink" title="Width and height together">🔗</button>`
        + `<label title="Scale height (%)">H <input type="number" id="xhSH" min="1" max="1000" value="${opt.sh}" style="width:52px">%</label><button class="ghost" id="xhSc" title="Scale by W % x H %">⤡</button>`
        + `<span style="color:var(--pc-dim);font-size:11px" title="On the canvas">· handles: click = scale, double-click = rotate</span>`;
      o.appendChild(box);
      const q = (id) => box.querySelector("#" + id), keep = () => store.set("xh.opt", opt);
      q("xhAng").onchange = () => { opt.ang = +q("xhAng").value || 0; keep(); };
      q("xhRot").onclick = () => byOptions("rotate", +q("xhAng").value || 0);
      q("xhL90").onclick = () => byOptions("rotate", -90); q("xhR90").onclick = () => byOptions("rotate", 90);
      q("xhFH").onclick = () => byOptions("flipH"); q("xhFV").onclick = () => byOptions("flipV");
      q("xhLink").onclick = () => { opt.link = !opt.link; q("xhLink").classList.toggle("on", opt.link); if (opt.link) { q("xhSH").value = q("xhSW").value; opt.sh = opt.sw; } keep(); };
      q("xhSW").onchange = () => { opt.sw = Math.max(1, +q("xhSW").value || 100); if (opt.link) { opt.sh = opt.sw; q("xhSH").value = opt.sw; } keep(); };
      q("xhSH").onchange = () => { opt.sh = Math.max(1, +q("xhSH").value || 100); if (opt.link) { opt.sw = opt.sh; q("xhSW").value = opt.sh; } keep(); };
      q("xhSc").onclick = () => byOptions("scale", opt.sw, opt.sh);
      box.querySelectorAll("input").forEach((x) => x.addEventListener("keydown", (ev) => ev.stopPropagation()));
    }
    const ob = doc.getElementById("kxOpts");
    if (ob && root.MutationObserver) new root.MutationObserver(() => addOptions()).observe(ob, { childList: true });
    addOptions();
    E.handles = { state: () => ({ mode: st.mode, dragging: !!st.drag }), setMode: (m) => { st.mode = m === "rotate" ? "rotate" : "scale"; E.drawOverlay(); }, apply, byOptions, box: () => { const L = target(); return L ? boxNow(L) : null; } };
  }

  const PCHandles = { HANDLES, mul, about, turnAbout, scaleAbout, handlePoints, hitHandle, matrixFor, isIdentity, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCHandles;
  if (root && root.document) root.PCHandles = PCHandles;
})(typeof window !== "undefined" ? window : globalThis);
