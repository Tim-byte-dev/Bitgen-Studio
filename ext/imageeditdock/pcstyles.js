/* pcstyles.js — THE IMAGE EDITOR'S MORE LAYER STYLES (2.397.0), window.PCStyles.
 *
 * Tim (verbatim): "yes please add the text tool improvements, like text along a path , add the filters like lense
 * flare, swirl,drop shadow, 3d text and the overlay styles"
 *
 * pcdoc.js draws the 2.389.0 styles (drop shadow, inner shadow, outer / inner glow, stroke, colour / gradient overlay).
 * This file adds what Photoshop's Layer Style dialog has besides, and pcdoc's styled() calls it:
 *
 *   BEVEL & EMBOSS   inner bevel / outer bevel / emboss / pillow emboss; depth, up / down, size, soften, the light's
 *                    angle + altitude, highlight (screen) and shadow (multiply) colours + opacities. A height map from
 *                    the layer's blurred silhouette, lit like a surface (bevelShade - pure, tested in Node)
 *   SATIN            the silhouette shifted both ways along an angle, blurred, XOR-ed: the silky inner sheen
 *   PATTERN OVERLAY  10 patterns drawn in two colours (patternTile - pure), scale, blend mode, opacity
 *   OVERLAYS         Color / Gradient / Pattern Overlay each with a BLEND MODE (16); the gradient overlay also has a
 *                    style (linear, radial, angle, reflected, diamond), reverse and scale
 *   PRESETS          one-click looks for text and shapes: Gold, Chrome, Neon, Embossed, Glass, 3D Pop, Retro, Fire, Ice,
 *                    Letterpress - the Layer Style dialog's Styles list
 * 2.411.0 (Tim: "add these styles to a presets dropdown in the text tool properties in timeline docker and image editor"
 * -> the PSD text effects, static/textfx.js): a bevel's GLOSS CONTOUR (gloss: [[in, out] 0..255 …] - Photoshop's
 * "Ring - Double" gives metal its bands), a gradient's STOPS (stops: [{c, at 0..1} …] - more than two colours), the
 * GLITTER pattern (sparse bright sparkles) and gradientFill for a gradient STROKE (pcdoc.js).
 * The bevel is cached per layer (its silhouette's fingerprint + the settings), so a redraw that changes nothing else
 * does not recompute it.
 */
