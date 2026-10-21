/* pcdraw.js — CORELDRAW'S OTHER DRAWING TOOLS IN THE IMAGE EDITOR (2.428.0), window.PCDraw.
 *
 * Tim (verbatim, with the 2.425.0 plan): "i would like all the drawing tools from coreldraw and the tool dockers" - the
 * agreed order: after Actions, "the rest of CorelDRAW's drawing tools (3-point rectangle / ellipse, star, spiral, graph
 * paper, common shapes, dimension and connector tools, Artistic Media)". Everything draws a VECTOR LINE layer
 * (pcvline.js / pcbezier.js: the outline pen, the fill, F10 / F12 / Ctrl+Q all work on it):
 *
 *   F6   THE SHAPE TOOLS (F6 again = the next): Rectangle (corners: round / scallop / chamfer, each corner's radius),
 *        3-Point Rectangle (drag a side, click its height - at any angle), Ellipse (ellipse / pie / arc, start and end
 *        angles), 3-Point Ellipse, Polygon (sides), Star (points, sharpness), Complex Star (points, sharpness - its
 *        middle open), Spiral (revolutions, symmetric / logarithmic, expansion), Graph Paper (columns x rows), Common
 *        Shapes (basic shapes, arrows, flowchart, banners, callouts). Ctrl = square / circle, Shift = from the centre.
 *        They stay LIVE (L.shape.gen): the property bar changes them until F10 edits a node or Ctrl+Q converts them.
 *   F5   + ARTISTIC MEDIA: Preset (taper, teardrop, flare, uniform), Calligraphic (nib width and angle), Pressure (the
 *        pen's pressure, or the speed with a mouse), Sprayer (stars, dots, leaves, hearts, bubbles, confetti along the
 *        stroke) - a filled outline kept live round its stroke (L.shape.media).
 *   F8   DIMENSIONS AND CONNECTORS: Parallel Dimension, Horizontal / Vertical Dimension, Angular Dimension (two clicks
 *        for the line / arms, a third for where the dimension sits), 3-Point Callout (point, elbow, end + its text);
 *        units px / mm / cm / in (at a dpi), decimals, text size. Connector (straight / right-angle / rounded
 *        right-angle): drag from one object to another - it snaps to their sides' middles or centres and FOLLOWS them
 *        when they move.
 *
 * The geometry is pure (Node: scripts/test-psdraw.js): rectPath, ellipsePath, polygonPath, starPath, cstarPath,
 * spiralPath, graphPath, COMMON + commonPath, genPath (+ frames), rect3 / ellipse3 frames, mediaOutline, sprayItems,
 * dimParallel, dimAngular, callout, anchorsOf, route.
 */
