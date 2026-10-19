/* filters4.js — THE FILTER MENU, ROUND B part 2 (2.481.0): Distort, Pixelate, Render, Stylize + the artistic sets
 * (Artistic, Sketch, Texture). window.IEFilters4.
 *
 * Tim (verbatim): "close the photoshop gap."
 *
 *   Distort    Displace (a map from another layer / the merged picture: red moves across, green up and down), Polar
 *              Coordinates (both ways), Pinch, ZigZag (pond ripples / out from / around the centre), Shear (a bend
 *              through top / middle / bottom), Glass (frosted / blocks / canvas / tiny lens)
 *   Pixelate   Color Halftone (C / M / Y / K dot screens at their angles), Crystallize, Pointillize, Facet, Fragment,
 *              Mezzotint (dots / lines / strokes)
 *   Render     Lighting Effects (spot / point / infinite, colour, height from the brightness or the transparency,
 *              gloss, ambience), Fibers, Difference Clouds
 *   Stylize    Diffuse (normal / darken / lighten / anisotropic), Tiles, Trace Contour
 *   Artistic   Cutout, Poster Edges, Watercolor, Dry Brush         Sketch   Graphic Pen, Charcoal
 *   Texture    Grain (regular / soft / sprinkles / clumped / horizontal / vertical / speckle), Craquelure
 * Pure (rgba, w, h, params, ctx) -> RGBA (filters.js's rule), registered into IEFilters.FILTERS at load. Displace's
 * map is a layer picked like Apply Image's (filters2.js: the "layerpick" kind + its SOURCES). Pure helpers (Node:
 * scripts/test-filters3.js): warp, voronoi, heightNormals.
 */
