/* pcfill.js — THE IMAGE EDITOR'S COLOURS, NEW, PAINT BUCKET AND GRADIENT FILL (2.396.0), window.PCFill.
 *
 * Tim (verbatim): "can we do more work on the image editor, start with making the tools in the toolbar functional -
 * when new make the background the color in the background select, when swap with foreground change the background
 * color, add a bucket fill/gradient fill" (asked: swapping also recolours the canvas).
 *
 *   NEW           File ▸ New's Background starts on "Background colour" - the swatch's colour, shown beside it
 *   SWAP (X / ⇄)  the foreground and background colours change places; when the document's bottom layer (the
 *                 Background) is still ONE plain colour it is repainted with the new background colour (one undo step)
 *   SWATCHES      bigger, ringed so a dark colour shows on the dark theme; ⇄ and ◩ are real buttons; the Color
 *                 panel has ⇄ too
 *   PAINT BUCKET  its own button in the tool column (G; Shift+G cycles Gradient / Paint Bucket). Fill: Foreground,
 *                 Background or Gradient; Tolerance, Contiguous, All layers, Opacity. Gradient: click = the region top
 *                 to bottom, drag = your direction - the Gradient tool's colours and shape (linear, radial ...),
 *                 inside the clicked region only. A selection under the click = the selection is filled.
 * Pure helpers (tested in Node: scripts/test-pcfill.js): solidOf, maskBox, gradLine, swapPlan, bucketPlan.
 */
