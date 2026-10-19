/* pcsketchcad.js — CAD extras for SKETCH LAYERS (2.464.0), window.PCSketchCAD (pure: no page, no editor).
 *
 * Tim (verbatim): "continue with the photoshop gap closure. add cad tools, create sketch layers for cad in image editor"
 * - a sketch layer "something like fusion 360 sketch". This is the measuring and the CAD file side of it:
 *
 *   measure(s, items)        what the Measure tool shows for the picked points / entities:
 *                            -> {title, rows: [[label, value, unit]]} | null
 *   regionAt(s, x, y)        the closed region (profile) under (x, y), its holes taken out: {area, perimeter, holes, profile}
 *   loopArea / loopLength    exact (lines, arcs, circles; splines finely flattened)
 *   toSVG(s, o)              the sketch as an SVG document (the picture's own px; o.unit "mm" / "in" + o.scale = a real size)
 *   toDXF(s, o)              the sketch as an ASCII DXF (R12 / AC1009: LINE, CIRCLE, ARC, POINT, POLYLINE for splines,
 *                            TEXT for the dimensions); the sketch's ORIGIN is the drawing's 0,0 and y goes up;
 *                            o.scale = drawing units per px, o.unit "mm" | "in" | "" ($INSUNITS)
 *   parseDXF(text)           LINE, CIRCLE, ARC, POINT, LWPOLYLINE + POLYLINE (bulges = arcs), SPLINE (fit or control
 *                            points), ELLIPSE (a circle / an arc when round, else a spline through it) ->
 *                            {items, skipped: {TYPE: n}, units, bounds}
 *   addDXF(s, parsed, o)     into a sketch: o.place "origin" (0,0 = the origin, o.scale px per unit) | "fit" (scaled
 *                            to o.w x o.h); ends that meet share ONE point (so closed outlines are profiles at once)
 */
