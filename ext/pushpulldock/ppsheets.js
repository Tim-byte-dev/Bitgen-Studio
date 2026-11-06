/* bitGen Studio — ext/pushpulldock/ppsheets.js (2.665.0): 📄 BUILDING PLANS TO SCALE, AS A PDF - window.PPSheets / require().
 *
 * Tim (verbatim): "add a button in sketcher top toolstrip to create building plans - create building plans from sketch to scale
 * and save it to a pdf, allow user to select scale by using, A4, A3,A2,A1 for the scale size, add a title block and dimensions
 * like a professional building plan. bring up a dialog with titlebar for building plans custom so user can check if they want
 * dimensions, all views on 1 a1 page, views of different pages etc"
 *
 * The drawing set (the dialog is ppsheetsdlg.js):
 *   floor plans    one per storey - PPPlan.symbols (walls cut, doors + swings, windows, stairs, furniture, lights) in print
 *                  colours; dimensions: every outside wall face (aligned, in mm, architectural ticks) + the overall width /
 *                  depth; room names, W x L and areas (optional)
 *   elevations     North / East / South / West - the built model (PPArch.build) seen square-on: the faces that look at you,
 *                  far ones first (painter's order), each plane's own outline (edges shared inside one plane are left out);
 *                  the ground line, FFL marks for every storey, the top, the overall height
 *   roof / site    the model from above (roofs, wall tops, pools, driveways) + the ground's contour lines
 *   sheets         A4 / A3 / A2 / A1, landscape or portrait; ALL VIEWS ON ONE SHEET (one scale for all - auto = the largest
 *                  standard scale they all fit at) or ONE VIEW PER PAGE (auto = per page); a border, each view titled with its
 *                  scale, a title block (project, drawing, drawn by, date, scale, sheet n of m, revision, notes, north arrow,
 *                  scale bar)
 * Pure (Node: scripts/test-sheets665.js):
 *   SHEETS, SCALES, defaults(), clean(o), sheetSize(o), views(A, o, deps) -> specs, compose(A, o, deps) -> {pages, scales, fits,
 *   warn}  - a page {w, h (mm), prims: [{t: "poly", rings, fill, stroke, lw} | {t: "line", pts, col, lw, dash} | {t: "text",
 *   x, y, s, str, col, bold, align, vmid, rot}]}, origin bottom-left, y up (the PDF's own way)
 *   drawCanvas(ctx, page, px) the preview;  toPdf(pages, PDFLib, meta) -> Promise<Uint8Array>  (pdf-lib, MIT, static/vendor)
 * deps = {PPArch, PPPlan, PPTerrain, hex(col), footprint(item), label(item)} - the page passes window's, a test passes require's.
 */
