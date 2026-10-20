/* pctools.js — THE IMAGE EDITOR'S PHOTOSHOP TOOLS (2.389.0), window.PCTools.
 *
 * Tim (verbatim): "can we build our image editor to have the same functionality and look as
 * https://github.com/storytold/photocraft" - "Rebuild ours, in phases". The tools PhotoCraft / Photoshop have that the
 * editor did not, written from Photoshop's public behaviour:
 *
 *   Crop (C)            a box with handles, a ratio, the rule of thirds; Enter crops every layer, Esc cancels
 *   Gradient (G)        linear / radial / angle / reflected / diamond; foreground → background / → transparent /
 *                       black-white / spectrum; reverse, opacity, blend - inside the selection, on a mask too
 *   Clone Stamp (S)     Alt-click a source, paint it (aligned or from the source each stroke; this layer / all layers)
 *   Healing Brush (J)   the clone, its colour matched to where it lands
 *   Spot Healing (J)    paint over a spot: it is filled from around it (push-pull)
 *   History Brush (Y)   paints the layer back as it was opened (or when ⟲ Set source was pressed)
 *   Dodge / Burn / Sponge (O)   lighten / darken shadows, midtones or highlights by an exposure; (de)saturate
 *   Blur / Sharpen / Smudge (R) a strength
 *   Pencil (B)          a hard 100 % edge
 *   Type (T)            a click makes a TEXT layer (or edits the one under it) - font, size, bold, italic, align,
 *                       leading, tracking, colour; it stays editable
 *   Shapes (U)          rectangle / rounded / ellipse / line / triangle / polygon as SHAPE layers (fill, stroke,
 *                       dashes), still editable
 *   Zoom (Z)            click in, Alt-click out
 *   Free Transform      Ctrl+T: move, scale (corners keep the proportions, Shift frees them), rotate outside the box;
 *                       2.551.0: a MIDDLE handle skews (the skew cursor), Shift / Alt + a middle handle stretches that side
 *                       (Shift = 15° steps); X / Y / W / H / angle in the options bar; Enter / Esc
 *   E.img               the Image menu: Image Size, Canvas Size, rotate / flip the canvas or the layer, Crop to the
 *                       selection, Trim, Auto Tone / Contrast / Color
 *
 * Each tool is {down, move, up, key, options, bindOptions, leave, hover, dblclick, brush, cursor} - the editor
 * (imageedit.js) calls them; brush-like ones paint through E.beginStroke with their own dab (brushes.js o.dab).
 * The geometry (crop ratios, transform matrices and handles, gradient stops, tone weights) is pure (tested in Node).
 */