(function (root) {
  "use strict";
  let K0 = null;
  const K = () => K0 || (K0 = root.PCSketch || (typeof require === "function" ? require("./pcsketch.js") : null));
  const hyp = Math.hypot, TAU = Math.PI * 2;
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const deg = (r) => r * 180 / Math.PI;

  /* ================================ measuring ================================ */
  const radOf = (s, e) => { const S = K(); if (e.t === "circle") return e.r; const c = S.pt(s, e.c), a = S.pt(s, e.p1); return hyp(a.x - c.x, a.y - c.y); };
  /** an entity's length (a line, a circle's circumference, an arc, a spline) */
  function entLength(s, e) {
    const S = K(), P = (id) => S.pt(s, id);
    if (e.t === "line") return hyp(P(e.p2).x - P(e.p1).x, P(e.p2).y - P(e.p1).y);
    if (e.t === "circle") return TAU * e.r;
    if (e.t === "arc") { const A = S.arcAngles(s, e); return A.r * (A.a1 - A.a0); }
    if (e.t === "spline") { const q = S.splinePoly(s, e, 48); let L = 0; for (let i = 1; i < q.length; i++) L += hyp(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]); return L; }
    return 0;
  }
  /** the angle of a direction (dx, dy in the picture, y down) from level, anticlockwise as seen: 0 - 360 */
  const angleOf = (dx, dy) => { let a = deg(Math.atan2(-dy, dx)); if (a < 0) a += 360; return a; };
  function measure(s, items) {
    const S = K(), P = (id) => S.pt(s, id);
    const pts = items.filter((q) => q.k === "pt").map((q) => q.id).concat(items.filter((q) => q.k === "ent").map((q) => S.ent(s, q.id)).filter((e) => e && e.t === "point").map((e) => e.p1));
    const E = items.filter((q) => q.k === "ent").map((q) => S.ent(s, q.id)).filter((e) => e && e.t !== "point");
    const lines = E.filter((e) => e.t === "line"), rounds = E.filter((e) => e.t === "circle" || e.t === "arc");
    const px = "px", dg = "°";
    if (pts.length === 2 && !E.length) {
      const a = P(pts[0]), b = P(pts[1]);
      return { title: "Two points", rows: [["Distance", hyp(b.x - a.x, b.y - a.y), px], ["ΔX", Math.abs(b.x - a.x), px], ["ΔY", Math.abs(b.y - a.y), px], ["Angle from level", angleOf(b.x - a.x, b.y - a.y), dg]] };
    }
    if (pts.length === 1 && lines.length === 1 && E.length === 1) {
      const p = P(pts[0]), e = lines[0], a = P(e.p1), b = P(e.p2), u = [b.x - a.x, b.y - a.y], L = hyp(u[0], u[1]) || 1;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * u[0] + (p.y - a.y) * u[1]) / (L * L)));
      return { title: "Point + line", rows: [["Distance to the line", Math.abs(u[0] * (p.y - a.y) - u[1] * (p.x - a.x)) / L, px], ["Nearest distance to the segment", hyp(a.x + t * u[0] - p.x, a.y + t * u[1] - p.y), px]] };
    }
    if (pts.length === 1 && rounds.length === 1 && E.length === 1) {
      const p = P(pts[0]), e = rounds[0], c = P(e.c), d = hyp(p.x - c.x, p.y - c.y);
      return { title: "Point + circle", rows: [["To the centre", d, px], ["To the edge", Math.abs(d - radOf(s, e)), px]] };
    }
    if (pts.length) return null;
    if (E.length === 1) {
      const e = E[0];
      if (e.t === "line") { const a = P(e.p1), b = P(e.p2); return { title: "Line", rows: [["Length", hyp(b.x - a.x, b.y - a.y), px], ["Angle from level", angleOf(b.x - a.x, b.y - a.y) % 180, dg], ["ΔX", Math.abs(b.x - a.x), px], ["ΔY", Math.abs(b.y - a.y), px]] }; }
      if (e.t === "circle") return { title: "Circle", rows: [["Radius", e.r, px], ["Diameter", 2 * e.r, px], ["Circumference", TAU * e.r, px], ["Area", Math.PI * e.r * e.r, "px²"]] };
      if (e.t === "arc") { const A = S.arcAngles(s, e); return { title: "Arc", rows: [["Radius", A.r, px], ["Sweep", deg(A.a1 - A.a0), dg], ["Arc length", A.r * (A.a1 - A.a0), px], ["Chord", hyp(P(e.p2).x - P(e.p1).x, P(e.p2).y - P(e.p1).y), px]] }; }
      if (e.t === "spline") { const a = P(e.pts[0]), b = P(e.pts[e.pts.length - 1]); return { title: "Spline", rows: [["Length", entLength(s, e), px], ["End to end", hyp(b.x - a.x, b.y - a.y), px]] }; }
    }
    if (E.length === 2 && lines.length === 2) {
      const [l1, l2] = lines, u = [P(l1.p2).x - P(l1.p1).x, P(l1.p2).y - P(l1.p1).y], w = [P(l2.p2).x - P(l2.p1).x, P(l2.p2).y - P(l2.p1).y];
      const cr = u[0] * w[1] - u[1] * w[0], a = deg(Math.abs(Math.atan2(cr, u[0] * w[0] + u[1] * w[1]))), acute = Math.min(a, 180 - a);
      if (Math.abs(cr) / ((hyp(...u) * hyp(...w)) || 1) < 1e-6) {
        const p = P(l2.p1), q = P(l1.p1), L = hyp(...u) || 1;
        return { title: "Two parallel lines", rows: [["Distance apart", Math.abs(u[0] * (p.y - q.y) - u[1] * (p.x - q.x)) / L, px], ["Angle", 0, dg]] };
      }
      return { title: "Two lines", rows: [["Angle", acute, dg], ["Its supplement", 180 - acute, dg]] };
    }
    if (E.length === 2 && rounds.length === 2) {
      const [a, b] = rounds, ca = P(a.c), cb = P(b.c), d = hyp(cb.x - ca.x, cb.y - ca.y), ra = radOf(s, a), rb = radOf(s, b);
      return { title: "Two circles / arcs", rows: [["Centre to centre", d, px], ["Gap between them", d - ra - rb, px], ["Radii", ra, px], ["", rb, px]] };
    }
    if (E.length === 2 && lines.length === 1 && rounds.length === 1) {
      const l = lines[0], c = P(rounds[0].c), a = P(l.p1), b = P(l.p2), u = [b.x - a.x, b.y - a.y], L = hyp(u[0], u[1]) || 1, d = Math.abs(u[0] * (c.y - a.y) - u[1] * (c.x - a.x)) / L;
      return { title: "Line + circle", rows: [["Centre to the line", d, px], ["Gap (edge to the line)", d - radOf(s, rounds[0]), px]] };
    }
    if (E.length) return { title: `${E.length} entities`, rows: [["Total length", E.reduce((t, e) => t + entLength(s, e), 0), px]] };
    return null;
  }
  /** a profile loop's exact signed area (Green: lines + arcs exact, splines flattened) and length */
  function loopStats(s, loop) {
    const S = K(), P = (id) => S.pt(s, id);
    let A = 0, L = 0;
    const seg = (a, b) => { A += (a[0] * b[1] - b[0] * a[1]) / 2; L += hyp(b[0] - a[0], b[1] - a[1]); };
    const arcPart = (cx, cy, r, t0, t1) => { A += (r * cx * (Math.sin(t1) - Math.sin(t0)) - r * cy * (Math.cos(t1) - Math.cos(t0)) + r * r * (t1 - t0)) / 2; L += Math.abs(r * (t1 - t0)); };
    for (const { e: id, rev } of loop) {
      const e = typeof id === "string" ? S.ent(s, id) : id; if (!e) continue;
      if (e.t === "line") { const a = P(rev ? e.p2 : e.p1), b = P(rev ? e.p1 : e.p2); seg([a.x, a.y], [b.x, b.y]); }
      else if (e.t === "circle") { const c = P(e.c); arcPart(c.x, c.y, e.r, 0, TAU); }
      else if (e.t === "arc") { const Q = S.arcAngles(s, e); if (rev) arcPart(Q.cx, Q.cy, Q.r, Q.a1, Q.a0); else arcPart(Q.cx, Q.cy, Q.r, Q.a0, Q.a1); }
      else if (e.t === "spline") { const q = S.splinePoly(s, e, 48); if (rev) q.reverse(); for (let i = 1; i < q.length; i++) seg(q[i - 1], q[i]); }
    }
    return { area: A, length: L };
  }
  const loopArea = (s, loop) => Math.abs(loopStats(s, loop).area);
  const loopLength = (s, loop) => loopStats(s, loop).length;
  /** the innermost closed region under (x, y) - its own holes are not it */
  function regionAt(s, x, y) {
    const S = K(), pr = S.profiles(s, { withPaths: false });
    let best = null;
    for (const p of pr) {
      if (!S.inside([x, y], p.poly)) continue;
      if ((p.holes || []).some((h) => S.inside([x, y], h.poly))) continue;
      if (!best || p.area < best.area) best = p;
    }
    if (!best) return null;
    const outer = loopStats(s, best.loop), holes = (best.holes || []).map((h) => loopStats(s, h.loop));
    return { profile: best, area: Math.abs(outer.area) - holes.reduce((t, h) => t + Math.abs(h.area), 0), perimeter: outer.length + holes.reduce((t, h) => t + h.length, 0), outer: outer.length, holes: holes.length };
  }

  /* ================================ SVG ================================ */
  const n6 = (v) => String(Math.round(v * 1e4) / 1e4);
  function entD(s, e) {
    const S = K(), P = (id) => S.pt(s, id);
    if (e.t === "line") { const a = P(e.p1), b = P(e.p2); return `M${n6(a.x)} ${n6(a.y)}L${n6(b.x)} ${n6(b.y)}`; }
    if (e.t === "circle") { const c = P(e.c), r = e.r; return `M${n6(c.x + r)} ${n6(c.y)}A${n6(r)} ${n6(r)} 0 1 1 ${n6(c.x - r)} ${n6(c.y)}A${n6(r)} ${n6(r)} 0 1 1 ${n6(c.x + r)} ${n6(c.y)}Z`; }
    if (e.t === "arc") { const A = S.arcAngles(s, e), a = P(e.p1), b = P(e.p2); return `M${n6(a.x)} ${n6(a.y)}A${n6(A.r)} ${n6(A.r)} 0 ${A.a1 - A.a0 > Math.PI ? 1 : 0} 1 ${n6(b.x)} ${n6(b.y)}`; }
    if (e.t === "spline") { const B = S.splineBez(s, e); if (!B.length) return ""; return `M${n6(B[0][0][0])} ${n6(B[0][0][1])}` + B.map((b) => `C${n6(b[1][0])} ${n6(b[1][1])} ${n6(b[2][0])} ${n6(b[2][1])} ${n6(b[3][0])} ${n6(b[3][1])}`).join(""); }
    return "";
  }
  /** a pcpath sub -> SVG path data */
  function subD(sub) {
    const p = sub.pts; if (!p.length) return "";
    let d = `M${n6(p[0].x)} ${n6(p[0].y)}`;
    const n = p.length, last = sub.closed ? n : n - 1;
    for (let i = 0; i < last; i++) { const a = p[i], b = p[(i + 1) % n]; d += `C${n6(a.ox)} ${n6(a.oy)} ${n6(b.ix)} ${n6(b.iy)} ${n6(b.x)} ${n6(b.y)}`; }
    return d + (sub.closed ? "Z" : "");
  }
  const xesc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function toSVG(s, o) {
    const S = K(), opt = o || {}, st = s.style || {}, W = opt.w || 1000, H = opt.h || 1000;
    const scale = +opt.scale > 0 ? +opt.scale : 1, unit = opt.unit === "mm" || opt.unit === "in" ? opt.unit : "";
    const size = unit ? `width="${n6(W * scale)}${unit}" height="${n6(H * scale)}${unit}"` : `width="${W}" height="${H}"`;
    const out = [`<?xml version="1.0" encoding="UTF-8"?>`, `<svg xmlns="http://www.w3.org/2000/svg" ${size} viewBox="0 0 ${W} ${H}">`, `<title>${xesc(opt.title || "sketch")}</title>`];
    if (st.fill) {
      const pr = S.profiles(s);
      const tops = pr.filter((x) => !pr.some((y) => y !== x && (y.holes || []).includes(x)));
      out.push(`<g id="profiles" fill="${xesc(st.fill)}" fill-rule="evenodd" stroke="none">` + tops.map((p) => `<path d="${p.path.subs.map(subD).join("")}"/>`).join("") + `</g>`);
    }
    out.push(`<g id="sketch" fill="none" stroke="${xesc(st.color || "#000000")}" stroke-width="${n6(st.w || 2)}" stroke-linecap="round" stroke-linejoin="round">`);
    for (const e of s.ents) if (!e.cons && e.t !== "point") { const d = entD(s, e); if (d) out.push(`<path id="${xesc(e.id)}" d="${d}"/>`); }
    out.push(`</g>`);
    if (opt.construction) {
      out.push(`<g id="construction" fill="none" stroke="#e8a33a" stroke-width="1" stroke-dasharray="6 4">`);
      for (const e of s.ents) if (e.cons && !e.axis && e.t !== "point") { const d = entD(s, e); if (d) out.push(`<path id="${xesc(e.id)}" d="${d}"/>`); }
      out.push(`</g>`);
    }
    const pts = s.ents.filter((e) => e.t === "point" && !e.cons);
    if (pts.length) out.push(`<g id="points" fill="${xesc(st.color || "#000000")}">` + pts.map((e) => { const p = S.pt(s, e.p1); return `<circle cx="${n6(p.x)}" cy="${n6(p.y)}" r="${n6(Math.max(1, (st.w || 2)))}"/>`; }).join("") + `</g>`);
    if (opt.dims) {
      out.push(`<g id="dimensions" fill="none" stroke="#555555" stroke-width="1">`);
      for (const m of s.dims) { const G = S.dimGeom(s, m); if (!G) continue; out.push(`<path d="${G.lines.map((l) => `M${n6(l[0])} ${n6(l[1])}L${n6(l[2])} ${n6(l[3])}`).join("")}"/><text x="${n6(G.x)}" y="${n6(G.y)}" fill="#555555" stroke="none" font-family="sans-serif" font-size="12" text-anchor="middle" dominant-baseline="middle">${xesc(G.text)}</text>`); }
      out.push(`</g>`);
    }
    out.push(`</svg>`);
    return out.join("\n") + "\n";
  }

  /* ================================ DXF out ================================ */
  const UNITS = { "": 0, in: 1, mm: 4 };
  function toDXF(s, o) {
    const S = K(), opt = o || {}, k = +opt.scale > 0 ? +opt.scale : 1, O = S.pt(s, s.origin.pt);
    const X = (x) => r6((x - O.x) * k), Y = (y) => r6((O.y - y) * k);
    const out = [];
    const g = (code, v) => { out.push(String(code)); out.push(String(v)); };
    const ents = s.ents.filter((e) => !e.axis && (!e.cons || opt.construction));
    // the extents
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const grow = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
    for (const e of ents) {
      if (e.t === "circle") { const c = S.pt(s, e.c); grow(X(c.x - e.r), Y(c.y + e.r)); grow(X(c.x + e.r), Y(c.y - e.r)); }
      else if (e.t === "arc") { const A = S.arcAngles(s, e); grow(X(A.cx - A.r), Y(A.cy + A.r)); grow(X(A.cx + A.r), Y(A.cy - A.r)); }
      else for (const id of S.ptsOf(e)) { const p = S.pt(s, id); grow(X(p.x), Y(p.y)); }
    }
    if (!isFinite(x0)) { x0 = y0 = x1 = y1 = 0; }
    g(0, "SECTION"); g(2, "HEADER");
    g(9, "$ACADVER"); g(1, "AC1009");
    g(9, "$INSUNITS"); g(70, UNITS[opt.unit] || 0);
    g(9, "$EXTMIN"); g(10, x0); g(20, y0); g(30, 0);
    g(9, "$EXTMAX"); g(10, x1); g(20, y1); g(30, 0);
    g(0, "ENDSEC");
    g(0, "SECTION"); g(2, "TABLES");
    g(0, "TABLE"); g(2, "LTYPE"); g(70, 2);
    g(0, "LTYPE"); g(2, "CONTINUOUS"); g(70, 0); g(3, "Solid line"); g(72, 65); g(73, 0); g(40, 0);
    g(0, "LTYPE"); g(2, "DASHED"); g(70, 0); g(3, "Dashed __ __ __"); g(72, 65); g(73, 2); g(40, r6(10 * k)); g(49, r6(6 * k)); g(49, r6(-4 * k));
    g(0, "ENDTAB");
    g(0, "TABLE"); g(2, "LAYER"); g(70, 3);
    g(0, "LAYER"); g(2, "0"); g(70, 0); g(62, 7); g(6, "CONTINUOUS");
    g(0, "LAYER"); g(2, "CONSTRUCTION"); g(70, 0); g(62, 30); g(6, "DASHED");
    g(0, "LAYER"); g(2, "DIMENSIONS"); g(70, 0); g(62, 8); g(6, "CONTINUOUS");
    g(0, "ENDTAB");
    g(0, "ENDSEC");
    g(0, "SECTION"); g(2, "ENTITIES");
    const lay = (e) => (e.cons ? "CONSTRUCTION" : "0");
    let n = 0;
    for (const e of ents) {
      const P = (id) => S.pt(s, id);
      if (e.t === "line") { const a = P(e.p1), b = P(e.p2); g(0, "LINE"); g(8, lay(e)); g(10, X(a.x)); g(20, Y(a.y)); g(30, 0); g(11, X(b.x)); g(21, Y(b.y)); g(31, 0); n++; }
      else if (e.t === "circle") { const c = P(e.c); g(0, "CIRCLE"); g(8, lay(e)); g(10, X(c.x)); g(20, Y(c.y)); g(30, 0); g(40, r6(e.r * k)); n++; }
      else if (e.t === "arc") {
        // the picture's arc runs a0 -> a1 (y down); with y up that is -a1 -> -a0 anticlockwise
        const A = S.arcAngles(s, e), nd = (v) => { let d = deg(v) % 360; if (d < 0) d += 360; return r6(d); };
        g(0, "ARC"); g(8, lay(e)); g(10, X(A.cx)); g(20, Y(A.cy)); g(30, 0); g(40, r6(A.r * k)); g(50, nd(-A.a1)); g(51, nd(-A.a0)); n++;
      }
      else if (e.t === "point") { const p = P(e.p1); g(0, "POINT"); g(8, lay(e)); g(10, X(p.x)); g(20, Y(p.y)); g(30, 0); n++; }
      else if (e.t === "spline") {
        const q = S.splinePoly(s, e, 16);
        g(0, "POLYLINE"); g(8, lay(e)); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, 0);
        for (const v of q) { g(0, "VERTEX"); g(8, lay(e)); g(10, X(v[0])); g(20, Y(v[1])); g(30, 0); }
        g(0, "SEQEND"); g(8, lay(e)); n++;
      }
    }
    if (opt.dims) for (const m of s.dims) {
      const G = S.dimGeom(s, m); if (!G) continue;
      for (const l of G.lines) { g(0, "LINE"); g(8, "DIMENSIONS"); g(10, X(l[0])); g(20, Y(l[1])); g(30, 0); g(11, X(l[2])); g(21, Y(l[3])); g(31, 0); }
      g(0, "TEXT"); g(8, "DIMENSIONS"); g(10, X(G.x)); g(20, Y(G.y)); g(30, 0); g(40, r6(10 * k)); g(1, String(G.text).replace(/[\r\n]/g, " ")); g(72, 1); g(73, 2); g(11, X(G.x)); g(21, Y(G.y)); g(31, 0);
    }
    g(0, "ENDSEC");
    g(0, "EOF");
    void n;
    return out.join("\r\n") + "\r\n";
  }
  function r6(v) { const x = Math.round(v * 1e6) / 1e6; return Object.is(x, -0) ? 0 : x; }

  /* ================================ DXF in ================================ */
  function parseDXF(text) {
    const lines = String(text || "").split(/\r\n|\r|\n/);
    const pairs = [];
    for (let i = 0; i + 1 < lines.length; i += 2) { const c = parseInt(lines[i].trim(), 10); if (!Number.isFinite(c)) { i--; continue; } pairs.push([c, lines[i + 1].replace(/^\s+|\s+$/g, "")]); }
    // the header's units + the entities section
    let units = 0, inEnt = false, sec = null;
    const raw = [];
    for (let i = 0; i < pairs.length; i++) {
      const [c, v] = pairs[i];
      if (c === 0 && v === "SECTION") { sec = (pairs[i + 1] || [])[1]; inEnt = sec === "ENTITIES"; i++; continue; }
      if (c === 0 && v === "ENDSEC") { inEnt = false; sec = null; continue; }
      if (sec === "HEADER" && c === 9 && v === "$INSUNITS") { const n = pairs[i + 1]; if (n) units = +n[1] || 0; continue; }
      if (!inEnt) continue;
      if (c === 0) raw.push({ type: v, g: [] }); else if (raw.length) raw[raw.length - 1].g.push([c, v]);
    }
    const items = [], skipped = {};
    const num = (g, c, d) => { const f = g.find((q) => q[0] === c); return f ? +f[1] : d; };
    const skip = (t) => { skipped[t] = (skipped[t] || 0) + 1; };
    for (let i = 0; i < raw.length; i++) {
      const E = raw[i], g = E.g, layer = (g.find((q) => q[0] === 8) || [0, "0"])[1];
      switch (E.type) {
        case "LINE": items.push({ t: "line", a: [num(g, 10, 0), num(g, 20, 0)], b: [num(g, 11, 0), num(g, 21, 0)], layer }); break;
        case "CIRCLE": items.push({ t: "circle", c: [num(g, 10, 0), num(g, 20, 0)], r: num(g, 40, 0), layer }); break;
        case "ARC": items.push({ t: "arc", c: [num(g, 10, 0), num(g, 20, 0)], r: num(g, 40, 0), a0: num(g, 50, 0), a1: num(g, 51, 360), layer }); break;
        case "POINT": items.push({ t: "point", p: [num(g, 10, 0), num(g, 20, 0)], layer }); break;
        case "LWPOLYLINE": {
          const v = []; let cur = null;
          for (const [c, val] of g) {
            if (c === 10) { cur = [+val, 0, 0]; v.push(cur); }
            else if (c === 20 && cur) cur[1] = +val;
            else if (c === 42 && cur) cur[2] = +val;
          }
          items.push({ t: "poly", v, closed: (num(g, 70, 0) & 1) === 1, layer }); break;
        }
        case "POLYLINE": {
          const flags = num(g, 70, 0), v = [];
          let j = i + 1;
          for (; j < raw.length && raw[j].type === "VERTEX"; j++) { const q = raw[j].g, vf = num(q, 70, 0); if (vf & 16) continue; v.push([num(q, 10, 0), num(q, 20, 0), num(q, 42, 0)]); }
          if (j < raw.length && raw[j].type === "SEQEND") j++;
          i = j - 1;
          if (flags & (16 | 64)) { skip("POLYLINE (3D mesh)"); break; }
          items.push({ t: "poly", v, closed: (flags & 1) === 1, layer }); break;
        }
        case "SPLINE": {
          const fit = [], ctrl = []; let cf = null, cc = null;
          for (const [c, val] of g) {
            if (c === 11) { cf = [+val, 0]; fit.push(cf); } else if (c === 21 && cf) cf[1] = +val;
            else if (c === 10) { cc = [+val, 0]; ctrl.push(cc); } else if (c === 20 && cc) cc[1] = +val;
          }
          const pts = fit.length >= 2 ? fit : ctrl;
          if (pts.length < 2) { skip("SPLINE"); break; }
          items.push({ t: "spline", pts, closed: (num(g, 70, 0) & 1) === 1, layer }); break;
        }
        case "ELLIPSE": {
          const c = [num(g, 10, 0), num(g, 20, 0)], m = [num(g, 11, 1), num(g, 21, 0)], ratio = num(g, 40, 1), t0 = num(g, 41, 0), t1 = num(g, 42, TAU);
          const R = hyp(m[0], m[1]), rot = Math.atan2(m[1], m[0]);
          const full = Math.abs((t1 - t0) - TAU) < 1e-6 || Math.abs(t1 - t0) < 1e-9;
          if (Math.abs(ratio - 1) < 1e-6) { if (full) items.push({ t: "circle", c, r: R, layer }); else items.push({ t: "arc", c, r: R, a0: deg(t0 + rot), a1: deg(t1 + rot), layer }); break; }
          let span = t1 - t0; if (span <= 0) span += TAU; const n = full ? 16 : Math.max(4, Math.ceil(16 * span / TAU));
          const pts = []; for (let k = 0; k <= n; k++) { const t = t0 + span * k / n, x = R * Math.cos(t), y = R * ratio * Math.sin(t); pts.push([c[0] + x * Math.cos(rot) - y * Math.sin(rot), c[1] + x * Math.sin(rot) + y * Math.cos(rot)]); }
          if (full) pts.pop();
          items.push({ t: "spline", pts, closed: full, layer }); break;
        }
        case "VERTEX": case "SEQEND": break;
        default: skip(E.type);
      }
    }
    // the drawing's extents
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const grow = (p, r) => { const d = r || 0; x0 = Math.min(x0, p[0] - d); y0 = Math.min(y0, p[1] - d); x1 = Math.max(x1, p[0] + d); y1 = Math.max(y1, p[1] + d); };
    for (const it of items) {
      if (it.t === "line") { grow(it.a); grow(it.b); } else if (it.t === "circle") grow(it.c, it.r);
      else if (it.t === "arc") {                          // its ends + the quarter points it passes
        let a1 = it.a1; while (a1 <= it.a0) a1 += 360;
        const at = (d) => [it.c[0] + it.r * Math.cos(d * Math.PI / 180), it.c[1] + it.r * Math.sin(d * Math.PI / 180)];
        grow(at(it.a0)); grow(at(a1));
        for (let q = Math.ceil(it.a0 / 90) * 90; q < a1; q += 90) grow(at(q));
      }
      else if (it.t === "point") grow(it.p); else if (it.t === "poly") it.v.forEach((q) => grow(q)); else if (it.t === "spline") it.pts.forEach((q) => grow(q));
    }
    const bounds = isFinite(x0) ? { x0, y0, x1, y1 } : null;
    return { items, skipped, units, bounds };
  }
  /** a bulge segment p -> q (DXF, y up): {c, r, ccw} | null (straight) */
  function bulgeArc(p, q, b) {
    if (!b || Math.abs(b) < 1e-9) return null;
    const th = 4 * Math.atan(b), dx = q[0] - p[0], dy = q[1] - p[1], c = hyp(dx, dy); if (c < 1e-12) return null;
    const u = [dx / c, dy / c], nL = [-u[1], u[0]], h = (c / 2) / Math.tan(th / 2), m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    return { c: [m[0] + nL[0] * h, m[1] + nL[1] * h], r: Math.abs(c / (2 * Math.sin(th / 2))), ccw: b > 0 };
  }
  function addDXF(s, parsed, o) {
    const S = K(), opt = o || {}, O = S.pt(s, s.origin.pt), B = parsed.bounds;
    if (!parsed.items.length || !B) return { ok: false, why: "nothing to import (no lines, circles, arcs, polylines or splines)" };
    let k = +opt.scale > 0 ? +opt.scale : 1, tx, ty;
    if (opt.place === "fit") {
      const W = opt.w || 1000, H = opt.h || 1000, bw = Math.max(1e-9, B.x1 - B.x0), bh = Math.max(1e-9, B.y1 - B.y0);
      k = Math.min(0.8 * W / bw, 0.8 * H / bh);
      const cx = (B.x0 + B.x1) / 2, cy = (B.y0 + B.y1) / 2;
      tx = W / 2 - cx * k; ty = H / 2 + cy * k;
    } else { tx = O.x; ty = O.y; }
    const M = (p) => [tx + p[0] * k, ty - p[1] * k];
    const byKey = new Map(), before = new Set(s.ents.map((e) => e.id));
    const P = (p) => { const q = M(p), key = Math.round(q[0] * 100) + "," + Math.round(q[1] * 100); if (byKey.has(key)) return byKey.get(key); const id = S.addPoint(s, q[0], q[1]); byKey.set(key, id); return id; };
    const cons = (it) => !!opt.layersAsConstruction && /^(construction|cons|dim|dimensions?|defpoints)$/i.test(it.layer || "");
    // an arc given in DXF terms (centre, radius, start / end anticlockwise, y up) -> the sketch's arc (y down)
    const arcDXF = (c, r, a0d, a1d, cn) => {
      const a0 = a0d * Math.PI / 180, a1 = a1d * Math.PI / 180, sp = [c[0] + r * Math.cos(a0), c[1] + r * Math.sin(a0)], ep = [c[0] + r * Math.cos(a1), c[1] + r * Math.sin(a1)];
      const C = M(c); return S.arc(s, [C[0], C[1]], P(ep), P(sp), cn);
    };
    let n = 0;
    for (const it of parsed.items) {
      const cn = cons(it);
      if (it.t === "line") { const a = P(it.a), b = P(it.b); if (a !== b) { S.line(s, a, b, cn); n++; } }
      else if (it.t === "circle") { if (it.r > 0) { S.circle(s, M(it.c), it.r * k, cn); n++; } }
      else if (it.t === "arc") { if (it.r > 0) { let a1 = it.a1; if (a1 <= it.a0) a1 += 360; if (a1 - it.a0 >= 360 - 1e-9) S.circle(s, M(it.c), it.r * k, cn); else arcDXF(it.c, it.r, it.a0, a1, cn); n++; } }
      else if (it.t === "point") { S.point(s, P(it.p)); n++; }
      else if (it.t === "poly") {
        const v = it.v, m = v.length; if (m < 2) continue;
        const segs = it.closed ? m : m - 1;
        for (let i = 0; i < segs; i++) {
          const p = v[i], q = v[(i + 1) % m], A = bulgeArc(p, q, p[2]);
          if (!A) { const a = P(p), b = P(q); if (a !== b) { S.line(s, a, b, cn); n++; } continue; }
          const C = M(A.c);
          if (A.ccw) S.arc(s, [C[0], C[1]], P(q), P(p), cn); else S.arc(s, [C[0], C[1]], P(p), P(q), cn);
          n++;
        }
      }
      else if (it.t === "spline") {
        const ids = it.pts.map(P).filter((id, i, a) => i === 0 || id !== a[i - 1]);
        if (it.closed && ids.length > 2 && ids[ids.length - 1] === ids[0]) ids.pop();
        if (it.closed && ids.length >= 3) {
          // a closed spline = two open halves meeting at two points (a loop the profiles can follow)
          const h = Math.floor(ids.length / 2); S.spline(s, ids.slice(0, h + 1), cn); S.spline(s, ids.slice(h).concat([ids[0]]), cn); n++;
        } else if (ids.length >= 2) { S.spline(s, ids, cn); n++; }
      }
    }
    S.measure(s);
    return { ok: n > 0, count: n, scale: k, ents: s.ents.filter((e) => !before.has(e.id)).map((e) => e.id), skipped: parsed.skipped };
  }
  const UNIT_NAMES = { 0: "", 1: "in", 2: "ft", 4: "mm", 5: "cm", 6: "m" };

  const PCSketchCAD = { measure, entLength, angleOf, loopStats, loopArea, loopLength, regionAt, toSVG, entD, subD, toDXF, parseDXF, bulgeArc, addDXF, UNITS, UNIT_NAMES, r3 };
  if (typeof module !== "undefined" && module.exports) module.exports = PCSketchCAD;
  else root.PCSketchCAD = PCSketchCAD;
})(typeof window !== "undefined" ? window : globalThis);