(function (root) {
  "use strict";
  const Q = (typeof module !== "undefined" && module.exports) ? require("./pcpath.js") : root.PCPath;
  const A = (x, y, ix, iy, ox, oy, sm) => Q.anchor(x, y, ix, iy, ox, oy, sm);
  const K = 0.5522847498;
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rot = (x, y, cx, cy, a) => { const c = Math.cos(a), s = Math.sin(a); return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]; };
  /** a path made in an unturned box, turned by `a` about the box's centre */
  function turned(p, f) { if (!f.rot) return p; const c = Math.cos(f.rot), s = Math.sin(f.rot); return Q.transform(p, [c, s, -s, c, f.cx - c * f.cx + s * f.cy, f.cy - s * f.cx - c * f.cy]); }
  const boxOf = (f) => ({ x: f.cx - f.w / 2, y: f.cy - f.h / 2, w: f.w, h: f.h });

  /* ================================ the shapes (in a frame {cx, cy, w, h, rot}) ================================ */
  /** Rectangle: corners [tl, tr, br, bl] px, style round | scallop | chamfer */
  function rectPath(f, corners, style) {
    const { x, y, w, h } = boxOf(f), m = Math.min(w, h) / 2;
    const r = (corners || [0, 0, 0, 0]).map((v) => clamp(+v || 0, 0, m));
    const st = style || "round";
    const pts = [];
    // clockwise from the top-left: corner(cx, cy, r, the direction to the side we arrive on ... ) - written per corner
    const tl = r[0], tr = r[1], br = r[2], bl = r[3];
    // top-left: arrive from the left side (going up) at (x, y + tl), leave along the top at (x + tl, y)
    const C = (px, py, rr, inDir, outDir) => {
      if (rr <= 0) { pts.push(A(px, py)); return; }
      const p1 = [px + inDir[0] * rr, py + inDir[1] * rr], p2 = [px + outDir[0] * rr, py + outDir[1] * rr];
      if (st === "chamfer") { pts.push(A(p1[0], p1[1]), A(p2[0], p2[1])); return; }
      if (st === "scallop") { pts.push(A(p1[0], p1[1], p1[0], p1[1], p1[0] + outDir[0] * rr * K - inDir[0] * 0, p1[1] + outDir[1] * rr * K), A(p2[0], p2[1], p2[0] + inDir[0] * rr * K, p2[1] + inDir[1] * rr * K, p2[0], p2[1])); return; }
      pts.push(A(p1[0], p1[1], p1[0], p1[1], p1[0] - inDir[0] * rr * K, p1[1] - inDir[1] * rr * K), A(p2[0], p2[1], p2[0] - outDir[0] * rr * K, p2[1] - outDir[1] * rr * K, p2[0], p2[1]));
    };
    C(x, y, tl, [0, 1], [1, 0]); C(x + w, y, tr, [-1, 0], [0, 1]); C(x + w, y + h, br, [0, -1], [-1, 0]); C(x, y + h, bl, [1, 0], [0, -1]);
    return turned({ subs: [{ closed: true, op: "add", pts }] }, f);
  }
  /** a circular / elliptic arc from a0 to a1 (radians, y down = clockwise) as Bézier anchors (the first included) */
  function arcPts(cx, cy, rx, ry, a0, a1) {
    const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 2) - 1e-9)), d = (a1 - a0) / n, k = 4 / 3 * Math.tan(d / 4), out = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + d * i, c = Math.cos(a), s = Math.sin(a), x = cx + rx * c, y = cy + ry * s;
      const tx = -rx * s * k, ty = ry * c * k;
      out.push(A(x, y, i > 0 ? x - tx : x, i > 0 ? y - ty : y, i < n ? x + tx : x, i < n ? y + ty : y, i > 0 && i < n));
    }
    return out;
  }
  /** Ellipse: kind ellipse | pie | arc, start / end in degrees (0 = 3 o'clock, counter-clockwise like CorelDRAW) */
  function ellipsePath(f, kind, start, end) {
    const rx = f.w / 2, ry = f.h / 2;
    if (!kind || kind === "ellipse") return turned({ subs: [Q.ellipseSub(f.cx, f.cy, rx, ry, "add")] }, f);
    let a0 = -(+start || 0) * Math.PI / 180, a1 = -(+end || 270) * Math.PI / 180;
    while (a1 >= a0) a1 -= Math.PI * 2;                                   // counter-clockwise on screen = decreasing angle (y down)
    const pts = arcPts(f.cx, f.cy, rx, ry, a0, a1);
    if (kind === "pie") { pts.push(A(f.cx, f.cy)); return turned({ subs: [{ closed: true, op: "add", pts }] }, f); }
    return turned({ subs: [{ closed: false, op: "add", pts }] }, f);
  }
  const ring = (f, n, off, rr) => { const out = []; for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + off + i * 2 * Math.PI / n; out.push([f.cx + Math.cos(a) * f.w / 2 * rr, f.cy + Math.sin(a) * f.h / 2 * rr]); } return out; };
  const poly = (pts, closed) => ({ closed: closed !== false, op: "add", pts: pts.map(([x, y]) => A(r3(x), r3(y))) });
  function polygonPath(f, sides) { const n = clamp(Math.round(+sides || 5), 3, 500); return turned({ subs: [poly(ring(f, n, 0, 1))] }, f); }
  /** Star: points, sharpness 1..99 (the inner corners pulled in) */
  function starPath(f, points, sharp) {
    const n = clamp(Math.round(+points || 5), 3, 500), ir = clamp(1 - (+sharp || 53) / 100, 0.01, 0.99) * 0.95 + 0.02, out = [];
    const o = ring(f, n, 0, 1), i2 = ring(f, n, Math.PI / n, ir);
    for (let i = 0; i < n; i++) out.push(o[i], i2[i]);
    return turned({ subs: [poly(out)] }, f);
  }
  /** Complex Star {n / k}: every k-th point joined (k = sharpness, 1 .. (n - 1) / 2) - drawn even-odd, its middle open */
  function cstarPath(f, points, sharp) {
    const n = clamp(Math.round(+points || 9), 5, 500), kMax = Math.floor((n - 1) / 2), k = clamp(Math.round(+sharp || 2), 1, Math.max(1, kMax));
    const v = ring(f, n, 0, 1), subs = [], seen = new Set();
    for (let s0 = 0; s0 < n; s0++) {
      if (seen.has(s0)) continue;
      const pts = []; let i = s0;
      do { seen.add(i); pts.push(v[i]); i = (i + k) % n; } while (i !== s0);
      if (pts.length >= 3) subs.push(poly(pts));
    }
    return turned({ subs }, f);
  }
  /** Spiral: revolutions, symmetric (even spacing) or logarithmic (expansion 1..100 - each turn wider) */
  function spiralPath(f, revs, type, expansion) {
    const R = clamp(+revs || 4, 0.25, 100), steps = Math.ceil(R * 48), T = R * 2 * Math.PI, pts = [];
    const e = clamp(+expansion || 50, 1, 100), kk = Math.log(1 + e / 8) / (2 * Math.PI);
    for (let i = 0; i <= steps; i++) {
      const t = T * i / steps;
      const r = type === "log" ? (Math.exp(kk * t) - 1) / (Math.exp(kk * T) - 1) : t / T;
      pts.push([f.cx + Math.cos(t - Math.PI / 2) * r * f.w / 2, f.cy + Math.sin(t - Math.PI / 2) * r * f.h / 2]);
    }
    const sub = Q.fromPolygon(pts, false, Math.max(0.15, Math.min(f.w, f.h) / 800), 70);
    return turned({ subs: [sub] }, f);
  }
  /** Graph Paper: columns x rows of cells */
  function graphPath(f, cols, rows) {
    const c = clamp(Math.round(+cols || 4), 1, 100), r = clamp(Math.round(+rows || 3), 1, 100), { x, y, w, h } = boxOf(f), subs = [];
    for (let j = 0; j < r; j++) for (let i = 0; i < c; i++) {
      const x0 = x + w * i / c, x1 = x + w * (i + 1) / c, y0 = y + h * j / r, y1 = y + h * (j + 1) / r;
      subs.push(poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]));
    }
    return turned({ subs }, f);
  }
  // Common Shapes - each in a 100 x 100 box (simple geometry of ours), grouped as CorelDRAW groups them
  const COMMON = [
    ["basic", "parallelogram", "Parallelogram", "M25 0 L100 0 L75 100 L0 100 Z"],
    ["basic", "trapezoid", "Trapezoid", "M25 0 L75 0 L100 100 L0 100 Z"],
    ["basic", "diamond", "Diamond", "M50 0 L100 50 L50 100 L0 50 Z"],
    ["basic", "hexagon", "Hexagon", "M25 0 L75 0 L100 50 L75 100 L25 100 L0 50 Z"],
    ["basic", "octagon", "Octagon", "M30 0 L70 0 L100 30 L100 70 L70 100 L30 100 L0 70 L0 30 Z"],
    ["basic", "cross", "Cross", "M35 0 L65 0 L65 35 L100 35 L100 65 L65 65 L65 100 L35 100 L35 65 L0 65 L0 35 L35 35 Z"],
    ["basic", "heart", "Heart", "custom:heart"],
    ["basic", "bolt", "Lightning", "custom:bolt"],
    ["basic", "moon", "Moon", "custom:moon"],
    ["basic", "cube", "Cube", "M0 25 L25 0 L100 0 L100 75 L75 100 L0 100 Z M0 25 L75 25 L100 0 M75 25 L75 100"],
    ["basic", "can", "Cylinder", "M0 15 C0 -5 100 -5 100 15 L100 85 C100 105 0 105 0 85 Z"],
    ["arrows", "arrowR", "Right Arrow", "M0 30 L60 30 L60 5 L100 50 L60 95 L60 70 L0 70 Z"],
    ["arrows", "arrowLR", "Left-Right Arrow", "M0 50 L25 15 L25 35 L75 35 L75 15 L100 50 L75 85 L75 65 L25 65 L25 85 Z"],
    ["arrows", "arrowUD", "Up-Down Arrow", "M50 0 L85 25 L65 25 L65 75 L85 75 L50 100 L15 75 L35 75 L35 25 L15 25 Z"],
    ["arrows", "arrow4", "Four-Way Arrow", "M50 0 L65 15 L57 15 L57 43 L85 43 L85 35 L100 50 L85 65 L85 57 L57 57 L57 85 L65 85 L50 100 L35 85 L43 85 L43 57 L15 57 L15 65 L0 50 L15 35 L15 43 L43 43 L43 15 L35 15 Z"],
    ["arrows", "chevron", "Chevron", "M0 0 L60 0 L100 50 L60 100 L0 100 L40 50 Z"],
    ["arrows", "pentarrow", "Pentagon Arrow", "M0 0 L75 0 L100 50 L75 100 L0 100 Z"],
    ["arrows", "uturn", "U-Turn Arrow", "M10 100 L10 40 C10 10 70 10 70 40 L70 55 L85 55 L60 85 L35 55 L50 55 L50 40 C50 30 30 30 30 40 L30 100 Z"],
    ["flowchart", "process", "Process", "M0 10 L100 10 L100 90 L0 90 Z"],
    ["flowchart", "decision", "Decision", "M50 0 L100 50 L50 100 L0 50 Z"],
    ["flowchart", "terminator", "Terminator", "M25 20 L75 20 C102 20 102 80 75 80 L25 80 C-2 80 -2 20 25 20 Z"],
    ["flowchart", "document", "Document", "M0 0 L100 0 L100 82 C75 70 60 100 30 92 C15 88 8 84 0 86 Z"],
    ["flowchart", "data", "Data", "M20 10 L100 10 L80 90 L0 90 Z"],
    ["flowchart", "predefined", "Predefined Process", "M0 10 L100 10 L100 90 L0 90 Z M12 10 L12 90 M88 10 L88 90"],
    ["flowchart", "manualinput", "Manual Input", "M0 30 L100 0 L100 100 L0 100 Z"],
    ["flowchart", "offpage", "Off-page Connector", "M0 0 L100 0 L100 65 L50 100 L0 65 Z"],
    ["flowchart", "connector", "Connector", "circle"],
    ["banners", "ribbon", "Ribbon", "M0 20 L20 20 L20 0 L80 0 L80 20 L100 20 L88 40 L100 60 L80 60 L80 80 L20 80 L20 60 L0 60 L12 40 Z"],
    ["banners", "wave", "Wave Banner", "M0 15 C25 -5 50 35 100 10 L100 85 C50 110 25 70 0 90 Z"],
    ["banners", "explosion", "Explosion", "M50 0 L60 30 L90 15 L72 42 L100 55 L70 62 L82 95 L55 75 L42 100 L36 70 L5 85 L25 58 L0 40 L30 35 L18 8 L45 25 Z"],
    ["callouts", "rectcallout", "Rectangle Callout", "M0 0 L100 0 L100 70 L45 70 L20 100 L28 70 L0 70 Z"],
    ["callouts", "roundcallout", "Rounded Callout", "custom:bubble"],
    ["callouts", "ovalcallout", "Oval Callout", "M50 0 C78 0 100 16 100 36 C100 56 78 72 50 72 C46 72 42 72 38 71 L18 100 L24 67 C10 61 0 49 0 36 C0 16 22 0 50 0 Z"],
    ["callouts", "cloudcallout", "Cloud Callout", "custom:cloud"],
  ];
  function commonPath(f, id) {
    const def = COMMON.find((c) => c[1] === id) || COMMON[0], d = def[3], b = boxOf(f);
    let p;
    if (d === "circle") p = { subs: [Q.ellipseSub(f.cx, f.cy, f.w / 2, f.h / 2, "add")] };
    else if (/^custom:/.test(d)) p = Q.custom(d.slice(7), b.x, b.y, b.w, b.h);
    else {
      // a d with extra open strokes (the cube's edges, the predefined process' lines): closed parts + plain open parts
      const raw = Q.parseSvg(d), base = Q.bbox({ subs: raw.subs.filter((s) => s.closed) }) || { x: 0, y: 0, w: 100, h: 100 };
      p = Q.fitBox(raw, base, b);
      p.subs.forEach((s) => { if (!s.closed) s.plain = true; });
    }
    return turned(p, f);
  }
  /** a live shape's path: gen = {type, frame, ...its settings} */
  function genPath(gen) {
    const f = gen.frame;
    switch (gen.type) {
      case "rect": return rectPath(f, gen.corners, gen.style);
      case "ellipse": return ellipsePath(f, gen.kind, gen.start, gen.end);
      case "polygon": return polygonPath(f, gen.sides);
      case "star": return starPath(f, gen.points, gen.sharp);
      case "cstar": return cstarPath(f, gen.points, gen.sharp);
      case "spiral": return spiralPath(f, gen.revs, gen.spiral, gen.expansion);
      case "graph": return graphPath(f, gen.cols, gen.rows);
      case "common": return commonPath(f, gen.id);
      default: return Q.empty();
    }
  }
  /** a frame from a drag (x0, y0) -> (x1, y1): Ctrl = square, Shift = from the centre */
  function frameOfDrag(x0, y0, x1, y1, square, centre) {
    let w = x1 - x0, h = y1 - y0;
    if (square) { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
    if (centre) return { cx: x0, cy: y0, w: Math.abs(w) * 2, h: Math.abs(h) * 2, rot: 0 };
    return { cx: x0 + w / 2, cy: y0 + h / 2, w: Math.abs(w), h: Math.abs(h), rot: 0 };
  }
  /** 3-Point Rectangle / Ellipse: the first side p0 -> p1, the height to p2 (its distance from that side, on its side) */
  function frame3(p0, p1, p2) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const hgt = (p2[0] - p0[0]) * nx + (p2[1] - p0[1]) * ny;
    return { cx: (p0[0] + p1[0]) / 2 + nx * hgt / 2, cy: (p0[1] + p1[1]) / 2 + ny * hgt / 2, w: L, h: Math.abs(hgt), rot: Math.atan2(dy, dx) };
  }
  /** the frame a live shape is in now (moved / scaled since by the move tool, crop, Image Size ...: follow its box) */
  function frameNow(gen, path) {
    const own = Q.bbox(genPath(gen)), cur = Q.bbox(path), f = gen.frame;
    if (!own || !cur) return f;
    if (Math.abs(own.x - cur.x) < 0.05 && Math.abs(own.y - cur.y) < 0.05 && Math.abs(own.w - cur.w) < 0.05 && Math.abs(own.h - cur.h) < 0.05) return f;
    const sx = own.w > 1e-6 ? cur.w / own.w : 1, sy = own.h > 1e-6 ? cur.h / own.h : 1;
    return { cx: cur.x + cur.w / 2 + (f.cx - (own.x + own.w / 2)) * sx, cy: cur.y + cur.h / 2 + (f.cy - (own.y + own.h / 2)) * sy, w: f.w * (f.rot ? Math.sqrt(sx * sy) : sx), h: f.h * (f.rot ? Math.sqrt(sx * sy) : sy), rot: f.rot };
  }

  /* ================================ Artistic Media ================================ */
  /** a stroke's points evenly spaced (step px) with their direction */
  function resample(pts, step) {
    const out = []; if (!pts || !pts.length) return out;
    let prev = pts[0], acc = 0; out.push([prev[0], prev[1], pts[0][2]]);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i]; let d = Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      while (acc + d >= step) {
        const t = (step - acc) / d, q = [prev[0] + (p[0] - prev[0]) * t, prev[1] + (p[1] - prev[1]) * t, p[2]];
        out.push(q); prev = q; d = Math.hypot(p[0] - prev[0], p[1] - prev[1]); acc = 0;
      }
      acc += d; prev = p;
    }
    const last = pts[pts.length - 1]; if (Math.hypot(last[0] - out[out.length - 1][0], last[1] - out[out.length - 1][1]) > 0.01) out.push([last[0], last[1], last[2]]);
    return out;
  }
  /** the half-width along the stroke (0..1 of the way) for a preset */
  function profile(preset, t) {
    switch (preset) {
      case "taper": return Math.sin(Math.PI * clamp(t, 0, 1)) * 0.9 + 0.1;
      case "teardrop": return Math.sqrt(Math.max(0, 1 - t)) * (t < 0.08 ? 0.6 + t * 5 : 1);
      case "flare": return 0.15 + 0.85 * t;
      default: return 1;
    }
  }
  /** Artistic Media's filled outline round a stroke: mode preset | calligraphic | pressure; width px; angle (nib, deg);
   *  preset; the stroke's points [[x, y, pressure?] ...] */
  function mediaOutline(pts0, o) {
    const pts = resample(pts0, Math.max(1, (o.width || 10) / 6));
    const n = pts.length; if (n < 2) return null;
    const W = Math.max(0.5, +o.width || 10), nib = (o.angle == null || o.angle === "" ? 45 : +o.angle || 0) * Math.PI / 180, L = [], R = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      let hw;
      if (o.mode === "calligraphic") hw = Math.max(W * 0.06, Math.abs(Math.sin(Math.atan2(dy, dx) - nib)) * W / 2);
      else if (o.mode === "pressure") hw = Math.max(W * 0.05, (p[2] == null ? 0.5 : p[2]) * W / 2);
      else hw = profile(o.preset || "taper", n > 1 ? i / (n - 1) : 0) * W / 2;
      L.push([p[0] - dy * hw, p[1] + dx * hw]); R.push([p[0] + dy * hw, p[1] - dx * hw]);
    }
    // round ends for an even width
    const capPts = (c, from, to) => { const out = []; for (let k = 1; k < 8; k++) { const a = from + (to - from) * k / 8; out.push([c[0] + Math.cos(a) * W / 2, c[1] + Math.sin(a) * W / 2]); } return out; };
    let ring = L.concat(R.reverse());
    if ((o.mode || "preset") === "preset" && (o.preset || "taper") === "uniform") {
      const e = pts[n - 1], s = pts[0], ae = Math.atan2(e[1] - pts[n - 2][1], e[0] - pts[n - 2][0]), as = Math.atan2(pts[1][1] - s[1], pts[1][0] - s[0]);
      ring = L.concat(capPts(e, ae + Math.PI / 2, ae - Math.PI / 2), R, capPts(s, as - Math.PI / 2, as - Math.PI * 1.5));
    }
    const sub = Q.fromPolygon(ring, true, Math.max(0.3, W / 40), 35);
    return { subs: [sub] };
  }
  const SPRAY = { stars: "star5", hearts: "heart", leaves: "drop", dots: "dot", bubbles: "ring", confetti: "rect" };
  /** Sprayer: items along the stroke - every `spacing` px, size ± jitter %, turned along it (rotate) - deterministic */
  function sprayItems(pts0, o) {
    const size = Math.max(2, +o.size || 24), sp = Math.max(2, +o.spacing || size * 1.2), jit = clamp(+o.jitter || 30, 0, 100) / 100, pts = resample(pts0, sp), subs = [];
    let seed = 12345 + Math.round(size * 7 + sp);
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], ang = o.rotate === false ? 0 : Math.atan2(b[1] - a[1], b[0] - a[0]) + (rnd() - 0.5) * jit * 1.5;
      const s = size * (1 + (rnd() - 0.5) * jit), kind = SPRAY[o.item] || "star5";
      let p1;
      if (kind === "dot") p1 = { subs: [Q.ellipseSub(p[0], p[1], s / 2, s / 2, "add")] };
      else if (kind === "rect") p1 = Q.fromShape({ kind: "rect", x: p[0] - s / 2, y: p[1] - s / 4, w: s, h: s / 2 });
      else if (kind === "ring") p1 = { subs: [Q.ellipseSub(p[0], p[1], s / 2, s / 2, "add"), Q.ellipseSub(p[0], p[1], s * 0.32, s * 0.32, "subtract")] };
      else p1 = Q.custom(kind, p[0] - s / 2, p[1] - s / 2, s, s);
      const c = Math.cos(ang), sn = Math.sin(ang);
      p1 = Q.transform(p1, [c, sn, -sn, c, p[0] - c * p[0] + sn * p[1], p[1] - sn * p[0] - c * p[1]]);
      p1.subs.forEach((q, k) => { if (k > 0 && q.op === "add") q.op = "add"; subs.push(q); });
    });
    return { subs };
  }

  /* ================================ dimensions, callouts, connectors ================================ */
  const UNITS = { px: [1, "px"], mm: [25.4, "mm"], cm: [2.54, "cm"], in: [1, "in"] };
  function fmtLen(px, unit, dpi, dec) {
    const u = UNITS[unit] ? unit : "px", d = clamp(Math.round(+dec || 0), 0, 4);
    const v = u === "px" ? px : px / (+dpi || 96) * UNITS[u][0];
    return v.toFixed(d) + " " + UNITS[u][1];
  }
  /** Parallel / Horizontal / Vertical dimension: from p0 to p1, placed at m; how = parallel | horizontal | vertical | auto */
  function dimParallel(p0, p1, m, how, o) {
    let a = [p0[0], p0[1]], b = [p1[0], p1[1]];
    let mode = how || "parallel";
    if (mode === "auto") mode = Math.abs(m[1] - (p0[1] + p1[1]) / 2) > Math.abs(m[0] - (p0[0] + p1[0]) / 2) ? "horizontal" : "vertical";
    let ux, uy;
    if (mode === "horizontal") { ux = Math.sign(b[0] - a[0]) || 1; uy = 0; }
    else if (mode === "vertical") { ux = 0; uy = Math.sign(b[1] - a[1]) || 1; }
    else { const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; ux = (b[0] - a[0]) / L; uy = (b[1] - a[1]) / L; }
    const nx = -uy, ny = ux, len = Math.abs((b[0] - a[0]) * ux + (b[1] - a[1]) * uy);
    // the dimension line through m, parallel to u; extension lines from the points to it (+ a little past)
    const off0 = (m[0] - a[0]) * nx + (m[1] - a[1]) * ny, off1 = (m[0] - b[0]) * nx + (m[1] - b[1]) * ny, ext = Math.sign(off0 || 1) * 6;
    const d0 = [a[0] + nx * off0, a[1] + ny * off0], d1 = [b[0] + nx * off1, b[1] + ny * off1];
    const subs = [
      Object.assign(poly([a, [a[0] + nx * (off0 + ext), a[1] + ny * (off0 + ext)]], false), { plain: true }),
      Object.assign(poly([b, [b[0] + nx * (off1 + ext), b[1] + ny * (off1 + ext)]], false), { plain: true }),
      poly([d0, d1], false)];
    let ang = Math.atan2(d1[1] - d0[1], d1[0] - d0[0]); if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
    const side = off0 >= 0 ? 1 : -1, size = (o && o.size) || 14, mx = (d0[0] + d1[0]) / 2, my = (d0[1] + d1[1]) / 2;
    // the text above the line (outside, away from the measured points)
    const lx = mx + nx * side * 3, ly = my + ny * side * 3;
    const label = { text: (o && o.text) || fmtLen(len, o && o.unit, o && o.dpi, o && o.dec), x: r3(lx), y: r3(ly), angle: r3(ang), size, base: side > 0 === (Math.cos(ang) * ny - Math.sin(ang) * nx > 0) ? "top" : "bottom" };
    return { path: { subs }, label, length: len, mode };
  }
  /** Angular dimension: the vertex c, the arms towards p1 / p2, the arc at radius |m - c| */
  function dimAngular(c, p1, p2, m, o) {
    const a1 = Math.atan2(p1[1] - c[1], p1[0] - c[0]), a2 = Math.atan2(p2[1] - c[1], p2[0] - c[0]), r = Math.max(8, Math.hypot(m[0] - c[0], m[1] - c[1]));
    let d = a2 - a1; while (d <= -Math.PI) d += 2 * Math.PI; while (d > Math.PI) d -= 2 * Math.PI;
    const deg = Math.abs(d) * 180 / Math.PI, arc = arcPts(c[0], c[1], r, r, a1, a1 + d);
    const arm = (a) => Object.assign(poly([c, [c[0] + Math.cos(a) * (r + 6), c[1] + Math.sin(a) * (r + 6)]], false), { plain: true });
    const mid = a1 + d / 2, size = (o && o.size) || 14;
    return { path: { subs: [arm(a1), arm(a2), { closed: false, op: "add", pts: arc }] }, label: { text: deg.toFixed(clamp(Math.round(+((o && o.dec) || 0)), 0, 3)) + "°", x: r3(c[0] + Math.cos(mid) * (r + size)), y: r3(c[1] + Math.sin(mid) * (r + size)), angle: 0, size, base: "middle" }, degrees: deg };
  }
  /** 3-Point Callout: the arrow at p0, the elbow p1, the end p2 - the text past the end */
  function callout(p0, p1, p2, o) {
    const size = (o && o.size) || 14, right = p2[0] >= p1[0];
    return { path: { subs: [poly([p0, p1, p2], false)] }, label: { text: (o && o.text) || "Callout", x: r3(p2[0] + (right ? 6 : -6)), y: r3(p2[1]), angle: 0, size, align: right ? "left" : "right", base: "middle" } };
  }
  /** an object's snap points: the middles of its sides and its centre */
  const anchorsOf = (b) => ({ n: [b.x + b.w / 2, b.y], e: [b.x + b.w, b.y + b.h / 2], s: [b.x + b.w / 2, b.y + b.h], w: [b.x, b.y + b.h / 2], c: [b.x + b.w / 2, b.y + b.h / 2] });
  const DIR = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0], c: [0, 0] };
  /** the nearest snap point of a box to (x, y): [side, point] */
  function nearestAnchor(b, x, y) { let best = null; for (const [k, p] of Object.entries(anchorsOf(b))) { const d = Math.hypot(p[0] - x, p[1] - y); if (!best || d < best[2]) best = [k, p, d]; } return best; }
  /** a connector's line: straight | right (right-angle, out of each side and in) | round (its corners rounded r) */
  function route(a, aSide, b, bSide, kind, r) {
    if (kind !== "right" && kind !== "round") return { subs: [poly([a, b], false)] };
    const da = DIR[aSide] || [0, 0], db = DIR[bSide] || [0, 0], g = 16;
    const a1 = [a[0] + da[0] * g, a[1] + da[1] * g], b1 = [b[0] + db[0] * g, b[1] + db[1] * g];
    const horizA = da[0] !== 0 || (da[0] === 0 && da[1] === 0 && Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]));
    const mid = horizA ? [[(a1[0] + b1[0]) / 2, a1[1]], [(a1[0] + b1[0]) / 2, b1[1]]] : [[a1[0], (a1[1] + b1[1]) / 2], [b1[0], (a1[1] + b1[1]) / 2]];
    let pts = [a, a1, ...mid, b1, b].filter((p, i, arr) => i === 0 || Math.hypot(p[0] - arr[i - 1][0], p[1] - arr[i - 1][1]) > 0.01);
    // drop points on a straight run
    pts = pts.filter((p, i, arr) => i === 0 || i === arr.length - 1 || Math.abs((p[0] - arr[i - 1][0]) * (arr[i + 1][1] - p[1]) - (p[1] - arr[i - 1][1]) * (arr[i + 1][0] - p[0])) > 1e-6);
    if (kind === "right" || pts.length < 3) return { subs: [poly(pts, false)] };
    // rounded: each inner corner cut by rr and bent
    const out = [A(pts[0][0], pts[0][1])];
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i], q0 = pts[i - 1], q1 = pts[i + 1];
      const l0 = Math.hypot(p[0] - q0[0], p[1] - q0[1]), l1 = Math.hypot(q1[0] - p[0], q1[1] - p[1]), rr = Math.min(r || 10, l0 / 2, l1 / 2);
      const u0 = [(p[0] - q0[0]) / l0, (p[1] - q0[1]) / l0], u1 = [(q1[0] - p[0]) / l1, (q1[1] - p[1]) / l1];
      const s = [p[0] - u0[0] * rr, p[1] - u0[1] * rr], e = [p[0] + u1[0] * rr, p[1] + u1[1] * rr];
      out.push(A(s[0], s[1], s[0], s[1], s[0] + u0[0] * rr * K, s[1] + u0[1] * rr * K), A(e[0], e[1], e[0] - u1[0] * rr * K, e[1] - u1[1] * rr * K, e[0], e[1]));
    }
    out.push(A(pts[pts.length - 1][0], pts[pts.length - 1][1]));
    return { subs: [{ closed: false, op: "add", pts: out }] };
  }

  const pure = { rectPath, arcPts, ellipsePath, polygonPath, starPath, cstarPath, spiralPath, graphPath, COMMON, commonPath, genPath, frameOfDrag, frame3, frameNow,
    resample, profile, mediaOutline, SPRAY, sprayItems, UNITS, fmtLen, dimParallel, dimAngular, callout, anchorsOf, nearestAnchor, route };
  if (typeof module !== "undefined" && module.exports) { module.exports = Object.assign({ install: null }, pure); return; }

  /* ================================ the editor ================================ */
  function install(E) {
    const B = root.PCBez, V = E.vline;
    if (!Q || !B || !V || !E.tools) return;
    const { S, D, store, say, doc, ctx } = E, T = E.tools;
    const esc = (v) => String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const G = (k, d) => store.get("cd." + k, d), P = (k, v) => store.set("cd." + k, v);
    S.cd = Object.assign({ corners: [0, 0, 0, 0], cornerStyle: "round", ekind: "ellipse", estart: 0, eend: 270, sides: 5, points: 5, sharp: 53, cpoints: 9, csharp: 2, revs: 4, spiral: "sym",
      expansion: 50, cols: 4, rows: 3, common: "arrowR", mmode: "preset", mpreset: "taper", mwidth: 16, mangle: 45, mitem: "stars", msize: 24, mspace: 28, unit: "px", dpi: 96, dec: 0, tsize: 14, conn: "right" }, G("s", {}));
    const save = () => P("s", S.cd);
    const R = () => 6 / (S.zoom || 1);
    const active = () => { const L = E.layer(); return L && L.type === "shape" && L.shape && L.shape.kind === "path" ? L : null; };
    const opts = (list, cur) => list.map(([v, n]) => `<option value="${v}"${String(v) === String(cur) ? " selected" : ""}>${esc(n)}</option>`).join("");
    const num = (id, v, min, max, step, title, w) => `<input type="number" id="${id}" min="${min}" max="${max}" step="${step || 1}" value="${v}" title="${esc(title)}" style="width:${w || 50}px">`;
    const hint = (t) => `<span class="pnhint" title="${esc(t)}">ⓘ</span>`;
    function newShape(path, name, extra) {
      if (E.drawCombine) { const c = E.drawCombine(path, name); if (c) return c; }   // 2.439.0: ⊕ / ⊖ / ⊗ / ⊘ - joined to the picked shape (pcpropbar.js)
      const L = V.newLine({ closed: false, op: "add", pts: [] }, name, extra || {});
      L.shape.path = path; Q.syncShape(L.shape); D.rasterize(L); return L;
    }

    /* ---------------- live shapes: the bar's settings, regenerated in their frame ---------------- */
    const GEN_KEYS = { rect: ["corners", "style"], ellipse: ["kind", "start", "end"], polygon: ["sides"], star: ["points", "sharp"], cstar: ["points", "sharp"], spiral: ["revs", "spiral", "expansion"], graph: ["cols", "rows"], common: ["id"] };
    function genOf(type, frame) {
      const c = S.cd;
      const g = { type, frame };
      if (type === "rect") Object.assign(g, { corners: c.corners.slice(), style: c.cornerStyle });
      if (type === "ellipse") Object.assign(g, { kind: c.ekind, start: c.estart, end: c.eend });
      if (type === "polygon") g.sides = c.sides;
      if (type === "star") Object.assign(g, { points: c.points, sharp: c.sharp });
      if (type === "cstar") Object.assign(g, { points: c.cpoints, sharp: c.csharp });
      if (type === "spiral") Object.assign(g, { revs: c.revs, spiral: c.spiral, expansion: c.expansion });
      if (type === "graph") Object.assign(g, { cols: c.cols, rows: c.rows });
      if (type === "common") g.id = c.common;
      return g;
    }
    /** a setting from the bar: the defaults, and the active live shape of that type (one undo step) */
    function setGen(label, f) {
      f(S.cd); save();
      const L = active(); if (!L || !L.shape.gen) return;
      V.once(label, () => {
        const g = JSON.parse(JSON.stringify(L.shape.gen)); g.frame = frameNow(L.shape.gen, L.shape.path);
        f(null, g);
        if (JSON.stringify(g) === JSON.stringify(L.shape.gen)) return false;            // nothing changed (a field's change + blur): no undo step
        L.shape.gen = g; L.shape.path = genPath(g);
        if (g.type === "cstar") L.shape.line = Object.assign({}, L.shape.line, { evenodd: true });
        Q.syncShape(L.shape); D.rasterize(L);
      });
    }
    const genNow = (type) => { const L = active(); return L && L.shape.gen && L.shape.gen.type === type ? L.shape.gen : null; };

    /* ---------------- F6: the shape tools ---------------- */
    let dr = null;            // a drag {x0, y0, x1, y1} | a 3-point {p0, p1, p2, stage}
    function makeDragTool(id, name, type, bar, bind) {
      return {
        id, name, cursor: "crosshair",
        options: () => bar() + V.lineBar() + hint("drag to draw · Ctrl = square / circle · Shift = from the centre · the bar changes the picked " + name.toLowerCase() + " too (Ctrl+Q makes it curves)"),
        bindOptions(o) { V.bindLineBar(o); bind(o); },
        down(e, fx, fy) { if (!S.w) return false; dr = { x0: fx, y0: fy, x1: fx, y1: fy }; },
        move(e, fx, fy) { if (!dr) return; dr.x1 = fx; dr.y1 = fy; dr.sq = e.ctrlKey || e.metaKey; dr.c = e.shiftKey; E.drawOverlay(); },
        up() {
          const d = dr; dr = null; E.drawOverlay();
          if (!d || Math.abs(d.x1 - d.x0) < 3 && Math.abs(d.y1 - d.y0) < 3) return say(`${name}: drag to draw one`);
          const f = frameOfDrag(d.x0, d.y0, d.x1, d.y1, d.sq, d.c), g = genOf(type, f);
          V.once(name.toLowerCase(), () => {
            const L = newShape(genPath(g), name + " " + (S.layers.filter((x) => x.shape && x.shape.gen && x.shape.gen.type === type).length + 1));
            L.shape.gen = g; if (type === "cstar") L.shape.line.evenodd = true;
            Q.syncShape(L.shape); D.rasterize(L);
          });
          E.renderOptions();
        },
        preview: () => (dr ? genPath(genOf(type, frameOfDrag(dr.x0, dr.y0, dr.x1, dr.y1, dr.sq, dr.c))) : null),
        leave() { dr = null; },
      };
    }
    function make3Tool(id, name, type) {
      return {
        id, name, cursor: "crosshair",
        options: () => (type === "rect" ? rectBar() : ellipseBar()) + V.lineBar() + hint("drag one side (any angle - Ctrl = 15°), let go, then move and click for the height"),
        bindOptions(o) { V.bindLineBar(o); (type === "rect" ? bindRect : bindEllipse)(o); },
        down(e, fx, fy) {
          if (!S.w) return false;
          if (dr && dr.stage === 2) {
            const g = genOf(type, frame3(dr.p0, dr.p1, [fx, fy])); dr = null; E.drawOverlay();
            if (g.frame.h < 2) return false;
            V.once(name.toLowerCase(), () => { const L = newShape(genPath(g), name.replace("3-Point ", "") + " " + (S.layers.filter((x) => x.shape && x.shape.gen && x.shape.gen.type === type).length + 1)); L.shape.gen = g; Q.syncShape(L.shape); D.rasterize(L); });
            E.renderOptions(); return false;
          }
          dr = { p0: [fx, fy], p1: [fx, fy], stage: 1 };
        },
        move(e, fx, fy) { if (!dr || dr.stage !== 1) return; dr.p1 = e.ctrlKey || e.metaKey ? B.constrain(dr.p0[0], dr.p0[1], fx, fy) : [fx, fy]; E.drawOverlay(); },
        up() { if (!dr) return; if (Math.hypot(dr.p1[0] - dr.p0[0], dr.p1[1] - dr.p0[1]) > 3) { dr.stage = 2; dr.p2 = dr.p1.slice(); say(`${name}: move to set the height, click`); } else { dr = null; say(`${name}: drag one side first`); } E.drawOverlay(); },
        hover(e, fx, fy) { if (dr && dr.stage === 2) { dr.p2 = [fx, fy]; E.drawOverlay(); } },
        key(e) { if (dr && e.key === "Escape") { dr = null; E.drawOverlay(); return true; } return false; },
        preview: () => (dr ? (dr.stage === 2 ? genPath(genOf(type, frame3(dr.p0, dr.p1, dr.p2))) : { subs: [poly([dr.p0, dr.p1], false)] }) : null),
        leave() { dr = null; },
      };
    }
    // the bars
    const rectBar = () => { const g = genNow("rect"), c = g ? g.corners : S.cd.corners, st = g ? g.style : S.cd.cornerStyle;
      return `<select id="cdCS" title="Corner style">${opts([["round", "◜ Round"], ["scallop", "◟ Scallop"], ["chamfer", "◸ Chamfer"]], st)}</select>`
        + ["↖", "↗", "↘", "↙"].map((ic, i) => `<label title="Corner radius (px)">${ic}${num("cdR" + i, c[i], 0, 5000, 1, "Corner radius", 46)}</label>`).join("")
        + `<label title="Change all four corners together"><input type="checkbox" id="cdRL" ${S.cd.rlock !== false ? "checked" : ""}>🔒</label>`; };
    function bindRect(o) {
      const cs = o.querySelector("#cdCS"); if (cs) cs.onchange = () => setGen("corner style", (c, g) => { if (c) c.cornerStyle = cs.value; else g.style = cs.value; });
      const rl = o.querySelector("#cdRL"); if (rl) rl.onchange = () => { S.cd.rlock = rl.checked; save(); };
      for (let i = 0; i < 4; i++) { const el = o.querySelector("#cdR" + i); if (el) el.onchange = () => { const v = Math.max(0, +el.value || 0), all = S.cd.rlock !== false; setGen("corner radius", (c, g) => { const arr = c ? c.corners : (g.corners = g.corners.slice()); for (let k = 0; k < 4; k++) if (all || k === i) arr[k] = v; }); E.renderOptions(); }; }
    }
    const ellipseBar = () => { const g = genNow("ellipse"), k = g ? g.kind : S.cd.ekind, s = g ? g.start : S.cd.estart, en = g ? g.end : S.cd.eend;
      return `<select id="cdEK" title="Ellipse, pie or arc">${opts([["ellipse", "◯ Ellipse"], ["pie", "◔ Pie"], ["arc", "◡ Arc"]], k)}</select>` + `<label title="Start angle (°)">∠ ${num("cdES", s, -360, 360, 1, "Start angle", 50)}</label><label title="End angle (°)">→ ${num("cdEE", en, -360, 360, 1, "End angle", 50)}</label>`; };
    function bindEllipse(o) {
      const k = o.querySelector("#cdEK"); if (k) k.onchange = () => setGen("ellipse type", (c, g) => { if (c) c.ekind = k.value; else g.kind = k.value; });
      const s = o.querySelector("#cdES"); if (s) s.onchange = () => setGen("start angle", (c, g) => { if (c) c.estart = +s.value || 0; else g.start = +s.value || 0; });
      const en = o.querySelector("#cdEE"); if (en) en.onchange = () => setGen("end angle", (c, g) => { if (c) c.eend = +en.value || 0; else g.end = +en.value || 0; });
    }
    const field = (id, key, gk, label, title, min, max, step, type) => ({
      html: () => { const g = genNow(type); return `<label title="${esc(title)}">${label} ${num(id, g ? g[gk] : S.cd[key], min, max, step, title, 52)}</label>`; },
      bind: (o) => { const el = o.querySelector("#" + id); if (el) el.onchange = () => { const v = Math.max(min, Math.min(max, +el.value || min)); setGen(title.toLowerCase(), (c, g) => { if (c) c[key] = v; else g[gk] = v; }); }; } });
    const F = {
      sides: field("cdSides", "sides", "sides", "⬠", "Sides", 3, 500, 1, "polygon"),
      points: field("cdPts", "points", "points", "✦", "Points", 3, 500, 1, "star"), sharp: field("cdSh", "sharp", "sharp", "◇", "Sharpness", 1, 99, 1, "star"),
      cpoints: field("cdCPts", "cpoints", "points", "✦", "Points", 5, 500, 1, "cstar"), csharp: field("cdCSh", "csharp", "sharp", "◇", "Sharpness", 1, 250, 1, "cstar"),
      revs: field("cdRev", "revs", "revs", "@", "Revolutions", 0.25, 100, 0.25, "spiral"), exp: field("cdExp", "expansion", "expansion", "↗", "Expansion", 1, 100, 1, "spiral"),
      cols: field("cdCols", "cols", "cols", "▥", "Columns", 1, 100, 1, "graph"), rows: field("cdRows", "rows", "rows", "▤", "Rows", 1, 100, 1, "graph"),
    };
    const spiralType = () => { const g = genNow("spiral"); return `<select id="cdSpT" title="Symmetric or logarithmic">${opts([["sym", "Symmetric"], ["log", "Logarithmic"]], g ? g.spiral : S.cd.spiral)}</select>`; };
    const bindSpiralType = (o) => { const el = o.querySelector("#cdSpT"); if (el) el.onchange = () => setGen("spiral type", (c, g) => { if (c) c.spiral = el.value; else g.spiral = el.value; }); };
    const commonBar = () => { const g = genNow("common"), cur = g ? g.id : S.cd.common;
      const groups = [...new Set(COMMON.map((c) => c[0]))];
      return `<select id="cdCom" title="Common Shapes">${groups.map((gr) => `<optgroup label="${gr[0].toUpperCase() + gr.slice(1)}">${COMMON.filter((c) => c[0] === gr).map((c) => `<option value="${c[1]}"${c[1] === cur ? " selected" : ""}>${esc(c[2])}</option>`).join("")}</optgroup>`).join("")}</select>`; };
    const bindCommon = (o) => { const el = o.querySelector("#cdCom"); if (el) el.onchange = () => setGen("common shape", (c, g) => { if (c) c.common = el.value; else g.id = el.value; }); };
    T.crect = makeDragTool("crect", "Rectangle", "rect", rectBar, bindRect);
    T.crect3 = make3Tool("crect3", "3-Point Rectangle", "rect");
    T.cellipse = makeDragTool("cellipse", "Ellipse", "ellipse", ellipseBar, bindEllipse);
    T.cellipse3 = make3Tool("cellipse3", "3-Point Ellipse", "ellipse");
    T.cpolygon = makeDragTool("cpolygon", "Polygon", "polygon", () => F.sides.html(), (o) => F.sides.bind(o));
    T.cstar = makeDragTool("cstar", "Star", "star", () => F.points.html() + F.sharp.html(), (o) => { F.points.bind(o); F.sharp.bind(o); });
    T.ccstar = makeDragTool("ccstar", "Complex Star", "cstar", () => F.cpoints.html() + F.csharp.html(), (o) => { F.cpoints.bind(o); F.csharp.bind(o); });
    T.cspiral = makeDragTool("cspiral", "Spiral", "spiral", () => F.revs.html() + spiralType() + F.exp.html(), (o) => { F.revs.bind(o); bindSpiralType(o); F.exp.bind(o); });
    T.cgraph = makeDragTool("cgraph", "Graph Paper", "graph", () => F.cols.html() + F.rows.html(), (o) => { F.cols.bind(o); F.rows.bind(o); });
    T.ccommon = makeDragTool("ccommon", "Common Shape", "common", commonBar, bindCommon);

    /* ---------------- F5: Artistic Media ---------------- */
    let am = null;            // {pts: [[x, y, pressure]], t0}
    const mediaOpts = () => ({ mode: S.cd.mmode, preset: S.cd.mpreset, width: S.cd.mwidth, angle: S.cd.mangle, item: S.cd.mitem, size: S.cd.msize, spacing: S.cd.mspace });
    const mediaPath = (pts, o) => (o.mode === "sprayer" ? sprayItems(pts, o) : mediaOutline(pts, o));
    /** a media setting: the defaults (S.cd[sk]) and the picked Artistic Media stroke (its o[mk]) - one undo step */
    function chgMedia(mk, sk, v) {
      S.cd[sk] = v; save();
      const L = active(); if (!L || !L.shape.media || L.shape.media.o[mk] === v) return;
      V.once("artistic media", () => { const m = Object.assign({}, L.shape.media, { o: Object.assign({}, L.shape.media.o, { [mk]: v }) }); L.shape.media = m; const p = mediaPath(m.pts, m.o); if (p && p.subs.length) { L.shape.path = p; Q.syncShape(L.shape); D.rasterize(L); } });
    }
    T.cmedia = {
      id: "cmedia", name: "Artistic Media", cursor: "crosshair",
      options() {
        const L = active(), m = L && L.shape.media ? L.shape.media.o : mediaOpts(), md = m.mode;
        return `<select id="cdMM" title="Artistic media">${opts([["preset", "Preset"], ["calligraphic", "Calligraphic"], ["pressure", "Pressure"], ["sprayer", "Sprayer"]], md)}</select>`
          + (md === "preset" ? `<select id="cdMP" title="The stroke's shape">${opts([["taper", "◖▬◗ Taper"], ["teardrop", "Teardrop"], ["flare", "Flare"], ["uniform", "Uniform"]], m.preset)}</select>` : "")
          + (md !== "sprayer" ? `<label title="Stroke width (px)">W ${num("cdMW", m.width, 1, 1000, 1, "Stroke width", 52)}</label>` : "")
          + (md === "calligraphic" ? `<label title="Nib angle (°)">∠ ${num("cdMA", m.angle, -180, 180, 1, "Nib angle", 50)}</label>` : "")
          + (md === "sprayer" ? `<select id="cdMI" title="What it sprays">${opts([["stars", "★ Stars"], ["dots", "● Dots"], ["leaves", "💧 Leaves"], ["hearts", "♥ Hearts"], ["bubbles", "◎ Bubbles"], ["confetti", "▬ Confetti"]], m.item)}</select><label title="Item size (px)">size ${num("cdMS", m.size, 2, 500, 1, "Item size", 50)}</label><label title="Spacing (px)">gap ${num("cdMG", m.spacing, 2, 1000, 1, "Spacing", 50)}</label>` : "")
          + V.lineBar() + hint("draw a stroke - it becomes a filled shape (the Fill colour; the outline pen draws round it) · the bar changes the picked one too");
      },
      bindOptions(o) {
        V.bindLineBar(o);
        const map = [["cdMM", "mode", "mmode", (v) => v], ["cdMP", "preset", "mpreset", (v) => v], ["cdMW", "width", "mwidth", (v) => Math.max(1, +v || 1)], ["cdMA", "angle", "mangle", (v) => +v || 0],
          ["cdMI", "item", "mitem", (v) => v], ["cdMS", "size", "msize", (v) => Math.max(2, +v || 2)], ["cdMG", "spacing", "mspace", (v) => Math.max(2, +v || 2)]];
        for (const [id, mk, sk, f] of map) { const x = o.querySelector("#" + id); if (x) x.onchange = () => { chgMedia(mk, sk, f(x.value)); if (id === "cdMM") E.renderOptions(); }; }
      },
      down(e, fx, fy) { if (!S.w) return false; am = { pts: [[fx, fy, e.pointerType === "pen" ? (E.tablet ? E.tablet.pressure(e) : e.pressure) : 0.5]], t: performance.now() }; },   // 2.570.0: the 🖊 Pen tab's curve
      move(e, fx, fy) {
        if (!am) return; const l = am.pts[am.pts.length - 1], d = Math.hypot(fx - l[0], fy - l[1]); if (d < 1.2 / (S.zoom || 1)) return;
        const now = performance.now(), sp = d / Math.max(1, now - am.t); am.t = now;
        const pr = e.pointerType === "pen" && e.pressure > 0 ? (E.tablet ? E.tablet.pressure(e) : e.pressure) : Math.max(0.15, Math.min(1, 1.1 - sp * 0.35));   // a mouse: slower = wider
        am.pts.push([fx, fy, pr]); E.drawOverlay();
      },
      up() {
        const a = am; am = null; E.drawOverlay();
        if (!a || a.pts.length < 3) return say("Artistic Media: draw a stroke");
        const o = mediaOpts(), p = mediaPath(a.pts, o); if (!p || !p.subs.length) return;
        V.once("artistic media", () => {
          const L = newShape(p, (o.mode === "sprayer" ? "Sprayer " : "Artistic Media ") + (S.layers.filter((x) => x.shape && x.shape.media).length + 1), { fill: S.fg, fillOn: true, strokeW: 0, strokeOn: false });
          L.shape.media = { pts: a.pts.map((q) => [r3(q[0]), r3(q[1]), r3(q[2])]), o };
          D.rasterize(L);
        });
        E.renderOptions();
      },
      leave() { am = null; },
    };

    /* ---------------- F8: dimensions, callout, connector ---------------- */
    const dimO = () => ({ unit: S.cd.unit, dpi: S.cd.dpi, dec: S.cd.dec, size: S.cd.tsize });
    const dimBar = () => `<select id="cdU" title="Units">${opts([["px", "px"], ["mm", "mm"], ["cm", "cm"], ["in", "in"]], S.cd.unit)}</select><label title="Dots per inch (mm / cm / in)">dpi ${num("cdDpi", S.cd.dpi, 1, 2400, 1, "dpi", 52)}</label>`
      + `<label title="Decimal places">.0 ${num("cdDec", S.cd.dec, 0, 4, 1, "Decimals", 40)}</label><label title="Text size (px)">A ${num("cdTS", S.cd.tsize, 4, 400, 1, "Text size", 46)}</label>`;
    const bindDim = (o) => { const on = (id, k, f) => { const el = o.querySelector("#" + id); if (el) el.onchange = () => { S.cd[k] = f(el.value); save(); }; }; on("cdU", "unit", (v) => v); on("cdDpi", "dpi", (v) => Math.max(1, +v || 96)); on("cdDec", "dec", (v) => Math.max(0, Math.min(4, +v || 0))); on("cdTS", "tsize", (v) => Math.max(4, +v || 14)); };
    let dm = null;            // clicks so far [p0, p1, ...] + hover
    function dimLayer(res, name, extra, after) {
      V.once(name.toLowerCase(), () => {
        const L = newShape(res.path, name + " " + (S.layers.filter((x) => x.shape && x.shape.line && x.shape.line.labels).length + 1), Object.assign({ fillOn: false, strokeW: Math.max(1, S.vlW > 4 ? 1.5 : S.vlW), strokeOn: true }, extra || {}));
        L.shape.line = Object.assign({}, L.shape.line, { start: "arrow", end: "arrow", asize: 5, labels: [res.label], style: "solid" }, res.line || {});
        Q.syncShape(L.shape); D.rasterize(L);
        if (after) after(L);                              // 2.441.0: a live dimension (pcdims.js) - in the same undo step
      });
    }
    function makeDimTool(id, name, clicks, build, help) {
      return {
        id, name, cursor: "crosshair",
        options: () => dimBar() + (id === "ccallout" ? `<label title="The callout's text">Text <input type="text" id="cdCT" value="${esc(S.cd.ctext || "Callout")}" style="width:110px"></label>` : "") + V.lineBar() + hint(help),
        bindOptions(o) { V.bindLineBar(o); bindDim(o); const t = o.querySelector("#cdCT"); if (t) t.onchange = () => { S.cd.ctext = t.value; save(); }; },
        down(e, fx, fy) {
          if (!S.w) return false;
          dm = dm || { pts: [] };
          const last = dm.pts[dm.pts.length - 1];
          dm.pts.push(e.ctrlKey || e.metaKey ? (last ? B.constrain(last[0], last[1], fx, fy) : [fx, fy]) : [fx, fy]);
          if (dm.pts.length >= clicks) { const pts = dm.pts.slice(), r = build(pts); dm = null; E.drawOverlay(); if (r) dimLayer(r, name, undefined, id !== "ccallout" && E.dimNew ? (L) => E.dimNew(L, id, pts) : null); return false; }
          say(`${name}: ${clicks - dm.pts.length} more click(s)`); E.drawOverlay(); return false;
        },
        hover(e, fx, fy) { if (dm) { dm.hover = [fx, fy]; E.drawOverlay(); } },
        key(e) { if (dm && e.key === "Escape") { dm = null; E.drawOverlay(); return true; } return false; },
        preview: () => { if (!dm || !dm.hover) return null; const pts = dm.pts.concat([dm.hover]); if (pts.length >= clicks) { const r = build(pts); return r ? r.path : null; } return { subs: [poly(pts, false)] }; },
        leave() { dm = null; },
      };
    }
    T.cdimpar = makeDimTool("cdimpar", "Parallel Dimension", 3, (p) => dimParallel(p[0], p[1], p[2], "parallel", dimO()), "click the start, the end, then where the dimension line goes · Ctrl = 15°");
    T.cdimhv = makeDimTool("cdimhv", "Horizontal / Vertical Dimension", 3, (p) => dimParallel(p[0], p[1], p[2], "auto", dimO()), "click the start, the end, then above / below (horizontal) or beside (vertical)");
    T.cdimang = makeDimTool("cdimang", "Angular Dimension", 4, (p) => dimAngular(p[0], p[1], p[2], p[3], dimO()), "click the vertex, a point on each arm, then where the arc goes");
    T.ccallout = makeDimTool("ccallout", "3-Point Callout", 3, (p) => Object.assign(callout(p[0], p[1], p[2], Object.assign(dimO(), { text: S.cd.ctext || "Callout" })), { line: { start: "arrow", end: "none", asize: 4 } }), "click the point, the elbow, the end - the text (in the bar) goes after it");
    // the connector
    const boxOfLayer = (L) => {
      if (!L || L.visible === false) return null;
      if (L.type === "shape" && L.shape) return L.shape.kind === "path" ? Q.bbox(L.shape.path) : { x: Math.min(L.shape.x, L.shape.x + L.shape.w), y: Math.min(L.shape.y, L.shape.y + L.shape.h), w: Math.abs(L.shape.w), h: Math.abs(L.shape.h) };
      if (L.type === "text" && L.text) return D.textBox(L.text, ctx(L.canvas));
      if (L.type === "pixel" || L.type === "smart") { const b = E.alphaBox ? E.alphaBox(L.canvas) : null; return b && b.w > 0 ? b : null; }
      return null;
    };
    /** the object (not a connector) whose snap point / box is nearest (x, y) */
    function snapAt(x, y) {
      let best = null;
      for (let i = S.layers.length - 1; i >= 0; i--) {
        const L = S.layers[i]; if (!D.shown(S.layers, L) || (L.shape && L.shape.line && L.shape.line.connect) || L.type === "group" || L.type === "adjust" || L.type === "fill") continue;
        const b = boxOfLayer(L); if (!b || b.w <= 0 || (L.type === "pixel" && b.w >= S.w - 1 && b.h >= S.h - 1)) continue;
        const inside = x >= b.x - 12 && x <= b.x + b.w + 12 && y >= b.y - 12 && y <= b.y + b.h + 12; if (!inside) continue;
        const [side, pt, d] = nearestAnchor(b, x, y);
        if (!best || d < best.d) best = { L, side, pt, d };
      }
      return best;
    }
    let cn = null;
    const endOf = (e2) => { if (e2.id == null) return { pt: [e2.x, e2.y], side: "c" }; const L = S.layers.find((x) => x.id === e2.id); const b = boxOfLayer(L); if (!b) return null; return { pt: anchorsOf(b)[e2.at] || anchorsOf(b).c, side: e2.at }; };
    T.cconnect = {
      id: "cconnect", name: "Connector", cursor: "crosshair",
      options: () => `<select id="cdCK" title="Connector">${opts([["straight", "╱ Straight"], ["right", "└ Right-angle"], ["round", "╰ Rounded right-angle"]], S.cd.conn)}</select>` + V.lineBar() + hint("drag from one object to another - it snaps to the middle of their sides (or their centres) and follows them when they move"),
      bindOptions(o) { V.bindLineBar(o); const k = o.querySelector("#cdCK"); if (k) k.onchange = () => { S.cd.conn = k.value; save(); const L = active(); if (L && L.shape.line && L.shape.line.connect) V.once("connector type", () => { L.shape.line = Object.assign({}, L.shape.line, { connect: Object.assign({}, L.shape.line.connect, { kind: k.value }) }); reroute(L, true); }); }; },
      down(e, fx, fy) { if (!S.w) return false; const s = snapAt(fx, fy); cn = { a: s ? { id: s.L.id, at: s.side } : { x: fx, y: fy }, ax: s ? s.pt : [fx, fy], hover: [fx, fy] }; },
      move(e, fx, fy) { if (!cn) return; cn.hover = [fx, fy]; cn.snap = snapAt(fx, fy); E.drawOverlay(); },
      up(e, fx, fy) {
        const c = cn; cn = null; E.drawOverlay(); if (!c) return;
        const s = snapAt(fx, fy), b = s ? { id: s.L.id, at: s.side } : { x: fx, y: fy }, bp = s ? s.pt : [fx, fy];
        if (Math.hypot(bp[0] - c.ax[0], bp[1] - c.ax[1]) < 4) return say("Connector: drag from one object to another");
        V.once("connector", () => {
          const L = newShape(route(c.ax, c.a.at || "c", bp, b.at || "c", S.cd.conn, 10), "Connector " + (S.layers.filter((x) => x.shape && x.shape.line && x.shape.line.connect).length + 1), { fillOn: false });
          L.shape.line = Object.assign({}, L.shape.line, { connect: { a: c.a, b, kind: S.cd.conn } }); reroute(L, true);
        });
        say(s || c.a.id != null ? "connected - move either object and the line follows" : "a connector with free ends (start / end on objects to connect them)");
      },
      preview: () => { if (!cn) return null; const s = cn.snap, bp = s ? s.pt : cn.hover; return route(cn.ax, cn.a.at || "c", bp, s ? s.side : "c", S.cd.conn, 10); },
      leave() { cn = null; },
    };
    /** a connector's line from where its two objects are now; force = even when they did not move */
    function reroute(L, force) {
      const c = L.shape.line.connect, a = endOf(c.a), b = endOf(c.b); if (!a || !b) return false;
      const sig = JSON.stringify([a, b, c.kind]); if (!force && L._csig === sig) return false;
      L._csig = sig; L.shape.path = route(a.pt, a.side, b.pt, b.side, c.kind, 10); Q.syncShape(L.shape); D.rasterize(L); return true;
    }
    // connectors follow their objects: checked whenever the overlay is drawn (after any change, undo, redo)
    let rerouting = false;
    E.overlayHooks.push(() => {
      if (rerouting || !S.w) return;
      const cons = S.layers.filter((L) => L.type === "shape" && L.shape && L.shape.line && L.shape.line.connect); if (!cons.length) return;
      rerouting = true; let any = false;
      try { for (const L of cons) if (reroute(L, false)) any = true; } finally { rerouting = false; }
      if (any) E.renderSoon();
    });

    /* ---------------- the overlay: the shape being drawn ---------------- */
    E.overlayHooks.push((g, px) => {
      const tl = T[S.tool]; if (!tl || !tl.preview) { if (S.tool === "cmedia" && am && am.pts.length > 1) { g.strokeStyle = "#2680eb"; g.lineWidth = 1.5 * px; g.beginPath(); am.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); } return; }
      const p = tl.preview(); if (!p) return;
      g.save(); g.strokeStyle = "#2680eb"; g.lineWidth = 1.25 * px; g.setLineDash([]); Q.traceAll(g, p); g.stroke();
      if (cn && cn.snap) { const pt = cn.snap.pt; g.beginPath(); g.arc(pt[0], pt[1], 5 * px, 0, Math.PI * 2); g.fillStyle = "rgba(38,128,235,.6)"; g.fill(); }
      if (dm) for (const q of dm.pts) { g.fillStyle = "#2680eb"; g.fillRect(q[0] - 3 * px, q[1] - 3 * px, 6 * px, 6 * px); }
      g.restore();
    });

    /* ---------------- commands ---------------- */
    if (E.ui.addCmd) {
      const C = E.ui.addCmd;
      for (const [id, n] of [["crect", "Rectangle Tool"], ["crect3", "3-Point Rectangle Tool"], ["cellipse", "Ellipse Tool"], ["cellipse3", "3-Point Ellipse Tool"], ["cpolygon", "Polygon Tool"], ["cstar", "Star Tool"], ["ccstar", "Complex Star Tool"],
        ["cspiral", "Spiral Tool"], ["cgraph", "Graph Paper Tool"], ["ccommon", "Common Shapes Tool"], ["cmedia", "Artistic Media Tool"], ["cdimpar", "Parallel Dimension Tool"], ["cdimhv", "Horizontal / Vertical Dimension Tool"],
        ["cdimang", "Angular Dimension Tool"], ["ccallout", "3-Point Callout Tool"], ["cconnect", "Connector Tool"]])
        C("tool." + id, n, "", () => E.setTool(id), {});
    }
    E.cdraw = { genPath, frameNow, reroute, snapAt, boxOfLayer, state: () => ({ dr: !!dr, dm: dm ? dm.pts.length : 0, cn: !!cn, am: !!am }) };
  }
  root.PCDraw = Object.assign({ install }, pure);
})(typeof window !== "undefined" ? window : globalThis);