(function (root) {
  "use strict";

  /* ================================ pure ================================ */
  const BLENDS = ["normal", "multiply", "screen", "overlay", "soft-light", "hard-light", "color-dodge", "color-burn", "darken", "lighten",
    "difference", "exclusion", "hue", "saturation", "color", "luminosity"];
  const compOf = (b) => (b && b !== "normal" && BLENDS.includes(b) ? b : "source-over");
  const BEVEL_STYLES = ["inner bevel", "outer bevel", "emboss", "pillow emboss", "stroke emboss"];   // 2.411.0: + stroke emboss (pcdoc lights the stroke)
  const GRAD_STYLES = ["linear", "radial", "angle", "reflected", "diamond"];
  const PATTERNS = [["checker", "Checkerboard"], ["stripes", "Stripes"], ["diagonal", "Diagonal stripes"], ["dots", "Polka dots"], ["grid", "Grid"],
    ["bricks", "Bricks"], ["waves", "Waves"], ["carbon", "Carbon fibre"], ["noise", "Noise"], ["halftone", "Halftone"], ["glitter", "Glitter"]];
  const hex3 = (h) => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(h || "")); return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0]; };

  /** a pattern's tile: n x n RGBA in two colours (c1 = the marks, c2 = the ground) */
  function patternTile(kind, n, c1, c2) {
    const N = Math.max(4, Math.round(n || 16)), out = new Uint8ClampedArray(N * N * 4), A = hex3(c1), B = hex3(c2);
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N; let t;                                     // t = how much of c1 (0..1)
      switch (kind) {
        case "stripes": t = v < 0.5 ? 1 : 0; break;
        case "diagonal": t = ((x + y) % N) < N / 2 ? 1 : 0; break;
        case "dots": { const d = Math.hypot(u - 0.5, v - 0.5); t = d < 0.28 ? 1 : d < 0.31 ? (0.31 - d) / 0.03 : 0; break; }
        case "grid": t = x < Math.max(1, N / 12) || y < Math.max(1, N / 12) ? 1 : 0; break;
        case "bricks": { const row = v < 0.5 ? 0 : 1, xx = (u + row * 0.5) % 1, m = Math.max(1 / N, 0.06); t = (v % 0.5) < m || xx < m ? 1 : 0; break; }
        case "waves": t = Math.abs(v - 0.5 - 0.25 * Math.sin(u * Math.PI * 2)) < 0.12 ? 1 : 0; break;
        case "carbon": { const q = (Math.floor(u * 2) + Math.floor(v * 2)) % 2, w = q ? u * 2 % 1 : v * 2 % 1; t = 0.25 + 0.75 * Math.sin(w * Math.PI); break; }
        case "noise": t = rnd(); break;
        case "glitter": { const r = rnd(); t = r > 0.86 ? 0.75 + rnd() * 0.25 : r * 0.18; break; }   // 2.411.0: sparse sparkles
        case "halftone": { const d = Math.hypot(u - 0.5, v - 0.5); t = d < 0.18 + 0.2 * v ? 1 : 0; break; }
        default: t = (x < N / 2) !== (y < N / 2) ? 1 : 0;                   // checker
      }
      const i = (y * N + x) * 4;
      for (let c = 0; c < 3; c++) out[i + c] = Math.round(B[c] + (A[c] - B[c]) * t);
      out[i + 3] = 255;
    }
    return out;
  }

  /** a box blur of a float plane (3 passes ~ gaussian), radius r */
  function blurPlane(src, w, h, r) {
    if (!(r >= 1)) return Float32Array.from(src);
    const F = root.IEFilters;
    if (F && F.gaussPlanes) return F.gaussPlanes([src], w, h, Math.max(0.3, r / 2))[0];
    let a = Float32Array.from(src), b = new Float32Array(src.length);
    const R = Math.max(1, Math.round(r / 2));
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < h; y++) { let acc = 0; const row = y * w;
        for (let x = -R; x <= R; x++) acc += a[row + Math.min(w - 1, Math.max(0, x))];
        for (let x = 0; x < w; x++) { b[row + x] = acc / (2 * R + 1); acc += a[row + Math.min(w - 1, x + R + 1)] - a[row + Math.max(0, x - R)]; } }
      for (let x = 0; x < w; x++) { let acc = 0;
        for (let y = -R; y <= R; y++) acc += b[Math.min(h - 1, Math.max(0, y)) * w + x];
        for (let y = 0; y < h; y++) { a[y * w + x] = acc / (2 * R + 1); acc += b[Math.min(h - 1, y + R + 1) * w + x] - b[Math.max(0, y - R) * w + x]; } }
    }
    return a;
  }
  /**
   * BEVEL & EMBOSS - the light on a surface raised by the silhouette.
   * alpha = 0..1 plane (w x h); p = {style, depth (%), direction "up"|"down", size, soften, angle, altitude}
   * -> Float32Array: > 0 = highlight, < 0 = shadow (-1..1), 0 where the style draws nothing
   */
  function bevelShade(alpha, w, h, p) {
    const q = p || {}, size = Math.max(1, +q.size || 6), style = BEVEL_STYLES.includes(q.style) && q.style !== "stroke emboss" ? q.style : "inner bevel";
    let Hm = blurPlane(alpha, w, h, style === "emboss" || style === "pillow emboss" ? size : size * 2);
    // 2.413.0: the PROFILE contour (Photoshop's "Contour" under Bevel & Emboss): the height across the bevel through the
    // curve - a ring, a double step, a rounded lip; range (%) = how much of the bevel's width it spans (50 = all of it)
    const shp = glossOf(q.shape);
    if (shp) {
      const k2 = 0.5 / Math.max(0.01, (q.range == null ? 50 : +q.range) / 100), H2 = new Float32Array(Hm.length);
      for (let i = 0; i < Hm.length; i++) H2[i] = contourAt(shp, Math.max(0, Math.min(1, Hm[i] * k2)));
      Hm = H2;
    }
    const az = (q.angle == null ? 120 : +q.angle) * Math.PI / 180, alt = Math.max(1, Math.min(89, q.altitude == null ? 30 : +q.altitude)) * Math.PI / 180;
    const Lx = Math.cos(az) * Math.cos(alt), Ly = -Math.sin(az) * Math.cos(alt), Lz = Math.sin(alt);
    const k = ((q.depth == null ? 100 : +q.depth) / 100) * size * 1.6, dir = q.direction === "down" ? -1 : 1;
    const out = new Float32Array(w * h), gl = glossOf(q.gloss);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, a = alpha[i];
      let wgt;
      if (style === "inner bevel") wgt = a;
      else if (style === "outer bevel") wgt = (1 - a) * (Hm[i] > 0.004 ? 1 : 0);
      else wgt = Hm[i] > 0.004 || a > 0 ? 1 : 0;                                // emboss / pillow: both sides
      if (!wgt) continue;
      const gx = (Hm[y * w + Math.min(w - 1, x + 1)] - Hm[y * w + Math.max(0, x - 1)]) / 2;
      const gy = (Hm[Math.min(h - 1, y + 1) * w + x] - Hm[Math.max(0, y - 1) * w + x]) / 2;
      let nx = -gx * k, ny = -gy * k; const nz = 1, nl = Math.hypot(nx, ny, nz);
      let sh = (nx * Lx + ny * Ly + nz * Lz) / nl - Lz;
      if (style === "pillow emboss" && a < 0.5) sh = -sh;
      let v = Math.max(-1, Math.min(1, sh * 1.8 * dir));
      if (gl) v = contourAt(gl, (v + 1) / 2) * 2 - 1;                          // 2.411.0: the gloss contour
      out[i] = v * wgt;
    }
    const soft = +q.soften || 0;
    return soft >= 1 ? blurPlane(out, w, h, soft) : out;
  }
  /** 2.411.0: a contour curve ([[x, y] 0..255 …], Photoshop's TrnS / MpgS) -> sorted 0..1 points, or null (none / linear) */
  function glossOf(pts) {
    if (!Array.isArray(pts) || pts.length < 2) return null;
    const p = pts.map((q) => [Math.max(0, Math.min(1, (+q[0] || 0) / 255)), Math.max(0, Math.min(1, (+q[1] || 0) / 255))]).sort((a, b) => a[0] - b[0]);
    if (p.length === 2 && Math.abs(p[0][0] - p[0][1]) < 0.01 && Math.abs(p[1][0] - p[1][1]) < 0.01) return null;      // linear
    return p;
  }
  /** a contour's value at x (0..1): straight lines between its points */
  function contourAt(p, x) {
    if (x <= p[0][0]) return p[0][1];
    for (let i = 1; i < p.length; i++) if (x <= p[i][0]) { const a = p[i - 1], b = p[i], t = (x - a[0]) / Math.max(1e-6, b[0] - a[0]); return a[1] + (b[1] - a[1]) * t; }
    return p[p.length - 1][1];
  }
  /** 2.411.0: a gradient's colour at t (0..1) - {stops: [{c, at}]} or {c1, c2} */
  function stopsOf(go) {
    const st = Array.isArray(go && go.stops) ? go.stops.filter((x) => x && /^#[0-9a-f]{6}$/i.test(String(x.c))).map((x) => ({ c: x.c, at: Math.max(0, Math.min(1, +x.at || 0)) }))
      .sort((a, b) => a.at - b.at) : [];
    return st.length >= 2 ? st : [{ c: (go && go.c1) || "#000000", at: 0 }, { c: (go && go.c2) || "#ffffff", at: 1 }];
  }
  function colorAt(stops, t) {
    if (t <= stops[0].at) return hex3(stops[0].c);
    for (let i = 1; i < stops.length; i++) if (t <= stops[i].at) {
      const a = hex3(stops[i - 1].c), b = hex3(stops[i].c), u = (t - stops[i - 1].at) / Math.max(1e-6, stops[i].at - stops[i - 1].at);
      return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
    }
    return hex3(stops[stops.length - 1].c);
  }
  /** a quick fingerprint of an alpha plane (the bevel cache's key) */
  function fingerprint(d, stride) {
    let h = 2166136261 >>> 0; const st = Math.max(4, stride || 4);
    for (let i = 3; i < d.length; i += st) { h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; }
    return h.toString(36) + ":" + d.length;
  }
  /** the gradient overlay's t (0..1) at a point - the five styles; (cx, cy) centre, angle (deg), r = the reach (px) */
  function gradT(style, x, y, cx, cy, angleDeg, r) {
    const a = angleDeg * Math.PI / 180, ux = Math.cos(a), uy = -Math.sin(a), dx = x - cx, dy = y - cy, R = Math.max(1, r);
    const lin = (dx * ux + dy * uy) / R;                                          // -1 .. 1 along the angle
    switch (style) {
      case "radial": return Math.min(1, Math.hypot(dx, dy) / R);
      case "angle": { let t = (Math.atan2(-dy, dx) - a) / (2 * Math.PI); t -= Math.floor(t); return t; }
      case "reflected": return Math.min(1, Math.abs(lin));
      case "diamond": return Math.min(1, (Math.abs(dx) + Math.abs(dy)) / R);
      default: return Math.max(0, Math.min(1, (lin + 1) / 2));
    }
  }

  /** the Layer Style dialog's fields for the new styles (and the overlays' new ones) - pcui.js shows them */
  const FIELDS = {
    bevel: [["style", "Style", "sel", BEVEL_STYLES], ["depth", "Depth (%)", "num", 1, 1000], ["direction", "Direction", "sel", ["up", "down"]],
      ["size", "Size (px)", "num", 1, 250], ["soften", "Soften (px)", "num", 0, 16], ["angle", "Light angle (°)", "num", -180, 180], ["altitude", "Altitude (°)", "num", 1, 89],
      ["hiColor", "Highlight colour", "color"], ["hiOpacity", "Highlight opacity", "pct"], ["shColor", "Shadow colour", "color"], ["shOpacity", "Shadow opacity", "pct"]],
    satin: [["blend", "Blend mode", "sel", BLENDS], ["color", "Colour", "color"], ["opacity", "Opacity", "pct"], ["angle", "Angle (°)", "num", -180, 180],
      ["distance", "Distance (px)", "num", 1, 250], ["size", "Size (px)", "num", 0, 250], ["invert", "Invert", "chk"]],
    patternOverlay: [["pattern", "Pattern", "sel", PATTERNS.map(([k]) => k)], ["c1", "Colour", "color"], ["c2", "Ground colour", "color"], ["scale", "Scale (%)", "num", 10, 1000],
      ["blend", "Blend mode", "sel", BLENDS], ["opacity", "Opacity", "pct"]],
    colorOverlay: [["blend", "Blend mode", "sel", BLENDS], ["color", "Colour", "color"], ["opacity", "Opacity", "pct"]],
    gradientOverlay: [["blend", "Blend mode", "sel", BLENDS], ["c1", "From", "color"], ["c2", "To", "color"], ["style", "Style", "sel", GRAD_STYLES], ["angle", "Angle (°)", "num", -180, 180],
      ["scale", "Scale (%)", "num", 10, 150], ["reverse", "Reverse", "chk"], ["opacity", "Opacity", "pct"]],
  };

  /** one-click looks (the Layer Style dialog's Styles list) - only the styles each one turns on */
  const PRESETS = [
    ["Gold", { gradientOverlay: { on: true, c1: "#7a4a00", c2: "#ffe39a", style: "linear", angle: 90, opacity: 1, blend: "normal", scale: 100 },
      bevel: { on: true, style: "inner bevel", depth: 180, size: 5, hiColor: "#fff6d0", hiOpacity: 0.9, shColor: "#3b2300", shOpacity: 0.7 },
      shadow: { on: true, color: "#000000", opacity: 0.55, angle: 120, distance: 4, size: 6 } }],
    ["Chrome", { gradientOverlay: { on: true, c1: "#2c2f33", c2: "#ffffff", style: "reflected", angle: 90, opacity: 1, blend: "normal", scale: 100 },
      bevel: { on: true, style: "inner bevel", depth: 250, size: 4, altitude: 45, hiOpacity: 1, shOpacity: 0.8 },
      satin: { on: true, color: "#000000", opacity: 0.35, angle: 19, distance: 9, size: 10, invert: false, blend: "multiply" },
      stroke: { on: true, color: "#8a8f96", opacity: 1, size: 1, position: "outside" } }],
    ["Neon", { colorOverlay: { on: true, color: "#ffffff", opacity: 1, blend: "normal" },
      innerGlow: { on: true, color: "#00e5ff", opacity: 0.9, size: 6 }, outerGlow: { on: true, color: "#00e5ff", opacity: 1, size: 22 } }],
    ["Embossed", { bevel: { on: true, style: "emboss", depth: 120, size: 4, angle: 120, altitude: 30, hiOpacity: 0.8, shOpacity: 0.8 } }],
    ["Glass", { colorOverlay: { on: true, color: "#bfe6ff", opacity: 0.35, blend: "normal" },
      bevel: { on: true, style: "inner bevel", depth: 300, size: 8, soften: 2, altitude: 60, hiOpacity: 1, shOpacity: 0.45 },
      innerShadow: { on: true, color: "#0a2a40", opacity: 0.35, angle: 120, distance: 3, size: 8 },
      shadow: { on: true, color: "#000000", opacity: 0.35, angle: 120, distance: 6, size: 12 } }],
    ["3D Pop", { stroke: { on: true, color: "#000000", opacity: 1, size: 3, position: "outside" },
      shadow: { on: true, color: "#000000", opacity: 1, angle: 135, distance: 7, size: 0 },
      bevel: { on: true, style: "inner bevel", depth: 100, size: 3, hiOpacity: 0.6, shOpacity: 0.5 } }],
    ["Retro", { colorOverlay: { on: true, color: "#ffd23f", opacity: 1, blend: "normal" }, stroke: { on: true, color: "#1b1b1b", opacity: 1, size: 3, position: "outside" },
      shadow: { on: true, color: "#ff3d7f", opacity: 1, angle: 135, distance: 8, size: 0 } }],
    ["Fire", { gradientOverlay: { on: true, c1: "#ff2a00", c2: "#ffe14d", style: "linear", angle: 90, opacity: 1, blend: "normal", scale: 100 },
      innerGlow: { on: true, color: "#fff2a8", opacity: 0.8, size: 6 }, outerGlow: { on: true, color: "#ff6a00", opacity: 0.9, size: 18 } }],
    ["Ice", { gradientOverlay: { on: true, c1: "#4fb3ff", c2: "#effbff", style: "linear", angle: 90, opacity: 1, blend: "normal", scale: 100 },
      bevel: { on: true, style: "inner bevel", depth: 160, size: 5, hiOpacity: 1, shColor: "#0a3a66", shOpacity: 0.5 },
      stroke: { on: true, color: "#ffffff", opacity: 0.9, size: 1, position: "outside" }, outerGlow: { on: true, color: "#bfefff", opacity: 0.7, size: 12 } }],
    ["Letterpress", { innerShadow: { on: true, color: "#000000", opacity: 0.7, angle: 90, distance: 2, size: 3 },
      shadow: { on: true, color: "#ffffff", opacity: 0.35, angle: -90, distance: 1, size: 0 } }],
  ];
  /** a preset over the defaults: every style off except the preset's (filled from `defaults`) */
  function presetStyles(name, defaults) {
    const p = PRESETS.find(([n]) => n === name); if (!p) return null;
    const out = {};
    for (const k of Object.keys(defaults || {})) out[k] = Object.assign({}, defaults[k], { on: false });
    for (const [k, v] of Object.entries(p[1])) out[k] = Object.assign({}, (defaults || {})[k] || {}, v, { on: true });
    return out;
  }

  /* ================================ canvas ================================ */
  const cache = new Map();
  function alphaPlane(content, W, H) {
    const d = content.getContext("2d").getImageData(0, 0, W, H).data, a = new Float32Array(W * H);
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let i = 0; i < a.length; i++) {
      const v = d[i * 4 + 3]; if (!v) continue;
      a[i] = v / 255;
      const x = i % W, y = (i - x) / W;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return { a, fp: fingerprint(d, 4 * 7), box: x1 < 0 ? { x: 0, y: 0, w: 0, h: 0 } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } };
  }
  /** {hi, sh} canvases for a bevel (cached by the layer, the silhouette and the settings) */
  function bevelCanvases(env, L, content, s, W, H) {
    const { a, fp, box } = alphaPlane(content, W, H);
    const key = `${(L && L.id) || "?"}|${fp}|${JSON.stringify(s)}|${W}x${H}`;
    const hit = cache.get(key); if (hit) return hit;
    // 2.411.0: only around the shape (its box + the bevel's reach) - a text effect's canvas is mostly empty margin
    const reach = Math.ceil(Math.max(1, +s.size || 6) * 3 + (+s.soften || 0) * 2 + 4);
    const x0 = Math.max(0, box.x - reach), y0 = Math.max(0, box.y - reach), x1 = Math.min(W, box.x + box.w + reach), y1 = Math.min(H, box.y + box.h + reach);
    const cw = Math.max(1, x1 - x0), ch = Math.max(1, y1 - y0), ca = new Float32Array(cw * ch);
    for (let y = 0; y < ch; y++) ca.set(a.subarray((y + y0) * W + x0, (y + y0) * W + x0 + cw), y * cw);
    const sh = bevelShade(ca, cw, ch, s), hi = env.newCanvas(W, H), lo = env.newCanvas(W, H);
    const hg = hi.getContext("2d"), lg = lo.getContext("2d"), hd = hg.createImageData(cw, ch), ld = lg.createImageData(cw, ch);
    const HC = hex3(s.hiColor || "#ffffff"), SC = hex3(s.shColor || "#000000"), ho = s.hiOpacity == null ? 0.75 : s.hiOpacity, so = s.shOpacity == null ? 0.75 : s.shOpacity;
    for (let i = 0; i < sh.length; i++) {
      const v = sh[i]; if (!v) continue;
      const o = i * 4;
      if (v > 0) { hd.data[o] = HC[0]; hd.data[o + 1] = HC[1]; hd.data[o + 2] = HC[2]; hd.data[o + 3] = Math.min(255, v * ho * 255); }
      else { ld.data[o] = SC[0]; ld.data[o + 1] = SC[1]; ld.data[o + 2] = SC[2]; ld.data[o + 3] = Math.min(255, -v * so * 255); }
    }
    hg.putImageData(hd, x0, y0); lg.putImageData(ld, x0, y0);
    const out = { hi, sh: lo };
    if (cache.size > 24) cache.delete(cache.keys().next().value);
    cache.set(key, out);
    return out;
  }
  /** draw the bevel onto `g` (the layer's styled canvas) */
  function drawBevel(env, L, content, s, W, H, g) {
    const b = bevelCanvases(env, L, content, s, W, H);
    drawLit(g, b.hi, b.sh, s);
  }
  /** the highlight / shadow canvases onto g with the bevel's blend modes (2.411.0: hiBlend / shBlend, PSD's colour dodge ...) */
  function drawLit(g, hi, sh, s) {
    g.save(); g.globalCompositeOperation = compOf(s.hiBlend || "screen"); g.drawImage(hi, 0, 0); g.globalCompositeOperation = compOf(s.shBlend || "multiply"); g.drawImage(sh, 0, 0); g.restore();
  }
  function tinted(env, content, color, W, H) {
    const c = env.newCanvas(W, H), g = c.getContext("2d");
    g.drawImage(content, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = color; g.fillRect(0, 0, W, H);
    return c;
  }
  /** the satin sheen, already clipped to the content */
  function satinCanvas(env, content, s, W, H) {
    const a = (s.angle || 0) * Math.PI / 180, d = s.distance == null ? 11 : s.distance, dx = Math.cos(a) * d, dy = -Math.sin(a) * d;
    const sil = tinted(env, content, s.color || "#000", W, H), c = env.newCanvas(W, H), g = c.getContext("2d");
    const blur = s.size > 0 ? `blur(${(s.size / 2).toFixed(1)}px)` : "none";
    g.filter = blur; g.drawImage(sil, dx, dy); g.globalCompositeOperation = "xor"; g.drawImage(sil, -dx, -dy); g.filter = "none";
    if (s.invert) { const t = env.newCanvas(W, H), tg = t.getContext("2d"); tg.fillStyle = s.color || "#000"; tg.fillRect(0, 0, W, H); tg.globalCompositeOperation = "destination-out"; tg.drawImage(c, 0, 0);
      g.globalCompositeOperation = "copy"; g.drawImage(t, 0, 0); }
    g.globalCompositeOperation = "destination-in"; g.drawImage(content, 0, 0); g.globalCompositeOperation = "source-over";
    return c;
  }
  /** the box of a canvas's pixels (alpha > 0) - the overlays align with the layer, like Photoshop's "Align with Layer" */
  function alphaBox(content, W, H) {
    const d = content.getContext("2d").getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) { const row = y * W * 4; for (let x = 0; x < W; x++) if (d[row + x * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    return x1 < 0 ? { x: 0, y: 0, w: W, h: H } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  function gradientFill(env, go, W, H, bx) {
    const c = env.newCanvas(W, H), g = c.getContext("2d"), style = GRAD_STYLES.includes(go.style) ? go.style : "linear";
    const B0 = bx || { x: 0, y: 0, w: W, h: H }, cx = B0.x + B0.w / 2, cy = B0.y + B0.h / 2, k = Math.max(0.1, (go.scale == null ? 100 : go.scale) / 100);
    const reach = Math.hypot(B0.w, B0.h) / 2 * k;
    let ST = stopsOf(go);
    if (go.reverse) ST = ST.map((x) => ({ c: x.c, at: 1 - x.at })).reverse();
    const ang = go.angle == null ? 90 : go.angle;
    if (style === "linear" || style === "radial") {
      let grd;
      if (style === "radial") grd = g.createRadialGradient(cx, cy, 0, cx, cy, reach);
      else { const a = ang * Math.PI / 180, rr = (Math.abs(B0.w * Math.cos(a)) / 2 + Math.abs(B0.h * Math.sin(a)) / 2) * k;
        grd = g.createLinearGradient(cx - Math.cos(a) * rr, cy + Math.sin(a) * rr, cx + Math.cos(a) * rr, cy - Math.sin(a) * rr); }
      ST.forEach((x) => grd.addColorStop(x.at, x.c));
      g.fillStyle = grd; g.fillRect(0, 0, W, H); return c;
    }
    const id = g.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = gradT(style, x, y, cx, cy, ang, reach), o = (y * W + x) * 4, C = colorAt(ST, t);
      id.data[o] = C[0]; id.data[o + 1] = C[1]; id.data[o + 2] = C[2]; id.data[o + 3] = 255;
    }
    g.putImageData(id, 0, 0); return c;
  }
  function patternFill(env, po, W, H) {
    if (/^user:/.test(po.pattern || "") && root.PCPattern && root.PCPattern.scaled) {   // 2.437.0: one from the pattern library
      const t = root.PCPattern.scaled(po.pattern.slice(5), po.scale), c = env.newCanvas(W, H), g = c.getContext("2d");
      if (t) { g.fillStyle = g.createPattern(t, "repeat"); g.fillRect(0, 0, W, H); }
      return c;
    }
    const n = Math.max(4, Math.round(16 * Math.max(0.1, (po.scale == null ? 100 : po.scale) / 100)));
    const tile = env.newCanvas(n, n), tg = tile.getContext("2d"), id = tg.createImageData(n, n);
    id.data.set(patternTile(po.pattern || "checker", n, po.c1 || "#000000", po.c2 || "#ffffff")); tg.putImageData(id, 0, 0);
    const c = env.newCanvas(W, H), g = c.getContext("2d");
    g.fillStyle = g.createPattern(tile, "repeat"); g.fillRect(0, 0, W, H); return c;
  }
  /** the content with its overlays (pattern, gradient, colour - Photoshop's order, each with its blend mode) */
  function overlays(env, st, content, W, H) {
    const po = st.patternOverlay, go = st.gradientOverlay, co = st.colorOverlay;
    if (!(po && po.on) && !(go && go.on) && !(co && co.on)) return content;
    const body = env.newCanvas(W, H), bg = body.getContext("2d"); bg.drawImage(content, 0, 0);
    // each overlay is blended onto a copy, then laid back SOURCE-ATOP: the colours change, the alpha stays the content's
    const lay = (fill, s) => {
      const t = env.newCanvas(W, H), tg = t.getContext("2d"); tg.drawImage(body, 0, 0);
      tg.save(); tg.globalAlpha = s.opacity == null ? 1 : s.opacity; tg.globalCompositeOperation = compOf(s.blend); tg.drawImage(fill, 0, 0); tg.restore();
      bg.save(); bg.globalCompositeOperation = "source-atop"; bg.drawImage(t, 0, 0); bg.restore();
    };
    if (po && po.on) lay(patternFill(env, po, W, H), po);
    if (go && go.on) lay(gradientFill(env, go, W, H, alphaBox(content, W, H)), go);
    if (co && co.on) { const f = env.newCanvas(W, H), fg = f.getContext("2d"); fg.fillStyle = co.color || "#f00"; fg.fillRect(0, 0, W, H); lay(f, co); }
    return body;
  }

  const api = { BLENDS, compOf, BEVEL_STYLES, GRAD_STYLES, PATTERNS, FIELDS, PRESETS, presetStyles,
    patternTile, blurPlane, bevelShade, fingerprint, gradT, glossOf, contourAt, stopsOf, colorAt, bevelCanvases, drawBevel, drawLit, satinCanvas, gradientFill, alphaBox, patternFill, overlays, _cache: cache };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document) root.PCStyles = api;
})(typeof window !== "undefined" ? window : globalThis);
