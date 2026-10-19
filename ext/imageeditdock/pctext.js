/* pctext.js — THE IMAGE EDITOR'S TYPE, BEYOND A STRAIGHT LINE (2.397.0), window.PCText.
 *
 * Tim (verbatim): "yes please add the text tool improvements, like text along a path , add the filters like lense
 * flare, swirl,drop shadow, 3d text and the overlay styles"
 *
 * A text layer (pcdoc.js, L.text) can now also carry - all optional, all live and editable, saved with the layer:
 *   path     TEXT ALONG A PATH: {kind: "curve", pts: [[dx, dy] ...] (relative to text.x / y), offset %, flip} drawn with
 *            the TYPE ON A PATH tool (T group: click points / drag a line; drag a point to reshape), or
 *            {kind: "circle", r, start (°, 0 = top), side "top" | "bottom"} - text round a circle (centre = text.x / y)
 *   warp     WARP TEXT, Photoshop's: arc, arc lower, arc upper, arch, bulge, flag, wave, fish, rise, squeeze, inflate;
 *            bend -100 .. 100 (each column of the straight text moved / stretched - warpColumn, pure)
 *   extrude  3D TEXT: {on, depth, angle, color (null = the text colour, darker), shade} - the letters extruded back,
 *            darker towards the back, the face on top (Layer Style ▸ Bevel & Emboss rounds the face)
 *   caps / underline / strike / vertical (the VERTICAL TYPE tool: one letter under the next, lines left to right)
 * pcdoc.js asks wants(t) and hands such a text to draw(g, t) / box(t, g); everything else is drawn as before.
 * Pure helpers (tested in Node: scripts/test-pctext.js): warpColumn, warpExtent, catmull, circlePoly, arcTable, pointAt,
 * layoutPath, polyOf, simplify, extrudeSteps, box (approximate without a canvas).
 */