(function (root) {
  "use strict";
  const SHEETS = { A4: [297, 210], A3: [420, 297], A2: [594, 420], A1: [841, 594] };
  /** the scales the dialog offers; AUTO is what "auto" tries (largest drawing first) */
  const SCALES = [20, 25, 50, 75, 100, 125, 150, 200, 250, 500];
  const AUTO = [10, 20, 25, 50, 75, 100, 125, 150, 200, 250, 500, 1000, 2000, 5000];
  /** paper text sizes (mm) per sheet: view titles, dimensions, labels, small print */
  const TXT = { A4: { title: 3.2, dim: 1.8, label: 2.0, small: 1.5 }, A3: { title: 3.8, dim: 2.0, label: 2.3, small: 1.7 }, A2: { title: 4.4, dim: 2.4, label: 2.6, small: 1.9 }, A1: { title: 5.0, dim: 2.5, label: 3.0, small: 2.1 } };
  /** the title block (mm) per sheet */
  const TB = { A4: [128, 42], A3: [165, 50], A2: [180, 56], A1: [190, 62] };
  const INK = "#1d1e21", MID = "#6b6d73";
  /** print colours for the plan (PPPlan.symbols' col) */
  const PRINT = { fill: "#ffffff", wall: "#1d1e21", wallIn: "#6b6d73", seam: "#9a9ca2", ink: INK, glass: "#2f7fc4", door: INK, stair: "#45474d", furn: "#6b6d73", light: "#b07c00", slab: "#8d8f95", text: INK, dim: "#55575d" };
  const ORDER = { contour: 2, floor: 3, furn: 4, wall: 5, seam: 5, sym: 6, label: 7 };
  const LW = { contour: 0.13, floor: 0.18, furn: 0.13, wall: 0.35, seam: 0.09, sym: 0.18, label: 0.18 };
  const ELEV = {
    north: { v: [0, 1, 0], u: [-1, 0, 0], w: [0, 0, 1], title: "NORTH ELEVATION" },
    east: { v: [1, 0, 0], u: [0, 1, 0], w: [0, 0, 1], title: "EAST ELEVATION" },
    south: { v: [0, -1, 0], u: [1, 0, 0], w: [0, 0, 1], title: "SOUTH ELEVATION" },
    west: { v: [-1, 0, 0], u: [0, -1, 0], w: [0, 0, 1], title: "WEST ELEVATION" },
    top: { v: [0, 0, 1], u: [1, 0, 0], w: [0, 1, 0], title: "ROOF / SITE PLAN" },
  };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const str = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f]+/g, " ").slice(0, n || 120);

  /* ============================================================ options */
  function defaults() {
    return { sheet: "A3", orient: "landscape", scale: "auto", pages: "one", plans: true, elevations: true, roof: true, dims: true, rooms: true, furniture: true, shade: false,
      project: "", title: "Building plans", drawnBy: "", date: today(), revision: "A", notes: "All dimensions in millimetres. Do not scale from this drawing. Check all dimensions on site before work starts.", file: "" };
  }
  function clean(o0) {
    const o = Object.assign(defaults(), o0 || {});
    if (!SHEETS[o.sheet]) o.sheet = "A3";
    o.orient = o.orient === "portrait" ? "portrait" : "landscape";
    const sc = parseInt(o.scale, 10); o.scale = o.scale === "auto" || !(sc >= 1 && sc <= 100000) ? "auto" : sc;
    o.pages = o.pages === "many" ? "many" : "one";
    ["plans", "elevations", "roof", "dims", "rooms", "furniture", "shade"].forEach((k) => { o[k] = !!o[k]; });
    o.project = str(o.project, 80); o.title = str(o.title, 80); o.drawnBy = str(o.drawnBy, 60); o.date = str(o.date, 30); o.revision = str(o.revision, 12); o.notes = str(o.notes, 400); o.file = str(o.file, 80);
    return o;
  }
  function sheetSize(o) { const s = SHEETS[o.sheet] || SHEETS.A3; return o.orient === "portrait" ? [s[1], s[0]] : [s[0], s[1]]; }

  /* ============================================================ helpers */
  const rgbOf = (h) => { let m = /^#?([0-9a-f]{6})$/i.exec(String(h || "")); if (!m) { const s = /^#?([0-9a-f]{3})$/i.exec(String(h || "")); if (s) m = [0, s[1].split("").map((x) => x + x).join("")]; } if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, k) => { const A = rgbOf(a), B = rgbOf(b); return A && B ? "#" + A.map((v, i) => Math.round(v * (1 - k) + B[i] * k).toString(16).padStart(2, "0")).join("") : b; };
  function boxOf(prims) {
    const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    const add = (x, y) => { if (!Number.isFinite(x) || !Number.isFinite(y)) return; if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y; };
    prims.forEach((p) => {
      if (p.t === "poly") p.rings.forEach((r) => r.forEach((q) => add(q[0], q[1])));
      else if (p.t === "line") p.pts.forEach((q) => add(q[0], q[1]));
      else if (p.t === "text" && p.mw != null) { add(p.x - p.mw, p.y - p.mw); add(p.x + p.mw, p.y + p.mw); }   // its reach (model units)
    });
    return b.x0 <= b.x1 ? b : null;
  }
  const grow = (b, d) => ({ x0: b.x0 - d, y0: b.y0 - d, x1: b.x1 + d, y1: b.y1 + d });
  /** a nice number of mm: 2450 */
  const mm = (m) => String(Math.round(m * 1000));
  /** approximate Helvetica width of a string at size s (the layout only - the renderers measure exactly) */
  const approxW = (t, s, bold) => String(t).length * s * (bold ? 0.6 : 0.54);

  /* ------------------------------------------------------------ dimensions (model units, metres) */
  /** an aligned dimension a -> b, drawn on the side nrm (unit) at off metres; k = metres per paper mm (scale / 1000) */
  function dimLine(a, b, nrm, off, k, ts, out) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) return;
    const d = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], gap = 1.2 * k, ext = 1.6 * k, over = 1.5 * k, tick = 1.3 * k;
    const P = (p, s) => [p[0] + nrm[0] * s, p[1] + nrm[1] * s];
    out.push({ t: "line", pts: [P(a, gap), P(a, off + ext)], col: MID, lw: 0.13 });
    out.push({ t: "line", pts: [P(b, gap), P(b, off + ext)], col: MID, lw: 0.13 });
    const A = P(a, off), B = P(b, off);
    out.push({ t: "line", pts: [[A[0] - d[0] * over, A[1] - d[1] * over], [B[0] + d[0] * over, B[1] + d[1] * over]], col: MID, lw: 0.13 });
    const t45 = [(d[0] + nrm[0]) * Math.SQRT1_2 * tick, (d[1] + nrm[1]) * Math.SQRT1_2 * tick];   // the architectural tick
    [A, B].forEach((q) => out.push({ t: "line", pts: [[q[0] - t45[0], q[1] - t45[1]], [q[0] + t45[0], q[1] + t45[1]]], col: INK, lw: 0.35 }));
    let ang = Math.atan2(d[1], d[0]) * 180 / Math.PI; if (ang > 90.01) ang -= 180; if (ang <= -89.99) ang += 180;
    const ar = ang * Math.PI / 180, up = [-Math.sin(ar), Math.cos(ar)];
    const m = [(A[0] + B[0]) / 2 + up[0] * (0.9 * k + ts * 0.5 * k), (A[1] + B[1]) / 2 + up[1] * (0.9 * k + ts * 0.5 * k)];
    out.push({ t: "text", x: m[0], y: m[1], s: ts, str: mm(L), col: INK, align: "c", vmid: true, rot: ang, mw: 0 });
  }
  const area2 = (r) => { let s = 0; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
  /** a ring without its closing point and without points on a straight run */
  function simplify(r0) {
    let r = r0.slice(); if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r.pop();
    let changed = true;
    while (changed && r.length > 3) {
      changed = false;
      for (let i = 0; i < r.length; i++) {
        const a = r[(i + r.length - 1) % r.length], b = r[i], c = r[(i + 1) % r.length];
        const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
        if (Math.abs(cr) < 1e-7 || Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-5) { r.splice(i, 1); changed = true; break; }
      }
    }
    return r;
  }
  /** the outside of the walls of the storey at z (openings NOT cut - a door must not send the dimensions inside):
   *  -> {rings (each wall shape's outer ring), jambs (every opening's jamb points on the wall faces)} */
  function wallOutline(A, z, deps) {
    const Q = deps.PPArch, pc = root.polygonClipping, hid = Q.hiddenOf(A);
    const rooms = A.rooms.filter((R) => Math.abs(R.z - z) < 0.01 && !hid("room:" + R.id)), ids = new Set(rooms.map((R) => R.id));
    const quads = [], ccw = (q) => (area2(q) < 0 ? q.slice().reverse() : q.slice());
    if (Q.butts) Q.butts(A);                                               // 2.691.0: the ends that butt up to other walls
    rooms.forEach((R) => Q.wallQuads(R).forEach((q) => { if (!hid("room:" + R.id + ":wall:" + q.i)) quads.push(ccw(q.quad)); }));
    if (Q.joints) rooms.forEach((R) => Q.joints(R, (i) => hid("room:" + R.id + ":wall:" + i)).forEach((j) => quads.push(ccw(j.poly))));
    let rings = [];
    if (quads.length && pc) { try { rings = pc.union.apply(null, quads.map((q) => [q.concat([q[0]])])).map((poly) => poly[0]); } catch (e) { rings = []; } }
    if (!rings.length) rings = quads;
    const jambs = [];
    (A.ops || []).forEach((op) => {
      if (!ids.has(op.room) || hid("op:" + op.id)) return;
      const I = Q.opInfo(A, op); if (!I) return;
      [I.x0, I.x1].forEach((x) => [-1, 1].forEach((sd) => jambs.push([I.o[0] + I.u[0] * x + I.nl[0] * sd * I.T / 2, I.o[1] + I.u[1] * x + I.nl[1] * sd * I.T / 2])));
    });
    return { rings, jambs };
  }
  /** the plan's dimensions: the openings along each outside face (a chain), each outside face, the overall width (below) and
   *  depth (left) - three rows outward */
  function planDims(W, scale, ts, out) {
    const k = scale / 1000, off1 = 7 * k, off2 = 14 * k, off3 = 21 * k;
    let bx = null; const faces = [];
    W.rings.forEach((r0) => {
      const r = simplify(r0); if (r.length < 3) return;
      const ccw = area2(r) > 0;
      for (let i = 0; i < r.length; i++) {
        const a = r[i], b = r[(i + 1) % r.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (L < 0.25) continue;                                                    // a jog: not worth a dimension
        const d = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], n = ccw ? [d[1], -d[0]] : [-d[1], d[0]];   // outward
        const ts0 = [0, L];
        W.jambs.forEach((q) => { const t = (q[0] - a[0]) * d[0] + (q[1] - a[1]) * d[1], e = Math.abs((q[0] - a[0]) * d[1] - (q[1] - a[1]) * d[0]); if (e < 0.02 && t > 0.01 && t < L - 0.01) ts0.push(t); });
        const ts1 = ts0.sort((x, y) => x - y).filter((t, j, arr) => !j || t - arr[j - 1] > 0.005);
        if (ts1.length > 2) for (let j = 0; j + 1 < ts1.length; j++) dimLine([a[0] + d[0] * ts1[j], a[1] + d[1] * ts1[j]], [a[0] + d[0] * ts1[j + 1], a[1] + d[1] * ts1[j + 1]], n, off1, k, ts, out);
        dimLine(a, b, n, off2, k, ts, out); faces.push([a, b]);
      }
      r.forEach((p) => { if (!bx) bx = { x0: p[0], y0: p[1], x1: p[0], y1: p[1] }; bx.x0 = Math.min(bx.x0, p[0]); bx.x1 = Math.max(bx.x1, p[0]); bx.y0 = Math.min(bx.y0, p[1]); bx.y1 = Math.max(bx.y1, p[1]); });
    });
    if (!bx) return;
    // the overall size - unless one face already is it (the same line, end to end)
    const same = (p, q) => Math.abs(p[0] - q[0]) < 1e-3 && Math.abs(p[1] - q[1]) < 1e-3;
    const has = (p, q) => faces.some((f) => (same(f[0], p) && same(f[1], q)) || (same(f[0], q) && same(f[1], p)));
    if (!has([bx.x0, bx.y0], [bx.x1, bx.y0])) dimLine([bx.x0, bx.y0], [bx.x1, bx.y0], [0, -1], off3, k, ts, out);
    if (!has([bx.x0, bx.y1], [bx.x0, bx.y0])) dimLine([bx.x0, bx.y1], [bx.x0, bx.y0], [-1, 0], off3, k, ts, out);
  }

  /* ============================================================ the views (model coordinates, metres) */
  /** which views the options ask for: [{kind: "plan", z, title} | {kind: "elev", dir, title}] */
  function views(A, o0, deps) {
    const o = clean(o0), PL = deps.PPPlan, out = [];
    const lv = PL && A ? PL.levels(A) : [];
    if (o.plans) {
      const names = ["GROUND FLOOR PLAN", "FIRST FLOOR PLAN", "SECOND FLOOR PLAN", "THIRD FLOOR PLAN"];
      lv.forEach((z, i) => out.push({ kind: "plan", z, title: lv.length === 1 ? "FLOOR PLAN" : (names[i] || "LEVEL " + i + " PLAN") }));
    }
    if (o.elevations) ["north", "east", "south", "west"].forEach((d) => out.push({ kind: "elev", dir: d, title: ELEV[d].title }));
    if (o.roof) out.push({ kind: "elev", dir: "top", title: ELEV.top.title });
    return out;
  }
  /** a floor plan at scale: {prims, box} - texts carry mw (their reach, metres) for the box */
  function planView(A, spec, o, deps, scale) {
    const PL = deps.PPPlan, k = scale / 1000, T = TXT[o.sheet];
    const S = PL.symbols(A, spec.z, { col: PRINT, hex: deps.hex || null, footprint: o.furniture && deps.footprint ? deps.footprint : null, label: deps.label || null });
    const prims = [];
    const kinds = [];
    S.fills.forEach((f) => {
      let fill = f.col;
      if (f.k === "floor" && !o.shade && !(f.tag && (f.tag.ak === "pool" || f.tag.ak === "drive" || f.tag.ak === "road"))) fill = "#ffffff";
      kinds.push({ o: ORDER[f.k] || 5, sub: 0, p: { t: "poly", rings: f.rings, fill, stroke: f.k === "wall" ? fill : null, lw: f.k === "wall" ? 0.1 : 0 } });
    });
    S.lines.forEach((l) => kinds.push({ o: ORDER[l.k] || 6, sub: 1, p: { t: "line", pts: l.pts, col: l.col, lw: LW[l.k] || 0.18, dash: l.dash ? [1.2, 0.8] : null } }));
    kinds.sort((a, b) => a.o - b.o || a.sub - b.sub).forEach((x) => prims.push(x.p));
    // the texts: a room's name / size / area only when asked; sizes kept readable on paper
    const roomNames = new Set(A.rooms.filter((R) => Math.abs(R.z - spec.z) < 0.01).map((R) => R.name || "Room"));
    let lastRoom = false;
    S.texts.forEach((t) => {
      const isRoom = (t.bold && roomNames.has(t.t)) || (lastRoom && (/ × .* m$/.test(t.t) || / m²$/.test(t.t)));
      lastRoom = isRoom;
      if (isRoom && !o.rooms) return;
      const s = Math.max(T.small * 0.85, Math.min(t.h * 1000 / scale, T.label * (t.h / 0.24) * 1.3));
      prims.push({ t: "text", x: t.p[0], y: t.p[1], s, str: t.t, col: t.col || INK, bold: !!t.bold, align: "c", vmid: true, rot: 0, mw: approxW(t.t, s, t.bold) * k / 2 });
    });
    if (o.dims) {
      planDims(wallOutline(A, spec.z, deps), scale, T.dim, prims);
    }
    return { prims, box: boxOf(prims) };
  }
  /** what PPArch.build makes, the faces looking at the viewer grouped by plane, each plane's outline - painter's order */
  function projGroups(A, dir, deps, o) {
    const D = ELEV[dir], Q = deps.PPArch, B = Q.build(A), groups = new Map();
    const hex = (c) => { const h = deps.hex ? deps.hex(c) : c; return typeof h === "string" && rgbOf(h) ? h : "#d8d4cc"; };
    B.polys.forEach((p) => {
      if (!p.rings || !p.rings.length || !p.n || p.layer === "ceil") return;
      if (p.tag && (p.tag.part === "skirt" || p.tag.part === "cornice" || p.tag.part === "ceil")) return;   // inside the rooms
      const nv = dot(p.n, D.v); if (!(nv > 0.05)) return;                                            // looking away / edge on
      const p0 = p.rings[0][0]; if (!p0) return;
      const key = [r3(p.n[0]), r3(p.n[1]), r3(p.n[2]), r3(dot(p.n, p0))].join(",");
      let g = groups.get(key);
      if (!g) { g = { polys: [], near: Infinity, sum: 0, cnt: 0 }; groups.set(key, g); }
      const rings = p.rings.map((r) => r.map((q) => { const dep = -dot(q, D.v); if (dep < g.near) g.near = dep; g.sum += dep; g.cnt++; return [dot(q, D.u), dot(q, D.w)]; }));
      let fill = "#ffffff";
      if (p.alpha != null && p.alpha < 1) fill = "#d3e3ef";
      else if (o.shade) fill = mix(hex(p.col), "#ffffff", p.tag && p.tag.ak === "roof" ? 0.35 : 0.55);
      g.polys.push({ rings, fill });
    });
    const out = [];
    groups.forEach((g) => { g.mean = g.sum / Math.max(1, g.cnt); g.edges = outline(g.polys); out.push(g); });
    out.sort((a, b) => (Math.abs(a.near - b.near) > 1e-4 ? b.near - a.near : b.mean - a.mean));
    return out;
  }
  /** a plane's outline: every ring edge, the parts covered by an odd number of edges (two faces meeting inside the plane cancel) */
  function outline(polys) {
    const buckets = new Map();
    polys.forEach((p) => p.rings.forEach((r) => {
      for (let i = 0; i < r.length; i++) {
        const a = r[i], b = r[(i + 1) % r.length];
        let dx = b[0] - a[0], dy = b[1] - a[1]; const L = Math.hypot(dx, dy); if (L < 1e-6) continue;
        dx /= L; dy /= L; if (dx < -1e-9 || (Math.abs(dx) < 1e-9 && dy < 0)) { dx = -dx; dy = -dy; }
        const c = -dy * a[0] + dx * a[1], key = Math.round(Math.atan2(dy, dx) * 2000) + "|" + Math.round(c * 2000);
        let bk = buckets.get(key); if (!bk) { bk = { dx, dy, c, iv: [] }; buckets.set(key, bk); }
        const t0 = dx * a[0] + dy * a[1], t1 = dx * b[0] + dy * b[1];
        bk.iv.push([Math.min(t0, t1), Math.max(t0, t1)]);
      }
    }));
    const segs = [];
    buckets.forEach((bk) => {
      const ts = []; bk.iv.forEach((v) => ts.push(v[0], v[1])); ts.sort((a, b) => a - b);
      const u = []; ts.forEach((t) => { if (!u.length || t - u[u.length - 1] > 1e-5) u.push(t); });
      let run = null;
      for (let i = 0; i + 1 < u.length; i++) {
        const m = (u[i] + u[i + 1]) / 2; let n = 0; bk.iv.forEach((v) => { if (v[0] < m && v[1] > m) n++; });
        if (n % 2 === 1) { if (run && Math.abs(run[1] - u[i]) < 1e-5) run[1] = u[i + 1]; else { if (run) segs.push(run.slice()); run = [u[i], u[i + 1]]; } }
        else if (run) { segs.push(run.slice()); run = null; }
      }
      if (run) segs.push(run.slice());
      segs.forEach((s) => { if (!s.done) { s.done = true; s.bk = bk; } });
    });
    return segs.map((s) => { const b = s.bk, P = (t) => [b.dx * t - b.dy * b.c, b.dy * t + b.dx * b.c]; return [P(s[0]), P(s[1])]; });
  }
  /** an elevation / the roof plan at scale */
  function projView(A, spec, o, deps, scale) {
    const k = scale / 1000, T = TXT[o.sheet], prims = [];
    const G = projGroups(A, spec.dir, deps, o);
    // ⛰ the ground's contours under the roof plan
    if (spec.dir === "top" && A.terrain && deps.PPTerrain && deps.PPTerrain.planLines) {
      try { deps.PPTerrain.planLines(A.terrain, { minor: "#b9bbc0", major: MID, drawn: "#2f7fc4", pad: "#b07c00" }).lines.forEach((l) => prims.push({ t: "line", pts: l.pts, col: l.col, lw: 0.13, dash: l.dash ? [1.2, 0.8] : null })); } catch (e) { /* no contours */ }
    }
    G.forEach((g) => {
      g.polys.forEach((p) => prims.push({ t: "poly", rings: p.rings, fill: p.fill, stroke: null, lw: 0 }));
      g.edges.forEach((e) => prims.push({ t: "line", pts: e, col: INK, lw: 0.25 }));
    });
    const body = boxOf(prims);
    if (!body) return { prims, box: null };
    if (spec.dir !== "top") {
      const PL = deps.PPPlan, lv = PL ? PL.levels(A) : [];
      const zg = lv.length ? lv[0] : body.y0;
      prims.push({ t: "line", pts: [[body.x0 - 1.5, zg], [body.x1 + 1.5, zg]], col: INK, lw: 0.6 });   // the ground line
      if (o.dims) {
        const xr = body.x1 + 6 * k, ts = T.dim;
        const mark = (z, label) => {
          prims.push({ t: "line", pts: [[body.x1 + 1.5 * k, z], [xr + 14 * k, z]], col: MID, lw: 0.13, dash: [2, 1] });
          const s = 1.6 * k; prims.push({ t: "poly", rings: [[[xr, z], [xr - s, z + s * 1.4], [xr + s, z + s * 1.4]]], fill: INK, stroke: INK, lw: 0.1 });
          prims.push({ t: "text", x: xr + 2.5 * k, y: z + 1.4 * k, s: ts, str: label, col: INK, align: "l", vmid: false, rot: 0, mw: approxW(label, ts) * k + 3 * k });
        };
        const sign = (v) => (v >= 0 ? "+" : "-") + Math.abs(v).toFixed(3);
        lv.forEach((z, i) => mark(z, "FFL " + sign(z) + (lv.length > 1 ? " (L" + i + ")" : "")));
        if (body.y1 - (lv[lv.length - 1] || zg) > 0.3) mark(body.y1, "TOP " + sign(body.y1));
        if (body.y1 - zg > 0.2) dimLine([body.x0, body.y1], [body.x0, zg], [-1, 0], 8 * k, k, ts, prims);
      }
    }
    return { prims, box: boxOf(prims) };
  }
  function makeView(A, spec, o, deps, scale) {
    const v = spec.kind === "plan" ? planView(A, spec, o, deps, scale) : projView(A, spec, o, deps, scale);
    v.spec = spec; v.scale = scale;
    if (v.box) v.box = grow(v.box, 2 * scale / 1000);
    return v;
  }

  /* ============================================================ sheets */
  function frameOf(o) {
    const [W, H] = sheetSize(o), m = o.sheet === "A4" ? 7 : 10, ml = o.sheet === "A4" ? 10 : 20;   // the binding side wider
    return { W, H, x0: ml, y0: m, x1: W - m, y1: H - m };
  }
  /** a view's paper size at its scale (+ the band under it for its title) */
  function paperOf(v, o) { const k = 1000 / v.scale, T = TXT[o.sheet]; return { w: (v.box.x1 - v.box.x0) * k, h: (v.box.y1 - v.box.y0) * k, th: T.title * 2.8 }; }
  /** rows from the top, left to right; the title block's corner kept free. -> [{v, x, y (its drawing's bottom-left)}] | null */
  function pack(vs, o, F, tb) {
    const gap = o.sheet === "A4" ? 6 : 10, tbTop = F.y0 + tb[1] + gap * 0.5, xs = F.x0 + gap * 0.5, ytop = F.y1 - gap * 0.5, ybot = F.y0 + gap * 0.5;
    const limit = (bottom) => F.x1 - gap * 0.5 - (bottom < tbTop - 1e-6 ? tb[0] + gap * 0.5 : 0);
    const rows = []; let row = null, top = ytop;
    for (const v of vs) {
      const P = paperOf(v, o), w = P.w, h = P.h + P.th;
      if (row) {
        const hh = Math.max(row.h, h);
        if (xs + row.used + gap + w <= limit(top - hh) + 1e-6) { row.items.push({ v, w, h, P }); row.used += gap + w; row.h = hh; continue; }
        rows.push(row); top -= row.h + gap;
      }
      if (xs + w > limit(top - h) + 1e-6) return null;
      row = { items: [{ v, w, h, P }], used: w, h, top };
    }
    if (row) rows.push(row);
    if (!rows.length) return [];
    const last = rows[rows.length - 1]; if (last.top - last.h < ybot - 1e-6) return null;
    // the space left over: shared out between the rows (unless a row would then reach the title block's corner)
    const free = (ytop - ybot) - rows.reduce((s, r) => s + r.h, 0) - gap * (rows.length - 1);
    const lay = (add) => { let y = ytop - add; return rows.map((r) => { const t = y; y -= r.h + gap + add; return t; }); };
    let tops = lay(Math.max(0, free) / (rows.length + 1));
    if (rows.some((r, i) => xs + r.used > limit(tops[i] - r.h) + 1e-6)) tops = lay(0);
    const out = [];
    rows.forEach((r, i) => {
      const lim = limit(tops[i] - r.h), wsum = r.items.reduce((s, it) => s + it.w, 0), sp = (lim - xs - wsum) / (r.items.length + 1);
      let x = xs + sp;
      r.items.forEach((it) => { out.push({ v: it.v, x, y: tops[i] - r.h + it.P.th }); x += it.w + sp; });   // on the row's baseline: the titles in line
    });
    return out;
  }
  /** model -> paper for one placed view */
  function place(v, x, y, prims) {
    const k = 1000 / v.scale, X = (q) => [r3(x + (q[0] - v.box.x0) * k), r3(y + (q[1] - v.box.y0) * k)];
    v.prims.forEach((p) => {
      if (p.t === "poly") prims.push({ t: "poly", rings: p.rings.map((r) => r.map(X)), fill: p.fill, stroke: p.stroke, lw: p.lw });
      else if (p.t === "line") prims.push({ t: "line", pts: p.pts.map(X), col: p.col, lw: p.lw, dash: p.dash || null });
      else if (p.t === "text") { const q = X([p.x, p.y]); prims.push({ t: "text", x: q[0], y: q[1], s: p.s, str: p.str, col: p.col, bold: !!p.bold, align: p.align || "c", vmid: !!p.vmid, rot: p.rot || 0 }); }
    });
  }
  function viewTitle(v, x, y, w, o, prims) {
    const T = TXT[o.sheet], cx = x + w / 2, ty = y - T.title * 1.5, t = v.spec.title, sc = "SCALE 1:" + v.scale;
    const tw = approxW(t, T.title, true);
    prims.push({ t: "text", x: cx, y: ty, s: T.title, str: t, col: INK, bold: true, align: "c", vmid: false, rot: 0 });
    prims.push({ t: "line", pts: [[cx - tw / 2, ty - T.title * 0.32], [cx + tw / 2, ty - T.title * 0.32]], col: INK, lw: 0.35 });
    prims.push({ t: "text", x: cx, y: ty - T.title * 1.25, s: T.small, str: sc, col: MID, align: "c", vmid: false, rot: 0 });
  }
  /** wrap words into lines of at most w mm (approximate widths) */
  function wrap(text, s, w) {
    const lines = []; let cur = "";
    String(text || "").split(/\s+/).filter(Boolean).forEach((word) => { const t = cur ? cur + " " + word : word; if (approxW(t, s) > w && cur) { lines.push(cur); cur = word; } else cur = t; });
    if (cur) lines.push(cur);
    return lines;
  }
  const fitTxt = (t, s, w, bold) => { t = String(t || ""); while (t.length > 1 && approxW(t, s, bold) > w) t = t.slice(0, -2) + "…"; return t; };
  /** the border + the title block */
  function sheetFrame(F, tb, o, info, prims) {
    const T = TXT[o.sheet], R = (x0, y0, x1, y1, lw) => prims.push({ t: "line", pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]], col: INK, lw });
    R(F.x0, F.y0, F.x1, F.y1, 0.5);
    const W = tb[0], H = tb[1], x0 = F.x1 - W, y0 = F.y0, x1 = F.x1, y1 = F.y0 + H;
    prims.push({ t: "poly", rings: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1]]], fill: "#ffffff", stroke: null, lw: 0 });
    R(x0, y0, x1, y1, 0.5);
    // the left cell: north arrow + scale bar
    const cw = W * 0.27, cx = x0 + cw / 2, xs = x0 + cw;
    prims.push({ t: "line", pts: [[xs, y0], [xs, y1]], col: INK, lw: 0.25 });
    const ra = Math.min(cw * 0.22, H * 0.17), ay = y1 - H * 0.08 - ra * 1.2;
    const circ = []; for (let i = 0; i <= 32; i++) { const a = i / 32 * Math.PI * 2; circ.push([cx + ra * Math.cos(a), ay + ra * Math.sin(a)]); }
    prims.push({ t: "line", pts: circ, col: INK, lw: 0.25 });
    prims.push({ t: "poly", rings: [[[cx, ay + ra * 1.05], [cx - ra * 0.38, ay - ra * 0.7], [cx, ay - ra * 0.35]]], fill: INK, stroke: INK, lw: 0.15 });
    prims.push({ t: "poly", rings: [[[cx, ay + ra * 1.05], [cx, ay - ra * 0.35], [cx + ra * 0.38, ay - ra * 0.7]]], fill: "#ffffff", stroke: INK, lw: 0.15 });
    prims.push({ t: "text", x: cx, y: ay + ra * 1.25, s: T.label, str: "N", col: INK, bold: true, align: "c", vmid: false, rot: 0 });
    if (info.scale) {                                                                  // a scale bar: 5 parts of a round length
      const maxMm = cw * 0.8; let Lm = 1; [1, 2, 5, 10, 20, 50, 100, 200, 500].forEach((c) => { if (c * 1000 / info.scale <= maxMm) Lm = c; });
      const bw = Lm * 1000 / info.scale, bx = cx - bw / 2, by = y0 + H * 0.2, bh = Math.min(1.6, H * 0.04);
      for (let i = 0; i < 5; i++) { const a = bx + bw * i / 5, b = bx + bw * (i + 1) / 5; prims.push({ t: "poly", rings: [[[a, by], [b, by], [b, by + bh], [a, by + bh]]], fill: i % 2 ? "#ffffff" : INK, stroke: INK, lw: 0.13 }); }
      prims.push({ t: "text", x: bx, y: by + bh + T.small * 0.5, s: T.small, str: "0", col: INK, align: "c", vmid: false, rot: 0 });
      prims.push({ t: "text", x: bx + bw, y: by + bh + T.small * 0.5, s: T.small, str: Lm + " m", col: INK, align: "c", vmid: false, rot: 0 });
      prims.push({ t: "text", x: cx, y: by - T.small * 1.4, s: T.small, str: "1:" + info.scale + " @ " + o.sheet, col: MID, align: "c", vmid: false, rot: 0 });
    }
    // the right part: rows
    const rows = [0.2, 0.22, 0.16, 0.14, 0.14, 0.14], rx0 = xs, rw = x1 - xs, pad = 1.2;
    let y = y1;
    const cell = (cx0, cw0, yTop, h, label, value, big, bold) => {
      prims.push({ t: "text", x: cx0 + pad, y: yTop - T.small * 1.15, s: T.small * 0.8, str: label, col: MID, align: "l", vmid: false, rot: 0 });
      const vs = Math.min(big ? T.title : T.label, h * 0.5);
      prims.push({ t: "text", x: cx0 + pad, y: yTop - h + h * 0.18, s: vs, str: fitTxt(value, vs, cw0 - pad * 2, bold), col: INK, bold: !!bold, align: "l", vmid: false, rot: 0 });
    };
    rows.forEach((f, i) => {
      const h = H * f, yb = y - h;
      if (i < rows.length - 1) prims.push({ t: "line", pts: [[rx0, yb], [x1, yb]], col: INK, lw: 0.25 });
      if (i === 0) {                                                             // the notes
        prims.push({ t: "text", x: rx0 + pad, y: y - T.small * 1.15, s: T.small * 0.8, str: "NOTES", col: MID, align: "l", vmid: false, rot: 0 });
        const ns = Math.min(T.small, h * 0.24); wrap(o.notes, ns, rw - pad * 2).slice(0, 3).forEach((ln, j) => prims.push({ t: "text", x: rx0 + pad, y: y - T.small * 1.15 - ns * 1.25 * (j + 1), s: ns, str: ln, col: INK, align: "l", vmid: false, rot: 0 }));
      } else if (i === 1) cell(rx0, rw, y, h, "PROJECT", o.project || info.model || "", true, true);
      else if (i === 2) cell(rx0, rw, y, h, "DRAWING", (o.title ? o.title + " - " : "") + info.what, false, true);
      else {
        const half = rw / 2, mx = rx0 + half; prims.push({ t: "line", pts: [[mx, yb], [mx, y]], col: INK, lw: 0.25 });
        if (i === 3) { cell(rx0, half, y, h, "DRAWN BY", o.drawnBy || "-"); cell(mx, half, y, h, "DATE", o.date || "-"); }
        if (i === 4) { cell(rx0, half, y, h, "SCALE", info.scale ? "1:" + info.scale + " @ " + o.sheet : "AS SHOWN @ " + o.sheet); cell(mx, half, y, h, "SHEET", info.n + " OF " + info.of); }
        if (i === 5) { cell(rx0, half, y, h, "REVISION", o.revision || "-"); cell(mx, half, y, h, "DRAWN WITH", "bitGen Studio · Sketcher"); }
      }
      y = yb;
    });
  }

  /** the whole set -> {pages, scales, fits, warn, n (views)} */
  function compose(A, opts, deps) {
    const o = clean(opts), F = frameOf(o), tb = TB[o.sheet].slice();
    if (F.x1 - F.x0 < tb[0] * 1.4) tb[0] = Math.round((F.x1 - F.x0) * 0.62);              // portrait A4: a narrower block
    const specs = A && A.rooms ? views(A, o, deps) : [];
    const res = { pages: [], scales: [], fits: true, warn: "", n: 0 };
    const sheetNote = (warn) => { const p = { w: F.W, h: F.H, prims: [] }; sheetFrame(F, tb, o, { what: "-", n: 1, of: 1, model: o.project }, p.prims); p.prims.push({ t: "text", x: (F.x0 + F.x1) / 2, y: (F.y0 + F.y1) / 2, s: TXT[o.sheet].title, str: warn, col: MID, align: "c", vmid: true, rot: 0 }); res.pages.push(p); res.warn = warn; res.fits = false; return res; };
    if (!specs.length) return sheetNote(A && A.rooms && A.rooms.length ? "Pick at least one view" : "Nothing to draw yet - draw rooms first");
    const build = (s) => specs.map((sp) => makeView(A, sp, o, deps, s)).filter((v) => v.box);
    if (o.pages === "one") {
      const list = o.scale === "auto" ? AUTO : [o.scale];
      let got = null, vs = null, sc = list[list.length - 1];
      for (const s of list) { vs = build(s); if (!vs.length) break; const P = pack(vs, o, F, tb); if (P) { got = P; sc = s; break; } }
      if (!vs || !vs.length) return sheetNote("Nothing to draw yet - draw rooms first");
      if (!got) {                                                                  // it does not fit: drawn anyway (a warning)
        res.fits = false; vs = build(sc);
        res.warn = o.scale === "auto" ? "The views do not fit on " + o.sheet + " - use a bigger sheet or one view per page" : "The views do not fit on " + o.sheet + " at 1:" + sc + " - try a smaller scale (auto), a bigger sheet or one view per page";
        let x = F.x0 + 6, y = F.y1 - 6; got = vs.map((v) => { const P = paperOf(v, o); const it = { v, x, y: y - P.h }; x += P.w + 10; return it; });
      }
      const page = { w: F.W, h: F.H, prims: [] };
      got.forEach((it) => { place(it.v, it.x, it.y, page.prims); viewTitle(it.v, it.x, it.y, paperOf(it.v, o).w, o, page.prims); });
      sheetFrame(F, tb, o, { scale: sc, n: 1, of: 1, what: got.length === 1 ? got[0].v.spec.title : "PLANS, ELEVATIONS", model: o.project }, page.prims);
      res.pages.push(page); res.scales = [sc]; res.n = got.length;
      return res;
    }
    // one view per page: each at its own scale (auto) or the one picked
    const gap = o.sheet === "A4" ? 6 : 10, area = { x0: F.x0 + gap, x1: F.x1 - gap, y0: F.y0 + tb[1] + gap, y1: F.y1 - gap };
    const made = [];
    specs.forEach((sp) => {
      let v = null, sc = o.scale;
      if (o.scale === "auto") {
        for (const s of AUTO) { const t = makeView(A, sp, o, deps, s); if (!t.box) { v = null; break; } const P = paperOf(t, o); if (P.w <= area.x1 - area.x0 && P.h + P.th <= area.y1 - area.y0) { v = t; sc = s; break; } v = t; sc = s; }
      } else v = makeView(A, sp, o, deps, o.scale);
      if (!v || !v.box) return;
      const P = paperOf(v, o), fits = P.w <= area.x1 - area.x0 + 1e-6 && P.h + P.th <= area.y1 - area.y0 + 1e-6;
      if (!fits) { res.fits = false; res.warn = v.spec.title + " does not fit on " + o.sheet + " at 1:" + sc + " - try auto, a smaller scale or a bigger sheet"; }
      made.push({ v, sc, P });
    });
    if (!made.length) return sheetNote("Nothing to draw yet - draw rooms first");
    made.forEach((m, i) => {
      const page = { w: F.W, h: F.H, prims: [] }, x = (area.x0 + area.x1 - m.P.w) / 2, y = area.y0 + m.P.th + Math.max(0, (area.y1 - area.y0 - m.P.h - m.P.th) / 2);
      place(m.v, x, y, page.prims); viewTitle(m.v, x, y, m.P.w, o, page.prims);
      sheetFrame(F, tb, o, { scale: m.sc, n: i + 1, of: made.length, what: m.v.spec.title, model: o.project }, page.prims);
      res.pages.push(page); res.scales.push(m.sc);
    });
    res.n = made.length;
    return res;
  }

  /* ============================================================ renderers */
  const fontCss = (s, bold) => (bold ? "bold " : "") + s + "px Helvetica, Arial, sans-serif";
  /** the preview: page -> a canvas context, px pixels wide */
  function drawCanvas(ctx, page, px) {
    const k = px / page.w, X = (q) => q[0] * k, Y = (q) => (page.h - q[1]) * k;
    ctx.save(); ctx.setLineDash([]); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, page.w * k, page.h * k);
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    page.prims.forEach((p) => {
      if (p.t === "poly") {
        ctx.beginPath(); p.rings.forEach((r) => { r.forEach((q, i) => (i ? ctx.lineTo(X(q), Y(q)) : ctx.moveTo(X(q), Y(q)))); ctx.closePath(); });
        if (p.fill) { ctx.fillStyle = p.fill; ctx.fill("evenodd"); }
        if (p.stroke) { ctx.strokeStyle = p.stroke; ctx.lineWidth = Math.max(0.4, p.lw * k); ctx.setLineDash([]); ctx.stroke(); }
      } else if (p.t === "line") {
        ctx.beginPath(); p.pts.forEach((q, i) => (i ? ctx.lineTo(X(q), Y(q)) : ctx.moveTo(X(q), Y(q))));
        ctx.strokeStyle = p.col; ctx.lineWidth = Math.max(0.35, p.lw * k); ctx.setLineDash(p.dash ? p.dash.map((d) => d * k) : []); ctx.stroke();
      } else if (p.t === "text") {
        ctx.save(); ctx.translate(X([p.x, p.y]), Y([p.x, p.y])); ctx.rotate(-(p.rot || 0) * Math.PI / 180);
        ctx.font = fontCss(p.s * k, p.bold); ctx.fillStyle = p.col || INK; ctx.textBaseline = "alphabetic";
        const w = ctx.measureText(p.str).width, dx = p.align === "c" ? -w / 2 : p.align === "r" ? -w : 0;
        ctx.fillText(p.str, dx, p.vmid ? 0.35 * p.s * k : 0); ctx.restore();
      }
    });
    ctx.restore();
  }
  /** pdf-lib's standard fonts write WinAnsi only - anything else becomes ? (× ² · ° are WinAnsi) */
  const WIN = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
  const winAnsi = (s) => Array.from(String(s)).map((c) => { const n = c.charCodeAt(0); return (n >= 32 && n < 127) || (n >= 160 && n <= 255) || WIN.has(c) ? c : "?"; }).join("");
  /** the pages -> a PDF (bytes); meta {title, author, subject} */
  async function toPdf(pages, L, meta) {
    const PT = 72 / 25.4, doc = await L.PDFDocument.create();
    const m = meta || {};
    doc.setTitle(winAnsi(m.title || "Building plans")); doc.setAuthor(winAnsi(m.author || "")); doc.setSubject(winAnsi(m.subject || "Building plans"));
    doc.setCreator("bitGen Studio - Sketcher"); doc.setProducer("bitGen Studio (pdf-lib)");
    const fR = await doc.embedFont(L.StandardFonts.Helvetica), fB = await doc.embedFont(L.StandardFonts.HelveticaBold);
    const col = (h) => { const c = rgbOf(h) || [0, 0, 0]; return L.rgb(c[0] / 255, c[1] / 255, c[2] / 255); };
    const op = (name) => L.PDFOperator.of(L.PDFOperatorNames[name]);
    for (const pg of pages) {
      const page = doc.addPage([pg.w * PT, pg.h * PT]), ops = [];
      const path = (rings, close) => rings.forEach((r) => { r.forEach((q, i) => ops.push((i ? L.lineTo : L.moveTo)(q[0] * PT, q[1] * PT))); if (close) ops.push(L.closePath()); });
      const flush = () => { if (ops.length) { page.pushOperators(...ops); ops.length = 0; } };
      for (const p of pg.prims) {
        if (p.t === "poly") {
          if (!p.fill && !p.stroke) continue;
          ops.push(L.pushGraphicsState());
          if (p.fill) ops.push(L.setFillingColor(col(p.fill)));
          if (p.stroke) ops.push(L.setStrokingColor(col(p.stroke)), L.setLineWidth(Math.max(0.05, p.lw) * PT), L.setLineJoin(L.LineJoinStyle.Round));
          path(p.rings, true);
          ops.push(op(p.fill && p.stroke ? "FillEvenOddAndStroke" : p.fill ? "FillEvenOdd" : "StrokePath"), L.popGraphicsState());
        } else if (p.t === "line") {
          if (p.pts.length < 2) continue;
          ops.push(L.pushGraphicsState(), L.setStrokingColor(col(p.col)), L.setLineWidth(Math.max(0.05, p.lw) * PT), L.setLineCap(L.LineCapStyle.Round), L.setLineJoin(L.LineJoinStyle.Round));
          if (p.dash) ops.push(L.setDashPattern(p.dash.map((d) => d * PT), 0));
          path([p.pts], false); ops.push(L.stroke(), L.popGraphicsState());
        } else if (p.t === "text") {
          flush();
          const font = p.bold ? fB : fR, s = p.s * PT, t = winAnsi(p.str), w = font.widthOfTextAtSize(t, s);
          const a = (p.rot || 0) * Math.PI / 180, d = [Math.cos(a), Math.sin(a)], up = [-d[1], d[0]];
          const off = p.align === "c" ? -w / 2 : p.align === "r" ? -w : 0, vo = p.vmid ? -0.35 * s : 0;
          page.drawText(t, { x: p.x * PT + d[0] * off + up[0] * vo, y: p.y * PT + d[1] * off + up[1] * vo, size: s, font, color: col(p.col || INK), rotate: L.degrees(p.rot || 0) });
        }
      }
      flush();
    }
    return doc.save();
  }

  const api = { SHEETS, SCALES, AUTO, TXT, TB, ELEV, defaults, clean, sheetSize, views, planView, projView, projGroups, outline, compose, drawCanvas, toPdf, winAnsi, simplify, frameOf, pack };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.PPSheets = api;
})(typeof window !== "undefined" ? window : globalThis);