(function (root) {
  "use strict";

  /* =============================== pure helpers =============================== */
  const RATIOS = { free: 0, original: -1, "1:1": 1, "4:3": 4 / 3, "3:2": 3 / 2, "16:9": 16 / 9, "9:16": 9 / 16, "2:3": 2 / 3 };
  /** a crop box from a drag, kept to a ratio (w/h; 0 = free) and inside the picture */
  function cropBox(x0, y0, x1, y1, ratio, W, H) {
    let w = x1 - x0, h = y1 - y0;
    if (ratio > 0) { const aw = Math.abs(w), ah = Math.abs(h); if (aw / Math.max(1, ah) > ratio) w = Math.sign(w || 1) * ah * ratio; else h = Math.sign(h || 1) * aw / ratio; }
    let x = Math.min(x0, x0 + w), y = Math.min(y0, y0 + h);
    w = Math.abs(w); h = Math.abs(h);
    const ex = Math.max(1, Math.min(W, Math.round(x + w))), ey = Math.max(1, Math.min(H, Math.round(y + h)));   // clipped at the picture's edges
    x = Math.max(0, Math.min(W - 1, Math.round(x))); y = Math.max(0, Math.min(H - 1, Math.round(y)));
    return { x, y, w: Math.max(1, ex - x), h: Math.max(1, ey - y) };
  }
  /** the free transform's matrix [a b c d e f]: about the box centre, then moved */
  function xform(T) {
    // 2.550.0: + skew - kx (horizontal: x += kx·y) / ky (vertical: y += ky·x), applied after the scale, before the turn
    const cx = T.box.x + T.box.w / 2, cy = T.box.y + T.box.h / 2, c = Math.cos(T.rot), s = Math.sin(T.rot), kx = T.kx || 0, ky = T.ky || 0;
    const a = T.sx * (c - s * ky), b = T.sx * (s + c * ky), cc = T.sy * (c * kx - s), d = T.sy * (s * kx + c);
    return [a, b, cc, d, cx + T.tx - (a * cx + cc * cy), cy + T.ty - (b * cx + d * cy)];
  }
  const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  function invert(m) {
    const det = m[0] * m[3] - m[1] * m[2] || 1e-9;
    return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
  }
  /** 2.550.0: the skew a drag of (dx, dy) on edge handle h gives - the top / bottom edge (j 0 / 2) = horizontal (kx),
   *  the left / right edge (i 0 / 2) = vertical (ky); the drag is turned back by the rotation and counted in the
   *  scaled box (t0 = the transform when the drag started) */
  function skewFor(h, dx, dy, t0, box) {
    const c = Math.cos(-t0.rot), s = Math.sin(-t0.rot), lx = dx * c - dy * s, ly = dx * s + dy * c;
    let kx = t0.kx || 0, ky = t0.ky || 0;
    if (h.i === 1 && (h.j === 0 || h.j === 2)) kx = (t0.kx || 0) + (h.j === 2 ? 2 : -2) * lx / Math.max(1, box.h * Math.abs(t0.sy));
    else if (h.j === 1 && (h.i === 0 || h.i === 2)) ky = (t0.ky || 0) + (h.i === 2 ? 2 : -2) * ly / Math.max(1, box.w * Math.abs(t0.sx));
    const cap = Math.tan(80 * Math.PI / 180);
    return { kx: Math.max(-cap, Math.min(cap, kx)), ky: Math.max(-cap, Math.min(cap, ky)) };
  }
  /** what is under (x, y) of a transform: a corner / edge handle, inside (move) or outside (rotate) */
  function hitTransform(T, x, y, tol) {
    const m = xform(T), [lx, ly] = apply(invert(m), x, y), b = T.box;
    const tl = tol / Math.max(0.01, Math.min(Math.abs(T.sx), Math.abs(T.sy)));
    const hx = [b.x, b.x + b.w / 2, b.x + b.w], hy = [b.y, b.y + b.h / 2, b.y + b.h];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      if (i === 1 && j === 1) continue;
      if (Math.abs(lx - hx[i]) <= tl && Math.abs(ly - hy[j]) <= tl) return { kind: i !== 1 && j !== 1 ? "corner" : "edge", i, j };
    }
    if (lx >= b.x && lx <= b.x + b.w && ly >= b.y && ly <= b.y + b.h) return { kind: "move" };
    return { kind: "rotate" };
  }
  /** a tool's tone weight for a pixel of lightness l (0..1): shadows / midtones / highlights */
  function toneWeight(range, l) {
    if (range === "shadows") return Math.max(0, 1 - l * 1.6) ** 2 * 1.2;
    if (range === "highlights") return Math.max(0, l * 1.6 - 0.6) ** 2 * 1.2;
    return Math.max(0, 1 - Math.abs(2 * l - 1));
  }
  /** dodge / burn / sponge on RGBA in place: k = strength already times the tip weight */
  function toneDab(d, i, kind, k, range) {
    const r = d[i], g = d[i + 1], b = d[i + 2], l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (kind === "sponge" || kind === "desaturate") {
      const avg = (r + g + b) / 3, f = kind === "desaturate" ? 1 - k : 1 + k;
      d[i] = avg + (r - avg) * f; d[i + 1] = avg + (g - avg) * f; d[i + 2] = avg + (b - avg) * f; return;
    }
    const t = k * toneWeight(range, l);
    for (let c = 0; c < 3; c++) d[i + c] = kind === "dodge" ? d[i + c] + (255 - d[i + c]) * t : d[i + c] * (1 - t);
  }
  const GRAD_KINDS = ["linear", "radial", "angle", "reflected", "diamond"];
  /** the gradient's colour stops: [[t, "rgba(...)"]] */
  function gradStops(kind, fg, bg, reverse, custom) {
    const rgb = (h) => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h || "#000000") || [0, "00", "00", "00"]; return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]; };
    let st;
    if (kind === "custom" && custom && root.PCGrad) st = root.PCGrad.toCanvas(custom, fg, bg);     // 2.434.0: the Gradient Editor's
    else if (kind === "fgtrans") { const c = rgb(fg); st = [[0, `rgba(${c},1)`], [1, `rgba(${c},0)`]]; }
    else if (kind === "bw") st = [[0, "rgba(0,0,0,1)"], [1, "rgba(255,255,255,1)"]];
    else if (kind === "spectrum") st = ["#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff", "#ff0000"].map((c, i, a) => [i / (a.length - 1), `rgba(${rgb(c)},1)`]);
    else st = [[0, `rgba(${rgb(fg)},1)`], [1, `rgba(${rgb(bg)},1)`]];
    return reverse ? st.map(([t, c]) => [1 - t, c]).reverse() : st;
  }

  /* =============================== the tools =============================== */
  function install(E) {
    const { S, P, B, D, doc, win, ctx, newCanvas, say, store } = E;
    const num = (k, d) => store.get(k, d);
    S.hard = num("t.hard", 0.5); S.toolStr = num("t.str", 50); S.toneRange = num("t.range", "midtones"); S.spongeMode = num("t.sponge", "desaturate");
    S.gradType = num("t.gtype", "linear"); S.gradKind = num("t.gkind", "fgbg"); S.gradRev = false; S.gradOpacity = num("t.gop", 100); S.gradBlend = "normal";
    S.cloneAligned = num("t.aligned", true); S.cloneAll = num("t.cloneall", false); S.cropRatio = num("t.ratio", "free");
    S.shapeKind = num("t.shape", "rect"); S.shapeStrokeW = num("t.sw", 0); S.shapeRadius = num("t.rad", 0); S.shapeSides = num("t.sides", 5);
    S.typeFont = num("t.font", "Arial"); S.typeSize = num("t.tsize", 48); S.typeBold = false; S.typeItalic = false; S.typeAlign = "left"; S.typeLeading = 1.2; S.typeTracking = 0;
    S.typeFx = (store.get ? store.get("t.fx", "") : "") || "";                // 2.411.0: the text effect preset for new text

    const T = E.tools;
    const opt = (html) => html;
    const rangeOpt = (id, label, min, max, v, title) => `<label title="${title || label}">${label} <input type="range" id="${id}" min="${min}" max="${max}" value="${v}"><input type="number" id="${id}N" min="${min}" max="${max}" value="${v}" style="width:46px"></label>`;
    function bindRange(o, id, set) {
      const r = o.querySelector("#" + id), n = o.querySelector("#" + id + "N"); if (!r) return;
      r.oninput = () => { n.value = r.value; set(+r.value); }; n.onchange = () => { r.value = n.value; set(+n.value); };
    }
    const sizeOpts = () => rangeOpt("ptSize", "Size", 1, 600, Math.round(S.size), "Brush size ([ and ])") + rangeOpt("ptHard", "Hardness", 0, 100, Math.round(S.hard * 100), "Hardness: 100 = a hard edge");
    function bindSize(o) {
      bindRange(o, "ptSize", (v) => E.setSize(v));
      bindRange(o, "ptHard", (v) => { S.hard = v / 100; store.set("t.hard", S.hard); });
    }

    /* ---------------- dab tools ---------------- */
    const tipCache = new Map();
    function weights(n) {
      const key = n + "|" + S.hard;
      if (tipCache.has(key)) return tipCache.get(key);
      const t = B.tipAlpha({ tip: "round", hardness: S.hard }, n, 1), w = new Float32Array(t.size * t.size);
      for (let i = 0; i < w.length; i++) w[i] = t.alpha[i] / 255;
      if (tipCache.size > 200) tipCache.clear();
      const r = { n: t.size, w }; tipCache.set(key, r); return r;
    }
    const dabPreset = (id) => ({ id: "tool-" + id, name: id, engine: "custom", tip: "round", hardness: S.hard, spacing: 0.12, size: S.size, opacity: 1, flow: 1, pressure: { size: false, flow: true } });
    /** a dab that changes the pixels under it through op(data, i, weight) */
    function pixelDab(op, needsNeighbours) {
      return (Lc, x, y, n, flow) => {
        const tw = weights(n), N = tw.n, sx = Math.round(x - N / 2), sy = Math.round(y - N / 2);
        const x0 = Math.max(0, sx), y0 = Math.max(0, sy), x1 = Math.min(Lc.width, sx + N), y1 = Math.min(Lc.height, sy + N);
        if (x1 <= x0 || y1 <= y0) return;
        const g = ctx(Lc), w = x1 - x0, h = y1 - y0, id = g.getImageData(x0, y0, w, h), d = id.data;
        const src = needsNeighbours ? Uint8ClampedArray.from(d) : null;
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
          const wt = tw.w[(j + y0 - sy) * N + (i + x0 - sx)] * flow; if (wt <= 0.002) continue;
          op(d, (j * w + i) * 4, wt, src, i, j, w, h);
        }
        g.putImageData(id, x0, y0);
      };
    }
    const strength = () => S.toolStr / 100;
    function blur3(src, i, x, y, w, h, c) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; s += src[(yy * w + xx) * 4 + c]; n++; }
      return s / n;
    }
    function dabTool(id, name, cursorTitle, makeDab, extraOpts, bindExtra, opts) {
      T[id] = {
        id, name, brush: true, cursor: "none",
        options: () => sizeOpts() + (extraOpts ? `<span class="sep"></span>${extraOpts()}` : ""),
        bindOptions: (o) => { bindSize(o); if (bindExtra) bindExtra(o); },
        down(e, fx, fy) {
          const pre = opts && opts.before ? opts.before(e, fx, fy) : true;
          if (pre === false) return false;
          if (pre === "handled") return false;
          const dab = makeDab(e, fx, fy);
          if (!dab) return false;
          if (!E.beginStroke(e, fx, fy, { preset: dabPreset(id), stroke: { dab }, label: name })) return false;
        },
      };
    }
    const strengthOpt = (label) => rangeOpt("ptStr", label || "Strength", 1, 100, S.toolStr, (label || "Strength") + " (%)");
    const bindStr = (o) => bindRange(o, "ptStr", (v) => { S.toolStr = v; store.set("t.str", v); });
    // 2.423.0: the dab-tool kit for other files (pcheal.js: the Mixer Brush, the Background Eraser)
    E.dab = { dabTool, pixelDab, weights, rangeOpt, bindRange, sizeOpts, bindSize, strengthOpt, bindStr };
    const rangeSel = () => `<label>Range <select id="ptRange">${["shadows", "midtones", "highlights"].map((r) => `<option${r === S.toneRange ? " selected" : ""}>${r}</option>`).join("")}</select></label>`;
    const bindRangeSel = (o) => { const s = o.querySelector("#ptRange"); if (s) s.onchange = () => { S.toneRange = s.value; store.set("t.range", s.value); }; };

    dabTool("dodge", "Dodge", "", () => pixelDab((d, i, w) => toneDab(d, i, "dodge", w * strength() * 0.25, S.toneRange)),
      () => rangeSel() + strengthOpt("Exposure"), (o) => { bindRangeSel(o); bindStr(o); });
    dabTool("burn", "Burn", "", () => pixelDab((d, i, w) => toneDab(d, i, "burn", w * strength() * 0.25, S.toneRange)),
      () => rangeSel() + strengthOpt("Exposure"), (o) => { bindRangeSel(o); bindStr(o); });
    dabTool("sponge", "Sponge", "", () => pixelDab((d, i, w) => toneDab(d, i, S.spongeMode === "saturate" ? "sponge" : "desaturate", w * strength() * 0.2)),
      () => `<label>Mode <select id="ptSponge"><option value="desaturate"${S.spongeMode !== "saturate" ? " selected" : ""}>Desaturate</option><option value="saturate"${S.spongeMode === "saturate" ? " selected" : ""}>Saturate</option></select></label>` + strengthOpt("Flow"),
      (o) => { const s = o.querySelector("#ptSponge"); s.onchange = () => { S.spongeMode = s.value; store.set("t.sponge", s.value); }; bindStr(o); });
    dabTool("blurtool", "Blur", "", () => pixelDab((d, i, w, src, x, y, ww, hh) => { const k = Math.min(1, w * strength()); for (let c = 0; c < 4; c++) d[i + c] = d[i + c] + (blur3(src, i, x, y, ww, hh, c) - d[i + c]) * k; }, true),
      () => strengthOpt(), bindStr);
    dabTool("sharpen", "Sharpen", "", () => pixelDab((d, i, w, src, x, y, ww, hh) => { const k = w * strength() * 0.6; for (let c = 0; c < 3; c++) d[i + c] = d[i + c] + (d[i + c] - blur3(src, i, x, y, ww, hh, c)) * k; }, true),
      () => strengthOpt(), bindStr);
    // smudge: the brush engine's own smudge, at this size / strength
    T.smudge = {
      id: "smudge", name: "Smudge", brush: true, cursor: "none",
      options: () => sizeOpts() + `<span class="sep"></span>` + strengthOpt(), bindOptions: (o) => { bindSize(o); bindStr(o); },
      down(e, fx, fy) {
        const p = Object.assign({}, B.byId("smudge"), { hardness: S.hard, id: "tool-smudge" });
        if (!E.beginStroke(e, fx, fy, { preset: p, stroke: { flow: strength(), opacity: 1 }, label: "smudge" })) return false;
      },
    };
    // pencil: a hard, fully opaque round
    T.pencil = {
      id: "pencil", name: "Pencil", brush: true, cursor: "none",
      options: () => rangeOpt("ptSize", "Size", 1, 200, Math.round(S.size), "Pencil size") + rangeOpt("ptOp", "Opacity", 1, 100, Math.round(S.opacity * 100)),
      bindOptions: (o) => { bindRange(o, "ptSize", (v) => E.setSize(v)); bindRange(o, "ptOp", (v) => { S.opacity = v / 100; }); },
      down(e, fx, fy) {
        const p = { id: "tool-pencil", name: "Pencil", engine: "paint", tip: "square", size: S.size, opacity: 1, flow: 1, hardness: 1, spacing: 0.05, pressure: { size: false, flow: false } };
        if (!E.beginStroke(e, fx, fy, { preset: p, stroke: { flow: 1 }, label: "pencil" })) return false;
      },
    };

    /* clone / healing / history: a source canvas and an offset */
    S.cloneSrc = null; S.cloneOff = null;
    function sourceDab(getSrc, heal, getOff) {
      return (Lc, x, y, n, flow) => {
        const src = getSrc(); if (!src) return;
        const tw = weights(n), N = tw.n, sx = Math.round(x - N / 2), sy = Math.round(y - N / 2);
        const off = (getOff ? getOff() : S.cloneOff) || [0, 0];
        const t = newCanvas(N, N), tg = ctx(t);
        tg.drawImage(src.c, sx + off[0], sy + off[1], N, N, 0, 0, N, N);
        const id = tg.getImageData(0, 0, N, N), d = id.data;
        let corr = null;
        if (heal) {                                       // the colour of where it lands
          const x0 = Math.max(0, sx), y0 = Math.max(0, sy), x1 = Math.min(Lc.width, sx + N), y1 = Math.min(Lc.height, sy + N);
          if (x1 > x0 && y1 > y0) {
            const dd = ctx(Lc).getImageData(x0, y0, x1 - x0, y1 - y0).data, ms = [0, 0, 0], md = [0, 0, 0]; let ns = 0, nd = 0;
            for (let j = 0; j < y1 - y0; j++) for (let i = 0; i < x1 - x0; i++) {
              const wt = tw.w[(j + y0 - sy) * N + (i + x0 - sx)]; if (wt < 0.3) continue;
              const k = (j * (x1 - x0) + i) * 4, ks = ((j + y0 - sy) * N + (i + x0 - sx)) * 4;
              for (let c = 0; c < 3; c++) { md[c] += dd[k + c]; ms[c] += d[ks + c]; } nd++; ns++;
            }
            if (nd && ns) corr = [0, 1, 2].map((c) => (md[c] / nd - ms[c] / ns));
          }
        }
        for (let i = 0; i < N * N; i++) {
          if (corr) for (let c = 0; c < 3; c++) d[i * 4 + c] = d[i * 4 + c] + corr[c] * 0.85;
          d[i * 4 + 3] = d[i * 4 + 3] * tw.w[i];
        }
        tg.putImageData(id, 0, 0);
        const g = ctx(Lc); g.save(); g.globalAlpha = Math.min(1, flow * S.opacity * (heal ? 0.9 : 1)); g.drawImage(t, sx, sy); g.restore();
      };
    }
    function cloneLike(id, name, heal) {
      let pending = null, src = null;
      dabTool(id, name, "", () => sourceDab(() => src, heal),
        () => `<label><input type="checkbox" id="ptAligned" ${S.cloneAligned ? "checked" : ""}> Aligned</label><label>Sample <select id="ptCAll"><option value="cur"${S.cloneAll ? "" : " selected"}>Current layer</option><option value="all"${S.cloneAll ? " selected" : ""}>All layers</option></select></label>`
          + rangeOpt("ptOp", "Opacity", 1, 100, Math.round(S.opacity * 100)),
        (o) => { const a = o.querySelector("#ptAligned"); a.onchange = () => { S.cloneAligned = a.checked; store.set("t.aligned", a.checked); };
          const c = o.querySelector("#ptCAll"); c.onchange = () => { S.cloneAll = c.value === "all"; store.set("t.cloneall", S.cloneAll); };
          bindRange(o, "ptOp", (v) => { S.opacity = v / 100; }); },
        { before(e, fx, fy) {
          if (e.altKey) { pending = [fx, fy]; S.cloneOff = null; S.cloneMark = [fx, fy]; say(`${name}: source set - now paint where it should go`); E.drawOverlay(); return "handled"; }
          if (!pending && !S.cloneOff) { say(`${name}: Alt-click the place to copy from first`); return false; }
          if (pending && (!S.cloneOff || !S.cloneAligned)) { S.cloneOff = [Math.round(pending[0] - fx), Math.round(pending[1] - fy)]; if (!S.cloneAligned) { /* keep pending: each stroke starts at the source */ } else pending = null; }
          const L = E.layer(), c = S.cloneAll ? E.flatten() : L && L.canvas;
          if (!c) return false;
          const copy = newCanvas(c.width, c.height); ctx(copy).drawImage(c, 0, 0); src = { c: copy };
          return true;
        } });
      T[id].hover = () => {};
    }
    cloneLike("clone", "Clone Stamp", false);
    cloneLike("heal", "Healing Brush", true);
    E.overlayHooks.push((g, px, cur) => {
      if (!["clone", "heal"].includes(S.tool)) return;
      const at = S.cloneOff && cur ? [cur[0] + S.cloneOff[0], cur[1] + S.cloneOff[1]] : S.cloneMark;
      if (!at) return;
      g.strokeStyle = "#fff"; g.lineWidth = px; g.beginPath(); g.moveTo(at[0] - 6 * px, at[1]); g.lineTo(at[0] + 6 * px, at[1]); g.moveTo(at[0], at[1] - 6 * px); g.lineTo(at[0], at[1] + 6 * px); g.stroke();
      g.beginPath(); g.arc(at[0], at[1], S.size / 2, 0, Math.PI * 2); g.setLineDash([3 * px, 3 * px]); g.stroke();
    });
    dabTool("histbrush", "History Brush", "", (e) => {
      const L = E.layer(), c = L && S.histSrc.get(L.id);
      if (!c) { say("History Brush: this layer has no history source (it was made after the picture opened) - ⟲ Set source first"); return null; }
      return sourceDab(() => ({ c }), false, () => [0, 0]);
    }, () => `<button class="ghost" id="ptHistSet" title="Every layer as it is NOW becomes what the History Brush paints back">⟲ Set source</button>` + rangeOpt("ptOp", "Opacity", 1, 100, Math.round(S.opacity * 100)),
    (o) => { o.querySelector("#ptHistSet").onclick = () => { E.snapHistorySource(); say("history source = the layers as they are now"); }; bindRange(o, "ptOp", (v) => { S.opacity = v / 100; }); });

    /* spot healing: paint over it, it is filled from around it */
    let spot = null;
    T.spotheal = {
      id: "spotheal", name: "Spot Healing Brush", brush: true, cursor: "none",
      options: () => rangeOpt("ptSize", "Size", 1, 400, Math.round(S.size), "Brush size ([ and ])"),
      bindOptions: (o) => bindRange(o, "ptSize", (v) => E.setSize(v)),
      down(e, fx, fy) {
        const L = E.layer(); if (!E.canPaint(L) || E.onMask(L) || S.qm) { if (L && (E.onMask(L) || S.qm)) say("Spot Healing works on a layer's pixels"); return false; }
        spot = { c: newCanvas(S.w, S.h), last: [fx, fy] };
        const g = ctx(spot.c); g.strokeStyle = g.fillStyle = "#000"; g.lineCap = g.lineJoin = "round"; g.lineWidth = S.size;
        g.beginPath(); g.arc(fx, fy, S.size / 2, 0, Math.PI * 2); g.fill();
        E.drawOverlay();
      },
      move(e, fx, fy) { if (!spot) return; const g = ctx(spot.c); g.beginPath(); g.moveTo(spot.last[0], spot.last[1]); g.lineTo(fx, fy); g.stroke(); spot.last = [fx, fy]; E.drawOverlay(); },
      up() {
        if (!spot) return;
        const m0 = ctx(spot.c).getImageData(0, 0, S.w, S.h).data; let hole = new Uint8Array(S.w * S.h);
        for (let i = 0; i < hole.length; i++) hole[i] = m0[i * 4 + 3] > 20 ? 255 : 0;
        if (E.hasSel()) hole = P.combine(hole, S.sel, "intersect");
        spot = null;
        const bb = P.bbox(hole, S.w, S.h); if (!bb) { E.drawOverlay(); return; }
        const R = P.contextRect(bb, S.w, S.h, Math.max(16, Math.round(S.size * 1.5)), 1);
        E.pxOp("spot healing", (c, g) => {
          const id = g.getImageData(R.x, R.y, R.w, R.h), hm = P.cropMask(hole, S.w, R), orig = Uint8ClampedArray.from(id.data);
          P.fillHole(id.data, hm, R.w, R.h);
          const fm = P.feather(P.morph(hm, R.w, R.h, 2), R.w, R.h, 4);
          const rnd = B.rng(R.x * 31 + R.y);
          for (let i = 0; i < fm.length; i++) {
            const a = fm[i] / 255; if (!a) { for (let k = 0; k < 4; k++) id.data[i * 4 + k] = orig[i * 4 + k]; continue; }
            const n = (rnd() - 0.5) * 6 * a;                       // a little grain so it does not look painted
            for (let k = 0; k < 3; k++) id.data[i * 4 + k] = orig[i * 4 + k] * (1 - a) + (id.data[i * 4 + k] + n) * a;
            id.data[i * 4 + 3] = Math.max(orig[i * 4 + 3], id.data[i * 4 + 3] * a);
          }
          g.putImageData(id, R.x, R.y);
        });
      },
    };
    E.overlayHooks.push((g) => { if (spot) { g.globalAlpha = 0.45; const t = newCanvas(S.w, S.h), tg = ctx(t); tg.drawImage(spot.c, 0, 0); tg.globalCompositeOperation = "source-in"; tg.fillStyle = "#ff3b3b"; tg.fillRect(0, 0, S.w, S.h); g.drawImage(t, 0, 0); } });

    /* ---------------- gradient ---------------- */
    let grad = null;
    function drawGradient(g, x0, y0, x1, y1) {
      const W = S.w, H = S.h, stops = gradStops(S.gradKind, S.fg, S.bg, S.gradRev, S.gradCustom), len = Math.max(1, Math.hypot(x1 - x0, y1 - y0));
      const t = newCanvas(W, H), tg = ctx(t);
      if (S.gradType === "diamond") {
        const ux = (x1 - x0) / len, uy = (y1 - y0) / len, id = tg.createImageData(W, H);
        const lut = newCanvas(256, 1), lg = ctx(lut), lgr = lg.createLinearGradient(0, 0, 256, 0); stops.forEach(([s, c]) => lgr.addColorStop(s, c)); lg.fillStyle = lgr; lg.fillRect(0, 0, 256, 1);
        const L = lg.getImageData(0, 0, 256, 1).data;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const dx = x - x0, dy = y - y0, v = Math.min(1, (Math.abs(dx * ux + dy * uy) + Math.abs(-dx * uy + dy * ux)) / len), k = Math.min(255, Math.round(v * 255)) * 4, i = (y * W + x) * 4;
          id.data[i] = L[k]; id.data[i + 1] = L[k + 1]; id.data[i + 2] = L[k + 2]; id.data[i + 3] = L[k + 3];
        }
        tg.putImageData(id, 0, 0);
      } else {
        let gr;
        if (S.gradType === "radial") gr = tg.createRadialGradient(x0, y0, 0, x0, y0, len);
        else if (S.gradType === "angle" && tg.createConicGradient) gr = tg.createConicGradient(Math.atan2(y1 - y0, x1 - x0), x0, y0);
        else if (S.gradType === "reflected") gr = tg.createLinearGradient(x0 - (x1 - x0), y0 - (y1 - y0), x1, y1);
        else gr = tg.createLinearGradient(x0, y0, x1, y1);
        const st = S.gradType === "reflected" ? stops.map(([s, c]) => [0.5 - s / 2, c]).reverse().concat(stops.map(([s, c]) => [0.5 + s / 2, c])) : stops;
        st.forEach(([s, c]) => gr.addColorStop(Math.max(0, Math.min(1, s)), c));
        tg.fillStyle = gr; tg.fillRect(0, 0, W, H);
      }
      const sc = E.selCanvas(); if (sc && !S.qm) { tg.globalCompositeOperation = "destination-in"; tg.drawImage(sc, 0, 0); }
      g.save(); g.globalAlpha = S.gradOpacity / 100; g.globalCompositeOperation = B.compositeOf(S.gradBlend); g.drawImage(t, 0, 0); g.restore();
    }
    T.gradient = {
      id: "gradient", name: "Gradient", cursor: "crosshair",
      options: () => `<label>Colours <select id="ptGKind">${[["fgbg", "Foreground → Background"], ["fgtrans", "Foreground → Transparent"], ["bw", "Black → White"], ["spectrum", "Spectrum"], ["custom", "Custom (Gradient Editor)"]].map(([v, l]) => `<option value="${v}"${v === S.gradKind ? " selected" : ""}>${l}</option>`).join("")}</select></label>`
        + (root.PCGrad ? `<button type="button" class="ptgbtn" id="ptGEdit" title="The gradient - click: the Gradient Editor (many stops, each with its opacity)" style="background:${root.PCGrad.toCss({ stops: gradStops(S.gradKind, S.fg, S.bg, false, S.gradCustom).map(([t, c]) => { const m = /rgba\((\d+),(\d+),(\d+),([\d.]+)\)/.exec(c) || [0, 0, 0, 0, 1]; return { t, c: "#" + [m[1], m[2], m[3]].map((v) => (+v).toString(16).padStart(2, "0")).join(""), a: +m[4] }; }) })}"></button>` : "")
        + `<span class="sep"></span>` + GRAD_KINDS.map((k) => `<button class="ghost ptgt${k === S.gradType ? " on" : ""}" data-gt="${k}" title="${k[0].toUpperCase() + k.slice(1)} gradient">${{ linear: "▭", radial: "◎", angle: "◔", reflected: "◫", diamond: "◇" }[k]}</button>`).join("")
        + `<span class="sep"></span><label>Mode <select id="ptGBlend">${E.BLEND_NAMES.map((b) => `<option${b === S.gradBlend ? " selected" : ""}>${b}</option>`).join("")}</select></label>`
        + rangeOpt("ptGOp", "Opacity", 1, 100, S.gradOpacity) + `<label><input type="checkbox" id="ptGRev" ${S.gradRev ? "checked" : ""}> Reverse</label>`,
      bindOptions(o) {
        const k = o.querySelector("#ptGKind"); k.onchange = () => { S.gradKind = k.value; store.set("t.gkind", k.value); E.renderOptions(); };
        const ge = o.querySelector("#ptGEdit");
        if (ge) ge.onclick = () => {                       // 2.434.0: the editor starts from the colours chosen now
          const P = root.PCGrad; if (!P || !E.gradEdit) return;
          const seed = S.gradKind === "custom" ? S.gradCustom : P.PRESETS[{ fgbg: 0, fgtrans: 1, bw: 2, spectrum: 3 }[S.gradKind] || 0];
          E.gradEdit(seed, (g) => { S.gradCustom = g; store.set("grad.tool", g); S.gradKind = "custom"; store.set("t.gkind", "custom"); E.renderOptions(); }, { title: "Gradient Editor - the Gradient tool / Paint Bucket" });
        };
        o.querySelectorAll(".ptgt").forEach((b) => { b.onclick = () => { S.gradType = b.dataset.gt; store.set("t.gtype", S.gradType); E.renderOptions(); }; });
        const bl = o.querySelector("#ptGBlend"); bl.onchange = () => { S.gradBlend = bl.value; };
        bindRange(o, "ptGOp", (v) => { S.gradOpacity = v; store.set("t.gop", v); });
        const r = o.querySelector("#ptGRev"); r.onchange = () => { S.gradRev = r.checked; };
      },
      down(e, fx, fy) { if (!E.canPaint()) return false; grad = { x0: fx, y0: fy, x1: fx, y1: fy }; },
      move(e, fx, fy) {
        if (!grad) return;
        let x = fx, y = fy;
        if (e.shiftKey) { const a = Math.round(Math.atan2(fy - grad.y0, fx - grad.x0) / (Math.PI / 4)) * Math.PI / 4, r = Math.hypot(fx - grad.x0, fy - grad.y0); x = grad.x0 + Math.cos(a) * r; y = grad.y0 + Math.sin(a) * r; }
        grad.x1 = x; grad.y1 = y; E.drawOverlay();
      },
      up() {
        const gd = grad; grad = null; E.drawOverlay();
        if (!gd || Math.hypot(gd.x1 - gd.x0, gd.y1 - gd.y0) < 2) return;
        E.pxOp("gradient", (c, g) => drawGradient(g, gd.x0, gd.y0, gd.x1, gd.y1));
      },
    };
    E.overlayHooks.push((g, px) => {
      if (!grad) return;
      g.lineWidth = 1.5 * px; g.strokeStyle = "#fff"; g.setLineDash([]); g.beginPath(); g.moveTo(grad.x0, grad.y0); g.lineTo(grad.x1, grad.y1); g.stroke();
      g.strokeStyle = "#000"; g.setLineDash([4 * px, 4 * px]); g.stroke();
      for (const [x, y] of [[grad.x0, grad.y0], [grad.x1, grad.y1]]) { g.setLineDash([]); g.fillStyle = "#fff"; g.fillRect(x - 3 * px, y - 3 * px, 6 * px, 6 * px); }
    });

    /* ---------------- crop ---------------- */
    let crop = null;
    const ratioOf = () => { const r = RATIOS[S.cropRatio]; return r === -1 ? S.w / S.h : r || 0; };
    function cropCommit() {
      if (!crop) return;
      const r = crop.box; crop = null;
      cropTo(r);
    }
    function cropTo(r) {
      if (!r || r.w < 1 || r.h < 1) return;
      E.docOp("crop", () => { E.remapLayers(r.w, r.h, (src, g) => g.drawImage(src, -r.x, -r.y), (L) => { const p = L.text || L.shape; p.x -= r.x; p.y -= r.y; }); if (E.mapPaths) E.mapPaths([1, 0, 0, 1, -r.x, -r.y]); });
      say(`cropped to ${r.w}×${r.h}`);
    }
    T.crop = {
      id: "crop", name: "Crop", cursor: "crosshair",
      options: () => `<label>Ratio <select id="ptRatio">${Object.keys(RATIOS).map((k) => `<option value="${k}"${k === S.cropRatio ? " selected" : ""}>${k === "free" ? "Ratio (free)" : k === "original" ? "Original ratio" : k}</option>`).join("")}</select></label>`
        + `<span class="sep"></span><span style="color:var(--pc-dim)" id="ptCropSz">${crop ? crop.box.w + " × " + crop.box.h : "drag a box"}</span>`
        + `<button class="ghost" id="ptCropOk" title="Crop (Enter)">✔</button><button class="ghost" id="ptCropNo" title="Cancel (Esc)">✕</button>`,
      bindOptions(o) {
        const r = o.querySelector("#ptRatio"); r.onchange = () => { S.cropRatio = r.value; store.set("t.ratio", r.value); if (crop) { const b = crop.box; crop.box = cropBox(b.x, b.y, b.x + b.w, b.y + b.h, ratioOf(), S.w, S.h); E.drawOverlay(); } };
        o.querySelector("#ptCropOk").onclick = cropCommit;
        o.querySelector("#ptCropNo").onclick = () => { crop = null; E.drawOverlay(); E.renderOptions(); };
      },
      down(e, fx, fy) {
        const tol = 8 / S.zoom;
        if (crop) {
          const b = crop.box, onX = Math.abs(fx - b.x) < tol ? "l" : Math.abs(fx - (b.x + b.w)) < tol ? "r" : "", onY = Math.abs(fy - b.y) < tol ? "t" : Math.abs(fy - (b.y + b.h)) < tol ? "b" : "";
          if (onX || onY) { crop.drag = { edge: onX + onY, b0: Object.assign({}, b) }; return; }
          if (fx > b.x && fx < b.x + b.w && fy > b.y && fy < b.y + b.h) { crop.drag = { move: [fx, fy], b0: Object.assign({}, b) }; return; }
        }
        crop = { box: { x: Math.round(fx), y: Math.round(fy), w: 1, h: 1 }, drag: { from: [fx, fy] } };
      },
      move(e, fx, fy) {
        if (!crop || !crop.drag) return;
        const d = crop.drag, b0 = d.b0;
        if (d.from) crop.box = cropBox(d.from[0], d.from[1], fx, fy, ratioOf(), S.w, S.h);
        else if (d.move) { crop.box = Object.assign({}, b0, { x: Math.max(0, Math.min(S.w - b0.w, Math.round(b0.x + fx - d.move[0]))), y: Math.max(0, Math.min(S.h - b0.h, Math.round(b0.y + fy - d.move[1]))) }); }
        else {
          let x0 = b0.x, y0 = b0.y, x1 = b0.x + b0.w, y1 = b0.y + b0.h;
          if (d.edge.includes("l")) x0 = fx; if (d.edge.includes("r")) x1 = fx; if (d.edge.includes("t")) y0 = fy; if (d.edge.includes("b")) y1 = fy;
          const ax = d.edge.includes("l") ? x1 : x0, ay = d.edge.includes("t") ? y1 : y0;
          crop.box = cropBox(ax, ay, d.edge.includes("l") ? x0 : x1, d.edge.includes("t") ? y0 : y1, ratioOf(), S.w, S.h);
        }
        E.drawOverlay(); const sz = E.$("ptCropSz"); if (sz) sz.textContent = crop.box.w + " × " + crop.box.h;
      },
      up() { if (crop) { crop.drag = null; if (crop.box.w < 3 || crop.box.h < 3) crop = null; } E.drawOverlay(); },
      dblclick() { cropCommit(); },
      key(e) {
        if (!crop) return false;
        if (e.key === "Enter") { cropCommit(); return true; }
        if (e.key === "Escape") { crop = null; E.drawOverlay(); E.renderOptions(); return true; }
        return false;
      },
      leave() { crop = null; },
    };
    E.overlayHooks.push((g, px) => {
      if (S.tool !== "crop" || !crop) return;
      const b = crop.box;
      g.fillStyle = "rgba(0,0,0,0.55)";
      g.fillRect(0, 0, S.w, b.y); g.fillRect(0, b.y + b.h, S.w, S.h - b.y - b.h); g.fillRect(0, b.y, b.x, b.h); g.fillRect(b.x + b.w, b.y, S.w - b.x - b.w, b.h);
      g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = px;
      for (let k = 1; k < 3; k++) { g.beginPath(); g.moveTo(b.x + b.w * k / 3, b.y); g.lineTo(b.x + b.w * k / 3, b.y + b.h); g.moveTo(b.x, b.y + b.h * k / 3); g.lineTo(b.x + b.w, b.y + b.h * k / 3); g.stroke(); }
      g.strokeStyle = "#fff"; g.lineWidth = 1.5 * px; g.strokeRect(b.x, b.y, b.w, b.h);
      g.fillStyle = "#fff";
      for (const x of [b.x, b.x + b.w / 2, b.x + b.w]) for (const y of [b.y, b.y + b.h / 2, b.y + b.h]) if (!(x === b.x + b.w / 2 && y === b.y + b.h / 2)) g.fillRect(x - 3 * px, y - 3 * px, 6 * px, 6 * px);
    });

    /* ---------------- zoom ---------------- */
    T.zoom = {
      id: "zoom", name: "Zoom", cursor: "zoom-in",
      options: () => `<button class="ghost" id="ptZ100" title="100 % (Ctrl+1)">100%</button><button class="ghost" id="ptZFit" title="Fit on screen (Ctrl+0)">Fit Screen</button><span style="color:var(--pc-dim)">click zooms in, Alt-click out</span>`,
      bindOptions(o) { o.querySelector("#ptZ100").onclick = () => E.zoomAt(1 / S.zoom); o.querySelector("#ptZFit").onclick = () => { S.userView = false; E.fitView(); }; },
      down(e) { const r = E.stage.getBoundingClientRect(); E.zoomAt(e.altKey ? 1 / 1.5 : 1.5, e.clientX - r.left, e.clientY - r.top); return false; },
    };

    /* ---------------- type ---------------- */
    const FONTS = Object.keys(D.FONT_STACK).filter((f) => !/^(serif|sans-serif|monospace)$/.test(f));
    let ta = null, taLayer = null;
    function typeSettings() { return Object.assign({ font: S.typeFont, size: S.typeSize, weight: S.typeBold ? 700 : 400, italic: S.typeItalic, color: S.fg, align: S.typeAlign, leading: S.typeLeading, tracking: S.typeTracking },
      S.typeFx ? { fx: S.typeFx } : {}); }
    function placeTa() {
      if (!ta || !taLayer) return;
      const t = taLayer.text, b = D.textBox(t, ctx(taLayer.canvas));
      // 2.397.0: path / warped / vertical / 3D text is drawn by pctext.js - the box to type in floats above it, plain
      // 2.449.0: so is a text with per-letter sizes / fonts (pcruns.js) - colours / lines only keep the box over the letters
      const runsOwn = root.PCRuns && root.PCRuns.owns(t);
      if ((runsOwn && !root.PCRuns.sameMetrics(t)) || (!runsOwn && root.PCText && root.PCText.wants(t))) {
        ta.classList.add("pcshaped");
        ta.style.left = (S.panX + b.x * S.zoom) + "px"; ta.style.top = Math.max(0, S.panY + b.y * S.zoom - 34) + "px";
        ta.style.width = Math.max(160, Math.min(520, b.w * S.zoom)) + "px"; ta.style.height = "30px";
        ta.style.font = D.fontCss(Object.assign({}, t, { size: 15, weight: 400, italic: false })); ta.style.lineHeight = "1.2"; ta.style.textAlign = "left";
        return;
      }
      ta.classList.remove("pcshaped");
      if (t.box) {                                                             // 2.426.0: paragraph text - the textarea IS the box
        ta.style.left = (S.panX + t.x * S.zoom) + "px"; ta.style.top = (S.panY + t.y * S.zoom) + "px";
        ta.style.width = Math.max(20, t.box.w * S.zoom) + "px"; ta.style.height = Math.max(20, t.box.h * S.zoom) + "px";
        ta.style.font = D.fontCss(Object.assign({}, t, { size: t.size * S.zoom })); ta.style.lineHeight = (t.leading || 1.2); ta.style.textAlign = t.justify ? "justify" : t.align;
        ta.style.whiteSpace = "pre-wrap"; ta.style.paddingLeft = ((t.indL || 0) * S.zoom) + "px"; ta.style.paddingRight = ((t.indR || 0) * S.zoom) + "px"; ta.style.textIndent = ((t.indF || 0) * S.zoom) + "px";
        return;
      }
      ta.style.whiteSpace = ""; ta.style.paddingLeft = ""; ta.style.paddingRight = ""; ta.style.textIndent = "";
      ta.style.left = (S.panX + b.x * S.zoom) + "px"; ta.style.top = (S.panY + t.y * S.zoom) + "px";
      ta.style.width = Math.max(40, (b.w + t.size) * S.zoom) + "px"; ta.style.height = Math.max(t.size * S.zoom, b.h * S.zoom + 4) + "px";
      ta.style.font = D.fontCss(Object.assign({}, t, { size: t.size * S.zoom })); ta.style.lineHeight = (t.leading || 1.2);
      ta.style.textAlign = t.align;
    }
    function editText(L) {
      endText();
      taLayer = L;
      ta = doc.createElement("textarea"); ta.className = "pctext"; ta.spellcheck = false; ta.value = L.text.str;
      E.stage.appendChild(ta); placeTa();
      ta.oninput = () => { E.liveSet(L, (x) => { if (x.text.runs && root.PCRuns) x.text.runs = root.PCRuns.shiftRuns(x.text.runs, String(x.text.str || ""), ta.value); x.text.str = ta.value; }); placeTa(); };   // 2.449.0: the per-letter ranges follow the typing
      ta.onkeydown = (ev) => {
        ev.stopPropagation();
        if (ev.key === "Escape" || (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey))) { ev.preventDefault(); endText(); }
      };
      ta.onblur = () => setTimeout(() => { if (ta && doc.activeElement !== ta && !(E.keepTyping && E.keepTyping(doc.activeElement))) endText(); }, 120);   // 2.449.0: the options bar / Character panel keep it open
      setTimeout(() => { ta.focus(); ta.select(); }, 0);
      say("typing - Ctrl+Enter or Esc commits; the options bar changes font, size, colour");
    }
    function endText() {
      if (!ta) return;
      const L = taLayer, el = ta; ta = null; taLayer = null; el.remove();
      if (L && !String(L.text.str || "").trim()) { E.commitLive("edit text"); const i = S.layers.indexOf(L); if (i >= 0) { E.setActive(i); E.deleteLayer(); } return; }
      E.commitLive("edit text");
    }
    E.endText = endText;
    E.textEditing = () => (ta && taLayer ? { L: taLayer, ta } : null);      // 2.449.0: pcruns.js - the letters picked while typing
    E.placeText = () => placeTa();
    E.editText = (L) => editText(L);                                         // 2.397.0: pctext.js (Type on a Path, the Shape dialog)
    E.typeSettings = () => typeSettings();
    function textAt(x, y) {
      for (let i = S.layers.length - 1; i >= 0; i--) {
        const L = S.layers[i]; if (L.type !== "text" || !D.shown(S.layers, L)) continue;
        if (root.PCText && root.PCText.wants(L.text)) { if (root.PCText.hit(L.text, x, y, ctx(L.canvas))) return i; continue; }   // 2.397.0: a path text is hit on its letters
        const b = D.textBox(L.text, ctx(L.canvas)); if (x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4) return i;
      }
      return -1;
    }
    T.type = {
      id: "type", name: "Horizontal Type", cursor: "text",
      options() {
        const t = E.layer() && E.layer().type === "text" ? E.layer().text : null, v = t || typeSettings();
        return `<label><select id="ptFont">${FONTS.map((f) => `<option${f === v.font ? " selected" : ""}>${f}</option>`).join("")}</select></label>`
          + `<button class="ghost${(v.weight || 400) >= 600 ? " on" : ""}" id="ptBold" title="Bold"><b>B</b></button><button class="ghost${v.italic ? " on" : ""}" id="ptItal" title="Italic"><i>I</i></button>`
          + `<label title="Size (px)">tT <input type="number" id="ptTSize" min="4" max="1000" value="${Math.round(v.size)}"></label>`
          + ["left", "center", "right"].map((a) => `<button class="ghost ptal${v.align === a ? " on" : ""}" data-al="${a}" title="Align ${a}">${{ left: "⯇≡", center: "≡", right: "≡⯈" }[a]}</button>`).join("")
          + `<label title="Leading (line height)">↕ <input type="number" id="ptLead" min="0.5" max="4" step="0.05" value="${v.leading || 1.2}"></label>`
          + `<label title="Tracking (1/1000 em)">VA <input type="number" id="ptTrack" min="-200" max="1000" step="10" value="${v.tracking || 0}"></label>`
          + `<label title="Colour (the foreground colour for new text)"><input type="color" id="ptTCol" value="${v.color || S.fg}"></label>`
          + (t ? `<button class="ghost" id="ptTEdit" title="Edit the text (or click it with the Type tool)">✎ Edit</button>` : "")
          + (root.H3TextFx ? `<span id="ptFxBox" title="Text effect presets (from PSD text effects) - live as you type"></span>` : "");     // 2.411.0
      },
      bindOptions(o) {
        const L = E.layer(), isT = L && L.type === "text";
        const set = (label, f) => { if (isT) E.setLayer(L, label, (x) => f(x.text)); else { f(null); } if (ta) placeTa(); };
        o.querySelector("#ptFont").onchange = (ev) => { S.typeFont = ev.target.value; store.set("t.font", S.typeFont); set("font", (t) => { if (t) t.font = S.typeFont; }); };
        o.querySelector("#ptBold").onclick = () => { S.typeBold = !(isT ? L.text.weight >= 600 : S.typeBold); set("bold", (t) => { if (t) t.weight = S.typeBold ? 700 : 400; }); E.renderOptions(); };
        o.querySelector("#ptItal").onclick = () => { S.typeItalic = !(isT ? L.text.italic : S.typeItalic); set("italic", (t) => { if (t) t.italic = S.typeItalic; }); E.renderOptions(); };
        o.querySelector("#ptTSize").onchange = (ev) => { S.typeSize = Math.max(4, +ev.target.value || 48); store.set("t.tsize", S.typeSize); set("text size", (t) => { if (t) t.size = S.typeSize; }); };
        o.querySelectorAll(".ptal").forEach((b) => { b.onclick = () => { S.typeAlign = b.dataset.al; set("align", (t) => { if (t) { const bx = D.textBox(t, ctx(L.canvas)); t.x = S.typeAlign === "center" ? bx.x + bx.w / 2 : S.typeAlign === "right" ? bx.x + bx.w : bx.x; t.align = S.typeAlign; } }); E.renderOptions(); }; });
        o.querySelector("#ptLead").onchange = (ev) => { S.typeLeading = +ev.target.value || 1.2; set("leading", (t) => { if (t) t.leading = S.typeLeading; }); };
        o.querySelector("#ptTrack").onchange = (ev) => { S.typeTracking = +ev.target.value || 0; set("tracking", (t) => { if (t) t.tracking = S.typeTracking; }); };
        o.querySelector("#ptTCol").oninput = (ev) => { if (!isT) E.setFg(ev.target.value); };
        o.querySelector("#ptTCol").onchange = (ev) => { if (isT) set("text colour", (t) => { t.color = ev.target.value; }); };
        const ed = o.querySelector("#ptTEdit"); if (ed) ed.onclick = () => editText(L);
        // 2.411.0: Presets ▾ - the selected text layer's look (or the next new text's)
        const fb = o.querySelector("#ptFxBox");
        if (fb && root.H3TextFx) fb.appendChild(root.H3TextFx.picker({ current: isT ? L.text.fx || "" : S.typeFx, say: (m) => say(m),
          onPick: (id) => { S.typeFx = id || ""; if (store.set) store.set("t.fx", S.typeFx); if (isT) E.setLayer(L, "text effect preset", (x) => { if (id) x.text.fx = id; else delete x.text.fx; }); } }));
      },
      down(e, fx, fy) {
        if (ta) { endText(); return false; }
        const i = textAt(fx, fy);
        if (i >= 0) { E.setActive(i); E.renderOptions(); editText(S.layers[i]); return false; }
        const L = E.makeLayer("Text", S.w, S.h, "text");
        L.text = Object.assign({}, D.TEXT_DEFAULT, typeSettings(), { str: "", x: Math.round(fx), y: Math.round(fy - S.typeSize * 0.15) });
        D.rasterize(L);
        E.addLayer(L, "new text layer", false);
        E.renderOptions(); editText(L);
        return false;
      },
      leave() { endText(); },
    };
    // the textarea follows zoom / pan
    const prevApply = E.ui.rulers;
    E.overlayHooks.push(() => { if (ta) placeTa(); });
    void prevApply;

    /* ---------------- shapes ---------------- */
    let shp = null;
    const SHAPES = [["rect", "Rectangle", "▭"], ["rounded", "Rounded Rectangle", "▢"], ["ellipse", "Ellipse", "◯"], ["triangle", "Triangle", "△"], ["polygon", "Polygon", "⬠"], ["line", "Line", "╱"]];
    function shapeSettings() {
      const k = S.shapeKind === "rounded" ? "rect" : S.shapeKind;
      const af = E.autoFill ? E.autoFill(true) : { fill: S.fg, fillOn: true };          // 2.430.0: the colour picked last (⊠ = not filled)
      return { kind: k, radius: S.shapeKind === "rounded" ? Math.max(4, S.shapeRadius || 16) : 0, sides: S.shapeSides, fill: af.fill, fillOn: af.fillOn,
               stroke: S.bg, strokeW: S.shapeKind === "line" ? Math.max(1, S.shapeStrokeW || 4) : S.shapeStrokeW, strokeOn: S.shapeKind !== "line" && S.shapeStrokeW > 0, dash: !!S.shapeDash };
    }
    T.shape = {
      id: "shape", name: "Shape", cursor: "crosshair",
      options() {
        const L = E.layer(), s = L && L.type === "shape" ? L.shape : null;
        return SHAPES.map(([k, n, ic]) => `<button class="ghost ptsk${(s ? (s.kind === "rect" && s.radius > 0 ? "rounded" : s.kind) : S.shapeKind) === k ? " on" : ""}" data-sk="${k}" title="${n} (U)">${ic}</button>`).join("")
          + `<span class="sep"></span><label title="Fill">Fill <input type="color" id="ptSFill" value="${s ? s.fill : S.fg}"></label>`
          + `<label title="Stroke colour">Stroke <input type="color" id="ptSStroke" value="${s ? s.stroke : S.bg}"></label>`
          + `<label title="Stroke width (px; 0 = none)">W <input type="number" id="ptSW" min="0" max="200" value="${s ? (s.strokeOn || s.kind === "line" ? s.strokeW : 0) : S.shapeStrokeW}"></label>`
          + `<label title="Dashed stroke"><input type="checkbox" id="ptSDash" ${(s ? s.dash : S.shapeDash) ? "checked" : ""}> Dashed</label>`
          + `<label title="Corner radius">R <input type="number" id="ptSR" min="0" max="2000" value="${s ? s.radius : S.shapeRadius}"></label>`
          + `<label title="Polygon sides">Sides <input type="number" id="ptSSides" min="3" max="64" value="${s ? s.sides : S.shapeSides}"></label>`;
      },
      bindOptions(o) {
        const L = E.layer(), isS = L && L.type === "shape";
        const set = (label, f) => { if (isS) E.setLayer(L, label, (x) => f(x.shape)); };
        o.querySelectorAll(".ptsk").forEach((b) => { b.onclick = () => { S.shapeKind = b.dataset.sk; store.set("t.shape", S.shapeKind); set("shape kind", (s) => { s.kind = S.shapeKind === "rounded" ? "rect" : S.shapeKind; if (S.shapeKind === "rounded" && !s.radius) s.radius = 16; }); E.renderOptions(); }; });
        o.querySelector("#ptSFill").onchange = (ev) => { if (isS) set("shape fill", (s) => { s.fill = ev.target.value; s.fillOn = true; }); else E.setFg(ev.target.value); };
        o.querySelector("#ptSStroke").onchange = (ev) => { if (isS) set("shape stroke", (s) => { s.stroke = ev.target.value; }); else E.setBg(ev.target.value); };
        o.querySelector("#ptSW").onchange = (ev) => { const v = Math.max(0, +ev.target.value || 0); S.shapeStrokeW = v; store.set("t.sw", v); set("stroke width", (s) => { s.strokeW = v; s.strokeOn = v > 0; }); };
        o.querySelector("#ptSDash").onchange = (ev) => { S.shapeDash = ev.target.checked; set("dashes", (s) => { s.dash = S.shapeDash; }); };
        o.querySelector("#ptSR").onchange = (ev) => { S.shapeRadius = Math.max(0, +ev.target.value || 0); store.set("t.rad", S.shapeRadius); set("corner radius", (s) => { s.radius = S.shapeRadius; }); };
        o.querySelector("#ptSSides").onchange = (ev) => { S.shapeSides = Math.max(3, Math.min(64, +ev.target.value || 5)); store.set("t.sides", S.shapeSides); set("sides", (s) => { s.sides = S.shapeSides; }); };
      },
      down(e, fx, fy) { shp = { x0: fx, y0: fy, x1: fx, y1: fy }; },
      move(e, fx, fy) {
        if (!shp) return;
        let w = fx - shp.x0, h = fy - shp.y0;
        if (e.shiftKey) { if (S.shapeKind === "line") { const a = Math.round(Math.atan2(h, w) / (Math.PI / 4)) * Math.PI / 4, r = Math.hypot(w, h); w = Math.cos(a) * r; h = Math.sin(a) * r; } else { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; } }
        shp.x1 = shp.x0 + w; shp.y1 = shp.y0 + h; E.drawOverlay();
      },
      up() {
        const s0 = shp; shp = null; E.drawOverlay();
        if (!s0 || Math.hypot(s0.x1 - s0.x0, s0.y1 - s0.y0) < 3) return;
        const L = E.makeLayer(SHAPES.find((x) => x[0] === S.shapeKind)[1] + " " + (S.layers.filter((x) => x.type === "shape").length + 1), S.w, S.h, "shape");
        L.shape = Object.assign({}, D.SHAPE_DEFAULT, shapeSettings(), S.shapeKind === "line"
          ? { x: Math.round(s0.x0), y: Math.round(s0.y0), w: Math.round(s0.x1 - s0.x0), h: Math.round(s0.y1 - s0.y0) }
          : { x: Math.round(Math.min(s0.x0, s0.x1)), y: Math.round(Math.min(s0.y0, s0.y1)), w: Math.round(Math.abs(s0.x1 - s0.x0)), h: Math.round(Math.abs(s0.y1 - s0.y0)) });
        D.rasterize(L);
        E.addLayer(L, "new shape layer", false);
        E.renderOptions();
      },
    };
    E.overlayHooks.push((g, px) => {
      if (!shp) return;
      const s = Object.assign({}, D.SHAPE_DEFAULT, shapeSettings(), S.shapeKind === "line" ? { x: shp.x0, y: shp.y0, w: shp.x1 - shp.x0, h: shp.y1 - shp.y0 } : { x: Math.min(shp.x0, shp.x1), y: Math.min(shp.y0, shp.y1), w: Math.abs(shp.x1 - shp.x0), h: Math.abs(shp.y1 - shp.y0) });
      g.globalAlpha = 0.7; D.drawShape(g, s); g.globalAlpha = 1;
      g.strokeStyle = "#2680eb"; g.lineWidth = px; D.shapePath(g, s); g.stroke();
    });
    // the bounding box of a text / shape layer while the move tool is on it
    E.overlayHooks.push((g, px) => {
      const L = E.layer(); if (!L || S.tool !== "move" || !(L.type === "text" || L.type === "shape")) return;
      const b = L.type === "text" ? D.textBox(L.text, ctx(L.canvas)) : { x: Math.min(L.shape.x, L.shape.x + L.shape.w), y: Math.min(L.shape.y, L.shape.y + L.shape.h), w: Math.abs(L.shape.w), h: Math.abs(L.shape.h) };
      g.strokeStyle = "#2680eb"; g.lineWidth = px; g.setLineDash([4 * px, 3 * px]); g.strokeRect(b.x, b.y, b.w, b.h);
    });

    /* ---------------- free transform (Ctrl+T) ---------------- */
    let X = null;
    // 2.551.0: Photoshop-like cursors - a slanted double arrow on a middle handle (skew), a curved arrow outside (rotate)
    const svgCur = (svg, x, y, fb) => `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${x} ${y}, ${fb}`;
    const SKEW_H = svgCur('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M3 15 L21 9" stroke="#fff" stroke-width="4"/><path d="M3 15 L21 9" stroke="#000" stroke-width="1.6"/><path d="M5 11 L3 15 L7 16 M17 8 L21 9 L19 13" stroke="#fff" stroke-width="4"/><path d="M5 11 L3 15 L7 16 M17 8 L21 9 L19 13" stroke="#000" stroke-width="1.6"/></g></svg>', 12, 12, "ew-resize");
    const SKEW_V = svgCur('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3 L15 21" stroke="#fff" stroke-width="4"/><path d="M9 3 L15 21" stroke="#000" stroke-width="1.6"/><path d="M13 5 L9 3 L8 7 M16 17 L15 21 L11 19" stroke="#fff" stroke-width="4"/><path d="M13 5 L9 3 L8 7 M16 17 L15 21 L11 19" stroke="#000" stroke-width="1.6"/></g></svg>', 12, 12, "ns-resize");
    const ROT_CURSOR = svgCur('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M5 14 A8 8 0 0 1 17 6" stroke="#fff" stroke-width="4"/><path d="M5 14 A8 8 0 0 1 17 6" stroke="#000" stroke-width="1.6"/><path d="M13 4 L17 6 L15 10" stroke="#fff" stroke-width="4"/><path d="M13 4 L17 6 L15 10" stroke="#000" stroke-width="1.6"/></g></svg>', 12, 12, "alias");
    function startTransform() {
      const L = E.layer();
      if (!L) return say("open a picture first");
      if (L.type !== "pixel") return say(L.type === "text" || L.type === "shape" ? "change a text / shape layer in the options bar (or Layer ▸ Rasterize first)" : `a ${L.type} layer has nothing to transform`);
      if (L.locks && (L.locks.pos || L.locks.all)) return say("the layer's position is locked");
      const copy = E.beginPx(L), c = newCanvas(S.w, S.h), g = ctx(c);
      let sc = E.selCanvas();
      g.drawImage(L.canvas, 0, 0);
      if (sc) { g.globalCompositeOperation = "destination-in"; g.drawImage(sc, 0, 0); g.globalCompositeOperation = "source-over"; }
      // 2.550.0: a selection with none of the layer's pixels in it = the whole layer is transformed
      if (sc && !E.alphaBox(c)) { g.clearRect(0, 0, S.w, S.h); g.drawImage(L.canvas, 0, 0); sc = null; }
      const box = E.alphaBox(c); if (!box) return say("nothing to transform - the layer (or the selection on it) is empty");
      if (sc) { const lg = ctx(L.canvas); lg.save(); lg.globalCompositeOperation = "destination-out"; lg.drawImage(sc, 0, 0); lg.restore(); } else ctx(L.canvas).clearRect(0, 0, S.w, S.h);
      X = { L, copy, c, box, tx: 0, ty: 0, sx: 1, sy: 1, rot: 0, kx: 0, ky: 0, prev: S.tool, hadSel: !!sc, selBefore: S.sel ? Uint8Array.from(S.sel) : null };
      say("Free Transform: drag inside = move, a corner = scale (Shift frees the proportions), a middle handle = skew (Shift / Alt + a middle handle = stretch that side), outside = rotate - Enter keeps, Esc cancels");
      S.float = { c, m: xform(X) };
      E.setTool("transform");
      E.renderSoon();
    }
    function finishTransform(ok) {
      if (!X) return;
      const t = X; X = null;
      const L = t.L, g = ctx(L.canvas);
      if (ok) { const m = xform(t); g.save(); g.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); g.imageSmoothingQuality = "high"; g.drawImage(t.c, 0, 0); g.restore(); }
      else { g.clearRect(0, 0, S.w, S.h); g.drawImage(t.copy, 0, 0); }
      S.float = null;
      if (ok) {
        const list = [E.endPx(L, t.copy, null, "free transform")];
        if (t.hadSel) {                                // the selection follows the pixels
          const sc = newCanvas(S.w, S.h), sg = ctx(sc), m = xform(t), id0 = sg.createImageData(S.w, S.h);
          for (let i = 0; i < t.selBefore.length; i++) id0.data[i * 4 + 3] = t.selBefore[i];
          const s0 = newCanvas(S.w, S.h); ctx(s0).putImageData(id0, 0, 0);
          sg.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); sg.drawImage(s0, 0, 0); sg.setTransform(1, 0, 0, 1, 0, 0);
          const d = sg.getImageData(0, 0, S.w, S.h).data, nm = new Uint8Array(S.w * S.h); for (let i = 0; i < nm.length; i++) nm[i] = d[i * 4 + 3];
          list.push({ t: "sel", before: t.selBefore, after: Uint8Array.from(nm) }); E.setSel(nm, true);
        }
        E.push({ t: "multi", list: list.filter(Boolean), label: "free transform" });
      }
      E.setTool(t.prev === "transform" ? "move" : t.prev);
      E.refresh(); E.renderLayersPanel();
      say(ok ? "transformed" : "transform cancelled");
    }
    E.startTransform = startTransform; E.finishTransform = finishTransform;
    T.transform = {
      id: "transform", name: "Free Transform", cursor: "move",
      options() {
        if (!X) return "";
        const cx = Math.round(X.box.x + X.box.w / 2 + X.tx), cy = Math.round(X.box.y + X.box.h / 2 + X.ty);
        return `<label>X <input type="number" id="ptXx" value="${cx}"></label><label>Y <input type="number" id="ptXy" value="${cy}"></label>`
          + `<label>W <input type="number" id="ptXw" value="${Math.round(X.sx * 1000) / 10}" step="1">%</label><label>H <input type="number" id="ptXh" value="${Math.round(X.sy * 1000) / 10}" step="1">%</label>`
          + `<label>∠ <input type="number" id="ptXr" value="${Math.round(X.rot * 1800 / Math.PI) / 10}" step="1">°</label>`
          + `<label title="Horizontal skew (Ctrl + drag the top / bottom edge)">⇋ <input type="number" id="ptXkx" value="${Math.round(Math.atan(X.kx || 0) * 1800 / Math.PI) / 10}" step="1">°</label>`
          + `<label title="Vertical skew (Ctrl + drag the left / right edge)">⇵ <input type="number" id="ptXky" value="${Math.round(Math.atan(X.ky || 0) * 1800 / Math.PI) / 10}" step="1">°</label>`
          + `<button class="ghost" id="ptXok" title="Commit (Enter)">✔</button><button class="ghost" id="ptXno" title="Cancel (Esc)">✕</button>`;
      },
      bindOptions(o) {
        if (!X) return;
        const upd = () => { S.float.m = xform(X); E.renderSoon(); };
        o.querySelector("#ptXx").onchange = (e) => { X.tx = +e.target.value - (X.box.x + X.box.w / 2); upd(); };
        o.querySelector("#ptXy").onchange = (e) => { X.ty = +e.target.value - (X.box.y + X.box.h / 2); upd(); };
        o.querySelector("#ptXw").onchange = (e) => { X.sx = (+e.target.value || 100) / 100; upd(); };
        o.querySelector("#ptXh").onchange = (e) => { X.sy = (+e.target.value || 100) / 100; upd(); };
        o.querySelector("#ptXr").onchange = (e) => { X.rot = (+e.target.value || 0) * Math.PI / 180; upd(); };
        o.querySelector("#ptXkx").onchange = (e) => { X.kx = Math.tan(Math.max(-80, Math.min(80, +e.target.value || 0)) * Math.PI / 180); upd(); };   // 2.550.0
        o.querySelector("#ptXky").onchange = (e) => { X.ky = Math.tan(Math.max(-80, Math.min(80, +e.target.value || 0)) * Math.PI / 180); upd(); };
        o.querySelector("#ptXok").onclick = () => finishTransform(true);
        o.querySelector("#ptXno").onclick = () => finishTransform(false);
      },
      down(e, fx, fy) {
        if (!X) return false;
        const h = hitTransform(X, fx, fy, 7 / S.zoom);
        // 2.551.0 (Tim: "when user hovers over middle handle ... change transform icon to skew then skew like photoshop
        // instead of rotate"): a MIDDLE (edge) handle skews; Shift or Alt + a middle handle stretches that side
        X.drag = { h, x0: fx, y0: fy, skew: h.kind === "edge" && !e.shiftKey && !e.altKey, t0: { tx: X.tx, ty: X.ty, sx: X.sx, sy: X.sy, rot: X.rot, kx: X.kx || 0, ky: X.ky || 0 } };
      },
      hover(e, fx, fy) { if (!X) return; const h = hitTransform(X, fx, fy, 7 / S.zoom); E.stage.style.cursor = h.kind === "move" ? "move" : h.kind === "rotate" ? ROT_CURSOR : h.kind === "corner" ? "nwse-resize" : (e.shiftKey || e.altKey) ? (h.i === 1 ? "ns-resize" : "ew-resize") : (h.i === 1 ? SKEW_H : SKEW_V); },   // 2.551.0: the skew cursor on a middle handle
      move(e, fx, fy) {
        if (!X || !X.drag) return;
        const d = X.drag, t0 = d.t0, cx = X.box.x + X.box.w / 2 + t0.tx, cy = X.box.y + X.box.h / 2 + t0.ty;
        if (d.h.kind === "move") { X.tx = t0.tx + fx - d.x0; X.ty = t0.ty + fy - d.y0; }
        else if (d.skew) {                                 // 2.550.0: Ctrl + an edge = skew along that edge
          const k = skewFor(d.h, fx - d.x0, fy - d.y0, t0, X.box);
          X.kx = k.kx; X.ky = k.ky;
        }
        else if (d.h.kind === "rotate") {
          let a = t0.rot + Math.atan2(fy - cy, fx - cx) - Math.atan2(d.y0 - cy, d.x0 - cx);
          if (e.shiftKey) a = Math.round(a / (Math.PI / 12)) * (Math.PI / 12);
          X.rot = a;
        } else {
          const c = Math.cos(-t0.rot), s = Math.sin(-t0.rot);
          const lx = (fx - cx) * c - (fy - cy) * s, ly = (fx - cx) * s + (fy - cy) * c;
          const l0x = (d.x0 - cx) * c - (d.y0 - cy) * s, l0y = (d.x0 - cx) * s + (d.y0 - cy) * c;
          let kx = d.h.i === 1 ? 1 : lx / (l0x || 1e-6), ky = d.h.j === 1 ? 1 : ly / (l0y || 1e-6);
          if (d.h.kind === "corner" && !e.shiftKey) { const k = Math.abs(kx) > Math.abs(ky) ? kx : ky; kx = ky = k; }
          X.sx = t0.sx * kx; X.sy = t0.sy * ky;
        }
        S.float.m = xform(X); E.renderSoon();
      },
      up() { if (X) { X.drag = null; E.renderOptions(); } },
      dblclick() { finishTransform(true); },
      key(e) {
        if (!X) return false;
        if (e.key === "Enter") { finishTransform(true); return true; }
        if (e.key === "Escape") { finishTransform(false); return true; }
        return false;
      },
      leave() { if (X) finishTransform(true); },
    };
    E.overlayHooks.push((g, px) => {
      if (!X) return;
      const m = xform(X), b = X.box, P4 = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(([x, y]) => apply(m, x, y));
      g.strokeStyle = "#2680eb"; g.lineWidth = 1.2 * px; g.beginPath(); P4.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke();
      g.fillStyle = "#fff"; g.strokeStyle = "#2680eb";
      for (const [x, y] of [[b.x, b.y], [b.x + b.w / 2, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h / 2], [b.x + b.w, b.y + b.h], [b.x + b.w / 2, b.y + b.h], [b.x, b.y + b.h], [b.x, b.y + b.h / 2]].map(([x, y]) => apply(m, x, y))) {
        g.fillRect(x - 4 * px, y - 4 * px, 8 * px, 8 * px); g.strokeRect(x - 4 * px, y - 4 * px, 8 * px, 8 * px);
      }
    });

    /* ---------------- the Image menu ---------------- */
    // 2.421.0: a PATH shape stays a shape (its path turns with the canvas - E.mapPaths)
    function textShapeToPixels() { for (const L of S.layers) if (L.type === "text" || (L.type === "shape" && !(L.shape && L.shape.kind === "path"))) { L.type = "pixel"; delete L.text; delete L.shape; } }
    /** 2.447.0: the artboards (pcartboards.js) follow Canvas Size (moved) / Image Size (scaled) - in the same undo step */
    function shiftBoards(ox, oy, kx, ky) {
      for (const L of S.layers) if (L.artboard) { const a = L.artboard; L.artboard = Object.assign({}, a, { x: Math.round(a.x * kx + ox), y: Math.round(a.y * ky + oy), w: Math.round(a.w * kx), h: Math.round(a.h * ky) }); }
    }
    const img = {
      /** resample everything to W x H */
      size(W, H) {
        W = Math.max(1, Math.min(16384, Math.round(W))); H = Math.max(1, Math.min(16384, Math.round(H)));
        const kx = W / S.w, ky = H / S.h;
        return E.docOp("image size", () => E.remapLayers(W, H, (src, g) => { g.imageSmoothingQuality = "high"; g.drawImage(src, 0, 0, W, H); }, (L) => {
          if (L.text) { L.text.x *= kx; L.text.y *= ky; L.text.size *= ky; if (L.text.path && root.PCText) root.PCText.scalePath(L.text, kx, ky); if (root.PCType) root.PCType.scale(L.text, kx, ky); if (root.PCRuns) root.PCRuns.scale(L.text, ky); }
          if (L.shape) { L.shape.x *= kx; L.shape.y *= ky; L.shape.w *= kx; L.shape.h *= ky; L.shape.strokeW *= Math.min(kx, ky); L.shape.radius *= Math.min(kx, ky); }
        }) || (E.mapPaths && E.mapPaths([kx, 0, 0, ky, 0, 0])) || shiftBoards(0, 0, kx, ky));
      },
      /** the canvas W x H, the picture placed by the anchor (ax, ay = 0 | 0.5 | 1); new room on the bottom layer = the background colour */
      canvas(W, H, ax, ay) {
        W = Math.max(1, Math.min(16384, Math.round(W))); H = Math.max(1, Math.min(16384, Math.round(H)));
        const ox = Math.round((W - S.w) * (ax == null ? 0.5 : ax)), oy = Math.round((H - S.h) * (ay == null ? 0.5 : ay)), ow = S.w, oh = S.h, bottom = S.layers[0];
        return E.docOp("canvas size", () => E.remapLayers(W, H, (src, g, L) => {
          if (L === bottom && L.type === "pixel" && /^background$/i.test(L.name)) { g.fillStyle = S.bg; g.fillRect(0, 0, W, H); g.clearRect(ox, oy, ow, oh); }
          g.drawImage(src, ox, oy);
        }, (L) => { const p = L.text || L.shape; p.x += ox; p.y += oy; }) || (E.mapPaths && E.mapPaths([1, 0, 0, 1, ox, oy])) || shiftBoards(ox, oy, 1, 1));
      },
      /** rotate the canvas by 90 / -90 / 180, or flip it ("h" / "v") */
      rotate(how) {
        return E.docOp(typeof how === "number" ? `rotate canvas ${how}°` : `flip canvas ${how === "h" ? "horizontal" : "vertical"}`, () => {
          textShapeToPixels();
          const W0 = S.w, H0 = S.h, swap = how === 90 || how === -90, W = swap ? H0 : W0, H = swap ? W0 : H0;
          E.remapLayers(W, H, (src, g) => {
            g.save();
            if (how === 90) { g.translate(W, 0); g.rotate(Math.PI / 2); }
            else if (how === -90) { g.translate(0, H); g.rotate(-Math.PI / 2); }
            else if (how === 180) { g.translate(W, H); g.rotate(Math.PI); }
            else if (how === "h") { g.translate(W, 0); g.scale(-1, 1); }
            else if (how === "v") { g.translate(0, H); g.scale(1, -1); }
            g.drawImage(src, 0, 0); g.restore();
          });
          if (E.mapPaths) E.mapPaths(how === 90 ? [0, 1, -1, 0, W, 0] : how === -90 ? [0, -1, 1, 0, 0, H] : how === 180 ? [-1, 0, 0, -1, W, H] : how === "h" ? [-1, 0, 0, 1, W, 0] : [1, 0, 0, -1, 0, H], true);
        });
      },
      /** the ACTIVE layer rotated / flipped about its content's centre (Edit ▸ Transform) */
      layer(how) {
        const L = E.layer(); if (!L || L.type !== "pixel") return say("Edit ▸ Transform works on a pixel layer");
        const box = E.alphaBox(L.canvas); if (!box) return say("the layer is empty");
        const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
        return E.pxOp("transform layer", (c, g) => {
          const t = newCanvas(S.w, S.h); ctx(t).drawImage(c, 0, 0); g.clearRect(0, 0, S.w, S.h);
          g.save(); g.translate(cx, cy);
          if (how === "h") g.scale(-1, 1); else if (how === "v") g.scale(1, -1); else g.rotate(how * Math.PI / 180);
          g.drawImage(t, -cx, -cy); g.restore();
        });
      },
      cropToSelection() { if (!E.hasSel()) return say("select the area to keep first"); const b = P.bbox(S.sel, S.w, S.h); cropTo(b); },
      trim() {
        const b = E.alphaBox(E.flatten()); if (!b) return say("the picture is empty");
        if (b.x === 0 && b.y === 0 && b.w === S.w && b.h === S.h) return say("nothing to trim - there is no transparent border");
        cropTo(b);
      },
      crop: cropTo,
      autoTone() { return E.applyFilter("autocontrast", { clip: 0.5, perChannel: false }, "Auto Tone"); },
      autoContrast() { return E.applyFilter("autocontrast", { clip: 0.1, perChannel: false }, "Auto Contrast"); },
      autoColor() { return E.applyFilter("autocontrast", { clip: 0.5, perChannel: true }, "Auto Color"); },
    };
    E.img = img;
  }

  const api = { install, RATIOS, cropBox, xform, apply, invert, hitTransform, skewFor, toneWeight, toneDab, gradStops, GRAD_KINDS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PCTools = api;
})(typeof window !== "undefined" ? window : globalThis);