(function (root) {
  "use strict";

  /* ================================ pure ================================ */
  const WARPS = [["none", "None"], ["arc", "Arc"], ["arcLower", "Arc Lower"], ["arcUpper", "Arc Upper"], ["arch", "Arch"], ["bulge", "Bulge"],
    ["flag", "Flag"], ["wave", "Wave"], ["fish", "Fish"], ["rise", "Rise"], ["squeeze", "Squeeze"], ["inflate", "Inflate"]];
  /** a column at u (-1 left .. 1 right) of a warped block: [top, bottom] moves as fractions of the block's height
   *  (negative = up). bend -100 .. 100 */
  function warpColumn(style, bend, u) {
    const b = Math.max(-100, Math.min(100, +bend || 0)) / 100, c = 1 - u * u, s = Math.sin(u * Math.PI);
    switch (style) {
      case "arc": return [-b * c * 0.5, -b * c * 0.5];
      case "arcLower": return [0, b * c * 0.5];
      case "arcUpper": return [-b * c * 0.5, 0];
      case "arch": return [-b * c * 0.55, -b * c * 0.3];
      case "bulge": return [-b * c * 0.4, b * c * 0.4];
      case "inflate": { const k = Math.cos(u * Math.PI / 2); return [-b * k * 0.3, b * k * 0.3]; }
      case "flag": return [b * s * 0.3, b * s * 0.3];
      case "wave": return [b * s * 0.3, b * Math.sin(u * Math.PI - 0.9) * 0.3];
      case "fish": return [-b * c * 0.4, b * c * 0.4 * (u < 0 ? 1 : 1 - u)];
      case "rise": return [-b * u * 0.5, -b * u * 0.5];
      case "squeeze": return [b * c * 0.3, -b * c * 0.3];
      default: return [0, 0];
    }
  }
  /** how far a warp reaches above / below the block (fractions of its height) */
  function warpExtent(style, bend) {
    let up = 0, down = 0;
    for (let i = 0; i <= 40; i++) { const [a, b] = warpColumn(style, bend, -1 + i / 20); up = Math.min(up, a, b); down = Math.max(down, a, b); }
    return { up: -up, down };
  }
  /** a smooth line through the points (Catmull-Rom), `steps` per span */
  function catmull(pts, steps) {
    const P = (pts || []).filter((p) => Array.isArray(p) && isFinite(p[0]) && isFinite(p[1]));
    if (P.length < 3) return P.map((p) => [p[0], p[1]]);
    const n = Math.max(2, steps || 12), out = [];
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        out.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
                  0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
      }
    }
    out.push([P[P.length - 1][0], P[P.length - 1][1]]);
    return out;
  }
  /** a circle as a closed polyline, clockwise from `start` (° from the top) - or, side "bottom", anticlockwise from
   *  the bottom so the letters read left to right along the lower edge */
  function circlePoly(cx, cy, r, startDeg, side, n) {
    const N = Math.max(24, n || 180), R = Math.max(1, r), out = [];
    const bottom = side === "bottom", a0 = (bottom ? 90 - (+startDeg || 0) : (+startDeg || 0) - 90) * Math.PI / 180;
    for (let i = 0; i <= N; i++) { const a = a0 + (bottom ? -1 : 1) * i * 2 * Math.PI / N; out.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
    return out;
  }
  /** cumulative lengths along a polyline */
  function arcTable(poly) {
    const pts = poly || [], len = [0];
    for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, len, total: len[len.length - 1] || 0 };
  }
  /** the point and direction (radians) at arc length s (clamped; `closed` wraps) */
  function pointAt(tab, s, closed) {
    const P = tab.pts, L = tab.len, T = tab.total;
    if (P.length < 2 || !(T > 0)) return P.length ? { x: P[0][0], y: P[0][1], a: 0 } : { x: 0, y: 0, a: 0 };
    let q = closed ? ((s % T) + T) % T : Math.max(0, Math.min(T, s));
    let lo = 0, hi = L.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] <= q) lo = m; else hi = m; }
    const seg = L[hi] - L[lo] || 1, t = (q - L[lo]) / seg, a = P[lo], b = P[hi];
    return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, a: Math.atan2(b[1] - a[1], b[0] - a[0]) };
  }
  /**
   * the letters' places along the path: widths [px], opts {offset (0..100 % - the anchor), align left|center|right,
   * closed} -> [{i, x, y, a, w}] (a letter off the end of an open path is left out: on: false)
   */
  function layoutPath(widths, tab, opts) {
    const o = opts || {}, total = widths.reduce((s, w) => s + w, 0), T = tab.total;
    const anchor = (o.offset == null ? (o.closed ? 0 : 0) : +o.offset) / 100 * T;
    let s = anchor - (o.align === "center" ? total / 2 : o.align === "right" ? total : 0);
    const out = [];
    widths.forEach((w, i) => {
      const mid = s + w / 2, p = pointAt(tab, mid, o.closed);
      out.push({ i, x: p.x, y: p.y, a: p.a, w, on: o.closed || (mid >= 0 && mid <= T) });
      s += w;
    });
    return out;
  }
  /** a text's path as a polyline in picture px (null = none) */
  function polyOf(t) {
    const p = t && t.path; if (!p) return null;
    if (p.kind === "circle") { const poly = circlePoly(t.x, t.y, p.r || 120, p.start || 0, p.side, 240); return p.flip ? poly.reverse() : poly; }
    if (p.kind === "curve" && Array.isArray(p.pts) && p.pts.length >= 2) {
      const poly = catmull(p.pts.map((q) => [t.x + q[0], t.y + q[1]]), 16);
      return p.flip ? poly.reverse() : poly;
    }
    return null;
  }
  /** Ramer-Douglas-Peucker: a hand-drawn line down to its corners (eps px), at most `max` points */
  function simplify(pts, eps, max) {
    const P = pts || []; if (P.length < 3) return P.slice();
    const keep = new Uint8Array(P.length); keep[0] = keep[P.length - 1] = 1;
    const rec = (a, b) => {
      let best = -1, bd = 0; const [ax, ay] = P[a], [bx, by] = P[b], L = Math.hypot(bx - ax, by - ay) || 1;
      for (let i = a + 1; i < b; i++) { const d = Math.abs((bx - ax) * (ay - P[i][1]) - (ax - P[i][0]) * (by - ay)) / L; if (d > bd) { bd = d; best = i; } }
      if (best > 0 && bd > (eps || 2)) { keep[best] = 1; rec(a, best); rec(best, b); }
    };
    rec(0, P.length - 1);
    let out = P.filter((p, i) => keep[i]);
    const M = Math.max(2, max || 40);
    while (out.length > M) out = out.filter((p, i) => i === 0 || i === out.length - 1 || i % 2 === 0);
    return out;
  }
  /** the 3D slices back to front: [{k, dx, dy, dark}] - angle like a shadow's (135 = down to the right) */
  function extrudeSteps(depth, angleDeg, shade) {
    const n = Math.max(0, Math.min(200, Math.round(+depth || 0))), a = (angleDeg == null ? 135 : +angleDeg) * Math.PI / 180, sh = shade == null ? 0.5 : +shade;
    const out = [];
    for (let k = n; k >= 1; k--) out.push({ k, dx: -Math.cos(a) * k, dy: Math.sin(a) * k, dark: Math.max(0, Math.min(1, sh * k / n)) });
    return out;
  }
  const strOf = (t) => (t.caps ? String(t.str || "").toUpperCase() : String(t.str || ""));
  const warpOn = (t) => !!(t.warp && t.warp.style && t.warp.style !== "none" && +t.warp.bend);
  const extOn = (t) => !!(t.extrude && t.extrude.on && +t.extrude.depth > 0);
  /** does this text need pctext.js to draw it? */
  function wants(t) { return !!t && !!(t.caps || t.underline || t.strike || t.vertical || warpOn(t) || polyOf(t) || extOn(t)); }
  function scalePath(t, kx, ky) {
    const p = t.path; if (!p) return;
    if (p.kind === "curve" && Array.isArray(p.pts)) p.pts = p.pts.map((q) => [q[0] * kx, q[1] * ky]);
    if (p.kind === "circle") p.r = (p.r || 120) * Math.min(kx, ky);
  }

  /* ---------------- measuring (a canvas when there is one; 0.55 em per letter without) ---------------- */
  function fontOf(t) { const D = root.PCDoc; return D && D.fontCss ? D.fontCss(t) : `${t.italic ? "italic " : ""}${t.weight || 400} ${Math.max(1, t.size)}px sans-serif`; }
  function measurer(t, g) {
    const track = (t.tracking || 0) / 1000 * t.size;
    if (g && g.measureText) {
      g.save(); g.font = fontOf(t); if ("letterSpacing" in g) g.letterSpacing = "0px";
      const cache = new Map();
      const m = (s) => { if (!cache.has(s)) cache.set(s, g.measureText(s).width); return cache.get(s); };
      const fn = (s) => m(s) + track * s.length;
      fn.done = () => g.restore();
      return fn;
    }
    const fn = (s) => s.length * t.size * 0.55 + track * s.length; fn.done = () => {};
    return fn;
  }
  /** the straight block's box (as pcdoc's textBox, with caps) */
  function straightBox(t, g) {
    if (root.PCType && root.PCType.wants(t)) return root.PCType.box(t, g);   // 2.426.0: the Character / Paragraph panels' settings (pctype.js)
    const lines = strOf(t).split("\n"), lh = t.size * (t.leading || 1.2), m = measurer(t, g);
    let w = 0; for (const ln of lines) w = Math.max(w, m(ln)); m.done();
    const x = t.align === "center" ? t.x - w / 2 : t.align === "right" ? t.x - w : t.x;
    return { x, y: t.y, w: Math.max(1, w), h: Math.max(lh, lines.length * lh) };
  }
  function verticalBox(t) {
    const lines = strOf(t).split("\n"), step = t.size * (1 + (t.tracking || 0) / 1000), col = t.size * (t.leading || 1.2);
    const rows = Math.max(1, ...lines.map((l) => l.length));
    return { x: t.x, y: t.y, w: Math.max(t.size, lines.length * col), h: Math.max(t.size, rows * step) };
  }
  function pathPlaces(t, g) {
    const poly = polyOf(t); if (!poly) return null;
    const tab = arcTable(poly), m = measurer(t, g), chars = Array.from(strOf(t).replace(/\n/g, " "));
    const widths = chars.map((c) => m(c)); m.done();
    const circle = t.path.kind === "circle";
    const places = layoutPath(widths, tab, { offset: circle ? 0 : (t.path.offset || 0), align: circle ? "center" : t.align, closed: circle });
    return { places, chars, tab };
  }
  /** the box a text covers in picture px (path, warp, vertical, 3D included) */
  function box(t, g) {
    let b;
    const pp = pathPlaces(t, g);
    if (pp) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const asc = t.size * 0.85, desc = t.size * 0.25;
      for (const p of pp.places) {
        if (!p.on) continue;
        const ca = Math.cos(p.a), sa = Math.sin(p.a);
        for (const [lx, ly] of [[-p.w / 2, -asc], [p.w / 2, -asc], [-p.w / 2, desc], [p.w / 2, desc]]) {
          const X = p.x + lx * ca - ly * sa, Y = p.y + lx * sa + ly * ca;
          x0 = Math.min(x0, X); y0 = Math.min(y0, Y); x1 = Math.max(x1, X); y1 = Math.max(y1, Y);
        }
      }
      b = isFinite(x0) ? { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) } : { x: t.x, y: t.y, w: t.size, h: t.size };
    } else if (t.vertical) b = verticalBox(t);
    else {
      b = straightBox(t, g);
      if (warpOn(t)) { const e = warpExtent(t.warp.style, t.warp.bend); b = { x: b.x, y: b.y - e.up * b.h, w: b.w, h: b.h * (1 + e.up + e.down) }; }
    }
    if (extOn(t)) {
      const s = extrudeSteps(t.extrude.depth, t.extrude.angle, 0)[0];
      if (s) { const x0 = Math.min(b.x, b.x + s.dx), y0 = Math.min(b.y, b.y + s.dy); b = { x: x0, y: y0, w: Math.max(b.x + b.w, b.x + b.w + s.dx) - x0, h: Math.max(b.y + b.h, b.y + b.h + s.dy) - y0 }; }
    }
    return { x: Math.floor(b.x), y: Math.floor(b.y), w: Math.ceil(b.w) + 1, h: Math.ceil(b.h) + 1 };
  }

  /** is (x, y) on this text? path text: near a letter (its box would cover the whole curve); else in its box */
  function hit(t, x, y, g) {
    const pp = pathPlaces(t, g);
    if (pp) return pp.places.some((p) => p.on && Math.hypot(x - (p.x + Math.sin(p.a) * t.size * 0.35), y - (p.y - Math.cos(p.a) * t.size * 0.35)) <= Math.max(t.size * 0.6, p.w * 0.6));
    const b = box(t, g); return x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4;
  }

  /* ================================ drawing ================================ */
  function newCanvas(w, h) {
    const d = root.document; if (d && d.createElement) { const c = d.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
    if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
    return null;
  }
  /** the straight block (lines, caps, underline, strike) with its top-left at (ox, oy) */
  function drawBlock(g, t, ox, oy) {
    if (root.PCType && root.PCType.wants(t)) { root.PCType.drawAt(g, t, ox, oy); return; }   // 2.426.0
    g.save();
    g.font = fontOf(t); g.fillStyle = t.color || "#000"; g.textBaseline = "top"; g.textAlign = t.align || "left";
    if ("letterSpacing" in g) g.letterSpacing = ((t.tracking || 0) / 1000 * t.size).toFixed(2) + "px";
    const lh = t.size * (t.leading || 1.2), lines = strOf(t).split("\n"), th = Math.max(1, t.size / 14);
    lines.forEach((ln, i) => {
      const y = oy + i * lh; g.fillText(ln, ox, y);
      if ((t.underline || t.strike) && ln) {
        const w = g.measureText(ln).width, x = t.align === "center" ? ox - w / 2 : t.align === "right" ? ox - w : ox;
        if (t.underline) g.fillRect(x, y + t.size * 0.95, w, th);
        if (t.strike) g.fillRect(x, y + t.size * 0.52, w, th);
      }
    });
    g.restore();
  }
  function drawVertical(g, t) {
    g.save(); g.font = fontOf(t); g.fillStyle = t.color || "#000"; g.textBaseline = "top"; g.textAlign = "center";
    const step = t.size * (1 + (t.tracking || 0) / 1000), col = t.size * (t.leading || 1.2);
    strOf(t).split("\n").forEach((ln, i) => Array.from(ln).forEach((ch, j) => g.fillText(ch, t.x + col * i + col / 2, t.y + j * step)));
    g.restore();
  }
  function drawPath(g, t) {
    const pp = pathPlaces(t, g); if (!pp) return;
    g.save(); g.font = fontOf(t); g.fillStyle = t.color || "#000"; g.textBaseline = "alphabetic"; g.textAlign = "center";
    if ("letterSpacing" in g) g.letterSpacing = "0px";
    for (const p of pp.places) {
      if (!p.on || !pp.chars[p.i].trim()) continue;
      g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillText(pp.chars[p.i], 0, 0); g.restore();
    }
    g.restore();
  }
  function drawWarped(g, t) {
    const b = straightBox(t, g), m = Math.ceil(t.size * 0.4), T = newCanvas(b.w + 2 * m, b.h + 2 * m); if (!T) return drawBlock(g, t, t.x, t.y);
    const tg = T.getContext("2d");
    drawBlock(tg, t, t.x - b.x + m, m);
    const H = T.height;
    for (let x = 0; x < T.width; x++) {
      const u = Math.max(-1, Math.min(1, ((x - m) / Math.max(1, b.w)) * 2 - 1)), [a, c] = warpColumn(t.warp.style, t.warp.bend, u);
      const top = b.y - m + a * b.h, bot = b.y - m + H + c * b.h;
      if (bot - top > 0.5) g.drawImage(T, x, 0, 1, H, b.x - m + x, top, 1.02, bot - top);
    }
  }
  /** the face (no 3D) into g */
  function drawFace(g, t) {
    if (polyOf(t)) drawPath(g, t);
    else if (t.vertical) drawVertical(g, t);
    else if (warpOn(t)) drawWarped(g, t);
    else drawBlock(g, t, t.x, t.y);
  }
  function darker(hex, k) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "")); const n = m ? parseInt(m[1], 16) : 0;
    const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, "0");
    return "#" + f((n >> 16) & 255) + f((n >> 8) & 255) + f(n & 255);
  }
  /** a text layer drawn into g (the layer's canvas, cleared) */
  function draw(g, t) {
    if (!extOn(t)) { drawFace(g, t); return; }
    const W = g.canvas.width, H = g.canvas.height, F = newCanvas(W, H); if (!F) { drawFace(g, t); return; }
    const fg = F.getContext("2d"); drawFace(fg, t);
    const e = t.extrude, bx = box(Object.assign({}, t, { extrude: null }), g);
    const x0 = Math.max(0, bx.x - 2), y0 = Math.max(0, bx.y - 2), w = Math.min(W - x0, bx.w + 4), h = Math.min(H - y0, bx.h + 4);
    if (w > 0 && h > 0) {
      const side = newCanvas(w, h), sg = side.getContext("2d"), dark = newCanvas(w, h), dg = dark.getContext("2d");
      sg.drawImage(F, x0, y0, w, h, 0, 0, w, h); sg.globalCompositeOperation = "source-in"; sg.fillStyle = e.color || darker(t.color || "#000", 0.55); sg.fillRect(0, 0, w, h);
      dg.drawImage(F, x0, y0, w, h, 0, 0, w, h); dg.globalCompositeOperation = "source-in"; dg.fillStyle = "#000"; dg.fillRect(0, 0, w, h);
      for (const s of extrudeSteps(e.depth, e.angle, e.shade == null ? 0.5 : e.shade)) {
        g.drawImage(side, x0 + s.dx, y0 + s.dy);
        if (s.dark > 0) { g.save(); g.globalAlpha = s.dark; g.drawImage(dark, x0 + s.dx, y0 + s.dy); g.restore(); }
      }
    }
    g.drawImage(F, 0, 0);
  }

  /* ================================ the editor ================================ */
  function install(E) {
    const { S, D, doc, $, say, ctx, store } = E;
    const T = E.tools; if (!T || !T.type || !D) return;
    if (!doc.getElementById("pctextCss")) {
      const st = doc.createElement("style"); st.id = "pctextCss";
      st.textContent = ".pctext.pcshaped{background:rgba(20,18,15,.94)!important;color:#e8e2d6!important;border:1px solid var(--pc-accent)!important;padding:4px 6px!important;border-radius:4px;overflow:auto!important;white-space:pre-wrap!important}"
        + ".kx .pttog{min-width:24px;padding:2px 6px}.kx .pttog.on{border-color:var(--pc-accent);color:var(--pc-accent)}";
      doc.head.appendChild(st);
    }
    const isText = (L) => !!L && L.type === "text" && !!L.text;
    const curText = () => { const L = E.layer(); return isText(L) ? L : null; };

    /* ---- the options bar: caps / underline / strike / vertical, ⌒ Shape / 3D ---- */
    const baseOpt = T.type.options, baseBind = T.type.bindOptions;
    const TOG = [["caps", "TT", "All caps"], ["underline", "<u>U</u>", "Underline"], ["strike", "<s>S</s>", "Strikethrough"], ["vertical", "↕T", "Vertical (one letter under the next)"]];
    T.type.options = function () {
      const L = curText(), t = L ? L.text : null;
      return baseOpt.call(this) + `<span class="sep"></span>` + TOG.map(([k, lab, tip]) => `<button class="ghost pttog${(t ? t[k] : S["type_" + k]) ? " on" : ""}" data-tg="${k}" title="${tip}">${lab}</button>`).join("")
        + `<button class="ghost" id="ptShape" title="Warp the text, put it round a circle or along a path, make it 3D">⌒ Shape / 3D…</button>`;
    };
    T.type.bindOptions = function (o) {
      baseBind.call(this, o);
      o.querySelectorAll(".pttog").forEach((b) => { b.onclick = () => {
        const k = b.dataset.tg, L = curText();
        if (L) E.setLayer(L, k, (x) => { x.text[k] = !x.text[k]; }); else { S["type_" + k] = !S["type_" + k]; }
        E.renderOptions();
      }; });
      const sh = o.querySelector("#ptShape"); if (sh) sh.onclick = () => shapeDialog();
    };
    // new text picks up the toggles
    const baseDown = T.type.down;
    T.type.down = function (e, fx, fy) {
      const before = S.layers.length, r = baseDown.call(this, e, fx, fy);
      const L = S.layers.length > before ? curText() : null;
      if (L && !L.text.str) { for (const [k] of TOG) if (S["type_" + k]) L.text[k] = true; D.rasterize(L); }
      return r;
    };

    /* ---- Vertical Type ---- */
    T.vtype = Object.assign({}, T.type, { id: "vtype", name: "Vertical Type", cursor: "vertical-text",
      down(e, fx, fy) {
        const before = S.layers.length, r = T.type.down(e, fx, fy);
        const L = S.layers.length > before ? curText() : null;
        if (L && !L.text.str) { L.text.vertical = true; D.rasterize(L); }
        return r;
      } });

    /* ---- Type on a Path ---- */
    let draft = null, drag = null;
    const pathText = () => { const L = curText(); return L && L.text.path && L.text.path.kind === "curve" ? L : null; };
    const near = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by) <= 8 / (S.zoom || 1);
    function finish() {
      const d = draft; draft = null; E.drawOverlay();
      if (!d) return;
      const pts = simplify(d.pts, 1.5 / (S.zoom || 1) + 1, 40);
      if (pts.length < 2 || Math.hypot(pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]) < 6) { say("a path needs two points at least - click twice (or drag a line), then type"); return; }
      const [x0, y0] = pts[0], ts = E.typeSettings ? E.typeSettings() : {};
      const L = E.makeLayer("Text on a path", S.w, S.h, "text");
      L.text = Object.assign({}, D.TEXT_DEFAULT, ts, { str: "", x: Math.round(x0), y: Math.round(y0), align: "left",
        path: { kind: "curve", pts: pts.map(([x, y]) => [Math.round((x - x0) * 10) / 10, Math.round((y - y0) * 10) / 10]), offset: 0, flip: false } });
      for (const [k] of TOG) if (S["type_" + k] && k !== "vertical") L.text[k] = true;
      D.rasterize(L);
      E.addLayer(L, "text on a path", false);
      E.renderOptions(); if (E.editText) E.editText(L);
      say("type along the path - Ctrl+Enter or Esc commits; with this tool, drag a point of the path to reshape it");
    }
    T.typepath = {
      id: "typepath", name: "Type on a Path", cursor: "crosshair",
      options() {
        const L = pathText(), p = L ? L.text.path : null;
        return (p ? `<label title="Where along the path the text starts (%)">Start <input type="number" id="ptpOff" min="-100" max="100" value="${Math.round(p.offset || 0)}"></label>`
            + `<button class="ghost${p.flip ? " on" : ""}" id="ptpFlip" title="The text on the other side of the path">⇅ Flip</button><button class="ghost" id="ptpEdit" title="Type in it">✎ Edit</button>`
            + `<span style="color:var(--pc-dim)">drag a point to reshape · click elsewhere to start a new path</span>`
          : `<span style="color:var(--pc-dim)">click points along the path (double-click or Enter to finish) or drag a line - then type · Esc cancels</span>`)
          + `<button class="ghost" id="ptpShape" title="Warp, circle, 3D">⌒ Shape / 3D…</button>`;
      },
      bindOptions(o) {
        const L = pathText();
        const off = o.querySelector("#ptpOff"); if (off && L) off.onchange = () => E.setLayer(L, "path start", (x) => { x.text.path.offset = Math.max(-100, Math.min(100, +off.value || 0)); });
        const fl = o.querySelector("#ptpFlip"); if (fl && L) fl.onclick = () => { E.setLayer(L, "flip path text", (x) => { x.text.path.flip = !x.text.path.flip; }); E.renderOptions(); };
        const ed = o.querySelector("#ptpEdit"); if (ed && L && E.editText) ed.onclick = () => E.editText(L);
        o.querySelector("#ptpShape").onclick = () => shapeDialog();
      },
      down(e, fx, fy) {
        if (E.endText && doc.querySelector(".kx .pctext")) { E.endText(); return false; }
        const L = pathText();
        if (L && !draft) {
          const i = L.text.path.pts.findIndex((q) => near(L.text.x + q[0], L.text.y + q[1], fx, fy));
          if (i >= 0) { drag = { L, i }; return; }
          if (hit(L.text, fx, fy, ctx(L.canvas)) && E.editText) { E.editText(L); return false; }
        }
        if (draft) {
          const last = draft.pts[draft.pts.length - 1];
          if (e.detail >= 2 || near(last[0], last[1], fx, fy)) { finish(); return false; }
          draft.pts.push([fx, fy]); draft.down = [fx, fy]; E.drawOverlay(); return;
        }
        draft = { pts: [[fx, fy]], down: [fx, fy], free: false }; E.drawOverlay();
      },
      move(e, fx, fy) {
        if (drag) { const { L, i } = drag; E.liveSet(L, (x) => { x.text.path.pts[i] = [fx - x.text.x, fy - x.text.y]; }); return; }
        if (draft && draft.down) {
          if (!draft.free && Math.hypot(fx - draft.down[0], fy - draft.down[1]) > 6) draft.free = true;
          if (draft.free) { const l = draft.pts[draft.pts.length - 1]; if (Math.hypot(fx - l[0], fy - l[1]) >= 3) draft.pts.push([fx, fy]); }
          E.drawOverlay();
        }
      },
      up() {
        if (drag) { drag = null; E.commitLive("reshape the path"); return; }
        if (draft) { draft.down = null; if (draft.free) finish(); }
      },
      dblclick() { if (draft) finish(); },
      leave() { draft = null; drag = null; E.drawOverlay(); },
    };
    doc.addEventListener("keydown", (e) => {
      if (S.tool !== "typepath" || !draft) return;
      if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); finish(); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); draft = null; E.drawOverlay(); say("path cancelled"); }
    }, true);
    E.overlayHooks.push((g, px) => {
      const L = S.tool === "typepath" ? pathText() : null;
      const line = (pts, dash) => { if (pts.length < 2) return; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.lineWidth = 1.5 * px; g.setLineDash([]); g.strokeStyle = "#000"; g.stroke(); g.strokeStyle = "#fff"; g.setLineDash(dash ? [4 * px, 4 * px] : []); g.stroke(); g.setLineDash([]); };
      const dots = (pts) => { for (const [x, y] of pts) { g.fillStyle = "#fff"; g.fillRect(x - 3.5 * px, y - 3.5 * px, 7 * px, 7 * px); g.strokeStyle = "#000"; g.lineWidth = px; g.strokeRect(x - 3.5 * px, y - 3.5 * px, 7 * px, 7 * px); } };
      if (L) { const abs = L.text.path.pts.map((q) => [L.text.x + q[0], L.text.y + q[1]]); line(catmull(abs, 12), true); dots(abs); }
      if (draft) { line(draft.free ? draft.pts : catmull(draft.pts, 12), false); if (!draft.free) dots(draft.pts); }
    });

    /* ---- ⌒ Shape / 3D: warp, circle, path, 3D, caps ... live ---- */
    function shapeDialog() {
      const L = curText(); if (!L) return say("pick a text layer first (the T tool makes one)");
      const t = L.text, ui = E.ui; if (!ui || !ui.dialog) return;
      const w = t.warp || { style: "none", bend: 50 }, p = t.path || null, x = t.extrude || { on: false, depth: 14, angle: 135, color: null, shade: 0.5 };
      const mode = p ? (p.kind === "circle" ? "circle" : "curve") : warpOn(t) ? "warp" : "none";
      const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
      const html = `<div class="rw"><span>Shape</span><select id="tsMode" style="grid-column:1/3">
          ${[["none", "Straight"], ["warp", "Warp"], ["circle", "Round a circle"], ["curve", "Along a drawn path"]].map(([v, l]) => `<option value="${v}"${v === mode ? " selected" : ""}${v === "curve" && !(p && p.kind === "curve") ? " disabled" : ""}>${l}</option>`).join("")}</select></div>
        <div id="tsWarp"><div class="rw"><span>Warp style</span><select id="tsWS">${WARPS.slice(1).map(([v, l]) => `<option value="${v}"${v === (w.style === "none" ? "arc" : w.style) ? " selected" : ""}>${l}</option>`).join("")}</select></div>
          <div class="rw"><label>Bend (%)</label><input type="range" id="tsWB" min="-100" max="100" value="${w.bend == null ? 50 : w.bend}"><input type="number" id="tsWBn" min="-100" max="100" value="${w.bend == null ? 50 : w.bend}"></div></div>
        <div id="tsCirc"><div class="rw"><label>Radius (px)</label><input type="range" id="tsCR" min="10" max="2000" value="${Math.round((p && p.kind === "circle" ? p.r : 160))}"><input type="number" id="tsCRn" min="10" max="4000" value="${Math.round((p && p.kind === "circle" ? p.r : 160))}"></div>
          <div class="rw"><label>Centre angle (°)</label><input type="range" id="tsCS" min="-180" max="180" value="${p && p.kind === "circle" ? p.start || 0 : 0}"><input type="number" id="tsCSn" min="-180" max="180" value="${p && p.kind === "circle" ? p.start || 0 : 0}"></div>
          <div class="rw"><span>Text on the</span><select id="tsCSide"><option value="top"${!(p && p.side === "bottom") ? " selected" : ""}>top (outside)</option><option value="bottom"${p && p.side === "bottom" ? " selected" : ""}>bottom (reads left to right)</option></select></div></div>
        <div id="tsCurve"><div class="rw"><label>Start along the path (%)</label><input type="number" id="tsPO" min="-100" max="100" value="${p && p.kind === "curve" ? Math.round(p.offset || 0) : 0}"></div>
          <div class="rw"><label><input type="checkbox" id="tsPF" ${p && p.flip ? "checked" : ""}> Flip to the other side</label></div></div>
        <div class="kxrow" style="margin-top:6px"><b>3D</b></div>
        <div class="rw"><label><input type="checkbox" id="ts3" ${x.on ? "checked" : ""}> Extrude the letters (3D)</label></div>
        <div class="rw"><label>Depth (px)</label><input type="range" id="ts3D" min="1" max="120" value="${x.depth || 14}"><input type="number" id="ts3Dn" min="1" max="200" value="${x.depth || 14}"></div>
        <div class="rw"><label>Direction (°)</label><input type="range" id="ts3A" min="-180" max="180" value="${x.angle == null ? 135 : x.angle}"><input type="number" id="ts3An" min="-180" max="180" value="${x.angle == null ? 135 : x.angle}"></div>
        <div class="rw"><label>Shading to the back (%)</label><input type="range" id="ts3S" min="0" max="100" value="${Math.round((x.shade == null ? 0.5 : x.shade) * 100)}"><input type="number" id="ts3Sn" min="0" max="100" value="${Math.round((x.shade == null ? 0.5 : x.shade) * 100)}"></div>
        <div class="rw"><label><input type="checkbox" id="ts3Auto" ${x.color ? "" : "checked"}> Sides in the text's colour, darker</label></div>
        <div class="rw"><span>Side colour</span><input type="color" id="ts3C" value="${esc(x.color || darker(t.color || "#000000", 0.55))}"></div>
        <div class="kxrow" style="margin-top:6px"><b>Letters</b></div>
        <div class="kxrow">${TOG.map(([k, lab, tip]) => `<label title="${tip}"><input type="checkbox" data-tsk="${k}" ${t[k] ? "checked" : ""}> ${tip.replace(/ \(.*/, "")}</label>`).join(" ")}</div>
        <div style="color:var(--pc-dim);font-size:11px;margin-top:4px">Tip: Layer ▸ Layer Style ▸ Bevel & Emboss rounds the face of 3D text; the Styles list has Gold, Chrome, Neon…</div>`;
      ui.dialog("Text Shape / 3D", html, () => { E.commitLive("text shape"); }, { wide: true, cancel: () => E.cancelLive(), init(d) {
        const q = (id) => d.querySelector("#" + id), body = d.querySelector(".pcdb");
        if (body) { body.style.maxHeight = "min(68vh, 600px)"; body.style.overflow = "auto"; }   // a short editor still reaches OK
        const show = () => { const m = q("tsMode").value; q("tsWarp").style.display = m === "warp" ? "" : "none"; q("tsCirc").style.display = m === "circle" ? "" : "none"; q("tsCurve").style.display = m === "curve" ? "" : "none"; };
        const pair = (a, b) => { const A = q(a), B = q(b); A.addEventListener("input", () => { B.value = A.value; apply(); }); B.addEventListener("change", () => { A.value = B.value; apply(); }); };
        const keepCurve = p && p.kind === "curve" ? JSON.parse(JSON.stringify(p)) : null;
        function apply() {
          show();
          E.liveSet(L, (y) => {
            const tt = y.text, m = q("tsMode").value, sb = straightBox(Object.assign({}, tt, { path: null, warp: null, extrude: null }), ctx(y.canvas));
            const wasCircle = tt.path && tt.path.kind === "circle";
            tt.warp = m === "warp" ? { style: q("tsWS").value, bend: +q("tsWBn").value || 0 } : null;
            if (m === "circle") {
              const r = Math.max(10, +q("tsCRn").value || 160);
              if (!wasCircle) { tt.align = "center"; tt.x = Math.round(sb.x + sb.w / 2); tt.y = Math.round(sb.y + r + tt.size); }
              tt.path = { kind: "circle", r, start: +q("tsCSn").value || 0, side: q("tsCSide").value };
            } else if (m === "curve" && keepCurve) {
              tt.path = Object.assign({}, keepCurve, { offset: +q("tsPO").value || 0, flip: q("tsPF").checked });
            } else {
              if (wasCircle) { const b0 = box(tt, ctx(y.canvas)); tt.x = b0.x; tt.y = b0.y; tt.align = "left"; }
              tt.path = null;
            }
            tt.extrude = q("ts3").checked ? { on: true, depth: Math.max(1, +q("ts3Dn").value || 14), angle: +q("ts3An").value || 0, shade: Math.max(0, Math.min(100, +q("ts3Sn").value)) / 100,
              color: q("ts3Auto").checked ? null : q("ts3C").value } : null;
            d.querySelectorAll("[data-tsk]").forEach((c) => { tt[c.dataset.tsk] = c.checked; });
          });
        }
        pair("tsWB", "tsWBn"); pair("tsCR", "tsCRn"); pair("tsCS", "tsCSn"); pair("ts3D", "ts3Dn"); pair("ts3A", "ts3An"); pair("ts3S", "ts3Sn");
        for (const id of ["tsMode", "tsWS", "tsCSide", "tsPO", "tsPF", "ts3", "ts3Auto", "ts3C"]) q(id).addEventListener("change", apply);
        q("ts3C").addEventListener("input", () => { q("ts3Auto").checked = false; apply(); });
        d.querySelectorAll("[data-tsk]").forEach((c) => c.addEventListener("change", apply));
        show();
      } });
    }
    E.textShapeDialog = shapeDialog;
    if (E.ui && E.ui.addCmd) {
      const hasT = () => !!curText();
      E.ui.addCmd("type.shape", "Text Shape: Warp · Circle · Path · 3D…", "", () => shapeDialog(), { enabled: hasT }, ["Layer", null, true]);
      E.ui.addCmd("type.vertical", "Text Orientation: Vertical / Horizontal", "", () => { const L = curText(); E.setLayer(L, "text orientation", (x) => { x.text.vertical = !x.text.vertical; }); }, { enabled: hasT });
      E.ui.addCmd("type.pathtool", "Type on a Path Tool", "", () => E.setTool && E.setTool("typepath"), {});
    }
    void store; void $;
  }

  const api = { WARPS, warpColumn, warpExtent, catmull, circlePoly, arcTable, pointAt, layoutPath, polyOf, simplify, extrudeSteps, wants, scalePath,
    box, straightBox, draw, install, darker, hit };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document) root.PCText = api;
})(typeof window !== "undefined" ? window : globalThis);