(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const FX = isNode ? require("./filters.js") : root.IEFilters;
  const F2 = isNode ? require("./filters2.js") : root.IEFilters2;
  const F3 = isNode ? require("./filters3.js") : root.IEFilters3;
  const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
  const N = (id, label, min, max, step, def) => ({ id, label, type: "range", min, max, step, def });
  const SEL = (id, label, options, def) => ({ id, label, type: "select", options, def });
  const CHK = (id, label, def) => ({ id, label, type: "check", def });
  const COL = (id, label, def) => ({ id, label, type: "color", def });
  const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
  const rng = (seed) => F3.rng(seed);
  const hex3 = (h) => FX.hex3(h);

  /** move every pixel: map(x, y) -> the source point; edges: "clamp" | "wrap" | "clear" */
  function warp(s, w, h, map, edges) {
    const out = new Uint8ClampedArray(s.length), px = [0, 0, 0, 0];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let [sx, sy] = map(x, y); const i = (y * w + x) * 4;
      if (edges === "wrap") { sx = ((sx % w) + w) % w; sy = ((sy % h) + h) % h; }
      else if (edges === "clear" && (sx < -0.5 || sy < -0.5 || sx > w - 0.5 || sy > h - 0.5)) continue;
      F3.sampleAt(s, w, h, sx, sy, px);
      out[i] = px[0]; out[i + 1] = px[1]; out[i + 2] = px[2]; out[i + 3] = px[3];
    }
    return out;
  }
  /** jittered-grid cells: -> {sites: [[x, y]], cellOf: Int32Array (each pixel's nearest site), edge: Float32Array (distance to the cell border, px)} */
  function voronoi(w, h, size, seed) {
    const rnd = rng(seed || 3), gw = Math.ceil(w / size) + 1, gh = Math.ceil(h / size) + 1, sites = [];
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) sites.push([(gx + 0.15 + rnd() * 0.7) * size, (gy + 0.15 + rnd() * 0.7) * size]);
    const cellOf = new Int32Array(w * h), edge = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const gx = Math.floor(x / size), gy = Math.floor(y / size); let b1 = Infinity, b2 = Infinity, bi = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const cx = gx + dx, cy = gy + dy; if (cx < 0 || cy < 0 || cx >= gw || cy >= gh) continue;
        const k = cy * gw + cx, d = Math.hypot(sites[k][0] - x, sites[k][1] - y);
        if (d < b1) { b2 = b1; b1 = d; bi = k; } else if (d < b2) b2 = d;
      }
      cellOf[y * w + x] = bi; edge[y * w + x] = (b2 - b1) / 2;
    }
    return { sites, cellOf, edge };
  }
  /** a height field -> unit normals (nx, ny, nz per pixel) */
  function heightNormals(H, w, h, depth) {
    const n = new Float32Array(w * h * 3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const at = (xx, yy) => H[Math.max(0, Math.min(h - 1, yy)) * w + Math.max(0, Math.min(w - 1, xx))];
      const dx = (at(x + 1, y) - at(x - 1, y)) * depth, dy = (at(x, y + 1) - at(x, y - 1)) * depth, L = Math.hypot(dx, dy, 1), i = (y * w + x) * 3;
      n[i] = -dx / L; n[i + 1] = -dy / L; n[i + 2] = 1 / L;
    }
    return n;
  }
  const ctxOf = (ctx, w, h) => ({ ox: (ctx && ctx.x) || 0, oy: (ctx && ctx.y) || 0, W: (ctx && ctx.W) || w, H: (ctx && ctx.H) || h });

  /* ---------------- Distort ---------------- */
  function displace(s, w, h, p, ctx) {
    const src = F2 && F2.SOURCES.get(String(p.map || "")); if (!src) return Uint8ClampedArray.from(s);
    const { ox, oy, W, H } = ctxOf(ctx, w, h), kx = p.hscale / 100, ky = p.vscale / 100;     // 128 levels off grey = scale % of 128 px
    return warp(s, w, h, (x, y) => {
      let mx = x + ox, my = y + oy;
      if (p.fit === "tile") { mx = ((mx % src.W) + src.W) % src.W; my = ((my % src.H) + src.H) % src.H; }
      else { mx = Math.max(0, Math.min(src.W - 1, Math.floor(mx * src.W / W))); my = Math.max(0, Math.min(src.H - 1, Math.floor(my * src.H / H))); }
      const j = (my * src.W + mx) * 4;
      return [x + (src.data[j] - 128) * kx, y + (src.data[j + 1] - 128) * ky];
    }, p.undefined === "wrap around" ? "wrap" : "clamp");
  }
  function polar(s, w, h, p) {
    const cx = w / 2, cy = h / 2;
    if (p.mode === "rectangular to polar")       // the picture's top edge becomes the centre, its sides meet at the top
      return warp(s, w, h, (x, y) => { const dx = x - cx, dy = y - cy, a = (Math.atan2(dx, -dy) + 2 * Math.PI) % (2 * Math.PI); return [a / (2 * Math.PI) * w, Math.hypot(dx / cx, dy / cy) * h]; }, "clamp");
    return warp(s, w, h, (x, y) => { const a = x / w * 2 * Math.PI, r = y / h; return [cx + Math.sin(a) * r * cx, cy - Math.cos(a) * r * cy]; }, "clamp");
  }
  function pinch(s, w, h, p) {                   // + squeezes towards the centre, - pushes out (the classic whirl-pinch)
    const cx = w / 2, cy = h / 2, R = Math.min(cx, cy), a = p.amount / 100;
    return warp(s, w, h, (x, y) => {
      const dx = (x - cx) / R, dy = (y - cy) / R, d = Math.hypot(dx, dy); if (d >= 1 || !d) return [x, y];
      const f = Math.pow(Math.sin(Math.PI / 2 * d), -a);
      return [cx + dx * f * R, cy + dy * f * R];
    }, "clamp");
  }
  function zigzag(s, w, h, p) {
    const cx = w / 2, cy = h / 2, R = Math.min(cx, cy), amt = p.amount / 100 * R * 0.12;
    return warp(s, w, h, (x, y) => {
      const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy); if (d >= R || !d) return [x, y];
      const fall = 1 - d / R, wv = Math.sin(d / R * p.ridges * 2 * Math.PI) * amt * fall;
      if (p.style === "around center") { const a = wv / d; const ca = Math.cos(a), sa = Math.sin(a); return [cx + dx * ca - dy * sa, cy + dx * sa + dy * ca]; }
      if (p.style === "out from center") return [x + dx / d * wv, y + dy / d * wv];
      const a = wv / d * 0.5, ca = Math.cos(a), sa = Math.sin(a); return [cx + (dx * ca - dy * sa) + dx / d * wv * 0.5, cy + (dx * sa + dy * ca) + dy / d * wv * 0.5];
    }, "clamp");
  }
  function shear(s, w, h, p) {
    const t0 = p.top, t1 = p.middle, t2 = p.bottom;
    return warp(s, w, h, (x, y) => { const t = h > 1 ? y / (h - 1) : 0, u = 1 - t, off = u * u * t0 + 2 * u * t * (2 * t1 - (t0 + t2) / 2) + t * t * t2; return [x - off, y]; }, p.undefined === "wrap around" ? "wrap" : "clamp");
  }
  function glass(s, w, h, p) {
    const rnd = rng(9), sc = Math.max(10, p.scaling) / 100, n = w * h, Hf = new Float32Array(n);
    if (p.texture === "frosted") { for (let i = 0; i < n; i++) Hf[i] = rnd(); }
    else if (p.texture === "blocks") { const b = 12 * sc; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const u = (x % b) / b, v = (y % b) / b; Hf[y * w + x] = Math.min(u, v, 1 - u, 1 - v) * 4; } }
    else if (p.texture === "canvas") { const b = 4 * sc; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) Hf[y * w + x] = (Math.sin(x / b * Math.PI) * Math.sin(y / b * Math.PI) + 1) / 2; }
    else { const b = 14 * sc; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const u = (x % b) / b - 0.5, v = (y % b) / b - 0.5; Hf[y * w + x] = Math.max(0, 0.25 - u * u - v * v) * 4; } }
    let Hs = Hf;
    if (p.smoothness > 1) Hs = FX.gaussPlanes([Hf], w, h, p.smoothness / 2)[0];
    const N3 = heightNormals(Hs, w, h, 8), d = p.distortion * 1.2;
    return warp(s, w, h, (x, y) => { const i = (y * w + x) * 3; return [x + N3[i] * d, y + N3[i + 1] * d]; }, "clamp");
  }

  /* ---------------- Pixelate ---------------- */
  function colorHalftone(s, w, h, p) {
    const R = Math.max(4, p.radius), angs = [p.c, p.m, p.y, p.k].map((a) => a * Math.PI / 180), out = new Uint8ClampedArray(s.length);
    const inkAt = (x, y, ch) => { const xx = Math.max(0, Math.min(w - 1, Math.round(x))), yy = Math.max(0, Math.min(h - 1, Math.round(y))), i = (yy * w + xx) * 4, r = s[i] / 255, g = s[i + 1] / 255, b = s[i + 2] / 255, k = 1 - Math.max(r, g, b); if (ch === 3) return k; const c = [r, g, b][ch]; return k >= 1 ? 0 : (1 - c - k) / (1 - k); };
    const cell = 2 * R;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, cov = [0, 0, 0, 0];
      for (let ch = 0; ch < 4; ch++) {
        const a = angs[ch], ca = Math.cos(a), sa = Math.sin(a), u = x * ca + y * sa, v = -x * sa + y * ca;
        const cu = (Math.floor(u / cell) + 0.5) * cell, cv = (Math.floor(v / cell) + 0.5) * cell, px = cu * ca - cv * sa, py = cu * sa + cv * ca;
        const ink = inkAt(px, py, ch), rad = Math.sqrt(ink) * R * 1.414, d = Math.hypot(u - cu, v - cv);
        cov[ch] = Math.max(0, Math.min(1, rad - d + 0.5));
      }
      out[i] = 255 * (1 - cov[0]) * (1 - cov[3]); out[i + 1] = 255 * (1 - cov[1]) * (1 - cov[3]); out[i + 2] = 255 * (1 - cov[2]) * (1 - cov[3]); out[i + 3] = s[i + 3];
    }
    return out;
  }
  function crystallize(s, w, h, p) {
    const V = voronoi(w, h, Math.max(3, p.cell), p.seed), out = new Uint8ClampedArray(s.length);
    for (let i = 0; i < w * h; i++) { const [sx, sy] = V.sites[V.cellOf[i]], j = (Math.max(0, Math.min(h - 1, Math.round(sy))) * w + Math.max(0, Math.min(w - 1, Math.round(sx)))) * 4; out[i * 4] = s[j]; out[i * 4 + 1] = s[j + 1]; out[i * 4 + 2] = s[j + 2]; out[i * 4 + 3] = s[i * 4 + 3]; }
    return out;
  }
  function pointillize(s, w, h, p) {
    const size = Math.max(3, p.cell), V = voronoi(w, h, size, p.seed), bg = hex3(p.background), out = new Uint8ClampedArray(s.length), rad = size * 0.48;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, [sx, sy] = V.sites[V.cellOf[i]], j = (Math.max(0, Math.min(h - 1, Math.round(sy))) * w + Math.max(0, Math.min(w - 1, Math.round(sx)))) * 4, d = Math.hypot(x - sx, y - sy), t = Math.max(0, Math.min(1, rad - d));
      for (let c = 0; c < 3; c++) out[i * 4 + c] = bg[c] + (s[j + c] - bg[c]) * t;
      out[i * 4 + 3] = s[i * 4 + 3];
    }
    return out;
  }
  function facet(s, w, h) {
    const sm = F3.surface(s, w, h, 2, 30);
    return FX.run("posterize", sm, w, h, { levels: 12 });
  }
  function fragment(s, w, h) {
    const out = new Uint8ClampedArray(s.length), d = 4;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) { let a = 0; for (const [dx, dy] of [[-d, -d], [d, -d], [-d, d], [d, d]]) a += s[(Math.max(0, Math.min(h - 1, y + dy)) * w + Math.max(0, Math.min(w - 1, x + dx))) * 4 + c]; out[i + c] = a / 4; }
    }
    return out;
  }
  function mezzotint(s, w, h, p) {
    const rnd = rng(p.seed), out = new Uint8ClampedArray(s.length);
    const lines = p.type.indexOf("lines") >= 0, strokes = p.type.indexOf("strokes") >= 0, len = /long/.test(p.type) ? 12 : /medium/.test(p.type) ? 6 : 3;
    const noise = new Float32Array(w * h);
    if (lines || strokes) { for (let y = 0; y < h; y++) { let v = rnd(), k = 0; for (let x = 0; x < w; x++) { if (k++ >= len) { v = rnd(); k = 0; } noise[y * w + x] = strokes ? (v + rnd() * 0.2) / 1.2 : v; } } }
    else { const g = /coarse/.test(p.type) ? 3 : /medium/.test(p.type) ? 2 : 1; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const gx = Math.floor(x / g), gy = Math.floor(y / g); noise[y * w + x] = ((gx * 73856093 ^ gy * 19349663 ^ p.seed * 83492791) >>> 0) % 1000 / 1000; } }
    for (let i = 0; i < w * h; i++) { for (let c = 0; c < 3; c++) out[i * 4 + c] = s[i * 4 + c] / 255 > noise[i] ? 255 : 0; out[i * 4 + 3] = s[i * 4 + 3]; }
    return out;
  }

  /* ---------------- Render ---------------- */
  function lighting(s, w, h, p, ctx) {
    const { ox, oy, W, H } = ctxOf(ctx, w, h), n = w * h, Hf = new Float32Array(n);
    for (let i = 0; i < n; i++) Hf[i] = p.texture === "transparency" ? s[i * 4 + 3] / 255 : p.texture === "brightness" ? luma(s[i * 4], s[i * 4 + 1], s[i * 4 + 2]) / 255 : 0;
    const Nm = heightNormals(Hf, w, h, p.height / 10), col = hex3(p.color).map((v) => v / 255), I = p.intensity / 50, amb = p.ambience / 100, gloss = p.gloss;
    const lx = p.x / 100 * W - ox, ly = p.y / 100 * H - oy, lz = Math.max(W, H) * p.z / 100, spot = Math.cos(p.angle * Math.PI / 180), hot = Math.cos(p.angle * Math.PI / 180 * (1 - p.hotspot / 100));
    const tx = p.tx / 100 * W - ox, ty = p.ty / 100 * H - oy, ax = tx - lx, ay = ty - ly, aL = Math.hypot(ax, ay, lz) || 1;
    const out = new Uint8ClampedArray(s.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let vx, vy, vz, att = 1;
      if (p.style === "infinite") { const a = Math.atan2(ty - ly, tx - lx); vx = -Math.cos(a) * 0.7; vy = -Math.sin(a) * 0.7; vz = 0.7; }   // from the light towards where it aims
      else { vx = lx - x; vy = ly - y; vz = lz; const L = Math.hypot(vx, vy, vz); vx /= L; vy /= L; vz /= L; att = Math.min(1.5, (Math.max(W, H) * 0.9) / (L + 1));
        if (p.style === "spot") { const cos = (-(vx) * ax / aL + -(vy) * ay / aL + -(vz) * -lz / aL); att *= cos <= spot ? 0 : cos >= hot ? 1 : (cos - spot) / (hot - spot || 1); } }
      const nx = Nm[i * 3], ny = Nm[i * 3 + 1], nz = Nm[i * 3 + 2], dif = Math.max(0, nx * vx + ny * vy + nz * vz), hz = vz + 1, hl = Math.hypot(vx, vy, hz), spec = Math.pow(Math.max(0, (nx * vx + ny * vy + nz * hz) / hl), 4 + gloss) * (gloss / 100);
      for (let c = 0; c < 3; c++) out[i * 4 + c] = s[i * 4 + c] * (amb + I * att * dif * col[c]) + 255 * spec * att * col[c];
      out[i * 4 + 3] = s[i * 4 + 3];
    }
    return out;
  }
  function fibers(s, w, h, p) {
    const rnd = rng(p.seed), a = hex3(p.fg), b = hex3(p.bg), out = new Uint8ClampedArray(s.length), col = new Float32Array(w), noise = new Float32Array(w * h);
    for (let x = 0; x < w; x++) col[x] = rnd();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (rnd() < p.strength / 400) col[x] = col[x] * 0.5 + rnd() * 0.5; noise[y * w + x] = col[x]; }
    const sm = FX.gaussPlanes([noise], w, h, Math.max(0.5, (64 - p.variance) / 32))[0];
    for (let i = 0; i < w * h; i++) { const t = Math.max(0, Math.min(1, sm[i])); for (let c = 0; c < 3; c++) out[i * 4 + c] = a[c] + (b[c] - a[c]) * t; out[i * 4 + 3] = 255; }
    return out;
  }
  function diffClouds(s, w, h, p) {
    const cl = FX.run("clouds", s, w, h, { c1: p.c1, c2: p.c2, seed: p.seed, scale: p.scale }), out = new Uint8ClampedArray(s.length);
    for (let i = 0; i < s.length; i += 4) { for (let c = 0; c < 3; c++) out[i + c] = Math.abs(s[i + c] - cl[i + c]); out[i + 3] = s[i + 3]; }
    return out;
  }

  /* ---------------- Stylize ---------------- */
  function diffuse(s, w, h, p) {
    const rnd = rng(5), out = new Uint8ClampedArray(s.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; let dx = Math.round((rnd() - 0.5) * 4), dy = Math.round((rnd() - 0.5) * 4);
      if (p.mode === "anisotropic") { const xr = Math.min(w - 1, x + 1), yd = Math.min(h - 1, y + 1), gx = luma(s[(y * w + xr) * 4], s[(y * w + xr) * 4 + 1], s[(y * w + xr) * 4 + 2]) - luma(s[i], s[i + 1], s[i + 2]), gy = luma(s[(yd * w + x) * 4], s[(yd * w + x) * 4 + 1], s[(yd * w + x) * 4 + 2]) - luma(s[i], s[i + 1], s[i + 2]); if (Math.abs(gx) > Math.abs(gy)) dx = 0; else dy = 0; }
      const j = (Math.max(0, Math.min(h - 1, y + dy)) * w + Math.max(0, Math.min(w - 1, x + dx))) * 4;
      const Lj = luma(s[j], s[j + 1], s[j + 2]), Li = luma(s[i], s[i + 1], s[i + 2]);
      const take = p.mode === "darken only" ? Lj < Li : p.mode === "lighten only" ? Lj > Li : true;
      for (let c = 0; c < 4; c++) out[i + c] = take ? s[j + c] : s[i + c];
    }
    return out;
  }
  function tiles(s, w, h, p) {
    const n = Math.max(1, Math.round(p.count)), size = Math.max(2, Math.floor(Math.min(w, h) / n)), rnd = rng(p.seed), out = new Uint8ClampedArray(s.length);
    const bgc = hex3(p.fillColor);
    for (let i = 0; i < s.length; i += 4) {
      if (p.fill === "unaltered image") { for (let c = 0; c < 4; c++) out[i + c] = s[i + c]; }
      else if (p.fill === "inverse image") { for (let c = 0; c < 3; c++) out[i + c] = 255 - s[i + c]; out[i + 3] = s[i + 3]; }
      else { out[i] = bgc[0]; out[i + 1] = bgc[1]; out[i + 2] = bgc[2]; out[i + 3] = 255; }
    }
    const mo = size * p.offset / 100;
    for (let ty = 0; ty < h; ty += size) for (let tx = 0; tx < w; tx += size) {
      const dx = Math.round((rnd() - 0.5) * 2 * mo), dy = Math.round((rnd() - 0.5) * 2 * mo);
      for (let y = ty; y < Math.min(h, ty + size); y++) for (let x = tx; x < Math.min(w, tx + size); x++) {
        const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const i = (y * w + x) * 4, j = (Y * w + X) * 4; for (let c = 0; c < 4; c++) out[j + c] = s[i + c];
      }
    }
    return out;
  }
  function traceContour(s, w, h, p) {          // a line where a channel crosses the level: on its upper or lower side
    const out = new Uint8ClampedArray(s.length), L = p.level, up = p.edge === "upper";
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].filter(([xx, yy]) => xx >= 0 && yy >= 0 && xx < w && yy < h).map(([xx, yy]) => (yy * w + xx) * 4);
      for (let c = 0; c < 3; c++) {
        const a = s[i + c], on = up ? a > L && nb.some((j) => s[j + c] <= L) : a <= L && nb.some((j) => s[j + c] > L);
        out[i + c] = on ? 0 : 255;
      }
      out[i + 3] = s[i + 3];
    }
    return out;
  }

  /* ---------------- Artistic / Sketch / Texture ---------------- */
  function posterizeTo(s, levels) { return FX.run("posterize", s, 1, 1, { levels }); }
  function edgesOf(s, w, h) {
    const E = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const at = (xx, yy) => { const j = (Math.max(0, Math.min(h - 1, yy)) * w + Math.max(0, Math.min(w - 1, xx))) * 4; return luma(s[j], s[j + 1], s[j + 2]); };
      const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
      const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
      E[y * w + x] = Math.hypot(gx, gy) / 4;
    }
    return E;
  }
  function cutout(s, w, h, p) {
    const sm = F3.surface(s, w, h, Math.max(1, Math.round((10 - p.simplicity) / 2 + 1 + p.simplicity / 2)), 20 + p.simplicity * 6);
    return posterizeTo(sm, Math.max(2, Math.round(p.levels)));
  }
  function posterEdges(s, w, h, p) {
    const ps = posterizeTo(s, Math.max(2, Math.round(p.posterization + 1))), E = edgesOf(F3.surface(s, w, h, 1, 30), w, h), thr = 60 - p.thickness * 5, out = new Uint8ClampedArray(s.length), k = p.intensity / 10;
    for (let i = 0; i < w * h; i++) { const dark = Math.max(0, Math.min(1, (E[i] - thr) / 30 * k)); for (let c = 0; c < 3; c++) out[i * 4 + c] = ps[i * 4 + c] * (1 - dark); out[i * 4 + 3] = s[i * 4 + 3]; }
    return out;
  }
  function watercolor(s, w, h, p) {
    const sm = F3.surface(s, w, h, Math.round(16 - p.detail), 40), E = edgesOf(sm, w, h), rnd = rng(13), out = new Uint8ClampedArray(s.length), sh = p.shadow / 10;
    for (let i = 0; i < w * h; i++) { const d = Math.min(1, E[i] / 60) * sh * 0.6, t = 1 + (rnd() - 0.5) * p.texture * 0.04; for (let c = 0; c < 3; c++) out[i * 4 + c] = sm[i * 4 + c] * (1 - d) * t; out[i * 4 + 3] = s[i * 4 + 3]; }
    return out;
  }
  function dryBrush(s, w, h, p) {
    const o = FX.run("oil", s, w, h, { radius: Math.max(1, Math.round(p.size)) }), ps = posterizeTo(o, Math.max(4, Math.round(4 + p.detail))), rnd = rng(21), out = new Uint8ClampedArray(s.length);
    for (let i = 0; i < w * h; i++) { const t = 1 + (rnd() - 0.5) * p.texture * 0.08; for (let c = 0; c < 3; c++) out[i * 4 + c] = ps[i * 4 + c] * t; out[i * 4 + 3] = s[i * 4 + 3]; }
    return out;
  }
  function graphicPen(s, w, h, p) {
    const a = p.direction === "right diagonal" ? -1 : p.direction === "horizontal" ? 0 : p.direction === "vertical" ? 2 : 1, rnd = rng(31), n = w * h, noise = new Float32Array(n), len = Math.max(1, Math.round(p.length));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = a === 0 ? y : a === 2 ? x : a === 1 ? x - y : x + y, seg = Math.floor((a === 0 ? x : a === 2 ? y : y) / len);
      noise[y * w + x] = (((k * 2654435761) ^ (seg * 40503)) >>> 0) % 997 / 997 * 0.85 + rnd() * 0.15;
    }
    const ink = hex3(p.ink), paper = hex3(p.paper), out = new Uint8ClampedArray(s.length), bal = p.balance / 100;
    for (let i = 0; i < n; i++) { const L = luma(s[i * 4], s[i * 4 + 1], s[i * 4 + 2]) / 255, on = (1 - L) * (0.5 + bal) > noise[i]; for (let c = 0; c < 3; c++) out[i * 4 + c] = on ? ink[c] : paper[c]; out[i * 4 + 3] = s[i * 4 + 3]; }
    return out;
  }
  function charcoal(s, w, h, p) {
    const sm = FX.gaussian(s, w, h, Math.max(0.5, p.thickness / 2)), E = edgesOf(sm, w, h), rnd = rng(41), out = new Uint8ClampedArray(s.length), ink = hex3(p.ink), paper = hex3(p.paper), bal = p.balance / 100;
    for (let i = 0; i < w * h; i++) {
      const L = luma(sm[i * 4], sm[i * 4 + 1], sm[i * 4 + 2]) / 255, dark = Math.max(Math.min(1, E[i] / (80 - p.detail * 5)), (1 - L) * bal * 1.4 > 0.5 + (rnd() - 0.5) * 0.6 ? 0.8 : 0);
      for (let c = 0; c < 3; c++) out[i * 4 + c] = paper[c] + (ink[c] - paper[c]) * dark;
      out[i * 4 + 3] = s[i * 4 + 3];
    }
    return out;
  }
  function grain(s, w, h, p) {
    const rnd = rng(51), out = new Uint8ClampedArray(s.length), k = p.intensity / 100 * 255, ct = 1 + p.contrast / 100, t = p.type;
    const lineV = new Float32Array(w), lineH = new Float32Array(h); for (let x = 0; x < w; x++) lineV[x] = rnd() - 0.5; for (let y = 0; y < h; y++) lineH[y] = rnd() - 0.5;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; let nz = rnd() - 0.5;
      if (t === "soft") nz *= 0.5; else if (t === "sprinkles") nz = rnd() < 0.06 ? (rnd() < 0.5 ? -1 : 1) : 0; else if (t === "clumped") nz = ((((x >> 1) * 73856093) ^ ((y >> 1) * 19349663)) >>> 0) % 1000 / 1000 - 0.5;
      else if (t === "horizontal") nz = lineH[y]; else if (t === "vertical") nz = lineV[x]; else if (t === "speckle") nz = rnd() < 0.15 ? rnd() - 0.5 : 0;
      for (let c = 0; c < 3; c++) out[i + c] = (s[i + c] - 128) * ct + 128 + nz * k;
      out[i + 3] = s[i + 3];
    }
    return out;
  }
  function craquelure(s, w, h, p) {
    const V = voronoi(w, h, Math.max(4, p.spacing), 61), Hf = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) Hf[i] = Math.min(1, V.edge[i] / 2);
    const Nm = heightNormals(Hf, w, h, p.depth / 2), out = new Uint8ClampedArray(s.length), br = p.brightness / 10;
    for (let i = 0; i < w * h; i++) { const lit = Math.max(0, Nm[i * 3] * -0.5 + Nm[i * 3 + 1] * -0.5 + Nm[i * 3 + 2] * 0.7) * (0.6 + br * 0.08); for (let c = 0; c < 3; c++) out[i * 4 + c] = s[i * 4 + c] * lit * 1.25; out[i * 4 + 3] = s[i * 4 + 3]; }
    return out;
  }

  const FILTERS4 = [
    // Distort
    { id: "displace", sub: "Distort", name: "Displace", params: [{ id: "map", label: "Displacement map", type: "layerpick", def: "merged" }, N("hscale", "Horizontal scale (%)", -999, 999, 1, 10), N("vscale", "Vertical scale (%)", -999, 999, 1, 10),
        SEL("fit", "Map", ["stretch to fit", "tile"], "stretch to fit"), SEL("undefined", "Undefined areas", ["wrap around", "repeat edge pixels"], "repeat edge pixels")], pad: (p) => Math.ceil(Math.max(Math.abs(p.hscale), Math.abs(p.vscale)) * 1.3), apply: displace },
    { id: "polar", sub: "Distort", name: "Polar Coordinates", params: [SEL("mode", "Mode", ["rectangular to polar", "polar to rectangular"], "rectangular to polar")], apply: polar },
    { id: "pinch", sub: "Distort", name: "Pinch", params: [N("amount", "Amount (%)", -100, 100, 1, 50)], apply: pinch },
    { id: "zigzag", sub: "Distort", name: "ZigZag", params: [N("amount", "Amount", -100, 100, 1, 10), N("ridges", "Ridges", 0, 20, 1, 5), SEL("style", "Style", ["pond ripples", "out from center", "around center"], "pond ripples")], apply: zigzag },
    { id: "shear", sub: "Distort", name: "Shear", params: [N("top", "Top (px)", -2000, 2000, 1, 0), N("middle", "Middle (px)", -2000, 2000, 1, 40), N("bottom", "Bottom (px)", -2000, 2000, 1, 0), SEL("undefined", "Undefined areas", ["wrap around", "repeat edge pixels"], "wrap around")], apply: shear },
    { id: "glass", sub: "Distort", name: "Glass", params: [N("distortion", "Distortion", 0, 20, 1, 5), N("smoothness", "Smoothness", 1, 15, 1, 3), SEL("texture", "Texture", ["frosted", "blocks", "canvas", "tiny lens"], "frosted"), N("scaling", "Scaling (%)", 50, 200, 1, 100)],
      pad: (p) => p.distortion * 2 + p.smoothness, apply: glass },
    // Pixelate
    { id: "colorhalftone", sub: "Pixelate", name: "Color Halftone", params: [N("radius", "Max. radius (px)", 4, 127, 1, 8), N("c", "Cyan angle (°)", -360, 360, 1, 108), N("m", "Magenta angle (°)", -360, 360, 1, 162), N("y", "Yellow angle (°)", -360, 360, 1, 90), N("k", "Black angle (°)", -360, 360, 1, 45)],
      pad: (p) => p.radius * 2, apply: colorHalftone },
    { id: "crystallize", sub: "Pixelate", name: "Crystallize", params: [N("cell", "Cell size (px)", 3, 300, 1, 10), N("seed", "Seed", 1, 9999, 1, 3)], pad: (p) => p.cell * 2, apply: crystallize },
    { id: "pointillize", sub: "Pixelate", name: "Pointillize", params: [N("cell", "Cell size (px)", 3, 300, 1, 6), COL("background", "Background colour", "#ffffff"), N("seed", "Seed", 1, 9999, 1, 3)], pad: (p) => p.cell * 2, apply: pointillize },
    { id: "facet", sub: "Pixelate", name: "Facet", params: [], pad: () => 3, apply: facet },
    { id: "fragment", sub: "Pixelate", name: "Fragment", params: [], pad: () => 4, apply: fragment },
    { id: "mezzotint", sub: "Pixelate", name: "Mezzotint", params: [SEL("type", "Type", ["fine dots", "medium dots", "coarse dots", "short lines", "medium lines", "long lines", "short strokes", "medium strokes", "long strokes"], "medium dots"), N("seed", "Seed", 1, 9999, 1, 7)], apply: mezzotint },
    // Render
    { id: "lighting", sub: "Render", name: "Lighting Effects", params: [SEL("style", "Light", ["spot", "point", "infinite"], "spot"), COL("color", "Colour", "#ffffff"), N("intensity", "Intensity", 0, 100, 1, 35),
        N("x", "Light x (%)", -50, 150, 1, 30), N("y", "Light y (%)", -50, 150, 1, 25), N("z", "Height (% of the size)", 1, 200, 1, 40), N("tx", "Aimed at x (%)", 0, 100, 1, 55), N("ty", "Aimed at y (%)", 0, 100, 1, 60),
        N("angle", "Spot cone (°)", 5, 89, 1, 35), N("hotspot", "Hotspot (%)", 0, 100, 1, 50), N("ambience", "Ambience (%)", 0, 100, 1, 25), N("gloss", "Gloss", 0, 100, 1, 20),
        SEL("texture", "Texture (height from)", ["none", "brightness", "transparency"], "none"), N("height", "Texture height", 0, 100, 1, 30)], apply: lighting },
    { id: "fibers", sub: "Render", name: "Fibers (foreground → background)", params: [COL("fg", "Foreground", "#000000"), COL("bg", "Background", "#ffffff"), N("variance", "Variance", 1, 64, 1, 16), N("strength", "Strength", 1, 64, 1, 4), N("seed", "Seed", 1, 9999, 1, 1)], apply: fibers },
    { id: "diffclouds", sub: "Render", name: "Difference Clouds", params: [COL("c1", "Foreground", "#000000"), COL("c2", "Background", "#ffffff"), N("scale", "Scale (px)", 8, 1024, 1, 160), N("seed", "Seed", 1, 9999, 1, 7)], apply: diffClouds },
    // Stylize
    { id: "diffuse", sub: "Stylize", name: "Diffuse", params: [SEL("mode", "Mode", ["normal", "darken only", "lighten only", "anisotropic"], "normal")], pad: () => 2, apply: diffuse },
    { id: "tiles", sub: "Stylize", name: "Tiles", params: [N("count", "Number of tiles (across the short side)", 1, 99, 1, 10), N("offset", "Maximum offset (%)", 1, 99, 1, 10), SEL("fill", "Fill empty area with", ["background colour", "inverse image", "unaltered image"], "background colour"), COL("fillColor", "Colour", "#ffffff"), N("seed", "Seed", 1, 9999, 1, 2)], apply: tiles },
    { id: "tracecontour", sub: "Stylize", name: "Trace Contour", params: [N("level", "Level", 0, 255, 1, 128), SEL("edge", "Edge", ["lower", "upper"], "upper")], pad: () => 1, apply: traceContour },
    // Artistic
    { id: "cutout", sub: "Artistic", name: "Cutout", params: [N("levels", "Number of levels", 2, 8, 1, 4), N("simplicity", "Edge simplicity", 0, 10, 1, 4)], pad: () => 10, apply: cutout },
    { id: "posteredges", sub: "Artistic", name: "Poster Edges", params: [N("thickness", "Edge thickness", 0, 10, 1, 2), N("intensity", "Edge intensity", 0, 10, 1, 1), N("posterization", "Posterization", 0, 6, 1, 2)], pad: () => 2, apply: posterEdges },
    { id: "watercolor", sub: "Artistic", name: "Watercolor", params: [N("detail", "Brush detail", 1, 14, 1, 9), N("shadow", "Shadow intensity", 0, 10, 1, 1), N("texture", "Texture", 1, 3, 1, 1)], pad: () => 15, apply: watercolor },
    { id: "drybrush", sub: "Artistic", name: "Dry Brush", params: [N("size", "Brush size", 0, 10, 1, 2), N("detail", "Brush detail", 0, 10, 1, 8), N("texture", "Texture", 1, 3, 1, 1)], pad: (p) => p.size * 2 + 1, apply: dryBrush },
    // Sketch
    { id: "graphicpen", sub: "Sketch", name: "Graphic Pen", params: [N("length", "Stroke length", 1, 15, 1, 15), N("balance", "Light / dark balance", 0, 100, 1, 50), SEL("direction", "Stroke direction", ["right diagonal", "horizontal", "left diagonal", "vertical"], "right diagonal"), COL("ink", "Ink", "#000000"), COL("paper", "Paper", "#ffffff")], apply: graphicPen },
    { id: "charcoal", sub: "Sketch", name: "Charcoal", params: [N("thickness", "Charcoal thickness", 1, 7, 1, 1), N("detail", "Detail", 0, 5, 1, 5), N("balance", "Light / dark balance", 0, 100, 1, 50), COL("ink", "Charcoal", "#000000"), COL("paper", "Paper", "#ffffff")], pad: (p) => p.thickness + 2, apply: charcoal },
    // Texture
    { id: "grain", sub: "Texture", name: "Grain", params: [N("intensity", "Intensity", 0, 100, 1, 40), N("contrast", "Contrast", 0, 100, 1, 50), SEL("type", "Grain type", ["regular", "soft", "sprinkles", "clumped", "horizontal", "vertical", "speckle"], "regular")], apply: grain },
    { id: "craquelure", sub: "Texture", name: "Craquelure", params: [N("spacing", "Crack spacing", 2, 100, 1, 15), N("depth", "Crack depth", 0, 10, 1, 6), N("brightness", "Crack brightness", 0, 10, 1, 9)], pad: (p) => p.spacing, apply: craquelure },
  ].map((f) => Object.assign({ group: "Filters" }, f));

  function register(fx) {
    if (!fx || fx.__filters4) return;
    fx.__filters4 = true;
    for (const f of FILTERS4) if (!fx.byId(f.id)) fx.FILTERS.push(f);
  }
  const api = { FILTERS4, register, warp, voronoi, heightNormals, edgesOf };
  if (isNode) module.exports = api;
  else { root.IEFilters4 = api; register(root.IEFilters); }
})(typeof window !== "undefined" ? window : globalThis);