(function (root) {
  "use strict";

  /* ================================ pure ================================ */
  const hex2 = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  /** RGBA data -> "#rrggbb" when EVERY pixel is that one opaque colour, else null */
  function solidOf(data) {
    const d = data; if (!d || d.length < 4) return null;
    const r = d[0], g = d[1], b = d[2];
    if (d[3] !== 255) return null;
    for (let i = 4; i < d.length; i += 4) if (d[i] !== r || d[i + 1] !== g || d[i + 2] !== b || d[i + 3] !== 255) return null;
    return "#" + hex2(r) + hex2(g) + hex2(b);
  }
  /** the box of a mask's set pixels (values > 0) -> {x, y, w, h} | null */
  function maskBox(m, w, h) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) { const o = y * w; for (let x = 0; x < w; x++) if (m[o + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  /** the bucket's gradient line: a drag (>= 3 px) = the drag; a click = the region's box top -> bottom through its middle */
  function gradLine(box, x0, y0, x1, y1) {
    if (Math.hypot(x1 - x0, y1 - y0) >= 3) return { x0, y0, x1, y1, dragged: true };
    if (!box) return { x0, y0, x1: x0, y1: y0 + 1, dragged: false };
    const cx = box.x + box.w / 2;
    return { x0: cx, y0: box.y, x1: cx, y1: box.y + box.h, dragged: false };
  }
  /** what a swap does: {fg, bg, recolour: "#hex" | null} - bgSolid = the Background layer's one colour (or null) */
  function swapPlan(fg, bg, bgSolid) {
    const nfg = bg, nbg = fg;
    return { fg: nfg, bg: nbg, recolour: bgSolid && bgSolid.toLowerCase() !== String(nbg).toLowerCase() ? nbg : null };
  }
  /** the bucket's fill as a plan: what fills (fg / bg / gradient) and the colour */
  const SOURCES = ["fg", "bg", "gradient"];
  function bucketPlan(source, fg, bg) {
    const s = SOURCES.includes(source) ? source : "fg";
    return { source: s, color: s === "bg" ? bg : s === "fg" ? fg : null };
  }

  /* ================================ the editor ================================ */
  function install(E) {
    const { S, P, B, doc, ctx, newCanvas, say, store } = E;
    const $ = (id) => doc.getElementById(id);
    S.bucketSrc = store.get("t.bsrc", "fg"); S.bucketOp = store.get("t.bop", 100);
    if (S.bucketContig == null) S.bucketContig = store.get("t.bcontig", true);

    /* ---------------- swap: the swatches, and the Background when it is one plain colour ---------------- */
    function bgLayer() { const L = S.layers && S.layers[0]; return L && L.type === "pixel" && L.canvas && !L.mask ? L : null; }
    function swapColors() {
      const L = S.w ? bgLayer() : null;
      let solid = null;
      if (L && L.visible !== false && !(L.locks && (L.locks.all || L.locks.px))) { try { solid = solidOf(ctx(L.canvas).getImageData(0, 0, L.canvas.width, L.canvas.height).data); } catch (e) { solid = null; } }
      const plan = swapPlan(S.fg, S.bg, solid);
      E.setFg(plan.fg); E.setBg(plan.bg);
      if (plan.recolour && L) {
        const copy = E.beginPx(L, null), g = ctx(L.canvas);
        g.save(); g.globalCompositeOperation = "copy"; g.fillStyle = plan.recolour; g.fillRect(0, 0, L.canvas.width, L.canvas.height); g.restore();
        const px = E.endPx(L, copy, null, "background colour"); if (px) E.push(px);
        E.refresh(); E.renderLayersPanel();
        say("swapped - the Background was one plain colour, so it is " + plan.recolour + " now (Ctrl+Z undoes)");
      }
      return plan;
    }
    E.swapColors = swapColors;
    const sx = $("kxSwap"); if (sx) sx.onclick = (e) => { e.preventDefault(); swapColors(); };

    /* ---------------- the bucket ---------------- */
    let bk = null;
    function regionAt(x, y) {
      const L = E.layer ? E.layer() : S.layers[S.active];
      const hasSel = S.sel && S.selCount > 0;
      if (hasSel && S.sel[y * S.w + x]) return S.sel;
      const src = S.sampleAll && !S.qm && !E.onMask(L) ? E.flattenCache() : E.target(L);
      let m = P.wand(ctx(src).getImageData(0, 0, S.w, S.h).data, S.w, S.h, x, y, S.tol, S.bucketContig !== false);
      if (hasSel) m = P.combine(Uint8Array.from(m), S.sel, "intersect");
      return m;
    }
    function maskCanvas(m) {
      const t = newCanvas(S.w, S.h), tg = ctx(t), id = tg.createImageData(S.w, S.h);
      for (let i = 0; i < m.length; i++) if (m[i]) { id.data[i * 4 + 3] = m[i]; }
      tg.putImageData(id, 0, 0); return t;
    }
    function gradCanvas(x0, y0, x1, y1) {
      const T = root.PCTools, t = newCanvas(S.w, S.h), tg = ctx(t);
      const stops = T && T.gradStops ? T.gradStops(S.gradKind || "fgbg", S.fg, S.bg, !!S.gradRev, S.gradCustom) : [[0, S.fg], [1, S.bg]];
      const len = Math.max(1, Math.hypot(x1 - x0, y1 - y0));
      let gr;
      if (S.gradType === "radial") gr = tg.createRadialGradient(x0, y0, 0, x0, y0, len);
      else if (S.gradType === "angle" && tg.createConicGradient) gr = tg.createConicGradient(Math.atan2(y1 - y0, x1 - x0), x0, y0);
      else gr = tg.createLinearGradient(x0, y0, x1, y1);
      stops.forEach(([s, c]) => gr.addColorStop(Math.max(0, Math.min(1, s)), c));
      tg.fillStyle = gr; tg.fillRect(0, 0, S.w, S.h); return t;
    }
    function bucketApply(b, x1, y1) {
      const plan = bucketPlan(S.bucketSrc, S.fg, S.bg);
      return E.pxOp(plan.source === "gradient" ? "gradient fill" : "fill", (c, g) => {
        let t;
        if (plan.source === "gradient") { const ln = gradLine(b.box, b.fx, b.fy, x1, y1); t = gradCanvas(ln.x0, ln.y0, ln.x1, ln.y1); }
        else { t = newCanvas(S.w, S.h); const tg = ctx(t); tg.fillStyle = plan.color; tg.fillRect(0, 0, S.w, S.h); }
        const tg = ctx(t); tg.globalCompositeOperation = "destination-in"; tg.drawImage(maskCanvas(b.m), 0, 0);
        g.save(); g.globalAlpha = Math.max(0.01, Math.min(1, (S.bucketOp == null ? 100 : S.bucketOp) / 100));
        if (S.fgNone && plan.source !== "gradient" && S.bucketSrc !== "bg") g.globalCompositeOperation = "destination-out";   // 2.430.0: ⊠ transparent foreground = the area cleared
        g.drawImage(t, 0, 0); g.restore();
      });
    }
    const T = E.tools;
    T.fill = {
      id: "fill", name: "Paint Bucket", cursor: "crosshair",
      options: () => `<label title="What the bucket pours">Fill <select id="pfSrc">${[["fg", "Foreground"], ["bg", "Background"], ["gradient", "Gradient"]].map(([v, l]) => `<option value="${v}"${v === S.bucketSrc ? " selected" : ""}>${l}</option>`).join("")}</select></label>`
        + (S.bucketSrc === "gradient" ? `<span class="pfhint" style="color:var(--pc-dim);font-size:11px" title="The Gradient tool's colours and shape are used">click = top → bottom, drag = your direction</span>` : "")
        + `<span class="sep"></span><label title="How close a colour must be to the clicked one (0-255)">Tolerance <input type="number" id="ieTol" min="0" max="255" value="${S.tol}"></label>`
        + `<label title="Only the connected area (off = every matching pixel)"><input type="checkbox" id="pfContig" ${S.bucketContig !== false ? "checked" : ""}> Contiguous</label>`
        + `<label title="Look at all visible layers to find the area"><input type="checkbox" id="pfAll" ${S.sampleAll ? "checked" : ""}> All layers</label>`
        + `<label>Opacity <input type="range" id="pfOp" min="1" max="100" value="${S.bucketOp}"><input type="number" id="pfOpN" min="1" max="100" value="${S.bucketOp}" style="width:46px"></label>`,
      bindOptions(o) {
        const s = o.querySelector("#pfSrc"); s.onchange = () => { S.bucketSrc = s.value; store.set("t.bsrc", s.value); E.renderOptions(); };
        const tol = o.querySelector("#ieTol"); tol.onchange = () => { S.tol = Math.max(0, Math.min(255, +tol.value || 0)); };
        const cg = o.querySelector("#pfContig"); cg.onchange = () => { S.bucketContig = cg.checked; store.set("t.bcontig", cg.checked); };
        const al = o.querySelector("#pfAll"); al.onchange = () => { S.sampleAll = al.checked; store.set("sampleall", al.checked); };
        const r = o.querySelector("#pfOp"), n = o.querySelector("#pfOpN");
        const set = (v) => { S.bucketOp = Math.max(1, Math.min(100, +v || 100)); store.set("t.bop", S.bucketOp); r.value = n.value = S.bucketOp; };
        r.oninput = () => set(r.value); n.onchange = () => set(n.value);
      },
      down(e, fx, fy) {
        if (!E.canPaint()) return false;
        const x = Math.floor(fx), y = Math.floor(fy);
        if (x < 0 || y < 0 || x >= S.w || y >= S.h) return false;
        if (e.altKey) { E.pickColor(x, y); return false; }           // Alt-click picks, like the brushes
        const m = regionAt(x, y);
        bk = { m, box: maskBox(m, S.w, S.h), fx, fy, x1: fx, y1: fy };
      },
      move(e, fx, fy) { if (!bk || S.bucketSrc !== "gradient") return; bk.x1 = fx; bk.y1 = fy; E.drawOverlay(); },
      up(e, fx, fy) {
        const b = bk; bk = null; E.drawOverlay();
        if (!b || !b.box) return;
        bucketApply(b, S.bucketSrc === "gradient" ? fx : b.fx, S.bucketSrc === "gradient" ? fy : b.fy);
      },
      leave() { bk = null; },
    };
    E.overlayHooks.push((g, px) => {
      if (!bk || S.bucketSrc !== "gradient" || Math.hypot(bk.x1 - bk.fx, bk.y1 - bk.fy) < 3) return;
      g.lineWidth = 1.5 * px; g.setLineDash([]); g.strokeStyle = "#fff"; g.beginPath(); g.moveTo(bk.fx, bk.fy); g.lineTo(bk.x1, bk.y1); g.stroke();
      g.strokeStyle = "#000"; g.setLineDash([4 * px, 4 * px]); g.stroke(); g.setLineDash([]);
    });
    E.bucketAt = (x, y, x1, y1) => { const m = regionAt(x, y); return bucketApply({ m, box: maskBox(m, S.w, S.h), fx: x, fy: y }, x1 == null ? x : x1, y1 == null ? y : y1); };
    if (S.tool === "fill" && E.renderOptions) E.renderOptions();
  }

  const api = { install, solidOf, maskBox, gradLine, swapPlan, bucketPlan, SOURCES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document) root.PCFill = api;
})(typeof window !== "undefined" ? window : globalThis);
